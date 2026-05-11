/**
 * FollowButton — Bouton suivi / désabonnement complet.
 * - Non suivi  → "Avancez avec" (blanc)
 * - Suivi      → "Suivi ✓" (violet), hover → "Se désabonner" (rouge doux)
 * - Toujours synchronisé avec FollowContext + Supabase KV
 */
import { useState } from "react";
import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { UserPlus, Check, UserMinus, Loader2 } from "lucide-react";
import { useFollow } from "../context/FollowContext";

interface FollowButtonProps {
  username: string;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
  stopPropagation?: boolean;
  /** Callback appelé après un toggle réussi */
  onToggled?: (nowFollowing: boolean) => void;
}

export function FollowButton({
  username,
  size = "sm",
  style,
  stopPropagation = true,
  onToggled,
}: FollowButtonProps) {
  const { isFollowing, toggleFollow, currentUserId } = useFollow();
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);

  // Ne jamais afficher sur soi-même
  if (!username || (currentUserId && username === currentUserId)) return null;

  const following = isFollowing(username);

  // ── Paddings selon taille ─────────────────────────────────────────────────
  const pad = size === "lg" ? "8px 18px" : size === "md" ? "6px 14px" : "4px 11px";
  const iconSz = size === "lg" ? 14 : size === "md" ? 12 : 11;
  const fontSize = size === "lg" ? 13 : size === "md" ? 12 : 11;

  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (loading) return;

    // Si déjà suivi → demander confirmation au premier tap, désabonner au second
    if (following) {
      if (!confirmUnfollow) {
        setConfirmUnfollow(true);
        // Reset auto après 2,5s si pas confirmé
        setTimeout(() => setConfirmUnfollow(false), 2500);
        return;
      }
      setConfirmUnfollow(false);
    }

    setLoading(true);
    try {
      await toggleFollow(username);
      onToggled?.(!following);
    } catch (err) {
      console.error("FollowButton: erreur toggle follow:", err);
    } finally {
      setLoading(false);
      setHovered(false);
    }
  };

  // ── État : NON SUIVI ──────────────────────────────────────────────────────
  if (!following) {
    return (
      <motion.button
        key="follow-btn"
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={loading ? {} : { scale: 0.91 }}
        disabled={loading}
        onClick={handleClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: iconSz - 4,
          padding: pad,
          borderRadius: 999,
          background: "rgba(255,255,255,0.93)",
          border: "none",
          color: "#111",
          cursor: loading ? "default" : "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
          ...style,
        }}
      >
        {loading ? (
          <Loader2 style={{ width: iconSz, height: iconSz, color: "#6366f1" }} className="animate-spin" />
        ) : (
          <>
            <span style={{ fontSize, fontWeight: 700 }}>+ Foradd</span>
          </>
        )}
      </motion.button>
    );
  }

  // ── État : SUIVI — avec confirmation désabonnement ────────────────────────
  const showUnfollowWarning = confirmUnfollow || (hovered && !confirmUnfollow);

  return (
    <motion.button
      key="following-btn"
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={loading ? {} : { scale: 0.93 }}
      disabled={loading}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: iconSz - 4,
        padding: pad,
        borderRadius: 999,
        cursor: loading ? "default" : "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "all 0.18s ease",
        background: confirmUnfollow
          ? "rgba(239,68,68,0.12)"
          : hovered
          ? "rgba(239,68,68,0.08)"
          : "rgba(99,102,241,0.14)",
        border: confirmUnfollow
          ? "1px solid rgba(239,68,68,0.38)"
          : hovered
          ? "1px solid rgba(239,68,68,0.25)"
          : "1px solid rgba(99,102,241,0.35)",
        ...style,
      }}
    >
      
        {loading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Loader2 style={{ width: iconSz, height: iconSz, color: "#818cf8" }} className="animate-spin" />
          </motion.span>
        ) : confirmUnfollow ? (
          <motion.span
            key="confirm"
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <UserMinus style={{ width: iconSz, height: iconSz, color: "#f87171" }} strokeWidth={2.5} />
            <span style={{ fontSize, fontWeight: 700, color: "#f87171" }}>Confirmer ?</span>
          </motion.span>
        ) : hovered ? (
          <motion.span
            key="unfollow-hover"
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <UserMinus style={{ width: iconSz, height: iconSz, color: "#fca5a5" }} strokeWidth={2.5} />
            <span style={{ fontSize, fontWeight: 700, color: "#fca5a5" }}>Se désabonner</span>
          </motion.span>
        ) : (
          <motion.span
            key="following"
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Check style={{ width: iconSz, height: iconSz, color: "#818cf8" }} strokeWidth={2.5} />
            <span style={{ fontSize, fontWeight: 700, color: "#818cf8" }}>Suivi</span>
          </motion.span>
        )}
      
    </motion.button>
  );
}