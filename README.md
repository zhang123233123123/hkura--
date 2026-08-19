# RuleLens BIM

轻量 IFC 合规评分原型。确定性规则负责判定与扣分，大语言模型只负责结果归纳和整改建议。

## 功能

- 使用 That Open Components 在浏览器本地加载 IFC
- 3D 透视查看与 2D 正交平面切换
- 两条确定性合规规则与可解释评分
- DeepSeek 检查结果分析和多轮“问模型”对话
- 无网络或模型 API 异常时的本地兜底
- 内置 That Open 示例 IFC，打开页面即可自动加载完整流程

内置样本位于 `public/models/openbim-small.ifc`，来源于 That Open Components 公开教程资源，仅用于本原型演示与回归测试。
项目同时内置与当前 `web-ifc` 依赖版本一致的 WASM，模型解析不依赖外部 CDN。

## 处理链路

1. 浏览器本地使用 WebIFC 读取 IFC 实体、空间结构和属性关系。
2. 规则引擎检查 `IfcDoor.OverallWidth` 和 `Pset_DoorCommon.FireRating`。
3. 检查问题通过 GUID/local ID 映射回 Fragments 模型，用于高亮和相机定位。
4. 确定性结果发送给 DeepSeek 进行总结与对话，模型不能修改评分。

## IFC 快速回归

```bash
npm run smoke:ifc -- /path/to/model.ifc
```

该命令会验证 IFC 总实体数、门、楼层、属性关系和空间容器关系是否可正常读取。

## 本地启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3001` （以终端实际地址为准）。

## 接入模型

后端通过 OpenAI-compatible `POST /v1/chat/completions` 接口调用模型。在 `.env.local` 填写：

```env
LLM_BASE_URL=http://127.0.0.1:8000/v1
LLM_API_KEY=
LLM_MODEL=your-model-name
```

未配置模型或调用失败时，系统会使用本地确定性建议兜底，便于无网络演示。密钥不会发送到浏览器。

## 当前规则

- 疏散门净宽：`IfcDoor.OverallWidth >= 900 mm`
- 防火属性完整性：`Pset_DoorCommon.FireRating` 必填

> 阈值仅用于原型演示，不替代当地法规和专业审查。
