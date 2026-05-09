import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { MY_USER_ID as _authUserId, MY_USER_NAME as _authUserName, MY_USER_AVATAR as _authUserAvatar } from "../api/authStore";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, MessageCircle, Share2, Bookmark,
  Send, Hash, Bold, Smile, X, Check, MoreHorizontal, Reply,
  AlertTriangle, TrendingDown, ThumbsDown, Plus, Loader2, WifiOff, ChevronDown, ChevronUp,
} from "lucide-react";
import { reportInappropriate, reduceAuthor, markNotRelevant } from "../api/postActionsApi";
import { useSavedPosts, type SavedPostData } from "../context/SavedPostsContext";
import { FollowButton } from "../components/FollowButton";
import { searchHashtags, searchUsers } from "../data/suggestions";
import { HighlightInput } from "../components/HighlightInput";
import {
  createComment, getPostComments, createReply, getCommentReplies,
  reactToComment, removeReaction,
  type ApiComment, type ApiReply, type CommentType, type ReactionType, type EloCommentType,
  REACTION_TYPES,
} from "../api/commentsApi";
import { triggerEloComment } from "../api/eloApi";
import { getPrivateStats, recordEngaged, recordDistributed, type PrivateStats } from "../api/privateStatsApi";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import {
  sharePost, getPostAnalytics, incrementPostView, getPostReactions, addPostReaction,
  getSessionId, type ApiAnalytics, type PostReactionType, sendCommunityMessage,
} from "../api/sharesApi";
import { stripAt, renderPostText } from "../utils/renderText";
import { GifPicker, GifMessage, isGifUrl } from "../components/GifPicker";
import { fetchAuthorGoalProgress, getCachedGoalProgress } from "../api/goalProgressCache";

/* ─── Types ───────────────────────────────���─���───────────────────────────────── */

type PostType = "infos" | "conseil" | "new" | "avancement" | "objectif" | "lecon" | "question" | "bilan";

const TYPE_LABELS: Record<PostType, string> = {
  infos: "Infos perso", conseil: "Conseil(s)", new: "New",
  avancement: "Avancement", objectif: "Objectif", lecon: "Leçon",
  question: "Question", bilan: "Bilan",
};


// Current user — resolved from authStore at render time
const MY_USER_ID   = _authUserId   || "thomasdubois";
const MY_USER_NAME = _authUserName || "Thomas Dubois";

interface PostData {
  user: { name: string; avatar: string; objective: string };
  streak: number;
  progress: { type: PostType; description: string; timestamp: string };
  image?: string;
  verified?: boolean;
  relevantCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  viewsCount?: number;
  isNew?: boolean;
  hashtags?: string[];
}

interface Comment {
  id: number;
  author: string;
  avatar: string;
  text: string;
  time: string;
  relevant: number;
  isRelevant: boolean;
  tag?: CommentTag;
  replyTo?: string;
}

/* ─── Mock data ──────────────────────────────────────────────────────────────── */

