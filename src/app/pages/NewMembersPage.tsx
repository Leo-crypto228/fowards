import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Users } from "lucide-react";
import { getMembersHistory, type HistoryMember } from "../api/statsApi";

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

export function NewMembersPage() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<HistoryMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMembersHistory(100)
      .then((r) => setMembers(r.members))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: "#050510" }}>
      {/* Header */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 20,
          background: "rgba(5,5,16,0.92)", backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div
          style={{
            maxWidth: 672, margin: "0 auto",
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px",
          }}
        >
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => navigate(-1)}
            style={{
              background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)",
              borderRadius: 999, width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <ArrowLeft style={{ width: 18, height: 18, color: "rgba(255,255,255,0.75)" }} />
          </motion.button>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.2 }}>
              Nouveaux membres
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", margin: 0, marginTop: 2 }}>
              Les derniers à avoir rejoint Fowards
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 672, margin: "0 auto", padding: "8px 0 80px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: "2.5px solid rgba(99,102,241,0.18)",
              borderTop: "2.5px solid #6366f1",
              animation: "spin 0.7s linear infinite",
            }} />
          </div>
        ) : members.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <Users style={{ width: 40, height: 40, color: "rgba(255,255,255,0.15)", margin: "0 auto 12px" }} />
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 15 }}>Aucun membre pour l'instant</p>
          </div>
        ) : (
          <div>
            {members.map((member, i) => (
              <motion.button
                key={member.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/profile/${member.id}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  width: "100%", padding: "14px 16px",
                  background: "transparent", border: "none",
                  borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                {/* Avatar */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", border: "1.5px solid rgba(99,102,241,0.25)" }}
                    />
                  ) : (
                    <div style={{
                      width: 46, height: 46, borderRadius: "50%",
                      background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 700, color: "#fff",
                    }}>
                      {(member.name[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", truncate: true }}>
                      {member.name}
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", flexShrink: 0 }}>
                      {relTime(member.joinedAt)}
                    </span>
                  </div>
                  {member.objective && (
                    <p style={{
                      fontSize: 13, color: "rgba(255,255,255,0.50)",
                      margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {member.objective}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: "rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <ArrowLeft style={{ width: 13, height: 13, color: "rgba(255,255,255,0.30)", transform: "rotate(180deg)" }} />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
