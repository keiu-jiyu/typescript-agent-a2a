---
# 全栈 AI Agent 系统开发实战手册 (Node.js + TypeScript)

本文档提供了一套完整的、可落地的 **A2A (Agent-to-Agent)** 系统构建指南。系统包含轻量级 Web 前端、外网网关 Agent 和内网专家 Agent，全链路采用 **TypeScript** 开发，并针对 **Azure Container Apps** 进行了企业级部署优化。

---

## 1. 系统架构蓝图

我们采用 **"BFF (Backend for Frontend) + 微服务"** 模式。

```mermaid
graph TD
    User((用户浏览器)) -->|HTTP/HTML| Gateway[Agent A: 网关 & Web Server]
    
    subgraph "Azure Cloud (VNET)"
        direction TB
        
        %% 外网区
        Gateway
        
        %% 内网隔离区
        subgraph "Internal Zone (内网)"
            AgentB[Agent B: 专家服务]
        end
        
        %% 通信流
        Gateway -->|1. 托管静态页面| User
        Gateway -->|2. A2A 调用 (REST)| AgentB
        
        %% AI 能力
        AgentB -->|3. 推理/计算| LLM[LLM 模型]
    end
    
    style Gateway fill:#e1f5fe,stroke:#01579b
    style AgentB fill:#fff9c4,stroke:#fbc02d
```

*   **前端 (HTML/JS)**: 极简聊天界面，直接由 Agent A 托管。
*   **Agent A (Gateway)**: 负责路由分发、鉴权、托管静态资源。
*   **Agent B (Worker)**: 负责重度逻辑、LLM 调用，位于内网安全区。

---

## 2. 项目目录结构

```text
mcp-a2a-demo/
├── public/             # [新增] 前端静态资源
│   └── index.html
├── src/
│   ├── agent-a.ts      # 外网网关 (修改后)
│   ├── agent-b.ts      # 内网专家
│   └── types.ts        # 共享协议 (Slot)
├── .env                # 环境变量
├── Dockerfile.agent-a  # Agent A 构建文件
├── Dockerfile.agent-b  # Agent B 构建文件
├── package.json
└── tsconfig.json
```

---

## 3. 核心代码实现

### 3.1 共享协议 (`src/types.ts`)
```typescript
export interface Slot {
    id: string;
    role: 'user' | 'agent' | 'system';
    content: string;
    meta: Record<string, any>;
}

export interface AgentPayload {
    traceId: string;
    slot: Slot;
}
```

