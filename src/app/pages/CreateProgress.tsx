import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ArrowLeft, AlertCircle, X, ImagePlus, Info, Mic, Video } from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { createPost, extractHashtags, LABEL_TO_TYPE, PostType } from "../api/postsApi";
import { createWays } from "../api/waysApi";
import { compressImage } from "../utils/compressImage";
import { linkPostReply } from "../api/sharesApi";
import { postCheckin } from "../api/progressionApi";
import { MY_USER_ID, MY_USER_NAME, MY_USER_AVATAR, MY_USER_OBJECTIVE, MY_USER_STREAK, getAuthUser } from "../api/authStore";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { VoicePlayer } from "../components/VoicePlayer";
import { VideoRecorder } from "../components/VideoRecorder";
import { toast } from "sonner";

const MAX_VOICE_SEC = 60;

const BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const POST_TYPES = ["Avancée", "Question", "Blocage", "Conseil(s)", "Actus"];

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `Format non autorisé (${file.type}). Acceptés : JPG, PNG, WEBP.`;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return `Image trop volumineuse (${(file.size / 1024 / 1024).toFixed(1)} MB). Max : 5 MB.`;
  }
  return null;
}

// ── Badge preview ─────────────────────────────────────────────────────────────
function TypePreview({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}
    >
      <span style={{ fontSize: 12, color: "rgba(144,144,168,0.55)", fontWeight: 500 }}>Apparaîtra comme :</span>
      <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 12px", borderRadius: 999, background: "rgba(255,255,255,0.90)", color: "#111", fontWeight: 600, fontSize: 12, letterSpacing: "0.01em" }}>
        {label}
      </span>
    </motion.div>
  );
}

// ── Tooltip suggestions ───────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Partage ce que tu construis aujourd'hui",
  "Pose une question",
  "Montre tes avancées",
  "Demande un avis",
  "Partage une victoire (même petite)",
];

function TypeTooltip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <motion.button type="button" whileTap={{ scale: 0.90 }} onClick={() => setOpen((v) => !v)}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: open ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.08)", border: open ? "1px solid rgba(99,102,241,0.40)" : "1px solid rgba(255,255,255,0.15)", cursor: "pointer", flexShrink: 0 }}>
        <Info style={{ width: 11, height: 11, color: open ? "#a5b4fc" : "rgba(255,255,255,0.40)", strokeWidth: 2.2 }} />
      </motion.button>

      
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15 }}
            style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", zIndex: 200, background: "rgba(14,14,22,0.98)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", borderRadius: 14, border: "0.5px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.55)", padding: "12px 14px", minWidth: 220 }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(165,180,252,0.80)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tu peux y poster</p>
            {SUGGESTIONS.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: i < SUGGESTIONS.length - 1 ? 6 : 0 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.18)" }}>·</span>
                <span style={{ fontSize: 13, color: "rgba(235,235,245,0.72)", whiteSpace: "normal", lineHeight: 1.4 }}>{s}</span>
              </div>
            ))}
          </motion.div>
        )}
      
    </div>
  );
}

