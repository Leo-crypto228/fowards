/**
 * ActivityRings — 3 anneaux concentriques style Apple Fitness
 * Remplace la carte "Objectifs" dans DashboardStatsCards
 *
 * 🟣 Anneau violet  — Progression réelle de l'objectif principal
 * 🌸 Anneau rose    — Contribution qualitative (posts + commentaires qualifiés)
 * 🔴 Anneau rouge   — Engagement global (score pondéré)
 *
 * IMPORTANT : aucun pourcentage ni signe % ne s'affiche dans l'UI.
 */

import { useState, useEffect, type CSSProperties } from "react";
import { motion } from "motion/react";
import { getRings, type RingsData } from "../api/ringsApi";

// ── Styles uniformes (gradient noir identique aux cartes Constance / DeepWork) ─
const CARD_BG     = "rgba(255,255,255,0.07)";
const CARD_BORDER = "0.5px solid rgba(255,255,255,0.11)";

// ── Paramètres des 3 anneaux ─────────────────────────────────────────────────
//    viewBox "0 0 100 100", centre cx=50 cy=50
//    Géométrie : purple r=44 s=11 [38.5–49.5] | pink r=30 s=11 [24.5–35.5] | red r=16 s=11 [10.5–21.5]
//    Gaps : ~3px entre chaque anneau — centre vide ≈ Ø21
const RINGS = [
  {
    id:     "purple",
    r:      44,
    stroke: 11,
    g0:     "#9333EA",
    g1:     "#C084FC",
    track:  "rgba(147,51,234,0.18)",
    label:  "Objectif",
    dot:    "#A855F7",
  },
  {
    id:     "pink",
    r:      30,
    stroke: 11,
    g0:     "#FF2D78",
    g1:     "#FF79A8",
    track:  "rgba(255,45,120,0.18)",
    label:  "Actions",
    dot:    "#FF2D78",
  },
  {
    id:     "red",
    r:      16,
    stroke: 11,
    g0:     "#FF3B30",
    g1:     "#FF7B6B",
    track:  "rgba(255,59,48,0.18)",
    label:  "Social",
    dot:    "#FF3B30",
  },
] as const;

type RingId = "purple" | "pink" | "red";

// ── Composant SVG d'un anneau individuel ─────────────────────────────────────

function Ring({
  r, stroke, g0, g1, track, id, progress, delay,
}: {
  r: number; stroke: number; g0: string; g1: string; track: string;
  id: string; progress: number; delay: number;
}) {
  const circumference  = 2 * Math.PI * r;
  const targetOffset   = circumference * (1 - Math.min(100, progress) / 100);
  const gradId         = `ring-grad-${id}`;

  return (
    <g>
      {/* Piste de fond colorée */}
      <circle
        cx={50} cy={50} r={r}
        fill="none"
        stroke={track}
        strokeWidth={stroke}
      />
      {/* Arc coloré animé — sans glow */}
      <motion.circle
        cx={50} cy={50} r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: targetOffset }}
        transition={{
          duration: 1.3,
          delay,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
      />
    </g>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  userId: string;
  /** Override direct de l'anneau violet (objectif) — prioritaire sur l'API /rings */
  purpleOverride?: number;
  style?: CSSProperties;
}

export function ActivityRings({ userId, purpleOverride, style }: Props) {
  const [data, setData]       = useState<RingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getRings(userId)
      .then(setData)
      .catch((err) => console.error("ActivityRings fetch error:", err))
      .finally(() => setLoading(false));
  }, [userId]);

  const values: Record<RingId, number> = {
    // Si purpleOverride est fourni, l'anneau objectif = même source que la barre de progression
    purple: purpleOverride !== undefined ? purpleOverride : (data?.purple ?? 0),
    pink:   data?.pink   ?? 0,
    red:    data?.red    ?? 0,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: 0 }}
      style={{
        flex:               1,
        height:             148,
        borderRadius:       20,
        background:         CARD_BG,
        border:             CARD_BORDER,
        backdropFilter:     "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        padding:            "15px 14px",
        display:            "flex",
        flexDirection:      "column",
        justifyContent:     "space-between",
        overflow:           "hidden",
        position:           "relative",
        ...style,
      }}
    >
      {/* Label */}
      <p style={{
        fontSize:      11,
        fontWeight:    700,
        color:         "rgba(255,255,255,0.40)",
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        lineHeight:    1.3,
        position:      "relative",
      }}>
        Activité
      </p>

      {/* SVG anneaux */}
      <div style={{ display: "flex", justifyContent: "center", flex: 1, alignItems: "center" }}>
        <svg
          viewBox="0 0 100 100"
          width="86"
          height="86"
          style={{ transform: "rotate(-90deg)", overflow: "visible" }}
        >
          <defs>
            {RINGS.map((ring) => (
              <linearGradient key={ring.id} id={`ring-grad-${ring.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor={ring.g0} />
                <stop offset="100%" stopColor={ring.g1} />
              </linearGradient>
            ))}
          </defs>

          {loading ? (
            /* Anneaux vides pendant le chargement */
            RINGS.map((ring) => (
              <circle
                key={ring.id}
                cx={50} cy={50} r={ring.r}
                fill="none"
                stroke={ring.track}
                strokeWidth={ring.stroke}
              />
            ))
          ) : (
            RINGS.map((ring, i) => (
              <Ring
                key={ring.id}
                r={ring.r}
                stroke={ring.stroke}
                g0={ring.g0}
                g1={ring.g1}
                track={ring.track}
                id={ring.id}
                progress={values[ring.id as RingId]}
                delay={i * 0.12}
              />
            ))
          )}
        </svg>
      </div>

      {/* Légende — 3 points colorés sans valeurs ni % */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, position: "relative" }}>
        {RINGS.map((ring) => (
          <div key={ring.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              width:        6,
              height:       6,
              borderRadius: "50%",
              background:   ring.dot,
              boxShadow:    `0 0 5px ${ring.dot}`,
              flexShrink:   0,
            }} />
            <span style={{
              fontSize:  9,
              fontWeight: 600,
              color:     "rgba(255,255,255,0.35)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}>
              {ring.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}