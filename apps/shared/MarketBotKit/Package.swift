// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "MarketBotKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "MarketBotProtocol", targets: ["MarketBotProtocol"]),
        .library(name: "MarketBotKit", targets: ["MarketBotKit"]),
        .library(name: "MarketBotChatUI", targets: ["MarketBotChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "MarketBotProtocol",
            path: "Sources/MarketBotProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "MarketBotKit",
            dependencies: [
                "MarketBotProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/MarketBotKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "MarketBotChatUI",
            dependencies: [
                "MarketBotKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/MarketBotChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "MarketBotKitTests",
            dependencies: ["MarketBotKit", "MarketBotChatUI"],
            path: "Tests/MarketBotKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
