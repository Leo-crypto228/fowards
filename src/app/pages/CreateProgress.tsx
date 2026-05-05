import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ArrowLeft, AlertCircle, X, ImagePlus, ChevronDown, Globe, Users, Info } from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { createPost, extractHashtags, LABEL_TO_TYPE, PostType } from "../api/postsApi";
import { linkPostReply } from "../api/sharesApi";
import { postCheckin } from "../api/progressionApi";
import { MY_USER_ID, MY_USER_NAME, MY_USER_AVATAR, MY_USER_OBJECTIVE, MY_USER_STREAK } from "../api/authStore";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { GifPicker, GifMessage } from "../components/GifPicker";
import { toast } from "sonner";

const BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

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

const AUDIENCE_OPTIONS = [
  { id: "everyone",  label: "Pour tous le monde",                   icon: Globe },
  { id: "relations", label: "Relations et communauté(s) seulement", icon: Users },
];

// ── Badge preview ─────────────────────────────────────────────────────────────
function TypePreview({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 4 }}
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

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.95 }}
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
      </AnimatePresence>
    </div>
  );
}

export function CreateProgress() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const quotedPost = location.state?.quotedPost ?? null;

  const [selectedType, setSelectedType] = useState<string>("");
  const [text, setText]                 = useState("");
  const [posted, setPosted]             = useState(false); // optimistic: posted instantly
  const [error, setError]               = useState<string | null>(null);

  // Images
  const [images, setImages]         = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  // GIF
  const [gifOpen, setGifOpen]       = useState(false);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);

  // Audience
  const [audience, setAudience]           = useState<"everyone" | "relations">("everyone");
  const [showAudienceMenu, setShowAudienceMenu] = useState(false);
  const audienceRef                       = useRef<HTMLDivElement>(null);
  const audienceSaveTimeout               = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charger la préférence d'audience
  useEffect(() => {
    if (!MY_USER_ID) return;
    fetch(`${BASE}/user-prefs/${MY_USER_ID}`, { headers: HEADERS })
      .then((r) => r.json())
      .then((data) => { if (data?.prefs?.audience) setAudience(data.prefs.audience); })
      .catch((e) => console.error("Erreur chargement user-prefs:", e));
  }, []);

  const saveAudience = (value: "everyone" | "relations") => {
    if (audienceSaveTimeout.current) clearTimeout(audienceSaveTimeout.current);
    audienceSaveTimeout.current = setTimeout(() => {
      if (!MY_USER_ID) return;
      fetch(`${BASE}/user-prefs/${MY_USER_ID}`, { method: "POST", headers: HEADERS, body: JSON.stringify({ audience: value }) })
        .catch((e) => console.error("Erreur sauvegarde user-prefs:", e));
    }, 600);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (audienceRef.current && !audienceRef.current.contains(e.target as Node)) setShowAudienceMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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

  const isValid = text.trim().length > 0 && selectedType !== "";

  const handleSubmit = () => {
    if (!isValid || posted) return;
    setError(null);

    // ── Optimistic UI : on marque comme posté IMMÉDIATEMENT ─────────────────
    setPosted(true);

    // Naviguer vers le feed immédiatement
    navigate("/", { state: { refreshPosts: true } });

    // ── Enregistrement en background (Supabase) ──────────────────────────────
    const doSave = async () => {
      try {
        const postType = LABEL_TO_TYPE[selectedType] as PostType;
        const hashtags = extractHashtags(text);

        // Upload image si présente
        let uploadedImageUrl: string | undefined;
        if (images.length > 0) {
          const formData = new FormData();
          formData.append("file", images[0].file);
          const upRes  = await fetch(`${BASE}/upload-image`, { method: "POST", headers: { Authorization: `Bearer ${publicAnonKey}` }, body: formData });
          const upData = await upRes.json();
          if (!upRes.ok || !upData.url) throw new Error(upData.error ?? "Erreur upload image");
          uploadedImageUrl = upData.url;
        }

        const result = await createPost({
          user:     { name: MY_USER_NAME || "Utilisateur", avatar: MY_USER_AVATAR, objective: MY_USER_OBJECTIVE, followers: 0 },
          streak:   MY_USER_STREAK,
          progress: { type: postType, description: text.trim() },
          hashtags,
          username: MY_USER_ID,
          image:    uploadedImageUrl ?? selectedGif ?? undefined,
        });

        // Lien réponse si post quoté
        if (quotedPost?.postId) {
          linkPostReply(quotedPost.postId, result.post.id).catch((e) => console.error("Erreur liaison post-réponse:", e));
        }

        // Checkin progression
        postCheckin(MY_USER_ID, result.post.id).catch((e) => console.error("Erreur post-checkin:", e));

      } catch (err) {
        console.error("Erreur save post background:", err);
        // Toast d'erreur discret (l'utilisateur est déjà sur le feed)
        toast.error("Le post n'a pas pu être enregistré", { description: err instanceof Error ? err.message : "Réessaie", duration: 4000 });
      }
    };

    doSave();
  };

  return (
    <div className="min-h-screen" style={{ background: "#000000" }}>
      {/* Orbs ambiance */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute rounded-full" style={{ width: 340, height: 340, top: -80, right: -60, background: "radial-gradient(circle,rgba(99,102,241,0.04) 0%,transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute rounded-full" style={{ width: 260, height: 260, bottom: 200, left: -40, background: "radial-gradient(circle,rgba(139,92,246,0.03) 0%,transparent 70%)", filter: "blur(36px)" }} />
      </div>

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

        {/* ── Type de post ── */}
        <motion.div
          className={quotedPost ? "mt-6" : "mt-14"}
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
                  onClick={() => setSelectedType(active ? "" : type)}
                  style={{ padding: "7px 15px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease", background: active ? "rgba(99,102,241,0.22)" : "rgba(255,255,255,0.06)", border: active ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.11)", color: active ? "#a5b4fc" : "rgba(240,240,245,0.55)", boxShadow: active ? "0 0 14px rgba(99,102,241,0.25)" : "none" }}>
                  {type}
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence>
            {selectedType && <TypePreview label={selectedType} />}
          </AnimatePresence>
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

        {/* ── Zone de texte ── */}
        <motion.div className="mt-8" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4 }}>
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

          {/* Hashtags extraits */}
          {text.trim().length > 0 && extractHashtags(text).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {extractHashtags(text).map((tag) => (
                <span key={tag} style={{ fontSize: 12, color: "rgba(139,92,246,0.70)", fontWeight: 500 }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Aperçu images */}
          <AnimatePresence>
            {images.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                style={{ display: "grid", gridTemplateColumns: images.length === 1 ? "1fr" : "1fr 1fr", gap: 8, marginTop: 14, borderRadius: 16, overflow: "hidden" }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: "relative", aspectRatio: images.length === 1 ? "16/9" : "1/1" }}>
                    <img src={img.preview} alt={`Image ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
                    <motion.button whileTap={{ scale: 0.88 }} onClick={() => removeImage(i)}
                      style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X style={{ width: 12, height: 12, color: "#fff" }} />
                    </motion.button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Aperçu GIF */}
          <AnimatePresence>
            {selectedGif && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} style={{ marginTop: 14, position: "relative", display: "inline-block" }}>
                <GifMessage url={selectedGif} />
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => setSelectedGif(null)}
                  style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X style={{ width: 12, height: 12, color: "#fff" }} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Barre d'actions ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, paddingBottom: 4 }}>
            {/* Photo */}
            <motion.button type="button" whileTap={{ scale: 0.91 }} onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 4}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: images.length >= 4 ? "not-allowed" : "pointer", opacity: images.length >= 4 ? 0.4 : 1 }}>
              <ImagePlus style={{ width: 16, height: 16, color: "rgba(255,255,255,0.55)" }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.50)" }}>{images.length > 0 ? `${images.length}/4` : "Photo"}</span>
            </motion.button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: "none" }} onChange={handleImagePick} />

            {/* GIF */}
            <motion.button type="button" whileTap={{ scale: 0.91 }} onClick={() => setGifOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "7px 11px", borderRadius: 999, background: selectedGif ? "rgba(99,102,241,0.14)" : "rgba(255,255,255,0.06)", border: selectedGif ? "1px solid rgba(99,102,241,0.38)" : "1px solid rgba(255,255,255,0.10)", cursor: "pointer" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: selectedGif ? "#a5b4fc" : "rgba(255,255,255,0.50)", letterSpacing: "0.04em" }}>GIF</span>
            </motion.button>

            {/* Audience */}
            <div ref={audienceRef} style={{ position: "relative" }}>
              <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => setShowAudienceMenu((v) => !v)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer" }}>
                {audience === "everyone"
                  ? <Globe style={{ width: 13, height: 13, color: "rgba(255,255,255,0.55)" }} />
                  : <Users style={{ width: 13, height: 13, color: "rgba(255,255,255,0.55)" }} />
                }
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.72)", whiteSpace: "nowrap" }}>
                  {audience === "everyone" ? "Pour tous le monde" : "Relations et communauté(s)"}
                </span>
                <motion.div animate={{ rotate: showAudienceMenu ? 180 : 0 }} transition={{ duration: 0.18 }}>
                  <ChevronDown style={{ width: 13, height: 13, color: "rgba(255,255,255,0.40)" }} />
                </motion.div>
              </motion.button>

              <AnimatePresence>
                {showAudienceMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: [0.25, 0, 0.35, 1] }}
                    style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, minWidth: 260, background: "rgba(18,18,22,0.96)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.55)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", overflow: "hidden", zIndex: 100 }}
                  >
                    {AUDIENCE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = audience === opt.id;
                      return (
                        <motion.button key={opt.id} type="button" whileTap={{ scale: 0.98 }}
                          onClick={() => { setAudience(opt.id as "everyone" | "relations"); setShowAudienceMenu(false); saveAudience(opt.id as "everyone" | "relations"); }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "12px 16px", background: isSelected ? "rgba(255,255,255,0.06)" : "transparent", border: "none", cursor: "pointer", textAlign: "left", borderBottom: opt.id === "everyone" ? "1px solid rgba(255,255,255,0.07)" : "none", transition: "background 0.15s" }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: isSelected ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.07)", border: isSelected ? "1px solid rgba(99,102,241,0.30)" : "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon style={{ width: 14, height: 14, color: isSelected ? "#a5b4fc" : "rgba(255,255,255,0.50)" }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? "rgba(240,240,245,0.92)" : "rgba(255,255,255,0.65)", lineHeight: 1.35 }}>{opt.label}</span>
                          {isSelected && <div style={{ marginLeft: "auto" }}><Check style={{ width: 14, height: 14, color: "#a5b4fc" }} /></div>}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ── Erreur ── */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              style={{ marginTop: 16, padding: "12px 16px", borderRadius: 14, background: "rgba(239,68,68,0.10)", border: "0.5px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
              <AlertCircle style={{ width: 16, height: 16, color: "#ef4444", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "rgba(239,68,68,0.90)" }}>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bouton Publier — inline, au-dessus de la zone de nav ── */}
        <motion.div
          className="mt-8 mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.4 }}
        >
          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || posted}
            whileTap={isValid && !posted ? { scale: 0.97 } : {}}
            animate={{
              background: posted ? "#ffffff" : isValid ? "#111111" : "#0a0a0a",
              borderColor: posted ? "#ffffff" : isValid ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.10)",
            }}
            transition={{ duration: 0.18 }}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 100,
              border: "1px solid rgba(255,255,255,0.10)",
              color: posted ? "#ffffff" : isValid ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.28)",
              fontSize: 16,
              fontWeight: 700,
              cursor: isValid && !posted ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              letterSpacing: "-0.1px",
              transition: "color 0.18s ease",
            }}
          >
            {posted
              ? <><Check style={{ width: 18, height: 18 }} /> Publié !</>
              : "Publier"
            }
          </motion.button>
        </motion.div>

        {/* GIF Picker */}
        <GifPicker isOpen={gifOpen} onClose={() => setGifOpen(false)} onSelect={(url) => { setSelectedGif(url); setGifOpen(false); }} />
      </div>
    </div>
  );
}