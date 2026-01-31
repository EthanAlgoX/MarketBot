import MarketBotKit
import MarketBotProtocol
import Foundation

// Prefer the MarketBotKit wrapper to keep gateway request payloads consistent.
typealias AnyCodable = MarketBotKit.AnyCodable
typealias InstanceIdentity = MarketBotKit.InstanceIdentity

extension AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: AnyCodable]? { self.value as? [String: AnyCodable] }
    var arrayValue: [AnyCodable]? { self.value as? [AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}

extension MarketBotProtocol.AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: MarketBotProtocol.AnyCodable]? { self.value as? [String: MarketBotProtocol.AnyCodable] }
    var arrayValue: [MarketBotProtocol.AnyCodable]? { self.value as? [MarketBotProtocol.AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: MarketBotProtocol.AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [MarketBotProtocol.AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}
