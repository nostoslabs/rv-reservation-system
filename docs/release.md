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
- **Tag push**: `git tag v1.0.0 && git push origin v1.0.0`
- **Manual**: Actions > "Build Desktop App" > Run workflow

Build artifacts are uploaded as GitHub Actions artifacts and (for tag pushes) attached to a draft GitHub Release.

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

- GitHub Actions artifacts: `rv-reservation-demo-{target}` (e.g. `rv-reservation-demo-universal-apple-darwin`)
- Installer files follow Tauri defaults: `RV Reservation Demo_{version}_{arch}.{ext}`

## Versioning

Version is maintained in:
- `src-tauri/tauri.conf.json` → `version`
- `package.json` → `version`

Both should be updated together before tagging a release.

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
