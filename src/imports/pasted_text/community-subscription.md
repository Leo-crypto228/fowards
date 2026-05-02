Implémente un système d’abonnement aux communautés dans mon application FF en utilisant Supabase comme base de données. Le système doit permettre aux utilisateurs de rejoindre une communauté et contrôler l’accès aux actions dans celle-ci.

1. BOUTON "S’ABONNER" SUR LES CARTES DE COMMUNAUTÉS

Dans la page "Recherche de communautés", chaque carte de communauté doit afficher en haut à droite un bouton :

"S’abonner"

Design :

* bouton avec bordure blanche (style boudin blanc)
* état actif ou inactif selon si l’utilisateur est déjà membre.

Quand l’utilisateur clique sur ce bouton :

* enregistrer l’abonnement dans Supabase
* mettre à jour immédiatement l’interface.

Table à utiliser :

community_members

* id
* community_id
* user_id
* created_at

Règles :

* un utilisateur ne peut rejoindre une communauté qu’une seule fois
* empêcher les doublons
* permettre aussi de se désabonner.

2. FONCTION BACKEND

Créer deux fonctions :

joinCommunity(user_id, community_id)

Cette fonction doit :

* vérifier si l’utilisateur est déjà membre
* créer un nouvel enregistrement dans community_members si ce n’est pas le cas.

leaveCommunity(user_id, community_id)

Cette fonction doit :

* supprimer l’enregistrement dans community_members.

3. CONTRÔLE D’ACCÈS À LA COMMUNAUTÉ

Si l’utilisateur n’est pas membre d’une communauté :

Il peut :

* voir le profil de la communauté
* voir la description
* voir les membres.

Mais il ne peut PAS :

* envoyer de message dans la discussion
* partager un post dans la communauté
* faire avancer les objectifs de la communauté.

Quand un utilisateur non membre tente d’effectuer ces actions :

* afficher un message indiquant qu’il doit d’abord s’abonner à la communauté.

4. VÉRIFICATION DES DROITS

Avant chaque action dans la communauté (message, progression d’objectif, partage) :

* vérifier si l’utilisateur est présent dans la table community_members
* autoriser l’action seulement si l’utilisateur est membre.

5. AFFICHAGE DES MEMBRES

Dans la page d’une communauté :

* afficher la liste des membres
* récupérer les membres depuis Supabase.

6. CHARGEMENT DES COMMUNAUTÉS

Quand la page "Recherche de communautés" se charge :

* récupérer les communautés depuis Supabase
* vérifier si l’utilisateur actuel est membre
* afficher le bouton :

"S’abonner" si l’utilisateur n’est pas membre
"Abonné" si l’utilisateur est déjà membre.

7. PERSISTENCE DES DONNÉES

Toutes les actions doivent être :

* enregistrées dans Supabase
* persistantes après un refresh
* synchronisées entre toutes les pages de l’application.
