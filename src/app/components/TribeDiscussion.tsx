import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, X, CornerDownRight, ChevronDown, Share2, RefreshCw, Loader2 } from "lucide-react";
import {
  getCommunityMessages, sendCommunityMessage, getCommunityShares,
  type ApiCommunityMessage, type PostSnapshot,
} from "../api/sharesApi";
import { useParams } from "react-router";
import { MY_USER_NAME, MY_USER_AVATAR, MY_USER_ID } from "../api/authStore";
import { stripAt } from "../utils/renderText";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Msg {
  id: string;
  parentId: string | null;
  user: string;
  handle: string;
  avatar: string;
  text: string;
  timestamp: string;
  image?: string;
  sharedPost?: PostSnapshot | null;
  isApi?: boolean; // message venu du backend
}

// ─── Utilisateur courant ──────────────────────────────────────────────────────

function getMyUser()   { return MY_USER_NAME   || "Utilisateur"; }
function getMyHandle() { return `@${MY_USER_ID || "moi"}`; }
function getMyAvatar() { return MY_USER_AVATAR || "https://images.unsplash.com/photo-1584940121730-93ffb8aa88b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200"; }
function getMyId()     { return MY_USER_ID     || "user"; }

// ─── Seed data (affiché si aucun message Supabase) ────────────────────────────

