import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Feed } from "./pages/Feed";
import { Profile } from "./pages/Profile";
import { CreateProgress } from "./pages/CreateProgress";
import { Tribes } from "./pages/Tribes";
import { TribeDetail } from "./pages/TribeDetail";
import { CreateCommunity } from "./pages/CreateCommunity";
import { EditCommunity } from "./pages/EditCommunity";
import { CreateCommunityPost } from "./pages/CreateCommunityPost";
import { UserProfile } from "./pages/UserProfile";
import { HashtagFeed } from "./pages/HashtagFeed";
import { PostDetail } from "./pages/PostDetail";
import { Search } from "./pages/Search";
import { FcoinsPage } from "./pages/FcoinsPage";
import { ProgressionPage } from "./pages/ProgressionPage";
import { EditProfilePage } from "./pages/EditProfilePage";
import { ProfileSettings } from "./pages/ProfileSettings";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { AdminProtected } from "./pages/AdminProtected";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { FirstPostPage } from "./pages/FirstPostPage";
import { NotificationsPage } from "./pages/NotificationsPage";

export const router = createBrowserRouter([
  // ── Auth pages (hors Layout, hors guard) ─────────────────────────────────
  { path: "/login",         Component: LoginPage },
  { path: "/signup",        Component: SignupPage },
  { path: "/onboarding",    Component: OnboardingPage },
  { path: "/verify-email",  Component: VerifyEmailPage },
  { path: "/auth/callback", Component: AuthCallbackPage },
  { path: "/first-post",    Component: FirstPostPage },

  // ── Admin (accès restreint — UUID admin uniquement) ───────────────────────
  { path: "/admin",         Component: AdminProtected },

  // ── App pages (sous Layout + guard auth) ──────────────────────────────────
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true,                Component: Feed },
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
    ],
  },
]);