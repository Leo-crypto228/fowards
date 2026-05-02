Corrige et unifie complètement le système de suivi (bouton "Avancer avec") dans mon application FF.

Actuellement, certains boutons "Avancer avec" ne fonctionnent pas correctement :

* certains ne peuvent pas être cliqués
* certains ne font rien
* certains ne sauvegardent pas l'abonnement
* certains endroits ne mettent pas à jour l'interface.

Le système doit être corrigé et centralisé pour que le suivi fonctionne partout.

1. FONCTION UNIQUE DE FOLLOW

Créer une fonction backend unique pour suivre un utilisateur.

followUser(follower_id, following_id)

Cette fonction doit :

* vérifier si l'abonnement existe déjà
* créer un nouvel abonnement si ce n'est pas le cas
* enregistrer l'action dans Supabase.

Table utilisée :

user_follows

* id
* follower_id
* following_id
* created_at

Règles :

* un utilisateur ne peut suivre un autre utilisateur qu'une seule fois
* empêcher les doublons
* empêcher de se suivre soi-même.

2. FONCTION DE DÉSABONNEMENT

Créer une fonction :

unfollowUser(follower_id, following_id)

Cette fonction doit :

* supprimer la relation dans user_follows
* mettre à jour immédiatement l'interface.

3. UTILISER LES MÊMES FONCTIONS PARTOUT

Tous les boutons "Avancer avec" doivent utiliser ces fonctions.

Corriger les boutons dans :

* les profils utilisateurs
* les posts
* les commentaires
* les communautés
* la liste des abonnés
* la liste des abonnements
* les posts dans les communautés
* les profils affichés dans les communautés.

4. AFFICHAGE DANS LES PROFILS

Dans chaque profil utilisateur afficher :

Abonnés
→ récupérer les utilisateurs dont following_id = user_id

Abonnements
→ récupérer les utilisateurs dont follower_id = user_id

Ces listes doivent être récupérées depuis Supabase et mises à jour automatiquement.

5. MISE À JOUR DE L'INTERFACE

Quand un utilisateur clique sur "Avancer avec" :

* enregistrer dans Supabase
* changer le bouton en "Suivi"
* mettre à jour le compteur d'abonnés
* mettre à jour les listes abonnés / abonnements.

Quand il clique sur "Suivi" :

* se désabonner
* remettre le bouton "Avancer avec".

6. SYNCHRONISATION DES DONNÉES

Quand une page se charge :

* vérifier si l'utilisateur actuel suit déjà ce profil
* afficher automatiquement le bon état du bouton.

7. API À CRÉER

Créer les routes suivantes :

* suivre un utilisateur
* se désabonner
* récupérer les abonnés d’un utilisateur
* récupérer les abonnements d’un utilisateur.

Toutes les actions doivent être persistées dans Supabase et fonctionner dans toutes les parties de l'application.
