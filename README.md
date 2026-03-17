# RV Reservation System

Offline-first RV park reservation management built with SvelteKit, Tauri, and SQLite. Includes a web deployment via Vercel and cross-platform desktop builds (macOS, Windows, Linux).

## Features

- Working sheet grid: rows = parking locations, columns = dates
- Sticky first column and sticky top two rows
- `TODAY` button realigns view so visible row2 col2 is today
- Reservation CRUD via double-click cell modal (save / cancel / delete)
- Reservation fields include name, phone number, and notes (notes capped at 128 chars)
- Overlap validation (allows back-to-back reservations where end date == next start date)
- Customer management with contact details
- Colorblind-safe palette with status icons
- LocalStorage persistence (web) / SQLite persistence (desktop)
- Autosave status indicator
- Parking location management (add / rename / delete with safety checks)
- JSON backup export and import
- Settings page for site name and display preferences

## Run Locally

Prerequisites:
- Node.js 18+ (Node 20+ recommended)
- npm

Install and start:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Build / Check

```bash
npm run check
npm run build
```

## Desktop Build (Tauri)

```bash
npm run tauri:dev    # Development mode
npm run tauri:build  # Production installer
```

## How to Use

- Double-click an empty cell to create a reservation (start date + parking location prefilled from the clicked cell)
- Double-click a colored reservation cell to edit that reservation
- Optional reservation phone number and notes are shown in the cell tooltip/title when present
- Use the modal `Save`, `Cancel`, and `Delete` buttons
- Use the `TODAY` button (first row, fourth column) to realign the view to today
- Manage parking locations in the panel on the left (or top on narrow screens)
- Navigate to `/admin` for site name and display preferences

## Data Persistence

### Web (LocalStorage)
Reservation data is stored in LocalStorage under `rv-reservation-demo:v1` (legacy key, kept for backward compatibility).
Settings are stored separately under `rv-reservation-demo:settings:v1`.

### Desktop (SQLite)
Data is persisted locally via SQLite through the Tauri runtime.

## Notes

- Dates are stored as `YYYY-MM-DD` and rendered in the working sheet as `dd/mm/yyyy`
- End date is exclusive (cells are filled from start date inclusive to end date exclusive)
- The date grid is generated as a rolling horizon around today
