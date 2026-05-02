import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ArrowLeft, Loader2, AlertCircle, X, ImagePlus } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { extractHashtags, LABEL_TO_TYPE, type PostType } from "../api/postsApi";
import { useAuth } from "../context/AuthContext";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

const POST_TYPES = [
  "Infos perso", "Conseil(s)", "New", "Avancement",
  "Objectif", "Leçon", "Question", "Bilan",
];

function TypePreview({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 4 }}
      transition={{ duration: 0.18 }}
      style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}
    >
      <span style={{ fontSize: 12, color: "rgba(144,144,168,0.55)", fontWeight: 500 }}>
        Apparaîtra comme :
      </span>
      <span style={{
        display: "inline-flex", alignItems: "center",
        padding: "3px 12px", borderRadius: 999,
        background: "rgba(255,255,255,0.90)", color: "#111",
        fontWeight: 600, fontSize: 12, letterSpacing: "0.01em",
      }}>
        {label}
      </span>
    </motion.div>
  );
}

export function CreateCommunityPost() {
  const navigate = useNavigate();
  const { id: communityId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [selectedType, setSelectedType] = useState("");
  const [text, setText]                 = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [showSuccess, setShowSuccess]   = useState(false);

  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef        = useRef<HTMLInputElement>(null);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const valid: File[] = [];
    for (const f of files.slice(0, 4 - images.length)) {
      if (!ALLOWED.includes(f.type)) { alert(`Format non autorisé (${f.type}). Acceptés : JPG, PNG, WEBP.`); continue; }
      if (f.size > 5 * 1024 * 1024) { alert(`Image trop volumineuse (${(f.size/1024/1024).toFixed(1)} MB). Max : 5 MB.`); continue; }
      valid.push(f);
    }
    const next  = valid.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setImages(prev => [...prev, ...next]);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const isValid = text.trim().length > 0 && selectedType !== "";

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    if (!user) { setError("Tu dois être connecté."); return; }
    if (!communityId) { setError("Communauté introuvable."); return; }

    setError(null);
    setLoading(true);

    try {
      // Upload image si présente
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

      const postType = LABEL_TO_TYPE[selectedType] as PostType;
      const hashtags = extractHashtags(text);

      // Même format payload que CreateProgress → POST /posts
      const res = await fetch(`${BASE}/communities/${communityId}/posts`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
          user: {
            name:      user.name      || "Utilisateur",
            avatar:    user.avatar    || "",
            objective: user.objective || "",
            followers: 0,
          },
          streak:   user.streak || 0,
          progress: {
            type:        postType,
            description: text.trim(),
          },
          hashtags,
          username: user.username || user.supabaseId,
          image:    uploadedImageUrl ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Erreur serveur");

      setShowSuccess(true);
      setTimeout(() => {
        navigate(`/tribes/${communityId}`, {
          replace: true,
          state: { openTab: "progress", refresh: Date.now() },
        });
      }, 1400);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue";
      console.error("Erreur création post communauté:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.name?.split(" ")[0] || "toi";

  return (
    <div className="min-h-screen pb-32" style={{ background: "#000000" }}>
      {/* Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute rounded-full" style={{
          width: 340, height: 340, top: -80, right: -60,
          background: "radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)",
          filter: "blur(40px)",
        }} />
        <div className="absolute rounded-full" style={{
          width: 260, height: 260, bottom: 200, left: -40,
          background: "radial-gradient(circle,rgba(139,92,246,0.04) 0%,transparent 70%)",
          filter: "blur(36px)",
        }} />
      </div>

      <div className="relative max-w-md mx-auto px-5" style={{ zIndex: 1 }}>
        {/* Retour */}
        <div style={{ paddingTop: 56 }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate(-1)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 16px 8px 12px", borderRadius: 999,
              background: "rgba(255,255,255,0.08)", backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "0.5px solid rgba(255,255,255,0.14)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.09)",
              cursor: "pointer",
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16, color: "rgba(255,255,255,0.80)", strokeWidth: 2.2 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>Retour</span>
          </motion.button>
        </div>

        {/* Avatar */}
        <motion.div className="pt-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <div className="rounded-full overflow-hidden" style={{
            width: 46, height: 46,
            border: "2px solid rgba(99,102,241,0.50)",
            boxShadow: "0 0 14px rgba(99,102,241,0.28)",
          }}>
            {user?.avatar
              ? <img src={user.avatar} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{
                  width: "100%", height: "100%",
                  background: "linear-gradient(135deg,#4f46e5,#818cf8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    {(user?.name || "U").slice(0, 2).toUpperCase()}
                  </span>
                </div>
            }
          </div>
        </motion.div>

        {/* Titre */}
        <motion.div
          className="mt-7 text-center"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f0f0f5", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
            Hey {firstName} 👋
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f0f5", letterSpacing: "-0.4px", lineHeight: 1.2, marginBottom: 10 }}>
            Publie dans les Actus
          </div>
          <div style={{ fontSize: 15, color: "rgba(144,144,168,0.80)", fontWeight: 400 }}>
            Partage ton avancement dans la communauté.
          </div>
        </motion.div>

        {/* Type de post */}
        <motion.div
          className="mt-9"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.5 }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(240,240,245,0.60)", marginBottom: 12 }}>
            Type de post
          </div>
          <div className="flex flex-wrap gap-2">
            {POST_TYPES.map(type => {
              const active = selectedType === type;
              return (
                <motion.button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(active ? "" : type)}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    padding: "7px 15px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.18s ease",
                    background: active ? "rgba(99,102,241,0.22)" : "rgba(255,255,255,0.06)",
                    border: active ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.10)",
                    color: active ? "#a5b4fc" : "rgba(240,240,245,0.50)",
                    boxShadow: active ? "0 0 14px rgba(99,102,241,0.25)" : "none",
                  }}
                >
                  {type}
                </motion.button>
              );
            })}
          </div>
          <AnimatePresence>
            {selectedType && <TypePreview label={selectedType} />}
          </AnimatePresence>
        </motion.div>

        {/* Zone de texte */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.5 }}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: "16px 18px",
          }}
        >
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Partage ton avancement... utilise #hashtag pour catégoriser"
            maxLength={500}
            rows={6}
            disabled={loading}
            style={{
              width: "100%", background: "transparent", border: "none",
              outline: "none", resize: "none", fontSize: 16, fontWeight: 400,
              color: "#f0f0f5", lineHeight: 1.7, letterSpacing: "0.1px",
              caretColor: "#6366f1", opacity: loading ? 0.5 : 1,
            }}
            className="placeholder:text-[rgba(144,144,168,0.40)]"
          />

          {text.trim().length > 0 && extractHashtags(text).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {extractHashtags(text).map(tag => (
                <span key={tag} style={{ fontSize: 12, color: "rgba(139,92,246,0.75)", fontWeight: 500 }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Aperçu images */}
          <AnimatePresence>
            {images.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  display: "grid",
                  gridTemplateColumns: images.length === 1 ? "1fr" : "1fr 1fr",
                  gap: 8, marginTop: 14, borderRadius: 12, overflow: "hidden",
                }}
              >
                {images.map((img, i) => (
                  <div key={i} style={{ position: "relative", aspectRatio: images.length === 1 ? "16/9" : "1/1" }}>
                    <img src={img.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => removeImage(i)}
                      style={{
                        position: "absolute", top: 6, right: 6,
                        width: 24, height: 24, borderRadius: "50%",
                        background: "rgba(0,0,0,0.70)", backdropFilter: "blur(8px)",
                        border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <X style={{ width: 12, height: 12, color: "#fff" }} />
                    </motion.button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions barre */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.91 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 4 || loading}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 999,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: images.length >= 4 || loading ? "not-allowed" : "pointer",
                opacity: images.length >= 4 ? 0.4 : 1,
              }}
            >
              <ImagePlus style={{ width: 15, height: 15, color: "rgba(255,255,255,0.45)" }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.40)" }}>
                {images.length > 0 ? `${images.length}/4 photo${images.length > 1 ? "s" : ""}` : "Photo"}
              </span>
            </motion.button>
            <span style={{ fontSize: 12, color: text.length > 450 ? "rgba(251,113,133,0.70)" : "rgba(144,144,168,0.40)" }}>
              {text.length}/500
            </span>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: "none" }} onChange={handleImagePick} />
        </motion.div>

        {/* Erreur */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 14,
                background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)",
                display: "flex", alignItems: "flex-start", gap: 10,
              }}
            >
              <AlertCircle style={{ width: 16, height: 16, color: "#f87171", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: "#fca5a5", lineHeight: 1.45, flex: 1 }}>{error}</span>
              <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <X style={{ width: 14, height: 14, color: "rgba(252,165,165,0.55)" }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Aide */}
        {text.trim().length > 0 && !selectedType && (
          <p style={{ fontSize: 12, color: "rgba(165,180,252,0.50)", marginTop: 14, textAlign: "center" }}>
            Sélectionne un type de post pour publier
          </p>
        )}

        {/* Bouton submit */}
        <motion.div
          className="mt-8 flex justify-center"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.5 }}
        >
          <AnimatePresence mode="wait">
            {showSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "14px 36px", borderRadius: 999,
                  background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.30)",
                }}
              >
                <Check style={{ width: 18, height: 18, color: "#34d399", strokeWidth: 2.5 }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#34d399" }}>Publié dans les Actus !</span>
              </motion.div>
            ) : (
              <motion.button
                key="submit"
                type="button"
                onClick={handleSubmit}
                disabled={!isValid || loading}
                whileTap={isValid && !loading ? { scale: 0.97 } : {}}
                style={{
                  padding: "14px 44px", borderRadius: 999, fontSize: 15, fontWeight: 700,
                  letterSpacing: "0.1px",
                  cursor: isValid && !loading ? "pointer" : "not-allowed",
                  transition: "all 0.25s ease",
                  display: "flex", alignItems: "center", gap: 8,
                  background: isValid && !loading
                    ? "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(139,92,246,0.22))"
                    : "rgba(255,255,255,0.04)",
                  border: isValid && !loading
                    ? "1px solid rgba(99,102,241,0.45)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: isValid && !loading ? "#c7d2fe" : "rgba(255,255,255,0.20)",
                  boxShadow: isValid && !loading
                    ? "0 0 28px rgba(99,102,241,0.20), inset 0 1px 0 rgba(255,255,255,0.10)"
                    : "none",
                }}
              >
                {loading
                  ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Publication…</>
                  : "Publier dans les Actus"
                }
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}