// Gateway - Unified control plane for all agent interactions

import {
    ChannelType,
    GatewayMessage,
    MessageDirection,
    RequestContext,
    AgentBinding,
    GatewayConfig,
} from "./types.js";
import {
    Channel,
    CLIChannel,
    HTTPChannel,
    createResponse,
    createError,
} from "./channels.js";

/**
 * Generate unique ID
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Request handler type
 */
export type RequestHandler = (
    ctx: RequestContext,
    message: GatewayMessage,
) => Promise<string>;

/**
 * Gateway - Central control plane
 * 
 * Responsibilities:
 * - Channel connection management
 * - Request/event routing to agents
 * - Session coordination
 * - Tool execution logging
 */
export class Gateway {
    private config: GatewayConfig;
    private channels: Map<string, Channel> = new Map();
    private requestHandler?: RequestHandler;
    private isRunning = false;

    constructor(config: GatewayConfig) {
        this.config = {
            requestTimeoutMs: 60000,
            enableLogging: true,
            ...config,
        };
    }

    /**
     * Set the request handler
     */
    setRequestHandler(handler: RequestHandler): void {
        this.requestHandler = handler;
    }

    /**
     * Start the gateway
     */
    start(): void {
        this.isRunning = true;
        if (this.config.enableLogging) {
            console.log("[Gateway] Started");
        }
    }

    /**
     * Stop the gateway
     */
    stop(): void {
        this.isRunning = false;
        for (const channel of this.channels.values()) {
            channel.close();
        }
        this.channels.clear();
        if (this.config.enableLogging) {
            console.log("[Gateway] Stopped");
        }
    }

    /**
     * Create and register a CLI channel
     */
    createCLIChannel(): CLIChannel {
        const channel = new CLIChannel();
        this.registerChannel(channel);
        return channel;
    }

    /**
     * Create and register an HTTP channel
     */
    createHTTPChannel(): HTTPChannel {
        const channel = new HTTPChannel();
        this.registerChannel(channel);
        return channel;
    }

    /**
     * Register a channel
     */
    private registerChannel(channel: Channel): void {
        this.channels.set(channel.connectionId, channel);

        channel.onMessage(async (message) => {
            await this.handleMessage(channel, message);
        });

        if (this.config.enableLogging) {
            console.log(`[Gateway] Channel connected: ${channel.type} (${channel.connectionId})`);
        }
    }

    /**
     * Handle incoming message
     */
    private async handleMessage(channel: Channel, message: GatewayMessage): Promise<void> {
        if (!this.requestHandler) {
            await channel.send(createError(message, "NO_HANDLER", "No request handler configured"));
            return;
        }

        const startTime = Date.now();

        // Resolve agent ID
        const agentId = message.agentId || this.resolveAgentId(message);

        // Create request context
        const ctx: RequestContext = {
            requestId: message.id,
            channel: message.channel,
            connectionId: channel.connectionId,
            agentId,
            sessionKey: message.sessionKey || `${agentId}:${channel.connectionId}`,
            startTime,
            metadata: message.metadata,
        };

        if (this.config.enableLogging) {
            console.log(`[Gateway] Request ${ctx.requestId}: ${message.payload.query?.slice(0, 50)}...`);
        }

        try {
            // Execute request with timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error("Request timeout")), this.config.requestTimeoutMs);
            });

            const result = await Promise.race([
                this.requestHandler(ctx, message),
                timeoutPromise,
            ]);

            const durationMs = Date.now() - startTime;

            if (this.config.enableLogging) {
                console.log(`[Gateway] Response ${ctx.requestId}: ${durationMs}ms`);
            }

            await channel.send(createResponse(message, result));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (this.config.enableLogging) {
                console.error(`[Gateway] Error ${ctx.requestId}: ${errorMessage}`);
            }

            await channel.send(createError(message, "REQUEST_ERROR", errorMessage));
        }
    }

    /**
     * Resolve agent ID based on bindings
     */
    private resolveAgentId(message: GatewayMessage): string {
        // Check bindings
        for (const binding of this.config.agents) {
            // Match by channel type
            if (binding.channels?.includes(message.channel)) {
                return binding.agentId;
            }

            // Match by pattern (for HTTP)
            if (binding.patterns && message.metadata?.path) {
                const path = message.metadata.path as string;
                for (const pattern of binding.patterns) {
                    if (path.startsWith(pattern) || new RegExp(pattern).test(path)) {
                        return binding.agentId;
                    }
                }
            }
        }

        // Default agent
        return this.config.defaultAgentId || this.config.agents[0]?.agentId || "default";
    }

    /**
     * Get active connections
     */
    getConnections(): Array<{ id: string; type: ChannelType }> {
        return Array.from(this.channels.values()).map(ch => ({
            id: ch.connectionId,
            type: ch.type,
        }));
    }

    /**
     * Check if gateway is running
     */
    isActive(): boolean {
        return this.isRunning;
    }
}

/**
 * Create a simple gateway with default config
 */
export function createGateway(defaultAgentId: string = "main"): Gateway {
    return new Gateway({
        agents: [{ agentId: defaultAgentId }],
        defaultAgentId,
    });
}
