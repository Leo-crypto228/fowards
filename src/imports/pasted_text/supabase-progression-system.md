Implémente le système complet de progression pour mon application FF en utilisant Supabase. Ce système doit connecter la streak, les Fcoins, la barre d’évolution, la constance d’utilisation et la progression des objectifs.

Toutes les données doivent être persistées dans Supabase et mises à jour automatiquement.

1. SYSTÈME DE STREAK

Créer un système de streak basé sur l’activité quotidienne.

Conditions pour valider un jour de streak :

* l’utilisateur doit se connecter
* l’utilisateur doit publier au moins un post dans la journée.

Règles :

* si l’utilisateur valide ces actions → streak +1
* si l’utilisateur ne revient pas pendant 3 jours → streak reset.

Créer une table :

user_streaks

* user_id
* current_streak
* last_active_date
* longest_streak

Le système doit vérifier chaque jour si l’utilisateur a publié un post et mettre à jour la streak automatiquement.

2. SYSTÈME DE FCOINS

Les Fcoins représentent le statut social positif de l’utilisateur et sont affichés dans le profil.

Créer une table :

user_fcoins

* id
* user_id
* fcoin_type
* fcoin_name
* achieved_at

Les Fcoins doivent être attribués automatiquement quand les conditions sont remplies.

Types de Fcoins :

STREAK

Départ — streak 2 jours
Discipline — streak 7 jours
Constant — streak 30 jours

POSTS

Premiers pas — 1 post
Contributeur — 10 posts
Créateur — 50 posts

RÉACTIONS

Premier post apprécié — premier post avec réactions
Impression — 100 réactions reçues
Influence — 1000 réactions reçues

COMMUNAUTÉ

Début d’aventure — rejoindre 1 communauté
L’actif — envoyer 20 messages
Aimé — envoyer 100 messages

RARES

EarlyBuilder — premier utilisateur
Pioneer — premier utilisateur actif
First Objectif — premier objectif atteint

SOCIAL

Explorateur — visiter 10 profils
Curieux — écrire 10 commentaires
Observateur — suivre 10 personnes

Les Fcoins doivent apparaître dans le profil de l’utilisateur comme badges sociaux.

3. BARRE D’ÉVOLUTION

Créer une barre d’évolution globale pour chaque utilisateur.

Créer une table :

user_progress

* user_id
* progress_score
* last_update

La progression doit augmenter en fonction :

* des Fcoins gagnés
* des actions sur la plateforme
* de la participation aux communautés
* de la progression des objectifs
* de la constance d’utilisation.

Il n’y a pas de niveaux pour le moment, seulement une progression continue.

4. OBJECTIFS PERSONNELS

Chaque utilisateur peut créer son objectif personnel dans son profil.

Créer une table :

user_goals

* id
* user_id
* goal_title
* goal_description
* progress
* created_at

Les actions qui font avancer un objectif :

* publier une progression
* cocher une étape
* poster une preuve
* écrire un message.

Chaque action doit augmenter la progression.

5. OBJECTIFS DE COMMUNAUTÉ

Créer un système d’objectifs pour les communautés.

Table :

community_goals

* id
* community_id
* goal_title
* goal_progress
* created_at

Les membres de la communauté peuvent :

* publier une progression
* envoyer un message
* poster une preuve
* cocher une étape.

Ces actions doivent faire avancer l’objectif collectif.

6. NOUVELLE FONCTIONNALITÉ : QUESTION DE PROGRESSION PERSONNELLE

Ajouter un nouveau bouton sur la bannière du profil utilisateur, à côté du bouton "Recherche".

Nom du bouton :

Progression

Quand l’utilisateur clique dessus :

ouvrir une page avec la question :

"Comment as-tu avancé sur ton objectif ou projet ?"

Sous cette question :

un champ de réponse texte (réponse courte ou longue).

Quand l’utilisateur envoie sa réponse :

* enregistrer la réponse dans Supabase
* envoyer la réponse à une API externe ou une IA pour analyse.

Créer une table :

goal_progress_reports

* id
* user_id
* goal_id
* response_text
* created_at

Après analyse par l’IA :

* ajuster automatiquement la barre d’évolution de l’utilisateur
* augmenter légèrement la progression si la réponse montre un réel progrès.

7. CONSTANCES D’UTILISATION

Le système doit suivre les actions suivantes :

* poster
* commenter
* discuter dans une communauté
* avancer un objectif.

Ces actions doivent :

* augmenter la barre d’évolution
* contribuer à l’obtention de Fcoins.

Créer une table :

user_activity_log

* id
* user_id
* action_type
* created_at

Toutes les actions doivent être enregistrées pour analyser la constance d’utilisation.

8. AFFICHAGE DANS LE PROFIL

Dans le profil utilisateur afficher :

* streak actuelle
* Fcoins gagnés
* barre d’évolution
* objectif personnel
* progression récente.

Toutes les données doivent être récupérées depuis Supabase et mises à jour en temps réel.
