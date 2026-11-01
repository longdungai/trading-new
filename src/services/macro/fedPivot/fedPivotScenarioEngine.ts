import {
  FedPivotAssetGroupImpact,
  FedPivotScenarioAnalysis,
  FedPivotScenarioId,
  FedPivotSignalId,
  FedPivotSignalItem,
} from '../../../types/fedPivotV2';
import { EvaluatedPivotRuleOutput } from './fedPivotRulesEngine';

const METHODOLOGY_NOTE =
  'Đánh giá định tính theo Ma trận Quy tắc Đa Biến (Rule-based Multi-Signal Regime Matrix) trên dữ liệu chính thức FRED/BEA/BLS/NY Fed. Hệ thống chủ động KHÔNG gán xác suất phần trăm (%) giả định khi chưa có chuỗi kiểm định hậu nghiệm đủ dài.';

function findSignal(
  signals: FedPivotSignalItem[],
  id: FedPivotSignalId
): FedPivotSignalItem | undefined {
  return signals.find(s => s.id === id);
}

export function evaluateFedPivotScenarios(
  evaluated: EvaluatedPivotRuleOutput
): {
  dominantScenarioId: FedPivotScenarioId;
  dominantScenarioLabel: string;
  scenarios: FedPivotScenarioAnalysis[];
  macroNarrativeSummary: string;
} {
  const { signals, derivedMetrics: m, pivotScore, dataQuality } = evaluated;

  const s1 = findSignal(signals, 'CORE_PCE');
  const s2 = findSignal(signals, 'NFP_TREND');
  const s3 = findSignal(signals, 'UNEMPLOYMENT_CLAIMS');
  const s4 = findSignal(signals, 'FED_FUNDS_FUTURES');
  const s5 = findSignal(signals, 'US_TREASURY_2Y');
  const s6 = findSignal(signals, 'REAL_YIELD_DXY');
  const s7 = findSignal(signals, 'CREDIT_FINANCIAL_STRESS');

  // ==================== 1. SOFT LANDING ====================
  const softSupport: string[] = [];
  const softConflict: string[] = [];
  let softPoints = 0;

  if (m.corePce3mAnn !== null) {
    if (m.corePce3mAnn <= 2.75) {
      softPoints += 2;
      softSupport.push(
        `Core PCE 3 tháng chuẩn hóa năm hạ về ${m.corePce3mAnn.toFixed(2)}%, mở dư địa nới lỏng chủ động.`
      );
    } else if (m.corePce6mAnn !== null && m.corePce3mAnn < m.corePce6mAnn) {
      softPoints += 1;
      softSupport.push(
        `Lạm phát lõi 3 tháng (${m.corePce3mAnn.toFixed(2)}%) đang giảm tốc so với trung bình 6 tháng (${m.corePce6mAnn.toFixed(2)}%).`
      );
    } else {
      softConflict.push(
        `Core PCE 3 tháng (${m.corePce3mAnn.toFixed(2)}%) chưa giảm đủ sâu về vùng mục tiêu 2.0–2.5% của FOMC.`
      );
    }
  } else {
    softConflict.push('Thiếu dữ liệu Core PCE hợp lệ để xác nhận xu hướng giảm phát ổn định.');
  }

  if (m.nfp3mAvgK !== null) {
    if (m.nfp3mAvgK >= 40 && m.nfp3mAvgK <= 175) {
      softPoints += 2;
      softSupport.push(
        `Bảng lương NFP trung bình 3 tháng duy trì dương ổn định (+${m.nfp3mAvgK}K việc làm), chưa rơi vào thu hẹp việc làm.`
      );
    } else if (m.nfp3mAvgK > 175) {
      softPoints += 0.5;
      softConflict.push(
        `Tăng trưởng việc làm còn nóng (+${m.nfp3mAvgK}K/tháng), khiến Fed chưa vội cắt giảm lãi suất.`
      );
    } else {
      softConflict.push(
        `NFP trung bình 3 tháng suy yếu sâu (${m.nfp3mAvgK}K), nghiêng sang rủi ro suy thoái hơn là hạ cánh mềm.`
      );
    }
  }

  if (m.hySpreadPct !== null) {
    if (m.hySpreadPct < 3.85 && (m.stlfsiValue === null || m.stlfsiValue < 0.25)) {
      softPoints += 1.5;
      softSupport.push(
        `Chênh lệch tín dụng HY OAS ở vùng lành mạnh (${m.hySpreadPct.toFixed(2)}%), không có dấu hiệu đứt gãy thanh khoản.`
      );
    } else if (m.hySpreadPct >= 4.2) {
      softConflict.push(
        `HY Credit Spread giãn lên ${m.hySpreadPct.toFixed(2)}%, cảnh báo áp lực tài chính doanh nghiệp gia tăng.`
      );
    }
  }

  if ((s4 && s4.rawScore >= 0.5) || (s5 && s5.rawScore >= 0.5)) {
    softPoints += 1.5;
    softSupport.push(
      'Thị trường lãi suất ngắn hạn (CBOT ZQ / US 2Y) bắt đầu định giá lộ trình hạ lãi suất điều hành.'
    );
  } else {
    softConflict.push(
      `Thị trường hợp đồng tương lai ZQ (${m.zqDelta6mBps !== null ? `${m.zqDelta6mBps >= 0 ? '+' : ''}${m.zqDelta6mBps} bps/6T` : 'N/A'}) và US 2Y chưa định giá cắt giảm lãi suất gần.`
    );
  }

  // ==================== 2. RECESSION ====================
  const recSupport: string[] = [];
  const recConflict: string[] = [];
  let recPoints = 0;

  if (m.sahmDelta !== null) {
    if (m.sahmDelta >= 0.5) {
      recPoints += 3;
      recSupport.push(
        `Chỉ báo Sahm Rule đạt +${m.sahmDelta.toFixed(2)}% (≥ ngưỡng suy thoái lịch sử 0.50%).`
      );
    } else if (m.sahmDelta >= 0.3) {
      recPoints += 1.5;
      recSupport.push(
        `Độ chùng thất nghiệp mở rộng (Sahm +${m.sahmDelta.toFixed(2)}%, tỷ lệ thất nghiệp ${m.unemploymentRate?.toFixed(1) ?? '--'}%).`
      );
    } else {
      recConflict.push(
        `Sahm Rule ở mức thấp (+${m.sahmDelta.toFixed(2)}% < 0.50%), chưa kích hoạt tín hiệu suy thoái lao động.`
      );
    }
  }

  if (m.nfp3mAvgK !== null) {
    if (m.nfp3mAvgK <= 35 || (m.latestNfpK !== null && m.latestNfpK < 0)) {
      recPoints += 2.5;
      recSupport.push(
        `Đà tạo việc làm suy yếu nghiêm trọng (kỳ gần nhất ${m.latestNfpK ?? 0}K, TB 3 tháng ${m.nfp3mAvgK}K).`
      );
    } else if (m.nfp3mAvgK <= 95) {
      recPoints += 1;
      recSupport.push(`Tăng trưởng việc làm TB 3 tháng chậm lại còn +${m.nfp3mAvgK}K.`);
    } else {
      recConflict.push(
        `Khu vực phi nông nghiệp vẫn tạo trung bình +${m.nfp3mAvgK}K việc làm/tháng.`
      );
    }
  }

  if (m.icsa4wAvg !== null) {
    if (m.icsa4wAvg >= 255_000) {
      recPoints += 1.5;
      recSupport.push(
        `Đơn xin trợ cấp thất nghiệp TB 4 tuần dâng cao lên ${Math.round(m.icsa4wAvg / 1000)}K.`
      );
    } else {
      recConflict.push(
        `Initial Jobless Claims TB 4 tuần ổn định ở mức ${Math.round(m.icsa4wAvg / 1000)}K (< ngưỡng cảnh báo sa thải diện rộng 255K).`
      );
    }
  }

  // ==================== 3. FINANCIAL STRESS ====================
  const stressSupport: string[] = [];
  const stressConflict: string[] = [];
  let stressPoints = 0;

  if (m.hySpreadPct !== null) {
    if (m.hySpreadPct >= 5.0) {
      stressPoints += 3.5;
      stressSupport.push(
        `High-Yield Credit Spread bùng nổ lên ${m.hySpreadPct.toFixed(2)}% (≥ 5.00%), phản ánh co thắt tín dụng nghiêm trọng.`
      );
    } else if (m.hySpreadPct >= 4.25) {
      stressPoints += 1.5;
      stressSupport.push(
        `Chênh lệch tín dụng doanh nghiệp HY OAS mở rộng lên ${m.hySpreadPct.toFixed(2)}%.`
      );
    } else {
      stressConflict.push(
        `HY Credit Spread đang hẹp ở mức ${m.hySpreadPct.toFixed(2)}% (< ngưỡng căng thẳng 4.50%).`
      );
    }
  }

  if (m.stlfsiValue !== null) {
    if (m.stlfsiValue >= 1.0) {
      stressPoints += 3.0;
      stressSupport.push(
        `Chỉ số căng thẳng tài chính St. Louis Fed (STLFSI4 = +${m.stlfsiValue.toFixed(2)}) vượt xa mức trung bình lịch sử.`
      );
    } else if (m.stlfsiValue >= 0.4) {
      stressPoints += 1.5;
      stressSupport.push(
        `Chỉ số STLFSI4 chuyển dương (+${m.stlfsiValue.toFixed(2)}), cho thấy điều kiện thanh khoản đang thắt lại.`
      );
    } else {
      stressConflict.push(
        `Chỉ số căng thẳng tài chính STLFSI4 ở mức ${m.stlfsiValue.toFixed(2)} (≤ 0 nghĩa là thanh khoản hệ thống ổn định).`
      );
    }
  }

  if (m.spread2yEffrBps !== null && m.spread2yEffrBps <= -60 && s7?.state === 'CONFIRMED') {
    stressPoints += 1.5;
    stressSupport.push(
      `Lợi suất US 2Y lao dốc ${m.spread2yEffrBps} bps dưới EFFR do dòng tiền tháo chạy tìm nơi trú ẩn (Flight-to-Quality).`
    );
  }

  // Fallback non-empty arrays so UI cards are always informative
  if (softSupport.length === 0) {
    softSupport.push('Chưa có cụm chỉ báo nới lỏng chủ động nào xác nhận đầy đủ ở kỳ dữ liệu hiện tại.');
  }
  if (recSupport.length === 0) {
    recSupport.push('Chưa ghi nhận tín hiệu suy thoái diện rộng trên bảng lương NFP hoặc Sahm Rule.');
  }
  if (stressSupport.length === 0) {
    stressSupport.push('Chưa xuất hiện dấu hiệu rạn nứt thanh khoản liên ngân hàng hay giãn rộng tín dụng.');
  }

  const toConfidence = (
    pts: number,
    isPivotActive: boolean
  ): Pick<FedPivotScenarioAnalysis, 'confidenceTier' | 'confidenceLabel'> => {
    if (dataQuality.validSignalsCount < 3) {
      return {
        confidenceTier: 'LOW',
        confidenceLabel: 'Thấp (Độ phủ dữ liệu hạn chế)',
      };
    }
    if (pts >= 5.0 && (isPivotActive || pts >= 5.5)) {
      return {
        confidenceTier: 'HIGH',
        confidenceLabel: 'Mức độ tin cậy: Cao',
      };
    }
    if (pts >= 3.0) {
      return {
        confidenceTier: 'MODERATE',
        confidenceLabel: 'Mức độ tin cậy: Trung bình',
      };
    }
    if (pts >= 1.5) {
      return {
        confidenceTier: 'LOW',
        confidenceLabel: 'Mức độ tin cậy: Thấp (Theo dõi sớm)',
      };
    }
    return {
      confidenceTier: 'INACTIVE',
      confidenceLabel: 'Chưa kích hoạt',
    };
  };

  // Determine dominant scenario
  let dominantScenarioId: FedPivotScenarioId = 'SOFT_LANDING';
  if (stressPoints >= 4.0 && stressPoints >= recPoints && stressPoints >= softPoints) {
    dominantScenarioId = 'FINANCIAL_STRESS';
  } else if (recPoints >= 3.5 && recPoints > softPoints) {
    dominantScenarioId = 'RECESSION';
  } else {
    dominantScenarioId = 'SOFT_LANDING';
  }

  const isPivotActive = pivotScore >= 2.75;
  const softConf = toConfidence(softPoints, isPivotActive);
  const recConf = toConfidence(recPoints, isPivotActive);
  const stressConf = toConfidence(stressPoints, isPivotActive);

  const scenarios: FedPivotScenarioAnalysis[] = [
    {
      id: 'SOFT_LANDING',
      title: 'Soft Landing',
      vietnameseTitle: 'Hạ Cánh Mềm (Nới Lỏng Chủ Động)',
      definition:
        'Fed cắt giảm lãi suất từng bước để đưa lãi suất thực về mức trung tính khi lạm phát hạ nhiệt bền vững trong lúc tăng trưởng và việc làm vẫn đứng vững.',
      ...softConf,
      methodologyNote: METHODOLOGY_NOTE,
      isDominant: dominantScenarioId === 'SOFT_LANDING',
      supportingEvidence: softSupport,
      conflictingSignals: softConflict,
      confirmationConditions: [
        'Core PCE 3 tháng chuẩn hóa năm duy trì ≤ 2.55% trong ít nhất 2 kỳ công bố liên tiếp.',
        'NFP trung bình 3 tháng giữ vùng dương vừa phải (+50K đến +140K) và Sahm Rule < 0.40%.',
        'HY Credit Spread ổn định dưới 3.90% khi ZQ 6T / US 2Y định giá hạ ≥ 25 bps.',
      ],
      expectedMarketImpact:
        'Tích cực nhất cho tài sản rủi ro: S&P 500, Nasdaq, BTC/ETH và VN-Index mở rộng định giá P/E bền vững; Vàng tăng ổn định nhờ lợi suất thực và DXY hạ nhiệt.',
    },
    {
      id: 'RECESSION',
      title: 'Recession Pivot',
      vietnameseTitle: 'Suy Thoái Kinh Tế (Nới Lỏng Bị Động)',
      definition:
        'Fed buộc phải cắt giảm lãi suất mạnh và nhanh hơn dự kiến do cầu tiêu dùng sụt giảm, tỷ lệ thất nghiệp bật tăng và tăng trưởng việc làm âm.',
      ...recConf,
      methodologyNote: METHODOLOGY_NOTE,
      isDominant: dominantScenarioId === 'RECESSION',
      supportingEvidence: recSupport,
      conflictingSignals: recConflict,
      confirmationConditions: [
        'Chỉ báo Sahm Rule vượt ≥ 0.50% hoặc tỷ lệ thất nghiệp tăng vượt 4.5%.',
        'NFP trung bình 3 tháng giảm xuống dưới +35K và Initial Claims TB 4 tuần vượt 255K.',
        'Đường cong lợi suất US 2Y đảo chiều giảm gắt (Bull Steepening) nhanh hơn US 10Y.',
      ],
      expectedMarketImpact:
        'Phân hóa mạnh: Vàng (XAUUSD) và trái phiếu chính phủ hưởng lợi trú ẩn; Cổ phiếu Mỹ, VN-Index và Altcoin thường chịu nhịp điều chỉnh EPS trước khi tạo đáy thanh khoản.',
    },
    {
      id: 'FINANCIAL_STRESS',
      title: 'Financial Stress',
      vietnameseTitle: 'Căng Thẳng Tài Chính (Can Thiệp Khẩn Cấp)',
      definition:
        'Fed hạ lãi suất khẩn cấp hoặc mở cửa sổ thanh khoản do sự cố hệ thống ngân hàng, đứt gãy thị trường Repo/Trái phiếu hoặc sốc tín dụng doanh nghiệp.',
      ...stressConf,
      methodologyNote: METHODOLOGY_NOTE,
      isDominant: dominantScenarioId === 'FINANCIAL_STRESS',
      supportingEvidence: stressSupport,
      conflictingSignals: stressConflict,
      confirmationConditions: [
        'ICE BofA High-Yield Spread (HY OAS) giãn vọt ≥ 5.00% hoặc tăng > 75 bps trong 20 phiên.',
        'Chỉ số St. Louis Fed Financial Stress (STLFSI4) vượt ngưỡng +1.0.',
        'Hợp đồng ZQ kỳ hạn gần định giá cắt giảm khẩn cấp ≥ 50 bps ngoài lịch họp hoặc ngay kỳ tới.',
      ],
      expectedMarketImpact:
        'Biến động hai chiều cực đoan: Ngắn hạn xảy ra bán tháo giải chấp chéo (Dash-for-Cash), sau đó Vàng và Bitcoin phục hồi mạnh nhất khi Fed bơm thanh khoản hệ thống.',
    },
  ];

  const dominantObj = scenarios.find(s => s.id === dominantScenarioId)!;
  const dominantScenarioLabel =
    pivotScore < 1.25 && dominantScenarioId === 'SOFT_LANDING'
      ? 'Giữ Lãi Suất Cao (Higher-for-Longer) • Theo Dõi Soft Landing'
      : `${dominantObj.title} — ${dominantObj.vietnameseTitle}`;

  let macroNarrativeSummary = '';
  if (pivotScore < 1.25) {
    macroNarrativeSummary = `Điểm hội tụ đạt ${pivotScore.toFixed(2)}/7 (${evaluated.statusLabel}): Các dữ liệu chính thức hiện nghiêng về trạng thái giữ nguyên lãi suất điều hành; chưa đủ điều kiện hội tụ cho chu kỳ nới lỏng sớm.`;
  } else if (dominantScenarioId === 'FINANCIAL_STRESS') {
    macroNarrativeSummary = `Điểm hội tụ đạt ${pivotScore.toFixed(2)}/7 trong bối cảnh căng thẳng tín dụng gia tăng: Cần ưu tiên quản trị rủi ro thanh khoản và theo dõi sát chênh lệch HY OAS / STLFSI4.`;
  } else if (dominantScenarioId === 'RECESSION') {
    macroNarrativeSummary = `Điểm hội tụ đạt ${pivotScore.toFixed(2)}/7 dẫn dắt bởi sự suy yếu của dữ liệu lao động (NFP / Thất nghiệp): Kỳ vọng Fed nới lỏng đi kèm rủi ro suy giảm tăng trưởng lợi nhuận doanh nghiệp.`;
  } else {
    macroNarrativeSummary = `Điểm hội tụ đạt ${pivotScore.toFixed(2)}/7 hướng về kịch bản Soft Landing: Lạm phát và kỳ vọng lãi suất hạ nhiệt dần trong khi thị trường lao động và tín dụng chưa xuất hiện đổ vỡ.`;
  }

  if (s1?.state === 'CONFLICTING' || s6?.state === 'CONFLICTING') {
    macroNarrativeSummary +=
      ' Lưu ý: Vẫn tồn tại lực cản từ lạm phát lõi hoặc lợi suất thực neo cao.';
  }

  return {
    dominantScenarioId,
    dominantScenarioLabel,
    scenarios,
    macroNarrativeSummary,
  };
}

