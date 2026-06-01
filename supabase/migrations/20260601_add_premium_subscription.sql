ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'past_due', 'canceled', 'trialing'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'free' CHECK (subscription_plan IN ('free', 'monthly', 'annual'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium boolean GENERATED ALWAYS AS (subscription_status = 'active') STORED;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);
