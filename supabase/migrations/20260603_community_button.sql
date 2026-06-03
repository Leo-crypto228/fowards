-- ============================================================
-- Migration : Bouton "Poste ta situation" dans la conversation IA
-- Date       : 2026-06-03
-- ============================================================
-- Persiste le texte du bouton communauté suggéré par l'IA, attaché
-- au message assistant. Permet au bouton de rester visible au reload
-- / scroll (lu depuis messages.community_button_text).
-- ============================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS community_button_text text;
