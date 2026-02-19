import { Hono } from 'hono';
import { z } from 'zod';
import { eq, desc, count } from 'drizzle-orm';
import { ProjectSyncService } from '../services/sync.js';
import { getScanPaths } from '../lib/config.js';
import { db } from '../db/index.js';
import { projects } from '../db/schema.js';

export const syncRoutes = new Hono();

function getService(): ProjectSyncService {
  return new ProjectSyncService(getScanPaths());
}

// ---------------------------------------------------------------------------
// POST /discover — scan directories for projects with team-config.json
// ---------------------------------------------------------------------------
const discoverSchema = z.object({
  scan_paths: z.array(z.string()).optional(),
}).optional();

syncRoutes.post('/discover', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = discoverSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const requestPaths = parsed.data?.scan_paths;
  const service = getService();

  // If custom paths provided, validate they're within allowed scan paths
  if (requestPaths) {
    for (const p of requestPaths) {
      if (!service.validatePath(p)) {
        return c.json({ error: `Path not allowed: ${p}` }, 403);
      }
    }
  }

  const discovered = service.discoverProjects(requestPaths);
  return c.json({ discovered });
});

// ---------------------------------------------------------------------------
// POST /projects — sync all or specific paths
// ---------------------------------------------------------------------------
const syncProjectsSchema = z.object({
  paths: z.array(z.string()).optional(),
}).optional();

syncRoutes.post('/projects', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = syncProjectsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const service = getService();
  const requestPaths = parsed.data?.paths;

  let synced;
  if (requestPaths && requestPaths.length > 0) {
    // Validate all paths
    for (const p of requestPaths) {
      if (!service.validatePath(p)) {
        return c.json({ error: `Path not allowed: ${p}` }, 403);
      }
    }
    // Sync specific paths
    synced = [];
    for (const p of requestPaths) {
      try {
        synced.push(service.syncProject(p));
      } catch (err) {
        console.warn(`[sync] Failed to sync ${p}:`, err);
      }
    }
  } else {
    // Sync all discovered
    synced = service.syncAll();
  }

  return c.json({ synced });
});

// ---------------------------------------------------------------------------
// POST /projects/:id — re-sync a single project by ID
// ---------------------------------------------------------------------------
syncRoutes.post('/projects/:id', async (c) => {
  const id = c.req.param('id');
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (!project.cwd) {
    return c.json({ error: 'Project has no cwd (not a synced project)' }, 400);
  }

  const service = getService();
  try {
    const result = service.syncProject(project.cwd);
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /status — sync status overview
// ---------------------------------------------------------------------------
syncRoutes.get('/status', (c) => {
  const syncedCount = db.select({ count: count() })
    .from(projects)
    .where(eq(projects.source, 'synced'))
    .get();

  // Find latest sync time
  const latest = db.select({ last_synced_at: projects.last_synced_at })
    .from(projects)
    .where(eq(projects.source, 'synced'))
    .orderBy(desc(projects.last_synced_at))
    .limit(1)
    .get();

  return c.json({
    last_run: latest?.last_synced_at ?? null,
    synced_projects: syncedCount?.count ?? 0,
    scan_paths: getScanPaths(),
  });
});
