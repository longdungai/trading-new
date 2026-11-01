import {
  FedPivotDataQuality,
  FedPivotHistoricalPoint,
  FedPivotMacroEventMarker,
  FedPivotSignalId,
  FedPivotSignalItem,
  FedPivotSignalState,
  FedPivotV2Status,
  RawFedPivotProviderBundle,
  TimeSeriesObservation,
  ValidatedMacroSeries,
} from '../../../types/fedPivotV2';
import { formatEffectiveReleaseDate, getObservationsAsOf, PUBLICATION_LAG_DAYS } from './fedPivotValidator';

export const OFFICIAL_FOMC_DATES_V2: Array<{ dateISO: string; label: string; hasDotPlot: boolean }> = [
  { dateISO: '2025-11-05', label: 'FOMC T11/2025', hasDotPlot: false },
  { dateISO: '2025-12-17', label: 'FOMC T12/2025 (Dot Plot)', hasDotPlot: true },
  { dateISO: '2026-01-28', label: 'FOMC T1/2026', hasDotPlot: false },
  { dateISO: '2026-03-18', label: 'FOMC T3/2026 (Dot Plot)', hasDotPlot: true },
  { dateISO: '2026-04-29', label: 'FOMC T4/2026', hasDotPlot: false },
  { dateISO: '2026-06-17', label: 'FOMC T6/2026 (Dot Plot)', hasDotPlot: true },
  { dateISO: '2026-07-29', label: 'FOMC T7/2026', hasDotPlot: false },
  { dateISO: '2026-09-16', label: 'FOMC T9/2026 (Dot Plot)', hasDotPlot: true },
  { dateISO: '2026-10-28', label: 'FOMC T10/2026', hasDotPlot: false },
  { dateISO: '2026-12-09', label: 'FOMC T12/2026 (Dot Plot)', hasDotPlot: true },
  { dateISO: '2027-01-27', label: 'FOMC T1/2027', hasDotPlot: false },
  { dateISO: '2027-03-17', label: 'FOMC T3/2027 (Dot Plot)', hasDotPlot: true },
];

export function mapPivotScoreToStatus(score: number): {
  status: FedPivotV2Status;
  label: string;
  description: string;
} {
  if (score >= 5.75) {
    return {
      status: 'STRONG_CONVERGENCE',
      label: 'Strong Convergence',
      description: 'Hội tụ mạnh trên đa số nhóm dữ liệu lạm phát, lao động và thị trường trái phiếu.',
    };
  }
  if (score >= 4.25) {
    return {
      status: 'PIVOT_WINDOW',
      label: 'Pivot Window',
      description: 'Cửa sổ xoay trục chính sách đã mở; nhiều nhóm dữ liệu kinh tế và lãi suất cùng xác nhận.',
    };
  }
  if (score >= 2.75) {
    return {
      status: 'EARLY_PIVOT',
      label: 'Early Pivot',
      description: 'Xuất hiện hội tụ ban đầu cho chu kỳ nới lỏng nhưng vẫn còn một số chỉ báo chưa đồng thuận.',
    };
  }
  if (score >= 1.25) {
    return {
      status: 'WATCH',
      label: 'Watch',
      description: 'Một số tín hiệu bắt đầu chuyển dịch; cần theo dõi thêm dữ liệu công bố kỳ tới.',
    };
  }
  return {
    status: 'NO_PIVOT',
    label: 'No Pivot',
    description: 'Chưa có hội tụ tín hiệu xoay trục hạ lãi suất; chính sách tiền tệ vẫn nghiêng về thắt chặt/giữ cao.',
  };
}

export interface EvaluatedPivotRuleOutput {
  pivotScore: number;
  status: FedPivotV2Status;
  statusLabel: string;
  statusDescription: string;
  signals: FedPivotSignalItem[];
  dataQuality: FedPivotDataQuality;
  derivedMetrics: {
    corePceYoY: number | null;
    corePce3mAnn: number | null;
    corePce6mAnn: number | null;
    latestNfpK: number | null;
    nfp3mAvgK: number | null;
    unemploymentRate: number | null;
    sahmDelta: number | null;
    icsa4wAvg: number | null;
    effectiveRate: number | null;
    zqDelta3mBps: number | null;
    zqDelta6mBps: number | null;
    us2yYield: number | null;
    spread2yEffrBps: number | null;
    real10yYield: number | null;
    dxyValue: number | null;
    hySpreadPct: number | null;
    stlfsiValue: number | null;
  };
}

function unknownSignal(
  id: FedPivotSignalId,
  order: number,
  title: string,
  subtitle: string,
  source: string,
  fetchedAtISO: string,
  reason: string,
  isStale: boolean = false
): FedPivotSignalItem {
  return {
    id,
    order,
    title,
    subtitle,
    latestDisplay: 'UNKNOWN',
    previousDisplay: 'UNKNOWN',
    deltaDisplay: 'N/A',
    latestNumeric: null,
    previousNumeric: null,
    state: 'UNKNOWN',
    rawScore: 0,
    effectiveScore: 0,
    rationale: reason || 'Thiếu dữ liệu hoặc dữ liệu quá hạn — không cộng điểm vào Pivot Score.',
    source,
    releaseDate: 'N/A',
    fetchedAtISO,
    isStale,
  };
}

