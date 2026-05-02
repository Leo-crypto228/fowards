import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

/* ── Images fictives ─────────────────────────────────────────────────────── */
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
const IMG_INVEST  = "https://images.unsplash.com/photo-1766218329569-53c9270bb305?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

/* ── Données fictives normalisées ───────────────────────────────────────── */
// createdAt décroissant simulé sur les dernières 24h (posts les plus récents d'abord)
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

export interface SeedPost {
  id: string;
  username: string;
  user: { name: string; avatar: string; objective: string; followers: number };
  streak: number;
  progress: { type: string; description: string; timestamp: string };
  hashtags: string[];
  image: string | null;
  verified: boolean;
  relevantCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  isNew: boolean;
  createdAt: string;
}

export interface SeedProfile {
  username: string;
  name: string;
  avatar: string;
  objective: string;
  streak: number;
  followers: number;
  progressPct: number;
  bio: string;
}

/* ─────────────────────────────────────────────────────────────────────────
   Posts fictifs POUR VOUS
───────────────────────────────────────────────────────────────────────── */
export const FICTITIOUS_POSTS: SeedPost[] = [
  {
    id: "seed-pv-00", username: "sarahmartin",
    user: { name: "Sarah Martin", avatar: "https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Marathon en 6 mois", followers: 1240 },
    streak: 42, progress: { type: "avancement", description: "Course de 15km ce matin. J'ai battu mon record personnel de 2 minutes. La constance commence à payer.", timestamp: "2h" },
    image: IMG_RUN, verified: false, relevantCount: 82, commentsCount: 12, sharesCount: 5, viewsCount: 870, isNew: true, hashtags: ["#Marathon", "#Running", "#Constance"],
    createdAt: hoursAgo(2),
  },
  {
    id: "seed-pv-01", username: "thomasduboisff",
    user: { name: "Thomas Dubois", avatar: "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lancer mon SaaS", followers: 3800 },
    streak: 87, progress: { type: "new", description: "3 heures de code aujourd'hui. J'ai intégré le système de paiement. Plus que l'authentification à finaliser.\n\nLa progression est lente mais régulière.", timestamp: "4h" },
    image: IMG_SAAS, verified: true, relevantCount: 124, commentsCount: 45, sharesCount: 18, viewsCount: 2100, isNew: true, hashtags: ["#SaaS", "#BuildInPublic", "#Indiehacker"],
    createdAt: hoursAgo(4),
  },
  {
    id: "seed-pv-02", username: "camillerousseaumed",
    user: { name: "Camille Rousseau", avatar: "https://images.unsplash.com/photo-1607346256330-abd12a0cd65c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Méditation quotidienne 1 an", followers: 670 },
    streak: 21, progress: { type: "bilan", description: "21 jours consécutifs de méditation. 20 minutes chaque matin avant le café. Mon niveau de stress a baissé de façon perceptible. Le cerveau s'adapte vraiment.", timestamp: "3h" },
    image: IMG_YOGA, verified: false, relevantCount: 67, commentsCount: 9, sharesCount: 4, viewsCount: 740, isNew: true, hashtags: ["#Méditation", "#Mindfulness", "#Bien-être"],
    createdAt: hoursAgo(3),
  },
  {
    id: "seed-pv-03", username: "nadialeblanc",
    user: { name: "Nadia Leblanc", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Maîtriser la cuisine japonaise", followers: 980 },
    streak: 45, progress: { type: "avancement", description: "Ramen maison réussi pour la première fois ! Le bouillon a mijoté 6h. Le résultat est incroyable. La patience en cuisine, c'est 90% du résultat.", timestamp: "5h" },
    image: IMG_COOK, verified: false, relevantCount: 93, commentsCount: 21, sharesCount: 8, viewsCount: 1200, isNew: true, hashtags: ["#Cuisine", "#Ramen", "#JapaneseCooking"],
    createdAt: hoursAgo(5),
  },
  {
    id: "seed-pv-04", username: "julienmoreau",
    user: { name: "Julien Moreau", avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Sortir mon premier EP", followers: 430 },
    streak: 13, progress: { type: "new", description: "Première vraie session d'enregistrement en studio aujourd'hui. 3 titres posés. L'acoustique de la pièce fait toute la différence. Je recommence demain.", timestamp: "6h" },
    image: IMG_MUSIC, verified: false, relevantCount: 45, commentsCount: 7, sharesCount: 3, viewsCount: 530, isNew: false, hashtags: ["#Musique", "#Studio", "#EP"],
    createdAt: hoursAgo(6),
  },
  {
    id: "seed-pv-05", username: "marielaurent",
    user: { name: "Marie Laurent", avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Apprendre le japonais", followers: 2100 },
    streak: 156, progress: { type: "bilan", description: "Aujourd'hui, j'ai révisé ma méthode d'apprentissage. Je vais me concentrer sur la conversation plutôt que l'écriture pour le prochain mois.", timestamp: "5h" },
    image: null, verified: true, relevantCount: 91, commentsCount: 23, sharesCount: 8, viewsCount: 1500, isNew: true, hashtags: ["#Japonais", "#Apprentissage", "#Langues"],
    createdAt: hoursAgo(5.5),
  },
  {
    id: "seed-pv-06", username: "chloebernard",
    user: { name: "Chloé Bernard", avatar: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Publier 100 photos de voyage", followers: 5200 },
    streak: 78, progress: { type: "objectif", description: "Sortie photo au lever du soleil ce matin. 47 clichés dont 3 vraiment exceptionnels. La lumière dorée de 6h30 est incomparable.", timestamp: "7h" },
    image: IMG_PHOTO, verified: true, relevantCount: 187, commentsCount: 52, sharesCount: 24, viewsCount: 2900, isNew: false, hashtags: ["#Photographie", "#GoldenHour", "#Travel"],
    createdAt: hoursAgo(7),
  },
  {
    id: "seed-pv-07", username: "lucasbernard",
    user: { name: "Lucas Bernard", avatar: "https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Indépendance financière", followers: 2100 },
    streak: 31, progress: { type: "objectif", description: "Portfolio investi +12% ce trimestre. La diversification commence à montrer ses effets. Chaque mois régulier compte.", timestamp: "7h" },
    image: IMG_MONEY, verified: false, relevantCount: 156, commentsCount: 34, sharesCount: 12, viewsCount: 1800, isNew: false, hashtags: ["#Finance", "#Investissement", "#IndépendanceFinancière"],
    createdAt: hoursAgo(7.5),
  },
  {
    id: "seed-pv-08", username: "paulrenard",
    user: { name: "Paul Renard", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Créer mon agence digitale", followers: 760 },
    streak: 38, progress: { type: "avancement", description: "Premier client signé aujourd'hui ! Un contrat de 3 mois avec une startup locale. L'agence commence à exister concrètement.", timestamp: "8h" },
    image: IMG_OFFICE, verified: false, relevantCount: 134, commentsCount: 38, sharesCount: 16, viewsCount: 2100, isNew: false, hashtags: ["#Agence", "#Entrepreneuriat", "#PremierClient"],
    createdAt: hoursAgo(8),
  },
  {
    id: "seed-pv-09", username: "emmapetit",
    user: { name: "Emma Petit", avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Écrire un roman", followers: 4300 },
    streak: 203, progress: { type: "lecon", description: "Chapitre 12 terminé ! 2500 mots aujourd'hui. L'arc narratif prend forme. La constance quotidienne transforme le projet en réalité.", timestamp: "9h" },
    image: null, verified: true, relevantCount: 234, commentsCount: 67, sharesCount: 31, viewsCount: 3200, isNew: false, hashtags: ["#Écriture", "#Roman", "#Créativité"],
    createdAt: hoursAgo(9),
  },
  {
    id: "seed-pv-10", username: "isabellemartinlit",
    user: { name: "Isabelle Martin", avatar: "https://images.unsplash.com/photo-1521252659862-eec69941b071?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lire 52 livres en 1 an", followers: 3100 },
    streak: 112, progress: { type: "bilan", description: "Livre 23/52 terminé ce soir. 'Atomic Habits' — le meilleur livre que j'ai lu cette année. Le concept d'identité avant les habitudes a changé ma façon de voir les choses.", timestamp: "10h" },
    image: IMG_BOOK, verified: true, relevantCount: 178, commentsCount: 44, sharesCount: 27, viewsCount: 2600, isNew: false, hashtags: ["#Lecture", "#AtomicHabits", "#Development"],
    createdAt: hoursAgo(10),
  },
  {
    id: "seed-pv-11", username: "nicolasfaure",
    user: { name: "Nicolas Faure", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Perdre 15kg et muscler", followers: 1890 },
    streak: 55, progress: { type: "avancement", description: "PR squat aujourd'hui : 120kg ! Il y a 3 mois je peinais à 80kg. La progression linéaire ça marche vraiment.", timestamp: "11h" },
    image: IMG_GYM, verified: false, relevantCount: 201, commentsCount: 58, sharesCount: 19, viewsCount: 3100, isNew: false, hashtags: ["#Fitness", "#Squat", "#PR"],
    createdAt: hoursAgo(11),
  },
  {
    id: "seed-pv-12", username: "maximedupont",
    user: { name: "Maxime Dupont", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Traverser la France à vélo", followers: 540 },
    streak: 29, progress: { type: "objectif", description: "80km aujourd'hui dans le Vercors. Les montées sont brutales mais la vue du sommet efface tout.", timestamp: "13h" },
    image: IMG_CYCLE, verified: false, relevantCount: 112, commentsCount: 29, sharesCount: 11, viewsCount: 1700, isNew: false, hashtags: ["#Cyclisme", "#Vercors", "#France"],
    createdAt: hoursAgo(13),
  },
  {
    id: "seed-pv-13", username: "antoinerousseau",
    user: { name: "Antoine Rousseau", avatar: "https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir développeur Full-Stack", followers: 870 },
    streak: 64, progress: { type: "conseil", description: "Aujourd'hui j'ai planifié mon roadmap pour les 3 prochains mois. Focus sur React, Node.js et PostgreSQL.", timestamp: "11h" },
    image: null, verified: false, relevantCount: 98, commentsCount: 28, sharesCount: 15, viewsCount: 1400, isNew: false, hashtags: ["#Dev", "#React", "#FullStack"],
    createdAt: hoursAgo(11.5),
  },
  {
    id: "seed-pv-14", username: "elodiechen",
    user: { name: "Elodie Chen", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir UI/UX designer freelance", followers: 6700 },
    streak: 91, progress: { type: "new", description: "Nouveau projet dans mon portfolio ! Refonte complète de l'app d'un cabinet médical. Interface pensée d'abord pour les patients âgés.", timestamp: "14h" },
    image: IMG_DESIGN, verified: true, relevantCount: 223, commentsCount: 61, sharesCount: 33, viewsCount: 3700, isNew: false, hashtags: ["#UX", "#Design", "#Accessibilité"],
    createdAt: hoursAgo(14),
  },
  {
    id: "seed-pv-15", username: "hugolambertjp",
    user: { name: "Hugo Lambert", avatar: "https://images.unsplash.com/photo-1463453091185-61582044d556?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Parler japonais couramment", followers: 1350 },
    streak: 62, progress: { type: "avancement", description: "Première conversation complète en japonais avec un natif sur Tandem. Je n'ai consulté le dictionnaire qu'une fois.", timestamp: "15h" },
    image: IMG_JAPAN, verified: false, relevantCount: 144, commentsCount: 37, sharesCount: 14, viewsCount: 2200, isNew: false, hashtags: ["#日本語", "#Japonais", "#Tandem"],
    createdAt: hoursAgo(15),
  },
  {
    id: "seed-pv-16", username: "alexiatorres",
    user: { name: "Alexia Torres", avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lancer mon podcast tech", followers: 920 },
    streak: 34, progress: { type: "new", description: "Épisode 12 enregistré et monté en 3h chrono. J'ai enfin trouvé mon rythme de production. La régularité avant la perfection.", timestamp: "16h" },
    image: IMG_PODCAST, verified: false, relevantCount: 87, commentsCount: 18, sharesCount: 9, viewsCount: 1300, isNew: false, hashtags: ["#Podcast", "#Tech", "#Content"],
    createdAt: hoursAgo(16),
  },
  {
    id: "seed-pv-17", username: "pierreleclerc",
    user: { name: "Pierre Leclerc", avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Nager 100km cette année", followers: 380 },
    streak: 18, progress: { type: "avancement", description: "48km sur 100km. Mi-parcours atteint ! La nage de fond m'a appris quelque chose : quand t'es dans l'eau, tu peux pas fuir tes pensées.", timestamp: "18h" },
    image: IMG_SWIM, verified: false, relevantCount: 56, commentsCount: 11, sharesCount: 4, viewsCount: 820, isNew: false, hashtags: ["#Natation", "#Endurance", "#100km"],
    createdAt: hoursAgo(18),
  },
  {
    id: "seed-pv-18", username: "yasminehassan",
    user: { name: "Yasmine Hassan", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir data analyst", followers: 4800 },
    streak: 143, progress: { type: "lecon", description: "Dashboard Power BI terminé pour mon projet perso. J'ai visualisé 6 mois de mes propres données : sommeil, sport, productivité.", timestamp: "20h" },
    image: IMG_DATA, verified: true, relevantCount: 198, commentsCount: 54, sharesCount: 28, viewsCount: 3400, isNew: false, hashtags: ["#Data", "#PowerBI", "#Analytics"],
    createdAt: hoursAgo(20),
  },
  // Abonnements posts
  {
    id: "seed-ab-00", username: "thomasduboisff",
    user: { name: "Thomas Dubois", avatar: "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lancer mon SaaS", followers: 3800 },
    streak: 87, progress: { type: "question", description: "Comment vous gérez la motivation les jours où vous n'avez pas envie ? Je cherche des stratégies concrètes pour les passages à vide.", timestamp: "1h" },
    image: null, verified: true, relevantCount: 57, commentsCount: 38, sharesCount: 4, viewsCount: 920, isNew: true, hashtags: ["#Motivation", "#SaaS", "#Mindset"],
    createdAt: hoursAgo(1),
  },
  {
    id: "seed-ab-01", username: "marielaurent",
    user: { name: "Marie Laurent", avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Apprendre le japonais", followers: 2100 },
    streak: 156, progress: { type: "infos", description: "J'ai rejoint un groupe de conversation en japonais. Première session demain soir. Un peu stressée mais très excitée !", timestamp: "3h" },
    image: IMG_JAPAN, verified: true, relevantCount: 74, commentsCount: 19, sharesCount: 6, viewsCount: 1100, isNew: true, hashtags: ["#Japonais", "#Communauté", "#Progression"],
    createdAt: hoursAgo(3.5),
  },
  {
    id: "seed-ab-02", username: "yasminehassan",
    user: { name: "Yasmine Hassan", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir data analyst", followers: 4800 },
    streak: 143, progress: { type: "avancement", description: "Certif SQL obtenue ce matin. 3 mois de préparation. Le score final : 94/100. La prochaine étape c'est la certif Python.", timestamp: "2h" },
    image: IMG_DATA, verified: true, relevantCount: 167, commentsCount: 43, sharesCount: 21, viewsCount: 2900, isNew: true, hashtags: ["#SQL", "#Certification", "#Data"],
    createdAt: hoursAgo(2.5),
  },
  {
    id: "seed-ab-03", username: "emmapetit",
    user: { name: "Emma Petit", avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Écrire un roman", followers: 4300 },
    streak: 203, progress: { type: "conseil", description: "Pour ceux qui écrivent : réservez un créneau fixe chaque jour, même 20 minutes. La régularité bat l'inspiration. En 6 mois j'ai produit 80 000 mots grâce à ça.", timestamp: "6h" },
    image: null, verified: true, relevantCount: 189, commentsCount: 52, sharesCount: 44, viewsCount: 4100, isNew: false, hashtags: ["#Écriture", "#Constance", "#Productivité"],
    createdAt: hoursAgo(6.5),
  },
  {
    id: "seed-ab-04", username: "elodiechen",
    user: { name: "Elodie Chen", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir UI/UX designer freelance", followers: 6700 },
    streak: 91, progress: { type: "new", description: "J'ai accepté ma première mission freelance ! 3 semaines de mission pour une fintech parisienne. Taux journalier négocié à 450€.", timestamp: "4h" },
    image: IMG_DESIGN, verified: true, relevantCount: 245, commentsCount: 71, sharesCount: 38, viewsCount: 4800, isNew: true, hashtags: ["#Freelance", "#UX", "#Design"],
    createdAt: hoursAgo(4.5),
  },
  {
    id: "seed-ab-05", username: "antoinerousseau",
    user: { name: "Antoine Rousseau", avatar: "https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir développeur Full-Stack", followers: 870 },
    streak: 64, progress: { type: "avancement", description: "Premier projet en production ! Une API REST complète avec authentification JWT. C'est petit, mais c'est le mien.", timestamp: "8h" },
    image: IMG_SAAS, verified: false, relevantCount: 143, commentsCount: 41, sharesCount: 22, viewsCount: 2700, isNew: false, hashtags: ["#Dev", "#API", "#FullStack"],
    createdAt: hoursAgo(8.5),
  },
  {
    id: "seed-ab-06", username: "nicolasfaure",
    user: { name: "Nicolas Faure", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Perdre 15kg et muscler", followers: 1890 },
    streak: 55, progress: { type: "lecon", description: "Leçon durement apprise : la récupération compte autant que l'entraînement. J'ai ignoré les signaux de mon corps pendant 2 semaines. Résultat : tendinite.", timestamp: "10h" },
    image: IMG_GYM, verified: false, relevantCount: 156, commentsCount: 47, sharesCount: 18, viewsCount: 2400, isNew: false, hashtags: ["#Fitness", "#Récupération", "#Leçon"],
    createdAt: hoursAgo(10.5),
  },
  {
    id: "seed-ab-07", username: "lucasbernard",
    user: { name: "Lucas Bernard", avatar: "https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Indépendance financière", followers: 2100 },
    streak: 31, progress: { type: "bilan", description: "Bilan du mois : +8% sur le portefeuille. La discipline d'investissement mensuel commence à vraiment payer. Patience et constance.", timestamp: "1j" },
    image: IMG_INVEST, verified: false, relevantCount: 112, commentsCount: 27, sharesCount: 9, viewsCount: 2100, isNew: false, hashtags: ["#Finance", "#Bilan", "#Investissement"],
    createdAt: hoursAgo(24),
  },
];

/* ── Profils fictifs ─────────────────────────────────────────────────────── */
export const FICTITIOUS_PROFILES: SeedProfile[] = [
  { username: "sarahmartin",       name: "Sarah Martin",      avatar: "https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Marathon en 6 mois",              streak: 42,  followers: 1240, progressPct: 55, bio: "Coureuse passionnée, objectif marathon Paris." },
  { username: "thomasduboisff",    name: "Thomas Dubois",     avatar: "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lancer mon SaaS",                streak: 87,  followers: 3800, progressPct: 72, bio: "Indiehacker • Build in public" },
  { username: "camillerousseaumed",name: "Camille Rousseau",  avatar: "https://images.unsplash.com/photo-1607346256330-abd12a0cd65c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Méditation quotidienne 1 an",     streak: 21,  followers: 670,  progressPct: 38, bio: "Mindfulness & bien-être" },
  { username: "nadialeblanc",      name: "Nadia Leblanc",     avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Maîtriser la cuisine japonaise", streak: 45,  followers: 980,  progressPct: 60, bio: "Cuisinière aventureuse" },
  { username: "julienmoreau",      name: "Julien Moreau",     avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Sortir mon premier EP",          streak: 13,  followers: 430,  progressPct: 28, bio: "Compositeur indépendant" },
  { username: "marielaurent",      name: "Marie Laurent",     avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Apprendre le japonais",          streak: 156, followers: 2100, progressPct: 58, bio: "日本語 を 学んでいます" },
  { username: "chloebernard",      name: "Chloé Bernard",     avatar: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Publier 100 photos de voyage",   streak: 78,  followers: 5200, progressPct: 47, bio: "Photographe voyageuse" },
  { username: "lucasbernard",      name: "Lucas Bernard",     avatar: "https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Indépendance financière",        streak: 31,  followers: 2100, progressPct: 29, bio: "Investisseur long terme" },
  { username: "paulrenard",        name: "Paul Renard",       avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Créer mon agence digitale",     streak: 38,  followers: 760,  progressPct: 45, bio: "Entrepreneur digital" },
  { username: "emmapetit",         name: "Emma Petit",        avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Écrire un roman",               streak: 203, followers: 4300, progressPct: 84, bio: "Auteure • 80k mots en cours" },
  { username: "isabellemartinlit", name: "Isabelle Martin",   avatar: "https://images.unsplash.com/photo-1521252659862-eec69941b071?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lire 52 livres en 1 an",        streak: 112, followers: 3100, progressPct: 44, bio: "Lectrice compulsive" },
  { username: "nicolasfaure",      name: "Nicolas Faure",     avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Perdre 15kg et muscler",        streak: 55,  followers: 1890, progressPct: 47, bio: "Fitness & powerlifting" },
  { username: "maximedupont",      name: "Maxime Dupont",     avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Traverser la France à vélo",    streak: 29,  followers: 540,  progressPct: 35, bio: "Cycliste aventurier" },
  { username: "antoinerousseau",   name: "Antoine Rousseau",  avatar: "https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir développeur Full-Stack", streak: 64,  followers: 870,  progressPct: 41, bio: "Dev en formation" },
  { username: "elodiechen",        name: "Elodie Chen",       avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir UI/UX designer freelance", streak: 91, followers: 6700, progressPct: 63, bio: "UI/UX designer freelance" },
  { username: "hugolambertjp",     name: "Hugo Lambert",      avatar: "https://images.unsplash.com/photo-1463453091185-61582044d556?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Parler japonais couramment",     streak: 62,  followers: 1350, progressPct: 50, bio: "JLPT N3 en cours" },
  { username: "alexiatorres",      name: "Alexia Torres",     avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Lancer mon podcast tech",       streak: 34,  followers: 920,  progressPct: 32, bio: "Podcasteuse tech" },
  { username: "pierreleclerc",     name: "Pierre Leclerc",    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Nager 100km cette année",       streak: 18,  followers: 380,  progressPct: 48, bio: "Nageur de fond" },
  { username: "yasminehassan",     name: "Yasmine Hassan",    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", objective: "Devenir data analyst",          streak: 143, followers: 4800, progressPct: 78, bio: "Data analyst • Power BI" },
];

/* ── Session flag ────────────────────────────────────────────────────────── */
// v4 : force re-seed pour créer ff:goals manquants
const SESSION_KEY = "ff:fictitious:seeded:v4";

function isAlreadySeeded(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}
function markAsSeeded(): void {
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
}

/* ── API call ────────────────────────────────────────────────────────────── */
export async function ensureFictitiousPosts(): Promise<void> {
  if (isAlreadySeeded()) return;
  try {
    const res = await fetch(`${BASE}/seed-fictitious-posts`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ posts: FICTITIOUS_POSTS, profiles: FICTITIOUS_PROFILES }),
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`Seed fictitious: ${data.seeded} seedés, ${data.skipped} ignorés`);
      markAsSeeded();
    } else {
      console.warn("Seed fictitious posts failed:", res.status);
    }
  } catch (err) {
    console.warn("Seed fictitious posts error:", err);
  }
}
