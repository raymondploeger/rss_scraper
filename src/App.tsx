import { useAuth } from "./contexts/AuthContext";
import { FeedProvider } from "./contexts/FeedContext";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";

const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500 dark:bg-slate-950">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <FeedProvider>
      <DashboardPage />
    </FeedProvider>
  );
};

export default App;
