🎯 OBJECTIF GLOBAL
Deja suprime totalement toute les streak qui ya dans l'app.
Reproduire EXACTEMENT le design du post comme sur l’image fournie
(structure, espacements, hiérarchie, proportions, position des éléments).
⚠️ Très important :
Le design doit être strictement identique visuellement
MAIS les données sont dynamiques (contenu variable)
🧱 1. STRUCTURE VISUELLE (IDENTIQUE À L’IMAGE)
Header (au-dessus de l’image)
Afficher :
Photo de profil
Nom (pseudo)
Nombre d’abonnés
Objectif
Bouton “+Foradd” (SI pas encore abonné → utiliser Supabase)
👉 Ajouter un trait fin de séparation sous le header
⚠️ Gestion abonnement
Si utilisateur NON abonné :
→ afficher bouton “+Foradd”
Si utilisateur déjà abonné :
→ NE PAS afficher le bouton
👉 conserver les abonnements existants (ne rien casser)
🔁 2. NAVIGATION PROFIL
Ces éléments doivent être cliquables :
photo de profil
pseudo
objectif
nombre d’abonnés
👉 au clic :
→ ouvrir /profile/{user_id}
⭐ 3. BOUTON LIKE (ÉTOILE)
Design
étoile inclinée (comme image)
État OFF :
contour blanc
fond noir
État ON :
remplie couleur #574fe0
effet immédiat
⚡ Interaction
au clic :
remplissage instantané
AUCUN loading visible
enregistrement :
se fait en arrière-plan (Supabase)
invisible pour l’utilisateur
feedback :
petit “bip” léger (ou haptic mobile)
💬 4. CTA DYNAMIQUE (ULTRA IMPORTANT)
Ajouter un bouton CTA en bas du post.
🎯 Texte selon type de post
Blocage → “J'ai une solution”
Question → “J'ai une reponse”
Avancée → “Encourager”
Conseil → “Remercier”
Actus → “Je veux rebondir”
🖱️ Interaction
Au clic :
ouvrir page du post
scroll vers commentaires
ouvrir clavier
pré-remplir le champ texte automatiquement
✍️ TEXTE AUTO (UNIQUEMENT VIA CTA)
⚠️ IMPORTANT :
fonctionne UNIQUEMENT si clic sur CTA
PAS si clic sur bouton commentaire classique
Texte injecté :
“J'ai une solution” →
👉 "J'ai une solution pour toi :"
“J'ai une reponse” →
👉 "J'ai une reponse pour toi :"
“Encourager” →
👉 "Je veux t'encourager alors"
“Remercier” →
👉 "Tu m'as aidés à"
“Je veux rebondir” →
👉 "Je trouve que c'est"
🎨 5. DESIGN CTA
bouton large
centré
visible
arrondi
contrasté
👉 doit être un des éléments les plus visibles du post
⚠️ 6. CONTRAINTES IMPORTANTES
Garder EXACTEMENT :
structure actuelle des posts
fonctionnement Supabase
interactions existantes
Ajouter uniquement :
CTA
comportement étoile
navigation
logique Foradd
⚙️ 7. SUPABASE (EXISTANT + EXTENSION OBLIGATOIRE)
Règle globale
👉 Toutes les actions doivent être connectées à Supabase
👉 Données persistées + mises à jour en temps réel
🧑‍💻 TABLES
users
id
username
profile_picture
subscribers_count
objective
score_user
posts
id
user_id
content
image_url (nullable)
type_post
created_at
score_post
likes
id
user_id
post_id
created_at
comments
id
user_id
post_id
content
is_useful
created_at
follows
id
follower_id
following_id
⭐ LIKE — SUPABASE
Vérifier :
SELECT * FROM likes
WHERE user_id = current_user
AND post_id = X
Si pas liké :
INSERT INTO likes (user_id, post_id)
Si déjà liké :
DELETE FROM likes
WHERE user_id = current_user
AND post_id = X
👉 Mettre à jour :
compteur de likes (UI instant + sync)
score_post (async)
💬 COMMENTAIRES — SUPABASE
INSERT INTO comments (user_id, post_id, content)
Commentaire utile
UPDATE comments
SET is_useful = true
WHERE id = X
📊 DIAGRAMME — SUPABASE
SELECT COUNT(*)
FROM comments
WHERE user_id = current_user
AND is_useful = true
GROUP BY date
👥 FOLLOW — SUPABASE
Vérifier :
SELECT * FROM follows
WHERE follower_id = current_user
AND following_id = post_user
Follow :
INSERT INTO follows (follower_id, following_id)
👉 Update :
subscribers_count
UI instant
📈 SCORE POST
UPDATE posts
SET score_post = X
WHERE id = post_id
👤 SCORE USER
UPDATE users
SET score_user = X
WHERE id = user_id
🔄 FEED
SELECT * FROM posts
ORDER BY score_post DESC
LIMIT 50
👉 + ajouter posts récents
⚡ OPTIMISATION
Supabase Realtime
cache local
lazy loading
🎯 SYNCHRONISATION TEMPS RÉEL
nouveaux posts
nouveaux commentaires
nouveaux likes
👉 mise à jour UI sans refresh
🚀 OBJECTIF TECHNIQUE
aucune latence visible
UI instantanée
backend async
🔧 AJOUT — POSTS SANS IMAGE
Si pas d’image :
texte plein écran
aligné avec photo de profil (gauche → droite)
fond noir ou léger gradient
lisibilité max
👉 structure identique sinon
📊 DIAGRAMME COMMENTAIRES UTILES
Règles
❌ ne pas influencer directement le feed
✅ utilisé comme feedback motivation
Type
👉 LINÉAIRE
Position
👉 au-dessus du gradient d’évolution
il prendre la meme largeur que le diagramme d’evolution
Données :
commentaires utiles (se connecte l'algo et au comme post si utile ou pas)
évolution (jour / semaine / cumul)
Design :
👉 EXACTEMENT le même que le diagramme d’évolution
Règles UX
pas de classement
pas de comparaison
rester subtil, et dans le gradient ya ecrit en haut "Les commentaires qui aide" et en dessous les trois boutons jour / semaine / cumulé (comme l'evolution) puis le diagramme
🎯 ALGO — FEED INTELLIGENT
Score post
score_post =
(commentaires_utiles × 3)
+ (likes × 1)
+ (partages × 2)
+ (récence × 2)
+ (bonus_type_post)
+ (bonus_auteur_actif)
bonus_type_post
Blocage → +3
Question → +2
Avancée → +1
score_user
score_user =
(aides_données × 2)
+ (commentaires_utiles × 3)
+ (posts_actifs × 1)
Boost
score_final_post = score_post + (score_user × 0.5)
Feed
trier par score
top 20–50
ajouter récents
Récence
bonus_récence = inverse_du_temps
🎯 OBJECTIF PRODUIT
favoriser posts utiles
pousser à aider
augmenter engagement
éviter contenu mort
feed dynamique
🧠 RÉSULTAT ATTENDU
bons posts visibles
utilisateurs utiles mis en avant
interactions
app vivante
