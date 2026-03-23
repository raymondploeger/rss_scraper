import { Search } from "lucide-react";
import { useFeed } from "../contexts/FeedContext";
import { ArticleCard } from "./ArticleCard";

export const ArticleList = () => {
  const { articles, search, setSearch, loadingArticles } = useFeed();

  return (
    <section className="flex-1 p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <Search size={16} className="text-slate-400" />
        <input
          type="search"
          placeholder="Search in articles"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />
      </div>

      {loadingArticles ? (
        <p className="text-sm text-slate-500">Loading articles...</p>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">No articles found</h3>
          <p className="mt-1 text-sm text-slate-500">Try adding a feed or changing your search.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </section>
  );
};
