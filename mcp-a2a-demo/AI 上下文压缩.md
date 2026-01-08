这是一个关于 **AI 上下文压缩 (Context Compression)** 的技术文档。我将其整理为标准的工程文档格式，您可以直接保存为 `DOCS_SLOT_COMPRESSION.md`，作为项目的核心架构文档之一。

---

# AI 上下文压缩与 Slot 管理指南

## 1. 背景与痛点

在构建 A2A (Agent-to-Agent) 或长文本对话系统时，随着交互轮数的增加，**Slot (记忆槽位)** 列表会无限增长。这带来了三个核心问题：

1.  **上下文窗口溢出 (Context Window Overflow)**: LLM 无法处理超过其最大 Token 限制（如 8k, 32k, 128k）的输入。
2.  **成本爆炸 (Cost Explosion)**: 每次请求都携带大量历史废话，导致 Token 费用呈线性甚至指数级增长。
3.  **注意力分散 (Lost in the Middle)**: 过长的上下文会干扰 LLM 的注意力，导致其忽略当前用户的核心指令（"幻觉"增加）。

**解决方案**：实施 **Slot 压缩算法**，将“短期记忆”转化为精简的“长期记忆”。

---

## 2. 压缩策略演进路线

我们在工程实践中通常遵循从简单到复杂的演进路线：V1 -> V2 -> V3。

### V1: 滑动窗口 (Sliding Window) —— 【保鲜】
最简单、性能最高的策略。假设只有最近的对话才有价值。

*   **原理**: 仅保留最近的 $N$ 条 Slot，旧的直接丢弃。
*   **算法**: `slots = slots.slice(-N)`
*   **优点**: 0 延迟，0 成本，代码极其简单。
*   **缺点**: “金鱼记忆”，早期的关键信息（如用户名字、初始需求）会被遗忘。
*   **适用场景**: 简单的闲聊机器人、即时指令执行。

### V2: 周期性摘要 (Periodic Summarization) —— 【存档】
引入 LLM 进行语义压缩。

*   **原理**: 当 Slot 数量超过阈值时，触发 LLM 将旧的 Slot 概括为一个 `SummarySlot`。
*   **算法**: `[Slot 1...10]` -> LLM -> `[SummarySlot]`。
*   **优点**: 保留了语义信息，解决了“金鱼记忆”问题。
*   **缺点**: 增加了 LLM 调用成本和延迟。
*   **适用场景**: 标准的 AI 助理、客服系统。

### V3: 混合向量聚类 (Hybrid Vector Clustering) —— 【旗舰版】
结合了规则、向量检索和生成式摘要的终极方案。

*   **原理**: 将数据分为 **热数据 (Hot)** 和 **冷数据 (Cold)**。
    *   **热数据**: 保持原样（最近 N 条），确保当前对话流畅。
    *   **冷数据**: 基于 Embedding 向量进行**聚类 (Clustering)**，将相似意图（如“5次询问天气”、“3次数据库报错”）合并，分别生成摘要。
*   **优点**: 极大降低 Token 占用，同时逻辑清晰，不会混淆不同的话题。
*   **适用场景**: 复杂 A2A 系统、运维排障 Agent、法律/医疗长文本分析。

---

## 3. V3 核心架构详解 (Hybrid Strategy)

这是我们 Demo (`src/compression-v3-demo.ts`) 中采用的架构。

### 3.1 流程图
```mermaid
graph TD
    A[原始 Slot 列表 (比如 50 条)] --> B{判断长度?};
    B -- < 阈值 --> C[直接返回];
    B -- > 阈值 --> D[切分数据];
    
    D --> E[热数据 (最近 3 条)];
    D --> F[冷数据 (旧的 47 条)];
    
    F --> G[向量化 & 聚类];
    G --> H[Topic A: 天气组];
    G --> I[Topic B: 数据库组];
    
    H --> J[LLM 生成摘要 A];
    I --> K[LLM 生成摘要 B];
    
    E --> L[合并结果];
    J --> L;
    K --> L;
    
    L --> M[输出: 2 条摘要 + 3 条热数据];
```

### 3.2 关键代码逻辑

```typescript
// 1. 切分冷热数据
const recentSlots = slots.slice(-windowSize); 
const historySlots = slots.slice(0, -windowSize);

// 2. 聚类 (Clustering)
// 真实场景使用 Cosine Similarity 计算
const clusters = vectorClustering(historySlots); 

// 3. 分组摘要
for (const group of clusters) {
    summarySlots.push(await llmSummarize(group));
}

// 4. 重组
return [...summarySlots, ...recentSlots];
```

---

## 4. 技术选型建议

| 维度 | V1 (滑动窗口) | V2 (简单摘要) | V3 (聚类+摘要) |
| :--- | :--- | :--- | :--- |
| **实现难度** | ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Token 消耗** | 低 | 中 | 中 (需 Embedding) |
| **记忆质量** | 差 (易遗忘) | 良 (线性压缩) | **优 (结构化记忆)** |
| **依赖技术** | Array.slice | LLM (Chat) | LLM + **Vector DB** |
| **推荐阶段** | POC / Demo | 上线初期 | **用户量 > 1k / 企业级** |

## 5. 真实环境落地指南

在生产环境 (`production`) 中实现 V3 方案时，请替换 Demo 中的模拟函数：

1.  **存储层**:
    *   使用 **Redis** 存储当前的 `raw_slots`。
    *   使用 **Pinecone / Milvus / PgVector** 存储历史 Slot 的 Embeddings。

2.  **计算层**:
    *   **Embeddings**: 使用 OpenAI `text-embedding-3-small` (便宜且快)。
    *   **Summarization**: 使用 `gpt-3.5-turbo` 或 `gpt-4o-mini` (性价比高)。

3.  **触发时机**:
    *   不要每次对话都压缩。
    *   **Lazy Mode**: 当总 Token 数 > 4000 时，才触发一次后台压缩任务。

---

*文档生成时间: 2023-10-XX*
*适用项目: A2A TypeScript Agent Architecture*