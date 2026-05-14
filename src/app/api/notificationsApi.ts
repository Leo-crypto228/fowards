import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

export interface AppNotification {
  id: string;
  userId: string;
  type: "like" | "comment" | "follow" | "comment_reply" | "comment_reaction" | "mention" | "access_request" | "access_accepted" | "access_refused";
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  postId?: string | null;
  commentId?: string | null;
  targetType?: "post" | "ways";
  postSnippet?: string | null;
  requestId?: string;
  visitorId?: string;
  visitorName?: string;
  visitorAvatar?: string;
  ownerId?: string;
  ownerName?: string;
  ownerAvatar?: string;
  read: boolean;
  createdAt: string;
  timestamp?: string;
}

/** Récupère toutes les notifications d'un utilisateur */
export async function fetchNotifications(
  userId: string,
  limit = 50
): Promise<{ notifications: AppNotification[]; total: number; unreadCount: number }> {
  try {
    const res = await fetch(
      `${BASE}/notifications?userId=${encodeURIComponent(userId)}&limit=${limit}`,
      { headers: H }
    );
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

/** Marque toutes les notifications d'un utilisateur comme lues */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  try {
    await fetch(
      `${BASE}/notifications/mark-all-read?userId=${encodeURIComponent(userId)}`,
      { method: "PUT", headers: H }
    );
  } catch {}
}
