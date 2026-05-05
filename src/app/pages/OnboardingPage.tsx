import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import {
  ArrowRight, Check, Loader2, Target, Users, Building2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { normalizeUsername } from "../api/profileCache";

const BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

// ── Types pour les données réelles ────────────────────────────────────────────
interface SuggestedProfile {
  handle: string;
  name: string;
  objective: string;
  streak: number;
  avatar: string;
}

interface SuggestedCommunity {
  id: string;
  name: string;
  description: string;
  members: number;
  emoji: string;
  avatar: string;
}

type Step = "bio" | "follow" | "communities" | "goal" | "progress";
const STEPS: Step[] = ["bio", "follow", "communities", "goal", "progress"];

const STEP_META: Record<Step, { icon: React.ComponentType<{ style?: React.CSSProperties }>, title: string; subtitle: string }> = {
  bio:         { icon: Target,     title: "Parle-nous de toi 👋",          subtitle: "Ta bio apparaîtra sur ton profil public." },
  follow:      { icon: Users,     title: "Avance avec eux 🚀",            subtitle: "Suis des profils qui t'inspirent et te motivent." },
  communities: { icon: Building2, title: "Rejoins des communautés 🤝",    subtitle: "Avance entouré de personnes qui partagent tes intérêts." },
  goal:        { icon: Target,    title: "Quel est ton objectif ? 🎯",    subtitle: "Ton premier objectif sur FuturFeed." },
  progress:    { icon: Target,    title: "Où en es-tu aujourd'hui ? 📍",  subtitle: "Décris ta situation actuelle par rapport à ton objectif." },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST", headers: HEADERS, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
  return data;
}

async function apiPut(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT", headers: HEADERS, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
  return data;
}

// ── Progress dots ─────────────────────────────────────────────────────────────
function StepDots({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 32 }}>
      {STEPS.map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === current ? 24 : 7,
            background: i <= current ? "#6366f1" : "rgba(255,255,255,0.15)",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          style={{ height: 7, borderRadius: 999 }}
        />
      ))}
    </div>
  );
}

// ── Follow card ───────────────────────────────────────────────────────────────
function FollowCard({
  profile, selected, onToggle,
}: {
  profile: SuggestedProfile;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 16,
        background: selected ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.04)",
        border: selected ? "1px solid rgba(99,102,241,0.35)" : "1px solid rgba(255,255,255,0.08)",
        cursor: "pointer", transition: "all 0.18s",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <img
          src={profile.avatar} alt={profile.name}
          style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }}
        />
        {selected && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{
              position: "absolute", bottom: -2, right: -2,
              width: 18, height: 18, borderRadius: "50%",
              background: "#6366f1",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #050510",
            }}
          >
            <Check style={{ width: 9, height: 9, color: "#fff" }} />
          </motion.div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.90)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {profile.name}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {profile.objective}
        </div>
      </div>

      <div style={{
        flexShrink: 0, padding: "5px 12px", borderRadius: 999,
        background: selected ? "#6366f1" : "rgba(255,255,255,0.07)",
        border: selected ? "none" : "0.5px solid rgba(255,255,255,0.12)",
        fontSize: 12, fontWeight: 600,
        color: selected ? "#fff" : "rgba(255,255,255,0.55)",
        transition: "all 0.18s",
        whiteSpace: "nowrap",
      }}>
        {selected ? "✓ Suivi" : "Avancer avec"}
      </div>
    </motion.div>
  );
}

// ── Community card ────────────────────────────────────────────────────────────
function CommunityCard({
  community, selected, onToggle,
}: {
  community: SuggestedCommunity;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 16,
        background: selected ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.04)",
        border: selected ? "1px solid rgba(99,102,241,0.35)" : "1px solid rgba(255,255,255,0.08)",
        cursor: "pointer", transition: "all 0.18s",
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, overflow: "hidden", flexShrink: 0,
        fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.07)",
      }}>
        {community.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.90)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {community.name}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)" }}>
          {community.members} membres
        </div>
      </div>

      <div style={{
        flexShrink: 0, padding: "5px 12px", borderRadius: 999,
        background: selected ? "#6366f1" : "rgba(255,255,255,0.07)",
        border: selected ? "none" : "0.5px solid rgba(255,255,255,0.12)",
        fontSize: 12, fontWeight: 600,
        color: selected ? "#fff" : "rgba(255,255,255,0.55)",
        transition: "all 0.18s",
      }}>
        {selected ? "✓ Rejoint" : "S'abonner"}
      </div>
    </motion.div>
  );
}

