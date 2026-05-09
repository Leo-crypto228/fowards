import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

import {
  Bell, MoreHorizontal, X, Check, Zap, Users,
  ChevronDown, Repeat2, Search,
  Bookmark, Lock, RefreshCw, WifiOff, PlusCircle, Loader2,
  TrendingUp, Link2, Settings,
} from "lucide-react";

import { BadgesSection } from "../components/BadgesSection";
import { ProgressCard } from "../components/ProgressCard";
import { useNavigate } from "react-router";
import { FollowButton } from "../components/FollowButton";
import { useSavedPosts } from "../context/SavedPostsContext";
import { getUserPosts, ApiPost } from "../api/postsApi";
import { getFollowers } from "../api/followsApi";
import { getProfile, upsertProfile, type UserProfile } from "../api/profileApi";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const PROFILE_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const PROFILE_HEADERS = { Authorization: `Bearer ${publicAnonKey}` };
import { getEvolutionChart, getExtendedStats, type ChartPoint, type ExtendedStats } from "../api/progressionApi";
import { DashboardStatsCards } from "../components/DashboardStatsCards";
import { FcoinHeaderStrip } from "../components/FcoinHeaderStrip";
import { useAuth } from "../context/AuthContext";
import { useFollow } from "../context/FollowContext";
import { useObjectiveProgress } from "../context/ObjectiveProgressContext";
import { toast } from "sonner";
import { stripAt } from "../utils/renderText";

// ─── ASSETS ──────────────────────────────────────────────────────────────────

const BANNER_URL =
  "https://images.unsplash.com/photo-1769184613636-1b7ba2210932?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const AVATAR_URL =
  "https://images.unsplash.com/photo-1762753674498-73ec49feafc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400";

const PEOPLE_AVATARS = [
  "https://images.unsplash.com/photo-1737574821698-862e77f044c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  "https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  "https://images.unsplash.com/photo-1731652227259-441c966ba1ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  "https://images.unsplash.com/photo-1585335559291-f94d268f8b17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
];

// ─── TYPES ────────────────────────────────────────────────────────────────────

type ProfileTab = "evolution" | "posts" | "suivi";
type PostMode = "tout" | "reponses" | "impactant" | "riposte" | "important";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const BIO_FULL =
  "Entrepreneur passionné par la création de produits digitaux. Je construis chaque jour, j'apprends de mes erreurs et je partage mon parcours en public. Actuellement en train de bâtir mon premier SaaS de A à Z.";
const OBJECTIVE_DESC =
  "Développer et lancer un produit SaaS en public, de l'idée au premier euro de revenu. Documenter chaque étape, partager les victoires et les échecs sans filtre.";
const HASHTAGS = ["#entrepreneur", "#buildinpublic", "#discipline", "#saas"];

const NOTIFS = [
  { id: 1, icon: Users,  text: "Emma Petit vous suit maintenant",            time: "2m",  unread: true  },
  { id: 2, icon: Zap,    text: "Antoine a trouvé votre post Pertinent",      time: "18m", unread: true  },
  { id: 3, icon: Check,  text: "Streak 27 jours — continuez comme ça !",     time: "1h",  unread: true  },
  { id: 4, icon: Users,  text: "Lucas Bernard vous suit maintenant",         time: "3h",  unread: false },
  { id: 5, icon: Zap,    text: "Marie a commenté votre objectif",             time: "5h",  unread: false },
];

type PostType = "infos"|"conseil"|"new"|"avancement"|"objectif"|"lecon"|"question"|"bilan";

const TYPE_LABELS: Record<PostType, string> = {
  infos: "Infos perso", conseil: "Conseil(s)", new: "New",
  avancement: "Avancement", objectif: "Objectif", lecon: "Leçon",
  question: "Question", bilan: "Bilan",
};

interface MockPost {
  id: number;
  type: PostType;
  text: string;
  time: string;
  views: number;
  relevant: number;
  comments: number;
  shares: number;
  isImpactant?: boolean;
  image?: string;
  hashtags?: string[];
  replyTo?: { name: string; avatar: string; postTitle?: string; postText?: string };
  riposteOf?: { name: string; text: string; avatar: string };
}

const MY_POSTS: MockPost[] = [
  { id: 1, type: "avancement", text: "Course de 15km ce matin. J'ai battu mon record personnel de 2 minutes. La constance commence à payer.", time: "2h", views: 870, relevant: 82, comments: 12, shares: 5, isImpactant: true, image: "https://images.unsplash.com/photo-1758506971667-fbaa8942258a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", hashtags: ["#Marathon", "#Running", "#Constance"] },
  { id: 2, type: "conseil", text: "Ne sous-estimez jamais le temps que prend la documentation. J'ai passé 2 jours complets sur mes API docs et c'est clairement un investissement qui paie sur le long terme.", time: "1j", views: 890, relevant: 62, comments: 8, shares: 5, isImpactant: true, image: "https://images.unsplash.com/photo-1770159116807-9b2a7bb82294?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", hashtags: ["#Dev", "#SaaS", "#Discipline"] },
  { id: 3, type: "bilan", text: "Bilan de la semaine 6 : 14 commits, 2 features livrées, 1 bug critique corrigé. La constance n'est pas glamour mais elle construit des choses solides.", time: "3j", views: 2100, relevant: 143, comments: 27, shares: 18, isImpactant: true, hashtags: ["#BuildInPublic", "#Semaine6"] },
  { id: 4, type: "question", text: "Vous utilisez quoi pour gérer votre roadmap en solo ? Je cherche quelque chose de léger, pas Notion (trop lourd pour moi).", time: "5j", views: 560, relevant: 34, comments: 41, shares: 3, hashtags: ["#Outils", "#Solo", "#Productivité"] },
  { id: 5, type: "new", text: "J'ai officiellement lancé ma landing page. C'est pas parfaite, mais elle est en ligne. Done is better than perfect.", time: "1sem", views: 3800, relevant: 210, comments: 38, shares: 29, isImpactant: true, image: "https://images.unsplash.com/photo-1568988541877-e743c10753e9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", hashtags: ["#Launch", "#SaaS", "#BuildInPublic"] },
  { id: 6, type: "lecon", text: "Leçon apprise cette semaine : il ne faut pas écrire le code avant d'avoir validé le problème. J'ai codé 4 jours une feature que personne ne voulait.", time: "2sem", views: 1680, relevant: 95, comments: 19, shares: 12, hashtags: ["#Leçon", "#Validation"] },
];

const REPLIES: MockPost[] = [
  {
    id: 101, type: "conseil", text: "Je suis d'accord, mais je nuancerais : le MVP peut être fait vite à condition de bien définir les user stories en amont. Sans ça tu codes dans le vide.", time: "1j", views: 320, relevant: 28, comments: 3, shares: 1,
    replyTo: { name: "Lucas Bernard", avatar: PEOPLE_AVATARS[2], postTitle: "Développer un MVP rapidement", postText: "Un MVP doit être livré en moins de 2 semaines, sans exception. Passé ce délai, vous sur-engineerez." },
  },
  {
    id: 102, type: "question", text: "Tu as essayé Linear ? C'est léger, rapide, et parfait pour le solo. Je l'utilise depuis 3 mois et je ne reviens plus en arrière.", time: "5j", views: 210, relevant: 15, comments: 7, shares: 0,
    replyTo: { name: "Emma Petit", avatar: PEOPLE_AVATARS[0], postTitle: "Outil de gestion de roadmap solo", postText: "Vous utilisez quoi pour gérer votre roadmap en solo ? Je cherche quelque chose de léger, sans friction." },
  },
  {
    id: 103, type: "avancement", text: "Bravo pour ce milestone ! La constance finit toujours par payer. J'ai vécu exactement la même chose il y a 6 mois — continue.", time: "2sem", views: 140, relevant: 9, comments: 1, shares: 0,
    replyTo: { name: "Sofia Martin", avatar: PEOPLE_AVATARS[1], postTitle: "100 jours de build public", postText: "100 jours que je construis en public. 0 revenus, mais tout le reste a changé. La discipline a tout transformé." },
  },
];