### 3.2 前端界面 (`public/index.html`)
一个不需要 React/Vue 的原生极简聊天室。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>Agent A2A Demo</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: 20px auto; background: #f5f5f5; }
        .chat { background: #fff; height: 500px; overflow-y: scroll; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .msg { padding: 10px; margin: 10px 0; border-radius: 5px; max-width: 80%; }
        .user { background: #0078d4; color: #fff; margin-left: auto; }
        .agent { background: #e0e0e0; color: #333; margin-right: auto; }
        .meta { font-size: 0.8em; color: #666; margin-top: 5px; }
        .controls { margin-top: 20px; display: flex; gap: 10px; }
        input { flex: 1; padding: 10px; }
    </style>
</head>
<body>
    <div class="chat" id="box"></div>
    <div class="controls">
        <input type="text" id="inp" placeholder="问 '你好' 或 '数据库坏了'..." onkeydown="if(event.key==='Enter') send()">
        <button onclick="send()">发送</button>
    </div>
    <script>
        async function send() {
            const inp = document.getElementById('inp');
            const msg = inp.value;
            if(!msg) return;
            
            append('user', msg);
            inp.value = '';

            try {
                const res = await fetch('/chat', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ message: msg })
                });
                const data = await res.json();
                const meta = data.debug_meta ? `[处理者: ${data.debug_meta.handledBy}]` : '';
                append('agent', data.final_reply || data.reply, meta);
            } catch(e) { append('agent', 'Error: ' + e); }
        }
        function append(role, text, meta='') {
            const box = document.getElementById('box');
            box.innerHTML += `<div class="msg ${role}"><div>${text}</div><div class="meta">${meta}</div></div>`;
            box.scrollTop = box.scrollHeight;
        }
    </script>
</body>
</html>
```

### 3.3 外网网关 Agent A (`src/agent-a.ts`)
**关键修改**：增加了 `express.static` 来托管前端页面。

```typescript
import express from 'express';
import axios from 'axios';
import path from 'path'; // 引入路径模块
import { Slot, AgentPayload } from './types';

const app = express();
app.use(express.json());

// [关键修改] 托管 public 目录下的静态文件
app.use(express.static(path.join(__dirname, '../public')));

const PORT = 3000;
const AGENT_B_URL = process.env.AGENT_B_URL || 'http://localhost:3001/v1/process';

app.post('/chat', async (req, res) => {
    const { message } = req.body;
    const traceId = `req-${Date.now()}`;
    console.log(`[Agent A] 新请求: ${message}`);

    // 路由逻辑
    if (message.includes('数据库') || message.includes('报错')) {
        try {
            const payload: AgentPayload = {
                traceId,
                slot: { id: '1', role: 'user', content: message, meta: {} }
            };
            // A2A 调用
            const { data } = await axios.post(AGENT_B_URL, payload);
            res.json({ final_reply: data.content, debug_meta: data.meta });
        } catch (e) {
            res.status(500).json({ reply: "专家 B 没接电话" });
        }
    } else {
        res.json({ 
            final_reply: "我是前台 A，请问有什么可以帮您？", 
            debug_meta: { handledBy: 'Agent-A-Gateway' } 
        });
    }
});

app.listen(PORT, () => console.log(`🚀 Agent A 启动: http://localhost:${PORT}`));
```

### 3.4 内网专家 Agent B (`src/agent-b.ts`)
保持不变，负责模拟 LLM 调用。

```typescript
import express from 'express';
import { Slot } from './types';

const app = express();
app.use(express.json());

app.post('/v1/process', async (req, res) => {
    // 模拟思考耗时
    await new Promise(r => setTimeout(r, 1000));
    
    res.json({
        id: req.body.slot.id,
        role: 'agent',
        content: `【专家建议】请检查您的数据库连接池配置。`,
        meta: { handledBy: 'Agent-B-Internal' }
    });
});

app.listen(3001, () => console.log(`✅ Agent B (内网) 启动 :3001`));
```

---

## 4. Docker 化与构建优化

### 4.1 Dockerfile.agent-a (含前端资源)

**重要知识点**：
1.  **`COPY --from=builder`**: 多阶段构建，只保留编译后的 JS，丢弃源码和 TS 编译器，减小体积。
2.  **`COPY package*.json ./`**: 优先复制依赖描述文件，利用 Docker 缓存层，加速 `npm install`。
3.  **`COPY public ./public`**: **新增！** 必须把前端 HTML 也复制到镜像里。

```dockerfile
# --- Build Stage ---
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production

# 复制编译好的后端代码
COPY --from=builder /app/dist ./dist
# [新增] 复制前端静态资源
COPY public ./public

EXPOSE 3000
CMD ["node", "dist/agent-a.js"]
```

### 4.2 Dockerfile.agent-b (纯后端)
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/agent-b.js"]
```

---

## 5. 部署到 Azure (ACR + Container Apps)

### 5.1 创建并推送镜像 (ACR)

```bash
# 1. 设置变量
ACR_NAME="myagentacr2024" # 改成你的唯一名字
RG="MyAgentGroup"

# 2. 创建 ACR (启用 Admin 账户以便简化登录)
az acr create -n $ACR_NAME -g $RG --sku Basic --admin-enabled true

# 3. 登录 ACR
az acr login -n $ACR_NAME

# 4. 构建并推送 Agent A
docker build -t agent-a:v1 -f Dockerfile.agent-a .
docker tag agent-a:v1 $ACR_NAME.azurecr.io/agent-a:v1
docker push $ACR_NAME.azurecr.io/agent-a:v1

# 5. 构建并推送 Agent B
docker build -t agent-b:v1 -f Dockerfile.agent-b .
docker tag agent-b:v1 $ACR_NAME.azurecr.io/agent-b:v1
docker push $ACR_NAME.azurecr.io/agent-b:v1
```

### 5.2 部署到 Container Apps (Serverless K8s)

```bash
# 1. 创建环境
az containerapp env create -n MyEnv -g $RG --location japaneast

# 2. 部署 Agent B (内网隐身)
# 关键: --ingress internal
az containerapp create \
  --name agent-b \
  --resource-group $RG \
  --environment MyEnv \
  --image $ACR_NAME.azurecr.io/agent-b:v1 \
  --ingress internal \
  --target-port 3001 \
  --registry-server $ACR_NAME.azurecr.io

# 获取 Agent B 的内网 FQDN 地址
# 假设得到: https://agent-b.internal.politehill.azurecontainerapps.io

# 3. 部署 Agent A (外网暴露 + 前端)
# 关键: --ingress external
az containerapp create \
  --name agent-a \
  --resource-group $RG \
  --environment MyEnv \
  --image $ACR_NAME.azurecr.io/agent-a:v1 \
  --ingress external \
  --target-port 3000 \
  --registry-server $ACR_NAME.azurecr.io \
  --env-vars AGENT_B_URL=https://agent-b.internal.politehill.azurecontainerapps.io/v1/process
```

---

## 6. 验证

1.  找到 Agent A 的 **Application URL** (在 Azure Portal 或 CLI 输出中)。
2.  浏览器访问该 URL。
3.  你应该能看到聊天界面。
4.  发送测试消息，验证数据是否成功流转到内网的 Agent B 并返回。