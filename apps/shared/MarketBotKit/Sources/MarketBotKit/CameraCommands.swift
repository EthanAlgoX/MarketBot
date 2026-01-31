import Foundation

public enum MarketBotCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum MarketBotCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum MarketBotCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum MarketBotCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct MarketBotCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: MarketBotCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: MarketBotCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: MarketBotCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: MarketBotCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct MarketBotCameraClipParams: Codable, Sendable, Equatable {
    public var facing: MarketBotCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: MarketBotCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: MarketBotCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: MarketBotCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
