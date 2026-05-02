Crée les fonctionnalités backend et frontend pour améliorer le système de posts de mon app FF en utilisant Supabase comme base de données et API.

Le système de posts existe déjà. Je veux maintenant ajouter les fonctionnalités suivantes :

1. PARTAGE D’UN POST DANS UNE COMMUNAUTÉ

Quand un utilisateur clique sur un post puis ouvre la section "Partager", il peut sélectionner une communauté.

Fonctionnement attendu :

* L’utilisateur choisit une communauté.
* Il peut ajouter un message sous le post partagé.
* Quand il clique sur "Partager", le post original + son message doivent être publiés automatiquement dans la section discussion de la communauté choisie.

Le système doit :

* sauvegarder la communauté choisie
* enregistrer le message ajouté
* garder une référence vers le post original
* afficher correctement le post partagé dans la discussion de la communauté.

Structure recommandée pour la base :

shared_posts

* id
* original_post_id
* user_id
* community_id
* message
* created_at

Dans la discussion de la communauté, afficher :

* le message de l’utilisateur
* le post original en dessous (style repost).

2. AJOUTER UN POST DANS UN NOUVEAU POST (RÉPONSE)

Si l’utilisateur clique sur "Ajouter à un nouveau post" :

* il est redirigé vers la page de création de post
* le post original apparaît en haut de la zone de création
* l’utilisateur peut écrire son propre post en dessous.

Quand il publie :

* le nouveau post est créé
* il contient une référence vers le post original.

Structure :

post_replies

* id
* original_post_id
* new_post_id
* created_at

Dans l’affichage :

* montrer le post original en haut
* puis le nouveau post en dessous.

3. VISIBILITÉ ET STATISTIQUES DES POSTS

Chaque post doit afficher les métriques suivantes :

* nombre de vues
* nombre de réactions
* nombre de commentaires

Créer une table analytics :

post_analytics

* post_id
* views_count
* reactions_count
* comments_count

Quand un utilisateur ouvre un post :

* incrémenter automatiquement le compteur de vues.

Les réactions et commentaires doivent aussi mettre à jour les compteurs automatiquement.

4. DIAGRAMME D’ENGAGEMENT

Créer un petit diagramme simple pour afficher l’engagement d’un post.

Le diagramme doit montrer :

* vues
* réactions
* commentaires

Afficher ces données visuellement dans la page du post pour que l’utilisateur puisse voir les performances de sa publication.

5. API À GÉNÉRER

Créer les routes suivantes :

* partager un post dans une communauté
* créer un nouveau post en réponse à un autre post
* récupérer les statistiques d’un post
* incrémenter les vues
* récupérer les posts partagés d’une communauté

6. FRONTEND

Créer également :

* le menu de partage avec sélection de communauté
* le champ pour ajouter un message
* la page de création de post avec le post original affiché en haut
* l’affichage des statistiques (vues, réactions, commentaires)
* le diagramme d’engagement.

Toutes les données doivent être stockées et synchronisées avec Supabase.
