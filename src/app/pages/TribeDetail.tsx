import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router";
import { ArrowLeft, Lock, Loader2, Search, Bell, BellOff, PenLine, Hash } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "motion/react";

import { FollowButton } from "../components/FollowButton";
import { ProgressCard } from "../components/ProgressCard";
import { TribeCommunityPost } from "../components/TribeCommunityPost";
import { seedCommunityPosts } from "../api/communityPostsApi";
import { TribeStats } from "../components/TribeStats";
import { ChannelChat } from "../components/ChannelChat";
import { CommunityImpact } from "../components/CommunityImpact";
import { CommunitySubscribeButton } from "../components/CommunitySubscribeButton";
import { useCommunityMember } from "../context/CommunityMemberContext";
import { useActiveCommunity } from "../context/ActiveCommunityContext";
import { type ApiPost } from "../api/postsApi";
import { toast } from "sonner";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { Authorization: `Bearer ${publicAnonKey}` };

// IDs statiques (hardcodés)
const STATIC_IDS = new Set(["1", "2", "3", "4", "5"]);

const TRIBE_AVATAR =
  "https://images.unsplash.com/photo-1563461660947-507ef49e9c47?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400";

const TRIBE_BANNER =
  "https://images.unsplash.com/photo-1556983852-43bf21186b2a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBidWlsZGluZyUyMGFyY2hpdGVjdHVyZSUyMG5hdHVyZSUyMGdyZWVuJTIwcGxhbnRzJTIwdXJiYW58ZW58MXx8fHwxNzcyODczMDI2fDA&ixlib=rb-4.1.0&q=80&w=1080";

const tribeData = {
  name: "Créateurs SaaS",
  mentality: "Objectif",
  mentalityLevel: "Argent",
  objective: "Lancer nos produits et atteindre nos premiers 1 000 clients",
  members: 245,
  streak: 145,
  constance: 87,
};

const AVATAR_SIZE = 162;
const AVATAR_HALF = AVATAR_SIZE / 2;

const tribeMembers = [
  {
    id: "m1",
    name: "Thomas Dubois",
    handle: "thomas_d",
    avatar: "https://images.unsplash.com/photo-1584940121730-93ffb8aa88b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    streak: 87,
    daysSince: 312,
    isAdmin: true,
  },
  {
    id: "m2",
    name: "Sophie Chen",
    handle: "sophie_c",
    avatar: "https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    streak: 22,
    daysSince: 198,
    isAdmin: true,
  },
  {
    id: "m3",
    name: "Marc Laurent",
    handle: "marc_l",
    avatar: "https://images.unsplash.com/photo-1719257751404-1dea075324bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    streak: 17,
    daysSince: 87,
    isAdmin: false,
  },
  {
    id: "m4",
    name: "Julia Renard",
    handle: "julia_r",
    avatar: "https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    streak: 119,
    daysSince: 445,
    isAdmin: false,
  },
  {
    id: "m5",
    name: "Kevin Blanc",
    handle: "kevin_b",
    avatar: "https://images.unsplash.com/photo-1758598497635-48cbbb1f6555?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    streak: 11,
    daysSince: 54,
    isAdmin: false,
  },
  {
    id: "m6",
    name: "Alex Martin",
    handle: "alex_m",
    avatar: "https://images.unsplash.com/photo-1740948267260-a738065a4b66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    streak: 75,
    daysSince: 267,
    isAdmin: false,
  },
];

