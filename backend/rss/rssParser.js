import Parser from "rss-parser";
import { env } from "../server/config.js";

const parser = new Parser({
  timeout: env.requestTimeoutMs,
  headers: {
    "User-Agent": "RSS Monitoring Dashboard/1.0"
  },
  customFields: {
    item: [["source", "source"]]
  }
});

export async function parseFeedXml(rssUrl) {
  return parser.parseURL(rssUrl);
}
