import { useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

export function PremiumSuccessPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    (auth as any).refreshPremiumStatus?.();
  }, []);

  return (
    <div
      style={{
        background: "#000",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ fontSize: "5rem", lineHeight: 1, marginBottom: "1.5rem" }}
      >
        🎉
      </motion.div>

      <motion.h1
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
        style={{
          color: "#fff",
          fontSize: "clamp(1.5rem, 5vw, 2.5rem)",
          fontWeight: 700,
          margin: "0 0 1rem",
        }}
      >
        Bienvenue dans Fowards Premium !
      </motion.h1>

      <motion.p
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.5, ease: "easeOut" }}
        style={{
          color: "rgba(255,255,255,0.65)",
          fontSize: "clamp(0.95rem, 3vw, 1.125rem)",
          maxWidth: "480px",
          lineHeight: 1.6,
          margin: "0 0 2.5rem",
        }}
      >
        Ton abonnement est actif. Toutes tes fonctionnalites Premium sont debloquees.
      </motion.p>

      <motion.button
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate("/ai")}
        style={{
          background: "#fff",
          color: "#000",
          border: "none",
          borderRadius: "999px",
          padding: "0.8rem 2.2rem",
          fontSize: "1rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Retour a l&apos;app
      </motion.button>
    </div>
  );
}
