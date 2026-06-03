import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/ai-fowards`;

function makeHeaders(accessToken?: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken ?? publicAnonKey}`,
  };
}

// Fetch avec timeout — évite les requêtes bloquées indéfiniment (cold start, réseau lent)
function fetchT(url: string, options: RequestInit, ms = 15_000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// Warm-up — réveille les deux edge functions en arrière-plan dès l'import du module
// (appelé une seule fois au démarrage de l'app, pas d'await)
(function warmUpEdgeFunctions() {
  const anonHeader = { Authorization: `Bearer ${publicAnonKey}` };
  fetch(`${BASE}/ping`, { headers: anonHeader }).catch(() => {});
  fetch(`https://${projectId}.supabase.co/functions/v1/make-server-218684af/ping`, {
    headers: anonHeader,
  }).catch(() => {});
})();

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatMode = "normal" | "diagnostic" | "diagnostic_approfondi";

export interface QuotaStatus {
  normalUsed: number;
  normalLimit: number;
  normalRemaining: number;
  diagnosticsUsed: number;
  diagnosticsLimit: number;      // 0 pour Premium
  diagnosticsRemaining: number;
  diagnosticsUnlockedViaPost: boolean;
  canSendNormal: boolean;
  canSendDiagnostic: boolean;
  isPhase1Complete: boolean;
  // Premium — Diagnostic Approfondi (4/jour)
  deepDiagnosticsUsedToday: number;
  deepDiagnosticsLimit: number;  // 4 Premium, 0 Free
  deepDiagnosticsRemaining: number;
  canSendDeepDiagnostic: boolean;
  // Plan
  plan?: "free" | "starter" | "premium";
  is_premium?: boolean;
  is_starter?: boolean;
  premium_expires_at?: string | null;
}

export interface AiConversation {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: ChatMode;
  fowards_data: Record<string, unknown> | null;
  community_button_text?: string | null;
  created_at: string;
}

export interface ChoicesBlock {
  type: "single" | "multi";
  choices: string[];
}

export interface ProfilePage {
  contentMarkdown: string;
  isPhase1Complete: boolean;
  phase1CompletedAt: string | null;
  lastUpdatedAt: string;
  aiUpdateCount: number;
  userUpdateCount: number;
}

export interface ChatResponse {
  conversationId: string;
  message: string;
  forwardsData: Record<string, unknown> | null;
  choices: ChoicesBlock | null;
  mode: ChatMode;
  isPhase1JustCompleted: boolean;
  community_button_text?: string | null;
  quota: QuotaStatus;
}

// Nettoie le texte partiel streamé : retire les blocs techniques complets et
// tronque un bloc ouvert mais pas encore fermé (évite tout flash de balise).
export function cleanPartialStream(t: string): string {
  let s = t
    .replace(/<fowards-data>[\s\S]*?<\/fowards-data>/g, "")
    .replace(/<profile-update>[\s\S]*?<\/profile-update>/g, "")
    .replace(/<choices[\s\S]*?<\/choices>/g, "")
    .replace(/<community-button>[\s\S]*?<\/community-button>/g, "");
  const open = s.search(/<(fowards-data|profile-update|choices|community-button)\b/);
  if (open !== -1) s = s.slice(0, open);
  return s;
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getQuotaStatus(accessToken: string): Promise<QuotaStatus> {
  const res = await fetchT(`${BASE}/quota-status`, {
    headers: makeHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`quota-status ${res.status}`);
  return res.json();
}

export async function getConversations(accessToken: string): Promise<AiConversation[]> {
  const res = await fetchT(`${BASE}/conversations`, {
    headers: makeHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`conversations ${res.status}`);
  const data = await res.json();
  return data.conversations ?? [];
}

export async function getConversation(
  accessToken: string,
  conversationId: string,
): Promise<{ conversation: AiConversation; messages: AiMessage[] }> {
  const res = await fetchT(`${BASE}/conversations/${conversationId}`, {
    headers: makeHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`conversations/${conversationId} ${res.status}`);
  return res.json();
}

export async function sendMessage(
  accessToken: string,
  payload: {
    conversationId?: string;
    message: string;
    mode: ChatMode;
    is_onboarding_trigger?: boolean;
  },
): Promise<ChatResponse> {
  const res = await fetchT(`${BASE}/chat`, {
    method: "POST",
    headers: makeHeaders(accessToken),
    body: JSON.stringify(payload),
  }, 30_000); // 30s — cold start Deno + appel Gemini (non-streaming)
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error ?? `chat ${res.status}`) as Error & {
      quotaExceeded?: boolean;
      quota?: QuotaStatus;
    };
    err.quotaExceeded = data.quotaExceeded ?? false;
    err.quota = data.quota;
    throw err;
  }
  return data as ChatResponse;
}

// ── Streaming chat — SSE, chunks en temps réel ───────────────────────────────
// onChunk reçoit le texte accumulé à chaque chunk (pas juste le delta).
// Retourne la réponse finale identique à sendMessage une fois le stream terminé.
export async function sendMessageStream(
  accessToken: string,
  payload: {
    conversationId?: string;
    message: string;
    mode: ChatMode;
    is_onboarding_trigger?: boolean;
  },
  onChunk: (accumulatedText: string) => void,
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: makeHeaders(accessToken),
    body: JSON.stringify({ ...payload, stream: true }),
  });

  // Erreurs HTTP (401, 429, 500…) — réponse JSON non-streaming
  if (!res.ok) {
    const data = await res.json();
    const err = new Error(data.error ?? `chat ${res.status}`) as Error & {
      quotaExceeded?: boolean;
      quota?: QuotaStatus;
    };
    err.quotaExceeded = data.quotaExceeded ?? false;
    err.quota = data.quota;
    throw err;
  }

  // Fallback : si l'edge function renvoie du JSON classique (ancien déploiement sans streaming),
  // on simule un seul chunk avec le message complet → compatibilité garantie
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json() as ChatResponse;
    onChunk(data.message ?? "");
    return data;
  }

  // Chemin streaming SSE
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;

      try {
        const event = JSON.parse(jsonStr) as Record<string, unknown>;

        if (event.error) throw new Error(event.error as string);

        if (typeof event.chunk === "string") {
          accText += event.chunk;
          onChunk(cleanPartialStream(accText));
        }

        if (event.done === true) {
          return event as unknown as ChatResponse;
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue; // ligne SSE malformée
        throw e; // vraie erreur (event.error)
      }
    }
  }

  throw new Error("Stream terminé sans données finales");
}

