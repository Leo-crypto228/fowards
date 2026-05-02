import { projectId, publicAnonKey } from "/utils/supabase/info";
import { fetchWithRetry } from "./fetchRetry";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreakData {
  userId: string;
  currentStreak: number;
  lastActiveDate: string;
  longestStreak: number;
  totalDaysActive: number;
  postedToday?: boolean;
  lastPostDate?: string;
}

export interface ProgressData {
  userId?: string;
  score: number;
  lastUpdate?: string;
}

export interface GoalData {
  id: string;
  title: string;
  description: string;
  progress: number; // 0–100+, peut dépasser 100 quand l'objectif est surpassé
  status: "en_cours" | "accompli";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  // Champs durée & scoring (nouveaux objectifs)
  duration_type?: string;      // ex: "3_mois"
  duration_days?: number;      // nb de jours associé
  progress_score?: number;     // points accumulés
  progress_max?: number;       // score cible = duration_days × 7
  progress_percentage?: number; // progress_score / progress_max (peut dépasser 1.0)
}

export interface ProgressReport {
  id: string;
  userId: string;
  goalId: string | null;
  responseText: string;
  analysis: {
    posScore: number;
    negScore: number;
    showsProgress: boolean;
    progressPoints: number;
  };
  createdAt: string;
}

export interface ProgressionState {
  streak: StreakData;
  fcoins: string[]; // liste des fcoin IDs gagnés
  fcoinDefs: Record<string, { category: string; name: string }>;
  progress: ProgressData;
  goals: GoalData[];
  stats: { postCount: number; followerCount: number; followingCount: number };
  recentActivity: Array<{ id: string; actionType: string; createdAt: string; data?: Record<string, unknown> }>;
}

// ─── API ──────────────────────────────────────────────────────────────────────

