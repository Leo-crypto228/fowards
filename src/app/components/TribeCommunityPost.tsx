import { MessageCircle, Share2, Lock, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { useFollow } from "../context/FollowContext";
import { fetchAuthorGoalProgress, getCachedGoalProgress } from "../api/goalProgressCache";
import { FollowButton } from "./FollowButton";
import { CommentModal } from "./CommentModal";
import { ShareModal } from "./ShareModal";
import { addPostReaction, getPostReactions } from "../api/sharesApi";
import { toast } from "sonner";

interface TribeCommunityPostProps {
  postId?: string;
  avatar: string;
  name: string;
  timestamp: string;
  role: string;
  memberSince: string;
  badge: string;
  text: string;
  image?: string;
  repliesCount?: number;
  hashtags?: string[];
  onReply?: () => void;
  onHashtagPress?: (tag: string) => void;
  isMember?: boolean;
  communityId?: string;
  communityName?: string;
}

/* ── Scroll-aware view bar ── */
function ViewProgressBar({ progress }: { progress: number }) {
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
    <div ref={ref} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, borderRadius: "22px 22px 0 0", overflow: "visible" }}>
      {/* Piste de fond */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.04)", borderRadius: "22px 22px 0 0" }} />
      {/* Barre remplie — part de 0% (gauche) → pct% */}
      <motion.div
        style={{ position: "absolute", top: 0, left: 0, height: "100%", background: "#6366f1", borderRadius: "22px 22px 0 0" }}
        initial={{ width: "0%" }}
        animate={{ width: seen ? `${pct}%` : "0%" }}
        transition={{ duration: 1.3, ease: "easeOut" }}
      />
      {/* Dot lumineux à la pointe */}
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
    </div>
  );
}

/* ── Trend arrow icon (same as ProgressCard) ── */
function TrendArrowIcon({ active, size = 16 }: { active: boolean; size?: number }) {
  const stroke = active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.52)";
  const sw = active ? 2.4 : 1.9;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polyline points="3,18 8,11.5 13,15 21,7" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15.5,7 21,7 21,12.5" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── 4-bar stats icon ── */
function BarStatsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 14" fill="none">
      <rect x="0"  y="9"  width="3" height="5"  rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="5"  y="5"  width="3" height="9"  rx="1" fill="currentColor" opacity="0.85"/>
      <rect x="10" y="2"  width="3" height="12" rx="1" fill="currentColor"/>
      <rect x="15" y="0"  width="3" height="14" rx="1" fill="currentColor"/>
    </svg>
  );
}

