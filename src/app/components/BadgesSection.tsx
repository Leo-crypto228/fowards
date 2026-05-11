import { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { getEarnedFcoins, type EarnedFcoinEntry } from "../api/progressionApi";
import { useFollow } from "../context/FollowContext";

// ── Figma assets : images Fcoin ───────────────────────────────────────────────
import progressionImg1 from "figma:asset/8a40cfe599e1d2546bcbd2352ad685810c61fd76.png";
import progressionImg2 from "figma:asset/38d65fad1b6a9a54c394d458d3da4981d3e242c2.png";
import progressionImg3 from "figma:asset/5cbd05408de823cd0296472e90d2be3db0a36a12.png";
import creationImg1    from "figma:asset/5700b0a9982d5751dc7bdf64d05101252466dd43.png";
import creationImg2    from "figma:asset/e12fd99971493a5270a251163e3d8ac3072825c8.png";
import creationImg3    from "figma:asset/301b9647c9122f6905e773acad8dc9c8ae78264e.png";
import impactImg1      from "figma:asset/aeb19e4687a7f7a730bf518dc6a3c50cbe8cab78.png";
import impactImg2      from "figma:asset/b5420e1e4dcb28c415b729a8b54919c339bf0feb.png";
import impactImg3      from "figma:asset/37bde483f7ebc8284a64ff0f671a820654728cb3.png";
import communauteImg1  from "figma:asset/f9ecd6857819c90f6a48373ff634dab7cf0fd1d4.png";
import communauteImg2  from "figma:asset/fffa1a3d255bdb60fb45607572f2724445bb79e8.png";
import communauteImg3  from "figma:asset/eb64d44556bc55a434a817d786f7f0cb9e032875.png";
import speciauxImg1    from "figma:asset/e2110878556a04164dce9d4c4d38bb88ba4cc03e.png";
import speciauxImg2    from "figma:asset/b3ae354120773b771d9831afb09d5bc2bbe5cb1e.png";
import speciauxImg3    from "figma:asset/7ff599b653b6137fb01267df900ccb6ee52ffa2c.png";

// ── Map fcoinKey → image ──────────────────────────────────────────────────────
export const FCOIN_IMAGES: Record<string, string> = {
  streak_2:          progressionImg1,
  streak_7:          progressionImg2,
  streak_30:         progressionImg3,
  posts_1:           creationImg1,
  posts_10:          creationImg2,
  posts_50:          creationImg3,
  reactions_first:   impactImg1,
  reactions_100:     impactImg2,
  reactions_1000:    impactImg3,
  community_join:    communauteImg1,
  community_20msg:   communauteImg2,
  community_100msg:  communauteImg3,
  rare_early:        speciauxImg1,
  rare_pioneer:      speciauxImg2,
  rare_first_goal:   speciauxImg3,
  social_10profiles: communauteImg1,
  social_10comments: impactImg1,
  social_10follows:  communauteImg2,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return "";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return "il y a 1 jour";
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "il y a 1 semaine";
  if (diffWeeks < 4) return `il y a ${diffWeeks} semaines`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "il y a 1 mois";
  return `il y a ${diffMonths} mois`;
}

const CIRCLE = 52;
const HALF   = CIRCLE / 2;

// ── FcoinCircle ───────────────────────────────────────────────────────────────
function FcoinCircle({ fcoinId, name }: { fcoinId: string; name: string }) {
  const img = FCOIN_IMAGES[fcoinId];
  return (
    <div style={{
      width: CIRCLE, height: CIRCLE, borderRadius: "50%",
      background: "#0d0d0d",
      border: "1.5px solid rgba(255,255,255,0.12)",
      flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.40)",
    }}>
      {img ? (
        <img src={img} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
      ) : (
        <span style={{ fontSize: 20, fontWeight: 800, color: "rgba(255,255,255,0.70)" }}>
          {name.charAt(0)}
        </span>
      )}
    </div>
  );
}

// ── Timeline connector ────────────────────────────────────────────────────────
function TimelineConnector() {
  return (
    <div style={{
      marginLeft: HALF - 1,
      width: 2, height: 14,
      borderRadius: 999,
      background: "rgba(255,255,255,0.14)",
    }} />
  );
}

