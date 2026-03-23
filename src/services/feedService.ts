import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import type { Feed } from "../types/models";

const feedsCollection = collection(db, "feeds");

const mapFeed = (id: string, data: Record<string, unknown>): Feed => ({
  id,
  userId: data.userId as string,
  title: data.title as string,
  url: data.url as string,
  createdAt: data.createdAt && "toDate" in (data.createdAt as object)
    ? (data.createdAt as { toDate: () => Date }).toDate()
    : undefined,
});

export const feedService = {
  subscribeToUserFeeds(userId: string, callback: (feeds: Feed[]) => void): Unsubscribe {
    const q = query(
      feedsCollection,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    );

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map((docRef) => mapFeed(docRef.id, docRef.data())));
    });
  },

  async addFeed(userId: string, url: string, titleHint?: string) {
    const validateFeed = httpsCallable(functions, "validateAndFetchFeed");
    const syncFeedArticles = httpsCallable(functions, "syncFeedArticles");
    const result = await validateFeed({ url });
    const payload = result.data as { title?: string };

    const title = payload.title || titleHint || new URL(url).hostname;

    const feedRef = await addDoc(feedsCollection, {
      userId,
      title,
      url,
      createdAt: serverTimestamp(),
    });

    await syncFeedArticles({ feedId: feedRef.id });
    return feedRef;
  },

  async deleteFeed(feedId: string) {
    await deleteDoc(doc(db, "feeds", feedId));
  },
};
