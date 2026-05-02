Prompt IA – Posts et commentaires fictifs dynamiques avec Supabase :

Créer un système social complet où les posts et commentaires fictifs restent visibles et fonctionnels, tout en étant synchronisés avec Supabase, pour permettre aux utilisateurs d’interagir et que toutes les données soient persistantes.

1. Contenu fictif et réel

Les posts et commentaires fictifs doivent rester dans le feed comme contenu initial.

Ils doivent être sauvegardés dans Supabase pour qu’ils soient dynamiques et modifiables, comme les posts réels.

Tous les nouveaux posts/commentaires des utilisateurs doivent s’ajouter à côté du contenu fictif.

Les posts fictifs doivent avoir les mêmes champs que les posts réels pour assurer la cohérence.

2. Tables Supabase

Posts (posts) :

id

user_id

content

created_at

visibility (public / followers / private)

likes_count

comments_count

Commentaires (comments) :

id

post_id

user_id

content

created_at

Réactions (reactions) :

id

post_id ou comment_id

user_id

type (pertinent, motivant, j'adore, je soutiens)

created_at

Profils (profiles) :

id

username

avatar_url

bio

created_at

progress_percentage (avancement / objectif / Fcoin)

followers_count

subscriptions_count

3. Fonctionnalités

Interaction avec les posts et commentaires

Tous les posts (fictifs ou réels) peuvent être commentés et aimés avec les réactions spécifiées.

Les réactions et commentaires sont sauvegardés dans Supabase et visibles pour tous.

Les réactions sur les commentaires doivent également être sauvegardées et visibles.

Navigation vers le profil

Cliquer sur le pseudo de n’importe quel utilisateur (fictif ou réel) ouvre son profil complet :

Progression, objectif, photo de profil, Fcoin, abonnements, personnes suivies.

Le bouton Progression et Modifier ne sont visibles que sur mon profil.

Synchronisation et persistance

Les posts et commentaires fictifs doivent se comporter exactement comme les posts réels : toutes les interactions sont persistantes via Supabase.

Après rechargement, tout reste intact.

Contenu dynamique

Supprimer le code statique pour l’affichage uniquement n’est pas nécessaire.

Les posts fictifs doivent être insérés dans Supabase lors de l’initialisation pour qu’ils soient dynamiques dès le départ.

Les nouveaux posts et commentaires sont ajoutés à côté et synchronisés en temps réel.

Feed et visibilité

Le feed affiche posts fictifs + posts réels, filtré selon la visibilité et l’utilisateur connecté.

Les mises à jour de Supabase doivent être automatiquement reflétées dans le feed.

Composants interactifs

La partie “cliquer sur post” doit permettre :

Voir les commentaires

Ajouter un commentaire

Ajouter une réaction

Tout sauvegardé dans Supabase en temps réel

Objectif final :
Créer un feed social fonctionnel avec contenu fictif et réel, où tous les posts et commentaires sont dynamiques, persistants et interactifs, entièrement connectés à Supabase, avec profils, progression et réactions intégrées.