import { motion } from "motion/react";
import flameImg from "figma:asset/4ca8e2e71f08795d9aa80acad2afd770d3206037.png";

interface FlameIconProps {
  size?: number;
}

/**
 * FlameIcon – Ultra-premium flame
 *
 * Stratégie : 4 couches empilées en screen blend mode,
 * chacune avec une animation indépendante aux durées
 * irrationnelles et un easing sinusoïdal ultra-doux.
 * Le halo extérieur et le shimmer central ajoutent
 * de la profondeur lumineuse.
 */

// Easing sinusoïdal : accélération/décélération maximale
const SINE = [0.45, 0, 0.55, 1] as const;

export function FlameIcon({ size = 28 }: FlameIconProps) {
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {/* ── Halo extérieur : glow violet chaud qui respire ── */}
      <motion.div
        style={{
          position: "absolute",
          inset: "-18%",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse 70% 80% at 50% 65%, rgba(120,80,255,0.65) 0%, rgba(99,60,255,0.30) 40%, transparent 70%)",
          filter: `blur(${size * 0.22}px)`,
          mixBlendMode: "screen",
        }}
        animate={{
          opacity:  [0.50, 0.90, 0.55, 0.95, 0.52, 0.88, 0.50],
          scale:    [1.00, 1.18, 1.05, 1.22, 1.02, 1.15, 1.00],
          scaleX:   [1.00, 0.94, 1.06, 0.96, 1.08, 0.95, 1.00],
        }}
        transition={{
          duration: 7.3,
          repeat: Infinity,
          ease: SINE,
          repeatType: "mirror",
          times: [0, 0.18, 0.35, 0.52, 0.68, 0.84, 1],
        }}
      />

      {/* ── Couche 1 · BASE : flamme entière, respiration lente ── */}
      <motion.img
        src={flameImg}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: size,
          height: size,
          objectFit: "contain",
          mixBlendMode: "screen",
          display: "block",
          transformOrigin: "50% 100%",
        }}
        animate={{
          opacity: [0.75, 0.92, 0.78, 0.95, 0.72, 0.90, 0.75],
          scaleX:  [1.00, 1.03, 0.97, 1.04, 0.96, 1.02, 1.00],
          scaleY:  [1.00, 0.97, 1.04, 0.96, 1.03, 0.98, 1.00],
          rotate:  [0,    0.4,  -0.3,  0.5,  -0.4,  0.3,  0   ],
        }}
        transition={{
          duration: 8.1,
          repeat: Infinity,
          ease: SINE,
          repeatType: "mirror",
          times: [0, 0.16, 0.33, 0.50, 0.66, 0.83, 1],
        }}
      />

      {/* ── Couche 2 · CORPS : légèrement réduite, balancement ── */}
      <motion.img
        src={flameImg}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: size,
          height: size,
          objectFit: "contain",
          mixBlendMode: "screen",
          display: "block",
          transformOrigin: "50% 88%",
          clipPath: "polygon(4% 22%, 96% 22%, 100% 100%, 0% 100%)",
        }}
        animate={{
          opacity: [0.80, 0.95, 0.82, 0.98, 0.78, 0.92, 0.80],
          scaleX:  [1.00, 1.055, 0.960, 1.060, 0.955, 1.050, 1.00],
          skewX:   [0,    1.2,   -0.8,   1.5,   -1.0,   0.9,   0  ],
          y:       [0,   -1.0,    0.5,  -1.2,    0.6,  -0.8,   0  ],
        }}
        transition={{
          duration: 5.7,
          repeat: Infinity,
          ease: SINE,
          repeatType: "mirror",
          times: [0, 0.18, 0.35, 0.52, 0.68, 0.84, 1],
        }}
      />

      {/* ── Couche 3 · POINTE : zone haute 0-38%, la plus vive ── */}
      <motion.img
        src={flameImg}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: size,
          height: size,
          objectFit: "contain",
          mixBlendMode: "screen",
          display: "block",
          transformOrigin: "50% 72%",
          clipPath: "polygon(14% 0%, 86% 0%, 92% 38%, 8% 38%)",
        }}
        animate={{
          opacity: [0.70, 1.00, 0.72, 1.00, 0.68, 0.96, 0.70],
          scaleX:  [1.00, 0.88, 1.14, 0.86, 1.12, 0.90, 1.00],
          scaleY:  [1.00, 1.14, 0.90, 1.18, 0.88, 1.12, 1.00],
          skewX:   [0,    3.5,  -4.0,  3.0,  -3.8,  2.8,  0  ],
          y:       [0,   -2.5,   1.2, -2.8,   1.5,  -2.0,  0  ],
          rotate:  [0,    1.5,  -2.0,  1.2,  -1.8,   1.4,  0  ],
        }}
        transition={{
          duration: 3.9,
          repeat: Infinity,
          ease: SINE,
          repeatType: "mirror",
          times: [0, 0.18, 0.35, 0.52, 0.68, 0.84, 1],
        }}
      />

      {/* ── Couche 4 · SHIMMER : éclat lumineux central ── */}
      <motion.div
        style={{
          position: "absolute",
          left: "28%",
          top: "30%",
          width: "44%",
          height: "40%",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(200,170,255,0.85) 0%, rgba(160,120,255,0.35) 45%, transparent 75%)",
          filter: `blur(${size * 0.08}px)`,
          mixBlendMode: "screen",
        }}
        animate={{
          opacity: [0.30, 0.75, 0.32, 0.80, 0.28, 0.70, 0.30],
          scale:   [1.00, 1.30, 0.88, 1.35, 0.90, 1.25, 1.00],
          y:       [0,   -1.5,  0.8, -1.8,  0.9, -1.2,  0  ],
        }}
        transition={{
          duration: 4.6,
          repeat: Infinity,
          ease: SINE,
          repeatType: "mirror",
          times: [0, 0.18, 0.35, 0.52, 0.68, 0.84, 1],
        }}
      />
    </div>
  );
}
