import { createAnalysisProvider, type CheckIssue } from "../../../lib/llm";

export async function POST(request: Request) {
  const payload = (await request.json()) as { issues?: CheckIssue[] };
  const issues = payload.issues ?? [];
  if (!issues.length) return Response.json({ error: "issues is required" }, { status: 400 });
  return Response.json(await createAnalysisProvider().analyze(issues));
}