export async function deleteConversation(
  accessToken: string,
  conversationId: string,
): Promise<void> {
  const res = await fetchT(`${BASE}/conversations/${conversationId}`, {
    method: "DELETE",
    headers: makeHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`delete conversation ${res.status}`);
}

export async function getProfile(accessToken: string): Promise<ProfilePage> {
  const res = await fetchT(`${BASE}/profile`, {
    headers: makeHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`profile GET ${res.status}`);
  return res.json();
}

export async function updateProfile(
  accessToken: string,
  contentMarkdown: string,
): Promise<void> {
  const res = await fetchT(`${BASE}/profile`, {
    method: "PUT",
    headers: makeHeaders(accessToken),
    body: JSON.stringify({ contentMarkdown }),
  });
  if (!res.ok) throw new Error(`profile PUT ${res.status}`);
}

export async function createCheckoutSession(
  token: string,
  plan: "starter_monthly" | "starter_annual" | "premium_monthly" | "premium_annual",
): Promise<{ url: string }> {
  const res = await fetchT(
    `https://${projectId}.supabase.co/functions/v1/create-checkout-session`,
    {
      method: "POST",
      headers: makeHeaders(token),
      body: JSON.stringify({
        plan,
        success_url: "https://fowards.net/premium/success",
        cancel_url: "https://fowards.net/premium",
      }),
    },
    30_000, // cold start Supabase Edge Function peut prendre ~20s
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `create-checkout-session ${res.status}`);
  }
  return res.json();
}

export async function createPortalSession(token: string): Promise<{ url: string }> {
  const res = await fetchT(
    `https://${projectId}.supabase.co/functions/v1/create-portal-session`,
    {
      method: "POST",
      headers: makeHeaders(token),
    },
  );
  if (!res.ok) throw new Error(`create-portal-session ${res.status}`);
  return res.json();
}

// ── Filet de sécurité onboarding — appelé au clic "Accéder à Fowards" ─────────
// Garantit que is_phase1_complete = true en DB même si Gemini n'a pas émis le bloc.
// Idempotent : sans effet si déjà complet.
export async function completePhase1(accessToken: string): Promise<void> {
  const res = await fetchT(`${BASE}/complete-phase1`, {
    method: "POST",
    headers: makeHeaders(accessToken),
  }, 8_000); // timeout court — c'est un safety net, pas bloquant
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `complete-phase1 ${res.status}`);
  }
}
