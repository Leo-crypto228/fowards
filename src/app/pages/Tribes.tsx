import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Search, ChevronDown } from "lucide-react";

import { CommunitySubscribeButton } from "../components/CommunitySubscribeButton";
import { useCommunityMember } from "../context/CommunityMemberContext";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useAuth } from "../context/AuthContext";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { Authorization: `Bearer ${publicAnonKey}` };

type Mentality = "Objectif" | "Passion";
type SortKey = "members_desc" | "members_asc" | "streak_desc" | "constance_desc";

interface Community {
  id: string;
  name: string;
  avatar: string;
  members: number;
  streak: number;
  constance: number;
  mentality: Mentality;
  createdBy?: string;
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
      avatar: c.avatar ?? "",
      members: typeof c.members === "number" ? c.members : 0,
      streak: typeof c.streak === "number" ? c.streak : 0,
      constance: typeof c.constance === "number" ? c.constance : 0,
      mentality: (c.mentality === "Passion" ? "Passion" : "Objectif") as Mentality,
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

  // createdBy contient le supabaseId — on compare avec user.supabaseId
  const isCreator =
    !!community.createdBy &&
    !!currentUserSupabaseId &&
    community.createdBy === currentUserSupabaseId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      onClick={() => navigate(`/tribes/${community.id}`)}
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "0.5px solid rgba(255,255,255,0.10)",
        borderRadius: 20,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
      whileTap={{ scale: 0.985 }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          flexShrink: 0,
          overflow: "hidden",
          background: "rgba(255,255,255,0.08)",
        }}
      >
        {community.avatar ? (
          <img
            src={community.avatar}
            alt={community.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            🏠
          </div>
        )}
      </div>

      {/* Infos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 3,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "#fff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {community.name}
          </span>
          {isCreator && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#a78bfa",
                background: "rgba(139,92,246,0.18)",
                border: "0.5px solid rgba(139,92,246,0.35)",
                borderRadius: 999,
                padding: "1px 7px",
                flexShrink: 0,
              }}
            >
              Admin
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          <span>{displayMembers.toLocaleString("fr-FR")} membres</span>
          <span>·</span>
          <span
            style={{
              color:
                community.mentality === "Passion"
                  ? "rgba(251,146,60,0.85)"
                  : "rgba(167,139,250,0.85)",
            }}
          >
            {community.mentality}
          </span>
        </div>
      </div>

      {/* Streak + bouton */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          flexShrink: 0,
        }}
      >
        {/* Afficher le bouton S'abonner uniquement si l'utilisateur n'est PAS le créateur */}
        {!isCreator && (
          <CommunitySubscribeButton
            communityId={community.id}
            communityName={community.name}
            size="sm"
            stopPropagation
          />
        )}
      </div>
    </motion.div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────
