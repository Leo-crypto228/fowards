import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { GLOBAL_PROFILES_MAP, KnownProfile, registerProfile } from "../data/profiles";
import { useAuth } from "./AuthContext";

// ── Re-export MY_USER_ID live binding depuis authStore ─────────────────────────
export { MY_USER_ID } from "../api/authStore";

// ── Base URL & headers ─────────────────────────────────────────────────────────
const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface FollowContextValue {
  followed: Set<string>;
  isFollowing: (username: string) => boolean;
  follow: (username: string) => void;
  unfollow: (username: string) => void;
  toggleFollow: (username: string) => Promise<void>;
  followedList: string[];
  loading: boolean;
  /** Récupère le profil d'un utilisateur suivi (depuis le registre centralisé) */
  getFollowedProfile: (username: string) => (KnownProfile & { username: string }) | null;
  /** Enregistre un profil dynamique */
  registerFollowedProfile: (username: string, data: KnownProfile) => void;
  /** Username de l'utilisateur connecté (réactif) */
  currentUserId: string;
}

const DEFAULT_VALUE: FollowContextValue = {
  followed: new Set(),
  isFollowing: () => false,
  follow: () => {},
  unfollow: () => {},
  toggleFollow: () => Promise.resolve(),
  followedList: [],
  loading: false,
  getFollowedProfile: () => null,
  registerFollowedProfile: () => {},
  currentUserId: "",
};

const FollowContext = createContext<FollowContextValue>(DEFAULT_VALUE);

// ── Helpers fetch ─────────────────────────────────────────────────────────────

async function fetchFollowing(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const res = await fetch(
      `${BASE}/follows/${encodeURIComponent(userId)}/following`,
      { headers: HEADERS }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.following as string[]) ?? [];
  } catch {
    return [];
  }
}

async function fetchToggleFollow(
  followerId: string,
  followingId: string
): Promise<boolean> {
  const res = await fetch(`${BASE}/follows`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ followerId, followingId }),
  });
  if (!res.ok) throw new Error(`Erreur serveur ${res.status}`);
  const data = await res.json();
  return (data as { following: boolean }).following;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function FollowProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const currentUserId = user?.username ?? "";

  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const prevUserIdRef = useRef<string>("");

  // Recharger les follows quand l'utilisateur connecté change
  useEffect(() => {
    // Si le userId est vide ou identique au précédent, ne rien faire
    if (!currentUserId) {
      setFollowed(new Set());
      setLoading(false);
      return;
    }
    if (currentUserId === prevUserIdRef.current) return;
    prevUserIdRef.current = currentUserId;

    setLoading(true);
    fetchFollowing(currentUserId)
      .then((ids) => {
        setFollowed(new Set(ids));
      })
      .catch((err) => {
        console.error("FollowContext: chargement follows échoué:", err);
      })
      .finally(() => setLoading(false));
  }, [currentUserId]);

  const isFollowing = useCallback(
    (username: string) => followed.has(username),
    [followed]
  );

  const follow = useCallback((username: string) => {
    setFollowed((prev) => new Set([...prev, username]));
  }, []);

  const unfollow = useCallback((username: string) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      next.delete(username);
      return next;
    });
  }, []);

  // Toggle optimiste + persistance Supabase async
  const toggleFollow = useCallback(
    (username: string): Promise<void> => {
      if (!username || username === currentUserId) return Promise.resolve();

      const wasFollowing = followed.has(username);

      // Mise à jour optimiste immédiate
      setFollowed((prev) => {
        const next = new Set(prev);
        if (next.has(username)) next.delete(username);
        else next.add(username);
        return next;
      });

      // Persistance async
      return fetchToggleFollow(currentUserId, username)
        .then((nowFollowing) => {
          setFollowed((prev) => {
            const next = new Set(prev);
            if (nowFollowing) next.add(username);
            else next.delete(username);
            return next;
          });
        })
        .catch((err) => {
          console.error("FollowContext: toggle follow échoué:", err);
          // Rollback
          setFollowed((prev) => {
            const next = new Set(prev);
            if (wasFollowing) next.add(username);
            else next.delete(username);
            return next;
          });
        });
    },
    [followed, currentUserId]
  );

  const getFollowedProfile = useCallback(
    (username: string): (KnownProfile & { username: string }) | null => {
      const key = username.toLowerCase().replace(/\s+/g, "");
      const data = GLOBAL_PROFILES_MAP.get(key);
      if (!data) return null;
      return { ...data, username: key };
    },
    []
  );

  const registerFollowedProfile = useCallback(
    (username: string, data: KnownProfile) => {
      registerProfile(username, data);
    },
    []
  );

  const followedList = Array.from(followed);

  return (
    <FollowContext.Provider
      value={{
        followed,
        isFollowing,
        follow,
        unfollow,
        toggleFollow,
        followedList,
        loading,
        getFollowedProfile,
        registerFollowedProfile,
        currentUserId,
      }}
    >
      {children}
    </FollowContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFollow() {
  return useContext(FollowContext);
}
