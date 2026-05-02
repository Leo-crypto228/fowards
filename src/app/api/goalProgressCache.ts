/**
 * goalProgressCache — Cache mémoire de la progression d'objectif par auteur.
 * Utilise getBatchGoalProgress pour éviter les appels redondants.
 */
import { getBatchGoalProgress } from "./progressionApi";

const cache = new Map<string, number>(); // username -> progress 0-100
const pending = new Map<string, Promise<number>>();

/**
 * Retourne le pourcentage de progression (0-100) de l'objectif principal
 * d'un utilisateur identifié par son username normalisé.
 */
export async function fetchAuthorGoalProgress(username: string): Promise<number> {
  if (!username) return 0;
  const key = username.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key)!;
  if (pending.has(key)) return pending.get(key)!;

  const promise = getBatchGoalProgress([key])
    .then((map) => {
      const pct = map[key]?.progress ?? 0;
      cache.set(key, pct);
      return pct;
    })
    .catch(() => 0)
    .finally(() => pending.delete(key));

  pending.set(key, promise);
  return promise;
}

/** Lecture synchrone (sans fetch) — retourne undefined si pas en cache */
export function getCachedGoalProgress(username: string): number | undefined {
  return cache.get(username.toLowerCase().trim());
}

/** Invalide le cache pour un utilisateur (après mise à jour) */
export function invalidateGoalProgress(username: string) {
  cache.delete(username.toLowerCase().trim());
}