const actus = [
  {
    id: "a1",
    avatar: "https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    name: "Léa Dubois",
    timestamp: "il y a 3h",
    role: "Modératrice",
    memberSince: "membre depuis 2023",
    badge: "Actus",
    text: "Nouveau défi pour la communauté :\n\nPublier 1 projet cette semaine.\nObjectif : 50 projets publiés.",
    repliesCount: 14,
    hashtags: ["#Lancement", "#SaaS", "#Indiehacker"],
  },
  {
    id: "a2",
    avatar: "https://images.unsplash.com/photo-1584940121730-93ffb8aa88b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    name: "Thomas Dubois",
    timestamp: "il y a 6h",
    role: "Membre",
    memberSince: "membre depuis 2022",
    badge: "Objectif",
    text: "3 heures de code aujourd'hui. J'ai intégré le système de paiement Stripe — enfin !",
    repliesCount: 8,
    hashtags: ["#SaaS", "#Revenue", "#MRR"],
    image: "https://images.unsplash.com/photo-1670761301241-7cec3cd6a925?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    id: "a3",
    avatar: "https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    name: "Sophie Chen",
    timestamp: "il y a 9h",
    role: "Membre",
    memberSince: "membre depuis 2023",
    badge: "Avancement",
    text: "Première version du prototype terminée. Tests utilisateurs demain matin — besoin de feedback !",
    repliesCount: 12,
    hashtags: ["#Startup", "#Growth", "#Lancement"],
    image: "https://images.unsplash.com/photo-1760611656615-db3fad24a314?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    id: "a4",
    avatar: "https://images.unsplash.com/photo-1719257751404-1dea075324bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    name: "Marc Laurent",
    timestamp: "il y a 12h",
    role: "Membre",
    memberSince: "membre depuis 2023",
    badge: "Conseil",
    text: "Conseil du jour : validez votre idée avant de coder. J'ai perdu 3 semaines sur une feature que personne ne voulait. Un simple sondage aurait tout évité.",
    repliesCount: 23,
    hashtags: ["#Validation", "#MVP", "#Lean"],
  },
  {
    id: "a5",
    avatar: "https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    name: "Julia Renard",
    timestamp: "il y a 1j",
    role: "Membre",
    memberSince: "membre depuis 2022",
    badge: "Bilan",
    text: "Bilan de la semaine : 5 prospects contactés, 2 démos planifiées, 1 contrat signé. Le pipeline commercial se construit lentement mais sûrement.",
    repliesCount: 7,
    hashtags: ["#Sales", "#B2B", "#SaaS"],
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    id: "a6",
    avatar: "https://images.unsplash.com/photo-1758598497635-48cbbb1f6555?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    name: "Kevin Blanc",
    timestamp: "il y a 1j",
    role: "Membre",
    memberSince: "membre depuis 2024",
    badge: "Question",
    text: "Comment vous gérez la pricing page pour un SaaS B2B ? Freemium vs trial ? Je suis bloqué sur cette décision depuis une semaine.",
    repliesCount: 31,
    hashtags: ["#Pricing", "#SaaS", "#Strategy"],
  },
  {
    id: "a7",
    avatar: "https://images.unsplash.com/photo-1740948267260-a738065a4b66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
    name: "Alex Martin",
    timestamp: "il y a 2j",
    role: "Membre",
    memberSince: "membre depuis 2023",
    badge: "New",
    text: "Mon SaaS est maintenant en ligne ! Après 4 mois de build en solo, la landing page est live. Premier utilisateur inscrit il y a 20 minutes. Je tremble encore.",
    repliesCount: 44,
    hashtags: ["#Launch", "#BuildInPublic", "#SaaS"],
    image: "https://images.unsplash.com/photo-1657256031812-4702fe316f1b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
];

const tribeHashtags = [
  "#SaaS", "#Productivité", "#Indiehacker", "#Startup", "#Business",
  "#Growth", "#NoCode", "#Marketing", "#Revenue", "#Bootstrapped",
  "#B2B", "#Lancement", "#MRR", "#Automation", "#Ventes",
];

// ── TabBubble ──────────────────────────────────────────────────────────────────
function TabBubble({
  tabs,
  active,
  onChange,
  layoutId,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
  layoutId: string;
}) {
  const activeIndex = tabs.findIndex((t) => t.key === active);
  return (
    <div
      className="relative flex"
      style={{
        background: "rgba(255,255,255,0.07)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 999,
        border: "0.5px solid rgba(255,255,255,0.11)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
        padding: 4,
      }}
    >
      <motion.div
        layoutId={layoutId}
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          width: `calc(${100 / tabs.length}% - 4px)`,
          left: `calc(${activeIndex * (100 / tabs.length)}% + 0px)`,
          borderRadius: 999,
          background: "rgba(255,255,255,0.13)",
          border: "0.5px solid rgba(255,255,255,0.18)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 8px rgba(0,0,0,0.25)",
        }}
        transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.8 }}
      />
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className="relative flex-1 flex items-center justify-center py-2.5 z-10"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: active === tab.key ? 600 : 400,
            color: active === tab.key
              ? "rgba(255,255,255,0.92)"
              : "rgba(255,255,255,0.35)",
            transition: "color 0.22s ease",
            borderRadius: 999,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Bannière "accès restreint" pour les non-membres ────────────────────────────