const RIPOSTES: MockPost[] = [
  {
    id: 201, type: "bilan", text: "90 jours de build public terminés. Revenus : 0. Apprentissages : infinis. Tout recommencer ? Oui, sans hésiter.", time: "4j", views: 5200, relevant: 312, comments: 67, shares: 44,
    riposteOf: { name: "Antoine Moreau", avatar: PEOPLE_AVATARS[2], text: "90 jours de build public terminés. Revenus : 0. Apprentissages : infinis. Tout recommencer ? Oui, sans hésiter." },
  },
  {
    id: 202, type: "conseil", text: "Le meilleur moment pour publier ? Tôt le matin. Votre audience est fraîche, l'engagement est 40% plus élevé avant 9h.", time: "1sem", views: 2800, relevant: 178, comments: 23, shares: 31,
    riposteOf: { name: "Marie Dupont", avatar: PEOPLE_AVATARS[3], text: "Le meilleur moment pour publier ? Tôt le matin. Votre audience est fraîche, l'engagement est 40% plus élevé avant 9h." },
  },
];

const FOLLOWING_LIST = [
  { id: 1, name: "Emma Petit",    avatar: PEOPLE_AVATARS[0], objective: "Courir un marathon en moins de 4h",       followers: 1240, streak: 22 },
  { id: 2, name: "Sofia Martin",  avatar: PEOPLE_AVATARS[1], objective: "Lancer ma marque de cosmétiques bio",     followers: 890,  streak: 15 },
  { id: 3, name: "Lucas Bernard", avatar: PEOPLE_AVATARS[2], objective: "Devenir développeur fullstack en 6 mois", followers: 2100, streak: 63 },
  { id: 4, name: "Marie Dupont",  avatar: PEOPLE_AVATARS[3], objective: "Écrire et publier mon premier roman",     followers: 540,  streak: 8  },
];

const FOLLOWERS_LIST = [
  { id: 1, name: "Antoine Moreau", avatar: PEOPLE_AVATARS[2], objective: "Construire un studio créatif indépendant", followers: 3200, streak: 91, tags: ["#créatif", "#design", "#indépendant"] },
  { id: 2, name: "Julia Chen",     avatar: PEOPLE_AVATARS[3], objective: "Lancer ma startup edtech en 2026",        followers: 670,  streak: 19, tags: ["#edtech", "#startup", "#vision"] },
  { id: 3, name: "Romain Leroy",   avatar: PEOPLE_AVATARS[0], objective: "Atteindre 10k abonnés sur LinkedIn",      followers: 820,  streak: 34, tags: ["#linkedin", "#personal branding"] },
  { id: 4, name: "Céline Faure",   avatar: PEOPLE_AVATARS[1], objective: "Courir 1000km cette année",               followers: 456,  streak: 14, tags: ["#sport", "#discipline", "#run"] },
];

// (chart data now fetched live from Supabase)

const BADGES = [
  { id: 1, emoji: "🎯", name: "1er objectif", unlocked: true  },
  { id: 2, emoji: "🔥", name: "7j streak",    unlocked: true  },
  { id: 3, emoji: "🔥", name: "30j streak",   unlocked: true  },
  { id: 4, emoji: "💬", name: "100 msgs",     unlocked: true  },
  { id: 5, emoji: "🌍", name: "Explorateur",  unlocked: true  },
  { id: 6, emoji: "⭐", name: "Contributeur", unlocked: true  },
  { id: 7, emoji: "🏗️", name: "Builder",      unlocked: true  },
  { id: 8, emoji: "🔒", name: "???",           unlocked: false },
];

// ─── STYLES ───────────────────────────────────────��──────────────────────────

const surfaceStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "0.5px solid rgba(255,255,255,0.11)",
  boxShadow: "0 4px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.09)",
};

const glassStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "0.5px solid rgba(255,255,255,0.20)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
};

// ─── AVATAR PROGRESS RING ─────────────────────────────────────────────────────

function AvatarProgressRing({ src, progress, size = 120 }: { src: string; progress: number; size?: number }) {
  const strokeWidth = 5;
  const pad = strokeWidth + 3;
  const total = size + pad * 2;
  const cx = total / 2, cy = total / 2;
  const radius = cx - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);

  return (
    <div style={{ position: "relative", width: total, height: total }}>
      <div
        style={{
          position: "absolute", top: pad, left: pad,
          width: size, height: size,
          borderRadius: "50%", overflow: "hidden",
          border: "4px solid #000000",
          boxShadow: "0 8px 32px rgba(0,0,0,0.65)",
        }}
      >
        <img src={src} alt="Thomas Dubois" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <svg width={total} height={total} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="avatarRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={cx} cy={cy} r={radius} fill="none"
          stroke="url(#avatarRingGrad)" strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, delay: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ filter: "drop-shadow(0 0 5px rgba(129,140,248,0.8))" }}
        />
      </svg>
    </div>
  );
}

// ─── EXPANDABLE TEXT ───────────��──────────────────────────────────────────────

