import { motion } from "motion/react";

// ── Gradient violet unifié (tous les tiers) ───────────────────────────────────
const STREAK_GRADIENT = `
  radial-gradient(ellipse at 28% 72%, #5b21b6 0%, transparent 55%),
  radial-gradient(ellipse at 74% 68%, #7c3aed 0%, transparent 52%),
  radial-gradient(ellipse at 50% 14%, #c4b5fd 0%, transparent 58%),
  radial-gradient(ellipse at 16% 32%, #8b5cf6 0%, transparent 50%),
  radial-gradient(ellipse at 78% 34%, #a78bfa 0%, transparent 48%),
  #6d28d9
`;

interface StreakBadgeProps {
  value: number;
  small?: boolean;
  profile?: boolean;
  hideAura?: boolean;
}

export function StreakBadge({ value, small = false, profile = false, hideAura = false }: StreakBadgeProps) {
  // tier -1 : masqué  |  tier 0 : 0-2 (neutre)
  // tier 0.5 : 3-24 (mini halo)  |  tier 1 : 25-99  |  tier 2 : 100+
  const rawTier = hideAura ? -1 : value >= 100 ? 2 : value >= 25 ? 1 : value >= 3 ? 0.5 : 0;
  const tier = rawTier; // on garde le demi-tier comme valeur numérique

  const circleSize = profile ? 58 : small ? 27 : 36;
  const fontSize   = profile ? 42 : small ? 18 : 26;

  const jetExtend = tier === 2
    ? (profile ? 26 : small ? 14 : 19)
    : (profile ? 52 : small ? 28 : 38);
  const jetHeight = profile ? 14 : small ? 7 : 10;
  const jetWidth  = circleSize + jetExtend * 2;

  const auraExtra = profile ? 20 : small ? 10 : 14;
  const blur1     = profile ? 3  : small ? 1.5 : 2;
  const blur2     = profile ? 7  : small ? 4   : 5;
  const blur3     = profile ? 10 : small ? 6   : 8;

  return (
    <div style={{
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      overflow: "visible",
    }}>

      {/* ════════════════════════════════════════════════════════════════════
          TIER 2 (100+) — Jets allongés + aura violet lumineuse
      ════════════════════════════════════════════════════════════════════ */}
      {tier === 2 && (
        <>
          {/* Aura violet lumineuse */}
          <motion.div
            animate={{ scale: [1, 1.22, 1], opacity: [0.40, 0.70, 0.40] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: circleSize + auraExtra + 12,
              height: circleSize + auraExtra + 12,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(167,139,250,0.75) 0%, rgba(139,92,246,0.50) 35%, rgba(109,40,217,0.22) 65%, transparent 80%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          <motion.div
            animate={{ scale: [1, 1.10, 1], opacity: [0.60, 0.90, 0.60] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            style={{
              position: "absolute",
              width: circleSize + (profile ? 10 : small ? 5 : 7),
              height: circleSize + (profile ? 10 : small ? 5 : 7),
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(196,181,253,0.85) 0%, rgba(139,92,246,0.55) 45%, transparent 72%)",
              filter: `blur(${profile ? 3 : small ? 1.5 : 2}px)`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          {/* Jets ambiants larges */}
          <motion.div
            animate={{ scaleX: [1, 1.14, 1], opacity: [0.30, 0.52, 0.30] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: jetWidth * 1.30,
              height: jetHeight * 2.8,
              background: "radial-gradient(ellipse at center, rgba(139,92,246,0.50) 0%, rgba(99,102,241,0.38) 20%, rgba(251,191,36,0.28) 48%, rgba(251,146,60,0.14) 62%, transparent 72%)",
              borderRadius: 999,
              transform: "rotate(-7deg)",
              filter: `blur(${blur3}px)`,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
          <motion.div
            animate={{ scaleX: [1, 1.10, 1], opacity: [0.55, 0.82, 0.55] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            style={{
              position: "absolute",
              width: jetWidth * 1.10,
              height: jetHeight * 1.7,
              background: "radial-gradient(ellipse at center, rgba(167,139,250,0.72) 0%, rgba(109,40,217,0.55) 18%, rgba(196,120,50,0.45) 42%, rgba(251,146,60,0.22) 60%, transparent 72%)",
              borderRadius: 999,
              transform: "rotate(-7deg)",
              filter: `blur(${blur2}px)`,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
          <motion.div
            animate={{ scaleX: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            style={{
              position: "absolute",
              width: jetWidth,
              height: jetHeight,
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.98) 0%, rgba(196,181,253,0.92) 10%, rgba(139,92,246,0.82) 22%, rgba(99,102,241,0.68) 32%, rgba(234,179,8,0.72) 50%, rgba(251,146,60,0.40) 64%, transparent 76%)",
              borderRadius: 999,
              transform: "rotate(-7deg)",
              filter: `blur(${blur1}px)`,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.80, 0.55] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            style={{
              position: "absolute",
              width: circleSize + (profile ? 18 : small ? 9 : 13),
              height: circleSize + (profile ? 18 : small ? 9 : 13),
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(196,181,253,0.30) 0%, rgba(139,92,246,0.50) 38%, rgba(234,179,8,0.32) 65%, rgba(251,146,60,0.18) 80%, transparent 92%)",
              filter: `blur(${profile ? 6 : small ? 3 : 4}px)`,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TIER 1 (25-99) — Aura violet pulsante + anneau conic violet
      ════════════════════════════════════════════════════════════════════ */}
      {tier === 1 && (
        <>
          {/* Halo radial violet doux */}
          <motion.div
            animate={{ scale: [1, 1.20, 1], opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: circleSize + auraExtra + 10,
              height: circleSize + auraExtra + 10,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(167,139,250,0.55) 0%, rgba(139,92,246,0.32) 45%, rgba(109,40,217,0.14) 70%, transparent 85%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          {/* Anneau rotatif conic */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute",
              width: circleSize + auraExtra,
              height: circleSize + auraExtra,
              borderRadius: "50%",
              background: "conic-gradient(from 0deg, #8b5cf6, #7c3aed, #a78bfa, #c4b5fd, #8b5cf6, #6d28d9, #a78bfa, #8b5cf6)",
              filter: "blur(5px)",
              opacity: 0.72,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TIER 0.5 (3-24) — Mini halo pulsant discret
      ════════════════════════════════════════════════════════════════════ */}
      {tier === 0.5 && (
        <>
          {/* Halo externe très doux — pulse lente */}
          <motion.div
            animate={{ scale: [1, 1.28, 1], opacity: [0.0, 0.30, 0.0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: circleSize + (profile ? 22 : small ? 11 : 15),
              height: circleSize + (profile ? 22 : small ? 11 : 15),
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(167,139,250,0.55) 0%, rgba(139,92,246,0.28) 50%, transparent 80%)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          {/* Halo interne plus chaud — pulse légèrement décalée */}
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.18, 0.48, 0.18] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            style={{
              position: "absolute",
              width: circleSize + (profile ? 10 : small ? 5 : 7),
              height: circleSize + (profile ? 10 : small ? 5 : 7),
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(196,181,253,0.70) 0%, rgba(139,92,246,0.40) 45%, transparent 72%)",
              filter: `blur(${profile ? 2.5 : small ? 1.5 : 2}px)`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          {/* Micro-anneau statique tenu — luminosité constante */}
          <div
            style={{
              position: "absolute",
              width: circleSize + (profile ? 6 : small ? 4 : 5),
              height: circleSize + (profile ? 6 : small ? 4 : 5),
              borderRadius: "50%",
              background: "radial-gradient(circle, transparent 55%, rgba(139,92,246,0.22) 75%, rgba(109,40,217,0.12) 90%, transparent 100%)",
              filter: `blur(${profile ? 1.5 : small ? 0.8 : 1}px)`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          BALLE PRINCIPALE (tous les tiers) — Full violet
      ════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: "50%",
          background: STREAK_GRADIENT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
          overflow: "hidden",
          flexShrink: 0,
          boxShadow:
            tier === 0.5
              ? `0 0 ${profile ? 10 : small ? 5 : 7}px rgba(139,92,246,0.35), 0 0 ${profile ? 18 : small ? 9 : 13}px rgba(109,40,217,0.18)`
              : tier === 1
              ? "0 0 14px rgba(139,92,246,0.75), 0 0 28px rgba(109,40,217,0.40)"
              : tier === 2
              ? "0 0 16px rgba(139,92,246,0.80), 0 0 32px rgba(167,139,250,0.45), 0 0 48px rgba(251,191,36,0.18)"
              : "none",
        }}
      >
        {/* Orbes internes animés (tier 1 & 2) */}
        {tier >= 1 && (
          <>
            <motion.div
              animate={{ x: [-5, 5, -5], y: [3, -4, 3] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute",
                width: "65%", height: "65%",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(196,181,253,0.45) 0%, transparent 70%)",
                top: "4%", right: "4%",
                pointerEvents: "none",
              }}
            />
            <motion.div
              animate={{ x: [4, -5, 4], y: [-3, 5, -3] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
              style={{
                position: "absolute",
                width: "58%", height: "58%",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(109,40,217,0.50) 0%, transparent 70%)",
                bottom: "4%", left: "4%",
                pointerEvents: "none",
              }}
            />
          </>
        )}

        {/* Shimmer intérieur rotatif (tier 2 uniquement) */}
        {tier === 2 && (
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute",
              inset: -6,
              borderRadius: "50%",
              background: "conic-gradient(from 0deg, transparent 0%, rgba(196,181,253,0.14) 18%, transparent 36%, rgba(255,255,255,0.08) 54%, transparent 72%, rgba(196,181,253,0.11) 90%, transparent 100%)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Numéro */}
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize,
            color: "#ffffff",
            lineHeight: 1,
            position: "relative",
            zIndex: 5,
            textShadow: "0 1px 8px rgba(0,0,0,0.55)",
            letterSpacing: "0.01em",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
