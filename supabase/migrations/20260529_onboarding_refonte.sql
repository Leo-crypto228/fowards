-- Migration : Refonte onboarding
-- Crée la table profiles (état onboarding) et enrichit conversations

-- ── Table profiles ────────────────────────────────────────────────────────────
-- Utilisée UNIQUEMENT pour l'état onboarding (pas les données KV).
-- id = auth.users.id (même UUID)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_complete boolean     NOT NULL DEFAULT false,
  onboarding_step     text        NOT NULL DEFAULT 'profile',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- L'utilisateur peut lire/écrire son propre profil
CREATE POLICY "profiles_self_rw" ON public.profiles
  USING       (id = auth.uid())
  WITH CHECK  (id = auth.uid());

-- Service role bypass RLS nativement (edge functions)

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

-- Index
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles (id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profiles_updated_at();

-- ── Table conversations : ajoute type ─────────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'normal';