const MOCK_COMMENTS: Comment[] = [
  { id: 1,  author: "Emma Petit",       avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80",  text: "Incroyable progression, tu m'inspires vraiment ! Continue comme ça, chaque jour compte.", time: "2h",    relevant: 18, isRelevant: false, tag: "Encouragement" },
  { id: 2,  author: "Lucas Bernard",    avatar: "https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80",  text: "Essaie de bloquer 30 min chaque matin sans téléphone, c'est le seul truc qui m'a vraiment aidé à tenir sur la durée.", time: "1h30", relevant: 32, isRelevant: true,  tag: "Conseil" },
  { id: 3,  author: "Marie Laurent",    avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80",  text: "Félicitations ! C'est exactement ce genre de post qui me motive à ne pas lâcher les jours difficiles.", time: "1h",    relevant: 9,  isRelevant: false, tag: "Motivant" },
  { id: 4,  author: "Antoine Rousseau", avatar: "https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80", text: "Utilise la méthode des 2 minutes : si une tâche prend moins de 2 min, fais-la immédiatement. Ça change tout.", time: "45min", relevant: 28, isRelevant: false, tag: "Conseil" },
  { id: 5,  author: "Sarah Martin",     avatar: "https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80",  text: "Post qui me parle à 100% ! On sous-estime trop la régularité. La discipline bat le talent.", time: "30min", relevant: 24, isRelevant: false, tag: "Réaction" },
  { id: 6,  author: "Yasmine Hassan",   avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80",  text: "Pour tracker ta progression : un simple Google Sheet avec 3 colonnes (date, objectif, done). Minimaliste mais ultra efficace.", time: "18min", relevant: 41, isRelevant: false, tag: "Conseil" },
  { id: 7,  author: "Nicolas Faure",    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80",  text: "Belle avancée 🔥 Moi j'ai lâché à J-14... t'as des tips pour tenir sur la durée ?", time: "10min", relevant: 3,  isRelevant: false, tag: "Réaction" },
  { id: 8,  author: "Elodie Chen",      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80",  text: "Hack que j'utilise : note 1 victoire par jour dans un carnet physique. Le cerveau adore les récompenses tangibles.", time: "5min",  relevant: 19, isRelevant: false, tag: "Conseil" },
];

const PERTINENT_USERS = [
  { id: 1, name: "Emma Petit",       avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80" },
  { id: 2, name: "Lucas Bernard",    avatar: "https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80" },
  { id: 3, name: "Marie Laurent",    avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80" },
  { id: 4, name: "Antoine Rousseau", avatar: "https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80" },
  { id: 5, name: "Sarah Martin",     avatar: "https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80" },
  { id: 6, name: "Yasmine Hassan",   avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80" },
  { id: 7, name: "Chloé Bernard",    avatar: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80" },
];

const SHARE_COMMUNITIES = [
  { id: "1", name: "Créateurs SaaS",       avatar: "https://images.unsplash.com/photo-1563461660947-507ef49e9c47?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80", members: 245 },
  { id: "2", name: "Runners du matin",     avatar: "https://images.unsplash.com/photo-1706029831332-67734fbf73d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80", members: 562 },
  { id: "3", name: "Investisseurs FR",     avatar: "https://images.unsplash.com/photo-1660970781103-ba6749cb9ce3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80", members: 318 },
  { id: "4", name: "Builders Indé",        avatar: "https://images.unsplash.com/photo-1760611656615-db3fad24a314?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80", members: 189 },
  { id: "5", name: "Créateurs de contenu", avatar: "https://images.unsplash.com/photo-1627667050609-d4ba6483a368?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80", members: 421 },
];

// MY_AVATAR est résolu dynamiquement dans le composant (voir myUserAvatar)
const EMOJI_LIST = ["😊","🔥","💪","🚀","✨","👏","💡","🎯","⚡","💎","🙌","❤️","😎","🏆","💯","🌟","😤","👍","🤝","💫"];

/* ── ApiCommentRow — commentaire backend avec réactions persistées + réponses inline ── */
function ApiCommentRow({
  comment, isTopConseil, onReplyClick, pendingReply,
}: {
  comment: ApiComment; isTopConseil: boolean;
  onReplyClick: (commentId: string, authorName: string) => void;
  pendingReply?: ApiReply | null;
}) {
  const navigate = useNavigate();
  const [activeReaction, setActiveReaction] = useState<ReactionType | null>((comment.myReaction as ReactionType) ?? null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(comment.reactionCounts || {});
  const [reactionPending, setReactionPending] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<ApiReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  // Merge server-loaded replies with any optimistic pending reply from parent (no extra hooks needed)
  const displayReplies = (() => {
    if (!pendingReply) return replies;
    if (replies.some((r) => r.id === pendingReply.id)) return replies;
    return [...replies, pendingReply];
  })();
  const isShowingReplies = showReplies || !!pendingReply;

  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);

  // Réaction unifiée — toggle via un seul POST (le backend gère le toggle)
  const handleToggleReaction = useCallback(async (rt: ReactionType) => {
    if (reactionPending) return;
    const willRemove = activeReaction === rt;
    const prevReaction = activeReaction;
    const prevCounts = { ...reactionCounts };

    // Optimiste
    setReactionPending(true);
    if (willRemove) {
      setActiveReaction(null);
      setReactionCounts((c) => ({ ...c, [rt]: Math.max(0, (c[rt] || 0) - 1) }));
    } else {
      setActiveReaction(rt);
      setReactionCounts((c) => {
        const next = { ...c, [rt]: (c[rt] || 0) + 1 };
        if (prevReaction) next[prevReaction] = Math.max(0, (next[prevReaction] || 0) - 1);
        return next;
      });
    }
    setShowReactionMenu(false);

    try {
      const result = await reactToComment(comment.id, MY_USER_ID, rt);
      // Sync avec réponse serveur
      setActiveReaction(result.myReaction);
      setReactionCounts(result.reactionCounts);
    } catch (err) {
      console.error("Erreur réaction commentaire:", err);
      // Rollback
      setActiveReaction(prevReaction);
      setReactionCounts(prevCounts);
    } finally {
      setReactionPending(false);
    }
  }, [comment.id, activeReaction, reactionCounts, reactionPending]);

  const loadReplies = async () => {
    if (isShowingReplies) { setShowReplies(false); return; }
    setLoadingReplies(true);
    try {
      const { replies: r } = await getCommentReplies(comment.id);
      setReplies(r);
      setShowReplies(true);
    } catch (err) { console.error("Erreur chargement réponses:", err); }
    finally { setLoadingReplies(false); }
  };

  const isActive = activeReaction !== null;
  const handle = comment.author.toLowerCase().replace(/\s+/g, "_");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      style={{ display: "flex", gap: 12, paddingBottom: 20, borderBottom: "0.5px solid rgba(255,255,255,0.05)", position: "relative" }}
    >
      {isTopConseil && <ConseilGlowBar />}
      {comment.author === "Anonyme" ? (
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#636370", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid rgba(255,255,255,0.10)", flexShrink: 0 }}>
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none"><path d="M7 9 C7 5.5 8.5 1 12 1 C15.5 1 17 5.5 17 9 Z" fill="#111"/><rect x="1.5" y="8" width="21" height="2.5" rx="1.25" fill="#111"/><ellipse cx="7.5" cy="17.5" rx="4.5" ry="3" fill="#111"/><ellipse cx="16.5" cy="17.5" rx="4.5" ry="3" fill="#111"/><rect x="11.3" y="16.2" width="1.4" height="2.6" fill="#111"/><ellipse cx="7.5" cy="17.5" rx="2.7" ry="1.75" fill="#636370"/><ellipse cx="16.5" cy="17.5" rx="2.7" ry="1.75" fill="#636370"/></svg>
        </div>
      ) : (
        <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: isTopConseil ? "1.5px solid rgba(99,102,241,0.55)" : "1.5px solid rgba(99,102,241,0.20)" }}>
          {comment.avatar ? (
            <img src={comment.avatar} alt={comment.author} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#6366f1,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{comment.author.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: comment.commentType ? 6 : 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>{comment.author}</span>
          {comment.author !== "Anonyme" && <span style={{ fontSize: "0.70em", color: "rgba(255,255,255,0.30)", fontWeight: 400 }}>{handle}</span>}
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>•</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>{comment.timestamp ?? "À l'instant"}</span>
        </div>
        {comment.commentType && (
          <div style={{ marginBottom: 7 }}>
            <TagPill tag={comment.commentType as CommentTag} small />
          </div>
        )}
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.78)", lineHeight: 1.55, margin: "0 0 11px", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
          {isGifUrl(comment.content)
            ? <GifMessage url={comment.content} />
            : renderPostText(comment.content, navigate)
          }
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Arrow reaction */}
          <motion.button
            onClick={() => handleToggleReaction("Pertinent")}
            whileTap={reactionPending ? {} : { scale: 1.08 }}
            transition={{ type: "spring", stiffness: 600, damping: 18 }}
            disabled={reactionPending}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: isActive ? "7px 11px" : "5px 9px",
              borderRadius: 999, background: "transparent", border: "none",
              cursor: reactionPending ? "default" : "pointer",
              userSelect: "none", transition: "padding 0.18s ease",
            }}
          >
            {reactionPending
              ? <Loader2 style={{ width: isActive ? 18 : 13, height: isActive ? 18 : 13, color: "rgba(255,255,255,0.40)" }} className="animate-spin" />
              : <TrendArrowIcon active={isActive} size={isActive ? 18 : 13} />
            }
            {totalReactions > 0 && (
              <span style={{ fontSize: isActive ? 12 : 11, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{totalReactions}</span>
            )}
          </motion.button>
          {/* Répondre */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => onReplyClick(comment.id, comment.author)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: "transparent", border: "none", cursor: "pointer" }}
          >
            <Reply style={{ width: 13, height: 13, color: "rgba(255,255,255,0.38)", strokeWidth: 2 }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", fontWeight: 500 }}>Répondre</span>
          </motion.button>
          {/* Voir réponses */}
          {(comment.repliesCount > 0 || displayReplies.length > 0) && (
            <motion.button whileTap={{ scale: 0.90 }} onClick={loadReplies}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 999, background: "rgba(99,102,241,0.10)", border: "0.5px solid rgba(99,102,241,0.22)", cursor: "pointer" }}
            >
              {loadingReplies ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}><Loader2 style={{ width: 11, height: 11, color: "#818cf8" }} /></motion.div>
              ) : isShowingReplies ? <ChevronUp style={{ width: 11, height: 11, color: "#818cf8" }} /> : <ChevronDown style={{ width: 11, height: 11, color: "#818cf8" }} />}
              <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 600 }}>
                {isShowingReplies ? "Masquer" : `${comment.repliesCount} réponse${(comment.repliesCount || 0) > 1 ? "s" : ""}`}
              </span>
            </motion.button>
          )}
        </div>
        {/* Réponses inline */}
        <AnimatePresence>
          {isShowingReplies && displayReplies.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden", marginTop: 14, paddingLeft: 14, borderLeft: "2px solid rgba(99,102,241,0.20)" }}
            >
              {displayReplies.map((reply) => (
                <motion.div key={reply.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(99,102,241,0.18)" }}>
                    {reply.avatar ? <img src={reply.avatar} alt={reply.author} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#6366f1,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{reply.author.slice(0, 2).toUpperCase()}</span></div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{reply.author}</span>
                      <span style={{ fontSize: "0.68em", color: "rgba(255,255,255,0.28)" }}>{reply.author.toLowerCase().replace(/\s+/g, "_")}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>• {reply.timestamp ?? "À l'instant"}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>{reply.content}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ── Interaction chart mock data ── */
const CHART_DAYS = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const CHART_VIEWS    = [420, 380, 510, 680, 750, 820, 1200];
const CHART_PERTINENT = [12,   8,  18,  24,  31,  42,   64];
const CHART_COMMENTS  = [3,    2,   6,   8,  11,  15,   22];

/* ─── Sub-components ────────────────────────────────────────────────────────── */

// ── Sparkle / Étincelle icon (replaces trend arrow) ─────────────────────────
function TrendArrowIcon({ active, size = 16 }: { active: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C12 8 8 12 2 12C8 12 12 16 12 22C12 16 16 12 22 12C16 12 12 8 12 2Z"
        fill={active ? "#ffffff" : "none"}
        stroke="#ffffff"
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

// ── 4-bar stats icon ─────────────────────────────────────────────────────────
function BarStatsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 14" fill="none">
      <rect x="0"  y="9"  width="3" height="5"  rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="5"  y="5"  width="3" height="9"  rx="1" fill="currentColor" opacity="0.85"/>
      <rect x="10" y="2"  width="3" height="12" rx="1" fill="currentColor"/>
      <rect x="15" y="0"  width="3" height="14" rx="1" fill="currentColor"/>
    </svg>
  );
}

function VerifiedBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }}>
      <Check style={{ width: 10, height: 10, color: "#fff", strokeWidth: 3 }} />
    </span>
  );
}

function ViewProgressBar({ progress, isNew }: { progress: number; isNew?: boolean }) {
  const pct = Math.max(0, Math.min(100, progress));
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); obs.disconnect(); } }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, overflow: "visible", zIndex: 2 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.04)" }} />
      {/* Barre — part de 0% (gauche) → pct% de l'auteur */}
      <motion.div
        style={{ position: "absolute", top: 0, left: 0, height: "100%", background: "#6366f1" }}
        initial={{ width: "0%" }}
        animate={{ width: seen ? `${pct}%` : "0%" }}
        transition={{ duration: 1.3, ease: "easeOut" }}
      />
      <motion.div
        style={{ position: "absolute", top: "50%", translateY: "-50%", width: 6, height: 6, borderRadius: "50%", background: "#6366f1", boxShadow: "0 0 8px 3px rgba(99,102,241,0.75)", marginLeft: -3 }}
        initial={{ left: "0%" }}
        animate={{ left: seen ? `${pct}%` : "0%" }}
        transition={{ duration: 1.3, ease: "easeOut" }}
      />
      {isNew && !seen && (
        <motion.div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100%", background: "#6366f1", filter: "blur(3px)" }} animate={{ opacity: [0.15, 0.55, 0.15] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} />
      )}
    </div>
  );
}

/* ── Conseil glowing bar ── */
function ConseilGlowBar() {
  return (
    <div
      style={{
        position: "absolute",
        left: -14,
        top: 0,
        bottom: 0,
        width: 3,
        borderRadius: 999,
        background: "linear-gradient(to bottom, #4f46e5 0%, #6366f1 40%, #818cf8 75%, #a5b4fc 100%)",
        boxShadow:
          "0 0 8px 2px rgba(99,102,241,0.65), 0 0 16px 4px rgba(79,70,229,0.40), 0 0 24px 6px rgba(129,140,248,0.22)",
        zIndex: 1,
      }}
    />
  );
}

/* ── Tag pill display — boudin blanc / texte noir comme les types de post ── */
function TagPill({ tag, small }: { tag: CommentTag; small?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: small ? "2px 9px" : "3px 11px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.92)",
      fontSize: small ? 10 : 11,
      fontWeight: 600,
      color: "#111",
      letterSpacing: "0.01em",
      flexShrink: 0,
    }}>
      {tag}
    </span>
  );
}

const COMMENT_REACTIONS = ["Pertinent", "Motivant", "J'adore", "Je soutiens"];

