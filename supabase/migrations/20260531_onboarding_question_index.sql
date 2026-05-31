-- Migration : tracker l'index de question onboarding dans user_profile_page
-- 0 = pas commencé, 1-12 = question en cours, 13 = récap affiché, 14 = validé

ALTER TABLE user_profile_page
  ADD COLUMN IF NOT EXISTS onboarding_question_index integer DEFAULT 0;

-- Remplir les lignes existantes avec 0 (déjà fait par DEFAULT, mais explicite)
UPDATE user_profile_page
  SET onboarding_question_index = 0
  WHERE onboarding_question_index IS NULL;
