import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HDR = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

// ── Cash investis ─────────────────────────────────────────────────────────────

export async function getCash(userId: string): Promise<number> {
  const res = await fetch(`${BASE}/user-stats/cash/${encodeURIComponent(userId)}`, { headers: HDR });
  if (!res.ok) { console.error("getCash error", res.status); return 0; }
  const data = await res.json();
  return data.cash ?? 0;
}

/**
 * Applique un delta signé (+/-) au cash total — retourne le nouveau total.
 * Le plancher est 0 (géré côté serveur).
 */
export async function updateCash(userId: string, delta: number): Promise<number> {
  const res = await fetch(`${BASE}/user-stats/cash/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: HDR,
    body: JSON.stringify({ amount: delta }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`updateCash error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.cash ?? 0;
}

/** @deprecated use updateCash */
export async function addCash(userId: string, amount: number): Promise<number> {
  return updateCash(userId, amount);
}

// ── Heures investies ──────────────────────────────────────────────────────────

export async function getHours(userId: string): Promise<number> {
  const res = await fetch(`${BASE}/user-stats/hours/${encodeURIComponent(userId)}`, { headers: HDR });
  if (!res.ok) { console.error("getHours error", res.status); return 0; }
  const data = await res.json();
  return data.hours ?? 0;
}

/**
 * Applique un delta signé (+/-) aux heures totales — retourne le nouveau total.
 * Le plancher est 0 (géré côté serveur).
 */
export async function updateHours(userId: string, delta: number): Promise<number> {
  const res = await fetch(`${BASE}/user-stats/hours/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: HDR,
    body: JSON.stringify({ amount: delta }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`updateHours error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.hours ?? 0;
}

/** @deprecated use updateHours */
export async function addHours(userId: string, amount: number): Promise<number> {
  return updateHours(userId, amount);
}
