// 这是 A 和 B 都要遵守的“合同”
export interface Slot {
    id: string;
    role: 'user' | 'agent' | 'system';
    content: string;
    // 元数据：记录是谁处理的，耗时多少等
    meta: Record<string, any>;
}

export interface AgentPayload {
    traceId: string;
    slot: Slot;
}