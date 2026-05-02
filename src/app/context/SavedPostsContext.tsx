import React, { createContext, useContext, useState, useCallback } from "react";

/* ─── Types ── */

export interface SavedPostData {
  user: { name: string; avatar: string; objective: string };
  streak: number;
  progress: { type: string; description: string; timestamp: string };
  image?: string;
  verified?: boolean;
  relevantCount?: number;
  commentsCount?: number;
  hashtags?: string[];
}

export interface SavedPost {
  id: string;          // generated key
  savedAt: Date;
  post: SavedPostData;
}

interface SavedPostsContextValue {
  savedPosts: SavedPost[];
  save: (post: SavedPostData) => string;
  unsave: (id: string) => void;
  isSaved: (id: string) => boolean;
  getSavedId: (post: SavedPostData) => string | null;
}

/* ─── Context ── */

const SavedPostsContext = createContext<SavedPostsContextValue | null>(null);

function makeId(post: SavedPostData): string {
  return `${post.user.name}__${post.progress.timestamp}__${post.progress.description.slice(0, 20)}`;
}

export function SavedPostsProvider({ children }: { children: React.ReactNode }) {
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);

  const save = useCallback((post: SavedPostData): string => {
    const id = makeId(post);
    setSavedPosts((prev) => {
      if (prev.find((p) => p.id === id)) return prev;
      return [{ id, savedAt: new Date(), post }, ...prev];
    });
    return id;
  }, []);

  const unsave = useCallback((id: string) => {
    setSavedPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const isSaved = useCallback(
    (id: string) => savedPosts.some((p) => p.id === id),
    [savedPosts]
  );

  const getSavedId = useCallback(
    (post: SavedPostData): string | null => {
      const id = makeId(post);
      return savedPosts.find((p) => p.id === id) ? id : null;
    },
    [savedPosts]
  );

  return (
    <SavedPostsContext.Provider value={{ savedPosts, save, unsave, isSaved, getSavedId }}>
      {children}
    </SavedPostsContext.Provider>
  );
}

export function useSavedPosts() {
  const ctx = useContext(SavedPostsContext);
  if (!ctx) throw new Error("useSavedPosts must be used within SavedPostsProvider");
  return ctx;
}
