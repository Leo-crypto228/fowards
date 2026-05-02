Corrige et complète le système de commentaires de mon application FF afin que toutes les données soient correctement enregistrées dans Supabase et connectées aux statistiques du post.

Actuellement :

* les commentaires se publient et semblent sauvegardés
* mais ils ne mettent pas à jour le diagramme du post
* les réactions aux commentaires ne se sauvegardent pas
* les réponses aux commentaires ne se sauvegardent pas non plus.

Je veux corriger ces trois problèmes.

1. CONNEXION DES COMMENTAIRES AU DIAGRAMME DU POST

Quand un utilisateur publie un commentaire :

* enregistrer le commentaire dans Supabase
* mettre à jour automatiquement le compteur comments_count dans la table post_analytics
* rafraîchir les données utilisées par le diagramme du post.

Structure :

comments

* id
* post_id
* user_id
* content
* comment_type
* created_at

post_analytics

* post_id
* views_count
* reactions_count
* comments_count

Chaque nouveau commentaire doit incrémenter comments_count.

2. RÉACTIONS AUX COMMENTAIRES

Créer un système persistant de réactions sur les commentaires.

Table :

comment_reactions

* id
* comment_id
* user_id
* reaction_type
* created_at

Règles :

* un utilisateur peut avoir une seule réaction par commentaire
* s'il change de réaction, remplacer l’ancienne
* la réaction doit rester visible après un refresh
* récupérer les réactions depuis Supabase au chargement de la page.

3. RÉPONSES AUX COMMENTAIRES

Créer un système de réponses aux commentaires.

Table :

comment_replies

* id
* comment_id
* user_id
* content
* created_at

Fonctionnement :

* un utilisateur peut répondre à un commentaire
* la réponse doit être enregistrée dans Supabase
* elle doit rester visible après un refresh
* les réponses doivent être affichées sous le commentaire parent.

4. API À CRÉER

Commentaires

* créer un commentaire
* récupérer les commentaires d’un post

Réactions aux commentaires

* ajouter une réaction
* modifier une réaction
* récupérer les réactions d’un commentaire

Réponses

* créer une réponse
* récupérer les réponses d’un commentaire

5. FRONTEND

Corriger l’interface pour :

* envoyer correctement les réactions de commentaire à Supabase
* envoyer les réponses aux commentaires
* recharger les données depuis Supabase après publication.

Toutes les données doivent être persistées et synchronisées avec Supabase.
