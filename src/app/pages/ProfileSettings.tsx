import React, { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft, Lock, Unlock, UserCheck, UserX, Users,
  Bell, Edit3, TrendingUp, LogOut, Shield, Clock,
  Check, X, Loader2, RefreshCw, Eye, EyeOff,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import {
  getPrivacy, setPrivacy,
  getAccessRequests, respondToAccessRequest,
  getNotifications, markNotificationRead,
  type AccessRequest, type Notification,
} from "../api/privacyApi";
import { toast } from "sonner";

// ─── Styles ──────────────────────────────────────────────────────────────────

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "0.5px solid rgba(255,255,255,0.10)",
  boxShadow: "0 4px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.07)",
};

const dangerGlass: React.CSSProperties = {
  background: "rgba(239,68,68,0.07)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "0.5px solid rgba(239,68,68,0.20)",
};

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ on, onChange, loading }: { on: boolean; onChange: (v: boolean) => void; loading?: boolean }) {
  return (
    <motion.div
      onClick={() => !loading && onChange(!on)}
      style={{
        width: 52, height: 30, borderRadius: 999, cursor: loading ? "default" : "pointer",
        background: on ? "linear-gradient(90deg,#4f46e5,#818cf8)" : "rgba(255,255,255,0.12)",
        border: on ? "none" : "0.5px solid rgba(255,255,255,0.18)",
        position: "relative", flexShrink: 0, transition: "background 0.25s ease",
        boxShadow: on ? "0 0 16px rgba(79,70,229,0.40)" : "none",
        display: "flex", alignItems: "center", padding: "0 4px",
      }}
      whileTap={{ scale: 0.94 }}
    >
      {loading ? (
        <Loader2 style={{ width: 14, height: 14, color: "rgba(255,255,255,0.60)" }} className="animate-spin" />
      ) : (
        <motion.div
          animate={{ x: on ? 22 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
        />
      )}
    </motion.div>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────

function RequestCard({
  req, ownerId, onResponded,
}: {
  req: AccessRequest;
  ownerId: string;
  onResponded: (id: string, action: "accept" | "refuse") => void;
}) {
  const [loading, setLoading] = useState<"accept" | "refuse" | null>(null);

  const handle = async (action: "accept" | "refuse") => {
    setLoading(action);
    try {
      await respondToAccessRequest(req.id, action, ownerId);
      onResponded(req.id, action);
      toast.success(action === "accept" ? "Accès accordé ✓" : "Demande refusée");
    } catch (err) {
      console.error("Erreur réponse demande:", err);
      toast.error("Impossible de traiter cette demande.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        ...glass, borderRadius: 18, padding: "14px 16px",
        marginBottom: 10, display: "flex", alignItems: "center", gap: 14,
      }}
    >
      {/* Avatar */}
      <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.10)" }}>
        {req.visitorAvatar ? (
          <img src={req.visitorAvatar} alt={req.visitorName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#4f46e5,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users style={{ width: 18, height: 18, color: "rgba(255,255,255,0.60)" }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>
          {req.visitorName || req.visitorId}
        </div>
        {req.visitorObjective && (
          <div style={{ fontSize: 12, color: "rgba(200,200,220,0.45)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {req.visitorObjective}
          </div>
        )}
        <div style={{ fontSize: 11, color: "rgba(144,144,168,0.40)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
          <Clock style={{ width: 10, height: 10 }} />
          {req.timestamp || "Récemment"}
        </div>
      </div>

      {/* Actions */}
      {req.status === "pending" ? (
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => handle("accept")}
            disabled={loading !== null}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(34,197,94,0.15)", border: "0.5px solid rgba(34,197,94,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            {loading === "accept" ? (
              <Loader2 style={{ width: 14, height: 14, color: "#22c55e" }} className="animate-spin" />
            ) : (
              <Check style={{ width: 14, height: 14, color: "#22c55e" }} />
            )}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => handle("refuse")}
            disabled={loading !== null}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(239,68,68,0.12)", border: "0.5px solid rgba(239,68,68,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            {loading === "refuse" ? (
              <Loader2 style={{ width: 14, height: 14, color: "#ef4444" }} className="animate-spin" />
            ) : (
              <X style={{ width: 14, height: 14, color: "#ef4444" }} />
            )}
          </motion.button>
        </div>
      ) : (
        <div style={{
          padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: req.status === "accepted" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.10)",
          color: req.status === "accepted" ? "#22c55e" : "#ef4444",
          border: `0.5px solid ${req.status === "accepted" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.22)"}`,
          flexShrink: 0,
        }}>
          {req.status === "accepted" ? "Accepté" : "Refusé"}
        </div>
      )}
    </motion.div>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(144,144,168,0.55)", textTransform: "uppercase", marginBottom: 12 }}>
      {children}
    </p>
  );
}

// ─── Notification Badge ───────────────────────────────────────────────────────

function NotifBadge({ notif }: { notif: Notification }) {
  const isAccessReq = notif.type === "access_request";
  const isAccepted = notif.type === "access_accepted";
  const isRefused = notif.type === "access_refused";

  const icon = isAccessReq ? <UserCheck style={{ width: 14, height: 14, color: "#818cf8" }} />
    : isAccepted ? <Check style={{ width: 14, height: 14, color: "#22c55e" }} />
    : <X style={{ width: 14, height: 14, color: "#ef4444" }} />;

  const bgColor = isAccessReq ? "rgba(99,102,241,0.12)"
    : isAccepted ? "rgba(34,197,94,0.10)"
    : "rgba(239,68,68,0.10)";

  const text = isAccessReq
    ? `${notif.visitorName || notif.visitorId} demande l'accès à votre profil`
    : isAccepted
    ? `${notif.ownerName || notif.ownerId} a accepté votre demande d'accès`
    : `${notif.ownerName || notif.ownerId} a refusé votre demande d'accès`;

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0",
      borderBottom: "0.5px solid rgba(255,255,255,0.05)",
      opacity: notif.read ? 0.55 : 1,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        background: bgColor, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: "rgba(240,240,245,0.82)", lineHeight: 1.45, margin: 0 }}>{text}</p>
        <p style={{ fontSize: 11, color: "rgba(144,144,168,0.40)", marginTop: 3 }}>{notif.timestamp || "Récemment"}</p>
      </div>
      {!notif.read && (
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", boxShadow: "0 0 6px rgba(99,102,241,0.9)", flexShrink: 0, marginTop: 4 }} />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type SettingsTab = "privacy" | "requests" | "notifications" | "actions";

export function ProfileSettings() {
  const navigate = useNavigate();
  const { user: authUser, signOut } = useAuth();
  const myUsername = authUser?.username || "";

  const [activeTab, setActiveTab] = useState<SettingsTab>("privacy");

  // Privacy state
  const [isPrivate, setIsPrivateState] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [privacyToggling, setPrivacyToggling] = useState(false);

  // Access requests
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsLoaded, setRequestsLoaded] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [notifsLoaded, setNotifsLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load privacy on mount
  useEffect(() => {
    if (!myUsername) return;
    setPrivacyLoading(true);
    getPrivacy(myUsername)
      .then((data) => setIsPrivateState(data.isPrivate))
      .catch((err) => console.error("Erreur chargement privacy:", err))
      .finally(() => setPrivacyLoading(false));
  }, [myUsername]);

  // Load requests when tab is active
  const loadRequests = useCallback(async () => {
    if (!myUsername) return;
    setRequestsLoading(true);
    try {
      const { requests: reqs } = await getAccessRequests(myUsername);
      setRequests(reqs);
      setRequestsLoaded(true);
    } catch (err) {
      console.error("Erreur chargement demandes:", err);
    } finally {
      setRequestsLoading(false);
    }
  }, [myUsername]);

  // Load notifications when tab is active
  const loadNotifications = useCallback(async () => {
    if (!myUsername) return;
    setNotifsLoading(true);
    try {
      const { notifications: notifs, unreadCount: uc } = await getNotifications(myUsername);
      setNotifications(notifs);
      setUnreadCount(uc);
      setNotifsLoaded(true);
      // Mark all as read
      for (const n of notifs.filter((n) => !n.read)) {
        await markNotificationRead(n.id).catch(() => {});
      }
    } catch (err) {
      console.error("Erreur chargement notifications:", err);
    } finally {
      setNotifsLoading(false);
    }
  }, [myUsername]);

  useEffect(() => {
    if (activeTab === "requests" && !requestsLoaded) loadRequests();
    if (activeTab === "notifications" && !notifsLoaded) loadNotifications();
  }, [activeTab, requestsLoaded, notifsLoaded, loadRequests, loadNotifications]);

  const handleTogglePrivacy = async (value: boolean) => {
    setPrivacyToggling(true);
    try {
      await setPrivacy(myUsername, value);
      setIsPrivateState(value);
      toast.success(value ? "Profil privé activé 🔒" : "Profil public activé 🌐");
    } catch (err) {
      console.error("Erreur toggle privacy:", err);
      toast.error("Impossible de modifier la confidentialité.");
    } finally {
      setPrivacyToggling(false);
    }
  };

  const handleRequestResponded = (id: string, action: "accept" | "refuse") => {
    setRequests((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: action === "accept" ? "accepted" : "refused" } : r)
    );
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const tabs: { key: SettingsTab; label: string; badge?: number }[] = [
    { key: "privacy", label: "Confidentialité" },
    { key: "requests", label: "Demandes", badge: pendingCount || undefined },
    { key: "notifications", label: "Alertes", badge: unreadCount || undefined },
    { key: "actions", label: "Compte" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#000", paddingBottom: 120 }}>
      <div style={{ maxWidth: 672, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ padding: "52px 20px 0", display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => navigate("/profile")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.14)",
              borderRadius: 999, padding: "7px 14px 7px 10px", cursor: "pointer",
            }}
          >
            <ArrowLeft style={{ width: 14, height: 14, color: "rgba(255,255,255,0.70)" }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.70)", fontWeight: 500 }}>Retour</span>
          </motion.button>

          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#f0f0f5", letterSpacing: "-0.3px", margin: 0 }}>
              Paramètres
            </p>
            <p style={{ fontSize: 13, color: "rgba(200,200,220,0.40)", margin: "2px 0 0" }}>
              @{myUsername}
            </p>
          </div>

          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "linear-gradient(135deg,rgba(79,70,229,0.25),rgba(129,140,248,0.15))",
            border: "0.5px solid rgba(99,102,241,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Shield style={{ width: 18, height: 18, color: "#818cf8" }} />
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ padding: "0 20px", marginBottom: 24, overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 8, minWidth: "max-content" }}>
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <motion.button
                  key={tab.key}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    position: "relative",
                    padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: active ? 700 : 500,
                    background: active ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.06)",
                    border: active ? "0.5px solid rgba(99,102,241,0.40)" : "0.5px solid rgba(255,255,255,0.10)",
                    color: active ? "#a5b4fc" : "rgba(255,255,255,0.45)",
                    cursor: "pointer", transition: "all 0.18s ease", whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                  {tab.badge && tab.badge > 0 ? (
                    <span style={{
                      position: "absolute", top: -4, right: -4,
                      minWidth: 17, height: 17, borderRadius: 999, padding: "0 4px",
                      background: "#6366f1", fontSize: 10, fontWeight: 800, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 0 6px rgba(99,102,241,0.8)",
                    }}>
                      {tab.badge}
                    </span>
                  ) : null}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ padding: "0 20px" }}>
          
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.20 }}
            >

              {/* ── Privacy Tab ── */}
              {activeTab === "privacy" && (
                <div>
                  <SectionLabel>Mode privé</SectionLabel>

                  {/* Privacy Toggle Card */}
                  <div style={{ ...glass, borderRadius: 22, padding: "20px 20px", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          {isPrivate ? (
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(99,102,241,0.15)", border: "0.5px solid rgba(99,102,241,0.30)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Lock style={{ width: 16, height: 16, color: "#818cf8" }} />
                            </div>
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(34,197,94,0.10)", border: "0.5px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Unlock style={{ width: 16, height: 16, color: "#22c55e" }} />
                            </div>
                          )}
                          <div>
                            <p style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f5", margin: 0 }}>
                              {privacyLoading ? "Chargement…" : isPrivate ? "Profil privé" : "Profil public"}
                            </p>
                            <p style={{ fontSize: 12, color: "rgba(200,200,220,0.45)", margin: "2px 0 0" }}>
                              {isPrivate ? "Seules les personnes acceptées voient votre contenu" : "Tout le monde peut voir votre profil"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <ToggleSwitch
                        on={isPrivate}
                        onChange={handleTogglePrivacy}
                        loading={privacyToggling || privacyLoading}
                      />
                    </div>
                  </div>

                  {/* Info cards */}
                  <div style={{ ...glass, borderRadius: 20, padding: "16px 18px", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <EyeOff style={{ width: 14, height: 14, color: "rgba(165,180,252,0.70)" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(240,240,245,0.80)" }}>Quand le profil est privé</span>
                    </div>
                    {[
                      "Les visiteurs voient seulement votre avatar et votre nom",
                      "Ils peuvent envoyer une demande d'accès",
                      "Une fois acceptés, ils voient tout votre profil",
                      "Vos posts, stats et objectifs restent cachés",
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(165,180,252,0.50)", marginTop: 7, flexShrink: 0 }} />
                        <p style={{ fontSize: 13, color: "rgba(200,200,220,0.55)", lineHeight: 1.5, margin: 0 }}>{item}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ ...glass, borderRadius: 20, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <Eye style={{ width: 14, height: 14, color: "rgba(34,197,94,0.70)" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(240,240,245,0.80)" }}>Toujours visible par tous</span>
                    </div>
                    {[
                      "Votre avatar et votre nom d'affichage",
                      "Le bouton partager et la recherche",
                      "Le bouton 'Demander l'accès'",
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(34,197,94,0.50)", marginTop: 7, flexShrink: 0 }} />
                        <p style={{ fontSize: 13, color: "rgba(200,200,220,0.55)", lineHeight: 1.5, margin: 0 }}>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Access Requests Tab ── */}
              {activeTab === "requests" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <SectionLabel>Demandes d'accès reçues</SectionLabel>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => { setRequestsLoaded(false); loadRequests(); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    >
                      <RefreshCw style={{ width: 14, height: 14, color: "rgba(255,255,255,0.28)" }} />
                    </motion.button>
                  </div>

                  {requestsLoading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", gap: 8, alignItems: "center" }}>
                      <Loader2 style={{ width: 16, height: 16, color: "rgba(99,102,241,0.55)" }} className="animate-spin" />
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Chargement…</span>
                    </div>
                  ) : requests.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "56px 20px" }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: "50%",
                        background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
                      }}>
                        <UserCheck style={{ width: 22, height: 22, color: "rgba(129,140,248,0.35)" }} />
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>Aucune demande</p>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.18)", marginTop: 6 }}>
                        Les demandes d'accès à votre profil privé apparaîtront ici.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {/* Pending first */}
                      {requests.filter((r) => r.status === "pending").length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(165,180,252,0.60)", textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 10 }}>
                            En attente · {requests.filter((r) => r.status === "pending").length}
                          </div>
                          
                            {requests.filter((r) => r.status === "pending").map((req) => (
                              <RequestCard key={req.id} req={req} ownerId={myUsername} onResponded={handleRequestResponded} />
                            ))}
                          
                        </div>
                      )}
                      {/* Others */}
                      {requests.filter((r) => r.status !== "pending").length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(144,144,168,0.40)", textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 10 }}>
                            Traités · {requests.filter((r) => r.status !== "pending").length}
                          </div>
                          {requests.filter((r) => r.status !== "pending").map((req) => (
                            <RequestCard key={req.id} req={req} ownerId={myUsername} onResponded={handleRequestResponded} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Notifications Tab ── */}
              {activeTab === "notifications" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <SectionLabel>Notifications</SectionLabel>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => { setNotifsLoaded(false); loadNotifications(); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    >
                      <RefreshCw style={{ width: 14, height: 14, color: "rgba(255,255,255,0.28)" }} />
                    </motion.button>
                  </div>

                  {notifsLoading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", gap: 8, alignItems: "center" }}>
                      <Loader2 style={{ width: 16, height: 16, color: "rgba(99,102,241,0.55)" }} className="animate-spin" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "56px 20px" }}>
                      <Bell style={{ width: 32, height: 32, color: "rgba(255,255,255,0.14)", margin: "0 auto 14px", display: "block" }} />
                      <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.30)" }}>Aucune notification</p>
                    </div>
                  ) : (
                    <div style={{ ...glass, borderRadius: 22, padding: "6px 18px 6px" }}>
                      {notifications.map((notif) => (
                        <NotifBadge key={notif.id} notif={notif} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Account Actions Tab ── */}
              {activeTab === "actions" && (
                <div>
                  <SectionLabel>Navigation rapide</SectionLabel>

                  {[
                    {
                      icon: <TrendingUp style={{ width: 16, height: 16, color: "#818cf8" }} />,
                      label: "Ma progression",
                      sub: "Objectifs, constance, évolution",
                      bg: "rgba(99,102,241,0.10)",
                      action: () => navigate("/progression"),
                    },
                    {
                      icon: <Edit3 style={{ width: 16, height: 16, color: "#a78bfa" }} />,
                      label: "Modifier mon profil",
                      sub: "Avatar, bio, objectif, hashtags",
                      bg: "rgba(167,139,250,0.10)",
                      action: () => navigate("/profile/edit"),
                    },
                    {
                      icon: <Bell style={{ width: 16, height: 16, color: "#f59e0b" }} />,
                      label: "Notifications",
                      sub: "Demandes d'accès, alertes",
                      bg: "rgba(245,158,11,0.10)",
                      action: () => setActiveTab("notifications"),
                    },
                  ].map((item, i) => (
                    <motion.button
                      key={i}
                      whileTap={{ scale: 0.98 }}
                      onClick={item.action}
                      style={{
                        ...glass, width: "100%", borderRadius: 18, padding: "16px 18px",
                        marginBottom: 10, display: "flex", alignItems: "center", gap: 14,
                        cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>{item.label}</div>
                        <div style={{ fontSize: 12, color: "rgba(200,200,220,0.42)", marginTop: 2 }}>{item.sub}</div>
                      </div>
                      <ArrowLeft style={{ width: 14, height: 14, color: "rgba(255,255,255,0.25)", transform: "rotate(180deg)" }} />
                    </motion.button>
                  ))}

                  <div style={{ marginTop: 28 }}>
                    <SectionLabel>Zone danger</SectionLabel>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => signOut().then(() => navigate("/login"))}
                      style={{
                        ...dangerGlass, width: "100%", borderRadius: 18, padding: "16px 18px",
                        display: "flex", alignItems: "center", gap: 14, cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <LogOut style={{ width: 16, height: 16, color: "#ef4444" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>Se déconnecter</div>
                        <div style={{ fontSize: 12, color: "rgba(239,68,68,0.50)", marginTop: 2 }}>Vous serez redirigé vers la page de connexion</div>
                      </div>
                    </motion.button>
                  </div>
                </div>
              )}

            </motion.div>
          
        </div>
      </div>
    </div>
  );
}