# Antigravity Skills Web App - Cloudflare Deployment Guide

## Overview

The Antigravity Skills web app is a Vite + React 19 SPA that serves as a catalog browser for 950+ agentic AI skills. It has been retrofitted to run on **Cloudflare Workers** with **Workers Static Assets**, using **D1** for database storage, **Drizzle ORM** for database operations, **Hono** for API routing, and **KV** for caching skills data.

## Architecture

### Stack Components

- **Frontend**: Vite + React 19 (TypeScript)
- **Backend API**: Hono (running on Cloudflare Workers)
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Caching**: Cloudflare KV
- **Static Assets**: Cloudflare Workers Static Assets

### File Structure

```
web-app/
├── src/
│   ├── worker.ts              # Hono Worker entry point
│   ├── db/
│   │   └── schema.ts          # Drizzle ORM schema
│   ├── hooks/
│   │   └── useSkillStars.ts   # Updated to use fetch() API
│   └── ...                     # React app components
├── drizzle/
│   └── migrations/            # D1 migrations
├── drizzle.config.ts          # Drizzle configuration
├── wrangler.toml              # Cloudflare configuration
└── package.json               # Dependencies and scripts
```

## Prerequisites

1. **Cloudflare Account** with Workers access
2. **Node.js** v18+ and npm
3. **Wrangler CLI** (installed via `npm install`)

## Local Development

### 1. Install Dependencies

```bash
cd web-app
npm install
```

### 2. Run Development Server (Vite)

For local React development with hot module replacement:

```bash
npm run dev
```

This runs the Vite dev server with the `refresh-skills-plugin.js` that:
- Serves `/skills.json` from the repo root
- Serves `/skills/*` files from the repo
- Provides `/api/refresh-skills` endpoint

The plugin works exactly as before, ensuring backward compatibility.

### 3. Preview with Cloudflare Workers Runtime

To test the Worker locally with D1 and KV:

```bash
npm run preview:cf
```

This runs `wrangler dev` which simulates the Cloudflare Workers environment locally.

## Cloudflare Setup

### 1. Create D1 Database

```bash
npx wrangler d1 create skills-db
```

This will output something like:

```toml
[[d1_databases]]
binding = "DB"
database_name = "skills-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Update `wrangler.toml` with the `database_id`.

### 2. Create KV Namespace

```bash
npx wrangler kv namespace create SKILLS_CACHE
```

This will output:

```toml
[[kv_namespaces]]
binding = "SKILLS_CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Update `wrangler.toml` with the `id`.

### 3. Apply D1 Migrations

For local D1 database:

```bash
npm run migrate:apply
```

For remote (production) D1 database:

```bash
npm run migrate:apply:remote
```

## Deployment

### 1. Build the Frontend

```bash
npm run build
```

This creates the `dist/` folder with your React app.

### 2. Deploy to Cloudflare Workers

```bash
npm run deploy
```

Or manually:

```bash
npx wrangler deploy
```

This will:
1. Upload the Worker script (`src/worker.ts`)
2. Upload static assets from `dist/`
3. Bind D1 database and KV namespace
4. Deploy to Cloudflare's global network

## Environment Variables

### Optional: GitHub Token

To increase GitHub API rate limits for the `/api/refresh-skills` endpoint, set a GitHub token:

```bash
npx wrangler secret put GITHUB_TOKEN
```

When prompted, paste your GitHub personal access token.

## API Endpoints

The Hono Worker exposes the following endpoints:

### OpenAPI Documentation

- `GET /openapi.json` - OpenAPI 3.1.0 specification
- `GET /swagger` - Swagger UI
- `GET /scalar` - Scalar API documentation

### Star Management

- `GET /api/stars/:skillId` - Get star count for a skill
- `POST /api/stars/:skillId` - Increment star count

### Skills Data

- `GET /skills.json` - Get skills index (from KV or GitHub)
- `GET /skills/*` - Get skill files (from KV or GitHub)
- `POST /api/refresh-skills` - Sync skills from GitHub to KV

### Static Assets & SPA

- `GET /*` - Serve static assets or SPA fallback

## Database Schema

The D1 database has one table for skill stars:

```sql
CREATE TABLE skill_stars (
  skill_id TEXT PRIMARY KEY NOT NULL,
  star_count INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Run Vite dev server with hot reload |
| `build` | `tsc && vite build` | Build production assets |
| `deploy` | `wrangler deploy` | Deploy to Cloudflare Workers |
| `preview:cf` | `wrangler dev` | Preview with Workers runtime locally |
| `migrate:generate` | `drizzle-kit generate` | Generate new D1 migration |
| `migrate:apply` | `wrangler d1 migrations apply DB --local` | Apply migrations to local D1 |
| `migrate:apply:remote` | `wrangler d1 migrations apply DB --remote` | Apply migrations to remote D1 |

## Troubleshooting

### Build Errors

If you encounter TypeScript errors:

1. Ensure `@cloudflare/workers-types` is installed
2. Check that `tsconfig.json` includes `"types": ["@cloudflare/workers-types"]`

### D1 Database Not Found

If D1 operations fail:

1. Verify `database_id` in `wrangler.toml` matches your D1 database
2. Run migrations: `npm run migrate:apply:remote`

### KV Namespace Not Found

If KV operations fail:

1. Verify `id` in `wrangler.toml` under `[[kv_namespaces]]`
2. Create KV namespace if missing: `npx wrangler kv namespace create SKILLS_CACHE`

### Worker Not Serving Static Assets

If the SPA doesn't load:

1. Ensure `npm run build` completed successfully
2. Check that `[assets]` section in `wrangler.toml` points to `"./dist"`
3. Verify deployment included assets: `wrangler deployments list`

## Migration from Supabase

This app has been completely migrated from Supabase to Cloudflare:

- ❌ **Removed**: `@supabase/supabase-js`, `src/lib/supabase.ts`
- ✅ **Added**: Cloudflare D1, Drizzle ORM, Hono
- ✅ **Updated**: `useSkillStars` hook now uses `fetch()` API
- ✅ **Updated**: `SkillContext` no longer depends on Supabase

## Performance Considerations

- **Static Assets**: Served directly from Cloudflare's edge network
- **KV Caching**: Skills data is cached in KV for fast access
- **D1**: SQLite database replicated globally
- **SPA Fallback**: Client-side routing handled via Worker

## Security

- No authentication required for read operations
- Star increments tracked via localStorage (client-side only)
- GitHub sync uses optional token for rate limiting
- All API responses include proper CORS headers

## Support

For issues or questions:
- Check the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- Review [Drizzle ORM documentation](https://orm.drizzle.team/)
- See [Hono documentation](https://hono.dev/)
