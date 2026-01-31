// Notification Service - Multi-channel dispatch

import {
    NotificationChannel,
    NotificationProvider,
    NotifyResult,
    WeChatNotifier,
    FeishuNotifier,
    TelegramNotifier,
    WebhookNotifier,
} from "./channels.js";

/**
 * Notification service configuration
 */
export interface NotificationConfig {
    wechat?: {
        webhookUrl?: string;
    };
    feishu?: {
        webhookUrl?: string;
    };
    telegram?: {
        botToken?: string;
        chatId?: string;
    };
    webhook?: {
        url?: string;
        bearerToken?: string;
    };
}

/**
 * Multi-channel notification service
 */
export class NotificationService {
    private providers: NotificationProvider[] = [];

    constructor(config?: NotificationConfig) {
        // Initialize all providers
        const wechat = new WeChatNotifier(config?.wechat?.webhookUrl);
        const feishu = new FeishuNotifier(config?.feishu?.webhookUrl);
        const telegram = new TelegramNotifier(config?.telegram?.botToken, config?.telegram?.chatId);
        const webhook = new WebhookNotifier(config?.webhook?.url, config?.webhook?.bearerToken);

        // Add configured providers
        if (wechat.isConfigured()) this.providers.push(wechat);
        if (feishu.isConfigured()) this.providers.push(feishu);
        if (telegram.isConfigured()) this.providers.push(telegram);
        if (webhook.isConfigured()) this.providers.push(webhook);
    }

    /**
     * Check if any notification channel is configured
     */
    isAvailable(): boolean {
        return this.providers.length > 0;
    }

    /**
     * Get list of configured channels
     */
    getConfiguredChannels(): NotificationChannel[] {
        return this.providers.map(p => p.channel);
    }

    /**
     * Get channel names in Chinese
     */
    getChannelNames(): string[] {
        const names: Record<NotificationChannel, string> = {
            [NotificationChannel.WECHAT]: "企业微信",
            [NotificationChannel.FEISHU]: "飞书",
            [NotificationChannel.TELEGRAM]: "Telegram",
            [NotificationChannel.EMAIL]: "邮件",
            [NotificationChannel.WEBHOOK]: "Webhook",
        };
        return this.providers.map(p => names[p.channel]);
    }

    /**
     * Send notification to all configured channels
     */
    async sendToAll(
        content: string,
        options?: { title?: string; markdown?: boolean }
    ): Promise<NotifyResult[]> {
        if (this.providers.length === 0) {
            return [];
        }

        const results = await Promise.all(
            this.providers.map(provider => provider.send(content, options))
        );

        return results;
    }

    /**
     * Send notification to specific channel
     */
    async sendTo(
        channel: NotificationChannel,
        content: string,
        options?: { title?: string; markdown?: boolean }
    ): Promise<NotifyResult | null> {
        const provider = this.providers.find(p => p.channel === channel);
        if (!provider) {
            return null;
        }
        return provider.send(content, options);
    }

    /**
     * Format and send analysis report
     */
    async sendReport(
        report: string,
        options?: { title?: string }
    ): Promise<{ sent: number; failed: number; results: NotifyResult[] }> {
        const results = await this.sendToAll(report, {
            title: options?.title || "📊 MarketBot 分析报告",
            markdown: true,
        });

        const sent = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        return { sent, failed, results };
    }
}

/**
 * Create notification service from environment variables
 */
export function createNotificationService(): NotificationService {
    return new NotificationService();
}
