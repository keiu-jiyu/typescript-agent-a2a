import express from 'express';
import { Slot, AgentPayload } from './types';

const app = express();
app.use(express.json());
const PORT = 3001;

// --- 模拟 LLM 服务 (真实场景这里会用 LangChain.js) ---
async function callLLM(prompt: string): Promise<string> {
    console.log(`   [Agent B 思考中] 正在调用 LLM 分析: "${prompt}"...`);
    
    // 模拟耗时 1.5秒
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (prompt.includes('数据库')) {
        return "建议检查连接池配置，并查看慢查询日志 (SELECT * FROM logs)。";
    }
    return "这个问题我也很难回答，建议重启试试。";
}

// --- Agent B 的 API ---
app.post('/v1/process', async (req, res) => {
    const payload: AgentPayload = req.body;
    console.log(`[Agent B] 收到工单 (Trace: ${payload.traceId})`);

    // 1. 调用 LLM
    const aiResult = await callLLM(payload.slot.content);

    // 2. 生成结果 Slot
    const resultSlot: Slot = {
        id: payload.slot.id, // 保持 ID 一致方便追踪
        role: 'agent',
        content: `【专家B回复】${aiResult}`,
        meta: { 
            handledBy: 'Agent-B-Internal', 
            timestamp: Date.now(),
            confidence: 0.99 
        }
    };

    console.log(`[Agent B] 处理完成，返回结果。`);
    res.json(resultSlot);
});

app.listen(PORT, () => {
    console.log(`✅ [内网] Agent B (专家) 已启动: http://localhost:${PORT}`);
});