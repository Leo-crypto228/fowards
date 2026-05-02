import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";

/** Singleton Supabase JS client (frontend) */
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Disable tab-lock to prevent orphaned lock warnings in single-tab apps
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
  }
);