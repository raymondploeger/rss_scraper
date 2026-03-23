import { addFeed, getAllFeeds, getFeedById } from "../database/feedRepository.js";
import { syncFeed } from "./rssSync.js";

export async function getFeeds(request, response) {
  const feeds = await getAllFeeds();
  response.json(feeds);
}

export async function createFeed(request, response) {
  const { name, topic, rssUrl } = request.body;

  if (!name || !topic || !rssUrl) {
    return response.status(400).json({ error: "name, topic and rssUrl are required" });
  }

  const feed = await addFeed({ name, topic, rssUrl, isActive: true });
  response.status(201).json(feed);
}

export async function refreshFeed(request, response) {
  const feed = await getFeedById(request.params.feedId);

  if (!feed) {
    return response.status(404).json({ error: "Feed not found" });
  }

  await syncFeed(feed);
  response.json({ ok: true });
}
