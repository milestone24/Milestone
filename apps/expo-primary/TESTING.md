# Testing options (iOS, Android, TestFlight)

How to run and distribute the Milestone mobile app before and after your client registers an **Apple Developer Program** account.

This app uses **Expo SDK 56** with **development builds** (`expo-dev-client`). App Store **Expo Go does not support SDK 56** on physical iPhones.

See also:

- [DEV_BUILD.md](./DEV_BUILD.md) — daily dev workflow, Metro, API URL, rebuild rules
- [README.md](./README.md) — quick start

---

## Who needs what

| Role | Apple Developer Program ($99/yr)? | Apple ID? |
|------|-----------------------------------|-----------|
| Build and sign iOS apps | **Yes** — someone's paid account | Yes |
| Upload to TestFlight | **Yes** — same as above | Yes |
| Install from TestFlight (tester) | **No** | Yes (free) |
| Own the app in App Store Connect long term | Client's account (eventually) | Yes |

**Important:** Your client does **not** need a developer account to **test** via TestFlight. They only need a normal Apple ID. A paid developer account is required for **building and uploading** — that can be **yours** until the client's account is ready.

---

## Decision guide

```
Need to test on physical iPhone?
├── No paid Apple account anywhere
│   ├── iOS Simulator → Option 4
│   └── Android device → Option 5
│
└── Someone has paid Apple account (you or client)
    ├── Daily development (Metro hot reload) → Option 1
    ├── Share build with client/stakeholders → Option 2 (TestFlight)
    ├── Client account ready, production path → Option 3
    └── Only need generic Expo Go for SDK 56 → Option 6 (advanced)
```

---

## Option 1 — EAS direct install (your Apple account, not TestFlight)

**Best for:** Day-to-day development on a physical iPhone while the client's Apple account is not ready.

**Requires:** Your Apple Developer Program membership.

**Does not require:** TestFlight, client's developer account.

### Steps

```bash
cd apps/expo-primary
eas login
npm run build:dev:ios
```

On the first build, EAS prompts for your Apple credentials and can manage certificates/provisioning.

When the build completes:

1. Open the install link from the EAS dashboard or terminal
2. Or scan the QR code on your iPhone
3. Install the **Milestone dev app** (not Expo Go)

### Daily use after install

```bash
export EXPO_PUBLIC_API_URL=http://192.168.x.x:5000   # your Mac's LAN IP
npm start                                             # expo start --dev-client
```

Open the Milestone dev app on your phone. JS/TS changes hot-reload over Metro.

### Pros and cons

| Pros | Cons |
|------|------|
| Fastest path to a real device | Install link is per-build; less polished for wide stakeholder testing |
| Dev client + Metro hot reload | Not the TestFlight app-install experience |
| Uses your Apple team temporarily | App is signed under **your** team until you migrate |

---

## Option 2 — TestFlight (your Apple account, client as tester)

**Best for:** Letting the client (and others) install builds without USB, ad hoc device registration, or sitting on your EAS install link.

**Requires:** Your Apple Developer Program membership.

**Client requires:** Only a free Apple ID (as external tester).

