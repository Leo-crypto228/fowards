-- ============================================================
-- Migration : Fowards IA — tables coach business
-- Date       : 2026-05-27
-- ============================================================

-- ── 1. user_profile_founder ──────────────────────────────────────────────────
-- Profil founder collecté par l'IA (rêve, temps dispo, situation de vie)
CREATE TABLE IF NOT EXISTS user_profile_founder (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reve       TEXT,                    -- rêve/objectif concret de l'user
  temps_dispo TEXT,                   -- temps disponible (ex: "2h/jour, 14h/sem")
  situation  TEXT,                    -- situation de vie (étudiant/salarié, logement, pression financière)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── 2. conversations ─────────────────────────────────────────────────────────
-- Une conversation = une session de coaching IA
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'Nouvelle conversation',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(user_id, last_message_at DESC);

-- ── 3. messages ──────────────────────────────────────────────────────────────
-- Messages dans une conversation (user + assistant)
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,      -- contenu affiché à l'user (sans balises fowards-data)
  mode            TEXT NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal', 'diagnostic')),
  fowards_data    JSONB,              -- données JSON parsées depuis <fowards-data>...</fowards-data>
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);

-- ── 4. user_quotas ───────────────────────────────────────────────────────────
-- Quotas journaliers par user (reset à 00:01 UTC+0 chaque jour)
CREATE TABLE IF NOT EXISTS user_quotas (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_date                      DATE NOT NULL DEFAULT CURRENT_DATE,
  normal_messages_used            INT NOT NULL DEFAULT 0,
  diagnostics_used                INT NOT NULL DEFAULT 0,
  diagnostics_unlocked_via_post   INT NOT NULL DEFAULT 0,  -- 0 ou 1 (max 1 unlock/jour)
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quota_date)
);

CREATE INDEX IF NOT EXISTS idx_user_quotas_user_date ON user_quotas(user_id, quota_date);

-- ── 5. Triggers updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_user_profile_founder'
  ) THEN
    CREATE TRIGGER set_updated_at_user_profile_founder
      BEFORE UPDATE ON user_profile_founder
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_user_quotas'
  ) THEN
    CREATE TRIGGER set_updated_at_user_quotas
      BEFORE UPDATE ON user_quotas
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END;
$$;

-- ── 6. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE user_profile_founder ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas           ENABLE ROW LEVEL SECURITY;

-- user_profile_founder: lecture et écriture sur son propre profil
CREATE POLICY "user_profile_founder_select" ON user_profile_founder
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_profile_founder_insert" ON user_profile_founder
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_profile_founder_update" ON user_profile_founder
  FOR UPDATE USING (auth.uid() = user_id);

-- conversations: lecture et écriture sur ses propres conversations
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "conversations_delete" ON conversations
  FOR DELETE USING (auth.uid() = user_id);

-- messages: lecture et écriture sur ses propres messages
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING (auth.uid() = user_id);

-- user_quotas: lecture sur ses propres quotas (écriture via service role uniquement)
CREATE POLICY "user_quotas_select" ON user_quotas
  FOR SELECT USING (auth.uid() = user_id);
