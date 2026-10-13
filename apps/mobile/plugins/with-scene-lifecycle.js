const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const LAUNCHING_BLOCK = `    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)`;

const LAUNCHING_BLOCK_REPLACEMENT = `    reactNativeDelegate = delegate
    reactNativeFactory = factory

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)`;

const CLASS_DECLARATION = "class AppDelegate: ExpoAppDelegate {";
const CLASS_DECLARATION_REPLACEMENT =
  "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {";

// The ObjC runtime name of Expo's `ExpoAppSceneDelegate`; referencing it by
// runtime name avoids Swift module-name mangling in the generated Info.plist.
const SCENE_DELEGATE_CLASS_NAME = "EXExpoAppSceneDelegate";

/**
 * iOS 26 refuses to launch apps built with the iOS 26 SDK unless they adopt
 * the UIScene life cycle. Expo's SDK 57 AppDelegate template still creates a
 * bare UIWindow in didFinishLaunching, so a prebuild from a current Xcode
 * crashes at startup on iOS 26 devices. Point the scene manifest at Expo's
 * own scene delegate and let it own window creation: it starts React Native
 * from the factory the app delegate builds, and re-feeds deep links,
 * universal links, and quick actions through Expo's linking path (which a
 * hand-rolled delegate forwarding to RCTLinkingManager would bypass).
 */
function withSceneLifecycle(config) {
  config = withAppDelegate(config, (config) => {
    config.modResults.contents = applySceneLifecycleToAppDelegate(config.modResults.contents);
    return config;
  });

  config = withInfoPlist(config, (config) => {
    applySceneManifest(config.modResults);
    return config;
  });

  return config;
}

function applySceneLifecycleToAppDelegate(contents) {
  // Only treat the file as already migrated when no legacy window startup is
  // left; a file with both would double-start React Native (the app delegate
  // and the scene delegate each call startReactNative).
  if (contents.includes("ExpoReactNativeFactoryProvider")) {
    if (contents.includes(LAUNCHING_BLOCK)) {
      throw new Error(
        "with-scene-lifecycle: AppDelegate already conforms to ExpoReactNativeFactoryProvider but still has legacy window startup; refusing to guess.",
      );
    }
    return contents;
  }

  if (!contents.includes(LAUNCHING_BLOCK) || !contents.includes(CLASS_DECLARATION)) {
    throw new Error(
      "with-scene-lifecycle: Expo AppDelegate template changed; update the plugin's anchor strings.",
    );
  }

  return contents
    .replace(CLASS_DECLARATION, CLASS_DECLARATION_REPLACEMENT)
    .replace(LAUNCHING_BLOCK, LAUNCHING_BLOCK_REPLACEMENT);
}

function applySceneManifest(infoPlist) {
  infoPlist.UIApplicationSceneManifest = {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneConfigurationName: "main",
          UISceneDelegateClassName: SCENE_DELEGATE_CLASS_NAME,
        },
      ],
    },
  };
  return infoPlist;
}

module.exports = withSceneLifecycle;
module.exports.applySceneLifecycleToAppDelegate = applySceneLifecycleToAppDelegate;
module.exports.applySceneManifest = applySceneManifest;
