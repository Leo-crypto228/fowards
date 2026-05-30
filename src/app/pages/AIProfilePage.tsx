import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getProfile, updateProfile, type ProfilePage } from "../api/aiApi";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function AIProfilePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const token = session?.access_token ?? "";

  const [profile, setProfile] = useState<ProfilePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const p = await getProfile(token);
      setProfile(p);
    } catch (err) {
      console.error("[AIProfilePage] load error:", err);
      toast.error("Erreur lors du chargement du profil");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    setEditText(profile?.contentMarkdown ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    if (saving) return;
    setSaving(true);
    try {
      await updateProfile(token, editText);
      setProfile((prev) => prev ? { ...prev, contentMarkdown: editText } : prev);
      setEditing(false);
      toast.success("Profil mis à jour");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#000",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileTap={{ scale: 0.88 }}
        onClick={() => navigate("/ai")}
        style={{
          position: "fixed",
          top: "calc(14px + env(safe-area-inset-top, 0px))",
          left: 14,
          zIndex: 20,
          width: 36, height: 36,
          borderRadius: "50%",
          border: "0.5px solid rgba(255,255,255,0.15)",
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          color: "rgba(235,235,245,0.8)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <ArrowLeft style={{ width: 17, height: 17 }} />
      </motion.button>

      <div style={{
        flex: 1,
        padding: "calc(64px + env(safe-area-inset-top, 0px)) 16px 32px",
        maxWidth: 520, width: "100%",
        margin: "0 auto",
      }}>
        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{
            fontSize: 20, fontWeight: 700,
            color: "rgba(235,235,245,0.92)",
            margin: 0,
          }}>
            Mon Profil IA
          </h1>
          {profile && (
            <p style={{ fontSize: 12, color: "rgba(235,235,245,0.3)", marginTop: 4, marginBottom: 0 }}>
              {profile.isPhase1Complete
                ? `Bilan complété · ${profile.aiUpdateCount} mises à jour IA`
                : "Bilan initial en cours…"}
            </p>
          )}
        </div>

        {/* Phase 1 not complete */}
        {!loading && profile && !profile.isPhase1Complete && (
          <div style={{
            background: "rgba(99,102,241,0.08)",
            border: "0.5px solid rgba(99,102,241,0.25)",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 20,
          }}>
            <p style={{ fontSize: 13, color: "rgba(235,235,245,0.6)", margin: 0, lineHeight: 1.5 }}>
              Ton profil IA se construit au fil du bilan initial.{" "}
              <span
                onClick={() => navigate("/ai")}
                style={{ color: "rgba(99,102,241,0.9)", cursor: "pointer", fontWeight: 600 }}
              >
                Continuer le bilan →
              </span>
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.08)",
              borderTop: "2px solid rgba(255,255,255,0.4)",
              animation: "spin 0.7s linear infinite",
            }} />
          </div>
        )}

        {/* Profile content */}
        {!loading && profile && (
          <>
            {editing ? (
              /* Edit mode */
              <div>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 320,
                    background: "rgba(255,255,255,0.05)",
                    border: "0.5px solid rgba(255,255,255,0.15)",
                    borderRadius: 12,
                    color: "rgba(235,235,245,0.92)",
                    fontSize: 14,
                    lineHeight: 1.6,
                    padding: "14px",
                    fontFamily: "inherit",
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button
                    onClick={() => setEditing(false)}
                    style={{
                      flex: 1, height: 40, borderRadius: 10,
                      border: "0.5px solid rgba(255,255,255,0.15)",
                      background: "transparent",
                      color: "rgba(235,235,245,0.5)",
                      fontSize: 14, cursor: "pointer",
                    }}
                  >
                    Annuler
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={saveEdit}
                    disabled={saving}
                    style={{
                      flex: 1, height: 40, borderRadius: 10,
                      border: "none",
                      background: saving ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.9)",
                      color: saving ? "rgba(255,255,255,0.4)" : "#000",
                      fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? "Sauvegarde…" : "Sauvegarder"}
                  </motion.button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div>
                {profile.contentMarkdown.trim() ? (
                  <div
                    className="ai-markdown"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                      borderRadius: 14,
                      padding: "16px",
                      color: "rgba(235,235,245,0.85)",
                      fontSize: 14,
                      lineHeight: 1.65,
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {profile.contentMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div style={{
                    textAlign: "center",
                    paddingTop: 40,
                    color: "rgba(235,235,245,0.25)",
                    fontSize: 14,
                  }}>
                    Ton profil se construit au fil de vos échanges.
                  </div>
                )}

                {/* Bouton modifier — toujours accessible */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={startEdit}
                  style={{
                    marginTop: 16,
                    width: "100%", height: 40,
                    borderRadius: 10,
                    border: "0.5px solid rgba(255,255,255,0.15)",
                    background: "transparent",
                    color: "rgba(235,235,245,0.5)",
                    fontSize: 13, cursor: "pointer",
                  }}
                >
                  Modifier le profil
                </motion.button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
