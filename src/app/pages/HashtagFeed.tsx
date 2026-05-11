import { useParams, Link, useNavigate } from "react-router";
import { ArrowLeft, Hash } from "lucide-react";
import { motion } from "motion/react";
import { TribeCommunityPost } from "../components/TribeCommunityPost";
import { useState, useEffect } from "react";
import { getCommunityPostsByHashtag, CommunityPostData } from "../api/communityPostsApi";
import { useFollow } from "../context/FollowContext";

// Hashtags connexes statiques
const RELATED: Record<string, string[]> = {
  saas:         ["#MRR", "#Bootstrapped", "#Indiehacker", "#Growth"],
  growth:       ["#Marketing", "#B2B", "#Ventes", "#SaaS"],
  marketing:    ["#B2B", "#Ventes", "#Growth", "#Lancement"],
  mrr:          ["#Revenue", "#SaaS", "#Bootstrapped", "#Startup"],
  indiehacker:  ["#SaaS", "#NoCode", "#Bootstrapped", "#Lancement"],
  nocode:       ["#Automation", "#SaaS", "#Productivité"],
  automation:   ["#NoCode", "#Productivité", "#SaaS"],
  startup:      ["#Growth", "#B2B", "#Lancement", "#MRR"],
  business:     ["#Growth", "#Ventes", "#B2B", "#Startup"],
  bootstrapped: ["#Indiehacker", "#MRR", "#Revenue", "#SaaS"],
  b2b:          ["#Ventes", "#Marketing", "#Growth", "#Business"],
  lancement:    ["#Startup", "#Indiehacker", "#SaaS", "#Growth"],
  revenue:      ["#MRR", "#Bootstrapped", "#Business"],
  ventes:       ["#B2B", "#Marketing", "#Growth"],
  productivite: ["#Automation", "#NoCode", "#Business"],
  pricing:      ["#SaaS", "#B2B", "#Strategy"],
  strategy:     ["#Business", "#Growth", "#B2B"],
  launch:       ["#Lancement", "#SaaS", "#Indiehacker"],
  buildinpublic:["#Indiehacker", "#SaaS", "#Startup"],
  sales:        ["#Ventes", "#B2B", "#Marketing"],
  mvp:          ["#Startup", "#Lancement", "#Lean"],
  lean:         ["#MVP", "#Startup", "#Validation"],
  validation:   ["#MVP", "#Lean", "#Startup"],
};

const getRelated = (tag: string) =>
  RELATED[tag.toLowerCase()] ?? ["#SaaS", "#Growth", "#Business", "#Startup"];

