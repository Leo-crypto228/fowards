-- ============================================================
-- Migration : user_profile_page — mémoire IA V6
-- Date       : 2026-05-28
-- ============================================================
-- Stocke la "page profil" markdown de l'utilisateur,
-- gérée par l'IA (via <profile-update>) et potentiellement l'user.
-- is_phase1_complete bloque le Diagnostic tant que le bilan initial
-- (12 questions Phase 1) n'est pas terminé.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profile_page (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_markdown     TEXT NOT NULL DEFAULT '',
  is_phase1_complete   BOOLEAN NOT NULL DEFAULT false,
  phase1_completed_at  TIMESTAMPTZ,
  last_updated_by      TEXT CHECK (last_updated_by IN ('ai', 'user', 'system')),
  last_updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ai_update_count      INT NOT NULL DEFAULT 0,
  user_update_count    INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profile_page_user ON user_profile_page(user_id);

-- ── Trigger updated_at (réutilise la fonction existante) ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_user_profile_page'
  ) THEN
    CREATE TRIGGER set_updated_at_user_profile_page
      BEFORE UPDATE ON user_profile_page
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END;
$$;

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE user_profile_page ENABLE ROW LEVEL SECURITY;

-- L'user peut lire et mettre à jour son propre profil (insert via service role à la 1ère session)
CREATE POLICY "user_profile_page_select" ON user_profile_page
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_profile_page_insert" ON user_profile_page
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profile_page_update" ON user_profile_page
  FOR UPDATE USING (auth.uid() = user_id);
