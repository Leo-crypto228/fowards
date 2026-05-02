🧠 Prompt — Refonte des calculs de la Constance (FuturFeed)
🎯 Objectif

Corriger et optimiser le calcul de la constance (%) pour qu’il reflète :

la régularité réelle
l’évolution dans le temps
sans être manipulable
avec un comportement naturel (montée / stagnation / baisse)
⚙️ Principe clé

La constance est basée sur :

Constance = régularité + variation d’effort

👉 Pas juste “faire beaucoup”
👉 Mais “faire régulièrement ET progresser”

📊 1. Score journalier (base)

Chaque jour génère un score entre 0 et 100

Calcul :
score_jour = min(100, score_actions)
🧮 Score actions (pondéré + plafonné)
Action	Valeur	Max/jour
Post	+20	2
Avancement objectif	+25	2
Commentaire	+8	5
Réaction	+2	20
Message communauté	+10	5
Follow / rejoindre	+5	5
🔒 Anti-abus

Après 70% du max d’une catégorie :

valeur × 0.5

👉 empêche le spam pur

📈 2. Moyenne glissante (base constance)

Sur 7 jours

moyenne = (somme scores_jour) / nombre de jours
⚡ 3. Variation d’activité (IMPORTANT)

On ajoute une composante dynamique :

variation = score_jour - moyenne_des_3_derniers_jours
Impact :
Si variation > 0 → boost
Si variation < 0 → baisse
Calcul final :
constance = moyenne + (variation × 0.3)

👉 Clamp entre 0 et 100

📉 4. Comportements réels
Cas 1 — Début utilisateur
Jour 1 : 1 action → score ~10-20
👉 constance monte DIRECT (important psychologiquement)
Cas 2 — Routine stable
Même actions tous les jours
👉 constance stagne
Cas 3 — Effort supplémentaire
posts / + commentaires
👉 constance augmente
Cas 4 — Baisse après pic

👉 constance redescend progressivement

Cas 5 — Inactivité
score_jour = 0

👉 chute visible mais pas brutale (grâce à moyenne glissante)

🧩 5. Supabase — Logique de calcul
Table utilisée (déjà existante)

user_daily_activity :

user_id
date
score_jour
Requête logique (pseudo SQL)
Récupérer 7 derniers jours :
SELECT score_jour
FROM user_daily_activity
WHERE user_id = ?
ORDER BY date DESC
LIMIT 7;
Calcul moyenne :
AVG(score_jour)
Calcul variation :
score_today - AVG(last_3_days)
Calcul final :
constance = moyenne + (variation * 0.3)
Clamp :
constance = GREATEST(0, LEAST(100, constance))
Update :
UPDATE user_constance
SET constance = ?
WHERE user_id = ?;
📊 6. % affiché (UI)
Arrondi :
constance_affichée = ROUND(constance)
Mise à jour :
en temps réel après action
ou batch toutes les X minutes
🎯 Résultat final

Ce système crée :

montée rapide au début (motivant)
stagnation si routine (réaliste)
boost si effort (stimulant)
chute si arrêt (logique)

👉 Sans triche possible
👉 Sans illusion

💡 Là t’as un truc très propre :

simple à calculer
dynamique
compréhensible
et surtout ressenti comme juste par l’utilisateur