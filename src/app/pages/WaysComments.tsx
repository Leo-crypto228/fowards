import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Send, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { getWaysComments, replyToWaysComment, type WaysComment } from "../api/waysApi";
import { MY_USER_ID } from "../api/authStore";
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

function Avatar({ name, avatar, size = 36 }: { name: string; avatar?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.[0] ?? "?").toUpperCase();
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {avatar && !failed ? (
        <img src={avatar} alt="" onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: size * 0.38, fontWeight: 700, color: "#fff" }}>{initial}</span>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  waysId,
  currentUserId,
  onReply,
}: {
  comment: WaysComment;
  waysId: string;
  currentUserId: string;
  onReply: (commentId: string, text: string) => Promise<void>;
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  const handleReply = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      await onReply(comment.id, replyText.trim());
      setReplyText("");
      setShowReplyInput(false);
      setShowReplies(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "rgba(255,255,255,0.03)",
        borderRadius: 16,
        border: "0.5px solid rgba(255,255,255,0.07)",
        padding: "14px 14px",
      }}
    >
      <div style={{ display: "flex", gap: 10 }}>
        <Avatar name={comment.author.name} avatar={comment.author.avatar} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>{comment.author.name}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>{relativeTime(comment.createdAt)}</span>
          </div>
          <p style={{ fontSize: 15, color: "rgba(240,240,245,0.80)", lineHeight: 1.55, margin: 0, wordBreak: "break-word" }}>
            {comment.text}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, paddingLeft: 46 }}>
        <button
          onClick={() => setShowReplyInput((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, color: "rgba(165,180,252,0.70)", fontWeight: 600 }}
        >
          Répondre
        </button>
        {comment.replies?.length > 0 && (
          <button
            onClick={() => setShowReplies((v) => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.35)" }}
          >
            {showReplies ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
            {comment.replies.length} réponse{comment.replies.length > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Reply input */}
      
        {showReplyInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            style={{ paddingLeft: 46, marginTop: 10, overflow: "hidden" }}
          >
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.05)",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.09)",
                padding: "7px 10px 7px 14px",
              }}
            >
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Ta réponse..."
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleReply(); } }}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: 14, color: "rgba(240,240,245,0.85)", fontFamily: "inherit",
                }}
              />
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleReply}
                disabled={!replyText.trim() || sending}
                style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: replyText.trim() ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "rgba(255,255,255,0.08)",
                  border: "none", cursor: replyText.trim() ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <Send style={{ width: 13, height: 13, color: "#fff" }} />
              </motion.button>
            </div>
          </motion.div>
        )}
      

      {/* Replies */}
      
        {showReplies && comment.replies?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            style={{ marginTop: 10, paddingLeft: 46, overflow: "hidden" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {comment.replies.map((reply) => (
                <div key={reply.id} style={{ display: "flex", gap: 8 }}>
                  <Avatar name={reply.author.name} avatar={reply.author.avatar} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>{reply.author.name}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}>{relativeTime(reply.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: 14, color: "rgba(240,240,245,0.75)", lineHeight: 1.5, margin: 0 }}>{reply.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      
    </motion.div>
  );
}

export function WaysComments() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [comments, setComments] = useState<WaysComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = MY_USER_ID;

  useEffect(() => {
    if (!id || !currentUserId) return;
    setLoading(true);
    getWaysComments(id, currentUserId)
      .then(({ comments: c }) => setComments(c))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [id, currentUserId]);

  const handleReply = async (commentId: string, text: string) => {
    if (!id || !currentUserId) return;
    try {
      const { reply } = await replyToWaysComment(id, commentId, { username: currentUserId, text });
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, replies: [...(c.replies || []), reply] } : c
        )
      );
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#09090f", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 16px 12px",
          borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        }}
      >
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => navigate(-1)}
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ArrowLeft style={{ width: 18, height: 18, color: "rgba(255,255,255,0.80)" }} />
        </motion.button>
        <div>
          <p style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.92)", margin: 0 }}>Commentaires</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", margin: 0 }}>Privés — visibles seulement par toi</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "16px" }}>
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ width: 28, height: 28, border: "2.5px solid rgba(255,255,255,0.15)", borderTopColor: "#a78bfa", borderRadius: "50%" }}
            />
          </div>
        )}

        {error && (
          <p style={{ textAlign: "center", color: "#f87171", fontSize: 14, paddingTop: 32 }}>{error}</p>
        )}

        {!loading && !error && comments.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 48 }}>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.35)" }}>Aucun commentaire pour l'instant.</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.22)", marginTop: 6 }}>Les commentaires de tes abonnés apparaîtront ici.</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                waysId={id!}
                currentUserId={currentUserId || ""}
                onReply={handleReply}
              />
            ))}
          
        </div>
      </div>
    </div>
  );
}
