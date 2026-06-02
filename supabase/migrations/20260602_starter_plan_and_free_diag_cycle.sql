-- ============================================================
-- Migration : Plan Starter + cycle diagnostic Free 3 jours
-- Date       : 2026-06-02
-- ============================================================
-- 1. Étend subscription_plan aux 4 plans payants (+ migre les valeurs
--    Premium existantes 'monthly'/'annual' → 'premium_*')
-- 2. Redéfinit is_premium (plan-aware, corrige la faille Starter)
--    + ajoute is_starter
-- 3. Cycle diagnostic Free 3 jours (1 base + 1 bonus post) sur profiles
-- 4. Réécrit le trigger post-unlock → bonus cycle-aware sur profiles
-- ============================================================

-- ── 1. subscription_plan : étendre + migrer l'existant ──────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;

UPDATE profiles SET subscription_plan = 'premium_monthly' WHERE subscription_plan = 'monthly';
UPDATE profiles SET subscription_plan = 'premium_annual'  WHERE subscription_plan = 'annual';

ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_plan_check
  CHECK (subscription_plan IN (
    'free',
    'starter_monthly', 'starter_annual',
    'premium_monthly', 'premium_annual'
  ));

-- ── 2. Colonnes générées plan-aware ─────────────────────────────────────────
-- is_premium était (subscription_status = 'active') → un Starter actif passait
-- premium = true. On le redéfinit. DROP obligatoire (ADD IF NOT EXISTS ne
-- redéfinit pas une colonne générée existante).
ALTER TABLE profiles DROP COLUMN IF EXISTS is_premium;
ALTER TABLE profiles DROP COLUMN IF EXISTS is_starter;

ALTER TABLE profiles
  ADD COLUMN is_premium boolean GENERATED ALWAYS AS
    (subscription_status = 'active' AND subscription_plan LIKE 'premium%') STORED,
  ADD COLUMN is_starter boolean GENERATED ALWAYS AS
    (subscription_status = 'active' AND subscription_plan LIKE 'starter%') STORED;

-- ── 3. Cycle diagnostic Free (3 jours glissants) ────────────────────────────
-- free_diag_cycle_start : début du cycle de 3 jours courant
-- free_diag_used        : diagnostics consommés dans le cycle (0..2)
-- free_diag_post_bonus  : 1 si un post a débloqué le bonus ce cycle (max 1)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS free_diag_cycle_start date,
  ADD COLUMN IF NOT EXISTS free_diag_used        int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_diag_post_bonus  int DEFAULT 0;

-- ── 4. Trigger post-unlock → bonus cycle-aware sur profiles ─────────────────
-- Remplace l'ancienne logique journalière (user_quotas). Un post normal ≥50
-- caractères accorde +1 diagnostic, plafonné à 1 bonus par cycle de 3 jours.
CREATE OR REPLACE FUNCTION on_post_created_unlock_diagnostic()
RETURNS TRIGGER AS $$
BEGIN
  IF LENGTH(TRIM(COALESCE(NEW.description, ''))) >= 50 THEN
    UPDATE profiles SET
      -- si cycle absent ou expiré (≥3 jours), on en démarre un neuf
      free_diag_cycle_start = CASE
        WHEN free_diag_cycle_start IS NULL OR free_diag_cycle_start <= CURRENT_DATE - 3
        THEN CURRENT_DATE ELSE free_diag_cycle_start END,
      free_diag_used = CASE
        WHEN free_diag_cycle_start IS NULL OR free_diag_cycle_start <= CURRENT_DATE - 3
        THEN 0 ELSE free_diag_used END,
      free_diag_post_bonus = 1  -- idempotent : un seul bonus par cycle
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Le trigger trigger_unlock_diagnostic_on_post existe déjà et pointe vers
-- cette fonction (CREATE OR REPLACE conserve le binding). Rien à recréer.
