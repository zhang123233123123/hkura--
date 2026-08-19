import { chatWithModel, type ChatMessage, type ModelContext } from "../../../lib/llm/model-chat";

export async function POST(request: Request) {
  const payload = (await request.json()) as { messages?: ChatMessage[]; context?: ModelContext };
  if (!payload.messages?.length || !payload.context) return Response.json({ error: "messages and context are required" }, { status: 400 });
  return Response.json(await chatWithModel(payload.messages, payload.context));
}
