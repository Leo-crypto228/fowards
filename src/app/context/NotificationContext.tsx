import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-218684af`;
const H = { Authorization: `Bearer ${publicAnonKey}` };

async function fetchUnreadCount(username: string): Promise<number> {
  try {
    const res = await fetch(
      `${BASE}/notifications/unread-count?userId=${encodeURIComponent(username)}`,
      { headers: H }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.unreadCount ?? 0;
  } catch { return 0; }
}

interface NotificationContextValue {
  unreadCount: number;
  refreshUnread: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refreshUnread: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.username) return;
    const c = await fetchUnreadCount(user.username);
    setUnreadCount(c);
  }, [user?.username]);

  useEffect(() => {
    if (!user?.username) return;
    refresh();
    // Polling toutes les 30s
    intervalRef.current = setInterval(refresh, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.username, refresh]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnread: refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}