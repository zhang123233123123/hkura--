"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BimViewer, type BimViewerHandle, type ViewMode } from "./components/BimViewer";
import { ModelChat } from "./components/ModelChat";
import type { Issue, ParsedModel } from "./model-types";

type AIAnalysis = {
  summary: string;
  priority: string;
  recommendations: Record<string, string>;
};

const sampleIssues: Issue[] = [
  { id: "D-104", rule: "DOOR_WIDTH", title: "疏散门净宽不足", element: "D-104  ·  IfcDoor", location: "L1 / 东侧走廊", actual: "780 mm", required: "≥ 900 mm", penalty: 12, x: 70, y: 41 },
  { id: "D-107", rule: "FIRE_RATING", title: "防火属性缺失", element: "D-107  ·  IfcDoor", location: "L1 / 前室", actual: "未填写", required: "FireRating ≥ 60 min", penalty: 8, x: 48, y: 67 },
  { id: "D-203", rule: "FIRE_RATING", title: "防火属性缺失", element: "D-203  ·  IfcDoor", location: "L2 / 楼梯间", actual: "未填写", required: "FireRating ≥ 60 min", penalty: 8, x: 27, y: 32 },
];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<BimViewerHandle>(null);
  const [fileName, setFileName] = useState("OpenBIM Sample · openbim-small.ifc");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [modelStatus, setModelStatus] = useState("查看器正在准备…");
  const [chatOpen, setChatOpen] = useState(false);
  const [parsedModel, setParsedModel] = useState<ParsedModel | null>(null);
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [active, setActive] = useState<Issue | null>(null);
  const [filter, setFilter] = useState<"all" | "door" | "fire">("all");
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [aiMode, setAiMode] = useState<string>("");

  const effectiveIssues = parsedModel?.issues ?? sampleIssues;
  const issues = useMemo(() => effectiveIssues.filter((item) => filter === "all" || (filter === "door" ? item.rule === "DOOR_WIDTH" : item.rule === "FIRE_RATING")), [filter, effectiveIssues]);
  const passedCount = parsedModel?.passedChecks ?? 39;
  const elementCount = parsedModel?.elementCount ?? 1284;
  const score = Math.max(0, 100 - effectiveIssues.reduce((total, issue) => total + issue.penalty, 0));

  useEffect(() => {
    let cancelled = false;
    async function loadBundledModel() {
      try {
        const response = await fetch("/models/openbim-small.ifc");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (!cancelled) setModelFile(new File([blob], "openbim-small.ifc", { type: "application/x-step" }));
      } catch {
        if (!cancelled) setModelStatus("内置 IFC 加载失败，请手动上传模型");
      }
    }
    void loadBundledModel();
    return () => { cancelled = true; };
  }, []);

  function selectIssue(issue: Issue) {
    setActive(issue);
    void viewerRef.current?.focusIssue(issue);
  }

  async function runCheck() {
    setChecking(true);
    setChecked(false);
    setActive(null);
    setAnalysis(null);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    setChecked(true);
    try {
      if (!effectiveIssues.length) {
        setAnalysis({ summary: "当前两条规则未发现异常。", priority: "建议继续扩展其他规则并进行专业复核。", recommendations: {} });
        setAiMode("local-fallback");
        return;
      }
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issues: effectiveIssues }),
      });
      const data = await response.json() as { analysis?: AIAnalysis; mode?: string };
      if (data.analysis) setAnalysis(data.analysis);
      setAiMode(data.mode ?? "");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main>
      <section className="intro">
        <div>
          <p className="eyebrow">IFC QUALITY GATE / 01</p>
          <h1>让模型问题，在进入施工前被看见。</h1>
          <p className="lede">基于 <a href="https://ifcopenshell.org" target="_blank" rel="noreferrer">IfcOpenShell</a> 与 <a href="https://thatopen.com" target="_blank" rel="noreferrer">That Open Engine</a> 的轻量合规检查器。第一版聚焦疏散门净宽与防火属性。
          </p>
        </div>
        <div className="upload-card">
          <div className="file-icon">IFC</div>
          <div><strong>{fileName}</strong><span>{modelFile ? `${(modelFile.size / 1024 / 1024).toFixed(1)} MB · 真实 IFC · 本地解析` : "正在读取内置 IFC…"}</span></div>
          <button className="replace" onClick={() => inputRef.current?.click()}>替换模型</button>
          <input ref={inputRef} hidden type="file" accept=".ifc" onChange={(e) => { const next = e.target.files?.[0]; if (next) { setFileName(next.name); setParsedModel(null); setChecked(false); setAnalysis(null); setModelFile(next); } }} />
        </div>
      </section>

      <section className="workspace">
        <aside className="rules-panel">
          <div className="panel-head"><span>01</span><div><p>CHECKSET</p><h2>检查规则</h2></div></div>
          <div className="rule active-rule">
            <div className="rule-index">R1</div><div><strong>疏散门净宽</strong><p>IfcDoor.OverallWidth ≥ 900 mm</p></div><span className="toggle" />
          </div>
          <div className="rule">
            <div className="rule-index">R2</div><div><strong>防火属性完整性</strong><p>Pset_DoorCommon.FireRating 必填</p></div><span className="toggle" />
          </div>
          <div className="standard-note"><span>i</span><p><strong>规则边界</strong><br />当前阈值用于原型演示，不代替正式法规审查。</p></div>
          <button className="run" onClick={runCheck} disabled={checking || Boolean(modelFile && !parsedModel)}>{checking ? <><span className="spinner" /> 正在遍历构件…</> : modelFile && !parsedModel ? "正在解析 IFC…" : "运行检查  →"}</button>
        </aside>

        <div className="model-panel">
          <div className="viewer-switch"><button className={viewMode === "3d" ? "on" : ""} onClick={() => setViewMode("3d")}>3D 模型</button><button className={viewMode === "2d" ? "on" : ""} onClick={() => setViewMode("2d")}>2D 平面</button><select aria-label="选择楼层" disabled={!parsedModel?.floors.length}>{(parsedModel?.floors.length ? parsedModel.floors : ["L1"]).map((floor) => <option key={floor}>{floor}</option>)}</select></div>
          <div className="canvas-tools">
            <button title="放大" aria-label="放大模型" onClick={() => void viewerRef.current?.zoomIn()}>+</button>
            <button title="缩小" aria-label="缩小模型" onClick={() => void viewerRef.current?.zoomOut()}>−</button>
            <button title="重置视图" aria-label="重置模型视图" onClick={() => void viewerRef.current?.reset()}>⌖</button>
          </div>
          <div className="view-label"><span>{viewMode.toUpperCase()}</span> {viewMode === "3d" ? "透视模型视图" : "正交楼层视图"}</div>
          <BimViewer ref={viewerRef} file={modelFile} mode={viewMode} onStatus={setModelStatus} onParsed={setParsedModel} />
          {!modelFile && <div className="demo-building" aria-label="演示建筑模型"><div className="demo-core" /><div className="demo-slab slab-1" /><div className="demo-slab slab-2" /><div className="demo-slab slab-3" /><div className="demo-slab slab-4" /></div>}
          {!modelFile && !checking && <button className="canvas-empty upload-empty" onClick={() => inputRef.current?.click()}><span>◎</span><strong>上传 IFC 查看真实模型</strong><p>当前展示为交互演示模型</p></button>}
          {checked && viewMode === "2d" && !modelFile && effectiveIssues.map((issue) => <button key={issue.id} onClick={() => selectIssue(issue)} className={`pin viewer-pin ${active?.id === issue.id ? "selected" : ""}`} style={{ left: `${issue.x}%`, top: `${issue.y}%` }}><span>!</span><em>{issue.id}</em></button>)}
          {checking && <div className="scanline"><span /></div>}
          <div className="viewer-status"><i className={modelStatus.includes("失败") ? "error" : ""} />{modelStatus}</div>
          <div className="legend"><span><i className="pass-dot" /> 通过 {passedCount}</span><span><i className="fail-dot" /> 问题 {effectiveIssues.length}</span><span><i className="muted-dot" /> 构件 {elementCount}</span></div>
        </div>

        <aside className="results-panel">
          <div className="panel-head"><span>02</span><div><p>RESULTS</p><h2>检查结果</h2></div></div>
          {!checked ? <div className="empty-result"><div>✓</div><strong>等待检查</strong><p>结果将按构件定位并给出可执行建议。</p></div> : <>
            <div className="score-row"><div className="score"><strong>{score}</strong><span>/ 100<br />{effectiveIssues.length ? "需整改" : "当前通过"}</span></div><div className="score-meta"><p><b>{passedCount}</b> 通过</p><p><b>{effectiveIssues.length}</b> 问题</p></div></div>
            <div className="ai-brief"><div><span>AI REVIEW</span><em>{analysis ? (aiMode === "llm" ? "模型已完成" : "本地兜底") : "分析中"}</em></div><p>{analysis?.summary ?? "正在将结构化检查结果发送至分析层…"}</p>{analysis && <small>{analysis.priority}</small>}</div>
            <div className="filters"><button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>全部 {effectiveIssues.length}</button><button className={filter === "door" ? "on" : ""} onClick={() => setFilter("door")}>净宽 {effectiveIssues.filter((i) => i.rule === "DOOR_WIDTH").length}</button><button className={filter === "fire" ? "on" : ""} onClick={() => setFilter("fire")}>属性 {effectiveIssues.filter((i) => i.rule === "FIRE_RATING").length}</button></div>
            <div className="issue-list">{issues.map((issue) => <button key={issue.id} className={`issue ${active?.id === issue.id ? "current" : ""}`} onClick={() => selectIssue(issue)}><span className="severity">{issue.penalty}</span><div><strong>{issue.title}</strong><p>{issue.element}</p><small>{issue.location}</small></div><b>→</b></button>)}</div>
          </>}
        </aside>
      </section>

      {active && <div className="detail-bar"><button className="close" onClick={() => setActive(null)}>×</button><div><span>当前问题</span><strong>{active.id} · {active.title}</strong></div><dl><div><dt>实际值</dt><dd>{active.actual}</dd></div><div><dt>规则要求</dt><dd>{active.required}</dd></div><div><dt>扣分</dt><dd>−{active.penalty}</dd></div></dl><p><span>AI 建议</span>{analysis?.recommendations[active.id] ?? "正在生成针对该构件的整改建议…"}</p></div>}

      <button className="chat-fab" onClick={() => setChatOpen(true)} aria-label="打开模型对话"><span>✶</span><b>问模型</b></button>
      <ModelChat open={chatOpen} onClose={() => setChatOpen(false)} fileName={fileName} checked={checked} issues={effectiveIssues} score={score} modelStatus={modelStatus} />
      {chatOpen && <button className="chat-backdrop" onClick={() => setChatOpen(false)} aria-label="关闭对话遮罩" />}

      <footer><span>PROTOTYPE 0.1</span><p>确定性规则负责判定，AI 只负责解释。</p><p>Powered by openBIM · IFC4</p></footer>
    </main>
  );
}
