import { ProgressCard } from "../components/ProgressCard";
import { Search, WifiOff, Wifi, RefreshCw, Plus } from "lucide-react";
import logoImage from "figma:asset/cd3b49eafdee7adc585eb4cea8cc18850443b810.png";
import { motion } from "motion/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";

import { FollowButton } from "../components/FollowButton";
import { searchHashtags, searchUsers } from "../data/suggestions";
import { HighlightInput } from "../components/HighlightInput";
import { getAllPosts, ApiPost } from "../api/postsApi";
import { getFollowingFeed, type FeedPost } from "../api/followsApi";
import { getBatchGoalProgress } from "../api/progressionApi";
import { useFollow } from "../context/FollowContext";
import { useAuth } from "../context/AuthContext";
import { GLOBAL_PROFILES_MAP } from "../data/profiles";
import { getWaysFeed, type WaysFeedEntry } from "../api/waysApi";

const USER_AVATAR =
  "https://images.unsplash.com/photo-1584940121730-93ffb8aa88b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200";
const USER_STREAK = 27;

const TABS = ["Pour vous", "Abonnements"] as const;
type Tab = (typeof TABS)[number];

// Module-level cache: persists while the page is open, avoids refetch on back-navigation
const FEED_CACHE_TTL = 300_000;
let _feedCache: { posts: ApiPost[]; ts: number } | null = null;

// ── Le registre de profils est maintenant centralisé dans /src/app/data/profiles.ts
// GLOBAL_PROFILES_MAP est importé depuis ce module.

