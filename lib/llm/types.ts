export type CheckIssue = {
  id: string;
  rule: string;
  title: string;
  location: string;
  actual: string;
  required: string;
  penalty: number;
};

export type ModelAnalysis = {
  summary: string;
  priority: string;
  recommendations: Record<string, string>;
};

export type AnalysisResult = {
  analysis: ModelAnalysis;
  mode: "llm" | "local-fallback";
  model?: string;
  warning?: string;
};

export interface AnalysisProvider {
  analyze(issues: CheckIssue[]): Promise<AnalysisResult>;
}
