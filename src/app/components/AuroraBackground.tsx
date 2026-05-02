/**
 * AuroraBackground — fond aurora ancré en haut de page (suit le scroll).
 * Couleurs au sommet (orange → rouge → rose → violet → bleu)
 * qui disparaissent progressivement dans le noir en descendant.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "70vh",
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* ── Couche aurora colorée ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "55vh",
          background: [
            "radial-gradient(ellipse 120% 60% at 15% -5%, rgba(249,115,22,0.72) 0%, transparent 55%)",
            "radial-gradient(ellipse 100% 50% at 85% -10%, rgba(239,68,68,0.65) 0%, transparent 52%)",
            "radial-gradient(ellipse 110% 55% at 50% 5%,  rgba(236,72,153,0.70) 0%, transparent 58%)",
            "radial-gradient(ellipse 90%  45% at 20% 30%, rgba(99,102,241,0.60) 0%, transparent 55%)",
            "radial-gradient(ellipse 95%  50% at 80% 25%, rgba(59,130,246,0.55)  0%, transparent 52%)",
            "radial-gradient(ellipse 80%  40% at 60% 10%, rgba(168,85,247,0.60)  0%, transparent 50%)",
          ].join(","),
          filter: "blur(32px) saturate(1.4)",
        }}
      />

      {/* ── Fondu vers le noir en bas ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(to bottom, transparent 0%, transparent 25%, rgba(0,0,0,0.55) 55%, #000000 100%)",
        }}
      />
    </div>
  );
}