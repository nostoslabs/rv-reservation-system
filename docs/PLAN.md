# Offline-First Desktop Migration Plan (Tauri + SQLite)

## Current Status - 2026-06-02
- The offline-first Tauri + SQLite migration epics below are complete and are kept as historical project context.
- Current published beta: [`v1.20.1-beta.1`](https://github.com/nostoslabs/rv-reservation-system/releases/tag/v1.20.1-beta.1), which includes PR #149's right-click copy non-mutating fix.
- Current active branch: `feat/reservation-context-paste`.
- Current active work: complete #141 by adding in-grid reservation paste from an occupied-cell copy into an empty cell.
- Current branch target version: `1.21.0` in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` before merge.
- Local verification checked on 2026-06-02 for the active branch: `npm run check`, `npm run test:unit`, `npm run build`, `npm run code-health:changed`, `npm run code-health:full`, and full `npm run test:e2e` all passed. Visual verification screenshot: `screenshots/issue-141-paste-context-menu.png`.
- Known toolchain warning remains: `npm run build` reports Rollup `Unknown output options: codeSplitting`.

## Open Issue Verification - 2026-06-02
| Issue | Verified status | Notes |
| --- | --- | --- |
| #136 ETA field and enhanced reservation tooltip | Implemented on PR #148 | ETA field, tooltip details, persistence, and optional save path have e2e coverage. |
| #137 Increase notes field character limit | Implemented on `main`; issue closed | `MAX_RESERVATION_NOTES_LENGTH = 5000`; unit and e2e coverage exist. |
| #138 Reservation count shows current and future only | Implemented on PR #148 | Uses active-reservation count with e2e coverage for excluding past stays. |
| #139 Auto-backup on app exit | Implemented on PR #148 | Close handler flushes SQLite writes, runs configured verified backup, then flushes again. Unit coverage confirms failures do not block close. |
| #140 Record and display reservation creation date | Implemented on PR #148 | Adds `createdAt`, SQLite migration/backfill, read-only edit display, and persistence tests. |
| #141 Right-click copy and paste support | Implemented on active branch; pending merge/release | Reservation grid context menu copies details to the clipboard and stores an internal reservation copy. Empty cells show `Paste reservation here`; paste preserves duration/details, creates a new reservation at the target site/date, and rejects overlaps with e2e coverage. |
| #142 Desktop update restart flow and pre-update backup | Implemented; issue closed | Download-ready state, forced pre-install backup, and blocked-backup UI error are covered by unit and e2e tests. |
| #133 Recurring code-health audit | Baseline implemented; intentionally recurring | `docs/coding_standards.md`, guardrail scripts, Knip, and audit punch list exist. Keep open only if used as the recurring checkpoint. |
| #145 Apply code-health audit findings | Pending/partial | Some narrow debt is fixed, but large route extraction and shim audit remain. |

## Current Pending Work
- Open and merge `feat/reservation-context-paste`, close #141, and create a `v1.21.0-beta.1` prerelease for testing.
- Continue #145 as the main real implementation backlog from the code-health audit.

## Objective
Evolve the RV reservation system into a fully offline-first desktop application using Tauri + SQLite, while preserving an architecture that can later support a web SaaS deployment (e.g. Firebase) via swappable infrastructure adapters.

## Execution Rules
- Follow `AGENTS.md` (Clean Architecture, storage abstraction, TDD, atomic commits).
- Execute issues in order unless an explicit blocker forces reprioritization.
- For behavior changes, add/update tests first.
- At the end of each epic, generate updated screenshots in `screenshots/` using Playwright automation.

## Epic 1: Clean Architecture Refactor (Foundational)

### Issue 1.1 - ~~Introduce layer folders and storage/application ports (no behavior change)~~ DONE
- Goal: Create the initial Clean Architecture structure and define storage interfaces/ports used by the app.
- Acceptance criteria:
  - Layer directories/modules exist for `domain`, `application`, `interface-adapters`, and `infrastructure`.
  - Reservation/app-data/admin-settings persistence interfaces are defined in application layer.
  - Existing UI still builds with no behavior change.
- Key files:
  - `src/lib/application/ports/*`
  - `src/lib/domain/*` (initial shared types re-export or migrated types)
  - `src/lib/infrastructure/*` (scaffold only)
  - `src/lib/types.ts` (bridge or migration shim if needed)
- Test additions:
  - Add/adjust compile-level import tests or minimal unit tests for port contracts (if harness exists).
  - Validate no regression via `npm run check` and `npm run build`.

### Issue 1.2 - ~~Move reservation validation/business rules into domain layer~~ DONE
- Goal: Relocate overlap/date/normalization logic into pure domain modules without UI coupling.
- Acceptance criteria:
  - Domain reservation validation and occupancy logic are pure and framework-independent.
  - Existing UI behavior unchanged.
  - Legacy imports replaced or shimmed cleanly.
- Key files:
  - `src/lib/domain/reservations/*`
  - `src/lib/reservations.ts` (compat shim or removed)
  - `src/lib/date.ts` / `src/lib/domain/date/*` (if migrated)
- Test additions:
  - Add domain tests for overlap rules and normalization.
  - Include adjacent-boundary non-overlap coverage.

### Issue 1.3 - ~~Introduce application use-cases for reservation and parking location mutations~~ DONE
- Goal: Move write operations from Svelte stores into application services/use-cases using repository ports.
- Acceptance criteria:
  - CRUD and parking location mutations are orchestrated by application use-cases.
  - Use-cases depend on ports, not LocalStorage.
  - UI/store delegates to adapters/use-cases and preserves behavior.
- Key files:
  - `src/lib/application/use-cases/*`
  - `src/lib/interface-adapters/*`
  - `src/lib/state.ts`
- Test additions:
  - Add use-case tests (save/edit/delete reservation, location rename/delete constraints).

### Issue 1.4 - ~~Introduce app composition root for choosing storage provider (LocalStorage default)~~ DONE
- Goal: Centralize dependency wiring and make storage provider selection explicit.
- Acceptance criteria:
  - A composition root wires application ports to a LocalStorage implementation by default.
  - UI/store imports composition root/facade instead of concrete storage helpers.
  - Swapping provider can be done in one place.
- Key files:
  - `src/lib/app/composition.ts` (or equivalent)
  - `src/lib/infrastructure/storage/localstorage/*`
  - `src/lib/state.ts`
  - `src/lib/site-settings.ts`
- Test additions:
  - Add adapter tests with an in-memory fake/localStorage stub.

## Epic 2: Playwright TDD Harness + CI

### Issue 2.1 - ~~Add Playwright test config, scripts, and deterministic local app launch~~ DONE
- Goal: Establish a repeatable Playwright test harness for local and CI runs.
- Acceptance criteria:
  - `playwright.config.*` exists and runs against local app.
  - `npm test` (or `npm run test:e2e`) executes Playwright tests.
  - Test output and screenshots/artifacts are stored in standard directories.
- Key files:
  - `playwright.config.ts`
  - `package.json`
  - `tests/e2e/*` (initial scaffold)
- Test additions:
  - Add smoke test that loads `/` and `/admin`.

### Issue 2.2 - ~~Add core user-flow Playwright tests (CRUD, overlap, TODAY, admin)~~ DONE
- Goal: Capture current expected behavior in end-to-end tests before larger platform changes.
- Acceptance criteria:
  - Playwright coverage exists for create/edit/delete reservation flow.
  - Overlap rejection flow is covered.
  - `TODAY` alignment behavior is verified.
  - `/admin` siteName + passcode flow is verified.
- Key files:
  - `tests/e2e/reservations.spec.ts`
  - `tests/e2e/admin.spec.ts`
  - `scripts/screenshot.mjs` (optional updates for reuse/helpers)
- Test additions:
  - The Playwright tests themselves (core required coverage).

### Issue 2.3 - ~~Add CI workflow for check/build/test~~ DONE
- Goal: Run typecheck/build/Playwright on CI for regression control.
- Acceptance criteria:
  - CI workflow runs `npm ci`, `npm run check`, `npm run build`, and Playwright tests.
  - CI stores Playwright artifacts on failure.
- Key files:
  - `.github/workflows/ci.yml`
- Test additions:
  - CI executes existing tests; no new functional tests required.

## Epic 3: Tauri Scaffolding

### Issue 3.1 - ~~Add Tauri project scaffold and desktop dev scripts~~ DONE
- Goal: Introduce Tauri workspace/config without breaking web build.
- Acceptance criteria:
  - `src-tauri/` scaffold exists with minimal app config.
  - `package.json` includes desktop dev/build scripts.
  - Existing web app still runs/builds.
- Key files:
  - `src-tauri/Cargo.toml`
  - `src-tauri/src/main.rs`
  - `src-tauri/tauri.conf.json`
  - `package.json`
- Test additions:
  - Add a basic smoke validation step/documented command for Tauri config (or CI TODO if platform blocked).

### Issue 3.2 - ~~Add infrastructure boundary for desktop capabilities (feature-flagged/no-op web fallback)~~ DONE
- Goal: Prepare a stable interface for desktop-only operations used later by SQLite adapter.
- Acceptance criteria:
  - Desktop capability interface is defined and injected through composition root.
  - Web fallback implementation exists and does not break current app.
- Key files:
  - `src/lib/application/ports/desktop.ts` (or equivalent)
  - `src/lib/infrastructure/desktop/*`
  - `src/lib/app/composition.ts`
- Test additions:
  - Add adapter tests for no-op web implementation behavior.

## Epic 4: SQLite Schema + Migrations

### Issue 4.1 - ~~Define SQLite schema for reservations, parking locations, admin settings, metadata~~ DONE
- Goal: Create normalized schema supporting current features and future migration/sync hooks.
- Acceptance criteria:
  - SQL schema includes tables for reservations, parking_locations, admin_settings, and schema metadata.
  - Constraints enforce key invariants where practical.
  - Date storage format is documented (ISO local calendar date strings).
- Key files:
  - `src/lib/infrastructure/storage/sqlite/schema.sql` (or migration files)
  - `docs/PLAN.md` (schema notes if needed)
- Test additions:
  - Add migration/schema tests (parse/apply SQL in test environment if possible, otherwise verify statements via integration harness later).

### Issue 4.2 - ~~Add migration runner abstraction and initial migration set~~ DONE
- Goal: Version database schema and enable future upgrades safely.
- Acceptance criteria:
  - Migration runner tracks applied versions.
  - Initial migration creates current schema.
  - Re-running migrations is idempotent/safe.
- Key files:
  - `src/lib/infrastructure/storage/sqlite/migrations/*`
  - `src/lib/infrastructure/storage/sqlite/migrator.*`
- Test additions:
  - Add migration runner tests for fresh DB and already-migrated DB.

## Epic 5: SQLite Storage Provider + Adapter Wiring

### Issue 5.1 - ~~Implement SQLite repositories for app data (reservations + parking locations)~~ DONE
- Goal: Provide concrete SQLite repository implementations behind application ports.
- Acceptance criteria:
  - Reservation and parking location reads/writes work through SQLite adapter.
  - Data shape matches current application expectations.
  - No UI layer imports SQLite directly.
- Key files:
  - `src/lib/infrastructure/storage/sqlite/*repository*`
  - `src/lib/application/ports/*`
- Test additions:
  - Add repository integration tests against a test SQLite database.

### Issue 5.2 - ~~Wire provider selection to choose SQLite in Tauri and LocalStorage in web/dev~~ DONE
- Goal: Swap storage implementation by runtime platform/composition without changing use-cases.
- Acceptance criteria:
  - Tauri desktop path selects SQLite provider.
  - Web/dev path selects LocalStorage provider.
  - Existing user flows remain green in Playwright tests.
- Key files:
  - `src/lib/app/composition.ts`
  - `src/lib/infrastructure/storage/localstorage/*`
  - `src/lib/infrastructure/storage/sqlite/*`
- Test additions:
  - Add composition tests for provider selection.
  - Re-run and keep Playwright core flows passing.

## Epic 6: Admin Settings Stored in DB

### Issue 6.1 - ~~Add admin settings repository port/use-cases and move settings logic out of route store~~ DONE
- Goal: Bring admin settings into the same Clean Architecture stack used by reservations.
- Acceptance criteria:
  - `siteName` and `adminPasscode` flow through application ports/use-cases.
  - `/admin` route uses adapters/facade, not direct storage helpers.
  - Web/local behavior unchanged.
- Key files:
  - `src/lib/application/use-cases/admin/*`
  - `src/lib/interface-adapters/admin/*`
  - `src/lib/site-settings.ts`
  - `src/routes/admin/+page.svelte`
- Test additions:
  - Add use-case tests for save/load/update passcode/siteName.
  - Maintain Playwright admin flow tests.

### Issue 6.2 - ~~Persist admin settings in SQLite provider and align schema usage~~ DONE
- Goal: Store admin settings in SQLite for desktop mode using the same port contract.
- Acceptance criteria:
  - SQLite implementation persists `siteName` and `adminPasscode`.
  - Admin route behavior matches LocalStorage provider behavior.
- Key files:
  - `src/lib/infrastructure/storage/sqlite/*admin*`
  - `src/lib/infrastructure/storage/localstorage/*admin*`
  - `src/lib/app/composition.ts`
- Test additions:
  - Add SQLite repository tests for admin settings.
  - Re-run Playwright `/admin` tests.

## Epic 7: Packaging for Windows/macOS

### Issue 7.1 - ~~Desktop packaging configuration and signing placeholders~~ DONE
- Goal: Prepare Tauri packaging configuration for Windows/macOS builds.
- Acceptance criteria:
  - Tauri bundle targets configured for Windows and macOS.
  - Signing/notarization placeholders/documentation are added (no secrets committed).
  - Build commands are documented.
- Key files:
  - `src-tauri/tauri.conf.json`
  - `README.md`
  - `docs/release.md` (new, optional)
- Test additions:
  - Add packaging smoke checklist (manual/CI matrix TODO as applicable).

### Issue 7.2 - ~~Release verification checklist and artifact naming conventions~~ DONE
- Goal: Standardize release outputs and manual verification steps.
- Acceptance criteria:
  - Documented checklist covers install, launch, persistence, and core reservation/admin flows.
  - Artifact naming/versioning conventions defined.
- Key files:
  - `docs/release.md`
- Test additions:
  - No new automated tests; ensure existing Playwright suite is part of release checklist.

## Epic 8 (Stretch): Optional Sync Interface (No Implementation Yet)

### Issue 8.1 - ~~Define sync port/contracts and conflict metadata model (interfaces only)~~ DONE
- Goal: Create a future-ready sync interface without implementing any remote sync provider.
- Acceptance criteria:
  - Sync-related ports/contracts are defined in application layer only.
  - Domain/application models include any required metadata hooks (e.g., updatedAt/version/source) without enabling sync behavior yet.
  - No Firebase/network SDK added.
- Key files:
  - `src/lib/application/ports/sync.ts`
  - `src/lib/domain/*` (metadata additions if needed)
  - `docs/architecture.md` (optional, new)
- Test additions:
  - Add unit tests for sync contract mappers/metadata defaults if code is introduced.

## Planned Execution Order (Atomic Commit Sequence)
1. Epic 1 (issues 1.1 -> 1.4)
2. Epic 2 (issues 2.1 -> 2.3)
3. Epic 3 (issues 3.1 -> 3.2)
4. Epic 4 (issues 4.1 -> 4.2)
5. Epic 5 (issues 5.1 -> 5.2)
6. Epic 6 (issues 6.1 -> 6.2)
7. Epic 7 (issues 7.1 -> 7.2)
8. Epic 8 stretch (issue 8.1)

## Milestone Artifacts (Per Epic)
At the end of each epic:
- Run `npm run check`
- Run `npm run build` (and `npm test` / Playwright as applicable)
- Generate/update screenshots in `screenshots/` via Playwright automation (`scripts/screenshot.mjs` may be adapted)
- Commit the epic-completing issue separately from follow-up fixes when feasible
