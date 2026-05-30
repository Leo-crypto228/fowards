import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Home, Users, Target, Loader2, Bell } from "lucide-react";
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
  // /ai/new, /ai/:conversationId, /ai/profile — tout sauf /ai (liste)
  const isAiConversation = location.pathname.startsWith("/ai/");
  // Page IA accueil — gère elle-même height + safe-area, main ne doit pas scroller
  const isAIHome = location.pathname === "/ai";
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

  // ── Auth guard + onboarding guard ──────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirect}`, { replace: true });
      return;
    }

    // Comptes existants : on nettoie definitivement le flag d'onboarding legacy
    try { localStorage.removeItem("ff_needs_onboarding"); } catch {}

    // Onboarding V2 : si l'onboarding n'est pas terminé,
    // rediriger vers la bonne étape (profile ou ia)
    if (!user.onboarding_complete) {
      const onboardingRoutes = ["/onboarding/profile", "/onboarding/ia"];
      const alreadyOnOnboarding = onboardingRoutes.some((r) => location.pathname.startsWith(r));
      if (!alreadyOnOnboarding) {
        // Règle de priorité :
        //   1. Si onboardingDone=true (compte existant avec profil déjà créé)
        //      → toujours /onboarding/ia, JAMAIS /onboarding/profile
        //      Évite qu'un reload avec un mauvais onboarding_step en cache
        //      renvoie un utilisateur existant vers la page profil.
        //   2. Sinon : nouveau compte → utiliser onboarding_step ou "profile" par défaut
        const target = user.onboardingDone
          ? "/onboarding/ia"
          : (user.onboarding_step === "ia" ? "/onboarding/ia" : "/onboarding/profile");
        navigate(target, { replace: true });
      }
    }
  }, [user, loading, navigate, location.pathname]);

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
    if (path === "/feed") return location.pathname === "/feed";
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

      {/* ── Global status bar band — covers Dynamic Island / notch on ALL pages ── */}
      {/* Pas de borderBottom : sur les appareils sans encoche env(safe-area-inset-top)=0
          donc la div a une hauteur de 0 mais la bordure se verrait quand même. */}
      <div aria-hidden style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: "env(safe-area-inset-top, 0px)",
        background: "#000",
        zIndex: 200,
        pointerEvents: "none",
      }} />

      <main
        id="app-scroll"
        className={`flex-1 overflow-x-hidden${hideNav || isAIHome ? "" : " overflow-y-auto fw-main"}`}
        style={{
          minHeight: 0,
          // Pour /ai : aucun padding, pas de scroll — la page gère elle-même tout son espace
          paddingTop: isAIHome ? 0 : "env(safe-area-inset-top, 0px)",
          paddingBottom: isAIHome ? 0 : (hideNav ? 0 : 60),
          overflowY: isAIHome ? "hidden" : undefined,
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

            <Link to="/feed" className="flex-1 h-[56px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full" style={{ textDecoration: "none" }}>
              <motion.div whileTap={{ scale: 0.82 }}>
                <Home style={{ width: 25, height: 25, color: isActive("/feed") ? "#fff" : "rgba(255,255,255,0.38)", strokeWidth: isActive("/feed") ? 2.2 : 1.7, transition: "color 0.18s" }} />
              </motion.div>
            </Link>

            <Link to="/tribes" className="flex-1 h-[56px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full" style={{ textDecoration: "none" }}>
              <motion.div whileTap={{ scale: 0.82 }}>
                <Users style={{ width: 25, height: 25, color: isActive("/tribes") ? "#fff" : "rgba(255,255,255,0.38)", strokeWidth: isActive("/tribes") ? 2.2 : 1.7, transition: "color 0.18s" }} />
              </motion.div>
            </Link>

            <div className="flex-[1.4] h-[56px] flex justify-center items-center lg:flex-none lg:h-[56px] lg:w-full">
              <Link to="/ai" style={{ textDecoration: "none" }} onClick={() => navigator.vibrate?.(12)}>
                <motion.img
                  src={logoImage}
                  alt="IA"
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  style={{
                    width: 30, height: 30,
                    objectFit: "contain",
                    mixBlendMode: "screen",
                    display: "block",
                    opacity: isActive("/ai") ? 1 : 0.42,
                    transition: "opacity 0.18s",
                  } as React.CSSProperties}
                />
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

          {/* ── Desktop only : bouton "Pose ta situation" en bas de la sidebar ── */}
          <div className="hidden lg:flex w-full flex-col"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))", padding: "0 10px", paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
            <Link
              to="/create"
              onClick={() => navigator.vibrate?.(12)}
              style={{ textDecoration: "none", width: "100%" }}
            >
              <motion.div
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                style={{
                  background: "#6366f1",
                  borderRadius: 18,
                  padding: "11px 6px",
                  textAlign: "center",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#fff",
                  lineHeight: 1.35,
                  letterSpacing: "0.01em",
                  boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
                }}
              >
                Pose ta<br />situation
              </motion.div>
            </Link>
          </div>

        </motion.nav>
      )}

    </div>
  );
}