/** Checkin quotidien (connexion) */
export async function dailyCheckin(userId: string): Promise<{
  streak: StreakData; newFcoins: string[]; alreadyCheckedIn: boolean;
}> {
  const res = await fetch(`${BASE}/progression/checkin`, {
    method: "POST", headers: H, body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`Checkin error (${res.status})`);
  return res.json();
}

/** Checkin après publication d'un post */
export async function postCheckin(userId: string, postId?: string): Promise<{
  streak: StreakData; newFcoins: string[];
}> {
  const res = await fetch(`${BASE}/progression/post-checkin`, {
    method: "POST", headers: H, body: JSON.stringify({ userId, postId }),
  });
  if (!res.ok) throw new Error(`Post-checkin error (${res.status})`);
  return res.json();
}

/** Récupérer l'état complet de la progression */
export async function getProgression(userId: string): Promise<ProgressionState> {
  const res = await fetch(`${BASE}/progression/${encodeURIComponent(userId)}`, { headers: H });
  if (!res.ok) throw new Error(`Progression error (${res.status})`);
  return res.json();
}

/** Logger une activité */
export async function logActivity(userId: string, actionType: string, data?: Record<string, unknown>): Promise<{
  newScore: number; newFcoins: string[];
}> {
  const res = await fetch(`${BASE}/progression/activity`, {
    method: "POST", headers: H, body: JSON.stringify({ userId, actionType, data }),
  });
  if (!res.ok) throw new Error(`Activity error (${res.status})`);
  return res.json();
}

/** Créer ou mettre à jour un objectif personnel */
export async function upsertGoal(
  userId: string,
  payload: { goalId?: string; title?: string; description?: string; progress?: number; duration_type?: string }
): Promise<{ goals: GoalData[] }> {
  const res = await fetch(`${BASE}/progression/goals`, {
    method: "POST", headers: H, body: JSON.stringify({ userId, ...payload }),
  });
  if (!res.ok) throw new Error(`Goal error (${res.status})`);
  return res.json();
}

/** Récupérer les objectifs d'un utilisateur
 *  Retry automatique (x2) sur 503 avec backoff exponentiel. */
export async function getGoals(
  userId: string,
  _attempt = 0
): Promise<{ goals: GoalData[]; total: number; selectedGoalId?: string | null }> {
  const res = await fetch(`${BASE}/progression/${encodeURIComponent(userId)}/goals`, { headers: H });
  if (res.status === 503 && _attempt < 2) {
    await new Promise((r) => setTimeout(r, 400 * Math.pow(2, _attempt) + Math.random() * 100));
    return getGoals(userId, _attempt + 1);
  }
  if (!res.ok) throw new Error(`Goals error (${res.status})`);
  return res.json();
}

/** Activer un objectif comme objectif principal du profil */
export async function setActiveGoal(userId: string, goalId: string): Promise<{ selectedGoalId: string }> {
  const res = await fetch(`${BASE}/progression/goals/${encodeURIComponent(goalId)}/activate`, {
    method: "PUT", headers: H, body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`setActiveGoal error (${res.status})`);
  return res.json();
}

/** Supprimer un objectif (requiert au moins 2 objectifs) */
export async function deleteGoal(userId: string, goalId: string): Promise<{ goals: GoalData[] }> {
  const res = await fetch(`${BASE}/progression/goals/${encodeURIComponent(goalId)}`, {
    method: "DELETE", headers: H, body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Delete goal error (${res.status})`);
  }
  return res.json();
}

/** Envoyer un rapport de progression */
export async function submitProgressReport(
  userId: string,
  responseText: string,
  goalId?: string
): Promise<{
  report: ProgressReport;
  analysis: ProgressReport["analysis"];
  newProgressScore: number;
  goalProgress: number | null;
  goalCompleted: boolean;
}> {
  const res = await fetch(`${BASE}/progression/progress-report`, {
    method: "POST", headers: H, body: JSON.stringify({ userId, goalId, responseText }),
  });
  if (res.status === 429) {
    const data = await res.json();
    throw new Error(data.error ?? "Tu as déjà soumis ton avancement aujourd'hui.");
  }
  if (!res.ok) throw new Error(`Report error (${res.status})`);
  return res.json();
}

/** Récupérer les rapports de progression */
export async function getProgressReports(userId: string, limit = 5): Promise<{
  reports: ProgressReport[]; total: number;
}> {
  const res = await fetch(
    `${BASE}/progression/${encodeURIComponent(userId)}/reports?limit=${limit}`,
    { headers: H }
  );
  if (!res.ok) throw new Error(`Reports error (${res.status})`);
  return res.json();
}

// ── Chart & Extended Stats ────────────────────────────────────────────────────

export interface ChartPoint {
  label: string;
  value: number;
  date: string;
}

export interface ChartData {
  points: ChartPoint[];
  filter: string;
  total: number;
  accountStartDate: string | null;
}

/** Diagramme d'évolution depuis Supabase */
export async function getEvolutionChart(
  userId: string,
  filter: "all" | "30d" | "week" = "30d"
): Promise<ChartData> {
  const res = await fetch(
    `${BASE}/progression/${encodeURIComponent(userId)}/chart?filter=${filter}`,
    { headers: H }
  );
  if (!res.ok) throw new Error(`Chart error (${res.status})`);
  return res.json();
}

export interface ExtendedStats {
  goalsAccomplis: number;
  goalsEnCours: number;
  constanceActiveDays: number;
  constanceScore: number;
  constanceVariation: number;
  totalActions: number;
  daysOnFF: number;
  accountCreatedAt: string | null;
  progressScore: number;
  deepworkHours: number;
  streak: { currentStreak: number; longestStreak: number; totalDaysActive: number };
}

/** Stats étendues du profil (constance, objectifs, jours sur FF) */
export async function getExtendedStats(userId: string): Promise<ExtendedStats> {
  const res = await fetchWithRetry(
    `${BASE}/progression/${encodeURIComponent(userId)}/extended-stats`,
    { headers: H }
  );
  if (!res.ok) throw new Error(`Extended stats error (${res.status})`);
  return res.json();
}

/** Récupérer la progression de l'objectif principal de plusieurs utilisateurs */
export async function getBatchGoalProgress(
  usernames: string[]
): Promise<Record<string, { progress: number; title: string; goalId: string | null }>> {
  if (!usernames.length) return {};
  const param = usernames.map(encodeURIComponent).join(",");
  const res = await fetchWithRetry(`${BASE}/batch-goal-progress?usernames=${param}`, { headers: H });
  if (!res.ok) throw new Error(`Batch goal progress error (${res.status})`);
  return res.json();
}

export interface EarnedFcoinEntry {
  id: string;
  name: string;
  category: string;
  condition: string;
  earnedAt: string | null;
}

/** Récupérer les Fcoins gagnés */
export async function getEarnedFcoins(userId: string): Promise<{
  earned: string[];
  earnedHistory: EarnedFcoinEntry[];
  total: number;
  definitions: Record<string, { category: string; name: string }>;
}> {
  const res = await fetch(
    `${BASE}/progression/${encodeURIComponent(userId)}/fcoins`,
    { headers: H }
  );
  if (!res.ok) throw new Error(`Fcoins error (${res.status})`);
  return res.json();
}