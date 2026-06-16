import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Wrench } from "lucide-react";

// Bandeau générique affiché à la place d'une fonctionnalité mise en pause
// (kill-switch via src/app/config/featureFlags.ts).
function FeatureDisabled({ title, subtitle }: { title: string; subtitle: string }) {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: "100dvh", background: "#000",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "2rem", textAlign: "center",
      paddingTop: "env(safe-area-inset-top, 0px)",
    }}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          width: 64, height: 64, borderRadius: 20, marginBottom: 22,
          background: "rgba(124,58,237,0.12)", border: "0.5px solid rgba(124,58,237,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Wrench style={{ width: 28, height: 28, color: "#a78bfa" }} />
      </motion.div>

      <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: "0 0 10px", maxWidth: 420, lineHeight: 1.3 }}>
        {title}
      </h1>
      <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14.5, lineHeight: 1.6, maxWidth: 380, margin: "0 0 28px" }}>
        {subtitle}
      </p>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/feed")}
        style={{
          background: "#fff", color: "#000", border: "none", borderRadius: 999,
          padding: "11px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        Retour à l'app
      </motion.button>
    </div>
  );
}

// Variantes sans props — utilisables directement comme `Component` dans routes.ts
export function AiDisabledPage() {
  return (
    <FeatureDisabled
      title="L'IA Fowards est temporairement indisponible"
      subtitle="On l'a mise en pause le temps de quelques ajustements. Elle revient très vite — merci de ta patience."
    />
  );
}

export function PaymentsDisabledPage() {
  return (
    <FeatureDisabled
      title="Les abonnements sont temporairement indisponibles"
      subtitle="Le paiement est en pause pour le moment. Reviens un peu plus tard pour passer Premium."
    />
  );
}