export function HashtagFeed() {
  const { tag } = useParams<{ tag: string }>();
  const navigate = useNavigate();
  const displayTag = `#${tag}`;
  const related = getRelated(tag ?? "");
  const { currentUserId } = useFollow();

  const [posts, setPosts] = useState<CommunityPostData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tag) return;
    setLoading(true);
    setError(null);
    setPosts([]);

    getCommunityPostsByHashtag(tag, currentUserId)
      .then(({ posts: fetched, total: t }) => {
        setPosts(fetched);
        setTotal(t);
      })
      .catch((err) => {
        console.error("Erreur chargement hashtag feed:", err);
        setError("Impossible de charger les posts.");
      })
      .finally(() => setLoading(false));
  }, [tag]);

  const handleHashtag = (t: string) =>
    navigate(`/hashtag/${t.replace("#", "").toLowerCase()}`);

  return (
    <div className="min-h-screen pb-32" style={{ background: "#000000" }}>
      <div className="max-w-lg mx-auto">

        {/* ── Header sticky ── */}
        <div
          className="sticky top-0 z-20 px-4 pt-12 pb-4"
          style={{
            background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(22px)",
            WebkitBackdropFilter: "blur(22px)",
            borderBottom: "0.5px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center gap-3">
            <Link
              to={-1 as any}
              className="inline-flex items-center gap-1.5"
              style={{
                color: "rgba(255,255,255,0.70)",
                fontSize: 14,
                background: "rgba(255,255,255,0.07)",
                borderRadius: 999,
                padding: "6px 13px 6px 9px",
                border: "0.5px solid rgba(255,255,255,0.10)",
                textDecoration: "none",
              }}
            >
              <ArrowLeft style={{ width: 15, height: 15 }} />
              Retour
            </Link>

            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "rgba(139,92,246,1)",
                  letterSpacing: "-0.3px",
                  lineHeight: 1.1,
                }}
              >
                {displayTag}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", marginTop: 2 }}>
                {loading ? "Chargement..." : `${total} publication${total !== 1 ? "s" : ""}`}
              </div>
            </div>
          </div>

          {/* Tags connexes */}
          <div className="flex gap-4 mt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {related.map((t) => (
              <motion.button
                key={t}
                whileTap={{ scale: 0.93 }}
                onClick={() => handleHashtag(t)}
                style={{
                  background: "transparent", border: "none", padding: 0,
                  cursor: "pointer", fontSize: 13, fontWeight: 500,
                  color: "rgba(139,92,246,0.60)", whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                {t}
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Contenu ── */}
        <div className="mt-5">
          
            {loading ? (
              // ── Skeleton loading ──
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3 px-3"
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      borderRadius: 22,
                      background: "#0d0d0d",
                      border: "1px solid rgba(255,255,255,0.06)",
                      padding: "20px 16px",
                      height: 160,
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: "50%",
                        background: "rgba(255,255,255,0.07)",
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 13, borderRadius: 6, background: "rgba(255,255,255,0.07)", marginBottom: 8, width: "45%" }} />
                        <div style={{ height: 11, borderRadius: 6, background: "rgba(255,255,255,0.04)", width: "30%" }} />
                      </div>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.06)", marginBottom: 7 }} />
                      <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.04)", width: "75%" }} />
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : error ? (
              // ── Error state ──
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24 px-8 text-center"
              >
                <div
                  style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: "rgba(255,255,255,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Hash style={{ width: 24, height: 24, color: "rgba(255,255,255,0.25)" }} />
                </div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>
                  {error}
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setLoading(true);
                    setError(null);
                    getCommunityPostsByHashtag(tag ?? "", currentUserId)
                      .then(({ posts: f, total: t }) => { setPosts(f); setTotal(t); })
                      .catch((e) => setError("Impossible de charger les posts."))
                      .finally(() => setLoading(false));
                  }}
                  style={{
                    padding: "9px 22px", borderRadius: 999, cursor: "pointer",
                    background: "rgba(255,255,255,0.09)",
                    border: "0.5px solid rgba(255,255,255,0.14)",
                    fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.70)",
                  }}
                >
                  Réessayer
                </motion.button>
              </motion.div>
            ) : posts.length === 0 ? (
              // ── Empty state ──
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24 px-8 text-center"
              >
                <div
                  style={{
                    width: 64, height: 64, borderRadius: "50%",
                    background: "rgba(139,92,246,0.10)",
                    border: "1px solid rgba(139,92,246,0.20)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 18,
                  }}
                >
                  <Hash style={{ width: 28, height: 28, color: "rgba(139,92,246,0.60)" }} />
                </div>
                <div
                  style={{
                    fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.80)",
                    marginBottom: 8, letterSpacing: "-0.3px",
                  }}
                >
                  {displayTag}
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: 24 }}>
                  Aucun post communautaire pour ce hashtag.<br />
                  Visitez une tribu pour les charger.
                </div>
                <div className="flex gap-3 flex-wrap justify-center">
                  {related.slice(0, 4).map((t) => (
                    <motion.button
                      key={t}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => handleHashtag(t)}
                      style={{
                        padding: "8px 18px", borderRadius: 999, cursor: "pointer",
                        background: "rgba(139,92,246,0.12)",
                        border: "0.5px solid rgba(139,92,246,0.25)",
                        fontSize: 14, fontWeight: 500, color: "rgba(139,92,246,0.80)",
                      }}
                    >
                      {t}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              // ── Posts ──
              <motion.div
                key="posts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {posts.map((post, i) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.32 }}
                  >
                    <TribeCommunityPost
                      postId={post.id}
                      avatar={post.avatar}
                      name={post.name}
                      timestamp={post.timestamp}
                      role={post.role}
                      memberSince={post.memberSince}
                      badge={post.badge}
                      text={post.text}
                      image={post.image} images={post.images}
                      repliesCount={post.liveCommentsCount ?? post.repliesCount}
                      hashtags={post.hashtags}
                      onReply={() => {}}
                      onHashtagPress={handleHashtag}
                    />
                  </motion.div>
                ))}

                {/* Padding bottom */}
                <div style={{ height: 12 }} />
              </motion.div>
            )}
          
        </div>
      </div>
    </div>
  );
}
