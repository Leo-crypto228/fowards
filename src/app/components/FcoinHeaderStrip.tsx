import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { getEarnedFcoins, type EarnedFcoinEntry } from "../api/progressionApi";
import { FCOIN_IMAGES } from "./BadgesSection";

// ── FcoinHeaderStrip ───────────────────────────────────────────────────────────
// Affiche les 3 premiers Fcoins du profil sous forme de cercles superposés.
// S'il y en a plus de 3, affiche "···" à la place du +N.
// Clic → scroll vers la section Fcoins. Polling Supabase toutes les 30s.

interface Props {
  userId: string;
  onScrollToBadges?: () => void;
  pollInterval?: number;
}

const COIN_SIZE = 26;
const OVERLAP   = 9;
const MAX_VISIBLE = 3;

export function FcoinHeaderStrip({ userId, onScrollToBadges, pollInterval = 30_000 }: Props) {
  const [fcoins, setFcoins] = useState<EarnedFcoinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const { earnedHistory } = await getEarnedFcoins(userId);
      setFcoins(earnedHistory ?? []);
    } catch (err) {
      console.error("FcoinHeaderStrip: erreur chargement fcoins:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, pollInterval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, pollInterval]);

  // Skeleton pendant le chargement
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, opacity: 0.35 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(200,200,220,0.45)", letterSpacing: "0.07em", flexShrink: 0 }}>
          Fcoin :
        </span>
        <div style={{ display: "flex" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: COIN_SIZE, height: COIN_SIZE, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.09)",
              marginLeft: i > 0 ? -OVERLAP : 0,
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (fcoins.length === 0) return null;

  const visible = fcoins.slice(0, MAX_VISIBLE);
  const hasMore = fcoins.length > MAX_VISIBLE;

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      onClick={onScrollToBadges}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 14,
        background: "none", border: "none", padding: 0,
        cursor: onScrollToBadges ? "pointer" : "default",
        textAlign: "left",
      }}
    >
      {/* Label */}
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: "rgba(200,200,220,0.45)",
        letterSpacing: "0.07em",
        flexShrink: 0,
        userSelect: "none",
      }}>
        Fcoin :
      </span>

      {/* Cercles superposés — max 3 */}
      <div style={{ display: "flex", alignItems: "center" }}>
        
          {visible.map((coin, i) => {
            const img = FCOIN_IMAGES[coin.id];
            return (
              <motion.div
                key={coin.id}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.20, delay: i * 0.05 }}
                title={coin.name}
                style={{
                  width: COIN_SIZE, height: COIN_SIZE, borderRadius: "50%",
                  background: "#0d0d0d",
                  border: "1.5px solid rgba(255,255,255,0.14)",
                  marginLeft: i > 0 ? -OVERLAP : 0,
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.45)",
                  zIndex: MAX_VISIBLE - i,
                  position: "relative",
                }}
              >
                {img ? (
                  <img src={img} alt={coin.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.65)" }}>
                    {coin.name.charAt(0)}
                  </span>
                )}
              </motion.div>
            );
          })}
        

        {/* 3 points si plus de 3 fcoins */}
        {hasMore && (
          <span style={{
            fontSize: 15, fontWeight: 900,
            color: "rgba(200,200,220,0.35)",
            marginLeft: 6,
            letterSpacing: "0.05em",
            lineHeight: 1,
            userSelect: "none",
          }}>
            ···
          </span>
        )}
      </div>
    </motion.button>
  );
}
