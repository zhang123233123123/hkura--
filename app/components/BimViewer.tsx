"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Issue, ParsedModel } from "../model-types";

export type ViewMode = "2d" | "3d";

export type BimViewerHandle = {
  setMode: (mode: ViewMode) => Promise<void>;
  reset: () => Promise<void>;
  focusIssue: (issue: Issue) => Promise<void>;
};

type ViewerRuntime = {
  components: { dispose: () => void };
  camera: {
    set: (mode: string) => void;
    projection: { set: (mode: "Orthographic" | "Perspective") => Promise<void> };
    controls: { setLookAt: (px: number, py: number, pz: number, tx: number, ty: number, tz: number, smooth?: boolean) => Promise<void>; addEventListener: (name: string, callback: () => void) => void };
    three: import("three").Camera;
    fit: (meshes?: Iterable<import("three").Mesh>, offset?: number) => Promise<void>;
  };
  scene: import("three").Scene;
  fragments: {
    core: { update: (force?: boolean) => void };
    highlight: (style: Record<string, unknown>, items?: Record<string, Set<number>>) => Promise<void>;
    resetHighlight: (items?: Record<string, Set<number>>) => Promise<void>;
    getBBoxes: (items: Record<string, Set<number>>) => Promise<import("three").Box3[]>;
  };
  loader: {
    load: (data: Uint8Array, coordinate: boolean, name: string, config?: unknown) => Promise<ViewerModel>;
    readIfcFile: (data: Uint8Array) => Promise<number>;
    webIfc: IfcApiLike;
  };
  schema: Record<string, number>;
  model?: ViewerModel;
};

type ViewerModel = {
  modelId: string;
  object: import("three").Object3D;
  useCamera: (camera: import("three").Camera) => void;
  getLocalIds: () => Promise<number[]>;
  getItemsOfCategories: (categories: RegExp[]) => Promise<Record<string, number[]>>;
  getItemsData: (ids: number[], config?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
  getGuidsByLocalIds: (ids: number[]) => Promise<(string | null)[]>;
  getLocalIdsByGuids: (guids: string[]) => Promise<(number | null)[]>;
};

type IfcVector = { size: () => number; get: (index: number) => number };
type IfcApiLike = {
  GetLineIDsWithType: (modelId: number, type: number, inherited?: boolean) => IfcVector;
  GetAllLines: (modelId: number) => IfcVector;
  GetLine: (modelId: number, expressId: number, recursive?: boolean) => Record<string, unknown>;
  CloseModel: (modelId: number) => void;
};

type Props = { file: File | null; mode: ViewMode; onStatus: (status: string) => void; onParsed: (model: ParsedModel) => void };

function unwrap(value: unknown): unknown {
  if (value && typeof value === "object" && "value" in value) return (value as { value: unknown }).value;
  return value;
}

function findValue(node: unknown, target: string): unknown {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) { const result = findValue(child, target); if (result !== undefined) return result; }
    return undefined;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key.toLowerCase() === target.toLowerCase()) return unwrap(value);
    const result = findValue(value, target); if (result !== undefined) return result;
  }
  return undefined;
}

function asNumber(value: unknown): number | null {
  const raw = unwrap(value);
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") { const number = Number.parseFloat(raw); return Number.isFinite(number) ? number : null; }
  return null;
}

function vectorValues(vector: IfcVector) {
  const values: number[] = [];
  for (let index = 0; index < vector.size(); index++) values.push(vector.get(index));
  return values;
}

function refId(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && typeof (value as { value?: unknown }).value === "number") return (value as { value: number }).value;
  if (value && typeof value === "object" && typeof (value as { expressID?: unknown }).expressID === "number") return (value as { expressID: number }).expressID;
  return null;
}

function relatedIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(refId).filter((id): id is number => id !== null);
}

function findPropertyValue(node: unknown, propertyName: string): unknown {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) { const result = findPropertyValue(child, propertyName); if (result !== undefined) return result; }
    return undefined;
  }
  const object = node as Record<string, unknown>;
  const name = unwrap(object.Name);
  if (String(name ?? "").toLowerCase() === propertyName.toLowerCase()) return unwrap(object.NominalValue ?? object.Value);
  for (const value of Object.values(object)) { const result = findPropertyValue(value, propertyName); if (result !== undefined) return result; }
  return undefined;
}

