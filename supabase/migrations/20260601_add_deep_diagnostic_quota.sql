ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS deep_diagnostic_used_this_week boolean DEFAULT false;
ALTER TABLE user_quotas ADD COLUMN IF NOT EXISTS deep_diagnostic_week_start date;
