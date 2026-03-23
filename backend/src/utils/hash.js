import crypto from "crypto";

export function createArticleHash(feedId, link) {
  return crypto.createHash("sha256").update(`${feedId}:${link}`).digest("hex");
}
