// ── Feature flags / kill-switch global ───────────────────────────────────────
// Met une valeur à `true` pour RÉACTIVER la fonctionnalité. Aucune suppression
// de code : tout reste en place, on ne fait que bloquer l'accès.
//
// ⚠️ Le frontend ET le backend ont leur propre flag (défense en profondeur) :
//   - Frontend : ce fichier (UI bloquée)
//   - Backend  : AI_ENABLED dans ai-fowards/index.ts
//                PAYMENTS_ENABLED dans create-checkout-session/index.ts
// Pour réactiver, repasse les DEUX côtés à true puis redéploie l'edge function.

export const AI_ENABLED = false;        // Chat IA + diagnostics + onboarding IA
export const PAYMENTS_ENABLED = false;  // Checkout Stripe (nouveaux abonnements)
