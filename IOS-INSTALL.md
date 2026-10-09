# SkyBound for your iPad

The cloud build creates **SkyBound-unsigned.ipa**, a compiled iOS device app with the entire game and models bundled for offline play. It supports iPadOS 15 or newer. An unsigned IPA cannot be installed directly: it needs to be signed for your iPad.

## Install from Windows

1. Download the `SkyBound-iPad-IPA` artifact from the successful **Build iPad IPA** run in this repository's Actions tab. Extract its ZIP to find `SkyBound-unsigned.ipa`.
2. Download a Windows sideloading tool from its official website, such as **Sideloadly** at https://sideloadly.io/. Follow its current Apple device-driver and iTunes requirements.
3. Connect your iPad by USB, unlock it, and trust your computer if asked.
4. Select your iPad and the IPA in the sideloading tool. Complete its Apple account signing steps yourself; do not send Apple passwords or verification codes to this chat or put them in GitHub.
5. Follow the device trust and Developer Mode instructions shown by the tool for your iPadOS version.
6. Open SkyBound. A free Apple account typically requires renewing the signing every seven days; follow your tool's refresh instructions.

The first build is unsigned and has not been tested on a physical iPad. Signing and installation are separate steps. There is no Apple account, certificate, or paid membership included in the IPA.

## Saves

The installed app keeps its own company save. It does not automatically share Safari's save. Export your web company before switching, and keep that backup. Offline play includes the game itself; it does not synchronize saves between devices.

## Rebuild

Changes to the game trigger the iOS build on `main`. You can also run **Build iPad IPA → Run workflow**. The workflow uses Xcode 26.2 on a macOS runner, runs the input tests, compiles an ARM64 device app, and verifies that the IPA contains the bundled JavaScript and all original models. The SHA256 file accompanies each build.

On a Mac with Xcode installed: `npm ci`, `npm run ios:sync`, then `npm run ios:open`. For a directly installable signed IPA, select your Apple development team and an appropriate provisioning profile in Xcode.
