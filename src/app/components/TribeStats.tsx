import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, Trash2, CheckCircle2,
  X, ChevronDown, TrendingUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

// ── Types ──────────────────────────────────────────────────────────────────────

interface Objective {
  id: string;
  userId: string;
  communityId: string;
  type: string;
  emoji: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  durationDays: number;
  endDate: string;
  completed: boolean;
}

interface CommunityStats {
  totalObjectives: number;
  completedObjectives: number;
  activeUsers: number;
  totalCurrentValue: number;
  avgCompletion: number;
}

// ── Static community mock data ─────────────────────────────────────────────────

const STATIC_STATS: Record<string, { totalObjectives: number; completedObjectives: number; evolution: number[] }> = {
  "1": { totalObjectives: 312, completedObjectives: 89, evolution: [12, 18, 15, 22, 28, 31, 24] },
  "2": { totalObjectives: 720, completedObjectives: 245, evolution: [28, 35, 41, 38, 52, 48, 44] },
  "3": { totalObjectives: 415, completedObjectives: 112, evolution: [18, 22, 26, 21, 32, 28, 25] },
  "4": { totalObjectives: 1050, completedObjectives: 380, evolution: [42, 55, 48, 61, 72, 65, 58] },
  "5": { totalObjectives: 540, completedObjectives: 178, evolution: [22, 28, 31, 26, 38, 35, 30] },
};

const STATIC_COMM_OBJECTIVES: Record<string, { emoji: string; title: string; currentValue: number; targetValue: number; unit: string }> = {
  "1": { emoji: "🚀", title: "Lancer 1 000 produits SaaS", currentValue: 234, targetValue: 1000, unit: "produits" },
  "2": { emoji: "🏃", title: "Courir 10 000 km collectifs", currentValue: 6872, targetValue: 10000, unit: "km" },
  "3": { emoji: "✍️", title: "Ecrire 500 000 mots collectifs", currentValue: 312000, targetValue: 500000, unit: "mots" },
  "4": { emoji: "💰", title: "Investir 1 000 000 euros", currentValue: 745000, targetValue: 1000000, unit: "euros" },
  "5": { emoji: "🧘", title: "365 jours de constance collective", currentValue: 215, targetValue: 365, unit: "jours" },
};

// ── Presets ────────────────────────────────────────────────────────────────────

