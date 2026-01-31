import Foundation

public enum MarketBotCapability: String, Codable, Sendable {
    case canvas
    case camera
    case screen
    case voiceWake
    case location
}
