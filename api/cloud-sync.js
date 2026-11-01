/**
 * Vercel Serverless Function: Cross-Device Cloud Sync via Vercel KV / Upstash Redis REST API
 * Zero external npm packages required.
 * Environment Variables (optional, configured in Vercel Storage -> KV / Upstash):
 *   - KV_REST_API_URL (or UPSTASH_REDIS_REST_URL)
 *   - KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_TOKEN)
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const kvUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  const configured = Boolean(kvUrl && kvToken);

  if (!configured) {
    return res.status(200).json({
      ok: true,
      configured: false,
      mode: 'LOCAL_STORAGE_ONLY',
      data: null,
    });
  }

  try {
    if (req.method === 'GET') {
      const rawWorkspace = String(req.query?.workspace || 'default');
      const safeWorkspace = sanitizeWorkspaceId(rawWorkspace);
      const redisKey = `trading_new:v2:sync:${safeWorkspace}`;

      const getRes = await fetch(`${kvUrl}/get/${encodeURIComponent(redisKey)}`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      });
      if (!getRes.ok) {
        return res.status(200).json({ ok: false, configured: true, error: `KV HTTP ${getRes.status}` });
      }
      const getJson = await getRes.json();
      let parsed = null;
      if (typeof getJson?.result === 'string') {
        try {
          parsed = JSON.parse(getJson.result);
        } catch {
          parsed = null;
        }
      }
      return res.status(200).json({
        ok: true,
        configured: true,
        mode: 'VERCEL_KV_CONNECTED',
        workspace: safeWorkspace,
        data: parsed,
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const safeWorkspace = sanitizeWorkspaceId(String(body.workspace || 'default'));
      const redisKey = `trading_new:v2:sync:${safeWorkspace}`;
      const serialized = JSON.stringify({
        updatedAtISO: new Date().toISOString(),
        payload: body.payload || {},
      });

      if (serialized.length > 450_000) {
        return res.status(413).json({ ok: false, configured: true, error: 'Payload exceeds 450KB limit' });
      }

      // Store with 180-day TTL (15,552,000 seconds) via Upstash REST pipeline command
      const setRes = await fetch(`${kvUrl}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['SET', redisKey, serialized, 'EX', 15552000]),
      });

      if (!setRes.ok) {
        return res.status(200).json({ ok: false, configured: true, error: `KV Write HTTP ${setRes.status}` });
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        mode: 'VERCEL_KV_CONNECTED',
        workspace: safeWorkspace,
        updatedAtISO: new Date().toISOString(),
      });
    }

    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      configured,
      error: err instanceof Error ? err.message : 'KV Sync Error',
    });
  }
}

function sanitizeWorkspaceId(raw) {
  const cleaned = String(raw || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48);
  return cleaned || 'default';
}
