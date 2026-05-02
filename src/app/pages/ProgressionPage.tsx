import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Send, Loader2, Check, TrendingUp,
  Trophy, Target, RefreshCw, ChevronRight, Lock, Clock, Sparkles,
  X, Trash2, Crown,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useFollow } from "../context/FollowContext";
import {
  submitProgressReport, getProgression, getProgressReports,
  upsertGoal, deleteGoal, type GoalData, type ProgressReport,
  getEvolutionChart, type ChartPoint,
} from "../api/progressionApi";
import { useProgression } from "../context/ProgressionContext";
import { useObjectiveProgress } from "../context/ObjectiveProgressContext";
import { toast } from "sonner";

import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

// ─── Mini SVG Area Chart (no recharts — avoids internal key conflicts) ────────

function MiniEvoChart({ data, fallbackValue }: { data: ChartPoint[]; fallbackValue: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const height = 100;
  const padL = 4, padR = 4, padT = 6, padB = 22;

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(containerRef.current);
    setWidth(containerRef.current.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const pts: { label: string; value: number }[] =
    data.length >= 1
      ? (data.length === 1 ? [{ label: data[0].label, value: 0 }, data[0]] : data)  // 1 pt → plateau
      : [{ label: "J0", value: 0 }, { label: "Auj.", value: 0 }];                   // vide → plat à 0

  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const values = pts.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const toX = (i: number) => padL + (i / Math.max(1, pts.length - 1)) * innerW;
  const toY = (v: number) => padT + innerH - ((v - minV) / range) * innerH;

  const linePoints = pts.map((d, i) => `${toX(i)},${toY(d.value)}`).join(" ");
  const areaPoints = [
    `${toX(0)},${padT + innerH}`,
    ...pts.map((d, i) => `${toX(i)},${toY(d.value)}`),
    `${toX(pts.length - 1)},${padT + innerH}`,
  ].join(" ");

  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left - padL;
    const ci = Math.max(0, Math.min(pts.length - 1, Math.round((mx / innerW) * (pts.length - 1))));
    setTooltip({ x: toX(ci), y: toY(pts[ci].value), label: pts[ci].label, value: pts[ci].value });
  };

  const labelIndices = new Set([0, pts.length - 1]);
  if (pts.length > 4) labelIndices.add(Math.floor(pts.length / 2));

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <svg width={width} height={height} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} style={{ overflow: "visible" }}>
        {[0, 50, 100].map((pct) => {
          const y = padT + innerH - ((pct - minV) / range) * innerH;
          if (y < padT || y > padT + innerH) return null;
          return (
            <line key={`grid-${pct}`} x1={padL} x2={padL + innerW} y1={y} y2={y}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          );
        })}
        <polygon points={areaPoints} fill="#6366f1" fillOpacity={0.15} />
        <polyline points={linePoints} fill="none" stroke="#818cf8" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 5px rgba(99,102,241,0.65))" }} />
        {pts.map((d, i) =>
          labelIndices.has(i) ? (
            <text key={`lbl-${i}`} x={toX(i)} y={height - 4} textAnchor="middle"
              fontSize={9} fill="rgba(144,144,168,0.40)">{d.label}</text>
          ) : null
        )}
        {tooltip && (
          <>
            <circle cx={tooltip.x} cy={tooltip.y} r={4} fill="#818cf8"
              stroke="rgba(129,140,248,0.30)" strokeWidth={4} />
            <rect x={Math.min(tooltip.x - 24, width - 58)} y={tooltip.y - 32}
              width={48} height={20} rx={6}
              fill="rgba(10,10,20,0.92)" stroke="rgba(99,102,241,0.30)" strokeWidth={0.5} />
            <text x={Math.min(tooltip.x - 24, width - 58) + 24} y={tooltip.y - 18}
              textAnchor="middle" fontSize={10} fontWeight="600" fill="#a5b4fc">
              {tooltip.value}%
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, color }: {
  label: string; value: string | number; color: string;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
      padding: "14px 10px", borderRadius: 18, flex: 1,
      background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: "-0.5px", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(144,144,168,0.50)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center", lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

function StreakStatCell({ value }: { value: number }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      padding: "12px 10px", borderRadius: 18, flex: 1,
      background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)",
    }}>
      <StreakBadge value={value} />
    </div>
  );
}

