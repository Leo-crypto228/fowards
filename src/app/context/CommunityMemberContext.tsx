import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  toggleCommunityMembership,
  getBatchCommunityStatus,
  getUserCommunities,
} from "../api/communityMembersApi";
import { useAuth } from "./AuthContext";

// IDs des communautés de l'app
const ALL_COMMUNITY_IDS = ["1", "2", "3", "4", "5"];

interface CommunityMemberContextValue {
  isMember: (communityId: string) => boolean;
  toggleMembership: (communityId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  loading: boolean;
  getMemberCount: (communityId: string) => number | null;
}

const CommunityMemberContext = createContext<CommunityMemberContextValue>({
  isMember: () => false,
  toggleMembership: async () => false,
  refresh: async () => {},
  loading: true,
  getMemberCount: () => null,
});

export function CommunityMemberProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.username ?? "";

  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const pendingRef = useRef<Set<string>>(new Set());
  const prevUserIdRef = useRef("");

  const refresh = useCallback(async (uid?: string) => {
    const effectiveId = uid ?? userId;
    if (!effectiveId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [communityIds, batchStatuses] = await Promise.all([
        getUserCommunities(effectiveId).catch(() => [] as string[]),
        getBatchCommunityStatus(effectiveId, ALL_COMMUNITY_IDS).catch(() => ({} as Record<string, boolean>)),
      ]);
      const merged: Record<string, boolean> = { ...batchStatuses };
      for (const id of communityIds) merged[id] = true;
      setStatuses(merged);
    } catch (err) {
      console.error("Erreur chargement memberships communautés:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Recharger quand l'user change
  useEffect(() => {
    if (!userId || userId === prevUserIdRef.current) return;
    prevUserIdRef.current = userId;
    refresh(userId);
  }, [userId, refresh]);

  const isMember = useCallback(
    (communityId: string) => statuses[communityId] === true,
    [statuses]
  );

  const toggleMembership = useCallback(
    async (communityId: string): Promise<boolean> => {
      if (!userId) return false;
      if (pendingRef.current.has(communityId)) return statuses[communityId] ?? false;
      pendingRef.current.add(communityId);

      const prevValue = statuses[communityId] ?? false;
      // Optimistic: increment/decrement count
      setStatuses((s) => ({ ...s, [communityId]: !prevValue }));
      setMemberCounts((c) => ({ ...c, [communityId]: (c[communityId] ?? 0) + (prevValue ? -1 : 1) }));

      try {
        const { isMember: newState, memberCount } = await toggleCommunityMembership(userId, communityId);
        setStatuses((s) => ({ ...s, [communityId]: newState }));
        if (typeof memberCount === "number") {
          setMemberCounts((c) => ({ ...c, [communityId]: memberCount }));
        }
        return newState;
      } catch (err) {
        console.error("Erreur toggle membership:", err);
        setStatuses((s) => ({ ...s, [communityId]: prevValue }));
        setMemberCounts((c) => ({ ...c, [communityId]: (c[communityId] ?? 0) + (prevValue ? 1 : -1) }));
        return prevValue;
      } finally {
        pendingRef.current.delete(communityId);
      }
    },
    [statuses, userId]
  );

  const getMemberCount = useCallback(
    (communityId: string): number | null =>
      memberCounts[communityId] !== undefined ? memberCounts[communityId] : null,
    [memberCounts]
  );

  return (
    <CommunityMemberContext.Provider value={{ isMember, toggleMembership, refresh, loading, getMemberCount }}>
      {children}
    </CommunityMemberContext.Provider>
  );
}

export function useCommunityMember() {
  return useContext(CommunityMemberContext);
}