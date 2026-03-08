# AGENTS.md

## Purpose
This repository is being evolved from a browser-only SvelteKit demo into an offline-first desktop app (Tauri + SQLite) while preserving a clean path to a future web SaaS deployment (Firebase or another cloud backend).

These instructions apply to both human contributors and Codex agents.

## Core Engineering Rules
- Follow Clean Architecture (Uncle Bob).
- Prefer small, atomic changes and small, meaningful commits.
- Use TDD: write or update tests first when adding/changing behavior.
- Preserve working behavior during refactors (no-behavior-change commits where possible).
- Keep UI components reusable and focused on presentation/interactions, not persistence details.

## Architecture Requirements (Mandatory)
Use explicit layers and dependency direction:
- `domain/`: entities, value objects, pure business rules, invariants, domain services.
- `application/` (use-cases): orchestration, commands/queries, ports (interfaces), transaction boundaries.
- `interface-adapters/`: presenters, controllers, view models, mapping between UI and use-cases.
- `infrastructure/`: concrete implementations (SQLite, LocalStorage, Firebase later, filesystem, Tauri bindings).

Rules:
- Dependencies point inward only.
- `domain` must not import Svelte, Tauri, browser APIs, SQLite libraries, or Firebase SDKs.
- `application` depends on `domain` and port interfaces only.
- UI/routes/components must call application/use-cases through adapters/facades, not infrastructure directly.
- Infrastructure implements interfaces defined in `application` (or domain ports where appropriate).

## Storage & Persistence Rules (Mandatory)
Storage must be abstracted behind interfaces/ports.
- Define repository/service interfaces for reservations, parking locations, and admin settings.
- Provide swappable implementations:
  - SQLite (desktop/Tauri target)
  - LocalStorage (developer/browser fallback)
- Do not call `window.localStorage` directly from routes/components/stores.
- Do not import SQLite/Tauri APIs outside infrastructure adapters.
- Keep serialization/deserialization in infrastructure, not domain entities.
- Plan for migrations/versioning from the start.

Recommended shape (adapt to repo conventions):
- `src/lib/domain/...`
- `src/lib/application/...`
- `src/lib/interface-adapters/...`
- `src/lib/infrastructure/storage/localstorage/...`
- `src/lib/infrastructure/storage/sqlite/...` (scaffold first; wire when Tauri is introduced)

## Testing Policy (Mandatory)
### TDD workflow
1. Add/adjust a failing test.
2. Implement the minimal change.
3. Refactor while keeping tests green.

### Visual verification for UI changes (Mandatory)
After every UI change, run a visual Playwright test to verify the impact:
1. Take a Playwright screenshot of the affected area before making the change (baseline).
2. Make the UI change.
3. Take a new Playwright screenshot and compare against the baseline.
4. Confirm the change looks correct and has no unintended visual side effects.
5. If the change affects multiple viewports or states, capture screenshots for each.

Use `page.screenshot()` for full-page captures or `locator.screenshot()` for component-level captures. Store visual verification screenshots in `screenshots/` with descriptive names.

### Test layers
- Domain/application logic: fast tests (pure logic, validation, overlap rules, date logic).
- UI integration / end-to-end: Playwright.

### Required Playwright coverage (minimum core flows)
Add and maintain tests for:
- Reservation create flow
- Reservation edit flow
- Reservation delete flow
- Overlap rejection flow
- `TODAY` alignment behavior
- `/admin` site name and passcode flows

Notes:
- Prefer deterministic fixtures and seeded storage states.
- Screenshots for milestone documentation should come from Playwright automation.
- When changing user-visible flows, update Playwright tests first (or in the same commit before implementation changes).

## Commit Discipline (Mandatory)
- Make incremental atomic commits.
- Commit messages must be small and meaningful.
- Separate refactors from behavior changes where feasible.
- Separate test harness/setup from feature implementation.
- If a change spans multiple concerns, split into multiple commits.

Examples:
- `refactor: add storage repository interfaces`
- `test: add playwright reservation create flow`
- `feat: wire localstorage adapter through app repository`

## Feature Development Rules
When adding a feature:
- Add or update tests first.
- Reuse or extract UI components instead of duplicating markup.
- Keep component props/events stable and explicit.
- Move business logic out of Svelte components into domain/application layers.
- Prefer adapters/facades for UI state orchestration rather than direct persistence calls.

## Tauri + SaaS Path Guidance
Design choices must support both desktop and future web:
- Keep an application-facing storage port that is backend-agnostic.
- Avoid Tauri-only assumptions in domain/application layers.
- Treat sync as an optional interface (contract) layered above repositories.
- Keep IDs and timestamps compatible with future remote sync and conflict resolution.

## Definition of Done (Per Issue)
- Tests added/updated first and passing (where harness exists for the layer touched).
- `npm run check` passes.
- `npm run build` passes for UI-affecting changes.
- Docs/plan updated if scope or sequencing changed.
- Atomic commit created.

## Working Agreement for Codex Agents
- Read this file and `docs/PLAN.md` before editing.
- Execute issues in documented order unless user requests a reorder.
- Report what issue is being executed and what tests/checks were run.
- Do not batch multiple major issues into one commit.
- After each epic completion, generate/update screenshots in `screenshots/` via Playwright (`scripts/screenshot.mjs` may be reused or revised).

## Dev Commands (Quick Reference)
| Command | Purpose |
|---------|---------|
| `npm run dev` | Web dev server (Vite, hot reload) at localhost:5173 |
| `npm run tauri:dev` | Tauri desktop app (compiles Rust + launches window) |
| `npm run build` | Production web build (outputs to `build/`) |
| `npm run tauri:build` | Production Tauri desktop build |
| `npm run check` | Svelte type-check + lint |
| `npm run test` | Playwright e2e tests |
| `npm run test:unit` | Vitest unit tests |

## Current Repository Notes
- Existing app is SvelteKit with browser LocalStorage persistence.
- Current coupling exists in `src/lib/state.ts`, `src/lib/storage.ts`, and `src/lib/site-settings.ts`.
- Admin settings are currently stored separately from reservation app data.
- Migration work should preserve current UX while moving logic into clean layers incrementally.