function ProgressBar({ pct, color = "#6366f1", animated = true }: { pct: number; color?: string; animated?: boolean }) {
  // Échelle dynamique : si pct > 100, compresser pour rester dans la barre
  const dynamicMax = pct <= 100 ? 100 : Math.ceil(pct / 100) * 100;
  const barFill = Math.min(100, (pct / dynamicMax) * 100);
  const isOverflow = pct > 100;
  const displayColor = isOverflow ? "#f59e0b" : color;
  return (
    <div style={{ height: 6, borderRadius: 999, background: "transparent", overflow: "hidden", position: "relative" }}>
      <motion.div
        initial={animated ? { width: 0 } : { width: `${barFill}%` }}
        animate={{ width: `${barFill}%` }}
        transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ position: "absolute", inset: "0 auto 0 0", borderRadius: 999, background: displayColor, boxShadow: `0 0 8px ${displayColor}80` }}
      />
    </div>
  );
}

function GoalCard({ goal, isPrimary = false, canDelete = false, canSetPrimary = false, onDelete, onSetPrimary }: {
  goal: GoalData;
  isPrimary?: boolean;
  canDelete?: boolean;
  canSetPrimary?: boolean;
  onDelete?: () => void;
  onSetPrimary?: () => void;
}) {
  const { primaryGoal, primaryProgress } = useObjectiveProgress();
  // N'utiliser primaryProgress du contexte que si c'est vraiment cet objectif qui est sélectionné
  const displayPct = (isPrimary && primaryGoal?.id === goal.id) ? primaryProgress : goal.progress;
  const isAccompli = goal.status === "accompli" || (displayPct >= 100 && displayPct <= 100);
  const isOverflow = displayPct > 100;
  const color = isOverflow ? "#f59e0b" : isAccompli ? "#10b981" : displayPct >= 60 ? "#6366f1" : "#8b5cf6";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);

  const handleSetPrimaryLocal = async () => {
    if (!onSetPrimary || settingPrimary) return;
    setSettingPrimary(true);
    try { await onSetPrimary(); } finally { setSettingPrimary(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{
        padding: "16px 18px", borderRadius: 18,
        background: isPrimary
          ? isAccompli ? "rgba(16,185,129,0.07)" : "rgba(139,92,246,0.07)"
          : "rgba(255,255,255,0.04)",
        border: isPrimary
          ? isAccompli ? "0.5px solid rgba(16,185,129,0.22)" : "0.5px solid rgba(139,92,246,0.22)"
          : "0.5px solid rgba(255,255,255,0.08)",
        marginBottom: 10,
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            {isPrimary && !isAccompli && (
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6", boxShadow: "0 0 6px rgba(139,92,246,0.8)", flexShrink: 0 }} />
            )}
            {isAccompli && (
              <Check style={{ width: 13, height: 13, color: "#10b981", strokeWidth: 2.5, flexShrink: 0 }} />
            )}
            <p style={{ fontSize: 15, fontWeight: 700, color: "rgba(240,240,245,0.90)", margin: 0, lineHeight: 1.3 }}>{goal.title}</p>
          </div>
          {goal.description && (
            <p style={{ fontSize: 12, color: "rgba(200,200,220,0.42)", margin: 0, lineHeight: 1.45 }}>{goal.description}</p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: `${color}18`, border: `0.5px solid ${color}30` }}>
            <span style={{ fontSize: 13, fontWeight: 800, color }}>
              {isOverflow ? `${Math.round(displayPct)}% 🚀` : `${Math.round(displayPct)}%`}
            </span>
          </div>

          {/* Badge "Principal" */}
          {isPrimary && (
            <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 999, background: "rgba(251,191,36,0.10)", border: "0.5px solid rgba(251,191,36,0.22)" }}>
              <Crown style={{ width: 9, height: 9, color: "#fbbf24" }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Principal</span>
            </div>
          )}

          {/* Bouton "Définir comme principal" */}
          {canSetPrimary && !isPrimary && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleSetPrimaryLocal}
              disabled={settingPrimary}
              title="Définir comme objectif principal"
              style={{
                width: 28, height: 28, borderRadius: "50%",
                cursor: settingPrimary ? "default" : "pointer",
                background: "rgba(251,191,36,0.08)", border: "0.5px solid rgba(251,191,36,0.20)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {settingPrimary
                ? <Loader2 style={{ width: 11, height: 11, color: "#fbbf24" }} className="animate-spin" />
                : <Crown style={{ width: 11, height: 11, color: "rgba(251,191,36,0.60)" }} />
              }
            </motion.button>
          )}

          {/* Bouton supprimer — uniquement si canDelete */}
          {canDelete && (
            <AnimatePresence mode="wait">
              {confirmDelete ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => { setConfirmDelete(false); onDelete?.(); }}
                    style={{
                      padding: "3px 10px", borderRadius: 999, cursor: "pointer",
                      background: "rgba(239,68,68,0.18)", border: "0.5px solid rgba(239,68,68,0.40)",
                      fontSize: 11, fontWeight: 700, color: "#f87171",
                    }}
                  >
                    Confirmer
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      width: 26, height: 26, borderRadius: "50%", cursor: "pointer",
                      background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.10)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <X style={{ width: 11, height: 11, color: "rgba(255,255,255,0.40)" }} />
                  </motion.button>
                </motion.div>
              ) : (
                <motion.button
                  key="trash"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                    background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.09)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Trash2 style={{ width: 12, height: 12, color: "rgba(255,255,255,0.28)" }} />
                </motion.button>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Barre de progression (read-only) */}
      <ProgressBar pct={displayPct} color={color} />

      {/* Pts + Badge IA + durée */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles style={{ width: 10, height: 10, color: "#8b5cf6", opacity: 0.55 }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(165,140,252,0.55)", letterSpacing: "0.04em" }}>
            {goal.duration_type
              ? ({ "1_semaine": "7j", "1_mois": "1 mois", "3_mois": "3 mois", "6_mois": "6 mois", "1_an": "1 an", "2_ans": "2 ans", "plus": "2 ans+" } as Record<string, string>)[goal.duration_type] ?? goal.duration_type
              : "Analyse IA"}
          </span>
          {goal.progress_score !== undefined && goal.progress_max !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc" }}>
              ⚡ {goal.progress_score}/{goal.progress_max} pts
            </span>
          )}
        </div>
        {isOverflow
          ? <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>🚀 Objectif dépassé !</span>
          : isAccompli
            ? <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981" }}>✓ Objectif atteint !</span>
            : null
        }
      </div>
    </motion.div>
  );
}

