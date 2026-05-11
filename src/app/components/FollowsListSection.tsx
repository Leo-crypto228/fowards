/**
 * FollowsListSection — Section avec deux onglets pill :
 *  • "Abonnement" → liste des comptes suivis
 *  • "Abonné"     → liste des followers
 *
 * Design : noir / blanc / gris, minimaliste, sans trait séparateur.
 * Avatar avec fallback initiales robuste.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Users, UserCheck } from "lucide-react";
import { FollowButton } from "./FollowButton";
import { AvatarImg } from "./AvatarImg";
import {
  getFollowingProfiles,
  getFollowerProfiles,
  type EnrichedProfile,
} from "../api/followsApi";
import { GLOBAL_PROFILES_MAP } from "../data/profiles";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "following" | "followers";

interface FollowsListSectionProps {
  currentUserId: string;
  followedList?: string[];
}

// ── Ligne de profil ──────────────────────────────────────────────────────────
function ProfileRow({ profile, index }: { profile: EnrichedProfile; index: number }) {
  const navigate = useNavigate();
  const handle = `@${profile.username}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, delay: index * 0.04 }}
      onClick={() => navigate(`/profile/${profile.username}`)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "14px 10px 12px",
        cursor: "pointer",
        borderRadius: 16,
        background: "rgba(255,255,255,0.04)",
        border: "0.5px solid rgba(255,255,255,0.07)",
        minWidth: 108,
        maxWidth: 120,
        flexShrink: 0,
      }}
    >
      <AvatarImg src={profile.avatar} name={profile.name} size={52} />

      <div style={{ textAlign: "center", width: "100%", minWidth: 0 }}>
        <p style={{
          fontSize: 12.5, fontWeight: 600,
          color: "rgba(255,255,255,0.90)", margin: 0,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {profile.name}
        </p>
        <p style={{
          fontSize: 10.5, color: "rgba(255,255,255,0.28)", margin: "2px 0 0",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {handle}
        </p>
        {profile.objective && (
          <p style={{
            fontSize: 10, color: "rgba(255,255,255,0.20)", margin: "3px 0 0",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {profile.objective.length > 20 ? profile.objective.slice(0, 20) + "…" : profile.objective}
          </p>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 2 }}>
        <FollowButton username={profile.username} size="sm" stopPropagation={false} />
      </div>
    </motion.div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ tab }: { tab: Tab }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: "36px 0", textAlign: "center" }}
    >
      {tab === "following" ? (
        <Users style={{ width: 32, height: 32, color: "rgba(255,255,255,0.15)", margin: "0 auto 12px" }} strokeWidth={1.5} />
      ) : (
        <UserCheck style={{ width: 32, height: 32, color: "rgba(255,255,255,0.15)", margin: "0 auto 12px" }} strokeWidth={1.5} />
      )}
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", margin: 0 }}>
        {tab === "following" ? "Tu ne suis personne encore." : "Aucun abonné pour l'instant."}
      </p>
    </motion.div>
  );
}

// ── Skeleton loader ──────────────────────────────────────────────────────────
function SkeletonRow({ i }: { i: number }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      padding: "14px 10px 12px",
      borderRadius: 16,
      background: "rgba(255,255,255,0.04)",
      border: "0.5px solid rgba(255,255,255,0.07)",
      minWidth: 108, maxWidth: 120, flexShrink: 0,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%",
        background: "rgba(255,255,255,0.06)", flexShrink: 0,
      }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: "100%" }}>
        <div style={{ height: 11, width: "70%", borderRadius: 6, background: "rgba(255,255,255,0.06)" }} />
        <div style={{ height: 9, width: "55%", borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
      </div>
      <div style={{ height: 24, width: 60, borderRadius: 999, background: "rgba(255,255,255,0.05)" }} />
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────
export function FollowsListSection({ currentUserId, followedList = [] }: FollowsListSectionProps) {
  const [activeTab, setActiveTab] = useState<Tab>("following");
  const [followingProfiles, setFollowingProfiles] = useState<EnrichedProfile[]>([]);
  const [followerProfiles, setFollowerProfiles] = useState<EnrichedProfile[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [loadingFollowers, setLoadingFollowers] = useState(false);

  const followingLoadedRef = useRef(false);
  const followerLoadedRef  = useRef(false);

  const enrichWithGlobal = useCallback((profiles: EnrichedProfile[]): EnrichedProfile[] =>
    profiles.map((p) => {
      if (p.avatar) return p;
      const known = GLOBAL_PROFILES_MAP.get(p.username);
      return known?.avatar ? { ...p, avatar: known.avatar, objective: p.objective || known.objective || "" } : p;
    }), []);

  const loadFollowing = useCallback(async (force = false) => {
    if (!currentUserId || (followingLoadedRef.current && !force)) return;
    setLoadingFollowing(true);
    try {
      const { profiles } = await getFollowingProfiles(currentUserId);
      setFollowingProfiles(enrichWithGlobal(profiles));
      followingLoadedRef.current = true;
    } catch (err) {
      console.error("FollowsListSection: erreur following profiles:", err);
    } finally {
      setLoadingFollowing(false);
    }
  }, [currentUserId, enrichWithGlobal]);

  const loadFollowers = useCallback(async (force = false) => {
    if (!currentUserId || (followerLoadedRef.current && !force)) return;
    setLoadingFollowers(true);
    try {
      const { profiles } = await getFollowerProfiles(currentUserId);
      setFollowerProfiles(enrichWithGlobal(profiles));
      followerLoadedRef.current = true;
    } catch (err) {
      console.error("FollowsListSection: erreur follower profiles:", err);
    } finally {
      setLoadingFollowers(false);
    }
  }, [currentUserId, enrichWithGlobal]);

  useEffect(() => { loadFollowing(); }, [loadFollowing]);
  useEffect(() => { if (activeTab === "followers") loadFollowers(); }, [activeTab, loadFollowers]);

  const prevFollowedLen = useRef(followedList.length);
  useEffect(() => {
    if (prevFollowedLen.current !== followedList.length) {
      prevFollowedLen.current = followedList.length;
      followingLoadedRef.current = false;
      loadFollowing(true);
    }
  }, [followedList.length, loadFollowing]);

  const followingCount = followingProfiles.length;
  const followerCount  = followerProfiles.length;
  const loading  = activeTab === "following" ? loadingFollowing : loadingFollowers;
  const profiles = activeTab === "following" ? followingProfiles : followerProfiles;

  return (
    <div>
      {/* ── Pill tabs ── */}
      <div style={{ display: "flex", gap: 8, padding: "0 0 14px" }}>
        {(["following", "followers"] as Tab[]).map((tab) => {
          const isActive = activeTab === tab;
          const label    = tab === "following" ? "Abonnement" : "Abonné";
          const count    = tab === "following" ? followingCount : followerCount;
          return (
            <motion.button
              key={tab}
              whileTap={{ scale: 0.93 }}
              onClick={() => setActiveTab(tab)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 16px", borderRadius: 999,
                border: isActive
                  ? "1.5px solid rgba(255,255,255,0.45)"
                  : "1.5px solid rgba(255,255,255,0.10)",
                background: isActive ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.25)",
                cursor: "pointer",
                transition: "border 0.18s, background 0.18s",
              }}
            >
              <span style={{
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.36)",
                letterSpacing: "0.01em",
              }}>
                {label}
              </span>
              {count > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, borderRadius: 999,
                  padding: "1px 6px", lineHeight: 1.5,
                  color: isActive ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.20)",
                  background: isActive ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
                }}>
                  {count}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ── Liste horizontale ── */}
      
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {loading ? (
            <div style={{
              display: "flex", gap: 10, overflowX: "auto",
              paddingBottom: 8, scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            } as React.CSSProperties}>
              {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} i={i} />)}
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState tab={activeTab} />
          ) : (
            <div style={{
              display: "flex", gap: 10, overflowX: "auto",
              paddingBottom: 8, scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            } as React.CSSProperties}>
              {profiles.map((p, i) => (
                <ProfileRow key={p.username} profile={p} index={i} />
              ))}
            </div>
          )}
        </motion.div>
      
    </div>
  );
}