import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CGU from './pages/cgu';
import ClarityScript from './components/clarityScript';
import React from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthContext";
import { FollowProvider } from "./context/FollowContext";
import { SavedPostsProvider } from "./context/SavedPostsContext";
import { CommunityMemberProvider } from "./context/CommunityMemberContext";
import { ProgressionProvider } from "./context/ProgressionContext";
import { ObjectiveProgressProvider } from "./context/ObjectiveProgressContext";
import { ActiveCommunityProvider } from "./context/ActiveCommunityContext";
import { NotificationProvider } from "./context/NotificationContext";

/**
 * Providers pour les données GLOBALES (disponibles partout, même sans user connecté)
 */
function GlobalProviders({ children }: { children: React.ReactNode }) {
  return (
    <SavedPostsProvider> {/* ← Disponible pour TOUTES les pages */}
      {children}
    </SavedPostsProvider>
  );
}

/**
 * Providers pour les données UTILISATEUR (remontés à chaque changement de compte)
 */
function UserScopedProviders({ children }: { children: React.ReactNode }) {
  return (
    <FollowProvider>
      {/* ❌ SavedPostsProvider enlevé d'ici (il est déjà dans GlobalProviders) */}
      <CommunityMemberProvider>
        <ProgressionProvider>
          <ObjectiveProgressProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </ObjectiveProgressProvider>
        </ProgressionProvider>
      </CommunityMemberProvider>
    </FollowProvider>
  );
}

/**
 * Ne monte les providers KV-dépendants QUE si l'utilisateur est authentifié.
 */
function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <>{children}</>;
  }

  return (
    <UserScopedProviders key={user.supabaseId}>
      {children}
    </UserScopedProviders>
  );
}

export default function App() {
  return (
    <>
      {/* 1. Providers GLOBAUX (toujours actifs) */}
      <GlobalProviders>
        {/* 2. AuthProvider (gestion de l'utilisateur) */}
        <AuthProvider>
          {/* 3. ActiveCommunityProvider (communautés) */}
          <ActiveCommunityProvider>
            {/* 4. Providers conditionnels (si user connecté) */}
            <AuthenticatedProviders>
              <RouterProvider router={router} />
            </AuthenticatedProviders>
          </ActiveCommunityProvider>
        </AuthProvider>
      </GlobalProviders>

      {/* 5. Scripts externes (doit rester en dehors des providers) */}
      <ClarityScript />
    </>
  );
}