# RV Reservation Demo Plan

## Scope
Build a demoable browser-only RV reservation system as a SvelteKit app with LocalStorage persistence, spreadsheet-like grid UX (sticky top rows + sticky first column), reservation CRUD modal, validation, autosave indicator, and parking location management.

## Assumptions
- Single-user demo app; no backend or multi-user sync.
- Dates are handled as local calendar days using deterministic `YYYY-MM-DD` storage and UTC-safe day math.
- SvelteKit app can run in SPA mode for demo purposes.

## Epic 1: Project Foundation & App Shell

### Issue 1.1 - Scaffold SvelteKit/TypeScript project files
- Goal: Create a runnable SvelteKit project skeleton with TypeScript and baseline config.
- User-visible behavior: `npm run dev` starts a SvelteKit app and renders a page.
- Acceptance criteria:
  - `package.json` includes SvelteKit scripts (`dev`, `build`, `preview`, `check`).
  - Required config files exist (`svelte.config.js`, `vite.config.ts`, `tsconfig.json`).
  - Root route renders without runtime errors.
- Key files touched/created:
  - `package.json`
  - `svelte.config.js`
  - `vite.config.ts`
  - `tsconfig.json`
  - `src/app.html`
  - `src/routes/+layout.svelte`
  - `src/routes/+page.svelte`
  - `src/app.d.ts`
- Notes:
  - Keep dependencies minimal and compatible with local-only demo.
  - Prefer static adapter / SPA-friendly configuration.

### Issue 1.2 - Base styles and layout shell
- Goal: Establish simple, clean styling and app layout primitives used by the grid and modals.
- User-visible behavior: Page has a polished frame, readable typography, and responsive layout.
- Acceptance criteria:
  - Global CSS variables and base styles applied.
  - Main page layout supports full-width scrollable content area.
  - Styles remain usable on mobile and desktop.
- Key files touched/created:
  - `src/app.css`
  - `src/routes/+layout.svelte`
  - `src/routes/+page.svelte`
- Notes:
  - Keep styling simple, avoid framework dependency.

## Epic 2: Domain Model, Date Utilities, and Persistence

### Issue 2.1 - Implement deterministic date utility module
- Goal: Provide safe date parsing/formatting/day arithmetic with no timezone drift.
- User-visible behavior: Dates display consistently and grid alignment is stable across reloads.
- Acceptance criteria:
  - Utilities support `YYYY-MM-DD` parsing/formatting for storage.
  - Utilities support `dd/mm/yyyy` display formatting for grid header.
  - Utilities support `addDays`, `diffDays`, and “today” as local date string.
- Key files touched/created:
  - `src/lib/date.ts`
- Notes:
  - Use UTC-normalized noon or explicit UTC day math; avoid JS implicit timezone parsing pitfalls.

### Issue 2.2 - Define reservation/parking types and validation logic
- Goal: Centralize reservation schema, color set, and business validation including overlap rules.
- User-visible behavior: Invalid entries show clear errors; overlapping reservations are blocked.
- Acceptance criteria:
  - Reservation type includes all required fields (`index`, `firstCellId`, `name`, `startDate`, `endDate`, `parkingLocation`, `color`).
  - Allowed colors constrained to required list.
  - Validation enforces non-empty name, end after start, valid location, and no overlap except adjacent end/start.
- Key files touched/created:
  - `src/lib/types.ts`
  - `src/lib/reservations.ts`
- Notes:
  - Keep logic independent of UI so it is testable.

### Issue 2.3 - LocalStorage persistence store with migrations/defaults
- Goal: Persist reservations, parking locations, view state, and autosave metadata in browser LocalStorage.
- User-visible behavior: Data survives refresh/reopen; default data appears on first load.
- Acceptance criteria:
  - Initial load seeds ~10 parking locations if none exist.
  - Reservation indices auto-increment and remain stable after reload.
  - Persist happens immediately on state changes.
  - Corrupt/partial LocalStorage data fails gracefully to defaults.
- Key files touched/created:
  - `src/lib/storage.ts`
  - `src/lib/state.svelte.ts` (or equivalent app store module)
- Notes:
  - Persisted shape should include version for future compatibility.

## Epic 3: Spreadsheet Grid Rendering

### Issue 3.1 - Render working sheet grid with sticky rows/column
- Goal: Build scrollable spreadsheet-like grid where rows are parking locations and columns are dates.
- User-visible behavior: User can scroll horizontally/vertically while top 2 rows and first column stay visible.
- Acceptance criteria:
  - Row 1 reserved for function buttons.
  - Row 2 shows perpetual calendar dates in `dd/mm/yyyy` format.
  - Column 1 shows parking locations; top-left cell shows current date.
  - Grid is scrollable and sticky behavior works in modern browsers.
- Key files touched/created:
  - `src/routes/+page.svelte`
  - `src/lib/components/Grid.svelte` (optional split)
- Notes:
  - Virtualization not required; fixed horizon is acceptable for demo.

### Issue 3.2 - Initial alignment and TODAY button behavior
- Goal: Ensure grid opens aligned to today and supports quick realignment via button in row1/col4.
- User-visible behavior: On open, today’s column is visible; clicking `TODAY` realigns so row2 col2 is today.
- Acceptance criteria:
  - On initial mount, horizontal scroll positions grid so date at row2/col2 equals current date.
  - `TODAY` button is placed in row1/col4 and performs same alignment.
  - Re-alignment is deterministic after resizing or edits.
- Key files touched/created:
  - `src/routes/+page.svelte`
  - `src/lib/components/Grid.svelte` (if used)
- Notes:
  - May require measuring cell width / querying target header cell.

