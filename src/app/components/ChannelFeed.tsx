import { motion, AnimatePresence } from "motion/react";
import {
  Plus, RefreshCw, Loader2, MessageCircle, Share2, MoreHorizontal, Trash2,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useAuth } from "../context/AuthContext";
import { useFollow } from "../context/FollowContext";
import { addPostReaction, getPostReactions } from "../api/sharesApi";
import { CommentModal } from "./CommentModal";
import { CreateChannelPostModal, type ChannelPost } from "./CreateChannelPostModal";
import { FollowButton } from "./FollowButton";
import { toast } from "sonner";
import { useState, useRef, useEffect, useCallback } from "react";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H    = { Authorization: `Bearer ${publicAnonKey}`, "Content-Type": "application/json" };

// ── Trend arrow icon ──────────────────────────────────────────────────────────
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

// ── 4-bar stats icon ──────────────────────────────────────────────────────────
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

// ── Reaction bubble ────────────────────────────────────────────────────────────
const REACTIONS = ["Pertinent", "Motivant", "J'adore", "Je soutiens"] as const;
type ReactionType = typeof REACTIONS[number];

function ReactionBar({
  postId,
  initialReaction,
  initialTotal,
  userId,
}: {
  postId: string;
  initialReaction: string | null;
  initialTotal: number;
  userId: string;
}) {
  const [active, setActive]     = useState<string | null>(initialReaction);
  const [total, setTotal]       = useState(initialTotal);
  const [pending, setPending]   = useState(false);

  const handleReact = useCallback(async (r: ReactionType) => {
    if (pending) return;
    const wasActive = active === r;
    const hadAny    = active !== null;
    setPending(true);
    setActive(wasActive ? null : r);
    setTotal((t) => wasActive ? Math.max(0, t - 1) : hadAny ? t : t + 1);
    try {
      const result = await addPostReaction(postId, userId, r);
      setActive(result.myReaction);
      setTotal(result.total);
    } catch {
      setActive(wasActive ? r : null);
      setTotal((t) => wasActive ? t + 1 : Math.max(0, t - 1));
    }
    setPending(false);
  }, [active, pending, postId, userId]);

  const isActive = active !== null;
  const ICON_ARROW = isActive ? 24 : 16;
  const PAD_ARROW = isActive ? "9px 16px" : "7px 13px";
  const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  return (
    <motion.button
      onClick={() => handleReact("Pertinent")}
      whileTap={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 600, damping: 18 }}
      disabled={pending}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        padding: PAD_ARROW, borderRadius: 999,
        background: "transparent", border: "none",
        cursor: pending ? "default" : "pointer",
        userSelect: "none", WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation", flexShrink: 0,
        transition: "padding 0.18s ease",
      }}
    >
      {pending
        ? <Loader2 style={{ width: ICON_ARROW, height: ICON_ARROW, color: "rgba(255,255,255,0.40)" }} className="animate-spin" />
        : <TrendArrowIcon active={isActive} size={ICON_ARROW} />
      }
      {total > 0 && (
        <span style={{ fontSize: isActive ? 14 : 12, color: "rgba(255,255,255,0.55)", fontWeight: 500, transition: "font-size 0.18s ease" }}>
          {formatCount(total)}
        </span>
      )}
    </motion.button>
  );
}

// ── Post card ──────────────────────────────────────────────────────────────────

