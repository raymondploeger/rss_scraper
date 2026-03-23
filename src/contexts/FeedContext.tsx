import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Article, Feed } from "../types/models";
import { useAuth } from "./AuthContext";
import { feedService } from "../services/feedService";
import { articleService } from "../services/articleService";

interface FeedContextValue {
  feeds: Feed[];
  selectedFeedId: string | null;
  articles: Article[];
  search: string;
  loadingFeeds: boolean;
  loadingArticles: boolean;
  setSearch: (value: string) => void;
  setSelectedFeedId: (id: string | null) => void;
  addFeed: (url: string) => Promise<void>;
  removeFeed: (feedId: string) => Promise<void>;
  toggleRead: (articleId: string, read: boolean) => Promise<void>;
  toggleFavorite: (articleId: string, favorite: boolean) => Promise<void>;
}

const FeedContext = createContext<FeedContextValue | undefined>(undefined);

export const FeedProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState("");
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [loadingArticles, setLoadingArticles] = useState(false);

  useEffect(() => {
    if (!user) {
      setFeeds([]);
      setSelectedFeedId(null);
      setArticles([]);
      return;
    }

    setLoadingFeeds(true);
    const unsubscribe = feedService.subscribeToUserFeeds(user.uid, (nextFeeds) => {
      setFeeds(nextFeeds);
      setSelectedFeedId((current) => current ?? nextFeeds[0]?.id ?? null);
      setLoadingFeeds(false);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!selectedFeedId) {
      setArticles([]);
      return;
    }

    setLoadingArticles(true);
    const unsubscribe = articleService.subscribeToFeedArticles(
      selectedFeedId,
      (nextArticles) => {
        setArticles(nextArticles);
        setLoadingArticles(false);
      },
    );

    return unsubscribe;
  }, [selectedFeedId]);

  const addFeed = useCallback(
    async (url: string) => {
      if (!user) {
        throw new Error("You must be logged in to add a feed");
      }
      await feedService.addFeed(user.uid, url);
    },
    [user],
  );

  const removeFeed = useCallback(async (feedId: string) => {
    await feedService.deleteFeed(feedId);
    if (selectedFeedId === feedId) {
      setSelectedFeedId(null);
    }
  }, [selectedFeedId]);

  const filteredArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return articles;
    }

    return articles.filter((article) => {
      const title = article.title.toLowerCase();
      const description = article.description.toLowerCase();
      return title.includes(q) || description.includes(q);
    });
  }, [articles, search]);

  const value = useMemo(
    () => ({
      feeds,
      selectedFeedId,
      articles: filteredArticles,
      search,
      loadingFeeds,
      loadingArticles,
      setSearch,
      setSelectedFeedId,
      addFeed,
      removeFeed,
      toggleRead: articleService.toggleRead,
      toggleFavorite: articleService.toggleFavorite,
    }),
    [
      addFeed,
      feeds,
      filteredArticles,
      loadingArticles,
      loadingFeeds,
      removeFeed,
      search,
      selectedFeedId,
    ],
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
};

export const useFeed = () => {
  const context = useContext(FeedContext);
  if (!context) {
    throw new Error("useFeed must be used within FeedProvider");
  }
  return context;
};
