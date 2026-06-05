import {
  createContext, useContext, useEffect, useState,
  useCallback, type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../api/supabaseClient";
import { normalizeUsername } from "../api/profileCache";
import { setAuthUser, getAuthUser, type StoredAuthUser } from "../api/authStore";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { dailyLoginImpact } from "../api/impactApi";
import { upsertProfile } from "../api/profileApi";

const BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };
const LS_KEY  = "ff_auth_user_v1"; // localStorage cache key

// ── Helpers ───────────────────────────────────────────────────────────────────

type KVProfile = Partial<StoredAuthUser> & {
  _kvUsername?: string;
  onboardingComplete?: boolean;
  onboardingStep?: string;
};

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
      onboardingComplete: Boolean(p.onboardingComplete),
      onboardingStep: p.onboardingStep as string | undefined || undefined,
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
      onboardingComplete: Boolean(p.onboardingComplete),
      onboardingStep: p.onboardingStep as string | undefined || undefined,
    };
  } catch { return {}; }
}

const hasRealData = (kv: KVProfile) => !!(kv.onboardingDone || kv.objective || kv.avatar);

// Vérifie dans user_profile_page (source de vérité Supabase) si la Phase 1 est complète.
// Utilisé comme filet de sécurité quand le profil KV ne confirme pas l'onboarding
// (nouvel appareil sans cache localStorage, ou KV lent/vide).
async function checkPhase1CompleteFromDB(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("user_profile_page")
      .select("is_phase1_complete")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.is_phase1_complete === true;
  } catch {
    return false;
  }
}

// Race une promesse contre un timeout — renvoie `fallback` si dépassé.
// PERF : garantit que le chemin d'auth ne bloque JAMAIS le rendu indéfiniment.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

type PremiumFields = Pick<StoredAuthUser, "is_premium" | "is_starter" | "subscription_status" | "subscription_plan">;
const FREE_PREMIUM: PremiumFields = { is_premium: false, is_starter: false, subscription_status: "free", subscription_plan: "free" };

async function fetchPremiumFields(userId: string): Promise<PremiumFields> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("is_premium, is_starter, subscription_status, subscription_plan, subscription_current_period_end")
      .eq("id", userId)
      .single();
    if (!data) return FREE_PREMIUM;
    return {
      is_premium:          data.is_premium          ?? false,
      is_starter:          data.is_starter          ?? false,
      subscription_status: data.subscription_status ?? "free",
      subscription_plan:   data.subscription_plan   ?? "free",
    };
  } catch { return FREE_PREMIUM; }
}

