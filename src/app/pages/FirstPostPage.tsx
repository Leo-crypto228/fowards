import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check, Loader2, X, ImagePlus, Info,
} from "lucide-react";
import { useNavigate } from "react-router";
import { createPost, extractHashtags, LABEL_TO_TYPE, PostType } from "../api/postsApi";
import { postCheckin } from "../api/progressionApi";
import { useAuth } from "../context/AuthContext";
import { MY_USER_ID, MY_USER_NAME, MY_USER_AVATAR, MY_USER_OBJECTIVE, MY_USER_STREAK } from "../api/authStore";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { GifPicker, GifMessage } from "../components/GifPicker";

const BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

const POST_TYPES = ["Avancée", "Question", "Blocage", "Conseil(s)", "Actus"];

const POST_TYPE_INFO: Record<string, { emoji: string }> = {
  "Avancée":    { emoji: "" },
  "Question":   { emoji: "" },
  "Blocage":    { emoji: "" },
  "Conseil(s)": { emoji: "" },
  "Actus":      { emoji: "" },
};

const SUGGESTIONS = [
  "Partage ce que tu construis aujourd'hui",
  "Pose une question",
  "Montre tes avancées",
  "Demande un avis",
  "Partage une victoire (même petite)",
];

// ── Floating stars ────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.8 + 0.4,
  opacity: Math.random() * 0.4 + 0.06,
  delay: Math.random() * 4,
  dur: Math.random() * 3 + 2,
}));

