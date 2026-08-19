import { LocalAnalysisProvider } from "./local-provider";
import { OpenAICompatibleProvider } from "./openai-compatible-provider";
import type { AnalysisProvider } from "./types";

export function createAnalysisProvider(): AnalysisProvider {
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!baseUrl || !model) return new LocalAnalysisProvider();
  return new OpenAICompatibleProvider({ baseUrl, model, apiKey: process.env.LLM_API_KEY });
}

export type { CheckIssue, ModelAnalysis } from "./types";