/* ───── Subscription profile card ───── */
function SubscriptionCard({ name, avatar, streak, objective, progress, followers, username: usernameProp }: {
  name: string; avatar: string; streak: number; objective: string; progress: number; followers: number;
  username?: string;
}) {
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);
  const safeName = name || "";
  const handle   = safeName.toLowerCase().replace(/\s+/g, "_");
  const username = usernameProp || safeName.toLowerCase().replace(/\s+/g, "");
  const initial  = (safeName.trim()[0] ?? "?").toUpperCase();

  const CARD_W   = 178;
  const BANNER_H = 78;
  const AVT      = 52;
  const AVT_TOP  = BANNER_H - Math.round(AVT * (2 / 3));
  const PTOP     = Math.round(AVT / 3) + 10;

  // Palette de couleurs de fallback dérivée du nom
  const fallbackBg = ["#1e1b4b","#0f172a","#14291a","#1a1429","#1a2740"][
    (safeName.charCodeAt(0) ?? 0) % 5
  ];

  return (
    <motion.div
      className="flex-shrink-0"
      style={{
        width: CARD_W,
        borderRadius: 20,
        background: "#0d0d0d",
        border: "0.5px solid rgba(255,255,255,0.09)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.05)",
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        userSelect: "none",
      }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onClick={() => navigate(`/profile/${username}`)}
    >
      {/* ── Bannière (~35%) ── */}
      <div style={{ height: BANNER_H, overflow: "hidden", position: "relative", background: fallbackBg }}>
        {avatar && !imgFailed ? (
          <img
            src={avatar}
            alt=""
            onError={() => setImgFailed(true)}
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              filter: "blur(10px) saturate(1.3) brightness(0.55)",
              transform: "scale(1.18)",
            }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(135deg, ${fallbackBg} 0%, rgba(0,0,0,0.6) 100%)`,
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(13,13,13,0.72) 100%)",
        }} />
      </div>

      {/* ── Avatar chevauchant ── */}
      <div
        style={{
          position: "absolute", top: AVT_TOP, left: 14, zIndex: 5,
          width: AVT, height: AVT, borderRadius: "50%",
          overflow: "hidden",
          border: "2.5px solid rgba(255,255,255,0.82)",
          boxShadow: "0 3px 14px rgba(0,0,0,0.45)",
          background: fallbackBg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {avatar && !imgFailed ? (
          <img
            src={avatar}
            alt={name}
            onError={() => setImgFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: AVT * 0.40, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>
            {initial}
          </span>
        )}
      </div>

      {/* ── Contenu texte — ancré juste sous l'avatar ── */}
      <div
        style={{
          paddingTop: PTOP,
          paddingLeft: 14,
          paddingRight: 14,
          paddingBottom: 16,
        }}
      >
        {/* Nom complet */}
        <p
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 3,
          }}
        >
          {name}
        </p>

        {/* @handle */}
        <p
          style={{
            fontSize: 13,
            fontWeight: 400,
            color: "rgba(255,255,255,0.32)",
            marginBottom: 8,
          }}
        >
          {handle}
        </p>

        {/* Objectif + abonnés */}
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.50)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
            marginBottom: 4,
          }}
        >
          {objective}
        </p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginBottom: 10 }}>
          {followers >= 1000 ? `${(followers / 1000).toFixed(1)}k` : followers} abonnés
        </p>

        {/* Barre de progression */}
        <div style={{ marginBottom: 5 }}>
          <div
            style={{
              position: "relative",
              height: 5,
              borderRadius: 999,
              background: "rgba(255,255,255,0.07)",
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.1, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #4f46e5 0%, #818cf8 60%, #a5b4fc 100%)",
                boxShadow: "0 0 8px rgba(99,102,241,0.55)",
              }}
            />
          </div>
        </div>

        {/* Pourcentage */}
        <p
          style={{
            fontSize: 11,
            color: "rgba(165,180,252,0.65)",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {progress}% de l'objectif
        </p>

        {/* Bouton Avancez avec — composant partagé */}
        <div style={{ marginTop: 10 }}>
          <FollowButton username={username} size="sm" />
        </div>
      </div>
    </motion.div>
  );
}

/* ───��─ Autocomplete dropdown ───── */
function AutocompleteDropdown({
  hashSuggestions, userSuggestions, onSelectHash, onSelectUser,
}: {
  hashSuggestions: string[];
  userSuggestions: { handle: string; name: string; avatar: string }[];
  onSelectHash: (h: string) => void;
  onSelectUser: (u: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14 }}
      style={{
        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60,
        background: "#0d0d0d",
        border: "1px solid rgba(255,255,255,0.10)",
        borderTop: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "0 0 22px 22px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.72)",
        overflow: "hidden",
      }}
    >
      {hashSuggestions.map((h, i) => (
        <motion.button key={h} whileTap={{ scale: 0.97 }} onClick={() => onSelectHash(h)}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 18px",
            background: "transparent", border: "none",
            borderBottom: i < hashSuggestions.length - 1 || userSuggestions.length > 0
              ? "0.5px solid rgba(255,255,255,0.07)" : "none",
            cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{ fontSize: 14, color: "#818cf8", fontWeight: 700 }}>#</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.82)", fontWeight: 500 }}>{h}</span>
        </motion.button>
      ))}
      {userSuggestions.map((u, i) => (
        <motion.button key={u.handle} whileTap={{ scale: 0.97 }} onClick={() => onSelectUser(u.handle)}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 18px",
            background: "transparent", border: "none",
            borderBottom: i < userSuggestions.length - 1 ? "0.5px solid rgba(255,255,255,0.07)" : "none",
            cursor: "pointer", textAlign: "left",
          }}
        >
          <img src={u.avatar} alt={u.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(99,102,241,0.25)" }} />
          <div>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{u.name}</span>
            <span style={{ fontSize: 12, color: "#818cf8", marginLeft: 6 }}>{u.handle}</span>
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
}

/* ───── Main Feed ───── */
export function Feed() {
  const [activeTab, setActiveTab] = useState<Tab>("Pour vous");
  const [query, setQuery] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { followedList, currentUserId } = useFollow();
  const { user: authUser } = useAuth();

  // ── Scroll-aware header ────────────────────────────────────────────────────
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    if (!headerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setHeaderH(e.contentRect.height + 2); // +2 for border
    });
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  // Reset header + scroll à chaque arrivée sur le feed
  useEffect(() => {
    if (location.pathname !== "/") return;
    setHeaderVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const scrollEl = document.querySelector("main") as HTMLElement | null;
    if (scrollEl) scrollEl.scrollTop = 0;
    lastScrollY.current = 0;
  }, [location.pathname]);

  useEffect(() => {
    const scrollEl = document.querySelector("main") as HTMLElement | null;
    if (!scrollEl) return;

    const onScroll = () => {
      const y = scrollEl.scrollTop;
      const delta = y - lastScrollY.current;

      // Always visible at very top
      if (y < 8) {
        setHeaderVisible(true);
        if (idleTimer.current) clearTimeout(idleTimer.current);
        lastScrollY.current = y;
        return;
      }

      if (delta < -4) setHeaderVisible(true);      // scroll UP → show
      else if (delta > 4) setHeaderVisible(false);  // scroll DOWN → hide

      lastScrollY.current = y;

      // Auto-hide after 1.5s idle (only when not at top)
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setHeaderVisible(false), 1500);
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  // Utiliser les vraies données de l'utilisateur connecté
  const liveAvatar = authUser?.avatar || USER_AVATAR;
  const liveStreak = authUser?.streak ?? USER_STREAK;

  // ── API posts state ──────────────────────────────────────────────────────
  const [apiPosts, setApiPosts] = useState<ApiPost[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchApiPosts = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && _feedCache && Date.now() - _feedCache.ts < FEED_CACHE_TTL) {
      setApiPosts(_feedCache.posts);
      return;
    }
    setLoadingApi(true);
    setApiError(null);
    try {
      const { posts } = await getAllPosts(60, currentUserId || undefined);
      const valid = posts
        .filter(p => p?.user?.name)
        .filter(p => !p.id?.startsWith("seed-"));
      valid.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      _feedCache = { posts: valid, ts: Date.now() };
      setApiPosts(valid);
    } catch (err) {
      console.error("Erreur chargement posts API:", err);
      setApiError("Serveur temporairement inaccessible.");
    } finally {
      setLoadingApi(false);
    }
  }, []);

  useEffect(() => {
    fetchApiPosts(!!location.state?.refreshPosts);
  }, [fetchApiPosts, location.state?.refreshPosts]);

  // Rafraîchit le feed quand le post est entièrement créé (toutes les images uploadées)
  useEffect(() => {
    const handler = () => fetchApiPosts(true);
    window.addEventListener("fowards:post-created", handler);
    return () => window.removeEventListener("fowards:post-created", handler);
  }, [fetchApiPosts]);

  // ── Ways feed ────────────────────────────────────────────────────────────
  const [waysFeed, setWaysFeed] = useState<WaysFeedEntry[]>([]);
  const waysLoadedRef = useRef(false);

  const fetchWaysFeed = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { feed } = await getWaysFeed(currentUserId);
      setWaysFeed(feed);
      waysLoadedRef.current = true;
    } catch {
      // silently ignore
    }
  }, [currentUserId]);

  // Prefetch Ways feed and following feed in the background on mount
  useEffect(() => {
    if (currentUserId && !waysLoadedRef.current) fetchWaysFeed();
  }, [currentUserId, fetchWaysFeed]);

  useEffect(() => {
    if (activeTab === "Abonnements" && currentUserId && !waysLoadedRef.current) {
      fetchWaysFeed();
    }
  }, [activeTab, currentUserId, fetchWaysFeed]);

  // ── Feed Abonnements depuis Supabase ─────────────────────────────────────
  const [followingPosts, setFollowingPosts] = useState<FeedPost[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<{
    name: string; avatar: string; streak: number; objective: string;
    progress: number; followers: number; username: string;
  }[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const followingLoadedRef = useRef(false);

  // ── Vraie progression Supabase (objectif principal) pour TOUS les suivis ─────
  // Source de vérité unique — se met à jour à chaque changement de followedList.
  const [realGoalProgress, setRealGoalProgress] = useState<
    Record<string, { progress: number; title: string }>
  >({});

  const fetchRealGoalProgress = useCallback(async (usernames: string[]) => {
    if (!usernames.length) return;
    try {
      const result = await getBatchGoalProgress(usernames);
      setRealGoalProgress((prev) => ({ ...prev, ...result }));
    } catch (err) {
      console.error("Feed: erreur fetchRealGoalProgress:", err);
    }
  }, []);

  // Se déclenche à chaque changement de followedList (follow / unfollow / login)
  useEffect(() => {
    if (followedList.length > 0) fetchRealGoalProgress(followedList);
  }, [followedList, fetchRealGoalProgress]);

  const fetchFollowingFeed = useCallback(async (force = false) => {
    if (followingLoadedRef.current && !force) return;
    if (!currentUserId) return;
    setLoadingFollowing(true);
    setFollowingError(null);
    try {
      const { posts, following } = await getFollowingFeed(currentUserId, 50);
      setFollowingPosts(posts);

      // Dériver les profils cards depuis les posts (unique par username)
      const profileMap = new Map<string, {
        name: string; avatar: string; streak: number; objective: string;
        progress: number; followers: number; username: string;
      }>();
      for (const p of posts) {
        if (!profileMap.has(p.username)) {
          profileMap.set(p.username, {
            name: p.user.name, avatar: p.user.avatar,
            streak: p.streak, objective: p.user.objective,
            progress: 0, // sera écrasé par realGoalProgress (state dédié)
            followers: p.user.followers ?? 0, username: p.username,
          });
        }
      }
      // Pour les suivis sans post encore dans Supabase, fallback sur GLOBAL_PROFILES_MAP
      for (const username of following) {
        if (!profileMap.has(username)) {
          const known = GLOBAL_PROFILES_MAP.get(username);
          if (known) profileMap.set(username, { ...known, progress: 0, username });
        }
      }
      setFollowingProfiles(Array.from(profileMap.values()));
      followingLoadedRef.current = true;
      // Déclenche aussi un fetch de progression pour les profils issus des posts
      fetchRealGoalProgress(Array.from(profileMap.keys()));
    } catch (err) {
      console.error("Erreur feed abonnements:", err);
      setFollowingError("Impossible de charger le feed abonnements.");
    } finally {
      setLoadingFollowing(false);
    }
  }, [currentUserId, fetchRealGoalProgress]);

  // Prefetch following feed on mount too
  useEffect(() => {
    if (currentUserId && !followingLoadedRef.current) fetchFollowingFeed();
  }, [currentUserId, fetchFollowingFeed]);

  useEffect(() => {
    if (activeTab === "Abonnements" && currentUserId) fetchFollowingFeed();
  }, [activeTab, fetchFollowingFeed, currentUserId]);

  // Recharger si la liste des suivis change ou si l'userId change
  const prevFollowedLen = useRef(followedList.length);
  const prevUserIdRef = useRef(currentUserId);
  useEffect(() => {
    const userChanged = prevUserIdRef.current !== currentUserId;
    const followsChanged = prevFollowedLen.current !== followedList.length;
    if (userChanged) {
      prevUserIdRef.current = currentUserId;
      followingLoadedRef.current = false;
      if (activeTab === "Abonnements" && currentUserId) fetchFollowingFeed(true);
    } else if (followsChanged) {
      prevFollowedLen.current = followedList.length;
      if (activeTab === "Abonnements") {
        followingLoadedRef.current = false;
        fetchFollowingFeed(true);
      }
    }
  }, [followedList.length, currentUserId, activeTab, fetchFollowingFeed]);

  // ── Filtre strict sur followedList (réactif immédiat au désabonnement) ─────
  const followedSet = new Set(followedList);

  // ── Cartes d'abonnements dérivées DIRECTEMENT de followedList ─────────────
  // Filtre strict : seules les personnes actuellement suivies apparaissent.
  // La progression est toujours overridée par realGoalProgress (source Supabase).
  const subscriptionProfileCards = (() => {
    const cardsMap = new Map<string, {
      name: string; avatar: string; streak: number;
      objective: string; progress: number; followers: number; username: string;
    }>();

    // 1. Données issues des posts Supabase — seulement si encore suivi
    for (const p of followingProfiles) {
      if (followedSet.has(p.username)) cardsMap.set(p.username, p);
    }

    // 2. Compléter avec GLOBAL_PROFILES_MAP pour les suivis sans posts Supabase
    for (const username of followedList) {
      if (!cardsMap.has(username)) {
        const known = GLOBAL_PROFILES_MAP.get(username);
        if (known) cardsMap.set(username, { ...known, username });
      }
    }

    // 3. Override ABSOLU de la progression par realGoalProgress (Supabase KV)
    //    Couvre TOUS les profils, qu'ils viennent de posts ou de GLOBAL_PROFILES_MAP.
    const cards = Array.from(cardsMap.values()).map((card) => {
      const real = realGoalProgress[card.username];
      return real !== undefined
        ? { ...card, progress: real.progress }
        : card;
    });

    return cards;
  })();

  // ── Posts abonnements filtrés en temps réel ───────────────────────────────
  // Quand on se désabonne, les posts de cette personne disparaissent
  // instantanément du feed sans attendre le rechargement serveur.
  const filteredFollowingPosts = followingPosts.filter(
    (p) => followedSet.has(p.username)
  );

  /* Detect # or @ trigger in query */
  const hashMatch = query.match(/#([^\s#@]*)$/);
  const atMatch   = query.match(/@([^\s#@]*)$/);
  const hashSuggestions = hashMatch ? searchHashtags(hashMatch[1]) : [];
  const userSuggestions = atMatch   ? searchUsers(atMatch[1])      : [];
  const hasAutocomplete = showAutocomplete && (hashSuggestions.length > 0 || userSuggestions.length > 0);

  const handleSelectHash = (h: string) => {
    setQuery((q) => q.replace(/#([^\s#@]*)$/, `#${h} `));
    setShowAutocomplete(false);
  };
  const handleSelectUser = (handle: string) => {
    setQuery((q) => q.replace(/@([^\s#@]*)$/, `@${handle} `));
    setShowAutocomplete(false);
  };

  // Naviguer vers la page de recherche complète
  const handleSearchSubmit = () => {
    if (!query.trim()) return;
    setShowAutocomplete(false);
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const displayedFeedPosts = apiPosts;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Fixed scroll-aware header ── */}
      <motion.div
        ref={headerRef}
        className="fixed left-0 right-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/50"
        style={{ top: 0 }}
        animate={{ y: headerVisible ? 0 : -(headerH || 165) }}
        transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.8 }}
      >
        <div className="max-w-2xl mx-auto px-3 pt-4 pb-0">

          {/* Row 1: logo centré */}
          <div className="flex items-center justify-center mb-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.25, 0, 0.35, 1] }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <img
                src={logoImage}
                alt="Fowards"
                style={{ width: 47, height: 47, objectFit: "contain", mixBlendMode: "screen", display: "block" }}
              />
            </motion.div>
          </div>

          {/* Row 2: Search bar — liquid glass */}
          <div ref={searchRef} style={{ position: "relative", marginBottom: 12 }}>
            {hasAutocomplete && (
              <div className="fixed inset-0 z-50" onClick={() => setShowAutocomplete(false)} />
            )}
            <motion.div
              className="flex items-center gap-2.5 px-4"
              style={{
                height: 44,
                background: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 4px 18px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.09)",
                borderRadius: hasAutocomplete ? "22px 22px 0 0" : "22px",
                transition: "border-radius 0.18s",
                position: "relative", zIndex: 51,
              }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.35 }}
            >
              <Search style={{ width: 15, height: 15, color: "rgba(150,150,175,0.55)", flexShrink: 0 }} />
              <HighlightInput
                value={query}
                onChange={(v) => { setQuery(v); setShowAutocomplete(true); }}
                onFocus={() => setShowAutocomplete(true)}
                placeholder="Recherchez des post, #hashtag ou @profil..."
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearchSubmit(); }}
              />
              {/* Bouton Rechercher → page complète */}
              
                {query.trim().length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.88 }}
                    onClick={handleSearchSubmit}
                    style={{
                      background: "rgba(99,102,241,0.80)", border: "none", borderRadius: 999,
                      padding: "4px 11px", cursor: "pointer", flexShrink: 0,
                      fontSize: 12, fontWeight: 700, color: "#fff",
                      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    }}
                  >
                    Chercher
                  </motion.button>
                )}
              
            </motion.div>
            
              {hasAutocomplete && (
                <AutocompleteDropdown
                  hashSuggestions={hashSuggestions}
                  userSuggestions={userSuggestions}
                  onSelectHash={handleSelectHash}
                  onSelectUser={handleSelectUser}
                />
              )}
            
          </div>

          {/* Row 3: Tabs */}
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative flex-1 py-3 transition-colors"
                style={{
                  color: activeTab === tab ? "var(--foreground)" : "var(--muted-foreground)",
                  fontWeight: activeTab === tab ? 600 : 400,
                  fontSize: 15,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 rounded-full"
                    style={{ height: 2, background: "#6366f1" }}
                    layoutId="feedTabIndicator"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Spacer = header height so content starts below the fixed header */}
      <div style={{ height: headerH || 165 }} />

      {/* ── Feed content ── */}
      <motion.div
        key={activeTab}
        className="max-w-2xl mx-auto pt-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {/* ── ONGLET ABONNEMENTS ── */}
        {activeTab === "Abonnements" && (
          <>
            {/* ── Ways circles ── */}
            <div style={{ padding: "8px 0 4px" }}>
              {/* Circles horizontal scroll */}
              {waysFeed.length > 0 && (
                <div
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    overflowX: "auto", paddingLeft: 16, paddingRight: 16, paddingBottom: 8,
                    scrollbarWidth: "none",
                  }}
                >
                  {waysFeed.map((entry) => {
                    const hasWays = entry.ways.length > 0;
                    const isSelf = entry.author.username === currentUserId;
                    const initial = (entry.author.name?.[0] ?? "?").toUpperCase();
                    const hasViewed = hasWays && !!localStorage.getItem(`ff:ways:viewed:${entry.ways[0].id}`);
                    return (
                      <motion.button
                        key={entry.author.username}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => hasWays
                          ? navigate(`/ways/${entry.ways[0].id}`)
                          : isSelf ? navigate("/ways/create") : undefined
                        }
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                          background: "none", border: "none", cursor: hasWays || isSelf ? "pointer" : "default",
                          flexShrink: 0, padding: 0,
                        }}
                      >
                        {/* Ring */}
                        <div
                          style={{
                            width: 66, height: 66, borderRadius: "50%", padding: 2.5,
                            background: hasWays && !hasViewed
                              ? "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #38bdf8 100%)"
                              : isSelf
                                ? "rgba(255,255,255,0.10)"
                                : "rgba(255,255,255,0.22)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              width: "100%", height: "100%", borderRadius: "50%",
                              background: "#09090f",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              overflow: "hidden",
                              border: hasWays ? "2px solid transparent" : "none",
                            }}
                          >
                            {entry.author.avatar ? (
                              <img
                                src={entry.author.avatar}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                              />
                            ) : (
                              <span style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{initial}</span>
                            )}
                          </div>
                        </div>
                        {/* + button for self with no ways */}
                        {isSelf && !hasWays && (
                          <div style={{
                            position: "absolute", bottom: 28, right: -2,
                            width: 20, height: 20, borderRadius: "50%",
                            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Plus style={{ width: 11, height: 11, color: "#fff" }} />
                          </div>
                        )}
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.60)", fontWeight: isSelf ? 700 : 400, maxWidth: 60, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {isSelf ? "Toi" : entry.author.name}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Séparateur visuel ── */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "4px 0 0" }} />

            {/* ── Header feed posts abonnements ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {loadingFollowing ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <RefreshCw style={{ width: 11, height: 11, color: "rgba(99,102,241,0.55)" }} />
                  </motion.div>
                ) : followingError ? (
                  <WifiOff style={{ width: 11, height: 11, color: "rgba(248,113,113,0.55)" }} />
                ) : (
                  <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2.2, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: filteredFollowingPosts.length > 0 ? "#22c55e" : "rgba(255,255,255,0.18)" }} />
                )}
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.30)", letterSpacing: "0.04em" }}>
                  {loadingFollowing ? "Chargement..." : followingError ? "Hors ligne" : filteredFollowingPosts.length > 0 ? `${filteredFollowingPosts.length} posts récents` : "Posts des abonnements"}
                </span>
              </div>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => { followingLoadedRef.current = false; fetchFollowingFeed(true); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6 }}>
                <RefreshCw style={{ width: 11, height: 11, color: "rgba(99,102,241,0.45)" }} />
              </motion.button>
            </div>

            {filteredFollowingPosts.length > 0 && (
              <>
                {filteredFollowingPosts.map((post, i) => (
                  <motion.div key={post.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.26 }}>
                    <ProgressCard
                      postId={post.id} user={post.user} streak={post.streak}
                      authorUsername={post.username}
                      isAnonymous={!!(post as any).isAnonymous}
                      isMineAnonymous={!!(post as any).isMineAnonymous}
                      progress={post.progress as { type: "infos"|"conseil"|"new"|"avancement"|"objectif"|"lecon"|"question"|"bilan"; description: string; timestamp: string }}
                      hashtags={post.hashtags} image={post.image ?? undefined} images={post.images}
                      verified={post.verified} isNew={post.isNew}
                      relevantCount={post.relevantCount} commentsCount={post.commentsCount}
                      sharesCount={post.sharesCount} viewsCount={post.viewsCount}
                      postCreatedAt={(post as any).createdAt}
                    />
                  </motion.div>
                ))}
              </>
            )}
            {filteredFollowingPosts.length === 0 && !loadingFollowing && !followingError && (
              <div style={{ padding: "32px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.22)" }}>Aucun post récent de tes abonnements.</p>
              </div>
            )}
          </>
        )}

        {/* ── ONGLET POUR VOUS ── */}
        {activeTab === "Pour vous" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 18px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {loadingApi ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <RefreshCw style={{ width: 11, height: 11, color: "rgba(99,102,241,0.55)" }} />
                  </motion.div>
                ) : apiError ? (
                  <WifiOff style={{ width: 11, height: 11, color: "rgba(248,113,113,0.55)" }} />
                ) : (
                  <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2.2, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: apiPosts.length > 0 ? "#22c55e" : "rgba(255,255,255,0.18)" }} />
                )}
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.30)", letterSpacing: "0.04em" }}>
                  {loadingApi
                    ? "Chargement..."
                    : apiError
                      ? "Hors ligne"
                      : apiPosts.length > 0
                        ? `${apiPosts.length} en direct`
                        : "Flux en direct"}
                </span>
              </div>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => fetchApiPosts(true)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6 }}>
                <RefreshCw style={{ width: 11, height: 11, color: "rgba(99,102,241,0.45)" }} />
              </motion.button>
            </div>

            {/* Bandeau hors-ligne discret — le feed reste lisible grâce au fallback */}
            
              {apiError && !loadingApi && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  style={{ margin: "0 12px 8px", padding: "8px 14px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "0.5px solid rgba(239,68,68,0.14)", display: "flex", alignItems: "center", gap: 8 }}>
                  <WifiOff style={{ width: 11, height: 11, color: "#f87171", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "rgba(252,165,165,0.70)" }}>
                    Connexion impossible · Réessaie dans un moment
                  </span>
                </motion.div>
              )}
            

            
              {displayedFeedPosts.map((post, i) => (
                <motion.div key={post.id ?? `demo-${i}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.26 }}>
                  {i === 0 && post.username === currentUserId && currentUserId !== "" && (
                    <div style={{ padding: "0 18px 5px", display: "flex", alignItems: "center", gap: 6 }}>
                      <Wifi style={{ width: 10, height: 10, color: "#818cf8" }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", letterSpacing: "0.07em" }}>VOTRE DERNIER POST</span>
                    </div>
                  )}
                  <ProgressCard
                    postId={post.id ?? `demo-${i}`}
                    user={post.user}
                    streak={post.streak}
                    authorUsername={(post as any).username ?? undefined}
                    isAnonymous={!!(post as any).isAnonymous}
                    isMineAnonymous={!!(post as any).isMineAnonymous}
                    progress={post.progress as { type: "infos"|"conseil"|"new"|"avancement"|"objectif"|"lecon"|"question"|"bilan"; description: string; timestamp: string }}
                    hashtags={post.hashtags}
                    image={post.image ?? undefined} images={post.images}
                    verified={post.verified}
                    isNew={post.isNew}
                    relevantCount={post.relevantCount}
                    commentsCount={post.commentsCount}
                    sharesCount={post.sharesCount}
                    viewsCount={post.viewsCount}
                    postCreatedAt={(post as any).createdAt}
                  />
                </motion.div>
              ))}
            

            {displayedFeedPosts.length === 0 && !loadingApi && (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.28)" }}>Aucun post pour l'instant.</p>
              </div>
            )}
          </>
        )}
      </motion.div>

      <div className="max-w-2xl mx-auto py-8 text-center">
        <p className="text-sm text-muted-foreground">Chargement d'autres avancements...</p>
      </div>
    </div>
  );
}