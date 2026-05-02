import { createContext, useContext, useState, useCallback } from "react";

interface ActiveCommunityState {
  communityId: string | null;
  channelId: string | null;
  channelName: string | null;
}

interface ActiveCommunityContextType extends ActiveCommunityState {
  setActive: (communityId: string, channelId: string | null, channelName: string | null) => void;
  clearActive: () => void;
}

const ActiveCommunityContext = createContext<ActiveCommunityContextType>({
  communityId: null,
  channelId: null,
  channelName: null,
  setActive: () => {},
  clearActive: () => {},
});

export function ActiveCommunityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ActiveCommunityState>({
    communityId: null,
    channelId: null,
    channelName: null,
  });

  const setActive = useCallback((communityId: string, channelId: string | null, channelName: string | null) => {
    setState({ communityId, channelId, channelName });
  }, []);

  const clearActive = useCallback(() => {
    setState({ communityId: null, channelId: null, channelName: null });
  }, []);

  return (
    <ActiveCommunityContext.Provider value={{ ...state, setActive, clearActive }}>
      {children}
    </ActiveCommunityContext.Provider>
  );
}

export function useActiveCommunity() {
  return useContext(ActiveCommunityContext);
}
