import { BrowserRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { AuthBootstrap, RequireAdmin, RequireAuth, RequireGuest } from '@/components/AuthGate';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Feed from '@/pages/Feed';
import Search from '@/pages/Search';
import Create from '@/pages/Create';
import Saved from '@/pages/Saved';
import Profile from '@/pages/Profile';
import ProfileEdit from '@/pages/ProfileEdit';
import RecipeDetail from '@/pages/RecipeDetail';
import RecipeEdit from '@/pages/RecipeEdit';
import Comments from '@/pages/Comments';
import Category from '@/pages/Category';
import UserProfile from '@/pages/UserProfile';
import Followers from '@/pages/Followers';
import Following from '@/pages/Following';
import Notifications from '@/pages/Notifications';
import AdminDashboard from '@/pages/AdminDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBootstrap>
          <Routes>
            <Route element={<RequireGuest />}>
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route index element={<Feed />} />
                <Route path="search" element={<Search />} />
                <Route path="create" element={<Create />} />
                <Route path="saved" element={<Saved />} />
                <Route path="profile" element={<Profile />} />
                <Route path="profile/edit" element={<ProfileEdit />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="recipe/:id" element={<RecipeDetail />} />
                <Route path="recipe/:id/edit" element={<RecipeEdit />} />
                <Route path="recipe/:id/comments" element={<Comments />} />
                <Route path="category/:slug" element={<Category />} />
                <Route path="user/:username" element={<UserProfile />} />
                <Route path="user/:username/followers" element={<Followers />} />
                <Route path="user/:username/following" element={<Following />} />

                <Route element={<RequireAdmin />}>
                  <Route path="admin" element={<AdminDashboard />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </AuthBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
