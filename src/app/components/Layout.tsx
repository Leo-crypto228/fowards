import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Home, Users, Target, Loader2, Bell, Sparkles } from "lucide-react";
import logoImage from "figma:asset/cd3b49eafdee7adc585eb4cea8cc18850443b810.png";
import { useNotifications } from "../context/NotificationContext";
import { projectId, publicAnonKey } from "/utils/supabase/info";
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

// Ping fire-and-forget au montage — réveille le Deno isolate avant le premier vrai appel
const _BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
fetch(`${_BASE}/ping`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }).catch(() => {});

export function Layout() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user, loading } = useAuth();
  const { communityId: activeCommunityId, channelId: activeChannelId, channelName: activeChannelName } = useActiveCommunity();
  const isPostDetail = location.pathname.startsWith("/post/");
  const isWaysViewer = location.pathname.startsWith("/ways/") && !location.pathname.endsWith("/create");
  const isCreatePage = location.pathname === "/create";
  // /ai/new or /ai/:conversationId (but not /ai itself — that shows the list)
  const isAiConversation = location.pathname.startsWith("/ai/");
  const hideNav = isPostDetail || isWaysViewer || isCreatePage || isAiConversation;
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const { unreadCount } = useNotifications();

  // ── Nav visibility — driven by Feed's scroll logic via custom event ────────
  // Only the feed page hides the nav. All other pages keep it fully visible.
  const [navVisible, setNavVisible] = useState(true);

  // Reset to visible on every route change (leaving the feed → nav comes back)
  useEffect(() => {
    setNavVisible(true);
  }, [location.pathname]);

  // Mirror Feed's header visibility: same event, same React render batch
  useEffect(() => {
    const handler = (e: Event) => {
      setNavVisible((e as CustomEvent<{ visible: boolean }>).detail.visible);
    };
    window.addEventListener("fowards:feedScroll", handler);
    return () => window.removeEventListener("fowards:feedScroll", handler);
  }, []);



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
      // Comptes existants : on nettoie definitivement le flag d'onboarding
      try { localStorage.removeItem("ff_needs_onboarding"); } catch {}
    }
  }, [user, loading, navigate]);

  // Pendant le chargement initial
  if (loading || !user) {
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
    <div className="fw-app-root flex flex-col bg-background">
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

      {/* ── Global status bar band — always covers Dynamic Island / notch on ALL pages ── */}
      <div aria-hidden style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: "env(safe-area-inset-top, 0px)",
        background: "#000",
        borderBottom: "0.5px solid #1a1a1a",
        zIndex: 200,
        pointerEvents: "none",
      }} />

      <main
        id="app-scroll"
        className={`flex-1 overflow-y-auto overflow-x-hidden${hideNav ? "" : " fw-main"}`}
        style={{
          minHeight: 0,
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: hideNav ? 0 : 60,
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
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
          className="fw-nav fixed bottom-0 left-0 right-0 z-50 flex bg-black w-full justify-center lg:right-auto lg:top-0 lg:bottom-0 lg:w-[72px] lg:flex-col lg:justify-start lg:items-center lg:left-[calc(50%-440px)]"
          style={{
            borderTop: "0.5px solid rgba(255,255,255,0.10)",
            paddingBottom: 0,
          }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: navVisible ? 0 : 80 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Logo — desktop only, top of sidebar */}
          <div className="hidden lg:flex items-center justify-center w-full" style={{ paddingTop: "max(20px, env(safe-area-inset-top, 20px))", paddingBottom: 24 }}>
            <img src={logoImage} alt="Fowards" style={{ width: 38, height: 38, objectFit: "contain", mixBlendMode: "screen", display: "block" }} />
          </div>

          <div className="w-full max-w-[672px] flex items-center lg:flex-col lg:max-w-none lg:gap-8 lg:flex-1 lg:justify-center">

            <Link to="/" className="flex-1 h-[56px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full" style={{ textDecoration: "none" }}>
              <motion.div whileTap={{ scale: 0.82 }}>
                <Home style={{ width: 25, height: 25, color: isActive("/") ? "#fff" : "rgba(255,255,255,0.38)", strokeWidth: isActive("/") ? 2.2 : 1.7, transition: "color 0.18s" }} />
              </motion.div>
            </Link>

            <Link to="/tribes" className="flex-1 h-[56px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full" style={{ textDecoration: "none" }}>
              <motion.div whileTap={{ scale: 0.82 }}>
                <Users style={{ width: 25, height: 25, color: isActive("/tribes") ? "#fff" : "rgba(255,255,255,0.38)", strokeWidth: isActive("/tribes") ? 2.2 : 1.7, transition: "color 0.18s" }} />
              </motion.div>
            </Link>

            <div className="flex-[1.4] h-[56px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full">
              <Link to="/ai" style={{ textDecoration: "none" }} onClick={() => navigator.vibrate?.(12)}>
                <motion.div
                  className="fw-nav-ai-btn"
                  whileTap={{ scale: 0.90 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  style={{ height: 38, paddingLeft: 18, paddingRight: 18, borderRadius: 999, background: isActive("/ai") ? "#7c3aed" : "#4c1d95", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Sparkles style={{ width: 18, height: 18, color: "#fff", strokeWidth: 2 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.2 }}>IA</span>
                </motion.div>
              </Link>
            </div>

            <Link to="/notifications" className="flex-1 h-[56px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full" style={{ textDecoration: "none" }}>
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

            <Link to="/profile" className="flex-1 h-[56px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full" style={{ textDecoration: "none" }}>
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