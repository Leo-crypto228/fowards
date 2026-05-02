import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Loader2, AlertCircle, CheckCircle2, Mail, RefreshCw, ArrowLeft,
} from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../api/supabaseClient";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };

const RESEND_COOLDOWN = 60;
const CODE_LENGTH = 8;

export function VerifyEmailPage() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const stateEmail = (location.state as { email?: string; mode?: string } | null)?.email || "";
  const stateMode  = (location.state as { email?: string; mode?: string } | null)?.mode  || "login";

  const [email] = useState(() => stateEmail || sessionStorage.getItem("ff_verify_email") || "");
  const [mode]  = useState(() => stateMode  || sessionStorage.getItem("ff_verify_mode")  || "login");

  useEffect(() => {
    if (email) sessionStorage.setItem("ff_verify_email", email);
    if (mode)  sessionStorage.setItem("ff_verify_mode",  mode);
  }, [email, mode]);

  // Redirect si déjà connecté
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      sessionStorage.removeItem("ff_verify_email");
      sessionStorage.removeItem("ff_verify_mode");
      const redirectAfterAuth = sessionStorage.getItem("ff_redirect_after_auth");
      if (redirectAfterAuth && redirectAfterAuth !== "/" && user.onboardingDone) {
        sessionStorage.removeItem("ff_redirect_after_auth");
        navigate(redirectAfterAuth, { replace: true });
      } else {
        navigate(user.onboardingDone ? "/" : "/onboarding", { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  // Redirect si pas d'email
  useEffect(() => {
    if (!authLoading && !email) navigate("/login", { replace: true });
  }, [email, authLoading, navigate]);

  // ── Code state ─────────────────────────────────────────────────────────────
  const [digits, setDigits]       = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [verified,  setVerified]  = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null); // erreur vérif code
  const [resendError, setResendError] = useState<string | null>(null); // erreur renvoi

  // Resend
  const [resending,     setResending]     = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [countdown,     setCountdown]     = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-focus premier input
  useEffect(() => {
    if (!authLoading && email) {
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    }
  }, [authLoading, email]);

  // ── Vérification du code ───────────────────────────────────────────────────
  const verifyCode = useCallback(async (code: string) => {
    if (verifying || verified) return;
    setVerifying(true);
    setVerifyError(null);
    setResendError(null);

    try {
      const res = await fetch(`${BASE}/auth/verify-otp`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Code incorrect ou expiré.");
      }

      const { access_token, refresh_token } = data;

      // Injecter la session dans le client Supabase → AuthContext se met à jour automatiquement
      const { error: sessionErr } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessionErr) throw new Error(`Erreur session: ${sessionErr.message}`);

      setVerified(true);
      sessionStorage.removeItem("ff_verify_email");
      sessionStorage.removeItem("ff_verify_mode");
      // La redirection est gérée par le useEffect qui surveille `user`
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue.";
      setVerifyError(msg);
      // Vider les cases + refocus
      setDigits(Array(CODE_LENGTH).fill(""));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setVerifying(false);
    }
  }, [verifying, verified, email]);

  // ── Gestion des inputs ─────────────────────────────────────────────────────
  const handleChange = (index: number, value: string) => {
    // Accepter seulement les chiffres
    const digit = value.replace(/\D/g, "").slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);
    setVerifyError(null);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-vérifier quand tous les chiffres sont saisis
    if (digit && next.every((d) => d !== "")) {
      verifyCode(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      const code = digits.join("");
      if (code.length === CODE_LENGTH) verifyCode(code);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    setVerifyError(null);
    const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
    if (pasted.length === CODE_LENGTH) verifyCode(pasted);
  };

  // ── Renvoi du code ─────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (resending || countdown > 0) return;
    setResending(true);
    setResendError(null);
    setVerifyError(null);

    try {
      const res = await fetch(`${BASE}/auth/resend-otp`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Transformer le message de rate limit Supabase en message user-friendly
        const raw = data.error || "Erreur lors du renvoi.";
        const isRateLimit = raw.toLowerCase().includes("security purposes") || raw.toLowerCase().includes("seconds");
        throw new Error(isRateLimit
          ? "Patiente quelques secondes avant de renvoyer un code."
          : raw);
      }

      setResendSuccess(true);
      setCountdown(RESEND_COOLDOWN);
      setDigits(Array(CODE_LENGTH).fill(""));
      setTimeout(() => {
        setResendSuccess(false);
        inputRefs.current[0]?.focus();
      }, 3000);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Impossible de renvoyer le code.");
    } finally {
      setResending(false);
    }
  }, [resending, countdown, email]);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const maskEmail = (e: string) => {
    const [local, domain] = e.split("@");
    if (!domain) return e;
    const visible = local.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(0, local.length - 2))}@${domain}`;
  };

  if (authLoading || !email) {
    return (
      <div style={{ minHeight: "100vh", background: "#000000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 28, height: 28, color: "#8b5cf6", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const codeComplete = digits.every((d) => d !== "");

  return (
    <div style={{
      minHeight: "100vh",
      background: "#000000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Aurora */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(139,92,246,0.18) 0%, transparent 70%)",
      }} />
      <div style={{
        position: "absolute", bottom: "-10%", right: "-10%", width: 400, height: 400,
        borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0, 0.35, 1] }}
        style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f0f0f5", margin: 0, letterSpacing: "-0.5px" }}>
            FuturFeed
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", margin: "6px 0 0" }}>
            Construis ton futur, jour après jour.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 24,
          padding: "36px 28px",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.50)",
          textAlign: "center",
        }}>

          {/* Icône email */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 320, damping: 22 }}
            style={{
              width: 64, height: 64, borderRadius: "50%",
              background: verified ? "rgba(34,197,94,0.14)" : "rgba(139,92,246,0.14)",
              border: `1px solid ${verified ? "rgba(34,197,94,0.28)" : "rgba(139,92,246,0.28)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
              transition: "background 0.3s, border-color 0.3s",
            }}
          >
            <motion.div
              animate={verified ? { scale: [1, 1.2, 1] } : { y: [0, -4, 0] }}
              transition={verified
                ? { duration: 0.4, ease: "easeOut" }
                : { repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            >
              {verified
                ? <CheckCircle2 style={{ width: 26, height: 26, color: "#22c55e" }} />
                : <Mail style={{ width: 26, height: 26, color: "#8b5cf6" }} />}
            </motion.div>
          </motion.div>

          {/* Titre */}
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f5", margin: "0 0 8px" }}>
            {verified ? "Connexion réussie ! 🎉" : "Entre ton code"}
          </h2>

          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", margin: "0 0 4px", lineHeight: 1.6 }}>
            {verified
              ? "Tu vas être redirigé…"
              : "Code à 8 chiffres envoyé à"}
          </p>
          {!verified && (
            <p style={{
              fontSize: 15, fontWeight: 600,
              color: "rgba(165,180,252,0.85)",
              margin: "0 0 12px",
              wordBreak: "break-all",
            }}>
              {maskEmail(email)}
            </p>
          )}
          {!verified && (
            <p style={{
              fontSize: 12,
              color: "rgba(144,144,168,0.45)",
              margin: "0 0 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}>
              <span>📬</span> Vérifie dans tes spams si tu ne le reçois pas
            </p>
          )}

          {/* ── Cases de code ── */}
          {!verified && (
            <>
              <div style={{
                display: "flex",
                gap: 7,
                justifyContent: "center",
                marginBottom: 24,
              }}>
                {digits.map((digit, i) => (
                  <motion.input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    disabled={verifying || verified}
                    whileFocus={{ scale: 1.06 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    style={{
                      width: 38,
                      height: 50,
                      textAlign: "center",
                      fontSize: 20,
                      fontWeight: 700,
                      color: digit ? "#f0f0f5" : "rgba(255,255,255,0.25)",
                      background: digit
                        ? "rgba(139,92,246,0.14)"
                        : "rgba(255,255,255,0.05)",
                      border: verifyError
                        ? "1.5px solid rgba(239,68,68,0.55)"
                        : digit
                        ? "1.5px solid rgba(139,92,246,0.50)"
                        : "1.5px solid rgba(255,255,255,0.10)",
                      borderRadius: 12,
                      outline: "none",
                      caretColor: "transparent",
                      transition: "border-color 0.18s, background 0.18s",
                      cursor: verifying ? "not-allowed" : "text",
                      letterSpacing: 0,
                    }}
                  />
                ))}
              </div>

              {/* Erreur vérification code */}
              <AnimatePresence>
                {verifyError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 8,
                      padding: "10px 14px", borderRadius: 12,
                      background: "rgba(239,68,68,0.10)",
                      border: "0.5px solid rgba(239,68,68,0.25)",
                      textAlign: "left",
                    }}
                  >
                    <AlertCircle style={{ width: 14, height: 14, color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 13, color: "rgba(239,68,68,0.90)", lineHeight: 1.45 }}>{verifyError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bouton vérifier (si rempli mais pas auto-soumis) */}
              <AnimatePresence>
                {codeComplete && !verifying && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    onClick={() => verifyCode(digits.join(""))}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      width: "100%",
                      padding: "15px",
                      borderRadius: 14,
                      background: "#8b5cf6",
                      border: "none",
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: "pointer",
                      marginBottom: 20,
                      boxShadow: "0 4px 20px rgba(139,92,246,0.35)",
                      transition: "background 0.2s",
                    }}
                  >
                    Vérifier le code
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Loader vérification */}
              {verifying && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  marginBottom: 20, color: "rgba(139,92,246,0.75)", fontSize: 14,
                }}>
                  <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                  Vérification…
                </div>
              )}

              {/* Succès renvoi */}
              <AnimatePresence>
                {resendSuccess && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 14 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 14px", borderRadius: 12,
                      background: "rgba(34,197,94,0.10)",
                      border: "0.5px solid rgba(34,197,94,0.25)",
                    }}
                  >
                    <CheckCircle2 style={{ width: 14, height: 14, color: "#22c55e", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "rgba(34,197,94,0.90)" }}>
                      Nouveau code envoyé à {maskEmail(email)} !
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Renvoyer */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 18, marginTop: 4 }}>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.30)", margin: "0 0 8px" }}>
                  Tu n'as pas reçu le code ?
                </p>
                <motion.button
                  onClick={handleResend}
                  disabled={resending || countdown > 0}
                  whileTap={(!resending && countdown === 0) ? { scale: 0.96 } : {}}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: (resending || countdown > 0) ? "not-allowed" : "pointer",
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 14, fontWeight: 600,
                    color: countdown > 0
                      ? "rgba(139,92,246,0.35)"
                      : "rgba(139,92,246,0.85)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    transition: "color 0.18s",
                  }}
                >
                  {resending
                    ? <><Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> Envoi…</>
                    : countdown > 0
                    ? <><RefreshCw style={{ width: 13, height: 13 }} /> Renvoyer dans {countdown}s</>
                    : <><RefreshCw style={{ width: 13, height: 13 }} /> Renvoyer le code</>
                  }
                </motion.button>

                {/* Erreur renvoi (séparée, sous le bouton) */}
                <AnimatePresence>
                  {resendError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 6,
                        marginTop: 10, padding: "10px 12px", borderRadius: 10,
                        background: "rgba(234,179,8,0.10)",
                        border: "0.5px solid rgba(234,179,8,0.25)",
                        textAlign: "left",
                      }}
                    >
                      <AlertCircle style={{ width: 13, height: 13, color: "#eab308", flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <span style={{ fontSize: 12, color: "rgba(234,179,8,0.85)", lineHeight: 1.5, display: "block" }}>{resendError}</span>
                        {resendError.includes("heure") && (
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.4, display: "block", marginTop: 4 }}>
                            💡 Solution : configure un SMTP custom dans{" "}
                            <a href="https://supabase.com/dashboard/project/_/settings/auth" target="_blank" rel="noreferrer"
                              style={{ color: "rgba(139,92,246,0.75)", textDecoration: "underline" }}>
                              Supabase Auth Settings
                            </a>
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>

        {/* Retour */}
        {!verified && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Link
              to={mode === "signup" ? "/signup" : "/login"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 14, color: "rgba(255,255,255,0.35)", textDecoration: "none", fontWeight: 500,
              }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              {mode === "signup" ? "Retour à l'inscription" : "Retour à la connexion"}
            </Link>
          </div>
        )}
      </motion.div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input[type="text"]:focus {
          border-color: rgba(139,92,246,0.65) !important;
          background: rgba(139,92,246,0.10) !important;
        }
      `}</style>
    </div>
  );
}