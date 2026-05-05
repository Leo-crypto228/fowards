import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Camera, Save, Loader2, Check, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { getProfile, upsertProfile, uploadProfileImage, type UserProfile } from "../api/profileApi";
import { invalidateProfile } from "../api/profileCache";
import { useAuth } from "../context/AuthContext";
import { MY_USER_ID } from "../api/authStore";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

// MY_USERNAME comes from authStore live binding (set after login)
function getMyUsername() { return MY_USER_ID || "thomasdubois"; }

const DEFAULTS = {
  name: "Thomas Dubois",
  handle: "@thomas_dubois",
  avatar: "https://images.unsplash.com/photo-1762753674498-73ec49feafc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400",
  banner: "https://images.unsplash.com/photo-1769184613636-1b7ba2210932?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  bio: "Entrepreneur passionné par la création de produits digitaux. Je construis chaque jour, j'apprends de mes erreurs et je partage mon parcours en public.",
  objective: "Construire mon premier SaaS",
  objectiveDesc: "Développer et lancer un produit SaaS en public, de l'idée au premier euro de revenu.",
  descriptor: "Builder",
};

// ─── Image Upload Zone ────────────────────────────────────────────────────────

function AvatarUpload({
  src,
  uploading,
  onFileChange,
}: {
  src: string;
  uploading: boolean;
  onFileChange: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
      {/* Circle image */}
      <div style={{
        width: 96, height: 96, borderRadius: "50%", overflow: "hidden",
        border: "3px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
      }}>
        {src ? (
          <img src={src} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Camera style={{ width: 28, height: 28, color: "rgba(255,255,255,0.25)" }} />
          </div>
        )}
      </div>

      {/* Overlay button */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: uploading ? "rgba(0,0,0,0.60)" : "rgba(0,0,0,0)",
          border: "none", cursor: uploading ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.2s",
          WebkitTapHighlightColor: "transparent",
        }}
        className="group"
      >
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: uploading ? "transparent" : "rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: uploading ? "none" : "1px solid rgba(255,255,255,0.20)",
        }}>
          {uploading ? (
            <Loader2 style={{ width: 14, height: 14, color: "#fff" }} className="animate-spin" />
          ) : (
            <Camera style={{ width: 14, height: 14, color: "rgba(255,255,255,0.90)" }} />
          )}
        </div>
      </motion.button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChange(f); e.target.value = ""; }}
      />
    </div>
  );
}

