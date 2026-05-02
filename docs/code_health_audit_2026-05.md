# Code-Health Audit - May 2026

## Scope
This is the initial follow-up punch list created with Issue 133. The issue adds standards and guardrails only; the findings below should be handled in separate focused refactor or fix issues.

## Follow-Up Findings

### Oversized UI Modules
These files are functioning legacy hotspots and should be split by responsibility before adding major new behavior:

| File | Current size | Suggested next step |
| --- | ---: | --- |
| `src/routes/+page.svelte` | 1681 lines | Move page orchestration/search/filtering state into an adapter facade and extract focused calendar controls. |
| `src/routes/admin/+page.svelte` | 959 lines | Split backup/update/admin-settings panels into focused components backed by application-facing state. |
| `src/routes/customers/+page.svelte` | 641 lines | Extract import/merge/search presentation pieces and keep page-level state thin. |
| `src/lib/components/ParkingLocationsPanel.svelte` | 635 lines | Separate list management, color editing, and destructive-action confirmation flows. |
| `src/lib/components/ReservationModal.svelte` | 600 lines | Extract field groups and availability/status presentation while keeping submit intent explicit. |

### Existing TODO
- `src/lib/app/startup-migrations.ts` disables auto-dedup after a cache/DB consistency bug. Resolve the consistency problem before re-enabling or remove the migration path if it is obsolete.

### Debug Logging
- `src/lib/infrastructure/desktop/tauri-capabilities.ts` still logs updater download/install events with `console.log`. Decide whether these should become structured diagnostics, debug-gated logs, or be removed.

### Legacy Bridge/Shim Files
Audit these after callers finish migrating to layered modules:

| File | Reason to audit |
| --- | --- |
| `src/lib/reservations.ts` | Backwards-compatibility re-export for domain reservation behavior. |
| `src/lib/types.ts` | Shared type bridge that still owns domain-adjacent constants and interfaces. |
| `src/lib/storage.ts` | Legacy LocalStorage persistence surface with serialization behavior that should stay in infrastructure. |

## Recommended Order
1. Remove or replace the updater debug logging.
2. Decide the startup migration path: fix and test it, or delete it.
3. Split `src/routes/+page.svelte` around adapter state and calendar controls.
4. Split admin and customer route panels after the main route split establishes the pattern.
5. Retire bridge/shim files only after import callers have moved cleanly.