export function evaluateFedPivotAssetImpacts(
  evaluated: EvaluatedPivotRuleOutput,
  dominantScenarioId: FedPivotScenarioId
): FedPivotAssetGroupImpact[] {
  const { pivotScore, derivedMetrics: m, signals } = evaluated;
  const s6 = findSignal(signals, 'REAL_YIELD_DXY');
  const isPivotBuilding = pivotScore >= 2.75;
  const isStressOrRecession =
    dominantScenarioId === 'RECESSION' || dominantScenarioId === 'FINANCIAL_STRESS';
  const isHawkishHeadwind =
    pivotScore < 1.5 &&
    ((m.zqDelta6mBps !== null && m.zqDelta6mBps >= 15) || s6?.state === 'CONFLICTING');

  // 1. Gold XAUUSD
  const goldImpact: FedPivotAssetGroupImpact = {
    id: 'GOLD_XAUUSD',
    groupTitle: 'Vàng Thế Giới & Kim Loại Quý',
    assetsLabel: 'XAUUSD • PAXGUSDT • SILVER',
    directionBias: isPivotBuilding
      ? 'BULLISH'
      : isHawkishHeadwind
      ? 'VOLATILE_TWO_WAY'
      : 'NEUTRAL_SELECTIVE',
    directionLabel: isPivotBuilding
      ? 'Tích cực (Thuận chiều Lợi suất thực giảm)'
      : isHawkishHeadwind
      ? 'Giằng co biên độ rộng (Áp lực Real Yield)'
      : 'Trung lập • Tích lũy chờ xác nhận',
    impactMechanism: `Vàng vận động ngược chiều trực tiếp với Lợi suất thực Mỹ 10Y TIPS (${m.real10yYield !== null ? `${m.real10yYield.toFixed(2)}%` : 'N/A'}) và DXY (${m.dxyValue !== null ? m.dxyValue.toFixed(2) : 'N/A'}). ${
      isStressOrRecession
        ? 'Kịch bản suy thoái/căng thẳng tài chính càng củng cố dòng vốn trú ẩn vào XAUUSD.'
        : 'Khi Pivot Score vượt 3.0 kèm Real Yield hạ nhiệt, chi phí cơ hội nắm giữ Vàng giảm mạnh.'
    }`,
    confirmationCondition:
      'Xác nhận xu hướng tăng bền vững khi US 10Y Real Yield lùi xuống dưới 1.80% và US 2Y giảm dẫn dắt EFFR ≥ 25 bps.',
    contrarianReversalRisk:
      'Rủi ro phản ứng ngược: Nếu CPI/Core PCE bất ngờ bật tăng trở lại khiến DXY và lợi suất thực bật vọt, Vàng dễ chịu nhịp rũ bỏ đòn bẩy ngắn hạn hoặc hiện tượng "Sell the news" ngay sau quyết định cắt lãi suất đã được định giá hết.',
    jumpTickers: ['XAUUSD', 'PAXGUSDT', 'SILVER'],
  };

  // 2. Crypto Majors (BTC, ETH, BNB)
  const cryptoImpact: FedPivotAssetGroupImpact = {
    id: 'CRYPTO_MAJORS',
    groupTitle: 'Tài Sản Số Vốn Hóa Lớn (Crypto Majors)',
    assetsLabel: 'BTC • ETH • BNB',
    directionBias:
      isPivotBuilding && !isStressOrRecession
        ? 'BULLISH'
        : isStressOrRecession
        ? 'VOLATILE_TWO_WAY'
        : isHawkishHeadwind
        ? 'BEARISH'
        : 'NEUTRAL_SELECTIVE',
    directionLabel:
      isPivotBuilding && !isStressOrRecession
        ? 'Tích cực (Độ nhạy thanh khoản cao)'
        : isStressOrRecession
        ? 'Biến động 2 chiều (Rủi ro rũ thanh khoản trước khi hồi)'
        : isHawkishHeadwind
        ? 'Thận trọng (Chi phí vốn USD neo cao)'
        : 'Chọn lọc • Giao dịch theo biên độ',
    impactMechanism:
      'BTC, ETH và BNB có hệ số beta cao với chu kỳ thanh khoản USD toàn cầu và kỳ vọng lãi suất thực. Kịch bản Soft Landing giúp dòng vốn ETF và tổ chức gia tăng tỷ trọng.',
    confirmationCondition:
      'Cần đồng thuận giữa Fed Funds Futures định giá cắt giảm (ZQ 6T ≤ −25 bps), DXY suy yếu và HY Credit Spread không vượt quá 4.25%.',
    contrarianReversalRisk:
      'Rủi ro phản ứng ngược: Nếu Fed cắt lãi suất khẩn cấp do Financial Stress hoặc suy thoái sâu, thị trường phái sinh Crypto thường xảy ra nhịp quét thanh lý Long đòn bẩy cùng nhịp bán tháo cổ phiếu công nghệ trước khi hưởng lợi từ bơm tiền.',
    jumpTickers: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
  };

  // 3. US Equities (S&P 500, Nasdaq)
  const usEquityImpact: FedPivotAssetGroupImpact = {
    id: 'US_EQUITIES',
    groupTitle: 'Chứng Khoán Mỹ (S&P 500 & Nasdaq)',
    assetsLabel: 'S&P 500 • Nasdaq • NVDA • AAPL • TSLA',
    directionBias:
      isPivotBuilding && dominantScenarioId === 'SOFT_LANDING'
        ? 'BULLISH'
        : isStressOrRecession
        ? 'BEARISH'
        : isHawkishHeadwind
        ? 'NEUTRAL_SELECTIVE'
        : 'NEUTRAL_SELECTIVE',
    directionLabel:
      isPivotBuilding && dominantScenarioId === 'SOFT_LANDING'
        ? 'Tích cực (Mở rộng định giá P/E nhóm Growth)'
        : isStressOrRecession
        ? 'Phòng thủ (Rủi ro hạ dự phóng EPS)'
        : 'Phân hóa chọn lọc theo KQKD',
    impactMechanism:
      'Tác động lên S&P 500 và Nasdaq phụ thuộc quyết định vào LÝ DO Fed xoay trục: Hạ cánh mềm giúp giảm lãi suất chiết khấu DCF mà không làm hỏng EPS; ngược lại Suy thoái khiến áp lực giảm lợi nhuận lấn át lợi ích hạ lãi suất.',
    confirmationCondition:
      'Xác nhận tích cực khi Core PCE giảm về ≤ 2.6%, NFP duy trì trên +75K/tháng và lợi suất US 10Y không vượt 4.50%.',
    contrarianReversalRisk:
      'Rủi ro phản ứng ngược: Lịch sử cho thấy nếu Fed cắt lãi suất khi Sahm Rule ≥ 0.50% và HY Spread giãn rộng, chỉ số S&P 500/Nasdaq thường điều chỉnh do định giá lại rủi ro lợi nhuận doanh nghiệp.',
    jumpTickers: ['NVDA', 'AAPL', 'TSLA'],
  };

  // 4. Vietnam Equities (VN-Index & VN Stocks)
  const vnEquityImpact: FedPivotAssetGroupImpact = {
    id: 'VN_EQUITIES',
    groupTitle: 'VN-Index & Cổ Phiếu Việt Nam',
    assetsLabel: 'VN-Index • VN30 • FPT • SSI • VCB • HPG',
    directionBias:
      isPivotBuilding && dominantScenarioId === 'SOFT_LANDING'
        ? 'BULLISH'
        : isStressOrRecession
        ? 'VOLATILE_TWO_WAY'
        : isHawkishHeadwind
        ? 'BEARISH'
        : 'NEUTRAL_SELECTIVE',
    directionLabel:
      isPivotBuilding && dominantScenarioId === 'SOFT_LANDING'
        ? 'Tích cực (Giải tỏa áp lực tỷ giá & khối ngoại)'
        : isStressOrRecession
        ? 'Thận trọng (Áp lực đơn hàng xuất khẩu)'
        : isHawkishHeadwind
        ? 'Chịu sức ép tỷ giá & dòng vốn ngoại'
        : 'Trung lập • Phân hóa theo ngành nội địa',
    impactMechanism:
      'Fed hạ lãi suất thu hẹp chênh lệch lãi suất USD–VND (Swap), giải phóng dư địa điều hành tiền tệ trong nước và giảm áp lực rút ròng của khối ngoại trên HOSE (hỗ trợ nhóm Chứng khoán, Ngân hàng, Thép).',
    confirmationCondition:
      'Xác nhận thuận lợi khi DXY lùi về dưới 101.5, tỷ giá liên ngân hàng USD/VND hạ nhiệt bền vững và đơn hàng xuất khẩu sang Mỹ không bị suy thoái tác động.',
    contrarianReversalRisk:
      'Rủi ro phản ứng ngược: Nếu Fed xoay trục vì kinh tế Mỹ suy thoái, nhu cầu nhập khẩu của Mỹ sụt giảm sẽ ảnh hưởng trực tiếp tới nhóm xuất khẩu Việt Nam, dù áp lực tỷ giá USD/VND được giải tỏa.',
    jumpTickers: ['VNINDEX', 'VN30', 'FPT', 'SSI', 'VCB', 'HPG'],
  };

  // 5. DXY & USD/VND
  const fxImpact: FedPivotAssetGroupImpact = {
    id: 'FX_DXY_USDVND',
    groupTitle: 'Chỉ Số Đồng USD (DXY) & Tỷ Giá USD/VND',
    assetsLabel: 'DXY • USD/VND (Liên thị trường)',
    directionBias:
      isPivotBuilding && dominantScenarioId !== 'FINANCIAL_STRESS'
        ? 'BEARISH'
        : dominantScenarioId === 'FINANCIAL_STRESS'
        ? 'VOLATILE_TWO_WAY'
        : isHawkishHeadwind
        ? 'BULLISH'
        : 'NEUTRAL_SELECTIVE',
    directionLabel:
      isPivotBuilding && dominantScenarioId !== 'FINANCIAL_STRESS'
        ? 'Hạ nhiệt / Suy yếu (Thu hẹp chênh lệch lãi suất USD)'
        : dominantScenarioId === 'FINANCIAL_STRESS'
        ? 'Biến động mạnh (Cầu trú ẩn USD ngắn hạn)'
        : isHawkishHeadwind
        ? 'Neo cao (Ưu thế lãi suất USD duy trì)'
        : 'Đi ngang trong biên độ kiểm soát',
    impactMechanism: `Chênh lệch lợi suất US 2Y (${m.us2yYield !== null ? `${m.us2yYield.toFixed(2)}%` : 'N/A'}) và kỳ vọng FOMC quyết định sức hút dòng vốn ngắn hạn vào USD, từ đó truyền dẫn trực tiếp sang áp lực tỷ giá USD/VND.`,
    confirmationCondition:
      'DXY xác nhận xu hướng giảm trung hạn khi cả US 2Y và US 10Y Real Yield đồng loạt tạo đỉnh thấp dần và FOMC mở tín hiệu nới lỏng trên Dot Plot.',
    contrarianReversalRisk:
      'Rủi ro "Dollar Smile": Trong giai đoạn hoảng loạn tài chính toàn cầu (Financial Stress) hoặc khi các ngân hàng trung ương khác (ECB/BoJ) cắt lãi suất nhanh hơn Fed, DXY vẫn có thể bật tăng ngược chiều dù Fed đang nới lỏng.',
    jumpTickers: ['XAUUSD', 'VNINDEX', 'FPT', 'DGC'],
  };

  return [goldImpact, cryptoImpact, usEquityImpact, vnEquityImpact, fxImpact];
}
