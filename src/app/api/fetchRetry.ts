/**
 * fetchWithRetry — Retente automatiquement les appels réseau qui échouent
 * avec un délai exponentiel. Gère les erreurs "Failed to fetch" qui surviennent
 * lors du cold-start des Supabase Edge Functions ou d'un redéploiement.
 * Chaque tentative est limitée à `timeoutMs` ms pour éviter les blocages.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2,
  baseDelayMs = 800,
  timeoutMs = 12_000,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      // Pas de retry sur la dernière tentative
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelayMs * (attempt + 1))
        );
      }
    }
  }

  throw lastError;
}
