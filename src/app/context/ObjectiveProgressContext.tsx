import {
  createContext, useContext, useState, useCallback,
  useEffect, type ReactNode,
} from "react";
import { getGoals, upsertGoal, setActiveGoal, type GoalData } from "../api/progressionApi";
import { MY_USER_ID, updateAuthUserField } from "../api/authStore";
import { invalidateProfile } from "../api/profileCache";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

// ─── Context value ─────────────────────────────────────────────────────────────

interface ObjectiveProgressValue {
  /** Objectif sélectionné (ou premier en_cours comme fallback) */
  primaryGoal: GoalData | null;
  /** Tous les objectifs de l'utilisateur */
  allGoals: GoalData[];
  /** ID de l'objectif sélectionné dans le KV */
  selectedGoalId: string | null;
  /** Progression de l'objectif principal — peut dépasser 100 si l'objectif est surpassé */
  primaryProgress: number;
  /** Titre de l'objectif principal */
  primaryTitle: string;
  loading: boolean;
  /** Met à jour la progression de l'objectif principal dans Supabase */
  updateProgress: (pct: number) => Promise<void>;
  /** Définit l'objectif actif affiché sur le profil */
  selectGoal: (goalId: string) => Promise<void>;
  /** Recharge les objectifs depuis Supabase */
  refresh: () => Promise<void>;
}

const ObjectiveProgressContext = createContext<ObjectiveProgressValue>({
  primaryGoal: null,
  allGoals: [],
  selectedGoalId: null,
  primaryProgress: 0,
  primaryTitle: "",
  loading: true,
  updateProgress: async () => {},
  selectGoal: async () => {},
  refresh: async () => {},
});

export function ObjectiveProgressProvider({ children }: { children: ReactNode }) {
  const [primaryGoal, setPrimaryGoal] = useState<GoalData | null>(null);
  const [allGoals, setAllGoals] = useState<GoalData[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!MY_USER_ID) { setLoading(false); return; }
    try {
      const { goals, selectedGoalId: kvSelected } = await getGoals(MY_USER_ID);
      setAllGoals(goals);
      setSelectedGoalId(kvSelected ?? null);

      // Choisir l'objectif actif : sélectionné dans KV, sinon premier en_cours, sinon premier
      const byId = kvSelected ? goals.find((g) => g.id === kvSelected) : null;
      const active = byId ?? goals.find((g) => g.status !== "accompli") ?? goals[0] ?? null;
      setPrimaryGoal(active);
    } catch (err) {
      console.error("ObjectiveProgressContext refresh erreur:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Décaler légèrement le chargement initial pour éviter le burst concurrent
    const timer = setTimeout(() => { refresh(); }, 300 + Math.random() * 200);
    return () => clearTimeout(timer);
  }, [refresh]);

  const updateProgress = useCallback(async (pct: number) => {
    if (!MY_USER_ID || !primaryGoal) return;
    // Pas de clamp supérieur — la progression peut dépasser 100%
    const clamped = Math.max(0, Math.round(pct));

    // Optimistic update
    setPrimaryGoal((prev) => prev ? { ...prev, progress: clamped } : prev);
    setAllGoals((prev) => prev.map((g) => g.id === primaryGoal.id ? { ...g, progress: clamped } : g));

    try {
      const { goals } = await upsertGoal(MY_USER_ID, {
        goalId: primaryGoal.id,
        progress: clamped,
      });
      setAllGoals(goals);
      const updated = goals.find((g) => g.id === primaryGoal.id);
      if (updated) setPrimaryGoal(updated);
    } catch (err) {
      console.error("ObjectiveProgressContext updateProgress erreur:", err);
      // Rollback
      setPrimaryGoal((prev) => prev ? { ...prev, progress: primaryGoal.progress } : prev);
    }
  }, [primaryGoal]);

  const selectGoal = useCallback(async (goalId: string) => {
    if (!MY_USER_ID) return;
    // Optimistic update
    const found = allGoals.find((g) => g.id === goalId);
    if (found) { setPrimaryGoal(found); setSelectedGoalId(goalId); }

    try {
      await setActiveGoal(MY_USER_ID, goalId);
      setSelectedGoalId(goalId);
      const goal = allGoals.find((g) => g.id === goalId);
      if (goal) {
        setPrimaryGoal(goal);
        // ── Sync profile.objective pour que le profil et les posts affichent le bon objectif ──
        await fetch(`${BASE}/profiles/${encodeURIComponent(MY_USER_ID)}`, {
          method: "PUT",
          headers: H,
          body: JSON.stringify({ objective: goal.title }),
        });
        // Mettre à jour l'authStore local + invalider le cache profil
        updateAuthUserField("objective", goal.title);
        invalidateProfile(MY_USER_ID);
      }
    } catch (err) {
      console.error("ObjectiveProgressContext selectGoal erreur:", err);
    }
  }, [allGoals]);

  const primaryProgress = primaryGoal?.progress ?? 0;
  const primaryTitle = primaryGoal?.title ?? "";

  return (
    <ObjectiveProgressContext.Provider value={{
      primaryGoal,
      allGoals,
      selectedGoalId,
      primaryProgress,
      primaryTitle,
      loading,
      updateProgress,
      selectGoal,
      refresh,
    }}>
      {children}
    </ObjectiveProgressContext.Provider>
  );
}

export function useObjectiveProgress() {
  return useContext(ObjectiveProgressContext);
}
