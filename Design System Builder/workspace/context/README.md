# Context — Drop Your Files Here

Place any files you want Claude to learn from in this folder.

## Accepted File Types

| Type | Extensions | Purpose |
|------|-----------|---------|
| Tokens | `.json`, `.tokens`, `.tokens.json` | Existing token/variable files |
| Docs | `.pdf`, `.md`, `.txt` | Brand guidelines, documentation |
| Styles | `.css`, `.scss`, `.less` | Existing stylesheets |
| Code | `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.svelte` | Component reference files |
| Config | `.yaml`, `.yml`, `.config.js`, `.config.ts` | Build configs (Tailwind, Vite, etc.) |
| Assets | `.svg`, `.png`, `.jpg`, `.webp` | Icons, logos, brand assets |

## Blocked File Types (Never Processed)

- Executables: `.exe`, `.app`, `.dmg`, `.msi`
- Scripts: `.sh`, `.bat`, `.cmd`, `.ps1`
- Secrets: `.env`, `.env.local`, `.pem`, `.key`, `.cert`
- Archives: `.zip`, `.tar`, `.gz`, `.rar`
- Databases: `.db`, `.sqlite`, `.sql`

## Size Limits

- Per file: 10 MB max
- Total folder: 100 MB max

## How It Works

1. Drop your files here
2. Tell Claude: "Learn from my context files"
3. Claude reads ONLY from this folder — nowhere else on your machine
4. All outputs go to `workspace/exports/`, `workspace/specs/`, or `workspace/reports/`
