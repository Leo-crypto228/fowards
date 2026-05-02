Implémente un système de recherche entièrement fonctionnel dans mon application FF en utilisant Supabase comme base de données. La recherche doit fonctionner de manière fiable et persistante dans plusieurs parties de l'application.

Le système doit permettre de rechercher des utilisateurs, des posts, des communautés et des hashtags.

1. RECHERCHE DANS LE FEED PRINCIPAL

La barre de recherche située dans le feed doit fonctionner.

Quand un utilisateur tape dans cette barre :

* rechercher les posts correspondant au texte saisi
* rechercher les utilisateurs correspondants
* rechercher les hashtags présents dans les posts.

Le système doit interroger Supabase dans la table posts et dans la table users.

Tables utilisées :

posts

* id
* user_id
* content
* created_at

users

* id
* username
* bio
* avatar_url

Fonctionnement :

* si l'utilisateur tape un mot normal → rechercher dans le contenu des posts
* si l'utilisateur tape @ → rechercher les utilisateurs
* si l'utilisateur tape # → rechercher les hashtags présents dans les posts.

Les résultats doivent être affichés dans une page de résultats de recherche.

2. RECHERCHE DES COMMUNAUTÉS

Dans la page "Rechercher des communautés", la barre de recherche doit fonctionner et permettre de trouver des communautés.

Table utilisée :

communities

* id
* name
* description
* created_at

Fonctionnement :

* rechercher les communautés par nom
* rechercher aussi dans la description.

La page doit afficher :

* nom de la communauté
* description
* nombre de membres
* bouton rejoindre.

La section "Propositions de communautés" doit également utiliser Supabase pour afficher des communautés populaires ou récentes.

3. RECHERCHE SUR LES PROFILS UTILISATEURS

Dans le profil d’un utilisateur, le bouton "Recherche" doit ouvrir une nouvelle page dédiée à la recherche dans le contenu de cet utilisateur.

Quand un utilisateur clique sur ce bouton :

ouvrir une page "Recherche du profil".

Dans cette page :

permettre de rechercher uniquement dans :

* les posts de cet utilisateur
* les commentaires de cet utilisateur.

Tables utilisées :

posts
comments

La requête doit filtrer les résultats avec user_id = id du profil.

4. RECHERCHE PAR HASHTAG

Les hashtags présents dans les posts doivent être détectés automatiquement.

Quand un utilisateur tape un hashtag :

#mot

Le système doit rechercher les posts contenant ce hashtag dans la table posts.

Afficher :

* les posts correspondants
* les utilisateurs qui utilisent souvent ce hashtag.

5. RECHERCHE PAR MENTION UTILISATEUR

Quand un utilisateur tape :

@username

Le système doit rechercher les utilisateurs correspondants dans la table users.

Afficher :

* photo de profil
* nom
* bio
* bouton "Avancer avec".

6. CHARGEMENT DES RÉSULTATS

Quand une recherche est effectuée :

* interroger Supabase
* récupérer les résultats
* afficher les résultats en temps réel.

Les résultats doivent être triés par pertinence et date.

7. OPTIMISATION

Ajouter un système de recherche optimisé :

* limiter les résultats à 20 par requête
* permettre le chargement progressif si nécessaire.

8. INTERFACE

Le système doit fonctionner dans :

* la barre de recherche du feed
* la page de recherche des communautés
* la page de recherche d’un profil utilisateur.

Chaque recherche doit rediriger vers une page de résultats affichant clairement :

* utilisateurs
* posts
* communautés
* hashtags.

Toutes les recherches doivent être effectuées via Supabase et retourner des données persistantes.
