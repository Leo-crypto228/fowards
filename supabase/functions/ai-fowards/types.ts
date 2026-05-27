// ── Types partagés pour l'edge function ai-fowards ───────────────────────────

export type MessageRole = "user" | "assistant";
export type ChatMode = "normal" | "diagnostic";

export interface DbMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  mode: ChatMode;
  fowards_data: Record<string, unknown> | null;
  created_at: string;
}

export interface DbConversation {
  id: string;
  user_id: string;
  title: string;
  last_message_at: string;
  created_at: string;
}

export interface DbUserQuota {
  id: string;
  user_id: string;
  quota_date: string;
  normal_messages_used: number;
  diagnostics_used: number;
  diagnostics_unlocked_via_post: number;
  created_at: string;
  updated_at: string;
}

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
}

// Gemini API types
export interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface GeminiRequest {
  system_instruction: { parts: Array<{ text: string }> };
  contents: GeminiContent[];
  generationConfig: {
    temperature: number;
    topK: number;
    topP: number;
    maxOutputTokens: number;
  };
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}
