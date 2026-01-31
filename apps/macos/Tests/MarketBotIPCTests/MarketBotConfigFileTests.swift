import Foundation
import Testing
@testable import MarketBot

@Suite(.serialized)
struct MarketBotConfigFileTests {
    @Test
    func configPathRespectsEnvOverride() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("marketbot-config-\(UUID().uuidString)")
            .appendingPathComponent("marketbot.json")
            .path

        await TestIsolation.withEnvValues(["MARKETBOT_CONFIG_PATH": override]) {
            #expect(MarketBotConfigFile.url().path == override)
        }
    }

    @MainActor
    @Test
    func remoteGatewayPortParsesAndMatchesHost() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("marketbot-config-\(UUID().uuidString)")
            .appendingPathComponent("marketbot.json")
            .path

        await TestIsolation.withEnvValues(["MARKETBOT_CONFIG_PATH": override]) {
            MarketBotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "ws://gateway.ts.net:19999",
                    ],
                ],
            ])
            #expect(MarketBotConfigFile.remoteGatewayPort() == 19999)
            #expect(MarketBotConfigFile.remoteGatewayPort(matchingHost: "gateway.ts.net") == 19999)
            #expect(MarketBotConfigFile.remoteGatewayPort(matchingHost: "gateway") == 19999)
            #expect(MarketBotConfigFile.remoteGatewayPort(matchingHost: "other.ts.net") == nil)
        }
    }

    @MainActor
    @Test
    func setRemoteGatewayUrlPreservesScheme() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("marketbot-config-\(UUID().uuidString)")
            .appendingPathComponent("marketbot.json")
            .path

        await TestIsolation.withEnvValues(["MARKETBOT_CONFIG_PATH": override]) {
            MarketBotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "wss://old-host:111",
                    ],
                ],
            ])
            MarketBotConfigFile.setRemoteGatewayUrl(host: "new-host", port: 2222)
            let root = MarketBotConfigFile.loadDict()
            let url = ((root["gateway"] as? [String: Any])?["remote"] as? [String: Any])?["url"] as? String
            #expect(url == "wss://new-host:2222")
        }
    }

    @Test
    func stateDirOverrideSetsConfigPath() async {
        let dir = FileManager().temporaryDirectory
            .appendingPathComponent("marketbot-state-\(UUID().uuidString)", isDirectory: true)
            .path

        await TestIsolation.withEnvValues([
            "MARKETBOT_CONFIG_PATH": nil,
            "MARKETBOT_STATE_DIR": dir,
        ]) {
            #expect(MarketBotConfigFile.stateDirURL().path == dir)
            #expect(MarketBotConfigFile.url().path == "\(dir)/marketbot.json")
        }
    }
}