function MembershipGate({
  communityId,
  communityName,
  action,
}: {
  communityId: string;
  communityName: string;
  action: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        margin: "24px 20px",
        padding: "20px 20px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.10)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        textAlign: "center",
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Lock style={{ width: 20, height: 20, color: "rgba(255,255,255,0.35)", strokeWidth: 1.8 }} />
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.80)", margin: "0 0 6px" }}>
          Membres uniquement
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.55 }}>
          Abonnez-vous à <strong style={{ color: "rgba(255,255,255,0.60)" }}>{communityName}</strong> pour {action}.
        </p>
      </div>
      <CommunitySubscribeButton
        communityId={communityId}
        communityName={communityName}
        size="lg"
        stopPropagation={false}
      />
    </motion.div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export function TribeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Guard : "create" n'est pas un id de tribu ─────────────────────────────
  useEffect(() => {
    if (id === "create") {
      navigate("/tribes/create", { replace: true });
    }
  }, [id, navigate]);

  if (id === "create") return null;

  // Read navigation state (coming back from CreateCommunityPost)
  const navState = location.state as { openTab?: string; openChannelId?: string; openChannelName?: string; refresh?: number } | null;

  const [activeTab, setActiveTab] = useState<"progress" | "chat" | "stats">(
    navState?.openTab === "chat" ? "chat" : "progress"
  );
  const [memberTab, setMemberTab] = useState<"admins" | "tous">("tous");
  const [statsTab, setStatsTab] = useState<"stats" | "impact">("stats");
  const [newMessage, setNewMessage] = useState("");
  const [seeded, setSeeded] = useState(false);

  // Posts dynamiques pour le fil Actus (communautés non-statiques) — format ApiPost
  const [dynamicPosts, setDynamicPosts] = useState<ApiPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Canal unique fixe — "general" pour toutes les communautés
  const GENERAL_CHANNEL_ID = "general";
  const GENERAL_CHANNEL_NAME = "GÉNÉRAL";

  // ── Chargement communauté Supabase (si ID dynamique) ───────────────────────
  const [dynamicCommunity, setDynamicCommunity] = useState<{
    name: string; avatar: string; banner: string;
    mentality: string; mentalityWord?: string; members: number; streak: number; constance: number;
    description?: string; tags?: string[]; visibility?: string; rules?: string;
    createdBy?: string;
  } | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);

  // ── Notifications ────────────────────────────────────────────────────────
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    if (!id || STATIC_IDS.has(id) || id === "create") return;
    setCommunityLoading(true);
    fetch(`${BASE}/communities/${id}`, { headers: H })
      .then(r => r.json())
      .then(data => {
        if (data.community) setDynamicCommunity(data.community);
      })
      .catch(err => console.error("Erreur chargement communauté:", err))
      .finally(() => setCommunityLoading(false));
  }, [id]);

  const { isMember, loading: membershipLoading, getMemberCount } = useCommunityMember();
  const { user } = useAuth();
  const communityId = id ?? "1";
  const isStaticCommunity = STATIC_IDS.has(communityId);
  const isUserMember = isMember(communityId);
  const isCreator = !!(user && dynamicCommunity?.createdBy && user.supabaseId === dynamicCommunity.createdBy);

  // ── Sync active community for floating "+" button in Layout ──────────────
  const { setActive, clearActive } = useActiveCommunity();
  useEffect(() => {
    setActive(
      communityId,
      GENERAL_CHANNEL_ID,
      GENERAL_CHANNEL_NAME,
    );
    return () => clearActive();
  }, [communityId, setActive, clearActive]);

  // ── Charger l'état de notification ───────────────────────────────────────
  useEffect(() => {
    if (!user?.supabaseId || isStaticCommunity || !id) return;
    fetch(`${BASE}/community-notifications/${id}?userId=${user.supabaseId}`, { headers: H })
      .then(r => r.json())
      .then(data => setNotifEnabled(!!data.enabled))
      .catch(() => {});
  }, [id, user?.supabaseId, isStaticCommunity]);

  const toggleNotif = useCallback(async () => {
    if (!user?.supabaseId || notifLoading) return;
    setNotifLoading(true);
    try {
      const res = await fetch(`${BASE}/community-notifications/${communityId}`, {
        method: "PUT",
        headers: { ...H, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.supabaseId }),
      });
      const data = await res.json();
      setNotifEnabled(!!data.enabled);
      toast(data.enabled ? "🔔 Notifications activées" : "🔕 Notifications désactivées", { duration: 2000 });
    } catch {
      toast.error("Impossible de changer les notifications");
    } finally {
      setNotifLoading(false);
    }
  }, [communityId, user?.supabaseId, notifLoading]);

  // ── Seeder les posts communautaires (uniquement communautés statiques) ──
  useEffect(() => {
    if (seeded || !id || !isStaticCommunity) return;
    const postsToSeed = actus.map((post) => ({
      id: `tribe-${id}-${post.id}`,
      communityId: id,
      avatar: post.avatar,
      name: post.name,
      timestamp: post.timestamp,
      role: post.role,
      memberSince: post.memberSince,
      badge: post.badge,
      text: post.text,
      image: (post as { image?: string }).image,
      repliesCount: post.repliesCount,
      hashtags: post.hashtags,
    }));
    seedCommunityPosts(postsToSeed)
      .then(() => setSeeded(true))
      .catch((err) => console.error("Erreur seeding community posts:", err));
  }, [id, seeded, isStaticCommunity]);

  // ── Charger les posts dynamiques (communautés non-statiques) ─────────────
  useEffect(() => {
    if (isStaticCommunity || !id) return;
    setPostsLoading(true);
    const userId = user?.supabaseId ? `?userId=${user.supabaseId}` : "";
    fetch(`${BASE}/communities/${id}/posts${userId}`, { headers: H })
      .then(r => r.json())
      .then(data => {
        if (data.posts) setDynamicPosts(data.posts);
      })
      .catch(err => console.error("Erreur chargement posts dynamiques:", err))
      .finally(() => setPostsLoading(false));
  }, [id, isStaticCommunity, navState?.refresh]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) setNewMessage("");
  };

  const goToDiscussion = () => setActiveTab("chat");

  const goToHashtag = (tag: string) =>
    navigate(`/hashtag/${tag.replace("#", "").toLowerCase()}`);

  const displayedMembers =
    memberTab === "admins"
      ? tribeMembers.filter((m) => m.isAdmin)
      : tribeMembers;

  // Données affichées : dynamique ou statique
  const displayName    = dynamicCommunity?.name    ?? tribeData.name;
  const displayBanner  = dynamicCommunity?.banner  || TRIBE_BANNER;
  const displayAvatar  = dynamicCommunity?.avatar  || TRIBE_AVATAR;
  const displayMentality = dynamicCommunity?.mentality ?? tribeData.mentality;
  const displayMembers = (() => {
    const liveCount = getMemberCount(communityId);
    if (liveCount !== null) return liveCount;
    return dynamicCommunity?.members ?? tribeData.members;
  })();
  const displayStreak  = dynamicCommunity?.streak  ?? tribeData.streak;
  const displayConstance = dynamicCommunity?.constance ?? tribeData.constance;

  // Loader pendant le fetch Supabase
  if (communityLoading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 28, height: 28, color: "#6366f1", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32" style={{ background: "#000000" }}>
      <div className="max-w-lg mx-auto" style={{ position: "relative", zIndex: 1 }}>

        {/* ══ BANNIÈRE + AVATAR chevauchant ══ */}
        <div style={{ position: "relative" }}>
          {/* Bannière */}
          <div style={{ height: 200, position: "relative", overflow: "hidden" }}>
            <img
              src={displayBanner}
              alt="bannière"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.68) 100%)",
              }}
            />
            {/* Bouton retour */}
            <div className="absolute top-12 left-4">
              <Link
                to="/tribes"
                className="inline-flex items-center gap-1.5"
                style={{
                  color: "rgba(255,255,255,0.80)",
                  fontSize: 14,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  background: "rgba(0,0,0,0.28)",
                  borderRadius: 999,
                  padding: "5px 13px 5px 8px",
                  border: "0.5px solid rgba(255,255,255,0.20)",
                }}
              >
                <ArrowLeft style={{ width: 15, height: 15 }} />
                Retour
              </Link>
            </div>

            {/* Boutons d'actions — top-right */}
            <div
              className="absolute top-12 right-4"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              {/* Recherche */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => navigate("/search")}
                style={{
                  width: 33, height: 33, borderRadius: "50%",
                  background: "rgba(0,0,0,0.50)",
                  backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                  border: "0.5px solid rgba(255,255,255,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Search style={{ width: 14, height: 14, color: "rgba(255,255,255,0.85)", strokeWidth: 2 }} />
              </motion.button>

              {/* Modifier — créateur uniquement */}
              {isCreator && (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => navigate(`/tribes/${communityId}/edit`)}
                  style={{
                    width: 33, height: 33, borderRadius: "50%",
                    background: "rgba(0,0,0,0.50)",
                    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                    border: "0.5px solid rgba(255,255,255,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <PenLine style={{ width: 14, height: 14, color: "rgba(255,255,255,0.85)", strokeWidth: 2 }} />
                </motion.button>
              )}

              {/* Notifications */}
              {!isStaticCommunity && (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={toggleNotif}
                  style={{
                    width: 33, height: 33, borderRadius: "50%",
                    background: notifEnabled ? "rgba(99,102,241,0.35)" : "rgba(0,0,0,0.50)",
                    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                    border: notifEnabled ? "0.5px solid rgba(99,102,241,0.55)" : "0.5px solid rgba(255,255,255,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: notifLoading ? "default" : "pointer",
                    transition: "all 0.22s ease",
                  }}
                >
                  {notifEnabled
                    ? <Bell style={{ width: 14, height: 14, color: "#c7d2fe", strokeWidth: 2 }} />
                    : <BellOff style={{ width: 14, height: 14, color: "rgba(255,255,255,0.75)", strokeWidth: 2 }} />
                  }
                </motion.button>
              )}
            </div>
          </div>

          {/* Avatar */}
          <div
            style={{
              position: "absolute",
              left: 20,
              top: 200 - AVATAR_HALF,
              zIndex: 10,
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: 28,
              overflow: "hidden",
              border: "3px solid rgba(99,102,241,0.55)",
              boxShadow: "0 0 36px rgba(99,102,241,0.28), 0 8px 28px rgba(0,0,0,0.60)",
            }}
          >
            <img
              src={displayAvatar}
              alt={displayName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          {/* ══ SURFACE HEADER ══ */}
          <div
            className="relative"
            style={{
              background: "#0d0d0d",
              borderRadius: "0 0 28px 28px",
              paddingTop: AVATAR_HALF + 18,
              paddingLeft: 20,
              paddingRight: 20,
              paddingBottom: 22,
            }}
          >
            {/* Nom + bouton S'abonner */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f5", letterSpacing: "-0.3px", flex: 1 }}>
                {displayName}
              </div>
              {/* Masquer le bouton pour le créateur (il est déjà admin/membre) */}
              {!membershipLoading && !isCreator && (
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <CommunitySubscribeButton
                    communityId={communityId}
                    communityName={displayName}
                    size="md"
                    stopPropagation={false}
                  />
                </div>
              )}
              {/* Badge Admin pour le créateur */}
              {isCreator && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "5px 13px", borderRadius: 999, flexShrink: 0, marginTop: 2,
                  background: "rgba(99,102,241,0.18)",
                  border: "0.5px solid rgba(99,102,241,0.45)",
                  fontSize: 12, fontWeight: 700, color: "#a5b4fc",
                }}>
                  ⚡ Admin
                </span>
              )}
            </div>

            {/* Badge mentalité */}
            <div style={{ marginTop: 8 }}>
              <span style={{
                display: "inline-flex", alignItems: "center",
                padding: "3px 14px", borderRadius: 999,
                fontSize: 13, fontWeight: 600,
                background: "rgba(255,255,255,0.92)", color: "#111", gap: 6,
              }}>
                {displayMentality}
                {(() => {
                  const word = isStaticCommunity ? tribeData.mentalityLevel : dynamicCommunity?.mentalityWord;
                  return word ? (
                    <>
                      <span style={{ opacity: 0.35, fontSize: 12 }}>·</span>
                      {word}
                    </>
                  ) : null;
                })()}
              </span>

              {/* Badge "Abonné" si membre */}
              <AnimatePresence>
                {isUserMember && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.85, x: -4 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      marginLeft: 8,
                      padding: "3px 11px", borderRadius: 999,
                      fontSize: 12, fontWeight: 600,
                      background: "rgba(99,102,241,0.15)",
                      border: "0.5px solid rgba(99,102,241,0.35)",
                      color: "#818cf8",
                    }}
                  >
                    ✓ Membre
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Description / Objectif */}
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", lineHeight: 1.55, marginTop: 8, maxWidth: "80%" }}>
              {dynamicCommunity?.description || tribeData.objective}
            </div>

            {/* Stats */}
            <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>{displayMembers}</span>
              <span style={{ color: "rgba(255,255,255,0.28)" }}>Membres</span>
              <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 16 }}>·</span>
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>{displayConstance}/100</span>
              <span style={{ color: "rgba(255,255,255,0.28)" }}>Constance</span>
            </div>

            {/* Hashtags — utilise les tags de la communauté si dynamique */}
            {(() => {
              const displayedTags = isStaticCommunity
                ? tribeHashtags
                : (dynamicCommunity?.tags ?? []).map((t: string) => t.startsWith("#") ? t : `#${t}`);
              if (displayedTags.length === 0) return null;
              return (
                <div className="flex gap-4 overflow-x-auto mt-3" style={{ scrollbarWidth: "none" }}>
                  {displayedTags.map((tag: string) => (
                    <motion.button
                      key={tag}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => goToHashtag(tag)}
                      style={{
                        background: "transparent", border: "none", padding: 0, cursor: "pointer",
                        fontSize: 15, fontWeight: 500, color: "rgba(139,92,246,0.70)",
                        whiteSpace: "nowrap", flexShrink: 0,
                      }}
                    >
                      {tag}
                    </motion.button>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        <div style={{ height: 16 }} />

        {/* ══ TABS — Actus / Discussion / Stats ══ */}
        <div
          className="sticky top-0 z-20"
          style={{ borderBottom: "0.5px solid rgba(255,255,255,0.07)", background: "#000000" }}
        >
          <div className="flex">
            {([
              { key: "progress", label: "Actus" },
              { key: "chat", label: "Discussion" },
              { key: "stats", label: "Stats" },
            ] as { key: "progress" | "chat" | "stats"; label: string }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                }}
                className="relative flex-1 transition-colors"
                style={{
                  padding: "14px 0",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: activeTab === tab.key ? 600 : 400,
                  color: activeTab === tab.key ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.35)",
                }}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="tribeMainTabIndicator"
                    style={{
                      position: "absolute", bottom: 0, left: "15%", right: "15%",
                      height: 2, borderRadius: 999, background: "#6366f1",
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ══ CONTENU ══ */}
        <div className="mt-5">
          {activeTab === "progress" ? (
            <>
              {/* ── Posts Actus ── */}
              {isStaticCommunity ? (
                <AnimatePresence mode="popLayout">
                  <div className="space-y-3">
                    {actus.map((post) => (
                      <TribeCommunityPost
                        key={post.id}
                        postId={`tribe-${id}-${post.id}`}
                        {...post}
                        onReply={goToDiscussion}
                        onHashtagPress={goToHashtag}
                        isMember={isUserMember || isCreator}
                        communityId={communityId}
                        communityName={tribeData.name}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              ) : (
                /* Communauté dynamique — posts chargés dynamiquement */
                postsLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                    <Loader2 style={{ width: 24, height: 24, color: "#6366f1", animation: "spin 1s linear infinite" }} />
                  </div>
                ) : dynamicPosts.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      margin: "32px 20px", padding: "32px 24px",
                      borderRadius: 22,
                      background: "rgba(255,255,255,0.025)",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
                      textAlign: "center",
                    }}
                  >
                    <div style={{
                      width: 52, height: 52, borderRadius: 18,
                      background: "rgba(99,102,241,0.10)",
                      border: "1px solid rgba(99,102,241,0.22)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                    }}>🚀</div>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.80)", margin: "0 0 6px" }}>
                        Soyez les premiers à publier !
                      </p>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.32)", margin: 0, lineHeight: 1.6, maxWidth: 260 }}>
                        Cette communauté vient d'être créée. Partagez votre premier avancement pour l'animer.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    <div className="space-y-3">
                      {dynamicPosts.map((post) => (
                        <ProgressCard
                          key={post.id}
                          postId={post.id}
                          user={post.user}
                          authorUsername={(post as any).username ?? undefined}
                          streak={post.streak}
                          progress={post.progress}
                          image={post.image ?? undefined} images={post.images}
                          verified={post.verified}
                          isRelevant={false}
                          relevantCount={post.relevantCount}
                          commentsCount={post.commentsCount}
                          sharesCount={post.sharesCount}
                          viewsCount={post.viewsCount}
                          isNew={post.isNew}
                          hashtags={post.hashtags}
                        />
                      ))}
                    </div>
                  </AnimatePresence>
                )
              )}

              {/* ── Section Membres ── */}
              <div style={{ marginTop: 32 }}>
                <div
                  className="px-4"
                  style={{
                    fontSize: 11, fontWeight: 600,
                    color: "rgba(255,255,255,0.28)",
                    textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 12,
                  }}
                >
                  Membres
                </div>

                {isStaticCommunity && (
                  <div className="px-4 mb-4">
                    <TabBubble
                      tabs={[
                        { key: "admins", label: "Admins" },
                        { key: "tous", label: "Tous" },
                      ]}
                      active={memberTab}
                      onChange={(k) => setMemberTab(k as "admins" | "tous")}
                      layoutId="memberTabBubble"
                    />
                  </div>
                )}

                <div className="px-4 flex flex-col" style={{ gap: 4 }}>
                  {!isStaticCommunity ? (
                    /* Communauté dynamique : afficher uniquement le créateur */
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ padding: "24px 0", textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.28)" }}
                    >
                      {displayMembers} membre{displayMembers !== 1 ? "s" : ""} — soyez les premiers à rejoindre !
                    </motion.div>
                  ) : (
                  <>
                  <AnimatePresence mode="popLayout">
                    {displayedMembers.map((m, i) => (
                      <motion.div
                        key={m.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                        className="flex items-center gap-4"
                        style={{
                          padding: "12px 0",
                        }}
                      >
                        <div style={{ position: "relative", width: 58, height: 58, flexShrink: 0 }}>
                          <div style={{
                            width: 58, height: 58, borderRadius: "50%", overflow: "hidden",
                            border: "1.5px solid rgba(255,255,255,0.12)",
                          }}>
                            <img src={m.avatar} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>

                        </div>

                        <div
                          className="flex-1 min-w-0"
                          onClick={() => navigate(`/profile/${m.handle}`)}
                          style={{ cursor: "pointer" }}
                        >
                          <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>
                            Depuis {m.daysSince} jours
                          </div>
                        </div>

                        <FollowButton username={m.handle} size="md" />
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {displayedMembers.length === 0 && (
                    <div style={{ padding: "24px 0", textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.22)" }}>
                      Aucun admin pour le moment.
                    </div>
                  )}
                  </>
                  )}
                </div>
              </div>
            </>
          ) : activeTab === "chat" ? (
            (isUserMember || isCreator) ? (
              /* ── Discussion unique : # GÉNÉRAL ── */
              <motion.div
                key="chat-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                style={{ display: "flex", flexDirection: "column" }}
              >
                {/* Header canal — exactement comme l'image fournie */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 16px 10px",
                    borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                    background: "#000",
                    position: "sticky",
                    top: 52,
                    zIndex: 10,
                  }}
                >
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => setActiveTab("progress")}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 30, height: 30, borderRadius: "50%",
                      background: "rgba(255,255,255,0.06)",
                      border: "0.5px solid rgba(255,255,255,0.10)",
                      cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    <ArrowLeft style={{ width: 13, height: 13, color: "rgba(255,255,255,0.70)" }} />
                  </motion.button>

                  {/* Channel badge — # GÉNÉRAL */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "4px 12px", borderRadius: 999,
                    background: "rgba(99,102,241,0.12)",
                    border: "0.5px solid rgba(99,102,241,0.28)",
                  }}>
                    <Hash style={{ width: 13, height: 13, color: "rgba(129,140,248,0.90)", strokeWidth: 2.5 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.90)", letterSpacing: "0.04em" }}>
                      {GENERAL_CHANNEL_NAME}
                    </span>
                  </div>

                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", flexShrink: 0 }}>
                    Général
                  </span>
                </div>

                {/* Chat view — canal unique "general" */}
                <ChannelChat
                  communityId={communityId}
                  channelId={GENERAL_CHANNEL_ID}
                  channelName={GENERAL_CHANNEL_NAME}
                  channelEmoji="#"
                />
              </motion.div>
            ) : (
              <MembershipGate
                communityId={communityId}
                communityName={displayName}
                action="participer à la discussion"
              />
            )
          ) : (
            /* ── Onglet Stats ── */
            (isUserMember || isCreator) ? (
              <>
                {/* Sub-tabs Stats */}
                <div className="px-4 mb-4">
                  <TabBubble
                    tabs={[
                      { key: "stats", label: "Stats" },
                      { key: "impact", label: "Impact" },
                    ]}
                    active={statsTab}
                    onChange={(k) => setStatsTab(k as "stats" | "impact")}
                    layoutId="statsSubTab"
                  />
                </div>

                <AnimatePresence mode="wait">
                  {statsTab === "stats" && (
                    <motion.div
                      key="stats"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22 }}
                    >
                      <TribeStats
                        tribeName={displayName}
                        communityId={communityId}
                        currentMembers={displayMembers}
                        isCreator={isCreator}
                        isStatic={isStaticCommunity}
                      />
                    </motion.div>
                  )}
                  {statsTab === "impact" && (
                    <motion.div
                      key="impact"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22 }}
                    >
                      <CommunityImpact
                        communityId={communityId}
                        communityName={displayName}
                        isStatic={isStaticCommunity}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <MembershipGate
                communityId={communityId}
                communityName={displayName}
                action="suivre les objectifs de la communauté"
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}