function BannerUpload({
  src,
  uploading,
  onFileChange,
}: {
  src: string;
  uploading: boolean;
  onFileChange: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      style={{
        position: "relative", width: "100%", height: 160,
        borderRadius: 18, overflow: "hidden",
        background: "rgba(255,255,255,0.05)",
        border: "0.5px solid rgba(255,255,255,0.10)",
        cursor: uploading ? "default" : "pointer",
      }}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      {src ? (
        <img src={src} alt="bannière" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <ImageIcon style={{ width: 28, height: 28, color: "rgba(255,255,255,0.20)" }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>Bannière de profil</span>
        </div>
      )}

      {/* Overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: uploading ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.30)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.2s",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(0,0,0,0.60)", backdropFilter: "blur(10px)",
          borderRadius: 999, padding: "8px 18px",
          border: "0.5px solid rgba(255,255,255,0.18)",
        }}>
          {uploading ? (
            <Loader2 style={{ width: 14, height: 14, color: "#fff" }} className="animate-spin" />
          ) : (
            <Camera style={{ width: 14, height: 14, color: "rgba(255,255,255,0.90)" }} />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.90)" }}>
            {uploading ? "Envoi en cours…" : "Changer la bannière"}
          </span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChange(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function EditProfilePage() {
  const navigate = useNavigate();
  const { refreshUserProfile } = useAuth();

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [name, setName] = useState(DEFAULTS.name);
  const [bio, setBio] = useState(DEFAULTS.bio);
  const [objective, setObjective] = useState(DEFAULTS.objective);
  const [objectiveDesc, setObjectiveDesc] = useState(DEFAULTS.objectiveDesc);
  const [descriptor, setDescriptor] = useState(DEFAULTS.descriptor);
  const [avatar, setAvatar] = useState(DEFAULTS.avatar);
  const [banner, setBanner] = useState(DEFAULTS.banner);

  // Upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load profile
  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { found, profile: p } = await getProfile(getMyUsername());
      if (found && p) {
        setProfile(p);
        setName(p.name || DEFAULTS.name);
        setBio(p.bio || DEFAULTS.bio);
        setObjective(p.objective || DEFAULTS.objective);
        setObjectiveDesc(p.objectiveDesc || DEFAULTS.objectiveDesc);
        setDescriptor(p.descriptor || DEFAULTS.descriptor);
        setAvatar(p.avatar || DEFAULTS.avatar);
        setBanner(p.banner || DEFAULTS.banner);
      }
    } catch (err) {
      console.error("Erreur chargement profil:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Validation image côté client (type + taille)
  const ALLOWED_IMG_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const MAX_IMG_BYTES = 5 * 1024 * 1024;
  const validateImg = (file: File): string | null => {
    if (!ALLOWED_IMG_TYPES.includes(file.type))
      return `Format non autorisé (${file.type || "inconnu"}). Acceptés : JPG, PNG, WEBP.`;
    if (file.size > MAX_IMG_BYTES)
      return `Image trop volumineuse (${(file.size / 1024 / 1024).toFixed(1)} MB). Max : 5 MB.`;
    return null;
  };

  // Upload avatar
  const handleAvatarFile = async (file: File) => {
    if (uploadingAvatar) return;
    const validErr = validateImg(file);
    if (validErr) { toast.error(validErr, { duration: 4000 }); return; }
    setUploadingAvatar(true);
    try {
      // Local preview immediately
      const localUrl = URL.createObjectURL(file);
      setAvatar(localUrl);
      // Upload to storage
      const url = await uploadProfileImage(file, "avatar", getMyUsername());
      setAvatar(url);
      toast.success("Photo de profil mise à jour !", { duration: 2000 });
    } catch (err) {
      console.error("Erreur upload avatar:", err);
      toast.error("Impossible d'envoyer l'image.");
      // Revert to original
      setAvatar(profile?.avatar || DEFAULTS.avatar);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Upload banner
  const handleBannerFile = async (file: File) => {
    if (uploadingBanner) return;
    const validErr = validateImg(file);
    if (validErr) { toast.error(validErr, { duration: 4000 }); return; }
    setUploadingBanner(true);
    try {
      const localUrl = URL.createObjectURL(file);
      setBanner(localUrl);
      const url = await uploadProfileImage(file, "banner", getMyUsername());
      setBanner(url);
      toast.success("Bannière mise à jour !", { duration: 2000 });
    } catch (err) {
      console.error("Erreur upload bannière:", err);
      toast.error("Impossible d'envoyer la bannière.");
      setBanner(profile?.banner || DEFAULTS.banner);
    } finally {
      setUploadingBanner(false);
    }
  };

  // Save profile
  const handleSave = async () => {
    if (saving || uploadingAvatar || uploadingBanner) return;
    setSaving(true);
    try {
      await upsertProfile(getMyUsername(), {
        name: name.trim(),
        bio: bio.trim(),
        objective: objective.trim(),
        objectiveDesc: objectiveDesc.trim(),
        descriptor: descriptor.trim(),
        avatar,
        banner,
        handle: `@${name.trim().toLowerCase().replace(/\s+/g, "_")}`,
      });
      // Invalide le cache local → les ProgressCards rechargeront les données fraîches
      invalidateProfile(getMyUsername());
      setSaved(true);
      toast.success("Profil sauvegardé !", { duration: 2000 });
      setTimeout(() => navigate("/profile"), 900);
      refreshUserProfile();
    } catch (err) {
      console.error("Erreur sauvegarde profil:", err);
      toast.error("Impossible de sauvegarder.");
    } finally {
      setSaving(false);
    }
  };

  // Input styles
  const inp: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)",
    border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: 14, padding: "12px 16px",
    fontSize: 15, color: "rgba(235,235,245,0.92)",
    outline: "none", caretColor: "#6366f1",
    resize: "none" as const, fontFamily: "inherit",
    whiteSpace: "pre-wrap", wordWrap: "break-word", overflowWrap: "break-word", wordBreak: "break-word",
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700,
    color: "rgba(144,144,168,0.55)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.09em",
    marginBottom: 7, display: "block",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000000", paddingBottom: 120 }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "0.5px solid rgba(255,255,255,0.07)",
          padding: "52px 20px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => navigate(-1)}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "rgba(255,255,255,0.07)",
                border: "0.5px solid rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", WebkitTapHighlightColor: "transparent", flexShrink: 0,
              }}
            >
              <ArrowLeft style={{ width: 16, height: 16, color: "rgba(255,255,255,0.70)", strokeWidth: 2 }} />
            </motion.button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f5", margin: 0, letterSpacing: "-0.3px" }}>
                Modifier le profil
              </h1>
              <p style={{ fontSize: 12, color: "rgba(144,144,168,0.45)", margin: "2px 0 0" }}>
                Personnalise ton identité FuturFeed
              </p>
            </div>
          </div>

          {/* Save button */}
          <motion.button
            whileTap={!saving && !saved ? { scale: 0.93 } : {}}
            onClick={handleSave}
            disabled={saving || saved || uploadingAvatar || uploadingBanner}
            style={{
              height: 38, paddingLeft: 18, paddingRight: 18, borderRadius: 999,
              background: saved ? "rgba(99,102,241,0.25)" : "#6366f1",
              border: "none", cursor: (saving || saved) ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 7,
              fontSize: 13, fontWeight: 700, color: "#fff",
              opacity: (uploadingAvatar || uploadingBanner) ? 0.6 : 1,
              transition: "all 0.2s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <AnimatePresence mode="wait">
              {saving ? (
                <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
                  Sauvegarde…
                </motion.div>
              ) : saved ? (
                <motion.div key="saved" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Check style={{ width: 13, height: 13 }} />
                  Sauvegardé
                </motion.div>
              ) : (
                <motion.div key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Save style={{ width: 13, height: 13 }} />
                  Sauvegarder
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* ── Loading ── */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 10 }}>
            <Loader2 style={{ width: 18, height: 18, color: "rgba(99,102,241,0.55)" }} className="animate-spin" />
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.28)" }}>Chargement du profil…</span>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            style={{ padding: "28px 20px" }}
          >
            {/* ── Bannière ── */}
            <div style={{ marginBottom: 24 }}>
              <label style={lbl}>Bannière</label>
              <BannerUpload
                src={banner}
                uploading={uploadingBanner}
                onFileChange={handleBannerFile}
              />
            </div>

            {/* ── Avatar ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28 }}>
              <AvatarUpload
                src={avatar}
                uploading={uploadingAvatar}
                onFileChange={handleAvatarFile}
              />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(240,240,245,0.85)", margin: "0 0 4px" }}>
                  Photo de profil
                </p>
                <p style={{ fontSize: 13, color: "rgba(144,144,168,0.45)", margin: 0, lineHeight: 1.5 }}>
                  Appuie sur la photo pour la modifier. JPG, PNG, HEIC acceptés.
                </p>
              </div>
            </div>

            {/* ── Divider ── */}
            <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", marginBottom: 24 }} />

            {/* ── Champs texte ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Nom complet */}
              <div>
                <label style={lbl}>Nom complet</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ton nom…"
                  style={{ ...inp, height: 48 }}
                  className="placeholder:text-[rgba(144,144,168,0.30)]"
                />
              </div>

              {/* Titre / Rôle */}
              <div>
                <label style={lbl}>Titre / Rôle</label>
                <input
                  value={descriptor}
                  onChange={(e) => setDescriptor(e.target.value)}
                  placeholder="Builder, Auteure, Fondateur…"
                  style={{ ...inp, height: 48 }}
                  className="placeholder:text-[rgba(144,144,168,0.30)]"
                />
              </div>

              {/* Bio */}
              <div>
                <label style={lbl}>Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="Parle de toi, de ce que tu construis…"
                  style={inp}
                  className="placeholder:text-[rgba(144,144,168,0.30)]"
                />
              </div>

              {/* Objectif principal */}
              <div>
                <label style={lbl}>Objectif principal</label>
                <input
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Ton grand objectif…"
                  style={{ ...inp, height: 48 }}
                  className="placeholder:text-[rgba(144,144,168,0.30)]"
                />
              </div>

              {/* Description objectif */}
              <div>
                <label style={lbl}>Description de l'objectif</label>
                <textarea
                  value={objectiveDesc}
                  onChange={(e) => setObjectiveDesc(e.target.value)}
                  rows={3}
                  placeholder="Développe ton objectif en quelques phrases…"
                  style={inp}
                  className="placeholder:text-[rgba(144,144,168,0.30)]"
                />
              </div>
            </div>

            {/* ── Save button bottom ── */}
            <motion.button
              whileTap={!saving && !saved ? { scale: 0.97 } : {}}
              onClick={handleSave}
              disabled={saving || saved || uploadingAvatar || uploadingBanner}
              style={{
                width: "100%", height: 56, borderRadius: 999, marginTop: 32,
                background: saved
                  ? "rgba(99,102,241,0.25)"
                  : saving
                  ? "rgba(99,102,241,0.45)"
                  : "linear-gradient(135deg,#4f46e5,#6366f1,#818cf8)",
                border: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                fontSize: 16, fontWeight: 700, color: saved ? "rgba(165,180,252,0.80)" : "#fff",
                cursor: (saving || saved) ? "default" : "pointer",
                boxShadow: (saving || saved) ? "none" : "0 4px 24px rgba(99,102,241,0.35)",
                WebkitTapHighlightColor: "transparent",
                opacity: (uploadingAvatar || uploadingBanner) ? 0.5 : 1,
              }}
            >
              {saving ? (
                <><Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />Sauvegarde en cours…</>
              ) : saved ? (
                <><Check style={{ width: 18, height: 18 }} />Profil mis à jour !</>
              ) : (
                <><Save style={{ width: 17, height: 17 }} />Sauvegarder le profil</>
              )}
            </motion.button>

          </motion.div>
        )}
      </div>
    </div>
  );
}