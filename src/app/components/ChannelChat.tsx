import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Loader2, RefreshCw, Mic, X } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useAuth } from "../context/AuthContext";
import { GifPicker, GifMessage, isGifUrl } from "./GifPicker";
import { VoicePlayer } from "./VoicePlayer";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = {
  Authorization: `Bearer ${publicAnonKey}`,
  "Content-Type": "application/json",
};

// ── Types ──────────────────────────────────────────────────────────────────────

type RecordingState = "idle" | "armed" | "recording" | "uploading";

interface ChatMessage {
  id: string;
  userId: string;
  author: string;
  handle: string;
  avatar: string;
  content: string;
  voiceUrl?: string | null;
  voiceDuration?: number | null;
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

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
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

// ── Sub-components ─────────────────────────────────────────────────────────────

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

function DateSeparator({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 14px" }}>
      <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.07)" }} />
      <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.28)", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}

function RecordingTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 500);
    return () => clearInterval(id);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span style={{ fontSize: 13, color: "#f87171", fontVariantNumeric: "tabular-nums", fontWeight: 600, flexShrink: 0 }}>
      {m}:{s.toString().padStart(2, "0")}
    </span>
  );
}

function RecordingWave() {
  const bars = useMemo(() => Array.from({ length: 22 }, () => 0.25 + Math.random() * 0.75), []);
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 3, height: 26 }}>
      {bars.map((h, i) => (
        <motion.div
          key={i}
          style={{ width: 3, borderRadius: 2, background: "rgba(248,113,113,0.65)" }}
          animate={{ height: [4, Math.round(h * 26), 4] }}
          transition={{ duration: 0.65 + h * 0.5, repeat: Infinity, delay: i * 0.07, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── Message row ────────────────────────────────────────────────────────────────

function MessageRow({ msg, isMine, showAvatar }: { msg: ChatMessage; isMine: boolean; showAvatar: boolean }) {
  const isVoice = !!msg.voiceUrl;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: showAvatar ? "6px 16px 2px" : "1px 16px 1px",
      }}
    >
      <div style={{ width: 34, flexShrink: 0 }}>
        {showAvatar
          ? <Avatar src={msg.avatar || undefined} name={msg.author} size={34} />
          : <div style={{ width: 34 }} />
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {showAvatar && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: isMine ? "#a5b4fc" : "rgba(255,255,255,0.88)" }}>
              {msg.author}
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontWeight: 400 }}>
              {formatTime(msg.createdAt)}
            </span>
          </div>
        )}

        {isVoice ? (
          <VoicePlayer
            url={msg.voiceUrl!}
            duration={msg.voiceDuration ?? 0}
            msgId={msg.id}
          />
        ) : (
          <p style={{
            fontSize: 14, lineHeight: 1.5, margin: 0,
            color: "rgba(255,255,255,0.72)",
            wordBreak: "break-word", whiteSpace: "pre-wrap",
          }}>
            {isGifUrl(msg.content)
              ? <GifMessage url={msg.content} />
              : msg.content
            }
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Main ChannelChat component ─────────────────────────────────────────────────

export function ChannelChat({ communityId, channelId, channelName, channelEmoji }: Props) {
  const { user } = useAuth();
  const userId    = user?.supabaseId ?? "";
  const userName  = user?.name ?? user?.username ?? "Moi";
  const userAvatar = user?.avatar ?? "";
  const userHandle = `@${user?.username ?? userId}`;

  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [loading, setLoading]       = useState(true);
  const [inputText, setInputText]   = useState("");
  const [sending, setSending]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gifOpen, setGifOpen]       = useState(false);

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const recordingStateRef = useRef<RecordingState>("idle");
  const armTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const recordStartRef    = useRef<number>(0);
  const voiceMimeRef      = useRef<string>("");

  const setRS = useCallback((s: RecordingState) => {
    recordingStateRef.current = s;
    setRecordingState(s);
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (data.messages) setMessages(data.messages as ChatMessage[]);
    } catch (err) {
      console.error("Erreur chargement messages canal:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chatKey]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(() => fetchMessages(true), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages]);

  useEffect(() => {
    if (!loading) setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, 60);
  }, [messages.length, loading]);

  // ── Send text ─────────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending || !userId) return;

    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    setMessages((prev) => [...prev, {
      id: tempId, userId, author: userName, handle: userHandle,
      avatar: userAvatar, content: text,
      createdAt: now, timestamp: "À l'instant", parentId: null,
    }]);
    setInputText("");
    setSending(true);

    try {
      const res = await fetch(`${BASE}/community/${encodeURIComponent(chatKey)}/messages`, {
        method: "POST", headers: H,
        body: JSON.stringify({ userId, author: userName, handle: userHandle, avatar: userAvatar, content: text, parentId: null }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...data.message } : m));
      }
    } catch (err) {
      console.error("Erreur envoi message:", err);
    } finally {
      setSending(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent); }
  };

  // ── Send GIF ──────────────────────────────────────────────────────────────
  const handleGifSelect = async (gifUrl: string) => {
    setGifOpen(false);
    if (!userId) return;
    const tempId = `temp-gif-${Date.now()}`;
    const now = new Date().toISOString();
    setMessages((prev) => [...prev, {
      id: tempId, userId, author: userName, handle: userHandle,
      avatar: userAvatar, content: gifUrl,
      createdAt: now, timestamp: "À l'instant", parentId: null,
    }]);
    setSending(true);
    try {
      const res = await fetch(`${BASE}/community/${encodeURIComponent(chatKey)}/messages`, {
        method: "POST", headers: H,
        body: JSON.stringify({ userId, author: userName, handle: userHandle, avatar: userAvatar, content: gifUrl, parentId: null }),
      });
      const data = await res.json();
      if (data.message) setMessages((prev) => prev.map((m) => m.id === tempId ? { ...data.message } : m));
    } catch (err) {
      console.error("Erreur envoi GIF:", err);
    } finally {
      setSending(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // ── Voice recording ───────────────────────────────────────────────────────
  const cancelRecording = () => {
    if (armTimerRef.current) { clearTimeout(armTimerRef.current); armTimerRef.current = null; }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stream.getTracks().forEach((t) => t.stop());
      rec.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRS("idle");
  };

  const handleMicPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!userId || recordingStateRef.current !== "idle") return;

    // Capture values at press time for the closure
    const _userId    = userId;
    const _userName  = userName;
    const _userHandle = userHandle;
    const _userAvatar = userAvatar;
    const _chatKey   = chatKey;

    setRS("armed");

    const handleUp = () => {
      document.removeEventListener("pointerup", handleUp);
      const cur = recordingStateRef.current;

      if (cur === "armed") {
        if (armTimerRef.current) { clearTimeout(armTimerRef.current); armTimerRef.current = null; }
        setRS("idle");
        return;
      }

      if (cur === "recording") {
        const rec = mediaRecorderRef.current;
        if (!rec || rec.state === "inactive") { setRS("idle"); return; }

        const duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));

        rec.onstop = async () => {
          const blobMime = voiceMimeRef.current || rec.mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: blobMime });
          rec.stream.getTracks().forEach((t) => t.stop());
          mediaRecorderRef.current = null;
          chunksRef.current = [];

          if (blob.size < 1000) { setRS("idle"); return; }
          setRS("uploading");

          try {
            const fd = new FormData();
            const ext = blobMime.includes("mp4") || blobMime.includes("m4a") ? "m4a" : "webm";
            fd.append("file", blob, `voice.${ext}`);

            const upRes = await fetch(`${BASE}/upload-voice`, {
              method: "POST",
              headers: { Authorization: `Bearer ${publicAnonKey}` },
              body: fd,
            });
            const upData = await upRes.json();
            if (!upData.url) throw new Error(upData.error || "Erreur upload");

            const tempId = `temp-voice-${Date.now()}`;
            const now = new Date().toISOString();
            setMessages((prev) => [...prev, {
              id: tempId, userId: _userId, author: _userName, handle: _userHandle,
              avatar: _userAvatar, content: "",
              voiceUrl: upData.url, voiceDuration: duration,
              createdAt: now, timestamp: "À l'instant", parentId: null,
            }]);

            const msgRes = await fetch(`${BASE}/community/${encodeURIComponent(_chatKey)}/messages`, {
              method: "POST", headers: H,
              body: JSON.stringify({
                userId: _userId, author: _userName, handle: _userHandle, avatar: _userAvatar,
                content: "", voiceUrl: upData.url, voiceDuration: duration, parentId: null,
              }),
            });
            const msgData = await msgRes.json();
            if (msgData.message) {
              setMessages((prev) => prev.map((m) => m.id === tempId ? { ...msgData.message } : m));
            }
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          } catch (err) {
            console.error("Erreur envoi vocal:", err);
          } finally {
            setRS("idle");
          }
        };

        rec.stop();
      }
    };

    document.addEventListener("pointerup", handleUp);

    armTimerRef.current = setTimeout(async () => {
      armTimerRef.current = null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = pickMimeType();
        voiceMimeRef.current = mime;
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        chunksRef.current = [];
        rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
        rec.start(100);
        mediaRecorderRef.current = rec;
        recordStartRef.current = Date.now();
        setRS("recording");
        navigator.vibrate?.(25);
      } catch {
        setRS("idle");
        document.removeEventListener("pointerup", handleUp);
      }
    }, 1500);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const showRecordingUI = recordingState === "recording" || recordingState === "uploading" || recordingState === "armed";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "calc(100dvh - 280px)", minHeight: 400,
      background: "#000", position: "relative",
    }}>
      <GifPicker isOpen={gifOpen} onClose={() => setGifOpen(false)} onSelect={handleGifSelect} anchor="bottom" />

      {/* ── Messages area ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none", paddingTop: 8, paddingBottom: 8 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 }}>
            <Loader2 style={{ width: 16, height: 16, color: "#6366f1" }} className="animate-spin" />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)" }}>Chargement…</span>
          </div>
        ) : messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 14, textAlign: "center", padding: "60px 32px" }}
          >
            <div style={{ width: 56, height: 56, borderRadius: 20, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
              {channelEmoji && channelEmoji !== "#" ? channelEmoji : "💬"}
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.72)", margin: "0 0 6px" }}>Sois le premier à écrire !</p>
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
                prev && prev.userId === msg.userId &&
                isSameDay(prev.createdAt, msg.createdAt) &&
                new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
              const showDateSep = !prev || !isSameDay(prev.createdAt, msg.createdAt);
              const isMine = msg.userId === userId || msg.id.startsWith("temp-");

              return (
                <div key={msg.id}>
                  {showDateSep && <DateSeparator label={formatDate(msg.createdAt)} />}
                  <MessageRow msg={msg} isMine={isMine} showAvatar={!isGrouped} />
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.07)", padding: "12px 12px 16px", background: "#000", flexShrink: 0 }}>

        <AnimatePresence mode="wait">
          {showRecordingUI ? (
            /* ── Recording / uploading overlay ── */
            <motion.div
              key="recording"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "rgba(255,255,255,0.05)",
                border: recordingState === "recording"
                  ? "0.5px solid rgba(248,113,113,0.35)"
                  : "0.5px solid rgba(255,255,255,0.10)",
                borderRadius: 24, padding: "10px 14px",
              }}
            >
              {/* Cancel button — onPointerDown so it fires before the global pointerup */}
              <motion.button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); cancelRecording(); }}
                whileTap={{ scale: 0.88 }}
                style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(255,255,255,0.07)", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.55)" }} />
              </motion.button>

              {/* Waveform or status */}
              <div style={{ flex: 1 }}>
                {recordingState === "uploading" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Loader2 style={{ width: 14, height: 14, color: "#6366f1" }} className="animate-spin" />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.40)" }}>Envoi…</span>
                  </div>
                ) : recordingState === "armed" ? (
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.40)" }}>Maintiens pour enregistrer…</span>
                ) : (
                  <RecordingWave />
                )}
              </div>

              {/* Timer */}
              {recordingState === "recording" && (
                <RecordingTimer startTime={recordStartRef.current} />
              )}

              {/* Mic button (right side in recording state — acts as send on release) */}
              {recordingState === "recording" && (
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: "#ef4444",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Mic style={{ width: 16, height: 16, color: "#fff" }} />
                </motion.div>
              )}
            </motion.div>
          ) : (
            /* ── Normal compose bar ── */
            <motion.div
              key="compose"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{ display: "flex", alignItems: "flex-end", gap: 8 }}
            >
              {/* Mic button — OUTSIDE the form, to its left */}
              <motion.div
                whileTap={{ scale: 0.88 }}
                onPointerDown={handleMicPointerDown}
                style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: recordingState === "armed"
                    ? "rgba(239,68,68,0.20)"
                    : "rgba(255,255,255,0.06)",
                  border: recordingState === "armed"
                    ? "0.5px solid rgba(239,68,68,0.50)"
                    : "0.5px solid rgba(255,255,255,0.10)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: userId ? "pointer" : "not-allowed",
                  opacity: userId ? 1 : 0.35,
                  alignSelf: "flex-end",
                  touchAction: "none",
                  userSelect: "none",
                  transition: "background 0.18s, border-color 0.18s",
                }}
              >
                <Mic style={{ width: 17, height: 17, color: recordingState === "armed" ? "#f87171" : "rgba(255,255,255,0.55)" }} />
              </motion.div>

              {/* Form */}
              <form
                onSubmit={handleSend}
                style={{
                  flex: 1, display: "flex", alignItems: "flex-end", gap: 8,
                  background: "rgba(255,255,255,0.05)",
                  border: "0.5px solid rgba(255,255,255,0.10)",
                  borderRadius: 24, padding: "10px 12px",
                }}
              >
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
                  placeholder={`${channelEmoji && channelEmoji !== "#" ? channelEmoji : "#"}${channelName}…`}
                  disabled={!userId}
                  rows={1}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    fontSize: 14, color: "rgba(255,255,255,0.85)",
                    caretColor: "#6366f1", resize: "none", lineHeight: 1.5,
                    maxHeight: 120, minHeight: 22,
                    whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere",
                    fontFamily: "inherit", paddingTop: 4, paddingBottom: 4,
                    alignSelf: "stretch",
                  }}
                />

                {/* Refresh */}
                <motion.button
                  type="button" whileTap={{ scale: 0.88 }}
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

                {/* GIF */}
                <motion.button
                  type="button" whileTap={{ scale: 0.90 }}
                  onClick={(e) => { e.preventDefault(); setGifOpen(true); }}
                  disabled={!userId}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    padding: "4px 8px", borderRadius: 6, flexShrink: 0,
                    background: gifOpen ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.06)",
                    border: gifOpen ? "0.5px solid rgba(99,102,241,0.45)" : "0.5px solid rgba(255,255,255,0.10)",
                    cursor: userId ? "pointer" : "not-allowed", opacity: userId ? 1 : 0.4,
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 800, color: gifOpen ? "#a5b4fc" : "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>GIF</span>
                </motion.button>

                {/* Send */}
                <motion.button
                  type="submit" whileTap={{ scale: 0.88 }}
                  disabled={!inputText.trim() || sending || !userId}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 34, height: 34, borderRadius: "50%", border: "none",
                    background: inputText.trim() && !sending && userId
                      ? "linear-gradient(135deg,#4f46e5 0%,#6366f1 100%)"
                      : "rgba(255,255,255,0.07)",
                    cursor: inputText.trim() && !sending && userId ? "pointer" : "not-allowed",
                    flexShrink: 0, transition: "background 0.18s ease",
                    boxShadow: inputText.trim() && !sending && userId ? "0 2px 12px rgba(79,70,229,0.40)" : "none",
                  }}
                >
                  {sending
                    ? <Loader2 style={{ width: 14, height: 14, color: "#fff" }} className="animate-spin" />
                    : <Send style={{ width: 14, height: 14, color: inputText.trim() && userId ? "#fff" : "rgba(255,255,255,0.25)", strokeWidth: 2.2 }} />
                  }
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {!userId && (
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 6, margin: "6px 0 0" }}>
            Connecte-toi pour participer à la discussion
          </p>
        )}
      </div>
    </div>
  );
}
