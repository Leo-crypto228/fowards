🎨 UI — Uniformisation des gradients (Profils)

Dans la page profil utilisateur, les éléments visuels suivants :

Anneaux de progression
Bloc “Constance”
Bloc “Deep Work”

Doivent respecter les règles suivantes :

Utiliser un gradient noir uniforme, identique pour les trois éléments
Supprimer toute variation de couleur (plus de gris ou autres nuances visibles)
Supprimer la bulle grise en haut de chaque bloc/gradient
Rendu attendu :
design plus propre
cohérence visuelle globale
focus sur les données et animations plutôt que sur des éléments parasites
📊 Système d’évolution — Diagramme de progression utilisateur
🎯 Objectif

Créer un système de courbe d’évolution dynamique qui reflète l’activité réelle de l’utilisateur dans le temps, de manière fluide et motivante.

📈 Données prises en compte

Le système doit mesurer et agréger toutes les actions suivantes :

Nombre de posts publiés
Nombre de commentaires
Activité dans les communautés (messages envoyés)
Réactions (données globales d’engagement)
Toute autre interaction sociale disponible dans l’application

Toutes ces données doivent être :

stockées dans Supabase
mises à jour en temps réel
exploitables pour générer une courbe d’évolution
⚙️ Logique de progression (très important)

Le système ne doit pas être basé uniquement sur des totaux, mais sur une dynamique d’évolution.

Cas de base :
Si un utilisateur :
poste 1 fois/jour
commente 1 fois/jour
👉 La courbe stagne (activité stable)
Si l’utilisateur augmente son activité :
plus de posts
plus de commentaires
👉 La courbe monte
Si l’activité diminue après un pic :

👉 La courbe descend progressivement

📉 Comportement attendu
La progression reflète la variation d’effort, pas juste le volume total
Le système doit détecter :
les phases de croissance
les phases de stagnation
les phases de baisse

👉 Objectif : montrer une courbe vivante, pas un simple compteur

🧠 Affichage graphique
Courbe fluide (arrondie)
pas de lignes droites ou cassées
interpolation pour un rendu naturel
Sensation visuelle :
organique
motivante
facile à lire
🔘 Filtres temporels

Le diagramme doit fonctionner avec 3 vues :

“Depuis toujours”
“30 derniers jours”
“Cette semaine”
Règles :
Chaque filtre recalcule les données indépendamment
Les statistiques sont donc différentes selon la période
⏳ Gestion des comptes récents

Si l’utilisateur n’a pas assez d’historique :

Exemple :
compte créé il y a 10 jours → vue “30 jours”
👉 La courbe :
commence au début réel de l’activité
ne remplit pas tout le graphique

Même logique pour :

semaine
historique global

👉 Important :

ne jamais “faker” des données
afficher uniquement ce qui existe réellement
⚡ Expérience utilisateur
Courbe animée à l’ouverture (léger mouvement)
Mise à jour dynamique après action
Sensation de progression ou de perte visible immédiatement