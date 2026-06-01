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
  deep_diagnostics_used_today: number; // reset automatique via quota_date
  created_at: string;
  updated_at: string;
}

export interface QuotaStatus {
  normalUsed: number;
  normalLimit: number;
  normalRemaining: number;
  diagnosticsUsed: number;
  diagnosticsLimit: number;      // 0 pour Premium (pas de diag normal)
  diagnosticsRemaining: number;
  diagnosticsUnlockedViaPost: boolean;
  canSendNormal: boolean;
  canSendDiagnostic: boolean;
  // V6 — état Phase 1
  isPhase1Complete: boolean;
  // Premium — Diagnostic Approfondi (4/jour)
  deepDiagnosticsUsedToday: number;
  deepDiagnosticsLimit: number;  // 4 pour Premium, 0 pour Free
  deepDiagnosticsRemaining: number;
  canSendDeepDiagnostic: boolean;
  // Champs plan
  plan?: "free" | "premium";
  is_premium?: boolean;
  premium_expires_at?: string | null;
}

// ── V6 — user_profile_page ────────────────────────────────────────────────────

export interface DbUserProfilePage {
  id: string;
  user_id: string;
  content_markdown: string;
  is_phase1_complete: boolean;
  phase1_completed_at: string | null;
  last_updated_by: "ai" | "user" | "system" | null;
  last_updated_at: string;
  ai_update_count: number;
  user_update_count: number;
  onboarding_question_index: number;
  created_at: string;
}

/** Shape retournée au client */
export interface ProfilePage {
  contentMarkdown: string;
  isPhase1Complete: boolean;
  phase1CompletedAt: string | null;
  lastUpdatedAt: string;
  aiUpdateCount: number;
  userUpdateCount: number;
}

/** <choices> block parsé depuis la réponse Gemini */
export interface ChoicesBlock {
  type: "single" | "multi";
  choices: string[];
}

/** <profile-update> block parsé depuis la réponse Gemini — V8 union type */
export type ProfileUpdateBlock =
  | {
      type: "initial_profile_complete";
      sections: {
        identite: string;
        business: string;
        temps_dispo: string;
        reve: string;
        blocage_principal: string;
        points_a_creuser: string[];
      };
    }
  | {
      type: "diagnostic_completed";
      diagnostic_entry: {
        date: string;
        sujet: string;
        diagnostic_resume: string;
        action_decidee: string;
        status: string;
      };
    }
  | {
      type: "action_status_update";
      action_date: string;
      new_status: string;
      resultat_reporte?: string;
    }
  | {
      type: "section_correction";
      section: string;
      new_content: string;
    };

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
