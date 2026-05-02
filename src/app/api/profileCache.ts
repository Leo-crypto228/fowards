/**
 * profileCache — Cache mémoire de profils Supabase.
 * Utilisé par ProgressCard pour afficher des données fraîches (avatar, objectif, streak, abonnés).
 */
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { fetchWithRetry } from "./fetchRetry";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

/** Normalise un username : lowercase, sans accents, sans espaces (ASCII safe) */
export function normalizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprime les diacritiques
    .replace(/\s+/g, "")             // supprime les espaces
    .replace(/[^a-z0-9_-]/g, "");    // garde seulement les caractères sûrs
}

export interface CachedProfile {
  avatar: string;
  objective: string;
  streak: number;
  followers: number;
  name: string;
}

// Mémoire partagée entre tous les composants
const cache = new Map<string, CachedProfile>();
const pending = new Map<string, Promise<CachedProfile | null>>();

/** Récupère le profil depuis le cache ou Supabase */
export async function fetchProfile(username: string): Promise<CachedProfile | null> {
  if (!username) return null;
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  if (cache.has(normalized)) return cache.get(normalized)!;
  if (pending.has(normalized)) return pending.get(normalized)!;

  const promise = fetchWithRetry(`${BASE}/profiles/${encodeURIComponent(normalized)}`, { headers: HEADERS })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data?.profile) return null;
      const p = data.profile;
      const profile: CachedProfile = {
        avatar: p.avatar || "",
        objective: p.objective || "",
        streak: p.streak || 0,
        followers: p.followersCount || 0,
        name: p.name || normalized,
      };
      cache.set(normalized, profile);
      return profile;
    })
    .catch((err) => {
      console.error(`profileCache: échec récupération profil ${normalized}:`, err);
      return null;
    })
    .finally(() => pending.delete(normalized));

  pending.set(normalized, promise);
  return promise;
}

/** Lecture synchrone du cache (sans fetch) */
export function getCachedProfile(username: string): CachedProfile | undefined {
  return cache.get(normalizeUsername(username));
}

/** Invalide le cache d'un profil (après modification) */
export function invalidateProfile(username: string) {
  cache.delete(normalizeUsername(username));
}