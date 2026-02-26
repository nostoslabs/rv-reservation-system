# RV Reservation Demo (SvelteKit)

Spreadsheet-style RV reservation working sheet demo built with SvelteKit and browser `localStorage` only (no backend).

## Features

- Working sheet grid: rows = parking locations, columns = dates
- Sticky first column and sticky top two rows
- `TODAY` button in working-sheet row 1 / column 4 behavior (realigns view so visible row2 col2 is today)
- Reservation CRUD via double-click cell modal (save / cancel / delete)
- Reservation fields include name, phone number, and notes (notes capped at 128 chars)
- Overlap validation (allows back-to-back reservations where end date == next start date)
- LocalStorage persistence with immediate save + periodic autosave (15 min) + tab-close save
- Autosave status indicator
- Parking location management (add / rename / delete with safety checks)
- Hidden `/admin` route for browser-local site name + admin passcode settings

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

## How to Use

- Double-click an empty cell to create a reservation (start date + parking location prefilled from the clicked cell)
- Double-click a colored reservation cell to edit that reservation
- Optional reservation phone number and notes are shown in the cell tooltip/title when present
- Use the modal `Save`, `Cancel`, and `Delete` buttons
- Use the `TODAY` button (first row, fourth column) to realign the view to today
- Manage parking locations in the panel on the left (or top on narrow screens)
- To access the hidden admin page, manually navigate to `/admin` in the browser URL (no visible link in normal UI)

## Data Persistence (LocalStorage)

Reservation data is stored in LocalStorage under `rv-reservation-demo:v1`.
Admin/site settings (site name + passcode) are stored separately under `rv-reservation-demo:settings:v1`.

To reset demo data:
- Open browser devtools
- Clear LocalStorage for the site origin
- Refresh the page

## Notes

- Dates are stored as `YYYY-MM-DD` and rendered in the working sheet as `dd/mm/yyyy`
- End date is exclusive (cells are filled from start date inclusive to end date exclusive)
- The date grid is generated as a long rolling horizon around today for demo purposes
- `/admin` passcode protection is intentionally lightweight and intended only to hide casual access in this demo
