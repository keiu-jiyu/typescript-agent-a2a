import express from 'express';
import axios from 'axios';
import path from 'path';
import { Slot, AgentPayload } from './types';
import { v4 as uuidv4 } from 'uuid'; // 如果报错需 npm i uuid @types/uuid，这里简单起见用随机数代替

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
const PORT = 3000;

// 配置 B 的地址 (如果是 Azure，这里读环境变量)
const AGENT_B_URL = process.env.AGENT_B_URL || 'http://localhost:3001/v1/process';

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    const traceId = `req-${Math.floor(Math.random() * 10000)}`;
    
    console.log(`\n=== [Agent A] 接待新客 (Trace: ${traceId}) ===`);
    console.log(`用户说: "${userMessage}"`);

    // 1. 构建 Slot
    const userSlot: Slot = {
        id: Date.now().toString(),
        role: 'user',
        content: userMessage,
        meta: { source: 'web_client' }
    };

    // 2. 路由逻辑 (Agent A 的大脑)
    // 真实场景：这里也可以调一个小 LLM 判断意图
    const isTechQuestion = userMessage.includes('死机') || userMessage.includes('数据库');

    if (isTechQuestion) {
        console.log(`[Agent A] 判定为[技术问题]，正在呼叫 Agent B...`);
        
        try {
            // --- A2A 核心调用 ---
            const payload: AgentPayload = { traceId, slot: userSlot };
            const response = await axios.post(AGENT_B_URL, payload);
            const resultSlot = response.data;
            
            // A 可以给结果加个“包装”
            res.json({
                final_reply: resultSlot.content,
                debug_meta: resultSlot.meta
            });
            
        } catch (error) {
            console.error(`[Agent A] 呼叫 B 失败: ${error}`);
            res.status(500).json({ error: "专家 B 没接电话" });
        }
    } else {
        console.log(`[Agent A] 判定为[普通闲聊]，自己处理。`);
        res.json({
            final_reply: "你好呀！我是接待员 A。有什么技术难题请尽管问我！",
            debug_meta: { handledBy: 'Agent-A-Gateway' }
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 [外网] Agent A (网关) 已启动: http://localhost:${PORT}`);
    console.log(`👉 请发送 POST 请求到 http://localhost:3000/chat`);
});