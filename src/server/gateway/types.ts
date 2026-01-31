// Gateway Types - Message and channel type definitions

/**
 * Channel types for message routing
 */
export enum ChannelType {
    CLI = "cli",
    HTTP = "http",
    WEBSOCKET = "websocket",
}

/**
 * Message direction
 */
export enum MessageDirection {
    INBOUND = "inbound",   // From client to gateway
    OUTBOUND = "outbound", // From gateway to client
}

/**
 * Standard message format for all channels
 */
export interface GatewayMessage {
    id: string;
    channel: ChannelType;
    direction: MessageDirection;
    timestamp: string;

    // Routing info
    agentId?: string;
    sessionKey?: string;

    // Content
    type: "request" | "response" | "event" | "error";
    payload: MessagePayload;

    // Metadata
    metadata?: Record<string, unknown>;
}

/**
 * Message payload types
 */
export interface MessagePayload {
    // Request
    query?: string;

    // Response
    content?: string;
    toolCalls?: ToolCallResult[];

    // Event
    event?: string;
    data?: unknown;

    // Error
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}

/**
 * Tool call result
 */
export interface ToolCallResult {
    toolName: string;
    args: Record<string, unknown>;
    result?: unknown;
    error?: string;
    durationMs?: number;
}

/**
 * Channel connection info
 */
export interface ChannelConnection {
    id: string;
    type: ChannelType;
    connectedAt: string;
    lastActiveAt: string;
    agentId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Gateway request context
 */
export interface RequestContext {
    requestId: string;
    channel: ChannelType;
    connectionId: string;
    agentId: string;
    sessionKey: string;
    startTime: number;
    metadata?: Record<string, unknown>;
}

/**
 * Agent routing binding
 */
export interface AgentBinding {
    agentId: string;
    channels?: ChannelType[];
    patterns?: string[];  // URL/path patterns for HTTP
    priority?: number;
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
    agents: AgentBinding[];
    defaultAgentId?: string;
    maxConnections?: number;
    requestTimeoutMs?: number;
    enableLogging?: boolean;
}
