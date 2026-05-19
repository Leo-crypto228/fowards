import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Home, Users, Target, Loader2, Plus, Bell } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import { motion } from "motion/react";
import { Toaster } from "sonner";
import { useEffect, useState, Suspense } from "react";
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
  const isWaysViewer = location.pathname.startsWith("/ways/") && !location.pathname.endsWith("/create");
  const isCreatePage = location.pathname === "/create";
  const hideNav = isPostDetail || isWaysViewer || isCreatePage;
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const { unreadCount } = useNotifications();



  // Show "+" button only on /tribes/:id (a specific community page)
  const communityMatch = location.pathname.match(/^\/tribes\/([^\/]+)$/);
  const isInCommunity = !!(communityMatch && communityMatch[1] !== "create");

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirect}`, { replace: true });
    } else {
      const needsOnboarding = (() => { try { return localStorage.getItem("ff_needs_onboarding") === "1"; } catch { return false; } })();
      if (!user.onboardingDone && needsOnboarding) {
        navigate("/onboarding", { replace: true });
      } else if (!user.firstPostCreated && needsOnboarding) {
        navigate("/first-post", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  // Pendant le chargement initial
  const needsOnboarding = (() => { try { return localStorage.getItem("ff_needs_onboarding") === "1"; } catch { return false; } })();
  if (loading || !user || (!user.onboardingDone && needsOnboarding) || (!user.firstPostCreated && needsOnboarding)) {
    return (
      <div style={{
        minHeight: "100dvh", background: "#050510",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Loader2 style={{ width: 28, height: 28, color: "#6366f1", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }


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
    <div className="fw-app-root flex flex-col bg-background" style={{ overflow: "hidden", paddingTop: "env(safe-area-inset-top)" }}>
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
        className={`flex-1 overflow-y-auto overflow-x-hidden${hideNav ? "" : " fw-main"}`}
        style={{ paddingBottom: 0, WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        <Suspense fallback={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid rgba(99,102,241,0.18)", borderTop: "2.5px solid #6366f1", animation: "spin 0.7s linear infinite" }} />
          </div>
        }>
          <Outlet />
        </Suspense>
      </main>

      {/* ── NAV — flex-flow sur mobile (dans le conteneur fixed = bas de l'écran garanti) ── */}
      {!hideNav && (
        <motion.nav
          className="fw-nav flex bg-black w-full justify-center lg:fixed lg:z-[50] lg:left-0 lg:top-0 lg:bottom-0 lg:w-[72px] lg:flex-col lg:justify-center"
          style={{
            flexShrink: 0,
            borderTop: "0.5px solid rgba(255,255,255,0.10)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <div className="w-full max-w-[672px] flex items-center lg:flex-col lg:max-w-none lg:gap-4">

            <Link to="/" className="flex-1 h-[60px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full" style={{ textDecoration: "none" }}>
              <motion.div whileTap={{ scale: 0.82 }}>
                <Home style={{ width: 25, height: 25, color: isActive("/") ? "#fff" : "rgba(255,255,255,0.38)", strokeWidth: isActive("/") ? 2.2 : 1.7, transition: "color 0.18s" }} />
              </motion.div>
            </Link>

            <Link to="/tribes" className="flex-1 h-[60px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full" style={{ textDecoration: "none" }}>
              <motion.div whileTap={{ scale: 0.82 }}>
                <Users style={{ width: 25, height: 25, color: isActive("/tribes") ? "#fff" : "rgba(255,255,255,0.38)", strokeWidth: isActive("/tribes") ? 2.2 : 1.7, transition: "color 0.18s" }} />
              </motion.div>
            </Link>

            <div className="flex-[1.4] h-[60px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full">
              <Link to="/create" style={{ textDecoration: "none" }} onClick={() => navigator.vibrate?.(12)}>
                <motion.div
                  className="fw-nav-create-btn"
                  whileTap={{ scale: 0.90 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  style={{ height: 38, paddingLeft: 22, paddingRight: 22, borderRadius: 999, background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Plus style={{ width: 22, height: 22, color: "#fff", strokeWidth: 2.4 }} />
                </motion.div>
              </Link>
            </div>

            <Link to="/notifications" className="flex-1 h-[60px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full" style={{ textDecoration: "none" }}>
              <motion.div whileTap={{ scale: 0.82 }} style={{ position: "relative" }}>
                <Bell style={{ width: 25, height: 25, color: isActive("/notifications") ? "#fff" : "rgba(255,255,255,0.38)", strokeWidth: isActive("/notifications") ? 2.2 : 1.7, transition: "color 0.18s" }} />
                {unreadCount > 0 && (
                  <motion.div key="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 28 }}
                    style={{ position: "absolute", top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 999, background: "#fff", color: "#111", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", lineHeight: 1, border: "1.5px solid #000" }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </motion.div>
                )}
              </motion.div>
            </Link>

            <Link to="/profile" className="flex-1 h-[60px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full" style={{ textDecoration: "none" }}>
              <motion.div whileTap={{ scale: 0.82 }}>
                <Target style={{ width: 25, height: 25, color: isActive("/profile") ? "#fff" : "rgba(255,255,255,0.38)", strokeWidth: isActive("/profile") ? 2.2 : 1.7, transition: "color 0.18s" }} />
              </motion.div>
            </Link>

          </div>
        </motion.nav>
      )}

    </div>
  );
}