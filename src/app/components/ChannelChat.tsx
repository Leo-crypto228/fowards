import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { Send, Loader2, RefreshCw } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useAuth } from "../context/AuthContext";
import { GifPicker, GifMessage, isGifUrl } from "./GifPicker";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = {
  Authorization: `Bearer ${publicAnonKey}`,
  "Content-Type": "application/json",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  userId: string;
  author: string;
  handle: string;
  avatar: string;
  content: string;
  createdAt: string;
  timestamp: string;
  parentId?: string | null;
}

interface Props {
  communityId: string;
  channelId: string;
  channelName: string;
  channelEmoji?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return "Aujourd'hui";
  if (isYesterday) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function avatarInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// ── Avatar component ───────────────────────────────────────────────────────────

function Avatar({ src, name, size = 34 }: { src?: string; name: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg,#4f46e5,#818cf8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "1px solid rgba(99,102,241,0.30)",
    }}>
      <span style={{ fontSize: size * 0.35, fontWeight: 700, color: "#fff" }}>
        {avatarInitials(name)}
      </span>
    </div>
  );
}

// ── Date separator ─────────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      margin: "18px 0 14px",
    }}>
      <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.07)" }} />
      <span style={{
        fontSize: 12, fontWeight: 500,
        color: "rgba(255,255,255,0.28)",
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}

// ── Message row ────────────────────────────────────────────────────────────────

function MessageRow({
  msg,
  isMine,
  showAvatar,
}: {
  msg: ChatMessage;
  isMine: boolean;
  showAvatar: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: showAvatar ? "6px 16px 2px" : "1px 16px 1px",
      }}
    >
      {/* Avatar — visible only on first message of a group */}
      <div style={{ width: 34, flexShrink: 0, marginTop: showAvatar ? 0 : 0 }}>
        {showAvatar ? (
          <Avatar src={msg.avatar || undefined} name={msg.author} size={34} />
        ) : (
          <div style={{ width: 34 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {showAvatar && (
          <div style={{
            display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2,
          }}>
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: isMine ? "#a5b4fc" : "rgba(255,255,255,0.88)",
            }}>
              {msg.author}
            </span>
            <span style={{
              fontSize: 11, color: "rgba(255,255,255,0.28)", fontWeight: 400,
            }}>
              {formatTime(msg.createdAt)}
            </span>
          </div>
        )}
        <p style={{
          fontSize: 14, lineHeight: 1.5, margin: 0,
          color: "rgba(255,255,255,0.72)",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}>
          {isGifUrl(msg.content)
            ? <GifMessage url={msg.content} />
            : msg.content
          }
        </p>
      </div>
    </motion.div>
  );
}

// ── Main ChannelChat component ─────────────────────────────────────────────────

export function ChannelChat({ communityId, channelId, channelName, channelEmoji }: Props) {
  const { user } = useAuth();
  const userId   = user?.supabaseId ?? "";
  const userName = user?.name ?? user?.username ?? "Moi";
  const userAvatar = user?.avatar ?? "";
  const userHandle = `@${user?.username ?? userId}`;

  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gifOpen, setGifOpen]     = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Use channel-scoped key for messages ───────────────────────────────────
  // We scope messages per channel using channelId as the communityId parameter
  // This maps to ff:cmsgs:${channelId} in the KV store
  const chatKey = `${communityId}-${channelId}`;

  // ── Fetch messages ────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(
        `${BASE}/community/${encodeURIComponent(chatKey)}/messages?limit=200`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages as ChatMessage[]);
      }
    } catch (err) {
      console.error("Erreur chargement messages canal:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chatKey]);

  useEffect(() => {
    fetchMessages();
    // Poll every 5 seconds for new messages
    pollRef.current = setInterval(() => fetchMessages(true), 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    }
  }, [messages.length, loading]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending || !userId) return;

    // Optimistic
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const tempMsg: ChatMessage = {
      id: tempId,
      userId,
      author: userName,
      handle: userHandle,
      avatar: userAvatar,
      content: text,
      createdAt: now,
      timestamp: "À l'instant",
      parentId: null,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setInputText("");
    setSending(true);

    try {
      const res = await fetch(`${BASE}/community/${encodeURIComponent(chatKey)}/messages`, {
        method: "POST",
        headers: H,
        body: JSON.stringify({
          userId,
          author: userName,
          handle: userHandle,
          avatar: userAvatar,
          content: text,
          parentId: null,
        }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) =>
          prev.map((m) => m.id === tempId ? { ...data.message, content: data.message.content } : m)
        );
      }
    } catch (err) {
      console.error("Erreur envoi message:", err);
      // Keep optimistic message
    } finally {
      setSending(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  };

  // ── Send GIF ──────────────────────────────────────────────────────────────
  const handleGifSelect = async (gifUrl: string) => {
    setGifOpen(false);
    if (!userId) return;
    const tempId = `temp-gif-${Date.now()}`;
    const now = new Date().toISOString();
    const tempMsg: ChatMessage = {
      id: tempId, userId, author: userName, handle: userHandle,
      avatar: userAvatar, content: gifUrl,
      createdAt: now, timestamp: "À l'instant", parentId: null,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setSending(true);
    try {
      const res = await fetch(`${BASE}/community/${encodeURIComponent(chatKey)}/messages`, {
        method: "POST", headers: H,
        body: JSON.stringify({ userId, author: userName, handle: userHandle, avatar: userAvatar, content: gifUrl, parentId: null }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...data.message } : m));
      }
    } catch (err) {
      console.error("Erreur envoi GIF:", err);
    } finally {
      setSending(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // ── Build grouped messages ─────────────────────────────────────────────────
  // Group consecutive messages from the same user

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "calc(100dvh - 280px)",
      minHeight: 400,
      background: "#000",
      position: "relative",
    }}>
      {/* GIF Picker */}
      <GifPicker isOpen={gifOpen} onClose={() => setGifOpen(false)} onSelect={handleGifSelect} anchor="bottom" />

      {/* ── Messages area ── */}
      <div style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        scrollbarWidth: "none",
        paddingTop: 8,
        paddingBottom: 8,
      }}>
        {loading ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            paddingTop: 60, gap: 8,
          }}>
            <Loader2 style={{ width: 16, height: 16, color: "#6366f1" }} className="animate-spin" />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)" }}>Chargement…</span>
          </div>
        ) : messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", paddingTop: 60, gap: 14, textAlign: "center",
              padding: "60px 32px",
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 20,
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}>
              {channelEmoji && channelEmoji !== "#" ? channelEmoji : "💬"}
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.72)", margin: "0 0 6px" }}>
                Sois le premier à écrire !
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.30)", margin: 0, lineHeight: 1.6 }}>
                Lance la discussion dans{" "}
                <span style={{ color: "rgba(129,140,248,0.80)", fontWeight: 600 }}>
                  {channelEmoji && channelEmoji !== "#" ? channelEmoji : "#"}{channelName}
                </span>
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const prev = messages[idx - 1];
              const isGrouped =
                prev &&
                prev.userId === msg.userId &&
                isSameDay(prev.createdAt, msg.createdAt) &&
                new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;

              const showDateSep =
                !prev || !isSameDay(prev.createdAt, msg.createdAt);

              const isMine = msg.userId === userId || msg.id.startsWith("temp-");

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <DateSeparator label={formatDate(msg.createdAt)} />
                  )}
                  <MessageRow
                    msg={msg}
                    isMine={isMine}
                    showAvatar={!isGrouped}
                  />
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{
        borderTop: "0.5px solid rgba(255,255,255,0.07)",
        padding: "12px 12px 16px",
        background: "#000",
        flexShrink: 0,
      }}>
        <form
          onSubmit={handleSend}
          style={{
            display: "flex", alignItems: "flex-end", gap: 10,
            background: "rgba(255,255,255,0.05)",
            border: "0.5px solid rgba(255,255,255,0.10)",
            borderRadius: 24,
            padding: "10px 14px",
            transition: "border-color 0.18s ease",
          }}
          onFocus={() => {}}
        >
          {/* Current user avatar */}
          <div style={{ paddingBottom: 0, alignSelf: "flex-end" }}>
            <Avatar src={userAvatar || undefined} name={userName} size={28} />
          </div>

          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 120) + "px";
            }}
            placeholder={`Message dans ${channelEmoji && channelEmoji !== "#" ? channelEmoji : "#"}${channelName}… (Maj+Entrée pour saut de ligne)`}
            disabled={!userId}
            rows={1}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 14, color: "rgba(255,255,255,0.85)",
              caretColor: "#6366f1",
              resize: "none", lineHeight: 1.5, maxHeight: 120, minHeight: 22,
              whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere",
              fontFamily: "inherit", paddingTop: 4, paddingBottom: 4,
              alignSelf: "stretch",
            }}
          />

          {/* Refresh button */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            onClick={() => fetchMessages(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            <motion.div
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}
            >
              <RefreshCw style={{ width: 14, height: 14, color: "rgba(255,255,255,0.6)" }} />
            </motion.div>
          </motion.button>

          {/* GIF button */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.90 }}
            onClick={(e) => { e.preventDefault(); setGifOpen(true); }}
            disabled={!userId}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "4px 8px", borderRadius: 6, flexShrink: 0,
              background: gifOpen ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.06)",
              border: gifOpen ? "0.5px solid rgba(99,102,241,0.45)" : "0.5px solid rgba(255,255,255,0.10)",
              cursor: userId ? "pointer" : "not-allowed",
              opacity: userId ? 1 : 0.4,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, color: gifOpen ? "#a5b4fc" : "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>GIF</span>
          </motion.button>

          {/* Send button */}
          <motion.button
            type="submit"
            whileTap={{ scale: 0.88 }}
            disabled={!inputText.trim() || sending || !userId}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: "50%", border: "none",
              background: inputText.trim() && !sending && userId
                ? "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)"
                : "rgba(255,255,255,0.07)",
              cursor: inputText.trim() && !sending && userId ? "pointer" : "not-allowed",
              flexShrink: 0,
              transition: "background 0.18s ease",
              boxShadow: inputText.trim() && !sending && userId
                ? "0 2px 12px rgba(79,70,229,0.40)"
                : "none",
            }}
          >
            {sending ? (
              <Loader2 style={{ width: 14, height: 14, color: "#fff" }} className="animate-spin" />
            ) : (
              <Send style={{
                width: 14, height: 14,
                color: inputText.trim() && userId ? "#fff" : "rgba(255,255,255,0.25)",
                strokeWidth: 2.2,
              }} />
            )}
          </motion.button>
        </form>

        {!userId && (
          <p style={{
            fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center",
            marginTop: 6, margin: "6px 0 0",
          }}>
            Connecte-toi pour participer à la discussion
          </p>
        )}
      </div>
    </div>
  );
}