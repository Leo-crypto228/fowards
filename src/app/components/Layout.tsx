import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Home, Users, PlusCircle, Target, Loader2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { useProgression } from "../context/ProgressionContext";
import { useAuth } from "../context/AuthContext";
import { useActiveCommunity } from "../context/ActiveCommunityContext";
import { toast } from "sonner";

// Mapping fcoin ID → emoji label for notifications
const FCOIN_LABELS: Record<string, string> = {
  streak_2: "🔥 Départ débloqué !",    streak_7: "🏅 Discipline débloqué !",
  streak_30: "💎 Constant débloqué !",  posts_1: "✨ Premiers pas débloqué !",
  posts_10: "📝 Contributeur débloqué !", posts_50: "🎨 Créateur débloqué !",
  reactions_first: "👍 1er Post apprécié !", reactions_100: "⚡ Impression débloqué !",
  reactions_1000: "🌟 Influence débloqué !", community_join: "🤝 Début d'aventure !",
  community_20msg: "💬 L'actif débloqué !", community_100msg: "❤️ Aimé débloqué !",
  rare_early: "🏗️ EarlyBuilder débloqué !", rare_pioneer: "🚀 Pioneer débloqué !",
  rare_first_goal: "🎯 First Objectif !",
  social_10follows: "👁️ Observateur débloqué !", social_10comments: "💡 Curieux débloqué !",
  social_10profiles: "🌍 Explorateur débloqué !",
};

function FcoinNotificationWatcher() {
  const { newFcoinNotification, clearNotification } = useProgression();
  useEffect(() => {
    if (!newFcoinNotification) return;
    const label = FCOIN_LABELS[newFcoinNotification] ?? `Fcoin débloqué : ${newFcoinNotification}`;
    toast(label, {
      icon: "🏆",
      duration: 3500,
      style: { background: "rgba(16,185,129,0.12)", border: "0.5px solid rgba(16,185,129,0.30)", color: "#6ee7b7" },
    });
    clearNotification();
  }, [newFcoinNotification, clearNotification]);
  return null;
}

