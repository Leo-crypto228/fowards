import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  ChevronRight, Hash, Plus, Pencil, Trash2, X, Check, GripVertical,
  Settings, ChevronDown, Loader2,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { toast } from "sonner";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { Authorization: `Bearer ${publicAnonKey}`, "Content-Type": "application/json" };

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChannelItem {
  id: string;
  name: string;
  emoji?: string;
}

export interface ChannelCategory {
  id: string;
  name: string;
  collapsed?: boolean;
  channels: ChannelItem[];
}

interface Props {
  communityId: string;
  isAdmin: boolean;
  adminUserId?: string;
  onChannelSelect: (category: ChannelCategory, channel: ChannelItem) => void;
  selectedChannelId?: string | null;
  initialChannelId?: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function slugify(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-éèêëàâîïôùûç]/g, "")
    .slice(0, 32);
}

// ── Inline editable text ───────────────────────────────────────────────────────

function InlineEdit({
  value,
  onSave,
  onCancel,
  placeholder,
  small,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  placeholder?: string;
  small?: boolean;
}) {
  const [text, setText] = useState(value);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSave(text.trim());
      }}
      style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        style={{
          flex: 1,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(99,102,241,0.45)",
          borderRadius: 8,
          padding: small ? "3px 8px" : "5px 10px",
          fontSize: small ? 11 : 13,
          color: "rgba(255,255,255,0.90)",
          outline: "none",
        }}
      />
      <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
        <Check style={{ width: 14, height: 14, color: "#818cf8" }} />
      </button>
      <button type="button" onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
        <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.30)" }} />
      </button>
    </form>
  );
}

// ── Inline edit for channel (emoji + name) ─────────────────────────────────────