export function evaluateFedPivotSignalsAndScore(
  bundle: RawFedPivotProviderBundle
): EvaluatedPivotRuleOutput {
  const { fredSeries, nyFedEffr, futuresQuote, fetchedAtISO } = bundle;
  const signals: FedPivotSignalItem[] = [];

  let corePceYoY: number | null = null;
  let corePce3mAnn: number | null = null;
  let corePce6mAnn: number | null = null;
  let latestNfpK: number | null = null;
  let nfp3mAvgK: number | null = null;
  let unemploymentRate: number | null = null;
  let sahmDelta: number | null = null;
  let icsa4wAvg: number | null = null;
  let zqDelta3mBps: number | null = null;
  let zqDelta6mBps: number | null = null;
  let us2yYield: number | null = null;
  let spread2yEffrBps: number | null = null;
  let us2yDelta20dBps = 0;
  let real10yYield: number | null = null;
  let dxyValue: number | null = futuresQuote.dxySpot;
  let hySpreadPct: number | null = null;
  let stlfsiValue: number | null = null;

  // ==================== SIGNAL 1: CORE PCE & 3M/6M TREND ====================
  const pce = fredSeries.PCEPILFE;
  if (!pce.isValid || pce.observations.length < 7) {
    signals.push(
      unknownSignal(
        'CORE_PCE',
        1,
        'Core PCE & Xu hướng lạm phát 3–6 tháng',
        'Thước đo lạm phát lõi mục tiêu 2.0% của Fed',
        pce.source,
        pce.fetchedAtISO || fetchedAtISO,
        pce.invalidReason || 'Không đủ chuỗi quan sát Core PCE hợp lệ.',
        pce.isStale
      )
    );
  } else {
    const obs = pce.observations;
    const n = obs.length;
    const curr = obs[n - 1].value;
    const prev3 = obs[n - 4].value;
    const prev6 = obs[n - 7].value;
    const prev1_curr = obs[n - 2].value;
    const prev1_prev3 = n >= 5 ? obs[n - 5].value : prev3;

    corePce3mAnn = parseFloat(((Math.pow(curr / prev3, 4) - 1) * 100).toFixed(2));
    corePce6mAnn = parseFloat(((Math.pow(curr / prev6, 2) - 1) * 100).toFixed(2));
    const prevMonth3mAnn = parseFloat(((Math.pow(prev1_curr / prev1_prev3, 4) - 1) * 100).toFixed(2));
    if (n >= 13 && obs[n - 13].value > 0) {
      corePceYoY = parseFloat((((curr - obs[n - 13].value) / obs[n - 13].value) * 100).toFixed(2));
    }

    const diff3mVs6m = parseFloat((corePce3mAnn - corePce6mAnn).toFixed(2));
    let state: FedPivotSignalState = 'UNCONFIRMED';
    let rawScore = 0;
    let rationale = '';

    if (
      corePce3mAnn <= 2.55 ||
      (corePceYoY !== null && corePceYoY <= 2.55 && corePce3mAnn <= 2.75)
    ) {
      state = 'CONFIRMED';
      rawScore = 1.0;
      rationale = `Lạm phát lõi 3 tháng chuẩn hóa năm hạ về ${corePce3mAnn.toFixed(2)}%${corePceYoY !== null ? ` (YoY ${corePceYoY.toFixed(2)}%)` : ''}, tiệm cận vùng mục tiêu của Fed.`;
    } else if (corePce3mAnn <= 2.95 && corePce3mAnn < corePce6mAnn) {
      state = 'PARTIAL';
      rawScore = 0.5;
      rationale = `Xu hướng 3 tháng (${corePce3mAnn.toFixed(2)}%) thấp hơn 6 tháng (${corePce6mAnn.toFixed(2)}%), xác nhận đà giảm tốc lạm phát ban đầu.`;
    } else if (corePce3mAnn >= 3.15 || corePce3mAnn > corePce6mAnn + 0.25) {
      state = 'CONFLICTING';
      rawScore = 0;
      rationale = `Lạm phát lõi 3 tháng (${corePce3mAnn.toFixed(2)}%) cao hơn xu hướng 6 tháng (${corePce6mAnn.toFixed(2)}%) — áp lực giá còn dai dẳng, cản trở Fed nới lỏng.`;
    } else {
      state = 'UNCONFIRMED';
      rawScore = 0;
      rationale = `Core PCE 3 tháng ở mức ${corePce3mAnn.toFixed(2)}% (6 tháng: ${corePce6mAnn.toFixed(2)}%), chưa giảm đủ sâu về vùng mục tiêu 2.0–2.5%.`;
    }

    signals.push({
      id: 'CORE_PCE',
      order: 1,
      title: 'Core PCE & Xu hướng lạm phát 3–6 tháng',
      subtitle: 'Thước đo lạm phát lõi ưu tiên số 1 của FOMC',
      latestDisplay: `3T: ${corePce3mAnn.toFixed(2)}%${corePceYoY !== null ? ` • YoY: ${corePceYoY.toFixed(2)}%` : ''}`,
      previousDisplay: `Kỳ trước 3T: ${prevMonth3mAnn.toFixed(2)}% (6T: ${corePce6mAnn.toFixed(2)}%)`,
      deltaDisplay: `${diff3mVs6m >= 0 ? '+' : ''}${diff3mVs6m.toFixed(2)}% (3T vs 6T)`,
      latestNumeric: corePce3mAnn,
      previousNumeric: prevMonth3mAnn,
      state,
      rawScore,
      effectiveScore: rawScore,
      rationale,
      source: pce.source,
      releaseDate: formatEffectiveReleaseDate(pce),
      fetchedAtISO: pce.fetchedAtISO,
      isStale: pce.isStale,
    });
  }

  // ==================== SIGNAL 2: NFP & 3-MONTH MOVING AVERAGE ====================
  const payems = fredSeries.PAYEMS;
  if (!payems.isValid || payems.observations.length < 4) {
    signals.push(
      unknownSignal(
        'NFP_TREND',
        2,
        'Bảng lương NFP & Trung bình 3 tháng',
        'Đà tạo việc làm khu vực phi nông nghiệp Mỹ',
        payems.source,
        payems.fetchedAtISO || fetchedAtISO,
        payems.invalidReason || 'Không đủ chuỗi dữ liệu PAYEMS hợp lệ.',
        payems.isStale
      )
    );
  } else {
    const obs = payems.observations;
    const n = obs.length;
    latestNfpK = Math.round(obs[n - 1].value - obs[n - 2].value);
    const prevNfpK = Math.round(obs[n - 2].value - obs[n - 3].value);
    nfp3mAvgK = Math.round((obs[n - 1].value - obs[n - 4].value) / 3);
    const deltaK = latestNfpK - prevNfpK;

    let state: FedPivotSignalState = 'UNCONFIRMED';
    let rawScore = 0;
    let rationale = '';

    if (nfp3mAvgK <= 110) {
      state = 'CONFIRMED';
      rawScore = 1.0;
      rationale = `Trung bình NFP 3 tháng hạ xuống ${nfp3mAvgK >= 0 ? '+' : ''}${nfp3mAvgK}K việc làm (kỳ mới ${latestNfpK >= 0 ? '+' : ''}${latestNfpK}K), xác nhận cầu lao động hạ nhiệt rõ rệt.`;
    } else if (nfp3mAvgK <= 150 && latestNfpK < nfp3mAvgK) {
      state = 'PARTIAL';
      rawScore = 0.5;
      rationale = `Tăng trưởng việc làm đang chậm dần (kỳ mới ${latestNfpK >= 0 ? '+' : ''}${latestNfpK}K thấp hơn TB 3 tháng +${nfp3mAvgK}K).`;
    } else if (nfp3mAvgK >= 180) {
      state = 'CONFLICTING';
      rawScore = 0;
      rationale = `Thị trường lao động còn quá mạnh (TB 3 tháng +${nfp3mAvgK}K việc làm/tháng), chưa tạo áp lực buộc Fed hạ lãi suất.`;
    } else {
      state = 'UNCONFIRMED';
      rawScore = 0;
      rationale = `NFP trung bình 3 tháng đạt +${nfp3mAvgK}K việc làm, ở vùng cân bằng ổn định.`;
    }

    signals.push({
      id: 'NFP_TREND',
      order: 2,
      title: 'Bảng lương NFP & Trung bình 3 tháng',
      subtitle: 'Tăng trưởng việc làm hàng tháng & trung bình trượt 3 kỳ',
      latestDisplay: `${latestNfpK >= 0 ? '+' : ''}${latestNfpK}K • TB 3T: ${nfp3mAvgK >= 0 ? '+' : ''}${nfp3mAvgK}K`,
      previousDisplay: `Kỳ trước: ${prevNfpK >= 0 ? '+' : ''}${prevNfpK}K`,
      deltaDisplay: `${deltaK >= 0 ? '+' : ''}${deltaK}K so với tháng trước`,
      latestNumeric: nfp3mAvgK,
      previousNumeric: prevNfpK,
      state,
      rawScore,
      effectiveScore: rawScore,
      rationale,
      source: payems.source,
      releaseDate: formatEffectiveReleaseDate(payems),
      fetchedAtISO: payems.fetchedAtISO,
      isStale: payems.isStale,
    });
  }

  // ==================== SIGNAL 3: UNEMPLOYMENT RATE & INITIAL JOBLESS CLAIMS ====================
  const unrate = fredSeries.UNRATE;
  const icsa = fredSeries.ICSA;
  if ((!unrate.isValid || unrate.observations.length < 12) && (!icsa.isValid || icsa.observations.length < 4)) {
    signals.push(
      unknownSignal(
        'UNEMPLOYMENT_CLAIMS',
        3,
        'Tỷ lệ Thất nghiệp & Initial Jobless Claims',
        'Độ chùng thị trường lao động & quy tắc Sahm Rule',
        `${unrate.source} + ${icsa.source}`,
        fetchedAtISO,
        unrate.invalidReason || icsa.invalidReason || 'Thiếu dữ liệu UNRATE và ICSA.',
        unrate.isStale || icsa.isStale
      )
    );
  } else {
    let prevUnrate: number | null = null;
    if (unrate.isValid && unrate.observations.length >= 12) {
      const uObs = unrate.observations;
      const uLen = uObs.length;
      unemploymentRate = uObs[uLen - 1].value;
      prevUnrate = uObs[uLen - 2].value;
      const avg3m = (uObs[uLen - 1].value + uObs[uLen - 2].value + uObs[uLen - 3].value) / 3;
      const min12m = Math.min(...uObs.slice(-12).map(x => x.value));
      sahmDelta = parseFloat((avg3m - min12m).toFixed(2));
    }

    let icsaLatestK: number | null = null;
    let icsaPrevK: number | null = null;
    if (icsa.isValid && icsa.observations.length >= 4) {
      const iObs = icsa.observations;
      const iLen = iObs.length;
      icsaLatestK = Math.round(iObs[iLen - 1].value / 1000);
      icsaPrevK = Math.round(iObs[iLen - 2].value / 1000);
      icsa4wAvg = Math.round(
        iObs.slice(-4).reduce((s, o) => s + o.value, 0) / 4
      );
    }

    let state: FedPivotSignalState = 'UNCONFIRMED';
    let rawScore = 0;
    let rationale = '';

    if (
      (sahmDelta !== null && sahmDelta >= 0.35) ||
      (unemploymentRate !== null && unemploymentRate >= 4.4) ||
      (icsa4wAvg !== null && icsa4wAvg >= 240_000)
    ) {
      state = 'CONFIRMED';
      rawScore = 1.0;
      rationale = `Độ chùng lao động mở rộng (Thất nghiệp ${unemploymentRate ?? '--'}%, Sahm +${sahmDelta ?? '--'}%, Đơn trợ cấp TB 4T ${icsa4wAvg ? `${Math.round(icsa4wAvg / 1000)}K` : '--'}) ủng hộ nới lỏng chính sách.`;
    } else if (
      (sahmDelta !== null && sahmDelta >= 0.2) ||
      (unemploymentRate !== null && unemploymentRate >= 4.2) ||
      (icsa4wAvg !== null && icsa4wAvg >= 220_000)
    ) {
      state = 'PARTIAL';
      rawScore = 0.5;
      rationale = `Tỷ lệ thất nghiệp nhích nhẹ lên ${unemploymentRate ?? '--'}% (Sahm +${sahmDelta ?? 0}%), trong khi đơn trợ cấp tuần ở mức ${icsaLatestK ?? '--'}K.`;
    } else if (
      unemploymentRate !== null &&
      unemploymentRate <= 3.9 &&
      (icsa4wAvg === null || icsa4wAvg < 205_000)
    ) {
      state = 'CONFLICTING';
      rawScore = 0;
      rationale = `Thất nghiệp thấp (${unemploymentRate}%) và số đơn xin trợ cấp thấp (${icsaLatestK ?? '--'}K) phản ánh thị trường lao động rất thắt chặt.`;
    } else {
      state = 'UNCONFIRMED';
      rawScore = 0;
      rationale = `Thất nghiệp ở mức ${unemploymentRate ?? '--'}% và Initial Claims ${icsaLatestK ?? '--'}K — chưa xuất hiện suy yếu đột biến.`;
    }

    const uDiff =
      unemploymentRate !== null && prevUnrate !== null
        ? parseFloat((unemploymentRate - prevUnrate).toFixed(2))
        : null;

    signals.push({
      id: 'UNEMPLOYMENT_CLAIMS',
      order: 3,
      title: 'Tỷ lệ Thất nghiệp & Initial Jobless Claims',
      subtitle: 'Tỷ lệ thất nghiệp BLS (Sahm Rule) & Đơn trợ cấp hàng tuần',
      latestDisplay: `${unemploymentRate !== null ? `UR: ${unemploymentRate.toFixed(1)}%` : 'UR: N/A'} • ${icsaLatestK !== null ? `Claims: ${icsaLatestK}K` : 'Claims: N/A'}`,
      previousDisplay: `${prevUnrate !== null ? `UR trước: ${prevUnrate.toFixed(1)}%` : ''}${icsaPrevK !== null ? ` • Claims trước: ${icsaPrevK}K` : ''}`.trim() || 'N/A',
      deltaDisplay: `${uDiff !== null ? `UR ${uDiff >= 0 ? '+' : ''}${uDiff}%` : ''}${sahmDelta !== null ? ` (Sahm +${sahmDelta.toFixed(2)}%)` : ''}`.trim() || 'N/A',
      latestNumeric: unemploymentRate,
      previousNumeric: prevUnrate,
      state,
      rawScore,
      effectiveScore: rawScore,
      rationale,
      source: 'BLS (UNRATE) & US DOL (ICSA) via FRED',
      releaseDate: unrate.isValid ? formatEffectiveReleaseDate(unrate) : formatEffectiveReleaseDate(icsa),
      fetchedAtISO,
      isStale: Boolean(unrate.isStale && icsa.isStale),
    });
  }

  // ==================== DETERMINE EFFECTIVE FED FUNDS RATE ====================
  const fredEffrLatest =
    fredSeries.EFFR.isValid && fredSeries.EFFR.observations.length > 0
      ? fredSeries.EFFR.observations[fredSeries.EFFR.observations.length - 1].value
      : null;
  const effectiveRate = nyFedEffr?.effectiveRate ?? fredEffrLatest ?? futuresQuote.frontRate;

  // ==================== SIGNAL 4: FED FUNDS FUTURES (ZQ) ====================
  if (
    effectiveRate === null ||
    (futuresQuote.implied3mRate === null && futuresQuote.implied6mRate === null)
  ) {
    signals.push(
      unknownSignal(
        'FED_FUNDS_FUTURES',
        4,
        'Fed Funds Futures / Kỳ vọng lãi suất',
        'Đường cong hợp đồng tương lai lãi suất Fed 3–6 tháng trên CBOT',
        'NY Fed EFFR + CBOT 30-Day Fed Funds (ZQ)',
        fetchedAtISO,
        'Không nhận được báo giá hợp đồng tương lai ZQ hợp lệ — trạng thái UNKNOWN (0 điểm).'
      )
    );
  } else {
    const imp3m = futuresQuote.implied3mRate ?? futuresQuote.implied6mRate ?? effectiveRate;
    const imp6m = futuresQuote.implied6mRate ?? imp3m;
    zqDelta3mBps = Math.round((imp3m - effectiveRate) * 100);
    zqDelta6mBps = Math.round((imp6m - effectiveRate) * 100);

    let state: FedPivotSignalState = 'UNCONFIRMED';
    let rawScore = 0;
    let rationale = '';

    if (zqDelta6mBps <= -35 || zqDelta3mBps <= -20) {
      state = 'CONFIRMED';
      rawScore = 1.0;
      rationale = `Hợp đồng ZQ kỳ hạn 6 tháng (${futuresQuote.contract6m}) định giá ${imp6m.toFixed(2)}% (${zqDelta6mBps} bps so với EFFR ${effectiveRate.toFixed(2)}%), phản ánh kỳ vọng cắt giảm rõ rệt.`;
    } else if (zqDelta6mBps <= -15 || zqDelta3mBps <= -10) {
      state = 'PARTIAL';
      rawScore = 0.5;
      rationale = `Phái sinh lãi suất bắt đầu chiết khấu nhẹ khả năng nới lỏng (${zqDelta6mBps} bps trong 6 tháng tới).`;
    } else if (zqDelta6mBps >= 15 || zqDelta3mBps >= 10) {
      state = 'CONFLICTING';
      rawScore = 0;
      rationale = `Trái chiều Pivot: Hợp đồng ZQ 6 tháng định giá lãi suất ${imp6m.toFixed(2)}% (cao hơn EFFR hiện tại +${zqDelta6mBps} bps), nghiêng về kịch bản giữ cao/thắt chặt thêm.`;
    } else {
      state = 'UNCONFIRMED';
      rawScore = 0;
      rationale = `Hợp đồng tương lai ZQ định giá Fed giữ nguyên vùng lãi suất quanh ${effectiveRate.toFixed(2)}% (${zqDelta6mBps >= 0 ? '+' : ''}${zqDelta6mBps} bps/6T).`;
    }

    signals.push({
      id: 'FED_FUNDS_FUTURES',
      order: 4,
      title: 'Fed Funds Futures / Kỳ vọng lãi suất',
      subtitle: 'Chênh lệch lãi suất ngầm định CBOT ZQ (3T & 6T) so với EFFR',
      latestDisplay: `6T (${futuresQuote.contract6m}): ${imp6m.toFixed(2)}% • 3T: ${imp3m.toFixed(2)}%`,
      previousDisplay: `EFFR hiện hành: ${effectiveRate.toFixed(2)}%`,
      deltaDisplay: `${zqDelta6mBps >= 0 ? '+' : ''}${zqDelta6mBps} bps (6T vs EFFR)`,
      latestNumeric: imp6m,
      previousNumeric: effectiveRate,
      state,
      rawScore,
      effectiveScore: rawScore,
      rationale,
      source: 'NY Fed Official EFFR + CBOT ZQ Futures',
      releaseDate: nyFedEffr?.effectiveDate || fredSeries.EFFR.latestDate || fetchedAtISO.slice(0, 10),
      fetchedAtISO,
      isStale: false,
    });
  }

  // ==================== SIGNAL 5: US TREASURY 2Y ====================
  const dgs2 = fredSeries.DGS2;
  if (!dgs2.isValid || dgs2.observations.length < 21 || effectiveRate === null) {
    signals.push(
      unknownSignal(
        'US_TREASURY_2Y',
        5,
        'Lợi suất Trái phiếu Mỹ kỳ hạn 2 năm (US 2Y)',
        'Chỉ báo dẫn dắt chu kỳ lãi suất điều hành FOMC',
        dgs2.source,
        dgs2.fetchedAtISO || fetchedAtISO,
        dgs2.invalidReason || 'Thiếu dữ liệu lợi suất US 2Y hoặc EFFR đối chiếu.',
        dgs2.isStale
      )
    );
  } else {
    const obs = dgs2.observations;
    const n = obs.length;
    us2yYield = obs[n - 1].value;
    const prevDay2y = obs[n - 2].value;
    const prev20d2y = obs[Math.max(0, n - 21)].value;
    spread2yEffrBps = Math.round((us2yYield - effectiveRate) * 100);
    us2yDelta20dBps = Math.round((us2yYield - prev20d2y) * 100);

    let state: FedPivotSignalState = 'UNCONFIRMED';
    let rawScore = 0;
    let rationale = '';

    if (spread2yEffrBps >= 25) {
      state = 'CONFLICTING';
      rawScore = 0;
      rationale = `US 2Y ở mức ${us2yYield.toFixed(2)}%, cao hơn EFFR tới +${spread2yEffrBps} bps — thị trường trái phiếu đang định giá mặt bằng lãi suất thắt chặt kéo dài.`;
    } else if (spread2yEffrBps <= -35 && us2yDelta20dBps <= 0) {
      state = 'CONFIRMED';
      rawScore = 1.0;
      rationale = `Lợi suất US 2Y (${us2yYield.toFixed(2)}%) lùi sâu ${spread2yEffrBps} bps xuống dưới lãi suất EFFR (${effectiveRate.toFixed(2)}%) — tín hiệu trái phiếu dẫn dắt chu kỳ cắt giảm.`;
    } else if (spread2yEffrBps <= -15 || (spread2yEffrBps <= 5 && us2yDelta20dBps <= -25)) {
      state = 'PARTIAL';
      rawScore = 0.5;
      rationale = `US 2Y hạ nhiệt (${us2yDelta20dBps >= 0 ? '+' : ''}${us2yDelta20dBps} bps sau 20 phiên, chênh lệch ${spread2yEffrBps >= 0 ? '+' : ''}${spread2yEffrBps} bps so với EFFR).`;
    } else {
      state = 'UNCONFIRMED';
      rawScore = 0;
      rationale = `US 2Y (${us2yYield.toFixed(2)}%) dao động sát EFFR (${spread2yEffrBps >= 0 ? '+' : ''}${spread2yEffrBps} bps), chưa phát tín hiệu nới lỏng.`;
    }

    signals.push({
      id: 'US_TREASURY_2Y',
      order: 5,
      title: 'Lợi suất Trái phiếu Mỹ kỳ hạn 2 năm (US 2Y)',
      subtitle: 'Chênh lệch US 2Y − EFFR & xung lượng 20 phiên',
      latestDisplay: `${us2yYield.toFixed(2)}% (vs EFFR: ${spread2yEffrBps >= 0 ? '+' : ''}${spread2yEffrBps} bps)`,
      previousDisplay: `Phiên trước: ${prevDay2y.toFixed(2)}% • 20 phiên trước: ${prev20d2y.toFixed(2)}%`,
      deltaDisplay: `${us2yDelta20dBps >= 0 ? '+' : ''}${us2yDelta20dBps} bps (20 phiên)`,
      latestNumeric: us2yYield,
      previousNumeric: prevDay2y,
      state,
      rawScore,
      effectiveScore: rawScore,
      rationale,
      source: dgs2.source,
      releaseDate: formatEffectiveReleaseDate(dgs2),
      fetchedAtISO: dgs2.fetchedAtISO,
      isStale: dgs2.isStale,
    });
  }

  // ==================== ANTI-DOUBLE-COUNTING GUARD BETWEEN S4 & S5 ====================
  const s1Score = signals.find(s => s.id === 'CORE_PCE')?.rawScore ?? 0;
  const s2Score = signals.find(s => s.id === 'NFP_TREND')?.rawScore ?? 0;
  const s3Score = signals.find(s => s.id === 'UNEMPLOYMENT_CLAIMS')?.rawScore ?? 0;
  const realEconomyScoreSum = s1Score + s2Score + s3Score;

  const s4Item = signals.find(s => s.id === 'FED_FUNDS_FUTURES');
  const s5Item = signals.find(s => s.id === 'US_TREASURY_2Y');
  let collinearityApplied = false;
  let collinearityExplanation: string | undefined;

  if (s4Item && s5Item && s4Item.rawScore > 0 && s5Item.rawScore > 0) {
    // S4 and S5 are >0.90 correlated short-rate expectations.
    // Unlock full independent points ONLY when real-economy fundamentals (S1..S3 >= 1.0) AND 20d US2Y momentum (< -10 bps) both confirm.
    if (realEconomyScoreSum < 1.0) {
      const targetToCap = s5Item.rawScore <= s4Item.rawScore ? s5Item : s4Item;
      const cappedVal = parseFloat(Math.min(0.25, targetToCap.rawScore * 0.25).toFixed(2));
      if (cappedVal < targetToCap.rawScore) {
        targetToCap.effectiveScore = cappedVal;
        targetToCap.collinearityAdjusted = true;
        targetToCap.collinearityNote = `Khử đếm trùng tương quan S4–S5 (${targetToCap.rawScore}đ → ${cappedVal}đ do nhóm kinh tế thực S1–S3 chưa xác nhận).`;
        collinearityApplied = true;
        collinearityExplanation = targetToCap.collinearityNote;
      }
    } else if (us2yDelta20dBps > -10 && s5Item.rawScore > 0.5) {
      s5Item.effectiveScore = 0.5;
      s5Item.collinearityAdjusted = true;
      s5Item.collinearityNote =
        'Điều tiết tương quan S4–S5 (1.0đ → 0.5đ cho đến khi US 2Y giảm thêm ≥ 10 bps trong 20 phiên).';
      collinearityApplied = true;
      collinearityExplanation = s5Item.collinearityNote;
    }
  }

  // ==================== SIGNAL 6: US 10Y REAL YIELD (TIPS) & DXY ====================
  const dfii10 = fredSeries.DFII10;
  const dtwex = fredSeries.DTWEXBGS;
  if (!dfii10.isValid || dfii10.observations.length < 21) {
    signals.push(
      unknownSignal(
        'REAL_YIELD_DXY',
        6,
        'US 10Y Real Yield (TIPS) & Đồng USD (DXY)',
        'Mức độ thắt chặt lãi suất thực & sức mạnh đồng bạc xanh',
        dfii10.source,
        dfii10.fetchedAtISO || fetchedAtISO,
        dfii10.invalidReason || 'Thiếu dữ liệu lợi suất thực 10Y TIPS (DFII10).',
        dfii10.isStale
      )
    );
  } else {
    const rObs = dfii10.observations;
    const rLen = rObs.length;
    real10yYield = rObs[rLen - 1].value;
    const prevReal10y = rObs[rLen - 2].value;
    const prev20dReal10y = rObs[Math.max(0, rLen - 21)].value;
    const realDelta20dBps = Math.round((real10yYield - prev20dReal10y) * 100);

    let dtwex20dPct = 0;
    if (dtwex.isValid && dtwex.observations.length >= 21) {
      const dObs = dtwex.observations;
      const dCurr = dObs[dObs.length - 1].value;
      const dPrev20 = dObs[Math.max(0, dObs.length - 21)].value;
      if (dPrev20 > 0) {
        dtwex20dPct = parseFloat((((dCurr - dPrev20) / dPrev20) * 100).toFixed(2));
      }
      if (dxyValue === null) {
        dxyValue = parseFloat(dCurr.toFixed(2));
      }
    }

    const realEasing = real10yYield <= 1.75 || realDelta20dBps <= -20;
    const usdEasing =
      (futuresQuote.dxySpot !== null && futuresQuote.dxySpot <= 101.0) || dtwex20dPct <= -1.2;

    let state: FedPivotSignalState = 'UNCONFIRMED';
    let rawScore = 0;
    let rationale = '';

    if (realEasing && usdEasing) {
      state = 'CONFIRMED';
      rawScore = 1.0;
      rationale = `Lợi suất thực 10Y hạ nhiệt (${real10yYield.toFixed(2)}%, ${realDelta20dBps} bps/20d) đồng thuận cùng đồng USD suy yếu — nới lỏng điều kiện tài chính toàn cầu.`;
    } else if ((realEasing || usdEasing) && real10yYield < 2.25) {
      state = 'PARTIAL';
      rawScore = 0.5;
      rationale = `Một phần áp lực lãi suất thực / tỷ giá USD bắt đầu hạ nhiệt (Real 10Y: ${real10yYield.toFixed(2)}%, DXY: ${futuresQuote.dxySpot ?? 'Broad USD'}).`;
    } else if (
      real10yYield >= 2.15 ||
      (futuresQuote.dxySpot !== null && futuresQuote.dxySpot >= 104.2)
    ) {
      state = 'CONFLICTING';
      rawScore = 0;
      rationale = `Lợi suất thực Mỹ 10Y neo rất cao tại ${real10yYield.toFixed(2)}%${futuresQuote.dxySpot ? ` (DXY ${futuresQuote.dxySpot.toFixed(2)})` : ''}, phản ánh điều kiện tiền tệ thực vẫn đang thắt chặt mạnh.`;
    } else {
      state = 'UNCONFIRMED';
      rawScore = 0;
      rationale = `Lợi suất thực 10Y ở mức ${real10yYield.toFixed(2)}% (${realDelta20dBps >= 0 ? '+' : ''}${realDelta20dBps} bps/20d), đi ngang trung tính.`;
    }

    signals.push({
      id: 'REAL_YIELD_DXY',
      order: 6,
      title: 'US 10Y Real Yield (TIPS) & Đồng USD (DXY)',
      subtitle: 'Lợi suất thực đã trừ kỳ vọng lạm phát & chỉ số USD',
      latestDisplay: `Real 10Y: ${real10yYield.toFixed(2)}% • ${futuresQuote.dxySpot !== null ? `DXY: ${futuresQuote.dxySpot.toFixed(2)}` : `USD Broad: ${dxyValue ?? 'N/A'}`}`,
      previousDisplay: `Real trước: ${prevReal10y.toFixed(2)}% (20p trước: ${prev20dReal10y.toFixed(2)}%)`,
      deltaDisplay: `Real ${realDelta20dBps >= 0 ? '+' : ''}${realDelta20dBps} bps/20p${futuresQuote.dxyChangePct !== null ? ` • DXY ${futuresQuote.dxyChangePct >= 0 ? '+' : ''}${futuresQuote.dxyChangePct}%` : ''}`,
      latestNumeric: real10yYield,
      previousNumeric: prevReal10y,
      state,
      rawScore,
      effectiveScore: rawScore,
      rationale,
      source: 'Fed H.15 TIPS (DFII10) + ICE DXY / Fed Broad USD',
      releaseDate: formatEffectiveReleaseDate(dfii10),
      fetchedAtISO: dfii10.fetchedAtISO,
      isStale: dfii10.isStale,
    });
  }

  // ==================== SIGNAL 7: CREDIT SPREAD & FINANCIAL STRESS ====================
  const hy = fredSeries.BAMLH0A0HYM2;
  const fsi = fredSeries.STLFSI4;
  if ((!hy.isValid || hy.observations.length < 21) && (!fsi.isValid || fsi.observations.length < 2)) {
    signals.push(
      unknownSignal(
        'CREDIT_FINANCIAL_STRESS',
        7,
        'Credit Spread (HY OAS) & Financial Stress',
        'Chênh lệch tín dụng lợi suất cao & căng thẳng hệ thống tài chính',
        `${hy.source} + ${fsi.source}`,
        fetchedAtISO,
        hy.invalidReason || fsi.invalidReason || 'Thiếu dữ liệu Credit Spread và STLFSI4.',
        hy.isStale || fsi.isStale
      )
    );
  } else {
    let prevHy: number | null = null;
    let hyDelta20dBps = 0;
    if (hy.isValid && hy.observations.length >= 21) {
      const hObs = hy.observations;
      const hLen = hObs.length;
      hySpreadPct = hObs[hLen - 1].value;
      prevHy = hObs[hLen - 2].value;
      const prev20Hy = hObs[Math.max(0, hLen - 21)].value;
      hyDelta20dBps = Math.round((hySpreadPct - prev20Hy) * 100);
    }

    let prevStlfsi: number | null = null;
    if (fsi.isValid && fsi.observations.length >= 2) {
      const fObs = fsi.observations;
      stlfsiValue = fObs[fObs.length - 1].value;
      prevStlfsi = fObs[fObs.length - 2].value;
    }

    const s4Raw = s4Item?.rawScore ?? 0;
    const s5Raw = s5Item?.rawScore ?? 0;

    const isStressWidening =
      (hySpreadPct !== null && (hySpreadPct >= 4.5 || hyDelta20dBps >= 50)) ||
      (stlfsiValue !== null && stlfsiValue >= 0.75);

    const isBenignSoftLandingSupport =
      (hySpreadPct !== null && hySpreadPct < 3.65) &&
      (stlfsiValue === null || stlfsiValue <= 0.15) &&
      s1Score >= 0.5 &&
      (s4Raw >= 0.5 || s5Raw >= 0.5);

    let state: FedPivotSignalState = 'UNCONFIRMED';
    let rawScore = 0;
    let rationale = '';

    if (isStressWidening) {
      state = 'CONFIRMED';
      rawScore = 1.0;
      rationale = `Chênh lệch tín dụng giãn rộng (HY OAS ${hySpreadPct?.toFixed(2) ?? '--'}%, ${hyDelta20dBps >= 0 ? '+' : ''}${hyDelta20dBps} bps/20p; STLFSI4 ${stlfsiValue?.toFixed(2) ?? '--'}) gây áp lực buộc Fed can thiệp thanh khoản.`;
    } else if (isBenignSoftLandingSupport) {
      state = 'PARTIAL';
      rawScore = 0.5;
      rationale = `Điều kiện tín dụng ổn định (HY OAS ${hySpreadPct?.toFixed(2) ?? '--'}%, STLFSI4 ${stlfsiValue?.toFixed(2) ?? '--'}) đi kèm lạm phát hạ nhiệt — ủng hộ kịch bản Soft Landing.`;
    } else if (
      hySpreadPct !== null &&
      hySpreadPct < 3.45 &&
      (stlfsiValue === null || stlfsiValue < -0.2) &&
      s1Score === 0
    ) {
      state = 'CONFLICTING';
      rawScore = 0;
      rationale = `Chênh lệch tín dụng rất hẹp (HY OAS ${hySpreadPct.toFixed(2)}%, STLFSI4 ${stlfsiValue?.toFixed(2) ?? '--'} < 0): Thị trường tài chính dư dả thanh khoản khi lạm phát chưa hạ, Fed không có áp lực cắt giảm sớm.`;
    } else {
      state = 'UNCONFIRMED';
      rawScore = 0;
      rationale = `Chênh lệch tín dụng HY OAS ở mức ${hySpreadPct?.toFixed(2) ?? '--'}% (${hyDelta20dBps >= 0 ? '+' : ''}${hyDelta20dBps} bps/20p), chưa xuất hiện căng thẳng hệ thống.`;
    }

    signals.push({
      id: 'CREDIT_FINANCIAL_STRESS',
      order: 7,
      title: 'Credit Spread (HY OAS) & Financial Stress',
      subtitle: 'ICE BofA High Yield Spread & Chỉ số căng thẳng tài chính St. Louis Fed',
      latestDisplay: `${hySpreadPct !== null ? `HY OAS: ${hySpreadPct.toFixed(2)}%` : 'HY: N/A'} • ${stlfsiValue !== null ? `FSI: ${stlfsiValue.toFixed(2)}` : 'FSI: N/A'}`,
      previousDisplay: `${prevHy !== null ? `HY trước: ${prevHy.toFixed(2)}%` : ''}${prevStlfsi !== null ? ` • FSI trước: ${prevStlfsi.toFixed(2)}` : ''}`.trim() || 'N/A',
      deltaDisplay: `HY ${hyDelta20dBps >= 0 ? '+' : ''}${hyDelta20dBps} bps (20 phiên)`,
      latestNumeric: hySpreadPct,
      previousNumeric: prevHy,
      state,
      rawScore,
      effectiveScore: rawScore,
      rationale,
      source: 'ICE BofA (BAMLH0A0HYM2) & St. Louis Fed (STLFSI4)',
      releaseDate: hy.isValid ? formatEffectiveReleaseDate(hy) : formatEffectiveReleaseDate(fsi),
      fetchedAtISO,
      isStale: Boolean(hy.isStale && fsi.isStale),
    });
  }

  // ==================== AGGREGATE PIVOT SCORE & DATA QUALITY ====================
  const unknownSignalIds = signals.filter(s => s.state === 'UNKNOWN').map(s => s.id);
  const staleSignalIds = signals.filter(s => s.isStale).map(s => s.id);
  const validSignalsCount = signals.length - unknownSignalIds.length;
  const coverageRatioPct = Math.round((validSignalsCount / 7) * 100);

  const sumEffective = signals.reduce(
    (sum, s) => sum + (s.state === 'UNKNOWN' ? 0 : s.effectiveScore),
    0
  );
  const pivotScore = parseFloat(Math.min(7, Math.max(0, sumEffective)).toFixed(2));
  const mapped = mapPivotScoreToStatus(pivotScore);

  const confidenceTier: FedPivotDataQuality['confidenceTier'] =
    validSignalsCount >= 6 ? 'HIGH' : validSignalsCount >= 4 ? 'MEDIUM' : 'LOW';

  const confidenceLabel =
    confidenceTier === 'HIGH'
      ? `Độ tin cậy Cao (${validSignalsCount}/7 nguồn chính thức hợp lệ)`
      : confidenceTier === 'MEDIUM'
      ? `Độ tin cậy Trung bình (${validSignalsCount}/7 nguồn hợp lệ — một số nguồn đang cập nhật)`
      : `Độ tin cậy Thấp (${validSignalsCount}/7 nguồn — dữ liệu thiếu/quá hạn không được cộng điểm)`;

  return {
    pivotScore,
    status: mapped.status,
    statusLabel: mapped.label,
    statusDescription: mapped.description,
    signals,
    dataQuality: {
      validSignalsCount,
      totalSignalsCount: 7,
      coverageRatioPct,
      confidenceTier,
      confidenceLabel,
      unknownSignalIds,
      staleSignalIds,
      collinearityApplied,
      collinearityExplanation,
    },
    derivedMetrics: {
      corePceYoY,
      corePce3mAnn,
      corePce6mAnn,
      latestNfpK,
      nfp3mAvgK,
      unemploymentRate,
      sahmDelta,
      icsa4wAvg,
      effectiveRate,
      zqDelta3mBps,
      zqDelta6mBps,
      us2yYield,
      spread2yEffrBps,
      real10yYield,
      dxyValue,
      hySpreadPct,
      stlfsiValue,
    },
  };
}