/* ── Comment row ── */
function CommentRow({
  comment,
  onReply,
  isTopConseil,
}: {
  comment: Comment;
  onReply: (author: string) => void;
  isTopConseil: boolean;
}) {
  const navigate = useNavigate();
  const [activeReaction, setActiveReaction] = useState<string | null>(
    comment.isRelevant ? "Pertinent" : null
  );
  const [localCount, setLocalCount] = useState(comment.relevant);
  const isActive = activeReaction !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        display: "flex", gap: 12, paddingBottom: 20,
        borderBottom: "0.5px solid rgba(255,255,255,0.05)",
        position: "relative",
      }}
    >
      {/* Conseil glow bar */}
      {isTopConseil && <ConseilGlowBar />}

      {/* Avatar */}
      <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: isTopConseil ? "1.5px solid rgba(99,102,241,0.55)" : "1.5px solid rgba(99,102,241,0.20)" }}>
        <img src={comment.avatar} alt={comment.author} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: comment.tag ? 6 : 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>{comment.author}</span>
          <span style={{ fontSize: "0.70em", color: "rgba(255,255,255,0.30)", fontWeight: 400 }}>{comment.author.toLowerCase().replace(/\s+/g, "_")}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>•</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>{comment.time}</span>
        </div>

        {/* Tag pill — boudin blanc texte noir */}
        {comment.tag && (
          <div style={{ marginBottom: 7 }}>
            <TagPill tag={comment.tag} small />
          </div>
        )}

        {/* Reply indicator */}
        {comment.replyTo && (
          <p style={{ fontSize: 12, color: "rgba(99,102,241,0.60)", marginBottom: 5, fontWeight: 600 }}>
            ↩ {comment.replyTo}
          </p>
        )}

        {/* Text */}
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.78)", lineHeight: 1.55, margin: "0 0 11px" }}>{renderPostText(comment.text, navigate)}</p>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>

          {/* Arrow reaction — tap to toggle */}
          <motion.button
            onClick={() => {
              if (activeReaction === "Pertinent") { setActiveReaction(null); setLocalCount((c) => c - 1); }
              else { const had = activeReaction !== null; setActiveReaction("Pertinent"); if (!had) setLocalCount((c) => c + 1); }
            }}
            whileTap={{ scale: 1.08 }}
            transition={{ type: "spring", stiffness: 600, damping: 18 }}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: isActive ? "7px 11px" : "5px 9px",
              borderRadius: 999, background: "transparent", border: "none",
              cursor: "pointer", userSelect: "none", transition: "padding 0.18s ease",
            }}
          >
            <TrendArrowIcon active={isActive} size={isActive ? 18 : 13} />
            {localCount > 0 && (
              <span style={{ fontSize: isActive ? 12 : 11, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{localCount}</span>
            )}
          </motion.button>

          {/* Répondre */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => onReply(comment.author)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: "transparent", border: "none", cursor: "pointer" }}
          >
            <Reply style={{ width: 13, height: 13, color: "rgba(255,255,255,0.38)", strokeWidth: 2 }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", fontWeight: 500 }}>Répondre</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Pertinent list modal ── */
function PertinentModal({ onClose, count }: { onClose: () => void; count: number }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      <motion.div className="relative w-full" style={{ maxWidth: 480, background: "rgba(10,10,22,0.97)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", borderTopLeftRadius: 24, borderTopRightRadius: 24, border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none", maxHeight: "62vh", overflowY: "auto", paddingBottom: 32 }}
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f5" }}>Pertinent</p>
            <p style={{ fontSize: 13, color: "rgba(165,180,252,0.65)", marginTop: 1 }}>{count} personnes ont trouvé ce post pertinent</p>
          </div>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.55)" }} />
          </motion.button>
        </div>
        <div style={{ padding: "8px 20px 0" }}>
          {PERTINENT_USERS.map((u, i) => (
            <motion.div key={u.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: i < PERTINENT_USERS.length - 1 ? "0.5px solid rgba(255,255,255,0.05)" : "none" }}
            >
              <div style={{ width: 46, height: 46, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(99,102,241,0.25)", flexShrink: 0 }}>
                <img src={u.avatar} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>{u.name}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Private Stats Panel — auteur uniquement ── */
function PrivateStatsPanel({ postId, userId }: { postId: string; userId: string }) {
  const [stats, setStats] = useState<PrivateStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId || !userId) return;
    getPrivateStats(postId, userId)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId, userId]);

  if (loading) return null;
  if (!stats) return null;

  const elo = Math.round(stats.eloScore);
  const pct = elo < 700 ? 5 : elo < 800 ? 30 : elo < 900 ? 60 : 100;
  const gaugeW = Math.min(100, Math.max(0, ((elo - 500) / 500) * 100));

  // Top boost type
  const { like, actionnable, motivant } = stats.boostCounts;
  const topBoostLabel = (() => {
    if (actionnable === 0 && motivant === 0 && like === 0) return null;
    if (actionnable >= like && actionnable >= motivant && actionnable > 0)
      return `${actionnable} commentaire${actionnable > 1 ? "s" : ""} Actionnable${actionnable > 1 ? "s" : ""} ont généré le plus de boost`;
    if (motivant >= like && motivant > 0)
      return `${motivant} commentaire${motivant > 1 ? "s" : ""} Motivant${motivant > 1 ? "s" : ""} ont généré le plus de boost`;
    return "Les likes ont été le principal moteur";
  })();

  // Elo history for chart
  const chartData = stats.eloHistory.length > 0
    ? stats.eloHistory.slice(-20).map((e, i) => ({
        i,
        score: Math.round(e.score),
        label: new Date(e.timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
        reason: e.reason,
      }))
    : [{ i: 0, score: 500, label: "Départ", reason: "start" }];

  const reasonLabel: Record<string, string> = {
    like: "Like",
    comment_actionnable: "Commentaire Actionnable",
    comment_motivant: "Commentaire Motivant",
    comment: "Commentaire",
    impression: "Vue ignorée",
    start: "Score initial",
  };

  const surface = { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 18 };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}
      style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 3, height: 18, borderRadius: 999, background: "linear-gradient(to bottom, #6366f1, #a78bfa)" }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.09em", textTransform: "uppercase" }}>
          Vos stats · privé
        </p>
      </div>

      {/* Section 1 — Score Elo + distribution */}
      <div style={{ ...surface, padding: "16px 18px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.50)" }}>Score Elo</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#a5b4fc", fontVariantNumeric: "tabular-nums" }}>{elo}</span>
        </div>

        {/* Gauge */}
        <div style={{ position: "relative", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 6 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${gaugeW}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            style={{ position: "absolute", inset: 0, borderRadius: 999,
              background: elo >= 900 ? "linear-gradient(to right, #6366f1, #22c55e)"
                : elo >= 800 ? "linear-gradient(to right, #6366f1, #f59e0b)"
                : elo >= 700 ? "linear-gradient(to right, #6366f1, #818cf8)"
                : "linear-gradient(to right, #4f46e5, #6366f1)" }}
          />
          {/* Threshold markers */}
          {[40, 60, 80].map((p, i) => (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${p}%`, width: 1, background: "rgba(0,0,0,0.4)" }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          {["500", "700", "800", "900+"].map((l) => (
            <span key={l} style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>{l}</span>
          ))}
        </div>

        {/* Distribution text */}
        <div style={{ padding: "8px 12px", borderRadius: 12, background: "rgba(99,102,241,0.10)", border: "0.5px solid rgba(99,102,241,0.22)", marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: "#a5b4fc", fontWeight: 600 }}>
            Distribué à <span style={{ fontWeight: 800 }}>{pct}%</span> de la communauté
          </span>
          <span style={{ fontSize: 12, color: "rgba(165,180,252,0.60)" }}> — sur 100%</span>
        </div>

        {/* 3 metrics */}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Distribués", value: stats.distributedCount, color: "#818cf8" },
            { label: "Vus",        value: stats.viewsCount,       color: "#f9a8d4" },
            { label: "Engagés",    value: stats.engagedCount,     color: "#6ee7b7" },
          ].map((m) => (
            <div key={m.label} style={{ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 12,
              background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 4, fontWeight: 600 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2 — Top boost */}
      {topBoostLabel && (
        <div style={{ ...surface, padding: "12px 16px", marginBottom: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Ce qui a le plus boosté</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{topBoostLabel}</p>
          </div>
        </div>
      )}

      {/* Section 3 — Historique Elo */}
      <div style={{ ...surface, padding: "14px 12px 10px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Historique du score</p>
        {chartData.length < 2 ? (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "20px 0" }}>
            Les interactions apparaîtront ici au fil du temps.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.28)" }}
                tickFormatter={(v: number) => String(Math.round(v))}
                width={40}
              />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.22)" }} interval="preserveStartEnd" />
              <Tooltip
                contentStyle={{ background: "#0d0d0d", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 11, padding: "6px 10px" }}
                formatter={(v: number, _: string, props: { payload?: { reason?: string } }) => [
                  `${Math.round(v)} pts`,
                  reasonLabel[props?.payload?.reason ?? ""] ?? props?.payload?.reason ?? "",
                ]}
                labelFormatter={() => ""}
              />
              <ReferenceLine y={700} stroke="rgba(251,191,36,0.25)" strokeDasharray="4 3" />
              <ReferenceLine y={800} stroke="rgba(251,191,36,0.25)" strokeDasharray="4 3" />
              <ReferenceLine y={900} stroke="rgba(34,197,94,0.30)" strokeDasharray="4 3" />
              <Line
                type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={2}
                dot={{ r: 3, fill: "#818cf8", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#a5b4fc" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {[
            { color: "rgba(251,191,36,0.50)", label: "Seuils 700 / 800" },
            { color: "rgba(34,197,94,0.50)",  label: "Seuil 900 (100%)" },
          ].map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 18, height: 1, background: l.color, borderRadius: 1 }} />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Inline Stats Panel — données réelles depuis le backend ── */
function StatsPanel({ postId, fallbackViews }: { postId: string; fallbackViews: number }) {
  const [activeMetric, setActiveMetric] = useState<"views" | "reactions" | "comments">("views");
  const [analytics, setAnalytics] = useState<ApiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    getPostAnalytics(postId)
      .then(({ analytics: a }) => setAnalytics(a))
      .catch((err) => console.error("Erreur analytics:", err))
      .finally(() => setLoading(false));
  }, [postId]);

  // Construire les 7 jours à partir de l'historique
  const history = analytics?.history ?? [];
  const last7 = (() => {
    const days: { label: string; views: number; reactions: number; comments: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 2);
      const entry = history.find((h) => h.date === key);
      days.push({ label, views: entry?.views ?? 0, reactions: entry?.reactions ?? 0, comments: entry?.comments ?? 0 });
    }
    return days;
  })();

  const totalViews     = analytics?.viewsCount     ?? fallbackViews;
  const totalReactions = analytics?.reactionsCount ?? 0;
  const totalComments  = analytics?.commentsCount  ?? 0;

  const metrics = {
    views:     { label: "Vues",         data: last7.map(d => d.views),     color: "#818cf8", total: totalViews },
    reactions: { label: "Réactions",    data: last7.map(d => d.reactions), color: "#f9a8d4", total: totalReactions },
    comments:  { label: "Commentaires", data: last7.map(d => d.comments),  color: "#6ee7b7", total: totalComments },
  };

  const active = metrics[activeMetric];
  const maxV = Math.max(...active.data, 1);
  const minV = 0;
  const range = maxV - minV || 1;
  const W = 320, H = 120, padL = 8, padR = 8, padT = 12, padB = 28;
  const iW = W - padL - padR, iH = H - padT - padB;
  const toX = (i: number) => padL + (i / (active.data.length - 1)) * iW;
  const toY = (v: number) => padT + iH - ((v - minV) / range) * iH;
  const pts = active.data.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const areaPts = [`${toX(0)},${padT + iH}`, ...active.data.map((v, i) => `${toX(i)},${toY(v)}`), `${toX(active.data.length - 1)},${padT + iH}`].join(" ");
  const firstNonZero = active.data.find(v => v > 0) ?? 0;
  const lastVal = active.data[active.data.length - 1];
  const growth = firstNonZero > 0 ? Math.round(((lastVal - firstNonZero) / firstNonZero) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.09em", textTransform: "uppercase" }}>
          Engagement · 7 jours
        </p>
        {loading && (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <Loader2 style={{ width: 13, height: 13, color: "rgba(99,102,241,0.55)" }} />
          </motion.div>
        )}
      </div>

      {/* Metric tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {(Object.entries(metrics) as [string, typeof metrics.views][]).map(([key, m]) => (
          <motion.button key={key} whileTap={{ scale: 0.93 }} onClick={() => setActiveMetric(key as typeof activeMetric)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start",
              padding: "10px 16px", borderRadius: 16, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0,
              background: activeMetric === key ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
              border: activeMetric === key ? `0.5px solid ${m.color}50` : "0.5px solid rgba(255,255,255,0.08)",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 800, color: activeMetric === key ? m.color : "rgba(255,255,255,0.50)", lineHeight: 1 }}>
              {m.total >= 1000 ? `${(m.total / 1000).toFixed(1)}k` : m.total}
            </span>
            <span style={{ fontSize: 11, color: activeMetric === key ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)", marginTop: 3, fontWeight: 600 }}>{m.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Diagramme d'engagement — 3 barres côte à côte */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)" }}>
        {([
          { key: "views",     label: "Vues",      value: totalViews,     color: "#818cf8", icon: "👁" },
          { key: "reactions", label: "Réactions",  value: totalReactions, color: "#f9a8d4", icon: "⚡" },
          { key: "comments",  label: "Comm.",      value: totalComments,  color: "#6ee7b7", icon: "💬" },
        ] as const).map((m) => {
          const maxTotal = Math.max(totalViews, totalReactions, totalComments, 1);
          const pct = Math.round((m.value / maxTotal) * 100);
          return (
            <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{m.icon}</span>
              {/* Barre verticale */}
              <div style={{ width: "100%", height: 60, background: "rgba(255,255,255,0.05)", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "flex-end" }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(pct, pct === 0 ? 0 : 4)}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  style={{ width: "100%", background: m.color, borderRadius: 8, boxShadow: `0 0 8px ${m.color}55` }}
                />
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: m.color }}>{m.value >= 1000 ? `${(m.value/1000).toFixed(1)}k` : m.value}</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", fontWeight: 600 }}>{m.label}</span>
            </div>
          );
        })}
      </div>

      {/* Croissance badge */}
      {firstNonZero > 0 && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: growth >= 0 ? "#6ee7b7" : "#f9a8d4", background: growth >= 0 ? "rgba(16,185,129,0.12)" : "rgba(236,72,153,0.12)", borderRadius: 999, padding: "4px 12px", border: growth >= 0 ? "0.5px solid rgba(16,185,129,0.25)" : "0.5px solid rgba(236,72,153,0.25)" }}>
            {growth >= 0 ? "+" : ""}{growth}% cette semaine
          </span>
        </div>
      )}

      {/* SVG chart */}
      <div style={{ borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", padding: "12px 8px 0", overflow: "hidden" }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeMetric} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
              <polygon points={areaPts} fill={`${active.color}18`} />
              <polyline points={pts} fill="none" stroke={active.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${active.color}88)` }} />
              {active.data.map((v, i) => (
                <circle key={i} cx={toX(i)} cy={toY(v)} r="3.5" fill={active.color} style={{ filter: `drop-shadow(0 0 4px ${active.color})` }} />
              ))}
              {last7.map((d, i) => (
                <text key={i} x={toX(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.28)">{d.label}</text>
              ))}
            </svg>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Per-day values */}
      <div style={{ marginTop: 12, display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}>
        {last7.map((d, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 38, padding: "8px 4px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: active.color }}>
              {active.data[i] >= 1000 ? `${(active.data[i] / 1000).toFixed(1)}k` : active.data[i]}
            </span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", fontWeight: 600 }}>{d.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Emoji picker ── */
function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }} transition={{ duration: 0.18 }}
      style={{ position: "absolute", bottom: "calc(100% + 10px)", left: 0, right: 0, background: "rgba(18,18,32,0.98)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "12px 16px", zIndex: 60, boxShadow: "0 -4px 32px rgba(0,0,0,0.45)" }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {EMOJI_LIST.map((em) => (
          <motion.button key={em} whileTap={{ scale: 0.85 }} onClick={() => { onSelect(em); onClose(); }}
            style={{ fontSize: 24, background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 10, lineHeight: 1 }}
          >{em}</motion.button>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Inline Share Panel — persistance réelle dans la communauté ── */
function SharePanel({
  postText, postData, postId, onShared, currentUserId, currentUserName, currentUserAvatar,
}: {
  postText: string; postData: PostData; postId: string; onShared: (count: number) => void;
  currentUserId: string; currentUserName: string; currentUserAvatar: string;
}) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleSelectCommunity = (id: string) => {
    setSelectedCommunity(id === selectedCommunity ? null : id);
    setShareError(null);
  };

  const handleShare = async () => {
    if (!selectedCommunity || sharing) return;
    const community = SHARE_COMMUNITIES.find(c => c.id === selectedCommunity);
    if (!community) return;
    setSharing(true);
    setShareError(null);
    try {
      const snapshot = { id: postId, user: postData.user, progress: postData.progress, hashtags: postData.hashtags ?? [] };

      // 1. Persister dans la table des partages (section "Posts partagés")
      await sharePost({
        originalPostId: postId,
        userId: currentUserId,
        author: currentUserName,
        avatar: currentUserAvatar,
        communityId: community.id,
        communityName: community.name,
        message: message.trim(),
        postSnapshot: snapshot,
      });

      // 2. Insérer aussi dans la discussion de la communauté (fil de messages)
      await sendCommunityMessage({
        communityId: community.id,
        userId: currentUserId,
        author: currentUserName,
        handle: `@${currentUserId}`,
        avatar: currentUserAvatar,
        content: message.trim() || `A partagé un post dans ${community.name}`,
        sharedPostId: postId,
        sharedPostSnapshot: snapshot,
      });

      setShared(selectedCommunity);
      setTimeout(() => onShared(1), 1200);
    } catch (err) {
      console.error("Erreur partage:", err);
      setShareError("Impossible de partager. Réessaie.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 14 }}>Partager dans :</p>

      {/* Message input — en haut pour visibilité */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 14, borderRadius: 22, padding: "11px 16px", minHeight: 46, background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.13)" }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = Math.min(t.scrollHeight, 120) + "px";
          }}
          placeholder="Ajouter un message... (Maj+Entrée pour saut de ligne)"
          rows={1}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontSize: 14, color: "#f0f0f5", caretColor: "#6366f1",
            resize: "none", lineHeight: 1.5, maxHeight: 120, minHeight: 22,
            whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere",
            fontFamily: "inherit",
          }}
          className="placeholder:text-[rgba(144,144,168,0.35)]"
        />
      </div>

      {/* Post preview compact */}
      <div style={{ padding: "10px 14px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
            <img src={postData.user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>{postData.user.name}</span>
          <span style={{ display: "inline-flex", padding: "1px 8px", borderRadius: 999, background: "rgba(255,255,255,0.90)", fontSize: 10, fontWeight: 700, color: "#111" }}>
            {postData.progress.type}
          </span>
        </div>
        <p style={{ fontSize: 12, color: "rgba(200,200,220,0.45)", lineHeight: 1.5, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{postText}</p>
      </div>

      {/* Communities */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {SHARE_COMMUNITIES.map((c, i) => {
          const isSelected = selectedCommunity === c.id;
          const isDone = shared === c.id;
          return (
            <motion.button key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} whileTap={{ scale: 0.97 }}
              onClick={() => handleSelectCommunity(c.id)}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", borderRadius: 16, background: isDone ? "rgba(34,197,94,0.10)" : isSelected ? "rgba(99,102,241,0.14)" : "rgba(255,255,255,0.04)", border: isDone ? "0.5px solid rgba(34,197,94,0.35)" : isSelected ? "0.5px solid rgba(99,102,241,0.40)" : "0.5px solid rgba(255,255,255,0.07)", cursor: "pointer", transition: "all 0.2s", width: "100%", textAlign: "left" }}
            >
              <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: isSelected ? "1.5px solid rgba(99,102,241,0.45)" : "1.5px solid rgba(99,102,241,0.18)" }}>
                <img src={c.avatar} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: isDone ? "#86efac" : isSelected ? "#c7d2fe" : "rgba(255,255,255,0.88)", margin: 0 }}>{c.name}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", margin: "2px 0 0" }}>{c.members} membres</p>
              </div>
              <AnimatePresence>
                {isDone ? (
                  <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ width: 22, height: 22, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Check style={{ width: 11, height: 11, color: "#fff", strokeWidth: 3 }} />
                  </motion.div>
                ) : isSelected ? (
                  <motion.div key="sel" initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(99,102,241,0.25)", border: "1.5px solid rgba(99,102,241,0.60)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Check style={{ width: 10, height: 10, color: "#a5b4fc", strokeWidth: 3 }} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {/* Erreur */}
      {shareError && (
        <p style={{ fontSize: 12, color: "#f87171", marginBottom: 10, textAlign: "center" }}>{shareError}</p>
      )}

      {/* CTA Partager */}
      <motion.button
        whileTap={selectedCommunity && !sharing ? { scale: 0.96 } : {}}
        onClick={handleShare}
        disabled={!selectedCommunity || sharing || !!shared}
        style={{
          width: "100%", padding: "14px", borderRadius: 999, fontSize: 15, fontWeight: 700,
          cursor: selectedCommunity && !sharing && !shared ? "pointer" : "not-allowed",
          transition: "all 0.2s", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          background: shared ? "rgba(34,197,94,0.12)" : selectedCommunity ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.05)",
          border: shared ? "0.5px solid rgba(34,197,94,0.35)" : selectedCommunity ? "0.5px solid rgba(99,102,241,0.38)" : "0.5px solid rgba(255,255,255,0.09)",
          color: shared ? "#86efac" : selectedCommunity ? "#a5b4fc" : "rgba(144,144,168,0.45)",
          boxShadow: selectedCommunity && !shared ? "0 0 22px rgba(99,102,241,0.18)" : "none",
        }}
      >
        {sharing ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
              <Loader2 style={{ width: 15, height: 15 }} />
            </motion.div>
            Partage en cours...
          </>
        ) : shared ? (
          <><Check style={{ width: 15, height: 15 }} /> Partagé avec succès !</>
        ) : (
          <><Share2 style={{ width: 15, height: 15 }} /> Partager dans la communauté</>
        )}
      </motion.button>

      {/* "Ajouter à un nouveau post" */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => navigate("/create", { state: { quotedPost: postData } })}
        style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 16, padding: "12px 16px", cursor: "pointer", width: "100%" }}
      >
        <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Plus style={{ width: 16, height: 16, color: "#ffffff", strokeWidth: 2.2 }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
          Ajouter à un nouveau post
        </span>
      </motion.button>
    </motion.div>
  );
}

/* ─── Carousel multi-images (PostDetail) ────────────────────────────────────── */
function PostDetailCarousel({ images }: { images: string[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setActiveIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div style={{ position: "relative" }}>
      <div ref={scrollRef} onScroll={handleScroll}
        style={{ display: "flex", overflowX: "scroll", scrollSnapType: "x mandatory", scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
        className="[&::-webkit-scrollbar]:hidden">
        {images.map((url, i) => (
          <div key={i} style={{ flexShrink: 0, width: "100%", scrollSnapAlign: "start", aspectRatio: "3/4" }}>
            <img src={url} alt="" loading={i === 0 ? "eager" : "lazy"}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6, pointerEvents: "none" }}>
        {images.map((_, i) => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i === activeIdx ? "#ffffff" : "rgba(255,255,255,0.38)", transition: "background 0.2s" }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */

export function PostDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routePostId } = useParams<{ id: string }>();
  const postId = decodeURIComponent(routePostId ?? "");

  // Auth-aware user IDs (override module-level fallbacks)
  const myUserId    = _authUserId   || MY_USER_ID;
  const myUserName  = _authUserName || MY_USER_NAME;
  const myUserAvatar = _authUserAvatar || "";

  const post: PostData | null = (() => {
    if (location.state?.post) return location.state.post as PostData;
    try {
      const saved = sessionStorage.getItem("ff_last_post");
      return saved ? (JSON.parse(saved) as PostData) : null;
    } catch { return null; }
  })();
  const isMineAnonymous = !!(post as any)?.isMineAnonymous;
  const isPostAnonymous = !!(post as any)?.isAnonymous;
  const isSelfPost = isMineAnonymous || (myUserName !== "" && post?.user?.name
    ? myUserName.toLowerCase().trim() === (post.user.name || "").toLowerCase().trim()
    : false);
  const { save, unsave, getSavedId } = useSavedPosts();

  const [view, setView] = useState<"comments" | "share" | "stats">("comments");
  // comments state kept (setter used as fallback for GIF/offline; not rendered)
  const [comments, setComments] = useState<Comment[]>([]);

  // ── Auto-incrément de vues au montage ────────────────────────────────────
  useEffect(() => {
    if (!postId) return;
    const sessionId = getSessionId();
    incrementPostView(postId, sessionId).catch((err) =>
      console.error("Erreur incrémentation vue:", err)
    );
  }, [postId]);

  // ── Engagement timer — 10s de lecture = engaged ───────────────────────────
  useEffect(() => {
    if (!postId || !myUserId) return;
    const t = setTimeout(() => {
      recordEngaged(postId, myUserId);
    }, 10_000);
    return () => clearTimeout(t);
  }, [postId, myUserId]);

  // ── Chargement de la réaction existante de l'utilisateur ─────────────────
  useEffect(() => {
    if (!postId) return;
    getPostReactions(postId, myUserId)
      .then(({ myReaction, counts, total }) => {
        setMyReactionType(myReaction);
        setIsRelevant(myReaction !== null);
        setReactionCounts(counts);
        setRelevantCount(total > 0 ? total : (post?.relevantCount ?? 124));
      })
      .catch((err) => console.error("Erreur chargement réactions post:", err));
  }, [postId]);

  // ── API comments ─────────────────────────────────────────────────────────
  const [apiComments, setApiComments] = useState<ApiComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeReplyTarget, setActiveReplyTarget] = useState<{ commentId: string; authorName: string } | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  // No extra state needed — optimistic replies are embedded in apiComments (optimisticReply field)

  // Fetch des commentaires API au chargement
  useEffect(() => {
    if (!postId) return;
    setLoadingComments(true);
    setCommentsError(null);
    getPostComments(postId, { userId: myUserId })
      .then(({ comments: c }) => setApiComments(c))
      .catch((err) => {
        console.error("Erreur chargement commentaires:", err);
        setCommentsError("Impossible de charger les commentaires.");
      })
      .finally(() => setLoadingComments(false));
  }, [postId]);

  const [commentInput, setCommentInput] = useState("");
  // Tools always visible in comments view (layout stable, plus de croissance au focus)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [boldMode, setBoldMode] = useState(false);
  const [eloType, setEloType] = useState<EloCommentType>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isRelevant, setIsRelevant] = useState(false);
  const [myReactionType, setMyReactionType] = useState<PostReactionType | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [reactionPending, setReactionPending] = useState(false);
  const [relevantCount, setRelevantCount] = useState(post?.relevantCount ?? 124);
  const [showPertinentList, setShowPertinentList] = useState(false);
  const [sharesCount, setSharesCount] = useState(post?.sharesCount ?? 8);
  const [savedCount, setSavedCount] = useState(12);
  const [showCommentAutocomplete, setShowCommentAutocomplete] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  type MenuActionState = "idle" | "loading" | "done" | "error";
  const [menuStates, setMenuStates] = useState<Record<string, MenuActionState>>({});
  const [menuFeedback, setMenuFeedback] = useState<Record<string, string>>({});

  const setMenuAction = (key: string, state: MenuActionState, msg?: string) => {
    setMenuStates((s) => ({ ...s, [key]: state }));
    if (msg) setMenuFeedback((f) => ({ ...f, [key]: msg }));
  };

  const handleReportInappropriate = async () => {
    if (!postId || menuStates["report"] === "loading" || menuStates["report"] === "done") return;
    setMenuAction("report", "loading");
    try {
      const res = await reportInappropriate(postId, MY_USER_ID);
      if (res.alreadyReported) { setMenuAction("report", "done", "Déjà signalé"); }
      else if (res.deleted) { setMenuAction("report", "done", "Post supprimé ✓"); setTimeout(() => setShowPostMenu(false), 1200); }
      else { setMenuAction("report", "done", "Signalé ✓"); setTimeout(() => setShowPostMenu(false), 1200); }
    } catch { setMenuAction("report", "error", "Erreur réseau"); }
  };

  const handleReduceAuthor = async () => {
    if (menuStates["reduce"] === "loading" || menuStates["reduce"] === "done") return;
    setMenuAction("reduce", "loading");
    try {
      await reduceAuthor(MY_USER_ID, authorUsername);
      setMenuAction("reduce", "done", "Préférence enregistrée ✓");
      setTimeout(() => setShowPostMenu(false), 1100);
    } catch { setMenuAction("reduce", "error", "Erreur réseau"); }
  };

  const handleNotRelevant = async () => {
    if (!postId || menuStates["notrelevant"] === "loading" || menuStates["notrelevant"] === "done") return;
    setMenuAction("notrelevant", "loading");
    try {
      await markNotRelevant(MY_USER_ID, postId);
      setMenuAction("notrelevant", "done", "Noté ✓");
      setTimeout(() => setShowPostMenu(false), 1000);
    } catch { setMenuAction("notrelevant", "error", "Erreur réseau"); }
  };

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);

  // ── Handle scrollTo + prefillText from ProgressCard navigation ──────────
  useEffect(() => {
    const scrollTo     = location.state?.scrollTo as string | undefined;
    const prefillText  = location.state?.prefillText as string | undefined;

    // Pre-fill comment input when coming from CTA button
    if (prefillText) {
      setCommentInput(prefillText);
    }

    if (scrollTo === "comments" || scrollTo === "share" || scrollTo === "stats") {
      setView(scrollTo as "comments" | "share" | "stats");
      setTimeout(() => {
        sectionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (prefillText) setTimeout(() => inputRef.current?.focus(), 350);
      }, 380);
    } else if (prefillText) {
      // CTA with no explicit scrollTo → go to comments and focus input
      setView("comments");
      setTimeout(() => {
        sectionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => inputRef.current?.focus(), 350);
      }, 380);
    }
  }, []); // run only on mount

  /* Autocomplete logic */
  const hashMatch = commentInput.match(/#([^\s#@]*)$/);
  const atMatch   = commentInput.match(/@([^\s#@]*)$/);
  const commentHashSuggestions = hashMatch ? searchHashtags(hashMatch[1]) : [];
  const commentUserSuggestions = atMatch   ? searchUsers(atMatch[1])      : [];
  const hasCommentAutocomplete = showCommentAutocomplete && (commentHashSuggestions.length > 0 || commentUserSuggestions.length > 0);

  const handleCommentSelectHash = (h: string) => {
    setCommentInput((q) => q.replace(/#([^\s#@]*)$/, `#${h} `));
    setShowCommentAutocomplete(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const handleCommentSelectUser = (handle: string) => {
    setCommentInput((q) => q.replace(/@([^\s#@]*)$/, `@${handle} `));
    setShowCommentAutocomplete(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const displayPost = post ?? {
    user: { name: myUserName || "Utilisateur", avatar: myUserAvatar || "", objective: "Mon objectif" },
    streak: 27,
    progress: { type: "avancement" as PostType, description: "Contenu du post.", timestamp: "2h" },
    verified: false, hashtags: [], isNew: false,
  };

  // Username de l'auteur (utilisé par FollowButton)
  const authorUsername = displayPost.user.name.toLowerCase().replace(/\s+/g, "");

  // ── Progression objectif de l'auteur (Supabase) ───────────────────────────
  const [authorProgress, setAuthorProgress] = useState<number>(
    () => getCachedGoalProgress(authorUsername) ?? 0
  );
  useEffect(() => {
    if (!authorUsername) return;
    const cached = getCachedGoalProgress(authorUsername);
    if (cached !== undefined) { setAuthorProgress(cached); return; }
    fetchAuthorGoalProgress(authorUsername)
      .then((pct) => setAuthorProgress(pct))
      .catch(() => {});
  }, [authorUsername]);

  // Saved state
  const savedId = getSavedId(displayPost as SavedPostData);
  const isSaved = savedId !== null;

  const formatCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  const postDate = new Date();
  postDate.setHours(postDate.getHours() - 3);
  const formattedDate = postDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // Sort comments: Conseil tag first (by relevant desc), then rest (by relevant desc)
  const sortedComments = useMemo(() => {
    const conseil = comments.filter((c) => c.tag === "Conseil").sort((a, b) => (b.relevant + (b.isRelevant ? 1 : 0)) - (a.relevant + (a.isRelevant ? 1 : 0)));
    const others  = comments.filter((c) => c.tag !== "Conseil").sort((a, b) => (b.relevant + (b.isRelevant ? 1 : 0)) - (a.relevant + (a.isRelevant ? 1 : 0)));
    return [...conseil, ...others];
  }, [comments]);

  // Top 10 Conseil comments (by relevant) get the glow bar
  const topConseilIds = useMemo(() => {
    return sortedComments.filter((c) => c.tag === "Conseil").slice(0, 10).map((c) => c.id);
  }, [sortedComments]);

  // Conseil en premier, puis le reste — pour l'affichage live
  const sortedApiComments = useMemo(() => {
    const conseil = apiComments.filter((c) => c.commentType === "Conseil");
    const others  = apiComments.filter((c) => c.commentType !== "Conseil");
    return [...conseil, ...others];
  }, [apiComments]);

  const topApiConseilIds = useMemo(() => {
    return sortedApiComments.filter((c) => c.commentType === "Conseil").slice(0, 10).map((c) => c.id);
  }, [sortedApiComments]);

  const totalComments = apiComments.length;

  const handleSendComment = useCallback(async () => {
    const raw = commentInput.trim();
    if (!raw || submittingComment) return;
    setSubmittingComment(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: ApiComment = {
      id: tempId,
      postId,
      userId: myUserId,
      author: myUserName,
      avatar: myUserAvatar,
      content: boldMode ? `**${raw}**` : raw,
      commentType: null,
      reactionCounts: { Pertinent: 0, Motivant: 0, "J'adore": 0, "Je soutiens": 0 } as Record<string, number>,
      repliesCount: 0,
      createdAt: new Date().toISOString(),
      timestamp: "À l'instant",
      myReaction: null,
    };
    setApiComments((prev) => [optimistic, ...prev]);
    const capturedEloType = eloType;
    const capturedRaw = boldMode ? `**${raw}**` : raw;
    setCommentInput(""); setBoldMode(false);
    setEloType(null); setReplyingTo(null); setActiveReplyTarget(null);
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 80);

    try {
      const { comment: saved } = await createComment({
        postId,
        userId: myUserId,
        author: myUserName,
        avatar: myUserAvatar,
        content: capturedRaw,
        eloType: capturedEloType,
      });
      setApiComments((prev) => prev.map((c) => c.id === tempId ? saved : c));
      // Elo update — fire-and-forget
      const postCreatedAt = (post as any)?.postCreatedAt || new Date().toISOString();
      triggerEloComment(postId, myUserId, postCreatedAt, capturedRaw.length, capturedEloType);
    } catch (err) {
      console.error("Erreur envoi commentaire:", err);
      // Keep optimistic comment visible on error — ID stays temp but content is right
    } finally {
      setSubmittingComment(false);
    }
  }, [commentInput, boldMode, eloType, replyingTo, postId, submittingComment, post]);

  // GIF → envoyer directement comme commentaire
  const handleGifComment = async (gifUrl: string) => {
    setGifOpen(false);
    if (!postId || submittingComment) return;
    setSubmittingComment(true);

    // ── Optimistic update en premier ───────────────────────────────────────
    const tempId = `gif-temp-${Date.now()}`;
    const gifComment: ApiComment = {
      id: tempId, postId,
      userId: myUserId,
      author: myUserName,
      avatar: myUserAvatar,
      content: gifUrl, commentType: null,
      reactionCounts: { Pertinent: 0, Motivant: 0, "J'adore": 0, "Je soutiens": 0 },
      repliesCount: 0,
      createdAt: new Date().toISOString(), timestamp: "À l'instant",
      myReaction: null,
    };
    setApiComments((prev) => [gifComment, ...prev]);

    try {
      const { comment: real } = await createComment({
        postId,
        userId: myUserId,
        content: gifUrl,
        author: myUserName,
        avatar: myUserAvatar,
      });
      // Remplacer le commentaire temporaire par le vrai
      setApiComments((prev) => prev.map((c) => c.id === tempId ? real : c));
    } catch (err) {
      console.error("Erreur envoi GIF commentaire:", err);
      // On garde l'optimiste visible plutôt que de le supprimer
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSendReply = async () => {
    if (!activeReplyTarget || !replyInput.trim() || submittingReply) return;
    setSubmittingReply(true);
    const targetCommentId = activeReplyTarget.commentId;
    const replyContent = replyInput.trim();

    // Optimistic reply — embedded directly in the comment's optimisticReply field (no new state needed)
    const optimisticReply: ApiReply = {
      id: `temp-${Date.now()}`,
      commentId: targetCommentId,
      userId: myUserId,
      author: myUserName,
      avatar: myUserAvatar,
      content: replyContent,
      createdAt: new Date().toISOString(),
      timestamp: "À l'instant",
    };

    setApiComments((prev) => prev.map((c) =>
      c.id === targetCommentId
        ? { ...c, repliesCount: (c.repliesCount || 0) + 1, optimisticReply }
        : c
    ));
    setReplyInput(""); setActiveReplyTarget(null);

    try {
      const { reply: serverReply } = await createReply(targetCommentId, {
        userId: myUserId, author: myUserName, avatar: myUserAvatar, content: replyContent,
      });
      // Replace optimistic with real server reply
      setApiComments((prev) => prev.map((c) =>
        c.id === targetCommentId ? { ...c, optimisticReply: serverReply } : c
      ));
    } catch (err) {
      console.error("Erreur envoi réponse:", err);
      // Keep optimistic reply visible on error
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleApiReplyClick = (commentId: string, authorName: string) => {
    setActiveReplyTarget({ commentId, authorName });
    setReplyInput("");
    setView("comments");
  };

  const handleReply = (author: string) => {
    setReplyingTo(author);
    setView("comments");
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const toggleRelevant = async () => {
    if (reactionPending || !postId) return;

    // Mise à jour optimiste
    const reactionToSend: PostReactionType = myReactionType ?? "Pertinent";
    const willRemove = myReactionType !== null;
    setReactionPending(true);
    setIsRelevant(!willRemove);
    setMyReactionType(willRemove ? null : reactionToSend);
    setRelevantCount((c) => willRemove ? Math.max(0, c - 1) : c + 1);

    try {
      const result = await addPostReaction(postId, MY_USER_ID, reactionToSend);
      // Synchroniser avec la vraie réponse serveur
      setMyReactionType(result.myReaction);
      setIsRelevant(result.myReaction !== null);
      setRelevantCount(result.total);
      setReactionCounts(result.counts);
    } catch (err) {
      // Rollback en cas d'erreur
      console.error("Erreur persistance réaction:", err);
      setIsRelevant(willRemove);
      setMyReactionType(willRemove ? reactionToSend : null);
      setRelevantCount((c) => willRemove ? c + 1 : Math.max(0, c - 1));
    } finally {
      setReactionPending(false);
    }
  };

  const toggleSave = () => {
    if (isSaved && savedId) { unsave(savedId); setSavedCount((c) => c - 1); }
    else { save(displayPost as SavedPostData); setSavedCount((c) => c + 1); }
  };

  const insertHashtag = () => {
    const val = commentInput;
    const newVal = val.endsWith(" ") || val === "" ? val + "#" : val + " #";
    setCommentInput(newVal);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(newVal.length, newVal.length); }, 50);
  };

  const typeLabel = post ? (TYPE_LABELS[post.progress.type] ?? "Avancement") : "Avancement";
  const postImages: string[] = (displayPost as any).images?.length
    ? (displayPost as any).images
    : displayPost.image ? [displayPost.image] : [];
  const hasImage = postImages.length > 0;

  return (
    <div style={{ minHeight: "100dvh", background: "#000000", display: "flex", flexDirection: "column" }}>

      {/* ── Sticky top bar ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, padding: "14px 16px 10px", background: "linear-gradient(to bottom, #000000 80%, transparent 100%)" }}>
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => navigate(-1)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px 8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.14)", boxShadow: "0 2px 12px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.09)", cursor: "pointer" }}
        >
          <ArrowLeft style={{ width: 16, height: 16, color: "rgba(255,255,255,0.80)", strokeWidth: 2.2 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>Retour</span>
        </motion.button>
      </div>

      {/* ── Scrollable content ── */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", paddingBottom: 150 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 12px" }}>

          {/* ── Post card ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}
            style={{ borderRadius: "20px 20px 0 0", background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "none", overflow: "hidden", position: "relative" }}
          >
            <ViewProgressBar progress={authorProgress} isNew={displayPost.isNew} />
            <div style={{ padding: "20px 16px 16px" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {/* Avatar — masqué si post anonyme */}
                {isPostAnonymous ? (
                  <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#636370", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(255,255,255,0.10)", flexShrink: 0 }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M7 9 C7 5.5 8.5 1 12 1 C15.5 1 17 5.5 17 9 Z" fill="#111"/><rect x="1.5" y="8" width="21" height="2.5" rx="1.25" fill="#111"/><ellipse cx="7.5" cy="17.5" rx="4.5" ry="3" fill="#111"/><ellipse cx="16.5" cy="17.5" rx="4.5" ry="3" fill="#111"/><rect x="11.3" y="16.2" width="1.4" height="2.6" fill="#111"/><ellipse cx="7.5" cy="17.5" rx="2.7" ry="1.75" fill="#636370"/><ellipse cx="16.5" cy="17.5" rx="2.7" ry="1.75" fill="#636370"/></svg>
                  </div>
                ) : (
                  <div style={{ width: 50, height: 50, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(99,102,241,0.28)", flexShrink: 0 }}>
                    <img src={displayPost.user.avatar} alt={displayPost.user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: isPostAnonymous ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.92)" }}>
                          {isPostAnonymous ? "Anonyme" : displayPost.user.name}
                        </span>
                        {!isPostAnonymous && displayPost.verified && <VerifiedBadge />}
                        {!isPostAnonymous && <span style={{ fontSize: "0.72em", color: "rgba(255,255,255,0.32)", fontWeight: 400 }}>{displayPost.user.name.toLowerCase().replace(/\s+/g, "_")}</span>}
                        {isMineAnonymous && <span style={{ fontSize: 11, color: "rgba(192,132,252,0.60)", fontStyle: "italic" }}>Ton post anonyme</span>}
                      </div>
                      {!isPostAnonymous && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 3 }}>{displayPost.user.objective}</p>}
                    </div>

                    {/* Right side: [More] */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                      <div style={{ position: "relative" }}>
                        <motion.button
                          whileTap={{ scale: 0.88 }}
                          onClick={() => setShowPostMenu((v) => !v)}
                          style={{ background: showPostMenu ? "rgba(255,255,255,0.08)" : "none", border: "none", padding: 4, cursor: "pointer", borderRadius: "50%", display: "flex" }}
                        >
                          <MoreHorizontal style={{ width: 18, height: 18, color: "rgba(255,255,255,0.35)" }} />
                        </motion.button>
                        <AnimatePresence>
                          {showPostMenu && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setShowPostMenu(false)} />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.88, y: -8 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.90, y: -6 }}
                                transition={{ duration: 0.18 }}
                                style={{
                                  position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
                                  minWidth: 238,
                                  background: "rgba(8,8,12,0.97)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                                  border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 16,
                                  boxShadow: "0 16px 48px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.04)",
                                  overflow: "hidden",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {[
                                  {
                                    key: "notrelevant",
                                    label: "Ce post n'est pas pertinent",
                                    doneLabel: menuFeedback["notrelevant"] || "Noté ✓",
                                    icon: ThumbsDown,
                                    color: "rgba(210,210,225,0.80)",
                                    onClick: handleNotRelevant,
                                  },
                                  {
                                    key: "reduce",
                                    label: `Moins voir les posts de ${displayPost.user.name}`,
                                    doneLabel: menuFeedback["reduce"] || "Préférence enregistrée ✓",
                                    icon: TrendingDown,
                                    color: "rgba(210,210,225,0.80)",
                                    onClick: handleReduceAuthor,
                                  },
                                  {
                                    key: "report",
                                    label: "Signaler du contenu inapproprié",
                                    doneLabel: menuFeedback["report"] || "Signalé ✓",
                                    icon: AlertTriangle,
                                    color: "#f87171",
                                    onClick: handleReportInappropriate,
                                  },
                                ].map((item, i, arr) => {
                                  const state = menuStates[item.key] || "idle";
                                  const isDone = state === "done";
                                  const isLoading = state === "loading";
                                  return (
                                    <motion.button key={item.key} whileTap={{ scale: 0.97 }}
                                      onClick={item.onClick}
                                      disabled={isDone || isLoading}
                                      style={{
                                        display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 18px",
                                        background: isDone ? "rgba(255,255,255,0.04)" : "transparent",
                                        border: "none",
                                        borderBottom: i < arr.length - 1 ? "0.5px solid rgba(255,255,255,0.07)" : "none",
                                        cursor: isDone ? "default" : "pointer",
                                        opacity: isDone ? 0.75 : 1,
                                      }}
                                    >
                                      {isLoading
                                        ? <Loader2 className="animate-spin" style={{ width: 15, height: 15, color: item.color, strokeWidth: 1.8 }} />
                                        : <item.icon style={{ width: 15, height: 15, color: isDone ? "rgba(255,255,255,0.5)" : item.color, strokeWidth: 1.8 }} />
                                      }
                                      <span style={{ fontSize: 13.5, color: isDone ? "rgba(255,255,255,0.5)" : item.color, fontWeight: isDone ? 600 : 400, lineHeight: 1.3 }}>
                                        {isDone ? item.doneLabel : item.label}
                                      </span>
                                    </motion.button>
                                  );
                                })}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, marginBottom: 12 }}>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.92)", color: "#111" }}>{typeLabel}</span>
              </div>
              <p style={{ fontSize: 15, color: "rgba(240,240,245,0.88)", lineHeight: 1.68, whiteSpace: "pre-wrap", marginBottom: (displayPost.hashtags ?? []).length > 0 ? 14 : 0 }}>
                {renderPostText(displayPost.progress.description, navigate)}
              </p>
              {(displayPost.hashtags ?? []).length > 0 && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
                  {(displayPost.hashtags ?? []).map((tag) => (
                    <span key={tag} style={{ fontSize: 13, color: "rgba(139,92,246,0.65)", fontWeight: 500 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            {hasImage && (
              <div style={{ width: "100%" }}>
                {postImages.length === 1 ? (
                  <div style={{ aspectRatio: "3/4" }}>
                    <img src={postImages[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                ) : (
                  <PostDetailCarousel images={postImages} />
                )}
              </div>
            )}
          </motion.div>

          {/* ── Date + detached interaction bar ── */}
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.08 }}
            style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderTop: "0.5px solid rgba(255,255,255,0.06)", borderRadius: "0 0 20px 20px", padding: "10px 14px 14px", marginBottom: 18 }}
          >
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", marginBottom: 10 }}>{formattedDate}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>

              {/* ── Arrow like button ── */}
              <motion.button
                whileTap={reactionPending ? {} : { scale: 1.08 }}
                transition={{ type: "spring", stiffness: 600, damping: 18 }}
                onClick={toggleRelevant}
                disabled={reactionPending}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: isRelevant ? "9px 16px" : "7px 13px",
                  borderRadius: 999, border: "none", background: "transparent",
                  cursor: reactionPending ? "default" : "pointer",
                  userSelect: "none", transition: "padding 0.18s ease",
                }}
              >
                {reactionPending
                  ? <Loader2 style={{ width: isRelevant ? 24 : 18, height: isRelevant ? 24 : 18, color: "rgba(255,255,255,0.40)" }} className="animate-spin" />
                  : <TrendArrowIcon active={isRelevant} size={isRelevant ? 24 : 18} />
                }
                {relevantCount > 0 && (
                  <span style={{ fontSize: isRelevant ? 15 : 13, color: "rgba(255,255,255,0.55)", fontWeight: 500, transition: "font-size 0.18s ease" }}>
                    {formatCount(relevantCount)}
                  </span>
                )}
              </motion.button>

              {/* Comments */}
              <motion.button whileTap={{ scale: 0.90 }} onClick={() => { setView("comments"); inputRef.current?.focus(); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, background: "transparent", border: "none", cursor: "pointer", color: "#ffffff" }}
              >
                <MessageCircle style={{ width: 18, height: 18, strokeWidth: 1.8, opacity: 0.85 }} />
                {totalComments > 0 && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{formatCount(totalComments)}</span>}
              </motion.button>

              {/* Share */}
              <motion.button whileTap={{ scale: 0.90 }} onClick={() => setView(view === "share" ? "comments" : "share")}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, background: "transparent", border: "none", cursor: "pointer", color: "#ffffff" }}
              >
                <Share2 style={{ width: 18, height: 18, strokeWidth: 1.8, opacity: view === "share" ? 1 : 0.85 }} />
                {sharesCount > 0 && <span style={{ fontSize: 13, opacity: view === "share" ? 1 : 0.85 }}>{formatCount(sharesCount)}</span>}
              </motion.button>

              {/* Stats — 4-bar icon */}
              <motion.button whileTap={{ scale: 0.90 }} onClick={() => setView(view === "stats" ? "comments" : "stats")}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, background: "transparent", border: "none", cursor: "pointer", color: "#ffffff", opacity: view === "stats" ? 1 : 0.85 }}
              >
                <BarStatsIcon size={18} />
                {(post?.viewsCount ?? 0) > 0 && <span style={{ fontSize: 13 }}>{formatCount(post?.viewsCount ?? 1200)}</span>}
              </motion.button>
            </div>
          </motion.div>

          {/* ── Content area: Comments / Share / Stats ── */}
          <div ref={sectionsRef} style={{ padding: "0 2px" }}>
            <AnimatePresence mode="wait">
              {view === "comments" && (
                <motion.div key="comments" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.2 }}>
                  {/* Conseil legend */}
                  {apiComments.some((c) => c.commentType === "Conseil") && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ width: 3, height: 24, borderRadius: 999, background: "linear-gradient(to bottom, #4f46e5, #6366f1, #a5b4fc)", boxShadow: "0 0 8px rgba(99,102,241,0.60)", flexShrink: 0 }} />
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", margin: 0 }}>Les commentaires Conseil les plus populaires sont mis en avant.</p>
                    </div>
                  )}

                  {/* Header + loader */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.09em", textTransform: "uppercase" }}>
                      Commentaires · {totalComments}
                    </p>
                    {loadingComments && (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                        <Loader2 style={{ width: 14, height: 14, color: "rgba(99,102,241,0.55)" }} />
                      </motion.div>
                    )}
                  </div>

                  {/* Erreur API */}
                  {commentsError && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", marginBottom: 16 }}>
                      <WifiOff style={{ width: 13, height: 13, color: "#f87171", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#fca5a5" }}>{commentsError}</span>
                    </div>
                  )}

                  {/* Bannière réponse inline */}
                  <AnimatePresence>
                    {activeReplyTarget && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: "hidden", marginBottom: 14 }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 14, background: "rgba(99,102,241,0.08)", border: "0.5px solid rgba(99,102,241,0.25)" }}>
                          <Reply style={{ width: 14, height: 14, color: "#818cf8", flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: "#c7d2fe", fontWeight: 600, whiteSpace: "nowrap" }}>
                            → <span style={{ color: "#a5b4fc" }}>{activeReplyTarget.authorName.toLowerCase().replace(/\s+/g, "_")}</span>
                          </span>
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flex: 1, background: "rgba(255,255,255,0.07)", borderRadius: 18, padding: "6px 12px", border: "0.5px solid rgba(99,102,241,0.28)" }}>
                            <textarea autoFocus value={replyInput} onChange={(e) => setReplyInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); }
                                if (e.key === "Escape") setActiveReplyTarget(null);
                              }}
                              onInput={(e) => {
                                const t = e.currentTarget;
                                t.style.height = "auto";
                                t.style.height = Math.min(t.scrollHeight, 100) + "px";
                              }}
                              placeholder="Votre réponse... (Maj+Entrée pour saut de ligne)"
                              rows={1}
                              style={{
                                flex: 1, background: "transparent", border: "none", outline: "none",
                                fontSize: 13, color: "#f0f0f5", caretColor: "#6366f1",
                                resize: "none", lineHeight: 1.5, maxHeight: 100, minHeight: 20,
                                whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere",
                                fontFamily: "inherit", paddingTop: 2, paddingBottom: 2,
                              }}
                              className="placeholder:text-[rgba(144,144,168,0.35)]"
                            />
                            {submittingReply ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}><Loader2 style={{ width: 14, height: 14, color: "#818cf8" }} /></motion.div>
                            ) : (
                              <motion.button whileTap={{ scale: 0.85 }} onClick={handleSendReply} disabled={!replyInput.trim()}
                                style={{ background: "none", border: "none", cursor: replyInput.trim() ? "pointer" : "default", padding: 0, display: "flex" }}
                              >
                                <Send style={{ width: 14, height: 14, color: replyInput.trim() ? "#818cf8" : "rgba(255,255,255,0.20)", transition: "color 0.2s" }} />
                              </motion.button>
                            )}
                          </div>
                          <motion.button whileTap={{ scale: 0.85 }} onClick={() => setActiveReplyTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                            <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)" }} />
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Commentaires API (live) — Conseil toujours en premier ── */}
                  {sortedApiComments.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
                      <AnimatePresence initial={false}>
                        {sortedApiComments.map((c) => (
                          <ApiCommentRow
                            key={c.id}
                            comment={c}
                            isTopConseil={topApiConseilIds.includes(c.id)}
                            onReplyClick={handleApiReplyClick}
                            pendingReply={c.optimisticReply ?? null}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Aucun commentaire */}
                  {!loadingComments && apiComments.length === 0 && (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
                      Sois le premier à commenter 💬
                    </div>
                  )}
                </motion.div>
              )}
              {view === "share" && (
                <SharePanel
                  key="share"
                  postText={displayPost.progress.description}
                  postData={displayPost}
                  postId={postId}
                  onShared={(n) => { setSharesCount((c) => c + n); setView("comments"); }}
                  currentUserId={myUserId}
                  currentUserName={myUserName}
                  currentUserAvatar={myUserAvatar}
                />
              )}
              {view === "stats" && (
                <>
                  {isSelfPost && <PrivateStatsPanel postId={postId} userId={myUserId} />}
                  <StatsPanel key="stats" postId={postId} fallbackViews={post?.viewsCount ?? 1200} />
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Sticky bottom comment bar (only in comments view) ── */}
      <AnimatePresence>
        {(view === "comments") && (
          <motion.div
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ position: "sticky", bottom: 0, zIndex: 40, background: "#000000", borderTop: "0.5px solid rgba(255,255,255,0.07)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* ── Comment type pills row (toujours visible en mode commentaires : layout stable, pas de croissance au focus) ── */}
            <div style={{ display: "flex", gap: 8, padding: "10px 14px 0", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              {/* Reply indicator */}
              {replyingTo && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "rgba(99,102,241,0.12)", border: "0.5px solid rgba(99,102,241,0.30)", flexShrink: 0 }}>
                  <Reply style={{ width: 12, height: 12, color: "#818cf8" }} />
                  <span style={{ fontSize: 12, color: "#a5b4fc", fontWeight: 600, whiteSpace: "nowrap" }}>{replyingTo}</span>
                  <motion.button whileTap={{ scale: 0.85 }} onClick={() => setReplyingTo(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                    <X style={{ width: 11, height: 11, color: "rgba(165,180,252,0.60)" }} />
                  </motion.button>
                </div>
              )}
              {/* Elo comment type — visible reader-side only (not on your own posts) */}
              {!isSelfPost && (
                <>
                  {(["actionnable", "motivant"] as EloCommentType[]).filter(Boolean).map((t) => (
                    <motion.button
                      key={t}
                      whileTap={{ scale: 0.90 }}
                      onClick={() => setEloType(eloType === t ? null : t)}
                      style={{
                        padding: "4px 14px", borderRadius: 999, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                        background: eloType === t ? "rgba(99,102,241,0.14)" : "transparent",
                        border: eloType === t ? "1.5px solid rgba(99,102,241,0.55)" : "1.5px solid rgba(255,255,255,0.18)",
                        color: eloType === t ? "#a5b4fc" : "rgba(255,255,255,0.55)",
                        fontSize: 13, fontWeight: eloType === t ? 600 : 400,
                        transition: "all 0.16s",
                      }}
                    >
                      {t === "actionnable" ? "Actionnable" : "Motivant"}
                    </motion.button>
                  ))}
                </>
              )}
            </div>

            {/* ── Input row ── */}
            <div style={{ padding: "10px 14px 0", display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
              <AnimatePresence>
                {showEmojiPicker && <EmojiPicker onSelect={(e) => setCommentInput((v) => v + e)} onClose={() => setShowEmojiPicker(false)} />}
              </AnimatePresence>

              {/* Autocomplete overlay dismiss */}
              {hasCommentAutocomplete && (
                <div className="fixed inset-0 z-40" onClick={() => setShowCommentAutocomplete(false)} />
              )}

              <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(99,102,241,0.25)", background: "linear-gradient(135deg,#4f46e5,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {myUserAvatar ? (
                  <img src={myUserAvatar} alt="Moi" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{myUserName.slice(0, 2).toUpperCase()}</span>
                )}
              </div>

              <div style={{ flex: 1, position: "relative" }}>
                {/* Autocomplete dropdown */}
                <AnimatePresence>
                  {hasCommentAutocomplete && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.16 }}
                      style={{
                        position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0, zIndex: 55,
                        background: "rgba(16,16,30,0.97)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
                        border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 18,
                        boxShadow: "0 -8px 32px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      {commentHashSuggestions.map((h, i) => (
                        <motion.button key={h} whileTap={{ scale: 0.97 }} onClick={() => handleCommentSelectHash(h)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 16px",
                            background: "transparent", border: "none",
                            borderBottom: i < commentHashSuggestions.length - 1 || commentUserSuggestions.length > 0 ? "0.5px solid rgba(255,255,255,0.06)" : "none",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ fontSize: 14, color: "#818cf8", fontWeight: 700 }}>#</span>
                          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.80)", fontWeight: 500 }}>{h}</span>
                        </motion.button>
                      ))}
                      {commentUserSuggestions.map((u, i) => (
                        <motion.button key={u.handle} whileTap={{ scale: 0.97 }} onClick={() => handleCommentSelectUser(u.handle)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 16px",
                            background: "transparent", border: "none",
                            borderBottom: i < commentUserSuggestions.length - 1 ? "0.5px solid rgba(255,255,255,0.06)" : "none",
                            cursor: "pointer",
                          }}
                        >
                          <img src={u.avatar} alt={u.name} style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(99,102,241,0.25)" }} />
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{u.name}</span>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{u.handle}</span>
                          </div>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, minHeight: 46, borderRadius: 22, padding: "8px 14px", background: boldMode ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.07)", border: boldMode ? "0.5px solid rgba(99,102,241,0.45)" : "0.5px solid rgba(99,102,241,0.28)", transition: "all 0.2s" }}>
                  <HighlightInput
                    inputRef={inputRef}
                    value={commentInput}
                    onChange={(v) => { setCommentInput(v); setShowCommentAutocomplete(true); }}
                    onFocus={() => { setShowEmojiPicker(false); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !hasCommentAutocomplete) {
                        e.preventDefault();
                        handleSendComment();
                      }
                    }}
                    placeholder={replyingTo ? `Répondre à @${replyingTo}…` : "Écrire un commentaire… (Maj+Entrée pour saut de ligne)"}
                    fontWeight={boldMode ? 700 : 400}
                    placeholderClassName="placeholder:text-[rgba(144,144,168,0.35)]"
                    multiline
                    maxHeight={140}
                    minHeight={22}
                  />
                  <motion.button whileTap={commentInput.trim() && !submittingComment ? { scale: 0.82 } : {}} onClick={handleSendComment} disabled={!commentInput.trim() || submittingComment} style={{ background: "none", border: "none", cursor: commentInput.trim() && !submittingComment ? "pointer" : "default", padding: 0, display: "flex", flexShrink: 0, alignSelf: "flex-end", paddingBottom: 6 }}>
                    {submittingComment ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}><Loader2 style={{ width: 17, height: 17, color: "#818cf8" }} /></motion.div>
                    ) : (
                      <Send style={{ width: 17, height: 17, color: commentInput.trim() ? "#818cf8" : "rgba(255,255,255,0.16)", transition: "color 0.2s" }} />
                    )}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* ── Formatting toolbar (toujours visible en mode commentaires : layout stable) ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px 14px" }}>
              {/* Emoji */}
              <motion.button whileTap={{ scale: 0.82 }} onClick={() => setShowEmojiPicker((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", display: "flex" }}>
                <Smile style={{ width: 22, height: 22, color: showEmojiPicker ? "#818cf8" : "rgba(99,102,241,0.75)", strokeWidth: 1.8 }} />
              </motion.button>
              {/* GIF */}
              <motion.button whileTap={{ scale: 0.82 }} onClick={() => setGifOpen(true)} style={{ background: gifOpen ? "rgba(99,102,241,0.20)" : "none", border: gifOpen ? "0.5px solid rgba(99,102,241,0.40)" : "none", borderRadius: 8, cursor: "pointer", padding: "6px 8px", display: "flex", transition: "all 0.18s" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: gifOpen ? "#818cf8" : "rgba(99,102,241,0.75)", fontFamily: "monospace", letterSpacing: "0.04em" }}>GIF</span>
              </motion.button>
              {/* Hashtag */}
              <motion.button whileTap={{ scale: 0.82 }} onClick={insertHashtag} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", display: "flex" }}>
                <Hash style={{ width: 22, height: 22, color: "rgba(99,102,241,0.75)", strokeWidth: 1.8 }} />
              </motion.button>
              {/* Bold */}
              <motion.button whileTap={{ scale: 0.82 }} onClick={() => setBoldMode((v) => !v)}
                style={{ background: boldMode ? "rgba(99,102,241,0.20)" : "none", border: boldMode ? "0.5px solid rgba(99,102,241,0.40)" : "none", borderRadius: 8, cursor: "pointer", padding: "6px 8px", display: "flex", transition: "all 0.18s" }}
              >
                <Bold style={{ width: 22, height: 22, color: boldMode ? "#818cf8" : "rgba(99,102,241,0.75)", strokeWidth: boldMode ? 2.5 : 1.8 }} />
              </motion.button>
              {/* Important / Bookmark */}
              <motion.button whileTap={{ scale: 0.82 }} onClick={toggleSave}
                style={{ background: isSaved ? "rgba(99,102,241,0.20)" : "none", border: isSaved ? "0.5px solid rgba(99,102,241,0.40)" : "none", borderRadius: 8, cursor: "pointer", padding: "6px 8px", display: "flex", transition: "all 0.18s", marginLeft: "auto" }}
              >
                <Bookmark style={{ width: 22, height: 22, color: isSaved ? "#818cf8" : "rgba(99,102,241,0.75)", fill: isSaved ? "#818cf8" : "none", strokeWidth: isSaved ? 2 : 1.8 }} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showPertinentList && <PertinentModal count={relevantCount} onClose={() => setShowPertinentList(false)} />}
      </AnimatePresence>

      {/* GIF Picker */}
      <GifPicker isOpen={gifOpen} onClose={() => setGifOpen(false)} onSelect={handleGifComment} anchor="bottom" />
    </div>
  );
}
