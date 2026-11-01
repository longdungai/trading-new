import {
  FedPivotScenarioId,
  FedPivotSignalId,
  FedPivotSignalState,
  FedPivotSnapshotDiff,
  FedPivotUserSnapshot,
} from '../../../types/fedPivotV2';
import { EvaluatedPivotRuleOutput } from './fedPivotRulesEngine';

export const FED_PIVOT_SNAPSHOTS_STORAGE_KEY = 'quant_ai_fed_pivot_v2_snapshots_v1';
const MAX_SAVED_SNAPSHOTS = 180;
const MIN_RECORD_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes if nothing changed

let memoryFallbackSnapshots: FedPivotUserSnapshot[] = [];

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore SecurityError in restricted iframes/contexts
  }
  return null;
}

export function loadSavedFedPivotSnapshots(): FedPivotUserSnapshot[] {
  const storage = getStorage();
  if (!storage) {
    return [...memoryFallbackSnapshots];
  }

  try {
    const raw = storage.getItem(FED_PIVOT_SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item: any): item is FedPivotUserSnapshot =>
          item &&
          typeof item.id === 'string' &&
          typeof item.timestampMs === 'number' &&
          typeof item.pivotScore === 'number' &&
          typeof item.status === 'string'
      )
      .sort((a, b) => a.timestampMs - b.timestampMs);
  } catch {
    return [];
  }
}

function saveSnapshots(list: FedPivotUserSnapshot[]): void {
  const trimmed = list.slice(-MAX_SAVED_SNAPSHOTS);
  memoryFallbackSnapshots = trimmed;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(FED_PIVOT_SNAPSHOTS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore quota errors gracefully
  }
}

