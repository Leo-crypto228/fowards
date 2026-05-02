/**
 * fetchWithRetry — Retente automatiquement les appels réseau qui échouent
 * avec un délai exponentiel. Gère les erreurs "Failed to fetch" qui surviennent
 * lors du cold-start des Supabase Edge Functions ou d'une redéployiement.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2,
  baseDelayMs = 800,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
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
