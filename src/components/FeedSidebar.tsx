import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useFeed } from "../contexts/FeedContext";

export const FeedSidebar = () => {
  const { feeds, selectedFeedId, setSelectedFeedId, addFeed, removeFeed, loadingFeeds } = useFeed();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedLabel = useMemo(
    () => feeds.find((feed) => feed.id === selectedFeedId)?.title || "Select feed",
    [feeds, selectedFeedId],
  );

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      new URL(url);
      setBusy(true);
      await addFeed(url);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid RSS URL");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="w-full shrink-0 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:w-80 md:border-b-0 md:border-r">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Feeds</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{selectedLabel}</p>
      </div>

      <form className="mb-3 space-y-2" onSubmit={onAdd}>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/rss"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-brand-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            required
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-3 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
            disabled={busy}
            aria-label="Add feed"
          >
            <Plus size={16} />
          </button>
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </form>

      <div className="space-y-2">
        {loadingFeeds ? (
          <p className="text-sm text-slate-500">Loading feeds...</p>
        ) : feeds.length === 0 ? (
          <p className="text-sm text-slate-500">No feeds yet. Add your first RSS URL.</p>
        ) : (
          feeds.map((feed) => (
            <div
              key={feed.id}
              className={`flex items-center justify-between rounded-lg border p-2 ${
                selectedFeedId === feed.id
                  ? "border-brand-600 bg-brand-50 dark:bg-slate-800"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <button
                className="min-w-0 flex-1 truncate text-left text-sm text-slate-700 dark:text-slate-100"
                onClick={() => setSelectedFeedId(feed.id)}
              >
                {feed.title}
              </button>
              <button
                className="ml-2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                onClick={() => void removeFeed(feed.id)}
                aria-label={`Delete ${feed.title}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
