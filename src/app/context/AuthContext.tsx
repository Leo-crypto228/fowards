import {
  createContext, useContext, useEffect, useState,
  useCallback, type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../api/supabaseClient";
import { normalizeUsername } from "../api/profileCache";
import { setAuthUser, getAuthUser, type StoredAuthUser } from "../api/authStore";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };
const LS_KEY  = "ff_auth_user_v1"; // localStorage cache key

// ── Helpers ───────────────────────────────────────────────────────────────────

type KVProfile = Partial<StoredAuthUser> & { _kvUsername?: string };

async function loadKVProfile(username: string, signal: AbortSignal): Promise<KVProfile> {
  try {
    const res = await fetch(`${BASE}/profiles/${encodeURIComponent(username)}`, { headers: HEADERS, signal });
    if (!res.ok) return {};
    const data = await res.json();
    const p = data?.profile;
    if (!p) return {};
    const firstPostCreated =
      p.firstPostCreated !== undefined ? Boolean(p.firstPostCreated) : Boolean(p.onboardingDone);
    return {
      avatar: p.avatar || "", objective: p.objective || "", streak: p.streak || 0,
      name: p.name || username, onboardingDone: Boolean(p.onboardingDone),
      firstPostCreated, _kvUsername: username,
    };
  } catch { return {}; }
}

async function loadKVProfileByUID(supabaseId: string, signal: AbortSignal): Promise<KVProfile> {
  try {
    const res = await fetch(`${BASE}/profiles/by-uid/${encodeURIComponent(supabaseId)}`, { headers: HEADERS, signal });
    if (!res.ok) return {};
    const data = await res.json();
    if (!data?.found || !data?.profile) return {};
    const p = data.profile;
    const kvUsername = data.kvUsername || "";
    const firstPostCreated =
      p.firstPostCreated !== undefined ? Boolean(p.firstPostCreated) : Boolean(p.onboardingDone);
    return {
      avatar: p.avatar || "", objective: p.objective || "", streak: p.streak || 0,
      name: p.name || kvUsername, onboardingDone: Boolean(p.onboardingDone),
      firstPostCreated, _kvUsername: kvUsername,
    };
  } catch { return {}; }
}

const hasRealData = (kv: KVProfile) => !!(kv.onboardingDone || kv.objective || kv.avatar);

