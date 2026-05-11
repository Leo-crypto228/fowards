import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import {
  Share2, MoreHorizontal,
  MessageCircle, Check, AlertTriangle, TrendingDown, ThumbsDown, Trash2,
} from "lucide-react";
import { getPostReactions, addPostReaction, type PostReactionType } from "../api/sharesApi";
import { triggerEloLike, triggerEloImpression } from "../api/eloApi";
import { recordDistributed } from "../api/privateStatsApi";
import { useFollow } from "../context/FollowContext";
import { FollowButton } from "./FollowButton";
import { fetchProfile, getCachedProfile, normalizeUsername } from "../api/profileCache";
import { renderPostText } from "../utils/renderText";
import { reportInappropriate, reduceAuthor, markNotRelevant } from "../api/postActionsApi";
import { fetchAuthorGoalProgress, getCachedGoalProgress } from "../api/goalProgressCache";
import { deletePost } from "../api/postsApi";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const AUTH_HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

function getSessionId(): string {
  try {
    let sid = localStorage.getItem("ff_session_id");
    if (!sid) {
      sid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("ff_session_id", sid);
    }
    return sid;
  } catch { return "anonymous"; }
}

type PostType =
  | "infos" | "conseil" | "new" | "avancement"
  | "objectif" | "lecon" | "question" | "bilan"
  | "avancee" | "blocage" | "actus";

interface ProgressCardProps {
  user: {
    name: string;
    avatar: string;
    objective: string;
    followers?: number;
  };
  authorUsername?: string;
  streak?: number;
  progress: {
    type: PostType;
    description: string;
    timestamp: string;
  };
  image?: string;
  images?: string[];
  verified?: boolean;
  isRelevant?: boolean;
  relevantCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  viewsCount?: number;
  isNew?: boolean;
  hashtags?: string[];
  memberSince?: number;
  hideStreak?: boolean;
  hideActions?: boolean;
  postId?: string;
  postCreatedAt?: string;
  disableDetailNav?: boolean;
  onPostDeleted?: () => void;
  isAnonymous?: boolean;
  isMineAnonymous?: boolean;
}

function AnonAvatar({ size }: { size: number }) {
  const icon = Math.round(size * 0.72);
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#636370", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,0.10)", flexShrink: 0 }}>
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none">
        {/* Chapeau — couronne */}
        <path d="M7 9 C7 5.5 8.5 1 12 1 C15.5 1 17 5.5 17 9 Z" fill="#111"/>
        {/* Chapeau — bord */}
        <rect x="1.5" y="8" width="21" height="2.5" rx="1.25" fill="#111"/>
        {/* Masque — lentille gauche */}
        <ellipse cx="7.5" cy="17.5" rx="4.5" ry="3" fill="#111"/>
        {/* Masque — lentille droite */}
        <ellipse cx="16.5" cy="17.5" rx="4.5" ry="3" fill="#111"/>
        {/* Pont central */}
        <rect x="11.3" y="16.2" width="1.4" height="2.6" fill="#111"/>
        {/* Trou œil gauche */}
        <ellipse cx="7.5" cy="17.5" rx="2.7" ry="1.75" fill="#636370"/>
        {/* Trou œil droit */}
        <ellipse cx="16.5" cy="17.5" rx="2.7" ry="1.75" fill="#636370"/>
      </svg>
    </div>
  );
}

let _cardMountCounter = 0;

const TYPE_LABELS: Record<PostType, string> = {
  avancee: "Avancée",
  blocage: "Blocage",
  actus: "Actus",
  infos: "Infos perso", conseil: "Conseil(s)", new: "New",
  avancement: "Avancement", objectif: "Objectif", lecon: "Leçon",
  question: "Question", bilan: "Bilan",
};

// ── CTA config per post type ───────────────────────────────────────────────────
const CTA_CONFIG: Partial<Record<PostType, { label: string; prefill: string }>> = {
  blocage:  { label: "J'ai une solution",  prefill: "J'ai une solution pour toi :" },
  question: { label: "J'ai une reponse",   prefill: "J'ai une reponse pour toi :" },
  avancee:  { label: "Encourager",         prefill: "Je veux t'encourager alors" },
  conseil:  { label: "Remercier",          prefill: "Tu m'as aidés à" },
  actus:    { label: "Je veux rebondir",   prefill: "Je trouve que c'est" },
};

