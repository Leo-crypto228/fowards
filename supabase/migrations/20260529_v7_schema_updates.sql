-- ============================================================
-- Migration V7 — Colonnes supplémentaires + trigger posts
-- Date : 2026-05-29
-- ============================================================

-- ── 1. Colonnes supplémentaires sur conversations ────────────
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS message_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT,
  ADD COLUMN IF NOT EXISTS has_final_diagnostic BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Colonnes tokens sur messages ──────────────────────────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS tokens_input INT,
  ADD COLUMN IF NOT EXISTS tokens_output INT;

-- ── 3. Trigger — déblocage diagnostic via post ≥50 chars ─────
-- Se déclenche après chaque INSERT sur posts (posts normaux uniquement)
-- Les Ways sont dans une table séparée — ce trigger ne les touche pas

CREATE OR REPLACE FUNCTION on_post_created_unlock_diagnostic()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier que le post a au moins 50 caractères de contenu
  -- Le champ de contenu dans la table posts est "description"
  IF LENGTH(TRIM(COALESCE(NEW.description, ''))) >= 50 THEN
    INSERT INTO user_quotas (
      user_id,
      quota_date,
      normal_messages_used,
      diagnostics_used,
      diagnostics_unlocked_via_post
    )
    VALUES (
      NEW.user_id,
      CURRENT_DATE,
      0,
      0,
      1
    )
    ON CONFLICT (user_id, quota_date)
    DO UPDATE SET
      diagnostics_unlocked_via_post = LEAST(
        user_quotas.diagnostics_unlocked_via_post + 1,
        1  -- max 1 unlock via post par jour
      ),
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger uniquement s'il n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_unlock_diagnostic_on_post'
  ) THEN
    CREATE TRIGGER trigger_unlock_diagnostic_on_post
      AFTER INSERT ON posts
      FOR EACH ROW EXECUTE FUNCTION on_post_created_unlock_diagnostic();
  END IF;
END;
$$;
