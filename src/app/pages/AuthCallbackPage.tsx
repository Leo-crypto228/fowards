import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "../api/supabaseClient";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // ── PKCE flow : URL contient ?code=xxx ────────────────────────────
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw new Error(`Échange de session échoué : ${error.message}`);
          if (data.session) {
            setStatus("success");
            setTimeout(() => navigate("/", { replace: true }), 1200);
            return;
          }
        }

        // ── Implicit flow : URL contient #access_token=xxx ─────────────────
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
          const hashParams = new URLSearchParams(hash.slice(1));
          const access_token  = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");
          const type          = hashParams.get("type");

          if (access_token && refresh_token) {
            console.log(`Auth callback implicit flow — type: ${type}`);
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw new Error(`Erreur de session : ${error.message}`);
            setStatus("success");
            setTimeout(() => navigate("/", { replace: true }), 1200);
            return;
          }
        }

        // ── Aucun paramètre valide ─────────────────────────────────────────
        throw new Error("Lien invalide ou expiré. Demande un nouveau lien de connexion.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        console.error("Auth callback error:", msg);
        setErrorMsg(msg);
        setStatus("error");
        setTimeout(() => navigate("/login", { replace: true }), 4000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#000000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Aurora background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(139,92,246,0.18) 0%, transparent 70%)",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 20, position: "relative", zIndex: 1, textAlign: "center",
          maxWidth: 340,
        }}
      >
        {/* Logo */}
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f0f0f5", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
          <span translate="no" className="notranslate">Fowards</span>
        </h1>

        {/* Icon */}
        <motion.div
          key={status}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          style={{
            width: 64, height: 64, borderRadius: "50%",
            background: status === "error"
              ? "rgba(239,68,68,0.14)"
              : status === "success"
              ? "rgba(34,197,94,0.14)"
              : "rgba(139,92,246,0.14)",
            border: status === "error"
              ? "1px solid rgba(239,68,68,0.30)"
              : status === "success"
              ? "1px solid rgba(34,197,94,0.30)"
              : "1px solid rgba(139,92,246,0.28)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {status === "loading" && (
            <Loader2 style={{ width: 26, height: 26, color: "#8b5cf6", animation: "spin 1s linear infinite" }} />
          )}
          {status === "success" && (
            <CheckCircle2 style={{ width: 26, height: 26, color: "#22c55e" }} />
          )}
          {status === "error" && (
            <AlertCircle style={{ width: 26, height: 26, color: "#ef4444" }} />
          )}
        </motion.div>

        {/* Message */}
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#f0f0f5", margin: "0 0 8px" }}>
            {status === "loading" && "Connexion en cours…"}
            {status === "success" && "Connecté avec succès !"}
            {status === "error"   && "Lien invalide"}
          </p>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0, lineHeight: 1.55 }}>
            {status === "loading" && "Veuillez patienter…"}
            {status === "success" && "Redirection vers l'app…"}
            {status === "error"   && (errorMsg || "Redirection vers la page de connexion…")}
          </p>
        </div>
      </motion.div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
