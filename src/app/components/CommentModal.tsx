import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Send, ChevronDown, AlertCircle, MessageCircle, X } from "lucide-react";
import {
  createComment,
  getPostComments,
  reactToComment,
  loadReactionCounts,
  COMMENT_TYPE_LABELS,
  CommentType,
  ApiComment,
  ReactionType,
} from "../api/commentsApi";
import { useFollow } from "../context/FollowContext";
import { MY_USER_NAME, MY_USER_AVATAR } from "../api/authStore";
import { toast } from "sonner";
import { stripAt } from "../utils/renderText";
import { GifPicker, GifMessage, isGifUrl } from "./GifPicker";

function getMyAvatar() { return MY_USER_AVATAR || "https://images.unsplash.com/photo-1584940121730-93ffb8aa88b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80"; }
function getMyName()   { return MY_USER_NAME   || "Utilisateur"; }

const TYPE_CONFIG: Record<string, { bg: string; color: string; border: string; label: string }> = {
  "Conseil(s)":  { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24", border: "rgba(251,191,36,0.30)",  label: "💡 Conseil(s)" },
  Encouragement: { bg: "rgba(34,197,94,0.10)",   color: "#4ade80", border: "rgba(34,197,94,0.25)",   label: "🙌 Encouragement" },
  Réaction:      { bg: "rgba(139,92,246,0.12)",  color: "#a78bfa", border: "rgba(139,92,246,0.28)",  label: "⚡ Réaction" },
};

const REACTION_CONFIG: Record<ReactionType, { activeColor: string }> = {
  Actionnable: { activeColor: "#818cf8" },
  Motivant:    { activeColor: "#fb923c" },
};

const REACTIONS = Object.keys(REACTION_CONFIG) as ReactionType[];

function CommentSkeleton() {
  return (
    <div style={{ display: "flex", gap: 12, padding: "16px 20px" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 11, width: "40%", borderRadius: 6, background: "rgba(255,255,255,0.07)", marginBottom: 8 }} />
        <div style={{ height: 13, width: "90%", borderRadius: 6, background: "rgba(255,255,255,0.05)", marginBottom: 6 }} />
        <div style={{ height: 13, width: "65%", borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: ApiComment;
  isLast: boolean;
}

function CommentItem({ comment, isLast }: CommentItemProps) {
  const { currentUserId } = useFollow();
  const [counts, setCounts] = useState<Record<ReactionType, number>>(
    comment.reactionCounts as Record<ReactionType, number>
  );
  const [myReaction, setMyReaction] = useState<ReactionType | null>(
    comment.myReaction ?? null
  );
  const [reactingTo, setReactingTo] = useState<ReactionType | null>(null);

  const handleReact = async (r: ReactionType) => {
    if (reactingTo) return;
    const prev = myReaction;
    const prevCounts = { ...counts };
    if (myReaction === r) {
      setMyReaction(null);
      setCounts((c) => ({ ...c, [r]: Math.max(0, (c[r] || 0) - 1) }));
    } else {
      if (myReaction) setCounts((c) => ({ ...c, [myReaction]: Math.max(0, (c[myReaction] || 0) - 1) }));
      setMyReaction(r);
      setCounts((c) => ({ ...c, [r]: (c[r] || 0) + 1 }));
    }
    setReactingTo(r);
    try {
      const res = await reactToComment(comment.id, currentUserId, r);
      setMyReaction(res.myReaction);
      setCounts(res.reactionCounts as Record<ReactionType, number>);
    } catch (err) {
      console.error("Erreur réaction commentaire:", err);
      setMyReaction(prev);
      setCounts(prevCounts);
    } finally {
      setReactingTo(null);
    }
  };

  const typeCfg = comment.commentType ? TYPE_CONFIG[comment.commentType] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0, 0.35, 1] }}
      style={{ display: "flex", gap: 12, padding: "14px 20px" }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.10)" }}>
          <img src={comment.avatar || getMyAvatar()} alt={comment.author} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        {!isLast && <div style={{ width: 1.5, flex: 1, minHeight: 16, background: "rgba(255,255,255,0.08)", borderRadius: 999, marginTop: 6 }} />}
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 4 }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.1px" }}>
            {comment.author}
          </span>
          {typeCfg && (
            <span style={{
              display: "inline-flex", alignItems: "center",
              padding: "2px 9px", borderRadius: 999,
              fontSize: 11, fontWeight: 600,
              background: typeCfg.bg, color: typeCfg.color,
              border: `0.5px solid ${typeCfg.border}`,
            }}>
              {typeCfg.label}
            </span>
          )}
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", marginLeft: "auto" }}>
            {comment.timestamp ?? ""}
          </span>
        </div>

        <div style={{ fontSize: 14.5, color: "rgba(235,235,245,0.82)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", wordWrap: "break-word", overflowWrap: "break-word", wordBreak: "break-word" }}>
          {isGifUrl(comment.content)
            ? <GifMessage url={comment.content} />
            : <span>{stripAt(comment.content)}</span>
          }
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
          {REACTIONS.map((r) => {
            const cfg = REACTION_CONFIG[r];
            const count = counts[r] || 0;
            const isActive = myReaction === r;
            return (
              <motion.button
                key={r}
                whileTap={{ scale: 0.88 }}
                onClick={() => handleReact(r)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 999,
                  border: isActive ? `1px solid ${cfg.activeColor}55` : "0.5px solid rgba(255,255,255,0.09)",
                  background: isActive ? `${cfg.activeColor}18` : "rgba(255,255,255,0.04)",
                  cursor: "pointer", fontSize: 12, fontWeight: isActive ? 600 : 400,
                  color: isActive ? cfg.activeColor : "rgba(255,255,255,0.38)",
                  transition: "all 0.16s", WebkitTapHighlightColor: "transparent",
                  opacity: reactingTo && reactingTo !== r ? 0.5 : 1,
                }}
              >
                <span>{r}</span>
                {count > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? cfg.activeColor : "rgba(255,255,255,0.28)" }}>{count}</span>}
              </motion.button>
            );
          })}
          {comment.repliesCount > 0 && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", alignSelf: "center", marginLeft: 2 }}>
              · {comment.repliesCount} réponse{comment.repliesCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId?: string;
  postAuthor: string;
  postAvatar: string;
  postHandle: string;
  postText: string;
  postTime?: string;
  postType?: string;
  onCommentAdded?: () => void;
}

export function CommentModal({
  isOpen, onClose, postId, postAuthor, postAvatar, postHandle,
  postText, postTime, postType, onCommentAdded,
}: CommentModalProps) {
  const { currentUserId } = useFollow();
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [loadingComments, setLoadingComments] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [commentType, setCommentType] = useState<CommentType | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [posted, setPosted] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKeyboardOffset(Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0)));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    setLoadingComments(true);
    setFetchError(null);
    try {
      const { comments: fetched, total } = await getPostComments(postId, { userId: currentUserId });
      const ids = fetched.map((c) => c.id);
      const rxMap = await loadReactionCounts(ids, currentUserId).catch(() => ({}));
      setComments(fetched.map((c) => ({
        ...c,
        reactionCounts: rxMap[c.id]?.counts ?? c.reactionCounts,
        myReaction: rxMap[c.id]?.myReaction ?? c.myReaction,
      })));
      setTotalComments(total);
    } catch (err) {
      console.error("Erreur chargement commentaires:", err);
      setFetchError("Impossible de charger les commentaires.");
    } finally {
      setLoadingComments(false);
    }
  }, [postId]);

  useEffect(() => {
    if (isOpen) {
      loadComments();
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 400);
    } else {
      document.body.style.overflow = "";
      setKeyboardOffset(0);
      setInput(""); setCommentType(null); setPosted(false); setSendError(null); setTypeOpen(false); setGifOpen(false);
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, loadComments]);

  useEffect(() => {
    if (!loadingComments && comments.length > 0) {
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 100);
    }
  }, [loadingComments, comments.length]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSendError(null);
    setSending(true);

    const optimistic: ApiComment = {
      id: `temp-${Date.now()}`,
      postId: postId ?? "",
      userId: currentUserId,
      author: getMyName(),
      avatar: getMyAvatar(),
      content: input.trim(),
      commentType,
      reactionCounts: { Pertinent: 0, Motivant: 0, "J'adore": 0, "Je soutiens": 0 },
      repliesCount: 0,
      createdAt: new Date().toISOString(),
      timestamp: "À l'instant",
      myReaction: null,
    };

    const prevInput = input;
    const prevType  = commentType;
    setComments((c) => [...c, optimistic]);
    setTotalComments((n) => n + 1);
    setInput(""); setCommentType(null);

    try {
      if (postId) {
        const { comment: real } = await createComment({
          postId, userId: currentUserId, content: optimistic.content,
          commentType: commentType ?? undefined, author: getMyName(), avatar: getMyAvatar(),
        });
        setComments((c) => c.map((x) => (x.id === optimistic.id ? real : x)));
      }
      setPosted(true);
      toast.success("Commentaire posté !", { duration: 1800 });
      setTimeout(() => { setPosted(false); onCommentAdded?.(); }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      console.error("Erreur commentaire:", err);
      setComments((c) => c.filter((x) => x.id !== optimistic.id));
      setTotalComments((n) => Math.max(0, n - 1));
      setInput(prevInput); setCommentType(prevType);
      setSendError(msg || "Impossible de poster.");
      toast.error("Échec de l'envoi", { description: msg, duration: 3000 });
    } finally {
      setSending(false);
    }
  };

  // Sélection d'un GIF → l'insérer directement comme message
  const handleGifSelect = async (gifUrl: string) => {
    setGifOpen(false);
    setSendError(null);
    setSending(true);

    const optimistic: ApiComment = {
      id: `temp-${Date.now()}`,
      postId: postId ?? "",
      userId: currentUserId,
      author: getMyName(),
      avatar: getMyAvatar(),
      content: gifUrl,
      commentType: null,
      reactionCounts: { Pertinent: 0, Motivant: 0, "J'adore": 0, "Je soutiens": 0 },
      repliesCount: 0,
      createdAt: new Date().toISOString(),
      timestamp: "À l'instant",
      myReaction: null,
    };

    setComments((c) => [...c, optimistic]);
    setTotalComments((n) => n + 1);

    try {
      if (postId) {
        const { comment: real } = await createComment({
          postId, userId: currentUserId, content: gifUrl,
          author: getMyName(), avatar: getMyAvatar(),
        });
        setComments((c) => c.map((x) => (x.id === optimistic.id ? real : x)));
      }
      toast.success("GIF envoyé !", { duration: 1500 });
      onCommentAdded?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      console.error("Erreur envoi GIF:", err);
      setComments((c) => c.filter((x) => x.id !== optimistic.id));
      setTotalComments((n) => Math.max(0, n - 1));
      setSendError(msg || "Impossible d'envoyer le GIF.");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => { if (sending) return; onClose(); };

  const modalContent = (
    <>
      {isOpen && (
        <>
          {/* GIF Picker */}
          <GifPicker isOpen={gifOpen} onClose={() => setGifOpen(false)} onSelect={handleGifSelect} anchor="center" />

          {/* Backdrop */}
          <motion.div
            onClick={handleClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.22 }}
            style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.70)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
          />

          {/* Sheet principale */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 38 }}
            style={{
              position: "fixed", left: 0, right: 0, bottom: keyboardOffset, zIndex: 9999,
              display: "flex", flexDirection: "column",
              background: "rgba(8,8,12,0.98)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              border: "0.5px solid rgba(255,255,255,0.09)", borderBottom: "none",
              boxShadow: "0 -12px 60px rgba(0,0,0,0.85)",
              maxHeight: "88vh", overflow: "hidden",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 2, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
            </div>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageCircle style={{ width: 17, height: 17, color: "rgba(255,255,255,0.40)", strokeWidth: 1.8 }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>Commentaires</span>
                {totalComments > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                    {totalComments}
                  </span>
                )}
              </div>
              <motion.button whileTap={{ scale: 0.88 }} onClick={handleClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.50)" }} />
              </motion.button>
            </div>

            {/* Post de référence */}
            <div style={{ display: "flex", gap: 10, padding: "12px 20px", borderBottom: "0.5px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
              <img src={postAvatar} alt={postAuthor} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.10)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>{postAuthor}</span>
                  {postType && <span style={{ fontSize: 10, fontWeight: 700, color: "#111", background: "rgba(255,255,255,0.88)", borderRadius: 999, padding: "1px 7px" }}>{postType}</span>}
                  {postTime && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", marginLeft: "auto" }}>{postTime}</span>}
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {postText}
                </p>
              </div>
            </div>

            {/* Liste des commentaires */}
            <div ref={listRef} style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}>
              {loadingComments ? (
                <div>{[1, 2, 3].map((i) => <CommentSkeleton key={i} />)}</div>
              ) : fetchError ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 12 }}>
                  <AlertCircle style={{ width: 28, height: 28, color: "rgba(239,68,68,0.60)" }} />
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textAlign: "center", margin: 0 }}>{fetchError}</p>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={loadComments} style={{ padding: "7px 18px", borderRadius: 999, cursor: "pointer", background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.60)", WebkitTapHighlightColor: "transparent" }}>
                    Réessayer
                  </motion.button>
                </div>
              ) : comments.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 10 }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MessageCircle style={{ width: 22, height: 22, color: "rgba(255,255,255,0.20)", strokeWidth: 1.5 }} />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.40)", margin: 0 }}>Aucun commentaire</p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.22)", margin: 0, textAlign: "center" }}>Soyez le premier à répondre à {postAuthor}</p>
                </motion.div>
              ) : (
                <div style={{ paddingBottom: 8 }}>
                  
                    {comments.map((c, i) => (
                      <CommentItem key={c.id} comment={c} isLast={i === comments.length - 1} />
                    ))}
                  
                </div>
              )}
            </div>

            {/* Zone de composition */}
            <div style={{ flexShrink: 0, borderTop: "0.5px solid rgba(255,255,255,0.07)", background: "rgba(8,8,12,0.98)", paddingBottom: keyboardOffset > 0 ? 8 : "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}>
              
                {sendError && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 16px 0", padding: "7px 11px", borderRadius: 10, background: "rgba(239,68,68,0.10)", border: "0.5px solid rgba(239,68,68,0.22)" }}>
                    <AlertCircle style={{ width: 13, height: 13, color: "#ef4444", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "rgba(239,68,68,0.88)" }}>{sendError}</span>
                  </motion.div>
                )}
              

              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", padding: "10px 16px 6px" }}>
                <img src={getMyAvatar()} alt={getMyName()} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid rgba(99,102,241,0.25)", alignSelf: "flex-end", marginBottom: 6 }} />

                <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.11)", borderRadius: 18, padding: "8px 12px", transition: "border-color 0.18s" }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); if (sendError) setSendError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={`Répondre à ${postAuthor}…`}
                    rows={1}
                    style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 15, color: "rgba(235,235,245,0.90)", caretColor: "#6366f1", lineHeight: 1.5, maxHeight: 80, overflowY: "auto", whiteSpace: "pre-wrap", wordWrap: "break-word", overflowWrap: "break-word", wordBreak: "break-word" }}
                    className="placeholder:text-[rgba(144,144,168,0.35)]"
                    onInput={(e) => {
                      const t = e.currentTarget;
                      t.style.height = "auto";
                      t.style.height = Math.min(t.scrollHeight, 80) + "px";
                    }}
                  />

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                    {/* Gauche : Type de commentaire + bouton GIF */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {postId && (
                        <div style={{ position: "relative" }}>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setTypeOpen((v) => !v)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "3px 10px", borderRadius: 999,
                              border: commentType ? `0.5px solid ${TYPE_CONFIG[commentType]?.border ?? "rgba(255,255,255,0.20)"}` : "0.5px solid rgba(255,255,255,0.10)",
                              background: commentType ? TYPE_CONFIG[commentType]?.bg ?? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
                              fontSize: 11, fontWeight: commentType ? 600 : 400,
                              color: commentType ? TYPE_CONFIG[commentType]?.color ?? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.30)",
                              cursor: "pointer", WebkitTapHighlightColor: "transparent",
                            }}
                          >
                            {commentType ? TYPE_CONFIG[commentType]?.label : "Type"}
                            <ChevronDown style={{ width: 11, height: 11, transform: typeOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
                          </motion.button>

                          
                            {typeOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: 4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.14 }}
                                style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 10000, background: "rgba(14,14,22,0.98)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", borderRadius: 14, border: "0.5px solid rgba(255,255,255,0.12)", boxShadow: "0 -8px 32px rgba(0,0,0,0.55)", padding: 5, minWidth: 170 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {([null, ...COMMENT_TYPE_LABELS] as (CommentType | null)[]).map((t) => {
                                  const cfg = t ? TYPE_CONFIG[t] : null;
                                  return (
                                    <motion.button key={t ?? "none"} whileTap={{ scale: 0.96 }}
                                      onClick={() => { setCommentType(t); setTypeOpen(false); }}
                                      style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 10, background: commentType === t ? (cfg?.bg ?? "rgba(255,255,255,0.07)") : "transparent", border: "none", cursor: "pointer", fontSize: 13, fontWeight: commentType === t ? 700 : 400, color: cfg?.color ?? "rgba(255,255,255,0.55)", WebkitTapHighlightColor: "transparent" }}>
                                      {t ? cfg?.label : "Aucun type"}
                                    </motion.button>
                                  );
                                })}
                              </motion.div>
                            )}
                          
                        </div>
                      )}

                      {/* Bouton GIF */}
                      <motion.button
                        whileTap={{ scale: 0.90 }}
                        onClick={() => setGifOpen(true)}
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          padding: "3px 8px", borderRadius: 6,
                          background: gifOpen ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.06)",
                          border: gifOpen ? "0.5px solid rgba(99,102,241,0.45)" : "0.5px solid rgba(255,255,255,0.10)",
                          cursor: "pointer", WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 800, color: gifOpen ? "#a5b4fc" : "rgba(255,255,255,0.40)", letterSpacing: "0.04em" }}>GIF</span>
                      </motion.button>
                    </div>

                    {/* Droite : bouton envoyer */}
                    <motion.button
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      whileTap={input.trim() && !sending ? { scale: 0.88 } : {}}
                      style={{
                        width: 32, height: 32, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: posted ? "rgba(34,197,94,0.22)" : input.trim() ? "#6366f1" : "rgba(255,255,255,0.07)",
                        border: posted ? "1px solid rgba(34,197,94,0.40)" : "none",
                        cursor: input.trim() && !sending ? "pointer" : "default",
                        transition: "background 0.18s",
                        opacity: !input.trim() && !sending ? 0.4 : 1,
                        flexShrink: 0, WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
                      }}
                    >
                      <>
                        {posted ? (
                          <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ fontSize: 14, color: "#4ade80" }}>✓</motion.span>
                        ) : sending ? (
                          <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.30)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                        ) : (
                          <motion.div key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <Send style={{ width: 14, height: 14, color: input.trim() ? "#fff" : "rgba(255,255,255,0.40)" }} />
                          </motion.div>
                        )}
                      </>
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </>
  );

  return createPortal(modalContent, document.body);
}