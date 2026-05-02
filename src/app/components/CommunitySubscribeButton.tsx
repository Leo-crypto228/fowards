import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, UserPlus } from "lucide-react";
import { useCommunityMember } from "../context/CommunityMemberContext";
import { toast } from "sonner";

interface CommunitySubscribeButtonProps {
  communityId: string;
  communityName?: string;
  size?: "sm" | "md" | "lg";
  // Si true, stop la propagation (évite de naviguer vers la page quand le bouton est dans une carte)
  stopPropagation?: boolean;
}

export function CommunitySubscribeButton({
  communityId,
  communityName,
  size = "md",
  stopPropagation = true,
}: CommunitySubscribeButtonProps) {
  const { isMember, toggleMembership } = useCommunityMember();
  const [loading, setLoading] = useState(false);
  const [justJoined, setJustJoined] = useState(false);

  const member = isMember(communityId);

  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const newState = await toggleMembership(communityId);
      if (newState) {
        setJustJoined(true);
        toast.success(`Abonné à ${communityName ?? "la communauté"} !`, { duration: 2000 });
        setTimeout(() => setJustJoined(false), 2000);
      } else {
        toast(`Désabonné de ${communityName ?? "la communauté"}`, { duration: 1800 });
      }
    } catch {
      toast.error("Impossible de changer le statut.");
    } finally {
      setLoading(false);
    }
  };

  // Tailles
  const sizeStyles = {
    sm: { padding: "4px 12px", fontSize: 12, height: 28, gap: 5, iconSize: 12 },
    md: { padding: "6px 16px", fontSize: 13, height: 34, gap: 6, iconSize: 14 },
    lg: { padding: "10px 24px", fontSize: 15, height: 44, gap: 7, iconSize: 16 },
  }[size];

  return (
    <motion.button
      onClick={handleClick}
      whileTap={!loading ? { scale: 0.93 } : {}}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: sizeStyles.gap,
        padding: sizeStyles.padding,
        height: sizeStyles.height,
        borderRadius: 999,
        cursor: loading ? "default" : "pointer",
        flexShrink: 0,
        transition: "all 0.20s ease",
        // Style "boudin blanc" si non-membre, rempli si membre
        background: member
          ? "rgba(255,255,255,0.10)"
          : "rgba(255,255,255,0.95)",
        border: member
          ? "0.5px solid rgba(255,255,255,0.20)"
          : "1px solid rgba(255,255,255,0.90)",
        color: member
          ? "rgba(255,255,255,0.55)"
          : "#0a0a0a",
        fontWeight: 600,
        fontSize: sizeStyles.fontSize,
        opacity: loading ? 0.7 : 1,
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{ display: "flex", alignItems: "center", gap: sizeStyles.gap }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
              style={{
                width: sizeStyles.iconSize,
                height: sizeStyles.iconSize,
                border: "2px solid rgba(0,0,0,0.15)",
                borderTopColor: member ? "rgba(255,255,255,0.55)" : "#0a0a0a",
                borderRadius: "50%",
              }}
            />
          </motion.span>
        ) : justJoined ? (
          <motion.span
            key="joined"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{ display: "flex", alignItems: "center", gap: sizeStyles.gap }}
          >
            <Check style={{ width: sizeStyles.iconSize, height: sizeStyles.iconSize }} />
            Abonné !
          </motion.span>
        ) : member ? (
          <motion.span
            key="member"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ display: "flex", alignItems: "center", gap: sizeStyles.gap }}
          >
            <Check style={{ width: sizeStyles.iconSize, height: sizeStyles.iconSize }} />
            Abonné
          </motion.span>
        ) : (
          <motion.span
            key="join"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ display: "flex", alignItems: "center", gap: sizeStyles.gap }}
          >
            <UserPlus style={{ width: sizeStyles.iconSize, height: sizeStyles.iconSize }} />
            S'abonner
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