function ReportCard({ report }: { report: ProgressReport }) {
  const { showsProgress, progressPoints } = report.analysis;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", marginBottom: 8 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "rgba(144,144,168,0.40)", fontWeight: 600 }}>{relTime(report.createdAt)}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {showsProgress ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", background: "rgba(139,92,246,0.12)", padding: "2px 8px", borderRadius: 999, border: "0.5px solid rgba(139,92,246,0.25)" }}>
              +{progressPoints} pts
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(144,144,168,0.45)" }}>+1 pt</span>
          )}
        </div>
      </div>
      <p style={{ fontSize: 13, color: "rgba(200,200,220,0.65)", lineHeight: 1.55, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
        {report.responseText}
      </p>
      {showsProgress && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
          <TrendingUp style={{ width: 11, height: 11, color: "#8b5cf6", strokeWidth: 2 }} />
          <span style={{ fontSize: 11, color: "rgba(139,92,246,0.80)", fontWeight: 600 }}>Progrès détecté — Évolution mise à jour</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = "question" | "objectifs" | "historique";

export function ProgressionPage() {
  const navigate = useNavigate();
  const { streak, progressScore, goals: ctxGoals, refresh: refreshCtx } = useProgression();
  const { primaryGoal, primaryProgress, refresh: refreshObjective, selectGoal } = useObjectiveProgress();
  const { currentUserId } = useFollow();
  // userId réactif via auth (jamais statique)
  const myUserId = currentUserId || "thomasdubois";

  const [tab, setTab] = useState<TabKey>("question");
  const [responseText, setResponseText] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ showsProgress: boolean; progressPoints: number; newScore: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Limite quotidienne ─────────────────────────────────────────────────────
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [secondsUntilReset, setSecondsUntilReset] = useState(0);
  const [loadingDailyStatus, setLoadingDailyStatus] = useState(true);

  useEffect(() => {
    if (!myUserId) {
      setLoadingDailyStatus(false);
      return;
    }
    setLoadingDailyStatus(true);
    fetch(`${BASE}/progression/${encodeURIComponent(myUserId)}/daily-status`, { headers: HEADERS })
      .then((r) => r.json())
      .then((d) => {
        setAlreadySubmitted(d.alreadySubmitted ?? false);
        setSecondsUntilReset(d.secondsUntilReset ?? 0);
      })
      .catch((e) => console.error("Erreur daily-status:", e))
      .finally(() => setLoadingDailyStatus(false));
  }, [myUserId]);

  // Compte à rebours
  useEffect(() => {
    if (!alreadySubmitted || secondsUntilReset <= 0) return;
    const t = setInterval(() => setSecondsUntilReset((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [alreadySubmitted, secondsUntilReset]);

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
    if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
    return `${s}s`;
  };

  const [goals, setGoals] = useState<GoalData[]>(ctxGoals);
  const [showNewGoalForm, setShowNewGoalForm] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDesc, setNewGoalDesc] = useState("");
  const [newGoalDuration, setNewGoalDuration] = useState<string | null>(null); // obligatoire
  const [savingGoal, setSavingGoal] = useState(false);
  // selectedGoalId : objectif ciblé par le rapport du jour (pill selector)
  // Synchronisé avec primaryGoal du contexte par défaut
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(primaryGoal?.id ?? null);

  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const [totalPosts, setTotalPosts] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!myUserId) return;
    setLoadingStats(true);
    try {
      const data = await getProgression(myUserId);
      setGoals(data.goals);
      setTotalPosts(data.stats.postCount);
    } catch (err) {
      console.error("Erreur chargement progression:", err);
      // En cas d'erreur réseau, on garde les goals du contexte (ctxGoals)
      setGoals(ctxGoals);
    } finally {
      setLoadingStats(false);
    }
  }, [myUserId, ctxGoals]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Sync selectedGoalId avec l'objectif principal dès qu'il est chargé
  useEffect(() => {
    if (primaryGoal?.id && !selectedGoalId) {
      setSelectedGoalId(primaryGoal.id);
    }
  }, [primaryGoal?.id]);

  useEffect(() => {
    if (!myUserId) return;
    setChartLoading(true);
    getEvolutionChart(myUserId, "30d")
      .then(({ points }) => setChartPoints(points.length > 0 ? points : []))
      .catch((err) => console.error("Erreur chart:", err))
      .finally(() => setChartLoading(false));
  }, [myUserId]);

  useEffect(() => {
    if (tab === "historique" && reports.length === 0) {
      setLoadingReports(true);
      getProgressReports(myUserId, 20)
        .then(({ reports: r }) => setReports(r))
        .catch((err) => console.error("Erreur rapports:", err))
        .finally(() => setLoadingReports(false));
    }
  }, [tab, reports.length]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(120, ta.scrollHeight)}px`;
  }, [responseText]);

  const handleSubmit = async () => {
    if (!responseText.trim() || sending) return;
    setSending(true);
    setLastResult(null);
    try {
      const { analysis, newProgressScore, report, goalProgress, goalCompleted } = await submitProgressReport(
        myUserId, responseText.trim(), selectedGoalId ?? undefined
      );
      setLastResult({ showsProgress: analysis.showsProgress, progressPoints: analysis.progressPoints, newScore: newProgressScore });
      setReports((prev) => [report, ...prev]);
      setResponseText("");
      setAlreadySubmitted(true);
      const now = new Date();
      const midnight = new Date(now);
      midnight.setUTCHours(24, 0, 0, 0);
      setSecondsUntilReset(Math.floor((midnight.getTime() - now.getTime()) / 1000));
      // Refresh les objectifs et contextes globaux
      await refreshObjective();
      await refreshCtx();
      // Recharger les goals locaux
      await loadAll();
      if (goalCompleted) {
        toast.success("🎉 Objectif accompli ! La barre est à 100% !", { duration: 4000 });
      } else if (goalProgress !== null && analysis.showsProgress) {
        toast.success(`+${analysis.progressPoints} pts · Objectif → ${goalProgress}% ↑`, { duration: 3000 });
      } else if (analysis.showsProgress) {
        toast.success(`+${analysis.progressPoints} pts d'évolution !`, { duration: 2500 });
      } else {
        toast.success("Rapport enregistré — continue comme ça !", { duration: 2500 });
      }
    } catch (err: unknown) {
      console.error("Erreur envoi rapport:", err);
      const msg = err instanceof Error ? err.message : "Impossible d'enregistrer le rapport.";
      if (msg.includes("déjà") || msg.includes("429")) {
        setAlreadySubmitted(true);
        toast.error("Tu as déjà soumis ton avancement aujourd'hui !", { duration: 3000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  };

  // handleUpdateGoalProgress gardé pour d'éventuels besoins internes mais non exposé à l'UI
  const handleUpdateGoalProgress = async (_goalId: string, _pct: number) => {};

  // ── Définir un objectif comme principal ──────────────────────────────────────
  const handleSetPrimary = async (goalId: string) => {
    if (!goalId) return;
    try {
      await selectGoal(goalId); // Met à jour KV + profil + anneau + barre
      setSelectedGoalId(goalId); // aligne aussi le sélecteur de rapport
      const goal = goals.find(g => g.id === goalId);
      if (goal) toast.success(`👑 "${goal.title}" est maintenant ton objectif principal`, { duration: 2500 });
    } catch (err) {
      console.error("handleSetPrimary error:", err);
      toast.error("Impossible de changer l'objectif principal.");
    }
  };

  const handleCreateGoal = async () => {
    if (!newGoalTitle.trim() || !newGoalDuration || savingGoal) return;
    setSavingGoal(true);
    try {
      const { goals: updated } = await upsertGoal(myUserId, {
        title: newGoalTitle.trim(),
        description: newGoalDesc.trim(),
        progress: 0,
        duration_type: newGoalDuration,
      });
      setGoals(updated);
      setNewGoalTitle("");
      setNewGoalDesc("");
      setNewGoalDuration(null);
      setShowNewGoalForm(false);
      // Rafraîchir le contexte ObjectiveProgressContext pour mettre à jour le profil
      refreshObjective();
      toast.success("Objectif créé !", { duration: 1800 });
    } catch (err) {
      toast.error("Impossible de créer l'objectif.");
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!goalId) return;
    setSavingGoal(true);
    try {
      const { goals: updated } = await deleteGoal(myUserId, goalId);
      setGoals(updated);
      toast.success("Objectif supprimé !", { duration: 1800 });
    } catch (err) {
      toast.error("Impossible de supprimer l'objectif.");
    } finally {
      setSavingGoal(false);
    }
  };

  const currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;

  return (
    <div style={{ minHeight: "100vh", background: "#000", paddingBottom: 120 }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ padding: "52px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate(-1)}
            style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent", flexShrink: 0 }}>
            <ArrowLeft style={{ width: 16, height: 16, color: "rgba(255,255,255,0.70)", strokeWidth: 2 }} />
          </motion.button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f0f0f5", margin: 0, letterSpacing: "-0.4px" }}>Progression</h1>
            <p style={{ fontSize: 13, color: "rgba(144,144,168,0.50)", margin: "2px 0 0" }}>Suivi de ton évolution quotidienne</p>
          </div>
        </div>

        {/* ── Stats ── */}
        <div style={{ padding: "0 20px 20px" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <StreakStatCell value={currentStreak} />
            <StatPill label="Constance" value={`${progressScore}%`} color="#ffffff" />
            <StatPill label="Record" value={`${longestStreak}j`} color="#ffffff" />
            <StatPill label="Posts" value={totalPosts} color="#ffffff" />
          </div>

          {/* Diagramme d'évolution (SVG custom — pas recharts) */}
          <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 16, background: "rgba(99,102,241,0.07)", border: "0.5px solid rgba(99,102,241,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(165,180,252,0.80)" }}>Diagramme d'évolution</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#818cf8" }}>{progressScore}%</span>
            </div>
            {chartLoading ? (
              <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Loader2 style={{ width: 16, height: 16, color: "rgba(99,102,241,0.50)" }} className="animate-spin" />
              </div>
            ) : (
              <MiniEvoChart data={chartPoints} fallbackValue={progressScore} />
            )}
            <p style={{ fontSize: 11, color: "rgba(144,144,168,0.38)", marginTop: 8, textAlign: "right" }}>
              Augmente en postant, commentant, rejoignant des communautés…
            </p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ padding: "0 20px 16px" }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 999, padding: 3, border: "0.5px solid rgba(255,255,255,0.08)" }}>
            {([
              { key: "question", label: "Question du jour" },
              { key: "objectifs", label: "Objectifs" },
              { key: "historique", label: "Historique" },
            ] as { key: TabKey; label: string }[]).map((t) => {
              const active = tab === t.key;
              return (
                <motion.button key={t.key} whileTap={{ scale: 0.97 }} onClick={() => setTab(t.key)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 999, fontSize: 12, fontWeight: active ? 700 : 500, background: active ? "rgba(255,255,255,0.12)" : "transparent", border: active ? "0.5px solid rgba(255,255,255,0.14)" : "none", color: active ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.35)", cursor: "pointer", transition: "all 0.18s ease", WebkitTapHighlightColor: "transparent" }}>
                  {t.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.20 }} style={{ padding: "0 20px" }}>

            {/* ── Question du jour ── */}
            {tab === "question" && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 24, fontWeight: 800, color: "#f0f0f5", lineHeight: 1.3, letterSpacing: "-0.4px", margin: "0 0 6px" }}>
                    Comment as-tu avancé sur ton objectif ou projet ?
                  </p>
                  <p style={{ fontSize: 14, color: "rgba(144,144,168,0.45)", margin: 0, lineHeight: 1.5 }}>
                    Partage honnêtement ce que tu as accompli aujourd'hui. Ton évolution sera analysée automatiquement.
                  </p>
                </div>

                {/* ── Chargement du statut ── */}
                {loadingDailyStatus ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "48px 0" }}>
                    <Loader2 style={{ width: 18, height: 18, color: "rgba(99,102,241,0.55)" }} className="animate-spin" />
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.25)" }}>Vérification…</span>
                  </div>
                ) : alreadySubmitted ? (
                  /* ── État verrouillé : déjà soumis aujourd'hui ── */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: [0.25, 0, 0.35, 1] }}
                    style={{
                      padding: "32px 24px",
                      borderRadius: 24,
                      background: "rgba(16,185,129,0.07)",
                      border: "0.5px solid rgba(16,185,129,0.22)",
                      textAlign: "center",
                    }}
                  >
                    {/* Icône succès */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 320, damping: 20 }}
                      style={{
                        width: 72, height: 72, borderRadius: "50%",
                        background: "rgba(16,185,129,0.14)",
                        border: "0.5px solid rgba(16,185,129,0.30)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        margin: "0 auto 20px",
                      }}
                    >
                      <Check style={{ width: 32, height: 32, color: "#10b981", strokeWidth: 2.5 }} />
                    </motion.div>

                    <p style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f5", margin: "0 0 8px", letterSpacing: "-0.3px" }}>
                      Avancement du jour envoyé !
                    </p>
                    <p style={{ fontSize: 14, color: "rgba(144,144,168,0.60)", margin: "0 0 24px", lineHeight: 1.55 }}>
                      Tu as déjà partagé ta progression aujourd'hui.<br />
                      Continue de construire ta constance !
                    </p>

                    {/* Compte à rebours */}
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "10px 18px", borderRadius: 999,
                      background: "rgba(255,255,255,0.05)",
                      border: "0.5px solid rgba(255,255,255,0.10)",
                    }}>
                      <Clock style={{ width: 14, height: 14, color: "rgba(144,144,168,0.55)" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(200,200,220,0.55)" }}>
                        Prochain envoi dans{" "}
                        <span style={{ color: "rgba(165,180,252,0.85)", fontVariantNumeric: "tabular-nums" }}>
                          {formatCountdown(secondsUntilReset)}
                        </span>
                      </span>
                    </div>

                    {/* Lien vers l'historique */}
                    <div style={{ marginTop: 20 }}>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setTab("historique")}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          display: "inline-flex", alignItems: "center", gap: 6,
                          fontSize: 13, fontWeight: 600, color: "rgba(165,180,252,0.65)",
                          padding: "6px 12px", borderRadius: 8,
                        }}
                      >
                        <ChevronRight style={{ width: 14, height: 14 }} />
                        Voir mes rapports précédents
                      </motion.button>
                    </div>
                  </motion.div>
                ) : (
                  /* ── Formulaire normal ── */
                  <>
                    {/* ── Sélecteur d'objectif ciblé ── */}
                    {goals.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(144,144,168,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                          Objectif ciblé par ce rapport
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {goals.map((g) => {
                            const isSelected = g.id === selectedGoalId || (!selectedGoalId && g.id === primaryGoal?.id);
                            return (
                              <motion.button
                                key={g.id}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSelectedGoalId(g.id)}
                                style={{
                                  padding: "6px 13px", borderRadius: 999, cursor: "pointer",
                                  background: isSelected ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.05)",
                                  border: isSelected ? "0.5px solid rgba(99,102,241,0.50)" : "0.5px solid rgba(255,255,255,0.09)",
                                  fontSize: 12, fontWeight: isSelected ? 700 : 500,
                                  color: isSelected ? "#a5b4fc" : "rgba(200,200,220,0.45)",
                                  maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  WebkitTapHighlightColor: "transparent",
                                }}
                              >
                                {g.status === "accompli" && <span style={{ marginRight: 4 }}>✓</span>}
                                {g.title}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ position: "relative", marginBottom: 14 }}>
                      <textarea
                        ref={textareaRef}
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Ex : J'ai terminé le module de paiement, rédigé 500 mots de mon roman, couru 8km ce matin…"
                        disabled={sending}
                        style={{
                          width: "100%", minHeight: 120, padding: "14px 16px",
                          background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.12)",
                          borderRadius: 18, fontSize: 15, color: "rgba(235,235,245,0.88)", lineHeight: 1.6,
                          outline: "none", resize: "none", caretColor: "#6366f1",
                          boxSizing: "border-box", fontFamily: "inherit",
                          opacity: sending ? 0.7 : 1,
                        }}
                        className="placeholder:text-[rgba(144,144,168,0.35)]"
                      />
                      <div style={{ position: "absolute", bottom: 12, right: 12 }}>
                        <span style={{ fontSize: 11, color: responseText.length > 800 ? "#f87171" : "rgba(144,144,168,0.30)" }}>
                          {responseText.length}/1000
                        </span>
                      </div>
                    </div>

                    <motion.button
                      whileTap={!sending && responseText.trim() ? { scale: 0.97 } : {}}
                      onClick={handleSubmit}
                      disabled={!responseText.trim() || sending}
                      style={{
                        width: "100%", height: 54, borderRadius: 999, cursor: (!responseText.trim() || sending) ? "default" : "pointer",
                        background: (!responseText.trim() || sending) ? "rgba(99,102,241,0.20)" : "linear-gradient(135deg,#4f46e5,#6366f1,#818cf8)",
                        border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                        fontSize: 16, fontWeight: 700, color: !responseText.trim() ? "rgba(255,255,255,0.30)" : "#fff",
                        boxShadow: (!responseText.trim() || sending) ? "none" : "0 4px 24px rgba(99,102,241,0.35)",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      {sending ? (
                        <>
                          <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                          Analyse en cours…
                        </>
                      ) : (
                        <>
                          <Send style={{ width: 17, height: 17 }} />
                          Envoyer ma progression
                        </>
                      )}
                    </motion.button>

                    <AnimatePresence>
                      {lastResult && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.28 }}
                          style={{
                            marginTop: 16, padding: "16px 18px", borderRadius: 18,
                            background: lastResult.showsProgress ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.04)",
                            border: lastResult.showsProgress ? "0.5px solid rgba(16,185,129,0.22)" : "0.5px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: lastResult.showsProgress ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {lastResult.showsProgress
                                ? <TrendingUp style={{ width: 15, height: 15, color: "#10b981", strokeWidth: 2 }} />
                                : <Check style={{ width: 15, height: 15, color: "rgba(255,255,255,0.40)", strokeWidth: 2 }} />
                              }
                            </div>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700, color: lastResult.showsProgress ? "#10b981" : "rgba(255,255,255,0.65)", margin: 0 }}>
                                {lastResult.showsProgress ? `+${lastResult.progressPoints} pts — Progrès détecté !` : "Rapport enregistré"}
                              </p>
                              <p style={{ fontSize: 12, color: "rgba(144,144,168,0.45)", margin: "2px 0 0" }}>
                                Évolution globale : {lastResult.newScore}%
                              </p>
                            </div>
                          </div>
                          {lastResult.showsProgress && (
                            <div style={{ marginTop: 10 }}>
                              <ProgressBar pct={lastResult.newScore} color="#10b981" />
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            )}

            {/* ── Objectifs ── */}
            {tab === "objectifs" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f5", margin: 0 }}>Mes objectifs</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowNewGoalForm((v) => !v)}
                    style={{ padding: "7px 16px", borderRadius: 999, background: "rgba(99,102,241,0.14)", border: "0.5px solid rgba(99,102,241,0.30)", fontSize: 13, fontWeight: 700, color: "#a5b4fc", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                    + Ajouter
                  </motion.button>
                </div>

                <AnimatePresence>
                  {showNewGoalForm && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden", marginBottom: 14 }}>
                      <div style={{ padding: "16px", borderRadius: 18, background: "rgba(99,102,241,0.08)", border: "0.5px solid rgba(99,102,241,0.20)" }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(165,180,252,0.85)", marginBottom: 12 }}>Nouvel objectif</p>
                        <input value={newGoalTitle} onChange={(e) => setNewGoalTitle(e.target.value)} placeholder="Titre de l'objectif…"
                          style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.10)", borderRadius: 12, fontSize: 14, color: "rgba(235,235,245,0.90)", outline: "none", caretColor: "#6366f1", marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit" }}
                          className="placeholder:text-[rgba(144,144,168,0.35)]" />
                        <textarea value={newGoalDesc} onChange={(e) => setNewGoalDesc(e.target.value)} placeholder="Description (optionnel)…" rows={2}
                          style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.10)", borderRadius: 12, fontSize: 13, color: "rgba(235,235,245,0.80)", outline: "none", caretColor: "#6366f1", resize: "none", marginBottom: 12, boxSizing: "border-box", fontFamily: "inherit" }}
                          className="placeholder:text-[rgba(144,144,168,0.30)]" />

                        {/* ── Durée obligatoire ── */}
                        <div style={{ marginBottom: 14 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: newGoalDuration ? "rgba(165,180,252,0.70)" : "rgba(239,68,68,0.70)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                            Durée prévue <span style={{ color: "rgba(239,68,68,0.80)" }}>*</span>
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {([
                              { key: "1_semaine", label: "1 semaine" },
                              { key: "1_mois",    label: "1 mois" },
                              { key: "3_mois",    label: "3 mois" },
                              { key: "6_mois",    label: "6 mois" },
                              { key: "1_an",      label: "1 an" },
                              { key: "2_ans",     label: "2 ans" },
                              { key: "plus",      label: "Plus de 2 ans" },
                            ] as const).map((d) => {
                              const active = newGoalDuration === d.key;
                              return (
                                <motion.button
                                  key={d.key}
                                  whileTap={{ scale: 0.93 }}
                                  onClick={() => setNewGoalDuration(d.key)}
                                  style={{
                                    padding: "5px 11px", borderRadius: 999, cursor: "pointer",
                                    background: active ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.04)",
                                    border: active ? "0.5px solid rgba(99,102,241,0.50)" : "0.5px solid rgba(255,255,255,0.09)",
                                    fontSize: 12, fontWeight: active ? 700 : 500,
                                    color: active ? "#a5b4fc" : "rgba(200,200,220,0.45)",
                                    WebkitTapHighlightColor: "transparent",
                                  }}
                                >
                                  {d.label}
                                </motion.button>
                              );
                            })}
                          </div>
                          {!newGoalDuration && (
                            <p style={{ fontSize: 11, color: "rgba(239,68,68,0.60)", marginTop: 6 }}>
                              Sélectionne une durée pour calibrer la progression
                            </p>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={handleCreateGoal} disabled={!newGoalTitle.trim() || !newGoalDuration || savingGoal}
                            style={{ flex: 1, height: 40, borderRadius: 999, background: (newGoalTitle.trim() && newGoalDuration) ? "#6366f1" : "rgba(99,102,241,0.20)", border: "none", fontSize: 13, fontWeight: 700, color: (newGoalTitle.trim() && newGoalDuration) ? "#fff" : "rgba(255,255,255,0.30)", cursor: (newGoalTitle.trim() && newGoalDuration) ? "pointer" : "default", WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            {savingGoal ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Target style={{ width: 14, height: 14 }} />}
                            Créer
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowNewGoalForm(false)}
                            style={{ padding: "0 18px", height: 40, borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.10)", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.45)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                            Annuler
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {goals.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 20px" }}>
                    <Target style={{ width: 40, height: 40, color: "rgba(255,255,255,0.12)", margin: "0 auto 14px", display: "block", strokeWidth: 1.5 }} />
                    <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.30)" }}>Aucun objectif créé</p>
                    <p style={{ fontSize: 13, color: "rgba(144,144,168,0.28)", marginTop: 4 }}>Crée ton premier objectif pour commencer à suivre ta progression.</p>
                  </div>
                ) : (
                  <>
                    {goals.length > 1 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "9px 13px", borderRadius: 12, marginBottom: 12,
                          background: "rgba(251,191,36,0.05)",
                          border: "0.5px solid rgba(251,191,36,0.14)",
                        }}
                      >
                        <Crown style={{ width: 11, height: 11, color: "#fbbf24", flexShrink: 0 }} />
                        <p style={{ fontSize: 12, color: "rgba(251,191,36,0.60)", margin: 0, lineHeight: 1.5 }}>
                          Appuie sur 👑 pour changer l'objectif <strong style={{ color: "rgba(251,191,36,0.80)" }}>Principal</strong> affiché sur ton profil.
                        </p>
                      </motion.div>
                    )}
                    {goals.map((g, idx) => (
                      <GoalCard
                        key={g.id}
                        goal={g}
                        isPrimary={g.id === primaryGoal?.id || (!primaryGoal && idx === 0)}
                        canDelete={goals.length > 1}
                        canSetPrimary={goals.length > 1}
                        onDelete={() => handleDeleteGoal(g.id)}
                        onSetPrimary={() => handleSetPrimary(g.id)}
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── Historique ── */}
            {tab === "historique" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f5", margin: 0 }}>Mes rapports</p>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={() => {
                    setLoadingReports(true);
                    getProgressReports(myUserId, 20).then(({ reports: r }) => setReports(r)).finally(() => setLoadingReports(false));
                  }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", gap: 5, color: "rgba(144,144,168,0.45)", fontSize: 12 }}>
                    <RefreshCw style={{ width: 13, height: 13 }} />
                    Actualiser
                  </motion.button>
                </div>

                {loadingReports ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", gap: 8, alignItems: "center" }}>
                    <Loader2 style={{ width: 16, height: 16, color: "rgba(99,102,241,0.55)" }} className="animate-spin" />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Chargement…</span>
                  </div>
                ) : reports.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 20px" }}>
                    <ChevronRight style={{ width: 40, height: 40, color: "rgba(255,255,255,0.10)", margin: "0 auto 14px", display: "block", strokeWidth: 1.5 }} />
                    <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.30)" }}>Aucun rapport</p>
                    <p style={{ fontSize: 13, color: "rgba(144,144,168,0.28)", marginTop: 4 }}>Réponds à la question du jour pour commencer.</p>
                  </div>
                ) : (
                  reports.map((r) => <ReportCard key={r.id} report={r} />)
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}