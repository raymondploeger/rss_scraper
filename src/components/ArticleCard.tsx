import { ExternalLink, Eye, EyeOff, Star } from "lucide-react";
import type { Article } from "../types/models";
import { useFeed } from "../contexts/FeedContext";

interface ArticleCardProps {
  article: Article;
}

export const ArticleCard = ({ article }: ArticleCardProps) => {
  const { toggleFavorite, toggleRead } = useFeed();

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex gap-4">
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt={article.title}
            className="h-24 w-24 rounded-md object-cover"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {article.title}
            </h3>
            <div className="flex gap-1">
              <button
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => void toggleRead(article.id, !article.read)}
                title={article.read ? "Mark unread" : "Mark read"}
              >
                {article.read ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                className={`rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  article.favorite ? "text-amber-500" : "text-slate-500"
                }`}
                onClick={() => void toggleFavorite(article.id, !article.favorite)}
                title={article.favorite ? "Remove favorite" : "Add favorite"}
              >
                <Star size={16} fill={article.favorite ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          <p className="mt-1 max-h-12 overflow-hidden text-sm text-slate-600 dark:text-slate-300">
            {article.description || "No description available."}
          </p>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {article.pubDate
                ? article.pubDate.toLocaleString()
                : "Publication date unavailable"}
            </span>
            <a
              href={article.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-600"
            >
              Open
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};
