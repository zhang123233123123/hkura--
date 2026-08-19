import { buildLocalAnalysis } from "./local-provider";
import { buildAnalysisInput, SYSTEM_PROMPT } from "./prompt";
import type { AnalysisProvider, CheckIssue, ModelAnalysis } from "./types";

type Config = { baseUrl: string; apiKey?: string; model: string };

function parseAnalysis(text: string): ModelAnalysis {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const value = JSON.parse(cleaned) as Partial<ModelAnalysis>;
  if (!value.summary || !value.priority || !value.recommendations) throw new Error("模型输出字段不完整");
  return value as ModelAnalysis;
}

export class OpenAICompatibleProvider implements AnalysisProvider {
  constructor(private readonly config: Config) {}

  async analyze(issues: CheckIssue[]) {
    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildAnalysisInput(issues) },
          ],
        }),
      });
      if (!response.ok) throw new Error(`模型接口返回 ${response.status}: ${(await response.text()).slice(0, 160)}`);
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("模型未返回内容");
      return { analysis: parseAnalysis(content), mode: "llm" as const, model: this.config.model };
    } catch (error) {
      return {
        analysis: buildLocalAnalysis(issues),
        mode: "local-fallback" as const,
        warning: error instanceof Error ? error.message : "模型暂不可用",
      };
    }
  }
}