function ChannelPostCard({
  post,
  userId,
  isAdmin,
  onDelete,
  communityId,
  channelId,
}: {
  post: ChannelPost;
  userId: string;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  communityId: string;
  channelId: string;
}) {
  const { currentUserId } = useFollow();
  const [commentCount, setCommentCount] = useState(post.liveCommentsCount ?? post.repliesCount ?? 0);
  const [commentOpen, setCommentOpen]   = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const isSelf = post.userId === userId;
  const canDelete = isSelf || isAdmin;
  const postUsername = (post.author || "").toLowerCase().replace(/\s+/g, "");

  const handleDelete = async () => {
    if (!window.confirm("Supprimer ce post ?")) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `${BASE}/communities/${communityId}/channels/${channelId}/posts/${post.id}`,
        {
          method: "DELETE",
          headers: H,
          body: JSON.stringify({ requestedBy: userId }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onDelete(post.id);
      toast.success("Post supprimé");
    } catch (err) {
      console.error("Erreur suppression post:", err);
      toast.error("Impossible de supprimer");
    } finally {
      setDeleting(false);
      setMenuOpen(false);
    }
  };

  return (
    <>
      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.28, ease: [0.25, 0, 0.35, 1] }}
        style={{
          borderRadius: 22,
          background: "#0d0d0d",
          border: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Accent bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, #4f46e5 0%, #818cf8 60%, transparent 100%)",
          opacity: 0.45,
        }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "18px 16px 0" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", overflow: "hidden",
            flexShrink: 0, border: "1.5px solid rgba(99,102,241,0.28)",
          }}>
            {post.avatar ? (
              <img src={post.avatar} alt={post.author} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{
                width: "100%", height: "100%",
                background: "linear-gradient(135deg,#4f46e5,#818cf8)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                  {(post.author || "U").slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>
                {post.author}
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>·</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.32)" }}>{post.timestamp}</span>
              {!isSelf && currentUserId !== postUsername && (
                <FollowButton username={postUsername} size="sm" />
              )}
            </div>
          </div>

          {/* Menu */}
          {canDelete && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setMenuOpen((v) => !v)}
                style={{
                  width: 30, height: 30, borderRadius: "50%", border: "none",
                  background: "rgba(255,255,255,0.05)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <MoreHorizontal style={{ width: 15, height: 15, color: "rgba(255,255,255,0.40)" }} />
              </motion.button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.90 }}
                    transition={{ duration: 0.14 }}
                    style={{
                      position: "absolute", top: 36, right: 0,
                      background: "rgba(20,20,30,0.98)",
                      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                      border: "0.5px solid rgba(255,255,255,0.12)",
                      borderRadius: 14, overflow: "hidden",
                      boxShadow: "0 6px 24px rgba(0,0,0,0.50)",
                      zIndex: 9998, minWidth: 160,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleDelete}
                      disabled={deleting}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        width: "100%", padding: "11px 16px", border: "none",
                        background: "transparent", cursor: "pointer",
                        fontSize: 14, fontWeight: 500, color: "rgba(239,68,68,0.85)",
                      }}
                    >
                      {deleting
                        ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                        : <Trash2 style={{ width: 14, height: 14 }} />
                      }
                      Supprimer
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Badge */}
        <div style={{ padding: "10px 16px 6px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "3px 13px", borderRadius: 999,
            fontSize: 11, fontWeight: 700,
            background: "rgba(255,255,255,0.90)", color: "#111",
          }}>
            {post.badge}
          </span>
        </div>

        {/* Text */}
        <div style={{
          padding: "2px 16px 4px",
          fontSize: 15, color: "rgba(255,255,255,0.86)",
          lineHeight: 1.65, whiteSpace: "pre-wrap",
        }}>
          {post.text}
        </div>

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <div style={{
            display: "flex", gap: 10, padding: "6px 16px",
            overflowX: "auto", scrollbarWidth: "none",
          }}>
            {post.hashtags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 13, fontWeight: 500,
                  color: "rgba(139,92,246,0.65)",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Image */}
        {post.image && (
          <div style={{ width: "100%", marginTop: 6, borderRadius: 14, overflow: "hidden", background: "rgba(0,0,0,0.30)" }}>
            <img
              src={post.image}
              alt=""
              style={{ width: "100%", height: "auto", display: "block", maxHeight: 480, objectFit: "contain" }}
            />
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "6px 8px 10px",
        }}>
          <ReactionBar
            postId={post.id}
            initialReaction={post.myReaction ?? null}
            initialTotal={post.reactionTotal ?? 0}
            userId={userId}
          />

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setCommentOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 999, border: "none",
              background: "transparent", cursor: "pointer",
              color: "rgba(200,200,220,0.50)", fontSize: 13,
            }}
          >
            <MessageCircle style={{ width: 15, height: 15, strokeWidth: 1.8 }} />
            {commentCount > 0 && <span>{commentCount}</span>}
          </motion.button>
        </div>
      </motion.div>

      {/* Comment modal */}
      <CommentModal
        isOpen={commentOpen}
        onClose={() => setCommentOpen(false)}
        postId={post.id}
        postAuthor={post.author}
        postAvatar={post.avatar}
        postHandle={postUsername}
        postText={post.text}
        postTime={post.timestamp}
        postType={post.badge}
        onCommentAdded={() => setCommentCount((c) => c + 1)}
      />
    </>
  );
}