export function CreateProgress() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const quotedPost = location.state?.quotedPost ?? null;

  // ── Mode : Partage (post classique) ou Ways (story 24h) ───────────────────
  const [mode, setMode] = useState<"partage" | "ways">("partage");

  // ── Ways state ────────────────────────────────────────────────────────────
  const [waysText, setWaysText]           = useState("");
  const [waysImageFile, setWaysImageFile] = useState<File | null>(null);
  const [waysImagePreview, setWaysImagePreview] = useState<string | null>(null);
  const [waysSubmitting, setWaysSubmitting] = useState(false);
  const waysFileInputRef = useRef<HTMLInputElement>(null);
  const WAYS_MAX = 1000;

  const handleWaysImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { toast.error(err); return; }
    const compressed = await compressImage(file);
    setWaysImageFile(compressed as File);
    setWaysImagePreview(URL.createObjectURL(compressed));
    e.target.value = "";
  };

  const handleWaysSubmit = async () => {
    if ((!waysText.trim() && !waysImageFile) || waysSubmitting) return;
    const username = MY_USER_ID;
    if (!username) { toast.error("Connecte-toi pour créer un Ways."); return; }
    setWaysSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (waysImageFile) {
        const form = new FormData();
        const ext = waysImageFile.type === "image/png" ? "png" : waysImageFile.type === "image/webp" ? "webp" : "jpg";
        form.append("file", waysImageFile, `image.${ext}`);
        const upRes = await fetch(`${BASE}/upload-image`, { method: "POST", headers: { Authorization: `Bearer ${publicAnonKey}` }, body: form });
        const upText = await upRes.text();
        let upData: { url?: string; error?: string };
        try { upData = JSON.parse(upText); } catch { throw new Error(`Upload échoué (${upRes.status}): ${upText.slice(0, 120)}`); }
        if (!upRes.ok) throw new Error(upData.error || "Erreur upload image");
        imageUrl = upData.url;
      }
      await createWays({ username, text: waysText.trim() || undefined, image: imageUrl });
      toast.success("Ton Ways est en ligne !");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(String(err));
    } finally {
      setWaysSubmitting(false);
    }
  };

  const [selectedType, setSelectedType] = useState<string>("");
  const [isAnonymous, setIsAnonymous]   = useState(false);
  const [anonHint, setAnonHint]         = useState(false);
  const [text, setText]                 = useState("");
  const [posted, setPosted]             = useState(false); // optimistic: posted instantly
  const [error, setError]               = useState<string | null>(null);

  // Images
  const [images, setImages]         = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  // ── Vocal (press-hold mic) ────────────────────────────────────────────────
  type VoiceMode = "idle" | "holding" | "recording" | "preview" | "uploading";
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("idle");
  const voiceModeRef = useRef<VoiceMode>("idle");
  const setVoiceModeBoth = useCallback((m: VoiceMode) => { voiceModeRef.current = m; setVoiceMode(m); }, []);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceTitle, setVoiceTitle] = useState("");
  const [voiceSubtitle, setVoiceSubtitle] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);

  // ── Vidéo ─────────────────────────────────────────────────────────────────
  type VideoPhase = null | "recorder" | "preview";
  const [videoPhase, setVideoPhase] = useState<VideoPhase>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDurationV, setVideoDurationV] = useState(0);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoSub, setVideoSub] = useState("");

  const resetVideo = useCallback(() => {
    if (videoPreviewUrl) { try { URL.revokeObjectURL(videoPreviewUrl); } catch {} }
    setVideoBlob(null);
    setVideoPreviewUrl(null);
    setVideoDurationV(0);
    setVideoTitle("");
    setVideoSub("");
    setVideoPhase(null);
  }, [videoPreviewUrl]);

  const handleVideoReady = useCallback((blob: Blob, duration: number) => {
    if (videoPreviewUrl) { try { URL.revokeObjectURL(videoPreviewUrl); } catch {} }
    const url = URL.createObjectURL(blob);
    setVideoBlob(blob);
    setVideoPreviewUrl(url);
    setVideoDurationV(duration);
    setVideoPhase("preview");
  }, [videoPreviewUrl]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordStartRef = useRef<number>(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordAutoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearVoiceTimers = useCallback(() => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    if (recordAutoStopRef.current) { clearTimeout(recordAutoStopRef.current); recordAutoStopRef.current = null; }
    if (holdTimeoutRef.current) { clearTimeout(holdTimeoutRef.current); holdTimeoutRef.current = null; }
  }, []);

  const resetVoice = useCallback(() => {
    clearVoiceTimers();
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.onstop = null; rec.stream.getTracks().forEach((t) => t.stop()); rec.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    voiceChunksRef.current = [];
    if (voicePreviewUrl) { try { URL.revokeObjectURL(voicePreviewUrl); } catch {} }
    setVoiceBlob(null);
    setVoicePreviewUrl(null);
    setVoiceDuration(0);
    setVoiceTitle("");
    setVoiceSubtitle("");
    setRecordingTime(0);
    setVoiceModeBoth("idle");
  }, [voicePreviewUrl, clearVoiceTimers, setVoiceModeBoth]);

  const startRecording = useCallback(async () => {
    try {
      const mime = (() => {
        if (typeof MediaRecorder === "undefined") return "";
        for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"])
          if (MediaRecorder.isTypeSupported(t)) return t;
        return "";
      })();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      voiceChunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) voiceChunksRef.current.push(ev.data); };
      rec.onstop = () => {
        clearVoiceTimers();
        const blob = new Blob(voiceChunksRef.current, { type: mime || rec.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        const dur = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        if (blob.size < 1000) { resetVoice(); return; }
        setVoiceBlob(blob);
        const url = URL.createObjectURL(blob);
        setVoicePreviewUrl(url);
        setVoiceDuration(dur);
        setVoiceModeBoth("preview");
      };
      rec.start();
      mediaRecorderRef.current = rec;
      recordStartRef.current = Date.now();
      setVoiceModeBoth("recording");
      setRecordingTime(0);
      navigator.vibrate?.(25);
      recordTimerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - recordStartRef.current) / 1000));
      }, 250);
      recordAutoStopRef.current = setTimeout(() => {
        const r = mediaRecorderRef.current;
        if (r && r.state !== "inactive") r.stop();
      }, MAX_VOICE_SEC * 1000);
    } catch {
      toast.error("Accès au micro refusé", { description: "Active le micro dans les paramètres du navigateur." });
      setVoiceModeBoth("idle");
    }
  }, [setVoiceModeBoth, clearVoiceTimers, resetVoice]);

  const startHold = useCallback(() => {
    if (voiceModeRef.current !== "idle") return;
    navigator.vibrate?.(8);
    startRecording();
  }, [startRecording]);

  const endHold = useCallback(() => {
    const mode = voiceModeRef.current;
    if (mode === "holding") {
      if (holdTimeoutRef.current) { clearTimeout(holdTimeoutRef.current); holdTimeoutRef.current = null; }
      setVoiceModeBoth("idle");
    } else if (mode === "recording") {
      const r = mediaRecorderRef.current;
      if (r && r.state !== "inactive") r.stop();
    }
  }, [setVoiceModeBoth]);

  // Touch handlers (iOS: preventDefault bloque le menu long-press natif)
  const handleMicTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    startHold();
  }, [startHold]);

  const handleMicTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    endHold();
  }, [endHold]);

  // Mouse handlers (desktop fallback — ignorés sur mobile car touch est prioritaire)
  const handleMicMouseDown = useCallback((_e: React.MouseEvent) => {
    startHold();
  }, [startHold]);

  const handleMicMouseUp = useCallback(() => {
    endHold();
  }, [endHold]);

  // Cleanup au unmount
  useEffect(() => {
    return () => {
      clearVoiceTimers();
      const r = mediaRecorderRef.current;
      if (r && r.state !== "inactive") {
        try { r.onstop = null; r.stream.getTracks().forEach((t) => t.stop()); r.stop(); } catch {}
      }
      if (voicePreviewUrl) { try { URL.revokeObjectURL(voicePreviewUrl); } catch {} }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    for (const file of files.slice(0, 4 - images.length)) {
      const err = validateImageFile(file);
      if (err) {
        toast.error(err, { duration: 4000 });
        continue;
      }
      validFiles.push(file);
    }
    const next = validFiles.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setImages((prev) => [...prev, ...next]);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => { URL.revokeObjectURL(prev[index].preview); return prev.filter((_, i) => i !== index); });
  };

  const hasVoice = voiceMode === "preview" && !!voiceBlob;
  const hasVideo = videoPhase === "preview" && !!videoBlob;
  const isValid = selectedType !== "" && (
    hasVideo
      ? videoTitle.trim().length > 0
      : hasVoice
        ? voiceTitle.trim().length > 0
        : text.trim().length > 0
  );

  const handleSubmit = () => {
    if (!isValid || posted) return;
    setError(null);

    // ── Optimistic UI ────────────────────────────────────────────────────────
    setPosted(true);
    navigate("/", { state: { refreshPosts: true } });

    const doSave = async () => {
      try {
        const postType = LABEL_TO_TYPE[selectedType] as PostType;

        // ─── Branche vidéo ────────────────────────────────────────────────────
        if (hasVideo && videoBlob) {
          const fd = new FormData();
          const ext = (videoBlob.type || "").includes("mp4") ? "mp4" : "webm";
          fd.append("file", videoBlob, `video.${ext}`);
          fd.append("bucket", "posts");
          const upRes = await fetch(`${BASE}/upload-video`, {
            method: "POST",
            headers: { Authorization: `Bearer ${publicAnonKey}` },
            body: fd,
          });
          const upData = await upRes.json();
          if (!upRes.ok || !upData.url) throw new Error(upData.error || "Erreur upload vidéo");

          const result = await createPost({
            user: { name: MY_USER_NAME || "Utilisateur", avatar: MY_USER_AVATAR, objective: MY_USER_OBJECTIVE, followers: 0 },
            streak: MY_USER_STREAK,
            progress: { type: postType, description: videoTitle.trim() },
            hashtags: [],
            username: MY_USER_ID,
            videoUrl: upData.url,
            videoDuration: videoDurationV,
            videoTitle: videoTitle.trim(),
            videoSubtitle: videoSub.trim() || undefined,
            isAnonymous: isAnonymous && selectedType === "Blocage" ? true : undefined,
            userId: getAuthUser()?.supabaseId,
          });
          window.dispatchEvent(new CustomEvent("fowards:post-created"));
          if (quotedPost?.postId) {
            linkPostReply(quotedPost.postId, result.post.id).catch(() => {});
          }
          postCheckin(MY_USER_ID, result.post.id).catch(() => {});
          return;
        }

        // ─── Branche vocal ────────────────────────────────────────────────────
        if (hasVoice && voiceBlob) {
          const fd = new FormData();
          const ext = (voiceBlob.type || "").includes("mp4") ? "m4a" : "webm";
          fd.append("file", voiceBlob, `voice.${ext}`);
          const upRes = await fetch(`${BASE}/upload-voice`, {
            method: "POST",
            headers: { Authorization: `Bearer ${publicAnonKey}` },
            body: fd,
          });
          const upData = await upRes.json();
          if (!upRes.ok || !upData.url) throw new Error(upData.error || "Erreur upload vocal");

          const result = await createPost({
            user: { name: MY_USER_NAME || "Utilisateur", avatar: MY_USER_AVATAR, objective: MY_USER_OBJECTIVE, followers: 0 },
            streak: MY_USER_STREAK,
            progress: { type: postType, description: voiceTitle.trim() },
            hashtags: [],
            username: MY_USER_ID,
            voiceUrl: upData.url,
            voiceDuration,
            voiceSubtitle: voiceSubtitle.trim() || undefined,
            isAnonymous: isAnonymous && selectedType === "Blocage" ? true : undefined,
            userId: getAuthUser()?.supabaseId,
          });
          window.dispatchEvent(new CustomEvent("fowards:post-created"));
          if (quotedPost?.postId) {
            linkPostReply(quotedPost.postId, result.post.id).catch((e) => console.error("Erreur liaison post-réponse:", e));
          }
          postCheckin(MY_USER_ID, result.post.id).catch((e) => console.error("Erreur post-checkin:", e));
          return;
        }

        // ─── Branche texte (normale) ──────────────────────────────────────────
        const hashtags = extractHashtags(text);
        const uploadedUrls: string[] = [];
        for (const { file } of images.slice(0, 4)) {
          const compressed = await compressImage(file);
          const formData = new FormData();
          formData.append("file", compressed, "image.jpg");
          const upRes = await fetch(`${BASE}/upload-image`, { method: "POST", headers: { Authorization: `Bearer ${publicAnonKey}` }, body: formData });
          const upData = await upRes.json();
          if (!upRes.ok || !upData.url) throw new Error(upData.error ?? "Erreur upload image");
          uploadedUrls.push(upData.url);
        }

        const result = await createPost({
          user: { name: MY_USER_NAME || "Utilisateur", avatar: MY_USER_AVATAR, objective: MY_USER_OBJECTIVE, followers: 0 },
          streak: MY_USER_STREAK,
          progress: { type: postType, description: text.trim() },
          hashtags,
          username: MY_USER_ID,
          images: uploadedUrls.length > 0 ? uploadedUrls : undefined,
          image: uploadedUrls[0] ?? undefined,
          isAnonymous: isAnonymous && selectedType === "Blocage" ? true : undefined,
          userId: getAuthUser()?.supabaseId,
        });

        window.dispatchEvent(new CustomEvent("fowards:post-created"));
        if (quotedPost?.postId) {
          linkPostReply(quotedPost.postId, result.post.id).catch((e) => console.error("Erreur liaison post-réponse:", e));
        }
        postCheckin(MY_USER_ID, result.post.id).catch((e) => console.error("Erreur post-checkin:", e));

      } catch (err) {
        console.error("Erreur save post background:", err);
        const msg = err instanceof Error ? err.message : "Réessaie";
        if (/quota vidéo|video-post-quota/i.test(msg)) {
          toast.error("Quota vidéo atteint", { description: msg, duration: 6000 });
        } else if (/aujourd|reviens|429/i.test(msg)) {
          toast.error("Quota vocal atteint", { description: "1 post vocal par 24h. Reviens demain.", duration: 6000 });
        } else {
          toast.error("Le post n'a pas pu être enregistré", { description: msg, duration: 4000 });
        }
      }
    };

    doSave();
  };

  return (
    <div className="min-h-screen" style={{ background: "#000000" }}>
      {/* Hint "Sélectionne Blocage pour activer" */}
      <AnimatePresence>
        {anonHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, exit: { duration: 1 } }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <motion.p
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, exit: { duration: 1 } }}
              style={{
                fontSize: 16, fontWeight: 700,
                color: "rgba(255,255,255,0.75)",
                textAlign: "center", padding: "0 32px",
              }}
            >
              Sélectionne Blocage pour activer
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orbs ambiance */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute rounded-full" style={{ width: 340, height: 340, top: -80, right: -60, background: "radial-gradient(circle,rgba(99,102,241,0.04) 0%,transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute rounded-full" style={{ width: 260, height: 260, bottom: 200, left: -40, background: "radial-gradient(circle,rgba(139,92,246,0.03) 0%,transparent 70%)", filter: "blur(36px)" }} />
      </div>

      {/* ── Croix fermer — fixe en haut à droite ── */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => navigate("/")}
        style={{
          position: "fixed", top: "max(20px, calc(env(safe-area-inset-top, 0px) + 12px))", right: 16, zIndex: 500,
          width: 38, height: 38, borderRadius: "50%",
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.14)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <X style={{ width: 18, height: 18, color: "rgba(255,255,255,0.80)", strokeWidth: 2.2 }} />
      </motion.button>

      <div className="relative max-w-md mx-auto px-5" style={{ zIndex: 1 }}>

        {/* ── Retour si post quoté ── */}
        {quotedPost && (
          <div style={{ paddingTop: 56, paddingBottom: 0 }}>
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => navigate(-1)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px 8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "0.5px solid rgba(255,255,255,0.14)", boxShadow: "0 2px 12px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.09)", cursor: "pointer" }}>
              <ArrowLeft style={{ width: 16, height: 16, color: "rgba(255,255,255,0.80)", strokeWidth: 2.2 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>Retour</span>
            </motion.button>
          </div>
        )}

        {/* ── Sélecteur de mode : tab style comme le feed ── */}
        <div
          className={quotedPost ? "mt-6" : "mt-14"}
          style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.07)", marginBottom: 24 }}
        >
          {(["partage", "ways"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: "12px 0",
                background: "transparent", border: "none", cursor: "pointer",
                fontSize: 15, fontWeight: mode === m ? 700 : 400,
                color: "#fff",
                position: "relative",
                opacity: mode === m ? 1 : 0.45,
              }}
            >
              {m === "partage" ? "Post ton partage" : "Post ton Ways"}
              {mode === m && (
                <motion.div
                  layoutId="createModeIndicator"
                  style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "#6366f1", borderRadius: 999 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Mode Ways : même design que Partage ── */}
        {mode === "ways" && (
          <div>
            {/* Textarea — même style que le post */}
            <textarea
              value={waysText}
              onChange={(e) => setWaysText(e.target.value.slice(0, WAYS_MAX))}
              placeholder="Partage quelque chose avec tes abonnés..."
              rows={7}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 17, fontWeight: 400, color: "#f0f0f5", lineHeight: 1.65, letterSpacing: "0.1px", caretColor: "#6366f1", whiteSpace: "pre-wrap", wordWrap: "break-word", overflowWrap: "break-word", wordBreak: "break-word" }}
              className="placeholder:text-[rgba(144,144,168,0.45)]"
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: waysText.length > 900 ? "rgba(251,191,36,0.70)" : "rgba(255,255,255,0.20)", fontWeight: 500 }}>
                {waysText.length}/{WAYS_MAX}
              </span>
            </div>

            {/* Image preview — 3:4 comme les posts */}
            
              {waysImagePreview && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: 6, marginBottom: 14, position: "relative" }}>
                  <div style={{ width: "72%", aspectRatio: "3/4", borderRadius: 14, overflow: "hidden", border: "0.5px solid rgba(255,255,255,0.10)", position: "relative" }}>
                    <img src={waysImagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <motion.button whileTap={{ scale: 0.88 }} onClick={() => { setWaysImageFile(null); setWaysImagePreview(null); }}
                      style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X style={{ width: 13, height: 13, color: "#fff" }} />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            

            {/* Barre d'actions — Photo uniquement */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingBottom: 4 }}>
              <motion.button type="button" whileTap={{ scale: 0.91 }} onClick={() => waysFileInputRef.current?.click()}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer" }}>
                <ImagePlus style={{ width: 16, height: 16, color: "rgba(255,255,255,0.55)" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.50)" }}>{waysImageFile ? "Changer" : "Photo"}</span>
              </motion.button>
              <input ref={waysFileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleWaysImagePick} />
            </div>

            {/* Bouton Publier — même style que Partage */}
            <motion.div className="mt-8 mb-4">
              <motion.button
                type="button"
                onClick={handleWaysSubmit}
                disabled={(!waysText.trim() && !waysImageFile) || waysSubmitting}
                whileTap={(!waysText.trim() && !waysImageFile) || waysSubmitting ? {} : { scale: 0.97 }}
                animate={{
                  background: waysSubmitting ? "#ffffff" : (waysText.trim() || waysImageFile) ? "#111111" : "#0a0a0a",
                  borderColor: waysSubmitting ? "#ffffff" : (waysText.trim() || waysImageFile) ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.10)",
                }}
                transition={{ duration: 0.18 }}
                style={{
                  width: "100%", padding: "16px", borderRadius: 100,
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: (waysText.trim() || waysImageFile) ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.28)",
                  fontSize: 16, fontWeight: 700, cursor: (!waysText.trim() && !waysImageFile) || waysSubmitting ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  letterSpacing: "-0.1px", transition: "color 0.18s ease",
                }}
              >
                {waysSubmitting
                  ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", borderRadius: "50%" }} /></>
                  : "Publier"
                }
              </motion.button>
            </motion.div>
          </div>
        )}

        {/* ── Type de post ── */}
        <motion.div
          className={quotedPost ? "mt-6" : "mt-0"}
          style={{ display: mode === "partage" ? undefined : "none" }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(240,240,245,0.75)" }}>Quel est ton type de post ?</span>
            <TypeTooltip />
          </div>

          <div className="flex flex-wrap gap-2">
            {POST_TYPES.map((type) => {
              const active = selectedType === type;
              return (
                <motion.button key={type} type="button" whileTap={{ scale: 0.95 }}
                  onClick={() => { setSelectedType(active ? "" : type); if (active) setIsAnonymous(false); }}
                  style={{ padding: "7px 15px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease", background: active ? "rgba(99,102,241,0.22)" : "rgba(255,255,255,0.06)", border: active ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.11)", color: active ? "#a5b4fc" : "rgba(240,240,245,0.55)", boxShadow: active ? "0 0 14px rgba(99,102,241,0.25)" : "none" }}>
                  {type}
                </motion.button>
              );
            })}
            {/* Toggle anonyme — toujours visible, actif seulement sur Blocage */}
            <motion.div
              style={{
                display: "flex", alignItems: "center", gap: 9,
                cursor: selectedType === "Blocage" ? "pointer" : "default",
                userSelect: "none",
                opacity: selectedType === "Blocage" ? 1 : 0.35,
                transition: "opacity 0.2s",
              }}
              onClick={() => {
                if (selectedType === "Blocage") {
                  setIsAnonymous((v) => !v);
                } else {
                  setAnonHint(true);
                  setTimeout(() => setAnonHint(false), 2000); // exit animation dure 1s → disparu à 3s
                }
              }}
            >
              {/* Track */}
              <div style={{ width: 46, height: 26, borderRadius: 999, background: isAnonymous && selectedType === "Blocage" ? "#7c3aed" : "rgba(255,255,255,0.10)", border: isAnonymous && selectedType === "Blocage" ? "none" : "1px solid rgba(255,255,255,0.14)", position: "relative", transition: "background 0.22s ease", flexShrink: 0 }}>
                <motion.div
                  animate={{ x: isAnonymous && selectedType === "Blocage" ? 22 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  style={{ position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%", background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.40)" }}
                />
              </div>
              {/* Label */}
              <span style={{ fontSize: 13, fontWeight: 600, color: isAnonymous && selectedType === "Blocage" ? "#c084fc" : "rgba(240,240,245,0.40)", transition: "color 0.2s" }}>
                {isAnonymous && selectedType === "Blocage" ? "Anonyme" : "Non anonyme"}
              </span>
            </motion.div>

          </div>

          
            {selectedType && <TypePreview label={selectedType} />}
          
        </motion.div>

        {/* ── Post quoté ── */}
        {quotedPost && (
          <motion.div className="mt-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.4 }}>
            <div style={{ borderRadius: 16, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.10)", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", border: "1px solid rgba(99,102,241,0.25)", flexShrink: 0 }}>
                  <img src={quotedPost.user.avatar} alt={quotedPost.user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.72)" }}>{quotedPost.user.name}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>· Post original</span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(200,200,220,0.55)", lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                {quotedPost.progress.description}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 2 }}>
              <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.07)" }} />
              <span style={{ fontSize: 11, color: "rgba(144,144,168,0.40)", fontWeight: 600 }}>Votre réponse</span>
              <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.07)" }} />
            </div>
          </motion.div>
        )}

        {/* ── Zone de texte / Vocal / Vidéo (Partage only) ── */}
        <motion.div className="mt-8" style={{ display: mode === "partage" ? undefined : "none" }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4 }}>
          {videoPhase === "recorder" ? (
            // ── Enregistreur vidéo ────────────────────────────────────────────
            <div style={{ margin: "0 -20px" }}>
              <VideoRecorder
                maxSeconds={20}
                idealHeight={720}
                onReady={handleVideoReady}
                onCancel={resetVideo}
              />
            </div>
          ) : videoPhase === "preview" && videoPreviewUrl ? (
            // ── Aperçu vidéo + titre + sous-titre ────────────────────────────
            <div>
              <div style={{ position: "relative", margin: "0 -20px", aspectRatio: "3/4" }}>
                <video
                  src={videoPreviewUrl}
                  controls
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
                />
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={resetVideo}
                  style={{
                    position: "absolute", top: 12, right: 12,
                    width: 30, height: 30, borderRadius: "50%",
                    background: "rgba(0,0,0,0.60)", border: "0.5px solid rgba(255,255,255,0.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", zIndex: 10,
                  }}
                >
                  <X style={{ width: 14, height: 14, color: "#fff" }} />
                </motion.button>
              </div>

              <input
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Titre (obligatoire)"
                maxLength={80}
                style={{ width: "100%", marginTop: 16, background: "transparent", border: "none", outline: "none", fontSize: 19, fontWeight: 700, color: "#f0f0f5", lineHeight: 1.35, letterSpacing: "-0.2px", caretColor: "#6366f1" }}
                className="placeholder:text-[rgba(144,144,168,0.50)]"
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 10.5, color: videoTitle.length > 70 ? "rgba(251,191,36,0.70)" : "rgba(255,255,255,0.18)", fontWeight: 500 }}>
                  {videoTitle.length}/80
                </span>
              </div>

              <textarea
                value={videoSub}
                onChange={(e) => setVideoSub(e.target.value)}
                placeholder="Description (facultatif)"
                maxLength={200}
                rows={3}
                style={{ width: "100%", marginTop: 6, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 14.5, color: "rgba(235,235,245,0.78)", lineHeight: 1.5, caretColor: "#6366f1" }}
                className="placeholder:text-[rgba(144,144,168,0.40)]"
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 10.5, color: videoSub.length > 180 ? "rgba(251,191,36,0.70)" : "rgba(255,255,255,0.18)", fontWeight: 500 }}>
                  {videoSub.length}/200
                </span>
              </div>
            </div>
          ) : voiceMode === "preview" && voicePreviewUrl ? (
            // ── Aperçu vocal + titre + sous-titre ────────────────────────────
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <VoicePlayer url={voicePreviewUrl} duration={voiceDuration} msgId="create-preview" />
                <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={resetVoice}
                  style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(239,68,68,0.14)", border: "0.5px solid rgba(239,68,68,0.32)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <X style={{ width: 14, height: 14, color: "#f87171" }} />
                </motion.button>
              </div>

              <input
                value={voiceTitle}
                onChange={(e) => setVoiceTitle(e.target.value)}
                placeholder="Titre (obligatoire)"
                maxLength={80}
                style={{ width: "100%", marginTop: 16, background: "transparent", border: "none", outline: "none", fontSize: 19, fontWeight: 700, color: "#f0f0f5", lineHeight: 1.35, letterSpacing: "-0.2px", caretColor: "#6366f1" }}
                className="placeholder:text-[rgba(144,144,168,0.50)]"
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 10.5, color: voiceTitle.length > 70 ? "rgba(251,191,36,0.70)" : "rgba(255,255,255,0.18)", fontWeight: 500 }}>
                  {voiceTitle.length}/80
                </span>
              </div>

              <textarea
                value={voiceSubtitle}
                onChange={(e) => setVoiceSubtitle(e.target.value)}
                placeholder="Description (facultatif)"
                maxLength={200}
                rows={3}
                style={{ width: "100%", marginTop: 6, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 14.5, fontWeight: 400, color: "rgba(235,235,245,0.78)", lineHeight: 1.5, caretColor: "#6366f1" }}
                className="placeholder:text-[rgba(144,144,168,0.40)]"
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 10.5, color: voiceSubtitle.length > 180 ? "rgba(251,191,36,0.70)" : "rgba(255,255,255,0.18)", fontWeight: 500 }}>
                  {voiceSubtitle.length}/200
                </span>
              </div>
            </div>
          ) : voiceMode === "recording" ? (
            // ── UI d'enregistrement ──────────────────────────────────────────
            <div style={{ minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "20px 0" }}>
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.42)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Mic style={{ width: 28, height: 28, color: "#f87171" }} />
              </motion.div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f5", letterSpacing: "-0.2px", fontVariantNumeric: "tabular-nums" }}>
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")} <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.30)" }}>/ 1:00</span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
                Relâche pour terminer l'enregistrement
              </div>
            </div>
          ) : (
            // ── Textarea normale ─────────────────────────────────────────────
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Sur quoi tu bosses aujourd'hui ?"
                maxLength={1000}
                rows={7}
                style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 17, fontWeight: 400, color: "#f0f0f5", lineHeight: 1.65, letterSpacing: "0.1px", caretColor: "#6366f1", whiteSpace: "pre-wrap", wordWrap: "break-word", overflowWrap: "break-word", wordBreak: "break-word" }}
                className="placeholder:text-[rgba(144,144,168,0.45)]"
              />

              {/* Compteur de caractères */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                <span style={{ fontSize: 11, color: text.length > 900 ? "rgba(251,191,36,0.70)" : "rgba(255,255,255,0.20)", fontWeight: 500, transition: "color 0.2s" }}>
                  {text.length}/1000
                </span>
              </div>
            </>
          )}

          {/* Hashtags extraits */}
          {voiceMode === "idle" && videoPhase === null && text.trim().length > 0 && extractHashtags(text).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {extractHashtags(text).map((tag) => (
                <span key={tag} style={{ fontSize: 12, color: "rgba(139,92,246,0.70)", fontWeight: 500 }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Aperçu images — carousel horizontal 3:4 (pas de média en mode vocal/vidéo) */}
          {voiceMode === "idle" && videoPhase === null && (
            <>
            {images.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: 14, position: "relative" }}>
                <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", scrollBehavior: "smooth", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}
                  className="[&::-webkit-scrollbar]:hidden">
                  {images.map((img, i) => (
                    <div key={i} style={{ flexShrink: 0, width: "72%", scrollSnapAlign: "start", position: "relative", aspectRatio: "3/4", borderRadius: 14, overflow: "hidden", border: "0.5px solid rgba(255,255,255,0.10)" }}>
                      <img src={img.preview} alt={`Image ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <motion.button whileTap={{ scale: 0.88 }} onClick={() => removeImage(i)}
                        style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X style={{ width: 13, height: 13, color: "#fff" }} />
                      </motion.button>
                      <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "2px 7px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{i + 1}/{images.length}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          

          </>
          )}

          {/* ── Barre d'actions compacte ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, paddingBottom: 4 }}>
            {/* Photo (icon only) */}
            <motion.button type="button" whileTap={{ scale: 0.88 }} onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 4 || voiceMode !== "idle" || videoPhase !== null}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                cursor: (images.length >= 4 || voiceMode !== "idle" || videoPhase !== null) ? "not-allowed" : "pointer",
                opacity: (images.length >= 4 || voiceMode !== "idle" || videoPhase !== null) ? 0.4 : 1,
                flexShrink: 0,
              }}>
              <ImagePlus style={{ width: 17, height: 17, color: "rgba(255,255,255,0.65)" }} />
            </motion.button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImagePick} />

            {/* Mic (press-hold 1.5s) */}
            <motion.button
              type="button"
              onTouchStart={handleMicTouchStart}
              onTouchEnd={handleMicTouchEnd}
              onTouchCancel={handleMicTouchEnd}
              onMouseDown={handleMicMouseDown}
              onMouseUp={handleMicMouseUp}
              onMouseLeave={handleMicMouseUp}
              onContextMenu={(e) => e.preventDefault()}
              disabled={images.length > 0 || voiceMode === "preview" || videoPhase !== null}
              animate={{
                scale: voiceMode === "holding" ? 1.08 : voiceMode === "recording" ? 1.15 : 1,
                background: voiceMode === "recording"
                  ? "rgba(239,68,68,0.28)"
                  : voiceMode === "holding"
                    ? "rgba(99,102,241,0.18)"
                    : "rgba(255,255,255,0.06)",
                borderColor: voiceMode === "recording"
                  ? "rgba(239,68,68,0.55)"
                  : voiceMode === "holding"
                    ? "rgba(99,102,241,0.45)"
                    : "rgba(255,255,255,0.10)",
              }}
              transition={{ duration: 0.18 }}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid",
                cursor: (images.length > 0 || voiceMode === "preview" || videoPhase !== null) ? "not-allowed" : "pointer",
                opacity: (images.length > 0 || voiceMode === "preview" || videoPhase !== null) ? 0.4 : 1,
                flexShrink: 0,
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none" as any,
              }}>
              <Mic style={{ width: 17, height: 17, color: voiceMode === "recording" ? "#f87171" : voiceMode === "holding" ? "#a5b4fc" : "rgba(255,255,255,0.65)" }} />
            </motion.button>

            {/* Vidéo (toggle) */}
            <motion.button
              type="button"
              onClick={() => {
                if (videoPhase === null) { setVideoPhase("recorder"); }
                else if (videoPhase === "recorder") { resetVideo(); }
              }}
              disabled={voiceMode !== "idle" || images.length > 0}
              animate={{
                background: videoPhase !== null ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.06)",
                borderColor: videoPhase !== null ? "rgba(99,102,241,0.45)" : "rgba(255,255,255,0.10)",
              }}
              transition={{ duration: 0.18 }}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid",
                cursor: (voiceMode !== "idle" || images.length > 0) ? "not-allowed" : "pointer",
                opacity: (voiceMode !== "idle" || images.length > 0) ? 0.4 : 1,
                flexShrink: 0,
              }}
            >
              <Video style={{ width: 17, height: 17, color: videoPhase !== null ? "#a5b4fc" : "rgba(255,255,255,0.65)" }} />
            </motion.button>

            <div style={{ flex: 1 }} />

            {/* Publish (compact, violet discret, à droite) */}
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || posted}
              whileTap={isValid && !posted ? { scale: 0.94 } : {}}
              animate={{
                background: posted
                  ? "#ffffff"
                  : isValid
                    ? "rgba(99,102,241,0.85)"
                    : "rgba(99,102,241,0.18)",
                color: posted ? "#4f46e5" : isValid ? "#ffffff" : "rgba(165,180,252,0.40)",
              }}
              transition={{ duration: 0.18 }}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "-0.05px",
                cursor: isValid && !posted ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
              }}>
              {posted ? <><Check style={{ width: 14, height: 14 }} /> Publié</> : "Publier"}
            </motion.button>
          </div>
        </motion.div>

        {/* ── Erreur (Partage only) ── */}
        {mode === "partage" && error && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 16, padding: "12px 16px", borderRadius: 14, background: "rgba(239,68,68,0.10)", border: "0.5px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
              <AlertCircle style={{ width: 16, height: 16, color: "#ef4444", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "rgba(239,68,68,0.90)" }}>{error}</span>
            </motion.div>
        )}

      </div>
    </div>
  );
}