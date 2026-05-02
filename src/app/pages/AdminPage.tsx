/**
 * AdminPage — Outil de nettoyage des données FuturFeed (dev only)
 * Wizard 4 étapes : Configure → Audit → Confirmation → Résultats
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft, ChevronRight, ShieldAlert, Users, FileText,
  MessageSquare, HardDrive, Key, Trash2, CheckCircle2,
  Loader2, AlertTriangle, RotateCcw, X, Plus, Sparkles, RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileEntry {
  username: string;
  name: string;
  supabaseId?: string;
  postsCount: number;
  msgsCount: number;
  filesCount: number;
}
interface AuthUser { id: string; email: string; username: string; createdAt: string }
interface StorageEntry { username: string; files: number }
interface Totals { profiles: number; posts: number; communityPosts: number; communityMessages: number; storageFiles: number; authUsers: number }
interface Inventory { profiles: ProfileEntry[]; authUsers: AuthUser[]; storageByUser: StorageEntry[]; totals: Totals }
interface PurgeReport {
  deletedProfiles: number; keptProfiles: number;
  deletedPosts: number; keptPosts: number;
  deletedCommunityMessages: number; deletedCommunityPosts: number;
  deletedFollowLinks: number; deletedMemberships: number;
  deletedAuthUsers: number; deletedStorageFiles: number;
  errors: string[];
}
interface SeedReport { profilesSeeded: number; postsSeeded: number; followsSeeded: number; progressSeeded: number; errors: string[] }

type Step = "configure" | "audit" | "confirm" | "done";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const glass = (extra = "") =>
  `backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl ${extra}`;

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${color}22`, color, border: `0.5px solid ${color}55` }}>
      {children}
    </span>
  );
}

function StatRow({ label, value, sub, danger }: { label: string; value: number; sub?: string; danger?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.50)" }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: danger ? "#f87171" : "#e0e0ef" }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminPage() {
  const navigate = useNavigate();

  const [step, setStep]             = useState<Step>("configure");
  const [keepUsers, setKeepUsers]   = useState<string[]>(["leo", ""]);
  const [newUser, setNewUser]       = useState("");
  const [inventory, setInventory]   = useState<Inventory | null>(null);
  const [purgeResult, setPurgeResult] = useState<PurgeReport | null>(null);
  const [loading, setLoading]       = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult]   = useState<SeedReport | null>(null);
  const [seedError, setSeedError]     = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [confirmed, setConfirmed]   = useState(false);

  const validKeepUsers = keepUsers.map(u => u.trim().toLowerCase()).filter(Boolean);

  const runSeed = useCallback(async (force = false) => {
    setSeedLoading(true);
    setSeedError(null);
    setSeedResult(null);
    try {
      const res = await fetch(`${BASE}/admin/seed-fictional`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      if (data.alreadyDone) {
        setSeedError("Déjà seedé — utilise 'Re-seeder' pour forcer.");
        return;
      }
      setSeedResult(data.report as SeedReport);
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : String(e));
    } finally {
      setSeedLoading(false);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/admin/inventory`, { headers: HEADERS });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      setInventory(data as Inventory);
      setStep("audit");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const runPurge = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/admin/purge`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ keepUsers: validKeepUsers }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Erreur serveur");
      setPurgeResult(data.report as PurgeReport);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [validKeepUsers]);

  const toDelete = inventory
    ? inventory.profiles.filter((p) => !validKeepUsers.includes(p.username))
    : [];
  const toKeep = inventory
    ? inventory.profiles.filter((p) => validKeepUsers.includes(p.username))
    : [];

  return (
    <div style={{ minHeight: "100vh", background: "#060612", color: "#e0e0ef", fontFamily: "system-ui, sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", gap: 12, maxWidth: 480, margin: "0 auto" }}>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <ChevronLeft size={16} color="rgba(255,255,255,0.7)" />
        </motion.button>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={14} color="#fbbf24" />
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Administration</h1>
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", margin: 0 }}>Nettoyage base de données — dev only</p>
        </div>
      </div>

      {/* ── Stepper ── */}
      <div style={{ maxWidth: 480, margin: "20px auto 0", padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
          {(["configure", "audit", "confirm", "done"] as Step[]).map((s, i) => {
            const steps: Step[] = ["configure", "audit", "confirm", "done"];
            const idx   = steps.indexOf(step);
            const sIdx  = i;
            const done  = sIdx < idx;
            const active = s === step;
            const labels = ["Configurer", "Audit", "Confirmer", "Résultats"];
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: active ? "#6366f1" : done ? "#22c55e" : "rgba(255,255,255,0.07)",
                    border: active ? "none" : done ? "none" : "0.5px solid rgba(255,255,255,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: (active || done) ? "#fff" : "rgba(255,255,255,0.25)",
                    transition: "all 0.2s",
                  }}>
                    {done ? <CheckCircle2 size={12} /> : i + 1}
                  </div>
                  <span style={{ fontSize: 10, color: active ? "#a5b4fc" : "rgba(255,255,255,0.25)", whiteSpace: "nowrap" }}>{labels[i]}</span>
                </div>
                {i < 3 && <div style={{ height: 1, flex: 1, background: done ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.07)", margin: "0 6px", marginBottom: 18 }} />}
              </div>
            );
          })}
        </div>

        {/* ── Error ── */}
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.30)", borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, color: "#fca5a5", margin: 0, fontWeight: 600 }}>Erreur</p>
              <p style={{ fontSize: 12, color: "rgba(252,165,165,0.75)", margin: "2px 0 0" }}>{error}</p>
            </div>
            <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "rgba(252,165,165,0.5)" }}>
              <X size={12} />
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">

          {/* ════════════════════════════════════════════ STEP 1 : Configure */}
          {step === "configure" && (
            <motion.div key="configure" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className={glass("p-5 mb-4")}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#c7d2fe", marginBottom: 4 }}>
                  Utilisateurs à CONSERVER
                </p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 16, lineHeight: 1.5 }}>
                  Tous les autres comptes et leurs données seront définitivement supprimés.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {keepUsers.map((u, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: i === 0 ? "rgba(99,102,241,0.20)" : "rgba(139,92,246,0.20)", border: `0.5px solid ${i === 0 ? "#6366f1" : "#8b5cf6"}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Key size={12} color={i === 0 ? "#818cf8" : "#a78bfa"} />
                      </div>
                      <input
                        value={u}
                        onChange={(e) => {
                          const next = [...keepUsers];
                          next[i] = e.target.value.toLowerCase().replace(/\s/g, "");
                          setKeepUsers(next);
                        }}
                        placeholder={i === 0 ? "ton username (ex: leo)" : "2ème compte (ex: testuser)"}
                        style={{
                          flex: 1, padding: "9px 12px", borderRadius: 10, fontSize: 13,
                          background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.12)",
                          color: "#e0e0ef", outline: "none",
                        }}
                      />
                      {i === 0 && (
                        <div style={{ width: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Tag color="#6366f1">Toi</Tag>
                        </div>
                      )}
                      {i > 0 && (
                        <button
                          onClick={() => setKeepUsers(keepUsers.filter((_, idx) => idx !== i))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", padding: 4 }}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  {keepUsers.length < 5 && (
                    <button
                      onClick={() => setKeepUsers([...keepUsers, ""])}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "0.5px dashed rgba(255,255,255,0.15)", borderRadius: 10, cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                      <Plus size={12} /> Ajouter un utilisateur
                    </button>
                  )}
                </div>
              </div>

              {/* ── Section Seed comptes fictifs ───────────────────────── */}
              <div className={glass("p-5 mb-4")}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Sparkles size={13} color="#a78bfa" />
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#c4b5fd", margin: 0 }}>Seed comptes fictifs</p>
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14, lineHeight: 1.5 }}>
                  Crée 26 profils fictifs dans Supabase KV avec leurs posts, follows, streak et fcoins. Idempotent — safe à relancer.
                </p>
                {seedError && (
                  <div style={{ background: "rgba(239,68,68,0.07)", border: "0.5px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "#fca5a5" }}>
                    {seedError}
                  </div>
                )}
                {seedResult && (
                  <div style={{ background: "rgba(16,185,129,0.07)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6ee7b7", margin: "0 0 6px" }}>✓ Seed terminé !</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {[["Profils", seedResult.profilesSeeded], ["Posts", seedResult.postsSeeded], ["Follows", seedResult.followsSeeded], ["Progression", seedResult.progressSeeded]].map(([label, val]) => (
                        <span key={String(label)} style={{ fontSize: 11, color: "rgba(110,231,183,0.75)", background: "rgba(16,185,129,0.10)", borderRadius: 6, padding: "2px 8px" }}>
                          {label} : <strong>{val}</strong>
                        </span>
                      ))}
                    </div>
                    {seedResult.errors.length > 0 && <p style={{ fontSize: 11, color: "rgba(251,191,36,0.60)", margin: "6px 0 0" }}>{seedResult.errors.length} erreur(s) non bloquante(s)</p>}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    disabled={seedLoading}
                    onClick={() => runSeed(false)}
                    style={{ flex: 2, padding: "10px", borderRadius: 11, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 3px 14px rgba(124,58,237,0.35)" }}>
                    {seedLoading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
                    Seed fictifs
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    disabled={seedLoading}
                    onClick={() => runSeed(true)}
                    style={{ flex: 1, padding: "10px", borderRadius: 11, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.50)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <RefreshCw size={12} /> Re-seed
                  </motion.button>
                </div>
              </div>

              {/* Warning */}
              <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: "rgba(251,191,36,0.05)", border: "0.5px solid rgba(251,191,36,0.20)", borderRadius: 12, marginBottom: 20 }}>
                <AlertTriangle size={13} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "rgba(251,191,36,0.70)", margin: 0, lineHeight: 1.5 }}>
                  Cet outil supprimera irrémédiablement : profils KV, posts, commentaires, réactions, messages de communauté, abonnements, données de progression, comptes Supabase Auth et fichiers Storage.
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={validKeepUsers.length === 0 || loading}
                onClick={fetchInventory}
                style={{
                  width: "100%", padding: "14px", borderRadius: 14, fontSize: 14, fontWeight: 700,
                  background: validKeepUsers.length > 0 ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.05)",
                  border: "none", color: validKeepUsers.length > 0 ? "#fff" : "rgba(255,255,255,0.20)",
                  cursor: validKeepUsers.length > 0 ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: validKeepUsers.length > 0 ? "0 4px 20px rgba(99,102,241,0.35)" : "none",
                }}
              >
                {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <><ChevronRight size={16} /> Lancer l'audit</>}
              </motion.button>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════ STEP 2 : Audit */}
          {step === "audit" && inventory && (
            <motion.div key="audit" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {/* Totaux globaux */}
              <div className={glass("p-5 mb-4")}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#c7d2fe", marginBottom: 12 }}>Contenu total dans la base</p>
                <StatRow label="Profils KV" value={inventory.totals.profiles} />
                <StatRow label="Comptes Auth" value={inventory.totals.authUsers} />
                <StatRow label="Posts feed" value={inventory.totals.posts} />
                <StatRow label="Posts communautaires" value={inventory.totals.communityPosts} />
                <StatRow label="Messages communauté" value={inventory.totals.communityMessages} />
                <StatRow label="Fichiers Storage" value={inventory.totals.storageFiles} />
              </div>

              {/* Utilisateurs conservés */}
              <div className={glass("p-5 mb-4")}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <CheckCircle2 size={13} color="#34d399" />
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#6ee7b7", margin: 0 }}>
                    Conservés ({toKeep.length})
                  </p>
                </div>
                {toKeep.length === 0 && (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", fontStyle: "italic" }}>
                    Aucun profil conservé trouvé dans la base.
                  </p>
                )}
                {toKeep.map((p) => {
                  const auth = inventory.authUsers.find((a) => a.username === p.username);
                  return (
                    <div key={p.username} style={{ padding: "8px 0", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#d1d5e0" }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginLeft: 6 }}>@{p.username}</span>
                        </div>
                        <Tag color="#34d399">CONSERVÉ</Tag>
                      </div>
                      {auth && <p style={{ fontSize: 11, color: "rgba(99,102,241,0.70)", margin: "2px 0 0" }}>{auth.email}</p>}
                      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>{p.postsCount} posts · {p.msgsCount} messages · {p.filesCount} fichiers</span>
                      </div>
                    </div>
                  );
                })}
                {/* Utilisateurs dans keepUsers mais pas encore dans la base */}
                {validKeepUsers.filter((u) => !toKeep.find((p) => p.username === u)).map((u) => (
                  <div key={u} style={{ padding: "8px 0", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", fontStyle: "italic" }}>@{u} (non trouvé en base)</span>
                      <Tag color="#fbbf24">ATTENDU</Tag>
                    </div>
                  </div>
                ))}
              </div>

              {/* Utilisateurs supprimés */}
              <div className={glass("p-5 mb-4")}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <Trash2 size={13} color="#f87171" />
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5", margin: 0 }}>
                    À supprimer ({toDelete.length})
                  </p>
                </div>
                {toDelete.length === 0 && (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.30)", fontStyle: "italic" }}>
                    Aucun profil à supprimer.
                  </p>
                )}
                {toDelete.map((p) => {
                  const auth = inventory.authUsers.find((a) => a.username === p.username);
                  return (
                    <div key={p.username} style={{ padding: "8px 0", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#d1d5e0", textDecoration: "line-through", opacity: 0.6 }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", marginLeft: 6 }}>@{p.username}</span>
                        </div>
                        <Tag color="#f87171">SUPPRIMÉ</Tag>
                      </div>
                      {auth && <p style={{ fontSize: 11, color: "rgba(248,113,113,0.60)", margin: "2px 0 0" }}>{auth.email}</p>}
                      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: "rgba(248,113,113,0.50)" }}>{p.postsCount} posts · {p.msgsCount} messages · {p.filesCount} fichiers</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comptes Auth sans profil KV */}
              {inventory.authUsers.filter((a) => !inventory.profiles.find((p) => p.username === a.username)).length > 0 && (
                <div className={glass("p-5 mb-4")}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <Key size={13} color="#fb923c" />
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#fdba74", margin: 0 }}>Comptes Auth orphelins (sans profil KV)</p>
                  </div>
                  {inventory.authUsers
                    .filter((a) => !inventory.profiles.find((p) => p.username === a.username) && !validKeepUsers.includes(a.username))
                    .map((a) => (
                      <div key={a.id} style={{ padding: "6px 0", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ fontSize: 12, color: "rgba(253,186,116,0.60)" }}>@{a.username} — {a.email}</span>
                        <Tag color="#f87171">SUPPRIMÉ</Tag>
                      </div>
                    ))
                  }
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setStep("configure")}
                  style={{ flex: 1, padding: "13px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  ← Modifier
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setStep("confirm")}
                  style={{ flex: 2, padding: "13px", borderRadius: 14, background: "linear-gradient(135deg,#ef4444,#dc2626)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px rgba(239,68,68,0.30)" }}>
                  <Trash2 size={15} /> Continuer
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════ STEP 3 : Confirm */}
          {step === "confirm" && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div style={{ background: "rgba(239,68,68,0.06)", border: "0.5px solid rgba(239,68,68,0.25)", borderRadius: 18, padding: "20px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <AlertTriangle size={15} color="#f87171" />
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#fca5a5", margin: 0 }}>Action irréversible</p>
                </div>
                <p style={{ fontSize: 13, color: "rgba(252,165,165,0.75)", margin: 0, lineHeight: 1.6 }}>
                  Cette opération va supprimer <strong style={{ color: "#f87171" }}>{toDelete.length} profil(s)</strong> et tout leur contenu associé directement dans Supabase. Il n'y a pas de retour en arrière possible.
                </p>
              </div>

              {/* Récap des utilisateurs conservés */}
              <div className={glass("p-4 mb-4")}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#6ee7b7", marginBottom: 8 }}>Comptes qui seront CONSERVÉS :</p>
                {validKeepUsers.map((u) => (
                  <div key={u} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <CheckCircle2 size={12} color="#34d399" />
                    <span style={{ fontSize: 13, color: "#d1d5e0", fontWeight: 600 }}>@{u}</span>
                  </div>
                ))}
              </div>

              {/* Checkbox */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 20 }}>
                <div
                  onClick={() => setConfirmed(v => !v)}
                  style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, border: confirmed ? "none" : "1.5px solid rgba(255,255,255,0.20)", background: confirmed ? "#ef4444" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", cursor: "pointer" }}>
                  {confirmed && <CheckCircle2 size={13} color="#fff" />}
                </div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                  Je comprends que cette suppression est définitive et que les données ne pourront pas être récupérées.
                </span>
              </label>

              <div style={{ display: "flex", gap: 10 }}>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setStep("audit")}
                  style={{ flex: 1, padding: "13px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  ← Retour
                </motion.button>
                <motion.button
                  whileTap={confirmed && !loading ? { scale: 0.96 } : {}}
                  disabled={!confirmed || loading}
                  onClick={runPurge}
                  style={{ flex: 2, padding: "13px", borderRadius: 14, background: confirmed ? "linear-gradient(135deg,#ef4444,#b91c1c)" : "rgba(255,255,255,0.04)", border: confirmed ? "none" : "0.5px solid rgba(255,255,255,0.08)", color: confirmed ? "#fff" : "rgba(255,255,255,0.20)", fontSize: 14, fontWeight: 700, cursor: confirmed && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: confirmed ? "0 4px 24px rgba(239,68,68,0.35)" : "none", transition: "all 0.2s" }}>
                  {loading
                    ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Purge en cours…</>
                    : <><Trash2 size={15} /> Lancer la purge</>
                  }
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════ STEP 4 : Done */}
          {step === "done" && purgeResult && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <div style={{ background: "rgba(16,185,129,0.07)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 18, padding: "20px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <CheckCircle2 size={18} color="#34d399" />
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#6ee7b7", margin: 0 }}>Purge terminée !</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  <StatRow label="Profils supprimés" value={purgeResult.deletedProfiles} danger />
                  <StatRow label="Profils conservés" value={purgeResult.keptProfiles} />
                  <StatRow label="Posts feed supprimés" value={purgeResult.deletedPosts} danger />
                  <StatRow label="Posts feed conservés" value={purgeResult.keptPosts} />
                  <StatRow label="Messages communauté supprimés" value={purgeResult.deletedCommunityMessages} danger />
                  <StatRow label="Posts communauté supprimés" value={purgeResult.deletedCommunityPosts} danger />
                  <StatRow label="Liens follow supprimés" value={purgeResult.deletedFollowLinks} danger />
                  <StatRow label="Memberships supprimés" value={purgeResult.deletedMemberships} danger />
                  <StatRow label="Comptes Auth supprimés" value={purgeResult.deletedAuthUsers} danger />
                  <StatRow label="Fichiers Storage supprimés" value={purgeResult.deletedStorageFiles} danger />
                </div>
              </div>

              {purgeResult.errors.length > 0 && (
                <div style={{ background: "rgba(251,191,36,0.06)", border: "0.5px solid rgba(251,191,36,0.20)", borderRadius: 12, padding: "14px", marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>⚠ Erreurs non bloquantes ({purgeResult.errors.length})</p>
                  {purgeResult.errors.map((e, i) => (
                    <p key={i} style={{ fontSize: 11, color: "rgba(251,191,36,0.60)", margin: "2px 0", fontFamily: "monospace" }}>{e}</p>
                  ))}
                </div>
              )}

              <motion.button whileTap={{ scale: 0.96 }} onClick={() => navigate(-1)}
                style={{ width: "100%", padding: "13px", borderRadius: 14, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(99,102,241,0.30)" }}>
                Retour à l'app
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>

        {/* SQL Script */}
        <div style={{ marginTop: 24, padding: "14px", background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)", borderRadius: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Script SQL Supabase (optionnel)
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "0 0 8px", lineHeight: 1.5 }}>
            Si des comptes Auth restent après la purge, exécute ce script dans le SQL Editor de Supabase :
          </p>
          <pre style={{ fontSize: 10, color: "rgba(165,180,252,0.60)", background: "rgba(0,0,0,0.30)", borderRadius: 8, padding: "10px 12px", margin: 0, overflowX: "auto", whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.6 }}>
{`-- Voir tous les utilisateurs Auth
SELECT id, email,
  raw_user_meta_data->>'username' as username,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- Supprimer tous SAUF tes comptes (adapter les emails)
DELETE FROM auth.users
WHERE email NOT IN (
  'ton.email@example.com',
  'compte.test@example.com'
);`}
          </pre>
        </div>

        <div style={{ height: 48 }} />
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}