function StarField() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      {STARS.map((s) => (
        <motion.div
          key={s.id}
          style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, borderRadius: "50%", background: "white", opacity: s.opacity }}
          animate={{ opacity: [s.opacity, s.opacity * 0.25, s.opacity] }}
          transition={{ repeat: Infinity, duration: s.dur, delay: s.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function SuggestionsTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.90 }}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 20, height: 20, borderRadius: "50%",
          background: open ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.08)",
          border: open ? "1px solid rgba(99,102,241,0.40)" : "1px solid rgba(255,255,255,0.15)",
          cursor: "pointer",
        }}
      >
        <Info style={{ width: 11, height: 11, color: open ? "#a5b4fc" : "rgba(255,255,255,0.40)", strokeWidth: 2.2 }} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
              zIndex: 200, background: "rgba(14,14,22,0.98)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
              borderRadius: 14, border: "0.5px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
              padding: "12px 14px", minWidth: 220,
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(165,180,252,0.80)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Tu peux y poster
            </p>
            {SUGGESTIONS.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: i < SUGGESTIONS.length - 1 ? 6 : 0 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.20)", marginTop: 1 }}>·</span>
                <span style={{ fontSize: 13, color: "rgba(235,235,245,0.72)", lineHeight: 1.4 }}>{s}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function FirstPostPage() {
  const navigate = useNavigate();
  const { updateLocalUser } = useAuth();

  // Step: "landing" → show intro, "create" → show form
  const [step, setStep] = useState<"landing" | "create">("landing");

  // Form state
  const [selectedType, setSelectedType] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Images
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GIF
  const [gifOpen, setGifOpen]         = useState(false);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);

  const isValid = text.trim().length > 0 && selectedType !== "";

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const valid: File[] = [];
    for (const f of files.slice(0, 4 - images.length)) {
      if (!ALLOWED.includes(f.type)) { continue; } // silently skip invalid
      if (f.size > 5 * 1024 * 1024) { continue; }
      valid.push(f);
    }
    const next = valid.map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
    setImages((prev) => [...prev, ...next]);
    e.target.value = "";
  };

  const removeImage = (i: number) => {
    setImages((prev) => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, j) => j !== i); });
  };

  // Mark firstPostCreated in Supabase KV
  const markFirstPostDone = async () => {
    if (!MY_USER_ID) return;
    try {
      await fetch(`${BASE}/profiles/${encodeURIComponent(MY_USER_ID)}`, {
        method: "PUT",
        headers: HEADERS,
        body: JSON.stringify({ firstPostCreated: true }),
      });
      updateLocalUser({ firstPostCreated: true });
    } catch (err) {
      console.error("Erreur marquage firstPostCreated:", err);
    }
  };

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setError(null);
    setLoading(true);

    try {
      const postType = LABEL_TO_TYPE[selectedType] as PostType;
      const hashtags = extractHashtags(text);

      let uploadedImageUrl: string | undefined;
      if (images.length > 0) {
        const formData = new FormData();
        formData.append("file", images[0].file);
        const upRes = await fetch(`${BASE}/upload-image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          body: formData,
        });
        const upData = await upRes.json();
        if (!upRes.ok || !upData.url) throw new Error(upData.error ?? "Erreur upload image");
        uploadedImageUrl = upData.url;
      }

      const result = await createPost({
        user: { name: MY_USER_NAME || "Utilisateur", avatar: MY_USER_AVATAR, objective: MY_USER_OBJECTIVE, followers: 0 },
        streak: MY_USER_STREAK,
        progress: { type: postType, description: text.trim() },
        hashtags,
        username: MY_USER_ID,
        image: uploadedImageUrl ?? selectedGif ?? undefined,
      });

      // Checkin progression
      postCheckin(MY_USER_ID, result.post.id).catch((err) =>
        console.error("Erreur post-checkin progression:", err)
      );

      // Mark first post done in KV + local state
      await markFirstPostDone();

      setSuccess(true);

      // Redirect to feed after short delay
      setTimeout(() => navigate("/", { replace: true, state: { refreshPosts: true } }), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue";
      console.error("Erreur premier post:", err);
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#050508", position: "relative", overflowX: "hidden" }}>
      <StarField />

      {/* Violet glow */}
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "80%", height: 320, background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.14) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>

        <AnimatePresence mode="wait">

          {/* ── STEP 1 : Landing ── */}
          {step === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.25, 0, 0.35, 1] }}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", textAlign: "center", maxWidth: 420, margin: "0 auto", width: "100%" }}
            >
              {/* Icone */}
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.30)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28, fontSize: 32 }}
              >
                ✍️
              </motion.div>

              {/* Titre */}
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.45 }}
                style={{ fontSize: 24, fontWeight: 800, color: "#f0f0f5", letterSpacing: "-0.5px", lineHeight: 1.25, margin: "0 0 14px" }}
              >
                Avant d'accéder à l'app,
                <br />
                <span style={{ color: "#a5b4fc" }}>crée ton premier post.</span>
              </motion.h1>

              {/* Sous-titre */}
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.4 }}
                style={{ fontSize: 15, color: "rgba(200,200,220,0.60)", lineHeight: 1.55, margin: "0 0 28px", maxWidth: 320 }}
              >
                FuturFeed c'est une communauté d'action. Pose ta première pierre.
              </motion.p>

              {/* Suggestions */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.30, duration: 0.4 }}
                style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 18, padding: "18px 20px", marginBottom: 32, width: "100%", textAlign: "left" }}
              >
                {SUGGESTIONS.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < SUGGESTIONS.length - 1 ? 11 : 0 }}>
                    <span style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>
                      {["🚀", "❓", "📈", "💬", "🏆"][i]}
                    </span>
                    <span style={{ fontSize: 14, color: "rgba(235,235,245,0.72)", lineHeight: 1.45 }}>{s}</span>
                  </div>
                ))}
              </motion.div>

              {/* Bouton */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38, duration: 0.4 }}
                style={{ width: "100%" }}
              >
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setStep("create")}
                  style={{
                    width: "100%", padding: "17px 28px", borderRadius: 100,
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none", color: "#fff",
                    fontSize: 17, fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 24px rgba(99,102,241,0.40)",
                    letterSpacing: "-0.1px",
                  }}
                >
                  J'ai compris 👊
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {/* ── STEP 2 : Create form ── */}
          {step === "create" && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.25, 0, 0.35, 1] }}
              style={{ flex: 1, paddingBottom: 120 }}
            >
              <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 20px" }}>

                {/* Header */}
                <div style={{ paddingTop: 56, paddingBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(99,102,241,0.50)", boxShadow: "0 0 12px rgba(99,102,241,0.28)", flexShrink: 0 }}>
                      <img src={MY_USER_AVATAR} alt="Mon profil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#f0f0f5", letterSpacing: "-0.3px" }}>
                        {MY_USER_NAME.split(" ")[0]}, c'est parti 🔥
                      </div>
                      <div style={{ fontSize: 13, color: "rgba(144,144,168,0.65)" }}>Ton premier post sur FuturFeed</div>
                    </div>
                  </div>
                </div>

                {/* Sélecteur de type */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(240,240,245,0.75)" }}>
                      Quel est ton type de post ?
                    </span>
                    <SuggestionsTooltip />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {POST_TYPES.map((type) => {
                      const active = selectedType === type;
                      return (
                        <motion.button
                          key={type}
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedType(active ? "" : type)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                            background: active ? "rgba(99,102,241,0.22)" : "rgba(255,255,255,0.06)",
                            border: active ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.11)",
                            color: active ? "#a5b4fc" : "rgba(240,240,245,0.55)",
                            boxShadow: active ? "0 0 14px rgba(99,102,241,0.25)" : "none",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {type}
                        </motion.button>
                      );
                    })}
                  </div>
                  {/* Badge preview */}
                  <AnimatePresence>
                    {selectedType && (
                      <motion.div initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                        <span style={{ fontSize: 12, color: "rgba(144,144,168,0.55)", fontWeight: 500 }}>Apparaîtra comme :</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 12px", borderRadius: 999, background: "rgba(255,255,255,0.90)", color: "#111", fontWeight: 600, fontSize: 12 }}>
                          {selectedType}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Zone texte */}
                <div style={{ marginBottom: 16 }}>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Sur quoi tu bosses aujourd'hui ?"
                    maxLength={500}
                    rows={6}
                    disabled={loading}
                    style={{
                      width: "100%", background: "transparent", border: "none", outline: "none",
                      resize: "none", fontSize: 17, fontWeight: 400, color: "#f0f0f5",
                      lineHeight: 1.65, caretColor: "#6366f1", opacity: loading ? 0.5 : 1,
                      whiteSpace: "pre-wrap", wordWrap: "break-word", overflowWrap: "break-word", wordBreak: "break-word",
                    }}
                    className="placeholder:text-[rgba(144,144,168,0.45)]"
                  />
                  {/* Hashtags */}
                  {text.trim().length > 0 && extractHashtags(text).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {extractHashtags(text).map((tag) => (
                        <span key={tag} style={{ fontSize: 12, color: "rgba(139,92,246,0.70)", fontWeight: 500 }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aperçu images */}
                <AnimatePresence>
                  {images.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ display: "grid", gridTemplateColumns: images.length === 1 ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 14 }}>
                      {images.map((img, i) => (
                        <div key={i} style={{ position: "relative", aspectRatio: images.length === 1 ? "16/9" : "1/1" }}>
                          <img src={img.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
                          <button onClick={() => removeImage(i)} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X style={{ width: 12, height: 12, color: "#fff" }} />
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Aperçu GIF */}
                <AnimatePresence>
                  {selectedGif && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ marginBottom: 14, position: "relative", display: "inline-block" }}>
                      <GifMessage url={selectedGif} />
                      <button onClick={() => setSelectedGif(null)} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X style={{ width: 12, height: 12, color: "#fff" }} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Barre d'actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "0.5px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
                  <motion.button type="button" whileTap={{ scale: 0.91 }} onClick={() => fileInputRef.current?.click()}
                    disabled={images.length >= 4 || loading}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: images.length >= 4 ? "not-allowed" : "pointer", opacity: images.length >= 4 ? 0.4 : 1 }}>
                    <ImagePlus style={{ width: 16, height: 16, color: "rgba(255,255,255,0.55)" }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.50)" }}>{images.length > 0 ? `${images.length}/4` : "Photo"}</span>
                  </motion.button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: "none" }} onChange={handleImagePick} />

                  <motion.button type="button" whileTap={{ scale: 0.91 }} onClick={() => setGifOpen(true)} disabled={loading}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "7px 11px", borderRadius: 999, background: selectedGif ? "rgba(99,102,241,0.14)" : "rgba(255,255,255,0.06)", border: selectedGif ? "1px solid rgba(99,102,241,0.38)" : "1px solid rgba(255,255,255,0.10)", cursor: "pointer" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: selectedGif ? "#a5b4fc" : "rgba(255,255,255,0.50)", letterSpacing: "0.04em" }}>GIF</span>
                  </motion.button>
                </div>

                {/* Erreur */}
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ marginTop: 14, padding: "11px 14px", borderRadius: 12, background: "rgba(239,68,68,0.10)", border: "0.5px solid rgba(239,68,68,0.25)", fontSize: 13, color: "rgba(239,68,68,0.90)" }}>
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Succès */}
                <AnimatePresence>
                  {success && (
                    <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      style={{ marginTop: 14, padding: "14px 18px", borderRadius: 16, background: "rgba(34,197,94,0.12)", border: "0.5px solid rgba(34,197,94,0.30)", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(34,197,94,0.20)", border: "1px solid rgba(34,197,94,0.40)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Check style={{ width: 13, height: 13, color: "#4ade80" }} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#4ade80" }}>Premier post publié ! Bienvenue 🎉</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* GIF Picker */}
              <GifPicker isOpen={gifOpen} onClose={() => setGifOpen(false)} onSelect={(url) => { setSelectedGif(url); setGifOpen(false); }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bouton publier sticky — visible uniquement en mode create ── */}
        <AnimatePresence>
          {step === "create" && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
                padding: "12px 20px",
                paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
                background: "linear-gradient(to top, rgba(5,5,8,0.97) 0%, rgba(5,5,8,0.70) 100%)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <div style={{ maxWidth: 420, margin: "0 auto" }}>
                <motion.button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isValid || loading || success}
                  whileTap={isValid && !loading ? { scale: 0.97 } : {}}
                  style={{
                    width: "100%", padding: "16px", borderRadius: 100,
                    background: isValid && !loading && !success
                      ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                      : success
                      ? "rgba(34,197,94,0.25)"
                      : "rgba(99,102,241,0.25)",
                    border: "none",
                    color: isValid && !loading ? "#fff" : "rgba(255,255,255,0.35)",
                    fontSize: 16, fontWeight: 700,
                    cursor: isValid && !loading && !success ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: isValid && !loading && !success ? "0 4px 24px rgba(99,102,241,0.40)" : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  {success
                    ? <><Check style={{ width: 18, height: 18, color: "#4ade80" }} /> Publié !</>
                    : loading
                    ? <><Loader2 style={{ width: 18, height: 18, animation: "spin 0.9s linear infinite" }} /> Publication…</>
                    : "Publier mon premier post"
                  }
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}