# AGENTS.md

## Purpose
An offline-first desktop RV park reservation management app (Tauri + SQLite) with a clean path to a future web SaaS deployment (Firebase or another cloud backend).

These instructions apply to both human contributors and Coding agents.

## Core Engineering Rules
- Follow Clean Architecture (Uncle Bob) and a pragmatic approach to domain driven design. 
- Prefer small, atomic changes and small, meaningful commits.
- Use TDD: write or update tests first when adding/changing behavior.
- Preserve working behavior during refactors (no-behavior-change commits where possible).
- Keep UI components reusable and focused on presentation/interactions, not persistence details.
- Use `docs/coding_standards.md` as the shared code-health rubric for architecture boundaries, module size, deletion-first refactoring, tests, and anti-AI-slop checks.

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
6. Where applicable, convert playwright testing you're doing via playwright or the playwright MCP into end to end tests if it makes sense.

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

### Notes:
- Prefer deterministic fixtures and seeded storage states.
- Screenshots for milestone documentation should come from Playwright automation.
- When changing user-visible flows, update Playwright tests first (or in the same commit before implementation changes).

## Code-Health Guardrails
- Run `npm run code-health:changed` while editing to catch changed-file guardrail failures.
- Run `npm run code-health:full` before opening a PR; CI runs the same full check.
- Keep code-health detector logic in `scripts/code-health.mjs` so Claude Code hooks, opencode plugins, local wrappers, and CI share the same checks.
- Treat `docs/code_health_audit_2026-05.md` as the current follow-up punch list; do not mix those refactors into unrelated issues.

## Branch & PR Workflow (Mandatory)
- **Never commit directly to `main`.** Always work from a feature branch.
- Branch naming: `<type>/<short-description>` (e.g. `feat/customer-management`, `fix/overlap-validation`, `refactor/storage-ports`).
- Push the branch to origin and open a pull request via `gh pr create`.
- PRs must pass all checks (type-check, unit tests, build) before merging.
- Use squash-merge or regular merge per PR size — avoid force-pushing to shared branches.

### PR Labeling (Mandatory)
Label every PR with at least one category label. These labels drive auto-generated release notes (configured in `.github/release.yml`).

| Label | When to use |
|-------|-------------|
| `enhancement` or `feat` | New features or capabilities |
| `bug` or `fix` | Bug fixes |
| `ui` or `design` or `accessibility` | Visual, layout, or accessibility changes |
| `chore` or `dependencies` or `refactor` | Maintenance, dependency updates, internal refactors |

PR titles should be clear and descriptive — they appear as line items in release notes. Use conventional commit style (e.g. `feat: add customer search`, `fix: overlap validation off-by-one`).

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

## Versioning (Mandatory)
- Bump the version as the **last commit** on the feature branch before merging — not in a separate PR.
- All three files must match: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
- After merge to `main`, tag a beta first (`git tag vX.Y.Z-beta.1 && git push origin vX.Y.Z-beta.1`) to trigger the desktop prerelease workflow for Windows/macOS testing.
- Do not tag a stable `vX.Y.Z` release until a matching published `vX.Y.Z-beta.N` prerelease exists with macOS and Windows artifacts.
- After beta testing passes, tag the same validated merge commit with `vX.Y.Z` (`git tag vX.Y.Z && git push origin vX.Y.Z`). Stable tag pushes are intentionally inert for the release workflow.
- Stable releases require manual workflow dispatch plus exact tag-specific consent: `I consent to publish stable release vX.Y.Z`. The release workflow enforces this through `node scripts/release-guard.mjs`.
- Use semantic versioning: `feat` = minor bump, `fix` = patch bump.

## Definition of Done (Per Issue)
- Work done on a feature branch, not `main`.
- Tests added/updated first and passing (where harness exists for the layer touched).
- `npm run check` passes.
- `npm run build` passes for UI-affecting changes.
- Version bumped in `package.json`, `tauri.conf.json`, and `Cargo.toml` (last commit on branch).
- Docs/plan updated if scope or sequencing changed.
- Atomic commit(s) created.
- PR opened via `gh pr create` for review/merge.

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
| `npm run code-health` | Changed-file code-health checks |
| `npm run code-health:changed` | Changed-file code-health checks for local hooks |
| `npm run code-health:full` | Full code-health audit, including Knip |
| `npm run test` | Playwright e2e tests |
| `npm run test:unit` | Vitest unit tests |

## Current Repository Notes
- Existing app is SvelteKit with browser LocalStorage persistence.
- Current coupling exists in `src/lib/state.ts`, `src/lib/storage.ts`, and `src/lib/site-settings.ts`.
- Admin settings are currently stored separately from reservation app data.
- Migration work should preserve current UX while moving logic into clean layers incrementally.

## Code Comments and Narration
- NEVER add any meta-narrative, explanatory, historical, or process comments in source code.
- Do not reference previous designs, cleanups, "theater", CDD slices/specs, "removed", "reset branch", agent loops, why something was changed, "vestigial", "over-engineering", or any narration of development decisions or history.
- Comments (if any) must be strictly functional: only describe what the current code does right now, using precise current terminology. Prefer zero comments.
- All such narration must live only in commit messages, PR descriptions, or external docs — never in .php, .ts, .md (except AGENTS.md itself), or any checked-in source.
- This rule exists to prevent stale comments, agent confusion loops, and code bloat. Violating it causes exactly the problems described in the repo history.
- When editing, remove any existing meta-narration you encounter. Code must not explain its own evolution.



## Interpreting User Requests and Inputs

When you receive any message, query, or task description from a user, always begin by internally evaluating the input for the user's task imperative (the core action or outcome they want you to deliver), referent specification (the specific details, context, constraints, goals, or underlying needs defining what they actually intend), and commitment shape (the desired form, format, level of detail, style, length, or structure of the response or deliverable).

If the task imperative, referent specification, or commitment shape is absent or under-specified, pause and seek direct clarification from the user before providing a complete answer or taking significant action. Use only friendly, natural, everyday language in your response—never reference any internal research concepts, specialized vocabulary, or framework terms. Keep your tone warm, helpful, and conversational, as if you're a supportive colleague who wants to get things exactly right for them.

Phrase your clarification questions to target the unclear component (task imperative, referent specification, or commitment shape) specifically and directly, while inviting the user to fill it in easily. For instance:

- When the requested action or goal is vague: "To make sure I focus on exactly what you need, could you tell me what you're hoping I'll do or produce here?"
- When more details about the situation would help: "It would be great if you could share a little more about the specific context, requirements, or what success would look like for you."
- When the desired response style isn't clear: "How would you like me to present this—perhaps as a numbered list, a detailed walkthrough, a quick summary, some options to choose from, or in another particular way?"

Only move forward with a full response once you have a solid grasp of the user's task imperative, referent specification, and commitment shape. This approach helps us avoid misunderstandings and deliver something that truly fits what the user has in mind.

This guidance applies to all user interactions while working in or with this repository.
