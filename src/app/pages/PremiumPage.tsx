import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { createCheckoutSession } from "../api/aiApi";
import { toast } from "sonner";
import { VerifiedIcon } from "../components/PremiumBadge";

type PlanKey = "starter_monthly" | "starter_annual" | "premium_monthly" | "premium_annual";

const STARTER_FEATURES = [
  "150 messages / jour",
  "1 diagnostic / jour",
  "Badge certifié",
  "Historique 30 jours",
];

const PREMIUM_FEATURES = [
  "300 messages / jour",
  "4 Diagnostics Approfondis / jour",
  "Plus de conseils et de données qu'en Starter",
  "Modules exclusifs (recherche clients, analyse concurrents)",
  "Badge certifié",
  "Historique illimité + suivi J+30",
];

export function PremiumPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<"starter" | "premium" | null>(null);

  async function handleCheckout(tier: "starter" | "premium") {
    if (!session?.access_token) {
      toast.error("Connecte-toi pour continuer");
      return;
    }
    const plan = `${tier}_${annual ? "annual" : "monthly"}` as PlanKey;
    setLoadingPlan(tier);
    try {
      const { url } = await createCheckoutSession(session.access_token, plan);
      if (!url) throw new Error("URL Stripe manquante dans la réponse");
      window.location.href = url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[PremiumPage] checkout error:", msg);
      toast.error(`Erreur: ${msg}`, { duration: 8000 });
      setLoadingPlan(null);
    }
  }

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh" }} className="flex flex-col items-center px-4 py-8 text-white relative">
      <div className="w-full" style={{ maxWidth: 460 }}>
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors mb-6">
          <ArrowLeft size={20} />
          <span className="text-sm">Retour</span>
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center mb-6">
          <div className="flex justify-center mb-3"><VerifiedIcon size={48} color="#7c3aed" /></div>
          <h1 className="text-2xl font-bold mb-1">Passe au niveau supérieur</h1>
          <p className="text-gray-400 text-sm">Débloque ton potentiel de founder</p>
        </motion.div>

        {/* Toggle mensuel/annuel commun */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="flex items-center justify-center mb-6">
          <div className="flex items-center bg-gray-900 rounded-full p-1 gap-1">
            <button onClick={() => setAnnual(false)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!annual ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}>
              Mensuel
            </button>
            <button onClick={() => setAnnual(true)} className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${annual ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}>
              Annuel
              <span className="bg-green-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">−17%</span>
            </button>
          </div>
        </motion.div>

        {/* Carte Starter */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl p-5 mb-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.12)" }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-lg font-bold">Starter</span>
            <span className="text-xl font-bold">{annual ? "99,99€" : "8,99€"}<span className="text-sm font-normal text-gray-400">/{annual ? "an" : "mois"}</span></span>
          </div>
          <ul className="space-y-2 mb-4">
            {STARTER_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center"><Check size={10} strokeWidth={3} /></div>
                <span className="text-sm text-gray-200">{f}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleCheckout("starter")}
            disabled={loadingPlan !== null}
            className="w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: "rgba(255,255,255,0.10)", border: "0.5px solid rgba(255,255,255,0.18)", color: "#fff" }}
          >
            {loadingPlan === "starter" ? <><Loader2 size={16} className="animate-spin" />Chargement…</> : "Choisir Starter"}
          </button>
        </motion.div>

        {/* Carte Premium — mise en avant */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
          className="rounded-2xl p-5 mb-6 relative"
          style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.55)" }}
        >
          <span className="absolute -top-2.5 left-5 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff" }}>
            LE PLUS POPULAIRE
          </span>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-lg font-bold flex items-center gap-1.5"><VerifiedIcon size={18} color="#a78bfa" /> Premium</span>
            <span className="text-xl font-bold">{annual ? "250€" : "25€"}<span className="text-sm font-normal text-gray-400">/{annual ? "an" : "mois"}</span></span>
          </div>
          {annual && <p className="text-green-400 text-xs mb-2 font-medium">Économise 50€ vs mensuel</p>}
          <ul className="space-y-2 mb-4">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center"><Check size={10} strokeWidth={3} /></div>
                <span className="text-sm text-gray-200">{f}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleCheckout("premium")}
            disabled={loadingPlan !== null}
            className="w-full py-2.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(to right, #4f46e5, #7c3aed)" }}
          >
            {loadingPlan === "premium" ? <><Loader2 size={16} className="animate-spin" />Chargement…</> : "Choisir Premium"}
          </button>
        </motion.div>

        <p className="text-center text-xs text-gray-500">🔒 Paiement sécurisé · Stripe · Annulation à tout moment</p>
      </div>
    </div>
  );
}
