// Gateway Channels - Abstraction for different input/output channels

import {
    ChannelType,
    GatewayMessage,
    MessageDirection,
    ChannelConnection,
} from "./types.js";

/**
 * Generate unique ID
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Base channel interface
 */
export interface Channel {
    readonly type: ChannelType;
    readonly connectionId: string;

    send(message: GatewayMessage): Promise<void>;
    onMessage(handler: (message: GatewayMessage) => void): void;
    close(): void;

    getConnection(): ChannelConnection;
}

/**
 * Channel event handlers
 */
export interface ChannelHandler {
    onConnect?: (channel: Channel) => void;
    onDisconnect?: (channel: Channel) => void;
    onMessage?: (channel: Channel, message: GatewayMessage) => void;
    onError?: (channel: Channel, error: Error) => void;
}

/**
 * CLI Channel - for command line interface
 */
export class CLIChannel implements Channel {
    readonly type = ChannelType.CLI;
    readonly connectionId: string;

    private connectedAt: string;
    private lastActiveAt: string;
    private messageHandler?: (message: GatewayMessage) => void;

    constructor() {
        this.connectionId = generateId();
        this.connectedAt = new Date().toISOString();
        this.lastActiveAt = this.connectedAt;
    }

    async send(message: GatewayMessage): Promise<void> {
        this.lastActiveAt = new Date().toISOString();

        if (message.type === "response" && message.payload.content) {
            console.log(message.payload.content);
        } else if (message.type === "error" && message.payload.error) {
            console.error(`Error: ${message.payload.error.message}`);
        }
    }

    onMessage(handler: (message: GatewayMessage) => void): void {
        this.messageHandler = handler;
    }

    /**
     * Submit a query through CLI channel
     */
    submit(query: string, agentId?: string, sessionKey?: string): void {
        this.lastActiveAt = new Date().toISOString();

        const message: GatewayMessage = {
            id: generateId(),
            channel: this.type,
            direction: MessageDirection.INBOUND,
            timestamp: this.lastActiveAt,
            agentId,
            sessionKey,
            type: "request",
            payload: { query },
        };

        this.messageHandler?.(message);
    }

    close(): void {
        // CLI doesn't need cleanup
    }

    getConnection(): ChannelConnection {
        return {
            id: this.connectionId,
            type: this.type,
            connectedAt: this.connectedAt,
            lastActiveAt: this.lastActiveAt,
        };
    }
}

/**
 * HTTP Channel - for HTTP API requests
 */
export class HTTPChannel implements Channel {
    readonly type = ChannelType.HTTP;
    readonly connectionId: string;

    private connectedAt: string;
    private lastActiveAt: string;
    private responseResolver?: (message: GatewayMessage) => void;
    private messageHandler?: (message: GatewayMessage) => void;

    constructor() {
        this.connectionId = generateId();
        this.connectedAt = new Date().toISOString();
        this.lastActiveAt = this.connectedAt;
    }

    async send(message: GatewayMessage): Promise<void> {
        this.lastActiveAt = new Date().toISOString();
        this.responseResolver?.(message);
    }

    onMessage(handler: (message: GatewayMessage) => void): void {
        this.messageHandler = handler;
    }

    /**
     * Handle HTTP request and wait for response
     */
    async handleRequest(
        query: string,
        agentId?: string,
        sessionKey?: string,
        metadata?: Record<string, unknown>,
    ): Promise<GatewayMessage> {
        this.lastActiveAt = new Date().toISOString();

        return new Promise((resolve) => {
            this.responseResolver = resolve;

            const message: GatewayMessage = {
                id: generateId(),
                channel: this.type,
                direction: MessageDirection.INBOUND,
                timestamp: this.lastActiveAt,
                agentId,
                sessionKey,
                type: "request",
                payload: { query },
                metadata,
            };

            this.messageHandler?.(message);
        });
    }

    close(): void {
        this.responseResolver = undefined;
    }

    getConnection(): ChannelConnection {
        return {
            id: this.connectionId,
            type: this.type,
            connectedAt: this.connectedAt,
            lastActiveAt: this.lastActiveAt,
        };
    }
}

/**
 * Create outbound message
 */
export function createResponse(
    request: GatewayMessage,
    content: string,
): GatewayMessage {
    return {
        id: generateId(),
        channel: request.channel,
        direction: MessageDirection.OUTBOUND,
        timestamp: new Date().toISOString(),
        agentId: request.agentId,
        sessionKey: request.sessionKey,
        type: "response",
        payload: { content },
    };
}

/**
 * Create error message
 */
export function createError(
    request: GatewayMessage,
    code: string,
    message: string,
): GatewayMessage {
    return {
        id: generateId(),
        channel: request.channel,
        direction: MessageDirection.OUTBOUND,
        timestamp: new Date().toISOString(),
        agentId: request.agentId,
        sessionKey: request.sessionKey,
        type: "error",
        payload: {
            error: { code, message },
        },
    };
}
