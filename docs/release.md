# Release Guide

## Build Commands

### Development (web)
```bash
npm run dev          # Start SvelteKit dev server at localhost:5173
npm run build        # Build static web app to build/
npm run preview      # Preview built web app
```

### Development (desktop)
```bash
npm run tauri:dev    # Start Tauri dev mode (web + native shell)
npm run tauri:build  # Build desktop installer
```

### Testing
```bash
npm run test:unit    # Run vitest unit tests
npm run test:e2e     # Run Playwright e2e tests
npm run check        # Run TypeScript type checking
```

## Desktop Packaging

### Targets
| Platform | Format | Architecture |
|----------|--------|-------------|
| macOS | `.dmg`, `.app.tar.gz` | Universal (Intel + Apple Silicon) |
| Windows | `.msi`, `.exe` (NSIS) | x86_64 |

### CI Build
Trigger a build via GitHub Actions:
- **Beta tag push**: `git tag v1.0.0-beta.1 && git push origin v1.0.0-beta.1`
- **Stable tag push**: `git tag v1.0.0 && git push origin v1.0.0`
- **Manual**: Actions > "Build Desktop App" > Run workflow

Build artifacts are uploaded as GitHub Actions artifacts and (for tag pushes) attached to a draft GitHub Release.

Stable release tags are blocked unless a matching published beta prerelease exists first. For example, `v1.0.0` requires a non-draft `v1.0.0-beta.N` GitHub prerelease with both macOS and Windows artifacts attached. The workflow runs `node scripts/release-guard.mjs` before creating or building a stable release.

### Local Build
```bash
# macOS universal binary
npm run tauri:build -- --target universal-apple-darwin

# Windows (on Windows machine)
npm run tauri:build
```

## Signing & Notarization

### macOS
Set these GitHub Secrets for CI signing:
- `APPLE_CERTIFICATE` — Base64-encoded `.p12` certificate
- `APPLE_CERTIFICATE_PASSWORD` — Certificate password
- `APPLE_SIGNING_IDENTITY` — e.g. `Developer ID Application: Your Name (TEAMID)`
- `APPLE_ID` — Apple ID email for notarization
- `APPLE_PASSWORD` — App-specific password
- `APPLE_TEAM_ID` — Apple Developer Team ID

Without these secrets, the build will succeed but the app will be unsigned (users will see Gatekeeper warnings).

### Windows
Windows code signing is not yet configured. Unsigned builds will show SmartScreen warnings on first launch.

## Artifact Naming

- GitHub Actions artifacts: `rv-reservation-system-{target}` (e.g. `rv-reservation-system-universal-apple-darwin`)
- Installer files follow Tauri defaults: `RV Reservation System_{version}_{arch}.{ext}`

## Versioning

Version is maintained in three files (all must match):
- `package.json` → `version`
- `src-tauri/tauri.conf.json` → `version`
- `src-tauri/Cargo.toml` → `version`

All three should be updated together before tagging a release.

## Beta-First Release Flow

1. Merge the release PR to `main`.
2. Tag the merge commit as a beta: `git tag vX.Y.Z-beta.1 && git push origin vX.Y.Z-beta.1`.
3. Wait for the desktop workflow to attach macOS and Windows artifacts to the draft prerelease.
4. Publish the prerelease and test the artifacts on macOS and Windows.
5. After testing passes, tag the same validated commit as stable: `git tag vX.Y.Z && git push origin vX.Y.Z`.

The stable tag guard checks GitHub Releases, not local tags. A qualifying beta must be published, marked as a prerelease, and include at least one macOS artifact (`.dmg` or `.app.tar.gz`) plus one Windows artifact (`.msi`, `.exe`, or `.nsis.zip`).

## Verification Checklist

Before releasing, verify:

- [ ] `npm run check` passes (0 errors)
- [ ] `npm run test:unit` passes (all unit tests green)
- [ ] `npm run test:e2e` passes (all Playwright tests green)
- [ ] `npm run build` succeeds
- [ ] Desktop app launches and shows the reservation grid
- [ ] Create, edit, and delete a reservation
- [ ] Overlap rejection works
- [ ] TODAY button scrolls to current date
- [ ] Admin page: set passcode, change site name
- [ ] Data persists after closing and reopening the app
- [ ] Parking location management works (add, rename, delete constraints)