async function buildStoredUser(supabaseUser: User): Promise<StoredAuthUser> {
  const meta         = supabaseUser.user_metadata ?? {};
  const authUsername = normalizeUsername(meta.username || supabaseUser.email?.split("@")[0] || "user");
  const nameDefault  = meta.name || meta.username || supabaseUser.email?.split("@")[0] || "Utilisateur";

  // 2,5s timeout — évite de bloquer indéfiniment si le worker KV est lent/cold
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  // PERF : la requête premium est indépendante du KV → on la lance EN PARALLÈLE
  // dès maintenant, bornée à 2,5s. Elle ne rallonge donc pas le chemin critique.
  const premiumPromise = withTimeout(fetchPremiumFields(supabaseUser.id), 2500, FREE_PREMIUM);

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

    // onboarding_complete / onboarding_step — stockés dans le profil KV (comme onboardingDone)
    // Rétrocompat : comptes existants (onboardingDone=true mais onboardingComplete non défini)
    //   → on les envoie direct au chat IA (step='ia'), pas à la page profil
    let onboarding_complete: boolean = Boolean(kv.onboardingComplete);
    let onboarding_step: StoredAuthUser["onboarding_step"] =
      (kv.onboardingStep as StoredAuthUser["onboarding_step"] | undefined) ||
      (kv.onboardingDone ? "ia" : "profile");

    // Filet de sécurité : si KV ne confirme pas l'onboarding, vérifier la DB.
    // user_profile_page.is_phase1_complete est la source de vérité côté serveur.
    // Évite le faux redirect vers /onboarding/ia sur un nouvel appareil (sans cache localStorage)
    // si le flag KV est absent ou si le worker KV a retourné des données incomplètes.
    if (!onboarding_complete) {
      // Timeout 2s — ne bloque jamais le rendu si Supabase est lent
      const dbComplete = await withTimeout(checkPhase1CompleteFromDB(supabaseUser.id), 2000, false);
      if (dbComplete) {
        onboarding_complete = true;
        onboarding_step = "done";
        // Sync KV — évite la rechute au prochain login sur cet appareil
        upsertProfile(authUsername, { onboardingComplete: true, onboardingStep: "done" }).catch(() => {});
      }
    }

    // ── Premium / subscription (déjà en vol depuis le début, parallèle au KV) ──
    const premium = await premiumPromise;

    return {
      supabaseId: supabaseUser.id, username: authUsername,
      name: kv.name || nameDefault, email: supabaseUser.email || "",
      avatar: kv.avatar || "", objective: kv.objective || "",
      streak: kv.streak || 0, onboardingDone: kv.onboardingDone || false, firstPostCreated,
      onboarding_complete,
      onboarding_step,
      ...premium,
    };
  } catch {
    clearTimeout(timer);
    // KV injoignable — lire les flags critiques depuis le localStorage
    // pour ne pas envoyer un utilisateur existant vers l'onboarding.
    let onboardingDone   = false;
    let firstPostCreated = false;
    let cachedAvatar = ""; let cachedObjective = ""; let cachedStreak = 0; let cachedName = nameDefault;
    let onboarding_complete = false;
    let onboarding_step: StoredAuthUser["onboarding_step"] = "profile";
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const c = JSON.parse(raw) as Partial<StoredAuthUser>;
        if (c.supabaseId === supabaseUser.id) {
          onboardingDone         = c.onboardingDone      || false;
          firstPostCreated       = c.firstPostCreated    || false;
          cachedAvatar           = c.avatar              || "";
          cachedObjective        = c.objective           || "";
          cachedStreak           = c.streak              || 0;
          cachedName             = c.name                || nameDefault;
          onboarding_complete = c.onboarding_complete || false;
          onboarding_step     = c.onboarding_step     || (onboardingDone ? "ia" : "profile");
        }
      }
    } catch { /* cache corrompu, valeurs par défaut */ }

    // KV inaccessible + localStorage vide (nouvel appareil) → vérifier la DB
    // pour ne pas rediriger un utilisateur existant vers l'onboarding.
    if (!onboarding_complete) {
      const dbComplete = await withTimeout(checkPhase1CompleteFromDB(supabaseUser.id), 2000, false);
      if (dbComplete) {
        onboarding_complete = true;
        onboarding_step = "done";
        // Sync KV — évite la rechute au prochain login sur cet appareil
        upsertProfile(authUsername, { onboardingComplete: true, onboardingStep: "done" }).catch(() => {});
      }
    }

    // ── Premium / subscription depuis Supabase profiles (catch path) ─────────
    let is_premium = false;
    let is_starter = false;
    let subscription_status: StoredAuthUser["subscription_status"] = "free";
    let subscription_plan: StoredAuthUser["subscription_plan"] = "free";
    try {
      const cachedRaw = localStorage.getItem(LS_KEY);
      if (cachedRaw) {
        const c = JSON.parse(cachedRaw) as Partial<StoredAuthUser>;
        if (c.supabaseId === supabaseUser.id) {
          is_premium          = c.is_premium          ?? false;
          is_starter          = c.is_starter          ?? false;
          subscription_status = c.subscription_status ?? "free";
          subscription_plan   = c.subscription_plan   ?? "free";
        }
      }
    } catch { /* cache corrompu */ }

    return {
      supabaseId: supabaseUser.id, username: authUsername,
      name: cachedName, email: supabaseUser.email || "",
      avatar: cachedAvatar, objective: cachedObjective, streak: cachedStreak,
      onboardingDone, firstPostCreated,
      onboarding_complete,
      onboarding_step,
      is_premium,
      is_starter,
      subscription_status,
      subscription_plan,
    };
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user:                  StoredAuthUser | null;
  session:               Session | null;
  loading:               boolean;
  isRefreshing:          boolean;
  signIn:                (email: string, password: string) => Promise<void>;
  signOut:               () => Promise<void>;
  refreshUserProfile:    () => Promise<void>;
  updateLocalUser:       (updates: Partial<StoredAuthUser>) => void;
  refreshPremiumStatus:  () => Promise<void>;
  devLogin:              () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, session: null, loading: true, isRefreshing: false,
  signIn:                async () => {},
  signOut:               async () => {},
  refreshUserProfile:    async () => {},
  updateLocalUser:       () => {},
  refreshPremiumStatus:  async () => {},
  devLogin:              () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,      setSession]      = useState<Session | null>(null);
  const [user,         setUser]         = useState<StoredAuthUser | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
          // Rafraîchissement silencieux en arrière-plan.
          // On fusionne avec le cache : jamais downgrader onboardingDone/firstPostCreated
          // (protège contre un KV lent qui retournerait false pour un user existant).
          // isRefreshing bloque le Layout guard pendant ce refresh pour éviter un faux
          // redirect vers /onboarding/ia avec des données périmées (cache périmé race condition).
          setIsRefreshing(true);
          buildStoredUser(supabaseUser).then((refreshed) => {
            // Relire le localStorage au moment du merge pour capturer les mises à jour
            // survenues PENDANT le fetch KV (ex: completeOnboarding → updateLocalUser).
            // Sans ça, la closure capture l'ancienne valeur de `cached` et peut écraser
            // onboarding_complete=true fraîchement écrit par completeOnboarding.
            let latest = cached;
            try {
              const latestRaw = localStorage.getItem(LS_KEY);
              if (latestRaw) {
                const parsed = JSON.parse(latestRaw) as StoredAuthUser;
                if (parsed.supabaseId === supabaseUser.id) latest = parsed;
              }
            } catch { /* garde le cached si localStorage corrompu */ }

            const merged: StoredAuthUser = {
              ...refreshed,
              // Booléens critiques : ne jamais downgrader
              onboardingDone:      latest.onboardingDone      || refreshed.onboardingDone,
              firstPostCreated:    latest.firstPostCreated    || refreshed.firstPostCreated,
              onboarding_complete: latest.onboarding_complete || refreshed.onboarding_complete,
              onboarding_step:     refreshed.onboarding_step  || latest.onboarding_step || "profile",
              // Champs texte : préférer latest si non vide (protège contre KV stale
              // écrasant un updateLocalUser survenu pendant le fetch — BUG-05)
              avatar:    latest.avatar    || refreshed.avatar,
              name:      latest.name      || refreshed.name,
              objective: latest.objective || refreshed.objective,
              streak:    Math.max(latest.streak || 0, refreshed.streak || 0),
            };
            setAuthUser(merged);
            setUser(merged);
            localStorage.setItem(LS_KEY, JSON.stringify(merged));
          }).catch(() => { /* échec réseau → on garde le cache intact */ })
            .finally(() => { setIsRefreshing(false); });
          return;
        }
      }
    } catch { /* cache corrompu, on ignore */ }

    // ── Rafraîchissement silencieux en arrière-plan ───────────────────────────
    // (Ce bloc est aussi le chemin "pas de cache → fetch bloquant",
    //  mais sans cache on doit await pour avoir loading=false.)
    // Attention : ne jamais downgrader onboardingDone/firstPostCreated de true→false
    const stored = await buildStoredUser(supabaseUser);
    const safeStored: StoredAuthUser = {
      ...stored,
      onboardingDone:      stored.onboardingDone      || false,
      firstPostCreated:    stored.firstPostCreated    || false,
      onboarding_complete: stored.onboarding_complete || false,
      onboarding_step:     stored.onboarding_step     || "profile",
    };
    setAuthUser(safeStored);
    setUser(safeStored);
    localStorage.setItem(LS_KEY, JSON.stringify(safeStored));
  }, []);

  useEffect(() => {
    // Failsafe : si Supabase/réseau ne répond pas dans les 5s,
    // on force loading=false pour ne pas bloquer l'app indéfiniment.
    const failsafe = setTimeout(() => setLoading(false), 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        setSession(sess);
        await applyUser(sess?.user ?? null);
        setLoading(false);
        clearTimeout(failsafe);
        // Connexion quotidienne Impact (+1/j, max 7/sem) — fire-and-forget
        if (sess?.user) {
          const username = normalizeUsername(
            sess.user.user_metadata?.username || sess.user.email?.split("@")[0] || ""
          );
          if (username) dailyLoginImpact(username).catch(() => {});
        }
      }
    );
    return () => { subscription.unsubscribe(); clearTimeout(failsafe); };
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
    // Persister dans le localStorage pour que le prochain chargement
    // voit les bonnes valeurs (onboardingDone, firstPostCreated, etc.)
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  }, []);

  const refreshPremiumStatus = useCallback(async () => {
    const current = getAuthUser();
    if (!current?.supabaseId) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("is_premium, is_starter, subscription_status, subscription_plan, subscription_current_period_end")
        .eq("id", current.supabaseId)
        .single();
      if (data) {
        updateLocalUser({
          is_premium:          data.is_premium          ?? false,
          is_starter:          data.is_starter          ?? false,
          subscription_status: data.subscription_status ?? "free",
          subscription_plan:   data.subscription_plan   ?? "free",
        });
      }
    } catch { /* réseau inaccessible — on conserve les valeurs actuelles */ }
  }, [updateLocalUser]);

  const devLogin = useCallback(async () => {
    // SEC-03 : interdit en production — uniquement disponible en développement local
    if (!import.meta.env.DEV) {
      console.error("[devLogin] Interdit en production. Cette fonction ne doit jamais être appelée hors dev.");
      return;
    }
    try {
      // Charger le vrai profil "leo" depuis Supabase KV
      const res = await fetch(`${BASE}/profiles/leo`, { headers: HEADERS });
      if (res.ok) {
        const data = await res.json();
        const p = data?.profile;
        if (p) {
          const leoUser: StoredAuthUser = {
            supabaseId:          "leo-dev-bypass",
            username:            "leo",
            name:                p.name              || "Leo",
            email:               p.email             || "leo@futurfeed.com",
            avatar:              p.avatar            || "",
            objective:           p.objective         || "",
            streak:              p.streak            || 0,
            onboardingDone:      true,
            firstPostCreated:    p.firstPostCreated  || false,
            onboarding_complete: true,
            onboarding_step:     "done",
          };
          setAuthUser(leoUser);
          setUser(leoUser);
          return;
        }
      }
    } catch { /* fallback */ }
    // Fallback si KV inaccessible
    const leoUser: StoredAuthUser = {
      supabaseId:          "leo-dev-bypass",
      username:            "leo",
      name:                "Leo",
      email:               "leo@futurfeed.com",
      avatar:              "",
      objective:           "",
      streak:              0,
      onboardingDone:      true,
      firstPostCreated:    false,
      onboarding_complete: true,
      onboarding_step:     "done",
    };
    setAuthUser(leoUser);
    setUser(leoUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, isRefreshing, signIn, signOut, refreshUserProfile, updateLocalUser, refreshPremiumStatus, devLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Standalone helper — re-queries the Supabase profiles table and syncs
 * premium fields into the local auth store via updateLocalUser.
 * Call this after a successful checkout, webhook confirmation, etc.
 */
export function useRefreshPremiumStatus() {
  const { refreshPremiumStatus } = useContext(AuthContext);
  return refreshPremiumStatus;
}