import Foundation

public enum MarketBotChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(MarketBotChatEventPayload)
    case agent(MarketBotAgentEventPayload)
    case seqGap
}

public protocol MarketBotChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> MarketBotChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [MarketBotChatAttachmentPayload]) async throws -> MarketBotChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> MarketBotChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<MarketBotChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension MarketBotChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "MarketBotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> MarketBotChatSessionsListResponse {
        throw NSError(
            domain: "MarketBotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}
