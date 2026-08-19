"use client";

import { useMemo, useRef, useState } from "react";

type Issue = {
  id: string;
  rule: "DOOR_WIDTH" | "FIRE_RATING";
  title: string;
  element: string;
  location: string;
  actual: string;
  required: string;
  penalty: number;
  x: number;
  y: number;
};

const sampleIssues: Issue[] = [
  { id: "D-104", rule: "DOOR_WIDTH", title: "疏散门净宽不足", element: "D-104  ·  IfcDoor", location: "L1 / 东侧走廊", actual: "780 mm", required: "≥ 900 mm", penalty: 12, x: 70, y: 41 },
  { id: "D-107", rule: "FIRE_RATING", title: "防火属性缺失", element: "D-107  ·  IfcDoor", location: "L1 / 前室", actual: "未填写", required: "FireRating ≥ 60 min", penalty: 8, x: 48, y: 67 },
  { id: "D-203", rule: "FIRE_RATING", title: "防火属性缺失", element: "D-203  ·  IfcDoor", location: "L2 / 楼梯间", actual: "未填写", required: "FireRating ≥ 60 min", penalty: 8, x: 27, y: 32 },
];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("HKU_Office_L2.ifc");
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [active, setActive] = useState<Issue | null>(null);
  const [filter, setFilter] = useState<"all" | "door" | "fire">("all");

  const issues = useMemo(() => sampleIssues.filter((item) => filter === "all" || (filter === "door" ? item.rule === "DOOR_WIDTH" : item.rule === "FIRE_RATING")), [filter]);

  function runCheck() {
    setChecking(true);
    setChecked(false);
    setActive(null);
    window.setTimeout(() => { setChecking(false); setChecked(true); }, 850);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#" aria-label="RuleLens 首页"><span className="mark">R</span><span>RuleLens <b>BIM</b></span></a>
        <div className="project"><span className="status-dot" /> {fileName}<span className="saved">本地分析 · 数据不上传</span></div>
        <a className="github" href="https://github.com/IfcOpenShell/IfcOpenShell" target="_blank" rel="noreferrer">开源技术栈 <span>↗</span></a>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">IFC QUALITY GATE / 01</p>
          <h1>让模型问题，在进入施工前被看见。</h1>
          <p className="lede">基于 <a href="https://ifcopenshell.org" target="_blank" rel="noreferrer">IfcOpenShell</a> 与 <a href="https://thatopen.com" target="_blank" rel="noreferrer">That Open Engine</a> 的轻量合规检查器。第一版聚焦疏散门净宽与防火属性。
          </p>
        </div>
        <div className="upload-card">
          <div className="file-icon">IFC</div>
          <div><strong>{fileName}</strong><span>IFC4 · 4.8 MB · 1,284 构件</span></div>
          <button className="replace" onClick={() => inputRef.current?.click()}>替换模型</button>
          <input ref={inputRef} hidden type="file" accept=".ifc,.json" onChange={(e) => e.target.files?.[0] && setFileName(e.target.files[0].name)} />
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
          <button className="run" onClick={runCheck} disabled={checking}>{checking ? <><span className="spinner" /> 正在遍历构件…</> : "运行检查  →"}</button>
        </aside>

        <div className="model-panel">
          <div className="canvas-tools"><button title="缩放">+</button><button title="缩放">−</button><button title="重置视图">⌖</button></div>
          <div className="view-label"><span>L1</span> 平面定位视图</div>
          <div className="floorplan" aria-label="建筑平面模型示意图">
            <div className="room room-a"><span>MEETING 01</span></div>
            <div className="room room-b"><span>OPEN OFFICE</span></div>
            <div className="room room-c"><span>CORE</span></div>
            <div className="room room-d"><span>MEETING 02</span></div>
            <div className="room room-e"><span>LOBBY</span></div>
            {checked && sampleIssues.map((issue) => <button key={issue.id} onClick={() => setActive(issue)} className={`pin ${active?.id === issue.id ? "selected" : ""}`} style={{ left: `${issue.x}%`, top: `${issue.y}%` }}><span>!</span><em>{issue.id}</em></button>)}
          </div>
          {!checked && !checking && <div className="canvas-empty"><span>◎</span><strong>模型已就绪</strong><p>选择规则后运行检查</p></div>}
          {checking && <div className="scanline"><span /></div>}
          <div className="legend"><span><i className="pass-dot" /> 通过 39</span><span><i className="fail-dot" /> 问题 3</span><span><i className="muted-dot" /> 未检查 1,242</span></div>
        </div>

        <aside className="results-panel">
          <div className="panel-head"><span>02</span><div><p>RESULTS</p><h2>检查结果</h2></div></div>
          {!checked ? <div className="empty-result"><div>✓</div><strong>等待检查</strong><p>结果将按构件定位并给出可执行建议。</p></div> : <>
            <div className="score-row"><div className="score"><strong>72</strong><span>/ 100<br />需整改</span></div><div className="score-meta"><p><b>39</b> 通过</p><p><b>3</b> 问题</p></div></div>
            <div className="filters"><button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>全部 3</button><button className={filter === "door" ? "on" : ""} onClick={() => setFilter("door")}>净宽 1</button><button className={filter === "fire" ? "on" : ""} onClick={() => setFilter("fire")}>属性 2</button></div>
            <div className="issue-list">{issues.map((issue) => <button key={issue.id} className={`issue ${active?.id === issue.id ? "current" : ""}`} onClick={() => setActive(issue)}><span className="severity">{issue.penalty}</span><div><strong>{issue.title}</strong><p>{issue.element}</p><small>{issue.location}</small></div><b>→</b></button>)}</div>
          </>}
        </aside>
      </section>

      {active && <div className="detail-bar"><button className="close" onClick={() => setActive(null)}>×</button><div><span>当前问题</span><strong>{active.id} · {active.title}</strong></div><dl><div><dt>实际值</dt><dd>{active.actual}</dd></div><div><dt>规则要求</dt><dd>{active.required}</dd></div><div><dt>扣分</dt><dd>−{active.penalty}</dd></div></dl><p><span>AI 建议</span>{active.rule === "DOOR_WIDTH" ? "建议将门洞净宽增加至 900 mm 以上，并复核开启后的实际通行宽度。" : "请向 Pset_DoorCommon.FireRating 写入有效防火时长，并与防火分区要求复核。"}</p></div>}

      <footer><span>PROTOTYPE 0.1</span><p>确定性规则负责判定，AI 只负责解释。</p><p>Powered by openBIM · IFC4</p></footer>
    </main>
  );
}
