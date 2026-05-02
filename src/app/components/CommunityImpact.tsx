import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Loader2, TrendingUp } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HGET = { Authorization: `Bearer ${publicAnonKey}` };

// ── Static mock impact data ───────────────────────────────────────────────────

const STATIC_IMPACT: Record<string, { weeklyReactions: number[]; weeklyComments: number[] }> = {
  "1": {
    weeklyReactions: [14, 22, 18, 31, 27, 35, 28],
    weeklyComments:  [8,  14, 11, 19, 16, 22, 17],
  },
  "2": {
    weeklyReactions: [32, 44, 38, 55, 48, 61, 52],
    weeklyComments:  [18, 27, 24, 33, 28, 40, 31],
  },
  "3": {
    weeklyReactions: [21, 28, 24, 37, 31, 42, 34],
    weeklyComments:  [12, 18, 15, 24, 19, 28, 21],
  },
  "4": {
    weeklyReactions: [48, 62, 55, 74, 67, 82, 71],
    weeklyComments:  [28, 38, 33, 48, 41, 54, 45],
  },
  "5": {
    weeklyReactions: [22, 31, 26, 40, 34, 45, 37],
    weeklyComments:  [14, 19, 16, 25, 20, 28, 22],
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImpactData {
  weeklyReactions: number[];
  weeklyComments: number[];
}

interface Props {
  communityId: string;
  communityName: string;
  isStatic?: boolean;
}

type FilterType = "reactions" | "commentaires";

// ── Custom pure-CSS bar chart (no recharts — avoids SVG key collisions) ───────

function CssBarChart({ values, maxVal }: { values: number[]; maxVal: number }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{ width: "100%", height: 160, display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Bars area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          padding: "0 2px",
          position: "relative",
        }}
      >
        {values.map((val, i) => {
          const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const isMax = val === maxVal && val > 0;
          const isHov = hovered === i;

          return (
            <div
              key={`bar-col-${i}`}
              style={{
                flex: 1,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                position: "relative",
                cursor: "default",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip on hover */}
              {isHov && val > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    marginBottom: 6,
                    background: "rgba(14,14,22,0.97)",
                    border: "0.5px solid rgba(99,102,241,0.35)",
                    borderRadius: 8,
                    padding: "4px 9px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#a5b4fc",
                    whiteSpace: "nowrap",
                    zIndex: 10,
                    boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
                  }}
                >
                  {val}
                </div>
              )}

              {/* Bar */}
              <motion.div
                key={`bar-${i}-${val}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(pct, val > 0 ? 4 : 2)}%` }}
                transition={{ duration: 0.5, delay: i * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{
                  width: "100%",
                  borderRadius: "5px 5px 2px 2px",
                  background: isMax
                    ? "linear-gradient(180deg,#818cf8,#4f46e5)"
                    : val > 0
                    ? isHov
                      ? "rgba(99,102,241,0.65)"
                      : "rgba(99,102,241,0.40)"
                    : "rgba(255,255,255,0.05)",
                  boxShadow: isMax ? "0 0 10px rgba(99,102,241,0.45)" : "none",
                  transition: "background 0.15s ease",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "6px 2px 0",
        }}
      >
        {values.map((_, i) => (
          <div
            key={`label-${i}`}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 10,
              color: hovered === i ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.25)",
              fontWeight: hovered === i ? 600 : 400,
              transition: "color 0.15s",
            }}
          >
            J{i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CommunityImpact({ communityId, communityName, isStatic = false }: Props) {
  const [data, setData]       = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterType>("reactions");

  useEffect(() => {
    if (isStatic && STATIC_IMPACT[communityId]) {
      setData(STATIC_IMPACT[communityId]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${BASE}/communities/${communityId}/impact`, { headers: HGET })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setData(null);
        } else {
          setData({
            weeklyReactions: d.weeklyReactions || new Array(7).fill(0),
            weeklyComments:  d.weeklyComments  || new Array(7).fill(0),
          });
        }
      })
      .catch((err) => {
        console.error("Erreur chargement impact:", err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [communityId, isStatic]);

  const rawValues = data
    ? (filter === "reactions" ? data.weeklyReactions : data.weeklyComments)
    : new Array(7).fill(0);

  const maxVal  = Math.max(...rawValues, 1);
  const isEmpty = rawValues.every((v) => v === 0);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 }}>
        <Loader2 style={{ width: 18, height: 18, color: "#6366f1" }} className="animate-spin" />
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)" }}>Chargement de l'impact...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 80px" }}>

      {/* ── Bloc : graphique impact ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        style={{
          margin: "0 16px 12px",
          padding: "20px 16px 18px",
          borderRadius: 20,
          border: "0.5px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <TrendingUp style={{ width: 15, height: 15, color: "#818cf8" }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>
            Impact de tous les membres
          </span>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", margin: "0 0 16px" }}>
          Activite globale de {communityName} — 7 derniers jours
        </p>

        {/* Filtres */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {([
            { key: "reactions" as FilterType, label: "Reactions" },
            { key: "commentaires" as FilterType, label: "Commentaires" },
          ]).map((f) => {
            const active = filter === f.key;
            return (
              <motion.button
                key={f.key}
                whileTap={{ scale: 0.94 }}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 999,
                  border: active
                    ? "0.5px solid rgba(99,102,241,0.55)"
                    : "0.5px solid rgba(255,255,255,0.12)",
                  background: active
                    ? "rgba(99,102,241,0.20)"
                    : "transparent",
                  color: active
                    ? "#a5b4fc"
                    : "rgba(255,255,255,0.40)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                }}
              >
                {f.label}
              </motion.button>
            );
          })}
        </div>

        {/* Graphique */}
        {isEmpty ? (
          <div style={{ textAlign: "center", padding: "28px 0", fontSize: 13, color: "rgba(255,255,255,0.22)" }}>
            Aucune donnee pour cette periode
          </div>
        ) : (
          <CssBarChart key={filter} values={rawValues} maxVal={maxVal} />
        )}

        {/* Legende axe */}
        <div style={{
          marginTop: 4,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.20)" }}>J1 (il y a 6 jours) → J7 (aujourd'hui)</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.20)" }}>Axe Y : nombre</span>
        </div>
      </motion.div>

    </div>
  );
}
