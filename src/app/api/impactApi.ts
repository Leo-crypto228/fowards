import { projectId, publicAnonKey } from "/utils/supabase/info";
import { getGrade } from "../utils/grade";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

export interface ImpactResult {
  score: number;
  grade: string;
}

/** Appeler à chaque session (connexion quotidienne) : +1 Impact/jour, max 7/semaine */
export async function dailyLoginImpact(userId: string): Promise<ImpactResult> {
  try {
    const res = await fetch(`${BASE}/impact/daily-login`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("dailyLoginImpact error:", e);
    return { score: 0, grade: "Membre" };
  }
}

/** Récupère le score et grade courant d'un utilisateur */
export async function getImpactScore(userId: string): Promise<ImpactResult> {
  try {
    const res = await fetch(`${BASE}/impact/${encodeURIComponent(userId)}`, {
      headers: HEADERS,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("getImpactScore error:", e);
    return { score: 0, grade: getGrade(0) };
  }
}
