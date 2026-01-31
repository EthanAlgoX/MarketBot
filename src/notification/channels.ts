// Notification Channels - Multi-channel push notifications

/**
 * Notification channel types
 */
export enum NotificationChannel {
    WECHAT = "wechat",       // 企业微信
    FEISHU = "feishu",       // 飞书
    TELEGRAM = "telegram",   // Telegram
    EMAIL = "email",         // 邮件
    WEBHOOK = "webhook",     // 自定义 Webhook
    PUSHPLUS = "pushplus",   // PushPlus
}

/**
 * Notification result
 */
export interface NotifyResult {
    channel: NotificationChannel;
    success: boolean;
    error?: string;
}

/**
 * Base notification channel interface
 */
export interface NotificationProvider {
    channel: NotificationChannel;
    isConfigured(): boolean;
    send(content: string, options?: { title?: string; markdown?: boolean }): Promise<NotifyResult>;
}

/**
 * 企业微信 Webhook
 * 文档: https://developer.work.weixin.qq.com/document/path/91770
 */
export class WeChatNotifier implements NotificationProvider {
    readonly channel = NotificationChannel.WECHAT;
    private webhookUrl: string | null;

    constructor(webhookUrl?: string) {
        this.webhookUrl = webhookUrl || process.env.WECHAT_WEBHOOK_URL || null;
    }

    isConfigured(): boolean {
        return !!this.webhookUrl;
    }

    async send(content: string, options?: { title?: string; markdown?: boolean }): Promise<NotifyResult> {
        if (!this.webhookUrl) {
            return { channel: this.channel, success: false, error: "Webhook URL not configured" };
        }

        try {
            const response = await fetch(this.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    msgtype: options?.markdown ? "markdown" : "text",
                    markdown: options?.markdown ? { content } : undefined,
                    text: !options?.markdown ? { content } : undefined,
                }),
            });

            const data = await response.json() as { errcode?: number; errmsg?: string };
            if (data.errcode !== 0) {
                return { channel: this.channel, success: false, error: data.errmsg };
            }
            return { channel: this.channel, success: true };
        } catch (error) {
            return { channel: this.channel, success: false, error: String(error) };
        }
    }
}

/**
 * 飞书 Webhook
 * 文档: https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN
 */
export class FeishuNotifier implements NotificationProvider {
    readonly channel = NotificationChannel.FEISHU;
    private webhookUrl: string | null;

    constructor(webhookUrl?: string) {
        this.webhookUrl = webhookUrl || process.env.FEISHU_WEBHOOK_URL || null;
    }

    isConfigured(): boolean {
        return !!this.webhookUrl;
    }

    async send(content: string, options?: { title?: string; markdown?: boolean }): Promise<NotifyResult> {
        if (!this.webhookUrl) {
            return { channel: this.channel, success: false, error: "Webhook URL not configured" };
        }

        try {
            // 飞书支持富文本卡片
            const body = options?.markdown
                ? {
                    msg_type: "interactive",
                    card: {
                        header: {
                            title: { tag: "plain_text", content: options.title || "MarketBot 分析报告" },
                        },
                        elements: [
                            { tag: "markdown", content },
                        ],
                    },
                }
                : {
                    msg_type: "text",
                    content: { text: content },
                };

            const response = await fetch(this.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await response.json() as { code?: number; msg?: string };
            if (data.code !== 0) {
                return { channel: this.channel, success: false, error: data.msg };
            }
            return { channel: this.channel, success: true };
        } catch (error) {
            return { channel: this.channel, success: false, error: String(error) };
        }
    }
}

/**
 * Telegram Bot
 * 文档: https://core.telegram.org/bots/api
 */
export class TelegramNotifier implements NotificationProvider {
    readonly channel = NotificationChannel.TELEGRAM;
    private botToken: string | null;
    private chatId: string | null;

    constructor(botToken?: string, chatId?: string) {
        this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN || null;
        this.chatId = chatId || process.env.TELEGRAM_CHAT_ID || null;
    }

    isConfigured(): boolean {
        return !!(this.botToken && this.chatId);
    }

    async send(content: string, options?: { title?: string; markdown?: boolean }): Promise<NotifyResult> {
        if (!this.botToken || !this.chatId) {
            return { channel: this.channel, success: false, error: "Bot token or chat ID not configured" };
        }

        try {
            const text = options?.title ? `*${options.title}*\n\n${content}` : content;
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: this.chatId,
                    text,
                    parse_mode: options?.markdown ? "Markdown" : undefined,
                }),
            });

            const data = await response.json() as { ok: boolean; description?: string };
            if (!data.ok) {
                return { channel: this.channel, success: false, error: data.description };
            }
            return { channel: this.channel, success: true };
        } catch (error) {
            return { channel: this.channel, success: false, error: String(error) };
        }
    }
}

/**
 * Custom Webhook
 */
export class WebhookNotifier implements NotificationProvider {
    readonly channel = NotificationChannel.WEBHOOK;
    private webhookUrl: string | null;
    private bearerToken: string | null;

    constructor(webhookUrl?: string, bearerToken?: string) {
        this.webhookUrl = webhookUrl || process.env.CUSTOM_WEBHOOK_URL || null;
        this.bearerToken = bearerToken || process.env.CUSTOM_WEBHOOK_BEARER_TOKEN || null;
    }

    isConfigured(): boolean {
        return !!this.webhookUrl;
    }

    async send(content: string, options?: { title?: string; markdown?: boolean }): Promise<NotifyResult> {
        if (!this.webhookUrl) {
            return { channel: this.channel, success: false, error: "Webhook URL not configured" };
        }

        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (this.bearerToken) {
                headers["Authorization"] = `Bearer ${this.bearerToken}`;
            }

            const response = await fetch(this.webhookUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    title: options?.title || "MarketBot Report",
                    content,
                    markdown: options?.markdown || false,
                    timestamp: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                return { channel: this.channel, success: false, error: `HTTP ${response.status}` };
            }
            return { channel: this.channel, success: true };
        } catch (error) {
            return { channel: this.channel, success: false, error: String(error) };
        }
    }
}
/**
 * PushPlus Notifier
 * Docs: http://www.pushplus.plus
 */
export class PushPlusNotifier implements NotificationProvider {
    readonly channel = NotificationChannel.PUSHPLUS;
    private token: string | null;

    constructor(token?: string) {
        this.token = token || process.env.PUSHPLUS_TOKEN || null;
    }

    isConfigured(): boolean {
        return !!this.token;
    }

    async send(content: string, options?: { title?: string; markdown?: boolean }): Promise<NotifyResult> {
        if (!this.token) {
            return { channel: this.channel, success: false, error: "Token not configured" };
        }

        try {
            const response = await fetch("http://www.pushplus.plus/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: this.token,
                    title: options?.title || "MarketBot Report",
                    content: content,
                    template: options?.markdown ? "markdown" : "txt",
                }),
            });

            const data = await response.json() as { code?: number; msg?: string };
            if (data.code !== 200) {
                return { channel: this.channel, success: false, error: data.msg };
            }
            return { channel: this.channel, success: true };
        } catch (error) {
            return { channel: this.channel, success: false, error: String(error) };
        }
    }
}