const PRESETS = [
  {
    cat: "💸 Business",
    items: [
      { type: "business", emoji: "🤝", title: "Signer X clients",      targetValue: 5,    unit: "clients" },
      { type: "business", emoji: "💰", title: "Generer X euros",        targetValue: 1000, unit: "euros" },
      { type: "business", emoji: "📧", title: "Envoyer X leads",        targetValue: 50,   unit: "leads" },
    ],
  },
  {
    cat: "⚙️ Productivité",
    items: [
      { type: "productivity", emoji: "⏱️", title: "Travailler X heures", targetValue: 40, unit: "heures" },
      { type: "productivity", emoji: "🔥", title: "Streak X jours",       targetValue: 7,  unit: "jours" },
      { type: "productivity", emoji: "✅", title: "Finir X taches",        targetValue: 20, unit: "taches" },
    ],
  },
  {
    cat: "🚀 Creation",
    items: [
      { type: "creation", emoji: "🌐", title: "Creer mon site",   targetValue: 1,  unit: "site" },
      { type: "creation", emoji: "💡", title: "Creer mon offre",  targetValue: 1,  unit: "offre" },
      { type: "creation", emoji: "📱", title: "Publier X contenus", targetValue: 10, unit: "contenus" },
    ],
  },
  {
    cat: "📈 Acquisition",
    items: [
      { type: "acquisition", emoji: "🎯", title: "Lancer une pub",  targetValue: 1,   unit: "pub" },
      { type: "acquisition", emoji: "🎬", title: "Poster X videos",  targetValue: 4,   unit: "videos" },
      { type: "acquisition", emoji: "👥", title: "Obtenir X leads",  targetValue: 100, unit: "leads" },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function pct(cur: number, tgt: number) {
  if (!tgt) return 0;
  return Math.min(100, Math.round((cur / tgt) * 100));
}

function daysLeft(endDate: string) {
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

// ── Progress Bar ───────────────────────────────────────────────────────────────

function ProgressBar({ value, delay = 0, done = false }: { value: number; delay?: number; done?: boolean }) {
  return (
    <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden", position: "relative" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.9, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 999,
          background: done
            ? "linear-gradient(90deg,#22c55e,#4ade80)"
            : "linear-gradient(90deg,#4f46e5,#818cf8,#a5b4fc)",
          boxShadow: done ? "0 0 10px rgba(34,197,94,0.45)" : "0 0 10px rgba(99,102,241,0.5)",
        }}
      />
    </div>
  );
}

// ── Custom CSS Bar Chart (no recharts — avoids SVG key collisions) ─────────────

function CssEvoChart({ values, maxVal }: { values: number[]; maxVal: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div style={{ width: "100%", height: 120, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 5, padding: "0 2px" }}>
        {values.map((val, i) => {
          const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const isMax = val === maxVal && val > 0;
          const isHov = hovered === i;
          return (
            <div
              key={`evo-col-${i}`}
              style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", position: "relative" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHov && val > 0 && (
                <div style={{
                  position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
                  marginBottom: 5, background: "rgba(14,14,22,0.97)",
                  border: "0.5px solid rgba(99,102,241,0.35)", borderRadius: 7,
                  padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#a5b4fc",
                  whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.40)",
                }}>
                  {val}
                </div>
              )}
              <motion.div
                key={`evo-bar-${i}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(heightPct, val > 0 ? 5 : 2)}%` }}
                transition={{ duration: 0.5, delay: i * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{
                  width: "100%",
                  borderRadius: "5px 5px 2px 2px",
                  background: isMax
                    ? "linear-gradient(180deg,#818cf8,#4f46e5)"
                    : val > 0
                    ? isHov ? "rgba(99,102,241,0.65)" : "rgba(99,102,241,0.42)"
                    : "rgba(255,255,255,0.05)",
                  boxShadow: isMax ? "0 0 8px rgba(99,102,241,0.40)" : "none",
                  transition: "background 0.15s ease",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 5, padding: "5px 2px 0" }}>
        {values.map((_, i) => (
          <div
            key={`evo-lbl-${i}`}
            style={{
              flex: 1, textAlign: "center", fontSize: 10,
              color: hovered === i ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.22)",
              fontWeight: hovered === i ? 600 : 400,
              transition: "color 0.15s",
            }}
          >
            J{i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Create Modal ───────────────────────────────────────────────────────────────

type PresetItem = { type: string; emoji: string; title: string; targetValue: number; unit: string };

// Mapping durée → jours (identique au backend)
const DURATION_OPTIONS = [
  { key: "1_semaine", label: "1 semaine", days: 7 },
  { key: "1_mois",    label: "1 mois",    days: 30 },
  { key: "3_mois",    label: "3 mois",    days: 90 },
  { key: "6_mois",    label: "6 mois",    days: 180 },
  { key: "1_an",      label: "1 an",      days: 365 },
  { key: "2_ans",     label: "2 ans",     days: 730 },
  { key: "plus",      label: "2 ans+",    days: 1000 },
] as const;
type DurationKey = typeof DURATION_OPTIONS[number]["key"];

function CreateModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: PresetItem & { durationDays: number; duration_type: string }) => void;
}) {
  const [mode, setMode] = useState<"presets" | "custom">("presets");
  const [selected, setSelected] = useState<PresetItem | null>(null);
  const [openCat, setOpenCat] = useState<string | null>("💸 Business");
  const [durationKey, setDurationKey] = useState<DurationKey | null>(null); // obligatoire
  const [emoji, setEmoji] = useState("🎯");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("10");
  const [unit, setUnit] = useState("");

  const canSave = (mode === "presets" ? !!selected : !!title.trim()) && !!durationKey;

  const handleSave = () => {
    if (!durationKey) return;
    const opt = DURATION_OPTIONS.find((d) => d.key === durationKey)!;
    if (mode === "presets" && selected) {
      onSave({ ...selected, durationDays: opt.days, duration_type: opt.key });
    } else {
      onSave({
        type: "custom", emoji, title, durationDays: opt.days, duration_type: opt.key,
        targetValue: parseFloat(target) || 10, unit,
      });
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.70)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", maxWidth: 520, margin: "0 auto",
          background: "#0e0e16",
          border: "0.5px solid rgba(255,255,255,0.10)",
          borderRadius: "28px 28px 0 0",
          maxHeight: "88vh",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* ── Handle + Header (fixe en haut) ── */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.14)", margin: "14px auto 0" }} />
          <div className="flex items-center justify-between" style={{ padding: "18px 20px 0" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>Creer un objectif</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>Simple · Mesurable · Actionnable</div>
            </div>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 10, cursor: "pointer",
                background: "rgba(255,255,255,0.07)",
                border: "0.5px solid rgba(255,255,255,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.45)" }} />
            </motion.button>
          </div>
        </div>

        {/* ── Contenu scrollable ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 0" }}>
          <div className="flex gap-2" style={{ marginBottom: 16 }}>
            {(["presets", "custom"] as const).map((m) => (
              <motion.button
                key={m}
                whileTap={{ scale: 0.95 }}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 10, cursor: "pointer",
                  background: mode === m ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.05)",
                  border: mode === m ? "0.5px solid rgba(99,102,241,0.40)" : "0.5px solid rgba(255,255,255,0.08)",
                  color: mode === m ? "#a5b4fc" : "rgba(255,255,255,0.38)",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                {m === "presets" ? "Presets" : "Personnalise"}
              </motion.button>
            ))}
          </div>

          {mode === "presets" ? (
            <div className="flex flex-col gap-2">
              {PRESETS.map((cat) => (
                <div key={cat.cat}>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setOpenCat(openCat === cat.cat ? null : cat.cat)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 12px", borderRadius: 12, cursor: "pointer",
                      background: "rgba(255,255,255,0.04)",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.70)" }}>{cat.cat}</span>
                    <motion.span animate={{ rotate: openCat === cat.cat ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown style={{ width: 14, height: 14, color: "rgba(255,255,255,0.28)" }} />
                    </motion.span>
                  </motion.button>
                  <AnimatePresence>
                    {openCat === cat.cat && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="flex flex-col gap-1.5" style={{ paddingTop: 6, paddingLeft: 6 }}>
                          {cat.items.map((item, i) => {
                            const isSelected = selected?.title === item.title;
                            return (
                              <motion.button
                                key={i}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setSelected(item)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 10,
                                  padding: "9px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                                  background: isSelected ? "rgba(99,102,241,0.16)" : "rgba(255,255,255,0.03)",
                                  border: isSelected ? "0.5px solid rgba(99,102,241,0.38)" : "0.5px solid rgba(255,255,255,0.07)",
                                }}
                              >
                                <span style={{ fontSize: 18 }}>{item.emoji}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.80)" }}>{item.title}</div>
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
                                    Cible : {item.targetValue} {item.unit}
                                  </div>
                                </div>
                                {isSelected && <CheckCircle2 style={{ width: 14, height: 14, color: "#6366f1", flexShrink: 0 }} />}
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  maxLength={2}
                  style={{
                    width: 48, height: 48, textAlign: "center", fontSize: 22, flexShrink: 0,
                    background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)",
                    borderRadius: 12, outline: "none", color: "#f0f0f5",
                  }}
                />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nom de l'objectif"
                  style={{
                    flex: 1, height: 48, padding: "0 14px",
                    background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)",
                    borderRadius: 12, outline: "none", fontSize: 14, color: "#f0f0f5",
                  }}
                  className="placeholder:text-[rgba(255,255,255,0.22)]"
                />
              </div>
              <div className="flex gap-2">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginBottom: 6, fontWeight: 500 }}>Valeur cible</div>
                  <input
                    type="number"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    min={1}
                    style={{
                      width: "100%", padding: "10px 12px",
                      background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)",
                      borderRadius: 12, outline: "none", fontSize: 14, color: "#f0f0f5",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginBottom: 6, fontWeight: 500 }}>Unite</div>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="clients, euros, jours..."
                    style={{
                      width: "100%", padding: "10px 12px",
                      background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)",
                      borderRadius: 12, outline: "none", fontSize: 14, color: "#f0f0f5",
                    }}
                    className="placeholder:text-[rgba(255,255,255,0.18)]"
                  />
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 16, paddingBottom: 8 }}>
            <div style={{ fontSize: 11, color: durationKey ? "rgba(255,255,255,0.32)" : "rgba(239,68,68,0.70)", marginBottom: 8, fontWeight: 600 }}>
              Durée prévue <span style={{ color: "rgba(239,68,68,0.80)" }}>*</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DURATION_OPTIONS.map((d) => (
                <motion.button
                  key={d.key}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setDurationKey(d.key)}
                  style={{
                    padding: "6px 12px", borderRadius: 10, cursor: "pointer",
                    background: durationKey === d.key ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.05)",
                    border: durationKey === d.key ? "0.5px solid rgba(99,102,241,0.40)" : "0.5px solid rgba(255,255,255,0.08)",
                    color: durationKey === d.key ? "#a5b4fc" : "rgba(255,255,255,0.38)",
                    fontSize: 12, fontWeight: durationKey === d.key ? 700 : 500,
                  }}
                >
                  {d.label}
                </motion.button>
              ))}
            </div>
            {!durationKey && (
              <p style={{ fontSize: 11, color: "rgba(239,68,68,0.55)", marginTop: 6 }}>
                Sélectionne une durée pour calibrer la progression
              </p>
            )}
          </div>
        </div>

        {/* ── Bouton sticky en bas — au-dessus de la bottom nav ── */}
        <div style={{
          flexShrink: 0,
          padding: "14px 20px",
          paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
          borderTop: "0.5px solid rgba(255,255,255,0.07)",
          background: "#0e0e16",
        }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={!canSave}
            style={{
              width: "100%", padding: "15px 0", borderRadius: 14,
              background: canSave
                ? "linear-gradient(135deg,#4f46e5,#7c3aed)"
                : "rgba(255,255,255,0.06)",
              border: "none", cursor: canSave ? "pointer" : "not-allowed",
              fontSize: 15, fontWeight: 700,
              color: canSave ? "#fff" : "rgba(255,255,255,0.22)",
              boxShadow: canSave ? "0 4px 20px rgba(79,70,229,0.38)" : "none",
            }}
          >
            Créer l'objectif
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface TribeStatsProps {
  tribeName: string;
  communityId: string;
  currentMembers: number;
  isCreator?: boolean;
  isStatic?: boolean;
}

export function TribeStats({ tribeName, communityId, currentMembers, isCreator = false, isStatic = false }: TribeStatsProps) {
  const { user } = useAuth();
  const userId = user?.username || "anonymous";

  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [commStats, setCommStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [completing, setCompleting] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || userId === "anonymous") { setLoading(false); return; }
    const load = async () => {
      try {
        const [objRes, statsRes] = await Promise.all([
          fetch(`${BASE}/community-objectives/${userId}/${communityId}`, { headers: H }),
          fetch(`${BASE}/community-objectives/stats/${communityId}`, { headers: H }),
        ]);
        const objData = await objRes.json();
        const statsData = await statsRes.json();
        setObjectives(objData.objectives || []);
        if (!statsData.error) setCommStats(statsData);
      } catch (e) {
        console.error("Erreur chargement stats:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, communityId]);

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreate = async (data: PresetItem & { durationDays: number; duration_type: string }) => {
    try {
      const res = await fetch(`${BASE}/community-objectives`, {
        method: "POST", headers: H,
        body: JSON.stringify({ userId, communityId, ...data }),
      });
      const result = await res.json();
      if (result.objective) {
        setObjectives((prev) => [result.objective, ...prev]);
        setCommStats((prev) => prev
          ? { ...prev, totalObjectives: prev.totalObjectives + 1 }
          : prev
        );
        setShowCreate(false);
      }
    } catch (e) { console.error("Erreur creation:", e); }
  };

  // ── Complete ────────────────────────────────────────────────────────────────
  const handleComplete = async (obj: Objective) => {
    if (completing || obj.completed) return;
    setCompleting(true);
    try {
      const res = await fetch(`${BASE}/community-objectives/${obj.id}/progress`, {
        method: "PUT", headers: H,
        body: JSON.stringify({ setValue: obj.targetValue }),
      });
      const data = await res.json();
      if (data.objective) {
        setObjectives((prev) => prev.map((o) => o.id === obj.id ? data.objective : o));
        setCommStats((prev) => prev
          ? { ...prev, completedObjectives: prev.completedObjectives + 1 }
          : prev
        );
      }
    } catch (e) { console.error("Erreur completion:", e); }
    finally { setCompleting(false); }
  };

  // ── Increment ──────────────────────────────────────────────────────────────
  const handleIncrement = async (id: string) => {
    try {
      const res = await fetch(`${BASE}/community-objectives/${id}/progress`, {
        method: "PUT", headers: H,
        body: JSON.stringify({ increment: true }),
      });
      const data = await res.json();
      if (data.objective) setObjectives((prev) => prev.map((o) => o.id === id ? data.objective : o));
    } catch (e) { console.error("Erreur +1:", e); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await fetch(`${BASE}/community-objectives/${id}`, { method: "DELETE", headers: H });
      setObjectives((prev) => prev.filter((o) => o.id !== id));
    } catch (e) { console.error("Erreur suppression:", e); }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const mainObj = objectives.find((o) => !o.completed) ?? null;
  const mainPct = mainObj ? pct(mainObj.currentValue, mainObj.targetValue) : 0;

  const mockStats = STATIC_STATS[communityId];
  const displayTotal = isStatic && mockStats
    ? mockStats.totalObjectives + (commStats?.totalObjectives ?? 0)
    : (commStats?.totalObjectives ?? 0);
  const displayCompleted = isStatic && mockStats
    ? mockStats.completedObjectives + (commStats?.completedObjectives ?? 0)
    : (commStats?.completedObjectives ?? 0);

  const evolutionValues = (() => {
    if (isStatic && mockStats) return mockStats.evolution;
    const total = displayCompleted || 0;
    const base = Math.max(1, Math.floor(total / 7));
    return Array.from({ length: 7 }, (_, i) =>
      Math.max(0, base + Math.round((Math.random() - 0.4) * base * 1.2))
    );
  })();

  const maxEvo = Math.max(...evolutionValues, 1);
  const staticCommObj = isStatic ? STATIC_COMM_OBJECTIVES[communityId] : null;

  return (
    <div style={{ paddingBottom: 48 }}>

      {/* ── Bloc 2 : Stats globales ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.30 }}
        style={{
          margin: "0 16px 12px",
          padding: "18px 18px 16px",
          borderRadius: 20,
          border: "0.5px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
          color: "rgba(255,255,255,0.28)", textTransform: "uppercase", marginBottom: 16,
        }}>
          Stats globales — tous les membres
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: "14px 14px 12px", borderRadius: 14, background: "rgba(99,102,241,0.06)", border: "0.5px solid rgba(99,102,241,0.18)" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#a5b4fc", lineHeight: 1 }}>
              {loading ? "—" : displayTotal.toLocaleString("fr-FR")}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 5, lineHeight: 1.35 }}>Objectifs cumulés</div>
          </div>
          <div style={{ padding: "14px 14px 12px", borderRadius: 14, background: "rgba(34,197,94,0.06)", border: "0.5px solid rgba(34,197,94,0.18)" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#4ade80", lineHeight: 1 }}>
              {loading ? "—" : displayCompleted.toLocaleString("fr-FR")}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 5, lineHeight: 1.35 }}>Objectifs accomplis</div>
          </div>
        </div>
      </motion.div>

      {/* ── Bloc 3 : Objectif actuel ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.30 }}
        style={{
          margin: "0 16px 12px",
          padding: "18px 18px 16px",
          borderRadius: 20,
          border: mainObj ? "0.5px solid rgba(99,102,241,0.22)" : "0.5px solid rgba(255,255,255,0.08)",
          background: mainObj
            ? "linear-gradient(135deg,rgba(79,70,229,0.10) 0%,rgba(124,58,237,0.06) 100%)"
            : "rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase" }}>
            Objectif actuel
          </div>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setShowCreate(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 999, cursor: "pointer",
              background: "rgba(99,102,241,0.16)",
              border: "0.5px solid rgba(99,102,241,0.32)",
              fontSize: 12, fontWeight: 600, color: "#a5b4fc",
            }}
          >
            <Plus style={{ width: 12, height: 12 }} />
            Nouvel objectif
          </motion.button>
        </div>

        {loading ? (
          <div style={{ height: 60, borderRadius: 12, background: "rgba(255,255,255,0.04)" }} />
        ) : mainObj ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.92)", marginBottom: 4 }}>
              {mainObj.emoji} {mainObj.title}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", marginBottom: 12 }}>
              {mainObj.currentValue.toLocaleString("fr-FR")} / {mainObj.targetValue.toLocaleString("fr-FR")} {mainObj.unit}
              {mainObj.endDate && (
                <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.22)" }}>
                  · {daysLeft(mainObj.endDate)} jour{daysLeft(mainObj.endDate) > 1 ? "s" : ""} restant{daysLeft(mainObj.endDate) > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)" }}>Progression</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: mainObj.completed ? "#4ade80" : "#a5b4fc" }}>{mainPct}%</span>
              </div>
              <ProgressBar value={mainPct} delay={0.15} done={mainObj.completed} />
            </div>

            {!mainObj.completed ? (
              <div style={{ display: "flex", gap: 8 }}>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleIncrement(mainObj.id)}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 12, cursor: "pointer",
                    background: "rgba(79,70,229,0.14)", border: "0.5px solid rgba(99,102,241,0.25)",
                    color: "#a5b4fc", fontSize: 13, fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  }}
                >
                  <Plus style={{ width: 14, height: 14 }} />
                  +1 progression
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleComplete(mainObj)}
                  disabled={completing}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 12, cursor: completing ? "default" : "pointer",
                    background: "linear-gradient(135deg,rgba(34,197,94,0.22),rgba(74,222,128,0.14))",
                    border: "0.5px solid rgba(34,197,94,0.35)",
                    color: "#4ade80", fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    opacity: completing ? 0.6 : 1,
                  }}
                >
                  <CheckCircle2 style={{ width: 14, height: 14 }} />
                  Accompli
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => handleDelete(mainObj.id)}
                  style={{
                    width: 40, height: 40, borderRadius: 12, cursor: "pointer",
                    background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Trash2 style={{ width: 14, height: 14, color: "rgba(255,255,255,0.22)" }} />
                </motion.button>
              </div>
            ) : (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px 0", borderRadius: 12,
                background: "rgba(34,197,94,0.10)", border: "0.5px solid rgba(34,197,94,0.25)",
              }}>
                <CheckCircle2 style={{ width: 15, height: 15, color: "#4ade80" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#4ade80" }}>Objectif accompli !</span>
              </div>
            )}
          </>
        ) : staticCommObj ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.92)", marginBottom: 4 }}>
              {staticCommObj.emoji} {staticCommObj.title}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", marginBottom: 12 }}>
              {staticCommObj.currentValue.toLocaleString("fr-FR")} / {staticCommObj.targetValue.toLocaleString("fr-FR")} {staticCommObj.unit}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)" }}>Progression collective</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc" }}>
                  {pct(staticCommObj.currentValue, staticCommObj.targetValue)}%
                </span>
              </div>
              <ProgressBar value={pct(staticCommObj.currentValue, staticCommObj.targetValue)} delay={0.15} />
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
              Cree ton propre objectif avec le bouton ci-dessus
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Aucun objectif en cours</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>
              Cree ton premier objectif pour progresser avec la communaute.
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Bloc 4 : Évolution ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.30 }}
        style={{
          margin: "0 16px 12px",
          padding: "18px 16px 14px",
          borderRadius: 20,
          border: "0.5px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
          <TrendingUp style={{ width: 13, height: 13, color: "#818cf8" }} />
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
            color: "rgba(255,255,255,0.28)", textTransform: "uppercase",
          }}>
            Evolution — objectifs accomplis (7 jours)
          </div>
        </div>

        {displayCompleted === 0 && !isStatic ? (
          <div style={{ textAlign: "center", padding: "18px 0", fontSize: 13, color: "rgba(255,255,255,0.22)" }}>
            Aucune donnee d'evolution disponible
          </div>
        ) : (
          <CssEvoChart values={evolutionValues} maxVal={maxEvo} />
        )}
      </motion.div>

      {/* ── Modal création ── */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal onClose={() => setShowCreate(false)} onSave={handleCreate} />
        )}
      </AnimatePresence>
    </div>
  );
}