const SEC: React.CSSProperties = {
  fontSize: 11.5,
  color: "rgba(255,255,255,0.34)",
  fontWeight: 400,
  lineHeight: 1.4,
};

// ── Post menu ─────────────────────────────────────────────────────────────────
interface PostMenuProps {
  postId?: string;
  authorUsername: string;
  authorName: string;
  postContent: string;
  currentUserId: string;
  isOwner?: boolean;
  onClose: () => void;
  onPostDeleted?: () => void;
}

function PostMenu({ postId, authorUsername, authorName, postContent, currentUserId, isOwner, onClose, onPostDeleted }: PostMenuProps) {
  type ActionState = "idle" | "loading" | "done" | "error";
  const [states, setStates] = useState<Record<string, ActionState>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const setAction = (key: string, state: ActionState, msg?: string) => {
    setStates((s) => ({ ...s, [key]: state }));
    if (msg) setFeedback((f) => ({ ...f, [key]: msg }));
  };

  const handleDelete = async () => {
    if (!postId || states["delete"] === "loading" || states["delete"] === "done") return;
    setAction("delete", "loading");
    try {
      await deletePost(postId);
      setAction("delete", "done", "Supprimé ✓");
      setTimeout(() => { onPostDeleted?.(); onClose(); }, 900);
    } catch {
      setAction("delete", "error", "Erreur, réessaie");
    }
  };

  const handleReport = async () => {
    if (!postId || !currentUserId || states["report"] === "loading" || states["report"] === "done") return;
    setAction("report", "loading");
    try {
      const res = await reportInappropriate(postId, currentUserId);
      if (res.alreadyReported) {
        setAction("report", "done", "Déjà signalé");
      } else if (res.deleted) {
        setAction("report", "done", "Post supprimé ✓");
        setTimeout(() => { onPostDeleted?.(); onClose(); }, 1200);
      } else {
        setAction("report", "done", "Signalé ✓");
        setTimeout(onClose, 1200);
      }
    } catch {
      setAction("report", "error", "Erreur, réessaie");
    }
  };

  const handleReduceAuthor = async () => {
    if (!currentUserId || states["reduce"] === "loading" || states["reduce"] === "done") return;
    setAction("reduce", "loading");
    try {
      await reduceAuthor(currentUserId, authorUsername);
      setAction("reduce", "done", "Préférence enregistrée ✓");
      setTimeout(onClose, 1100);
    } catch {
      setAction("reduce", "error", "Erreur, réessaie");
    }
  };

  const handleNotRelevant = async () => {
    if (!postId || !currentUserId || states["notrelevant"] === "loading" || states["notrelevant"] === "done") return;
    setAction("notrelevant", "loading");
    try {
      await markNotRelevant(currentUserId, postId);
      setAction("notrelevant", "done", "Noté ✓");
      setTimeout(onClose, 1000);
    } catch {
      setAction("notrelevant", "error", "Erreur, réessaie");
    }
  };

  const deleteItem = isOwner ? [{
    key: "delete",
    label: "Supprimer le post",
    doneLabel: feedback["delete"] || "Supprimé ✓",
    icon: Trash2,
    color: "#f87171",
    onClick: handleDelete,
  }] : [];

  const socialItems = [
    {
      key: "notrelevant",
      label: "Ce post n'est pas pertinent",
      doneLabel: feedback["notrelevant"] || "Noté ✓",
      icon: ThumbsDown,
      color: "rgba(210,210,225,0.80)",
      onClick: handleNotRelevant,
    },
    {
      key: "reduce",
      label: `Moins voir les posts de ${authorName}`,
      doneLabel: feedback["reduce"] || "Préférence enregistrée ✓",
      icon: TrendingDown,
      color: "rgba(210,210,225,0.80)",
      onClick: handleReduceAuthor,
    },
    {
      key: "report",
      label: "Signaler du contenu inapproprié",
      doneLabel: feedback["report"] || "Signalé ✓",
      icon: AlertTriangle,
      color: "#f87171",
      onClick: handleReport,
    },
  ];

  const ITEMS = [...deleteItem, ...socialItems];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{
        position: "absolute",
        bottom: 52, right: 8,
        zIndex: 100,
        minWidth: 252,
        background: "rgba(8,8,12,0.97)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: "0.5px solid rgba(255,255,255,0.09)",
        borderRadius: 16,
        boxShadow: "0 16px 48px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.04)",
        overflow: "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {ITEMS.map((item, i) => {
        const state = states[item.key] || "idle";
        const isDone = state === "done";
        const isLoading = state === "loading";
        const isDelete = item.key === "delete";
        return (
          <motion.button
            key={item.key}
            whileTap={{ scale: 0.97 }}
            onClick={item.onClick}
            disabled={isDone || isLoading}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              width: "100%", padding: "13px 18px",
              background: isDelete && !isDone
                ? "rgba(248,113,113,0.06)"
                : isDone ? "rgba(255,255,255,0.04)" : "transparent",
              border: "none",
              borderBottom: i < ITEMS.length - 1
                ? isDelete
                  ? "0.5px solid rgba(248,113,113,0.12)"
                  : "0.5px solid rgba(255,255,255,0.06)"
                : "none",
              cursor: isDone ? "default" : "pointer",
              textAlign: "left", transition: "background 0.15s",
              opacity: isDone ? 0.75 : 1,
            }}
          >
            {isLoading
              ? <Loader2 className="animate-spin" style={{ width: 15, height: 15, color: item.color, flexShrink: 0, strokeWidth: 1.8 }} />
              : <item.icon style={{ width: 15, height: 15, color: isDone ? "rgba(255,255,255,0.5)" : item.color, flexShrink: 0, strokeWidth: 1.8 }} />
            }
            <span style={{ fontSize: 13.5, color: isDone ? "rgba(255,255,255,0.5)" : item.color, fontWeight: isDelete ? 600 : (isDone ? 600 : 400), lineHeight: 1.3 }}>
              {isDone ? item.doneLabel : item.label}
            </span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ── Verified badge ───────────────────────────────────────────────────────────
function VerifiedBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 14, height: 14, borderRadius: "50%", background: "#6366f1", flexShrink: 0,
    }}>
      <Check style={{ width: 8, height: 8, color: "#fff", strokeWidth: 3 }} />
    </span>
  );
}