export function Tribes() {
  const { user } = useAuth();
  const currentUserSupabaseId = user?.supabaseId ?? "";

  const [dynamicCommunities, setDynamicCommunities] = useState<Community[]>([]);
  const [loadingDynamic, setLoadingDynamic] = useState(true);

  const [search, setSearch] = useState("");
  const [mentality, setMentality] = useState<"all" | Mentality>("all");
  const [sortKey, setSortKey] = useState<SortKey>("members_desc");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Charger les communautés dynamiques
  useEffect(() => {
    setLoadingDynamic(true);
    fetchDynamicCommunities()
      .then(setDynamicCommunities)
      .finally(() => setLoadingDynamic(false));
  }, []);

  // Fermer le dropdown de tri si clic hors
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Filtrage + tri ────────────────────────────────────────────────────────
  const allCommunities = dynamicCommunities;

  const filtered = allCommunities
    .filter((c) => {
      const matchSearch =
        !search || c.name.toLowerCase().includes(search.toLowerCase());
      const matchMentality = mentality === "all" || c.mentality === mentality;
      return matchSearch && matchMentality;
    })
    .sort((a, b) => {
      switch (sortKey) {
        case "members_asc":
          return a.members - b.members;
        case "members_desc":
          return b.members - a.members;
        case "streak_desc":
          return b.streak - a.streak;
        case "constance_desc":
          return b.constance - a.constance;
        default:
          return 0;
      }
    });

  const SORT_LABELS: Record<SortKey, string> = {
    members_desc: "Membres ↓",
    members_asc: "Membres ↑",
    streak_desc: "Streak ↓",
    constance_desc: "Constance ↓",
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        padding: "16px 16px 100px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {/* ── Titre ── */}
      <div style={{ paddingTop: 8 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#fff",
            margin: 0,
            letterSpacing: "-0.5px",
          }}
        >
          Tribus
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", margin: "4px 0 0" }}>
          Rejoins une communauté qui te ressemble
        </p>
      </div>

      {/* ── Barre de recherche + tri ── */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/* Search */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(255,255,255,0.07)",
            border: "0.5px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: "0 14px",
            height: 42,
          }}
        >
          <Search size={15} color="rgba(255,255,255,0.35)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une tribu…"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: 14,
              caretColor: "#a78bfa",
            }}
          />
        </div>

        {/* Tri dropdown */}
        <div ref={sortRef} style={{ position: "relative" }}>
          <motion.button
            onClick={() => setSortOpen((v) => !v)}
            whileTap={{ scale: 0.93 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 14px",
              height: 42,
              borderRadius: 14,
              background: "rgba(255,255,255,0.07)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.70)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {SORT_LABELS[sortKey]}
            <ChevronDown
              size={13}
              style={{
                transform: sortOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </motion.button>

          <AnimatePresence>
            {sortOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "rgba(20,12,40,0.97)",
                  border: "0.5px solid rgba(255,255,255,0.14)",
                  borderRadius: 14,
                  padding: "6px",
                  zIndex: 200,
                  minWidth: 160,
                  backdropFilter: "blur(18px)",
                }}
              >
                {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(
                  ([key, label]) => (
                    <motion.button
                      key={key}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setSortKey(key);
                        setSortOpen(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "9px 12px",
                        borderRadius: 10,
                        background:
                          sortKey === key
                            ? "rgba(139,92,246,0.20)"
                            : "transparent",
                        color:
                          sortKey === key
                            ? "#c4b5fd"
                            : "rgba(255,255,255,0.65)",
                        fontSize: 13,
                        fontWeight: sortKey === key ? 700 : 500,
                        cursor: "pointer",
                        border: "none",
                        outline: "none",
                      }}
                    >
                      {label}
                    </motion.button>
                  )
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Filtres mentalité ── */}
      <div style={{ display: "flex", gap: 8 }}>
        {(["all", "Objectif", "Passion"] as const).map((m) => (
          <motion.button
            key={m}
            whileTap={{ scale: 0.93 }}
            onClick={() => setMentality(m)}
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              border: "0.5px solid",
              transition: "all 0.18s ease",
              background:
                mentality === m
                  ? m === "Passion"
                    ? "rgba(251,146,60,0.20)"
                    : m === "Objectif"
                    ? "rgba(139,92,246,0.22)"
                    : "rgba(255,255,255,0.12)"
                  : "rgba(255,255,255,0.05)",
              borderColor:
                mentality === m
                  ? m === "Passion"
                    ? "rgba(251,146,60,0.55)"
                    : m === "Objectif"
                    ? "rgba(139,92,246,0.55)"
                    : "rgba(255,255,255,0.30)"
                  : "rgba(255,255,255,0.10)",
              color:
                mentality === m
                  ? m === "Passion"
                    ? "#fb923c"
                    : m === "Objectif"
                    ? "#c4b5fd"
                    : "#fff"
                  : "rgba(255,255,255,0.45)",
            }}
          >
            {m === "all" ? "Toutes" : m}
          </motion.button>
        ))}
      </div>

      {/* ── Liste ── */}
      {loadingDynamic ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 80,
                borderRadius: 20,
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.07)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            textAlign: "center",
            padding: "48px 24px",
            color: "rgba(255,255,255,0.30)",
            fontSize: 14,
          }}
        >
          {search || mentality !== "all"
            ? "Aucune communauté ne correspond à ta recherche."
            : "Aucune communauté pour l'instant. Crée la première !"}
        </motion.div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <AnimatePresence mode="popLayout">
            {filtered.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                currentUserSupabaseId={currentUserSupabaseId}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
