# Coding Standards and Code-Health Rubric

## Purpose
This document is the reusable audit rubric for repository health. Use it during implementation, review, and follow-up audits to keep the desktop app maintainable while preserving the future web/SaaS path.

The goal is not to block every imperfect legacy module immediately. The goal is to stop new drift, make debt visible, and prefer small corrective changes that move code toward the architecture in `AGENTS.md`.

## Clean Architecture
- Domain modules contain pure business rules, invariants, and value normalization. They do not import Svelte, browser APIs, Tauri APIs, SQLite, Firebase, or concrete storage.
- Application modules orchestrate use-cases through ports. They do not import UI components, route modules, LocalStorage, SQLite, Tauri bindings, or Firebase SDKs.
- Interface adapters translate UI intent and presentation state into application calls. They should own view-model mapping, not persistence details.
- Infrastructure modules implement application ports and contain serialization, deserialization, migrations, filesystem, Tauri, SQLite, and browser storage details.
- Route and component modules should call facades/adapters/use-cases. They should not call `window.localStorage`, SQLite, Tauri APIs, or filesystem APIs directly.
- Imports should point inward. If a layer needs outward behavior, define a port inward and implement it outward.

## Module Size and Shape
- Prefer modules with one clear reason to change. If a file needs unrelated headings to navigate it, it is probably doing too much.
- Treat Svelte route files over 600 lines as refactor candidates, and over 900 lines as high-priority candidates unless the file is intentionally generated.
- Treat reusable components over 500 lines as refactor candidates, especially when they mix layout, persistence orchestration, validation, and modal state.
- Split by responsibility before splitting by convenience: domain rules, application orchestration, adapter state, and presentation markup should not be interleaved.
- Avoid broad utility dumping grounds. Add helpers near their owning domain first, then extract only when reuse is real.
- Prefer shallow dependency trees. If a change requires reading several unrelated modules to understand one behavior, improve naming or boundaries before adding more abstraction.

## Deletion-First Refactoring
- Before adding a new abstraction, check whether dead code, compatibility shims, duplicated branches, or unused exports can be removed.
- Prefer deleting obsolete bridge files once callers have moved to the layered module that owns the behavior.
- Inline one-off helpers when the helper hides more than it clarifies.
- Keep no-behavior-change refactors separate from behavior changes when practical.
- Preserve public contracts until tests and callers prove a contract is unused.

## Test Discipline
- Add or update a failing test first for behavior changes.
- Domain and application behavior should use fast unit tests with deterministic fixtures.
- UI workflow changes should update Playwright coverage for the affected flow.
- Visual Playwright verification is required for UI changes; docs, CI, and tooling-only changes do not need visual screenshots.
- Do not weaken tests to match an implementation unless the behavior intentionally changed and the PR explains why.
- Prefer regression tests for fixed bugs. The test should fail against the bug, not merely exercise the surrounding code.

## Anti-AI-Slop Checks
- No placeholder implementations, fake fallbacks, or hidden no-op branches unless explicitly named as temporary and tracked.
- No assistant meta-commentary in committed code or docs.
- No speculative abstraction for possible future features unless the current architecture already needs the boundary.
- No broad catch-and-ignore error handling. Surface failures through explicit result types or user-facing error paths.
- No TODOs without enough context to act on them later. Prefer a linked issue, reason, and removal condition.
- No duplicated business rules in UI or infrastructure when a domain/application module already owns the rule.
- No generated-looking prose that does not help a maintainer make a decision.

## Code-Health Commands
- `npm run code-health:changed` checks changed files and runs heavier detectors when guardrail config changes.
- `npm run code-health:full` runs repository-wide checks, including Knip.
- `npm run code-health` is the default local alias for changed-file checks.

The shared runner is `scripts/code-health.mjs`. Claude Code hooks, opencode plugins, pre-commit wrappers, CI, and future Codex wrappers should call that script rather than duplicating detector logic.

## Audit Rating
- `Pass`: The change follows the layer boundaries, has appropriate tests, and does not add avoidable complexity.
- `Monitor`: The change is acceptable, but it touches a known large or transitional module. Add a follow-up note when useful.
- `Fail`: The change introduces direct storage/UI coupling across layers, untested behavior, placeholder code, dead code, or a new oversized mixed-responsibility module.
