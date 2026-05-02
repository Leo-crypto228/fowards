import { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ObjectifProps {
  index: number;
  title: string;
  subtitle: string;
  description: string;
  progress: number; // 0–100
  progressLabel: string;
  chartData: { label: string; value: number }[];
  chartUnit: string;
  animDelay?: number;
}

// ─── Custom SVG Area Chart (no recharts — évite les clés dupliquées) ──────────

function MiniAreaChart({
  data,
  unit,
}: {
  data: { label: string; value: number }[];
  unit: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const height = 110;
  const padL = 8;
  const padR = 16;
  const padT = 4;
  const padB = 22;

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    setWidth(containerRef.current.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const values = data.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const toX = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const toY = (v: number) => padT + innerH - ((v - minV) / range) * innerH;

  const linePoints = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(" ");
  const areaPoints = [
    `${toX(0)},${padT + innerH}`,
    ...data.map((d, i) => `${toX(i)},${toY(d.value)}`),
    `${toX(data.length - 1)},${padT + innerH}`,
  ].join(" ");

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: number;
  } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left - padL;
    const idx = Math.round((mx / innerW) * (data.length - 1));
    const ci = Math.max(0, Math.min(data.length - 1, idx));
    setTooltip({
      x: toX(ci),
      y: toY(data[ci].value),
      label: data[ci].label,
      value: data[ci].value,
    });
  };

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Area fill */}
        <polygon points={areaPoints} fill="#6366f1" fillOpacity={0.18} />

        {/* Line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#818cf8"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 5px rgba(99,102,241,0.6))" }}
        />

        {/* X axis labels */}
        {data.map((d, i) => (
          <text
            key={`x-${i}`}
            x={toX(i)}
            y={height - 4}
            textAnchor="middle"
            fontSize={10}
            fill="rgba(255,255,255,0.22)"
          >
            {d.label}
          </text>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <>
            <circle
              cx={tooltip.x}
              cy={tooltip.y}
              r={4}
              fill="#818cf8"
              stroke="rgba(129,140,248,0.30)"
              strokeWidth={4}
            />
            <rect
              x={Math.min(tooltip.x - 24, width - 60)}
              y={tooltip.y - 30}
              width={52}
              height={20}
              rx={6}
              fill="rgba(15,15,20,0.92)"
              stroke="rgba(99,102,241,0.30)"
              strokeWidth={0.5}
            />
            <text
              x={Math.min(tooltip.x - 24, width - 60) + 26}
              y={tooltip.y - 16}
              textAnchor="middle"
              fontSize={10}
              fontWeight="600"
              fill="#a5b4fc"
            >
              {tooltip.value} {unit}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ─── Animated progress bar ────────────────────────────────────────────────────

function ProgressBar({ value, delay = 0 }: { value: number; delay?: number }) {
  return (
    <div
      style={{
        position: "relative",
        height: 10,
        borderRadius: 999,
        background: "rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1.1, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: "100%",
          borderRadius: 999,
          background:
            "linear-gradient(90deg, #4f46e5 0%, #818cf8 60%, #a5b4fc 100%)",
          boxShadow: "0 0 12px rgba(99,102,241,0.55)",
        }}
      />
    </div>
  );
}

// ─── Single Objectif card ─────────────────────────────────────────────────────

function ObjectifCard({
  index,
  title,
  subtitle,
  description,
  progress,
  progressLabel,
  chartData,
  chartUnit,
  animDelay = 0,
}: ObjectifProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: animDelay, ease: "easeOut" }}
    >
      <div
        style={{
          background: "#0d0d0d",
          borderRadius: 20,
          overflow: "hidden",
          border: "0.5px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* ── Top section ── */}
        <div style={{ padding: "20px 20px 18px" }}>
          {/* Index label */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(129,140,248,0.55)",
              letterSpacing: "0.13em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Objectif {index < 10 ? `0${index}` : index}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "rgba(255,255,255,0.90)",
              letterSpacing: "-0.3px",
              marginBottom: 6,
            }}
          >
            {title}
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              lineHeight: 1.55,
              marginBottom: 18,
            }}
          >
            {description}
          </div>

          {/* Progress header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.40)",
                fontWeight: 500,
              }}
            >
              {subtitle}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(165,180,252,0.90)",
              }}
            >
              {progress}%
            </span>
          </div>

          {/* Progress bar */}
          <ProgressBar value={progress} delay={animDelay + 0.3} />

          {/* Progress label */}
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "rgba(255,255,255,0.22)",
            }}
          >
            {progressLabel}
          </div>
        </div>

        {/* ── Chart section ── */}
        <div
          style={{
            borderTop: "0.5px solid rgba(255,255,255,0.05)",
            padding: "16px 0 4px",
          }}
        >
          {/* Chart label */}
          <div
            style={{
              paddingLeft: 20,
              paddingBottom: 10,
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(255,255,255,0.22)",
              textTransform: "uppercase",
              letterSpacing: "0.10em",
            }}
          >
            Évolution
          </div>

          <MiniAreaChart data={chartData} unit={chartUnit} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface TribeObjectifsProps {
  tribeName: string;
  currentMembers: number;
}

