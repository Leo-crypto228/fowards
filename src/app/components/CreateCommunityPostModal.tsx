import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { X, Image as ImageIcon, Loader2, Hash, ChevronDown, Check } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H    = { Authorization: `Bearer ${publicAnonKey}`, "Content-Type": "application/json" };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  preselectedChannelId?: string | null;
  preselectedChannelName?: string | null;
}

interface ChannelItem {
  id: string;
  name: string;
  emoji?: string;
}

interface ChannelCategory {
  id: string;
  name: string;
  channels: ChannelItem[];
}

const BADGES = [
  { key: "Actus",      emoji: "📣" },
  { key: "Avancement", emoji: "🚀" },
  { key: "Conseil",    emoji: "💡" },
  { key: "Question",   emoji: "❓" },
  { key: "Objectif",   emoji: "🎯" },
  { key: "Bilan",      emoji: "📊" },
  { key: "New",        emoji: "✨" },
  { key: "Leçon",      emoji: "📖" },
];

export function CreateCommunityPostModal({
  isOpen, onClose, communityId, preselectedChannelId, preselectedChannelName,
}: Props) {
  const { user } = useAuth();

  // ── Channel selection ─────────────────────────────────────────────────────
  const [channels, setChannels]           = useState<ChannelItem[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [selectedChannelId, setSelectedChannelId]     = useState<string | null>(preselectedChannelId ?? null);
  const [selectedChannelName, setSelectedChannelName] = useState<string | null>(preselectedChannelName ?? null);
  const [showChannelPicker, setShowChannelPicker]     = useState(false);

  // ── Post form ─────────────────────────────────────────────────────────────
  const [badge, setBadge]           = useState("Actus");
  const [text, setText]             = useState("");
  const [hashtag, setHashtag]       = useState("");
  const [hashtags, setHashtags]     = useState<string[]>([]);
  const [imageUrl, setImageUrl]     = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Fetch channels ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !communityId) return;
    setChannelsLoading(true);
    fetch(`${BASE}/communities/${communityId}/channels`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => r.json())
      .then(data => {
        const cats: ChannelCategory[] = data.channels || [];
        const flat = cats.flatMap(c => c.channels || []);
        setChannels(flat);
        // Auto-select first channel if none preselected
        if (!selectedChannelId && flat.length > 0) {
          setSelectedChannelId(flat[0].id);
          setSelectedChannelName(flat[0].name);
        }
      })
      .catch(err => console.error("Erreur chargement canaux:", err))
      .finally(() => setChannelsLoading(false));
  }, [isOpen, communityId]);

  // Sync preselected channel when modal opens
  useEffect(() => {
    if (preselectedChannelId) {
      setSelectedChannelId(preselectedChannelId);
      setSelectedChannelName(preselectedChannelName ?? null);
    }
  }, [preselectedChannelId, preselectedChannelName, isOpen]);

  const reset = () => {
    setBadge("Actus"); setText(""); setHashtag(""); setHashtags([]);
    setImageUrl(null); setShowBadges(false); setShowChannelPicker(false);
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        body: fd,
      });
      const data = await res.json();
      if (data.url) { setImageUrl(data.url); toast.success("Image ajoutée ✓"); }
      else throw new Error(data.error || "Upload échoué");
    } catch (err) {
      console.error("Erreur upload:", err);
      toast.error("Impossible d'uploader l'image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  // ── Hashtag handling ──────────────────────────────────────────────────────
  const addHashtag = () => {
    const tag = hashtag.trim().replace(/^#+/, "");
    if (!tag || hashtags.includes(`#${tag}`) || hashtags.length >= 5) return;
    setHashtags(prev => [...prev, `#${tag}`]);
    setHashtag("");
  };
  const removeHashtag = (tag: string) => setHashtags(prev => prev.filter(t => t !== tag));

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!text.trim()) { toast.error("Écris quelque chose !"); return; }
    if (!user?.supabaseId) { toast.error("Tu dois être connecté."); return; }
    if (!selectedChannelId) { toast.error("Sélectionne un canal."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${BASE}/communities/${communityId}/channels/${selectedChannelId}/posts`,
        {
          method: "POST",
          headers: H,
          body: JSON.stringify({
            userId:   user.supabaseId,
            author:   user.name,
            avatar:   user.avatar || "",
            badge,
            text:     text.trim(),
            image:    imageUrl,
            hashtags,
          }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Erreur serveur");
      toast.success("Post publié ! 🚀");
      handleClose();
    } catch (err) {
      console.error("Erreur soumission post:", err);
      toast.error("Impossible de publier");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;
  const activeBadge = BADGES.find(b => b.key === badge) || BADGES[0];

  return createPortal(
    
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.22 }}
            onClick={handleClose}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
              zIndex: 9998,
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32, mass: 0.9 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0,
              zIndex: 9999, maxWidth: 520, margin: "0 auto",
              borderRadius: "24px 24px 0 0",
              background: "rgba(14,14,22,0.98)",
              border: "0.5px solid rgba(255,255,255,0.10)",
              borderBottom: "none",
              boxShadow: "0 -12px 60px rgba(0,0,0,0.65)",
              overflow: "hidden",
              paddingBottom: "env(safe-area-inset-bottom, 20px)",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
            </div>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px 14px",
              borderBottom: "0.5px solid rgba(255,255,255,0.06)",
            }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.92)", margin: 0 }}>
                  Nouveau post
                </p>
                {/* Channel selector */}
                <div style={{ marginTop: 4 }}>
                  {channelsLoading ? (
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>Chargement des canaux…</span>
                  ) : channels.length > 0 ? (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowChannelPicker(v => !v)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        background: "rgba(99,102,241,0.12)",
                        border: "0.5px solid rgba(99,102,241,0.25)",
                        borderRadius: 999, padding: "3px 10px", cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 12, color: "rgba(165,180,252,0.80)", fontWeight: 600 }}>
                        #{selectedChannelName || "Sélectionner un canal"}
                      </span>
                      <ChevronDown style={{
                        width: 11, height: 11, color: "rgba(165,180,252,0.55)",
                        transform: showChannelPicker ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.18s ease",
                      }} />
                    </motion.button>
                  ) : (
                    <span style={{ fontSize: 11, color: "rgba(255,100,100,0.60)" }}>Aucun canal disponible</span>
                  )}
                </div>

                {/* Channel picker dropdown */}
                
                  {showChannelPicker && channels.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      transition={{ duration: 0.18 }}
                      style={{
                        position: "absolute", top: 70, left: 20,
                        background: "rgba(18,18,30,0.98)",
                        border: "0.5px solid rgba(255,255,255,0.12)",
                        borderRadius: 14, overflow: "hidden",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.60)",
                        zIndex: 10, minWidth: 200,
                      }}
                    >
                      {channels.map(ch => (
                        <motion.button
                          key={ch.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setSelectedChannelId(ch.id);
                            setSelectedChannelName(ch.name);
                            setShowChannelPicker(false);
                          }}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            gap: 8, width: "100%",
                            padding: "10px 14px", border: "none",
                            background: selectedChannelId === ch.id ? "rgba(99,102,241,0.15)" : "transparent",
                            cursor: "pointer",
                            borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <span style={{
                            fontSize: 13, color: selectedChannelId === ch.id
                              ? "rgba(165,180,252,0.90)" : "rgba(255,255,255,0.65)",
                            fontWeight: selectedChannelId === ch.id ? 600 : 400,
                          }}>
                            {ch.emoji && ch.emoji !== "#" ? `${ch.emoji} ` : "#"}{ch.name}
                          </span>
                          {selectedChannelId === ch.id && (
                            <Check style={{ width: 12, height: 12, color: "#818cf8", flexShrink: 0 }} />
                          )}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                
              </div>

              <motion.button
                whileTap={{ scale: 0.88 }} onClick={handleClose}
                style={{
                  width: 32, height: 32, borderRadius: "50%", border: "none",
                  background: "rgba(255,255,255,0.07)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.55)" }} />
              </motion.button>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Badge selector */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: "0.09em", textTransform: "uppercase", margin: "0 0 8px" }}>
                  Type de post
                </p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowBadges(v => !v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 14px", borderRadius: 12,
                    background: "rgba(255,255,255,0.06)",
                    border: "0.5px solid rgba(255,255,255,0.12)",
                    cursor: "pointer", width: "fit-content",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{activeBadge.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, background: "rgba(255,255,255,0.92)", color: "#111", padding: "2px 10px", borderRadius: 999 }}>
                    {activeBadge.key}
                  </span>
                  <ChevronDown style={{
                    width: 14, height: 14, color: "rgba(255,255,255,0.35)",
                    transform: showBadges ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.18s ease",
                  }} />
                </motion.button>

                
                  {showBadges && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden", marginTop: 8 }}
                    >
                      <div style={{
                        display: "flex", flexWrap: "wrap", gap: 8, padding: "12px",
                        borderRadius: 14, background: "rgba(255,255,255,0.04)",
                        border: "0.5px solid rgba(255,255,255,0.08)",
                      }}>
                        {BADGES.map(b => (
                          <motion.button
                            key={b.key} whileTap={{ scale: 0.93 }}
                            onClick={() => { setBadge(b.key); setShowBadges(false); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "5px 12px", borderRadius: 999, border: "none",
                              background: badge === b.key ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.06)",
                              outline: badge === b.key ? "0.5px solid rgba(99,102,241,0.40)" : "0.5px solid rgba(255,255,255,0.09)",
                              cursor: "pointer", fontSize: 13,
                              fontWeight: badge === b.key ? 700 : 500,
                              color: badge === b.key ? "#a5b4fc" : "rgba(255,255,255,0.55)",
                            }}
                          >
                            <span>{b.emoji}</span><span>{b.key}</span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                
              </div>

              {/* Author row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                  border: "1.5px solid rgba(99,102,241,0.35)",
                  background: "linear-gradient(135deg,#4f46e5,#818cf8)",
                }}>
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                        {(user?.name || "U").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.88)", margin: 0 }}>{user?.name || "Utilisateur"}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", margin: "2px 0 0" }}>@{user?.username || "inconnu"}</p>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={selectedChannelName ? `Partage quelque chose dans #${selectedChannelName}…` : "Partage quelque chose…"}
                rows={5}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)",
                  border: "0.5px solid rgba(255,255,255,0.10)", borderRadius: 14,
                  padding: "12px 14px", fontSize: 15,
                  color: "rgba(255,255,255,0.88)", lineHeight: 1.6,
                  resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                  whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere",
                }}
                onFocus={e => { e.target.style.borderColor = "rgba(99,102,241,0.40)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.10)"; }}
              />

              {/* Image preview */}
              
                {imageUrl && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                    style={{ position: "relative", borderRadius: 14, overflow: "hidden", height: 160 }}
                  >
                    <img src={imageUrl} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <motion.button
                      whileTap={{ scale: 0.88 }} onClick={() => setImageUrl(null)}
                      style={{
                        position: "absolute", top: 8, right: 8,
                        width: 28, height: 28, borderRadius: "50%", border: "none",
                        background: "rgba(0,0,0,0.60)", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <X style={{ width: 13, height: 13, color: "#fff" }} />
                    </motion.button>
                  </motion.div>
                )}
              

              {/* Hashtags */}
              <div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{
                    flex: 1, display: "flex", alignItems: "center", gap: 6,
                    background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.10)",
                    borderRadius: 10, padding: "7px 12px",
                  }}>
                    <Hash style={{ width: 13, height: 13, color: "rgba(139,92,246,0.55)", flexShrink: 0 }} />
                    <input
                      value={hashtag} onChange={e => setHashtag(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addHashtag(); } }}
                      placeholder="hashtag"
                      style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "inherit" }}
                    />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.92 }} onClick={addHashtag}
                    disabled={!hashtag.trim() || hashtags.length >= 5}
                    style={{
                      padding: "7px 14px", borderRadius: 10, border: "none",
                      background: hashtag.trim() && hashtags.length < 5 ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.04)",
                      color: hashtag.trim() && hashtags.length < 5 ? "#818cf8" : "rgba(255,255,255,0.20)",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    + Tag
                  </motion.button>
                </div>
                {hashtags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {hashtags.map(tag => (
                      <motion.button
                        key={tag} whileTap={{ scale: 0.92 }} onClick={() => removeHashtag(tag)}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "3px 10px", borderRadius: 999, border: "none",
                          background: "rgba(139,92,246,0.12)", outline: "0.5px solid rgba(139,92,246,0.25)",
                          fontSize: 12, color: "rgba(167,139,250,0.80)", cursor: "pointer",
                        }}
                      >
                        {tag}<X style={{ width: 10, height: 10 }} />
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px 20px",
              borderTop: "0.5px solid rgba(255,255,255,0.06)", gap: 12,
            }}>
              <motion.button
                whileTap={{ scale: 0.88 }} onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 10, border: "none",
                  background: imageUrl ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)",
                  outline: imageUrl ? "0.5px solid rgba(99,102,241,0.30)" : "0.5px solid rgba(255,255,255,0.10)",
                  cursor: uploading ? "default" : "pointer",
                  fontSize: 13, fontWeight: 500,
                  color: imageUrl ? "#818cf8" : "rgba(255,255,255,0.45)",
                }}
              >
                {uploading ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" /> : <ImageIcon style={{ width: 15, height: 15 }} />}
                {uploading ? "Upload…" : imageUrl ? "Changer" : "Image"}
              </motion.button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} style={{ display: "none" }} />

              <motion.button
                whileTap={{ scale: 0.94 }} onClick={handleSubmit}
                disabled={!text.trim() || submitting || !selectedChannelId}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 14, border: "none",
                  background: !text.trim() || submitting || !selectedChannelId
                    ? "rgba(99,102,241,0.20)"
                    : "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                  boxShadow: !text.trim() || submitting || !selectedChannelId
                    ? "none" : "0 4px 16px rgba(79,70,229,0.35)",
                  cursor: !text.trim() || submitting || !selectedChannelId ? "default" : "pointer",
                  fontSize: 15, fontWeight: 700,
                  color: !text.trim() || submitting || !selectedChannelId ? "rgba(165,180,252,0.45)" : "#fff",
                  transition: "all 0.18s ease",
                }}
              >
                {submitting
                  ? <><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> Publication…</>
                  : "Publier"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    ,
    document.body
  );
}