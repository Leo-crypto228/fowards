import { motion } from "motion/react";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { getEarnedFcoins } from "../api/progressionApi";
import { useFollow } from "../context/FollowContext";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import progressionImg1 from "figma:asset/8a40cfe599e1d2546bcbd2352ad685810c61fd76.png";
import progressionImg2 from "figma:asset/38d65fad1b6a9a54c394d458d3da4981d3e242c2.png";
import progressionImg3 from "figma:asset/5cbd05408de823cd0296472e90d2be3db0a36a12.png";
import creationImg1 from "figma:asset/5700b0a9982d5751dc7bdf64d05101252466dd43.png";
import creationImg2 from "figma:asset/e12fd99971493a5270a251163e3d8ac3072825c8.png";
import creationImg3 from "figma:asset/301b9647c9122f6905e773acad8dc9c8ae78264e.png";
import impactImg1 from "figma:asset/aeb19e4687a7f7a730bf518dc6a3c50cbe8cab78.png";
import impactImg2 from "figma:asset/b5420e1e4dcb28c415b729a8b54919c339bf0feb.png";
import impactImg3 from "figma:asset/37bde483f7ebc8284a64ff0f671a820654728cb3.png";
import speciauxImg1 from "figma:asset/e2110878556a04164dce9d4c4d38bb88ba4cc03e.png";
import speciauxImg2 from "figma:asset/b3ae354120773b771d9831afb09d5bc2bbe5cb1e.png";
import speciauxImg3 from "figma:asset/7ff599b653b6137fb01267df900ccb6ee52ffa2c.png";
import communauteImg1 from "figma:asset/f9ecd6857819c90f6a48373ff634dab7cf0fd1d4.png";
import communauteImg2 from "figma:asset/fffa1a3d255bdb60fb45607572f2724445bb79e8.png";
import communauteImg3 from "figma:asset/eb64d44556bc55a434a817d786f7f0cb9e032875.png";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface FcoinCategory {
  id: string;
  label: string;
  description: string;
  coins: { id: number; letter: string; name: string; image?: string }[];
}

/* ─── Data ───────────────────────────────────────────────────────────────── */

interface FcoinCategory {
  id: string;
  label: string;
  description: string;
  coins: { id: number; letter: string; name: string; image?: string; fcoinKey: string; condition: string }[];
}