async function buildStoredUser(supabaseUser: User): Promise<StoredAuthUser> {
  const meta         = supabaseUser.user_metadata ?? {};
  const authUsername = normalizeUsername(meta.username || supabaseUser.email?.split("@")[0] || "user");
  const nameDefault  = meta.name || meta.username || supabaseUser.email?.split("@")[0] || "Utilisateur";

  // 5s timeout — évite de bloquer indéfiniment si le worker KV est lent/cold
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    // Les deux fetches en parallèle (gagne ~300-800ms sur le cas nominal)
    const [byUsername, byUID] = await Promise.all([
      loadKVProfile(authUsername, controller.signal),
      loadKVProfileByUID(supabaseUser.id, controller.signal),
    ]);
    clearTimeout(timer);

    let kv: KVProfile = hasRealData(byUsername) ? byUsername
      : hasRealData(byUID) ? byUID
      : byUsername;

    // Profil trouvé sous un ancien pseudo → rename en arrière-plan
    if (!hasRealData(byUsername) && byUID._kvUsername && byUID._kvUsername !== authUsername) {
      fetch(`${BASE}/profiles/${encodeURIComponent(byUID._kvUsername)}/rename`, {
        method: "PUT", headers: HEADERS,
        body: JSON.stringify({ newUsername: authUsername, supabaseId: supabaseUser.id }),
      }).catch((e) => console.warn("Rename profil KV failed:", e));
      kv = byUID;
    }

    const firstPostCreated = kv.firstPostCreated !== undefined ? kv.firstPostCreated : Boolean(kv.onboardingDone);
    return {
      supabaseId: supabaseUser.id, username: authUsername,
      name: kv.name || nameDefault, email: supabaseUser.email || "",
      avatar: kv.avatar || "", objective: kv.objective || "",
      streak: kv.streak || 0, onboardingDone: kv.onboardingDone || false, firstPostCreated,
    };
  } catch {
    clearTimeout(timer);
    // KV injoignable (timeout ou réseau) — retourner un utilisateur minimal
    // onboardingDone: false → redirige vers onboarding si c'est un nouvel utilisateur
    // Pour un utilisateur existant avec cache, ce code n'est jamais atteint
    return {
      supabaseId: supabaseUser.id, username: authUsername,
      name: nameDefault, email: supabaseUser.email || "",
      avatar: "", objective: "", streak: 0,
      onboardingDone: false, firstPostCreated: false,
    };
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user:                StoredAuthUser | null;
  session:             Session | null;
  loading:             boolean;
  signIn:              (email: string, password: string) => Promise<void>;
  signOut:             () => Promise<void>;
  refreshUserProfile:  () => Promise<void>;
  updateLocalUser:     (updates: Partial<StoredAuthUser>) => void;
  devLogin:            () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, session: null, loading: true,
  signIn:             async () => {},
  signOut:            async () => {},
  refreshUserProfile: async () => {},
  updateLocalUser:    () => {},
  devLogin:           () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user,    setUser]    = useState<StoredAuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback(async (supabaseUser: User | null) => {
    if (!supabaseUser) {
      setAuthUser(null);
      setUser(null);
      localStorage.removeItem(LS_KEY);
      return;
    }

    // ── Lecture du cache localStorage ────────────────────────────────────────
    // Si un profil est déjà mis en cache pour cet utilisateur, on l'affiche
    // immédiatement et on rafraîchit en arrière-plan → chargement instantané.
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as StoredAuthUser;
        if (cached.supabaseId === supabaseUser.id) {
          setAuthUser(cached);
          setUser(cached);
          setLoading(false);
          // Rafraîchissement silencieux en arrière-plan
          buildStoredUser(supabaseUser).then((refreshed) => {
            setAuthUser(refreshed);
            setUser(refreshed);
            localStorage.setItem(LS_KEY, JSON.stringify(refreshed));
          }).catch(() => {});
          return;
        }
      }
    } catch { /* cache corrompu, on ignore */ }

    // ── Première connexion (pas de cache) : fetch bloquant ───────────────────
    const stored = await buildStoredUser(supabaseUser);
    setAuthUser(stored);
    setUser(stored);
    localStorage.setItem(LS_KEY, JSON.stringify(stored));
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        setSession(sess);
        await applyUser(sess?.user ?? null);
        setLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, [applyUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setUser(null);
    localStorage.removeItem(LS_KEY);
    sessionStorage.removeItem("ff_verify_email");
    sessionStorage.removeItem("ff_verify_mode");
  }, []);

  const refreshUserProfile = useCallback(async () => {
    const sess = (await supabase.auth.getSession()).data.session;
    if (sess?.user) await applyUser(sess.user);
  }, [applyUser]);

  const updateLocalUser = useCallback((updates: Partial<StoredAuthUser>) => {
    const current = getAuthUser();
    if (!current) return;
    const updated = { ...current, ...updates };
    setAuthUser(updated);
    setUser(updated);
  }, []);

  const devLogin = useCallback(async () => {
    try {
      // Charger le vrai profil "leo" depuis Supabase KV
      const res = await fetch(`${BASE}/profiles/leo`, { headers: HEADERS });
      if (res.ok) {
        const data = await res.json();
        const p = data?.profile;
        if (p) {
          const leoUser: StoredAuthUser = {
            supabaseId:     "leo-dev-bypass",
            username:       "leo",
            name:           p.name           || "Leo",
            email:          p.email          || "leo@futurfeed.com",
            avatar:         p.avatar         || "",
            objective:      p.objective      || "",
            streak:         p.streak         || 0,
            onboardingDone: true,
            firstPostCreated: p.firstPostCreated || false,
          };
          setAuthUser(leoUser);
          setUser(leoUser);
          return;
        }
      }
    } catch { /* fallback */ }
    // Fallback si KV inaccessible
    const leoUser: StoredAuthUser = {
      supabaseId:     "leo-dev-bypass",
      username:       "leo",
      name:           "Leo",
      email:          "leo@futurfeed.com",
      avatar:         "",
      objective:      "",
      streak:         0,
      onboardingDone: true,
      firstPostCreated: false,
    };
    setAuthUser(leoUser);
    setUser(leoUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut, refreshUserProfile, updateLocalUser, devLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}