// ── Shared textarea style ─────────────────────────────────────────────────────
const TEXTAREA_STYLE: React.CSSProperties = {
  width: "100%",
  minHeight: 120,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
  padding: "16px",
  fontSize: 15,
  color: "rgba(235,235,245,0.92)",
  outline: "none",
  resize: "none",
  caretColor: "#6366f1",
  lineHeight: 1.6,
  boxSizing: "border-box",
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
  overflowWrap: "break-word",
  wordBreak: "break-word",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 14,
  padding: "14px 16px",
  fontSize: 15,
  color: "rgba(235,235,245,0.92)",
  outline: "none",
  caretColor: "#6366f1",
  boxSizing: "border-box",
};

// ── Main component ────────────────────────────────────────────────────────────
export function OnboardingPage() {
  const { user, updateLocalUser } = useAuth();
  const navigate = useNavigate();

  const [stepIdx,   setStepIdx]   = useState(0);
  const [direction, setDirection] = useState(1); // +1 forward, -1 back
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Données réelles depuis Supabase
  const [suggestedProfiles,     setSuggestedProfiles]     = useState<SuggestedProfile[]>([]);
  const [suggestedCommunities,  setSuggestedCommunities]  = useState<SuggestedCommunity[]>([]);
  const [loadingProfiles,       setLoadingProfiles]       = useState(true);
  const [loadingCommunities,    setLoadingCommunities]    = useState(true);

  // Step data
  const [bio,             setBio]             = useState("");
  const [followedHandles, setFollowedHandles] = useState<Set<string>>(new Set());
  const [joinedCommunities, setJoinedCommunities] = useState<Set<string>>(new Set());
  const [goalTitle,       setGoalTitle]       = useState("");
  const [goalDesc,        setGoalDesc]        = useState("");
  const [progressText,    setProgressText]    = useState("");
  const [createdGoalId,   setCreatedGoalId]   = useState<string | null>(null);

  const currentStep = STEPS[stepIdx];
  const username    = user?.username || "";

  // ── Chargement des vrais profils et communautés depuis Supabase ──────────────
  useEffect(() => {
    if (!username) return;
    setLoadingProfiles(true);
    fetch(`${BASE}/onboarding/suggested-profiles?exclude=${encodeURIComponent(username)}`, { headers: HEADERS })
      .then((r) => r.json())
      .then((d) => { if (d.profiles) setSuggestedProfiles(d.profiles); })
      .catch((e) => console.error("Erreur chargement profils onboarding:", e))
      .finally(() => setLoadingProfiles(false));

    setLoadingCommunities(true);
    fetch(`${BASE}/onboarding/suggested-communities`, { headers: HEADERS })
      .then((r) => r.json())
      .then((d) => { if (d.communities) setSuggestedCommunities(d.communities); })
      .catch((e) => console.error("Erreur chargement communautés onboarding:", e))
      .finally(() => setLoadingCommunities(false));
  }, [username]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goNext = useCallback(async () => {
    if (saving) return;
    setError(null);
    setSaving(true);

    try {
      if (currentStep === "bio") {
        // Save bio
        await apiPut(`/profiles/${encodeURIComponent(username)}`, { bio: bio.trim() });

      } else if (currentStep === "follow") {
        // Save follows
        const targets = Array.from(followedHandles);
        await Promise.allSettled(
          targets.map((handle) =>
            apiPost("/follows", { followerId: username, followingId: handle })
          )
        );

      } else if (currentStep === "communities") {
        // Save community memberships
        const communityIds = Array.from(joinedCommunities);
        await Promise.allSettled(
          communityIds.map((communityId) =>
            apiPost("/community-members", { communityId, userId: username })
          )
        );

      } else if (currentStep === "goal") {
        if (!goalTitle.trim()) { setError("Le titre de l'objectif est requis."); setSaving(false); return; }
        // Create goal in KV
        const data = await apiPost("/progression/goals", {
          userId: username,
          title:       goalTitle.trim(),
          description: goalDesc.trim(),
          progress:    0,
        }) as { goals?: Array<{ id: string }> };
        const goals = data.goals ?? [];
        const newGoal = goals[0];
        if (newGoal?.id) setCreatedGoalId(newGoal.id);
        // Update profile objective
        await apiPut(`/profiles/${encodeURIComponent(username)}`, { objective: goalTitle.trim() });

      } else if (currentStep === "progress") {
        if (!progressText.trim()) { setError("Décris ta situation actuelle."); setSaving(false); return; }
        // Save progress report
        await apiPost("/progression/progress-report", {
          userId:       username,
          goalId:       createdGoalId,
          responseText: progressText.trim(),
        });
        // Do daily checkin
        await apiPost("/progression/checkin", { userId: username });
        // Mark onboarding as done
        await apiPut(`/profiles/${encodeURIComponent(username)}`, { onboardingDone: true });
        // Update local state
        updateLocalUser({ onboardingDone: true, objective: goalTitle.trim() });
        navigate("/", { replace: true });
        return;
      }

      // Go to next step
      setDirection(1);
      setStepIdx((i) => i + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [saving, currentStep, username, bio, followedHandles, joinedCommunities, goalTitle, goalDesc, progressText, createdGoalId, updateLocalUser, navigate]);

  const skipStep = () => {
    setError(null);
    setDirection(1);
    setStepIdx((i) => i + 1);
  };

  // ── Render step content ─────────────────────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case "bio":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Je construis mon premier SaaS, j'apprends à coder et je partage mon parcours en public…"
              style={TEXTAREA_STYLE}
              className="focus:border-indigo-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
              maxLength={280}
            />
            <div style={{ textAlign: "right", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
              {bio.length}/280
            </div>
          </div>
        );

      case "follow":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {followedHandles.size > 0 && (
              <p style={{ fontSize: 13, color: "rgba(99,102,241,0.85)", margin: "0 0 4px", fontWeight: 600 }}>
                {followedHandles.size} personne{followedHandles.size > 1 ? "s" : ""} suivie{followedHandles.size > 1 ? "s" : ""}
              </p>
            )}
            {loadingProfiles ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                <Loader2 style={{ width: 22, height: 22, color: "#6366f1", animation: "spin 0.8s linear infinite" }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : suggestedProfiles.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.30)", fontSize: 14 }}>
                Aucun profil disponible pour l'instant.<br />
                <span style={{ fontSize: 12, opacity: 0.6 }}>D'autres membres rejoindront bientôt !</span>
              </div>
            ) : (
              suggestedProfiles.map((p) => (
                <FollowCard
                  key={p.handle}
                  profile={p}
                  selected={followedHandles.has(p.handle)}
                  onToggle={() => {
                    setFollowedHandles((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.handle)) next.delete(p.handle);
                      else next.add(p.handle);
                      return next;
                    });
                  }}
                />
              ))
            )}
          </div>
        );

      case "communities":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {joinedCommunities.size > 0 && (
              <p style={{ fontSize: 13, color: "rgba(99,102,241,0.85)", margin: "0 0 4px", fontWeight: 600 }}>
                {joinedCommunities.size} communauté{joinedCommunities.size > 1 ? "s" : ""} rejointe{joinedCommunities.size > 1 ? "s" : ""}
              </p>
            )}
            {loadingCommunities ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                <Loader2 style={{ width: 22, height: 22, color: "#6366f1", animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : suggestedCommunities.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.30)", fontSize: 14 }}>
                Aucune communauté disponible pour l'instant.<br />
                <span style={{ fontSize: 12, opacity: 0.6 }}>Les premières communautés arrivent bientôt !</span>
              </div>
            ) : (
              suggestedCommunities.map((c) => (
                <CommunityCard
                  key={c.id}
                  community={c}
                  selected={joinedCommunities.has(c.id)}
                  onToggle={() => {
                    setJoinedCommunities((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    });
                  }}
                />
              ))
            )}
          </div>
        );

      case "goal":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 7 }}>
                Titre de l'objectif *
              </label>
              <input
                type="text"
                value={goalTitle}
                onChange={(e) => { setGoalTitle(e.target.value); setError(null); }}
                placeholder="Lancer mon SaaS en 6 mois"
                style={INPUT_STYLE}
                className="focus:border-indigo-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 7 }}>
                Description (optionnelle)
              </label>
              <textarea
                value={goalDesc}
                onChange={(e) => setGoalDesc(e.target.value)}
                placeholder="Détaille ton objectif : pourquoi, comment, avec quel délai…"
                style={{ ...TEXTAREA_STYLE, minHeight: 90 }}
                className="focus:border-indigo-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
                maxLength={500}
              />
            </div>
          </div>
        );

      case "progress":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {goalTitle && (
              <div style={{
                padding: "10px 14px", borderRadius: 12,
                background: "rgba(99,102,241,0.08)",
                border: "0.5px solid rgba(99,102,241,0.20)",
              }}>
                <span style={{ fontSize: 12, color: "rgba(99,102,241,0.80)", fontWeight: 600 }}>
                  🎯 {goalTitle}
                </span>
              </div>
            )}
            <textarea
              value={progressText}
              onChange={(e) => { setProgressText(e.target.value); setError(null); }}
              placeholder="J'en suis à l'étape de validation de l'idée. J'ai fait 3 interviews clients cette semaine…"
              style={{ ...TEXTAREA_STYLE, minHeight: 140 }}
              className="focus:border-indigo-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
              maxLength={500}
            />
            <div style={{ textAlign: "right", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
              {progressText.length}/500
            </div>
          </div>
        );
    }
  };

  const canSkip = currentStep === "bio" || currentStep === "follow" || currentStep === "communities";
  const isLast  = currentStep === "progress";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#000000",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Aurora */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%)",
      }} />

      <div style={{
        flex: 1, overflowY: "auto",
        display: "flex", flexDirection: "column",
        alignItems: "center",
        padding: "48px 20px 32px",
        position: "relative", zIndex: 1,
      }}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 28 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#f0f0f5", letterSpacing: "-0.3px" }}>
              FuturFeed
            </span>
          </div>

          {/* Progress dots */}
          <StepDots current={stepIdx} />

          {/* Animated step content */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              initial={{ opacity: 0, x: direction * 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -32 }}
              transition={{ duration: 0.28, ease: [0.25, 0, 0.35, 1] }}
            >
              {/* Step header */}
              <div style={{ marginBottom: 24 }}>
                <h1 style={{
                  fontSize: 24, fontWeight: 800, color: "#f0f0f5",
                  margin: "0 0 8px", letterSpacing: "-0.4px",
                }}>
                  {STEP_META[currentStep].title}
                </h1>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", margin: 0 }}>
                  {STEP_META[currentStep].subtitle}
                </p>
              </div>

              {/* Step form */}
              {renderStep()}

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 8,
                      padding: "10px 14px", borderRadius: 12, marginTop: 14,
                      background: "rgba(239,68,68,0.10)",
                      border: "0.5px solid rgba(239,68,68,0.25)",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "rgba(239,68,68,0.90)" }}>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 28 }}>
                <motion.button
                  whileTap={!saving ? { scale: 0.97 } : {}}
                  disabled={saving}
                  onClick={goNext}
                  style={{
                    width: "100%", padding: "15px",
                    borderRadius: 14,
                    background: saving ? "rgba(139,92,246,0.50)" : "#8b5cf6",
                    border: "none", color: "#fff", fontSize: 16, fontWeight: 700,
                    cursor: saving ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: saving ? "none" : "0 4px 20px rgba(139,92,246,0.30)",
                  }}
                >
                  {saving ? (
                    <><Loader2 style={{ width: 17, height: 17, animation: "spin 1s linear infinite" }} /> Enregistrement…</>
                  ) : isLast ? (
                    <><Check style={{ width: 17, height: 17 }} /> Terminer l'onboarding</>
                  ) : (
                    <>Continuer <ArrowRight style={{ width: 17, height: 17 }} /></>
                  )}
                </motion.button>

                {canSkip && !saving && (
                  <button
                    onClick={skipStep}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 14, color: "rgba(255,255,255,0.30)", padding: "8px",
                      fontWeight: 500,
                    }}
                  >
                    Passer cette étape →
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}