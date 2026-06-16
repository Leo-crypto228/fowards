import { createBrowserRouter, Navigate } from "react-router";
import { lazy, createElement } from "react";
import { Layout } from "./components/Layout";
import { RootError } from "./components/RootError";

// Auth pages — eager (small forms, entry points for unauthenticated users)
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { OnboardingProfilePage } from "./pages/OnboardingProfilePage";
import { OnboardingIAPage } from "./pages/OnboardingIAPage";
import { AiDisabledPage, PaymentsDisabledPage } from "./pages/FeatureDisabled";
import { AI_ENABLED, PAYMENTS_ENABLED } from "./config/featureFlags";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { AdminProtected } from "./pages/AdminProtected";
import { MentionsLegales } from "./pages/MentionsLegales";
import { ConditionsGenerales } from "./pages/ConditionsGenerales";
import { PolitiqueConfidentialite } from "./pages/PolitiqueConfidentialite";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";

// App pages — lazy loaded (code-split per route, speeds up initial load and navigation)
const Feed              = lazy(() => import("./pages/Feed").then(m => ({ default: m.Feed })));
const Profile           = lazy(() => import("./pages/Profile").then(m => ({ default: m.Profile })));
const CreateProgress    = lazy(() => import("./pages/CreateProgress").then(m => ({ default: m.CreateProgress })));
const Tribes            = lazy(() => import("./pages/Tribes").then(m => ({ default: m.Tribes })));
const TribeDetail       = lazy(() => import("./pages/TribeDetail").then(m => ({ default: m.TribeDetail })));
const CreateCommunity   = lazy(() => import("./pages/CreateCommunity").then(m => ({ default: m.CreateCommunity })));
const EditCommunity     = lazy(() => import("./pages/EditCommunity").then(m => ({ default: m.EditCommunity })));
const CreateCommunityPost = lazy(() => import("./pages/CreateCommunityPost").then(m => ({ default: m.CreateCommunityPost })));
const UserProfile       = lazy(() => import("./pages/UserProfile").then(m => ({ default: m.UserProfile })));
const HashtagFeed       = lazy(() => import("./pages/HashtagFeed").then(m => ({ default: m.HashtagFeed })));
const PostDetail        = lazy(() => import("./pages/PostDetail").then(m => ({ default: m.PostDetail })));
const Search            = lazy(() => import("./pages/Search").then(m => ({ default: m.Search })));
const FcoinsPage        = lazy(() => import("./pages/FcoinsPage").then(m => ({ default: m.FcoinsPage })));
const ProgressionPage   = lazy(() => import("./pages/ProgressionPage").then(m => ({ default: m.ProgressionPage })));
const EditProfilePage   = lazy(() => import("./pages/EditProfilePage").then(m => ({ default: m.EditProfilePage })));
const ProfileSettings   = lazy(() => import("./pages/ProfileSettings").then(m => ({ default: m.ProfileSettings })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const CreateWays        = lazy(() => import("./pages/CreateWays").then(m => ({ default: m.CreateWays })));
const WaysViewer        = lazy(() => import("./pages/WaysViewer").then(m => ({ default: m.WaysViewer })));
const WaysComments      = lazy(() => import("./pages/WaysComments").then(m => ({ default: m.WaysComments })));
const NewMembersPage    = lazy(() => import("./pages/NewMembersPage").then(m => ({ default: m.NewMembersPage })));
const AIHomePage        = lazy(() => import("./pages/AIHomePage").then(m => ({ default: m.AIHomePage })));
const AIConversationPage = lazy(() => import("./pages/AIConversationPage").then(m => ({ default: m.AIConversationPage })));
const AIProfilePage     = lazy(() => import("./pages/AIProfilePage").then(m => ({ default: m.AIProfilePage })));
const PremiumPage        = lazy(() => import("./pages/PremiumPage").then(m => ({ default: m.PremiumPage })));
const PremiumSuccessPage = lazy(() => import("./pages/PremiumSuccessPage").then(m => ({ default: m.PremiumSuccessPage })));

export const router = createBrowserRouter([
  // ── Auth pages (hors Layout, hors guard) ─────────────────────────────────
  { path: "/login",              Component: LoginPage },
  { path: "/signup",             Component: SignupPage },
  { path: "/verify-email",       Component: VerifyEmailPage },
  { path: "/onboarding/profile", Component: OnboardingProfilePage },
  { path: "/onboarding/ia",      Component: AI_ENABLED ? OnboardingIAPage : AiDisabledPage },
  { path: "/auth/callback", Component: AuthCallbackPage },
  { path: "/mentions-legales",           Component: MentionsLegales },
  { path: "/conditions",                 Component: ConditionsGenerales },
  { path: "/politique-confidentialite",  Component: PolitiqueConfidentialite },
  { path: "/reset-password",             Component: ResetPasswordPage },

  // ── Admin (accès restreint — UUID admin uniquement) ───────────────────────
  { path: "/admin",            Component: AdminProtected },

  // ── App pages (sous Layout + guard auth) ──────────────────────────────────
  {
    path: "/",
    Component: Layout,
    ErrorBoundary: RootError,
    children: [
      { index: true,                element: createElement(Navigate, { to: AI_ENABLED ? "/ai" : "/feed", replace: true }) },
      { path: "feed",               Component: Feed },
      { path: "profile",            Component: Profile },
      { path: "profile/edit",       Component: EditProfilePage },
      { path: "profile/settings",   Component: ProfileSettings },
      { path: "profile/:username",  Component: UserProfile },
      { path: "create",             Component: CreateProgress },
      { path: "tribes",             Component: Tribes },
      { path: "tribes/create",      Component: CreateCommunity },
      { path: "tribes/:id/edit",    Component: EditCommunity },
      { path: "tribes/:id/post",    Component: CreateCommunityPost },
      { path: "tribes/:id",         Component: TribeDetail },
      { path: "hashtag/:tag",       Component: HashtagFeed },
      { path: "post/:id",           Component: PostDetail },
      { path: "search",             Component: Search },
      { path: "fcoins",             Component: FcoinsPage },
      { path: "progression",        Component: ProgressionPage },
      { path: "notifications",      Component: NotificationsPage },
      { path: "ways/create",        Component: CreateWays },
      { path: "ways/:id/comments",  Component: WaysComments },
      { path: "ways/:id",           Component: WaysViewer },
      { path: "new-members",        Component: NewMembersPage },
      { path: "ai",                 Component: AI_ENABLED ? AIHomePage : AiDisabledPage },
      { path: "ai/profile",         Component: AI_ENABLED ? AIProfilePage : AiDisabledPage },
      { path: "ai/:conversationId", Component: AI_ENABLED ? AIConversationPage : AiDisabledPage },
      { path: "premium",            Component: PAYMENTS_ENABLED ? PremiumPage : PaymentsDisabledPage },
      { path: "premium/success",    Component: PremiumSuccessPage },
    ],
  },
]);
