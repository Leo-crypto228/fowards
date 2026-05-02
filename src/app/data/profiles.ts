/**
 * Registre centralisé de tous les profils connus de l'application.
 * Utilisé par FollowContext et Feed.tsx pour construire les cartes d'abonnements.
 */

export interface KnownProfile {
  name: string;
  avatar: string;
  objective: string;
  followers: number;
  streak: number;
  progress: number; // 0–100
}

// Map username → profil
const GLOBAL_PROFILES_MAP = new Map<string, KnownProfile>();

function register(name: string, data: Omit<KnownProfile, "progress"> & { progress?: number }) {
  const key = name.toLowerCase().replace(/\s+/g, "");
  if (!GLOBAL_PROFILES_MAP.has(key)) {
    GLOBAL_PROFILES_MAP.set(key, {
      ...data,
      progress: data.progress ?? Math.min(90, Math.round((data.streak / 200) * 100)),
    });
  }
}

// ── Profils complets (depuis UserProfile.tsx / USERS) ─────────────────────────

register("Thomas Dubois", {
  avatar: "https://images.unsplash.com/photo-1770894807442-108cc33c0a7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Lancer mon SaaS", followers: 1240, streak: 87, progress: 74,
});
register("Marie Laurent", {
  avatar: "https://images.unsplash.com/photo-1744040866609-2b8952159e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Apprendre le japonais", followers: 892, streak: 156, progress: 68,
});
register("Emma Petit", {
  avatar: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Écrire un roman", followers: 2100, streak: 203, progress: 58,
});
register("Antoine Rousseau", {
  avatar: "https://images.unsplash.com/photo-1752859951149-7d3fc700a7ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Dev Full-Stack", followers: 870, streak: 64, progress: 51,
});
register("Lucas Bernard", {
  avatar: "https://images.unsplash.com/photo-1761358531297-614e4de53b85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Indépendance financière", followers: 2100, streak: 31, progress: 44,
});
register("Sarah Martin", {
  avatar: "https://images.unsplash.com/photo-1746632452765-05eeadb3c552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Marathon en 6 mois", followers: 580, streak: 42, progress: 61,
});
register("Yasmine Hassan", {
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Devenir data analyst", followers: 4800, streak: 143, progress: 78,
});
register("Elodie Chen", {
  avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Designer freelance", followers: 6700, streak: 91, progress: 63,
});
register("Nicolas Faure", {
  avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Perdre 15kg et muscler", followers: 1890, streak: 55, progress: 47,
});
register("Maxime Dupont", {
  avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Traverser la France à vélo", followers: 540, streak: 29, progress: 28,
});

// ── Profils supplémentaires (depuis Profile.tsx FOLLOWING_LIST + FOLLOWERS_LIST) ─

register("Sofia Martin", {
  avatar: "https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Lancer ma marque de cosmétiques bio", followers: 890, streak: 15,
});
register("Marie Dupont", {
  avatar: "https://images.unsplash.com/photo-1585335559291-f94d268f8b17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Écrire et publier mon premier roman", followers: 540, streak: 8,
});
register("Antoine Moreau", {
  avatar: "https://images.unsplash.com/photo-1731652227259-441c966ba1ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Construire un studio créatif indépendant", followers: 3200, streak: 91,
});
register("Julia Chen", {
  avatar: "https://images.unsplash.com/photo-1585335559291-f94d268f8b17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Lancer ma startup edtech en 2026", followers: 670, streak: 19,
});
register("Romain Leroy", {
  avatar: "https://images.unsplash.com/photo-1737574821698-862e77f044c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Atteindre 10k abonnés sur LinkedIn", followers: 820, streak: 34,
});
register("Céline Faure", {
  avatar: "https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  objective: "Courir 1000km cette année", followers: 456, streak: 14,
});

// ── Export ─────────────────────────────────────────────────────────────────────

export { GLOBAL_PROFILES_MAP };

/**
 * Récupère le profil d'un username (null si inconnu).
 */
export function getProfile(username: string): (KnownProfile & { username: string }) | null {
  const data = GLOBAL_PROFILES_MAP.get(username.toLowerCase().replace(/\s+/g, ""));
  if (!data) return null;
  return { ...data, username: username.toLowerCase().replace(/\s+/g, "") };
}

/**
 * Enregistre dynamiquement un profil (ex: depuis un post API).
 * N'écrase pas un profil déjà connu.
 */
export function registerProfile(username: string, data: KnownProfile): void {
  const key = username.toLowerCase().replace(/\s+/g, "");
  if (!GLOBAL_PROFILES_MAP.has(key)) {
    GLOBAL_PROFILES_MAP.set(key, data);
  }
}
