Partie : Communauté → Discussion (avec backend Supabase)
1. Accès aux discussions
Lorsque l’utilisateur ouvre le bouton :
Afficher le menu / la liste des discussions déjà présentes
Cette partie ne change pas côté design
Supabase
Récupérer la liste des discussions depuis la base de données
Les discussions doivent être :
stockées en base
visibles par tous les utilisateurs concernés
Mise à jour en temps réel (nouvelle discussion visible sans recharger)
2. Ouverture d’une discussion
Quand l’utilisateur clique sur une discussion :
La discussion s’ouvre
Le nom de la discussion s’affiche en haut :
sous : actus / discussion / stats
en petit
sur fond noir
Ajouter un fin trait gris en dessous
Supabase
Charger :
le nom de la discussion
les messages liés à cette discussion
Les données doivent être :
récupérées depuis Supabase
affichées en temps réel
Tous les utilisateurs de la discussion doivent voir les mêmes données
3. Bouton menu
À gauche du nom :
bouton rond avec 3 barres
Au clic :
afficher les 3 boutons principaux du haut jusqu’en bas
Supabase
Aucun besoin spécifique (UI uniquement)
4. Référence design
Utiliser :
même design que la première image
ajouter les éléments décrits
Supabase
Aucun besoin spécifique (UI uniquement)
5. Partage d’un post dans une discussion
Quand l’utilisateur :
voit un post
clique sur partager
choisit une chaîne / abonnement
ajoute un message
clique sur envoyer
Alors :
le message est envoyé dans “général” des communautés choisies
Supabase
Lors de l’envoi :
enregistrer le message en base
enregistrer :
texte ajouté par l’utilisateur
ID du post partagé
ID de l’utilisateur
ID de la discussion (général)
timestamp
Le message doit :
apparaître instantanément pour tous les utilisateurs
être persistant (sauvegardé)
6. Affichage du message dans la discussion
Le message :
affiché comme message classique
En dessous :
encadré
bords arrondis
bordure grise fine
Contenu de l’encadré
Contient :
tout le post partagé
photo de profil → dernier mot
Si image :
affichée en entier
prend toute la largeur
Supabase
Récupérer :
contenu du message
données du post partagé
Les données doivent être :
liées via ID (post_id)
stockées en base
Affichage identique pour tous les utilisateurs
Mise à jour en temps réel
7. Réactions aux messages
Appui 1,5 secondes sur un message :
écran s’assombrit
affichage d’un boudin noir
Contenu
Boutons :
“Motivant”
“réel”
“Pertinent”
bouton pour choisir un émoji
Supabase
Lorsqu’un utilisateur réagit :
enregistrer la réaction en base
données à stocker :
ID du message
ID utilisateur
type de réaction (motivant / réel / pertinent / emoji)
timestamp
Les réactions doivent :
être visibles par tous
se mettre à jour en temps réel
être persistantes
Règles globales backend (Supabase)
Toutes les données doivent être :
stockées
persistantes
partagées entre utilisateurs
Activer :
temps réel (realtime) pour :
messages
discussions
réactions
Chaque élément doit être lié avec des IDs :
user_id
discussion_id
message_id
post_id