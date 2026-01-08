think:
用户需要一份专门关于 **Azure Container Registry (ACR)** 使用的 Markdown 文档。
用途：保存备查 (Cheat Sheet)。

这份文档需要包含：
1.  **ACR 是什么** (通俗解释)。
2.  **核心操作流程** (创建 -> 登录 -> 打标 -> 推送)。
3.  **常用命令速查表**。
4.  **与 Azure Container Apps 的配合**。
5.  **常见报错解决** (比如 Unauthorized)。

文档风格：手册类、清晰、代码块为主。

结构设计：
1.  标题：Azure Container Registry (ACR) 实战速查手册。
2.  简介：它是 Docker Hub 的私有版。
3.  核心流程图解。
4.  Step-by-Step 实操命令 (从创建到推送)。
5.  进阶技巧 (查看镜像、删除镜像)。
6.  故障排查。

Let's generate.

---
# Azure Container Registry (ACR) 实战速查手册

这份文档记录了在 Azure 上管理 Docker 镜像的核心操作流程。ACR 是你的**私有 Docker 镜像仓库**，是部署 Container Apps 的前置条件。

---

## 1. 核心概念

*   **ACR (Azure Container Registry)**: 相当于你私人的 GitHub，只不过里面存的不是代码，是 **Docker 镜像**。
*   **Registry Server**: 你的仓库地址，格式通常为 `myname.azurecr.io`。
*   **Repository**: 镜像名（例如 `agent-a`）。
*   **Tag**: 版本号（例如 `v1`）。

---

## 2. 标准操作流程 (四步走)

### 第一步：创建仓库 (只需做一次)

创建时建议开启 `admin-enabled`，这样可以直接用用户名密码登录，最适合开发测试。

```bash
# 1. 设置变量 (名字必须全小写，全球唯一)
ACR_NAME="mycompanyacr2024"
RG="MyResourceGroup"

# 2. 创建标准版 ACR
az acr create \
  --resource-group $RG \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# 3. 获取仓库登录服务器地址 (记下来！)
# 输出示例: mycompanyacr2024.azurecr.io
az acr show --name $ACR_NAME --query loginServer --output tsv
```

### 第二步：本地登录

让你的本地 Docker 获得向该仓库推送的权限。

```bash
az acr login --name $ACR_NAME
# 成功标志: 显示 "Login Succeeded"
```

### 第三步：打标签 (Tag)

Docker 默认打的标签是 `agent-a:v1`，这属于本地标签。
你需要给它贴上“快递单”，写清楚要发到哪个仓库。

**语法**: `docker tag [本地镜像名]:[版本] [仓库地址]/[镜像名]:[版本]`

```bash
# 假设你本地已经 docker build 好了 agent-a:v1

docker tag agent-a:v1 mycompanyacr2024.azurecr.io/agent-a:v1
```

### 第四步：推送 (Push)

把镜像上传到云端。

```bash
docker push mycompanyacr2024.azurecr.io/agent-a:v1
```

---

## 3. 常用命令速查表

| 功能 | 命令 | 说明 |
| :--- | :--- | :--- |
| **查看仓库列表** | `az acr list -o table` | 列出你账号下所有的 ACR |
| **获取用户名密码** | `az acr credential show -n <acr名>` | 获取 Admin 账号密码 (部署时可能用到) |
| **查看云端镜像** | `az acr repository list -n <acr名>` | 看看仓库里有哪些镜像 |
| **查看特定版本的Tag** | `az acr repository show-tags -n <acr名> --repository agent-a` | 看看 agent-a 有哪些版本 (v1, v2...) |
| **删除云端镜像** | `az acr repository delete -n <acr名> --image agent-a:v1` | 删掉旧版本以节省空间 |

---

## 4. 常见问题排查 (Troubleshooting)

### Q1: `docker push` 报错 `unauthorized: authentication required`
*   **原因**: 你没登录，或者登录过期了。
*   **解决**: 重新运行 `az acr login --name <你的acr名字>`。

### Q2: `az containerapp create` 报错 `inaccessible image` 或 `PullImageError`
*   **原因**: Container App 没权限去你的 ACR 拉镜像。
*   **解决**: 
    1. 确保 ACR 开启了 Admin 用户 (`az acr update -n <acr名> --admin-enabled true`)。
    2. 或者在创建 Container App 时显式提供账号密码：
       ```bash
       --registry-server <acr名>.azurecr.io \
       --registry-username <用户名> \
       --registry-password <密码>
       ```

### Q3: 镜像死活推不上去，一直在重试 (Retrying)
*   **原因**: 通常是网络问题或公司防火墙拦截了上传流量。
*   **解决**: 尝试切换手机热点，或者检查是否开启了 VPN (有时 VPN 会干扰 Docker 上传)。

---

## 5. 配合 Azure Container Apps 使用

当你部署应用时，只需要指明镜像的**完整地址**：

```bash
az containerapp create \
  ... \
  --image mycompanyacr2024.azurecr.io/agent-a:v1 \
  ...
```

Azure 会自动识别这是 Azure 自己的仓库，并尝试进行认证对接。

---------------------------------------------------
# 第一次打包
docker build -t agent-a:v1 . //名字是你在敲命令的那一瞬间，通过 -t (tag) 参数强加给它的

# 修改了代码后...
docker build -t agent-a:v2 .  <--- 变成了 v2

开发版：
docker build -t agent-a:dev -f Dockerfile.agent-a .
测试版：
docker build -t agent-a:test -f Dockerfile.agent-a .
正式版：
docker build -t agent-a:v1.0.0 -f Dockerfile.agent-a .
---------------
docker build -t agent-a:v1.0.0 -f Dockerfile.agent-a .这里有一个点 是为什么？
这个点 . 代表什么？
它代表 “当前目录” (Current Directory)。
情况A 你就在 project 目录下。
cd /home/user/project
docker build -t my-app .  <-- 去“这里”找文件
情况B 你在上一级目录 /home/user，你想打包下面的项目。
cd /home/user
docker build -t my-app ./project  <-- 最后的点变成了文件夹路径
-------------
**有空格！必须有空格！**

这是一个非常容易看走眼的细节。我们把这句话拆开来看，就像拆解乐高积木一样：

```bash
docker build -t agent-a:v1.0.0 -f Dockerfile.agent-a .
            ↑                  ↑                  ↑
           空格               空格               空格
```

这句话由 **4 个独立的部分** 组成，每部分之间**必须用空格隔开**：

1.  **指令**: `docker build` (我要打包)
2.  **标签参数**: `-t agent-a:v1.0.0` (给它起个名)
3.  **文件参数**: `-f Dockerfile.agent-a` (配方是这张纸)
4.  **上下文路径**: `.` (材料在当前脚底下)

### 如果没空格会怎样？

如果你写成：
`...-f Dockerfile.agent-a.` (把点和文件名粘在一起了)

Docker 会以为你的 Dockerfile 名字叫 `Dockerfile.agent-a.` (文件名末尾带个点)，然后报错说找不到这个文件。

**正确读法：**
> Docker build [空格] tag是xxx [空格] file是xxx [空格] 在当前目录。
----------------
