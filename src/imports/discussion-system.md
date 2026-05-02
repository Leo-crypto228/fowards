Je veux concevoir le système de discussion pour les communautés dans l’application FF. L’objectif est d’avoir une interface simple, lisible et intuitive, inspirée d’un mélange entre un forum moderne et un système de réponses imbriquées.

Structure générale :

Chaque discussion commence par une question ou une phrase principale publiée par un utilisateur.

Les réponses s’affichent en dessous sous forme de fil de discussion imbriqué.

Interaction utilisateur :

En bas de l’écran, il y a une barre de réponse fixe (input) permettant d’écrire un message.

Si l’utilisateur touche un message existant, cela signifie qu’il veut répondre directement à ce message.

La réponse sera alors liée visuellement à ce message.

Affichage des réponses :

Une réponse apparaît légèrement décalée vers la droite par rapport au message auquel elle répond.

Elle est un peu plus petite (quelques pixels) pour montrer la hiérarchie.

Une petite flèche grise subtile relie les deux messages :

elle part de la photo de profil du message parent

elle pointe vers la photo de profil de la réponse

Cela crée un chemin visuel clair entre la question et les réponses.

Hiérarchie des réponses :

Si quelqu’un répond à une réponse existante, le système répète le même principe :

décalage vers la droite

taille légèrement réduite

flèche grise reliant les profils

Le système peut continuer ainsi pour plusieurs niveaux de réponses.

Créer un nouveau message :

Si l’utilisateur n’appuie sur aucun message avant d’écrire, son message devient une nouvelle question ou un nouveau message principal dans la discussion.

Objectif UX :

La discussion doit être très lisible et fluide, même avec beaucoup de réponses.

Les relations entre les messages doivent être visuellement évidentes grâce au décalage et aux flèches.

L’interface doit rester minimaliste, moderne et mobile-first.

Points importants :

Les avatars sont visibles à gauche des messages.

Les flèches doivent être subtiles, grises et élégantes, pas envahissantes.

L’animation d’apparition des réponses doit être douce et naturelle.

Le système doit être optimisé pour scroll vertical fluide.