### One-time setup (your Apple account)

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) if you are not already a member.
2. Open [App Store Connect](https://appstoreconnect.apple.com) and create an app:
   - Bundle ID: `com.milestone.app` (must match [`app.config.ts`](./app.config.ts))
   - Name: e.g. Milestone (internal/beta name is fine)
3. Ensure EAS is linked to **your** Apple team (handled during first `eas build` / `eas credentials`).

### Build for TestFlight

**Development client** (connects to Metro — for active dev if testers are on your network):

```bash
cd apps/expo-primary
npm run build:dev:ios
```

**Preview / standalone build** (no Metro required — better for stakeholders reviewing a fixed build):

```bash
eas build --profile preview --platform ios
```

Profile definitions: [`eas.json`](./eas.json).

### Submit to TestFlight

After a successful build:

```bash
eas submit --platform ios --latest
```

Or submit a specific build from the [EAS dashboard](https://expo.dev).

First submission may require App Store Connect app metadata (export compliance, etc.). For internal dev builds, answer export compliance as appropriate for your app (often "no" for standard HTTPS-only apps — confirm with your compliance requirements).

### Add testers in App Store Connect

App Store Connect → your app → **TestFlight**:

| Tester type | Who | Developer account? |
|-------------|-----|-------------------|
| **Internal** | People on your App Store Connect team | Must be invited to your ASC team |
| **External** | Client, stakeholders, QA | **No** — any Apple ID by email |

For external testers:

1. Create an external testing group
2. Add testers by email (client's personal Apple ID email)
3. Submit the build for Beta App Review (first external test only; usually quick for dev builds)
4. Testers receive an email → install **TestFlight** from the App Store → install Milestone

### Dev client on TestFlight vs preview on TestFlight

| Build profile | Metro hot reload? | Good for |
|---------------|-------------------|----------|
| `development` (`build:dev:ios`) | Yes, when on same network as Metro | Developers |
| `preview` | No — bundled JS | Client demos, QA snapshots |

For client demos without your Mac running Metro, use **`preview`**, not `development`.

### Pros and cons

| Pros | Cons |
|------|------|
| Familiar install flow for client | Requires your paid Apple account |
| External testers need only Apple ID | First external TestFlight build needs Beta App Review |
| Good for recurring beta builds | Dev-client builds still need Metro for live reload |

---

## Option 3 — Client's Apple account (production path)

**Best for:** When the client has registered Apple Developer Program and will own the App Store listing.

### Steps

1. Client enrolls at [developer.apple.com/programs](https://developer.apple.com/programs/).
2. Client creates the app in **their** App Store Connect (or transfers an existing app — see [Migration](#migration-from-your-account-to-clients-account)).
3. Client invites you to their App Store Connect team (Admin or Developer role), **or** provides credentials/API key for EAS.
4. Update EAS to use **their** Apple team:

   ```bash
   cd apps/expo-primary
   eas credentials
   ```

5. Rebuild and submit under their team:

   ```bash
   npm run build:dev:ios          # or preview / production profile
   eas submit --platform ios --latest
   ```

6. Add testers under **their** TestFlight in App Store Connect.

### Pros and cons

| Pros | Cons |
|------|------|
| Correct ownership for App Store release | Waits on client enrollment |
| Client controls certificates and listing | May require rebuild and credential migration |

---

## Option 4 — iOS Simulator (no Apple Developer account)

**Best for:** UI and flow testing without any paid Apple account or physical iPhone.

**Requires:** Mac with Xcode (for running the simulator build locally), or EAS simulator build.

### EAS simulator build

```bash
cd apps/expo-primary
npm run build:dev:ios:simulator
```

Download the `.tar.gz` / `.app` from EAS and drag into the iOS Simulator, or follow EAS install instructions.

### Local simulator (Mac + Xcode)

```bash
cd apps/expo-primary
npm run prebuild
npx expo run:ios
```

### Limitations

- Not a real device — no true test of push, camera, performance on hardware, or cookie/auth edge cases on cellular
- Simulator can reach `localhost` API on your Mac (easier than physical device networking)

---

## Option 5 — Android physical device (no Apple account)

**Best for:** Testing on a real phone when iOS signing is blocked by missing Apple Developer account.

**Requires:** No Apple account. Android allows sideloading the APK from EAS.

```bash
cd apps/expo-primary
npm run build:dev:android
```

Install the APK from the EAS link on your Android device (enable "Install unknown apps" if prompted).

Then:

```bash
export EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
npm start
```

Open the Milestone dev app on Android.

### Limitations

- Android UI/behavior may differ from iOS
- Does not replace eventual iOS TestFlight validation

---

## Option 6 — No paid Apple account anywhere

If **neither you nor the client** has Apple Developer Program membership:

| Platform | Possible? | How |
|----------|-------------|-----|
| TestFlight | **No** | Requires paid Apple Developer Program |
| Physical iPhone via EAS | **No** | Requires signing with paid account |
| Physical iPhone via free Apple ID + Xcode | Limited | Local `expo run:ios --device` only; ~7-day cert expiry; high friction |
| iOS Simulator | **Yes** | Option 4 |
| Android device | **Yes** | Option 5 |

**Recommendation:** Use **Option 4 + Option 5** until someone enrolls in the Apple Developer Program, then move to **Option 1** or **Option 2**.

---

## Option 7 — Expo Go for SDK 56 (advanced, not this app)

**Not** the Milestone app. This is Expo's generic client for SDK 56 when App Store Expo Go is too old.

Expo provides:

- **Android:** Install SDK 56 Expo Go via Expo CLI
- **iOS physical device:** TestFlight External Beta for Expo Go, or `eas go` to build Expo Go for your TestFlight team

See [Expo SDK 56 changelog — Expo Go](https://expo.dev/changelog/sdk-56) and [Expo Go and the App Store (May 2026)](https://expo.dev/changelog/expo-go-and-app-store-may-2026).

**Milestone uses a development build**, not Expo Go. Use this option only if you explicitly want to experiment with Expo Go + SDK 56, not for Milestone feature work.

---

## Migration from your account to client's account

If you shipped builds under **your** Apple team and the client later registers:

| Item | Action |
|------|--------|
| Bundle ID `com.milestone.app` | Registered under your team — may need [app transfer](https://developer.apple.com/help/app-store-connect/transfer-an-app/overview-of-app-transfer) to client's team, or change bundle ID (requires new app listing) |
| EAS credentials | Run `eas credentials` and switch Apple team to client's |
| TestFlight testers | Recreate groups under client's App Store Connect |
| Certificates / provisioning | Regenerated by EAS under new team on next build |

Plan bundle ID ownership **before** the first App Store submission. Transfers are possible but add process; aligning early avoids rework.

---

## Comparison summary

| Option | Physical iPhone | TestFlight | Client dev account | Metro hot reload | Best for |
|--------|-----------------|------------|--------------------|------------------|----------|
| 1 — EAS direct install | Yes | No | No (use yours) | Yes | Active development |
| 2 — TestFlight (yours) | Yes | Yes | No (use yours) | Dev profile only | Client/stakeholder testing |
| 3 — Client's account | Yes | Yes | Yes | Dev profile only | Production ownership |
| 4 — iOS Simulator | No | No | No | Yes | UI dev without Apple account |
| 5 — Android APK | No (Android) | N/A | No | Yes | Real device without Apple account |
| 6 — No paid Apple | No | No | No | Simulator/Android only | Waiting for enrollment |
| 7 — Expo Go SDK 56 | Yes* | Maybe* | Varies | Yes | Not Milestone — Expo Go only |

\*Via Expo's SDK 56 distribution channels, not App Store Expo Go.

---

## Recommended path while client has no Apple account

1. **You** enroll in Apple Developer Program (if not already).
2. **Develop daily:** Option 1 (`npm run build:dev:ios` + `npm start`).
3. **Share with client:** Option 2 — `eas build --profile preview` + `eas submit` + external TestFlight testers (client's Apple ID email).
4. **Parallel:** Option 5 on Android if useful.
5. **When client enrolls:** Option 3 — migrate credentials and App Store Connect ownership (see [Migration](#migration-from-your-account-to-clients-account)).

---

## Commands quick reference

```bash
cd apps/expo-primary

# Option 1 — direct install (dev client)
npm run build:dev:ios

# Option 2 — TestFlight (preview build for stakeholders)
eas build --profile preview --platform ios
eas submit --platform ios --latest

# Option 2 — TestFlight (dev client for developers)
npm run build:dev:ios
eas submit --platform ios --latest

# Option 4 — simulator
npm run build:dev:ios:simulator

# Option 5 — Android
npm run build:dev:android

# After install — start Metro
export EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
npm start
```

---

## Further reading

- [TestFlight overview (Apple)](https://developer.apple.com/testflight/)
- [EAS Submit](https://docs.expo.dev/submit/introduction/)
- [Internal distribution (EAS)](https://docs.expo.dev/build/internal-distribution/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
