import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { createCheckoutSession } from "../api/aiApi";
import { toast } from "sonner";

const features = [
  "300 messages discussion / jour",
  "4 Diagnostics Approfondis / jour",
  "Badge Premium sur profil",
  "Historique IA illimite",
];

export function PremiumPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(false);

  const plan = annual ? "annual" : "monthly";
  const price = annual ? "249.99" : "24.99";
  const period = annual ? "an" : "mois";

  async function handleCheckout() {
    if (!session?.access_token) {
      toast.error("Connecte-toi pour continuer");
      return;
    }
    setLoading(true);
    try {
      const { url } = await createCheckoutSession(session.access_token, plan);
      if (!url) throw new Error("URL Stripe manquante dans la réponse");
      window.location.href = url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[PremiumPage] checkout error:", msg);
      toast.error(`Erreur: ${msg}`, { duration: 8000 });
      setLoading(false);
    }
  }

  return (
    <div
      style={{ backgroundColor: "#000", minHeight: "100vh" }}
      className="flex flex-col items-center px-4 py-8 text-white relative"
    >
      <div className="w-full" style={{ maxWidth: 480 }}>
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">Retour</span>
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8"
        >
          <div className="text-4xl mb-3">⭐</div>
          <h1 className="text-2xl font-bold mb-2">Fowards Premium</h1>
          <p className="text-gray-400 text-sm">
            Debloque ton potentiel de founder
          </p>
        </motion.div>

        {/* Toggle pill */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="flex items-center justify-center mb-6"
        >
          <div className="flex items-center bg-gray-900 rounded-full p-1 gap-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !annual
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                annual
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Annuel
              <span className="bg-green-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
                -17%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Price */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-center mb-8"
        >
          <div className="text-4xl font-bold">
            {price}{" "}
            <span className="text-xl font-normal text-gray-400">
              EUR/{period}
            </span>
          </div>
          {annual && (
            <p className="text-green-400 text-sm mt-1 font-medium">
              Economies 50.12 EUR
            </p>
          )}
        </motion.div>

        {/* Features */}
        <motion.ul
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="space-y-3 mb-8"
        >
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                <Check size={12} strokeWidth={3} />
              </div>
              <span className="text-sm text-gray-200">{feature}</span>
            </li>
          ))}
        </motion.ul>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-3"
        >
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-70"
            style={{
              background: "linear-gradient(to right, #4f46e5, #7c3aed)",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Chargement...
              </>
            ) : (
              "Passer Premium"
            )}
          </button>

          <p className="text-center text-xs text-gray-500">
            Paiement securise Stripe | Annulation a tout moment
          </p>
        </motion.div>
      </div>
    </div>
  );
}
