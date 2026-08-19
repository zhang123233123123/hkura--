import type { AnalysisProvider, CheckIssue, ModelAnalysis } from "./types";

export function buildLocalAnalysis(issues: CheckIssue[]): ModelAnalysis {
  const loss = issues.reduce((total, issue) => total + issue.penalty, 0);
  return {
    summary: `本次检查发现 ${issues.length} 项问题，共扣 ${loss} 分。问题集中在疏散门净宽与防火属性完整性，建议先处理影响人员通行的几何问题，再补齐模型属性。`,
    priority: "优先整改疏散净宽问题；随后由建筑与消防专业共同确认防火门的耐火等级。",
    recommendations: Object.fromEntries(issues.map((issue) => [
      issue.id,
      issue.rule === "DOOR_WIDTH"
        ? "将门洞净宽调整至不小于 900 mm，并复核门扇开启后的有效通行宽度。"
        : "在 Pset_DoorCommon.FireRating 中填写经设计确认的耐火时长，并与防火分区要求交叉复核。",
    ])),
  };
}

export class LocalAnalysisProvider implements AnalysisProvider {
  async analyze(issues: CheckIssue[]) {
    return { analysis: buildLocalAnalysis(issues), mode: "local-fallback" as const };
  }
}
