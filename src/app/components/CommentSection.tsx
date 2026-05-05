import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send } from "lucide-react";

interface Comment {
  id: number;
  author: string;
  avatar: string;
  text: string;
  time: string;
}

const MOCK_AVATARS = [
  "https://images.unsplash.com/photo-1584940121730-93ffb8aa88b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80",
  "https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80",
  "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=80",
];

interface CommentSectionProps {
  postAuthor: string;
  initialCount: number;
}

export function CommentSection({ postAuthor, initialCount }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([
    {
      id: 1,
      author: "Léa Moreau",
      avatar: MOCK_AVATARS[1],
      text: "Incroyable progression, tu m'inspires vraiment !",
      time: "1h",
    },
    {
      id: 2,
      author: "Maxime Leroy",
      avatar: MOCK_AVATARS[2],
      text: "Continue comme ça, la constance paie toujours.",
      time: "45min",
    },
  ]);
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setComments((prev) => [
      ...prev,
      {
        id: Date.now(),
        author: "Moi",
        avatar: MOCK_AVATARS[0],
        text: trimmed,
        time: "maintenant",
      },
    ]);
    setInput("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="mt-3 rounded-2xl px-4 py-3 space-y-3"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Existing comments */}
        <AnimatePresence initial={false}>
          {comments.map((c) => (
            <motion.div
              key={c.id}
              className="flex gap-2.5"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="rounded-full overflow-hidden flex-shrink-0 mt-0.5"
                style={{ width: 30, height: 30, border: "1px solid rgba(99,102,241,0.25)" }}
              >
                <img src={c.avatar} alt={c.author} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{c.author}</span>
                  <span className="text-xs text-muted-foreground">{c.time}</span>
                </div>
                <p className="text-sm text-foreground/85 leading-snug" style={{ whiteSpace: "pre-wrap", wordWrap: "break-word", overflowWrap: "break-word", wordBreak: "break-word" }}>{c.text}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Input */}
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            minHeight: 38,
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder={`Répondre à ${postAuthor}...`}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 13,
              color: "#f0f0f5",
              caretColor: "#6366f1",
              resize: "none",
              maxHeight: 80,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              lineHeight: 1.4,
            }}
            className="placeholder:text-[rgba(144,144,168,0.40)]"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 80) + "px";
            }}
          />
          <motion.button
            onClick={handleSubmit}
            whileTap={{ scale: 0.88 }}
            disabled={!input.trim()}
            style={{ opacity: input.trim() ? 1 : 0.35, marginTop: 4, flexShrink: 0 }}
          >
            <Send style={{ width: 15, height: 15, color: "#6366f1" }} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
