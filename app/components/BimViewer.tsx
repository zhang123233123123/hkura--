"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type ViewMode = "2d" | "3d";

export type BimViewerHandle = {
  setMode: (mode: ViewMode) => Promise<void>;
  reset: () => Promise<void>;
};

type ViewerRuntime = {
  components: { dispose: () => void };
  camera: {
    set: (mode: string) => void;
    projection: { set: (mode: "Orthographic" | "Perspective") => Promise<void> };
    controls: { setLookAt: (...values: number[]) => Promise<void>; addEventListener: (name: string, callback: () => void) => void };
    three: import("three").Camera;
    fit: (meshes?: Iterable<import("three").Mesh>, offset?: number) => Promise<void>;
  };
  scene: import("three").Scene;
  fragments: { core: { update: (force?: boolean) => void } };
  loader: { load: (data: Uint8Array, coordinate: boolean, name: string) => Promise<{ object: import("three").Object3D; useCamera: (camera: import("three").Camera) => void }> };
  model?: { object: import("three").Object3D; useCamera: (camera: import("three").Camera) => void };
};

type Props = { file: File | null; mode: ViewMode; onStatus: (status: string) => void };

export const BimViewer = forwardRef<BimViewerHandle, Props>(function BimViewer({ file, mode, onStatus }, ref) {
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
    runtime.fragments.core.update(true);
  }

  useImperativeHandle(ref, () => ({
    setMode: applyMode,
    reset: async () => {
      const runtime = runtimeRef.current;
      if (runtime?.model) await runtime.camera.fit(undefined, 1.35);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!hostRef.current || runtimeRef.current) return;
      try {
        onStatus("正在初始化 openBIM 查看器…");
        const [OBC, THREE, worker] = await Promise.all([
          import("@thatopen/components"),
          import("three"),
          import("@thatopen/fragments/worker?url"),
        ]);
        if (cancelled || !hostRef.current) return;
        const components = new OBC.Components();
        const worlds = components.get(OBC.Worlds);
        const world = worlds.create();
        world.scene = new OBC.SimpleScene(components);
        world.scene.setup({ backgroundColor: new THREE.Color("#e8e8df") });
        world.renderer = new OBC.SimpleRenderer(components, hostRef.current, { antialias: true, alpha: true });
        world.renderer.showLogo = true;
        world.camera = new OBC.OrthoPerspectiveCamera(components);
        components.init();
        components.get(OBC.Grids).create(world);

        const fragments = components.get(OBC.FragmentsManager);
        fragments.init(worker.default);
        world.camera.controls.addEventListener("update", () => fragments.core.update());

        const loader = components.get(OBC.IfcLoader);
        await loader.setup({ autoSetWasm: true });
        runtimeRef.current = { components, camera: world.camera, scene: world.scene.three, fragments, loader } as ViewerRuntime;
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
        const model = await runtime.loader.load(bytes, true, file.name);
        runtime.model = model;
        runtime.scene.add(model.object);
        model.useCamera(runtime.camera.three);
        runtime.fragments.core.update(true);
        await runtime.camera.fit(undefined, 1.35);
        await applyMode(mode);
        onStatus(`${file.name} 已加载`);
      } catch (error) {
        onStatus(`IFC 加载失败：${error instanceof Error ? error.message : "未知错误"}`);
      }
    }
    void loadIfc();
  }, [file, ready]);

  return <div ref={hostRef} className="bim-viewer-host" aria-label="IFC 2D/3D 模型查看器" />;
});
