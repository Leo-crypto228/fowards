/**
 * authStore — Source de vérité globale pour l'utilisateur authentifié.
 * ES module live bindings : les imports sont automatiquement mis à jour.
 */

export interface StoredAuthUser {
  supabaseId: string;
  username: string;      // username normalisé (clé KV, ex: "thomasdubois")
  name: string;          // nom affiché (ex: "Thomas Dubois")
  email: string;
  avatar: string;
  objective: string;
  streak: number;
  onboardingDone: boolean;
  firstPostCreated: boolean;
}

// ── Valeurs mutable live-bindable ──────────────────────────────────────────────
export let MY_USER_ID       = "";
export let MY_USER_NAME     = "";
export let MY_USER_AVATAR   = "";
export let MY_USER_OBJECTIVE = "";
export let MY_USER_STREAK   = 0;

let _currentUser: StoredAuthUser | null = null;

export function setAuthUser(user: StoredAuthUser | null): void {
  _currentUser      = user;
  MY_USER_ID        = user?.username        ?? "";
  MY_USER_NAME      = user?.name            ?? "";
  MY_USER_AVATAR    = user?.avatar          ?? "";
  MY_USER_OBJECTIVE = user?.objective       ?? "";
  MY_USER_STREAK    = user?.streak          ?? 0;
}

export function getAuthUser(): StoredAuthUser | null {
  return _currentUser;
}

export function updateAuthUserField<K extends keyof StoredAuthUser>(
  key: K,
  value: StoredAuthUser[K]
): void {
  if (!_currentUser) return;
  (_currentUser as StoredAuthUser)[key] = value;
  setAuthUser(_currentUser); // re-sync live bindings
}