const SEED: Msg[] = [
  { id: "s1", parentId: null, user: "Sophie Chen", handle: "@sophie_c", avatar: "https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", text: "Quelqu'un a des conseils pour l'authentification OAuth ? Je commence l'intégration Google demain.", timestamp: "Il y a 32 min" },
  { id: "s2", parentId: "s1", user: "Thomas Dubois", handle: "@thomas_d", avatar: getMyAvatar(), text: "J'utilise NextAuth.js, c'est assez simple à configurer. La doc est claire et l'intégration Prisma est native.", timestamp: "Il y a 27 min" },
  { id: "s3", parentId: "s2", user: "Sophie Chen", handle: "@sophie_c", avatar: "https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", text: "Tu as un repo exemple à partager ?", timestamp: "Il y a 24 min" },
  { id: "s4", parentId: "s3", user: "Thomas Dubois", handle: "@thomas_d", avatar: getMyAvatar(), text: "Oui je t'envoie ça en DM ce soir, j'ai un boilerplate propre avec Prisma + Postgres.", timestamp: "Il y a 20 min" },
  { id: "s5", parentId: null, user: "Marc Laurent", handle: "@marc_l", avatar: "https://images.unsplash.com/photo-1719257751404-1dea075324bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", text: "Question liée : vous utilisez quelle DB avec votre stack auth ? PlanetScale ou Supabase ?", timestamp: "Il y a 15 min" },
  { id: "s6", parentId: "s5", user: "Julia Renard", handle: "@julia_r", avatar: "https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", text: "Supabase pour moi. Le branching de DB c'est un game-changer pour les migrations.", timestamp: "Il y a 10 min" },
  { id: "s7", parentId: null, user: "Julia Renard", handle: "@julia_r", avatar: "https://images.unsplash.com/photo-1607286908165-b8b6a2874fc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", text: "J'ai terminé mon dashboard analytics ce matin. Voilà à quoi ça ressemble en prod !", timestamp: "Il y a 8 min", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080" },
  { id: "s8", parentId: null, user: "Kevin Blanc", handle: "@kevin_b", avatar: "https://images.unsplash.com/photo-1758598497635-48cbbb1f6555?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200", text: "Quelqu'un a testé les nouvelles features de Vercel AI SDK ? Je cherche à intégrer du streaming.", timestamp: "Il y a 1 min" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiToMsg(m: ApiCommunityMessage): Msg {
  return {
    id: m.id,
    parentId: m.parentId,
    user: m.author,
    handle: m.handle,
    avatar: m.avatar,
    text: m.content,
    timestamp: m.timestamp ?? "À l'instant",
    image: m.image ?? undefined,
    sharedPost: m.sharedPostSnapshot ?? null,
    isApi: true,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_DEPTH    = 3;
const AVATAR_SIZES = [38, 32, 28, 24];
const FONT_SIZES   = [14, 13, 12, 12];
const NAME_SIZES   = [13, 12, 11, 11];
const COLLAPSE_AT  = 2;

// ─── Curved connector ─────────────────────────────────────────────────────────

function ThreadArc({ avatarSize }: { avatarSize: number }) {
  const W = 14, H = avatarSize * 0.6;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", flexShrink: 0 }}>
      <path d={`M 0 0 Q 0 ${H} ${W} ${H}`} stroke="rgba(255,255,255,0.13)" strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ─── SharedPostInline — post partagé dans le fil ──────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  infos: "Infos perso", conseil: "Conseil(s)", new: "New",
  avancement: "Avancement", objectif: "Objectif", lecon: "Leçon",
  question: "Question", bilan: "Bilan",
};

function SharedPostInline({ post }: { post: PostSnapshot }) {
  return (
    <div style={{
      marginTop: 8, borderRadius: 14,
      background: "rgba(99,102,241,0.06)",
      border: "0.5px solid rgba(99,102,241,0.22)",
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px 7px" }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(99,102,241,0.25)" }}>
          {post.user.avatar ? (
            <img src={post.user.avatar} alt={post.user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#6366f1,#a78bfa)" }} />
          )}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.72)" }}>{post.user.name}</span>
        <span style={{ display: "inline-flex", padding: "1px 8px", borderRadius: 999, background: "rgba(255,255,255,0.90)", fontSize: 10, fontWeight: 700, color: "#111", flexShrink: 0 }}>
          {TYPE_LABELS[post.progress.type] ?? post.progress.type}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <Share2 style={{ width: 10, height: 10, color: "rgba(99,102,241,0.55)" }} />
          <span style={{ fontSize: 10, color: "rgba(99,102,241,0.55)", fontWeight: 600 }}>Post partagé</span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "rgba(200,200,220,0.62)", lineHeight: 1.5, padding: "0 12px 9px", margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const }}>
        {post.progress.description}
      </p>
      {(post.hashtags ?? []).length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "0 12px 8px", flexWrap: "wrap" }}>
          {(post.hashtags ?? []).map((tag) => (
            <span key={tag} style={{ fontSize: 10, color: "rgba(139,92,246,0.60)" }}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MessageThread (recursive) ────────────────────────────────────────────────

interface ThreadProps {
  msg: Msg;
  all: Msg[];
  depth: number;
  replyingToId: string | null;
  onSelect: (msg: Msg) => void;
  animDelay?: number;
}

function MessageThread({ msg, all, depth, replyingToId, onSelect, animDelay = 0 }: ThreadProps) {
  const d          = Math.min(depth, MAX_DEPTH - 1);
  const avatarSize = AVATAR_SIZES[d];
  const fontSize   = FONT_SIZES[d];
  const nameSize   = NAME_SIZES[d];
  const isSelected = replyingToId === msg.id;
  const replies    = all.filter((m) => m.parentId === msg.id);
  const hasReplies = replies.length > 0;
  const shouldDefaultCollapse = depth === 0 && replies.length > COLLAPSE_AT;
  const [expanded, setExpanded] = useState(!shouldDefaultCollapse);
  const atMaxDepth = depth >= MAX_DEPTH - 1;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: animDelay, ease: "easeOut" }}>
      <motion.div
        onClick={() => onSelect(msg)}
        whileTap={{ scale: 0.985 }}
        style={{
          display: "flex", gap: 10, cursor: "pointer", borderRadius: 14, padding: "7px 8px",
          background: isSelected ? "rgba(99,102,241,0.08)" : "transparent",
          border: isSelected ? "0.5px solid rgba(99,102,241,0.25)" : "0.5px solid transparent",
          transition: "background 0.18s ease, border-color 0.18s ease",
        }}
      >
        <div style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: isSelected ? "1.5px solid rgba(99,102,241,0.50)" : "1px solid rgba(255,255,255,0.10)", transition: "border-color 0.18s ease" }}>
          {msg.avatar ? (
            <img src={msg.avatar} alt={msg.user} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#6366f1,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{msg.user.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: nameSize, fontWeight: 700, color: isSelected ? "rgba(165,180,252,0.95)" : "rgba(255,255,255,0.85)", transition: "color 0.18s ease" }}>
              {msg.user}
            </span>
            <span style={{ fontSize: nameSize - 1, color: "rgba(255,255,255,0.28)", fontWeight: 400 }}>{stripAt(msg.handle)}</span>
            <span style={{ fontSize: nameSize - 1, color: "rgba(255,255,255,0.20)" }}>· {msg.timestamp}</span>
          </div>

          {msg.text && (
            <p style={{ fontSize, color: isSelected ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.58)", lineHeight: 1.55, margin: 0, transition: "color 0.18s ease", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
              {msg.text}
            </p>
          )}

          {/* Post partagé inline */}
          {msg.sharedPost && <SharedPostInline post={msg.sharedPost} />}

          {/* Image */}
          {msg.image && depth === 0 && (
            <div style={{ marginTop: 8, borderRadius: 12, overflow: "hidden", maxHeight: 180 }}>
              <img src={msg.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          )}
        </div>
      </motion.div>

      {/* Thread children */}
      {hasReplies && (
        <div style={{ marginTop: 2 }}>
          {!expanded && (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onClick={() => setExpanded(true)} whileTap={{ scale: 0.95 }}
              style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: avatarSize + 18, marginTop: 6, marginBottom: 4, background: "none", border: "none", cursor: "pointer", padding: "5px 12px 5px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: "rgba(129,140,248,0.75)", backgroundColor: "rgba(99,102,241,0.08)" }}
            >
              <ChevronDown style={{ width: 13, height: 13 }} />
              Voir {replies.length} réponse{replies.length > 1 ? "s" : ""}
            </motion.button>
          )}

          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: "easeOut" }} style={{ overflow: "hidden" }}>
                {shouldDefaultCollapse && (
                  <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setExpanded(false)} whileTap={{ scale: 0.95 }}
                    style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: avatarSize + 18, marginBottom: 6, background: "none", border: "none", cursor: "pointer", padding: "4px 10px 4px 6px", borderRadius: 999, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.25)" }}
                  >
                    <ChevronDown style={{ width: 12, height: 12, transform: "rotate(180deg)" }} /> Réduire
                  </motion.button>
                )}
                <div style={{ display: "flex" }}>
                  {!atMaxDepth && (
                    <div style={{ width: avatarSize + 18, flexShrink: 0, display: "flex", justifyContent: "center", paddingLeft: 8, paddingTop: 2, paddingBottom: 4 }}>
                      <motion.div initial={{ scaleY: 0, originY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.35, ease: "easeOut" }}
                        style={{ width: 1.5, background: "linear-gradient(to bottom, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 100%)", borderRadius: 2, transformOrigin: "top" }}
                      />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {replies.map((r, i) => (
                      <div key={r.id} style={{ display: "flex", alignItems: "flex-start", paddingTop: i === 0 ? 2 : 0, paddingBottom: 2 }}>
                        {!atMaxDepth && (
                          <div style={{ paddingTop: AVATAR_SIZES[Math.min(depth + 1, MAX_DEPTH - 1)] * 0.2, flexShrink: 0 }}>
                            <ThreadArc avatarSize={AVATAR_SIZES[Math.min(depth + 1, MAX_DEPTH - 1)]} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <MessageThread msg={r} all={all} depth={depth + 1} replyingToId={replyingToId} onSelect={onSelect} animDelay={i * 0.06} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {depth === 0 && <div style={{ height: 4 }} />}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TribeDiscussion({ isStatic = true, channelKey }: { isStatic?: boolean; channelKey?: string }) {
  const { id: tribeId } = useParams<{ id: string }>();
  const communityId = tribeId ?? "1";
  // Si channelKey est fourni, on scoped les messages sur ce canal
  const effectiveCommunityId = channelKey ?? communityId;
  const isChannel = !!channelKey;

  // ── État messages ─────────────────────────────────────────────────────────
  const [messages, setMessages]       = useState<Msg[]>(isStatic ? SEED : []);
  const [apiLoaded, setApiLoaded]     = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [replyingTo, setReplyingTo]   = useState<Msg | null>(null);
  const [inputText, setInputText]     = useState("");
  const [sending, setSending]         = useState(false);
  const inputRef                      = useRef<HTMLTextAreaElement>(null);
  const listRef                       = useRef<HTMLDivElement>(null);

  // ── Chargement messages depuis Supabase ───────────────────────────────────
  const fetchMessages = useCallback(async () => {
    setLoadingMsgs(true);
    try {
      const { messages: apiMsgs } = await getCommunityMessages(effectiveCommunityId, 200);
      if (apiMsgs.length > 0) {
        // Remplacer par les vrais messages
        setMessages(apiMsgs.map(apiToMsg));
      } else if (!isStatic || isChannel) {
        // Communauté dynamique ou canal sans messages → état vide
        setMessages([]);
      }
      // Si statique (non-canal) et aucun message Supabase, garder le SEED
      setApiLoaded(true);
    } catch (err) {
      console.error("Erreur chargement messages communauté:", err);
    } finally {
      setLoadingMsgs(false);
    }
  }, [effectiveCommunityId, isChannel]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // ── Posts partagés (section séparée au top) ───────────────────────────────
  const [sharedPosts, setSharedPosts]     = useState<{ id: string; author: string; avatar: string; message: string; timestamp: string; postSnapshot: import("../api/sharesApi").PostSnapshot | null }[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);

  const fetchShares = useCallback(async () => {
    if (isChannel) { setLoadingShares(false); return; } // pas de partages dans les canaux
    setLoadingShares(true);
    try {
      const { shares } = await getCommunityShares(communityId, 10);
      setSharedPosts(shares.map(s => ({
        id: s.id, author: s.author, avatar: s.avatar,
        message: s.message, timestamp: s.timestamp ?? "",
        postSnapshot: s.postSnapshot,
      })));
    } catch (err) {
      console.error("Erreur chargement partages:", err);
    } finally {
      setLoadingShares(false);
    }
  }, [communityId]);

  useEffect(() => { fetchShares(); }, [fetchShares]);

  // ── Interactions ──────────────────────────────────────────────────────────
  const handleSelect = (msg: Msg) => {
    setReplyingTo((prev) => (prev?.id === msg.id ? null : msg));
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    // Optimiste
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Msg = {
      id: tempId,
      parentId: replyingTo ? replyingTo.id : null,
      user: getMyUser(),
      handle: getMyHandle(),
      avatar: getMyAvatar(),
      text,
      timestamp: "À l'instant",
    };
    setMessages((prev) => [...(apiLoaded ? prev : prev.filter(m => !m.id.startsWith("s"))), tempMsg]);
    setInputText("");
    setReplyingTo(null);
    setSending(true);

    try {
      const { message: saved } = await sendCommunityMessage({
        communityId: effectiveCommunityId,
        parentId: tempMsg.parentId,
        userId: getMyId(),
        author: getMyUser(),
        handle: getMyHandle(),
        avatar: getMyAvatar(),
        content: text,
      });
      // Remplacer le message temporaire par le vrai (avec bon ID)
      setMessages((prev) => prev.map((m) => m.id === tempId ? apiToMsg(saved) : m));
    } catch (err) {
      console.error("Erreur envoi message communauté:", err);
      // Conserver le message optimiste même en cas d'erreur
    } finally {
      setSending(false);
    }

    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 80);
  };

  const roots = messages.filter((m) => m.parentId === null);

  return (
    <div style={{ position: "relative" }}>

      {/* ── Posts partagés récents (top) ── */}
      {sharedPosts.length > 0 && (
        <div className="px-4 pb-2 pt-3">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {loadingShares ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw style={{ width: 11, height: 11, color: "rgba(99,102,241,0.55)" }} />
                </motion.div>
              ) : (
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2.5, repeat: Infinity }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8" }} />
                </motion.div>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: "0.04em" }}>
                {sharedPosts.length} post{sharedPosts.length > 1 ? "s" : ""} partagé{sharedPosts.length > 1 ? "s" : ""}
              </span>
            </div>
            <motion.button whileTap={{ scale: 0.88 }} onClick={fetchShares} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <RefreshCw style={{ width: 11, height: 11, color: "rgba(255,255,255,0.22)" }} />
            </motion.button>
          </div>

          {sharedPosts.map((share) => (
            <motion.div key={share.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
              style={{ borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(99,102,241,0.22)", overflow: "hidden", marginBottom: 10 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 8px" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(99,102,241,0.25)" }}>
                  {share.avatar ? (
                    <img src={share.avatar} alt={share.author} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#6366f1,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{share.author.slice(0, 2).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{share.author}</span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                  <Share2 style={{ width: 11, height: 11, color: "rgba(99,102,241,0.55)" }} />
                  <span style={{ fontSize: 11, color: "rgba(99,102,241,0.55)", fontWeight: 600 }}>Partagé</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>· {share.timestamp}</span>
                </div>
              </div>
              {share.message && (
                <p style={{ fontSize: 14, color: "rgba(240,240,245,0.82)", lineHeight: 1.55, padding: "0 14px 10px", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {share.message}
                </p>
              )}
              {share.postSnapshot && (
                <div style={{ margin: "0 10px 10px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 8px" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(99,102,241,0.22)" }}>
                      {share.postSnapshot.user.avatar ? (
                        <img src={share.postSnapshot.user.avatar} alt={share.postSnapshot.user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#6366f1,#a78bfa)" }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>{share.postSnapshot.user.name}</span>
                    </div>
                    <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 999, background: "rgba(255,255,255,0.90)", fontSize: 10, fontWeight: 700, color: "#111", flexShrink: 0 }}>
                      {TYPE_LABELS[share.postSnapshot.progress.type] ?? share.postSnapshot.progress.type}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(200,200,220,0.65)", lineHeight: 1.55, padding: "0 12px 10px", margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const }}>
                    {share.postSnapshot.progress.description}
                  </p>
                </div>
              )}
            </motion.div>
          ))}

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 14px" }}>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", fontWeight: 600, letterSpacing: "0.05em" }}>DISCUSSION</span>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.06)" }} />
          </div>
        </div>
      )}

      {/* ── Thread list ── */}
      <div ref={listRef} className="px-4 pb-40">
        {loadingMsgs && !apiLoaded && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 24, gap: 8 }}>
            <Loader2 style={{ width: 14, height: 14, color: "rgba(99,102,241,0.55)" }} className="animate-spin" />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>Chargement des messages…</span>
          </div>
        )}
        {/* État vide pour communauté dynamique sans messages */}
        {!loadingMsgs && apiLoaded && roots.length === 0 && !isStatic && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              paddingTop: 48, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 14, textAlign: "center",
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 20,
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.20)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26,
            }}>💬</div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.75)", margin: "0 0 6px" }}>
                Aucun message pour l'instant
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", margin: 0, lineHeight: 1.6 }}>
                Lancez la discussion ci-dessous !
              </p>
            </div>
          </motion.div>
        )}
        <AnimatePresence mode="popLayout">
          {roots.map((root, i) => (
            <div key={root.id}>
              <MessageThread msg={root} all={messages} depth={0} replyingToId={replyingTo?.id ?? null} onSelect={handleSelect} animDelay={i * 0.04} />
              {i < roots.length - 1 && (
                <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "4px 8px 10px" }} />
              )}
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Sticky input bar ── */}
      <div style={{ position: "sticky", bottom: 0, padding: "0 16px 20px", background: "linear-gradient(to top, #000000 60%, rgba(0,0,0,0) 100%)" }}>

        {/* Reply-to chip */}
        <AnimatePresence>
          {replyingTo && (
            <motion.div
              initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 6, height: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}
              style={{ overflow: "hidden", marginBottom: 8 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 14, background: "rgba(99,102,241,0.09)", border: "0.5px solid rgba(99,102,241,0.28)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                  <CornerDownRight style={{ width: 12, height: 12, color: "#818cf8", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#a5b4fc", flexShrink: 0 }}>{stripAt(replyingTo.handle)}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                    · "{replyingTo.text.slice(0, 36)}{replyingTo.text.length > 36 ? "…" : ""}"
                  </span>
                </div>
                <button onClick={() => setReplyingTo(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.30)" }} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input */}
        <form onSubmit={handleSend}>
          <motion.div
            style={{
              display: "flex", alignItems: "flex-end", gap: 12, minHeight: 50,
              borderRadius: 24, padding: "9px 18px",
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
              border: replyingTo ? "0.5px solid rgba(99,102,241,0.30)" : "0.5px solid rgba(255,255,255,0.12)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.38)",
              transition: "border-color 0.2s ease",
            }}
          >
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as unknown as React.FormEvent);
                }
              }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
              placeholder={replyingTo ? `Répondre à ${stripAt(replyingTo.handle)}…` : "Nouveau message… (Maj+Entrée pour saut de ligne)"}
              disabled={sending}
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                fontSize: 14, color: "#f0f0f5", caretColor: "#6366f1",
                resize: "none", lineHeight: 1.5, maxHeight: 120, minHeight: 22,
                whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere",
                fontFamily: "inherit", paddingTop: 4, paddingBottom: 4,
              }}
              className="placeholder:text-[rgba(144,144,168,0.38)]"
            />
            <motion.button
              type="submit"
              disabled={!inputText.trim() || sending}
              whileTap={inputText.trim() && !sending ? { scale: 0.86 } : {}}
              style={{ background: "none", border: "none", cursor: inputText.trim() && !sending ? "pointer" : "default", padding: 0, display: "flex", alignItems: "center" }}
            >
              {sending ? (
                <Loader2 style={{ width: 18, height: 18, color: "rgba(165,180,252,0.55)" }} className="animate-spin" />
              ) : (
                <Send style={{ width: 18, height: 18, color: inputText.trim() ? "rgba(165,180,252,0.90)" : "rgba(255,255,255,0.16)", transition: "color 0.2s ease" }} />
              )}
            </motion.button>
          </motion.div>
        </form>
      </div>
    </div>
  );
}