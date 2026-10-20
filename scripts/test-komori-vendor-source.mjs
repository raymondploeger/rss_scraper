import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveFeedProfileAffinities } from "../backend/src/services/feedProfileAffinityService.js";

const strategicFeedSource = fs.readFileSync(
  new URL("../backend/src/services/strategicFeedBootstrapService.js", import.meta.url),
  "utf8"
);
const komoriFeed = {
  name: "Komori America News",
  topic: "Commercial & Security Printing",
  rssUrl: "https://www.komori-america.us/komori-in-the-news/rss.xml",
  sourceType: "rss",
  sourceGroup: "Vendors",
  profileAffinities: ["vendors"],
};

assert.match(
  strategicFeedSource,
  /name: "Komori America News"[\s\S]*?rssUrl: "https:\/\/www\.komori-america\.us\/komori-in-the-news\/rss\.xml"[\s\S]*?sourceGroup: "Vendors"[\s\S]*?profileAffinities: \["vendors"\]/,
  "Komori must remain an official RSS source in the Vendors tracked-source group"
);
assert.deepEqual(
  resolveFeedProfileAffinities(komoriFeed),
  ["vendors"],
  "Komori must be scoped to the Vendors profile without inferring another profile"
);

process.stdout.write(JSON.stringify({
  status: "passed",
  source: komoriFeed.name,
  rssUrl: komoriFeed.rssUrl,
  sourceGroup: komoriFeed.sourceGroup,
  profileAffinities: komoriFeed.profileAffinities,
}, null, 2) + "\n");