const CATEGORIES: FcoinCategory[] = [
  {
    id: "progression",
    label: "Fcoin de progression",
    description: "Obtenus en maintenant votre streak quotidien",
    coins: [
      { id: 1, letter: "S", name: "Départ",    image: progressionImg1, fcoinKey: "streak_2",  condition: "2 jours de streak" },
      { id: 2, letter: "S", name: "Discipline", image: progressionImg2, fcoinKey: "streak_7",  condition: "7 jours de streak" },
      { id: 3, letter: "S", name: "Constant",  image: progressionImg3, fcoinKey: "streak_30", condition: "30 jours de streak" },
    ],
  },
  {
    id: "creation",
    label: "Fcoin de création",
    description: "Obtenus en créant du contenu original et inspirant",
    coins: [
      { id: 4, letter: "C", name: "Premiers pas",  image: creationImg1, fcoinKey: "posts_1",  condition: "1 post publié" },
      { id: 5, letter: "C", name: "Contributeur",  image: creationImg2, fcoinKey: "posts_10", condition: "10 posts publiés" },
      { id: 6, letter: "C", name: "Créateur",      image: creationImg3, fcoinKey: "posts_50", condition: "50 posts publiés" },
    ],
  },
  {
    id: "impact",
    label: "Fcoin d'impact",
    description: "Obtenus quand vos posts inspirent la communauté",
    coins: [
      { id: 7, letter: "I", name: "1er Post apprécié", image: impactImg1, fcoinKey: "reactions_first", condition: "Premier post avec réaction" },
      { id: 8, letter: "I", name: "Impression",        image: impactImg2, fcoinKey: "reactions_100",   condition: "100 réactions reçues" },
      { id: 9, letter: "I", name: "Influence",         image: impactImg3, fcoinKey: "reactions_1000",  condition: "1000 réactions reçues" },
    ],
  },
  {
    id: "communaute",
    label: "Fcoin de communauté",
    description: "Obtenus en interagissant activement avec la communauté",
    coins: [
      { id: 10, letter: "O", name: "Début d'aventure", image: communauteImg1, fcoinKey: "community_join",   condition: "Rejoindre 1 communauté" },
      { id: 11, letter: "O", name: "L'actif",          image: communauteImg2, fcoinKey: "community_20msg",  condition: "Envoyer 20 messages" },
      { id: 12, letter: "O", name: "Aimé",             image: communauteImg3, fcoinKey: "community_100msg", condition: "Envoyer 100 messages" },
    ],
  },
  {
    id: "speciaux",
    label: "Fcoin spéciaux",
    description: "Récompenses rares réservées aux bâtisseurs de la première heure",
    coins: [
      { id: 13, letter: "F", name: "Early Builder",  image: speciauxImg1, fcoinKey: "rare_early",      condition: "Parmi les 500 premiers inscrits" },
      { id: 14, letter: "F", name: "Pioneer",         image: speciauxImg2, fcoinKey: "rare_pioneer",    condition: "Parmi les 1 000 premiers inscrits" },
      { id: 15, letter: "F", name: "First Objectif",  image: speciauxImg3, fcoinKey: "rare_first_goal", condition: "Premier objectif atteint à 100%" },
    ],
  },
];

/* ─── Fcoin circle ───────────────────────────────────────────────────────── */

function FcoinDot({ letter, size = 80, image }: { letter: string; size?: number; image?: string }) {
  return (
    <div
      style={{
        width:          size,
        height:         size,
        borderRadius:   "50%",
        background:     "#0d0d0d",
        border:         "1.5px solid rgba(255,255,255,0.14)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        flexShrink:     0,
        overflow:       "hidden",
      }}
    >
      {image ? (
        <img
          src={image}
          alt={letter}
          style={{
            width:        "100%",
            height:       "100%",
            objectFit:    "cover",
            borderRadius: "50%",
          }}
        />
      ) : (
        <span
          style={{
            fontSize:   Math.round(size * 0.40),
            fontWeight: 800,
            color:      "rgba(255,255,255,0.88)",
            lineHeight: 1,
          }}
        >
          {letter}
        </span>
      )}
    </div>
  );
}

/* ─── FcoinsPage ─────────────────────────────────────────────────────────── */

