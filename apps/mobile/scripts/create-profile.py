#!/usr/bin/env python3
"""Create and install the App Store provisioning profile for this app.

Needed because this machine has no Apple ID signed into Xcode, so automatic
signing cannot mint a profile: it fails with "Cloud signing permission error"
and then "No profiles for 'br.com.pandapdv.medslides' were found" — and it
fails at *export*, after the ten-minute archive has already been built. The
App Store Connect API key can create the profile outright, which is what this
does.

Run once. The profile is long-lived; re-run if it expires or if the signing
certificate is replaced.

    python3 scripts/create-profile.py

Reads the key id and issuer id from scripts/.env.local — the same gitignored
file testflight.sh sources — and the .p8 from ~/.appstoreconnect/private_keys/.
"""

import base64
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

BUNDLE_ID = "br.com.pandapdv.medslides"
PROFILE_NAME = "MedSlides App Store"
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent


def env_local():
    """Read the same gitignored .env.local that testflight.sh sources."""
    path = SCRIPT_DIR / ".env.local"
    if not path.exists():
        sys.exit(f"Missing {path}. See testflight.sh --help.")
    found = {}
    for line in path.read_text().splitlines():
        match = re.match(r"\s*(?:export\s+)?(\w+)\s*=\s*(.+)", line)
        if match:
            found[match.group(1)] = match.group(2).strip().strip("'\"")
    return found


def token(key_id, issuer):
    key = pathlib.Path.home() / ".appstoreconnect/private_keys" / f"AuthKey_{key_id}.p8"
    if not key.exists():
        sys.exit(f"Missing {key}.")

    def b64u(raw):
        return base64.urlsafe_b64encode(raw).rstrip(b"=")

    now = int(time.time())
    header = {"alg": "ES256", "kid": key_id, "typ": "JWT"}
    payload = {"iss": issuer, "iat": now, "exp": now + 600,
               "aud": "appstoreconnect-v1"}
    signing_input = (b64u(json.dumps(header, separators=(",", ":")).encode())
                     + b"."
                     + b64u(json.dumps(payload, separators=(",", ":")).encode()))
    der = subprocess.run(["openssl", "dgst", "-sha256", "-sign", str(key)],
                         input=signing_input, capture_output=True,
                         check=True).stdout

    # openssl emits ECDSA signatures as DER SEQUENCE{INTEGER r, INTEGER s};
    # JWS wants the raw fixed-width r||s pair. Unwrapped by hand rather than
    # taking a PyJWT dependency for one call on a machine that lacks it.
    index = 2 if der[1] < 0x80 else 3 + (der[1] & 0x7F) - 1
    raw = b""
    for _ in range(2):
        length = der[index + 1]
        raw += der[index + 2:index + 2 + length].lstrip(b"\x00").rjust(32, b"\x00")
        index += 2 + length

    return (signing_input + b"." + b64u(raw)).decode()


def get(bearer, url):
    request = urllib.request.Request(url,
                                     headers={"Authorization": f"Bearer {bearer}"})
    return json.load(urllib.request.urlopen(request))


def main():
    env = env_local()
    key_id = env.get("APP_STORE_API_KEY_ID")
    issuer = env.get("APP_STORE_API_ISSUER_ID")
    if not key_id or not issuer:
        sys.exit("APP_STORE_API_KEY_ID / APP_STORE_API_ISSUER_ID not in .env.local.")
    bearer = token(key_id, issuer)

    bundles = get(bearer, "https://api.appstoreconnect.apple.com/v1/bundleIds"
                          f"?filter[identifier]={BUNDLE_ID}")["data"]
    if not bundles:
        sys.exit(f"{BUNDLE_ID} is not registered as an App ID.")

    certificates = get(bearer,
                       "https://api.appstoreconnect.apple.com/v1/certificates"
                       "?filter[certificateType]=DISTRIBUTION&limit=20")["data"]
    if not certificates:
        sys.exit("No distribution certificate on the account.")
    # Newest expiry wins. This account carries superseded distribution certs
    # alongside the live one, and signing against a superseded one fails at
    # upload rather than at export.
    certificate = max(certificates,
                      key=lambda c: c["attributes"]["expirationDate"])

    body = {"data": {
        "type": "profiles",
        "attributes": {"name": PROFILE_NAME, "profileType": "IOS_APP_STORE"},
        "relationships": {
            "bundleId": {"data": {"id": bundles[0]["id"], "type": "bundleIds"}},
            "certificates": {"data": [{"id": certificate["id"],
                                       "type": "certificates"}]}}}}
    request = urllib.request.Request(
        "https://api.appstoreconnect.apple.com/v1/profiles",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {bearer}",
                 "Content-Type": "application/json"},
        method="POST")
    try:
        created = json.load(urllib.request.urlopen(request))["data"]
    except urllib.error.HTTPError as error:
        sys.exit(f"HTTP {error.code}: {error.read().decode()[:600]}")

    content = base64.b64decode(created["attributes"]["profileContent"])
    staged = pathlib.Path("/tmp/medslides.mobileprovision")
    staged.write_bytes(content)
    uuid = subprocess.run(
        f"security cms -D -i {staged} | plutil -extract UUID raw -",
        shell=True, capture_output=True, text=True, check=True).stdout.strip()

    target = (pathlib.Path.home()
              / "Library/Developer/Xcode/UserData/Provisioning Profiles")
    target.mkdir(parents=True, exist_ok=True)
    (target / f"{uuid}.mobileprovision").write_bytes(content)
    os.remove(staged)

    print(f"Installed '{PROFILE_NAME}' ({uuid}) for {BUNDLE_ID}.")
    print("scripts/testflight.sh --upload can now export and ship.")


if __name__ == "__main__":
    main()
