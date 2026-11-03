Local test configuration is intentionally a demo project, not cloud credentials.
No emulator export/import is used; all fixtures are disposable and synthetic.

Requirements: Node 22.23.3, Java 21+, Firebase CLI 15.24.0.
From the repository root:
  npm ci --ignore-scripts
  npm ci --ignore-scripts --prefix backend/functions
  npm run build --prefix backend/functions
  npm run verify
  firebase emulators:exec --project demo-nur-prayer --only firestore,functions --config backend/firebase.json 'node backend/tests/emulator.mjs'

Ports: Functions 5001, Firestore 8086, hub 4400, logging 4500, websocket 9150.
Keep all emulator bindings on loopback. Runtime refuses a different demo project
or a non-loopback Firestore emulator. Do not point these tests at live services.

For manual local UI checks, run emulators:start with the same arguments, then:
  PUBLIC_PRAYER_API_URL=http://127.0.0.1:5001/demo-nur-prayer/europe-west3/prayerApi PUBLIC_PRAYER_MODE=local npm run dev -- --port 4343
Open http://127.0.0.1:4343/nur-und-huda/together.html in two separate browser profiles.
This is local integration evidence, not physical two-device staging acceptance.

Optional reproducible Chromium UI check (separate from physical-device acceptance):
  npm install --no-save --package-lock=false --ignore-scripts playwright-core@1.64.1
  node backend/tests/browser.mjs
Requires the frontend and emulators above. Uses the standard macOS Chrome path;
set PRAYER_BROWSER_EXECUTABLE to your installed Chromium/Chrome executable on
other systems. PRAYER_PLAYWRIGHT_MODULE can select an existing playwright-core
module path instead of installing it. It clears ONLY demo-nur-prayer's local
emulator documents before two synthetic sessions; never run alongside another
test that relies on that demo project's state. Screenshots go to the system temp
directory. Browser contexts are not separate physical devices or WebKit/Safari.
