import { defineAgent } from "eve";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});
const modelId = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
const apiMode = process.env.OPENAI_API_MODE ?? "responses";

if (apiMode !== "chat" && apiMode !== "responses") {
  throw new Error('OPENAI_API_MODE must be "chat" or "responses".');
}

export default defineAgent({
  build: {
    externalDependencies: ["@mongodb-js/zstd"],
  },
  model: apiMode === "chat" ? openai.chat(modelId) : openai.responses(modelId),
  modelContextWindowTokens: 128_000,
  ...(apiMode === "responses"
    ? {
        modelOptions: {
          providerOptions: {
            openai: {
              store: false,
            },
          },
        },
      }
    : {}),
});