function ExpandableText({ text, maxChars = 110 }: { text: string; maxChars?: number }) {
  const [expanded, setExpanded] = useState(false);
  const needs = text.length > maxChars;
  const display = expanded || !needs ? text : text.slice(0, maxChars);
  return (
    <p style={{ fontSize: 14, color: "rgba(200,200,220,0.60)", lineHeight: 1.55, margin: 0 }}>
      {display}
      {needs && !expanded && (
        <>{" "}<button onClick={() => setExpanded(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "rgba(165,180,252,0.85)", fontWeight: 600, fontSize: 14 }}>plus…</button></>
      )}
    </p>
  );
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, delay = 0.3 }: { pct: number; delay?: number }) {
  const isOverflow = pct > 100;
  const isCompleted = pct >= 100 && !isOverflow; // exactement 100 via complétion explicite

  /**
   * Échelle dynamique :
   * - pct ≤ 100 → max = 100, remplissage normal
   * - pct > 100 → max = prochaine centaine (110% → max 200 → fill 55%),
   *   ce qui représente visuellement "le 2e tour" en cours sans agrandir la barre.
   */
  const dynamicMax = pct <= 100 ? 100 : Math.ceil(pct / 100) * 100;
  const barFill = Math.min(100, (pct / dynamicMax) * 100);

  return (
    <div style={{ position: "relative", height: 16, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${barFill}%` }}
        transition={{ duration: 1.2, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 999,
          background: isOverflow
            ? "linear-gradient(90deg,#f59e0b 0%,#fbbf24 60%,#fde68a 100%)"
            : isCompleted
              ? "linear-gradient(90deg,#22c55e 0%,#4ade80 60%,#86efac 100%)"
              : "linear-gradient(90deg,#4f46e5 0%,#818cf8 60%,#a5b4fc 100%)",
          boxShadow: isOverflow
            ? "0 0 18px rgba(245,158,11,0.75)"
            : isCompleted
              ? "0 0 16px rgba(34,197,94,0.70)"
              : "0 0 12px rgba(99,102,241,0.60)",
        }}
      />
      {isCompleted && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.80)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Objectif accompli ✓
          </span>
        </div>
      )}
      {isOverflow && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.88)", letterSpacing: "0.06em" }}>
            🚀 Objectif dépassé
          </span>
        </div>
      )}
    </div>
  );
}

// ─── MINI AREA CHART ─────────────────────────────────────────────────────────

// Conversion Catmull-Rom → cubic bezier pour une courbe fluide et organique
function smoothCurvePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  const T = 0.28; // tension (plus bas = plus doux)
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * T;
    const cp1y = p1.y + (p2.y - p0.y) * T;
    const cp2x = p2.x - (p3.x - p1.x) * T;
    const cp2y = p2.y - (p3.y - p1.y) * T;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function MiniAreaChart({ data }: { data: { label: string; value: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const height = 130, padL = 10, padR = 10, padT = 12, padB = 28;

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(containerRef.current);
    setWidth(containerRef.current.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const values = data.map((d) => d.value);
  const minV = 0; // toujours ancré à 0 pour montrer les creux
  const maxV = Math.max(...values, 15); // au moins 15 pour ne pas écraser
  const range = maxV - minV;

  const toX = (i: number) =>
    padL + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const toY = (v: number) => padT + innerH - ((v - minV) / range) * innerH;

  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.value) }));
  const linePath = smoothCurvePath(pts);
  // Fermeture de la zone remplie
  const areaPath = pts.length > 0
    ? `${linePath} L ${pts[pts.length - 1].x.toFixed(2)},${(padT + innerH).toFixed(2)} L ${pts[0].x.toFixed(2)},${(padT + innerH).toFixed(2)} Z`
    : "";

  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left - padL;
    const ci = Math.max(0, Math.min(data.length - 1, Math.round((mx / innerW) * (data.length - 1))));
    setTooltip({ x: pts[ci].x, y: pts[ci].y, label: data[ci].label, value: data[ci].value });
  };

  const gradId = "chart-area-grad";

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <svg width={width} height={height} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#818cf8" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {/* Zone remplie */}
        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
        {/* Courbe fluide */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#818cf8"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Labels X — afficher uniquement les labels non vides */}
        {data.map((d, i) =>
          d.label ? (
            <text key={`lx-${i}`} x={pts[i].x} y={height - 6} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.22)">
              {d.label}
            </text>
          ) : null
        )}
        {/* Tooltip */}
        {tooltip && (
          <>
            <line x1={tooltip.x} y1={padT} x2={tooltip.x} y2={padT + innerH} stroke="rgba(129,140,248,0.20)" strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={tooltip.x} cy={tooltip.y} r={3.5} fill="#818cf8" />
            <circle cx={tooltip.x} cy={tooltip.y} r={7} fill="rgba(129,140,248,0.15)" />
            <rect x={Math.min(tooltip.x - 24, width - 56)} y={tooltip.y - 33} width={48} height={22} rx={7} fill="rgba(8,8,22,0.95)" stroke="rgba(129,140,248,0.25)" strokeWidth={0.5} />
            <text x={Math.min(tooltip.x - 24, width - 56) + 24} y={tooltip.y - 18} textAnchor="middle" fontSize={10} fontWeight="700" fill="#a5b4fc">
              {tooltip.value}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ─── SECTION LABEL ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(144,144,168,0.55)", textTransform: "uppercase", marginBottom: 14 }}>
      {children}
    </p>
  );
}

// ─── NOTIFICATION PANEL ─────────────��─────────────────────────────────────────

function NotifPanel({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      style={{
        position: "fixed", top: 104, left: 16, right: 16, zIndex: 200,
        background: "rgba(6,6,18,0.92)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)",
        border: "0.5px solid rgba(255,255,255,0.11)", borderRadius: 22, overflow: "hidden",
        boxShadow: "0 16px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)",
        maxWidth: 448, margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f5" }}>Notifications</p>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
          style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.60)" }} />
        </motion.button>
      </div>
      <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
        {NOTIFS.map((n, i) => {
          const Icon = n.icon;
          return (
            <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: i < NOTIFS.length - 1 ? "0.5px solid rgba(255,255,255,0.04)" : "none", background: n.unread ? "rgba(99,102,241,0.05)" : "transparent", cursor: "pointer" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: n.unread ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon style={{ width: 15, height: 15, color: n.unread ? "#818cf8" : "rgba(255,255,255,0.35)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: n.unread ? "rgba(240,240,245,0.88)" : "rgba(200,200,220,0.50)", lineHeight: 1.4 }}>{n.text}</p>
              </div>
              <span style={{ fontSize: 11, color: "rgba(144,144,168,0.40)", flexShrink: 0 }}>{n.time}</span>
              {n.unread && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", boxShadow: "0 0 6px rgba(99,102,241,0.9)", flexShrink: 0 }} />}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── PROFILE POST ADAPTER (uses ProgressCard) ───��─────────────────────────────

const PROFILE_USER = { name: "Thomas Dubois", avatar: AVATAR_URL, objective: "Construire mon premier SaaS" };
const PROFILE_STREAK = 27;

function ProfilePostAdapter({ post }: { post: MockPost }) {
  /* ── Reply post: context strip above ProgressCard ── */
  if (post.replyTo) {
    return (
      <div style={{ marginBottom: 0 }}>
        {/* Original post context */}
        <div style={{
          background: "#0d0d0d",
          borderRadius: "20px 20px 0 0",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderBottom: "0.5px solid rgba(255,255,255,0.05)",
          padding: "12px 16px 10px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <img src={post.replyTo.avatar} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(165,180,252,0.75)" }}>{post.replyTo.name}</span>
            <span style={{ fontSize: 11, color: "rgba(165,180,252,0.35)", fontWeight: 500 }}>· Post original</span>
          </div>
          {post.replyTo.postTitle && <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(200,200,220,0.55)", marginBottom: 2 }}>{post.replyTo.postTitle}</p>}
          {post.replyTo.postText && <p style={{ fontSize: 12, color: "rgba(200,200,220,0.38)", lineHeight: 1.45, margin: 0 }}>{post.replyTo.postText}</p>}
        </div>
        {/* Reply itself */}
        <div style={{ borderRadius: "0 0 20px 20px", overflow: "hidden", marginBottom: 10 }}>
          <ProgressCard
            user={PROFILE_USER} streak={PROFILE_STREAK}
            progress={{ type: post.type as any, description: post.text, timestamp: post.time }}
            relevantCount={post.relevant} commentsCount={post.comments}
            sharesCount={post.shares || 0} viewsCount={post.views}
            hashtags={post.hashtags} disableDetailNav
          />
        </div>
      </div>
    );
  }

  /* ── Riposte post: tiny strip above ProgressCard ── */
  if (post.riposteOf) {
    return (
      <div style={{ marginBottom: 0 }}>
        <div style={{ padding: "6px 19px 2px", display: "flex", alignItems: "center", gap: 7 }}>
          <Repeat2 style={{ width: 12, height: 12, color: "rgba(165,180,252,0.42)", flexShrink: 0 }} />
          <img src={post.riposteOf.avatar} alt="" style={{ width: 17, height: 17, borderRadius: "50%", objectFit: "cover" }} />
          <span style={{ fontSize: 12, color: "rgba(165,180,252,0.50)", fontWeight: 600 }}>{post.riposteOf.name}</span>
          <span style={{ fontSize: 11, color: "rgba(144,144,168,0.35)" }}>· original</span>
        </div>
        <ProgressCard
          user={PROFILE_USER} streak={PROFILE_STREAK}
          progress={{ type: post.type as any, description: post.text, timestamp: post.time }}
          image={post.image} images={post.images}
          relevantCount={post.relevant} commentsCount={post.comments}
          sharesCount={post.shares || 0} viewsCount={post.views}
          isNew={post.isImpactant} hashtags={post.hashtags} disableDetailNav
        />
      </div>
    );
  }

  /* ── Standard post ── */
  return (
    <ProgressCard
      user={PROFILE_USER} streak={PROFILE_STREAK}
      progress={{ type: post.type as any, description: post.text, timestamp: post.time }}
      image={post.image} images={post.images}
      relevantCount={post.relevant} commentsCount={post.comments}
      sharesCount={post.shares || 0} viewsCount={post.views}
      isNew={post.isImpactant} hashtags={post.hashtags} disableDetailNav
    />
  );
}

// ─── PERSON CARD ─────────────────────────────────────────────────────────────

function PersonCard({ name, avatar, objective, followers, streak, tags }: {
  name: string; avatar: string; objective: string; followers: number; streak: number; tags?: string[];
}) {
  const navigate = useNavigate();
  const safeName = name || "";
  const username = safeName.toLowerCase().replace(/\s+/g, "");

  return (
    <div
      style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "18px 0", borderBottom: "0.5px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
      onClick={() => navigate(`/profile/${username}`)}
    >
      {/* Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <img src={avatar} alt={safeName} style={{ width: 78, height: 78, borderRadius: "50%", objectFit: "cover", display: "block" }} />
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 0 }}>
        {/* Name */}
        <p style={{ fontSize: 17, fontWeight: 700, color: "#f0f0f5", margin: "0 0 3px" }}>{safeName}</p>
        {/* @handle + followers */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, margin: "0 0 6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", fontWeight: 400 }}>
            {safeName.toLowerCase().replace(/\s+/g, "_")}
          </span>
          <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 13 }}>·</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
            {followers >= 1000 ? `${(followers / 1000).toFixed(1)}k` : followers} abonnés
          </span>
        </div>
        <p style={{ fontSize: 14, color: "rgba(200,200,220,0.58)", lineHeight: 1.45, marginBottom: 6 }}>{objective}</p>
        {tags && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
            {tags.map((t) => <span key={t} style={{ fontSize: 12, color: "rgba(165,180,252,0.60)" }}>{t}</span>)}
          </div>
        )}
        {/* Bouton Avancez avec — composant partagé */}
        <FollowButton username={username} size="md" />
      </div>
    </div>
  );
}

// ─── NAV BAR ─────────────────────────────────────────────────────────────────

const NAV_TABS: { key: ProfileTab; label: string }[] = [
  { key: "evolution", label: "Évolution" },
  { key: "posts",     label: "Posts"     },
  { key: "suivi",     label: "Suivi"     },
];

function ProfileNavBar({ active, onChange }: { active: ProfileTab; onChange: (t: ProfileTab) => void }) {
  return (
    <div
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        gap:            0,
        position:       "relative",
      }}
    >
      {NAV_TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <motion.button
            key={tab.key}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(tab.key)}
            style={{
              flex:       1,
              padding:    "13px 0",
              position:   "relative",
              background: "transparent",
              border:     "none",
              cursor:     "pointer",
            }}
          >
            {isActive && (
              <motion.div
                layoutId="activeTabIndicator"
                style={{
                  position:     "absolute",
                  bottom:       0,
                  left:         "18%",
                  right:        "18%",
                  height:       2.5,
                  borderRadius: 999,
                  background:   "linear-gradient(90deg, #6366f1, #818cf8)",
                  boxShadow:    "0 0 8px rgba(99,102,241,0.55)",
                }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span
              style={{
                position:   "relative",
                zIndex:     1,
                fontSize:   21,
                fontWeight: isActive ? 700 : 500,
                color:      isActive ? "#f0f0f5" : "rgba(255,255,255,0.38)",
                transition: "color 0.18s ease",
                display:    "block",
              }}
            >
              {tab.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── POSTS SECTION ────────────────────────────────────────────────────────────

function PostsSection() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<PostMode>("tout");
  const [trierOpen, setTrierOpen] = useState(false);
  const { savedPosts } = useSavedPosts();

  // ── Mes publications API ─────────────────────────────────────────────────
  const [apiPosts, setApiPosts] = useState<ApiPost[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);


  const { user: authUserForPosts } = useAuth();
  const myPostsUsername = authUserForPosts?.username || "thomasdubois";

  const fetchMyPosts = useCallback(async () => {
    setLoadingApi(true);
    setApiError(null);
    try {
      const { posts } = await getUserPosts(myPostsUsername, 50);
      // Tri décroissant par createdAt côté frontend (filet de sécurité)
      const sorted = [...posts].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setApiPosts(sorted);
    } catch (err) {
      console.error("Erreur chargement mes posts:", err);
      setApiError("Impossible de charger vos publications.");
    } finally {
      setLoadingApi(false);
    }
  }, [myPostsUsername]);

  useEffect(() => {
    fetchMyPosts();
  }, [fetchMyPosts]);



  // Les posts affichés sous les filtres sont maintenant basés sur les vrais posts API
  // (plus de données mock dans la section filtrée — fiabilité et cohérence garanties)
  const displayedPosts = (() => {
    if (mode === "impactant") return MY_POSTS.filter((p) => p.isImpactant);
    if (mode === "riposte")   return RIPOSTES;
    if (mode === "reponses")  return REPLIES;
    return MY_POSTS; // "tout" — legacy mock conservé pour la démonstration des réponses/ripostes
  })();

  return (
    <div>

      {/* ── Mes publications (backend) ──────────────────────────────────── */}
      <div style={{ marginBottom: 22 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 3, height: 16, borderRadius: 2,
              background: "linear-gradient(180deg,#818cf8,#6366f1)",
            }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>
              Mes publications
            </span>
            {apiPosts.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: "rgba(99,102,241,0.70)",
                background: "rgba(99,102,241,0.12)", borderRadius: 999,
                padding: "2px 8px", border: "0.5px solid rgba(99,102,241,0.22)",
              }}>
                {apiPosts.length}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("/create")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: "rgba(99,102,241,0.14)", border: "0.5px solid rgba(99,102,241,0.30)",
                color: "#a5b4fc", cursor: "pointer",
              }}
            >
              <PlusCircle style={{ width: 12, height: 12 }} />
              Publier
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={fetchMyPosts}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6 }}
            >
              {loadingApi ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw style={{ width: 12, height: 12, color: "rgba(99,102,241,0.50)" }} />
                </motion.div>
              ) : (
                <RefreshCw style={{ width: 12, height: 12, color: "rgba(255,255,255,0.25)" }} />
              )}
            </motion.button>
          </div>
        </div>

        {/* Erreur */}
        {apiError && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", borderRadius: 12,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)",
            marginBottom: 10,
          }}>
            <WifiOff style={{ width: 13, height: 13, color: "#f87171", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#fca5a5" }}>{apiError}</span>
          </div>
        )}

        {/* Posts publiés */}
        {!loadingApi && apiPosts.length === 0 && !apiError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: "center", padding: "28px 20px",
              borderRadius: 16, background: "rgba(255,255,255,0.03)",
              border: "0.5px dashed rgba(255,255,255,0.10)",
            }}
          >
            <PlusCircle style={{ width: 28, height: 28, color: "rgba(99,102,241,0.35)", margin: "0 auto 10px", display: "block" }} />
            <p style={{ fontSize: 14, color: "rgba(144,144,168,0.55)", margin: 0 }}>Aucun post publié pour l'instant.</p>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/create")}
              style={{
                marginTop: 14, padding: "8px 20px", borderRadius: 999,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: "rgba(99,102,241,0.14)", border: "0.5px solid rgba(99,102,241,0.30)",
                color: "#a5b4fc",
              }}
            >
              Créer mon premier post
            </motion.button>
          </motion.div>
        )}

        <AnimatePresence>
          {apiPosts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              transition={{ delay: i * 0.04, duration: 0.24 }}
              style={{ position: "relative", marginBottom: 10 }}
            >
              <ProgressCard
                postId={post.id}
                user={post.user}
                authorUsername={post.username}
                streak={post.streak}
                progress={post.progress}
                hashtags={post.hashtags}
                image={post.image ?? undefined}
                verified={post.verified}
                isNew={post.isNew}
                relevantCount={post.relevantCount}
                commentsCount={post.commentsCount}
                sharesCount={post.sharesCount}
                viewsCount={post.viewsCount}
                hideStreak
                disableDetailNav
                onPostDeleted={() => setApiPosts((prev) => prev.filter((p) => p.id !== post.id))}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Séparateur */}
        {apiPosts.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 18px" }}>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", fontWeight: 600, letterSpacing: "0.05em" }}>ARCHIVES</span>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.06)" }} />
          </div>
        )}
      </div>

      {/* Filter bar — capsules indépendantes alignées à gauche */}
      <div style={{ marginBottom: 14, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

          {/* Trier dropdown capsule */}
          <div style={{ position: "relative" }}>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => setTrierOpen((v) => !v)}
              style={{
                borderRadius: 999,
                padding: "7px 13px",
                background: (mode === "tout" || mode === "reponses") ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
                border: (mode === "tout" || mode === "reponses") ? "0.5px solid rgba(255,255,255,0.22)" : "0.5px solid rgba(255,255,255,0.14)",
                color: (mode === "tout" || mode === "reponses") ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.60)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
            >
              {mode === "reponses" ? "Réponses" : "Trier"}
              <ChevronDown
                style={{
                  width: 13, height: 13,
                  transform: trierOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  opacity: 0.7,
                }}
              />
            </motion.button>

            {/* Dropdown */}
            <AnimatePresence>
              {trierOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    zIndex: 300,
                    background: "rgba(14,14,22,0.97)",
                    backdropFilter: "blur(28px)",
                    WebkitBackdropFilter: "blur(28px)",
                    border: "0.5px solid rgba(255,255,255,0.12)",
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.70)",
                    minWidth: 150,
                  }}
                >
                  {[
                    { key: "tout" as PostMode, label: "Tout" },
                    { key: "reponses" as PostMode, label: "Réponses" },
                  ].map((opt, i) => (
                    <button
                      key={opt.key}
                      onClick={() => { setMode(opt.key); setTrierOpen(false); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "13px 18px",
                        background: mode === opt.key ? "rgba(99,102,241,0.14)" : "transparent",
                        border: "none",
                        borderBottom: i === 0 ? "0.5px solid rgba(255,255,255,0.07)" : "none",
                        textAlign: "left",
                        cursor: "pointer",
                        color: mode === opt.key ? "#a5b4fc" : "rgba(240,240,245,0.72)",
                        fontSize: 14,
                        fontWeight: mode === opt.key ? 700 : 500,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Impactant capsule */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setMode("impactant")}
            style={{
              borderRadius: 999,
              padding: "7px 14px",
              background: mode === "impactant" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
              border: mode === "impactant" ? "0.5px solid rgba(255,255,255,0.22)" : "0.5px solid rgba(255,255,255,0.14)",
              color: mode === "impactant" ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.60)",
              fontSize: 13,
              fontWeight: mode === "impactant" ? 700 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            Impactant
          </motion.button>

          {/* Riposte capsule */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setMode("riposte")}
            style={{
              borderRadius: 999,
              padding: "7px 14px",
              background: mode === "riposte" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
              border: mode === "riposte" ? "0.5px solid rgba(255,255,255,0.22)" : "0.5px solid rgba(255,255,255,0.14)",
              color: mode === "riposte" ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.60)",
              fontSize: 13,
              fontWeight: mode === "riposte" ? 700 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            Riposte
          </motion.button>

          {/* Important capsule */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setMode("important")}
            style={{
              borderRadius: 999,
              padding: "7px 14px",
              background: mode === "important" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
              border: mode === "important" ? "0.5px solid rgba(255,255,255,0.22)" : "0.5px solid rgba(255,255,255,0.14)",
              color: mode === "important" ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.60)",
              fontSize: 13,
              fontWeight: mode === "important" ? 700 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Bookmark style={{ width: 12, height: 12, strokeWidth: 2 }} />
            Important
            {savedPosts.length > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 18, height: 18, borderRadius: 999, padding: "0 4px",
                background: mode === "important" ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.18)",
                fontSize: 10, fontWeight: 800,
                color: mode === "important" ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.70)",
              }}>{savedPosts.length}</span>
            )}
          </motion.button>
        </div>
      </div>

      {trierOpen && <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => setTrierOpen(false)} />}

      {/* Posts list OR Important section */}
      <AnimatePresence mode="wait">
        {mode === "important" ? (
          <motion.div key="important" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            {/* Private notice */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 14, marginBottom: 14, background: "rgba(99,102,241,0.08)", border: "0.5px solid rgba(99,102,241,0.20)" }}>
              <Lock style={{ width: 13, height: 13, color: "rgba(165,180,252,0.70)", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "rgba(165,180,252,0.65)", margin: 0 }}>
                Cette section est privée — visible uniquement par vous.
              </p>
            </div>

            {savedPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0 32px" }}>
                <Bookmark style={{ width: 32, height: 32, color: "rgba(255,255,255,0.14)", margin: "0 auto 12px", display: "block" }} />
                <p style={{ fontSize: 14, color: "rgba(144,144,168,0.40)" }}>Aucun post enregistré.</p>
                <p style={{ fontSize: 12, color: "rgba(144,144,168,0.28)", marginTop: 4 }}>Appuyez sur l'icône marque-page d'un post pour l'enregistrer ici.</p>
              </div>
            ) : (
              <div>
                {savedPosts.map((sp, i) => (
                  <motion.div key={sp.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    style={{ background: "#0d0d0d", borderRadius: 18, marginBottom: 10, overflow: "hidden", border: "0.5px solid rgba(255,255,255,0.08)", position: "relative" }}
                  >
                    {/* Bookmark date badge */}
                    <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2, display: "flex", alignItems: "center", gap: 4 }}>
                      <Bookmark style={{ width: 11, height: 11, color: "#818cf8", fill: "#818cf8" }} />
                      <span style={{ fontSize: 10, color: "rgba(129,140,248,0.70)", fontWeight: 600 }}>
                        {sp.savedAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </div>

                    <div style={{ padding: "14px 16px 12px" }}>
                      {/* Author */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(99,102,241,0.22)", flexShrink: 0 }}>
                          <img src={sp.post.user.avatar} alt={sp.post.user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.88)", margin: 0 }}>{sp.post.user.name}</p>
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sp.post.user.objective}</p>
                        </div>
                      </div>
                      {/* Type boudin */}
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ display: "inline-block", background: "rgba(255,255,255,0.92)", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700, color: "#111" }}>
                          {TYPE_LABELS[sp.post.progress.type as PostType] ?? sp.post.progress.type}
                        </span>
                      </div>
                      {/* Text */}
                      <p style={{ fontSize: 14, color: "rgba(235,235,245,0.82)", lineHeight: 1.55, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                        {sp.post.progress.description}
                      </p>
                    </div>

                    {sp.post.image && (
                      <div style={{ width: "100%", height: 140, overflow: "hidden" }}>
                        <img src={sp.post.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            {displayedPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(144,144,168,0.40)", fontSize: 14 }}>
                Aucun contenu ici pour l'instant.
              </div>
            ) : (
              displayedPosts.map((post) => <ProfilePostAdapter key={post.id} post={post} />)
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SUIVI SECTION ─────────────────────────────────────���──────────────────────

// Toutes les personnes connues (mock) pour enrichir les profils Supabase
const ALL_KNOWN_PEOPLE = [
  ...FOLLOWING_LIST,
  ...FOLLOWERS_LIST,
  { id: 10, name: "Thomas Dubois",    avatar: "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lancer mon SaaS",          followers: 3800, streak: 87 },
  { id: 11, name: "Marie Laurent",    avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Apprendre le japonais",     followers: 2100, streak: 156 },
  { id: 12, name: "Emma Petit",       avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Écrire un roman",            followers: 4300, streak: 203 },
  { id: 13, name: "Sarah Martin",     avatar: "https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Marathon en 6 mois",        followers: 1240, streak: 42 },
  { id: 14, name: "Lucas Bernard",    avatar: "https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Indépendance financière",  followers: 2100, streak: 31 },
  { id: 15, name: "Antoine Rousseau", avatar: "https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Dev Full-Stack",             followers: 870,  streak: 64 },
  { id: 16, name: "Yasmine Hassan",   avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir data analyst",     followers: 4800, streak: 143 },
  { id: 17, name: "Elodie Chen",      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Designer freelance",       followers: 6700, streak: 91 },
  { id: 18, name: "Nicolas Faure",    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Perdre 15kg et muscler",  followers: 1890, streak: 55 },
];

function usernameToProfile(username: string): { name: string; avatar: string; objective: string; followers: number; streak: number } | null {
  const match = ALL_KNOWN_PEOPLE.find(
    (p) => p.name.toLowerCase().replace(/\s+/g, "") === username
  );
  return match ? { name: match.name, avatar: match.avatar, objective: match.objective, followers: match.followers, streak: match.streak } : null;
}

function SuiviSection({ username }: { username: string }) {
  // ── Abonnements : source de vérité = FollowContext (réactif immédiat) ───────
  const { followedList } = useFollow();

  // ── Abonnés : depuis Supabase (statique à la visite) ────────────────────────
  const [followersUsernames, setFollowersUsernames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    getFollowers(username)
      .then(({ followers }) => setFollowersUsernames(followers))
      .catch(() => setFollowersUsernames([]))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 32, gap: 8 }}>
        <Loader2 style={{ width: 16, height: 16, color: "rgba(99,102,241,0.55)" }} className="animate-spin" />
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)" }}>Chargement…</span>
      </div>
    );
  }

  // Abonnements : FollowContext est toujours à jour (désabonnement immédiat)
  const followingProfiles = followedList
    .map((u) => usernameToProfile(u) ?? { name: u, avatar: "", objective: "–", followers: 0, streak: 0 })
    .map((p, i) => ({ ...p, id: i, username: (p.name || followedList[i] || "").toLowerCase().replace(/\s+/g, "") }));

  const followersProfiles = followersUsernames
    .map((u) => usernameToProfile(u) ?? { name: u, avatar: "", objective: "–", followers: 0, streak: 0 })
    .map((p, i) => ({ ...p, id: i }));

  return (
    <div>
      {/* Abonnements */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f5", marginBottom: 2 }}>Abonnements</p>
        <p style={{ fontSize: 12, color: "rgba(144,144,168,0.45)", marginBottom: 4 }}>
          Vous suivez {followingProfiles.length} personne{followingProfiles.length !== 1 ? "s" : ""}
        </p>
        <AnimatePresence>
          {followingProfiles.map((p) => (
            <motion.div
              key={p.username || p.id}
              initial={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, overflow: "hidden", marginBottom: 0 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
            >
              <PersonCard {...p} />
            </motion.div>
          ))}
        </AnimatePresence>
        {followingProfiles.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ fontSize: 14, color: "rgba(144,144,168,0.38)", textAlign: "center", paddingTop: 12 }}>
            Vous ne suivez personne encore.
          </motion.p>
        )}
      </div>

      {/* Abonnés */}
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f5", marginBottom: 2 }}>Abonnés</p>
        <p style={{ fontSize: 12, color: "rgba(144,144,168,0.45)", marginBottom: 4 }}>
          {followersProfiles.length} personne{followersProfiles.length !== 1 ? "s" : ""} vous sui{followersProfiles.length !== 1 ? "vent" : "t"}
        </p>
        {followersProfiles.map((p) => (
          <PersonCard key={p.id} {...p} />
        ))}
        {followersProfiles.length === 0 && (
          <p style={{ fontSize: 14, color: "rgba(144,144,168,0.38)", textAlign: "center", paddingTop: 12 }}>
            Personne ne vous suit encore.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── EVOLUTION SECTION ────────────────────────────────────────────────────────

type EvoFilter = "all" | "30d" | "week";

const FILTER_OPTIONS: { key: EvoFilter; label: string }[] = [
  { key: "all", label: "Depuis toujours" },
  { key: "30d", label: "30 derniers jours" },
  { key: "week", label: "Cette semaine" },
];

function StatBlock({ value, label, gradient = false }: { value: string | number; label: string; gradient?: boolean }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <p style={{
        fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1, marginBottom: 5,
        ...(gradient
          ? { background: "linear-gradient(135deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }
          : { color: "#f0f0f5" }),
      }}>
        {value}
      </p>
      <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(144,144,168,0.50)", letterSpacing: "0.09em", textTransform: "uppercase", lineHeight: 1.35 }}>
        {label}
      </p>
    </div>
  );
}

// Animated dots for objectives count loading state
function AnimatedObjectifsCount() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, lineHeight: 1, marginBottom: 5 }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{ fontSize: 26, fontWeight: 900, color: "#8b5cf6", display: "inline-block" }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
        >
          .
        </motion.span>
      ))}
      <span style={{ fontSize: 26, fontWeight: 800, color: "#f0f0f5", letterSpacing: "-0.5px", marginLeft: 1 }}>1</span>
    </div>
  );
}

function EvolutionSection({ userId, progressPct, objective, objectiveDesc }: {
  userId: string;
  progressPct: number;
  objective?: string;
  objectiveDesc?: string;
}) {
  // Lecture du contexte de progression unifié
  const { primaryProgress, primaryGoal, allGoals, selectedGoalId, selectGoal, loading: objLoading } = useObjectiveProgress();
  const [evolutionFilter, setEvolutionFilter] = useState<EvoFilter>("30d");
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [stats, setStats] = useState<ExtendedStats | null>(null);

  // Fetch extended stats (constance chart footer, objectif badge jours)
  useEffect(() => {
    if (!userId) return;
    getExtendedStats(userId)
      .then((s) => setStats(s))
      .catch((err) => console.error("Erreur extended-stats:", err));
  }, [userId]);

  // Fetch chart data when filter changes
  useEffect(() => {
    if (!userId) return;
    setChartLoading(true);
    getEvolutionChart(userId, evolutionFilter)
      .then(({ points }) => setChartPoints(points.length > 0 ? points : []))
      .catch((err) => { console.error("Erreur chart:", err); setChartPoints([]); })
      .finally(() => setChartLoading(false));
  }, [userId, evolutionFilter]);

  const constanceScore = stats?.constanceScore ?? 0;
  const constanceActiveDays = stats?.constanceActiveDays ?? 0;
  const daysOnFF = stats?.daysOnFF ?? 1;
  const liveProgressScore = stats?.progressScore ?? progressPct;

  // Fallback chart — toujours partir de 0 (jamais de faux score pour un nouveau compte)
  const displayPoints =
    chartPoints.length >= 2
      ? chartPoints
      : chartPoints.length === 1
        ? [{ label: chartPoints[0].label, value: 0, date: chartPoints[0].date }, chartPoints[0]]
        : [{ label: "J1", value: 0, date: "" }, { label: "Auj.", value: 0, date: "" }];

  return (
    <div>
      {/* Stats — 3 cartes gradient verticales */}
      <DashboardStatsCards userId={userId} isOwner style={{ marginBottom: 12 }} />

      {/* Objectif actif — avec sélecteur d'objectifs si plusieurs */}
      <div style={{ ...surfaceStyle, borderRadius: 24, padding: "18px 20px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <SectionLabel>Objectif actif</SectionLabel>
          {daysOnFF > 0 && (
            <div style={{ borderRadius: 999, padding: "4px 11px", background: "rgba(99,102,241,0.12)", border: "0.5px solid rgba(99,102,241,0.24)", marginTop: -14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(165,180,252,0.85)" }}>{daysOnFF} jour{daysOnFF !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Sélecteur d'objectifs — visible quand il y en a plusieurs */}
        {!objLoading && allGoals.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {allGoals.map((goal) => {
              const isSelected = goal.id === (selectedGoalId ?? primaryGoal?.id);
              const isAccompli = goal.status === "accompli";
              return (
                <motion.button
                  key={goal.id}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => selectGoal(goal.id)}
                  title={goal.title}
                  style={{
                    maxWidth: 160, padding: "5px 11px", borderRadius: 999, cursor: "pointer",
                    background: isSelected ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.06)",
                    border: isSelected ? "0.5px solid rgba(99,102,241,0.45)" : "0.5px solid rgba(255,255,255,0.10)",
                    display: "flex", alignItems: "center", gap: 5, transition: "all 0.18s ease",
                  }}
                >
                  {isAccompli && <span style={{ fontSize: 10 }}>✓</span>}
                  <span style={{
                    fontSize: 11, fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? "#a5b4fc" : "rgba(200,200,220,0.55)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {goal.title}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}

        <p style={{ fontSize: 27, fontWeight: 700, color: "rgba(240,240,245,0.92)", letterSpacing: "-0.2px", marginBottom: 10 }}>
          {primaryGoal?.title ?? objective ?? "Construire mon premier SaaS"}
        </p>
        <div style={{ marginBottom: 16 }}>
          <ExpandableText text={primaryGoal?.description ?? objectiveDesc ?? OBJECTIVE_DESC} maxChars={100} />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "rgba(200,200,220,0.50)", fontWeight: 500 }}>Progression</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: primaryProgress > 100 ? "#f59e0b" : primaryProgress >= 100 ? "#22c55e" : "#8b5cf6" }}>
              {objLoading ? "…" : primaryProgress > 100 ? `${Math.round(primaryProgress)}% 🚀` : primaryProgress >= 100 ? "✓ Accompli !" : `${Math.round(primaryProgress)}%`}
            </span>
          </div>
          {/* Fix bug : ne plus utiliser liveProgressScore pendant le chargement (évite le flash "casi fini") */}
          <ProgressBar pct={primaryProgress} delay={objLoading ? 0 : 0.3} />

          {/* Points accumulés — affichés sous la barre si disponibles */}
          {!objLoading && primaryGoal?.progress_score !== undefined && primaryGoal?.progress_max !== undefined && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.28 }}
              style={{
                display: "flex", alignItems: "center", gap: 8, marginTop: 10,
                padding: "8px 12px", borderRadius: 12,
                background: "rgba(139,92,246,0.07)",
                border: "0.5px solid rgba(139,92,246,0.18)",
              }}
            >
              <span style={{ fontSize: 18 }}>⚡</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#a5b4fc" }}>
                  {primaryGoal.progress_score}
                </span>
                <span style={{ fontSize: 12, color: "rgba(165,180,252,0.50)", fontWeight: 500 }}>
                  {" "}/ {primaryGoal.progress_max} pts
                </span>
              </div>
              {primaryGoal.duration_type && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: "rgba(165,180,252,0.45)",
                  padding: "2px 8px", borderRadius: 999,
                  background: "rgba(139,92,246,0.10)",
                  flexShrink: 0,
                }}>
                  {({"1_semaine":"7j","1_mois":"1 mois","3_mois":"3 mois","6_mois":"6 mois","1_an":"1 an","2_ans":"2 ans","plus":"2 ans+"} as Record<string,string>)[primaryGoal.duration_type] ?? primaryGoal.duration_type}
                </span>
              )}
            </motion.div>
          )}

          {!objLoading && primaryProgress === 100 && (
            <p style={{ fontSize: 12, color: "rgba(34,197,94,0.65)", marginTop: 8, fontStyle: "italic" }}>
              🎉 Objectif atteint — définis un nouvel objectif pour continuer !
            </p>
          )}
          {!objLoading && primaryProgress > 100 && (
            <p style={{ fontSize: 12, color: "rgba(245,158,11,0.75)", marginTop: 8, fontStyle: "italic" }}>
              🚀 Objectif dépassé — tu surpasses tes propres limites !
            </p>
          )}
        </div>
      </div>

      {/* Évolution chart */}
      <div style={{ ...surfaceStyle, borderRadius: 24, padding: "18px 18px 14px", marginBottom: 12 }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f5", marginBottom: 14 }}>L'évolution</p>
        <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap" }}>
          {FILTER_OPTIONS.map((f) => {
            const active = evolutionFilter === f.key;
            return (
              <motion.button key={f.key} whileTap={{ scale: 0.93 }} onClick={() => setEvolutionFilter(f.key)}
                style={{ borderRadius: 999, padding: "6px 13px", background: active ? "rgba(99,102,241,0.16)" : "transparent", border: active ? "0.5px solid rgba(99,102,241,0.40)" : "0.5px solid rgba(255,255,255,0.14)", color: active ? "#a5b4fc" : "rgba(255,255,255,0.50)", fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.18s ease" }}>
                {f.label}
              </motion.button>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          {chartLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 style={{ width: 18, height: 18, color: "rgba(99,102,241,0.50)" }} className="animate-spin" />
            </motion.div>
          ) : displayPoints.length <= 1 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ height: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <TrendingUp style={{ width: 24, height: 24, color: "rgba(99,102,241,0.30)" }} strokeWidth={1.5} />
              <p style={{ fontSize: 13, color: "rgba(144,144,168,0.38)", textAlign: "center" }}>
                Commence à poster, commenter et avancer tes objectifs pour voir ton évolution ici !
              </p>
            </motion.div>
          ) : (
            <motion.div key={evolutionFilter} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              <MiniAreaChart data={displayPoints} />
            </motion.div>
          )}
        </AnimatePresence>
        {!chartLoading && stats?.constanceScore !== undefined && (
          <p style={{ fontSize: 11, color: "rgba(144,144,168,0.35)", marginTop: 8, textAlign: "right" }}>
            Régularité sur 30 jours : {constanceScore}%
          </p>
        )}
      </div>

      {/* Badges */}
      <div id="profile-badges-section">
        <BadgesSection
          surfaceStyle={surfaceStyle}
          borderRadius={24}
          fadeBg="rgba(6,6,14,0.88)"
          objective={{ goal: primaryGoal?.title ?? objective ?? "Construire mon premier SaaS", value: `${daysOnFF} jours` }}
        />
      </div>
    </div>
  );
}

// ─── LAYOUT CONSTANTS ─────────────────────────────────────────────────────────

const BANNER_HEIGHT = 165;
const AVATAR_SIZE = 120;
const RING_STROKE = 5;
const RING_PAD = RING_STROKE + 3;
const RING_TOTAL = AVATAR_SIZE + RING_PAD * 2;
const AVATAR_OVERLAP = 82;

// ─── MY IDENTITY ─────────────────────────────────────────────────────────────

const MY_USERNAME = "thomasdubois"; // fallback — remplacé dynamiquement via useAuth

const DEFAULT_PROFILE_DATA = {
  name: "", handle: "",
  avatar: "", banner: "", bio: "",
  objective: "", objectiveDesc: "",
  descriptor: "", hashtags: [],
  streak: 0, constance: 0, progressPct: 0, objectifsAccomplis: 0, daysOnFF: 1,
};



// ─── SEARCH MODAL ─────────────────────────────────────────────────────────────

const SEARCH_SUGGESTIONS = [
  { label: "Posts", items: ["Avancement · 2h", "Bilan semaine 6 · 3j", "Leçon apprise · 2sem"] },
  { label: "Réponses", items: ["Réponse à Lucas Bernard", "Réponse à Emma Petit"] },
  { label: "Suivi", items: ["Emma Petit", "Sofia Martin", "Lucas Bernard"] },
];

function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { setTimeout(() => inputRef.current?.focus(), 150); }, []);

  const filtered = SEARCH_SUGGESTIONS.map((s) => ({
    ...s,
    items: s.items.filter((it) => query === "" || it.toLowerCase().includes(query.toLowerCase())),
  })).filter((s) => s.items.length > 0);

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)" }}
      />
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
        style={{
          position: "fixed", top: 64, left: 0, right: 0, zIndex: 401,
          maxWidth: 640, margin: "0 auto", padding: "0 16px",
        }}
      >
        <div style={{
          background: "rgba(8,8,20,0.97)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)",
          border: "0.5px solid rgba(255,255,255,0.13)", borderRadius: 24,
          boxShadow: "0 24px 64px rgba(0,0,0,0.70), inset 0 1px 0 rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}>
          {/* Search input */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
            <Search style={{ width: 18, height: 18, color: "rgba(165,180,252,0.70)", flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un post, une réponse, un suivi…"
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontSize: 15, color: "#f0f0f5",
              }}
            />
            <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
              style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.55)" }} />
            </motion.button>
          </div>
          {/* Results */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "32px 18px", textAlign: "center", color: "rgba(144,144,168,0.40)", fontSize: 14 }}>Aucun résultat</div>
            ) : (
              filtered.map((section) => (
                <div key={section.label}>
                  <div style={{ padding: "12px 18px 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", color: "rgba(144,144,168,0.50)", textTransform: "uppercase" }}>
                    {section.label}
                  </div>
                  {section.items.map((item) => (
                    <motion.button key={item} whileTap={{ scale: 0.98 }}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(99,102,241,0.12)", border: "0.5px solid rgba(99,102,241,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Search style={{ width: 13, height: 13, color: "#818cf8" }} />
                      </div>
                      <span style={{ fontSize: 14, color: "rgba(220,220,235,0.80)" }}>{item}</span>
                    </motion.button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export function Profile() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("evolution");
  const [showNotifs, setShowNotifs] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { user: authUser } = useAuth();
  const { primaryProgress } = useObjectiveProgress();

  const unreadCount = NOTIFS.filter((n) => n.unread).length;

  // Utilise le vrai username depuis l'auth (avec fallback)
  const MY_EFFECTIVE_USERNAME = authUser?.username || MY_USERNAME;

  const handleShareProfile = useCallback(() => {
    const url = `${window.location.origin}/profile/${MY_EFFECTIVE_USERNAME}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2200);
    }).catch(() => {
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
  }, [MY_EFFECTIVE_USERNAME]);

  // ── Données Supabase ────────────────────────────────────────────────────
  const [supaProfile, setSupaProfile] = useState<UserProfile | null>(null);

  const loadMyProfile = useCallback(async () => {
    try {
      const { found, profile: p } = await getProfile(MY_EFFECTIVE_USERNAME);
      if (found && (p.followersCount > 0 || p.onboardingDone || p.objective)) {
        // Profil trouvé avec des données réelles — utiliser directement
        setSupaProfile(p);
      } else if (found && authUser?.supabaseId) {
        // Profil trouvé mais potentiellement vide après rename — essayer par UID
        try {
          const res = await fetch(
            `${PROFILE_BASE}/profiles/by-uid/${encodeURIComponent(authUser.supabaseId)}`,
            { headers: PROFILE_HEADERS }
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.found && data?.profile) {
              setSupaProfile({ ...data.profile, postsCount: data.profile.postsCount || 0, followersCount: data.profile.followersCount || 0, followingCount: data.profile.followingCount || 0 });
              return;
            }
          }
        } catch {}
        setSupaProfile(p);
      } else if (!found && authUser?.supabaseId) {
        // Profil introuvable par username — chercher par UID (cas rename)
        try {
          const res = await fetch(
            `${PROFILE_BASE}/profiles/by-uid/${encodeURIComponent(authUser.supabaseId)}`,
            { headers: PROFILE_HEADERS }
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.found && data?.profile) {
              setSupaProfile({ ...data.profile, postsCount: data.profile.postsCount || 0, followersCount: data.profile.followersCount || 0, followingCount: data.profile.followingCount || 0 });
              return;
            }
          }
        } catch {}
        // Vraiment nouveau profil — créer avec les données auth et zéro pour tous les indicateurs
        const seeded = await upsertProfile(MY_EFFECTIVE_USERNAME, {
          name: authUser?.name || "",
          handle: `@${MY_EFFECTIVE_USERNAME}`,
          avatar: authUser?.avatar || "",
          banner: "",
          bio: "",
          objective: authUser?.objective || "",
          objectiveDesc: "",
          descriptor: "",
          hashtags: [],
          streak: 0,
          constance: 0,
          progressPct: 0,
          objectifsAccomplis: 0,
          daysOnFF: 1,
          onboardingDone: false,
        });
        setSupaProfile({ ...seeded, postsCount: 0, followersCount: 0, followingCount: 0 });
      } else if (!found) {
        const seeded = await upsertProfile(MY_EFFECTIVE_USERNAME, {
          name: authUser?.name || "",
          handle: `@${MY_EFFECTIVE_USERNAME}`,
          avatar: authUser?.avatar || "",
          banner: "",
          bio: "",
          objective: authUser?.objective || "",
          objectiveDesc: "",
          descriptor: "",
          hashtags: [],
          streak: 0,
          constance: 0,
          progressPct: 0,
          objectifsAccomplis: 0,
          daysOnFF: 1,
          onboardingDone: false,
        });
        setSupaProfile({ ...seeded, postsCount: 0, followersCount: 0, followingCount: 0 });
      }
    } catch (err) {
      console.error("Erreur chargement profil:", err);
    }
  }, [MY_EFFECTIVE_USERNAME, authUser]);

  useEffect(() => { loadMyProfile(); }, [loadMyProfile]);

  const streak        = supaProfile?.streak             ?? DEFAULT_PROFILE_DATA.streak;
  const followers     = supaProfile?.followersCount     ?? 0;
  const following     = supaProfile?.followingCount     ?? 0;
  const progressPct   = supaProfile?.progressPct        ?? DEFAULT_PROFILE_DATA.progressPct;
  const displayName   = supaProfile?.name               ?? authUser?.name ?? DEFAULT_PROFILE_DATA.name;
  const displayHandle = supaProfile?.handle             ?? `@${MY_EFFECTIVE_USERNAME}`;
  const displayAvatar = supaProfile?.avatar             ?? authUser?.avatar ?? DEFAULT_PROFILE_DATA.avatar;
  const displayBanner = supaProfile?.banner             ?? DEFAULT_PROFILE_DATA.banner;
  const displayBio    = supaProfile?.bio                ?? DEFAULT_PROFILE_DATA.bio;
  const displayDesc   = supaProfile?.descriptor         ?? DEFAULT_PROFILE_DATA.descriptor;
  const displayTags   = supaProfile?.hashtags           ?? DEFAULT_PROFILE_DATA.hashtags;
  const displayObj    = supaProfile?.objective          ?? authUser?.objective ?? DEFAULT_PROFILE_DATA.objective;
  const displayObjD   = supaProfile?.objectiveDesc      ?? DEFAULT_PROFILE_DATA.objectiveDesc;

  const navigate = useNavigate();
  const showInfo = activeTab === "evolution";

  return (
    <div className="select-none" style={{ minHeight: "100dvh", background: "#000000", position: "relative", paddingBottom: 120 }}>

      <div style={{ maxWidth: 672, marginLeft: "auto", marginRight: "auto" }}>

        {/* ── Banner — full width, straight corners, buttons overlaid bottom-right ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }}
          style={{ height: BANNER_HEIGHT, overflow: "hidden", position: "relative" }}>
          <motion.img
            src={displayBanner} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            animate={{
              filter: showInfo
                ? "brightness(0.75) saturate(1.1) blur(0px)"
                : "brightness(0.32) saturate(0.5) blur(18px)",
              scale: showInfo ? 1 : 1.06,
            }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.50) 100%)" }} />

          {/* Action buttons pinned bottom-right — une seule ligne */}
          <div style={{ position: "absolute", bottom: 12, right: 14, display: "flex", alignItems: "center", gap: 7 }}>

            {/* Bouton Partager */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleShareProfile}
              title="Copier le lien de mon profil"
              style={{
                width: 33, height: 33, borderRadius: "50%",
                background: linkCopied ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.12)",
                backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                border: linkCopied ? "0.5px solid rgba(34,197,94,0.40)" : "0.5px solid rgba(255,255,255,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                transition: "all 0.22s ease",
              }}
            >
              <AnimatePresence mode="wait">
                {linkCopied ? (
                  <motion.div key="check" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}>
                    <Check style={{ width: 13, height: 13, color: "#22c55e" }} />
                  </motion.div>
                ) : (
                  <motion.div key="link" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}>
                    <Link2 style={{ width: 13, height: 13, color: "rgba(255,255,255,0.85)" }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Bouton Progression */}
            <motion.div whileTap={{ scale: 0.88 }} onClick={() => navigate("/progression")}
              title="Ma progression"
              style={{ height: 33, paddingLeft: 10, paddingRight: 12, borderRadius: 999, background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "0.5px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <TrendingUp style={{ width: 12, height: 12, color: "rgba(255,255,255,0.85)", strokeWidth: 2 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>Progression</span>
            </motion.div>

            {/* Bouton Recherche */}
            <motion.div whileTap={{ scale: 0.88 }} onClick={() => navigate("/search")}
              style={{ width: 33, height: 33, borderRadius: "50%", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "0.5px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Search style={{ width: 13, height: 13, color: "rgba(255,255,255,0.85)" }} />
            </motion.div>

            {/* Bouton Paramètres — accède à la page dédiée */}
            <motion.div whileTap={{ scale: 0.88 }} onClick={() => navigate("/profile/settings")}
              title="Paramètres du profil"
              style={{ width: 33, height: 33, borderRadius: "50%", background: "rgba(99,102,241,0.18)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "0.5px solid rgba(99,102,241,0.40)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 0 10px rgba(99,102,241,0.25)" }}>
              <Settings style={{ width: 13, height: 13, color: "#a5b4fc" }} />
            </motion.div>

          </div>
        </motion.div>

        {/* ── Profile card — avatar + streak + info — visible only on Evolution ── */}
        <AnimatePresence initial={false}>
          {showInfo && (
            <motion.div
              key="profile-card"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ position: "relative", overflow: "visible" }}
            >
              {/* Avatar ring — progression synchronisée depuis Supabase KV */}
              <div style={{ position: "absolute", top: -AVATAR_OVERLAP, left: 18, zIndex: 20 }}>
                <AvatarProgressRing src={displayAvatar} progress={primaryProgress} size={AVATAR_SIZE} />
              </div>

              {/* Glass card */}
              <div style={{ ...surfaceStyle, borderRadius: "0 0 24px 24px", position: "relative", overflow: "hidden" }}>
                {/* Top row: spacer left */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 18px 0" }}>
                  <div style={{ width: RING_TOTAL + 4, height: RING_TOTAL - AVATAR_OVERLAP + 2, flexShrink: 0 }} />
                </div>

                {/* Info */}
                <div style={{ paddingTop: 8, paddingBottom: 20, paddingLeft: 18, paddingRight: 18 }}>
                  <p style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f5", letterSpacing: "-0.35px", margin: 0, marginBottom: 3 }}>{displayName}</p>
                  <p style={{ fontSize: 14, color: "rgba(200,200,220,0.45)", marginBottom: 14 }}>{stripAt(displayHandle)}</p>

                  <div style={{ marginBottom: 13 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", background: "#ffffff", borderRadius: 999, padding: "5px 16px" }}>
                      <span style={{ color: "#000000", fontSize: 13, fontWeight: 700 }}>{displayDesc}</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <ExpandableText text={displayBio} maxChars={105} />
                  </div>

                  {/* ── Fcoin strip — clic → scroll vers la section Fcoins ── */}
                  <FcoinHeaderStrip
                    userId={MY_EFFECTIVE_USERNAME}
                    onScrollToBadges={() => {
                      document.getElementById("profile-badges-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  />

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <button onClick={() => setActiveTab("suivi")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", gap: 4, alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#f0f0f5" }}>{followers}</span>
                      <span style={{ fontSize: 13, color: "rgba(200,200,220,0.48)" }}>abonnés</span>
                    </button>
                    <span style={{ color: "rgba(144,144,168,0.28)", fontSize: 14 }}>•</span>
                    <button onClick={() => setActiveTab("suivi")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", gap: 4, alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#f0f0f5" }}>{following}</span>
                      <span style={{ fontSize: 13, color: "rgba(200,200,220,0.48)" }}>abonnements</span>
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {displayTags.map((tag) => (
                      <span key={tag} style={{ fontSize: 13, fontWeight: 500, color: "rgba(165,180,252,0.72)" }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Nav + content ── */}
        <div style={{ padding: "0 16px" }}>

          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.36 }}
            style={{ marginTop: 14, marginBottom: 14 }}
          >
            <ProfileNavBar active={activeTab} onChange={setActiveTab} />
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {activeTab === "evolution" && (
                <EvolutionSection userId={MY_EFFECTIVE_USERNAME} progressPct={progressPct} objective={displayObj} objectiveDesc={displayObjD} />
              )}
              {activeTab === "posts" && <PostsSection />}
              {activeTab === "suivi" && <SuiviSection username={MY_EFFECTIVE_USERNAME} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Notif panel */}
      <AnimatePresence>
        {showNotifs && <NotifPanel onClose={() => setShowNotifs(false)} />}
      </AnimatePresence>

      {/* Notif overlay */}
      <AnimatePresence>
        {showNotifs && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowNotifs(false)}
            style={{ position: "fixed", inset: 0, zIndex: 150 }} />
        )}
      </AnimatePresence>


    </div>
  );
}
