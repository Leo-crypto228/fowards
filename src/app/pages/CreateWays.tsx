import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ImagePlus, X, Send } from "lucide-react";
import { useNavigate } from "react-router";
import { createWays } from "../api/waysApi";
import { compressImage } from "../utils/compressImage";
import { MY_USER_ID } from "../api/authStore";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { toast } from "sonner";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS: Record<string, string> = { Authorization: `Bearer ${publicAnonKey}` };

const MAX_CHARS = 300;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function CreateWays() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_CHARS - text.length;
  const canSubmit = (text.trim().length > 0 || imageFile !== null) && !submitting;

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Format non autorisé. Acceptés : JPG, PNG, WEBP.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Image trop volumineuse (max 5 MB).");
      return;
    }
    const compressed = await compressImage(file, { maxWidth: 1080, quality: 0.82 });
    setImageFile(compressed);
    setImagePreview(URL.createObjectURL(compressed));
    e.target.value = "";
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const username = MY_USER_ID();
    if (!username) { toast.error("Connecte-toi pour créer un Ways."); return; }

    setSubmitting(true);
    try {
      let imageUrl: string | undefined;

      if (imageFile) {
        setUploading(true);
        const form = new FormData();
        form.append("file", imageFile, imageFile.name);
        const upRes = await fetch(`${BASE}/upload-image`, { method: "POST", headers: HEADERS, body: form });
        setUploading(false);
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error || "Erreur upload image");
        imageUrl = upData.url;
      }

      await createWays({ username, text: text.trim() || undefined, image: imageUrl });
      toast.success("Ton Ways est en ligne !");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(String(err) || "Erreur lors de la création du Ways.");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#09090f",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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

        <span style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.01em" }}>
          Créer ton Ways
        </span>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 18px",
            borderRadius: 999,
            background: canSubmit
              ? "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)"
              : "rgba(255,255,255,0.08)",
            border: "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.45,
          }}
        >
          {submitting ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.30)", borderTopColor: "#fff", borderRadius: "50%" }}
            />
          ) : (
            <>
              <Send style={{ width: 14, height: 14, color: "#fff" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Publier</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: "20px 16px 32px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Subtext */}
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.32)", margin: 0 }}>
          Ton Ways disparaît automatiquement après 24h.
        </p>

        {/* Textarea */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.09)",
            padding: "14px 16px",
            position: "relative",
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Partage quelque chose avec tes abonnés..."
            rows={6}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: 16,
              color: "rgba(240,240,245,0.90)",
              lineHeight: 1.6,
              fontFamily: "inherit",
            }}
          />
          <span
            style={{
              position: "absolute", bottom: 10, right: 14,
              fontSize: 12, color: remaining < 30 ? "#f87171" : "rgba(255,255,255,0.22)",
              fontWeight: 600,
            }}
          >
            {remaining}
          </span>
        </div>

        {/* Image preview */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}
            >
              <img
                src={imagePreview}
                alt=""
                style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block", borderRadius: 16 }}
              />
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={removeImage}
                style={{
                  position: "absolute", top: 10, right: 10,
                  width: 30, height: 30, borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X style={{ width: 14, height: 14, color: "#fff" }} />
              </motion.button>
              {uploading && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(0,0,0,0.50)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    style={{ width: 28, height: 28, border: "2.5px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", borderRadius: "50%" }}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image picker button */}
        {!imagePreview && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "13px 16px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
              border: "1px dashed rgba(255,255,255,0.14)",
              cursor: "pointer",
            }}
          >
            <ImagePlus style={{ width: 20, height: 20, color: "rgba(255,255,255,0.40)" }} />
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.40)" }}>Ajouter une image</span>
          </motion.button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleImagePick}
        />
      </div>
    </div>
  );
}
