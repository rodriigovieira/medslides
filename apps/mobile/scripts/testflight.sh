#!/usr/bin/env bash
set -euo pipefail

# Archive and ship the MedSlides iOS app to TestFlight.
#
# There is no CI for this app. Nothing archives, nothing uploads, unless this
# script runs — the same situation Platform Admin iOS is in, and the reason that
# app's doc says never to treat a pushed tag as a shipped build.
#
# Auth is an App Store Connect API key. The Panda team's key already exists on
# this machine, so the values come from a gitignored .env.local rather than
# being re-issued: ~/.appstoreconnect/private_keys/AuthKey_<KeyID>.p8 plus the
# key id and issuer id.
#
# Signing identity comes from ios/Flutter/Signing.xcconfig, which is gitignored
# for the same reason the team id is not written down here.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$APP_DIR/build/release"
ARCHIVE="$BUILD_DIR/MedSlides.xcarchive"

UPLOAD=0
BUILD_NUMBER=""

usage() {
  cat <<'EOF'
Usage: scripts/testflight.sh [--upload] [--build-number N]

Archives the iOS app and, with --upload, sends it to TestFlight. Without
--upload it stops at the .ipa so you can inspect or upload it by hand.

  --upload          Upload to App Store Connect with xcrun altool.
  --build-number N  Override the build number for this run only. Use when App
                    Store Connect already has the number pubspec.yaml is on —
                    a rejected upload for a duplicate build number is the
                    commonest failure here, and it happens after the archive.
  -h, --help        Show this help.

Requires ios/Flutter/Signing.xcconfig (copy Signing.example.xcconfig), the
"MedSlides App Store" provisioning profile (create it once with
scripts/create-profile.py) and, for --upload, .env.local in this directory:
  APP_STORE_API_KEY_ID     e.g. WGXQ6U853Z; AuthKey_<ID>.p8 must be in
                           ~/.appstoreconnect/private_keys/
  APP_STORE_API_ISSUER_ID  the issuer UUID from the App Store Connect Keys page
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --upload) UPLOAD=1; shift ;;
    --build-number) BUILD_NUMBER="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

cd "$APP_DIR"

# Fail before the eleven-minute archive rather than after it. Every check below
# is something that only surfaces at upload time otherwise.
if [[ ! -f ios/Flutter/Signing.xcconfig ]]; then
  echo "Missing ios/Flutter/Signing.xcconfig." >&2
  echo "Copy ios/Flutter/Signing.example.xcconfig and fill in the team + bundle id." >&2
  exit 1
fi

if [[ "$UPLOAD" == "1" ]]; then
  # shellcheck disable=SC1091
  [[ -f "$SCRIPT_DIR/.env.local" ]] && source "$SCRIPT_DIR/.env.local"
  if [[ -z "${APP_STORE_API_KEY_ID:-}" || -z "${APP_STORE_API_ISSUER_ID:-}" ]]; then
    echo "Missing APP_STORE_API_KEY_ID / APP_STORE_API_ISSUER_ID." >&2
    echo "Put them in $SCRIPT_DIR/.env.local (gitignored)." >&2
    exit 1
  fi
  KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${APP_STORE_API_KEY_ID}.p8"
  if [[ ! -f "$KEY_PATH" ]]; then
    echo "Missing $KEY_PATH." >&2
    exit 1
  fi
fi

echo "==> Analysing"
flutter analyze

echo "==> Testing"
flutter test

# `flutter build ipa` cannot sign on this machine. It drives Xcode's automatic
# signing, which needs an Apple ID signed into Xcode; there is none, so it dies
# with "No Accounts" and "Cloud signing permission error" — at export, after
# the ten-minute archive. So the archive and the export are run separately and
# the export signs manually against a profile minted from the API key.
PROFILE_NAME="MedSlides App Store"
if ! grep -qls "$PROFILE_NAME" \
    "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/"*.mobileprovision \
    2>/dev/null; then
  echo "No '$PROFILE_NAME' provisioning profile installed." >&2
  echo "Run: python3 scripts/create-profile.py" >&2
  exit 1
fi

echo "==> Building"
BUILD_ARGS=(--release --no-codesign)
[[ -n "$BUILD_NUMBER" ]] && BUILD_ARGS+=(--build-number "$BUILD_NUMBER")
flutter build ios "${BUILD_ARGS[@]}"

echo "==> Archiving"
rm -rf "$ARCHIVE"
mkdir -p "$BUILD_DIR"
xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" archive

echo "==> Exporting"
EXPORT_DIR="$BUILD_DIR/ipa"
rm -rf "$EXPORT_DIR"
EXPORT_PLIST="$BUILD_DIR/ExportOptions.plist"
cat > "$EXPORT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>YT5JKQN5YD</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key>
  <string>Apple Distribution: Rodrigo Rodrigues (YT5JKQN5YD)</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>br.com.pandapdv.medslides</key><string>$PROFILE_NAME</string>
  </dict>
  <key>uploadSymbols</key><true/>
  <key>destination</key><string>export</string>
</dict>
</plist>
PLIST
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$EXPORT_PLIST" -exportPath "$EXPORT_DIR"

IPA="$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' | head -1)"
if [[ -z "$IPA" ]]; then
  echo "No .ipa produced." >&2
  exit 1
fi
echo "==> Built $IPA"

if [[ "$UPLOAD" != "1" ]]; then
  echo
  echo "Not uploading (no --upload). The .ipa is at:"
  echo "  $IPA"
  exit 0
fi

echo "==> Validating"
xcrun altool --validate-app -f "$IPA" -t ios \
  --apiKey "$APP_STORE_API_KEY_ID" --apiIssuer "$APP_STORE_API_ISSUER_ID"

echo "==> Uploading to TestFlight"
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$APP_STORE_API_KEY_ID" --apiIssuer "$APP_STORE_API_ISSUER_ID"

echo
echo "Uploaded. Processing on App Store Connect takes a few minutes; the build"
echo "is not testable until it finishes and clears export compliance."
