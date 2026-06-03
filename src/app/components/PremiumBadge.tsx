import { motion } from "motion/react";

// CTA Premium — pilule gradient gris (comme la barre de saisie IA),
// badge certifié violet + texte "Premium" blanc. Réutilisé page IA + profil.
export function PremiumCtaButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: "linear-gradient(135deg, #2e2e36 0%, #1c1c20 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 999, padding: "6px 12px", cursor: "pointer",
        boxShadow: "0 2px 12px rgba(0,0,0,0.40)", fontFamily: "inherit",
      }}
    >
      <VerifiedIcon size={14} color="#a78bfa" />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", lineHeight: 1 }}>Premium</span>
    </motion.button>
  );
}

// Badge vérifié violet — coche blanche sur fond violet, pas de fond extérieur
export function PremiumBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const px = size === "sm" ? 14 : 18;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
      <VerifiedIcon size={px} />
      <span style={{
        fontWeight: 700,
        fontSize: size === "sm" ? 9 : 11,
        color: "#a78bfa",
        letterSpacing: 0.2,
        lineHeight: 1,
      }}>
        Premium
      </span>
    </span>
  );
}

// Icône badge vérifié — même forme que la coche certifiée, en violet
export function VerifiedIcon({ size = 20, color = "#7c3aed" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Badge starburst rempli */}
      <path
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
        fill={color}
        stroke="none"
      />
      {/* Coche blanche */}
      <path
        d="m9 12 2 2 4-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