export function TribeCommunityPost({
  postId,
  avatar,
  name,
  timestamp,
  role,
  memberSince,
  badge,
  text,
  image,
  repliesCount = 0,
  hashtags = [],
  onReply,
  onHashtagPress,
  isMember = true,
  communityId,
  communityName,
}: TribeCommunityPostProps) {
  const { currentUserId } = useFollow();
  const postUsername = (name || "").toLowerCase().replace(/\s+/g, "");
  const isSelf = postUsername === currentUserId;

  // ── Author goal progress from Supabase ───────────────────────────────────
  const [authorProgress, setAuthorProgress] = useState<number>(
    () => getCachedGoalProgress(postUsername) ?? 0
  );

  useEffect(() => {
    if (!postUsername) return;
    const cached = getCachedGoalProgress(postUsername);
    if (cached !== undefined) { setAuthorProgress(cached); return; }
    fetchAuthorGoalProgress(postUsername)
      .then((pct) => setAuthorProgress(pct))
      .catch(() => {});
  }, [postUsername]);

  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [reactionCount, setReactionCount] = useState(0);
  const [reactionPending, setReactionPending] = useState(false);

  const [commentCount, setCommentCount] = useState(repliesCount);
  const [commentModalOpen, setCommentModalOpen] = useState(false);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCount, setShareCount] = useState(0);

  useEffect(() => {
    if (!postId) return;
    getPostReactions(postId, currentUserId)
      .then(({ myReaction, total }) => {
        setActiveReaction(myReaction);
        setReactionCount(total);
      })
      .catch((err) => console.error("Erreur chargement réactions:", err));
  }, [postId]);

  const handleArrowClick = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
    if (reactionPending) return;
    const r = "Pertinent";
    const wasActive = activeReaction === r;
    const hadAny = activeReaction !== null;
    setReactionPending(true);
    if (wasActive) { setActiveReaction(null); setReactionCount((c) => Math.max(0, c - 1)); }
    else { setActiveReaction(r); if (!hadAny) setReactionCount((c) => c + 1); }
    if (postId) {
      try {
        const result = await addPostReaction(postId, currentUserId, r as any);
        setActiveReaction(result.myReaction);
        setReactionCount(result.total);
      } catch (err) {
        console.error("Erreur réaction:", err);
        if (wasActive) { setActiveReaction(r); setReactionCount((c) => c + 1); }
        else { setActiveReaction(null); setReactionCount((c) => Math.max(0, c - 1)); }
      }
    }
    setReactionPending(false);
  }, [activeReaction, reactionPending, postId, currentUserId]);

  const isActive = activeReaction !== null;
  const ICON_SM = 16;
  const ICON_ARROW = isActive ? 24 : 16;
  const PAD_SM = "7px 13px";
  const PAD_ARROW = isActive ? "9px 16px" : "7px 13px";
  const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  // Format timestamp
  const displayTimestamp = (() => {
    if (!timestamp) return null;
    if (timestamp.toLowerCase().startsWith("il y a")) return timestamp;
    if (timestamp.toLowerCase().includes("instant")) return "À l'instant";
    return `Il y a ${timestamp}`;
  })();

  return (
    <>
      <motion.div
        className="mx-3 relative"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0, 0.35, 1] }}
        style={{ borderRadius: 22, background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}
      >
        <ViewProgressBar progress={authorProgress} />

        {/* ── Header ── */}
        <div className="flex items-start gap-3 px-4 pt-5">
          <div className="flex-shrink-0 rounded-full overflow-hidden" style={{ width: 48, height: 48, border: "2px solid rgba(99,102,241,0.28)" }}>
            <img src={avatar} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.1px" }}>{name}</span>
              {!isSelf && <FollowButton username={postUsername} size="sm" />}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{role} · {memberSince}</div>
          </div>
        </div>

        {/* ── Type badge ── */}
        <div className="px-4 mt-3 mb-3">
          <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 13px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.90)", color: "#111", letterSpacing: "0.01em" }}>
            {badge}
          </span>
        </div>

        {/* ── Text ── */}
        <div className="px-4" style={{ fontSize: 15, color: "rgba(255,255,255,0.88)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
          {text}
        </div>

        {/* ── Hashtags ── */}
        {hashtags.length > 0 && (
          <div className="flex gap-3 px-4 mt-2.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {hashtags.map((tag) => (
              <motion.button key={tag} whileTap={{ scale: 0.93 }} onClick={() => onHashtagPress?.(tag)}
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 500, color: "rgba(139,92,246,0.65)", whiteSpace: "nowrap", flexShrink: 0 }}>
                {tag}
              </motion.button>
            ))}
          </div>
        )}

        {/* ── Image ── */}
        {image && (
          <div style={{ width: "100%", marginTop: 12, borderRadius: 14, overflow: "hidden", background: "rgba(0,0,0,0.30)" }}>
            <img src={image} alt="" style={{ width: "100%", height: "auto", display: "block", maxHeight: 480, objectFit: "contain" }} />
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "6px 8px 8px 8px" }} onClick={(e) => e.stopPropagation()}>

          {/* Arrow / like button */}
          <motion.button
            onClick={handleArrowClick}
            whileTap={{ scale: 1.08 }}
            transition={{ type: "spring", stiffness: 600, damping: 18 }}
            disabled={reactionPending}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: PAD_ARROW, borderRadius: 999, background: "transparent", border: "none", cursor: reactionPending ? "default" : "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", flexShrink: 0, transition: "padding 0.18s ease" }}
          >
            {reactionPending
              ? <Loader2 style={{ width: ICON_ARROW, height: ICON_ARROW, color: "rgba(255,255,255,0.40)" }} className="animate-spin" />
              : <TrendArrowIcon active={isActive} size={ICON_ARROW} />
            }
            {reactionCount > 0 && (
              <span style={{ fontSize: isActive ? 14 : 12, color: "rgba(255,255,255,0.55)", fontWeight: 500, transition: "font-size 0.18s ease" }}>
                {formatCount(reactionCount)}
              </span>
            )}
          </motion.button>

          {/* Comment */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setCommentModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: PAD_SM, borderRadius: 999, background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.38)" }}
          >
            <MessageCircle style={{ width: ICON_SM, height: ICON_SM, strokeWidth: 1.8 }} />
            {commentCount > 0 && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.38)" }}>{formatCount(commentCount)}</span>}
          </motion.button>

          {/* Share */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => {
              if (!isMember && communityId) {
                toast("Abonnez-vous pour partager dans cette communauté.", { icon: "🔒", duration: 2500 });
              } else {
                setShareModalOpen(true);
              }
            }}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: PAD_SM, borderRadius: 999, background: "transparent", border: "none", cursor: "pointer", color: isMember ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.20)" }}
          >
            {!isMember && communityId
              ? <Lock style={{ width: ICON_SM - 3, height: ICON_SM - 3, strokeWidth: 1.8 }} />
              : <Share2 style={{ width: ICON_SM, height: ICON_SM, strokeWidth: 1.8 }} />
            }
            {shareCount > 0 && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.38)" }}>{formatCount(shareCount)}</span>}
          </motion.button>

          {/* Stats */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: PAD_SM, borderRadius: 999, background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.38)" }}
          >
            <BarStatsIcon size={ICON_SM} />
          </motion.button>

          {/* Timestamp */}
          {displayTimestamp && (
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.22)", fontWeight: 400, marginLeft: 2, whiteSpace: "nowrap", flexShrink: 0 }}>
              {displayTimestamp}
            </span>
          )}
        </div>
      </motion.div>

      <CommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        postId={postId}
        postAuthor={name}
        postAvatar={avatar}
        postHandle={postUsername}
        postText={text}
        postTime={timestamp}
        postType={badge}
        onCommentAdded={() => setCommentCount((c) => c + 1)}
      />

      {postId && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          postId={postId}
          postAuthor={name}
          postText={text}
          postBadge={badge}
          onShared={() => setShareCount((c) => c + 1)}
        />
      )}
    </>
  );
}