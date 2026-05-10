import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Loader2, Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { useNavigate } from "react-router";
import { supabase } from "../api/supabaseClient";

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  padding: "14px 16px",
  fontSize: 15,
  color: "rgba(235,235,245,0.92)",
  outline: "none",
  transition: "border-color 0.18s",
  caretColor: "#8b5cf6",
  WebkitAppearance: "none",
  boxSizing: "border-box",
};

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [pending,   setPending]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [ready,     setReady]     = useState(false);

  // Supabase sends a recovery link that embeds a token in the URL hash.
  // onAuthStateChange fires with event "PASSWORD_RECOVERY" when it is parsed.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);

    if (password.length < 6)  { setError("Le mot de passe doit contenir au moins 6 caracteres."); return; }
    if (password !== confirm)  { setError("Les mots de passe ne correspondent pas."); return; }

    setPending(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      setDone(true);
      setTimeout(() => navigate("/", { replace: true }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#050508",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 20px",
    }}>
      <div style={{
        fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px",
        alignSelf: "flex-start", marginBottom: 40,
      }}>
        <span translate="no" className="notranslate">Fowards</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0, 0.35, 1] }}
        style={{ width: "100%", maxWidth: 420 }}
      >
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f0f0f5", margin: "0 0 6px", letterSpacing: "-0.4px" }}>
            {done ? "Mot de passe mis a jour !" : "Nouveau mot de passe"}
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0, lineHeight: 1.5 }}>
            {done ? "Tu vas etre redirige..." : "Choisis un nouveau mot de passe pour ton compte."}
          </p>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 24, padding: "30px 28px",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.50)",
        }}>
          {done ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingBlock: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.30)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Check style={{ width: 24, height: 24, color: "#22c55e" }} />
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", margin: 0, textAlign: "center" }}>
                Ton mot de passe a ete mis a jour avec succes.
              </p>
            </div>
          ) : !ready ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "20px 0" }}>
              <Loader2 style={{ width: 20, height: 20, color: "#6366f1", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.40)" }}>Verification du lien...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 7 }}>
                  Nouveau mot de passe
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"} value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    placeholder="Au moins 6 caracteres"
                    autoComplete="new-password"
                    style={{ ...INPUT_STYLE, paddingRight: 46 }}
                    className="focus:border-violet-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
                  />
                  <button type="button" onClick={() => setShowPwd((v) => !v)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(255,255,255,0.30)" }}>
                    {showPwd ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 7 }}>
                  Confirmer le mot de passe
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConf ? "text" : "password"} value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                    placeholder="Repete ton mot de passe"
                    autoComplete="new-password"
                    style={{ ...INPUT_STYLE, paddingRight: 46 }}
                    className="focus:border-violet-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
                  />
                  <button type="button" onClick={() => setShowConf((v) => !v)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(255,255,255,0.30)" }}>
                    {showConf ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "10px 14px", borderRadius: 12,
                  background: "rgba(239,68,68,0.10)",
                  border: "0.5px solid rgba(239,68,68,0.25)",
                }}>
                  <AlertCircle style={{ width: 14, height: 14, color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 13, color: "rgba(239,68,68,0.90)", lineHeight: 1.45 }}>{error}</span>
                </div>
              )}

              <motion.button
                type="submit" disabled={pending}
                whileTap={!pending ? { scale: 0.97 } : {}}
                style={{
                  width: "100%", padding: "15px", borderRadius: 100,
                  background: pending ? "rgba(79,70,229,0.50)" : "#4f46e5",
                  border: "none", color: "#fff",
                  fontSize: 16, fontWeight: 700,
                  cursor: pending ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: pending ? "none" : "0 4px 20px rgba(79,70,229,0.30)",
                  marginTop: 4, transition: "background 0.2s",
                }}
              >
                {pending
                  ? <><Loader2 style={{ width: 17, height: 17, animation: "spin 1s linear infinite" }} /> Mise a jour...</>
                  : "Mettre a jour le mot de passe"}
              </motion.button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}