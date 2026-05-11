import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Bell, CheckCheck, Heart, MessageCircle, UserPlus, Lock, Check, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "../api/notificationsApi";
import { respondToAccessRequest } from "../api/privacyApi";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatTimestamp(ts?: string): string {
  if (!ts) return "";
  if (ts.toLowerCase().includes("instant")) return "À l'instant";
  return ts;
}

function getSenderDisplay(n: AppNotification): { name: string; avatar: string } {
  if (n.type === "like" || n.type === "comment" || n.type === "follow") {
    return { name: n.senderName || n.senderId || "Quelqu'un", avatar: n.senderAvatar || "" };
  }
  if (n.type === "access_request") {
    return { name: n.visitorName || n.visitorId || "Quelqu'un", avatar: n.visitorAvatar || "" };
  }
  if (n.type === "access_accepted" || n.type === "access_refused") {
    return { name: n.ownerName || n.ownerId || "Quelqu'un", avatar: n.ownerAvatar || "" };
  }
  return { name: "FuturFeed", avatar: "" };
}

function getNotifText(n: AppNotification): string {
  const { name } = getSenderDisplay(n);
  switch (n.type) {
    case "like":            return `@${name} a aimé ton post`;
    case "comment":         return `@${name} a commenté ton post`;
    case "follow":          return `@${name} s'est abonné à toi`;
    case "access_request":  return `@${name} demande à voir ton profil`;
    case "access_accepted": return `@${name} a accepté ta demande d'accès`;
    case "access_refused":  return `@${name} a refusé ta demande d'accès`;
    default:                return "Nouvelle notification";
  }
}

function getNotifIcon(type: AppNotification["type"]) {
  switch (type) {
    case "like":            return <Heart style={{ width: 14, height: 14, color: "#fff" }} strokeWidth={2} />;
    case "comment":         return <MessageCircle style={{ width: 14, height: 14, color: "#fff" }} strokeWidth={2} />;
    case "follow":          return <UserPlus style={{ width: 14, height: 14, color: "#fff" }} strokeWidth={2} />;
    case "access_request":  return <Lock style={{ width: 14, height: 14, color: "#fff" }} strokeWidth={2} />;
    case "access_accepted": return <Check style={{ width: 14, height: 14, color: "#fff" }} strokeWidth={2} />;
    case "access_refused":  return <X style={{ width: 14, height: 14, color: "#fff" }} strokeWidth={2} />;
    default:                return <Bell style={{ width: 14, height: 14, color: "#fff" }} strokeWidth={2} />;
  }
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */
function Avatar({ src, name, size = 44 }: { src: string; name: string; size?: number }) {
  const [error, setError] = useState(false);
  if (src && !error) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setError(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "#222", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: size * 0.38, fontWeight: 700, color: "#aaa" }}>
        {(name?.[0] ?? "?").toUpperCase()}
      </span>
    </div>
  );
}

