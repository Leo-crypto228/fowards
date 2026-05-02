import { type CSSProperties, useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Euro, Clock, X, Check, Plus, Minus, ArrowRight } from "lucide-react";
import { ActivityRings } from "./ActivityRings";
import { getCash, updateCash, getHours, updateHours } from "../api/userStatsApi";
import { useObjectiveProgress } from "../context/ObjectiveProgressContext";

// ── DashboardStatsCards ───────────────────────────────────────────────────────
// Carte 1 : Anneaux d'activité
// Carte 2 : Cash investis  (owner → modal ±, additive ou soustractif)
// Carte 3 : Heures ~total  (owner → modal ±, additive ou soustractif)

interface Props {
  userId: string;
  isOwner?: boolean;
  style?: CSSProperties;
}

const CARD_BG = "rgba(255,255,255,0.07)";
const CARD_BORDER = "0.5px solid rgba(255,255,255,0.11)";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtCash(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString("fr-FR");
}

function fmtHours(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n % 1 === 0) return String(n);
  return n.toFixed(1);
}

// ── StatModal — feuille d'édition + / − ──────────────────────────────────────

function StatModal({
  title,
  icon,
  unit,
  currentTotal,
  onUpdate,
  onClose,
}: {
  title: string;
  icon: React.ReactNode;
  unit: "€" | "h";
  currentTotal: number;
  onUpdate: (delta: number) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"add" | "sub">("add");
  const [rawValue, setRawValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 180);
  }, []);

  const parsed = parseFloat(rawValue.replace(",", "."));
  const isValid = !isNaN(parsed) && parsed > 0;
  const delta = isValid ? (mode === "add" ? parsed : -parsed) : 0;
  const preview = isValid ? Math.max(0, currentTotal + delta) : null;

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setError(null);
    setSaving(true);
    try {
      await onUpdate(delta);
      setSuccess(true);
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      console.error("StatModal onUpdate error:", err);
      setError("Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const formatPreview = (n: number) =>
    unit === "€" ? `${fmtCash(n)} €` : `${fmtHours(n)} h`;

  return createPortal(
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.70)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 9998,
        }}
      />

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: "100%", opacity: 0.7 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          maxWidth: 672, margin: "0 auto",
          background: "rgba(6,6,18,0.98)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "0.5px solid rgba(255,255,255,0.10)",
          borderRadius: "28px 28px 0 0",
          padding: "0 24px 48px",
          zIndex: 9999,
          boxShadow: "0 -24px 80px rgba(0,0,0,0.60)",
        }}
      >
        {/* Handle bar */}
        <div style={{
          width: 40, height: 4, borderRadius: 999,
          background: "rgba(255,255,255,0.14)",
          margin: "16px auto 28px",
        }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "rgba(99,102,241,0.15)",
            border: "0.5px solid rgba(99,102,241,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f5", margin: 0, letterSpacing: "-0.3px" }}>
              {title}
            </p>
            <p style={{ fontSize: 13, color: "rgba(200,200,220,0.42)", margin: "3px 0 0" }}>
              Modifier le total
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "rgba(255,255,255,0.07)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.45)" }} />
          </motion.button>
        </div>

        {/* Total actuel */}
        <div style={{
          background: "rgba(99,102,241,0.07)",
          border: "0.5px solid rgba(99,102,241,0.20)",
          borderRadius: 18, padding: "14px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(165,180,252,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 4px" }}>
              Total actuel
            </p>
            <p style={{ fontSize: 28, fontWeight: 900, color: "#a5b4fc", margin: 0, letterSpacing: "-1px" }}>
              {formatPreview(currentTotal)}
            </p>
          </div>

          {/* Flèche + preview */}
          <AnimatePresence mode="wait">
            {preview !== null && (
              <motion.div
                key={preview}
                initial={{ opacity: 0, x: 10, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.92 }}
                transition={{ duration: 0.18 }}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <ArrowRight style={{ width: 14, height: 14, color: "rgba(165,180,252,0.40)" }} />
                <div style={{ textAlign: "right" }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700,
                    color: mode === "add" ? "rgba(165,180,252,0.65)" : "rgba(248,113,113,0.65)",
                    letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 3px",
                  }}>
                    Nouveau total
                  </p>
                  <p style={{
                    fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.8px",
                    color: mode === "add" ? "#a5b4fc" : "#f87171",
                  }}>
                    {formatPreview(preview)}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Toggle + / − */}
        <div style={{
          display: "flex", gap: 8, marginBottom: 16,
          background: "rgba(255,255,255,0.04)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 16, padding: 4,
        }}>
          {(["add", "sub"] as const).map((m) => {
            const isActive = mode === m;
            const isAdd = m === "add";
            return (
              <motion.button
                key={m}
                whileTap={{ scale: 0.96 }}
                onClick={() => { setMode(m); setError(null); }}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 13, border: "none",
                  cursor: "pointer",
                  background: isActive
                    ? isAdd
                      ? "rgba(99,102,241,0.14)"
                      : "rgba(248,113,113,0.14)"
                    : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  transition: "background 0.18s ease",
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: isActive
                    ? isAdd ? "rgba(99,102,241,0.22)" : "rgba(248,113,113,0.22)"
                    : "rgba(255,255,255,0.07)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.18s",
                }}>
                  {isAdd
                    ? <Plus style={{ width: 13, height: 13, color: isActive ? "#a5b4fc" : "rgba(255,255,255,0.35)" }} />
                    : <Minus style={{ width: 13, height: 13, color: isActive ? "#f87171" : "rgba(255,255,255,0.35)" }} />
                  }
                </div>
                <span style={{
                  fontSize: 14, fontWeight: 700,
                  color: isActive
                    ? isAdd ? "#a5b4fc" : "#f87171"
                    : "rgba(255,255,255,0.35)",
                  transition: "color 0.18s",
                }}>
                  {isAdd ? "Ajouter" : "Retirer"}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Input */}
        <div style={{
          background: "rgba(255,255,255,0.06)",
          border: `0.5px solid ${mode === "add" ? "rgba(99,102,241,0.25)" : "rgba(248,113,113,0.20)"}`,
          borderRadius: 18, padding: "16px 20px", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 12,
          transition: "border-color 0.20s ease",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: mode === "add" ? "rgba(99,102,241,0.12)" : "rgba(248,113,113,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background 0.18s",
          }}>
            {mode === "add"
              ? <Plus style={{ width: 16, height: 16, color: "#818cf8" }} />
              : <Minus style={{ width: 16, height: 16, color: "#f87171" }} />
            }
          </div>
          <input
            ref={inputRef}
            type="number"
            min="0"
            step={unit === "€" ? "1" : "0.5"}
            value={rawValue}
            onChange={(e) => { setRawValue(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={unit === "€" ? "Montant en €…" : "Nombre d'heures…"}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 24, fontWeight: 800, color: "#f0f0f5",
              caretColor: mode === "add" ? "#818cf8" : "#f87171",
            }}
            className="placeholder:text-[rgba(144,144,168,0.28)]"
          />
          <span style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.22)", flexShrink: 0 }}>
            {unit}
          </span>
        </div>

        {/* Note soustraction plancher 0 */}
        <AnimatePresence>
          {mode === "sub" && currentTotal > 0 && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ fontSize: 12, color: "rgba(248,113,113,0.55)", margin: "0 0 12px", fontWeight: 500 }}
            >
              · Le total ne peut pas descendre sous 0.
            </motion.p>
          )}
        </AnimatePresence>

        {/* Erreur */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                padding: "10px 14px", borderRadius: 12, marginBottom: 12,
                background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.20)",
                fontSize: 13, color: "#fca5a5",
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bouton Modifier */}
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="ok"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                width: "100%", padding: "16px 0", borderRadius: 20,
                background: "rgba(99,102,241,0.14)", border: "0.5px solid rgba(99,102,241,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              <Check style={{ width: 20, height: 20, color: "#a5b4fc" }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: "#a5b4fc" }}>Enregistré ✓</span>
            </motion.div>
          ) : (
            <motion.button
              key="btn"
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={!isValid || saving}
              style={{
                width: "100%", padding: "17px 0", borderRadius: 20, border: "none",
                background: !isValid || saving
                  ? "rgba(99,102,241,0.12)"
                  : mode === "add"
                    ? "linear-gradient(135deg,#4f46e5 0%,#818cf8 100%)"
                    : "linear-gradient(135deg,#be123c 0%,#f87171 100%)",
                boxShadow: !isValid || saving
                  ? "none"
                  : mode === "add"
                    ? "0 4px 28px rgba(79,70,229,0.40)"
                    : "0 4px 28px rgba(190,18,60,0.35)",
                cursor: !isValid || saving ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.22s ease",
              }}
            >
              {saving ? (
                <Loader2 style={{ width: 20, height: 20, color: "rgba(255,255,255,0.55)" }} className="animate-spin" />
              ) : (
                <>
                  {mode === "add"
                    ? <Plus style={{ width: 18, height: 18, color: !isValid ? "rgba(255,255,255,0.30)" : "#fff" }} />
                    : <Minus style={{ width: 18, height: 18, color: !isValid ? "rgba(255,255,255,0.30)" : "#fff" }} />
                  }
                  <span style={{ fontSize: 16, fontWeight: 800, color: !isValid ? "rgba(255,255,255,0.30)" : "#fff" }}>
                    Modifier
                  </span>
                </>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </>,
    document.body
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DashboardStatsCards({ userId, isOwner = false, style }: Props) {
  const [cash, setCash] = useState<number | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCashModal, setShowCashModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [c, h] = await Promise.all([getCash(userId), getHours(userId)]);
      setCash(c);
      setHours(h);
    } catch (err) {
      console.error("DashboardStatsCards fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleUpdateCash = async (delta: number) => {
    const newTotal = await updateCash(userId, delta);
    setCash(newTotal);
  };

  const handleUpdateHours = async (delta: number) => {
    const newTotal = await updateHours(userId, delta);
    setHours(newTotal);
  };

  const Spinner = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <Loader2 style={{ width: 16, height: 16, color: "rgba(255,255,255,0.25)" }} className="animate-spin" />
    </div>
  );

  const cardStyle: CSSProperties = {
    flex: 1,
    height: 148,
    borderRadius: 20,
    background: CARD_BG,
    border: CARD_BORDER,
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    padding: "15px 14px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  };

  // Rond "+" partagé — même style violet/bleu pour les deux cartes
  const PlusCircle = () => (
    <div style={{
      width: 22, height: 22, borderRadius: "50%",
      background: "rgba(99,102,241,0.10)",
      border: "0.5px solid rgba(99,102,241,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <Plus style={{ width: 12, height: 12, color: "rgba(165,180,252,0.70)", display: "block" }} />
    </div>
  );

  const { primaryProgress } = useObjectiveProgress();

  return (
    <>
      <div style={{ display: "flex", gap: 10, ...style }}>

        {/* ── Carte 1 : Anneaux d'activité ─────────────────────────────────── */}
        <ActivityRings userId={userId} purpleOverride={primaryProgress} />

        {/* ── Carte 2 : Cash investis ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.07 }}
          style={{
            ...cardStyle,
            cursor: isOwner ? "pointer" : "default",
            transition: "border-color 0.18s ease",
          }}
          onClick={() => isOwner && setShowCashModal(true)}
          whileTap={isOwner ? { scale: 0.97 } : {}}
        >
          {/* Gradient décoratif violet (identique aux heures) */}
          <div style={{
            position: "absolute", bottom: -20, right: -16,
            width: 80, height: 80, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{
              fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.40)",
              letterSpacing: "0.09em", textTransform: "uppercase", lineHeight: 1.3,
            }}>
              Cash investis
            </p>
            {isOwner && <PlusCircle />}
          </div>

          {loading ? (
            <Spinner />
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 2 }}>
                <p style={{ fontSize: cash !== null && cash >= 10000 ? 34 : 40, fontWeight: 900, color: "#ffffff", letterSpacing: "-2px", lineHeight: 1 }}>
                  {fmtCash(cash ?? 0)}
                </p>
                <Euro style={{ width: 18, height: 18, color: "rgba(255,255,255,0.60)", marginBottom: 2 }} />
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.28)", lineHeight: 1.3 }}>
                {isOwner ? "↓ Appuyer pour modifier" : "investi au total"}
              </p>
            </div>
          )}
        </motion.div>

        {/* ── Carte 3 : Heures ~total investis ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.14 }}
          style={{
            ...cardStyle,
            cursor: isOwner ? "pointer" : "default",
          }}
          onClick={() => isOwner && setShowHoursModal(true)}
          whileTap={isOwner ? { scale: 0.97 } : {}}
        >
          {/* Gradient décoratif */}
          <div style={{
            position: "absolute", bottom: -20, right: -16,
            width: 80, height: 80, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{
              fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.40)",
              letterSpacing: "0.09em", textTransform: "uppercase", lineHeight: 1.3,
            }}>
              Heure ~total
            </p>
            {isOwner && <PlusCircle />}
          </div>

          {loading ? (
            <Spinner />
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 2 }}>
                <p style={{ fontSize: 40, fontWeight: 900, color: "#ffffff", letterSpacing: "-2px", lineHeight: 1 }}>
                  {fmtHours(hours ?? 0)}
                </p>
                <span style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.35)", lineHeight: 1 }}>h</span>
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.28)", lineHeight: 1.3 }}>
                {isOwner ? "↓ Appuyer pour modifier" : "investies au total"}
              </p>
            </div>
          )}
        </motion.div>

      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCashModal && (
          <StatModal
            key="cash-modal"
            title="Cash investis"
            icon={<Euro style={{ width: 22, height: 22, color: "#818cf8" }} />}
            unit="€"
            currentTotal={cash ?? 0}
            onUpdate={handleUpdateCash}
            onClose={() => setShowCashModal(false)}
          />
        )}
        {showHoursModal && (
          <StatModal
            key="hours-modal"
            title="Heures investies"
            icon={<Clock style={{ width: 22, height: 22, color: "#818cf8" }} />}
            unit="h"
            currentTotal={hours ?? 0}
            onUpdate={handleUpdateHours}
            onClose={() => setShowHoursModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}