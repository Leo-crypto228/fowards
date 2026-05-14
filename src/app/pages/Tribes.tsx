import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Search } from "lucide-react";

import { CommunitySubscribeButton } from "../components/CommunitySubscribeButton";
import { useCommunityMember } from "../context/CommunityMemberContext";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useAuth } from "../context/AuthContext";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { Authorization: `Bearer ${publicAnonKey}` };

type Mentality = "Objectif" | "Passion";

interface Community {
  id: string;
  name: string;
  avatar: string;
  members: number;
  activeMembers: number;
  streak: number;
  constance: number;
  mentality: Mentality;
  description: string;
  createdBy?: string;
}

function resolveAvatar(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith("http")) return raw;
  return `https://${projectId}.supabase.co/storage/v1/object/public/${raw}`;
}

// ── Fetch dynamique ────────────────────────────────────────────────────────────
async function fetchDynamicCommunities(): Promise<Community[]> {
  try {
    const res = await fetch(`${BASE}/communities`, { headers: H });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.communities)) return [];
    return data.communities.map((c: any) => ({
      id: String(c.id),
      name: c.name ?? "Communauté",
      avatar: resolveAvatar(c.avatar ?? ""),
      members: typeof c.members === "number" ? c.members : 0,
      activeMembers: typeof c.activeMembers === "number" ? c.activeMembers : 0,
      streak: typeof c.streak === "number" ? c.streak : 0,
      constance: typeof c.constance === "number" ? c.constance : 0,
      mentality: (c.mentality === "Passion" ? "Passion" : "Objectif") as Mentality,
      description: c.description ?? "",
      createdBy: c.createdBy ?? undefined,
    }));
  } catch {
    return [];
  }
}

// ── Sous-composant CommunityCard ───────────────────────────────────────────────
function CommunityCard({
  community,
  currentUserSupabaseId,
}: {
  community: Community;
  currentUserSupabaseId: string;
}) {
  const navigate = useNavigate();
  const { getMemberCount } = useCommunityMember();
  const liveCount = getMemberCount(community.id);
  const displayMembers = liveCount !== null ? liveCount : community.members;

  const isCreator =
    !!community.createdBy &&
    !!currentUserSupabaseId &&
    community.createdBy === currentUserSupabaseId;

  const activeCount = Math.max(1, community.activeMembers);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        onClick={() => navigate(`/tribes/${community.id}`)}
        style={{
          padding: "14px 4px 12px",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
        whileTap={{ scale: 0.985 }}
      >
        {/* Name row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: "#fff" }}>
            {community.name}
          </span>
          {isCreator && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#a78bfa",
              background: "rgba(139,92,246,0.18)", border: "0.5px solid rgba(139,92,246,0.35)",
              borderRadius: 999, padding: "1px 7px", flexShrink: 0,
            }}>
              Admin
            </span>
          )}
        </div>

        {/* Photo + info row */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {/* Avatar */}
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            overflow: "hidden", background: "rgba(255,255,255,0.08)",
          }}>
            {community.avatar ? (
              <img
                src={community.avatar}
                alt={community.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                🏠
              </div>
            )}
          </div>

          {/* Right: active members + description */}
          <div style={{ flex: 1, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", fontWeight: 500 }}>
                {activeCount} membre{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}
              </span>
              {!isCreator && (
                <div onClick={(e) => e.stopPropagation()}>
                  <CommunitySubscribeButton
                    communityId={community.id}
                    communityName={community.name}
                    size="sm"
                    stopPropagation
                  />
                </div>
              )}
            </div>
            {community.description ? (
              <p style={{
                fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0,
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"],
                WebkitLineClamp: 3,
                overflow: "hidden",
              } as React.CSSProperties}>
                {community.description}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", margin: 0, fontStyle: "italic" }}>
                {displayMembers.toLocaleString("fr-FR")} membres · {community.mentality}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Separator */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.14)" }} />
    </>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────
export function Tribes() {
  const { user } = useAuth();
  const currentUserSupabaseId = user?.supabaseId ?? "";

  const [dynamicCommunities, setDynamicCommunities] = useState<Community[]>([]);
  const [loadingDynamic, setLoadingDynamic] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoadingDynamic(true);
    fetchDynamicCommunities()
      .then(setDynamicCommunities)
      .finally(() => setLoadingDynamic(false));
  }, []);

  const filtered = dynamicCommunities
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.members - a.members);

  return (
    <div style={{
      minHeight: "100dvh",
      padding: "16px 16px 100px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
      maxWidth: 480,
      margin: "0 auto",
    }}>
      {/* ── Barre de recherche ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(255,255,255,0.07)",
        border: "0.5px solid rgba(255,255,255,0.12)",
        borderRadius: 14, padding: "0 14px", height: 42,
      }}>
        <Search size={15} color="rgba(255,255,255,0.35)" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une tribu…"
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "#fff", fontSize: 14, caretColor: "#a78bfa",
          }}
        />
      </div>

      {/* ── Liste ── */}
      {loadingDynamic ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 80, borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ textAlign: "center", padding: "48px 24px", color: "rgba(255,255,255,0.30)", fontSize: 14 }}
        >
          {search
            ? "Aucune communauté ne correspond à ta recherche."
            : "Aucune communauté pour l'instant. Crée la première !"}
        </motion.div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map((community) => (
            <CommunityCard
              key={community.id}
              community={community}
              currentUserSupabaseId={currentUserSupabaseId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