/* ── Notification Row ────────────────────────────────────────────────────── */
function NotifRow({
  notif,
  onRead,
  onNavigate,
  onAccessAction,
}: {
  notif: AppNotification;
  onRead: (id: string) => void;
  onNavigate: (notif: AppNotification) => void;
  onAccessAction?: (id: string, action: "accept" | "refuse") => void;
}) {
  const { name, avatar } = getSenderDisplay(notif);
  const isUnread = !notif.read;
  const isAccessRequest = notif.type === "access_request" && notif.requestId;

  const handleClick = () => {
    if (isUnread) onRead(notif.id);
    if (!isAccessRequest) onNavigate(notif);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px",
        background: isUnread ? "rgba(255,255,255,0.05)" : "transparent",
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        cursor: isAccessRequest ? "default" : "pointer",
        position: "relative",
        transition: "background 0.2s",
      }}
      onClick={handleClick}
    >
      {/* Avatar + type icon overlay */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar src={avatar} name={name} size={44} />
        <div style={{
          position: "absolute", bottom: -2, right: -2,
          width: 20, height: 20, borderRadius: "50%",
          background: "#1a1a1a", border: "1.5px solid #111",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {getNotifIcon(notif.type)}
        </div>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, color: isUnread ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)",
          fontWeight: isUnread ? 500 : 400, lineHeight: 1.4, margin: 0,
          whiteSpace: "normal",
        }}>
          {getNotifText(notif)}
        </p>
        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.28)", marginTop: 3, display: "block" }}>
          {formatTimestamp(notif.timestamp)}
        </span>

        {/* Boutons Accept / Refuse pour demande d'accès */}
        {isAccessRequest && onAccessAction && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => onAccessAction(notif.requestId!, "accept")}
              style={{
                padding: "5px 14px", borderRadius: 8,
                background: "#fff", color: "#111",
                border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 700,
              }}
            >
              Accepter
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => onAccessAction(notif.requestId!, "refuse")}
              style={{
                padding: "5px 14px", borderRadius: 8,
                background: "transparent", color: "rgba(255,255,255,0.45)",
                border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
                fontSize: 12, fontWeight: 600,
              }}
            >
              Refuser
            </motion.button>
          </div>
        )}
      </div>

      {/* Dot non lu */}
      {isUnread && (
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#fff", flexShrink: 0,
        }} />
      )}
    </motion.div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshUnread } = useNotifications();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.username) return;
    setLoading(true);
    const { notifications: data } = await fetchNotifications(user.username, 80);
    setNotifications(data);
    setLoading(false);
  }, [user?.username]);

  useEffect(() => { load(); }, [load]);

  const handleRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read: true } : n)
    );
    await markNotificationRead(id);
    refreshUnread();
  }, [refreshUnread]);

  const handleMarkAll = useCallback(async () => {
    if (!user?.username) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsRead(user.username);
    refreshUnread();
  }, [user?.username, refreshUnread]);

  const handleNavigate = useCallback((notif: AppNotification) => {
    if (notif.postId) {
      navigate(`/post/${encodeURIComponent(notif.postId)}`);
    } else if (notif.type === "follow" && notif.senderId) {
      navigate(`/profile/${notif.senderId}`);
    } else if ((notif.type === "access_accepted" || notif.type === "access_refused") && notif.ownerId) {
      navigate(`/profile/${notif.ownerId}`);
    }
  }, [navigate]);

  const handleAccessAction = useCallback(async (requestId: string, action: "accept" | "refuse") => {
    if (!user?.username) return;
    try {
      await respondToAccessRequest(requestId, action, user.username);
      // Marquer la notif comme lue et mettre à jour localement
      setNotifications((prev) =>
        prev.map((n) =>
          n.requestId === requestId ? { ...n, read: true } : n
        )
      );
      refreshUnread();
    } catch (err) {
      console.error("Erreur réponse demande d'accès:", err);
    }
  }, [user?.username, refreshUnread]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0a" }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#0a0a0a",
        borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        padding: "0 4px",
      }}>
        <div style={{
          maxWidth: 480, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 12px",
        }}>
          {/* Retour */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => navigate(-1)}
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "rgba(255,255,255,0.07)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ArrowLeft style={{ width: 18, height: 18, color: "rgba(255,255,255,0.80)" }} strokeWidth={2} />
          </motion.button>

          {/* Titre */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bell style={{ width: 18, height: 18, color: "rgba(255,255,255,0.70)" }} strokeWidth={1.8} />
            <span style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{
                background: "#fff", color: "#111",
                fontSize: 11, fontWeight: 800,
                borderRadius: 999, padding: "1px 7px",
                lineHeight: 1.5,
              }}>
                {unreadCount}
              </span>
            )}
          </div>

          {/* Tout marquer lu */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={handleMarkAll}
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: unreadCount > 0 ? "rgba(255,255,255,0.07)" : "transparent",
              border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: unreadCount > 0 ? "pointer" : "default",
            }}
          >
            <CheckCheck
              style={{ width: 17, height: 17, color: unreadCount > 0 ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.20)" }}
              strokeWidth={2}
            />
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {loading ? (
          <div style={{ padding: "60px 0", display: "flex", justifyContent: "center" }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{
                width: 24, height: 24, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.08)",
                borderTop: "2px solid rgba(255,255,255,0.55)",
              }}
            />
          </div>
        ) : notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ padding: "80px 24px", textAlign: "center" }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <Bell style={{ width: 26, height: 26, color: "rgba(255,255,255,0.25)" }} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.50)", margin: "0 0 8px" }}>
              Aucune notification
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", margin: 0, lineHeight: 1.6 }}>
              Les likes, commentaires et abonnements apparaîtront ici.
            </p>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {notifications.map((n) => (
              <NotifRow
                key={n.id}
                notif={n}
                onRead={handleRead}
                onNavigate={handleNavigate}
                onAccessAction={n.type === "access_request" ? handleAccessAction : undefined}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}