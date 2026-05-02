import { ProgressCard } from "../components/ProgressCard";
import { Search, WifiOff, Wifi, RefreshCw, Bell } from "lucide-react";
import logoImage from "figma:asset/cd3b49eafdee7adc585eb4cea8cc18850443b810.png";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";

import { FollowButton } from "../components/FollowButton";
import { searchHashtags, searchUsers } from "../data/suggestions";
import { HighlightInput } from "../components/HighlightInput";
import { getAllPosts, ApiPost } from "../api/postsApi";
import { getFollowingFeed, type FeedPost } from "../api/followsApi";
import { getBatchGoalProgress } from "../api/progressionApi";
import { useFollow } from "../context/FollowContext";
import { useAuth } from "../context/AuthContext";
import { GLOBAL_PROFILES_MAP } from "../data/profiles";
import { ensureFictitiousPosts, FICTITIOUS_POSTS } from "../api/seedApi";
import { useNotifications } from "../context/NotificationContext";
import { FollowsListSection } from "../components/FollowsListSection";

const USER_AVATAR =
  "https://images.unsplash.com/photo-1584940121730-93ffb8aa88b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200";
const USER_STREAK = 27;

/* ───── Post images ───── */
const IMG_SAAS    = "https://images.unsplash.com/photo-1670761301241-7cec3cd6a925?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_MONEY   = "https://images.unsplash.com/photo-1660970781103-ba6749cb9ce3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_RUN     = "https://images.unsplash.com/photo-1706029831332-67734fbf73d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_TRAVEL  = "https://images.unsplash.com/photo-1743356174523-b04efcc66b46?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_YOGA    = "https://images.unsplash.com/photo-1665950865910-733277270459?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_COOK    = "https://images.unsplash.com/photo-1758523420342-330c7e4e3e1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_MUSIC   = "https://images.unsplash.com/photo-1658010557310-e887544d7f4a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_PHOTO   = "https://images.unsplash.com/photo-1682445090053-1cfb63f3306a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_OFFICE  = "https://images.unsplash.com/photo-1760611656615-db3fad24a314?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_BOOK    = "https://images.unsplash.com/photo-1524591282491-edb48a0fca8f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_GYM     = "https://images.unsplash.com/photo-1552848031-326ec03fe2ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_CYCLE   = "https://images.unsplash.com/photo-1605271998276-db59cb8455bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_DESIGN  = "https://images.unsplash.com/photo-1763621569464-409a050b112e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_JAPAN   = "https://images.unsplash.com/photo-1662107399413-ccaf9bbb1ce9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_PODCAST = "https://images.unsplash.com/photo-1627667050609-d4ba6483a368?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_SWIM    = "https://images.unsplash.com/photo-1768576544598-7ad9f8a1d9a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_DATA    = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_HIKE    = "https://images.unsplash.com/photo-1687270282079-58b4689fed0f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_CHESS   = "https://images.unsplash.com/photo-1687862528147-0ecb1aa4b81d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const IMG_INVEST  = "https://images.unsplash.com/photo-1766218329569-53c9270bb305?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

/* ───── Mock data ───── */

