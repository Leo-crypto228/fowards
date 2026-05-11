import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Loader2, AlertCircle, Eye, EyeOff, Check,
  ArrowLeft, Mail,
} from "lucide-react";
import exampleImage from "figma:asset/cd3b49eafdee7adc585eb4cea8cc18850443b810.png";
import { useNavigate, useLocation, Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import { normalizeUsername } from "../api/profileCache";
import { supabase } from "../api/supabaseClient";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` };
const CODE_LENGTH     = 8;
const RESEND_COOLDOWN = 60;

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen = "landing" | "signup" | "login" | "forgot-password";

// ── Star mascot SVG ───────────────────────────────────────────────────────────
function StarMascot() {
  return (
    <>
      {/* Filtre SVG : rend les pixels noirs transparents */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="remove-black">
            <feColorMatrix type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      1 1 1 1 -1" />
          </filter>
        </defs>
      </svg>
      <img
        src={exampleImage}
        alt="Fowards mascot"
        style={{
          width: 225,
          height: 225,
          objectFit: "contain",
          display: "block",
          filter: "url(#remove-black)",
        }}
      />
    </>
  );
}

// ── Floating stars background ─────────────────────────────────────────────────
const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2.2 + 0.5,
  opacity: Math.random() * 0.55 + 0.1,
  delay: Math.random() * 4,
  duration: Math.random() * 3 + 2,
}));

function StarField() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {STARS.map((s) => (
        <motion.div
          key={s.id}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "white",
            opacity: s.opacity,
          }}
          animate={{ opacity: [s.opacity, s.opacity * 0.3, s.opacity] }}
          transition={{ repeat: Infinity, duration: s.duration, delay: s.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── Shared input style ────────────────────────────────────────────────────────
const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  padding: "14px 16px",
  fontSize: 15,
  color: "rgba(235,235,245,0.92)",
  outline: "none",
  transition: "border-color 0.18s",
  caretColor: "#8b5cf6",
  WebkitAppearance: "none",
  boxSizing: "border-box",
};

// ── Main component ────────────────────────────────────────────────────────────
export function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [screen, setScreen] = useState<Screen>("landing");

  // Lire le paramètre redirect depuis l'URL (?redirect=/profile/username)
  const redirectParam = new URLSearchParams(location.search).get("redirect") || "";

  // Persister le redirect en sessionStorage pour le retrouver après vérification OTP
  useEffect(() => {
    if (redirectParam) {
      sessionStorage.setItem("ff_redirect_after_auth", redirectParam);
    }
  }, [redirectParam]);

  // ── Redirect if already logged in ─────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (user) {
      if (!user.onboardingDone) {
        navigate("/onboarding", { replace: true });
        return;
      }
      if (!user.firstPostCreated) {
        navigate("/first-post", { replace: true });
        return;
      }
      const stored = sessionStorage.getItem("ff_redirect_after_auth");
      if (stored && stored !== "/") {
        sessionStorage.removeItem("ff_redirect_after_auth");
        navigate(stored, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  // ── "Se connecter" click ──────────────────────────────────────────────────
  const handleConnectClick = () => setScreen("login");

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 28, height: 28, color: "#8b5cf6", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#050508",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Starfield */}
      <StarField />

      {/* Subtle violet glow top */}
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: "70%", height: 340,
        background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.13) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* FuturFeed top-left brand */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          position: "absolute", top: 24, left: 24, zIndex: 10,
          fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px",
        }}
      >
        <span translate="no" className="notranslate">Fowards</span>
      </motion.div>

      {/* ── Screens ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {screen === "landing" ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.25, 0, 0.35, 1] }}
            style={{
              position: "relative", zIndex: 1,
              display: "flex", flexDirection: "column",
              alignItems: "center", textAlign: "center",
              width: "100%", maxWidth: 640,
              gap: 0,
            }}
          >
            {/* Mascot */}
            <div style={{ marginBottom: 20 }}>
              <StarMascot />
            </div>

            {/* Tagline */}
            <h1 style={{
              fontSize: "clamp(30px, 6.5vw, 46px)",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.18,
              letterSpacing: "-0.8px",
              margin: "0 0 44px",
              textAlign: "center",
            }}>
              Plonge dans la manière<br />dont avance vraiment les entrepreneurs
            </h1>

            {/* CTA — Rejoins FF */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => setScreen("signup")}
              style={{
                width: "100%", maxWidth: 320,
                padding: "17px 28px",
                borderRadius: 100,
                background: "#ffffff",
                border: "none",
                color: "#0a0a12",
                fontSize: 17,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "-0.1px",
                boxShadow: "0 4px 32px rgba(255,255,255,0.12), 0 1px 0 rgba(255,255,255,0.9) inset",
                transition: "box-shadow 0.2s",
                marginBottom: 20,
              }}
            >
              Plonge à ton tour
            </motion.button>

            {/* Separator */}
            <p style={{
              fontSize: 14,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.40)",
              margin: "0 0 18px",
            }}>
              Déjà un compte ?
            </p>

            {/* CTA — Se connecter */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={handleConnectClick}
              style={{
                width: "100%", maxWidth: 320,
                padding: "16px 28px",
                borderRadius: 100,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#ffffff",
                fontSize: 17,
                fontWeight: 700,
                cursor: "pointer",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                letterSpacing: "-0.1px",
                boxShadow: "0 2px 20px rgba(0,0,0,0.30)",
                transition: "background 0.2s, border-color 0.2s",
              }}
            >
              Se connecter
            </motion.button>

            {/* Fine print */}
            <p style={{
              fontSize: 11, color: "rgba(255,255,255,0.18)",
              margin: "32px 0 0",
              lineHeight: 1.6,
              maxWidth: 300,
            }}>
En rejoignant <span translate="no" className="notranslate">Fowards</span>, tu acceptes nos{" "}
              <Link to="/mentions-legales" style={{ color: "rgba(255,255,255,0.35)" }}>mentions légales</Link>,{" "}
              <Link to="/conditions" style={{ color: "rgba(255,255,255,0.35)" }}>conditions</Link>{" "}
              et notre{" "}
              <Link to="/politique-confidentialite" style={{ color: "rgba(255,255,255,0.35)" }}>politique de confidentialité</Link>.
            </p>
          </motion.div>
        ) : screen === "signup" ? (
          <SignupPanel
            key="signup"
            onBack={() => setScreen("landing")}
            onNavigate={(path, state) => navigate(path, { state })}
          />
        ) : screen === "login" ? (
          <LoginPanel
            key="login"
            onBack={() => setScreen("landing")}
            onForgotPassword={() => setScreen("forgot-password")}
          />
        ) : (
          <ForgotPasswordPanel
            key="forgot-password"
            onBack={() => setScreen("login")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNUP PANEL
// ═══════════════════════════════════════════════════════════════════════════════
interface SignupPanelProps {
  onBack: () => void;
  onNavigate: (path: string, state?: object) => void;
}

function SignupPanel({ onBack, onNavigate }: SignupPanelProps) {
  const [name,     setName]     = useState("");
  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [pending,  setPending]  = useState(false);
  const [step,     setStep]     = useState<"creating" | "sending" | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!username || username === normalizeUsername(name)) {
      setUsername(normalizeUsername(val));
    }
  };

  const validate = () => {
    if (!name.trim())            return "Le nom complet est requis.";
    if (!username.trim())        return "Le nom d'utilisateur est requis.";
    const norm = normalizeUsername(username);
    if (norm.length < 3)         return "Le nom d'utilisateur doit faire au moins 3 caractères.";
    if (!email.trim())           return "L'email est requis.";
    if (!email.includes("@"))    return "L'email n'est pas valide.";
    if (password.length < 6)     return "Le mot de passe doit contenir au moins 6 caractères.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setPending(true);

    try {
      setStep("creating");
      await new Promise((r) => setTimeout(r, 300));

      const res = await fetch(`${BASE}/auth/signup`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
          email:      email.trim(),
          password,
          username:   normalizeUsername(username),
          name:       name.trim(),
          redirectTo: `${window.location.origin}/auth/callback`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || `Erreur serveur (${res.status})`;
        if (res.status === 409) {
          throw new Error(errMsg + " → Utilise « Connexion » ci-dessous.");
        }
        throw new Error(errMsg);
      }

      setStep("sending");
      await new Promise((r) => setTimeout(r, 400));

      onNavigate("/verify-email", { email: email.trim(), mode: "signup" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setError(msg);
      setStep(null);
    } finally {
      setPending(false);
    }
  };

  const buttonLabel = () => {
    if (!pending) return "Créer mon compte";
    if (step === "creating") return <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Création…</>;
    if (step === "sending")  return <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Envoi du code…</>;
    return <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Création…</>;
  };

  return (
    <PanelWrapper onBack={onBack} title="Rejoins FF" subtitle="Commence à construire ton futur aujourd'hui.">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Nom complet */}
        <Field label="Nom complet">
          <input
            type="text" value={name}
            onChange={(e) => { handleNameChange(e.target.value); setError(null); }}
            placeholder="Thomas Dubois"
            autoComplete="name"
            style={INPUT_STYLE}
            className="focus:border-violet-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
          />
        </Field>

        {/* Username */}
        <Field label="Nom d'utilisateur">
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              fontSize: 15, color: "rgba(255,255,255,0.30)", pointerEvents: "none",
            }}>@</span>
            <input
              type="text" value={username}
              onChange={(e) => { setUsername(normalizeUsername(e.target.value)); setError(null); }}
              placeholder="thomasdubois"
              autoComplete="username"
              style={{ ...INPUT_STYLE, paddingLeft: 28 }}
              className="focus:border-violet-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
            />
          </div>
          {username && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", margin: "5px 0 0 4px" }}>
              @{normalizeUsername(username)}
            </p>
          )}
        </Field>

        {/* Email */}
        <Field label="Email">
          <input
            type="email" value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="ton@email.com"
            autoComplete="email"
            style={INPUT_STYLE}
            className="focus:border-violet-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
          />
        </Field>

        {/* Mot de passe */}
        <Field label="Mot de passe">
          <div style={{ position: "relative" }}>
            <input
              type={showPwd ? "text" : "password"} value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="Au moins 6 caractères"
              autoComplete="new-password"
              style={{ ...INPUT_STYLE, paddingRight: 46 }}
              className="focus:border-violet-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
            />
            <button
              type="button" onClick={() => setShowPwd((v) => !v)}
              style={{
                position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: "rgba(255,255,255,0.30)",
              }}
            >
              {showPwd ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        </Field>

        {/* Info */}
        <div style={{
          padding: "10px 14px", borderRadius: 12,
          background: "rgba(139,92,246,0.08)",
          border: "0.5px solid rgba(139,92,246,0.20)",
        }}>
          <span style={{ fontSize: 12, color: "rgba(165,180,252,0.70)", lineHeight: 1.5 }}>
            Un code de vérification à 8 chiffres sera envoyé à ton email.
          </span>
        </div>

        {/* Erreur */}
        <ErrorBox error={error} />

        {/* Submit */}
        <motion.button
          type="submit" disabled={pending}
          whileTap={!pending ? { scale: 0.97 } : {}}
          style={{
            width: "100%", padding: "15px", borderRadius: 100,
            background: pending ? "rgba(139,92,246,0.50)" : "#8b5cf6",
            border: "none", color: "#fff",
            fontSize: 16, fontWeight: 700,
            cursor: pending ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: pending ? "none" : "0 4px 20px rgba(139,92,246,0.35)",
            marginTop: 4,
            transition: "background 0.2s, box-shadow 0.2s",
          }}
        >
          {buttonLabel()}
        </motion.button>

        {/* Progression */}
        <AnimatePresence>
          {pending && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {[
                { key: "creating", label: "Création du compte",           done: step === "sending" },
                { key: "sending",  label: "Envoi du code de vérification", done: false },
              ].map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: s.done
                      ? "rgba(34,197,94,0.20)" : step === s.key
                      ? "rgba(139,92,246,0.20)" : "rgba(255,255,255,0.06)",
                    border: s.done
                      ? "1px solid rgba(34,197,94,0.40)" : step === s.key
                      ? "1px solid rgba(139,92,246,0.40)" : "1px solid rgba(255,255,255,0.10)",
                  }}>
                    {s.done
                      ? <Check style={{ width: 10, height: 10, color: "#22c55e" }} />
                      : step === s.key
                      ? <Loader2 style={{ width: 10, height: 10, color: "#8b5cf6", animation: "spin 1s linear infinite" }} />
                      : null}
                  </div>
                  <span style={{
                    fontSize: 12,
                    color: s.done
                      ? "rgba(34,197,94,0.75)" : step === s.key
                      ? "rgba(165,180,252,0.75)" : "rgba(255,255,255,0.25)",
                  }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </PanelWrapper>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
interface LoginPanelProps {
  onBack: () => void;
  onForgotPassword: () => void;
}

function LoginPanel({ onBack, onForgotPassword }: LoginPanelProps) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [pending,  setPending]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);

    const trimmed = email.trim();
    if (!trimmed)               { setError("L'email est requis."); return; }
    if (!trimmed.includes("@")) { setError("L'email n'est pas valide."); return; }
    if (!password)              { setError("Le mot de passe est requis."); return; }

    setPending(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (authError) throw new Error(authError.message);
      // AuthContext onAuthStateChange handles the redirect automatically
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue.";
      const low = msg.toLowerCase();
      if (low.includes("invalid login credentials") || low.includes("invalid credentials") || low.includes("email not confirmed")) {
        setError("Email ou mot de passe incorrect.");
      } else if (low.includes("load failed") || low.includes("failed to fetch") || low.includes("network") || low.includes("fetch")) {
        setError("Connexion au serveur impossible. Vérifie ta connexion internet et réessaie.");
      } else {
        setError(msg);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <PanelWrapper onBack={onBack} title="Se connecter" subtitle="Connecte-toi avec ton email et ton mot de passe.">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Email">
          <div style={{ position: "relative" }}>
            <input
              type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="ton@email.com"
              autoComplete="email"
              style={{ ...INPUT_STYLE, paddingLeft: 44 }}
              className="focus:border-violet-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
            />
            <Mail style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              width: 16, height: 16, color: "rgba(139,92,246,0.50)", pointerEvents: "none",
            }} />
          </div>
        </Field>

        <Field label="Mot de passe">
          <div style={{ position: "relative" }}>
            <input
              type={showPwd ? "text" : "password"} value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="Ton mot de passe"
              autoComplete="current-password"
              style={{ ...INPUT_STYLE, paddingRight: 46 }}
              className="focus:border-violet-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
            />
            <button
              type="button" onClick={() => setShowPwd((v) => !v)}
              style={{
                position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: "rgba(255,255,255,0.30)",
              }}
            >
              {showPwd ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        </Field>

        {/* Mot de passe oublié */}
        <div style={{ textAlign: "right", marginTop: -6 }}>
          <button
            type="button"
            onClick={onForgotPassword}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontSize: 12, color: "rgba(165,180,252,0.65)",
              fontWeight: 500,
            }}
          >
            Mot de passe oublié ?
          </button>
        </div>

        <ErrorBox error={error} />

        <motion.button
          type="submit" disabled={pending}
          whileTap={!pending ? { scale: 0.97 } : {}}
          style={{
            width: "100%", padding: "15px", borderRadius: 100,
            background: pending ? "rgba(79,70,229,0.50)" : "#4f46e5",
            border: "none", color: "#fff",
            fontSize: 16, fontWeight: 700,
            cursor: pending ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: pending ? "none" : "0 4px 20px rgba(79,70,229,0.30)",
            marginTop: 4,
            transition: "background 0.2s",
          }}
        >
          {pending
            ? <><Loader2 style={{ width: 17, height: 17, animation: "spin 1s linear infinite" }} /> Connexion…</>
            : "Se connecter"}
        </motion.button>
      </form>
    </PanelWrapper>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD PANEL
// ═══════════════════════════════════════════════════════════════════════════════
interface ForgotPasswordPanelProps {
  onBack: () => void;
}

function ForgotPasswordPanel({ onBack }: ForgotPasswordPanelProps) {
  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);

    const trimmed = email.trim();
    if (!trimmed)               { setError("L'email est requis."); return; }
    if (!trimmed.includes("@")) { setError("L'email n'est pas valide."); return; }

    setPending(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (authError) throw new Error(authError.message);
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue.";
      const low = msg.toLowerCase();
      if (low.includes("load failed") || low.includes("failed to fetch") || low.includes("network")) {
        setError("Connexion au serveur impossible. Vérifie ta connexion et réessaie.");
      } else {
        setError(msg);
      }
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <PanelWrapper onBack={onBack} title="Email envoyé !" subtitle="Vérifie ta boîte mail pour réinitialiser ton mot de passe.">
        <div style={{
          padding: "20px 0", textAlign: "center",
          display: "flex", flexDirection: "column", gap: 16, alignItems: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Check style={{ width: 24, height: 24, color: "#22c55e" }} />
          </div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", margin: 0, lineHeight: 1.6 }}>
            Un lien de réinitialisation a été envoyé à <strong style={{ color: "rgba(255,255,255,0.75)" }}>{email.trim()}</strong>.
            Clique sur le lien dans l'email pour choisir un nouveau mot de passe.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onBack}
            style={{
              marginTop: 8,
              padding: "13px 28px", borderRadius: 100,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "#fff", fontSize: 15, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retour à la connexion
          </motion.button>
        </div>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper onBack={onBack} title="Mot de passe oublié" subtitle="Saisis ton email pour recevoir un lien de réinitialisation.">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Email">
          <div style={{ position: "relative" }}>
            <input
              type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="ton@email.com"
              autoComplete="email"
              style={{ ...INPUT_STYLE, paddingLeft: 44 }}
              className="focus:border-violet-500/60 placeholder:text-[rgba(144,144,168,0.35)]"
            />
            <Mail style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              width: 16, height: 16, color: "rgba(139,92,246,0.50)", pointerEvents: "none",
            }} />
          </div>
        </Field>

        <ErrorBox error={error} />

        <motion.button
          type="submit" disabled={pending}
          whileTap={!pending ? { scale: 0.97 } : {}}
          style={{
            width: "100%", padding: "15px", borderRadius: 100,
            background: pending ? "rgba(79,70,229,0.50)" : "#4f46e5",
            border: "none", color: "#fff",
            fontSize: 16, fontWeight: 700,
            cursor: pending ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: pending ? "none" : "0 4px 20px rgba(79,70,229,0.30)",
            marginTop: 4,
            transition: "background 0.2s",
          }}
        >
          {pending
            ? <><Loader2 style={{ width: 17, height: 17, animation: "spin 1s linear infinite" }} /> Envoi…</>
            : "Envoyer le lien"}
        </motion.button>
      </form>
    </PanelWrapper>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED PANEL WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════
interface PanelWrapperProps {
  onBack: () => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function PanelWrapper({ onBack, title, subtitle, children }: PanelWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0, 0.35, 1] }}
      style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}
    >
      {/* Back button */}
      <motion.button
        onClick={onBack}
        whileTap={{ scale: 0.94 }}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: "6px 0",
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "rgba(255,255,255,0.38)", fontWeight: 500,
          marginBottom: 20,
        }}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} /> Retour
      </motion.button>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f0f0f5", margin: "0 0 6px", letterSpacing: "-0.4px" }}>
          {title}
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0, lineHeight: 1.5 }}>
          {subtitle}
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 24,
        padding: "30px 28px",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.50)",
      }}>
        {children}
      </div>
    </motion.div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        fontSize: 13, fontWeight: 600,
        color: "rgba(255,255,255,0.55)",
        display: "block", marginBottom: 7,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Error box ─────────────────────────────────────────────────────────────────
function ErrorBox({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "10px 14px", borderRadius: 12,
            background: "rgba(239,68,68,0.10)",
            border: "0.5px solid rgba(239,68,68,0.25)",
          }}
        >
          <AlertCircle style={{ width: 14, height: 14, color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: "rgba(239,68,68,0.90)", lineHeight: 1.45 }}>{error}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}