### Issue 3.3 - Reservation cell painting and label display
- Goal: Display reservations across date ranges with color fill and name text in covered cells.
- User-visible behavior: Reservations appear as colored spans across the correct cells, excluding end date cell.
- Acceptance criteria:
  - Cells from `startDate` inclusive to `endDate` exclusive are filled.
  - Cell background matches reservation color.
  - Reservation name appears in occupied cells (at least on first cell; optionally repeated for readability).
  - Adjacent reservations on boundary dates render without overlap.
- Key files touched/created:
  - `src/routes/+page.svelte`
  - `src/lib/reservations.ts`
- Notes:
  - Keep lookup efficient enough for demo (index by location/date map if needed).

## Epic 4: Reservation CRUD Modal and Interactions

### Issue 4.1 - Double-click cell interaction and modal open states
- Goal: Open modal on double-click for empty/new or existing/edit reservation flows.
- User-visible behavior: Double-clicking a grid cell opens a modal with relevant fields prefilled.
- Acceptance criteria:
  - Double-click empty cell opens “new reservation” modal with start date + parking location prefilled.
  - Double-click occupied cell opens “edit reservation” modal with reservation values pre-populated.
  - Modal can be dismissed with cancel/overlay/escape (at minimum cancel).
- Key files touched/created:
  - `src/routes/+page.svelte`
  - `src/lib/components/ReservationModal.svelte`
- Notes:
  - Track selected cell context and selected reservation separately.

### Issue 4.2 - Save/Cancel/Delete actions wired to persistent state
- Goal: Complete CRUD workflows from modal controls.
- User-visible behavior: Users can add, edit, cancel, and delete reservations and see grid update immediately.
- Acceptance criteria:
  - Save creates a new reservation row with auto-incremented index when new.
  - Save updates existing reservation when editing.
  - Delete removes reservation and clears all associated grid cells.
  - Cancel closes modal without changing stored data.
- Key files touched/created:
  - `src/lib/state.svelte.ts` (or store module)
  - `src/lib/components/ReservationModal.svelte`
  - `src/routes/+page.svelte`
- Notes:
  - `firstCellId` should be generated deterministically from first occupied cell context.

### Issue 4.3 - Validation and inline error messaging in modal
- Goal: Prevent invalid reservations and give actionable feedback.
- User-visible behavior: Form shows clear errors and blocks save until valid.
- Acceptance criteria:
  - End date must be after start date.
  - Parking location must exist.
  - Overlaps are rejected with message naming conflicting reservation/location/date range.
  - Validation runs on save and surfaces errors without breaking modal state.
- Key files touched/created:
  - `src/lib/reservations.ts`
  - `src/lib/components/ReservationModal.svelte`
- Notes:
  - Keep UI messages concise and specific.

## Epic 5: Parking Location Management and Autosave UX

### Issue 5.1 - Parking location management panel
- Goal: Provide small UI to add/remove/rename parking locations.
- User-visible behavior: User can manage parking rows and see grid update accordingly.
- Acceptance criteria:
  - Default ~10 locations on first load.
  - Add location appends a new row.
  - Rename updates row label and reservation associations safely.
  - Delete blocks if reservations exist for that location or offers clear error.
- Key files touched/created:
  - `src/lib/components/ParkingLocationsPanel.svelte`
  - `src/lib/state.svelte.ts` (or store module)
  - `src/routes/+page.svelte`
- Notes:
  - Renaming should migrate reservation `parkingLocation` values.

### Issue 5.2 - Autosave indicator and close/unload flush behavior
- Goal: Show persistence status and satisfy autosave timing/close requirements.
- User-visible behavior: Indicator shows last save time, updates on changes, periodic heartbeat (<=15 min), and saves on tab close.
- Acceptance criteria:
  - State changes persist immediately and update status timestamp.
  - Indicator refreshes displayed text at least every 15 minutes (prefer more frequently for UX).
  - `beforeunload` triggers final persistence attempt.
- Key files touched/created:
  - `src/lib/storage.ts`
  - `src/lib/state.svelte.ts` (or store module)
  - `src/routes/+page.svelte`
- Notes:
  - Browser may limit async work in `beforeunload`; use synchronous LocalStorage write.

## Epic 6: Documentation and Verification

### Issue 6.1 - README and developer run instructions
- Goal: Document how to install, run, and demo the app locally.
- User-visible behavior: Developer can follow README to start app and understand features.
- Acceptance criteria:
  - README includes prerequisites, install/run/build commands.
  - README documents LocalStorage persistence and reset method.
  - README summarizes core interactions (double-click, TODAY button, parking management).
- Key files touched/created:
  - `README.md`
- Notes:
  - Mention browser support assumptions for sticky grid.

### Issue 6.2 - Smoke verification and completion event
- Goal: Validate demo app behavior and signal completion.
- User-visible behavior: N/A (developer workflow step).
- Acceptance criteria:
  - Run at least available checks (`npm run check` and/or `npm run build`) if dependencies can be installed.
  - Manually sanity-check key flows if runtime can be launched.
  - Run required completion command exactly as requested.
- Key files touched/created:
  - None (unless fixing issues discovered during verification)
- Notes:
  - If local environment prevents install/build, document blocker and what was verified statically.

## Suggested Execution Order (Implementation Sequence)
- 1.1 Scaffold project
- 1.2 Base styles
- 2.1 Date utilities
- 2.2 Types + validation
- 2.3 LocalStorage state
- 3.1 Grid skeleton + sticky behavior
- 3.2 Today alignment
- 3.3 Reservation rendering
- 4.1 Modal open flows
- 4.2 CRUD actions
- 4.3 Validation UX
- 5.1 Parking location management
- 5.2 Autosave indicator
- 6.1 README
- 6.2 Verification + completion event
