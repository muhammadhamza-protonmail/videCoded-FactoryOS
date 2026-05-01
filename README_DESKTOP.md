# Factory Management Desktop (Electron)

This project now includes an Electron desktop wrapper that runs:

- backend API locally on `127.0.0.1:5000`
- frontend locally on `127.0.0.1:3000`
- SQLite from a writable desktop location

## 1) Branding setup

- Window/installer icon: `electron/assets/app.ico`
- Product metadata is configured in root `package.json` under `build`.

## 2) Runtime stability features

Desktop runtime now includes:

- single-instance lock (prevents duplicate hidden windows)
- automatic service restart if backend/frontend exits
- periodic health checks for backend (`5000`) and frontend (`3000`)
- clear startup and load failure dialogs

## 3) Data safety (SQLite backup/restore)

Automatic backup:

- one daily backup is created to Electron `userData/backups`
- up to 14 backups are retained

Manual backup/restore from root:

```bash
npm run desktop:backup
npm run desktop:restore
```

## 4) Release flow (recommended sequence)

Install deps once:

```bash
npm install
npm run desktop:deps
```

Test desktop app in production mode:

```bash
npm run desktop:start
```

Build Windows installer:

```bash
npm run desktop:pack
```

Installer output:

- `dist/FactoryOS.exe`

## Packaging notes

- Frontend is packaged from Next standalone output (`frontend/.next/standalone` + static/public), which keeps installer size much smaller than bundling full frontend `node_modules`.
- Backend keeps only production dependencies before packaging and rebuilds `sqlite3` against Electron runtime.

## If install build fails to start

Run these in PowerShell (as Administrator):

```bash
taskkill /F /IM FactoryOS.exe
taskkill /F /IM electron.exe
taskkill /F /IM node.exe
npm cache clean --force
rmdir /s /q dist
npm run desktop:deps
npm run desktop:pack
```

## Data paths at runtime

- Database is copied on first run to Electron `userData/data/database.sqlite`
- Uploads are stored in Electron `userData/uploads`
- Backups are stored in Electron `userData/backups`
