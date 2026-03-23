import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Article } from "../types/models";

const articlesCollection = collection(db, "articles");

const mapArticle = (id: string, data: Record<string, unknown>): Article => ({
  id,
  feedId: data.feedId as string,
  title: data.title as string,
  description: data.description as string,
  link: data.link as string,
  pubDate: data.pubDate && "toDate" in (data.pubDate as object)
    ? (data.pubDate as { toDate: () => Date }).toDate()
    : undefined,
  imageUrl: data.imageUrl as string | undefined,
  read: Boolean(data.read),
  favorite: Boolean(data.favorite),
  createdAt: data.createdAt && "toDate" in (data.createdAt as object)
    ? (data.createdAt as { toDate: () => Date }).toDate()
    : undefined,
});

export const articleService = {
  subscribeToFeedArticles(feedId: string, callback: (articles: Article[]) => void): Unsubscribe {
    const q = query(
      articlesCollection,
      where("feedId", "==", feedId),
      orderBy("pubDate", "desc"),
    );

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map((docRef) => mapArticle(docRef.id, docRef.data())));
    });
  },

  async toggleRead(articleId: string, read: boolean) {
    await updateDoc(doc(db, "articles", articleId), { read });
  },

  async toggleFavorite(articleId: string, favorite: boolean) {
    await updateDoc(doc(db, "articles", articleId), { favorite });
  },
};
