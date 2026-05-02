import { projectId, publicAnonKey } from "/utils/supabase/info";
import { normalizeUsername } from "./profileCache";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  username: string;
  name: string;
  handle: string;
  avatar: string;
  banner: string;
  bio: string;
  objective: string;
  objectiveDesc: string;
  descriptor: string;
  hashtags: string[];
  streak: number;
  constance: number;
  progressPct: number;
  objectifsAccomplis: number;
  daysOnFF: number;
  // enrichi côté serveur
  postsCount: number;
  followersCount: number;
  followingCount: number;
  joinedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ProfileUpdatePayload = Partial<Omit<UserProfile, "postsCount" | "followersCount" | "followingCount" | "joinedAt">>;

// ── API ─────────────────────────────────────────────────────��────────────────

/** Récupère un profil depuis Supabase KV */
export async function getProfile(username: string): Promise<{ profile: UserProfile; found: boolean }> {
  const res = await fetch(
    `${BASE}/profiles/${encodeURIComponent(normalizeUsername(username))}`,
    { headers: HEADERS }
  );
  if (res.status === 404) return { profile: null as unknown as UserProfile, found: false };
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur profil (${res.status})`);
  }
  return res.json();
}

/** Crée ou met à jour un profil dans Supabase KV */
export async function upsertProfile(
  username: string,
  data: ProfileUpdatePayload
): Promise<UserProfile> {
  const res = await fetch(
    `${BASE}/profiles/${encodeURIComponent(normalizeUsername(username))}`,
    {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur mise à jour profil (${res.status})`);
  }
  const data2 = await res.json();
  return data2.profile;
}

/** Seed un profil si inexistant */
export async function seedProfileIfNeeded(
  username: string,
  defaults: ProfileUpdatePayload
): Promise<UserProfile> {
  const { found, profile } = await getProfile(username);
  if (found) return profile;
  return upsertProfile(username, defaults);
}

/** Upload une image (avatar ou bannière) vers Supabase Storage */
export async function uploadProfileImage(
  file: File,
  type: "avatar" | "banner",
  username: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  formData.append("username", username.toLowerCase());

  const res = await fetch(`${BASE}/upload/profile-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${publicAnonKey}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur upload (${res.status})`);
  }
  const data = await res.json();
  return data.url as string;
}