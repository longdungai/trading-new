import {
  FedPivotAlertTier,
  FedPivotScenarioAnalysis,
  FedPivotScenarioId,
  FedPivotSmartAlert,
  FedPivotSnapshotDiff,
} from '../../../types/fedPivotV2';
import { EvaluatedPivotRuleOutput } from './fedPivotRulesEngine';

export const FED_PIVOT_SEEN_ALERTS_KEY = 'quant_ai_fed_pivot_v2_seen_alerts_v1';
const MAX_SEEN_FINGERPRINTS = 120;

let memorySeenFingerprints = new Set<string>();

function loadSeenFingerprints(): Set<string> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(FED_PIVOT_SEEN_ALERTS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set(arr.filter((x): x is string => typeof x === 'string'));
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return new Set(memorySeenFingerprints);
}

function persistSeenFingerprints(set: Set<string>): void {
  const arr = Array.from(set).slice(-MAX_SEEN_FINGERPRINTS);
  memorySeenFingerprints = new Set(arr);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(FED_PIVOT_SEEN_ALERTS_KEY, JSON.stringify(arr));
    }
  } catch {
    // ignore
  }
}

export function resetFedPivotSeenAlertsForTests(): void {
  memorySeenFingerprints.clear();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(FED_PIVOT_SEEN_ALERTS_KEY);
    }
  } catch {
    // ignore
  }
}

function tierToVietnameseLabel(tier: FedPivotAlertTier): string {
  switch (tier) {
    case 'STRONG_CONVERGENCE':
      return 'STRONG CONVERGENCE • Hội tụ xoay trục mạnh';
    case 'PIVOT_WINDOW':
      return 'PIVOT WINDOW • Cửa sổ nới lỏng mở rộng';
    case 'EARLY_PIVOT':
      return 'EARLY PIVOT • Hội tụ xoay trục ban đầu';
    case 'WATCH':
      return 'WATCH • Tín hiệu bắt đầu chuyển dịch';
    case 'RISK_WARNING':
      return 'RISK WARNING • Cảnh báo suy thoái / Căng thẳng tài chính';
  }
}

