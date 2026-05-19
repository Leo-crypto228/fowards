import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { Camera, Square, RotateCcw, Check, AlertCircle, X } from "lucide-react";

interface VideoRecorderProps {
  maxSeconds: number;
  onReady: (blob: Blob, duration: number) => void;
  onCancel: () => void;
  idealHeight?: number;
}

type RecState = "idle" | "requesting" | "recording" | "preview";

export function VideoRecorder({ maxSeconds, onReady, onCancel, idealHeight = 720 }: VideoRecorderProps) {
  const [recState, setRecState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<number>(0);
  const blobRef = useRef<Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const finalDurRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoRef.current) { clearTimeout(autoRef.current); autoRef.current = null; }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      stopStream();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [clearTimers, stopStream]);

  const startRecording = useCallback(async () => {
    setRecState("requesting");
    setErrorMsg(null);
    try {
      const idealWidth = Math.round(idealHeight * 3 / 4);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: idealWidth }, height: { ideal: idealHeight }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;

      if (liveRef.current) {
        liveRef.current.srcObject = stream;
        liveRef.current.play().catch(() => {});
      }

      const mimeType = (() => {
        for (const t of ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) {
          try { if (MediaRecorder.isTypeSupported(t)) return t; } catch {}
        }
        return "";
      })();

      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        clearTimers();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" });
        stopStream();
        const dur = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
        finalDurRef.current = dur;
        if (blob.size < 1000) {
          setRecState("idle");
          setErrorMsg("Enregistrement trop court, réessaie.");
          return;
        }
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setRecState("preview");
      };

      rec.start(100);
      recRef.current = rec;
      startRef.current = Date.now();
      setRecState("recording");
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 250);

      autoRef.current = setTimeout(() => {
        if (recRef.current?.state !== "inactive") recRef.current?.stop();
      }, maxSeconds * 1000);

    } catch (err: any) {
      setRecState("idle");
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setErrorMsg("Accès caméra refusé. Active-la dans les paramètres du navigateur.");
      } else if (err?.name === "NotFoundError") {
        setErrorMsg("Aucune caméra détectée sur cet appareil.");
      } else {
        setErrorMsg("Impossible d'accéder à la caméra.");
      }
    }
  }, [idealHeight, maxSeconds, clearTimers, stopStream]);

  const stopRecording = useCallback(() => {
    if (recRef.current?.state !== "inactive") recRef.current?.stop();
  }, []);

  const retry = useCallback(() => {
    clearTimers();
    stopStream();
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
    blobRef.current = null;
    finalDurRef.current = 0;
    setElapsed(0);
    setRecState("idle");
  }, [clearTimers, stopStream]);

  const confirm = useCallback(() => {
    if (!blobRef.current) return;
    onReady(blobRef.current, finalDurRef.current);
  }, [onReady]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const pct = Math.min(100, Math.round((elapsed / maxSeconds) * 100));

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "3/4", background: "#060609", overflow: "hidden" }}>
      {/* Live preview */}
      <video
        ref={liveRef}
        muted
        playsInline
        autoPlay
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover",
          display: recState === "recording" ? "block" : "none",
          transform: "scaleX(-1)",
        }}
      />

      {/* Recorded preview */}
      {recState === "preview" && previewUrlRef.current && (
        <video
          src={previewUrlRef.current}
          controls
          playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {/* Overlay */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {recState === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "0 24px", width: "100%" }}>
            {errorMsg && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8, width: "100%",
                padding: "10px 14px", borderRadius: 12,
                background: "rgba(239,68,68,0.15)", border: "0.5px solid rgba(239,68,68,0.35)",
              }}>
                <AlertCircle style={{ width: 14, height: 14, color: "#f87171", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: "rgba(239,68,68,0.90)", lineHeight: 1.4 }}>{errorMsg}</span>
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={startRecording}
              style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "rgba(99,102,241,0.18)", border: "2px solid rgba(99,102,241,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <Camera style={{ width: 30, height: 30, color: "#a5b4fc" }} />
            </motion.button>
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.38)", textAlign: "center" }}>
              Appuie pour démarrer · max {fmt(maxSeconds)}
            </span>
          </div>
        )}

        {recState === "requesting" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ width: 32, height: 32, border: "2px solid rgba(99,102,241,0.30)", borderTopColor: "#a5b4fc", borderRadius: "50%" }}
            />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.42)" }}>Accès caméra…</span>
          </div>
        )}

        {recState === "recording" && (
          <>
            {/* Progress bar */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.10)" }}>
              <motion.div
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.25, ease: "linear" }}
                style={{ height: "100%", background: "#ef4444" }}
              />
            </div>
            {/* Timer */}
            <div style={{ position: "absolute", top: 16, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: "rgba(0,0,0,0.60)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 5px #ef4444" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(elapsed)} / {fmt(maxSeconds)}
                </span>
              </div>
            </div>
            {/* Stop button */}
            <div style={{ position: "absolute", bottom: 28, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
              <motion.button
                whileTap={{ scale: 0.90 }}
                onClick={stopRecording}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "rgba(239,68,68,0.90)", border: "3px solid rgba(255,255,255,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <Square style={{ width: 24, height: 24, color: "#fff", fill: "#fff" }} />
              </motion.button>
            </div>
          </>
        )}

        {recState === "preview" && (
          <div style={{ position: "absolute", bottom: 28, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 12, padding: "0 16px" }}>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={retry}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 16px", borderRadius: 999,
                background: "rgba(0,0,0,0.72)", border: "1px solid rgba(255,255,255,0.22)",
                color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
              }}
            >
              <RotateCcw style={{ width: 14, height: 14 }} />
              Recommencer
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={confirm}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 16px", borderRadius: 999,
                background: "rgba(99,102,241,0.90)", border: "none",
                color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Check style={{ width: 14, height: 14 }} />
              Utiliser
            </motion.button>
          </div>
        )}
      </div>

      {/* Cancel button (hidden during recording) */}
      {recState !== "recording" && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onCancel}
          style={{
            position: "absolute", top: 14, right: 14,
            width: 30, height: 30, borderRadius: "50%",
            background: "rgba(0,0,0,0.60)", border: "0.5px solid rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 10,
          }}
        >
          <X style={{ width: 14, height: 14, color: "#fff" }} />
        </motion.button>
      )}
    </div>
  );
}
