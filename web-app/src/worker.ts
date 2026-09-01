import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { skillStars } from './db/schema';

export interface Env {
  ASSETS: Fetcher;
  SKILLS_CACHE: KVNamespace;
  DB: D1Database;
  VECTOR_INDEX?: VectorizeIndex;
  GITHUB_TOKEN?: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware for API routes
app.use('/api/*', cors());

// OpenAPI specification route
app.get('/openapi.json', (c) => {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Antigravity Skills API',
      version: '1.0.0',
      description: 'API for managing Antigravity Skills catalog and stars',
    },
    servers: [
      {
        url: new URL(c.req.url).origin,
        description: 'Skills API Server',
      },
    ],
    paths: {
      '/api/stars/{skillId}': {
        get: {
          summary: 'Get star count for a skill',
          parameters: [
            {
              name: 'skillId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      skillId: { type: 'string' },
                      starCount: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: 'Increment star count for a skill',
          parameters: [
            {
              name: 'skillId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      skillId: { type: 'string' },
                      starCount: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/refresh-skills': {
        post: {
          summary: 'Refresh skills data from GitHub',
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      upToDate: { type: 'boolean' },
                      count: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
  return c.json(spec);
});

// Swagger UI
app.get('/swagger', (c) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Antigravity Skills API - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>
  `;
  return c.html(html);
});

// Scalar UI
app.get('/scalar', (c) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Antigravity Skills API - Scalar</title>
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>
  `;
  return c.html(html);
});

// Get star count for a skill
app.get('/api/stars/:skillId', async (c) => {
  try {
    const skillId = c.req.param('skillId');
    const db = drizzle(c.env.DB);

    const result = await db
      .select()
      .from(skillStars)
      .where(eq(skillStars.skillId, skillId))
      .limit(1);

    if (result.length === 0) {
      return c.json({ skillId, starCount: 0 });
    }

    return c.json({
      skillId: result[0].skillId,
      starCount: result[0].starCount,
    });
  } catch (error) {
    console.error('Error fetching star count:', error);
    return c.json({ error: 'Failed to fetch star count' }, 500);
  }
});

// Increment star count for a skill
app.post('/api/stars/:skillId', async (c) => {
  try {
    const skillId = c.req.param('skillId');
    const db = drizzle(c.env.DB);

    // Check if record exists
    const existing = await db
      .select()
      .from(skillStars)
      .where(eq(skillStars.skillId, skillId))
      .limit(1);

    let newCount: number;

    if (existing.length === 0) {
      // Insert new record
      await db.insert(skillStars).values({
        skillId,
        starCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      newCount = 1;
    } else {
      // Update existing record
      newCount = existing[0].starCount + 1;
      await db
        .update(skillStars)
        .set({
          starCount: newCount,
          updatedAt: new Date(),
        })
        .where(eq(skillStars.skillId, skillId));
    }

    return c.json({
      skillId,
      starCount: newCount,
    });
  } catch (error) {
    console.error('Error incrementing star count:', error);
    return c.json({ error: 'Failed to increment star count' }, 500);
  }
});

// Refresh skills from GitHub
app.post('/api/refresh-skills', async (c) => {
  try {
    const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main';
    const GITHUB_API_BASE = 'https://api.github.com/repos/sickn33/antigravity-awesome-skills/commits/main';

    // Check latest SHA
    const headers: Record<string, string> = {
      'User-Agent': 'antigravity-skills-app',
    };

    if (c.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${c.env.GITHUB_TOKEN}`;
    }

    const commitRes = await fetch(GITHUB_API_BASE, { headers });

    if (!commitRes.ok) {
      throw new Error(`GitHub API error: ${commitRes.status}`);
    }

    const commitData = await commitRes.json() as { sha: string };
    const latestSha = commitData.sha;

    // Check cached SHA
    const cachedSha = await c.env.SKILLS_CACHE.get('latest-sha');

    if (cachedSha === latestSha) {
      return c.json({ success: true, upToDate: true });
    }

    // Fetch skills_index.json
    const indexUrl = `${GITHUB_RAW_BASE}/skills_index.json`;
    const indexRes = await fetch(indexUrl, { headers });

    if (!indexRes.ok) {
      throw new Error(`Failed to fetch skills_index.json: ${indexRes.status}`);
    }

    const skillsIndex = await indexRes.text();
    const skillsData = JSON.parse(skillsIndex);
    const count = Array.isArray(skillsData) ? skillsData.length : 0;

    // Store in KV
    await c.env.SKILLS_CACHE.put('skills_index.json', skillsIndex);
    await c.env.SKILLS_CACHE.put('latest-sha', latestSha);

    return c.json({ success: true, upToDate: false, count });
  } catch (error) {
    console.error('Error refreshing skills:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// Serve /skills.json from KV or GitHub
app.get('/skills.json', async (c) => {
  try {
    // Try KV first
    const cached = await c.env.SKILLS_CACHE.get('skills_index.json');
    if (cached) {
      return c.json(JSON.parse(cached));
    }

    // Fallback to GitHub
    const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main';
    const response = await fetch(`${GITHUB_RAW_BASE}/skills_index.json`);

    if (!response.ok) {
      return c.json({ error: 'Skills data not available' }, 404);
    }

    const data = await response.text();

    // Cache for next time
    await c.env.SKILLS_CACHE.put('skills_index.json', data);

    return c.json(JSON.parse(data));
  } catch (error) {
    console.error('Error serving skills.json:', error);
    return c.json({ error: 'Failed to load skills data' }, 500);
  }
});

// Serve /skills/* files from KV or GitHub
app.get('/skills/*', async (c) => {
  try {
    const path = c.req.path; // e.g., /skills/skill-name/SKILL.md

    // Try KV first
    const cached = await c.env.SKILLS_CACHE.get(path);
    if (cached) {
      const ext = path.split('.').pop()?.toLowerCase() || '';
      const contentType = getContentType(ext);
      return new Response(cached, {
        headers: { 'Content-Type': contentType },
      });
    }

    // Fallback to GitHub
    const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main';
    const response = await fetch(`${GITHUB_RAW_BASE}${path}`);

    if (!response.ok) {
      return c.notFound();
    }

    const content = await response.text();

    // Cache for next time
    await c.env.SKILLS_CACHE.put(path, content);

    const ext = path.split('.').pop()?.toLowerCase() || '';
    const contentType = getContentType(ext);

    return new Response(content, {
      headers: { 'Content-Type': contentType },
    });
  } catch (error) {
    console.error('Error serving skill file:', error);
    return c.notFound();
  }
});

// Static asset serving and SPA fallback
app.get('*', async (c) => {
  try {
    // Try to serve static asset
    const response = await c.env.ASSETS.fetch(c.req.raw);

    if (response.status === 404) {
      // Check if request accepts HTML (browser request)
      const acceptHeader = c.req.header('accept') || '';
      if (acceptHeader.includes('text/html')) {
        // Serve index.html for SPA routing
        const indexUrl = new URL('/index.html', c.req.url);
        return c.env.ASSETS.fetch(new Request(indexUrl, c.req.raw));
      }
    }

    return response;
  } catch (error) {
    console.error('Error serving asset:', error);

    // Fallback to index.html
    try {
      const indexUrl = new URL('/index.html', c.req.url);
      return c.env.ASSETS.fetch(new Request(indexUrl, c.req.raw));
    } catch {
      return c.text('Not found', 404);
    }
  }
});

// Helper function to determine content type
function getContentType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    md: 'text/markdown',
    txt: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    xml: 'text/xml',
    py: 'text/plain',
    sh: 'text/plain',
    bat: 'text/plain',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export default app;
