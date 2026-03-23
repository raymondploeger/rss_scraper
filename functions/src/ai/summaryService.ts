import axios from "axios";
import { getEnv } from "../config/env";
import { ArticleRecord } from "../types";
import { inferKeywords, normalizeText } from "../utils/text";
import { logError } from "../utils/logger";

type SummaryResult = {
  summaryShort: string;
  summary: string;
  keywords: string[];
};

function fallbackSummary(article: ArticleRecord): SummaryResult {
  const basis = normalizeText(article.contentSnippet, article.title);
  const sourceLine = article.source ? ` The source is ${article.source}.` : "";
  return {
    summaryShort: `${article.title}.`.slice(0, 120),
    summary: `${basis || article.title}.${sourceLine}`.trim(),
    keywords: inferKeywords([article.title, article.contentSnippet, article.topic], 6),
  };
}

function parseAiJson(text: string): SummaryResult | null {
  try {
    const parsed = JSON.parse(text) as Partial<SummaryResult>;
    if (!parsed.summary || !parsed.summaryShort || !Array.isArray(parsed.keywords)) {
      return null;
    }

    return {
      summaryShort: normalizeText(parsed.summaryShort),
      summary: normalizeText(parsed.summary),
      keywords: parsed.keywords.map((item) => normalizeText(item)).filter(Boolean).slice(0, 8),
    };
  } catch {
    return null;
  }
}

export async function summarizeArticle(article: ArticleRecord): Promise<SummaryResult> {
  const fallback = fallbackSummary(article);
  const { openAiApiKey, openAiModel } = getEnv();
  if (!openAiApiKey) {
    return fallback;
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: openAiModel,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You summarize news articles conservatively. Return strict JSON with keys summaryShort, summary, keywords. summaryShort must be one sentence and under 30 words. summary must be 2 to 4 factual sentences. Do not invent details.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  title: article.title,
                  source: article.source,
                  topic: article.topic,
                  snippet: article.contentSnippet,
                  author: article.author,
                  pubDate: article.pubDate,
                }),
              },
            ],
          },
        ],
      },
      {
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const outputText = normalizeText(response.data?.output_text, "");
    return parseAiJson(outputText) || fallback;
  } catch (error) {
    logError("Summary generation failed", error);
    return fallback;
  }
}

