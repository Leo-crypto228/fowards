import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Search as SearchIcon, Hash, FileText, Loader2, X, Users } from "lucide-react";
import { search, SearchPost, SearchUser, SearchHashtag } from "../api/searchApi";
import { FollowButton } from "../components/FollowButton";

/* ─── TYPE LABELS ────────────────────────────────────────────────────────── */
const TYPE_LABELS: Record<string, string> = {
  infos: "Infos perso", conseil: "Conseil(s)", new: "New",
  avancement: "Avancement", objectif: "Objectif",
  lecon: "Leçon", question: "Question", bilan: "Bilan",
};

/* ─── Highlight helper ───────────────────────────────────────────────────── */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const bare = q.startsWith("#") || q.startsWith("@") ? q.slice(1).toLowerCase() : q.toLowerCase();
  const idx = text.toLowerCase().indexOf(bare);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: "#818cf8", fontWeight: 700 }}>{text.slice(idx, idx + bare.length)}</span>
      {text.slice(idx + bare.length)}
    </>
  );
}

/* ─── Section wrapper ─────────────────────────────────────────────────────── */
function Section({ icon, title, count, children }: {
  icon: React.ReactNode; title: string; count?: number; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <span style={{ color: "rgba(144,144,168,0.45)" }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(144,144,168,0.45)", textTransform: "uppercase", letterSpacing: "0.09em" }}>{title}</span>
        {count !== undefined && count > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(99,102,241,0.60)", background: "rgba(99,102,241,0.10)", borderRadius: 999, padding: "1px 7px" }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─── Post result card ────────────────────────────────────────────────────── */
function PostCard({ post, q, onClick }: { post: SearchPost; q: string; onClick: () => void }) {
  const typeLabel = TYPE_LABELS[post.progress?.type] ?? "Avancement";
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        padding: "14px", borderRadius: 14,
        background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)",
        cursor: "pointer", marginBottom: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", border: "1px solid rgba(99,102,241,0.22)", flexShrink: 0 }}>
          {post.user.avatar
            ? <img src={post.user.avatar} alt={post.user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", background: "rgba(99,102,241,0.20)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#818cf8", fontWeight: 700 }}>{(post.user.name || "?")[0]}</div>
          }
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.72)" }}><Highlight text={post.user.name || ""} q={q} /></span>
        <span style={{ display: "inline-block", background: "rgba(255,255,255,0.90)", borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 700, color: "#111" }}>{typeLabel}</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", marginLeft: "auto" }}>{post.progress?.timestamp}</span>
      </div>
      <p style={{ fontSize: 14, color: "rgba(200,200,220,0.65)", lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
        <Highlight text={post.progress?.description || ""} q={q} />
      </p>
      {post.hashtags?.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {post.hashtags.slice(0, 4).map((tag) => (
            <span key={tag} style={{ fontSize: 11, color: "rgba(139,92,246,0.55)", fontWeight: 500 }}>{tag}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ─── User result card ────────────────────────────────────────────────────── */
function UserCard({ user, q, onClick }: { user: SearchUser; q: string; onClick: () => void }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 14px", borderRadius: 14,
        background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)",
        cursor: "pointer", marginBottom: 6,
      }}
    >
      <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(99,102,241,0.20)", flexShrink: 0 }}>
          {user.avatar
            ? <img src={user.avatar} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#818cf8" }}>{(user.name || "?")[0]}</div>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(240,240,245,0.90)", margin: 0 }}>
            <Highlight text={user.name} q={q} />
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", margin: "2px 0 0" }}>
            <Highlight text={user.username} q={q} />
          </p>
          {user.objective && (
            <p style={{ fontSize: 12, color: "rgba(200,200,220,0.45)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.objective}</p>
          )}
        </div>
      </div>
      <FollowButton username={user.username} size="sm" />
    </motion.div>
  );
}

/* ─── Main Search page ────────────────────────────────────────────────────── */
export function Search() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialiser avec les query params si présents
  const initialQ = searchParams.get("q") || "";
  const profileUsername = searchParams.get("username") || "";

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<{ posts: SearchPost[]; users: SearchUser[]; hashtags: SearchHashtag[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isProfileMode = !!profileUsername;

  /* auto-focus */
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 120); }, []);

  /* Lancer la recherche si query initiale */
  useEffect(() => {
    if (initialQ) doSearch(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await search({
        q: q.trim(),
        type: "all",
        username: profileUsername || undefined,
        limit: 20,
      });
      setResults(data);
    } catch (err) {
      console.error("Erreur recherche:", err);
      setError("Impossible de rechercher. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }, [profileUsername]);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 380);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(query);
  };

  const navigateToPost = (post: SearchPost) => {
    try { sessionStorage.setItem("ff_last_post", JSON.stringify({ user: post.user, streak: post.streak, progress: post.progress, image: post.image, verified: post.verified, relevantCount: post.relevantCount, commentsCount: post.commentsCount, sharesCount: post.sharesCount, viewsCount: post.viewsCount, isNew: post.isNew, hashtags: post.hashtags })); } catch {}
    navigate(`/post/${encodeURIComponent(post.id)}`, { state: { post } });
  };

  const q = query.trim();
  const isHash = q.startsWith("#");
  const isAt   = q.startsWith("@");

  const hasPosts    = (results?.posts?.length ?? 0) > 0;
  const hasUsers    = (results?.users?.length ?? 0) > 0;
  const hasHashtags = (results?.hashtags?.length ?? 0) > 0;
  const hasResults  = hasPosts || hasUsers || hasHashtags;

  return (
    <div style={{ minHeight: "100dvh", background: "#000000", overflowX: "hidden" }}>

      {/* ── Back button ── */}
      <div style={{ padding: "56px 16px 0" }}>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => navigate(-1)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 16px 8px 12px", borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            border: "0.5px solid rgba(255,255,255,0.15)",
            boxShadow: "0 2px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10)",
            cursor: "pointer",
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16, color: "rgba(255,255,255,0.80)", strokeWidth: 2.2 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>
            {isProfileMode ? `Profil @${profileUsername}` : "Retour"}
          </span>
        </motion.button>
      </div>

      {/* ── Title (profile mode) ── */}
      {isProfileMode && (
        <div style={{ padding: "14px 16px 0", maxWidth: 640, margin: "0 auto" }}>
          <p style={{ fontSize: 13, color: "rgba(165,180,252,0.55)", margin: 0 }}>
            Recherche dans les posts de <span style={{ color: "#818cf8", fontWeight: 700 }}>@{profileUsername}</span>
          </p>
        </div>
      )}

      {/* ── Search bar ── */}
      <div style={{ padding: "18px 16px 0", maxWidth: 640, margin: "0 auto" }}>
        <form onSubmit={handleSubmit}>
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: 0.05 }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "0 18px", height: 50,
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              borderRadius: 999,
              boxShadow: "0 2px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.07)",
            }}
          >
            {loading
              ? <Loader2 style={{ width: 18, height: 18, color: "rgba(165,180,252,0.65)", flexShrink: 0 }} className="animate-spin" />
              : <SearchIcon style={{ width: 18, height: 18, color: "rgba(165,180,252,0.65)", flexShrink: 0 }} />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={isProfileMode ? "Rechercher dans ce profil…" : "Posts, #hashtags, @mentions…"}
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontSize: 15, color: "#f0f0f5", caretColor: "#6366f1",
              }}
              className="placeholder:text-[rgba(144,144,168,0.38)]"
            />
            {query.length > 0 && (
              <motion.button
                type="button"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => { setQuery(""); setResults(null); inputRef.current?.focus(); }}
                style={{ background: "rgba(255,255,255,0.10)", border: "none", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              >
                <X style={{ width: 12, height: 12, color: "rgba(255,255,255,0.55)" }} />
              </motion.button>
            )}
          </motion.div>
        </form>

        {/* ── Hint chips (état vide) ── */}
        {query === "" && !isProfileMode && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}
          >
            {[
              { label: "# Hashtag", prefix: "#" },
              { label: "@ Mention", prefix: "@" },
            ].map((chip) => (
              <motion.button key={chip.prefix} whileTap={{ scale: 0.93 }}
                onClick={() => { handleChange(chip.prefix); inputRef.current?.focus(); }}
                style={{
                  padding: "5px 13px", borderRadius: 999, cursor: "pointer",
                  background: "rgba(255,255,255,0.07)",
                  border: "0.5px solid rgba(255,255,255,0.12)",
                  fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)",
                }}
              >
                {chip.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Results ── */}
      <div style={{ padding: "24px 16px 120px", maxWidth: 640, margin: "0 auto" }}>
        
          <motion.div
            key={q + loading}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* ── Error state ── */}
            {error && (
              <div style={{ textAlign: "center", paddingTop: 40, paddingBottom: 24 }}>
                <p style={{ fontSize: 14, color: "rgba(248,113,113,0.65)" }}>{error}</p>
              </div>
            )}

            {/* ── Empty initial state ── */}
            {!loading && !error && !results && query === "" && (
              <div style={{ textAlign: "center", paddingTop: 64 }}>
                <SearchIcon style={{ width: 36, height: 36, color: "rgba(255,255,255,0.07)", margin: "0 auto 14px", display: "block" }} />
                <p style={{ fontSize: 15, color: "rgba(144,144,168,0.35)" }}>
                  {isProfileMode ? "Tapez pour rechercher dans ce profil" : "Tapez pour rechercher"}
                </p>
                <p style={{ fontSize: 13, color: "rgba(144,144,168,0.22)", marginTop: 6 }}>Posts · Utilisateurs · #Hashtags</p>
              </div>
            )}

            {/* ── Empty query after typing ── */}
            {!loading && !error && !results && query !== "" && (
              <div style={{ textAlign: "center", paddingTop: 64 }}>
                <Loader2 style={{ width: 24, height: 24, color: "rgba(99,102,241,0.40)", margin: "0 auto 14px", display: "block" }} className="animate-spin" />
              </div>
            )}

            {/* ── Results ── */}
            {results && (
              <>
                {/* Hashtags */}
                {(!isAt) && hasHashtags && (
                  <Section icon={<Hash style={{ width: 14, height: 14 }} />} title="Hashtags" count={results.hashtags.length}>
                    {results.hashtags.map(({ tag, count }) => (
                      <motion.button
                        key={tag}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate(`/hashtag/${tag.replace(/^#/, "")}`)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          width: "100%", padding: "12px 14px", borderRadius: 14,
                          background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)",
                          cursor: "pointer", textAlign: "left", marginBottom: 6,
                        }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99,102,241,0.12)", border: "0.5px solid rgba(99,102,241,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Hash style={{ width: 15, height: 15, color: "#818cf8" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 15, color: "rgba(220,220,235,0.82)", fontWeight: 500 }}>
                            <Highlight text={tag} q={q} />
                          </span>
                          {count > 0 && (
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginLeft: 8 }}>{count} post{count > 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </Section>
                )}

                {/* Users */}
                {(!isHash) && hasUsers && (
                  <Section icon={<Users style={{ width: 14, height: 14 }} />} title="Utilisateurs" count={results.users.length}>
                    {results.users.map((u) => (
                      <UserCard
                        key={u.username}
                        user={u}
                        q={q}
                        onClick={() => navigate(`/profile/${u.username}`)}
                      />
                    ))}
                  </Section>
                )}

                {/* Posts */}
                {(!isAt) && hasPosts && (
                  <Section icon={<FileText style={{ width: 14, height: 14 }} />} title={isProfileMode ? "Posts de ce profil" : "Posts & Réponses"} count={results.posts.length}>
                    {results.posts.map((p) => (
                      <PostCard key={p.id} post={p} q={q} onClick={() => navigateToPost(p)} />
                    ))}
                  </Section>
                )}

                {/* Empty results */}
                {q !== "" && !hasResults && !loading && (
                  <div style={{ textAlign: "center", paddingTop: 64 }}>
                    <SearchIcon style={{ width: 36, height: 36, color: "rgba(255,255,255,0.12)", margin: "0 auto 14px", display: "block" }} />
                    <p style={{ fontSize: 15, color: "rgba(144,144,168,0.40)" }}>Aucun résultat pour «&nbsp;{query}&nbsp;»</p>
                    <p style={{ fontSize: 13, color: "rgba(144,144,168,0.25)", marginTop: 6 }}>
                      {isProfileMode ? "Cet utilisateur n'a pas encore posté ce contenu." : "Essayez un #hashtag ou @mention"}
                    </p>
                  </div>
                )}
              </>
            )}

          </motion.div>
        
      </div>
    </div>
  );
}