import { AppHeader } from "../components/AppHeader";
import { ArticleList } from "../components/ArticleList";
import { FeedSidebar } from "../components/FeedSidebar";

export const DashboardPage = () => {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader />
      <div className="flex flex-col md:h-[calc(100vh-64px)] md:flex-row">
        <FeedSidebar />
        <ArticleList />
      </div>
    </main>
  );
};
