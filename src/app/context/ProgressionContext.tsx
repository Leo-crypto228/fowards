import {
  createContext, useContext, useState, useCallback,
  useEffect, useRef, type ReactNode,
} from "react";
import {
  getProgression, dailyCheckin, logActivity as apiLogActivity,
  type ProgressionState, type StreakData, type GoalData,
} from "../api/progressionApi";
import { MY_USER_ID } from "../api/authStore";

// ─── Context value ─────────────────────────────────────────────────────────────

interface ProgressionContextValue {
  // State
  streak: StreakData | null;
  earnedFcoins: string[];
  progressScore: number;
  goals: GoalData[];
  loading: boolean;
  // Actions
  refresh: () => Promise<void>;
  triggerActivity: (actionType: string, data?: Record<string, unknown>) => Promise<void>;
  addNewFcoins: (ids: string[]) => void;
  updateStreak: (s: StreakData) => void;
  // Notification state
  newFcoinNotification: string | null;
  clearNotification: () => void;
}

const ProgressionContext = createContext<ProgressionContextValue>({
  streak: null, earnedFcoins: [], progressScore: 0, goals: [], loading: true,
  refresh: async () => {}, triggerActivity: async () => {}, addNewFcoins: () => {},
  updateStreak: () => {}, newFcoinNotification: null, clearNotification: () => {},
});

export function ProgressionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [newFcoinNotification, setNewFcoinNotification] = useState<string | null>(null);
  const checkinDone = useRef(false);

  const refresh = useCallback(async () => {
    if (!MY_USER_ID) return; // guard: auth not ready yet
    try {
      const data = await getProgression(MY_USER_ID);
      setState(data);
    } catch (err) {
      console.error("Erreur chargement progression:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger + checkin au démarrage
  useEffect(() => {
    if (!MY_USER_ID) { setLoading(false); return; } // guard: not yet authenticated
    refresh().then(async () => {
      if (!checkinDone.current) {
        checkinDone.current = true;
        try {
          const result = await dailyCheckin(MY_USER_ID);
          const newFcoins: string[] = result?.newFcoins ?? [];
          const alreadyCheckedIn: boolean = result?.alreadyCheckedIn ?? false;
          if (!alreadyCheckedIn) {
            await refresh();
          }
          if (newFcoins.length > 0) {
            setNewFcoinNotification(newFcoins[newFcoins.length - 1]);
          }
        } catch (err) {
          console.error("Erreur checkin:", err);
        }
      }
    });
  }, [refresh]);

  const triggerActivity = useCallback(async (actionType: string, data?: Record<string, unknown>) => {
    try {
      const { newFcoins } = await apiLogActivity(MY_USER_ID, actionType, data);
      if (newFcoins?.length > 0) {
        setNewFcoinNotification(newFcoins[newFcoins.length - 1]);
        await refresh();
      }
    } catch (err) {
      console.error("Erreur log activité:", err);
    }
  }, [refresh]);

  const addNewFcoins = useCallback((ids: string[]) => {
    if (ids.length > 0) {
      setNewFcoinNotification(ids[ids.length - 1]);
      setState((prev) => prev ? { ...prev, fcoins: [...new Set([...prev.fcoins, ...ids])] } : prev);
    }
  }, []);

  const updateStreak = useCallback((s: StreakData) => {
    setState((prev) => prev ? { ...prev, streak: s } : prev);
  }, []);

  const clearNotification = useCallback(() => setNewFcoinNotification(null), []);

  return (
    <ProgressionContext.Provider value={{
      streak: state?.streak ?? null,
      earnedFcoins: state?.fcoins ?? [],
      progressScore: state?.progress?.score ?? 0,
      goals: state?.goals ?? [],
      loading,
      refresh,
      triggerActivity,
      addNewFcoins,
      updateStreak,
      newFcoinNotification,
      clearNotification,
    }}>
      {children}
    </ProgressionContext.Provider>
  );
}

export function useProgression() {
  return useContext(ProgressionContext);
}