// ── Scroll-aware progress bar ─────────────────────────────────────────────────
function ViewProgressBar({ progress, isNew }: { progress: number; isNew: boolean }) {
  const pct = Math.max(0, Math.min(100, progress));
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setSeen(true); observer.disconnect(); } },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, borderRadius: "20px 20px 0 0", overflow: "visible", zIndex: 6 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.04)", borderRadius: "20px 20px 0 0" }} />
      <motion.div
        style={{ position: "absolute", top: 0, left: 0, height: "100%", background: "#6366f1", borderRadius: "20px 20px 0 0" }}
        initial={{ width: "0%" }}
        animate={{ width: seen ? `${pct}%` : "0%" }}
        transition={{ duration: 1.3, ease: "easeOut" }}
      />
      <motion.div
        style={{
          position: "absolute", top: "50%", translateY: "-50%",
          width: 5, height: 5, borderRadius: "50%",
          background: "#6366f1", boxShadow: "0 0 6px 2px rgba(99,102,241,0.7)",
          marginLeft: -2.5,
        }}
        initial={{ left: "0%" }}
        animate={{ left: seen ? `${pct}%` : "0%" }}
        transition={{ duration: 1.3, ease: "easeOut" }}
      />
      {isNew && !seen && (
        <motion.div
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100%", background: "#6366f1", filter: "blur(3px)" }}
          animate={{ opacity: [0.15, 0.55, 0.15] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

// ── Star / Like icon (4-pointed sparkle, tilted) ──────────────────────────────
// OFF: white outline, no fill
// ON:  filled #574fe0
function SparkleIcon({ active, size = 20 }: { active: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C12 8 8 12 2 12C8 12 12 16 12 22C12 16 16 12 22 12C16 12 12 8 12 2Z"
        fill={active ? "#574fe0" : "none"}
        stroke={active ? "#574fe0" : "#ffffff"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {!active && (
        <path
          d="M12 5C12 8.5 9 11 4.5 12C9 13 12 15.5 12 19C12 15.5 15 13 19.5 12C15 11 12 8.5 12 5Z"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

// ── 4-bar stats icon ──────────────────────────────────────────────────────────
function BarStatsIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0"    y="9"  width="3" height="5"  rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="5"    y="5"  width="3" height="9"  rx="1" fill="currentColor" opacity="0.85"/>
      <rect x="10"   y="2"  width="3" height="12" rx="1" fill="currentColor"/>
      <rect x="15"   y="0"  width="3" height="14" rx="1" fill="currentColor"/>
    </svg>
  );
}

// ── Multi-image carousel ──────────────────────────────────────────────────────
function MultiImageCarousel({ images }: { images: string[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setActiveIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div style={{ marginTop: 4, position: "relative", overflow: "hidden" }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ display: "flex", overflowX: "scroll", scrollSnapType: "x mandatory", scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
        className="[&::-webkit-scrollbar]:hidden"
      >
        {images.map((url, i) => (
          <div key={i} style={{ flexShrink: 0, width: "100%", scrollSnapAlign: "start", aspectRatio: "3/4" }}>
            <img src={url} alt="" loading={i === 0 ? "eager" : "lazy"}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ))}
      </div>
      {/* Dots */}
      <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, pointerEvents: "none" }}>
        {images.map((_, i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === activeIdx ? "#ffffff" : "rgba(255,255,255,0.38)", transition: "background 0.2s" }} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ProgressCard({
  user,
  authorUsername,
  streak: _streak = 0,
  progress,
  image,
  images: imagesProp,
  verified = false,
  isRelevant = false,
  relevantCount = 0,
  commentsCount = 0,
  sharesCount = 0,
  viewsCount = 0,
  isNew = false,
  hashtags = [],
  memberSince,
  hideStreak: _hideStreak = false,
  hideActions = false,
  postId,
  postCreatedAt,
  disableDetailNav = false,
  onPostDeleted,
  isAnonymous = false,
  isMineAnonymous = false,
}: ProgressCardProps) {
  const navigate = useNavigate();
  const { currentUserId } = useFollow();

  const postUsername = authorUsername
    ? normalizeUsername(authorUsername)
    : normalizeUsername(user?.name || "");
  const isSelfPost = isMineAnonymous || (currentUserId !== "" && postUsername === normalizeUsername(currentUserId));

  // ── Live profile data ──────────────────────────────────────────────────────
  const [liveAvatar, setLiveAvatar] = useState(user.avatar);
  const [liveObjective, setLiveObjective] = useState(user.objective);
  const [liveFollowers, setLiveFollowers] = useState(user.followers);

  // ── Author goal progress ───────────────────────────────────────────────────
  const [authorProgress, setAuthorProgress] = useState<number>(
    () => getCachedGoalProgress(normalizeUsername(user?.name || "")) ?? 0
  );

  useEffect(() => {
    if (!postUsername || isAnonymous) return;
    const cached = getCachedProfile(postUsername);
    if (cached) {
      if (cached.avatar)    setLiveAvatar(cached.avatar);
      if (cached.objective) setLiveObjective(cached.objective);
      setLiveFollowers(cached.followers);
      return;
    }
    fetchProfile(postUsername).then((p) => {
      if (!p) return;
      if (p.avatar)    setLiveAvatar(p.avatar);
      if (p.objective) setLiveObjective(p.objective);
      setLiveFollowers(p.followers);
    });
  }, [postUsername, isAnonymous]);

  useEffect(() => {
    if (!postUsername) return;
    const cached = getCachedGoalProgress(postUsername);
    if (cached !== undefined) { setAuthorProgress(cached); return; }
    fetchAuthorGoalProgress(postUsername)
      .then((pct) => setAuthorProgress(pct))
      .catch(() => {});
  }, [postUsername]);

  // ── Reactions (Supabase) ──────────────────────────────────────────────────
  const [activeReaction, setActiveReaction] = useState<string | null>(isRelevant ? "Pertinent" : null);
  const [count, setCount] = useState(relevantCount);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [reactionPending, setReactionPending] = useState(false);
  const [sparkleKey, setSparkleKey] = useState(0);

  // ── Text expand/collapse ──────────────────────────────────────────────────
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandable = useMemo(() => {
    return progress.description.includes("\n") || progress.description.length > 100;
  }, [progress.description]);

  // ── Views ─────────────────────────────────────────────────────────────────
  const [liveViewsCount, setLiveViewsCount] = useState(viewsCount);
  const cardRef           = useRef<HTMLDivElement>(null);
  const viewTracked       = useRef(false);
  const viewTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eloLiked          = useRef(false);
  const eloImpressionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!postId || viewTracked.current) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewTracked.current) {
          viewTimerRef.current = setTimeout(async () => {
            if (viewTracked.current) return;
            viewTracked.current = true;
            setLiveViewsCount((c) => c + 1);
            try {
              await fetch(`${BASE_URL}/posts/${postId}/view`, {
                method: "POST",
                headers: AUTH_HEADERS,
                body: JSON.stringify({ sessionId: getSessionId() }),
              });
            } catch (err) {
              console.error("Erreur vue post:", err);
            }
            observer.disconnect();
          }, 1000);
        } else if (!entry.isIntersecting && viewTimerRef.current) {
          clearTimeout(viewTimerRef.current);
          viewTimerRef.current = null;
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    };
  }, [postId]);

  // Elo impression — fires R=0 once per user/post after 3 s of visibility without a like
  // Also records distribution (post shown to user in feed) on first viewport entry
  useEffect(() => {
    if (!postId || !currentUserId) return;
    const sessionKey = `ff:elo:imp:${postId}`;
    const distKey = `ff:dist:${postId}`;
    try { if (sessionStorage.getItem(sessionKey)) return; } catch {}
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          try {
            if (!sessionStorage.getItem(distKey)) {
              sessionStorage.setItem(distKey, "1");
              recordDistributed(postId, currentUserId);
            }
          } catch {}
          eloImpressionTimer.current = setTimeout(() => {
            if (eloLiked.current) return;
            try { sessionStorage.setItem(sessionKey, "1"); } catch {}
            triggerEloImpression(postId, currentUserId, postCreatedAt || new Date().toISOString());
          }, 3000);
        } else {
          if (eloImpressionTimer.current) { clearTimeout(eloImpressionTimer.current); eloImpressionTimer.current = null; }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (eloImpressionTimer.current) clearTimeout(eloImpressionTimer.current);
    };
  }, [postId, currentUserId, postCreatedAt]);

  useEffect(() => {
    if (!postId) return;
    const mountIndex = _cardMountCounter++;
    const staggerMs = Math.min(mountIndex * 80, 1200) + Math.random() * 60;
    const timer = setTimeout(() => {
      getPostReactions(postId, currentUserId)
        .then(({ myReaction, total }) => {
          setActiveReaction(myReaction);
          if (total > 0) setCount(total);
        })
        .catch(() => {});
    }, staggerMs);
    return () => clearTimeout(timer);
  }, [postId]);

  const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  const formatFollowers = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  const persistReaction = useCallback(async (reactionType: PostReactionType) => {
    if (!postId || reactionPending) return;
    const willRemove = activeReaction === reactionType;
    const hadReaction = activeReaction !== null;
    setReactionPending(true);
    if (willRemove) { setActiveReaction(null); setCount((c) => Math.max(0, c - 1)); }
    else { setActiveReaction(reactionType); if (!hadReaction) setCount((c) => c + 1); }
    try {
      const result = await addPostReaction(postId, currentUserId, reactionType);
      setActiveReaction(result.myReaction);
      setCount(result.total);
      // Elo: fire only for new likes, not unlikes
      if (!willRemove && !result.removed) {
        eloLiked.current = true;
        if (eloImpressionTimer.current) { clearTimeout(eloImpressionTimer.current); eloImpressionTimer.current = null; }
        triggerEloLike(postId, currentUserId, postCreatedAt || new Date().toISOString());
      }
    } catch (err) {
      console.error(`Erreur persistance réaction (post ${postId}):`, err);
      if (willRemove) { setActiveReaction(reactionType); setCount((c) => c + 1); }
      else { setActiveReaction(hadReaction ? activeReaction : null); if (!hadReaction) setCount((c) => Math.max(0, c - 1)); }
    } finally { setReactionPending(false); }
  }, [postId, reactionPending, activeReaction]);

  const handlePertinentClick = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(14);
    setSparkleKey((k) => k + 1);
    if (postId) {
      persistReaction("Pertinent");
    } else {
      const had = activeReaction !== null;
      if (activeReaction === "Pertinent") { setActiveReaction(null); setCount((c) => c - 1); }
      else { setActiveReaction("Pertinent"); if (!had) setCount((c) => c + 1); }
    }
  }, [activeReaction, postId, persistReaction]);

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${postUsername}`);
  };

  const handleCardClick = () => {
    if (showPostMenu) { setShowPostMenu(false); return; }
    if (disableDetailNav) return;
    const id = postId ?? `${user?.name || "post"}-${progress.timestamp}`.replace(/\s+/g, "-");
    const postData = { user, progress, image, images: imagesProp, verified, relevantCount: count, commentsCount, sharesCount, viewsCount: liveViewsCount, isNew, hashtags, postCreatedAt };
    try { sessionStorage.setItem("ff_last_post", JSON.stringify(postData)); } catch {}
    navigate(`/post/${encodeURIComponent(id)}`, { state: { post: postData } });
  };

  // ── Navigate to PostDetail with section scroll + optional prefill ─────────
  const navigateToPost = useCallback((scrollTo?: "comments" | "share" | "stats", prefillText?: string) => {
    const id = postId ?? `${user?.name || "post"}-${progress.timestamp}`.replace(/\s+/g, "-");
    const postData = { user, progress, image, images: imagesProp, verified, relevantCount: count, commentsCount, sharesCount, viewsCount: liveViewsCount, isNew, hashtags, postCreatedAt };
    try { sessionStorage.setItem("ff_last_post", JSON.stringify(postData)); } catch {}
    navigate(`/post/${encodeURIComponent(id)}`, { state: { post: postData, scrollTo, prefillText } });
  }, [postId, user, progress, image, verified, count, commentsCount, sharesCount, liveViewsCount, isNew, hashtags, postCreatedAt, navigate]);

  const typeLabel = TYPE_LABELS[progress.type as PostType] ?? progress.type ?? "Avancée";
  const isActive  = activeReaction !== null;
  const ctaConfig = CTA_CONFIG[progress.type as PostType];

  // Format timestamp
  const displayTimestamp = (() => {
    const ts = progress.timestamp || "";
    if (!ts || ts === "–") return null;
    if (ts.toLowerCase().startsWith("à l'instant") || ts.toLowerCase().startsWith("a l'instant")) return "À l'instant";
    if (ts.toLowerCase().startsWith("il y a")) return ts;
    return `Il y a ${ts}`;
  })();

  const ICON_SM      = 18;
  const ICON_SPARKLE = 22;
  const PAD_SM       = "7px 13px";
  const PAD_SPARKLE  = "7px 13px";

  // ── Action row ─────────────────────────────────────────────────────────────
  const renderActions = () => (
    <div
      style={{ display: "flex", alignItems: "center", gap: 3, position: "relative", padding: "6px 8px 8px 8px" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Star / Like button ── */}
      <motion.button
        onClick={handlePertinentClick}
        whileTap={{ scale: 1.06 }}
        transition={{ type: "spring", stiffness: 600, damping: 18 }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          padding: PAD_SPARKLE, borderRadius: 999,
          background: "transparent", border: "none",
          cursor: "pointer",
          userSelect: "none",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
          flexShrink: 0,
          transition: "padding 0.18s ease",
        }}
      >
        <motion.div
          key={sparkleKey}
          initial={{ scale: 1 }}
          animate={sparkleKey > 0 ? { scale: [1, 1.5, 1] } : { scale: 1 }}
          transition={{ duration: 0.45, times: [0, 0.28, 1], ease: ["easeOut", "easeIn"] }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", willChange: "transform" }}
        >
          <SparkleIcon active={isActive} size={ICON_SPARKLE} />
        </motion.div>
        {count > 0 && (
          <span style={{
            fontSize: isActive ? 14 : 13,
            color: "#ffffff",
            fontWeight: 500,
            transition: "font-size 0.18s ease",
          }}>
            {formatCount(count)}
          </span>
        )}
      </motion.button>

      {/* ── Comment ── */}
      <motion.button
        onClick={(e) => { e.stopPropagation(); navigateToPost("comments"); }}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: PAD_SM, borderRadius: 999, color: "#ffffff", background: "transparent", border: "none", cursor: "pointer" }}
        whileTap={{ scale: 0.93 }}
      >
        <MessageCircle style={{ width: ICON_SM, height: ICON_SM, opacity: 0.85 }} strokeWidth={1.8} />
        {commentsCount > 0 && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{formatCount(commentsCount)}</span>}
      </motion.button>

      {/* ── Share ── */}
      <motion.button
        onClick={(e) => { e.stopPropagation(); navigateToPost("share"); }}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: PAD_SM, borderRadius: 999, color: "#ffffff", background: "transparent", border: "none", cursor: "pointer" }}
        whileTap={{ scale: 0.93 }}
      >
        <Share2 style={{ width: ICON_SM, height: ICON_SM, opacity: 0.85 }} strokeWidth={1.8} />
        {sharesCount > 0 && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{formatCount(sharesCount)}</span>}
      </motion.button>

      {/* ── Stats ── */}
      <motion.button
        onClick={(e) => { e.stopPropagation(); navigateToPost("stats"); }}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: PAD_SM, borderRadius: 999, color: "#ffffff", background: "transparent", border: "none", cursor: "pointer" }}
        whileTap={{ scale: 0.93 }}
      >
        <BarStatsIcon size={ICON_SM} />
        {liveViewsCount > 0 && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{formatCount(liveViewsCount)}</span>}
      </motion.button>

      {/* Timestamp */}
      {displayTimestamp && (
        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.30)", fontWeight: 400, marginLeft: 2, whiteSpace: "nowrap", flexShrink: 0 }}>
          {displayTimestamp}
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* ⋯ Three-dot */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={(e) => { e.stopPropagation(); setShowPostMenu((v) => !v); }}
        style={{ padding: "5px", borderRadius: "50%", background: showPostMenu ? "rgba(255,255,255,0.08)" : "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
      >
        <MoreHorizontal style={{ width: 14, height: 14, color: "rgba(255,255,255,0.50)" }} />
      </motion.button>
    </div>
  );

  // ── Header ─────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 12px 10px 10px" }}>
      {/* Avatar */}
      {isAnonymous ? (
        <AnonAvatar size={42} />
      ) : (
        <div style={{ flexShrink: 0 }} onClick={handleUserClick}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(99,102,241,0.28)", cursor: "pointer", flexShrink: 0 }}>
            {liveAvatar ? (
              <img src={liveAvatar} alt={user?.name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#4f46e5,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 14 }}>
                {(user?.name || "??").substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Name + followers + objective */}
      <div style={{ flex: 1, minWidth: 0, cursor: isAnonymous ? "default" : "pointer" }} onClick={isAnonymous ? undefined : handleUserClick}>
        {/* Row 1: name · followers */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0 4px", lineHeight: 1.3 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: isAnonymous ? "rgba(240,240,245,0.55)" : "#f0f0f5", whiteSpace: "nowrap" }}>
            {isAnonymous ? "Anonyme" : (user?.name || "")}
          </span>
          {!isAnonymous && verified && <VerifiedBadge />}
          {!isAnonymous && liveFollowers !== undefined && (
            <span style={{ ...SEC, whiteSpace: "nowrap" }}>· {formatFollowers(liveFollowers)} abonnés</span>
          )}
        </div>
        {/* Row 2: objective or "ton post anonyme" badge */}
        {isAnonymous ? (
          isMineAnonymous && (
            <div style={{ marginTop: 3 }}>
              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.09)", border: "0.5px solid rgba(255,255,255,0.14)", fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.72)", letterSpacing: "0.02em" }}>
                Ton post anonyme
              </span>
            </div>
          )
        ) : (
          <div style={{ ...SEC, marginTop: 1, overflowX: "auto", whiteSpace: "nowrap", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", maxWidth: "100%" } as React.CSSProperties}>
            {memberSince !== undefined ? `Présent depuis ${memberSince} jours` : liveObjective}
          </div>
        )}
      </div>

      {/* Follow button (right side, uniquement si pas soi-même et pas anonyme) */}
      {!isSelfPost && !isAnonymous && (
        <div className="scale-90 origin-right sm:scale-100" style={{ flexShrink: 0 }}>
          <FollowButton username={postUsername} size="sm" />
        </div>
      )}
    </div>
  );

  // ── CTA Button ─────────────────────────────────────────────────────────────
  const renderCTA = () => {
    if (!ctaConfig || hideActions) return null;
    return (
      <div
        style={{ padding: "4px 12px 14px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={(e) => { e.stopPropagation(); navigateToPost("comments", ctaConfig.prefill); }}
          style={{
            width: "100%",
            padding: "11px 24px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.92)",
            color: "#111",
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.01em",
            boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
            transition: "background 0.15s",
          }}
        >
          {ctaConfig.label}
        </motion.button>
      </div>
    );
  };

  // ==========================================================================
  // ── RENDER ────────────────────────────────────────────────────────────────
  // ==========================================================================
  return (
    <>
      {showPostMenu && <div className="fixed inset-0 z-40" onClick={() => setShowPostMenu(false)} />}

      <div className="mx-3 relative">
        <motion.div
          className="cursor-pointer relative"
          style={{
            borderRadius: 20,
            background: "#0d0d0d",
            border: "1px solid rgba(255,255,255,0.07)",
            overflow: "hidden",
          }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
          onClick={handleCardClick}
          ref={cardRef}
        >
          {/* Progress bar */}
          <ViewProgressBar progress={authorProgress} isNew={isNew} />

          {/* ── HEADER ──────────────────────────────────────────────────────── */}
          {renderHeader()}

          {/* ── SEPARATOR ───────────────────────────────────────────────────── */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 0 }} />

          {/* ── CONTENT ─────────────────────────────────────────────────────── */}
          <div style={{ padding: "10px 12px 0 12px" }}>
            {/* Type Badge */}
            <div style={{ marginBottom: 8 }}>
              <span style={{
                display: "inline-flex", alignItems: "center",
                padding: "2px 12px", borderRadius: 999,
                background: "rgba(255,255,255,0.90)", color: "#111",
                fontWeight: 600, fontSize: 12, letterSpacing: "0.01em",
              }}>
                {typeLabel}
              </span>
            </div>

            {/* Description */}
            <p style={{
              color: "rgba(255,255,255,0.96)",
              fontSize: 14,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              margin: "0 0 8px",
              ...(image && !isExpanded ? {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"],
                WebkitLineClamp: 3,
                overflow: "hidden",
              } : {}),
            } as React.CSSProperties}>
              {renderPostText(progress.description, navigate)}
            </p>

            {/* "plus..." */}
            {image && !isExpanded && isExpandable && (
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: "block", marginTop: -4, marginBottom: 6, color: "rgba(255,255,255,0.50)", fontStyle: "italic", fontSize: 13, cursor: "pointer", userSelect: "none" }}
                onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
              >
                plus...
              </motion.span>
            )}
            {image && isExpanded && isExpandable && (
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: "block", marginBottom: 6, fontSize: 13, color: "rgba(255,255,255,0.45)", fontStyle: "italic", cursor: "pointer", textAlign: "right", userSelect: "none" }}
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
              >
                ...Moins
              </motion.span>
            )}

            {/* Hashtags */}
            {hashtags.length > 0 && (
              <div style={{ display: "flex", gap: 12, marginBottom: 8, overflowX: "auto", scrollbarWidth: "none" }}>
                {hashtags.map((tag) => (
                  <span key={tag} style={{ fontSize: 12, fontWeight: 400, color: "rgba(139,92,246,0.65)", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── IMAGE / CAROUSEL ────────────────────────────────────────────── */}
          {(() => {
            const allImages = imagesProp?.length ? imagesProp : (image ? [image] : []);
            if (!allImages.length) return null;
            if (allImages.length === 1) {
              return (
                <div style={{ marginTop: 4, overflow: "hidden", aspectRatio: "3/4" }}>
                  <img src={allImages[0]} alt="post media" loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              );
            }
            return <MultiImageCarousel images={allImages} />;
          })()}

          {/* ── ACTIONS ROW ─────────────────────────────────────────────────── */}
          {!hideActions && renderActions()}

          {/* actions hidden → show ⋯ alone */}
          {hideActions && (
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 8px 8px" }} onClick={(e) => e.stopPropagation()}>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={(e) => { e.stopPropagation(); setShowPostMenu((v) => !v); }}
                style={{ padding: "5px", borderRadius: "50%", background: showPostMenu ? "rgba(255,255,255,0.08)" : "transparent", border: "none", cursor: "pointer" }}
              >
                <MoreHorizontal style={{ width: 14, height: 14, color: "rgba(255,255,255,0.50)" }} />
              </motion.button>
            </div>
          )}

          {/* ── CTA BUTTON ──────────────────────────────────────────────────── */}
          {renderCTA()}
        </motion.div>

        {/* Post menu dropdown */}
        
          {showPostMenu && (
            <PostMenu
              postId={postId}
              authorUsername={postUsername}
              authorName={user?.name || ""}
              postContent={progress.description}
              currentUserId={currentUserId || ""}
              isOwner={isSelfPost}
              onClose={() => setShowPostMenu(false)}
              onPostDeleted={onPostDeleted}
            />
          )}
        
      </div>

      {/* ── SEPARATOR BETWEEN POSTS ────────────────────────────────────────── */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />
    </>
  );
}
