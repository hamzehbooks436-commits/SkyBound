"""Check the device archive really contains the game, not just a wrapper."""
import json
import plistlib
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as ipa:
    bad = ipa.testzip()
    if bad:
        raise SystemExit(f"Corrupt archive member: {bad}")
    names = ipa.namelist()
    infos = [n for n in names if n.startswith("Payload/") and n.count("/") == 2 and n.endswith(".app/Info.plist")]
    if len(infos) != 1:
        raise SystemExit("Expected exactly one iOS app in Payload")
    info = plistlib.loads(ipa.read(infos[0]))
    base = infos[0].removesuffix("Info.plist")
    assert info["CFBundleIdentifier"] == "com.hamzehbooks436.skybound"
    assert 2 in info["UIDeviceFamily"], "iPad support missing"
    assert info["CFBundleSupportedPlatforms"] == ["iPhoneOS"], "Simulator build cannot install on an iPad"
    assert len(ipa.read(base + info["CFBundleExecutable"])) > 1000
    assert ipa.read(base + "public/index.html")
    config = json.loads(ipa.read(base + "capacitor.config.json"))
    assert not config.get("server", {}).get("url"), "Game must use bundled offline files"
    scripts = [n for n in names if n.startswith(base + "public/assets/") and n.endswith(".js")]
    assert scripts, "Compiled game JavaScript missing"
    models = [n for n in names if n.startswith(base + "public/models/") and n.endswith(".glb")]
    assert len(models) >= 73, f"Missing game models: found {len(models)}"
    assert ipa.read(base + "public/thumbnails/courier_starter.png")
    print(f"Verified iPad IPA: {info['CFBundleDisplayName']}, iOS {info['MinimumOSVersion']}+, {len(models)} bundled models")