export function generateFedPivotSmartAlerts(params: {
  evaluated: EvaluatedPivotRuleOutput;
  dominantScenarioId: FedPivotScenarioId;
  scenarios: FedPivotScenarioAnalysis[];
  snapshotDiff: FedPivotSnapshotDiff;
  nowMs?: number;
}): FedPivotSmartAlert[] {
  const {
    evaluated,
    dominantScenarioId,
    scenarios,
    snapshotDiff,
    nowMs = Date.now(),
  } = params;

  // MANDATORY GUARDRAIL: Never generate alerts from missing, malformed, or overly stale data
  if (
    evaluated.dataQuality.validSignalsCount < 4 ||
    evaluated.dataQuality.confidenceTier === 'LOW'
  ) {
    return [];
  }

  const seen = loadSeenFingerprints();
  const alerts: FedPivotSmartAlert[] = [];
  const m = evaluated.derivedMetrics;

  const confirmedSignals = evaluated.signals.filter(
    s => s.state === 'CONFIRMED' || s.state === 'PARTIAL'
  );
  const conflictingItems = evaluated.signals.filter(s => s.state === 'CONFLICTING');

  const buildConflictStrings = (): string[] => {
    if (conflictingItems.length > 0) {
      return conflictingItems.map(s => `${s.title}: ${s.rationale}`);
    }
    const unconfirmed = evaluated.signals.filter(s => s.state === 'UNCONFIRMED');
    if (unconfirmed.length > 0) {
      return unconfirmed.slice(0, 2).map(s => `${s.title} chưa xác nhận (${s.latestDisplay}).`);
    }
    return ['Hiện không có tín hiệu định lượng nào đi ngược chiều hội tụ chính.'];
  };

  // ==================== 1. CONVERGENCE TIER ALERT (WATCH -> STRONG_CONVERGENCE) ====================
  if (evaluated.status !== 'NO_PIVOT') {
    const tier: FedPivotAlertTier =
      evaluated.status === 'STRONG_CONVERGENCE'
        ? 'STRONG_CONVERGENCE'
        : evaluated.status === 'PIVOT_WINDOW'
        ? 'PIVOT_WINDOW'
        : evaluated.status === 'EARLY_PIVOT'
        ? 'EARLY_PIVOT'
        : 'WATCH';

    // Bucket score in 0.5 increments so micro fluctuations don't spam new alerts
    const scoreBucket = (Math.round(evaluated.pivotScore * 2) / 2).toFixed(1);
    const sigSignature = confirmedSignals
      .map(s => `${s.id}:${s.state}`)
      .sort()
      .join('|');
    const fingerprint = `fpv2:${tier}:${dominantScenarioId}:${scoreBucket}:${sigSignature}`;
    const isNew = !seen.has(fingerprint);
    if (isNew) {
      seen.add(fingerprint);
    }

    const whatChanged = snapshotDiff.hasPreviousSnapshot && Math.abs(snapshotDiff.scoreDelta) >= 0.25
      ? `Điểm hội tụ dịch chuyển ${snapshotDiff.scoreDelta > 0 ? '+' : ''}${snapshotDiff.scoreDelta.toFixed(2)}đ lên ${evaluated.pivotScore.toFixed(2)}/7 (${evaluated.statusLabel}), kích hoạt vùng theo dõi ${tier}.`
      : `Hệ thống ghi nhận điểm hội tụ Fed Pivot đạt ${evaluated.pivotScore.toFixed(2)}/7 (trạng thái ${evaluated.statusLabel}) theo kịch bản ${dominantScenarioId.replace('_', ' ')}.`;

    const confirmingEvidence =
      confirmedSignals.length > 0
        ? confirmedSignals.map(s => `${s.title} (${s.latestDisplay}): ${s.rationale}`)
        : [`Điểm hội tụ đạt ${evaluated.pivotScore.toFixed(2)}/7 từ các nguồn dữ liệu hợp lệ.`];

    const conflictingSignals = buildConflictStrings();

    const affectedAssets =
      dominantScenarioId === 'SOFT_LANDING'
        ? ['XAUUSD', 'BTCUSDT', 'ETHUSDT', 'NVDA', 'AAPL', 'VNINDEX', 'FPT', 'SSI']
        : ['XAUUSD', 'PAXGUSDT', 'BTCUSDT', 'VNINDEX'];

    const actionableChecklist =
      tier === 'STRONG_CONVERGENCE' || tier === 'PIVOT_WINDOW'
        ? [
            'Theo dõi sát thông điệp họp báo FOMC và chênh lệch US 2Y − EFFR để phòng ngừa hiệu ứng "Sell the news".',
            'Ưu tiên chiến lược giải ngân từng phần theo xu hướng ở nhóm nhạy cảm lãi suất thực (Vàng XAUUSD, cổ phiếu tăng trưởng, VN30) với quản trị rủi ro chuẩn.',
            'Kiểm tra lại lịch công bố Core PCE và NFP kỳ kế tiếp để xác nhận chuỗi giảm phát không bị đảo chiều.',
          ]
        : [
            'Chưa vội sử dụng đòn bẩy cao khi tín hiệu mới ở giai đoạn chuyển dịch sớm (Watch / Early Pivot).',
            'Theo dõi xem lợi suất US 2Y và hợp đồng tương lai ZQ 6T có tiếp tục mở rộng mức chiết khấu hạ lãi suất ≥ 25 bps hay không.',
            'Quan sát phản ứng của DXY quanh mốc 101–104 và tỷ giá USD/VND trước khi nâng tỷ trọng cổ phiếu.',
          ];

    const markdownSummary = [
      `*[Trading New • Fed Pivot Intelligence]*`,
      `• Phân loại: *${tier}* (Score: *${evaluated.pivotScore.toFixed(2)}/7*)`,
      `• Thay đổi: ${whatChanged}`,
      `• Kịch bản: ${dominantScenarioId}`,
      `• Tài sản trọng tâm: ${affectedAssets.join(', ')}`,
    ].join('\n');

    alerts.push({
      id: `alert-convergence-${tier.toLowerCase()}`,
      fingerprint,
      tier,
      tierLabel: tierToVietnameseLabel(tier),
      createdAtMs: nowMs,
      isNew,
      whatChanged,
      confirmingEvidence,
      conflictingSignals,
      affectedAssets,
      actionableChecklist,
      telegramContract: {
        readyForBackendPhase: isNew,
        serverEndpoint: '/api/telegram-pivot-alert',
        fingerprint,
        tier,
        markdownSummary,
      },
    });
  }

  // ==================== 2. SYSTEMIC / RECESSION / HAWKISH RISK WARNING ====================
  const recScenario = scenarios.find(s => s.id === 'RECESSION');
  const stressScenario = scenarios.find(s => s.id === 'FINANCIAL_STRESS');

  const isRecessionOrStressWarning =
    dominantScenarioId === 'RECESSION' ||
    dominantScenarioId === 'FINANCIAL_STRESS' ||
    (m.sahmDelta !== null && m.sahmDelta >= 0.45) ||
    (m.hySpreadPct !== null && m.hySpreadPct >= 4.5) ||
    (m.stlfsiValue !== null && m.stlfsiValue >= 0.75);

  const isHawkishRepricingWarning =
    !isRecessionOrStressWarning &&
    evaluated.status === 'NO_PIVOT' &&
    conflictingItems.length >= 2 &&
    ((m.zqDelta6mBps !== null && m.zqDelta6mBps >= 15) ||
      (m.real10yYield !== null && m.real10yYield >= 2.15));

  if (isRecessionOrStressWarning) {
    const modeTag =
      dominantScenarioId === 'FINANCIAL_STRESS' || (m.hySpreadPct !== null && m.hySpreadPct >= 4.5)
        ? 'FIN_STRESS'
        : 'RECESSION_RISK';
    const fingerprint = `fpv2:RISK_WARNING:${modeTag}:${Math.round((m.hySpreadPct ?? 0) * 2)}:${Math.round((m.sahmDelta ?? 0) * 10)}`;
    const isNew = !seen.has(fingerprint);
    if (isNew) {
      seen.add(fingerprint);
    }

    const activeScen = modeTag === 'FIN_STRESS' ? stressScenario : recScenario;
    const whatChanged =
      modeTag === 'FIN_STRESS'
        ? `Cảnh báo căng thẳng tài chính kích hoạt: HY Credit Spread (${m.hySpreadPct?.toFixed(2) ?? '--'}%) hoặc STLFSI4 (${m.stlfsiValue?.toFixed(2) ?? '--'}) vượt ngưỡng an toàn.`
        : `Cảnh báo suy yếu chu kỳ lao động: Sahm Rule (+${m.sahmDelta?.toFixed(2) ?? '--'}%) / bảng lương NFP phát tín hiệu tăng trưởng chậm lại nhanh.`;

    const markdownSummary = [
      `*[Trading New • RISK WARNING]*`,
      `• Chế độ rủi ro: *${modeTag}*`,
      `• Chi tiết: ${whatChanged}`,
      `• Tài sản nhạy cảm: XAUUSD, BTCUSDT, NVDA, VNINDEX`,
    ].join('\n');

    alerts.unshift({
      id: `alert-risk-${modeTag.toLowerCase()}`,
      fingerprint,
      tier: 'RISK_WARNING',
      tierLabel: tierToVietnameseLabel('RISK_WARNING'),
      createdAtMs: nowMs,
      isNew,
      whatChanged,
      confirmingEvidence:
        activeScen?.supportingEvidence ?? [whatChanged],
      conflictingSignals:
        activeScen?.conflictingSignals ?? buildConflictStrings(),
      affectedAssets: ['XAUUSD', 'BTCUSDT', 'ETHUSDT', 'NVDA', 'VNINDEX', 'VN30'],
      actionableChecklist: [
        'Hạ tỷ trọng vị thế đòn bẩy và tuân thủ nghiêm ngặt hệ số giảm chấn Kelly (Kelly Damper) trên thanh công cụ quản trị vốn.',
        'Phân biệt rõ "Nới lỏng do suy thoái/căng thẳng" với "Hạ cánh mềm": Ưu tiên tài sản phòng thủ/trú ẩn (XAUUSD) hơn cổ phiếu chu kỳ.',
        'Theo dõi sát biến động thanh khoản phiên Mỹ và chênh lệch tín dụng HY OAS trong các phiên kế tiếp.',
      ],
      telegramContract: {
        readyForBackendPhase: isNew,
        serverEndpoint: '/api/telegram-pivot-alert',
        fingerprint,
        tier: 'RISK_WARNING',
        markdownSummary,
      },
    });
  } else if (isHawkishRepricingWarning) {
    const fingerprint = `fpv2:RISK_WARNING:HAWKISH_HOLD:${conflictingItems.map(c => c.id).sort().join('|')}`;
    const isNew = !seen.has(fingerprint);
    if (isNew) {
      seen.add(fingerprint);
    }

    const whatChanged = `Áp lực lãi suất thực và kỳ vọng thắt chặt kéo dài (No Pivot — ${conflictingItems.length}/7 tín hiệu đang đi ngược chiều nới lỏng).`;
    const markdownSummary = [
      `*[Trading New • RISK WARNING (Hawkish Hold)]*`,
      `• Trạng thái: *No Pivot (${evaluated.pivotScore.toFixed(2)}/7)*`,
      `• Chi tiết: ${whatChanged}`,
    ].join('\n');

    alerts.push({
      id: 'alert-risk-hawkish-hold',
      fingerprint,
      tier: 'RISK_WARNING',
      tierLabel: 'RISK WARNING • Lực cản Lãi suất cao (Higher-for-Longer)',
      createdAtMs: nowMs,
      isNew,
      whatChanged,
      confirmingEvidence: conflictingItems.map(s => `${s.title} (${s.latestDisplay}): ${s.rationale}`),
      conflictingSignals:
        confirmedSignals.length > 0
          ? confirmedSignals.map(s => `${s.title} (${s.latestDisplay}) đã hạ nhiệt một phần.`)
          : ['Chưa có tín hiệu nới lỏng nào đủ mạnh để đối trọng với mặt bằng lợi suất thực hiện tại.'],
      affectedAssets: ['XAUUSD', 'BTCUSDT', 'NVDA', 'TSLA', 'VNINDEX', 'SSI'],
      actionableChecklist: [
        'Không giao dịch theo giả định Fed sớm cắt giảm lãi suất khi cả ZQ Futures và Real Yield đều chưa xác nhận.',
        'Với cổ phiếu Việt Nam, theo dõi sát tỷ giá USD/VND và ưu tiên doanh nghiệp có nền tảng dòng tiền thực / xuất khẩu thu USD (như FPT, DGC).',
        'Chờ kỳ công bố Core PCE và NFP tiếp theo để đánh giá lại điểm hội tụ.',
      ],
      telegramContract: {
        readyForBackendPhase: isNew,
        serverEndpoint: '/api/telegram-pivot-alert',
        fingerprint,
        tier: 'RISK_WARNING',
        markdownSummary,
      },
    });
  }

  persistSeenFingerprints(seen);
  return alerts;
}