function parseIfcCompliance(api: IfcApiLike, rawModelId: number, schema: Record<string, number>): ParsedModel {
  const doorIds = vectorValues(api.GetLineIDsWithType(rawModelId, schema.IFCDOOR, true));
  const storeyIds = vectorValues(api.GetLineIDsWithType(rawModelId, schema.IFCBUILDINGSTOREY, true));
  const floors = storeyIds.map((id, index) => String(unwrap(api.GetLine(rawModelId, id, false).Name) ?? `Storey ${index + 1}`));
  const fireByDoor = new Map<number, unknown>();
  const locationByDoor = new Map<number, string>();
  for (const relationId of vectorValues(api.GetLineIDsWithType(rawModelId, schema.IFCRELDEFINESBYPROPERTIES, false))) {
    const relation = api.GetLine(rawModelId, relationId, true);
    const fireRating = findPropertyValue(relation.RelatingPropertyDefinition, "FireRating");
    if (fireRating !== undefined) for (const id of relatedIds(relation.RelatedObjects)) fireByDoor.set(id, fireRating);
  }
  for (const relationId of vectorValues(api.GetLineIDsWithType(rawModelId, schema.IFCRELCONTAINEDINSPATIALSTRUCTURE, false))) {
    const relation = api.GetLine(rawModelId, relationId, true);
    const location = String(findValue(relation.RelatingStructure, "Name") ?? "未分配楼层");
    for (const id of relatedIds(relation.RelatedElements)) locationByDoor.set(id, location);
  }
  const issues: Issue[] = [];
  let passedChecks = 0;
  doorIds.forEach((expressId) => {
    const data = api.GetLine(rawModelId, expressId, false);
    const guid = String(unwrap(data.GlobalId) ?? "") || undefined;
    const label = String(unwrap(data.Name) ?? `IfcDoor #${expressId}`);
    const widthRaw = asNumber(data.OverallWidth);
    const widthMm = widthRaw === null ? null : widthRaw < 20 ? widthRaw * 1000 : widthRaw;
    const fireRating = fireByDoor.get(expressId);
    const base = { element: `${label} · IfcDoor`, location: locationByDoor.get(expressId) ?? floors[0] ?? "未分配楼层", localId: expressId, guid, x: 50, y: 50 };
    if (widthMm === null || widthMm < 900) issues.push({ ...base, id: guid ?? `Door-${expressId}`, rule: "DOOR_WIDTH", title: widthMm === null ? "门宽属性缺失" : "疏散门净宽不足", actual: widthMm === null ? "未填写" : `${Math.round(widthMm)} mm`, required: "≥ 900 mm", penalty: 12 }); else passedChecks++;
    if (fireRating === undefined || fireRating === null || String(fireRating).trim() === "") issues.push({ ...base, id: `${guid ?? `Door-${expressId}`}-FR`, rule: "FIRE_RATING", title: "防火属性缺失", actual: "未填写", required: "FireRating 必填", penalty: 8 }); else passedChecks++;
  });
  return { issues, doorsChecked: doorIds.length, passedChecks, elementCount: api.GetAllLines(rawModelId).size(), floors };
}