// Seed chart data
const membersChartData = [
  { label: "Sem 1", value: 12 },
  { label: "Sem 2", value: 28 },
  { label: "Sem 3", value: 45 },
  { label: "Sem 4", value: 63 },
  { label: "Sem 5", value: 89 },
  { label: "Sem 6", value: 112 },
  { label: "Sem 7", value: 148 },
  { label: "Sem 8", value: 187 },
  { label: "Sem 9", value: 219 },
  { label: "Sem 10", value: 245 },
];

const activityChartData = [
  { label: "L", value: 18 },
  { label: "M", value: 34 },
  { label: "Me", value: 27 },
  { label: "J", value: 41 },
  { label: "V", value: 38 },
  { label: "S", value: 22 },
  { label: "D", value: 31 },
];

export function TribeObjectifs({ tribeName, currentMembers }: TribeObjectifsProps) {
  const membersProgress = Math.round((currentMembers / 1000) * 100);

  // Activity: msgs today out of 50 target
  const msgsToday = 31;
  const activityProgress = Math.round((msgsToday / 50) * 100);

  return (
    <div style={{ position: "relative" }}>

      {/* ── En-tête ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mx-4"
        style={{
          background: "#0d0d0d",
          borderRadius: 20,
          padding: "24px 22px 20px",
          border: "0.5px solid rgba(255,255,255,0.07)",
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        {/* Titre principal */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "rgba(255,255,255,0.88)",
            letterSpacing: "-0.2px",
            marginBottom: 6,
          }}
        >
          Objectifs —{" "}
          <span style={{ color: "rgba(165,180,252,0.90)" }}>{tribeName}</span>
        </div>

        {/* Accroche */}
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.30)",
            fontWeight: 400,
            letterSpacing: "0.01em",
          }}
        >
          Progression visible
        </div>

        {/* Indicateur global */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            marginTop: 18,
          }}
        >
          {[
            { label: "Membres", value: currentMembers, unit: "" },
            { label: "Cible", value: "1 000", unit: "" },
            { label: "Constance", value: "87", unit: "%" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                {stat.value}
                {stat.unit}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.28)",
                  marginTop: 2,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 600,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Objectif 1 ── */}
      <div className="px-4">
        <ObjectifCard
          index={1}
          title="100 membres"
          subtitle="Croissance de la communauté"
          description="Atteindre 100 membres actifs dans cette communauté pour créer une masse critique d'entraide et de progression collective."
          progress={membersProgress}
          progressLabel={`${currentMembers} membres sur 1 000 objectif`}
          chartData={membersChartData}
          chartUnit="membres"
          animDelay={0.1}
        />
      </div>

      {/* ── Séparateur ── */}
      <div style={{ height: 16 }} />

      {/* ── Objectif 2 ── */}
      <div className="px-4">
        <ObjectifCard
          index={2}
          title="Parler, évoluer tous les jours"
          subtitle="Activité quotidienne"
          description="Encourager les membres à échanger et progresser ensemble chaque jour. Objectif : 50 messages par jour."
          progress={activityProgress}
          progressLabel={`${msgsToday} messages aujourd'hui sur 50 objectif — remet à zéro chaque jour`}
          chartData={activityChartData}
          chartUnit="msgs"
          animDelay={0.2}
        />
      </div>

      {/* Bottom padding */}
      <div style={{ height: 40 }} />
    </div>
  );
}