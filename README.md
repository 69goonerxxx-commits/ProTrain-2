# ProTrain (Android app)

`index.html` is the whole app and the only file you edit. Everything Android-specific is applied at build time by `build-www.mjs`, `shim-early.js` and `shim-late.js`. The repo has no folders except `.github/workflows/android.yml`.

## Build
1. Add repository secrets (Settings > Secrets and variables > Actions): `KEYSTORE_B64`, `KEYSTORE_PASSWORD`, and `KEY_ALIAS` if the key alias is not `protrain`.
2. Actions tab > Android APK > Run workflow. The APK appears on the Releases page.
3. Bump `version` in `package.json` when you ship a new version.

## Keystore
Reuse the Yotei keystore (set `KEY_ALIAS` to `yotei`), or make a new one:

    keytool -genkeypair -v -storetype PKCS12 -keystore protrain-release.p12 -alias protrain -keyalg RSA -keysize 2048 -validity 10000
    base64 -w0 protrain-release.p12

Keep the file and password safe. Lose the key and new builds can no longer install over the old one.

## If a build fails with "could not find ... in index.html"
You edited a line the Android shell patches. Update the matching line in `build-www.mjs`.
