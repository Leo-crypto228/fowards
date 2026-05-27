import type { QuotaStatus } from "../api/aiApi";

interface Props {
  quota: QuotaStatus;
  compact?: boolean;
}

export function QuotaBar({ quota, compact = false }: Props) {
  const normalPct = Math.round((quota.normalUsed / quota.normalLimit) * 100);

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "rgba(235,235,245,0.5)" }}>
        <span>{quota.normalRemaining} msg</span>
        <span>·</span>
        <span>{quota.diagnosticsRemaining} diag</span>
        {quota.diagnosticsUnlockedViaPost && (
          <span style={{ color: "#a78bfa", fontSize: 11 }}>🔓 +1 débloqué</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "0.5px solid rgba(255,255,255,0.08)" }}>
      {/* Normal messages */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "rgba(235,235,245,0.6)" }}>Messages normaux</span>
          <span style={{ fontSize: 12, color: "rgba(235,235,245,0.8)", fontWeight: 600 }}>
            {quota.normalUsed}/{quota.normalLimit}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${normalPct}%`,
              borderRadius: 999,
              background: normalPct >= 90 ? "#ef4444" : normalPct >= 70 ? "#f59e0b" : "#6366f1",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Diagnostics */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "rgba(235,235,245,0.6)" }}>Diagnostics</span>
          {quota.diagnosticsUnlockedViaPost && (
            <span style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 999,
              background: "rgba(167,139,250,0.15)", color: "#a78bfa",
              border: "0.5px solid rgba(167,139,250,0.3)",
            }}>
              🔓 +1 post
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: "rgba(235,235,245,0.8)", fontWeight: 600 }}>
          {quota.diagnosticsUsed}/{quota.diagnosticsLimit}
        </span>
      </div>

      {!quota.diagnosticsUnlockedViaPost && quota.diagnosticsRemaining === 0 && (
        <p style={{ fontSize: 11, color: "rgba(235,235,245,0.4)", marginTop: 6, marginBottom: 0 }}>
          💡 Publie un post ≥50 chars pour débloquer +1 diagnostic
        </p>
      )}
    </div>
  );
}