export function Layout() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user, loading } = useAuth();
  const { communityId: activeCommunityId, channelId: activeChannelId, channelName: activeChannelName } = useActiveCommunity();
  const isPostDetail = location.pathname.startsWith("/post/");
  const [createPostOpen, setCreatePostOpen] = useState(false);

  // Show "+" button only on /tribes/:id (a specific community page)
  const communityMatch = location.pathname.match(/^\/tribes\/([^\/]+)$/);
  const isInCommunity = !!(communityMatch && communityMatch[1] !== "create");

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirect}`, { replace: true });
    } else if (!user.onboardingDone) {
      navigate("/onboarding", { replace: true });
    } else if (!user.firstPostCreated) {
      navigate("/first-post", { replace: true });
    }
  }, [user, loading, navigate]);

  // Pendant le chargement initial
  if (loading || !user || !user.onboardingDone || !user.firstPostCreated) {
    return (
      <div style={{
        minHeight: "100dvh", background: "#050510",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Loader2 style={{ width: 28, height: 28, color: "#6366f1", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const navItems = [
    { path: "/",        icon: Home,      label: "Feed"   },
    { path: "/tribes",  icon: Users,     label: "Tribus" },
    { path: "/create",  icon: PlusCircle,label: "Créer"  },
    { path: "/profile", icon: Target,    label: "Profil" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    // Éviter que /tribes/create et /tribes/:id matchent /tribes comme actif pour le "+"
    if (path === "/tribes") return location.pathname === "/tribes";
    return location.pathname.startsWith(path);
  };

  // Le bouton "+" n'apparaît que sur /tribes (liste) et /tribes/create
  const showCreateCommunityBtn =
    location.pathname === "/tribes" || location.pathname === "/tribes/create";
  const createCommunityActive = location.pathname === "/tribes/create";

  return (
    <div className="flex flex-col h-screen bg-background" style={{ overflow: "hidden", maxWidth: "100vw" }}>
      {/* Toaster global pour toutes les notifications */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(18,18,28,0.97)",
            border: "0.5px solid rgba(255,255,255,0.12)",
            color: "rgba(235,235,245,0.92)",
            borderRadius: 14,
            backdropFilter: "blur(24px)",
            fontSize: 14,
          },
        }}
      />
      <FcoinNotificationWatcher />
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: isPostDetail ? 0 : "7rem" }}
      >
        <Outlet />
      </main>

      {/* ── BOTTOM NAV ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isPostDetail && (
          <motion.nav
            className="fixed bottom-0 left-0 right-0 flex justify-center items-end pb-8 px-5"
            style={{ zIndex: 50, gap: 10 }}
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            {/* Pill container principal */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "5px",
                borderRadius: 999,
                background: "rgba(10,10,10,0.55)",
                backdropFilter: "blur(32px) saturate(180%)",
                WebkitBackdropFilter: "blur(32px) saturate(180%)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.3)",
              }}
            >
              {navItems.map(({ path, icon: Icon }) => {
                const active = isActive(path);
                return (
                  <Link key={path} to={path} style={{ textDecoration: "none" }}>
                    <motion.div
                      whileTap={{ scale: 0.86 }}
                      transition={{ type: "spring", stiffness: 500, damping: 28 }}
                      className="relative flex items-center justify-center"
                      style={{
                        width: 62,
                        height: 50,
                        borderRadius: 999,
                        position: "relative",
                      }}
                    >
                      {/* ── Bubble active ── */}
                      {active && (
                        <motion.div
                          layoutId="nav-bubble"
                          style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.13)",
                            zIndex: 0,
                          }}
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}

                      <Icon
                        style={{
                          position: "relative",
                          zIndex: 1,
                          width: 27,
                          height: 27,
                          color: active ? "#ffffff" : "rgba(255,255,255,0.38)",
                          transition: "color 0.20s ease",
                          strokeWidth: active ? 2.1 : 1.75,
                        }}
                      />
                    </motion.div>
                  </Link>
                );
              })}
            </div>

            {/* ── Bouton "+" Créer une communauté — détaché, visible sur /tribes uniquement ── */}
            <AnimatePresence>
              {showCreateCommunityBtn && (
                <motion.div
                  key="create-community-btn"
                  initial={{ opacity: 0, scale: 0.75, x: 12 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.75, x: 12 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                >
                  <Link to="/tribes/create" style={{ textDecoration: "none" }}>
                    <motion.div
                      whileTap={{ scale: 0.86 }}
                      transition={{ type: "spring", stiffness: 500, damping: 28 }}
                      style={{
                        width: 62,
                        height: 60,
                        borderRadius: 999,
                        background: "rgba(10,10,10,0.55)",
                        backdropFilter: "blur(32px) saturate(180%)",
                        WebkitBackdropFilter: "blur(32px) saturate(180%)",
                        border: "0.5px solid rgba(255,255,255,0.08)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {/* Bubble active quand sur /tribes/create */}
                      {createCommunityActive && (
                        <motion.div
                          layoutId="nav-bubble"
                          style={{
                            position: "absolute", inset: 0, borderRadius: 999,
                            background: "rgba(255,255,255,0.13)", zIndex: 0,
                          }}
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span style={{
                        position: "relative", zIndex: 1,
                        fontSize: 46,
                        fontWeight: 200,
                        lineHeight: 1,
                        color: createCommunityActive ? "#ffffff" : "rgba(255,255,255,0.50)",
                        transition: "color 0.20s ease",
                        userSelect: "none",
                        marginTop: -3,
                      }}>
                        +
                      </span>
                    </motion.div>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Bouton "+" Créer un post dans la communauté ── */}
            <AnimatePresence>
              {isInCommunity && !isPostDetail && (
                <motion.div
                  key="create-community-post-btn"
                  initial={{ opacity: 0, scale: 0.75, x: 12 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.75, x: 12 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                >
                  <motion.button
                    whileTap={{ scale: 0.86 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => {
                      if (activeCommunityId) {
                        navigate(`/tribes/${activeCommunityId}/post`, {
                          state: {
                            channelId: activeChannelId,
                            channelName: activeChannelName,
                          },
                        });
                      }
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 28 }}
                    style={{
                      width: 62,
                      height: 50,
                      borderRadius: 999,
                      background: "#4f46e5",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    <Plus style={{ width: 24, height: 24, color: "#ffffff", strokeWidth: 2.2 }} />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}