const POUR_VOUS = [
  {
    user: { name: "Sarah Martin", avatar: "https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Marathon en 6 mois", followers: 1240 },
    streak: 42, progress: { type: "avancement" as const, description: "Course de 15km ce matin. J'ai battu mon record personnel de 2 minutes. La constance commence à payer.", timestamp: "2h" },
    image: IMG_RUN, verified: false, isRelevant: false, relevantCount: 82, commentsCount: 12, sharesCount: 5, viewsCount: 870, isNew: true,
    hashtags: ["#Marathon", "#Running", "#Constance"],
  },
  {
    user: { name: "Thomas Dubois", avatar: "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lancer mon SaaS", followers: 3800 },
    streak: 87, progress: { type: "new" as const, description: "3 heures de code aujourd'hui. J'ai intégré le système de paiement. Plus que l'authentification à finaliser.\n\nLa progression est lente mais régulière.", timestamp: "4h" },
    image: IMG_SAAS, verified: true, isRelevant: false, relevantCount: 124, commentsCount: 45, sharesCount: 18, viewsCount: 2100, isNew: true,
    hashtags: ["#SaaS", "#BuildInPublic", "#Indiehacker"],
  },
  {
    user: { name: "Camille Rousseau", avatar: "https://images.unsplash.com/photo-1607346256330-abd12a0cd65c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Méditation quotidienne 1 an", followers: 670 },
    streak: 21, progress: { type: "bilan" as const, description: "21 jours consécutifs de méditation. 20 minutes chaque matin avant le café. Mon niveau de stress a baissé de façon perceptible. Le cerveau s'adapte vraiment.", timestamp: "3h" },
    image: IMG_YOGA, verified: false, isRelevant: false, relevantCount: 67, commentsCount: 9, sharesCount: 4, viewsCount: 740, isNew: true,
    hashtags: ["#Méditation", "#Mindfulness", "#Bien-être"],
  },
  {
    user: { name: "Nadia Leblanc", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Maîtriser la cuisine japonaise", followers: 980 },
    streak: 45, progress: { type: "avancement" as const, description: "Ramen maison réussi pour la première fois ! Le bouillon a mijoté 6h. Le résultat est incroyable. La patience en cuisine, c'est 90% du résultat.", timestamp: "5h" },
    image: IMG_COOK, verified: false, isRelevant: false, relevantCount: 93, commentsCount: 21, sharesCount: 8, viewsCount: 1200, isNew: true,
    hashtags: ["#Cuisine", "#Ramen", "#JapaneseCooking"],
  },
  {
    user: { name: "Julien Moreau", avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Sortir mon premier EP", followers: 430 },
    streak: 13, progress: { type: "new" as const, description: "Première vraie session d'enregistrement en studio aujourd'hui. 3 titres posés. L'acoustique de la pièce fait toute la différence. Je recommence demain.", timestamp: "6h" },
    image: IMG_MUSIC, verified: false, isRelevant: false, relevantCount: 45, commentsCount: 7, sharesCount: 3, viewsCount: 530, isNew: false,
    hashtags: ["#Musique", "#Studio", "#EP"],
  },
  {
    user: { name: "Marie Laurent", avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Apprendre le japonais", followers: 2100 },
    streak: 156, progress: { type: "bilan" as const, description: "Aujourd'hui, j'ai révisé ma méthode d'apprentissage. Je vais me concentrer sur la conversation plutôt que l'écriture pour le prochain mois.", timestamp: "5h" },
    verified: true, isRelevant: false, relevantCount: 91, commentsCount: 23, sharesCount: 8, viewsCount: 1500, isNew: true,
    hashtags: ["#Japonais", "#Apprentissage", "#Langues"],
  },
  {
    user: { name: "Chloé Bernard", avatar: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Publier 100 photos de voyage", followers: 5200 },
    streak: 78, progress: { type: "objectif" as const, description: "Sortie photo au lever du soleil ce matin. 47 clichés dont 3 vraiment exceptionnels. La lumière dorée de 6h30 est incomparable. Je comprends enfin pourquoi les photographes se lèvent tôt.", timestamp: "7h" },
    image: IMG_PHOTO, verified: true, isRelevant: false, relevantCount: 187, commentsCount: 52, sharesCount: 24, viewsCount: 2900, isNew: false,
    hashtags: ["#Photographie", "#GoldenHour", "#Travel"],
  },
  {
    user: { name: "Lucas Bernard", avatar: "https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Indépendance financière", followers: 2100 },
    streak: 31, progress: { type: "objectif" as const, description: "Portfolio investi +12% ce trimestre. La diversification commence à montrer ses effets. Chaque mois régulier compte.", timestamp: "7h" },
    image: IMG_MONEY, verified: false, isRelevant: false, relevantCount: 156, commentsCount: 34, sharesCount: 12, viewsCount: 1800,
    hashtags: ["#Finance", "#Investissement", "#IndépendanceFinancière"],
  },
  {
    user: { name: "Paul Renard", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Créer mon agence digitale", followers: 760 },
    streak: 38, progress: { type: "avancement" as const, description: "Premier client signé aujourd'hui ! Un contrat de 3 mois avec une startup locale. L'agence commence à exister concrètement. Chaque étape compte.", timestamp: "8h" },
    image: IMG_OFFICE, verified: false, isRelevant: false, relevantCount: 134, commentsCount: 38, sharesCount: 16, viewsCount: 2100,
    hashtags: ["#Agence", "#Entrepreneuriat", "#PremierClient"],
  },
  {
    user: { name: "Emma Petit", avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Écrire un roman", followers: 4300 },
    streak: 203, progress: { type: "lecon" as const, description: "Chapitre 12 terminé ! 2500 mots aujourd'hui. L'arc narratif prend forme. La constance quotidienne transforme le projet en réalité.", timestamp: "9h" },
    verified: true, isRelevant: false, relevantCount: 234, commentsCount: 67, sharesCount: 31, viewsCount: 3200,
    hashtags: ["#Écriture", "#Roman", "#Créativité"],
  },
  {
    user: { name: "Isabelle Martin", avatar: "https://images.unsplash.com/photo-1521252659862-eec69941b071?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lire 52 livres en 1 an", followers: 3100 },
    streak: 112, progress: { type: "bilan" as const, description: "Livre 23/52 terminé ce soir. 'Atomic Habits' — le meilleur livre que j'ai lu cette année. Le concept d'identité avant les habitudes a changé ma façon de voir les choses.", timestamp: "10h" },
    image: IMG_BOOK, verified: true, isRelevant: false, relevantCount: 178, commentsCount: 44, sharesCount: 27, viewsCount: 2600,
    hashtags: ["#Lecture", "#AtomicHabits", "#Development"],
  },
  {
    user: { name: "Nicolas Faure", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Perdre 15kg et muscler", followers: 1890 },
    streak: 55, progress: { type: "avancement" as const, description: "PR squat aujourd'hui : 120kg ! Il y a 3 mois je peinais à 80kg. La progression linéaire ça marche vraiment. Petit à petit l'oiseau fait son nid.", timestamp: "11h" },
    image: IMG_GYM, verified: false, isRelevant: false, relevantCount: 201, commentsCount: 58, sharesCount: 19, viewsCount: 3100,
    hashtags: ["#Fitness", "#Squat", "#PR"],
  },
  {
    user: { name: "Maxime Dupont", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Traverser la France à vélo", followers: 540 },
    streak: 29, progress: { type: "objectif" as const, description: "80km aujourd'hui dans le Vercors. Les montées sont brutales mais la vue du sommet efface tout. J'ai compris pourquoi les cyclistes sont obsédés par les cols.", timestamp: "13h" },
    image: IMG_CYCLE, verified: false, isRelevant: false, relevantCount: 112, commentsCount: 29, sharesCount: 11, viewsCount: 1700,
    hashtags: ["#Cyclisme", "#Vercors", "#France"],
  },
  {
    user: { name: "Antoine Rousseau", avatar: "https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir développeur Full-Stack", followers: 870 },
    streak: 64, progress: { type: "conseil" as const, description: "Aujourd'hui j'ai planifié mon roadmap pour les 3 prochains mois. Focus sur React, Node.js et PostgreSQL.", timestamp: "11h" },
    verified: false, isRelevant: false, relevantCount: 98, commentsCount: 28, sharesCount: 15, viewsCount: 1400,
    hashtags: ["#Dev", "#React", "#FullStack"],
  },
  {
    user: { name: "Elodie Chen", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir UI/UX designer freelance", followers: 6700 },
    streak: 91, progress: { type: "new" as const, description: "Nouveau projet dans mon portfolio ! Refonte complète de l'app d'un cabinet médical. Interface pensée d'abord pour les patients âgés. L'accessibilité, c'est pas un bonus.", timestamp: "14h" },
    image: IMG_DESIGN, verified: true, isRelevant: false, relevantCount: 223, commentsCount: 61, sharesCount: 33, viewsCount: 3700,
    hashtags: ["#UX", "#Design", "#Accessibilité"],
  },
  {
    user: { name: "Hugo Lambert", avatar: "https://images.unsplash.com/photo-1463453091185-61582044d556?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Parler japonais couramment", followers: 1350 },
    streak: 62, progress: { type: "avancement" as const, description: "Première conversation complète en japonais avec un natif sur Tandem. Je n'ai consulté le dictionnaire qu'une fois. Il y a 4 mois je ne savais pas dire bonjour.", timestamp: "15h" },
    image: IMG_JAPAN, verified: false, isRelevant: false, relevantCount: 144, commentsCount: 37, sharesCount: 14, viewsCount: 2200,
    hashtags: ["#日本語", "#Japonais", "#Tandem"],
  },
  {
    user: { name: "Alexia Torres", avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lancer mon podcast tech", followers: 920 },
    streak: 34, progress: { type: "new" as const, description: "Épisode 12 enregistré et monté en 3h chrono. J'ai enfin trouvé mon rythme de production. La régularité avant la perfection.", timestamp: "16h" },
    image: IMG_PODCAST, verified: false, isRelevant: false, relevantCount: 87, commentsCount: 18, sharesCount: 9, viewsCount: 1300,
    hashtags: ["#Podcast", "#Tech", "#Content"],
  },
  {
    user: { name: "Pierre Leclerc", avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Nager 100km cette année", followers: 380 },
    streak: 18, progress: { type: "avancement" as const, description: "48km sur 100km. Mi-parcours atteint ! La nage de fond m'a appris quelque chose : quand t'es dans l'eau, tu peux pas fuir tes pensées. C'est presque méditatif.", timestamp: "18h" },
    image: IMG_SWIM, verified: false, isRelevant: false, relevantCount: 56, commentsCount: 11, sharesCount: 4, viewsCount: 820,
    hashtags: ["#Natation", "#Endurance", "#100km"],
  },
  {
    user: { name: "Yasmine Hassan", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir data analyst", followers: 4800 },
    streak: 143, progress: { type: "lecon" as const, description: "Dashboard Power BI terminé pour mon projet perso. J'ai visualisé 6 mois de mes propres données : sommeil, sport, productivité. Les corrélations sont fascinantes.", timestamp: "20h" },
    image: IMG_DATA, verified: true, isRelevant: false, relevantCount: 198, commentsCount: 54, sharesCount: 28, viewsCount: 3400,
    hashtags: ["#Data", "#PowerBI", "#Analytics"],
  },
  {
    user: { name: "Baptiste Roy", avatar: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Faire les 5 GR alpins", followers: 2600 },
    streak: 7, progress: { type: "objectif" as const, description: "GR5 — Jour 3. Nuit en bivouac à 2400m d'altitude. Température : -2°C. Réveil à 5h pour voir le lever de soleil sur les Écrins. Aucun regret.", timestamp: "22h" },
    image: IMG_HIKE, verified: false, isRelevant: false, relevantCount: 312, commentsCount: 88, sharesCount: 47, viewsCount: 5100, isNew: false,
    hashtags: ["#GR5", "#Alpinisme", "#Bivouac"],
  },
];

const SUBSCRIPTIONS_PROFILES = [
  { name: "Thomas Dubois",    avatar: "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  streak: 87,  objective: "Lancer mon SaaS",           progress: 72, followers: 3800 },
  { name: "Marie Laurent",    avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  streak: 156, objective: "Apprendre le japonais",      progress: 58, followers: 2100 },
  { name: "Emma Petit",       avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  streak: 203, objective: "Écrire un roman",             progress: 84, followers: 4300 },
  { name: "Antoine Rousseau", avatar: "https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", streak: 64,  objective: "Dev Full-Stack",              progress: 41, followers: 870  },
  { name: "Lucas Bernard",    avatar: "https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  streak: 31,  objective: "Indépendance financière",     progress: 29, followers: 2100 },
  { name: "Sarah Martin",     avatar: "https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  streak: 42,  objective: "Marathon 6 mois",             progress: 55, followers: 1240 },
  { name: "Yasmine Hassan",   avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  streak: 143, objective: "Devenir data analyst",        progress: 78, followers: 4800 },
  { name: "Elodie Chen",      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  streak: 91,  objective: "Designer freelance",          progress: 63, followers: 6700 },
  { name: "Nicolas Faure",    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",  streak: 55,  objective: "Perdre 15kg et muscler",      progress: 47, followers: 1890 },
];

const ABONNEMENTS = [
  {
    user: { name: "Thomas Dubois", avatar: "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lancer mon SaaS", followers: 3800 },
    streak: 87, progress: { type: "question" as const, description: "Comment vous gérez la motivation les jours où vous n'avez pas envie ? Je cherche des stratégies concrètes pour les passages à vide.", timestamp: "1h" },
    verified: true, isRelevant: false, relevantCount: 57, commentsCount: 38, sharesCount: 4, viewsCount: 920, isNew: true,
    hashtags: ["#Motivation", "#SaaS", "#Mindset"],
  },
  {
    user: { name: "Marie Laurent", avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Apprendre le japonais", followers: 2100 },
    streak: 156, progress: { type: "infos" as const, description: "J'ai rejoint un groupe de conversation en japonais. Première session demain soir. Un peu stressée mais très excitée !", timestamp: "3h" },
    image: IMG_JAPAN, verified: true, isRelevant: true, relevantCount: 74, commentsCount: 19, sharesCount: 6, viewsCount: 1100, isNew: true,
    hashtags: ["#Japonais", "#Communauté", "#Progression"],
  },
  {
    user: { name: "Yasmine Hassan", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir data analyst", followers: 4800 },
    streak: 143, progress: { type: "avancement" as const, description: "Certif SQL obtenue ce matin. 3 mois de préparation. Le score final : 94/100. La prochaine étape c'est la certif Python pour l'analyse de données.", timestamp: "2h" },
    image: IMG_DATA, verified: true, isRelevant: false, relevantCount: 167, commentsCount: 43, sharesCount: 21, viewsCount: 2900, isNew: true,
    hashtags: ["#SQL", "#Certification", "#Data"],
  },
  {
    user: { name: "Emma Petit", avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Écrire un roman", followers: 4300 },
    streak: 203, progress: { type: "conseil" as const, description: "Pour ceux qui écrivent : réservez un créneau fixe chaque jour, même 20 minutes. La régularité bat l'inspiration. En 6 mois j'ai produit 80 000 mots grâce à ça.", timestamp: "6h" },
    verified: true, isRelevant: false, relevantCount: 189, commentsCount: 52, sharesCount: 44, viewsCount: 4100,
    hashtags: ["#Écriture", "#Constance", "#Productivité"],
  },
  {
    user: { name: "Elodie Chen", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir UI/UX designer freelance", followers: 6700 },
    streak: 91, progress: { type: "new" as const, description: "J'ai accepté ma première mission freelance ! 3 semaines de mission pour une fintech parisienne. Taux journalier négocié à 450€. Le portfolio en ligne ça marche.", timestamp: "4h" },
    image: IMG_DESIGN, verified: true, isRelevant: true, relevantCount: 245, commentsCount: 71, sharesCount: 38, viewsCount: 4800, isNew: true,
    hashtags: ["#Freelance", "#UX", "#Design"],
  },
  {
    user: { name: "Antoine Rousseau", avatar: "https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir développeur Full-Stack", followers: 870 },
    streak: 64, progress: { type: "avancement" as const, description: "Premier projet en production ! Une API REST complète avec authentification JWT. C'est petit, mais c'est le mien.", timestamp: "8h" },
    image: IMG_SAAS, verified: false, isRelevant: false, relevantCount: 143, commentsCount: 41, sharesCount: 22, viewsCount: 2700,
    hashtags: ["#Dev", "#API", "#FullStack"],
  },
  {
    user: { name: "Nicolas Faure", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Perdre 15kg et muscler", followers: 1890 },
    streak: 55, progress: { type: "lecon" as const, description: "Leçon durement apprise : la récupération compte autant que l'entraînement. J'ai ignoré les signaux de mon corps pendant 2 semaines. Résultat : tendinite. Prenez vos jours de repos.", timestamp: "10h" },
    image: IMG_GYM, verified: false, isRelevant: false, relevantCount: 156, commentsCount: 47, sharesCount: 18, viewsCount: 2400,
    hashtags: ["#Fitness", "#Récupération", "#Leçon"],
  },
  {
    user: { name: "Lucas Bernard", avatar: "https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Indépendance financière", followers: 2100 },
    streak: 31, progress: { type: "bilan" as const, description: "Bilan du mois : +8% sur le portefeuille. La discipline d'investissement mensuel commence à vraiment payer. Patience et constance.", timestamp: "1j" },
    image: IMG_INVEST, verified: false, isRelevant: false, relevantCount: 112, commentsCount: 27, sharesCount: 9, viewsCount: 2100,
    hashtags: ["#Finance", "#Bilan", "#Investissement"],
  },
  {
    user: { name: "Sarah Martin", avatar: "https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Marathon en 6 mois", followers: 1240 },
    streak: 42, progress: { type: "objectif" as const, description: "Inscrite au marathon de Paris. La date est fixée. Maintenant je m'y tiens. 42km dans 4 mois.", timestamp: "1j" },
    image: IMG_RUN, verified: false, isRelevant: false, relevantCount: 88, commentsCount: 15, sharesCount: 7, viewsCount: 1350,
    hashtags: ["#Marathon", "#Paris", "#Running"],
  },
  {
    user: { name: "Maxime Dupont", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Traverser la France à vélo", followers: 540 },
    streak: 29, progress: { type: "infos" as const, description: "J'ai tracé l'itinéraire complet : 1800km de Dunkerque à Hendaye. Départ prévu dans 6 semaines. Je documente tout ici. Restez à bord.", timestamp: "2j" },
    image: IMG_CYCLE, verified: false, isRelevant: true, relevantCount: 203, commentsCount: 66, sharesCount: 41, viewsCount: 3800,
    hashtags: ["#Cyclisme", "#France", "#Aventure"],
  },
];

const TABS = ["Pour vous", "Abonnements"] as const;
type Tab = (typeof TABS)[number];

// ── Le registre de profils est maintenant centralisé dans /src/app/data/profiles.ts
// GLOBAL_PROFILES_MAP est importé depuis ce module.

/* ───── Subscription profile card ───── */
function SubscriptionCard({ name, avatar, streak, objective, progress, followers, username: usernameProp }: {
  name: string; avatar: string; streak: number; objective: string; progress: number; followers: number;
  username?: string;
}) {
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);
  const safeName = name || "";
  const handle   = safeName.toLowerCase().replace(/\s+/g, "_");
  const username = usernameProp || safeName.toLowerCase().replace(/\s+/g, "");
  const initial  = (safeName.trim()[0] ?? "?").toUpperCase();

  const CARD_W   = 178;
  const BANNER_H = 78;
  const AVT      = 52;
  const AVT_TOP  = BANNER_H - Math.round(AVT * (2 / 3));
  const PTOP     = Math.round(AVT / 3) + 10;

  // Palette de couleurs de fallback dérivée du nom
  const fallbackBg = ["#1e1b4b","#0f172a","#14291a","#1a1429","#1a2740"][
    (safeName.charCodeAt(0) ?? 0) % 5
  ];

  return (
    <motion.div
      className="flex-shrink-0"
      style={{
        width: CARD_W,
        borderRadius: 20,
        background: "#0d0d0d",
        border: "0.5px solid rgba(255,255,255,0.09)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.05)",
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        userSelect: "none",
      }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onClick={() => navigate(`/profile/${username}`)}
    >
      {/* ── Bannière (~35%) ── */}
      <div style={{ height: BANNER_H, overflow: "hidden", position: "relative", background: fallbackBg }}>
        {avatar && !imgFailed ? (
          <img
            src={avatar}
            alt=""
            onError={() => setImgFailed(true)}
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              filter: "blur(10px) saturate(1.3) brightness(0.55)",
              transform: "scale(1.18)",
            }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(135deg, ${fallbackBg} 0%, rgba(0,0,0,0.6) 100%)`,
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(13,13,13,0.72) 100%)",
        }} />
      </div>

      {/* ── Avatar chevauchant ── */}
      <div
        style={{
          position: "absolute", top: AVT_TOP, left: 14, zIndex: 5,
          width: AVT, height: AVT, borderRadius: "50%",
          overflow: "hidden",
          border: "2.5px solid rgba(255,255,255,0.82)",
          boxShadow: "0 3px 14px rgba(0,0,0,0.45)",
          background: fallbackBg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {avatar && !imgFailed ? (
          <img
            src={avatar}
            alt={name}
            onError={() => setImgFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: AVT * 0.40, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>
            {initial}
          </span>
        )}
      </div>

      {/* ── Contenu texte — ancré juste sous l'avatar ── */}
      <div
        style={{
          paddingTop: PTOP,
          paddingLeft: 14,
          paddingRight: 14,
          paddingBottom: 16,
        }}
      >
        {/* Nom complet */}
        <p
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 3,
          }}
        >
          {name}
        </p>

        {/* @handle */}
        <p
          style={{
            fontSize: 13,
            fontWeight: 400,
            color: "rgba(255,255,255,0.32)",
            marginBottom: 8,
          }}
        >
          {handle}
        </p>

        {/* Objectif + abonnés */}
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.50)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
            marginBottom: 4,
          }}
        >
          {objective}
        </p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginBottom: 10 }}>
          {followers >= 1000 ? `${(followers / 1000).toFixed(1)}k` : followers} abonnés
        </p>

        {/* Barre de progression */}
        <div style={{ marginBottom: 5 }}>
          <div
            style={{
              position: "relative",
              height: 5,
              borderRadius: 999,
              background: "rgba(255,255,255,0.07)",
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.1, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #4f46e5 0%, #818cf8 60%, #a5b4fc 100%)",
                boxShadow: "0 0 8px rgba(99,102,241,0.55)",
              }}
            />
          </div>
        </div>

        {/* Pourcentage */}
        <p
          style={{
            fontSize: 11,
            color: "rgba(165,180,252,0.65)",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {progress}% de l'objectif
        </p>

        {/* Bouton Avancez avec — composant partagé */}
        <div style={{ marginTop: 10 }}>
          <FollowButton username={username} size="sm" />
        </div>
      </div>
    </motion.div>
  );
}

/* ───��─ Autocomplete dropdown ───── */
function AutocompleteDropdown({
  hashSuggestions, userSuggestions, onSelectHash, onSelectUser,
}: {
  hashSuggestions: string[];
  userSuggestions: { handle: string; name: string; avatar: string }[];
  onSelectHash: (h: string) => void;
  onSelectUser: (u: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.14 }}
      style={{
        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60,
        background: "#0d0d0d",
        border: "1px solid rgba(255,255,255,0.10)",
        borderTop: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "0 0 22px 22px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.72)",
        overflow: "hidden",
      }}
    >
      {hashSuggestions.map((h, i) => (
        <motion.button key={h} whileTap={{ scale: 0.97 }} onClick={() => onSelectHash(h)}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 18px",
            background: "transparent", border: "none",
            borderBottom: i < hashSuggestions.length - 1 || userSuggestions.length > 0
              ? "0.5px solid rgba(255,255,255,0.07)" : "none",
            cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{ fontSize: 14, color: "#818cf8", fontWeight: 700 }}>#</span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.82)", fontWeight: 500 }}>{h}</span>
        </motion.button>
      ))}
      {userSuggestions.map((u, i) => (
        <motion.button key={u.handle} whileTap={{ scale: 0.97 }} onClick={() => onSelectUser(u.handle)}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 18px",
            background: "transparent", border: "none",
            borderBottom: i < userSuggestions.length - 1 ? "0.5px solid rgba(255,255,255,0.07)" : "none",
            cursor: "pointer", textAlign: "left",
          }}
        >
          <img src={u.avatar} alt={u.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(99,102,241,0.25)" }} />
          <div>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{u.name}</span>
            <span style={{ fontSize: 12, color: "#818cf8", marginLeft: 6 }}>{u.handle}</span>
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
}

/* ───── Main Feed ───── */
export function Feed() {
  const [activeTab, setActiveTab] = useState<Tab>("Pour vous");
  const [query, setQuery] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { followedList, currentUserId } = useFollow();
  const { user: authUser } = useAuth();
  const { unreadCount } = useNotifications();

  // ── Scroll-aware header ────────────────────────────────────────────────────
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    if (!headerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setHeaderH(e.contentRect.height + 2); // +2 for border
    });
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  // Reset header + scroll à chaque arrivée sur le feed
  useEffect(() => {
    if (location.pathname !== "/") return;
    setHeaderVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const scrollEl = document.querySelector("main") as HTMLElement | null;
    if (scrollEl) scrollEl.scrollTop = 0;
    lastScrollY.current = 0;
  }, [location.pathname]);

  useEffect(() => {
    const scrollEl = document.querySelector("main") as HTMLElement | null;
    if (!scrollEl) return;

    const onScroll = () => {
      const y = scrollEl.scrollTop;
      const delta = y - lastScrollY.current;

      // Always visible at very top
      if (y < 8) {
        setHeaderVisible(true);
        if (idleTimer.current) clearTimeout(idleTimer.current);
        lastScrollY.current = y;
        return;
      }

      if (delta < -4) setHeaderVisible(true);      // scroll UP → show
      else if (delta > 4) setHeaderVisible(false);  // scroll DOWN → hide

      lastScrollY.current = y;

      // Auto-hide after 1.5s idle (only when not at top)
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setHeaderVisible(false), 1500);
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  // Utiliser les vraies données de l'utilisateur connecté
  const liveAvatar = authUser?.avatar || USER_AVATAR;
  const liveStreak = authUser?.streak ?? USER_STREAK;

  // ── API posts state ──────────────────────────────────────────────────────
  const [apiPosts, setApiPosts] = useState<ApiPost[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchApiPosts = useCallback(async () => {
    setLoadingApi(true);
    setApiError(null);
    try {
      // Seed fictif en arrière-plan — NON-BLOQUANT (fire & forget).
      // Si le serveur est inaccessible, on n'attend pas et on charge quand même les posts.
      ensureFictitiousPosts().catch((e) =>
        console.warn("Seed fictif ignoré (serveur inaccessible):", e)
      );
      const { posts } = await getAllPosts(60);
      // Filtrer les posts sans user.name pour éviter les crashes toLowerCase
      const valid = posts.filter(p => p?.user?.name);
      // Tri décroissant par createdAt (filet de sécurité côté frontend)
      valid.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setApiPosts(valid);
    } catch (err) {
      console.error("Erreur chargement posts API:", err);
      setApiError("Serveur temporairement inaccessible — affichage des posts de démonstration.");
    } finally {
      setLoadingApi(false);
    }
  }, []);

  useEffect(() => {
    fetchApiPosts();
  }, [fetchApiPosts, location.state?.refreshPosts]);

  // ── Feed Abonnements depuis Supabase ─────────────────────────────────────
  const [followingPosts, setFollowingPosts] = useState<FeedPost[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<{
    name: string; avatar: string; streak: number; objective: string;
    progress: number; followers: number; username: string;
  }[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const followingLoadedRef = useRef(false);

  // ── Vraie progression Supabase (objectif principal) pour TOUS les suivis ─────
  // Source de vérité unique — se met à jour à chaque changement de followedList.
  const [realGoalProgress, setRealGoalProgress] = useState<
    Record<string, { progress: number; title: string }>
  >({});

  const fetchRealGoalProgress = useCallback(async (usernames: string[]) => {
    if (!usernames.length) return;
    try {
      const result = await getBatchGoalProgress(usernames);
      setRealGoalProgress((prev) => ({ ...prev, ...result }));
    } catch (err) {
      console.error("Feed: erreur fetchRealGoalProgress:", err);
    }
  }, []);

  // Se déclenche à chaque changement de followedList (follow / unfollow / login)
  useEffect(() => {
    if (followedList.length > 0) fetchRealGoalProgress(followedList);
  }, [followedList, fetchRealGoalProgress]);

  const fetchFollowingFeed = useCallback(async (force = false) => {
    if (followingLoadedRef.current && !force) return;
    if (!currentUserId) return;
    setLoadingFollowing(true);
    setFollowingError(null);
    try {
      const { posts, following } = await getFollowingFeed(currentUserId, 50);
      setFollowingPosts(posts);

      // Dériver les profils cards depuis les posts (unique par username)
      const profileMap = new Map<string, {
        name: string; avatar: string; streak: number; objective: string;
        progress: number; followers: number; username: string;
      }>();
      for (const p of posts) {
        if (!profileMap.has(p.username)) {
          profileMap.set(p.username, {
            name: p.user.name, avatar: p.user.avatar,
            streak: p.streak, objective: p.user.objective,
            progress: 0, // sera écrasé par realGoalProgress (state dédié)
            followers: p.user.followers ?? 0, username: p.username,
          });
        }
      }
      // Pour les suivis sans post encore dans Supabase, fallback sur GLOBAL_PROFILES_MAP
      for (const username of following) {
        if (!profileMap.has(username)) {
          const known = GLOBAL_PROFILES_MAP.get(username);
          if (known) profileMap.set(username, { ...known, progress: 0, username });
        }
      }
      setFollowingProfiles(Array.from(profileMap.values()));
      followingLoadedRef.current = true;
      // Déclenche aussi un fetch de progression pour les profils issus des posts
      fetchRealGoalProgress(Array.from(profileMap.keys()));
    } catch (err) {
      console.error("Erreur feed abonnements:", err);
      setFollowingError("Impossible de charger le feed abonnements.");
    } finally {
      setLoadingFollowing(false);
    }
  }, [currentUserId, fetchRealGoalProgress]);

  useEffect(() => {
    if (activeTab === "Abonnements" && currentUserId) fetchFollowingFeed();
  }, [activeTab, fetchFollowingFeed, currentUserId]);

  // Recharger si la liste des suivis change ou si l'userId change
  const prevFollowedLen = useRef(followedList.length);
  const prevUserIdRef = useRef(currentUserId);
  useEffect(() => {
    const userChanged = prevUserIdRef.current !== currentUserId;
    const followsChanged = prevFollowedLen.current !== followedList.length;
    if (userChanged) {
      prevUserIdRef.current = currentUserId;
      followingLoadedRef.current = false;
      if (activeTab === "Abonnements" && currentUserId) fetchFollowingFeed(true);
    } else if (followsChanged) {
      prevFollowedLen.current = followedList.length;
      if (activeTab === "Abonnements") {
        followingLoadedRef.current = false;
        fetchFollowingFeed(true);
      }
    }
  }, [followedList.length, currentUserId, activeTab, fetchFollowingFeed]);

  // ── Filtre strict sur followedList (réactif immédiat au désabonnement) ─────
  const followedSet = new Set(followedList);

  // ── Cartes d'abonnements dérivées DIRECTEMENT de followedList ─────────────
  // Filtre strict : seules les personnes actuellement suivies apparaissent.
  // La progression est toujours overridée par realGoalProgress (source Supabase).
  const subscriptionProfileCards = (() => {
    const cardsMap = new Map<string, {
      name: string; avatar: string; streak: number;
      objective: string; progress: number; followers: number; username: string;
    }>();

    // 1. Données issues des posts Supabase — seulement si encore suivi
    for (const p of followingProfiles) {
      if (followedSet.has(p.username)) cardsMap.set(p.username, p);
    }

    // 2. Compléter avec GLOBAL_PROFILES_MAP pour les suivis sans posts Supabase
    for (const username of followedList) {
      if (!cardsMap.has(username)) {
        const known = GLOBAL_PROFILES_MAP.get(username);
        if (known) cardsMap.set(username, { ...known, username });
      }
    }

    // 3. Override ABSOLU de la progression par realGoalProgress (Supabase KV)
    //    Couvre TOUS les profils, qu'ils viennent de posts ou de GLOBAL_PROFILES_MAP.
    const cards = Array.from(cardsMap.values()).map((card) => {
      const real = realGoalProgress[card.username];
      return real !== undefined
        ? { ...card, progress: real.progress }
        : card;
    });

    return cards;
  })();

  // ── Posts abonnements filtrés en temps réel ───────────────────────────────
  // Quand on se désabonne, les posts de cette personne disparaissent
  // instantanément du feed sans attendre le rechargement serveur.
  const filteredFollowingPosts = followingPosts.filter(
    (p) => followedSet.has(p.username)
  );

  /* Detect # or @ trigger in query */
  const hashMatch = query.match(/#([^\s#@]*)$/);
  const atMatch   = query.match(/@([^\s#@]*)$/);
  const hashSuggestions = hashMatch ? searchHashtags(hashMatch[1]) : [];
  const userSuggestions = atMatch   ? searchUsers(atMatch[1])      : [];
  const hasAutocomplete = showAutocomplete && (hashSuggestions.length > 0 || userSuggestions.length > 0);

  const handleSelectHash = (h: string) => {
    setQuery((q) => q.replace(/#([^\s#@]*)$/, `#${h} `));
    setShowAutocomplete(false);
  };
  const handleSelectUser = (handle: string) => {
    setQuery((q) => q.replace(/@([^\s#@]*)$/, `@${handle} `));
    setShowAutocomplete(false);
  };

  // Naviguer vers la page de recherche complète
  const handleSearchSubmit = () => {
    if (!query.trim()) return;
    setShowAutocomplete(false);
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  // ── Feed "Pour vous" : posts API + fallback sur les posts fictifs ─────────
  // Si l'API échoue ou est encore vide, afficher FICTITIOUS_POSTS pour que
  // le feed ne soit jamais complètement vide.
  const isFeedFallback = apiPosts.length === 0;
  const feedFallbackPosts = FICTITIOUS_POSTS as unknown as ApiPost[];
  const displayedFeedPosts: ApiPost[] = apiPosts.length > 0 ? apiPosts : feedFallbackPosts;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Fixed scroll-aware header ── */}
      <motion.div
        ref={headerRef}
        className="fixed left-0 right-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/50"
        style={{ top: 0 }}
        animate={{ y: headerVisible ? 0 : -(headerH || 165) }}
        transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.8 }}
      >
        <div className="max-w-2xl mx-auto px-3 pt-4 pb-0">

          {/* Row 1: cloche + logo (center) + streak — tous à 47px */}
          <div className="flex items-center justify-between mb-3">
            {/* Cloche notifications — 47px */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => navigate("/notifications")}
              style={{
                width: 47, height: 47, borderRadius: "50%",
                background: "rgba(255,255,255,0.07)",
                border: "1.5px solid rgba(255,255,255,0.11)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0, position: "relative",
              }}
            >
              <Bell style={{ width: 21, height: 21, color: "rgba(255,255,255,0.80)" }} strokeWidth={1.8} />
              {/* Badge non-lus */}
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.div
                    key="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 28 }}
                    style={{
                      position: "absolute", top: 2, right: 2,
                      minWidth: 17, height: 17, borderRadius: 999,
                      background: "#ffffff", color: "#111",
                      fontSize: 10, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 4px", lineHeight: 1,
                      border: "1.5px solid rgba(10,10,18,1)",
                    }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Logo centré — même taille que l'avatar (47px) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.25, 0, 0.35, 1] }}
              style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <img
                src={logoImage}
                alt="FuturFeed"
                style={{
                  width: 47,
                  height: 47,
                  objectFit: "contain",
                  mixBlendMode: "screen",
                  display: "block",
                }}
              />
            </motion.div>


          </div>

          {/* Row 2: Search bar — liquid glass */}
          <div ref={searchRef} style={{ position: "relative", marginBottom: 12 }}>
            {hasAutocomplete && (
              <div className="fixed inset-0 z-50" onClick={() => setShowAutocomplete(false)} />
            )}
            <motion.div
              className="flex items-center gap-2.5 px-4"
              style={{
                height: 44,
                background: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 4px 18px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.09)",
                borderRadius: hasAutocomplete ? "22px 22px 0 0" : "22px",
                transition: "border-radius 0.18s",
                position: "relative", zIndex: 51,
              }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.35 }}
            >
              <Search style={{ width: 15, height: 15, color: "rgba(150,150,175,0.55)", flexShrink: 0 }} />
              <HighlightInput
                value={query}
                onChange={(v) => { setQuery(v); setShowAutocomplete(true); }}
                onFocus={() => setShowAutocomplete(true)}
                placeholder="Recherchez des post, #hashtag ou @profil..."
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearchSubmit(); }}
              />
              {/* Bouton Rechercher → page complète */}
              <AnimatePresence>
                {query.trim().length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileTap={{ scale: 0.88 }}
                    onClick={handleSearchSubmit}
                    style={{
                      background: "rgba(99,102,241,0.80)", border: "none", borderRadius: 999,
                      padding: "4px 11px", cursor: "pointer", flexShrink: 0,
                      fontSize: 12, fontWeight: 700, color: "#fff",
                      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    }}
                  >
                    Chercher
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
            <AnimatePresence>
              {hasAutocomplete && (
                <AutocompleteDropdown
                  hashSuggestions={hashSuggestions}
                  userSuggestions={userSuggestions}
                  onSelectHash={handleSelectHash}
                  onSelectUser={handleSelectUser}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Row 3: Tabs */}
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative flex-1 py-3 transition-colors"
                style={{
                  color: activeTab === tab ? "var(--foreground)" : "var(--muted-foreground)",
                  fontWeight: activeTab === tab ? 600 : 400,
                  fontSize: 15,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 rounded-full"
                    style={{ height: 2, background: "#6366f1" }}
                    layoutId="feedTabIndicator"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Spacer = header height so content starts below the fixed header */}
      <div style={{ height: headerH || 165 }} />

      {/* ── Feed content ── */}
      <motion.div
        key={activeTab}
        className="max-w-2xl mx-auto pt-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {/* ── ONGLET ABONNEMENTS ── */}
        {activeTab === "Abonnements" && (
          <>
            {/* ── Section Abonnement / Abonné avec pill tabs ── */}
            <div style={{ padding: "4px 16px 0" }}>
              <FollowsListSection
                currentUserId={currentUserId}
                followedList={followedList}
              />
            </div>

            {/* ── Séparateur visuel ── */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "4px 0 0" }} />

            {/* ── Header feed posts abonnements ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {loadingFollowing ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <RefreshCw style={{ width: 11, height: 11, color: "rgba(99,102,241,0.55)" }} />
                  </motion.div>
                ) : followingError ? (
                  <WifiOff style={{ width: 11, height: 11, color: "rgba(248,113,113,0.55)" }} />
                ) : (
                  <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2.2, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: filteredFollowingPosts.length > 0 ? "#22c55e" : "rgba(255,255,255,0.18)" }} />
                )}
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.30)", letterSpacing: "0.04em" }}>
                  {loadingFollowing ? "Chargement..." : followingError ? "Hors ligne" : filteredFollowingPosts.length > 0 ? `${filteredFollowingPosts.length} posts récents` : "Posts des abonnements"}
                </span>
              </div>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => { followingLoadedRef.current = false; fetchFollowingFeed(true); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6 }}>
                <RefreshCw style={{ width: 11, height: 11, color: "rgba(99,102,241,0.45)" }} />
              </motion.button>
            </div>

            {filteredFollowingPosts.length > 0 && (
              <AnimatePresence>
                {filteredFollowingPosts.map((post, i) => (
                  <motion.div key={post.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }} transition={{ delay: i * 0.04, duration: 0.26 }}>
                    <ProgressCard
                      postId={post.id} user={post.user} streak={post.streak}
                      authorUsername={post.username}
                      progress={post.progress as { type: "infos"|"conseil"|"new"|"avancement"|"objectif"|"lecon"|"question"|"bilan"; description: string; timestamp: string }}
                      hashtags={post.hashtags} image={post.image ?? undefined}
                      verified={post.verified} isNew={post.isNew}
                      relevantCount={post.relevantCount} commentsCount={post.commentsCount}
                      sharesCount={post.sharesCount} viewsCount={post.viewsCount}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {filteredFollowingPosts.length === 0 && !loadingFollowing && !followingError && (
              <div style={{ padding: "32px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.22)" }}>Aucun post récent de tes abonnements.</p>
              </div>
            )}
          </>
        )}

        {/* ── ONGLET POUR VOUS ── */}
        {activeTab === "Pour vous" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 18px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {loadingApi ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <RefreshCw style={{ width: 11, height: 11, color: "rgba(99,102,241,0.55)" }} />
                  </motion.div>
                ) : apiError ? (
                  <WifiOff style={{ width: 11, height: 11, color: "rgba(248,113,113,0.55)" }} />
                ) : (
                  <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2.2, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: "50%", background: apiPosts.length > 0 ? "#22c55e" : "rgba(255,255,255,0.18)" }} />
                )}
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.30)", letterSpacing: "0.04em" }}>
                  {loadingApi
                    ? "Chargement..."
                    : apiError
                      ? "Hors ligne — démo"
                      : apiPosts.length > 0
                        ? `${apiPosts.length} en direct`
                        : "Flux en direct"}
                </span>
              </div>
              <motion.button whileTap={{ scale: 0.88 }} onClick={fetchApiPosts}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6 }}>
                <RefreshCw style={{ width: 11, height: 11, color: "rgba(99,102,241,0.45)" }} />
              </motion.button>
            </div>

            {/* Bandeau hors-ligne discret — le feed reste lisible grâce au fallback */}
            <AnimatePresence>
              {apiError && !loadingApi && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  style={{ margin: "0 12px 8px", padding: "8px 14px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "0.5px solid rgba(239,68,68,0.14)", display: "flex", alignItems: "center", gap: 8 }}>
                  <WifiOff style={{ width: 11, height: 11, color: "#f87171", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "rgba(252,165,165,0.70)" }}>
                    Mode démo · données en direct temporairement indisponibles
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {displayedFeedPosts.map((post, i) => (
                <motion.div key={post.id ?? `demo-${i}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }} transition={{ delay: i * 0.04, duration: 0.26 }}>
                  {i === 0 && !isFeedFallback && post.username === currentUserId && currentUserId !== "" && (
                    <div style={{ padding: "0 18px 5px", display: "flex", alignItems: "center", gap: 6 }}>
                      <Wifi style={{ width: 10, height: 10, color: "#818cf8" }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", letterSpacing: "0.07em" }}>VOTRE DERNIER POST</span>
                    </div>
                  )}
                  <ProgressCard
                    postId={post.id ?? `demo-${i}`}
                    user={post.user}
                    streak={post.streak}
                    authorUsername={(post as any).username ?? undefined}
                    progress={post.progress as { type: "infos"|"conseil"|"new"|"avancement"|"objectif"|"lecon"|"question"|"bilan"; description: string; timestamp: string }}
                    hashtags={post.hashtags}
                    image={post.image ?? undefined}
                    verified={post.verified}
                    isNew={post.isNew}
                    relevantCount={post.relevantCount}
                    commentsCount={post.commentsCount}
                    sharesCount={post.sharesCount}
                    viewsCount={post.viewsCount}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {displayedFeedPosts.length === 0 && !loadingApi && (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.28)" }}>Aucun post pour l'instant.</p>
              </div>
            )}
          </>
        )}
      </motion.div>

      <div className="max-w-2xl mx-auto py-8 text-center">
        <p className="text-sm text-muted-foreground">Chargement d'autres avancements...</p>
      </div>
    </div>
  );
}