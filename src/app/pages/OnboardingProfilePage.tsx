import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Camera, ImagePlus, Check, Loader2, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { upsertProfile, uploadProfileImage } from "../api/profileApi";
import { toggleFollow } from "../api/followsApi";
import { getSuggestedUsers, getSuggestedCommunities, type SuggestedUser, type SuggestedCommunity } from "../api/onboardingApi";
import { useCommunityMember } from "../context/CommunityMemberContext";
import { toast } from "sonner";
import { projectId } from "/utils/supabase/info";

// ── Objectifs disponibles ─────────────────────────────────────────────────────

const OBJECTIVES = [
  "Lancer ma startup",
  "Développer mon projet freelance",
  "Trouver mes premiers clients",
  "Apprendre à coder",
  "Créer du contenu",
  "Faire croître mon audience",
  "Construire un SaaS",
  "Quitter mon emploi",
  "Autre",
];

const PAGE_SIZE = 8; // Nombre d'utilisateurs / communautés chargés par page

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveAvatar(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith("http")) return raw;
  return `https://${projectId}.supabase.co/storage/v1/object/public/${raw}`;
}

function Avatar({ src, name, size = 44 }: { src: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return (
      <img
        src={resolveAvatar(src)}
        alt={name}
        onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, color: "#fff",
    }}>
      {(name[0] ?? "?").toUpperCase()}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function OnboardingProfilePage() {
  const navigate = useNavigate();
  const { user, session, updateLocalUser } = useAuth();
  const { toggleMembership, isMember } = useCommunityMember();

  // ── Champs profil ─────────────────────────────────────────────────────────────
  const [bio, setBio]               = useState("");
  const [objective, setObjective]   = useState("");
  const [showObjPicker, setShowObjPicker] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");

  // ── Suggestions ───────────────────────────────────────────────────────────────
  const [users, setUsers]               = useState<SuggestedUser[]>([]);
  const [usersTotal, setUsersTotal]     = useState(0);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [usersPage, setUsersPage]       = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);

  const [communities, setCommunities]         = useState<SuggestedCommunity[]>([]);
  const [communitiesPage, setCommunitiesPage] = useState(1); // affichées = page * PAGE_SIZE
  const [loadingComm, setLoadingComm]         = useState(true);

  // ── État follows ──────────────────────────────────────────────────────────────
  const [followedSet, setFollowedSet]   = useState<Set<string>>(new Set());
  const [followCounts, setFollowCounts] = useState<Record<string, number>>({});
  const [pendingFollow, setPendingFollow] = useState<Set<string>>(new Set());

  // ── Validation ────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // ── Chargement initial ────────────────────────────────────────────────────────

  const loadUsers = useCallback(async (page: number) => {
    const isFirst = page === 0;
    if (isFirst) setLoadingUsers(true); else setLoadingMoreUsers(true);
    try {
      const result = await getSuggestedUsers(PAGE_SIZE, page * PAGE_SIZE, user?.username);
      setUsers((prev) => isFirst ? result.users : [...prev, ...result.users]);
      setUsersTotal(result.total);
      setUsersHasMore(result.hasMore);
      setUsersPage(page);
    } catch {
      toast.error("Impossible de charger les profils");
    } finally {
      if (isFirst) setLoadingUsers(false); else setLoadingMoreUsers(false);
    }
  }, [user?.username]);

  useEffect(() => {
    loadUsers(0);
    getSuggestedCommunities()
      .then(setCommunities)
      .catch(() => {})
      .finally(() => setLoadingComm(false));
  }, [loadUsers]);

  // ── Handlers fichiers ─────────────────────────────────────────────────────────

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  // ── Follow ────────────────────────────────────────────────────────────────────

  async function handleFollow(targetUsername: string, currentFollowers: number) {
    if (!user?.username || pendingFollow.has(targetUsername)) return;
    setPendingFollow((s) => new Set(s).add(targetUsername));

    const isFollowing = followedSet.has(targetUsername);
    // Optimistic update
    setFollowedSet((s) => {
      const n = new Set(s);
      isFollowing ? n.delete(targetUsername) : n.add(targetUsername);
      return n;
    });
    setFollowCounts((c) => ({
      ...c,
      [targetUsername]: (c[targetUsername] ?? currentFollowers) + (isFollowing ? -1 : 1),
    }));

    try {
      const result = await toggleFollow(user.username, targetUsername);
      setFollowCounts((c) => ({ ...c, [targetUsername]: result.followingCount }));
    } catch {
      // Rollback
      setFollowedSet((s) => {
        const n = new Set(s);
        isFollowing ? n.add(targetUsername) : n.delete(targetUsername);
        return n;
      });
      setFollowCounts((c) => ({
        ...c,
        [targetUsername]: (c[targetUsername] ?? currentFollowers) + (isFollowing ? 1 : -1),
      }));
      toast.error("Erreur lors du suivi");
    } finally {
      setPendingFollow((s) => { const n = new Set(s); n.delete(targetUsername); return n; });
    }
  }

  // ── Rejoindre communauté ──────────────────────────────────────────────────────

  async function handleJoinCommunity(communityId: string) {
    await toggleMembership(communityId);
  }

  // ── Valider et passer à la page IA ───────────────────────────────────────────

  const canProceed =
    bio.trim().length > 0 &&
    objective.length > 0 &&
    followedSet.size >= 1 &&
    communities.slice(0, communitiesPage * PAGE_SIZE).some((c) => isMember(c.id));

  async function handleValidate() {
    if (!canProceed || !user?.username || saving) return;
    setSaving(true);

    try {
      // 1. Upload avatar si sélectionné
      let avatarUrl = user.avatar || "";
      if (avatarFile) {
        try {
          avatarUrl = await uploadProfileImage(avatarFile, "avatar", user.username);
        } catch (e) {
          console.error("[onboarding-profile] avatar upload error:", e);
          // Non-bloquant
        }
      }

      // 2. Upload bannière si sélectionnée
      let bannerUrl = "";
      if (bannerFile) {
        try {
          bannerUrl = await uploadProfileImage(bannerFile, "banner", user.username);
        } catch (e) {
          console.error("[onboarding-profile] banner upload error:", e);
        }
      }

      // 3. Sauvegarder le profil KV (inclut onboardingStep pour le guard)
      await upsertProfile(user.username, {
        bio: bio.trim(),
        objective,
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
        ...(bannerUrl ? { banner: bannerUrl } : {}),
        onboardingDone: true,
        onboardingStep: "ia",
      });

      // 4. Mettre à jour le contexte local
      updateLocalUser({
        objective,
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
        onboarding_step: "ia",
      } as Parameters<typeof updateLocalUser>[0]);

      navigate("/onboarding/ia");
    } catch (err) {
      console.error("[onboarding-profile] save error:", err);
      toast.error("Erreur lors de l'enregistrement. Réessaie.");
    } finally {
      setSaving(false);
    }
  }

  const displayedCommunities = communities.slice(0, communitiesPage * PAGE_SIZE);
  const hasMoreCommunities = communitiesPage * PAGE_SIZE < communities.length;

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#000",
      color: "rgba(235,235,245,0.92)",
      fontFamily: "inherit",
      paddingTop: "env(safe-area-inset-top, 0px)",
      paddingBottom: 120,
    }}>

      {/* ── Bannière + Avatar ─────────────────────────────────────────────── */}
      <div style={{ position: "relative", height: 160 }}>
        {/* Bannière */}
        <div
          onClick={() => bannerInputRef.current?.click()}
          style={{
            width: "100%", height: 160,
            background: bannerPreview
              ? `url(${bannerPreview}) center/cover no-repeat`
              : "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(124,58,237,0.15) 100%)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {!bannerPreview && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <ImagePlus style={{ width: 20, height: 20, color: "rgba(255,255,255,0.3)" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Ajouter une bannière</span>
            </div>
          )}
        </div>
        <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerChange} style={{ display: "none" }} />

        {/* Avatar */}
        <div
          onClick={() => avatarInputRef.current?.click()}
          style={{
            position: "absolute", bottom: -28, left: 20,
            width: 72, height: 72, borderRadius: "50%",
            border: "3px solid #000",
            background: avatarPreview ? `url(${avatarPreview}) center/cover no-repeat` : "rgba(255,255,255,0.08)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {!avatarPreview && <Camera style={{ width: 22, height: 22, color: "rgba(255,255,255,0.35)" }} />}
        </div>
        <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
      </div>

      <div style={{ padding: "44px 20px 0" }}>

        {/* ── Titre ──────────────────────────────────────────────────────── */}
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#fff" }}>
          Crée ton profil
        </h1>
        <p style={{ fontSize: 14, color: "rgba(235,235,245,0.4)", margin: "0 0 28px" }}>
          Présente-toi à la communauté Fowards
        </p>

        {/* ── Bio ────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(235,235,245,0.55)", display: "block", marginBottom: 8 }}>
            Bio <span style={{ color: "rgba(255,100,100,0.7)" }}>*</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 150))}
            placeholder="En quelques mots, qui tu es et ce que tu construis…"
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(255,255,255,0.06)",
              border: `0.5px solid ${bio.trim().length > 0 ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 12, padding: "12px 14px",
              color: "rgba(235,235,245,0.92)", fontSize: 14,
              resize: "none", outline: "none", fontFamily: "inherit",
              lineHeight: 1.5, transition: "border-color 0.15s",
            }}
          />
          <div style={{ textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
            {bio.length}/150
          </div>
        </div>

        {/* ── Objectif ───────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28, position: "relative" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(235,235,245,0.55)", display: "block", marginBottom: 8 }}>
            Objectif principal <span style={{ color: "rgba(255,100,100,0.7)" }}>*</span>
          </label>
          <button
            onClick={() => setShowObjPicker((v) => !v)}
            style={{
              width: "100%", padding: "12px 14px",
              background: "rgba(255,255,255,0.06)",
              border: `0.5px solid ${objective ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              color: objective ? "rgba(235,235,245,0.92)" : "rgba(255,255,255,0.3)",
              fontSize: 14, fontFamily: "inherit",
            }}
          >
            <span>{objective || "Choisis ton objectif…"}</span>
            <ChevronDown style={{
              width: 16, height: 16, color: "rgba(255,255,255,0.3)",
              transform: showObjPicker ? "rotate(180deg)" : "none",
              transition: "transform 0.15s",
            }} />
          </button>

          <AnimatePresence>
            {showObjPicker && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30,
                  background: "rgba(20,20,30,0.98)",
                  border: "0.5px solid rgba(255,255,255,0.12)",
                  borderRadius: 12, marginTop: 4,
                  overflow: "hidden",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                {OBJECTIVES.map((obj) => (
                  <button
                    key={obj}
                    onClick={() => { setObjective(obj); setShowObjPicker(false); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", padding: "13px 16px",
                      background: objective === obj ? "rgba(99,102,241,0.12)" : "transparent",
                      border: "none", borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                      color: objective === obj ? "rgba(235,235,245,0.95)" : "rgba(235,235,245,0.7)",
                      fontSize: 14, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    }}
                  >
                    {obj}
                    {objective === obj && <Check style={{ width: 14, height: 14, color: "rgba(99,102,241,0.8)" }} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Profils suggérés ───────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Suis des fondateurs</h2>
            <p style={{ fontSize: 13, color: "rgba(235,235,245,0.35)", margin: 0 }}>
              Abonne-toi à au moins 1 profil <span style={{ color: followedSet.size >= 1 ? "rgba(99,244,99,0.7)" : "rgba(255,100,100,0.7)" }}>*</span>
            </p>
          </div>

          {loadingUsers ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
              <Loader2 style={{ width: 20, height: 20, color: "rgba(255,255,255,0.3)", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : (
            <>
              {users.map((u) => {
                const isFollowing = followedSet.has(u.username);
                const count = followCounts[u.username] ?? u.followersCount;
                const pending = pendingFollow.has(u.username);
                return (
                  <motion.div
                    key={u.username}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 0",
                      borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <Avatar src={u.avatar} name={u.name} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{u.name}</span>
                        {u.grade && u.grade !== "Membre" && (
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontWeight: 400 }}>
                            {u.grade}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>
                        {count} abonné{count !== 1 ? "s" : ""}
                      </div>
                      {u.objective && (
                        <div style={{
                          fontSize: 12, color: "rgba(235,235,245,0.45)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          marginTop: 2,
                        }}>
                          {u.objective}
                        </div>
                      )}
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleFollow(u.username, u.followersCount)}
                      disabled={pending}
                      style={{
                        height: 34, padding: "0 14px",
                        borderRadius: 999,
                        border: isFollowing ? "0.5px solid rgba(255,255,255,0.2)" : "none",
                        background: isFollowing ? "transparent" : "rgba(255,255,255,0.9)",
                        color: isFollowing ? "rgba(255,255,255,0.6)" : "#000",
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                        flexShrink: 0, opacity: pending ? 0.6 : 1,
                        transition: "all 0.15s",
                      }}
                    >
                      {isFollowing ? "Suivi ✓" : "Suivre"}
                    </motion.button>
                  </motion.div>
                );
              })}

              {(usersHasMore || loadingMoreUsers) && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => !loadingMoreUsers && loadUsers(usersPage + 1)}
                  disabled={loadingMoreUsers}
                  style={{
                    width: "100%", height: 40, marginTop: 10,
                    borderRadius: 10,
                    border: "0.5px solid rgba(255,255,255,0.1)",
                    background: "transparent",
                    color: "rgba(235,235,245,0.45)",
                    fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  {loadingMoreUsers
                    ? <Loader2 style={{ width: 14, height: 14, animation: "spin 0.7s linear infinite" }} />
                    : `Voir plus (${usersTotal - users.length} restants)`}
                </motion.button>
              )}
            </>
          )}
        </div>

        {/* ── Communautés ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Rejoins des communautés</h2>
            <p style={{ fontSize: 13, color: "rgba(235,235,245,0.35)", margin: 0 }}>
              Rejoint au moins 1 communauté <span style={{ color: displayedCommunities.some((c) => isMember(c.id)) ? "rgba(99,244,99,0.7)" : "rgba(255,100,100,0.7)" }}>*</span>
            </p>
          </div>

          {loadingComm ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
              <Loader2 style={{ width: 20, height: 20, color: "rgba(255,255,255,0.3)", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : (
            <>
              {displayedCommunities.map((c) => {
                const joined = isMember(c.id);
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 0",
                      borderBottom: "0.5px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                      background: "rgba(255,255,255,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {c.avatar
                        ? <img src={c.avatar} alt={c.name} style={{ width: 44, height: 44, objectFit: "cover" }} />
                        : <span style={{ fontSize: 20 }}>🏠</span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>
                        {c.members} membre{c.members !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleJoinCommunity(c.id)}
                      style={{
                        height: 34, padding: "0 14px",
                        borderRadius: 999,
                        border: joined ? "0.5px solid rgba(255,255,255,0.2)" : "none",
                        background: joined ? "transparent" : "rgba(255,255,255,0.9)",
                        color: joined ? "rgba(255,255,255,0.6)" : "#000",
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                        flexShrink: 0, transition: "all 0.15s",
                      }}
                    >
                      {joined ? "Rejoint ✓" : "Rejoindre"}
                    </motion.button>
                  </motion.div>
                );
              })}

              {hasMoreCommunities && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setCommunitiesPage((p) => p + 1)}
                  style={{
                    width: "100%", height: 40, marginTop: 10,
                    borderRadius: 10,
                    border: "0.5px solid rgba(255,255,255,0.1)",
                    background: "transparent",
                    color: "rgba(235,235,245,0.45)",
                    fontSize: 13, cursor: "pointer",
                  }}
                >
                  Voir plus ({communities.length - displayedCommunities.length} restantes)
                </motion.button>
              )}
            </>
          )}
        </div>

      </div>

      {/* ── Bouton Valider (sticky bas) ─────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "12px 20px",
        paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
        background: "linear-gradient(to top, rgba(0,0,0,1) 60%, rgba(0,0,0,0))",
        zIndex: 40,
      }}>
        {/* Indicateurs de progression */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, justifyContent: "center" }}>
          {[
            { label: "Bio", done: bio.trim().length > 0 },
            { label: "Objectif", done: objective.length > 0 },
            { label: "1 suivi", done: followedSet.size >= 1 },
            { label: "1 communauté", done: displayedCommunities.some((c) => isMember(c.id)) },
          ].map((item) => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, color: item.done ? "rgba(99,244,99,0.8)" : "rgba(255,255,255,0.25)",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: item.done ? "rgba(99,244,99,0.8)" : "rgba(255,255,255,0.15)",
              }} />
              {item.label}
            </div>
          ))}
        </div>

        <motion.button
          whileTap={canProceed ? { scale: 0.97 } : {}}
          onClick={handleValidate}
          disabled={!canProceed || saving}
          style={{
            width: "100%", height: 50, borderRadius: 14,
            border: "none",
            background: canProceed ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.1)",
            color: canProceed ? "#000" : "rgba(255,255,255,0.25)",
            fontSize: 15, fontWeight: 700, cursor: canProceed ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.2s",
          }}
        >
          {saving
            ? <Loader2 style={{ width: 18, height: 18, animation: "spin 0.7s linear infinite" }} />
            : "Continuer →"
          }
        </motion.button>
      </div>
    </div>
  );
}