// ── FcoinRow ──────────────────────────────────────────────────────────────────
function FcoinRow({ entry, index }: { entry: EarnedFcoinEntry; index: number }) {
  const [showDetail, setShowDetail] = useState(false);
  const ago = timeAgo(entry.earnedAt);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.26, delay: index * 0.06 }}
    >
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowDetail((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          paddingTop: 4, paddingBottom: 4,
          cursor: "pointer",
        }}
      >
        <FcoinCircle fcoinId={entry.id} name={entry.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 17, fontWeight: 700,
            color: "rgba(240,240,245,0.92)",
            letterSpacing: "-0.1px", margin: "0 0 3px",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            lineHeight: 1.15,
          }}>
            {entry.name}
          </p>
          {ago && (
            <p style={{
              fontSize: 13, fontWeight: 500,
              color: "rgba(200,200,215,0.42)",
              margin: 0, lineHeight: 1.2,
            }}>
              {ago}
            </p>
          )}
        </div>
      </motion.div>

      {/* Detail tooltip on tap */}
      
        {showDetail && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.20 }}
            style={{ overflow: "hidden", marginLeft: CIRCLE + 14, marginBottom: 4 }}
          >
            <div style={{
              background: "rgba(139,92,246,0.08)",
              border: "0.5px solid rgba(139,92,246,0.22)",
              borderRadius: 10,
              padding: "8px 12px",
              marginBottom: 2,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(167,139,250,0.80)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                Déverrouillé via
              </p>
              <p style={{ fontSize: 13, color: "rgba(220,220,235,0.70)", margin: 0 }}>
                {entry.condition}
              </p>
              {entry.earnedAt && (
                <p style={{ fontSize: 11, color: "rgba(144,144,168,0.45)", marginTop: 4 }}>
                  {new Date(entry.earnedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
          </motion.div>
        )}
      
    </motion.div>
  );
}

/* ─── ObjectiveLine interface (kept for Profile.tsx compatibility) ─────── */
interface ObjectiveLine {
  goal:  string;
  value: string;
}

/* ─── BadgesSection ──────────────────────────────────────────────────────── */

export function BadgesSection({
  surfaceStyle = {},
  borderRadius = 22,
  fadeBg = "rgba(13,13,13,0.92)",
  objective: _objective,
  userId: userIdProp,
}: {
  surfaceStyle?: React.CSSProperties;
  borderRadius?: number;
  fadeBg?: string;
  objective?: ObjectiveLine;
  /** Si fourni, affiche les Fcoins de cet utilisateur. Sinon, utilise l'utilisateur connecté. */
  userId?: string;
}) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const navigate   = useNavigate();
  const { currentUserId } = useFollow();

  // userId effectif : prop prioritaire, sinon connecté
  const effectiveUserId = userIdProp || currentUserId;

  const [earnedList, setEarnedList] = useState<EarnedFcoinEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);

  const fetchFcoins = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    setError(false);
    try {
      const { earnedHistory } = await getEarnedFcoins(effectiveUserId);
      setEarnedList(earnedHistory || []);
    } catch (err) {
      console.error("BadgesSection: erreur fetch fcoins:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => { fetchFcoins(); }, [fetchFcoins]);

  const TITLE_SIZE = 22;
  const LINK_SIZE  = 11;
  const SCROLL_H   = 180;

  return (
    <div style={{ ...surfaceStyle, borderRadius, padding: "18px 18px 0" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{
          fontSize: TITLE_SIZE, fontWeight: 700,
          color: "#f0f0f5", letterSpacing: "-0.1px", margin: 0,
        }}>
          Fcoin obtenu
        </p>
        <button
          onClick={() => navigate("/fcoins")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 0, fontSize: LINK_SIZE, fontWeight: 400,
            color: "rgba(255,255,255,0.50)",
            textDecoration: "underline", textUnderlineOffset: "2px",
            whiteSpace: "nowrap",
          }}
        >
          Voir tous les Fcoin
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{ position: "relative" }}>
        <style>{`.fcoin-scroll::-webkit-scrollbar { display: none; }`}</style>

        {loading ? (
          <div style={{ height: SCROLL_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 style={{ width: 20, height: 20, color: "rgba(139,92,246,0.50)" }} className="animate-spin" />
          </div>
        ) : error ? (
          <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontSize: 13, color: "rgba(144,144,168,0.40)", textAlign: "center" }}>
              Impossible de charger les Fcoins.
            </p>
          </div>
        ) : earnedList.length === 0 ? (
          <div style={{ height: SCROLL_H, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {/* Placeholder circles */}
            <div style={{ display: "flex", gap: -8, alignItems: "center" }}>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.3 }}
                  style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: "rgba(139,92,246,0.10)",
                    border: "1px solid rgba(139,92,246,0.18)",
                    marginLeft: i > 0 ? -10 : 0,
                  }}
                />
              ))}
            </div>
            <p style={{ fontSize: 13, color: "rgba(144,144,168,0.38)", textAlign: "center", margin: 0 }}>
              Continue ta progression pour débloquer tes premiers Fcoins !
            </p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="fcoin-scroll"
            style={{
              height: SCROLL_H,
              overflowY: "auto", overflowX: "hidden",
              scrollbarWidth: "none",
            }}
          >
            {earnedList.map((entry, i) => (
              <div key={entry.id}>
                <FcoinRow entry={entry} index={i} />
                {i < earnedList.length - 1 && <TimelineConnector />}
              </div>
            ))}
          </div>
        )}

        {/* Bottom gradient fade */}
        {earnedList.length > 0 && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 52,
            background: `linear-gradient(to top, ${fadeBg} 0%, transparent 100%)`,
            pointerEvents: "none",
            borderRadius: `0 0 ${borderRadius}px ${borderRadius}px`,
          }} />
        )}
      </div>

    </div>
  );
}
