import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

export interface AccessRequest {
  id: string;
  visitorId: string;
  ownerId: string;
  status: "pending" | "accepted" | "refused";
  createdAt: string;
  updatedAt: string;
  visitorName?: string;
  visitorAvatar?: string;
  visitorObjective?: string;
  timestamp?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: "access_request" | "access_accepted" | "access_refused";
  requestId?: string;
  visitorId?: string;
  ownerId?: string;
  visitorName?: string;
  visitorAvatar?: string;
  ownerName?: string;
  ownerAvatar?: string;
  read: boolean;
  createdAt: string;
  timestamp?: string;
}

/** Récupère le statut privé d'un profil */
export async function getPrivacy(username: string): Promise<{ isPrivate: boolean; found: boolean }> {
  try {
    const res = await fetch(`${BASE}/privacy/${encodeURIComponent(username)}`, { headers: H });
    if (!res.ok) return { isPrivate: false, found: false };
    return res.json();
  } catch {
    return { isPrivate: false, found: false };
  }
}

/** Active ou désactive le mode privé (propriétaire uniquement) */
export async function setPrivacy(username: string, isPrivate: boolean): Promise<{ success: boolean; isPrivate: boolean }> {
  const res = await fetch(`${BASE}/privacy/${encodeURIComponent(username)}`, {
    method: "PUT",
    headers: H,
    body: JSON.stringify({ isPrivate, requestedBy: username }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur mise à jour privacy (${res.status})`);
  }
  return res.json();
}

/** Envoie une demande d'accès */
export async function sendAccessRequest(visitorId: string, ownerId: string): Promise<{ success: boolean; request: AccessRequest; alreadyExists?: boolean }> {
  const res = await fetch(`${BASE}/access-requests`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ visitorId, ownerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur demande d'accès (${res.status})`);
  }
  return res.json();
}

/** Vérifie le statut d'une demande d'accès */
export async function getAccessRequestStatus(visitorId: string, ownerId: string): Promise<{ status: "none" | "pending" | "accepted" | "refused"; request: AccessRequest | null }> {
  try {
    const res = await fetch(`${BASE}/access-requests/status?visitorId=${encodeURIComponent(visitorId)}&ownerId=${encodeURIComponent(ownerId)}`, { headers: H });
    if (!res.ok) return { status: "none", request: null };
    return res.json();
  } catch {
    return { status: "none", request: null };
  }
}

/** Vérifie si un visiteur a accès à un profil privé */
export async function checkAccess(ownerId: string, visitorId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/access-requests/check?ownerId=${encodeURIComponent(ownerId)}&visitorId=${encodeURIComponent(visitorId)}`, { headers: H });
    if (!res.ok) return false;
    const data = await res.json();
    return data.hasAccess === true;
  } catch {
    return false;
  }
}

/** Liste les demandes d'accès reçues par le propriétaire */
export async function getAccessRequests(ownerId: string): Promise<{ requests: AccessRequest[]; total: number }> {
  const res = await fetch(`${BASE}/access-requests?ownerId=${encodeURIComponent(ownerId)}`, { headers: H });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur récupération demandes (${res.status})`);
  }
  return res.json();
}

/** Accepte ou refuse une demande d'accès */
export async function respondToAccessRequest(id: string, action: "accept" | "refuse", ownerId: string): Promise<{ success: boolean; request: AccessRequest }> {
  const res = await fetch(`${BASE}/access-requests/${id}`, {
    method: "PUT",
    headers: H,
    body: JSON.stringify({ action, ownerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur réponse demande (${res.status})`);
  }
  return res.json();
}

/** Récupère les notifications d'un utilisateur */
export async function getNotifications(userId: string): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
  try {
    const res = await fetch(`${BASE}/notifications?userId=${encodeURIComponent(userId)}`, { headers: H });
    if (!res.ok) return { notifications: [], total: 0, unreadCount: 0 };
    return res.json();
  } catch {
    return { notifications: [], total: 0, unreadCount: 0 };
  }
}

/** Marque une notification comme lue */
export async function markNotificationRead(id: string): Promise<void> {
  try {
    await fetch(`${BASE}/notifications/${id}/read`, { method: "PUT", headers: H });
  } catch {}
}
