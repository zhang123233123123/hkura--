# RuleLens BIM

轻量 IFC 合规评分原型。确定性规则负责判定与扣分，大语言模型只负责结果归纳和整改建议。

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
