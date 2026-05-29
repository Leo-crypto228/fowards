import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/ai-fowards`;

function makeHeaders(accessToken?: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken ?? publicAnonKey}`,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatMode = "normal" | "diagnostic";

export interface QuotaStatus {
  normalUsed: number;
  normalLimit: number;
  normalRemaining: number;
  diagnosticsUsed: number;
  diagnosticsLimit: number;
  diagnosticsRemaining: number;
  diagnosticsUnlockedViaPost: boolean;
  canSendNormal: boolean;
  canSendDiagnostic: boolean;
  // V6
  isPhase1Complete: boolean;
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
  quota: QuotaStatus;
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getQuotaStatus(accessToken: string): Promise<QuotaStatus> {
  const res = await fetch(`${BASE}/quota-status`, {
    headers: makeHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`quota-status ${res.status}`);
  return res.json();
}

export async function getConversations(accessToken: string): Promise<AiConversation[]> {
  const res = await fetch(`${BASE}/conversations`, {
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
  const res = await fetch(`${BASE}/conversations/${conversationId}`, {
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
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: makeHeaders(accessToken),
    body: JSON.stringify(payload),
  });
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

export async function deleteConversation(
  accessToken: string,
  conversationId: string,
): Promise<void> {
  const res = await fetch(`${BASE}/conversations/${conversationId}`, {
    method: "DELETE",
    headers: makeHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`delete conversation ${res.status}`);
}

export async function getProfile(accessToken: string): Promise<ProfilePage> {
  const res = await fetch(`${BASE}/profile`, {
    headers: makeHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`profile GET ${res.status}`);
  return res.json();
}

export async function updateProfile(
  accessToken: string,
  contentMarkdown: string,
): Promise<void> {
  const res = await fetch(`${BASE}/profile`, {
    method: "PUT",
    headers: makeHeaders(accessToken),
    body: JSON.stringify({ contentMarkdown }),
  });
  if (!res.ok) throw new Error(`profile PUT ${res.status}`);
}
