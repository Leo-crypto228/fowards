MASTER PROMPT — Section Dashboard (3 gradients statistiques) (remplce par la ligne que j'ai envoye en image de l'app par ce que je dit ici)

Créer 3 cartes statistiques verticales avec gradien
IMPORTANT :

reprendre fond gradient que les cartes colorées envoyé en image (que le fond melange colore, sans les inscription dessus comme tu le ramarquera) 

supprimer le texte actuel

remplacer par les nouvelles informations


coins arrondis

même taille pour les 3

orientation inversée :
la largeur devient la hauteur et la hauteur devient la largeur (rectangle vertical)

Les trois cartes doivent être alignées horizontalement.

Toutes les données doivent être connectées au reste de l’application :

via Supabase

via les données du bouton Progression

via les validations d’objectifs

via les heures de DeepWork déclarées

Les valeurs doivent se mettre à jour automatiquement.

Si aucune donnée n'existe encore :

afficher 0

sauf cas particulier expliqué plus bas.

Carte 1 — DeepWork (à droite)

Texte noir.

Structure verticale :

[nombre]
Heures
DeepWork

Fonctionnement :

Le nombre correspond au total d’heures de DeepWork de l’utilisateur.

Ces heures sont récupérées depuis :

les données saisies dans Progression

les entrées où l’utilisateur indique
combien d’heures de DeepWork il a réalisées.

Supabase doit :

enregistrer chaque session

additionner toutes les heures

mettre à jour la carte automatiquement.

Valeur par défaut :

0
Heures
DeepWork
Carte 2 — Constance (au centre)

Structure :

[nombre] / 100

[flèche] +/- [nombre] %

Constance

Couleurs :

flèche violette vers le haut = amélioration

flèche rouge vers le bas = baisse

texte du pourcentage en violet

si aucune donnée encore :

flèche grise horizontale

pourcentage = 0 %

Calcul du score de constance (via Supabase)

Le score de constance est basé sur plusieurs paramètres :

streak quotidienne

nombre de validations dans Progression

heures de DeepWork

régularité d’activité

Exemple de logique :

score_constance =
(streak_jours × 3)
+ (validations_progression × 5)
+ (heures_deepwork_semaine × 2)

Le score est limité à 100 maximum.

Calcul de la variation %

Comparer :

période actuelle

période précédente

Exemple :

variation =
((score_actuel - score_precedent) / score_precedent) × 100

Afficher :

flèche vers le haut si positif

flèche vers le bas si négatif.

Carte 3 — Objectifs (à gauche)

Structure normale quand un objectif est terminé :

[nombre]

Objectif

Accomplis

Le nombre correspond au nombre total d’objectifs terminés par l’utilisateur.

Les données viennent de :

la validation des objectifs

synchronisées avec Supabase.

Cas particulier — premier objectif

Si l’utilisateur est encore sur son premier objectif non terminé :

afficher :

1

En cours

Quand l’objectif est validé :

la carte passe au format normal :

1

Objectif

Accomplis

Puis continue à augmenter avec chaque nouvel objectif terminé.

Connexion aux données

Chaque carte doit être connectée aux données globales de l’app.

Sources :

Supabase database

bouton Progression

validations d’objectifs

déclarations de DeepWork

historique utilisateur

Le système doit :

synchroniser les données en temps réel

mettre à jour automatiquement les cartes

fonctionner pour le profil de l’utilisateur actif.

Règles UX importantes

Respecter :

le design actuel de l’application

les gradients existants

le style minimaliste

la cohérence avec les autres composants

les coins arrondis identiques

Les cartes doivent être :

lisibles

dynamiques

connectées au reste du système.