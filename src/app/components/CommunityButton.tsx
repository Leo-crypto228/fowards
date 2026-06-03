import { useNavigate } from "react-router";
import { motion } from "motion/react";

interface Props {
  text: string;          // phrase contextuelle de l'IA
  prefillText: string;   // message user → prérempli dans /create
}

// Bouton "Poste ta situation" affiché sous un message IA quand elle suggère
// de partager sa situation à la communauté. Le clic ouvre /create avec le
// message de l'user prérempli. La logique d'apparition (règle 30 min /
// persistance) est gérée par AIConversationPage.
export function CommunityButton({ text, prefillText }: Props) {
  const navigate = useNavigate();

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{
        fontSize: 13,
        color: "rgba(255,255,255,0.55)",
        marginBottom: 8,
        lineHeight: 1.4,
      }}>
        {text}
      </p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate("/create", { state: { prefillText } })}
        style={{
          background: "linear-gradient(135deg, #6366f1, #7c3aed)",
          border: "none",
          borderRadius: 12,
          padding: "10px 18px",
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          width: "100%",
          fontFamily: "inherit",
        }}
      >
        Poste ta situation
      </motion.button>
    </div>
  );
}
