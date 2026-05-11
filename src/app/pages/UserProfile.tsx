import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, MoreHorizontal, Repeat2, X,
  Users, RefreshCw, ChevronDown,
  Loader2, WifiOff, UserCheck, UserX, Link2, Check as CheckIcon,
  Lock, Clock, Send,
} from "lucide-react";
import { ProgressCard } from "../components/ProgressCard";
import { useParams, useNavigate } from "react-router";

import { BadgesSection } from "../components/BadgesSection";
import { FollowButton } from "../components/FollowButton";
import { DashboardStatsCards } from "../components/DashboardStatsCards";
import { getProfile, upsertProfile, type UserProfile } from "../api/profileApi";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const BATCH_HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

async function fetchBatchProfiles(usernames: string[]): Promise<Record<string, { name: string; avatar: string; objective: string; followersCount: number; streak: number }>> {
  if (usernames.length === 0) return {};
  try {
    const res = await fetch(`${BASE_URL}/profiles/batch`, {
      method: "POST",
      headers: BATCH_HEADERS,
      body: JSON.stringify({ usernames }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.profiles ?? {};
  } catch {
    return {};
  }
}
import { getUserPosts, type ApiPost } from "../api/postsApi";
import { getFollowing, getFollowers } from "../api/followsApi";
import { useFollow } from "../context/FollowContext";
import { stripAt } from "../utils/renderText";
import { getGoals, type GoalData } from "../api/progressionApi";
import { getPrivacy, checkAccess, sendAccessRequest, getAccessRequestStatus } from "../api/privacyApi";
import { useAuth } from "../context/AuthContext";
import { FcoinHeaderStrip } from "../components/FcoinHeaderStrip";
import { AvatarImg } from "../components/AvatarImg";

// ─── Styles partagés ──────────────────────────────────────────────────────────

const surface: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "0.5px solid rgba(255,255,255,0.10)",
  boxShadow: "0 4px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.07)",
};

// ─── Profils mock (seed + fallback) ──────────────────────────────────────────

type PersonEntry = {
  name: string; avatar: string; objective: string; followers: number; streak: number; tags?: string[];
};

interface MockUserData {
  name: string; handle: string; avatar: string; banner: string;
  streak: number; objective: string; objectiveDesc: string; progressPct: number;
  bio: string; descriptor: string; hashtags: string[];
  followers: number; following: number; posts: number;
  constance: number; objectifsAccomplis: number; daysOnFF: number;
  evolutionData: { label: string; value: number }[];
  followingList: PersonEntry[];
  followersList: PersonEntry[];
}

const MOCK_USERS: Record<string, MockUserData> = {
  thomasdubois: {
    name: "Thomas Dubois", handle: "@thomasdubois", descriptor: "Builder",
    hashtags: ["#SaaS", "#buildinpublic", "#indie", "#entrepreneur"],
    avatar: "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    banner: "https://images.unsplash.com/photo-1733826544831-ad71d05c8423?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    streak: 0, objective: "Lancer mon SaaS",
    objectiveDesc: "Développer et lancer un SaaS de A à Z, en public. Documenter chaque étape, partager les victoires et les échecs sans filtre.",
    progressPct: 0,
    bio: "Entrepreneur & dev indie. Je build en public et partage chaque étape de mon aventure SaaS.",
    followers: 0, following: 0, posts: 0,
    constance: 0, objectifsAccomplis: 0, daysOnFF: 0,
    evolutionData: [],
    followingList: [],
    followersList: [],
  },
  marielaurent: {
    name: "Marie Laurent", handle: "@marielaurent", descriptor: "Linguiste",
    hashtags: ["#japonais", "#langues", "#N2", "#discipline"],
    avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    banner: "https://images.unsplash.com/photo-1769870704097-4b027c85bb2b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    streak: 0, objective: "Apprendre le japonais",
    objectiveDesc: "Atteindre le niveau N2 en japonais en 18 mois, en pratiquant chaque jour. De N5 à N2 sans école.",
    progressPct: 0,
    bio: "Passionnée de langues. Sur la route vers la fluidité en japonais. N5 → N2 en 18 mois. Chaque kanji compte.",
    followers: 0, following: 0, posts: 0,
    constance: 0, objectifsAccomplis: 0, daysOnFF: 0,
    evolutionData: [],
    followingList: [],
    followersList: [],
  },
  emmapetit: {
    name: "Emma Petit", handle: "@emmapetit", descriptor: "Auteure",
    hashtags: ["#roman", "#écriture", "#500mots", "#buildinpublic"],
    avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    banner: "https://images.unsplash.com/photo-1689023542259-d1e58b32a5a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
    streak: 0, objective: "Écrire un roman",
    objectiveDesc: "Poser 500 mots chaque jour jusqu'à terminer mon premier roman. Chapitre 12 terminé sur 20.",
    progressPct: 0,
    bio: "Auteure en herbe. Je pose 500 mots chaque jour depuis 203 jours. Mon roman avance — chapitre 12 terminé.",
    followers: 0, following: 0, posts: 0,
    constance: 0, objectifsAccomplis: 0, daysOnFF: 0,
    evolutionData: [],
    followingList: [],
    followersList: [],
  },
};

function getMock(username: string): MockUserData | null {
  return MOCK_USERS[username.toLowerCase().replace(/[\s_-]/g, "")] ?? null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── Mini Area Chart ─────────────────────────────────────────────────────────

function MiniAreaChart({ data }: { data: { label: string; value: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(300);
  const h = 100, pL = 6, pR = 6, pT = 6, pB = 22;
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.offsetWidth);
    return () => ro.disconnect();
  }, []);
  const iW = w - pL - pR, iH = h - pT - pB;
  const vals = data.map((d) => d.value);
  const mn = Math.min(...vals), mx = Math.max(...vals), range = mx - mn || 1;
  const toX = (i: number) => pL + (i / (data.length - 1)) * iW;
  const toY = (v: number) => pT + iH - ((v - mn) / range) * iH;
  const line = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(" ");
  const area = [`${toX(0)},${pT + iH}`, ...data.map((d, i) => `${toX(i)},${toY(d.value)}`), `${toX(data.length - 1)},${pT + iH}`].join(" ");
  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={w} height={h}>
        <polygon points={area} fill="#6366f1" fillOpacity={0.13} />
        <polyline points={line} fill="none" stroke="#818cf8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 5px rgba(99,102,241,0.6))" }} />
        {data.map((d, i) => (
          <text key={i} x={toX(i)} y={h - 4} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.22)">{d.label}</text>
        ))}
      </svg>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const completed = pct >= 100;
  return (
    <div style={{ height: 14, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden", position: "relative" }}>
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ duration: 1.1, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          position: "absolute", inset: "0 auto 0 0", borderRadius: 999,
          background: completed ? "linear-gradient(90deg,#22c55e,#4ade80,#86efac)" : "linear-gradient(90deg,#4f46e5,#818cf8,#a5b4fc)",
          boxShadow: completed ? "0 0 14px rgba(34,197,94,0.65)" : "0 0 10px rgba(99,102,241,0.55)",
        }}
      />
      {completed && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,0.85)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Accompli ✓
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Avatar Ring ──────────────────────────────────────────────────────────────

function AvatarRing({ src, progress, size = 96 }: { src: string; progress: number; size?: number }) {
  const sw = 4, pad = sw + 2, total = size + pad * 2;
  const cx = total / 2, r = cx - sw / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: total, height: total, flexShrink: 0 }}>
      <div style={{ position: "absolute", top: pad, left: pad, width: size, height: size, borderRadius: "50%", overflow: "hidden", border: "3px solid #000", boxShadow: "0 8px 28px rgba(0,0,0,0.65)" }}>
        {src ? (
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#4f46e5,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users style={{ width: 32, height: 32, color: "rgba(255,255,255,0.60)" }} />
          </div>
        )}
      </div>
      <svg width={total} height={total} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={`ring-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
        <motion.circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={`url(#ring-grad-${size})`} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - progress / 100) }}
          transition={{ duration: 1.3, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ filter: "drop-shadow(0 0 4px rgba(129,140,248,0.7))" }}
        />
      </svg>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  const sh = (w: string, h: number, r = 8) => (
    <div style={{ width: w, height: h, borderRadius: r, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />
  );
  return (
    <div style={{ background: "#000", minHeight: "100dvh" }}>
      <div style={{ height: 180, background: "rgba(255,255,255,0.05)" }} />
      <div style={{ padding: "0 20px", marginTop: -48 }}>
        {sh("96px", 96, 999)}
        <div style={{ marginTop: 16 }}>{sh("60%", 22, 10)}</div>
        <div style={{ marginTop: 8 }}>{sh("40%", 14, 8)}</div>
        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          {sh("80px", 32, 999)}{sh("80px", 32, 999)}
        </div>
      </div>
    </div>
  );
}

// ─── People List Modal (followers / following) ────────────────────────────────

interface PeopleListEntry {
  username: string;
  name: string;
  avatar: string;
  objective: string;
  followers: number;
  streak: number;
}

function PeopleModal({
  title, people, onClose,
}: {
  title: string;
  people: PeopleListEntry[];
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 38 }}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999,
          background: "rgba(8,8,14,0.98)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          border: "0.5px solid rgba(255,255,255,0.09)", borderBottom: "none",
          boxShadow: "0 -12px 60px rgba(0,0,0,0.80)",
          maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column",
        }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 2 }}>
          <div style={{ width: 34, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.14)" }} />
        </div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 12px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users style={{ width: 16, height: 16, color: "rgba(255,255,255,0.35)", strokeWidth: 1.8 }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.90)" }}>{title}</span>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.40)" }}>{people.length}</span>
          </div>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.45)" }} />
          </motion.button>
        </div>
        {/* List */}
        <div style={{ overflowY: "auto", flex: 1, padding: "6px 0 24px" }}>
          {people.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
              Aucune personne pour le moment.
            </div>
          ) : (
            people.map((p, i) => (
              <motion.div
                key={p.username}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.22 }}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px" }}
              >
                <div
                  style={{ position: "relative", width: 46, height: 46, flexShrink: 0, cursor: "pointer" }}
                  onClick={() => { navigate(`/profile/${p.username}`); onClose(); }}
                >
                  <AvatarImg src={p.avatar} name={p.name} size={46} style={{ border: "1.5px solid rgba(255,255,255,0.10)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => { navigate(`/profile/${p.username}`); onClose(); }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", marginTop: 1 }}>{p.username} · {fmtNum(p.followers)} abonnés</div>
                  {p.objective && (
                    <div style={{ fontSize: 12, color: "rgba(200,200,220,0.45)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.objective}</div>
                  )}
                </div>
                <FollowButton username={p.username} size="sm" />
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

// ─── Evolution Section ────────────────────────────────────────────────────────

type EvoFilter = "all" | "30d" | "week";

const CHART_DATA: Record<EvoFilter, { label: string; value: number }[]> = {
  all:  [{ label: "S1", value: 0 }, { label: "S2", value: 0 }, { label: "S3", value: 0 }, { label: "S4", value: 0 }, { label: "S5", value: 0 }, { label: "S6", value: 0 }, { label: "S7", value: 0 }],
  "30d":[{ label: "J1", value: 0 }, { label: "J5", value: 0 }, { label: "J10", value: 0 }, { label: "J15", value: 0 }, { label: "J20", value: 0 }, { label: "J25", value: 0 }, { label: "J30", value: 0 }],
  week: [{ label: "L", value: 0 }, { label: "M", value: 0 }, { label: "Me", value: 0 }, { label: "J", value: 0 }, { label: "V", value: 0 }, { label: "S", value: 0 }, { label: "D", value: 0 }],
};

function EvolutionSection({ profile, username, evolutionData, realProgress, allUserGoals, kvSelectedGoalId, viewingGoalId, onViewGoal }: {
  profile: UserProfile | null;
  username: string;
  evolutionData: { label: string; value: number }[];
  realProgress: number | null;
  allUserGoals: GoalData[];
  kvSelectedGoalId: string | null;
  viewingGoalId: string | null;
  onViewGoal: (goalId: string) => void;
}) {
  const [filter, setFilter] = useState<EvoFilter>("30d");
  if (!profile) return null;

  // L'objectif actuellement affiché (celui que le visiteur sélectionne, ou le défaut)
  const viewingGoal = viewingGoalId ? allUserGoals.find((g) => g.id === viewingGoalId) : null;
  const displayTitle = viewingGoal?.title ?? profile.objective ?? "";
  const displayDesc = viewingGoal?.description ?? profile.objectiveDesc ?? "";
  const displayPct = viewingGoal ? viewingGoal.progress : (realProgress !== null ? realProgress : profile.progressPct);

  return (
    <div>
      {/* Stats — 3 cartes gradient connectées Supabase */}
      <DashboardStatsCards userId={username} isOwner={false} style={{ marginBottom: 12 }} />

      {/* Objectif — avec sélecteur si plusieurs */}
      {(allUserGoals.length > 0 || profile.objective) && (
        <div style={{ ...surface, borderRadius: 20, padding: "16px 20px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(144,144,168,0.50)", textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 10 }}>
            Objectif actif
          </div>

          {/* Sélecteur d'objectifs — lecture seule, click pour afficher */}
          {allUserGoals.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {allUserGoals.map((goal) => {
                const isSelected = goal.id === (viewingGoalId ?? kvSelectedGoalId);
                const isAccompli = goal.status === "accompli";
                const isProfileSelected = goal.id === kvSelectedGoalId;
                return (
                  <motion.button
                    key={goal.id}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => onViewGoal(goal.id)}
                    title={goal.title}
                    style={{
                      maxWidth: 160, padding: "5px 11px", borderRadius: 999, cursor: "pointer",
                      background: isSelected ? "rgba(99,102,241,0.16)" : "rgba(255,255,255,0.05)",
                      border: isSelected ? "0.5px solid rgba(99,102,241,0.40)" : "0.5px solid rgba(255,255,255,0.09)",
                      display: "flex", alignItems: "center", gap: 5, transition: "all 0.16s ease",
                    }}
                  >
                    {isAccompli && <span style={{ fontSize: 10 }}>✓</span>}
                    {isProfileSelected && !isAccompli && (
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#818cf8", flexShrink: 0 }} />
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? "#a5b4fc" : "rgba(200,200,220,0.50)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {goal.title}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}

          {displayTitle && (
            <p style={{ fontSize: 22, fontWeight: 700, color: "rgba(240,240,245,0.92)", letterSpacing: "-0.2px", marginBottom: 8 }}>{displayTitle}</p>
          )}
          {displayDesc && (
            <p style={{ fontSize: 13, color: "rgba(200,200,220,0.50)", lineHeight: 1.55, marginBottom: 12 }}>{displayDesc}</p>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "rgba(200,200,220,0.45)" }}>Progression</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: displayPct >= 100 ? "#22c55e" : "#8b5cf6" }}>
              {displayPct >= 100 ? "✓ Accompli !" : `${displayPct}%`}
            </span>
          </div>
          <ProgressBar pct={displayPct} />
        </div>
      )}

      {/* Chart */}
      <div style={{ ...surface, borderRadius: 20, padding: "16px 16px 12px", marginBottom: 12 }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f5", marginBottom: 12 }}>L'évolution</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {(["all", "30d", "week"] as EvoFilter[]).map((f) => {
            const labels = { all: "Depuis toujours", "30d": "30 jours", week: "Cette semaine" };
            const active = filter === f;
            return (
              <motion.button key={f} whileTap={{ scale: 0.93 }} onClick={() => setFilter(f)}
                style={{ borderRadius: 999, padding: "5px 12px", background: active ? "rgba(99,102,241,0.16)" : "transparent", border: active ? "0.5px solid rgba(99,102,241,0.40)" : "0.5px solid rgba(255,255,255,0.12)", color: active ? "#a5b4fc" : "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer", transition: "all 0.16s ease" }}>
                {labels[f]}
              </motion.button>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={filter} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <MiniAreaChart data={evolutionData.length > 0 ? evolutionData : CHART_DATA[filter]} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Badges */}
      <div id="up-badges-section">
        <BadgesSection
          surfaceStyle={surface}
          borderRadius={20}
          fadeBg="rgba(6,6,14,0.88)"
          objective={{ goal: displayTitle || "–", value: `${profile.daysOnFF} jours` }}
          userId={username}
        />
      </div>
    </div>
  );
}

// ─── Posts Section ────────────────────────────────────────────────────────────

function PostsSection({ username, profileUser }: { username: string; profileUser: { name: string; avatar: string; objective: string } }) {
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUserId } = useFollow();

  const fetchPosts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { posts: p } = await getUserPosts(username, 30, currentUserId || undefined);
      setPosts(p);
    } catch (err) {
      console.error("Erreur posts utilisateur:", err);
      setError("Impossible de charger les posts.");
    } finally {
      setLoading(false);
    }
  }, [username, currentUserId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", gap: 8, alignItems: "center" }}>
      <Loader2 style={{ width: 16, height: 16, color: "rgba(99,102,241,0.55)" }} className="animate-spin" />
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Chargement des posts…</span>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", gap: 12 }}>
      <WifiOff style={{ width: 24, height: 24, color: "rgba(239,68,68,0.55)" }} />
      <p style={{ fontSize: 13, color: "rgba(239,68,68,0.70)", textAlign: "center" }}>{error}</p>
      <motion.button whileTap={{ scale: 0.95 }} onClick={fetchPosts}
        style={{ padding: "7px 18px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", cursor: "pointer" }}>
        Réessayer
      </motion.button>
    </div>
  );

  if (posts.length === 0) return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
        <RefreshCw style={{ width: 20, height: 20, color: "rgba(255,255,255,0.18)", strokeWidth: 1.5 }} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>Aucun post publié</p>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.20)", marginTop: 4 }}>Les publications apparaîtront ici.</p>
    </div>
  );

  return (
    <div>
      <AnimatePresence>
        {posts.map((post, i) => (
          <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.22 }} style={{ marginBottom: 10 }}>
            <ProgressCard
              postId={post.id}
              user={(post as any).isAnonymous ? { name: "Anonyme", avatar: "", objective: "" } : profileUser}
              authorUsername={post.username || username}
              isAnonymous={!!(post as any).isAnonymous}
              isMineAnonymous={!!(post as any).isMineAnonymous}
              streak={post.streak}
              progress={post.progress}
              hashtags={post.hashtags}
              image={post.image ?? undefined} images={post.images}
              verified={post.verified}
              isNew={post.isNew}
              relevantCount={post.relevantCount}
              commentsCount={post.commentsCount}
              sharesCount={post.sharesCount}
              viewsCount={post.viewsCount}
              hideStreak
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Suivi Section ────────────────────────────────────────────────────────────

const KNOWN_PEOPLE: Record<string, { name: string; avatar: string; objective: string; followers: number; streak: number }> = {
  thomasdubois:    { name: "Thomas Dubois",    avatar: "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lancer mon SaaS",         followers: 1240, streak: 87 },
  marielaurent:    { name: "Marie Laurent",    avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Apprendre le japonais",  followers: 892,  streak: 156 },
  emmapetit:       { name: "Emma Petit",       avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Écrire un roman",        followers: 2100, streak: 203 },
  sarahmartin:     { name: "Sarah Martin",     avatar: "https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Marathon en 6 mois",    followers: 580,  streak: 42 },
  lucasbernard:    { name: "Lucas Bernard",    avatar: "https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Dev Full-Stack",         followers: 670,  streak: 31 },
  antoinerousseau: { name: "Antoine Rousseau", avatar: "https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Dev Full-Stack",         followers: 870,  streak: 64 },
};

function enrichUsernameFromMap(username: string, profileMap: Record<string, { name: string; avatar: string; objective: string; followersCount: number; streak: number }>): PeopleListEntry {
  const u = username.toLowerCase().replace(/[\s_-]/g, "");
  const fromApi = profileMap[u];
  if (fromApi) return { username: u, name: fromApi.name, avatar: fromApi.avatar, objective: fromApi.objective, followers: fromApi.followersCount ?? 0, streak: fromApi.streak ?? 0 };
  const known = KNOWN_PEOPLE[u];
  if (known) return { username: u, ...known };
  return { username: u, name: username, avatar: "", objective: "–", followers: 0, streak: 0 };
}

function SuiviSection({ username, mockFollowing, mockFollowers }: {
  username: string;
  mockFollowing: PersonEntry[];
  mockFollowers: PersonEntry[];
}) {
  const [followingList, setFollowingList] = useState<PeopleListEntry[]>([]);
  const [followersList, setFollowersList] = useState<PeopleListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [subiTab, setSubiTab] = useState<"following" | "followers">("followers");

  useEffect(() => {
    Promise.all([getFollowing(username), getFollowers(username)])
      .then(async ([{ following }, { followers }]) => {
        // Charger les profils Supabase pour enrichir les données
        const allUsernames = [...new Set([...following, ...followers])];
        const profileMap = await fetchBatchProfiles(allUsernames);

        const fw = following.length > 0
          ? following.map((u) => enrichUsernameFromMap(u, profileMap))
          : mockFollowing.map((p) => ({ username: p.name.toLowerCase().replace(/\s+/g, ""), ...p }));
        const fl = followers.length > 0
          ? followers.map((u) => enrichUsernameFromMap(u, profileMap))
          : mockFollowers.map((p) => ({ username: p.name.toLowerCase().replace(/\s+/g, ""), ...p }));
        setFollowingList(fw);
        setFollowersList(fl);
      })
      .catch(() => {
        setFollowingList(mockFollowing.map((p) => ({ username: p.name.toLowerCase().replace(/\s+/g, ""), ...p })));
        setFollowersList(mockFollowers.map((p) => ({ username: p.name.toLowerCase().replace(/\s+/g, ""), ...p })));
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", gap: 8, alignItems: "center" }}>
      <Loader2 style={{ width: 16, height: 16, color: "rgba(99,102,241,0.55)" }} className="animate-spin" />
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Chargement…</span>
    </div>
  );

  const displayList = subiTab === "following" ? followingList : followersList;

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, background: "rgba(255,255,255,0.06)", borderRadius: 999, border: "0.5px solid rgba(255,255,255,0.09)", padding: 3 }}>
        {[
          { key: "followers" as const, label: `${followersList.length} Abonnés` },
          { key: "following" as const, label: `${followingList.length} Abonnements` },
        ].map((tab) => {
          const active = subiTab === tab.key;
          return (
            <motion.button
              key={tab.key}
              onClick={() => setSubiTab(tab.key)}
              whileTap={{ scale: 0.97 }}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 999, fontSize: 13, fontWeight: active ? 700 : 500,
                background: active ? "rgba(255,255,255,0.12)" : "transparent",
                border: active ? "0.5px solid rgba(255,255,255,0.16)" : "none",
                color: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.35)",
                cursor: "pointer", transition: "all 0.18s ease",
                boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.12)" : "none",
              }}
            >
              {tab.label}
            </motion.button>
          );
        })}
      </div>

      {/* Liste */}
      <AnimatePresence mode="wait">
        <motion.div key={subiTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {displayList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.22)", fontSize: 14 }}>
              {subiTab === "followers" ? "Aucun abonné pour le moment." : "Ne suit personne encore."}
            </div>
          ) : (
            displayList.map((p, i) => (
              <PersonRow key={p.username} person={p} isLast={i === displayList.length - 1} />
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function PersonRow({ person, isLast }: { person: PeopleListEntry; isLast: boolean }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "12px 0",
      }}
    >
      <div
        style={{ position: "relative", width: 50, height: 50, flexShrink: 0, cursor: "pointer" }}
        onClick={() => navigate(`/profile/${person.username}`)}
      >
        <AvatarImg src={person.avatar} name={person.name} size={50} style={{ border: "1.5px solid rgba(255,255,255,0.10)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => navigate(`/profile/${person.username}`)}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>{person.name}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>{person.username} · {fmtNum(person.followers)} abonnés</div>
        {person.objective && (
          <div style={{ fontSize: 12, color: "rgba(200,200,220,0.42)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.objective}</div>
        )}
      </div>
      <FollowButton username={person.username} size="sm" />
    </motion.div>
  );
}

// ─── Private Profile Gate ─────────────────────────────────────────────────────

function PrivateProfileGate({
  profile,
  ownerId,
  visitorId,
  initialReqStatus,
  onAccessGranted,
}: {
  profile: { name: string; avatar: string; handle: string };
  ownerId: string;
  visitorId: string;
  initialReqStatus: "none" | "pending" | "accepted" | "refused";
  onAccessGranted: () => void;
}) {
  const [reqStatus, setReqStatus] = useState<"none" | "pending" | "accepted" | "refused">(initialReqStatus);
  const [sending, setSending] = useState(false);

  const handleSendRequest = async () => {
    setSending(true);
    try {
      const result = await sendAccessRequest(visitorId, ownerId);
      if (result.request?.status === "accepted") {
        onAccessGranted();
        return;
      }
      setReqStatus(result.request?.status === "pending" ? "pending" : "none");
    } catch (err) {
      console.error("Erreur envoi demande:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 28px", textAlign: "center" }}
    >
      {/* Avatar */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <AvatarImg src={profile.avatar} name={profile.name} size={88} style={{ border: "3px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.50)" }} />
        {/* Lock badge */}
        <div style={{
          position: "absolute", bottom: -2, right: -2,
          width: 28, height: 28, borderRadius: "50%",
          background: "linear-gradient(135deg,#4f46e5,#818cf8)",
          border: "2px solid #000",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 12px rgba(79,70,229,0.55)",
        }}>
          <Lock style={{ width: 13, height: 13, color: "#fff" }} />
        </div>
      </div>

      {/* Name */}
      <p style={{ fontSize: 22, fontWeight: 800, color: "#f0f0f5", letterSpacing: "-0.3px", margin: "0 0 4px" }}>
        {profile.name}
      </p>
      <p style={{ fontSize: 14, color: "rgba(200,200,220,0.40)", margin: "0 0 28px" }}>
        {profile.handle}
      </p>

      {/* Private badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "10px 18px", borderRadius: 999, marginBottom: 28,
        background: "rgba(99,102,241,0.12)",
        border: "0.5px solid rgba(99,102,241,0.28)",
      }}>
        <Lock style={{ width: 13, height: 13, color: "#818cf8" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(165,180,252,0.85)" }}>
          Ce profil est privé
        </span>
      </div>

      <p style={{ fontSize: 15, color: "rgba(200,200,220,0.50)", lineHeight: 1.6, marginBottom: 32, maxWidth: 280 }}>
        Seules les personnes acceptées par <strong style={{ color: "rgba(255,255,255,0.70)" }}>{profile.name}</strong> peuvent voir le contenu complet de ce profil.
      </p>

      {/* CTA */}
      <AnimatePresence mode="wait">
        {reqStatus === "pending" ? (
          <motion.div
            key="pending"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 24px", borderRadius: 999,
              background: "rgba(99,102,241,0.10)",
              border: "0.5px solid rgba(99,102,241,0.30)",
            }}
          >
            <Clock style={{ width: 15, height: 15, color: "#818cf8" }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(165,180,252,0.80)" }}>
              Demande envoyée — en attente
            </span>
          </motion.div>
        ) : reqStatus === "refused" ? (
          <motion.div
            key="refused"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 24px", borderRadius: 999,
              background: "rgba(239,68,68,0.08)",
              border: "0.5px solid rgba(239,68,68,0.22)",
            }}
          >
            <UserX style={{ width: 15, height: 15, color: "#ef4444" }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(239,68,68,0.75)" }}>
              Demande refusée
            </span>
          </motion.div>
        ) : (
          <motion.button
            key="send"
            whileTap={{ scale: 0.94 }}
            onClick={handleSendRequest}
            disabled={sending}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 28px", borderRadius: 999, cursor: sending ? "default" : "pointer",
              background: "linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)",
              border: "none",
              boxShadow: "0 4px 24px rgba(79,70,229,0.40)",
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? (
              <Loader2 style={{ width: 15, height: 15, color: "#fff" }} className="animate-spin" />
            ) : (
              <Send style={{ width: 15, height: 15, color: "#fff" }} />
            )}
            <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
              {sending ? "Envoi…" : "Demander l'accès"}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type UserTab = "evolution" | "posts" | "suivi";

export function UserProfile() {
  const { username: rawUsername } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { currentUserId } = useFollow();
  const { user: authUser } = useAuth();

  const username = (rawUsername ?? "").toLowerCase().replace(/[\s_-]/g, "");

  // Redirect to own profile if visiting yourself
  useEffect(() => {
    if (currentUserId && username === currentUserId) navigate("/profile", { replace: true });
  }, [username, currentUserId, navigate]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<UserTab>("posts");
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followersData, setFollowersData] = useState<PeopleListEntry[]>([]);
  const [followingData, setFollowingData] = useState<PeopleListEntry[]>([]);
  // Progression réelle depuis Supabase KV (objectif principal)
  const [realProgress, setRealProgress] = useState<number | null>(null);
  // Tous les objectifs du profil visité
  const [allUserGoals, setAllUserGoals] = useState<GoalData[]>([]);
  const [kvSelectedGoalId, setKvSelectedGoalId] = useState<string | null>(null);
  // Objectif sélectionné côté client (pour switcher entre objectifs en lecture seule)
  const [viewingGoalId, setViewingGoalId] = useState<string | null>(null);
  // Followers mutuels — personnes que moi je suis ET qui suivent aussi ce profil (max 3)
  const [mutualFollowers, setMutualFollowers] = useState<PeopleListEntry[]>([]);
  // Share button
  const [linkCopied, setLinkCopied] = useState(false);
  // Privacy
  const [isPrivate, setIsPrivate] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [accessRequestStatus, setAccessRequestStatus] = useState<"none" | "pending" | "accepted" | "refused">("none");

  const handleShareProfile = useCallback(() => {
    const url = `${window.location.origin}/profile/${username}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2200);
    }).catch(() => {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand("copy"); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2200); } catch {}
      document.body.removeChild(ta);
    });
  }, [username]);

  const mock = getMock(username);

  // Load profile from Supabase, seed if missing
  const loadProfile = useCallback(async () => {
    if (!username) return;
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const { found, profile: p } = await getProfile(username);
      if (found) {
        setProfile(p);
      } else if (mock) {
        // Seed profile from mock data
        const seeded = await upsertProfile(username, {
          name:               mock.name,
          handle:             mock.handle,
          avatar:             mock.avatar,
          banner:             mock.banner,
          bio:                mock.bio,
          objective:          mock.objective,
          objectiveDesc:      mock.objectiveDesc,
          descriptor:         mock.descriptor,
          hashtags:           mock.hashtags,
          streak:             mock.streak,
          constance:          mock.constance,
          progressPct:        mock.progressPct,
          objectifsAccomplis: mock.objectifsAccomplis,
          daysOnFF:           mock.daysOnFF,
        });
        setProfile({ ...seeded, postsCount: mock.posts, followersCount: mock.followers, followingCount: mock.following });
      } else {
        setProfileError("Profil introuvable.");
      }
    } catch (err) {
      console.error("Erreur chargement profil:", err);
      if (mock) {
        // Fallback to mock if Supabase unreachable
        setProfile({
          username,
          name: mock.name, handle: mock.handle, avatar: mock.avatar, banner: mock.banner,
          bio: mock.bio, objective: mock.objective, objectiveDesc: mock.objectiveDesc,
          descriptor: mock.descriptor, hashtags: mock.hashtags, streak: mock.streak,
          constance: mock.constance, progressPct: mock.progressPct,
          objectifsAccomplis: mock.objectifsAccomplis, daysOnFF: mock.daysOnFF,
          postsCount: mock.posts, followersCount: mock.followers, followingCount: mock.following,
        });
      } else {
        setProfileError("Impossible de charger ce profil.");
      }
    } finally {
      setLoadingProfile(false);
    }
  }, [username, mock]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // Vérifier le mode privé + accès du visiteur
  useEffect(() => {
    if (!username) return;
    const visitorId = authUser?.username || "";
    Promise.all([
      getPrivacy(username),
      visitorId ? checkAccess(username, visitorId) : Promise.resolve(false),
      visitorId ? getAccessRequestStatus(visitorId, username) : Promise.resolve({ status: "none" as const, request: null }),
    ]).then(([privacyData, accessGranted, reqData]) => {
      setIsPrivate(privacyData.isPrivate);
      setHasAccess(accessGranted);
      setAccessRequestStatus(reqData.status as "none" | "pending" | "accepted" | "refused");
      setPrivacyChecked(true);
    }).catch((err) => {
      console.error("Erreur vérification privacy:", err);
      setPrivacyChecked(true); // fail open
    });
  }, [username, authUser?.username]);

  // Charger tous les objectifs depuis Supabase KV + la progression réelle
  useEffect(() => {
    if (!username) return;
    getGoals(username)
      .then(({ goals, selectedGoalId }) => {
        setAllUserGoals(goals);
        setKvSelectedGoalId(selectedGoalId ?? null);
        // L'objectif affiché par défaut = sélectionné dans KV, sinon premier en_cours
        const primary = (selectedGoalId ? goals.find((g) => g.id === selectedGoalId) : null)
          ?? goals.find((g) => g.status !== "accompli")
          ?? goals[0]
          ?? null;
        if (primary !== null) {
          setRealProgress(primary.progress);
          setViewingGoalId(primary.id);
        }
      })
      .catch((err) => console.error("Erreur chargement objectifs UserProfile:", err));
  }, [username]);

  // Load followers/following for modals
  useEffect(() => {
    if (!username) return;
    Promise.all([getFollowing(username), getFollowers(username)])
      .then(async ([{ following }, { followers }]) => {
        const allUsernames = [...new Set([...following, ...followers])];
        const profileMap = await fetchBatchProfiles(allUsernames);

        const fw = following.length > 0
          ? following.map((u) => enrichUsernameFromMap(u, profileMap))
          : (mock?.followingList ?? []).map((p) => ({ username: p.name.toLowerCase().replace(/\s+/g, ""), ...p }));
        const fl = followers.length > 0
          ? followers.map((u) => enrichUsernameFromMap(u, profileMap))
          : (mock?.followersList ?? []).map((p) => ({ username: p.name.toLowerCase().replace(/\s+/g, ""), ...p }));
        setFollowingData(fw);
        setFollowersData(fl);
      })
      .catch(() => {
        setFollowingData((mock?.followingList ?? []).map((p) => ({ username: p.name.toLowerCase().replace(/\s+/g, ""), ...p })));
        setFollowersData((mock?.followersList ?? []).map((p) => ({ username: p.name.toLowerCase().replace(/\s+/g, ""), ...p })));
      });
  }, [username, mock]);

  // ── Followers mutuels : personnes que moi je suis ET qui suivent ce profil (max 3) ──
  useEffect(() => {
    const myUsername = authUser?.username || currentUserId || "";
    if (!myUsername || !username || myUsername === username) return;

    getFollowing(myUsername)
      .then(async ({ following: myFollowing }) => {
        if (myFollowing.length === 0) return;

        // Récupérer les vrais followers du profil visité depuis Supabase
        const { followers: profileFollowers } = await getFollowers(username);
        const profileFollowerSet = new Set(profileFollowers);

        // Intersection : personnes que je suis ET qui suivent ce profil
        const shared = myFollowing.filter((u) => profileFollowerSet.has(u)).slice(0, 3);
        if (shared.length === 0) return;

        // Enrichir avec les vraies données de profil (avatar, nom) depuis Supabase
        const profileMap = await fetchBatchProfiles(shared);
        const enriched: PeopleListEntry[] = shared.map((u) => enrichUsernameFromMap(u, profileMap));

        setMutualFollowers(enriched);
      })
      .catch((err) => console.error("Erreur followers mutuels:", err));
  }, [username, authUser?.username, currentUserId]);

  // ── Loading ──
  if (loadingProfile || !privacyChecked) return <ProfileSkeleton />;

  // ── Private profile gate ──
  const showPrivateGate = isPrivate && !hasAccess && accessRequestStatus !== "accepted";

  // ── Error ──
  if (profileError || !profile) {
    return (
      <div style={{ minHeight: "100dvh", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <UserX style={{ width: 28, height: 28, color: "rgba(255,255,255,0.25)", strokeWidth: 1.5 }} />
        </div>
        <p style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.60)", textAlign: "center" }}>Profil introuvable</p>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.28)", textAlign: "center" }}>{profileError ?? "Cet utilisateur n'existe pas."}</p>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate(-1)}
          style={{ padding: "10px 24px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.14)", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.60)", cursor: "pointer" }}>
          Retour
        </motion.button>
      </div>
    );
  }

  const BANNER_H = 170;
  const AVATAR_SIZE = 96;
  const AVATAR_RING_PAD = 4 + 2;
  const AVATAR_TOTAL = AVATAR_SIZE + AVATAR_RING_PAD * 2;
  const AVATAR_OVERLAP = 60;

  const profileUser = { name: profile.name, avatar: profile.avatar, objective: profile.objective };
  const visitorId = authUser?.username || "";

  return (
    <div style={{ minHeight: "100dvh", background: "#000", paddingBottom: 120 }}>
      <div style={{ maxWidth: 672, margin: "0 auto" }}>

        {/* ── Bannière ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
          style={{ height: BANNER_H, position: "relative", overflow: "hidden" }}>
          {profile.banner ? (
            <img src={profile.banner} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)" }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.55) 100%)" }} />

          {/* Bouton retour */}
          <div style={{ position: "absolute", top: 50, left: 16 }}>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate(-1)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "0.5px solid rgba(255,255,255,0.18)", borderRadius: 999, padding: "5px 13px 5px 8px", cursor: "pointer" }}>
              <ArrowLeft style={{ width: 14, height: 14, color: "rgba(255,255,255,0.80)" }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.80)", fontWeight: 500 }}>Retour</span>
            </motion.button>
          </div>

          {/* Actions haut droite */}
          <div style={{ position: "absolute", top: 50, right: 16, display: "flex", alignItems: "center", gap: 8 }}>
            {/* Bouton Partager */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleShareProfile}
              title="Copier le lien du profil"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: "50%",
                background: linkCopied ? "rgba(34,197,94,0.22)" : "rgba(0,0,0,0.32)",
                backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                border: linkCopied ? "0.5px solid rgba(34,197,94,0.45)" : "0.5px solid rgba(255,255,255,0.18)",
                cursor: "pointer",
                transition: "all 0.22s ease",
              }}
            >
              <AnimatePresence mode="wait">
                {linkCopied ? (
                  <motion.div key="check" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ display: "flex", alignItems: "center" }}>
                    <CheckIcon style={{ width: 14, height: 14, color: "#22c55e" }} />
                  </motion.div>
                ) : (
                  <motion.div key="link" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ display: "flex", alignItems: "center" }}>
                    <Link2 style={{ width: 14, height: 14, color: "rgba(255,255,255,0.80)" }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Badge profil privé */}
            {isPrivate && (
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "rgba(0,0,0,0.40)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                border: "0.5px solid rgba(99,102,241,0.35)", borderRadius: 999,
                padding: "4px 10px",
              }}>
                <Lock style={{ width: 11, height: 11, color: "#818cf8" }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(165,180,252,0.80)" }}>Privé</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Header card (avatar + infos) ── */}
        <div style={{ position: "relative" }}>
          {/* Avatar flottant — progression synchronisée depuis Supabase KV */}
          <div style={{ position: "absolute", top: -AVATAR_OVERLAP, left: 18, zIndex: 20 }}>
            <AvatarRing src={profile.avatar} progress={realProgress ?? profile.progressPct} size={AVATAR_SIZE} />
          </div>

          {/* Card verre */}
          <div style={{ ...surface, borderRadius: "0 0 24px 24px", position: "relative", overflow: "hidden" }}>
            {/* Spacer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 18px 0" }}>
              <div style={{ width: AVATAR_TOTAL + 4, height: AVATAR_TOTAL - AVATAR_OVERLAP, flexShrink: 0 }} />
            </div>

            <div style={{ padding: "6px 18px 20px" }}>
              {/* Nom + handle */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: "#f0f0f5", letterSpacing: "-0.4px", margin: "0 0 2px" }}>{profile.name}</p>
                  <p style={{ fontSize: 14, color: "rgba(200,200,220,0.40)", margin: 0 }}>{stripAt(profile.handle)}</p>
                </div>
                {/* FollowButton — met à jour le compteur abonnés instantanément */}
                <div style={{ marginTop: 2 }}>
                  <FollowButton
                    username={username}
                    size="md"
                    onToggled={(nowFollowing) => {
                      setProfile((p) => p ? {
                        ...p,
                        followersCount: Math.max(0, p.followersCount + (nowFollowing ? 1 : -1)),
                      } : p);
                    }}
                  />
                </div>
              </div>

              {/* Descriptor badge */}
              {profile.descriptor && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", background: "rgba(255,255,255,0.92)", borderRadius: 999, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: "#111" }}>
                    {profile.descriptor}
                  </span>
                </div>
              )}

              {/* Bio */}
              {profile.bio && (
                <p style={{ fontSize: 13.5, color: "rgba(200,200,220,0.58)", lineHeight: 1.55, marginBottom: 12 }}>
                  {profile.bio}
                </p>
              )}

              {/* ── Fcoin strip — clic → scroll vers les Fcoins ── */}
              <FcoinHeaderStrip
                userId={username}
                onScrollToBadges={() => {
                  document.getElementById("up-badges-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />

              {/* ── Followers mutuels — max 3, avatars superposés, sans fond ── */}
              {mutualFollowers.length > 0 && (() => {
                const myName = authUser?.name || authUser?.username || "toi";

                // Construire le texte des noms
                const names = mutualFollowers.map((f) => f.name || f.username);
                let namesText = "";
                if (names.length === 1) namesText = names[0];
                else if (names.length === 2) namesText = `${names[0]} et ${names[1]}`;
                else namesText = `${names[0]}, ${names[1]} et ${names[2]}`;

                const avatarSize = 24;
                const avatarOverlap = 8;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26 }}
                    style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}
                  >
                    {/* Avatars superposés */}
                    <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                      {mutualFollowers.map((f, i) => (
                        <div
                          key={f.username}
                          title={f.name || f.username}
                          style={{
                            width: avatarSize, height: avatarSize, borderRadius: "50%",
                            overflow: "hidden",
                            border: "1.5px solid rgba(255,255,255,0.13)",
                            marginLeft: i > 0 ? -avatarOverlap : 0,
                            background: "#111",
                            flexShrink: 0,
                            zIndex: mutualFollowers.length - i,
                            position: "relative",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.40)",
                          }}
                        >
                          {f.avatar ? (
                            <img src={f.avatar} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>
                                {(f.name || f.username).charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Texte — aucune couleur différenciée */}
                    <p style={{ fontSize: 12, color: "rgba(200,200,220,0.48)", margin: 0, lineHeight: 1.3 }}>
                      <span style={{ fontWeight: 600, color: "rgba(220,220,235,0.65)" }}>{namesText}</span>
                      <span> {mutualFollowers.length > 1 ? "suivi(e)s" : "suivi(e)"} par {myName}</span>
                    </p>
                  </motion.div>
                );
              })()}

              {/* Stats : abonnés / abonnements / posts */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <button
                  onClick={() => setShowFollowersModal(true)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", gap: 5, alignItems: "baseline" }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#f0f0f5" }}>{fmtNum(profile.followersCount)}</span>
                  <span style={{ fontSize: 13, color: "rgba(200,200,220,0.42)" }}>abonnés</span>
                </button>
                <span style={{ color: "rgba(144,144,168,0.28)" }}>•</span>
                <button
                  onClick={() => setShowFollowingModal(true)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", gap: 5, alignItems: "baseline" }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#f0f0f5" }}>{fmtNum(profile.followingCount)}</span>
                  <span style={{ fontSize: 13, color: "rgba(200,200,220,0.42)" }}>abonnements</span>
                </button>
                <span style={{ color: "rgba(144,144,168,0.28)" }}>•</span>
                <button
                  onClick={() => setActiveTab("posts")}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", gap: 5, alignItems: "baseline" }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#f0f0f5" }}>{profile.postsCount}</span>
                  <span style={{ fontSize: 13, color: "rgba(200,200,220,0.42)" }}>posts</span>
                </button>
              </div>

              {/* Hashtags */}
              {profile.hashtags?.length > 0 && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {profile.hashtags.map((tag) => (
                    <span key={tag} style={{ fontSize: 13, fontWeight: 500, color: "rgba(165,180,252,0.68)" }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Private Gate ── */}
        {showPrivateGate && (
          <PrivateProfileGate
            profile={{ name: profile.name, avatar: profile.avatar, handle: profile.handle }}
            ownerId={username}
            visitorId={visitorId}
            initialReqStatus={accessRequestStatus}
            onAccessGranted={() => { setHasAccess(true); setAccessRequestStatus("accepted"); }}
          />
        )}

        {/* ── Tabs + Contenu (masqués si profil privé sans accès) ── */}
        {!showPrivateGate && (<>
        <div style={{ padding: "16px 16px 0", position: "sticky", top: 0, zIndex: 10, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
          <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
            {(["posts", "evolution", "suivi"] as UserTab[]).map((tab) => {
              const labels = { evolution: "Évolution", posts: "Posts", suivi: "Suivi" };
              const isActive = activeTab === tab;
              return (
                <motion.button
                  key={tab}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActiveTab(tab)}
                  style={{ flex: 1, padding: "12px 0", background: "transparent", border: "none", cursor: "pointer", position: "relative" }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="userProfileTabIndicator"
                      style={{ position: "absolute", bottom: 0, left: "18%", right: "18%", height: 2.5, borderRadius: 999, background: "linear-gradient(90deg,#6366f1,#818cf8)", boxShadow: "0 0 8px rgba(99,102,241,0.55)" }}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span style={{ position: "relative", zIndex: 1, fontSize: 19, fontWeight: isActive ? 700 : 500, color: isActive ? "#f0f0f5" : "rgba(255,255,255,0.35)", transition: "color 0.18s ease", display: "block" }}>
                    {labels[tab]}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Contenu ── */}
        <div style={{ padding: "16px 16px 0" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              {activeTab === "evolution" && (
                <EvolutionSection
                  profile={profile}
                  username={username}
                  evolutionData={mock?.evolutionData ?? []}
                  realProgress={realProgress}
                  allUserGoals={allUserGoals}
                  kvSelectedGoalId={kvSelectedGoalId}
                  viewingGoalId={viewingGoalId}
                  onViewGoal={(goalId) => {
                    setViewingGoalId(goalId);
                    const g = allUserGoals.find((g) => g.id === goalId);
                    if (g) setRealProgress(g.progress);
                  }}
                />
              )}
              {activeTab === "posts" && (
                <PostsSection username={username} profileUser={profileUser} />
              )}
              {activeTab === "suivi" && (
                <SuiviSection
                  username={username}
                  mockFollowing={mock?.followingList ?? []}
                  mockFollowers={mock?.followersList ?? []}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        </>)} {/* end !showPrivateGate */}
      </div>

      {/* ── Modals Abonnés / Abonnements ── */}
      {showFollowersModal && (
        <PeopleModal title={`Abonnés de ${profile.name}`} people={followersData} onClose={() => setShowFollowersModal(false)} />
      )}
      {showFollowingModal && (
        <PeopleModal title={`Abonnements de ${profile.name}`} people={followingData} onClose={() => setShowFollowingModal(false)} />
      )}
    </div>
  );
}
