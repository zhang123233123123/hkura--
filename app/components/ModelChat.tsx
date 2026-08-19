"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Issue } from "../model-types";

type Message = { role: "user" | "assistant"; content: string };
type Props = { open: boolean; onClose: () => void; fileName: string; checked: boolean; issues: Issue[]; score: number; modelStatus: string };

const suggestions = ["哪些问题最优先？", "门宽检查结果是什么？", "总结防火属性问题"];

export function ModelChat({ open, onClose, fileName, checked, issues, score, modelStatus }: Props) {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "你好，我可以根据当前模型的结构化检查结果回答问题。" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const next: Message[] = [...messages, { role: "user", content: question }];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context: { fileName, score: checked ? score : undefined, issues: checked ? issues : [], modelStatus } }),
      });
      const data = await response.json() as { reply?: string };
      setMessages((current) => [...current, { role: "assistant", content: data.reply ?? "暂时无法回答。" }]);
    } catch { setMessages((current) => [...current, { role: "assistant", content: "对话服务暂时不可用，请稍后再试。" }]); }
    finally { setLoading(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(input); }
  return <aside className={`chat-drawer ${open ? "chat-open" : ""}`} aria-hidden={!open}>
    <div className="chat-head"><div><span>MODEL COPILOT</span><strong>问模型</strong></div><button onClick={onClose} aria-label="关闭对话">×</button></div>
    <div className="chat-context"><i /> <span>{fileName}</span><em>{checked ? "已读取检查上下文" : "尚未运行检查"}</em></div>
    <div className="chat-messages">{messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}><span>{message.role === "assistant" ? "AI" : "YOU"}</span><p>{message.content}</p></div>)}{loading && <div className="chat-message assistant"><span>AI</span><p className="typing">正在查询模型上下文…</p></div>}<div ref={endRef} /></div>
    <div className="chat-suggestions">{suggestions.map((item) => <button key={item} onClick={() => void ask(item)}>{item}</button>)}</div>
    <form className="chat-input" onSubmit={submit}><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="询问构件、得分或整改建议…" /><button disabled={loading || !input.trim()}>↑</button></form>
    <p className="chat-disclaimer">AI 回答仅基于已解析数据，不代替专业审查。</p>
  </aside>;
}
