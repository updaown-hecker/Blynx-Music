# Blynx Music for iPhone, iPad and Mac

## iPhone and iPad

The native SwiftUI app targets iOS and iPadOS 16 or later. The CI package is an unsigned IPA for device signing. It needs to be signed before iOS can install it.

To build and sign on your own Mac:

1. Open Xcode, add your Apple Account, and connect your iPhone or iPad.
2. Install XcodeGen and generate the project from the repository root.

   ```sh
   brew install xcodegen
   cd ios
   xcodegen generate
   open BlynxMusic.xcodeproj
   ```

3. In the BlynxMusic target, choose your team under **Signing & Capabilities**. If Apple reports that the bundle identifier is already registered, use a unique identifier for your personal build.
4. Select your device and press **Run**. Follow Xcode's instructions if the device asks for Developer Mode.

An Xcode Personal Team can install builds on your own devices. Free provisioning expires after seven days. TestFlight and App Store publishing require an enrolled Apple Developer Program team and distribution signing.

## macOS

Choose **arm64** for Apple silicon or **x86_64** for Intel. The release contains the native desktop player and its Java runtime. Mount the DMG and drag Blynx Music to Applications. The test DMG has no Developer ID notarization. To create a locally built copy, run `./gradlew :desktop:createDistributable` on a Mac with JDK 21 and the Android SDK installed.

See the [Apple Developer account guide](https://developer.apple.com/help/account/basics/about-your-developer-account) and [Developer ID documentation](https://developer.apple.com/developer-id/) for distribution details.

Blynx Music is based on OpenTune under GPL-3.0. The source is available from the release's commit in this repository.