// ── Main ChannelFeed ───────────────────────────────────────────────────────────

interface Props {
  communityId: string;
  channelId: string;
  channelName: string;
  isAdmin: boolean;
}

export function ChannelFeed({ communityId, channelId, channelName, isAdmin }: Props) {
  const { user } = useAuth();
  const userId   = user?.supabaseId ?? "";

  const [posts, setPosts]         = useState<ChannelPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // ── Fetch posts ───────────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const url = `${BASE}/communities/${communityId}/channels/${channelId}/posts?limit=50${userId ? `&userId=${userId}` : ""}`;
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const data = await res.json();
      if (data.posts) setPosts(data.posts);
    } catch (err) {
      console.error("Erreur chargement posts canal:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [communityId, channelId, userId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handlePostCreated = useCallback((post: ChannelPost) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 }}>
        <Loader2 style={{ width: 18, height: 18, color: "#6366f1" }} className="animate-spin" />
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)" }}>Chargement…</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>

      {/* Sub-header : nb posts + refresh */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px 8px",
      }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontWeight: 500 }}>
          {posts.length === 0
            ? "Aucun post"
            : `${posts.length} post${posts.length > 1 ? "s" : ""}`}
        </span>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => fetchPosts(true)}
          disabled={refreshing}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 999, border: "none",
            background: "rgba(255,255,255,0.05)", cursor: "pointer",
            fontSize: 11, color: "rgba(255,255,255,0.30)",
          }}
        >
          <motion.div
            animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}
          >
            <RefreshCw style={{ width: 11, height: 11 }} />
          </motion.div>
          Actualiser
        </motion.button>
      </div>

      {/* Posts list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 12px 100px" }}>
        <AnimatePresence mode="popLayout">
          {posts.map((post) => (
            <ChannelPostCard
              key={post.id}
              post={post}
              userId={userId}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              communityId={communityId}
              channelId={channelId}
            />
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {posts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              margin: "32px 8px",
              padding: "40px 28px",
              borderRadius: 24,
              background: "rgba(99,102,241,0.04)",
              border: "0.5px dashed rgba(99,102,241,0.20)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 14 }}>✨</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.72)", margin: "0 0 8px" }}>
              Sois le premier à poster !
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.30)", margin: "0 0 20px", lineHeight: 1.6 }}>
              Lance la discussion dans #{channelName}
            </p>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setCreateOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "10px 22px", borderRadius: 14, border: "none",
                background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                boxShadow: "0 4px 16px rgba(79,70,229,0.30)",
                cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#fff",
              }}
            >
              <Plus style={{ width: 16, height: 16 }} />
              Créer un post
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* FAB */}
      <AnimatePresence>
        {posts.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.90 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => setCreateOpen(true)}
            style={{
              position: "fixed",
              bottom: 90, right: 20,
              zIndex: 100,
              width: 52, height: 52, borderRadius: "50%",
              background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
              boxShadow: "0 6px 24px rgba(79,70,229,0.50), 0 0 0 1px rgba(99,102,241,0.30)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Plus style={{ width: 22, height: 22, color: "#fff", strokeWidth: 2.5 }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Create post modal */}
      <CreateChannelPostModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        communityId={communityId}
        channelId={channelId}
        channelName={channelName}
        onPostCreated={handlePostCreated}
      />
    </div>
  );
}