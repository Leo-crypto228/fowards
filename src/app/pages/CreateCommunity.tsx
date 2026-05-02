import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Camera, ImagePlus,
  Check, Loader2, Tag, Globe, Lock, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { toast } from "sonner";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H_AUTH = { Authorization: `Bearer ${publicAnonKey}` };

type Mentality = "Objectif" | "Passion";
type Visibility = "public" | "prive";

async function uploadCommunityImage(file: File, prefix: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("prefix", prefix);
  const res = await fetch(`${BASE}/upload-community-image`, {
    method: "POST",
    headers: H_AUTH,
    body: form,
  });
  const data = await res.json();
  if (!data.url) throw new Error(data.error ?? "Upload échoué");
  return data.url;
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700,
      color: "rgba(255,255,255,0.38)",
      textTransform: "uppercase",
      letterSpacing: "0.10em",
      marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "28px 0" }} />
  );
}

export function CreateCommunity() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const bannerRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  // Images
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // Infos
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mentality, setMentality] = useState<Mentality | null>(null);
  const [mentalityWord, setMentalityWord] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Paramètres
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [rules, setRules] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const nameOk = name.trim().length >= 3;
  const canSubmit = nameOk && mentality !== null && !loading;

  const handleBanner = useCallback((f: File) => {
    const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!ALLOWED.includes(f.type)) { toast.error(`Format non autorisé. Acceptés : JPG, PNG, WEBP.`); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error(`Image trop volumineuse. Max : 5 MB.`); return; }
    setBannerFile(f);
    setBannerPreview(URL.createObjectURL(f));
  }, []);

  const handleAvatar = useCallback((f: File) => {
    const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!ALLOWED.includes(f.type)) { toast.error(`Format non autorisé. Acceptés : JPG, PNG, WEBP.`); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error(`Image trop volumineuse. Max : 5 MB.`); return; }
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  }, []);

  function addTag(raw: string) {
    const t = raw.replace(/^#/, "").trim();
    if (t && !tags.includes(t) && tags.length < 6) setTags([...tags, t]);
    setTagInput("");
  }

  const SUGGESTED_RULES = [
    "Respectez les autres membres en toutes circonstances.",
    "Pas de spam ni de contenu hors-sujet.",
    "Partagez uniquement du contenu original et pertinent.",
    "Les critiques doivent être constructives.",
    "Aucune discrimination de quelque nature que ce soit.",
  ].join("\n");

  async function handleSubmit() {
    if (!canSubmit || !user) return;
    setLoading(true);
    setError(null);
    try {
      let avatarUrl = "";
      let bannerUrl = "";
      if (avatarFile) avatarUrl = await uploadCommunityImage(avatarFile, "avatar");
      if (bannerFile) bannerUrl = await uploadCommunityImage(bannerFile, "banner");

      const res = await fetch(`${BASE}/communities`, {
        method: "POST",
        headers: { ...H_AUTH, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          mentality,
          mentalityWord: mentalityWord.trim(),
          avatar: avatarUrl,
          banner: bannerUrl,
          tags,
          visibility,
          rules: rules.trim(),
          createdBy: user.supabaseId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Création échouée");

      setSuccess(true);
      toast("🎉 Communauté créée et en ligne !", {
        duration: 3500,
        style: {
          background: "rgba(99,102,241,0.15)",
          border: "0.5px solid rgba(99,102,241,0.35)",
          color: "#c7d2fe",
        },
      });
      setTimeout(() => navigate(`/tribes/${data.community.id}`), 1400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(msg);
      toast.error(`Erreur : ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", paddingBottom: 48 }}>
      <style>{`@keyframes cc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        padding: "52px 20px 16px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <button
          onClick={() => navigate("/tribes")}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
            border: "0.5px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16, color: "rgba(255,255,255,0.70)", strokeWidth: 2 }} />
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f5", letterSpacing: "-0.2px" }}>
            Créer une communauté
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", marginTop: 1 }}>
            Visible par tous les membres de FuturFeed
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 0" }}>

        {/* ════════════════════════════════════════ */}
        {/* SECTION 1 — Identité visuelle           */}
        {/* ════════════════════════════════════════ */}
        <SectionLabel>Identité visuelle</SectionLabel>

        {/* Bannière */}
        <div style={{ position: "relative", marginBottom: 52 }}>
          <button
            type="button"
            onClick={() => bannerRef.current?.click()}
            style={{
              display: "block", width: "100%", height: 155,
              borderRadius: 18, overflow: "hidden", cursor: "pointer",
              background: bannerPreview ? "transparent" : "rgba(255,255,255,0.04)",
              border: bannerPreview ? "none" : "1.5px dashed rgba(255,255,255,0.12)",
              position: "relative",
            }}
          >
            {bannerPreview ? (
              <>
                <img src={bannerPreview} alt="bannière" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(0,0,0,0)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.18s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.40)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0)"; }}
                >
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "7px 16px", borderRadius: 999,
                    background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.20)",
                    opacity: 0, transition: "opacity 0.18s",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}
                  >
                    <ImagePlus style={{ width: 14, height: 14, color: "#fff" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Modifier</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ImagePlus style={{ width: 20, height: 20, color: "rgba(255,255,255,0.28)", strokeWidth: 1.5 }} />
                </div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", fontWeight: 500 }}>Ajouter une bannière</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.16)" }}>JPG, PNG · max 5 Mo</span>
              </div>
            )}
            <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleBanner(f); }} />
          </button>

          {/* Avatar chevauchant */}
          <button
            type="button"
            onClick={() => avatarRef.current?.click()}
            style={{
              position: "absolute", bottom: -42, left: 18,
              width: 76, height: 76, borderRadius: 18,
              overflow: "hidden", cursor: "pointer",
              border: "3px solid #000",
              boxShadow: "0 0 0 1.5px rgba(99,102,241,0.40)",
              background: avatarPreview ? "transparent" : "rgba(99,102,241,0.10)",
              zIndex: 2,
            }}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <Camera style={{ width: 20, height: 20, color: "rgba(99,102,241,0.65)", strokeWidth: 1.5 }} />
                <span style={{ fontSize: 9, color: "rgba(99,102,241,0.55)", fontWeight: 600 }}>Photo</span>
              </div>
            )}
            <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatar(f); }} />
          </button>

          <div style={{
            position: "absolute", bottom: -50, left: 76 + 18 + 12,
            fontSize: 11, color: "rgba(255,255,255,0.28)", lineHeight: 1.5,
          }}>
            <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>Photo de profil</span><br />
            Cliquez pour modifier
          </div>
        </div>

        <Divider />

        {/* ════════════════════════════════════════ */}
        {/* SECTION 2 — Informations                */}
        {/* ════════════════════════════════════════ */}
        <SectionLabel>Informations</SectionLabel>

        {/* Nom */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.40)", marginBottom: 8 }}>
            Nom de la communauté *
          </div>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex : Runners du matin"
              maxLength={60}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.05)",
                border: name.length > 0
                  ? `1px solid rgba(99,102,241,${nameOk ? "0.55" : "0.28"})`
                  : "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14, padding: "14px 44px 14px 16px",
                fontSize: 16, fontWeight: 600, color: "#f0f0f5",
                outline: "none", transition: "border-color 0.2s",
              }}
              className="placeholder:text-[rgba(144,144,168,0.30)]"
            />
            {nameOk && (
              <div style={{
                position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                width: 22, height: 22, borderRadius: "50%",
                background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Check style={{ width: 12, height: 12, color: "#4ade80", strokeWidth: 2.5 }} />
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", textAlign: "right", marginTop: 5 }}>
            {name.length}/60
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.40)", marginBottom: 8 }}>
            Description <span style={{ color: "rgba(255,255,255,0.22)" }}>(optionnel)</span>
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Décrivez l'objectif ou la passion de votre communauté…"
            maxLength={280}
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(255,255,255,0.05)",
              border: description.length > 0
                ? "1px solid rgba(99,102,241,0.50)"
                : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 14, padding: "14px 16px",
              fontSize: 15, color: "#f0f0f5",
              outline: "none", resize: "none",
              lineHeight: 1.55, fontFamily: "inherit",
              transition: "border-color 0.2s",
            }}
            className="placeholder:text-[rgba(144,144,168,0.30)]"
          />
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", textAlign: "right", marginTop: 5 }}>
            {description.length}/280
          </div>
        </div>

        {/* Mentalité */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.40)", marginBottom: 12 }}>
            Mentalité *
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {([
              { key: "Objectif" as Mentality, desc: "Atteindre un but précis ensemble" },
              { key: "Passion" as Mentality, desc: "Partager une passion commune" },
            ]).map(({ key: m, desc }) => {
              const active = mentality === m;
              return (
                <motion.button
                  key={m}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setMentality(m)}
                  style={{
                    padding: "16px 14px", borderRadius: 16, textAlign: "left",
                    border: active
                      ? "1.5px solid rgba(99,102,241,0.60)"
                      : "1px solid rgba(255,255,255,0.09)",
                    background: active
                      ? "rgba(99,102,241,0.11)"
                      : "rgba(255,255,255,0.04)",
                    cursor: "pointer", position: "relative", overflow: "hidden",
                    transition: "all 0.2s ease",
                  }}
                >
                  {active && (
                    <motion.div layoutId="mentality-glow" style={{
                      position: "absolute", inset: 0,
                      background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.18) 0%, transparent 70%)",
                      pointerEvents: "none",
                    }} />
                  )}
                  <div style={{ fontSize: 14, fontWeight: 700, color: active ? "#c7d2fe" : "rgba(255,255,255,0.70)", marginBottom: 3 }}>{m}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", lineHeight: 1.4 }}>{desc}</div>
                  {active && (
                    <div style={{
                      position: "absolute", top: 10, right: 10,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "rgba(99,102,241,0.85)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check style={{ width: 10, height: 10, color: "#fff", strokeWidth: 2.5 }} />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Mot personnalisé affiché dans le boudin à côté de la mentalité */}
          <AnimatePresence>
            {mentality && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{ marginTop: 12 }}
              >
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginBottom: 7, lineHeight: 1.5 }}>
                  Mot affiché dans le badge&nbsp;
                  <span style={{ color: "rgba(255,255,255,0.16)" }}>(1 mot · optionnel)</span>
                  &nbsp;—&nbsp;
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "1px 10px", borderRadius: 999, fontSize: 11,
                    background: "rgba(255,255,255,0.92)", color: "#111", fontWeight: 700,
                  }}>
                    {mentality}{mentalityWord ? ` · ${mentalityWord}` : ""}
                  </span>
                </div>
                <input
                  type="text"
                  value={mentalityWord}
                  onChange={e => {
                    // 1 mot max, pas d'espaces
                    const v = e.target.value.replace(/\s+/g, "").slice(0, 18);
                    setMentalityWord(v);
                  }}
                  placeholder={mentality === "Objectif" ? "ex: Fitness, Revenue…" : "ex: Gaming, Photo…"}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.05)",
                    border: mentalityWord
                      ? "1px solid rgba(99,102,241,0.50)"
                      : "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 12, padding: "11px 14px",
                    fontSize: 14, color: "#f0f0f5",
                    outline: "none", fontFamily: "inherit",
                    transition: "border-color 0.2s",
                  }}
                  className="placeholder:text-[rgba(144,144,168,0.28)]"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.40)", marginBottom: 10 }}>
            Tags <span style={{ color: "rgba(255,255,255,0.22)" }}>(optionnel · max 6)</span>
          </div>

          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {tags.map(t => (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "4px 10px 4px 12px", borderRadius: 999,
                    background: "rgba(99,102,241,0.14)",
                    border: "1px solid rgba(99,102,241,0.32)",
                    fontSize: 13, fontWeight: 600, color: "#a5b4fc",
                  }}
                >
                  #{t}
                  <button type="button" onClick={() => setTags(tags.filter(x => x !== t))}
                    style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <X style={{ width: 12, height: 12, color: "rgba(165,180,252,0.55)" }} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {tags.length < 6 && (
            <div style={{ position: "relative" }}>
              <Tag style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                width: 14, height: 14, color: "rgba(255,255,255,0.24)",
              }} />
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addTag(tagInput); } }}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder="#SaaS  #Course  #Business…"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14, padding: "12px 14px 12px 36px",
                  fontSize: 14, color: "#f0f0f5",
                  outline: "none", transition: "border-color 0.2s",
                }}
                className="placeholder:text-[rgba(144,144,168,0.28)]"
              />
            </div>
          )}
        </div>

        <Divider />

        {/* ════════════════════════════════════════ */}
        {/* SECTION 3 — Paramètres avancés          */}
        {/* ════════════════════════════════════════ */}
        <SectionLabel>Paramètres avancés</SectionLabel>

        {/* Visibilité */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.40)", marginBottom: 12 }}>
            Visibilité
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {([
              { key: "public" as Visibility, Icon: Globe, label: "Publique", desc: "Tout le monde peut rejoindre" },
              { key: "prive" as Visibility, Icon: Lock, label: "Privée", desc: "Sur invitation uniquement" },
            ]).map(({ key, Icon, label, desc }) => {
              const active = visibility === key;
              return (
                <motion.button
                  key={key}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setVisibility(key)}
                  style={{
                    padding: "16px 14px", borderRadius: 16, textAlign: "left",
                    border: active
                      ? "1.5px solid rgba(99,102,241,0.60)"
                      : "1px solid rgba(255,255,255,0.09)",
                    background: active ? "rgba(99,102,241,0.11)" : "rgba(255,255,255,0.04)",
                    cursor: "pointer", position: "relative", overflow: "hidden",
                    transition: "all 0.2s ease",
                  }}
                >
                  {active && (
                    <motion.div layoutId="vis-glow" style={{
                      position: "absolute", inset: 0,
                      background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.18) 0%, transparent 70%)",
                      pointerEvents: "none",
                    }} />
                  )}
                  <Icon style={{ width: 20, height: 20, color: active ? "#818cf8" : "rgba(255,255,255,0.32)", marginBottom: 8, strokeWidth: 1.6 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: active ? "#c7d2fe" : "rgba(255,255,255,0.70)", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", lineHeight: 1.4 }}>{desc}</div>
                  {active && (
                    <div style={{
                      position: "absolute", top: 10, right: 10,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "rgba(99,102,241,0.85)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check style={{ width: 10, height: 10, color: "#fff", strokeWidth: 2.5 }} />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
          {visibility === "prive" && (
            <div style={{
              marginTop: 10, padding: "10px 14px", borderRadius: 12,
              background: "rgba(251,191,36,0.07)", border: "0.5px solid rgba(251,191,36,0.20)",
              fontSize: 12, color: "rgba(251,191,36,0.65)", lineHeight: 1.5,
            }}>
              Les membres devront être approuvés manuellement avant de rejoindre.
            </div>
          )}
        </div>

        {/* Règles */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.40)", marginBottom: 10 }}>
            Règles <span style={{ color: "rgba(255,255,255,0.22)" }}>(optionnel)</span>
          </div>
          <textarea
            value={rules}
            onChange={e => setRules(e.target.value)}
            placeholder="Ex : Pas de spam, respectez les autres membres…"
            rows={4}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(255,255,255,0.05)",
              border: rules.length > 0
                ? "1px solid rgba(99,102,241,0.50)"
                : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 14, padding: "14px 16px",
              fontSize: 14, color: "#f0f0f5",
              outline: "none", resize: "none",
              lineHeight: 1.6, fontFamily: "inherit",
              transition: "border-color 0.2s",
            }}
            className="placeholder:text-[rgba(144,144,168,0.28)]"
          />
        </div>

        {/* ── Erreur ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                marginBottom: 20, padding: "12px 16px", borderRadius: 12,
                background: "rgba(239,68,68,0.09)", border: "0.5px solid rgba(239,68,68,0.28)",
                fontSize: 13, color: "#fca5a5",
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bouton créer ── */}
        <motion.button
          type="button"
          disabled={!canSubmit}
          whileTap={canSubmit ? { scale: 0.98 } : {}}
          onClick={handleSubmit}
          style={{
            width: "100%", padding: "16px 0",
            borderRadius: 999, border: "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontSize: 16, fontWeight: 700, color: "#fff",
            letterSpacing: "-0.1px",
            background: success
              ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
              : canSubmit
                ? "linear-gradient(135deg, #6366f1 0%, #7c3aed 50%, #8b5cf6 100%)"
                : "rgba(255,255,255,0.07)",
            boxShadow: success
              ? "0 4px 28px rgba(34,197,94,0.38)"
              : canSubmit
                ? "0 4px 28px rgba(99,102,241,0.42), inset 0 1px 0 rgba(255,255,255,0.18)"
                : "none",
            transition: "all 0.25s ease",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            opacity: loading ? 0.85 : 1,
          }}
        >
          {success ? (
            <><Check style={{ width: 18, height: 18, strokeWidth: 2.5 }} /> Communauté créée et en ligne !</>
          ) : loading ? (
            <><Loader2 style={{ width: 18, height: 18, animation: "cc-spin 1s linear infinite" }} /> Mise en ligne…</>
          ) : (
            <>Créer et mettre en ligne</>
          )}
        </motion.button>

        {!canSubmit && !loading && (
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            {name.trim().length < 3 ? "Le nom doit faire au moins 3 caractères" : "Choisissez une mentalité pour continuer"}
          </div>
        )}

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}