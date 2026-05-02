Corrige et améliore le système de progression et le diagramme d’évolution dans mon application FF en utilisant Supabase.

Le diagramme d’évolution du profil ne fonctionne pas correctement. Il doit refléter l’évolution réelle de l’utilisateur en fonction de son activité, de ses objectifs et de son expérience globale dans l’application.

Toutes les données doivent être calculées à partir de Supabase et se mettre à jour automatiquement.

1. DIAGRAMME D’ÉVOLUTION DU PROFIL

Le diagramme doit afficher l’évolution de la progression de l’utilisateur dans le temps.

Cette progression doit être calculée en fonction :

* des Fcoins gagnés
* de la streak
* des posts publiés
* des commentaires
* des messages dans les communautés
* de la progression des objectifs
* de la constance d’utilisation.

Créer ou utiliser la table :

user_progress

* user_id
* progress_score
* created_at
* progress_source

Chaque action importante doit ajouter ou retirer de la progression.

Exemples :

poster un post → +5
commenter → +2
message dans communauté → +2
progression d’objectif → +10
objectif atteint → +50

Si l’utilisateur n’a aucune activité pendant plusieurs jours :

* la progression doit stagner
* elle peut légèrement diminuer si l’objectif n’avance pas.

Le diagramme doit être recalculé dynamiquement à partir des données.

2. BOUTON "30 DERNIERS JOURS"

Le bouton "30 derniers jours" doit afficher les données des 30 derniers jours.

Mais si le compte utilisateur a été créé il y a moins de 30 jours :

* afficher uniquement les jours existants
* ne pas afficher de données fictives.

La requête Supabase doit filtrer :

created_at >= (date actuelle - 30 jours)

Mais limiter à la date de création du compte si elle est plus récente.

3. BOUTON "CETTE SEMAINE"

Le bouton "Cette semaine" doit afficher les données depuis le début de la semaine actuelle.

Si l’utilisateur a créé son compte cette semaine :

* afficher uniquement les jours existants.

Utiliser une requête Supabase basée sur la date actuelle et le début de semaine.

4. OBJECTIFS ACCOMPLIS

Le nombre d’objectifs accomplis ne fonctionne pas correctement.

Actuellement il affiche toujours "1 objectif en cours".

Corriger cela en utilisant la table :

user_goals

* id
* user_id
* goal_title
* progress
* status
* created_at
* completed_at

Les statuts doivent être :

"en_cours"
"accompli"

Quand progress atteint 100% :

* changer status en "accompli"
* enregistrer completed_at.

Dans le profil afficher :

* nombre d’objectifs accomplis
* nombre d’objectifs en cours.

Ces valeurs doivent être calculées depuis Supabase.

5. CONSTANCES D’UTILISATION

Corriger le système de constance.

La constance doit être calculée à partir des actions :

* poster
* commenter
* discuter dans une communauté
* avancer un objectif.

Utiliser la table :

user_activity_log

* id
* user_id
* action_type
* created_at

La constance doit afficher :

* nombre total de jours actifs
* nombre total d’actions.

Le nombre total de jours doit être calculé en comptant les jours uniques où une activité existe.

6. NOMBRE TOTAL DE JOURS SUR FF

Dans le profil afficher :

le nombre total de jours depuis l’inscription.

Calculer :

date actuelle - created_at du compte utilisateur.

7. SYNCHRONISATION AVEC LES FCOINS

Quand l’utilisateur atteint certains seuils :

* 2 jours streak → Fcoin Départ
* 7 jours streak → Fcoin Discipline
* 30 jours streak → Fcoin Constant
* 1 post → Fcoin Premiers pas
* 10 posts → Fcoin Contributeur
* 50 posts → Fcoin Créateur.

Ces Fcoins doivent être attribués automatiquement et enregistrés dans la table :

user_fcoins.

8. MISE À JOUR AUTOMATIQUE DU PROFIL

Chaque fois qu’un utilisateur :

* poste
* commente
* avance son objectif
* gagne un Fcoin
* participe à une communauté

Le système doit :

mettre à jour :

* la progression
* le diagramme
* la constance
* les statistiques du profil.

Toutes les données doivent être récupérées et mises à jour via Supabase pour garantir que le profil reflète l’activité réelle de l’utilisateur.
