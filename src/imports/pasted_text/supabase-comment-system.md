Crée un backend automatisé pour mon app FF afin de gérer le système de commentaires sous les posts.
Utilise Supabase comme base de données (PostgreSQL) et génère automatiquement les routes API nécessaires ainsi que les appels frontend.

Fonctionnalités à créer

Commentaires sur les posts

Permettre à un utilisateur d’ajouter un commentaire sous un post.

Chaque commentaire doit contenir :

id

post_id (référence au post)

user_id

contenu du commentaire

type de commentaire

date de création

Types de commentaires (affichés en haut du commentaire dans un petit label)
Créer les catégories suivantes :

Conseil (mise en avant visuelle)

Encouragement

Réaction

Motivant

Je soutiens

J’adore

Pertinent

Le type choisi doit s’afficher au-dessus du commentaire dans un petit badge visuel, similaire à la logique utilisée pour les types de posts.

Réponses aux commentaires
Permettre de répondre à un commentaire existant.

Structure :

id

comment_id

user_id

contenu

date de création

Les réponses doivent être affichées en dessous du commentaire parent.

Réactions aux commentaires
Permettre aux utilisateurs de réagir à un commentaire.

Types de réactions :

Je soutiens

J’adore

Pertinent

Motivant

Structure :

id

comment_id

user_id

reaction_type

created_at

Un utilisateur ne peut avoir qu’une seule réaction par commentaire mais peut la modifier.

Routes API à générer

Créer automatiquement les routes suivantes :

Commentaires

créer un commentaire

récupérer les commentaires d’un post

récupérer les commentaires d’un utilisateur

Réponses

créer une réponse à un commentaire

récupérer les réponses d’un commentaire

Réactions

ajouter une réaction

modifier une réaction

récupérer les réactions d’un commentaire

Frontend

Générer également :

un formulaire pour écrire un commentaire

un menu pour choisir le type de commentaire

un bouton pour répondre à un commentaire

un système de réactions rapides sur chaque commentaire

l’affichage du badge du type de commentaire au-dessus du texte

affichage des réponses sous le commentaire

Le système doit être simple, rapide et optimisé pour un réseau social, avec un affichage clair des conversations.

Toutes les données doivent être stockées et persistées dans Supabase.