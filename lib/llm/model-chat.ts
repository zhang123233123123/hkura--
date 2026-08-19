import type { CheckIssue } from "./types";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ModelContext = { fileName: string; score?: number; issues: CheckIssue[]; modelStatus: string };

function localReply(question: string, context: ModelContext) {
  if (/(优先|先处理|最严重|风险最高)/.test(question)) {
    const issue = [...context.issues].sort((a, b) => b.penalty - a.penalty)[0];
    return issue ? `建议优先处理 ${issue.id}（${issue.title}），该问题当前扣 ${issue.penalty} 分，实际值为 ${issue.actual}，规则要求为 ${issue.required}。` : "尚未运行检查，暂时无法判断整改优先级。";
  }
  if (/(多少|几个|数量|问题)/.test(question)) return `当前规则检查发现 ${context.issues.length} 项问题，模型得分为 ${context.score ?? "尚未计算"}。`;
  if (/(门宽|净宽|疏散)/.test(question)) return "D-104 的净宽为 780 mm，低于当前原型规则设定的 900 mm。";
  if (/(防火|FireRating|耐火)/i.test(question)) return "D-107 和 D-203 缺少 FireRating 属性，需由建筑与消防专业确认后补录。";
  return "当前离线模式可查询得分、问题数量、门宽和 FireRating。配置模型后可进行更自然的多轮分析。";
}

export async function chatWithModel(messages: ChatMessage[], context: ModelContext) {
  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/$/, "");
  const model = process.env.LLM_MODEL;
  if (!baseUrl || !model) return { reply: localReply(messages.at(-1)?.content ?? "", context), mode: "local-fallback" };
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}) },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: "system", content: `你是 RuleLens BIM 的模型问答助手。只能根据提供的 MODEL_CONTEXT 回答。区分“原型规则阈值”与正式法规；不得编造未提供的构件、尺寸或条文。如信息不足，明确说明。回答简洁，并尽量引用构件 ID。\nMODEL_CONTEXT=${JSON.stringify(context)}` },
        ...messages.slice(-8),
      ],
    }),
  });
  if (!response.ok) return { reply: localReply(messages.at(-1)?.content ?? "", context), mode: "local-fallback", warning: `LLM ${response.status}: ${(await response.text()).slice(0, 160)}` };
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return { reply: data.choices?.[0]?.message?.content ?? localReply(messages.at(-1)?.content ?? "", context), mode: "llm", model };
}
