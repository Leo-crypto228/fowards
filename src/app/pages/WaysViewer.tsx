import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Heart, MessageCircle, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { getWays, likeWays, deleteWays, addWaysComment, type Ways } from "../api/waysApi";
import { MY_USER_ID, MY_USER_NAME, MY_USER_AVATAR } from "../api/authStore";
import { toast } from "sonner";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expiré";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h restantes`;
  return `${mins}m restantes`;
}

export function WaysViewer() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [ways, setWays] = useState<Ways | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentUserId = MY_USER_ID;
  const isAuthor = ways?.author.username === currentUserId;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getWays(id)
      .then(({ ways: w }) => {
        setWays(w);
        setLikesCount(w.likesCount);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleLike = async () => {
    if (!ways || !currentUserId) return;
    const prev = liked;
    setLiked(!prev);
    setLikesCount((c) => c + (prev ? -1 : 1));
    try {
      const result = await likeWays(ways.id, currentUserId);
      setLiked(result.liked);
      setLikesCount(result.likesCount);
    } catch {
      setLiked(prev);
      setLikesCount((c) => c + (prev ? 1 : -1));
    }
  };

  const handleDelete = async () => {
    if (!ways || !currentUserId) return;
    try {
      await deleteWays(ways.id, currentUserId);
      toast.success("Ways supprimé.");
      navigate(-1);
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleComment = async () => {
    if (!ways || !commentText.trim() || !currentUserId || sendingComment) return;
    setSendingComment(true);
    try {
      await addWaysComment(ways.id, {
        username: currentUserId,
        name: MY_USER_NAME() || currentUserId,
        avatar: MY_USER_AVATAR() || "",
        text: commentText.trim(),
      });
      setCommentText("");
      setWays((w) => w ? { ...w, commentsCount: w.commentsCount + 1 } : w);
      toast.success("Commentaire envoyé !");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSendingComment(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#09090f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={{ width: 32, height: 32, border: "2.5px solid rgba(255,255,255,0.15)", borderTopColor: "#a78bfa", borderRadius: "50%" }}
        />
      </div>
    );
  }

  if (error || !ways) {
    return (
      <div style={{ minHeight: "100dvh", background: "#09090f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <p style={{ color: "rgba(255,255,255,0.50)", fontSize: 15 }}>{error || "Ways introuvable."}</p>
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => navigate(-1)}
          style={{ padding: "10px 20px", borderRadius: 12, background: "rgba(255,255,255,0.07)", border: "none", color: "rgba(255,255,255,0.75)", cursor: "pointer", fontSize: 14 }}>
          Retour
        </motion.button>
      </div>
    );
  }

  const avatarInitial = (ways.author.name?.[0] ?? "?").toUpperCase();

  return (
    <div
      style={{
        height: "100dvh",
        background: "#09090f",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 16px 12px",
          position: "relative", zIndex: 20,
        }}
      >
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => navigate(-1)}
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ArrowLeft style={{ width: 18, height: 18, color: "rgba(255,255,255,0.80)" }} />
        </motion.button>

        {/* Author info */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, marginLeft: 12 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {ways.author.avatar && !imgFailed ? (
              <img
                src={ways.author.avatar}
                alt=""
                onError={() => setImgFailed(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{avatarInitial}</span>
            )}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.90)", margin: 0 }}>{ways.author.name}</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0 }}>{relativeTime(ways.createdAt)} · {timeLeft(ways.expiresAt)}</p>
          </div>
        </div>

        {/* 3-dot menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setShowMenu((v) => !v)}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <MoreHorizontal style={{ width: 18, height: 18, color: "rgba(255,255,255,0.60)" }} />
          </motion.button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -4 }}
                transition={{ duration: 0.13 }}
                style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  minWidth: 180, zIndex: 100,
                  background: "rgba(14,14,22,0.98)",
                  backdropFilter: "blur(28px)",
                  borderRadius: 14,
                  border: "0.5px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
                  overflow: "hidden",
                }}
              >
                {isAuthor && (
                  <>
                    <button
                      onClick={() => { setShowMenu(false); navigate(`/ways/${ways.id}/comments`); }}
                      style={{
                        width: "100%", padding: "13px 16px",
                        background: "transparent", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10,
                        color: "rgba(255,255,255,0.80)", fontSize: 14, textAlign: "left",
                      }}
                    >
                      <MessageCircle style={{ width: 16, height: 16 }} />
                      Commentaires
                    </button>
                    <div style={{ height: "0.5px", background: "rgba(255,255,255,0.07)" }} />
                    <button
                      onClick={() => { setShowMenu(false); handleDelete(); }}
                      style={{
                        width: "100%", padding: "13px 16px",
                        background: "transparent", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10,
                        color: "#f87171", fontSize: 14, textAlign: "left",
                      }}
                    >
                      <Trash2 style={{ width: 16, height: 16 }} />
                      Supprimer le Ways
                    </button>
                  </>
                )}
                {!isAuthor && (
                  <button
                    onClick={() => setShowMenu(false)}
                    style={{
                      width: "100%", padding: "13px 16px",
                      background: "transparent", border: "none", cursor: "pointer",
                      color: "rgba(255,255,255,0.55)", fontSize: 14, textAlign: "left",
                    }}
                  >
                    Fermer
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content — scrollable */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {ways.image && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ borderRadius: 18, overflow: "hidden" }}
          >
            <img
              src={ways.image}
              alt=""
              style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }}
            />
          </motion.div>
        )}

        {ways.text && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ways.image ? 0.05 : 0 }}
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: "rgba(240,240,245,0.90)",
              margin: 0,
              fontWeight: 400,
            }}
          >
            {ways.text}
          </motion.p>
        )}
      </div>

      {/* Bottom bar: like + comment */}
      <div
        style={{
          padding: "12px 16px 24px",
          borderTop: "0.5px solid rgba(255,255,255,0.07)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Like + comment counts */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleLike}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
          >
            <motion.div animate={{ scale: liked ? [1, 1.3, 1] : 1 }} transition={{ duration: 0.25 }}>
              <Heart
                style={{ width: 22, height: 22, color: liked ? "#f87171" : "rgba(255,255,255,0.50)" }}
                fill={liked ? "#f87171" : "none"}
                strokeWidth={1.8}
              />
            </motion.div>
            <span style={{ fontSize: 14, color: liked ? "#f87171" : "rgba(255,255,255,0.50)", fontWeight: 600 }}>
              {likesCount}
            </span>
          </motion.button>

          {isAuthor && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => navigate(`/ways/${ways.id}/comments`)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              <MessageCircle style={{ width: 20, height: 20, color: "rgba(255,255,255,0.50)" }} strokeWidth={1.8} />
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", fontWeight: 600 }}>
                {ways.commentsCount}
              </span>
            </motion.button>
          )}
        </div>

        {/* Comment input — non-authors only */}
        {!isAuthor && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.09)",
              padding: "8px 12px 8px 16px",
            }}
          >
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Laisser un message privé…"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                fontSize: 15, color: "rgba(240,240,245,0.85)", fontFamily: "inherit",
              }}
            />
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleComment}
              disabled={!commentText.trim() || sendingComment}
              style={{
                width: 34, height: 34, borderRadius: "50%",
                background: commentText.trim() ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "rgba(255,255,255,0.08)",
                border: "none", cursor: commentText.trim() ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Send style={{ width: 14, height: 14, color: "#fff" }} />
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