export const BimViewer = forwardRef<BimViewerHandle, Props>(function BimViewer({ file, mode, onStatus, onParsed }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ViewerRuntime | null>(null);
  const [ready, setReady] = useState(false);

  async function applyMode(nextMode: ViewMode) {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (nextMode === "2d") {
      await runtime.camera.projection.set("Orthographic");
      runtime.camera.set("Plan");
      if (runtime.model) {
        const THREE = await import("three");
        const box = new THREE.Box3().setFromObject(runtime.model.object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        await runtime.camera.controls.setLookAt(center.x, center.y + Math.max(size.length(), 10), center.z, center.x, center.y, center.z, true);
      }
    } else {
      runtime.camera.set("Orbit");
      await runtime.camera.projection.set("Perspective");
      if (runtime.model) await runtime.camera.fit(undefined, 1.35);
    }
    runtime.model?.useCamera(runtime.camera.three);
    runtime.fragments.core.update(true);
  }

  useImperativeHandle(ref, () => ({
    setMode: applyMode,
    reset: async () => {
      const runtime = runtimeRef.current;
      if (runtime?.model) await runtime.camera.fit(undefined, 1.35);
    },
    focusIssue: async (issue) => {
      const runtime = runtimeRef.current;
      if (!runtime?.model || issue.localId === undefined || !issue.modelId) return;
      const items = { [issue.modelId]: new Set([issue.localId]) };
      await runtime.fragments.resetHighlight();
      const THREE = await import("three");
      await runtime.fragments.highlight({ color: new THREE.Color("#e5533d"), renderedFaces: 1, opacity: 1, transparent: false, preserveOriginalMaterial: true }, items);
      const boxes = await runtime.fragments.getBBoxes(items);
      const box = boxes[0];
      if (box && !box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const distance = Math.max(size.length() * 3, 4);
        await runtime.camera.controls.setLookAt(center.x + distance, center.y + distance, center.z + distance, center.x, center.y, center.z, true);
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!hostRef.current || runtimeRef.current) return;
      try {
        onStatus("正在初始化 openBIM 查看器…");
        const [OBC, THREE, worker, schema] = await Promise.all([
          import("@thatopen/components"),
          import("three"),
          import("@thatopen/fragments/worker?url"),
          import("web-ifc"),
        ]);
        if (cancelled || !hostRef.current) return;
        const components = new OBC.Components();
        const worlds = components.get(OBC.Worlds);
        const world = worlds.create() as unknown as {
          scene: InstanceType<(typeof OBC)["SimpleScene"]>;
          renderer: InstanceType<(typeof OBC)["SimpleRenderer"]>;
          camera: InstanceType<(typeof OBC)["OrthoPerspectiveCamera"]>;
        };
        world.scene = new OBC.SimpleScene(components);
        world.scene.setup({ backgroundColor: new THREE.Color("#e8e8df") });
        world.renderer = new OBC.SimpleRenderer(components, hostRef.current, { antialias: true, alpha: true });
        world.renderer.showLogo = true;
        world.camera = new OBC.OrthoPerspectiveCamera(components);
        components.init();
        components.get(OBC.Grids).create(world as never);

        const fragments = components.get(OBC.FragmentsManager);
        fragments.init(worker.default);
        world.camera.controls!.addEventListener("update", () => fragments.core.update());

        const loader = components.get(OBC.IfcLoader);
        await loader.setup({ autoSetWasm: true });
        runtimeRef.current = { components, camera: world.camera, scene: world.scene.three, fragments, loader, schema } as unknown as ViewerRuntime;
        setReady(true);
        onStatus("查看器已就绪，请上传 IFC 模型");
      } catch (error) {
        onStatus(`查看器初始化失败：${error instanceof Error ? error.message : "未知错误"}`);
      }
    }
    void initialize();
    return () => { cancelled = true; runtimeRef.current?.components.dispose(); runtimeRef.current = null; };
  }, [onStatus]);

  useEffect(() => { if (ready) void applyMode(mode); }, [mode, ready]);

  useEffect(() => {
    async function loadIfc() {
      const runtime = runtimeRef.current;
      if (!file || !runtime) return;
      try {
        onStatus(`正在解析 ${file.name}…`);
        if (runtime.model) runtime.scene.remove(runtime.model.object);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const rawModelId = await runtime.loader.readIfcFile(bytes);
        const parsed = parseIfcCompliance(runtime.loader.webIfc, rawModelId, runtime.schema);
        runtime.loader.webIfc.CloseModel(rawModelId);
        const model = await runtime.loader.load(bytes, true, file.name, { instanceCallback: (importer: { addAllAttributes: () => void; addAllRelations: () => void }) => { importer.addAllAttributes(); importer.addAllRelations(); } });
        runtime.model = model;
        runtime.scene.add(model.object);
        model.useCamera(runtime.camera.three);
        runtime.fragments.core.update(true);
        await runtime.camera.fit(undefined, 1.35);
        await applyMode(mode);
        onStatus(`${file.name} 已加载，正在执行门构件检查…`);
        const guids = [...new Set(parsed.issues.map((issue) => issue.guid).filter((guid): guid is string => Boolean(guid)))];
        const localIds = guids.length ? await model.getLocalIdsByGuids(guids) : [];
        const guidToLocal = new Map(guids.map((guid, index) => [guid, localIds[index]]));
        parsed.issues = parsed.issues.map((issue) => ({ ...issue, modelId: model.modelId, localId: issue.guid ? (guidToLocal.get(issue.guid) ?? issue.localId) ?? undefined : issue.localId }));
        onParsed(parsed);
        onStatus(`${file.name} · ${parsed.elementCount} 构件 · ${parsed.doorsChecked} 樘门已检查`);
      } catch (error) {
        onStatus(`IFC 加载失败：${error instanceof Error ? error.message : "未知错误"}`);
      }
    }
    void loadIfc();
  }, [file, ready, onParsed]);

  return <div ref={hostRef} className="bim-viewer-host" aria-label="IFC 2D/3D 模型查看器" />;
});
