Corrige et complète le système de partage et de discussion des communautés dans mon application FF.

Actuellement, quand un utilisateur partage un post dans une communauté avec un message, l’interface indique que l’envoi fonctionne, mais le contenu n’apparaît pas dans la discussion de la communauté. Le système n’est donc pas correctement connecté à Supabase.

Je veux rendre les discussions de communauté entièrement fonctionnelles et persistantes.

1. SYSTÈME DE DISCUSSION DES COMMUNAUTÉS

Créer un système de messages dans les communautés.

Table :

community_messages

* id
* community_id
* user_id
* content
* created_at

Fonctionnement :

* chaque communauté possède une discussion
* les messages doivent être enregistrés dans Supabase
* les messages doivent rester visibles après refresh
* les messages doivent être récupérés automatiquement quand la page de la communauté se charge.

2. PARTAGE D’UN POST DANS UNE COMMUNAUTÉ

Quand un utilisateur partage un post dans une communauté :

* enregistrer le message dans community_messages
* enregistrer la référence au post partagé.

Structure recommandée :

community_shared_posts

* id
* community_id
* user_id
* original_post_id
* message
* created_at

Dans la discussion de la communauté afficher :

* le message de l’utilisateur
* le post original en dessous (style repost).

3. CRÉER UN POST À PARTIR DU POST D’UN AUTRE UTILISATEUR

Quand un utilisateur clique sur “Ajouter à un nouveau post” :

* ouvrir la page de création de post
* afficher le post original en haut
* permettre d’écrire un nouveau post.

Quand il publie :

* créer un nouveau post
* enregistrer une référence vers le post original.

Table :

post_reposts

* id
* original_post_id
* new_post_id
* user_id
* created_at

4. CHARGEMENT DES DISCUSSIONS

Quand la page d’une communauté se charge :

* récupérer tous les community_messages
* récupérer les community_shared_posts
* afficher les messages dans l’ordre chronologique.

5. API À CRÉER

Créer les routes suivantes :

Communautés

* envoyer un message dans une communauté
* récupérer les messages d’une communauté

Partage

* partager un post dans une communauté
* récupérer les posts partagés d’une communauté

Repost

* créer un post basé sur un autre post.

6. FRONTEND

Corriger l’interface pour que :

* le bouton “envoyer” publie réellement dans Supabase
* la discussion de la communauté se mette à jour
* les messages restent visibles après refresh
* les posts partagés apparaissent correctement dans la discussion.

Toutes les données doivent être persistées dans Supabase.
