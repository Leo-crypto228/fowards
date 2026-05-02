import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Trophy, Star, Zap, MessageSquare } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useAuth } from "../context/AuthContext";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HGET = { Authorization: `Bearer ${publicAnonKey}` };

interface LeaderEntry {
  userId: string;
  name: string;
  avatar: string;
  posts: number;
  reactionsReceived: number;
  score: number;
}

interface Props {
  communityId: string;
}

// ── Médailles ─────────────────────────────────────────────────────────────────
const MEDALS = [
  { rank: 1, emoji: "🥇", color: "#fbbf24", glow: "rgba(251,191,36,0.35)" },
  { rank: 2, emoji: "🥈", color: "#94a3b8", glow: "rgba(148,163,184,0.25)" },
  { rank: 3, emoji: "🥉", color: "#f97316", glow: "rgba(249,115,22,0.25)" },
];

function getMedal(rank: number) {
  return MEDALS.find((m) => m.rank === rank) ?? null;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ src, name, size = 48 }: { src: string; name: string; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
        background: "linear-gradient(135deg,#4f46e5,#818cf8)",
        border: "1.5px solid rgba(99,102,241,0.30)",
      }}
    >
      {src ? (
        <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: Math.floor(size * 0.35), fontWeight: 700, color: "#fff",
        }}>
          {(name || "?").slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

// ── Podium (top 3) ─────────────────────────────────────────────────────────────
function Podium({ top3 }: { top3: LeaderEntry[] }) {
  const order = [1, 0, 2]; // affichage : 2e, 1er, 3e
  const heights = [80, 108, 64];
  const labels = ["🥈 2ème", "🥇 1er", "🥉 3ème"];

  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12, marginBottom: 24, padding: "0 8px" }}>
      {order.map((idx, displayPos) => {
        const entry = top3[idx];
        if (!entry) return <div key={displayPos} style={{ flex: 1 }} />;
        const medal = getMedal(idx + 1)!;
        const h = heights[displayPos];

        return (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: displayPos * 0.12, duration: 0.4, ease: [0.25, 0, 0.35, 1] }}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
          >
            {/* Avatar + médaille */}
            <div style={{ position: "relative" }}>
              <div style={{
                width: idx === 0 ? 58 : 46, height: idx === 0 ? 58 : 46,
                borderRadius: "50%", overflow: "hidden",
                border: `2px solid ${medal.color}`,
                boxShadow: `0 0 16px ${medal.glow}`,
              }}>
                {entry.avatar ? (
                  <img src={entry.avatar} alt={entry.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    background: "linear-gradient(135deg,#4f46e5,#818cf8)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700, color: "#fff",
                  }}>
                    {(entry.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{
                position: "absolute", bottom: -6, right: -6, fontSize: 16,
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
              }}>
                {medal.emoji}
              </div>
            </div>

            {/* Nom */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.75)",
              textAlign: "center", maxWidth: 70, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {entry.name.split(" ")[0]}
            </div>

            {/* Socle */}
            <div style={{
              width: "100%", height: h, borderRadius: "10px 10px 0 0",
              background: idx === 0
                ? `linear-gradient(180deg, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.06) 100%)`
                : `rgba(255,255,255,0.04)`,
              border: `0.5px solid ${idx === 0 ? "rgba(251,191,36,0.30)" : "rgba(255,255,255,0.08)"}`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            }}>
              <span style={{ fontSize: idx === 0 ? 18 : 16, fontWeight: 700, color: medal.color }}>
                {entry.score}
              </span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                pts
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Ligne classement ──────────────────────────────────────────────────────────
function LeaderRow({
  entry,
  rank,
  maxScore,
  isMe,
  delay,
}: {
  entry: LeaderEntry;
  rank: number;
  maxScore: number;
  isMe: boolean;
  delay: number;
}) {
  const medal = getMedal(rank);
  const pct = maxScore > 0 ? Math.round((entry.score / maxScore) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.30, ease: [0.25, 0, 0.35, 1] }}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px",
        borderRadius: 18,
        background: isMe
          ? "rgba(99,102,241,0.10)"
          : "rgba(255,255,255,0.03)",
        border: isMe
          ? "0.5px solid rgba(99,102,241,0.28)"
          : "0.5px solid rgba(255,255,255,0.055)",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Barre de fond */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ delay: delay + 0.15, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          background: isMe
            ? "linear-gradient(90deg, rgba(99,102,241,0.12) 0%, transparent 100%)"
            : "linear-gradient(90deg, rgba(255,255,255,0.025) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Rang */}
      <div style={{
        width: 28, textAlign: "center", flexShrink: 0,
        fontSize: medal ? 18 : 13,
        fontWeight: medal ? 400 : 700,
        color: medal ? "inherit" : "rgba(255,255,255,0.25)",
      }}>
        {medal ? medal.emoji : `${rank}`}
      </div>

      {/* Avatar */}
      <Avatar src={entry.avatar} name={entry.name} size={40} />

      {/* Infos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: isMe ? "#c7d2fe" : "rgba(255,255,255,0.85)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {entry.name}
          {isMe && (
            <span style={{ fontSize: 10, color: "#818cf8", marginLeft: 6, fontWeight: 600 }}>Toi</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <MessageSquare style={{ width: 10, height: 10, color: "rgba(129,140,248,0.55)" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.32)" }}>{entry.posts} posts</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Star style={{ width: 10, height: 10, color: "rgba(251,191,36,0.55)" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.32)" }}>{entry.reactionsReceived} réactions</span>
          </div>
        </div>
      </div>

      {/* Score */}
      <div style={{
        textAlign: "right", flexShrink: 0,
        fontSize: 16, fontWeight: 800,
        color: isMe ? "#a5b4fc" : "rgba(255,255,255,0.55)",
      }}>
        {entry.score}
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          pts
        </div>
      </div>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function CommunityLeaderboard({ communityId }: Props) {
  const { user } = useAuth();
  const userId = user?.supabaseId ?? "";

  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [total, setTotal]             = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/communities/${communityId}/leaderboard?limit=15`, { headers: HGET })
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(data.leaderboard ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => console.error("Erreur chargement leaderboard:", err))
      .finally(() => setLoading(false));
  }, [communityId]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 }}>
        <Loader2 style={{ width: 18, height: 18, color: "#6366f1" }} className="animate-spin" />
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)" }}>Calcul du classement…</span>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          margin: "32px 16px", padding: "40px 24px",
          borderRadius: 24, textAlign: "center",
          background: "rgba(99,102,241,0.04)",
          border: "0.5px dashed rgba(99,102,241,0.20)",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 14 }}>🏆</div>
        <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.70)", margin: "0 0 8px" }}>
          Aucun classement pour l'instant
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.30)", margin: 0, lineHeight: 1.6 }}>
          Publie dans les canaux pour apparaître ici !
        </p>
      </motion.div>
    );
  }

  const top3    = leaderboard.slice(0, 3);
  const rest    = leaderboard.slice(3);
  const maxScore = leaderboard[0]?.score ?? 1;
  const myRank   = leaderboard.findIndex((e) => e.userId === userId);

  return (
    <div style={{ padding: "0 0 80px" }}>

      {/* Header */}
      <div style={{ padding: "8px 16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy style={{ width: 16, height: 16, color: "#fbbf24" }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>
              Classement
            </span>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", margin: "3px 0 0" }}>
            {total} contributeur{total > 1 ? "s" : ""} · score = posts×5 + réactions×2
          </p>
        </div>
        {myRank >= 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 12px", borderRadius: 999,
            background: "rgba(99,102,241,0.14)",
            border: "0.5px solid rgba(99,102,241,0.30)",
          }}>
            <Zap style={{ width: 11, height: 11, color: "#818cf8" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#a5b4fc" }}>
              #{myRank + 1}
            </span>
          </div>
        )}
      </div>

      {/* Podium */}
      {top3.length >= 2 && <Podium top3={top3} />}

      {/* Liste */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 12px" }}>
        {leaderboard.map((entry, i) => (
          <LeaderRow
            key={entry.userId}
            entry={entry}
            rank={i + 1}
            maxScore={maxScore}
            isMe={entry.userId === userId}
            delay={i * 0.04}
          />
        ))}
      </div>
    </div>
  );
}
