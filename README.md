
```markdown
# 🤖 TypeScript Agent-to-Agent (A2A) System

> 一个基于 **Node.js + TypeScript** 构建的企业级 Agent 微服务协作系统示例。

## 📖 项目简介

本项目展示了如何不依赖 Python 生态，仅使用 **TypeScript** 全栈技术构建一套 **A2A (Agent-to-Agent)** 架构。系统包含一个面向用户的网关 Agent 和一个面向内部的专家 Agent，支持 Azure Container Apps 部署。

## 🏗️ 系统架构

*   **Agent A (Gateway)**: 对外网关，托管 Web 前端，负责路由分发。
*   **Agent B (Worker)**: 内网微服务，模拟 LLM 思考与处理。
*   **Protocol**: 基于 JSON Slot 的轻量级通信协议。

```mermaid
graph LR
    User -->|HTTP| AgentA[Agent A (Gateway)]
    AgentA -->|REST/Slot| AgentB[Agent B (Internal)]
    AgentB -.->|Think| LLM
```

## ✨ 核心特性

- [x] **纯 TypeScript 实现**: 摆脱 Python 依赖，统一种植栈。
- [x] **微服务架构**: 职责分离，A 负责路由，B 负责业务。
- [x] **Docker 化**: 包含多阶段构建优化，镜像体积极小。
- [x] **Azure Ready**: 专为 Azure Container Apps (ACA) 设计的内网/外网网络拓扑。

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发环境
你需要开启两个终端窗口：

```bash
# 终端 1: 启动内网 Agent B (Port 3001)
npm run start:b

# 终端 2: 启动网关 Agent A (Port 3000)
npm run start:a
```

### 3. 体验
打开浏览器访问 `http://localhost:3000`，即可通过可视化界面与 Agent 集群交互。

## 📦 部署 (Docker)

```bash
# 构建镜像
docker build -t agent-a:v1 -f Dockerfile.agent-a .
docker build -t agent-b:v1 -f Dockerfile.agent-b .

# 运行容器
docker run -p 3000:3000 agent-a:v1
```

---
*Created for the modern AI Engineer.*
```
