-- =============================================================
-- Migration : Conformité Supabase – permissions explicites (Mai 2026)
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- =============================================================
-- Après le 30 mai 2026, les nouvelles tables ne sont plus
-- exposées automatiquement. Ce fichier rend le projet conforme :
-- GRANT explicites + RLS activé + policies adaptées au contexte.
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- TABLE 1 : kv_store_218684af
-- Rôle : store clé-valeur interne, accédé UNIQUEMENT par les
--        edge functions via SUPABASE_SERVICE_ROLE_KEY.
-- Jamais exposé au browser (ni anon, ni authenticated).
-- service_role bypasse RLS nativement → les edge functions
-- continuent de fonctionner sans aucune policy.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.kv_store_218684af ENABLE ROW LEVEL SECURITY;

-- Aucune policy = deny all pour anon + authenticated.
-- service_role bypasse RLS et conserve un accès total.
-- Résultat : table inaccessible depuis le browser, pleinement
-- accessible depuis les edge functions. ✓


-- ─────────────────────────────────────────────────────────────
-- TABLE 2 : comment_reactions
-- Rôle : réactions (Actionnable / Motivant) sur les commentaires.
-- Accédée depuis le browser via supabase-js (clé anon publique).
-- Schéma :
--   comment_id   TEXT    NOT NULL
--   user_id      UUID    NOT NULL  →  auth.users(id)
--   reaction_type TEXT   NOT NULL  CHECK ('Actionnable','Motivant')
--   created_at   TIMESTAMPTZ DEFAULT now()
--   PRIMARY KEY (comment_id, user_id)
-- ─────────────────────────────────────────────────────────────

-- Créer la table si elle n'existe pas encore
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  comment_id    TEXT        NOT NULL,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT        NOT NULL CHECK (reaction_type IN ('Actionnable', 'Motivant')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

-- Index pour accélérer la lecture par commentaire
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id
  ON public.comment_reactions (comment_id);

-- GRANTs explicites
-- anon   : lecture seule (afficher les compteurs sans être connecté)
-- authenticated : lecture + écriture de ses propres réactions
-- service_role  : accès complet (edge functions, triggers)
GRANT SELECT
  ON public.comment_reactions TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.comment_reactions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.comment_reactions TO service_role;

-- Activer RLS
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- Policy : lecture publique (comptes de réactions visibles par tous)
CREATE POLICY "comment_reactions_select_public"
  ON public.comment_reactions
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy : un utilisateur connecté ne peut insérer QUE ses propres réactions
CREATE POLICY "comment_reactions_insert_own"
  ON public.comment_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy : un utilisateur connecté ne peut supprimer QUE ses propres réactions
CREATE POLICY "comment_reactions_delete_own"
  ON public.comment_reactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy : un utilisateur connecté ne peut modifier QUE ses propres réactions
CREATE POLICY "comment_reactions_update_own"
  ON public.comment_reactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- =============================================================
-- RÉSUMÉ
-- kv_store_218684af : RLS activé, 0 policy → inaccessible
--   depuis le browser, service_role bypasse RLS ✓
-- comment_reactions : créée si absente, RLS + GRANT + 4 policies
--   SELECT public, INSERT/UPDATE/DELETE owner-only ✓
-- =============================================================