/**
 * Deterministically reconstruct true point-in-time historical Pivot Score over the past 365 days
 * strictly from real FRED / BEA / BLS historical observations (respecting publication lags, zero synthetic data).
 */
export function buildHistoricalPivotSeriesAndEvents(
  bundle: RawFedPivotProviderBundle
): {
  historicalSeries: FedPivotHistoricalPoint[];
  eventMarkers: FedPivotMacroEventMarker[];
} {
  const anchorSeries = bundle.fredSeries.DGS2;
  if (!anchorSeries.isValid || anchorSeries.observations.length < 15) {
    return { historicalSeries: [], eventMarkers: [] };
  }

  const cutoffMs = bundle.fetchedAtMs - 370 * 86_400_000;
  const candidateDates = anchorSeries.observations.filter(o => {
    const ms = Date.parse(`${o.date}T00:00:00Z`);
    return Number.isFinite(ms) && ms >= cutoffMs;
  });

  if (candidateDates.length === 0) {
    return { historicalSeries: [], eventMarkers: [] };
  }

  const sliceSeriesAt = (
    src: ValidatedMacroSeries,
    asOfMs: number,
    minReq: number
  ): ValidatedMacroSeries => {
    const obs: TimeSeriesObservation[] = getObservationsAsOf(src, asOfMs);
    if (obs.length < minReq) {
      return {
        ...src,
        observations: obs,
        latestDate: obs[obs.length - 1]?.date ?? null,
        isValid: false,
        isStale: false,
      };
    }
    return {
      ...src,
      observations: obs,
      latestDate: obs[obs.length - 1].date,
      isValid: true,
      isStale: false,
    };
  };

  const historicalSeries: FedPivotHistoricalPoint[] = [];

  for (let i = 0; i < candidateDates.length; i++) {
    const d = candidateDates[i];
    const isLast = i === candidateDates.length - 1;
    // Sample every 2nd trading day on older history to keep UI ultra-snappy (~130 points/year), while keeping every recent 35 days daily!
    if (!isLast && candidateDates.length - i > 35 && i % 2 !== 0) {
      continue;
    }

    const asOfMs = Date.parse(`${d.date}T23:59:59Z`);
    const effrSlice = sliceSeriesAt(bundle.fredSeries.EFFR, asOfMs, 2);
    const dgs2Slice = sliceSeriesAt(bundle.fredSeries.DGS2, asOfMs, 21);

    const effrAtDate =
      effrSlice.observations[effrSlice.observations.length - 1]?.value ?? null;

    // On the final (today) point, use live ZQ futures; on historical dates where CBOT ZQ history isn't in FRED,
    // mark ZQ strictly UNKNOWN (0 pts), ensuring zero fabricated quotes.
    const pointBundle: RawFedPivotProviderBundle = {
      fetchedAtMs: asOfMs,
      fetchedAtISO: new Date(asOfMs).toISOString(),
      nyFedEffr: isLast
        ? bundle.nyFedEffr
        : effrAtDate !== null
        ? {
            effectiveRate: effrAtDate,
            targetRangeLow: Math.floor(effrAtDate * 4) / 4,
            targetRangeHigh: Math.floor(effrAtDate * 4) / 4 + 0.25,
            effectiveDate: d.date,
          }
        : null,
      futuresQuote: isLast
        ? bundle.futuresQuote
          : {
              frontRate: effrAtDate,
              implied1mRate: null,
              // Historical forward CBOT ZQ 3M/6M contracts are not in FRED -> strictly UNKNOWN (0 pts, zero synthetic proxy).
              implied3mRate: null,
              implied6mRate: null,
              contract3m: 'N/A',
              contract6m: 'N/A',
              dxySpot: null,
              dxyChangePct: null,
            },
      fredSeries: {
        PCEPILFE: sliceSeriesAt(bundle.fredSeries.PCEPILFE, asOfMs, 7),
        CPIAUCSL: sliceSeriesAt(bundle.fredSeries.CPIAUCSL, asOfMs, 3),
        PAYEMS: sliceSeriesAt(bundle.fredSeries.PAYEMS, asOfMs, 4),
        UNRATE: sliceSeriesAt(bundle.fredSeries.UNRATE, asOfMs, 12),
        ICSA: sliceSeriesAt(bundle.fredSeries.ICSA, asOfMs, 4),
        EFFR: effrSlice,
        DGS2: dgs2Slice,
        DFII10: sliceSeriesAt(bundle.fredSeries.DFII10, asOfMs, 21),
        DTWEXBGS: sliceSeriesAt(bundle.fredSeries.DTWEXBGS, asOfMs, 21),
        BAMLH0A0HYM2: sliceSeriesAt(bundle.fredSeries.BAMLH0A0HYM2, asOfMs, 21),
        STLFSI4: sliceSeriesAt(bundle.fredSeries.STLFSI4, asOfMs, 2),
      },
    };

    const evaluated = evaluateFedPivotSignalsAndScore(pointBundle);
    historicalSeries.push({
      dateISO: d.date,
      timestampSec: Math.floor(Date.parse(`${d.date}T00:00:00Z`) / 1000),
      score: evaluated.pivotScore,
      status: evaluated.status,
      validSignalsCount: evaluated.dataQuality.validSignalsCount,
    });
  }

  // Build Real Macro Event Markers (FOMC, CPI, PCE, NFP) within the 1Y historical + upcoming 45d window
  const eventMarkers: FedPivotMacroEventMarker[] = [];
  const minEventMs = cutoffMs;
  const maxEventMs = bundle.fetchedAtMs + 45 * 86_400_000;

  // 1. Official FOMC Meetings
  for (const f of OFFICIAL_FOMC_DATES_V2) {
    const ms = Date.parse(`${f.dateISO}T00:00:00Z`);
    if (ms >= minEventMs && ms <= maxEventMs) {
      eventMarkers.push({
        id: `ev-fomc-${f.dateISO}`,
        dateISO: f.dateISO,
        timestampSec: Math.floor(ms / 1000),
        type: 'FOMC',
        shortTag: 'FOMC',
        title: f.label,
        detail: f.hasDotPlot
          ? 'Quyết định lãi suất FOMC kèm Biểu đồ Chấm (SEP Dot Plot)'
          : 'Quyết định lãi suất điều hành FOMC',
      });
    }
  }

  // 2. Real Historical Release Dates for PCE, CPI, NFP derived from actual FRED observations + standard agency lag
  const addReleaseMarkers = (
    series: ValidatedMacroSeries,
    type: 'PCE' | 'CPI' | 'NFP',
    labelPrefix: string
  ) => {
    const lagMs = (PUBLICATION_LAG_DAYS[series.seriesId] ?? 35) * 86_400_000;
    for (const obs of series.observations) {
      const releaseMs = Date.parse(`${obs.date}T00:00:00Z`) + lagMs;
      if (releaseMs >= minEventMs && releaseMs <= bundle.fetchedAtMs) {
        const relISO = new Date(releaseMs).toISOString().slice(0, 10);
        eventMarkers.push({
          id: `ev-${type.toLowerCase()}-${obs.date}`,
          dateISO: relISO,
          timestampSec: Math.floor(releaseMs / 1000),
          type,
          shortTag: type,
          title: `${labelPrefix} (kỳ ${obs.date.slice(0, 7)})`,
          detail: `Công bố dữ liệu ${type} chính thức từ cơ quan thống kê Mỹ`,
        });
      }
    }
  };

  addReleaseMarkers(bundle.fredSeries.PCEPILFE, 'PCE', 'Công bố Core PCE');
  addReleaseMarkers(bundle.fredSeries.CPIAUCSL, 'CPI', 'Công bố Lạm phát CPI');
  addReleaseMarkers(bundle.fredSeries.PAYEMS, 'NFP', 'Công bố Bảng lương NFP');

  eventMarkers.sort((a, b) => a.timestampSec - b.timestampSec);

  return { historicalSeries, eventMarkers };
}
