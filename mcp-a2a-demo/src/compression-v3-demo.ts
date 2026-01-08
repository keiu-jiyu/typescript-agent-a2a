import { v4 as uuidv4 } from 'uuid';

// ==========================================
// 1. 基础数据结构定义 (复用你的 types.ts)
// ==========================================
interface Slot {
    id: string;
    role: 'user' | 'agent' | 'system' | 'tool';
    content: string;
    timestamp: number;
    metadata?: any; // 用于存向量、聚类标签等
}

// ==========================================
// 2. V3 核心压缩器类
// ==========================================
class V3SlotCompressor {
    private windowSize: number;

    constructor(windowSize: number = 3) {
        this.windowSize = windowSize;
    }

    /**
     * 主压缩函数
     */
    async compress(slots: Slot[]): Promise<Slot[]> {
        console.log(`\n[V3 Compressor] 开始处理 ${slots.length} 条 Slot...`);

        // ------------------------------------------
        // 第一步：滑动窗口 (保留最近 N 条)
        // ------------------------------------------
        if (slots.length <= this.windowSize) {
            console.log("-> 数据量未超标，无需压缩。");
            return slots;
        }

        const recentSlots = slots.slice(-this.windowSize); // 最近的热数据
        const historySlots = slots.slice(0, -this.windowSize); // 待压缩的冷数据

        console.log(`-> 切分完成: 热数据 ${recentSlots.length} 条, 冷数据 ${historySlots.length} 条`);

        // ------------------------------------------
        // 第二步：聚类去重 (Clustering / Deduplication)
        // 这里模拟向量聚类：根据 content 的简单的关键词特征分组
        // ------------------------------------------
        const clusteredGroups = this.mockVectorClustering(historySlots);
        console.log(`-> 聚类完成: 将冷数据聚成了 ${Object.keys(clusteredGroups).length} 个意图组`);

        // ------------------------------------------
        // 第三步：分组摘要 (Group Summarization)
        // 对每一组生成一个摘要 Slot
        // ------------------------------------------
        const summarySlots: Slot[] = [];

        for (const [intent, groupSlots] of Object.entries(clusteredGroups)) {
            const groupSummary = await this.mockLLMSummarize(groupSlots, intent);
            summarySlots.push(groupSummary);
        }

        console.log(`-> 摘要生成完毕: 生成了 ${summarySlots.length} 条摘要 Slot`);

        // ------------------------------------------
        // 第四步：合并结果 (摘要 + 热数据)
        // ------------------------------------------
        const finalSlots = [...summarySlots, ...recentSlots];
        return finalSlots;
    }

    /**
     * [模拟] 向量聚类算法
     * 真实场景：调用 OpenAI Embedding API -> 计算 Cosine Similarity -> K-Means 聚类
     */
    private mockVectorClustering(slots: Slot[]): Record<string, Slot[]> {
        const clusters: Record<string, Slot[]> = {};

        slots.forEach(slot => {
            // 这里用极其简单的逻辑模拟“语义聚类”：
            // 如果包含 "天气" -> 天气组
            // 如果包含 "数据库" -> 运维组
            // 其他 -> 杂项组
            let key = 'general';
            if (slot.content.includes('天气') || slot.content.includes('温度')) key = 'weather_topic';
            else if (slot.content.includes('数据库') || slot.content.includes('SQL')) key = 'db_topic';

            if (!clusters[key]) clusters[key] = [];
            clusters[key].push(slot);
        });

        return clusters;
    }

    /**
     * [模拟] LLM 摘要生成
     * 真实场景：调用 LangChain + GPT-4
     */
    private async mockLLMSummarize(slots: Slot[], topic: string): Promise<Slot> {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 100));

        // 这是一个伪造的 LLM 输出
        const summaryContent = `[历史摘要-${topic}]: 用户与 Agent 进行了 ${slots.length} 轮关于 ${topic} 的交互，最后状态正常。`;

        return {
            id: uuidv4(),
            role: 'system', // 摘要通常作为 system 提示词存在
            content: summaryContent,
            timestamp: Date.now(),
            metadata: { type: 'summary', original_count: slots.length }
        };
    }
}

// ==========================================
// 3. 运行演示
// ==========================================
async function runDemo() {
    // 1. 造一点数据 (模拟 10 条对话，包含重复意图)
    const rawSlots: Slot[] = [
        { id: '1', role: 'user', content: '今天北京天气怎么样？', timestamp: 100 },
        { id: '2', role: 'agent', content: '北京今天是晴天，25度。', timestamp: 101 },
        { id: '3', role: 'user', content: '那上海的天气呢？', timestamp: 102 }, // 天气类
        { id: '4', role: 'agent', content: '上海有小雨。', timestamp: 103 },
        { id: '5', role: 'user', content: '生产环境数据库连不上了', timestamp: 104 }, // 数据库类
        { id: '6', role: 'agent', content: '收到，正在检查连接池。', timestamp: 105 },
        { id: '7', role: 'user', content: '是不是 SQL 超时了？', timestamp: 106 }, // 数据库类
        { id: '8', role: 'user', content: '还没好吗？数据库还是报错', timestamp: 107 }, // 数据库类 (重复意图)
        { id: '9', role: 'user', content: '现在几点了？', timestamp: 108 }, // 最近的热数据
        { id: '10', role: 'agent', content: '现在是下午 3 点。', timestamp: 109 } // 最近的热数据
    ];

    console.log("=== 压缩前 (原始数据) ===");
    rawSlots.forEach(s => console.log(`[${s.role}] ${s.content}`));

    // 2. 初始化 V3 压缩器 (保留最近 2 条)
    const compressor = new V3SlotCompressor(2);

    // 3. 执行压缩
    const compressedSlots = await compressor.compress(rawSlots);

    console.log("\n=== 压缩后 (V3 算法处理) ===");
    compressedSlots.forEach(s => {
        if (s.role === 'system') {
            console.log(`\x1b[33m[${s.role}] ${s.content}\x1b[0m`); // 黄色高亮摘要
        } else {
            console.log(`[${s.role}] ${s.content}`);
        }
    });

    console.log(`\n压缩率: ${rawSlots.length} 条 -> ${compressedSlots.length} 条`);
}

runDemo();