export function FcoinsPage() {
  const navigate = useNavigate();
  const { currentUserId } = useFollow();
  const [earnedFcoins, setEarnedFcoins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userNumber, setUserNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!currentUserId) return;
    getEarnedFcoins(currentUserId)
      .then(({ earned }) => setEarnedFcoins(earned))
      .catch((err) => console.error("Erreur chargement fcoins:", err))
      .finally(() => setLoading(false));
  }, [currentUserId]);

  // Fetch user number (rang d'inscription)
  useEffect(() => {
    if (!currentUserId) return;
    fetch(`https://${projectId}.supabase.co/functions/v1/make-server-218684af/user-number/${encodeURIComponent(currentUserId)}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.userNumber) setUserNumber(d.userNumber); })
      .catch(() => {});
  }, [currentUserId]);

  const hasEarlyBuilder = earnedFcoins.includes("rare_early");
  const totalEarned = CATEGORIES.flatMap((c) => c.coins).filter((coin) => earnedFcoins.includes(coin.fcoinKey)).length;
  const totalAll = CATEGORIES.flatMap((c) => c.coins).length;

  return (
    <div style={{ minHeight: "100dvh", background: "#000000", overflowX: "hidden" }}>

      {/* ── Header row: back button + title aligned ── */}
      <div
        style={{
          position:   "relative",
          display:    "flex",
          alignItems: "center",
          padding:    "56px 16px 0",
        }}
      >
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => navigate(-1)}
          style={{
            display:            "inline-flex",
            alignItems:         "center",
            gap:                8,
            padding:            "8px 16px 8px 12px",
            borderRadius:       999,
            background:         "rgba(255,255,255,0.08)",
            backdropFilter:     "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border:             "0.5px solid rgba(255,255,255,0.14)",
            boxShadow:          "0 2px 12px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.09)",
            cursor:             "pointer",
            flexShrink:         0,
            zIndex:             2,
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16, color: "rgba(255,255,255,0.80)", strokeWidth: 2.2 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>Retour</span>
        </motion.button>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.06 }}
          style={{
            position:      "absolute",
            left:          "50%",
            transform:     "translateX(-50%)",
            fontSize:      22,
            fontWeight:    800,
            color:         "#f0f0f5",
            margin:        0,
            letterSpacing: "-0.4px",
            whiteSpace:    "nowrap",
            pointerEvents: "none",
          }}
        >
          Les Fcoin
        </motion.h1>
      </div>

      {/* ── Subtitle + compteur ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, delay: 0.10 }}
        style={{ textAlign: "center", margin: "10px 0 0", padding: "0 16px" }}>
        <p style={{ fontSize: 13, color: "rgba(144,144,168,0.50)", margin: "0 0 8px" }}>
          Votre historique complet de Fcoin
        </p>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "6px 0" }}>
            <Loader2 style={{ width: 13, height: 13, color: "rgba(99,102,241,0.55)" }} className="animate-spin" />
            <span style={{ fontSize: 12, color: "rgba(144,144,168,0.38)" }}>Chargement…</span>
          </div>
        ) : (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 999, background: earnedFcoins.length > 0 ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.05)", border: earnedFcoins.length > 0 ? "0.5px solid rgba(99,102,241,0.28)" : "0.5px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: earnedFcoins.length > 0 ? "#a5b4fc" : "rgba(255,255,255,0.35)" }}>{totalEarned}</span>
            <span style={{ fontSize: 12, color: "rgba(144,144,168,0.45)", fontWeight: 500 }}>/ {totalAll} Fcoins débloqués</span>
          </div>
        )}
      </motion.div>

      {/* ── Early Builder banner (si débloqué) ── */}
      {!loading && hasEarlyBuilder && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.38, delay: 0.18, ease: [0.25, 0, 0.35, 1] }}
          style={{
            margin: "24px 20px 0",
            padding: "18px 20px",
            borderRadius: 20,
            background: "linear-gradient(135deg, rgba(234,179,8,0.10) 0%, rgba(251,191,36,0.06) 100%)",
            border: "1px solid rgba(234,179,8,0.30)",
            boxShadow: "0 0 32px rgba(234,179,8,0.08), inset 0 1px 0 rgba(234,179,8,0.12)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            maxWidth: 600,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {/* Golden star */}
          <div style={{
            width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px rgba(234,179,8,0.45), 0 4px 12px rgba(0,0,0,0.40)",
          }}>
            <span style={{ fontSize: 24 }}>⚡</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24", letterSpacing: "-0.2px" }}>
                Early Builder
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "rgba(234,179,8,0.15)", border: "0.5px solid rgba(234,179,8,0.35)", borderRadius: 6, padding: "2px 7px", letterSpacing: "0.5px" }}>
                RARE
              </span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(251,191,36,0.65)", margin: 0, lineHeight: 1.45 }}>
              Tu fais partie des{" "}
              <strong style={{ color: "rgba(251,191,36,0.88)" }}>
                {userNumber ? `500 premiers inscrits` : "fondateurs de FuturFeed"}
              </strong>
              {userNumber && (
                <span style={{ color: "rgba(251,191,36,0.50)", fontSize: 12 }}>
                  {" "}· Inscrit n°{userNumber}
                </span>
              )}
            </p>
          </div>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg,#10b981,#059669)",
            border: "2px solid rgba(0,0,0,0.60)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 8px rgba(16,185,129,0.50)",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, color: "#fff", fontWeight: 800 }}>✓</span>
          </div>
        </motion.div>
      )}

      {/* ── Categories ── */}
      <div style={{ padding: "28px 20px 120px", maxWidth: 640, margin: "0 auto" }}>
        {CATEGORIES.map((cat, catIndex) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.12 + catIndex * 0.07 }}
            style={{ marginBottom: 32 }}
          >
            {/* Category header */}
            <div style={{ marginBottom: 20 }}>
              <p
                style={{
                  fontSize:      17,
                  fontWeight:    700,
                  color:         "rgba(240,240,245,0.90)",
                  margin:        "0 0 4px",
                  letterSpacing: "-0.1px",
                }}
              >
                {cat.label}
              </p>
              <p
                style={{
                  fontSize:  13,
                  color:     "rgba(144,144,168,0.45)",
                  margin:    0,
                  lineHeight: 1.45,
                }}
              >
                {cat.description}
              </p>
            </div>

            {/* Coins row */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {cat.coins.map((coin) => {
                const earned = earnedFcoins.includes(coin.fcoinKey);
                const isEarlyBuilder = coin.fcoinKey === "rare_early";
                return (
                <motion.div
                  key={coin.id}
                  whileTap={{ scale: 0.96 }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 8, cursor: "default", minWidth: 80, position: "relative",
                  }}
                >
                  {/* Coin image with lock overlay if not earned */}
                  <div style={{ position: "relative" }}>
                    <div style={{
                      opacity: earned ? 1 : 0.30,
                      transition: "opacity 0.2s",
                      filter: earned && isEarlyBuilder ? "drop-shadow(0 0 12px rgba(234,179,8,0.60))" : "none",
                    }}>
                      <FcoinDot letter={coin.letter} size={80} image={coin.image} />
                    </div>
                    {!earned && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "rgba(0,0,0,0.40)" }}>
                        <Lock style={{ width: 22, height: 22, color: "rgba(255,255,255,0.50)", strokeWidth: 1.8 }} />
                      </div>
                    )}
                    {earned && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        style={{ position: "absolute", top: -4, right: -4, width: 22, height: 22, borderRadius: "50%", background: isEarlyBuilder ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#10b981,#059669)", border: "2px solid #000", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isEarlyBuilder ? "0 0 8px rgba(234,179,8,0.70)" : "0 0 8px rgba(16,185,129,0.60)" }}>
                        <span style={{ fontSize: 11, color: "#fff", fontWeight: 800, lineHeight: 1 }}>✓</span>
                      </motion.div>
                    )}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: earned ? (isEarlyBuilder ? "#fbbf24" : "rgba(240,240,245,0.88)") : "rgba(144,144,168,0.38)", display: "block", lineHeight: 1.3, maxWidth: 90 }}>
                      {coin.name}
                    </span>
                    <span style={{ fontSize: 10, color: earned ? (isEarlyBuilder ? "rgba(234,179,8,0.70)" : "rgba(16,185,129,0.70)") : "rgba(144,144,168,0.28)", display: "block", marginTop: 3, lineHeight: 1.3, maxWidth: 90 }}>
                      {earned ? (isEarlyBuilder && userNumber ? `Inscrit n°${userNumber} ✓` : "Débloqué ✓") : coin.condition}
                    </span>
                  </div>
                </motion.div>
                );
              })}
            </div>

            {/* Divider */}
            {catIndex < CATEGORIES.length - 1 && (
              <div
                style={{
                  marginTop:  28,
                  height:     0.5,
                  background: "rgba(255,255,255,0.07)",
                }}
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}