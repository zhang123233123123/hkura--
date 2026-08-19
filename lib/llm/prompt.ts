import type { CheckIssue } from "./types";

export const SYSTEM_PROMPT = `你是 BIM 合规审查助手。确定性规则已经完成判定。你只能解释结果、排列整改优先级和提出整改建议，不得改变 pass/fail、分数或构件数据，不得编造规范名称或条文。输出严格 JSON，不要 Markdown：{"summary":"不超过120字","priority":"不超过80字","recommendations":{"构件ID":"不超过80字"}}`;

export function buildAnalysisInput(issues: CheckIssue[]) {
  return JSON.stringify({
    score: 100 - issues.reduce((total, issue) => total + issue.penalty, 0),
    issues,
  });
}