export function resetFedPivotHistoryStoreForTests(): void {
  memoryFallbackSnapshots = [];
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(FED_PIVOT_SNAPSHOTS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

function hasAnyStateChange(
  prev: FedPivotUserSnapshot,
  curr: FedPivotUserSnapshot
): boolean {
  if (Math.abs(curr.pivotScore - prev.pivotScore) >= 0.05) return true;
  if (curr.status !== prev.status) return true;
  if (curr.dominantScenario !== prev.dominantScenario) return true;

  const keys = new Set([
    ...Object.keys(prev.signalStates || {}),
    ...Object.keys(curr.signalStates || {}),
  ]) as Set<FedPivotSignalId>;

  for (const key of keys) {
    if (prev.signalStates[key] !== curr.signalStates[key]) {
      return true;
    }
  }
  return false;
}

export function recordAndDiffFedPivotSnapshot(params: {
  evaluated: EvaluatedPivotRuleOutput;
  dominantScenario: FedPivotScenarioId;
  nowMs?: number;
}): {
  snapshotDiff: FedPivotSnapshotDiff;
  savedSnapshots: FedPivotUserSnapshot[];
} {
  const { evaluated, dominantScenario, nowMs = Date.now() } = params;
  const existing = loadSavedFedPivotSnapshots();

  const signalStates: Partial<Record<FedPivotSignalId, FedPivotSignalState>> = {};
  for (const s of evaluated.signals) {
    signalStates[s.id] = s.state;
  }

  const currentSnap: FedPivotUserSnapshot = {
    id: `fp-snap-${nowMs}`,
    timestampMs: nowMs,
    dateISO: new Date(nowMs).toISOString().slice(0, 10),
    pivotScore: evaluated.pivotScore,
    status: evaluated.status,
    dominantScenario,
    validSignalsCount: evaluated.dataQuality.validSignalsCount,
    signalStates,
    metrics: {
      corePce3mAnn: evaluated.derivedMetrics.corePce3mAnn,
      nfp3mAvgK: evaluated.derivedMetrics.nfp3mAvgK,
      unemploymentRate: evaluated.derivedMetrics.unemploymentRate,
      zqDelta6mBps: evaluated.derivedMetrics.zqDelta6mBps,
      us2yYield: evaluated.derivedMetrics.us2yYield,
      real10yYield: evaluated.derivedMetrics.real10yYield,
      hySpreadPct: evaluated.derivedMetrics.hySpreadPct,
    },
  };

  // Find baseline snapshot to compare against:
  // If the very last snapshot was taken moments ago with identical state, compare against the one prior if available,
  // or against the last distinct snapshot so changes remain visible during the user's session.
  const latestSaved = existing.length > 0 ? existing[existing.length - 1] : null;
  let comparisonBase: FedPivotUserSnapshot | null = latestSaved;

  if (
    latestSaved &&
    !hasAnyStateChange(latestSaved, currentSnap) &&
    existing.length >= 2 &&
    nowMs - latestSaved.timestampMs < MIN_RECORD_INTERVAL_MS
  ) {
    comparisonBase = existing[existing.length - 2];
  }

  // Persist current snapshot ONLY if data coverage is valid (>= 3/7 signals)
  let updatedList = existing;
  if (evaluated.dataQuality.validSignalsCount >= 3) {
    if (!latestSaved) {
      updatedList = [currentSnap];
      saveSnapshots(updatedList);
    } else if (
      hasAnyStateChange(latestSaved, currentSnap) ||
      nowMs - latestSaved.timestampMs >= MIN_RECORD_INTERVAL_MS
    ) {
      updatedList = [...existing, currentSnap];
      saveSnapshots(updatedList);
    }
  }

  if (!comparisonBase) {
    return {
      snapshotDiff: {
        hasPreviousSnapshot: false,
        previousTimestampMs: null,
        scoreDelta: 0,
        statusChanged: false,
        previousStatus: null,
        scenarioChanged: false,
        previousScenario: null,
        highlights: [
          'Đây là bản ghi Snapshot đầu tiên trên thiết bị này — hệ thống đã lưu mốc đối chiếu gốc để so sánh ở các lần cập nhật tiếp theo.',
        ],
      },
      savedSnapshots: updatedList,
    };
  }

  const scoreDelta = parseFloat((currentSnap.pivotScore - comparisonBase.pivotScore).toFixed(2));
  const statusChanged = currentSnap.status !== comparisonBase.status;
  const scenarioChanged = currentSnap.dominantScenario !== comparisonBase.dominantScenario;
  const highlights: string[] = [];

  if (Math.abs(scoreDelta) >= 0.05) {
    highlights.push(
      `Điểm hội tụ thay đổi ${scoreDelta > 0 ? '+' : ''}${scoreDelta.toFixed(2)}đ (${comparisonBase.pivotScore.toFixed(2)} → ${currentSnap.pivotScore.toFixed(2)}/7).`
    );
  }
  if (statusChanged) {
    highlights.push(
      `Trạng thái chuyển từ ${comparisonBase.status} sang ${currentSnap.status}.`
    );
  }
  if (scenarioChanged) {
    highlights.push(
      `Kịch bản trọng tâm dịch chuyển từ ${comparisonBase.dominantScenario} sang ${currentSnap.dominantScenario}.`
    );
  }

  for (const sig of evaluated.signals) {
    const oldState = comparisonBase.signalStates[sig.id];
    if (oldState && oldState !== sig.state && sig.state !== 'UNKNOWN' && oldState !== 'UNKNOWN') {
      highlights.push(`Tín hiệu "${sig.title}" đổi trạng thái: ${oldState} → ${sig.state}.`);
    }
  }

  if (highlights.length === 0) {
    highlights.push(
      'Không có thay đổi trọng yếu về điểm hội tụ hoặc trạng thái 7 tín hiệu kể từ lần chụp Snapshot gần nhất.'
    );
  }

  return {
    snapshotDiff: {
      hasPreviousSnapshot: true,
      previousTimestampMs: comparisonBase.timestampMs,
      scoreDelta,
      statusChanged,
      previousStatus: comparisonBase.status,
      scenarioChanged,
      previousScenario: comparisonBase.dominantScenario,
      highlights,
    },
    savedSnapshots: updatedList,
  };
}
