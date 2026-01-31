// swift-tools-version: 6.2
// Package manifest for the MarketBot macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "MarketBot",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "MarketBotIPC", targets: ["MarketBotIPC"]),
        .library(name: "MarketBotDiscovery", targets: ["MarketBotDiscovery"]),
        .executable(name: "MarketBot", targets: ["MarketBot"]),
        .executable(name: "marketbot-mac", targets: ["MarketBotMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/MarketBotKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "MarketBotIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "MarketBotDiscovery",
            dependencies: [
                .product(name: "MarketBotKit", package: "MarketBotKit"),
            ],
            path: "Sources/MarketBotDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "MarketBot",
            dependencies: [
                "MarketBotIPC",
                "MarketBotDiscovery",
                .product(name: "MarketBotKit", package: "MarketBotKit"),
                .product(name: "MarketBotChatUI", package: "MarketBotKit"),
                .product(name: "MarketBotProtocol", package: "MarketBotKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/MarketBot.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "MarketBotMacCLI",
            dependencies: [
                "MarketBotDiscovery",
                .product(name: "MarketBotKit", package: "MarketBotKit"),
                .product(name: "MarketBotProtocol", package: "MarketBotKit"),
            ],
            path: "Sources/MarketBotMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "MarketBotIPCTests",
            dependencies: [
                "MarketBotIPC",
                "MarketBot",
                "MarketBotDiscovery",
                .product(name: "MarketBotProtocol", package: "MarketBotKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
