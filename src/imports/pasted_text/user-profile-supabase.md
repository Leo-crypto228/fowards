Corrige et améliore le système de profils utilisateurs dans mon application FF en utilisant Supabase comme base de données.

Les profils doivent être visibles par tous les utilisateurs et l’interface doit s’adapter automatiquement selon que l’utilisateur regarde son propre profil ou celui d’un autre utilisateur.

1. VISIBILITÉ DES PROFILS

Tous les profils utilisateurs doivent être visibles publiquement.

Quand un utilisateur clique sur un profil :

* récupérer les données depuis Supabase
* afficher les informations du profil.

Table utilisée :

users

* id
* username
* avatar_url
* bio
* created_at

Si Row Level Security est activé dans Supabase :

ajouter une policy SELECT publique permettant à tous les utilisateurs authentifiés de lire les profils.

2. PROFIL PERSONNEL VS PROFIL D’UN AUTRE UTILISATEUR

Le profil doit changer automatiquement selon la situation.

Si user_id du profil = utilisateur connecté :

Afficher le profil personnel.

Boutons visibles :

* Modifier le profil
* Voir ses abonnés
* Voir ses abonnements
* Voir ses posts
* Recherche dans son profil.

Si user_id du profil ≠ utilisateur connecté :

Afficher le profil d’un autre utilisateur.

Boutons visibles :

* Avancer avec (suivre)
* Message (si messagerie existante)
* Voir abonnés
* Voir abonnements.

3. POSTS DU PROFIL

Dans chaque profil afficher :

* les posts créés par cet utilisateur
* les posts doivent être récupérés depuis Supabase.

Table :

posts

* id
* user_id
* content
* created_at

Filtrer :

user_id = id du profil.

4. BOUTONS DU PROFIL

Tous les boutons doivent être fonctionnels :

Avancer avec
→ suivre ou se désabonner

Voir abonnés
→ ouvrir la liste des abonnés

Voir abonnements
→ ouvrir la liste des comptes suivis

Modifier le profil
→ modifier les informations du profil dans Supabase.

5. SYNCHRONISATION DES DONNÉES

Quand une page profil se charge :

* récupérer les informations du profil
* récupérer les abonnés
* récupérer les abonnements
* récupérer les posts.

Toutes les données doivent venir de Supabase.

6. MISE À JOUR EN TEMPS RÉEL

Quand une action est faite :

* suivre un utilisateur
* modifier son profil
* publier un post

Les données du profil doivent être mises à jour immédiatement dans l’interface.

7. STRUCTURE DU PROFIL

Chaque profil doit afficher :

* photo de profil
* nom d’utilisateur
* bio
* nombre de posts
* nombre d’abonnés
* nombre d’abonnements.

Toutes les informations doivent être récupérées et mises à jour depuis Supabase.
