const WORKSPACE_STORAGE_KEY = 'trading_new_cloud_workspace_id_v1';

const SYNCED_LOCAL_KEYS = [
  'trading_ai_favorites_v2',
  'trading_ai_user_paper_trades_v2',
  'trading_new_smart_alert_rules_v1',
  'trading_new_smart_alert_prefs_v1',
  'trading_new_chart_drawings_v1',
  'trading_new_vn_dealer_gold_quote_v1',
  'trading_new_fed_pivot_v2_snapshots',
  'trading_ai_kronos_audit_v2',
] as const;

export interface CloudSyncStatus {
  configured: boolean;
  mode: 'VERCEL_KV_CONNECTED' | 'LOCAL_STORAGE_ONLY' | 'OFFLINE';
  workspaceId: string;
  lastSyncedAtISO: string | null;
  error?: string;
}

export function loadCloudWorkspaceId(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY) || 'default';
  } catch {
    return 'default';
  }
}

export function saveCloudWorkspaceId(id: string): string {
  const safe =
    id
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 48) || 'default';
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, safe);
    } catch {
      // ignore
    }
  }
  return safe;
}

export function collectLocalWorkspaceSnapshot(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  const snapshot: Record<string, unknown> = {};
  for (const key of SYNCED_LOCAL_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        snapshot[key] = JSON.parse(raw);
      }
    } catch {
      // skip malformed entry
    }
  }
  return snapshot;
}

export function applyCloudWorkspaceSnapshot(payload: Record<string, unknown>): number {
  if (typeof window === 'undefined' || !payload || typeof payload !== 'object') return 0;
  let restoredKeys = 0;
  for (const key of SYNCED_LOCAL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined) {
      try {
        window.localStorage.setItem(key, JSON.stringify(payload[key]));
        restoredKeys++;
      } catch {
        // ignore quota error
      }
    }
  }
  return restoredKeys;
}

export async function checkAndPullCloudWorkspace(
  workspaceId: string = loadCloudWorkspaceId()
): Promise<{ status: CloudSyncStatus; restoredKeys: number }> {
  const safeId = saveCloudWorkspaceId(workspaceId);
  try {
    const res = await fetch(`/api/cloud-sync?workspace=${encodeURIComponent(safeId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        status: {
          configured: false,
          mode: 'LOCAL_STORAGE_ONLY',
          workspaceId: safeId,
          lastSyncedAtISO: null,
        },
        restoredKeys: 0,
      };
    }
    const json = await res.json();
    if (!json?.configured) {
      return {
        status: {
          configured: false,
          mode: 'LOCAL_STORAGE_ONLY',
          workspaceId: safeId,
          lastSyncedAtISO: null,
        },
        restoredKeys: 0,
      };
    }

    let restoredKeys = 0;
    const remotePayload = json?.data?.payload;
    if (remotePayload && typeof remotePayload === 'object') {
      restoredKeys = applyCloudWorkspaceSnapshot(remotePayload as Record<string, unknown>);
    }

    return {
      status: {
        configured: true,
        mode: 'VERCEL_KV_CONNECTED',
        workspaceId: safeId,
        lastSyncedAtISO: json?.data?.updatedAtISO || null,
      },
      restoredKeys,
    };
  } catch {
    return {
      status: {
        configured: false,
        mode: 'OFFLINE',
        workspaceId: safeId,
        lastSyncedAtISO: null,
      },
      restoredKeys: 0,
    };
  }
}

export async function pushLocalWorkspaceToCloud(
  workspaceId: string = loadCloudWorkspaceId()
): Promise<CloudSyncStatus> {
  const safeId = saveCloudWorkspaceId(workspaceId);
  try {
    const payload = collectLocalWorkspaceSnapshot();
    const res = await fetch('/api/cloud-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace: safeId,
        payload,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.configured) {
      return {
        configured: false,
        mode: 'LOCAL_STORAGE_ONLY',
        workspaceId: safeId,
        lastSyncedAtISO: null,
        error: json?.error,
      };
    }
    return {
      configured: true,
      mode: 'VERCEL_KV_CONNECTED',
      workspaceId: safeId,
      lastSyncedAtISO: json?.updatedAtISO || new Date().toISOString(),
    };
  } catch (err) {
    return {
      configured: false,
      mode: 'OFFLINE',
      workspaceId: safeId,
      lastSyncedAtISO: null,
      error: err instanceof Error ? err.message : 'Lỗi kết nối Cloud KV',
    };
  }
}
