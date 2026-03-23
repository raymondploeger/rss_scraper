import { DEFAULT_OPENAI_MODEL } from "./constants";

export function getEnv() {
  return {
    openAiApiKey: process.env.OPENAI_API_KEY || "",
    openAiModel: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    appBaseUrl: process.env.APP_BASE_URL || "",
  };
}