function InlineEditChan({
  emoji,
  name,
  onSave,
  onCancel,
}: {
  emoji: string;
  name: string;
  onSave: (emoji: string, name: string) => void;
  onCancel: () => void;
}) {
  const [emojiVal, setEmojiVal] = useState(emoji === "#" ? "" : emoji);
  const [nameVal, setNameVal]   = useState(name);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (nameVal.trim()) onSave(emojiVal.trim() || "#", nameVal.trim());
      }}
      style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}
    >
      <input
        value={emojiVal}
        onChange={(e) => setEmojiVal(e.target.value)}
        placeholder="😀"
        maxLength={3}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        style={{
          width: 34, height: 28, textAlign: "center", fontSize: 16, flexShrink: 0,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(99,102,241,0.35)",
          borderRadius: 7, outline: "none", color: "#f0f0f5",
        }}
      />
      <input
        autoFocus
        value={nameVal}
        onChange={(e) => setNameVal(e.target.value)}
        placeholder="nom-du-canal"
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        style={{
          flex: 1,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(99,102,241,0.45)",
          borderRadius: 8,
          padding: "3px 8px",
          fontSize: 13,
          color: "rgba(255,255,255,0.90)",
          outline: "none",
        }}
      />
      <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
        <Check style={{ width: 14, height: 14, color: "#818cf8" }} />
      </button>
      <button type="button" onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
        <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.30)" }} />
      </button>
    </form>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DiscussionChannelList({
  communityId,
  isAdmin,
  adminUserId,
  onChannelSelect,
  selectedChannelId,
  initialChannelId,
}: Props) {
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [editMode, setEditMode]     = useState(false);

  // Inline-edit state
  const [renamingCatId, setRenamingCatId]   = useState<string | null>(null);
  const [renamingChanId, setRenamingChanId] = useState<string | null>(null);

  // Add-form state
  const [addingCatId, setAddingCatId]   = useState<string | null>(null); // catId for new channel
  const [addingCat, setAddingCat]       = useState(false);              // new category form
  const [newChanName, setNewChanName]   = useState("");
  const [newChanEmoji, setNewChanEmoji] = useState("");
  const [newCatName, setNewCatName]     = useState("");

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/communities/${communityId}/channels`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (data.channels) {
        setCategories(data.channels);
        // Auto-open initialChannelId if provided
        if (initialChannelId) {
          for (const cat of data.channels as ChannelCategory[]) {
            const chan = cat.channels.find((ch: ChannelItem) => ch.id === initialChannelId);
            if (chan) { onChannelSelect(cat, chan); break; }
          }
        }
      }
    } catch (err) {
      console.error("Erreur chargement canaux:", err);
    } finally {
      setLoading(false);
    }
  }, [communityId, initialChannelId, onChannelSelect]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  // ── Save to backend ───────────────────────────────────────────────────────────
  const saveChannels = useCallback(async (updated: ChannelCategory[]) => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/communities/${communityId}/channels`, {
        method: "PUT",
        headers: H,
        body: JSON.stringify({ channels: updated, requestedBy: adminUserId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Erreur serveur");
      setCategories(updated);
      toast.success("Canaux sauvegardés ✓");
    } catch (err) {
      console.error("Erreur sauvegarde canaux:", err);
      toast.error("Impossible de sauvegarder");
    } finally {
      setSaving(false);
    }
  }, [communityId, adminUserId]);

  // ── Toggle category collapse ──────────────────────────────────────────────────
  const toggleCat = (catId: string) => {
    if (editMode) return;
    setCategories((prev) =>
      prev.map((c) => c.id === catId ? { ...c, collapsed: !c.collapsed } : c)
    );
  };

  // ── Rename category ───────────────────────────────────────────────────────────
  const renameCat = async (catId: string, newName: string) => {
    const updated = categories.map((c) => c.id === catId ? { ...c, name: newName } : c);
    setRenamingCatId(null);
    await saveChannels(updated);
  };

  // ── Delete category ───────────────────────────────────────────────────────────
  const deleteCat = async (catId: string) => {
    const updated = categories.filter((c) => c.id !== catId);
    await saveChannels(updated);
  };

  // ── Add category ──────────────────────────────────────────────────────────────
  const addCat = async () => {
    if (!newCatName.trim()) return;
    const newCat: ChannelCategory = {
      id: `cat-${genId()}`,
      name: newCatName.trim(),
      collapsed: false,
      channels: [],
    };
    const updated = [...categories, newCat];
    setNewCatName("");
    setAddingCat(false);
    await saveChannels(updated);
  };

  // ── Rename channel ────────────────────────────────────────────────────────────
  const renameChan = async (catId: string, chanId: string, newEmoji: string, newName: string) => {
    const updated = categories.map((c) =>
      c.id === catId
        ? { ...c, channels: c.channels.map((ch) => ch.id === chanId ? { ...ch, emoji: newEmoji || ch.emoji, name: newName || ch.name } : ch) }
        : c
    );
    setRenamingChanId(null);
    await saveChannels(updated);
  };

  // ── Delete channel ────────────────────────────────────────────────────────────
  const deleteChan = async (catId: string, chanId: string) => {
    const updated = categories.map((c) =>
      c.id === catId ? { ...c, channels: c.channels.filter((ch) => ch.id !== chanId) } : c
    );
    await saveChannels(updated);
  };

  // ── Add channel ───────────────────────────────────────────────────────────────
  const addChan = async (catId: string) => {
    if (!newChanName.trim()) return;
    const newCh: ChannelItem = {
      id: `ch-${genId()}`,
      name: newChanName.trim(),
      emoji: newChanEmoji.trim() || "#",
    };
    const updated = categories.map((c) =>
      c.id === catId ? { ...c, channels: [...c.channels, newCh] } : c
    );
    setNewChanName("");
    setNewChanEmoji("");
    setAddingCatId(null);
    await saveChannels(updated);
  };

  // ── Move category up/down ─────────────────────────────────────────────────────
  const moveCat = async (catId: string, dir: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === catId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= categories.length) return;
    const updated = [...categories];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    await saveChannels(updated);
  };

  // ── Move channel up/down ──────────────────────────────────────────────────────
  const moveChan = async (catId: string, chanId: string, dir: -1 | 1) => {
    const updated = categories.map((c) => {
      if (c.id !== catId) return c;
      const idx = c.channels.findIndex((ch) => ch.id === chanId);
      if (idx < 0) return c;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= c.channels.length) return c;
      const chans = [...c.channels];
      [chans[idx], chans[newIdx]] = [chans[newIdx], chans[idx]];
      return { ...c, channels: chans };
    });
    await saveChannels(updated);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 48, gap: 8 }}>
        <Loader2 style={{ width: 16, height: 16, color: "#6366f1" }} className="animate-spin" />
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)" }}>Chargement des canaux…</span>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px 10px",
        }}
      >
        <span
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.10em",
            color: "rgba(255,255,255,0.30)", textTransform: "uppercase",
          }}
        >
          Discussions
        </span>

        {isAdmin && (
          <div style={{ display: "flex", gap: 6 }}>
            {editMode && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  setEditMode(false);
                  setRenamingCatId(null);
                  setRenamingChanId(null);
                  setAddingCat(false);
                  setAddingCatId(null);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 999, border: "none",
                  background: "rgba(99,102,241,0.15)",
                  fontSize: 11, fontWeight: 700, color: "#818cf8", cursor: "pointer",
                }}
              >
                <Check style={{ width: 11, height: 11 }} /> Terminer
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => setEditMode((v) => !v)}
              title={editMode ? "Quitter le mode édition" : "Modifier les canaux"}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: "50%", border: "none",
                background: editMode ? "rgba(99,102,241,0.20)" : "rgba(255,255,255,0.06)",
                cursor: "pointer",
              }}
            >
              <Settings style={{ width: 13, height: 13, color: editMode ? "#a5b4fc" : "rgba(255,255,255,0.40)" }} />
            </motion.button>
          </div>
        )}
      </div>

      {saving && (
        <div style={{ padding: "0 20px 8px", display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 style={{ width: 11, height: 11, color: "#6366f1" }} className="animate-spin" />
          <span style={{ fontSize: 11, color: "rgba(99,102,241,0.65)" }}>Sauvegarde…</span>
        </div>
      )}

      {/* ── Category list ── */}
      <div>
        
          {categories.map((cat, catIdx) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              style={{ marginBottom: 4 }}
            >
              {/* ── Category header ��─ */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 20px 5px",
                  cursor: editMode ? "default" : "pointer",
                }}
                onClick={() => !editMode && toggleCat(cat.id)}
              >
                {editMode && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, marginRight: 2 }}>
                    <button
                      disabled={catIdx === 0}
                      onClick={(e) => { e.stopPropagation(); moveCat(cat.id, -1); }}
                      style={{
                        background: "none", border: "none", cursor: catIdx === 0 ? "default" : "pointer",
                        padding: 0, opacity: catIdx === 0 ? 0.25 : 0.6, lineHeight: 1,
                      }}
                    >
                      <ChevronRight style={{ width: 10, height: 10, color: "rgba(255,255,255,0.55)", transform: "rotate(-90deg)" }} />
                    </button>
                    <button
                      disabled={catIdx === categories.length - 1}
                      onClick={(e) => { e.stopPropagation(); moveCat(cat.id, 1); }}
                      style={{
                        background: "none", border: "none",
                        cursor: catIdx === categories.length - 1 ? "default" : "pointer",
                        padding: 0, opacity: catIdx === categories.length - 1 ? 0.25 : 0.6, lineHeight: 1,
                      }}
                    >
                      <ChevronRight style={{ width: 10, height: 10, color: "rgba(255,255,255,0.55)", transform: "rotate(90deg)" }} />
                    </button>
                  </div>
                )}

                {!editMode && (
                  <motion.div
                    animate={{ rotate: cat.collapsed ? -90 : 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    style={{ flexShrink: 0 }}
                  >
                    <ChevronDown style={{ width: 11, height: 11, color: "rgba(255,255,255,0.28)" }} />
                  </motion.div>
                )}

                {renamingCatId === cat.id ? (
                  <InlineEdit
                    value={cat.name}
                    onSave={(v) => renameCat(cat.id, v)}
                    onCancel={() => setRenamingCatId(null)}
                    placeholder="Nom de la catégorie"
                  />
                ) : (
                  <span
                    style={{
                      flex: 1,
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.09em",
                      color: editMode ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.32)",
                      textTransform: "uppercase",
                      userSelect: "none",
                    }}
                  >
                    {cat.name}
                  </span>
                )}

                {editMode && renamingCatId !== cat.id && (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => { e.stopPropagation(); setRenamingCatId(cat.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}
                    >
                      <Pencil style={{ width: 11, height: 11, color: "rgba(255,255,255,0.35)" }} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => { e.stopPropagation(); deleteCat(cat.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}
                    >
                      <Trash2 style={{ width: 11, height: 11, color: "rgba(239,68,68,0.60)" }} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => { e.stopPropagation(); setAddingCatId(cat.id); setNewChanName(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}
                      title="Ajouter un canal"
                    >
                      <Plus style={{ width: 13, height: 13, color: "rgba(129,140,248,0.70)" }} />
                    </motion.button>
                  </div>
                )}

                {!editMode && isAdmin && (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditMode(true);
                      setAddingCatId(cat.id);
                      setNewChanName("");
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 3, opacity: 0.45 }}
                    title="Ajouter un canal"
                  >
                    <Plus style={{ width: 13, height: 13, color: "rgba(255,255,255,0.55)" }} />
                  </motion.button>
                )}
              </div>

              {/* ── Channels list ── */}
              
                {!cat.collapsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    {cat.channels.map((chan, chanIdx) => {
                      const isSelected = selectedChannelId === chan.id;
                      return (
                        <motion.div
                          key={chan.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.18 }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            margin: "1px 8px",
                            padding: "8px 12px",
                            borderRadius: 10,
                            background: isSelected
                              ? "rgba(99,102,241,0.14)"
                              : "transparent",
                            border: isSelected
                              ? "0.5px solid rgba(99,102,241,0.30)"
                              : "0.5px solid transparent",
                            cursor: editMode ? "default" : "pointer",
                            transition: "background 0.16s ease, border-color 0.16s ease",
                          }}
                          onClick={() => !editMode && onChannelSelect(cat, chan)}
                          whileTap={!editMode ? { scale: 0.97 } : undefined}
                        >
                          {editMode && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginRight: 1 }}>
                              <button
                                disabled={chanIdx === 0}
                                onClick={(e) => { e.stopPropagation(); moveChan(cat.id, chan.id, -1); }}
                                style={{ background: "none", border: "none", cursor: chanIdx === 0 ? "default" : "pointer", padding: 0, opacity: chanIdx === 0 ? 0.2 : 0.5, lineHeight: 1 }}
                              >
                                <ChevronRight style={{ width: 9, height: 9, color: "rgba(255,255,255,0.45)", transform: "rotate(-90deg)" }} />
                              </button>
                              <button
                                disabled={chanIdx === cat.channels.length - 1}
                                onClick={(e) => { e.stopPropagation(); moveChan(cat.id, chan.id, 1); }}
                                style={{ background: "none", border: "none", cursor: chanIdx === cat.channels.length - 1 ? "default" : "pointer", padding: 0, opacity: chanIdx === cat.channels.length - 1 ? 0.2 : 0.5, lineHeight: 1 }}
                              >
                                <ChevronRight style={{ width: 9, height: 9, color: "rgba(255,255,255,0.45)", transform: "rotate(90deg)" }} />
                              </button>
                            </div>
                          )}

                          <Hash
                            style={{
                              width: 15, height: 15, flexShrink: 0,
                              color: isSelected ? "#818cf8" : "rgba(255,255,255,0.28)",
                              strokeWidth: 2.5,
                              transition: "color 0.16s ease",
                              display: (chan.emoji && chan.emoji !== "#") ? "none" : "block",
                            }}
                          />
                          {chan.emoji && chan.emoji !== "#" && (
                            <span style={{
                              fontSize: 15, flexShrink: 0, lineHeight: 1,
                              opacity: isSelected ? 1 : 0.65,
                              transition: "opacity 0.16s ease",
                            }}>
                              {chan.emoji}
                            </span>
                          )}

                          {renamingChanId === chan.id ? (
                            <InlineEditChan
                              emoji={chan.emoji || "#"}
                              name={chan.name}
                              onSave={(em, nm) => renameChan(cat.id, chan.id, em, nm)}
                              onCancel={() => setRenamingChanId(null)}
                            />
                          ) : (
                            <span
                              style={{
                                flex: 1,
                                fontSize: 15,
                                fontWeight: isSelected ? 600 : 400,
                                color: isSelected
                                  ? "rgba(255,255,255,0.90)"
                                  : "rgba(255,255,255,0.48)",
                                transition: "color 0.16s ease, font-weight 0.16s ease",
                                userSelect: "none",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {chan.name}
                            </span>
                          )}

                          {editMode && renamingChanId !== chan.id && (
                            <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                              <motion.button
                                whileTap={{ scale: 0.85 }}
                                onClick={(e) => { e.stopPropagation(); setRenamingChanId(chan.id); }}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}
                              >
                                <Pencil style={{ width: 10, height: 10, color: "rgba(255,255,255,0.30)" }} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.85 }}
                                onClick={(e) => { e.stopPropagation(); deleteChan(cat.id, chan.id); }}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 3 }}
                              >
                                <Trash2 style={{ width: 10, height: 10, color: "rgba(239,68,68,0.55)" }} />
                              </motion.button>
                            </div>
                          )}

                          {isSelected && !editMode && (
                            <motion.div
                              layoutId="channelActivePip"
                              style={{
                                width: 5, height: 5, borderRadius: "50%",
                                background: "#818cf8", flexShrink: 0,
                              }}
                            />
                          )}
                        </motion.div>
                      );
                    })}

                    {/* Add channel form */}
                    
                      {addingCatId === cat.id && (
                        <motion.form
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          transition={{ duration: 0.20 }}
                          onSubmit={(e) => { e.preventDefault(); addChan(cat.id); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            margin: "4px 8px",
                            padding: "7px 12px",
                            borderRadius: 10,
                            background: "rgba(99,102,241,0.06)",
                            border: "0.5px solid rgba(99,102,241,0.25)",
                            overflow: "hidden",
                          }}
                        >
                          <input
                            value={newChanEmoji}
                            onChange={(e) => setNewChanEmoji(e.target.value)}
                            placeholder="😀"
                            maxLength={3}
                            style={{
                              width: 32, height: 28, textAlign: "center", fontSize: 16, flexShrink: 0,
                              background: "rgba(255,255,255,0.06)",
                              border: "0.5px solid rgba(99,102,241,0.30)",
                              borderRadius: 7, outline: "none", color: "#f0f0f5",
                            }}
                          />
                          <input
                            autoFocus
                            value={newChanName}
                            onChange={(e) => setNewChanName(e.target.value)}
                            placeholder="nom-du-canal"
                            onKeyDown={(e) => e.key === "Escape" && setAddingCatId(null)}
                            style={{
                              flex: 1, background: "none", border: "none", outline: "none",
                              fontSize: 13, color: "rgba(255,255,255,0.80)",
                            }}
                          />
                          <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                            <Check style={{ width: 14, height: 14, color: "#818cf8" }} />
                          </button>
                          <button type="button" onClick={() => setAddingCatId(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                            <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.25)" }} />
                          </button>
                        </motion.form>
                      )}
                    

                    {/* Empty state */}
                    {cat.channels.length === 0 && addingCatId !== cat.id && (
                      <div
                        style={{
                          margin: "2px 20px 6px",
                          fontSize: 12,
                          color: "rgba(255,255,255,0.18)",
                          fontStyle: "italic",
                        }}
                      >
                        Aucun canal
                        {editMode && (
                          <span
                            onClick={() => { setAddingCatId(cat.id); setNewChanName(""); }}
                            style={{ cursor: "pointer", color: "rgba(129,140,248,0.55)", marginLeft: 6 }}
                          >
                            + Ajouter
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              
            </motion.div>
          ))}
        

        {/* ── Add category ── */}
        {editMode && (
          <div style={{ padding: "8px 16px 0" }}>
            
              {addingCat ? (
                <motion.form
                  key="add-cat-form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={(e) => { e.preventDefault(); addCat(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", borderRadius: 12,
                    background: "rgba(99,102,241,0.07)",
                    border: "0.5px solid rgba(99,102,241,0.28)",
                  }}
                >
                  <GripVertical style={{ width: 13, height: 13, color: "rgba(255,255,255,0.20)", flexShrink: 0 }} />
                  <input
                    autoFocus
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nom de la catégorie"
                    onKeyDown={(e) => e.key === "Escape" && setAddingCat(false)}
                    style={{
                      flex: 1, background: "none", border: "none", outline: "none",
                      fontSize: 12, fontWeight: 700, letterSpacing: "0.07em",
                      textTransform: "uppercase", color: "rgba(255,255,255,0.70)",
                    }}
                  />
                  <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                    <Check style={{ width: 14, height: 14, color: "#818cf8" }} />
                  </button>
                  <button type="button" onClick={() => setAddingCat(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                    <X style={{ width: 13, height: 13, color: "rgba(255,255,255,0.25)" }} />
                  </button>
                </motion.form>
              ) : (
                <motion.button
                  key="add-cat-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setAddingCat(true); setNewCatName(""); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, width: "100%",
                    padding: "9px 12px", borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "0.5px dashed rgba(255,255,255,0.12)",
                    cursor: "pointer", fontSize: 12, fontWeight: 600,
                    color: "rgba(255,255,255,0.30)",
                  }}
                >
                  <Plus style={{ width: 13, height: 13 }} />
                  Ajouter une catégorie
                </motion.button>
              )}
            
          </div>
        )}
      </div>

      {/* ── Empty state (no categories at all) ── */}
      {!loading && categories.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            margin: "32px 20px",
            padding: "32px 24px",
            borderRadius: 20,
            background: "rgba(255,255,255,0.025)",
            border: "0.5px solid rgba(255,255,255,0.07)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 12 }}>💬</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.65)", margin: "0 0 6px" }}>
            Aucun canal
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", margin: 0, lineHeight: 1.6 }}>
            {isAdmin
              ? "Cliquez sur ⚙ pour créer les premiers canaux."
              : "L'admin n'a pas encore créé de canaux."}
          </p>
        </motion.div>
      )}
    </div>
  );
}