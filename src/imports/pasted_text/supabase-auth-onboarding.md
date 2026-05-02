Implémente le système complet d’authentification et d’onboarding pour mon application FF en utilisant Supabase.

Le système doit gérer :

* création de compte
* validation
* personnalisation du profil
* choix des personnes à suivre
* suggestion de communautés
* création du premier objectif.

Toutes les données doivent être enregistrées dans Supabase.

1. CRÉATION DE COMPTE

Utiliser Supabase Auth pour gérer l’authentification.

Champs nécessaires lors de la création :

* email
* mot de passe
* username.

Après création du compte :

* créer automatiquement un profil utilisateur dans la table users.

Table :

users

* id (lié à Supabase Auth)
* username
* bio
* avatar_url
* goal_description
* goal_progress
* created_at

2. VALIDATION DU COMPTE

Après inscription :

* envoyer un email de confirmation via Supabase Auth
* l’utilisateur doit confirmer son email avant d’accéder à l’application.

Si l’email n’est pas confirmé :

* afficher une page "Validation du compte".

3. ONBOARDING (PERSONNALISATION)

Après la validation du compte, afficher un onboarding en plusieurs étapes.

Étape 1 : description utilisateur

Demander :

"Parle-nous un peu de toi."

Champ texte :

bio utilisateur.

Enregistrer dans Supabase.

4. CHOIX DES PERSONNES À SUIVRE

Afficher une liste de profils suggérés.

Suggestions basées sur :

* nouveaux utilisateurs
* utilisateurs actifs
* profils populaires.

L’utilisateur peut cliquer sur :

"Avancer avec"

Créer les relations dans la table :

user_follows

* follower_id
* following_id
* created_at.

5. SUGGESTION DE COMMUNAUTÉS

Afficher une page :

"Rejoignez des communautés"

Afficher des communautés populaires depuis Supabase.

Table :

communities

* id
* name
* description
* members_count

L’utilisateur peut cliquer :

"S’abonner"

Créer la relation dans :

community_members

* user_id
* community_id
* created_at.

6. CRÉATION DU PREMIER OBJECTIF

Créer une étape importante :

"Quel est ton objectif ou projet ?"

Champs :

titre objectif
description objectif

Créer un objectif dans la table :

user_goals

* id
* user_id
* goal_title
* goal_description
* progress
* status
* created_at.

Statut initial :

en_cours

Progress initiale :

0.

1. POSITION ACTUELLE DANS L’OBJECTIF

Demander ensuite :

"Où en es-tu aujourd’hui dans cet objectif ?"

Champ texte :

description de l’avancement actuel.

Enregistrer cette réponse dans :

goal_progress_reports

* user_id
* goal_id
* response_text
* created_at.

Cette réponse doit également :

* augmenter légèrement la barre d’évolution
* enregistrer une activité dans user_activity_log.

8. FINALISATION DU PROFIL

Une fois l’onboarding terminé :

rediriger l’utilisateur vers le feed principal.

Son profil doit maintenant contenir :

* bio
* objectif
* progression initiale
* personnes suivies
* communautés rejointes.

Toutes les données doivent être récupérées depuis Supabase et mises à jour dans l’interface.
