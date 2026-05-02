STRUCTURE GÉNÉRALE
L’application contient 3 sections principales :
• Discussions (communauté)
• Stats (progression personnelle et collective)
• Objectifs
Navigation simple entre les pages.

PAGE 1 : DISCUSSIONS (LISTE DES THÈMES)
Nom : Discussions
Contenu :
• Liste de thèmes sous forme de catégories :
◦ Général
◦ (discussion de général) #Aide
◦ (discussion de général) #Conseils
◦ promouvoir
(discussion de général) #Vos business
◦ Demande / Règles
◦ (discussion de général) #Règle communauté
(discussion de général) #Demande a l’admin

◦	Stats

(discussion de général) #Objectif

En gros même fonctionnement que Discord

Chaque thème est cliquable → ouvre une page de discussion.

🆕 PERSONNALISATION DES DISCUSSIONS (IMPORTANT)
• Tous les menus déroulants de discussions (catégories + sous-thèmes) doivent être personnalisables
• Modification accessible via un bouton “Modifier” présent sur la bannière de la communauté
• Seuls les créateurs/admins de la communauté peuvent :

Ajouter un thème

Supprimer un thème

Renommer un thème

Réorganiser les catégories
• Objectif : permettre à chaque communauté d’avoir sa propre structure

PAGE 2 : DISCUSSION D’UN THÈME
Nom : Discussion - [nom du thème]
Contenu :
• Header avec nom du thème (# Général par exemple)
• Liste de posts

Chaque post contient :
• Photo de profil utilisateur
• Nom utilisateur
• Temps (ex: 4h)
• Texte du post
• Image (optionnelle)
• Nombre de réactions
• Nombre de commentaires

Boutons sur chaque post :
• Réagir
• Commenter

🆕 SYSTÈME DE RÉACTIONS AMÉLIORÉ
• Possibilité d’ajouter des emojis en réaction
• Ajouter aussi des réactions fixes orientées valeur :

“Pertinent”

“Motivant”

“Je soutiens”

“Croissance”
• Ces réactions doivent être visibles et comptabilisées
• Objectif : encourager du contenu utile et inspirant (pas juste des likes)

En bas :
• Champ de saisie pour écrire un message
• Bouton envoyer

Les posts sont stockés dans Supabase et visibles par tous.

PAGE 3 : STATS (PERSONNEL + GLOBAL)
Nom : Stats
Contenu :
Bloc 1 (dans un rectangle arrondi)
• Stats de l’utilisateur :
◦ Nombre d’objectifs
◦ Objectifs accomplis
◦ Progression actuelle

Bloc 2 (dans un rectangle arrondi)
• Stats globales (tous les membres) :
◦ Objectifs cumulés
◦ Objectifs accomplis

Bloc 3 (dans un rectangle arrondi)
• Objectif actuel :
◦ Titre de l’objectif
◦ Description
◦ Progression (barre)
◦ Bouton : “Accompli”

Bloc 4 (dans un rectangle arrondi)
• Évolution :
◦ Graphique de progression

PAGE 4 : IMPACT COMMUNAUTÉ
Nom : Impact
Contenu :
• Graphique (dans un rectangle arrondi)
• Titre : Impact de tous les membres
• Filtres :
◦ Réactions
◦ Commentaires
• Axe X : jours (J1 à J7)
• Axe Y : nombre

Les données viennent de Supabase.

RÈGLES IMPORTANTES
• Tous les éléments entourés dans les croquis doivent être dans des rectangles à bords arrondis
• Pas besoin de design complexe, focus sur la structure et les fonctionnalités
• Toutes les actions doivent être persistées dans Supabase
• Mise à jour en temps réel (posts, commentaires, stats)
• Code propre et structuré