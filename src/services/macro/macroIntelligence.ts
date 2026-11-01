import {
  FedPivotFactorCheck,
  FedPivotStance,
  FedPivotWatchSnapshot,
  FedRateCurvePoint,
  MacroAlertItem,
  MacroCalendarEvent,
  MacroIndicatorItem,
  MacroIntelligenceSnapshot,
  MacroRegime,
  MarketSymbol,
  SymbolMacroImpact,
} from '../../types';
import { isVietnamMarketSymbol } from '../../utils/marketHours';

const YAHOO_BASES = ['/api/yahoo', 'https://query1.finance.yahoo.com'];
const FAPI_BASES = ['/api/fapi', 'https://fapi.binance.com'];
const NYFED_EFFR_URL = 'https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json';
const CME_MONTH_CODES = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];

// Official Federal Reserve FOMC Rate Decision Calendar (2:00 PM ET on Day 2 -> 18:00 UTC EDT / 19:00 UTC EST)
const OFFICIAL_FOMC_DECISIONS: Array<{ iso: string; label: string; hasDotPlot: boolean }> = [
  { iso: '2026-01-28T19:00:00Z', label: 'T1/2026', hasDotPlot: false },
  { iso: '2026-03-18T18:00:00Z', label: 'T3/2026', hasDotPlot: true },
  { iso: '2026-04-29T18:00:00Z', label: 'T4/2026', hasDotPlot: false },
  { iso: '2026-06-17T18:00:00Z', label: 'T6/2026', hasDotPlot: true },
  { iso: '2026-07-29T18:00:00Z', label: 'T7/2026', hasDotPlot: false },
  { iso: '2026-09-16T18:00:00Z', label: 'T9/2026', hasDotPlot: true },
  { iso: '2026-10-28T18:00:00Z', label: 'T10/2026', hasDotPlot: false },
  { iso: '2026-12-09T19:00:00Z', label: 'T12/2026', hasDotPlot: true },
  { iso: '2027-01-27T19:00:00Z', label: 'T1/2027', hasDotPlot: false },
  { iso: '2027-03-17T18:00:00Z', label: 'T3/2027', hasDotPlot: true },
  { iso: '2027-04-28T18:00:00Z', label: 'T4/2027', hasDotPlot: false },
  { iso: '2027-06-09T18:00:00Z', label: 'T6/2027', hasDotPlot: true },
  { iso: '2027-07-28T18:00:00Z', label: 'T7/2027', hasDotPlot: false },
  { iso: '2027-09-15T18:00:00Z', label: 'T9/2027', hasDotPlot: true },
  { iso: '2027-10-27T18:00:00Z', label: 'T10/2027', hasDotPlot: false },
  { iso: '2027-12-08T19:00:00Z', label: 'T12/2027', hasDotPlot: true },
];

const VN_OIL_BENEFICIARIES = new Set(['GAS', 'PVD', 'PVS', 'BSR', 'PLX', 'OIL']);
const VN_OIL_COST_SENSITIVE = new Set(['VJC', 'HVN', 'MWG', 'MSN', 'SAB', 'VNM']);
const VN_FX_BENEFICIARIES = new Set(['FPT', 'DGC', 'VHC', 'ANV', 'TNG', 'GVR']);
const VN_RATE_SENSITIVE = new Set([
  'VNINDEX', 'VN30', 'SSI', 'VND', 'VCI', 'HCM', 'VIC', 'VHM', 'VRE', 'DIG', 'DXG', 'PDR', 'NVL',
  'VCB', 'TCB', 'MBB', 'VPB', 'ACB', 'BID', 'CTG', 'STB', 'HDB', 'SHB', 'TPB', 'VIB', 'SSB',
]);

let cachedMacroSnapshot: MacroIntelligenceSnapshot | null = null;
let macroFetchInFlight: Promise<MacroIntelligenceSnapshot | null> | null = null;
const MACRO_TTL_MS = 45_000;

interface ParsedSparkMetric {
  last: number;
  changePct: number;
}

function parseSparkEntry(entry: any): ParsedSparkMetric | null {
  if (!entry || !Array.isArray(entry.close)) return null;
  const closes = entry.close.filter(
    (v: any): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
  );
  if (closes.length === 0) return null;

  const last = closes[closes.length - 1];
  let changePct = 0;

  if (
    typeof entry.fulldayChangePercent === 'number' &&
    Number.isFinite(entry.fulldayChangePercent) &&
    entry.fulldayChangePercent !== 0
  ) {
    changePct = parseFloat(entry.fulldayChangePercent.toFixed(2));
  } else {
    let prev =
      typeof entry.chartPreviousClose === 'number' && entry.chartPreviousClose > 0
        ? entry.chartPreviousClose
        : last;
    for (let i = closes.length - 2; i >= 0; i--) {
      if (closes[i] !== last) {
        prev = closes[i];
        break;
      }
    }
    if (prev > 0) {
      changePct = parseFloat((((last - prev) / prev) * 100).toFixed(2));
    }
  }

  return { last, changePct };
}

function getForwardZqContract(now: Date, monthsAhead: number): string {
  const totalMonths = now.getUTCFullYear() * 12 + now.getUTCMonth() + monthsAhead;
  const year = Math.floor(totalMonths / 12);
  const monthIdx = totalMonths % 12;
  const yy = String(year % 100).padStart(2, '0');
  return `ZQ${CME_MONTH_CODES[monthIdx]}${yy}.CBT`;
}

interface NyFedEffrData {
  effectiveRate: number;
  targetRangeLow: number;
  targetRangeHigh: number;
  effectiveDate: string;
}

async function fetchOfficialNyFedEffr(): Promise<NyFedEffrData | null> {
  try {
    const res = await fetch(NYFED_EFFR_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json();
    const row = json?.refRates?.[0];
    if (!row || typeof row.percentRate !== 'number') return null;
    return {
      effectiveRate: parseFloat(row.percentRate.toFixed(2)),
      targetRangeLow:
        typeof row.targetRateFrom === 'number'
          ? parseFloat(row.targetRateFrom.toFixed(2))
          : parseFloat((Math.floor(row.percentRate * 4) / 4).toFixed(2)),
      targetRangeHigh:
        typeof row.targetRateTo === 'number'
          ? parseFloat(row.targetRateTo.toFixed(2))
          : parseFloat((Math.floor(row.percentRate * 4) / 4 + 0.25).toFixed(2)),
      effectiveDate: typeof row.effectiveDate === 'string' ? row.effectiveDate : '',
    };
  } catch {
    return null;
  }
}

async function fetchYahooMacroSpark(extraSymbols: string[] = []): Promise<Record<string, ParsedSparkMetric>> {
  const symbols = [
    'DX-Y.NYB',
    'VND=X',
    '^TNX',
    '^IRX',
    '^VIX',
    'BZ=F',
    '^GSPC',
    '^IXIC',
    'ZQ=F',
    ...extraSymbols,
  ];
  const query = `/v8/finance/spark?symbols=${encodeURIComponent(symbols.join(','))}&range=5d&interval=1d`;

  for (const base of YAHOO_BASES) {
    try {
      const res = await fetch(`${base}${query}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const raw = await res.json();
      const out: Record<string, ParsedSparkMetric> = {};
      for (const s of symbols) {
        const parsed = parseSparkEntry(raw?.[s]);
        if (parsed) out[s] = parsed;
      }
      if (Object.keys(out).length > 0) return out;
    } catch {
      // try next base
    }
  }
  return {};
}

async function fetchRealBinanceBtcFunding(): Promise<{ fundingPct8h: number; markPrice: number } | null> {
  const query = '/fapi/v1/premiumIndex?symbol=BTCUSDT';
  for (const base of FAPI_BASES) {
    try {
      const res = await fetch(`${base}${query}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();
      const rate = parseFloat(data?.lastFundingRate);
      const mark = parseFloat(data?.markPrice);
      if (Number.isFinite(rate) && Number.isFinite(mark) && mark > 0) {
        return {
          fundingPct8h: parseFloat((rate * 100).toFixed(4)),
          markPrice: mark,
        };
      }
    } catch {
      // try next base
    }
  }
  return null;
}

// Compute nth weekday (0=Sun..6=Sat) of a given year & month (0-based month) at a specific UTC timestamp
function getNthWeekdayOfMonth(
  year: number,
  monthZeroBased: number,
  targetWeekday: number,
  nth: number,
  utcHour: number,
  utcMinute: number
): Date {
  const firstDay = new Date(Date.UTC(year, monthZeroBased, 1, utcHour, utcMinute, 0));
  const firstWeekday = firstDay.getUTCDay();
  const offset = (targetWeekday - firstWeekday + 7) % 7;
  const dayOfMonth = 1 + offset + (nth - 1) * 7;
  return new Date(Date.UTC(year, monthZeroBased, dayOfMonth, utcHour, utcMinute, 0));
}

function formatVNDate(d: Date): string {
  const dtf = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return dtf.format(d);
}

// Deterministic, rule-based official financial market calendar (zero fabricated news)
export function buildUpcomingMacroCalendar(now: Date = new Date()): MacroCalendarEvent[] {
  const events: MacroCalendarEvent[] = [];
  const nowMs = now.getTime();

  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth();

  for (let mOffset = 0; mOffset <= 2; mOffset++) {
    const y = curYear + Math.floor((curMonth + mOffset) / 12);
    const m = (curMonth + mOffset) % 12;

    // 1. Đáo hạn Phái sinh Hợp đồng Tương lai VN30F1M: Thứ Năm tuần thứ 3 hàng tháng lúc 14:45 GMT+7 (= 07:45 UTC)
    const vn30Expiry = getNthWeekdayOfMonth(y, m, 4, 3, 7, 45);
    if (vn30Expiry.getTime() >= nowMs - 3600_000 * 4) {
      const diffHours = Math.max(0, Math.round((vn30Expiry.getTime() - nowMs) / 3600_000));
      events.push({
        id: `vn30f1m-${y}-${m + 1}`,
        title: `Đáo hạn Phái sinh VN30F1M (T${m + 1}/${y})`,
        market: 'VN',
        dateISO: vn30Expiry.toISOString(),
        dateLabel: `${formatVNDate(vn30Expiry)} (GMT+7)`,
        daysRemaining: Math.floor(diffHours / 24),
        hoursRemaining: diffHours,
        impactLevel: 'HIGH',
        guidance:
          'Thứ Năm tuần thứ 3 hàng tháng: Phiên ATC (14:30–14:45) trên HOSE thường xuất hiện lệnh cân danh mục lớn ở rổ VN30, hạn chế mua đuổi giá ATC.',
      });
    }

    // 2. Báo cáo Bảng lương Phi nông nghiệp Mỹ (Non-Farm Payrolls): Thứ Sáu đầu tiên hàng tháng lúc 08:30 ET (~12:30/13:30 UTC)
    const nfpDate = getNthWeekdayOfMonth(y, m, 5, 1, 13, 30);
    if (nfpDate.getTime() >= nowMs - 3600_000 * 2) {
      const diffHours = Math.max(0, Math.round((nfpDate.getTime() - nowMs) / 3600_000));
      events.push({
        id: `us-nfp-${y}-${m + 1}`,
        title: `Bảng lương Non-Farm Mỹ (NFP T${m + 1})`,
        market: 'GLOBAL',
        dateISO: nfpDate.toISOString(),
        dateLabel: `${formatVNDate(nfpDate)} (GMT+7)`,
        daysRemaining: Math.floor(diffHours / 24),
        hoursRemaining: diffHours,
        impactLevel: 'HIGH',
        guidance:
          'Dữ liệu lao động Mỹ quyết định kỳ vọng lãi suất Fed; gây biến động tức thời ±1.5–3% lên Vàng (XAUUSD), DXY, BTC và hợp đồng tương lai Mỹ.',
      });
    }

    // 3. Đáo hạn Quyền chọn Mỹ (US Monthly OpEx / Triple Witching T3,6,9,12): Thứ Sáu tuần thứ 3 hàng tháng (20:00 UTC)
    const isQuarterly = m === 2 || m === 5 || m === 8 || m === 11;
    const usOpex = getNthWeekdayOfMonth(y, m, 5, 3, 20, 0);
    if (usOpex.getTime() >= nowMs - 3600_000 * 2) {
      const diffHours = Math.max(0, Math.round((usOpex.getTime() - nowMs) / 3600_000));
      events.push({
        id: `us-opex-${y}-${m + 1}`,
        title: isQuarterly
          ? `Cơ cấu Quỹ ETF Quý & US Triple Witching (T${m + 1})`
          : `Đáo hạn Quyền chọn Chứng khoán Mỹ (OpEx T${m + 1})`,
        market: isQuarterly ? 'VN' : 'GLOBAL',
        dateISO: usOpex.toISOString(),
        dateLabel: `${formatVNDate(usOpex)}`,
        daysRemaining: Math.floor(diffHours / 24),
        hoursRemaining: diffHours,
        impactLevel: isQuarterly ? 'HIGH' : 'MEDIUM',
        guidance: isQuarterly
          ? 'Thứ Sáu tuần thứ 3 cuối Quý: Các quỹ ETF ngoại (FTSE/VNM) hoàn tất cơ cấu danh mục tại HOSE phiên ATC đồng thời đáo hạn phái sinh Quý tại Mỹ.'
          : 'Đáo hạn quyền chọn tháng tại Phố Wall (NVDA, TSLA, AAPL, SPY, QQQ); thanh khoản và biên độ biến động tăng mạnh.',
      });
    }
  }

  // 4. Lịch Họp Quyết Định Lãi Suất Chính Thức FOMC (Federal Reserve + Biểu đồ Dot Plot)
  for (const fomc of OFFICIAL_FOMC_DECISIONS) {
    const dt = new Date(fomc.iso);
    if (dt.getTime() >= nowMs - 3600_000 * 4) {
      const diffHours = Math.max(0, Math.round((dt.getTime() - nowMs) / 3600_000));
      if (diffHours <= 24 * 75) {
        events.push({
          id: `fomc-${fomc.label}`,
          title: fomc.hasDotPlot
            ? `Họp FOMC Công Bố Lãi Suất Fed & Dot Plot (${fomc.label})`
            : `Họp FOMC Công Bố Quyết Định Lãi Suất Fed (${fomc.label})`,
          market: 'GLOBAL',
          dateISO: dt.toISOString(),
          dateLabel: `${formatVNDate(dt)} (GMT+7)`,
          daysRemaining: Math.floor(diffHours / 24),
          hoursRemaining: diffHours,
          impactLevel: 'HIGH',
          guidance: fomc.hasDotPlot
            ? 'Kỳ họp FOMC đặc biệt kèm Biểu đồ Chấm (SEP Dot Plot) dự phóng lộ trình lãi suất của các thống đốc Fed & họp báo Chủ tịch Fed lúc 02:30 sáng GMT+7.'
            : 'Công bố quyết định lãi suất điều hành Fed Funds Rate & thông điệp chính sách tiền tệ (Hawkish / Dovish Pivot).',
        });
      }
    }
  }

  return events
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime())
    .slice(0, 6);
}

export async function fetchMacroIntelligenceSnapshot(
  forceRefresh: boolean = false
): Promise<MacroIntelligenceSnapshot | null> {
  if (!forceRefresh && cachedMacroSnapshot && Date.now() - cachedMacroSnapshot.updatedAt < MACRO_TTL_MS) {
    return cachedMacroSnapshot;
  }

  if (macroFetchInFlight) {
    return macroFetchInFlight;
  }

  macroFetchInFlight = (async () => {
    try {
      const nowDate = new Date();
      const zq1mSym = getForwardZqContract(nowDate, 1);
      const zq3mSym = getForwardZqContract(nowDate, 3);
      const zq6mSym = getForwardZqContract(nowDate, 6);

      const [spark, btcFunding, nyFedEffr] = await Promise.all([
        fetchYahooMacroSpark([zq1mSym, zq3mSym, zq6mSym]),
        fetchRealBinanceBtcFunding(),
        fetchOfficialNyFedEffr(),
      ]);

      const indicators: MacroIndicatorItem[] = [];
      const alerts: MacroAlertItem[] = [];
      let regimeScore = 0; // Positive = Risk-On, Negative = Risk-Off

      const dxy = spark['DX-Y.NYB'];
      const usdvnd = spark['VND=X'];
      const us10y = spark['^TNX'];
      const us3m = spark['^IRX'];
      const vix = spark['^VIX'];
      const brent = spark['BZ=F'];
      const sp500 = spark['^GSPC'];
      const nasdaq = spark['^IXIC'];
      const zqFront = spark['ZQ=F'];
      const zq1m = spark[zq1mSym];
      const zq3m = spark[zq3mSym];
      const zq6m = spark[zq6mSym];

      // 1. DXY
      if (dxy) {
        const isHighStress = dxy.last >= 104.5 || dxy.changePct >= 0.65;
        const isSupportive = dxy.last <= 100.8 || dxy.changePct <= -0.5;
        indicators.push({
          id: 'DXY',
          label: 'Chỉ số Đô la Mỹ (DXY)',
          shortLabel: 'DXY',
          value: parseFloat(dxy.last.toFixed(2)),
          displayValue: dxy.last.toFixed(2),
          changePercent: dxy.changePct,
          status: isHighStress ? 'STRESS' : isSupportive ? 'FAVORABLE' : 'NORMAL',
          impactSummary:
            'Ngược chiều với Vàng (XAUUSD), Bitcoin và gây sức ép lên tỷ giá USD/VND khi bứt phá tăng mạnh.',
          source: 'ICE / Yahoo Finance (DX-Y.NYB)',
        });

        if (isHighStress) {
          regimeScore -= 20;
          alerts.push({
            id: 'alert-dxy-surge',
            severity: 'WARNING',
            title: 'Đồng USD (DXY) Mạnh Lên Gây Sức Ép Định Giá',
            message: `DXY đạt ${dxy.last.toFixed(2)} (${dxy.changePct >= 0 ? '+' : ''}${dxy.changePct}%), tạo lực cản ngắn hạn lên Vàng quốc tế, Crypto và tỷ giá mới nổi.`,
            affectedAssets: ['XAUUSD', 'BTCUSDT', 'VNINDEX'],
            metricBadge: `DXY ${dxy.last.toFixed(2)}`,
          });
        } else if (isSupportive) {
          regimeScore += 14;
        }
      }

      // 2. USD/VND Exchange Rate
      if (usdvnd) {
        const isFxStress = usdvnd.last >= 25500 || usdvnd.changePct >= 0.3;
        const isFxExtreme = usdvnd.last >= 25750;
        indicators.push({
          id: 'USDVND',
          label: 'Tỷ giá thực tế USD/VND',
          shortLabel: 'USD/VND',
          value: Math.round(usdvnd.last),
          displayValue: `${Math.round(usdvnd.last).toLocaleString('en-US')}₫`,
          changePercent: usdvnd.changePct,
          status: isFxExtreme ? 'STRESS' : isFxStress ? 'ELEVATED' : 'NORMAL',
          impactSummary:
            'Biến số trọng yếu nhất của TTCK Việt Nam: Tỷ giá neo cao tạo áp lực bán ròng khối ngoại & lãi suất liên ngân hàng.',
          source: 'FX Interbank / Yahoo (VND=X)',
        });

        if (isFxStress) {
          regimeScore -= isFxExtreme ? 16 : 8;
          alerts.push({
            id: 'alert-usdvnd-high',
            severity: isFxExtreme ? 'CRITICAL' : 'WARNING',
            title: 'Áp Lực Tỷ Giá USD/VND Neo Cao Đối Với Chứng Khoán VN',
            message: `Tỷ giá USD/VND giao dịch ở mức ${Math.round(usdvnd.last).toLocaleString('en-US')}₫. Cần thận trọng với nhóm nhạy cảm lãi suất/khối ngoại (Chứng khoán, BĐS); ưu tiên doanh nghiệp thu ngoại tệ (FPT, DGC).`,
            affectedAssets: ['VNINDEX', 'VN30', 'SSI', 'VIC', 'FPT'],
            metricBadge: `${Math.round(usdvnd.last).toLocaleString('en-US')}₫`,
          });
        }
      }

      // 3. US 10Y Treasury Yield & 3M Yield Curve
      const yieldCurveSpread =
        us10y && us3m ? parseFloat((us10y.last - us3m.last).toFixed(2)) : 0;

      if (us10y) {
        const isYieldTight = us10y.last >= 4.5;
        indicators.push({
          id: 'US10Y',
          label: 'Lợi suất Trái phiếu Mỹ 10Y',
          shortLabel: 'US10Y',
          value: parseFloat(us10y.last.toFixed(2)),
          displayValue: `${us10y.last.toFixed(2)}%`,
          changePercent: us10y.changePct,
          status: us10y.last >= 4.75 ? 'STRESS' : isYieldTight ? 'ELEVATED' : 'NORMAL',
          impactSummary: us3m
            ? `Chi phí vốn chuẩn toàn cầu (Chênh lệch 10Y–3M: ${yieldCurveSpread >= 0 ? '+' : ''}${yieldCurveSpread}%). Lợi suất > 4.5% gây áp lực chiết khấu dòng tiền cổ phiếu Tech & Vàng.`
            : 'Chi phí vốn chuẩn toàn cầu; lợi suất cao gây áp lực lên định giá cổ phiếu tăng trưởng và Vàng.',
          source: 'CBOE / US Treasury (^TNX)',
        });

        if (us10y.last >= 4.65) {
          regimeScore -= 14;
          alerts.push({
            id: 'alert-us10y-high',
            severity: 'WARNING',
            title: 'Lợi Suất Trái Phiếu Mỹ 10Y Ở Vùng Thắt Chặt (> 4.65%)',
            message: `US10Y hiện đạt ${us10y.last.toFixed(2)}%, làm tăng chi phí cơ hội nắm giữ tài sản không trả lãi suất (Vàng) và ép P/E nhóm Big Tech (NVDA, TSLA, AAPL).`,
            affectedAssets: ['NVDA', 'TSLA', 'AAPL', 'XAUUSD'],
            metricBadge: `US10Y ${us10y.last.toFixed(2)}%`,
          });
        }
      }

      // 4. CBOE VIX Volatility Index
      let kellyDamper = 1.0;
      if (vix) {
        const isPanic = vix.last >= 28 || vix.changePct >= 20;
        const isElevated = vix.last >= 19.5 || vix.changePct >= 10;
        indicators.push({
          id: 'VIX',
          label: 'Chỉ số Biến động & Sợ hãi VIX',
          shortLabel: 'VIX',
          value: parseFloat(vix.last.toFixed(2)),
          displayValue: vix.last.toFixed(2),
          changePercent: vix.changePct,
          status: isPanic ? 'STRESS' : isElevated ? 'ELEVATED' : 'FAVORABLE',
          impactSummary:
            'Đo chi phí phòng vệ rủi ro S&P 500; VIX tăng vọt cảnh báo biến động mạnh lan sang Crypto & TTCK châu Á.',
          source: 'CBOE Volatility Index (^VIX)',
        });

        if (isPanic) {
          regimeScore -= 32;
          kellyDamper = 0.5;
          alerts.push({
            id: 'alert-vix-panic',
            severity: 'CRITICAL',
            title: 'Cảnh Báo Đỏ: Chỉ Số Sợ Hãi VIX Bùng Nổ (Risk-Off Toàn Cầu)',
            message: `VIX ở mức ${vix.last.toFixed(2)} (${vix.changePct >= 0 ? '+' : ''}${vix.changePct}%). Khuyến nghị hạ ngay tỷ trọng giao dịch xuống 50% chuẩn Kelly và tuyệt đối tránh đòn bẩy cao.`,
            affectedAssets: ['BTCUSDT', 'NVDA', 'VNINDEX', 'VN30'],
            metricBadge: `VIX ${vix.last.toFixed(2)} (${vix.changePct >= 0 ? '+' : ''}${vix.changePct}%)`,
          });
        } else if (isElevated) {
          regimeScore -= 18;
          kellyDamper = 0.72;
          alerts.push({
            id: 'alert-vix-spike',
            severity: 'WARNING',
            title: 'Chỉ Số VIX Tăng Mạnh — Cảnh Báo Rung Lắc Liên Thị Trường',
            message: `VIX tăng ${vix.changePct >= 0 ? '+' : ''}${vix.changePct}% lên ${vix.last.toFixed(2)}. Hệ thống quản trị vốn tự động kích hoạt hệ số phòng thủ (0.72x Kelly) để bảo vệ tài khoản.`,
            affectedAssets: ['NVDA', 'BTCUSDT', 'VNINDEX'],
            metricBadge: `VIX +${vix.changePct}%`,
          });
        } else if (vix.last < 15.5) {
          regimeScore += 12;
        }
      }

      // 5. Brent Crude Oil (Inflation & Geopolitical Shock Gauge)
      if (brent) {
        const isOilShock = brent.last >= 95 || brent.changePct >= 3.0;
        indicators.push({
          id: 'BRENT',
          label: 'Giá Dầu Brent Quốc tế',
          shortLabel: 'BRENT',
          value: parseFloat(brent.last.toFixed(2)),
          displayValue: `$${brent.last.toFixed(2)}`,
          changePercent: brent.changePct,
          status: brent.last >= 100 ? 'STRESS' : isOilShock ? 'ELEVATED' : 'NORMAL',
          impactSummary:
            'Phong vũ biểu địa chính trị & lạm phát CPI; giá dầu cao hưởng lợi nhóm Dầu khí (GAS, PVD, PVS, BSR) nhưng tăng chi phí Vận tải/Tiêu dùng.',
          source: 'ICE Futures / Yahoo (BZ=F)',
        });

        if (isOilShock) {
          regimeScore -= 10;
          alerts.push({
            id: 'alert-brent-inflation',
            severity: brent.last >= 100 ? 'CRITICAL' : 'WARNING',
            title: 'Cú Sốc Giá Dầu Brent Neo Cao — Áp Lực Lạm Phát Chi Phí Đẩy',
            message: `Dầu Brent giao dịch tại $${brent.last.toFixed(2)}/thùng (${brent.changePct >= 0 ? '+' : ''}${brent.changePct}%). Hỗ trợ tích cực cổ phiếu Dầu khí (GAS, PVD, PVS, BSR, PLX) nhưng tạo áp lực chi phí lên Hàng không (VJC) và kỳ vọng lãi suất.`,
            affectedAssets: ['OIL_WTI', 'OIL_BRENT', 'GAS', 'PVD', 'PVS', 'BSR', 'VJC'],
            metricBadge: `Brent $${brent.last.toFixed(1)}`,
          });
        }
      }

      // 6. US Equity Benchmarks (Nasdaq & S&P 500 Overnight Lead Indicator)
      if (nasdaq) {
        const isTechSelloff = nasdaq.changePct <= -1.8;
        const isTechRally = nasdaq.changePct >= 1.5;
        indicators.push({
          id: 'NASDAQ',
          label: 'Chỉ số Nasdaq Composite',
          shortLabel: 'NASDAQ',
          value: Math.round(nasdaq.last),
          displayValue: Math.round(nasdaq.last).toLocaleString('en-US'),
          changePercent: nasdaq.changePct,
          status: isTechSelloff ? 'STRESS' : isTechRally ? 'FAVORABLE' : 'NORMAL',
          impactSummary: sp500
            ? `Khẩu vị rủi ro công nghệ toàn cầu (S&P 500: ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct}%). Dẫn dắt tâm lý phiên kế tiếp của Crypto & VN30.`
            : 'Dẫn dắt khẩu vị rủi ro cổ phiếu công nghệ, AI và Crypto toàn cầu.',
          source: 'NASDAQ (^IXIC)',
        });

        if (isTechSelloff) {
          regimeScore -= 18;
          alerts.push({
            id: 'alert-nasdaq-selloff',
            severity: 'WARNING',
            title: 'Phố Wall Điều Chỉnh Mạnh — Chú Ý Hiệu Ứng Lan Truyền Đầu Phiên',
            message: `Nasdaq giảm ${nasdaq.changePct}%${sp500 ? ` và S&P 500 ${sp500.changePct}%` : ''} trong phiên gần nhất, thường tạo áp lực tâm lý lên Crypto và nhịp mở cửa ATO của thị trường châu Á / Việt Nam.`,
            affectedAssets: ['NVDA', 'TSLA', 'AAPL', 'BTCUSDT', 'VNINDEX', 'FPT'],
            metricBadge: `Nasdaq ${nasdaq.changePct}%`,
          });
        } else if (isTechRally) {
          regimeScore += 16;
        }
      }

      // 7. Real Binance Perpetual Futures Funding Rate (8h)
      if (btcFunding) {
        const f = btcFunding.fundingPct8h;
        const isOverheatedLong = f >= 0.045;
        const isShortCrowded = f <= -0.015;
        indicators.push({
          id: 'BTC_FUNDING',
          label: 'BTC Funding Rate 8h (Phái sinh)',
          shortLabel: 'FUNDING',
          value: f,
          displayValue: `${f >= 0 ? '+' : ''}${f.toFixed(4)}%`,
          changePercent: f,
          status: isOverheatedLong ? 'STRESS' : isShortCrowded ? 'FAVORABLE' : 'NORMAL',
          impactSummary:
            'Lãi suất giữ lệnh hợp đồng vĩnh cửu thực tế trên Binance Futures; đo độ lệch đòn bẩy Long/Short.',
          source: 'Binance Futures (premiumIndex)',
        });

        if (isOverheatedLong) {
          alerts.push({
            id: 'alert-crypto-funding-high',
            severity: 'WARNING',
            title: 'Đòn Bẩy Long Phái Sinh Crypto Quá Nóng (Nguy Cơ Long Squeeze)',
            message: `Funding Rate BTC đạt +${f.toFixed(4)}%/8h — đám đông đang dùng đòn bẩy Long cao, cẩn trọng nhịp rũ thanh lý trước khi vào lệnh mới.`,
            affectedAssets: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
            metricBadge: `Funding +${f.toFixed(3)}%`,
          });
        } else if (isShortCrowded) {
          alerts.push({
            id: 'alert-crypto-short-squeeze',
            severity: 'POSITIVE',
            title: 'Funding Rate Âm — Tín Hiệu Nén Lò Xo (Short Squeeze)',
            message: `Funding Rate BTC âm (${f.toFixed(4)}%/8h) cho thấy phe Short đang trả phí; dễ xuất hiện nhịp bật tăng ép đóng vị thế Short.`,
            affectedAssets: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
            metricBadge: `Funding ${f.toFixed(3)}%`,
          });
        }
      }

      // Upcoming Official Calendar Events + Immediate Expiry Alert
      const upcomingEvents = buildUpcomingMacroCalendar(nowDate);
      const imminentVN30Expiry = upcomingEvents.find(
        ev => ev.id.startsWith('vn30f1m-') && ev.hoursRemaining <= 48
      );
      if (imminentVN30Expiry) {
        alerts.unshift({
          id: 'alert-vn30f1m-imminent',
          severity: 'WARNING',
          title: 'Sắp Tới Phiên Đáo Hạn Phái Sinh VN30F1M',
          message: `${imminentVN30Expiry.title} diễn ra trong ${imminentVN30Expiry.hoursRemaining} giờ tới. Cảnh giác biến động nhiễu trụ VN30 trong phiên ATC (14:30–14:45).`,
          affectedAssets: ['VNINDEX', 'VN30', 'VIC', 'VCB', 'FPT', 'HPG'],
          metricBadge: `Còn ${imminentVN30Expiry.hoursRemaining}h`,
        });
      }

      // ================= 8. LIVE FED PIVOT WATCH ENGINE (NY FED EFFR + CBOT ZQ FUTURES + 5 PILLARS) =================
      let fedPivot: FedPivotWatchSnapshot | undefined;
      const frontImplied =
        zqFront && zqFront.last > 50 && zqFront.last <= 102
          ? parseFloat((100 - zqFront.last).toFixed(2))
          : null;
      const effectiveRate = nyFedEffr?.effectiveRate ?? frontImplied ?? (us3m ? parseFloat(us3m.last.toFixed(2)) : null);

      if (effectiveRate !== null) {
        const targetRangeLow =
          nyFedEffr?.targetRangeLow ?? parseFloat((Math.floor(effectiveRate * 4) / 4).toFixed(2));
        const targetRangeHigh =
          nyFedEffr?.targetRangeHigh ?? parseFloat((targetRangeLow + 0.25).toFixed(2));
        const effectiveDate = nyFedEffr?.effectiveDate || nowDate.toISOString().slice(0, 10);

        const implied1mRate =
          zq1m && zq1m.last > 50
            ? parseFloat((100 - zq1m.last).toFixed(2))
            : frontImplied ?? effectiveRate;
        const implied3mRate =
          zq3m && zq3m.last > 50
            ? parseFloat((100 - zq3m.last).toFixed(2))
            : us3m
            ? parseFloat(us3m.last.toFixed(2))
            : implied1mRate;
        const implied6mRate =
          zq6m && zq6m.last > 50
            ? parseFloat((100 - zq6m.last).toFixed(2))
            : implied3mRate;

        const delta1mBps = Math.round((implied1mRate - effectiveRate) * 100);
        const delta3mBps = Math.round((implied3mRate - effectiveRate) * 100);
        const delta6mBps = Math.round((implied6mRate - effectiveRate) * 100);
        const pricedMoves6m = parseFloat((delta6mBps / 25).toFixed(2));

        // CME FedWatch style 25bps linear probability interpolation over 3M window
        let cutProb3mPct = 0;
        let hikeProb3mPct = 0;
        if (delta3mBps <= -3) {
          cutProb3mPct = Math.min(100, Math.round((Math.abs(delta3mBps) / 25) * 100));
        } else if (delta3mBps >= 3) {
          hikeProb3mPct = Math.min(100, Math.round((delta3mBps / 25) * 100));
        }
        const holdProb3mPct = Math.max(0, 100 - cutProb3mPct - hikeProb3mPct);

        const rateCurve: FedRateCurvePoint[] = [
          {
            horizonLabel: 'Hiện tại (EFFR)',
            contractSymbol: nyFedEffr ? 'NY FED' : 'ZQ=F',
            impliedRate: effectiveRate,
            deltaBps: 0,
          },
          {
            horizonLabel: 'Kỳ hạn +1T',
            contractSymbol: zq1m ? zq1mSym.replace('.CBT', '') : 'ZQ+1M',
            impliedRate: implied1mRate,
            deltaBps: delta1mBps,
          },
          {
            horizonLabel: 'Kỳ hạn +3T',
            contractSymbol: zq3m ? zq3mSym.replace('.CBT', '') : 'US3M',
            impliedRate: implied3mRate,
            deltaBps: delta3mBps,
          },
          {
            horizonLabel: 'Kỳ hạn +6T',
            contractSymbol: zq6m ? zq6mSym.replace('.CBT', '') : 'ZQ+6M',
            impliedRate: implied6mRate,
            deltaBps: delta6mBps,
          },
        ];

        // Evaluate 5 Fed Pivot Activation Conditions
        const checklist: FedPivotFactorCheck[] = [];

        // Condition 1: Forward Fed Funds Futures & US3M vs EFFR
        const c1Pass = delta3mBps <= -15 || delta6mBps <= -25;
        const c1Block = delta3mBps >= 12 || delta6mBps >= 18;
        checklist.push({
          id: 'zq_futures',
          label: '1. Hợp đồng Tương lai Lãi suất Fed (ZQ 3T/6T & US3M)',
          metricValue: `3T: ${implied3mRate.toFixed(2)}% (${delta3mBps >= 0 ? '+' : ''}${delta3mBps} bps) • 6T: ${implied6mRate.toFixed(2)}% (${delta6mBps >= 0 ? '+' : ''}${delta6mBps} bps)`,
          thresholdRule: 'Đạt Pivot khi ZQ 3T/6T định giá ≤ −25 bps (≥ 1 đợt hạ)',
          state: c1Pass ? 'PASSED' : c1Block ? 'BLOCKED' : 'WATCH',
          detail: c1Pass
            ? 'Thị trường tiền tệ CBOT đang đặt cược Fed cắt giảm lãi suất trong chu kỳ tới.'
            : c1Block
            ? `Phái sinh lãi suất đang định giá rủi ro Fed giữ cao hoặc TĂNG thêm (${delta6mBps >= 0 ? '+' : ''}${delta6mBps} bps trong 6T) thay vì hạ lãi suất.`
            : 'Thị trường định giá Fed giữ nguyên lãi suất điều hành trong ngắn hạn.',
        });

        // Condition 2: US10Y & Yield Curve 10Y-3M
        const c2Pass = Boolean(us10y && (us10y.last <= 4.2 || (us10y.changePct <= -1.5 && us10y.last < 4.5)));
        const c2Block = Boolean(us10y && us10y.last >= 4.65);
        checklist.push({
          id: 'us10y_curve',
          label: '2. Lợi suất Mỹ 10Y & Độ dốc Đường cong (10Y − 3M)',
          metricValue: us10y
            ? `US10Y ${us10y.last.toFixed(2)}% • Spread ${yieldCurveSpread >= 0 ? '+' : ''}${yieldCurveSpread.toFixed(2)}%`
            : 'Đang đồng bộ',
          thresholdRule: 'Đạt khi US10Y hạ nhiệt ≤ 4.20% & lợi suất ngắn hạn giảm dẫn dắt',
          state: c2Pass ? 'PASSED' : c2Block ? 'BLOCKED' : 'WATCH',
          detail: c2Pass
            ? 'Chi phí vốn dài hạn hạ nhiệt, mở dư địa định giá lại cho cổ phiếu & tài sản rủi ro.'
            : c2Block
            ? `US10Y neo cao tại ${us10y?.last.toFixed(2)}% phản ánh kỳ vọng lãi suất thắt chặt kéo dài (Higher-for-Longer).`
            : 'Lợi suất trái phiếu dài hạn đang dao động vùng trung tính.',
        });

        // Condition 3: US Dollar Index (DXY)
        const c3Pass = Boolean(dxy && (dxy.last <= 100.8 || dxy.changePct <= -0.5));
        const c3Block = Boolean(dxy && (dxy.last >= 104.2 || dxy.changePct >= 0.6));
        checklist.push({
          id: 'dxy_fx',
          label: '3. Sức mạnh Đồng Đô la Mỹ (DXY)',
          metricValue: dxy
            ? `${dxy.last.toFixed(2)} (${dxy.changePct >= 0 ? '+' : ''}${dxy.changePct}%)`
            : 'Đang đồng bộ',
          thresholdRule: 'Đạt khi DXY suy yếu ≤ 100.8 (giải phóng áp lực tỷ giá mới nổi)',
          state: c3Pass ? 'PASSED' : c3Block ? 'BLOCKED' : 'WATCH',
          detail: c3Pass
            ? 'Đồng USD hạ nhiệt ủng hộ dòng vốn chảy vào Vàng, Bitcoin và giảm áp lực tỷ giá.'
            : c3Block
            ? 'Đồng USD mạnh lên đang hút dòng vốn phòng thủ về tài sản định giá bằng USD.'
            : 'DXY đi ngang quanh vùng cân bằng, chưa xác nhận sóng suy yếu mạnh.',
        });

        // Condition 4: Brent Crude Oil (Cost-Push Inflation Filter)
        const c4Pass = Boolean(brent && brent.last <= 86);
        const c4Block = Boolean(brent && brent.last >= 95);
        checklist.push({
          id: 'brent_inflation',
          label: '4. Lạm phát Năng lượng (Giá Dầu Brent)',
          metricValue: brent
            ? `$${brent.last.toFixed(2)} (${brent.changePct >= 0 ? '+' : ''}${brent.changePct}%)`
            : 'Đang đồng bộ',
          thresholdRule: 'Đạt khi Brent ≤ $86/thùng (không gây sốc CPI chi phí đẩy)',
          state: c4Pass ? 'PASSED' : c4Block ? 'BLOCKED' : 'WATCH',
          detail: c4Pass
            ? 'Giá năng lượng hạ nhiệt giúp CPI/PCE ổn định để Fed tự tin nới lỏng tiền tệ.'
            : c4Block
            ? `Dầu Brent nóng ở mức $${brent?.last.toFixed(2)} là rào cản lớn khiến Fed khó sớm cắt giảm lãi suất do lo ngại lạm phát quay lại.`
            : 'Giá dầu ở vùng trung bình, cần theo dõi tác động lên CPI kỳ tới.',
        });

        // Condition 5: CBOE VIX Systemic Stress Filter
        const isVixEmergency = Boolean(vix && vix.last >= 28);
        const c5Pass = Boolean(vix && vix.last < 18.5);
        const c5Block = Boolean(vix && (vix.last >= 20 || vix.changePct >= 10));
        checklist.push({
          id: 'vix_stress',
          label: '5. Ổn định Thanh khoản & Chỉ số VIX',
          metricValue: vix
            ? `${vix.last.toFixed(2)} (${vix.changePct >= 0 ? '+' : ''}${vix.changePct}%)`
            : 'Đang đồng bộ',
          thresholdRule: 'Soft-Landing Pivot khi VIX < 18.5 • Emergency Pivot khi VIX ≥ 28',
          state: c5Pass ? 'PASSED' : c5Block ? 'BLOCKED' : 'WATCH',
          detail: isVixEmergency
            ? 'VIX vượt ngưỡng hoảng loạn (≥ 28): Dễ kích hoạt Fed bơm thanh khoản khẩn cấp.'
            : c5Pass
            ? 'Biến động hệ thống thấp, thuận lợi cho kịch bản hạ cánh mềm nếu lãi suất giảm.'
            : 'VIX đang dâng cao phản ánh tâm lý phòng vệ rủi ro ngắn hạn.',
        });

        const passedConditionsCount = checklist.filter(c => c.state === 'PASSED').length;

        let stance: FedPivotStance = 'ON_HOLD_WATCH';
        let stanceLabel = 'Giữ Nguyên Lãi Suất • Đang Chờ Tín Hiệu Pivot';
        let summary = `Lãi suất hiệu dụng Fed (EFFR) hiện ở mức ${effectiveRate.toFixed(2)}% (biên mục tiêu ${targetRangeLow.toFixed(2)}%–${targetRangeHigh.toFixed(2)}%). Hợp đồng tương lai ZQ 3 tháng định giá ${implied3mRate.toFixed(2)}% (${delta3mBps >= 0 ? '+' : ''}${delta3mBps} bps).`;

        if (delta3mBps <= -18 && isVixEmergency) {
          stance = 'EMERGENCY_EASING';
          stanceLabel = 'Cảnh Báo Xoay Trục Khẩn Cấp (Emergency Pivot)';
          summary = `Phái sinh ZQ định giá cắt giảm gấp (${delta3mBps} bps) giữa lúc VIX vọt lên ${vix?.last.toFixed(2)}. Ưu tiên tài sản trú ẩn (Vàng) và chờ hoảng loạn lắng dịu.`;
        } else if ((delta3mBps <= -18 || delta6mBps <= -30) && passedConditionsCount >= 3) {
          stance = 'DOVISH_PIVOT';
          stanceLabel = 'Tín Hiệu Fed Pivot Xuất Hiện (Nới Lỏng / Dovish)';
          summary = `Hội tụ ${passedConditionsCount}/5 điều kiện: Thị trường định giá Fed hạ lãi suất (${delta6mBps} bps trong 6 tháng) kèm lạm phát/DXY hạ nhiệt — Trợ lực mạnh cho Chứng khoán, Vàng & Crypto.`;
          regimeScore += 16;
        } else if (delta6mBps >= 18 || (c2Block && c4Block)) {
          stance = 'HAWKISH_TIGHTENING';
          stanceLabel = 'Chưa Có Fed Pivot • Định Giá Diều Hâu (Hawkish)';
          summary = `Chưa xuất hiện tín hiệu xoay trục hạ lãi suất (${passedConditionsCount}/5 điều kiện đạt). Hợp đồng ZQ 6T đang định giá ${implied6mRate.toFixed(2)}% (${delta6mBps >= 0 ? '+' : ''}${delta6mBps} bps vs EFFR ${effectiveRate.toFixed(2)}%) do áp lực lạm phát năng lượng & lợi suất cao.`;
          regimeScore -= 8;
        }

        // Next Official FOMC Meeting Lookup
        let nextFomc: FedPivotWatchSnapshot['nextFomc'] = null;
        const upcomingFomcRow = OFFICIAL_FOMC_DECISIONS.find(
          f => new Date(f.iso).getTime() >= nowDate.getTime() - 3600_000 * 2
        );
        if (upcomingFomcRow) {
          const dt = new Date(upcomingFomcRow.iso);
          const hrs = Math.max(0, Math.round((dt.getTime() - nowDate.getTime()) / 3600_000));
          nextFomc = {
            title: upcomingFomcRow.hasDotPlot
              ? `Kỳ họp FOMC & Dot Plot (${upcomingFomcRow.label})`
              : `Kỳ họp FOMC (${upcomingFomcRow.label})`,
            dateLabel: `${formatVNDate(dt)} (GMT+7)`,
            daysRemaining: Math.floor(hrs / 24),
            hoursRemaining: hrs,
            hasDotPlot: upcomingFomcRow.hasDotPlot,
          };

          if (hrs <= 72) {
            alerts.unshift({
              id: 'alert-fomc-imminent',
              severity: 'WARNING',
              title: 'Đếm Ngược Công Bố Lãi Suất Fed (FOMC) Trong 72 Giờ Tới',
              message: `${nextFomc.title} sẽ công bố lúc ${nextFomc.dateLabel}. Hạn chế sử dụng đòn bẩy cao trước giờ họp báo Chủ tịch Fed.`,
              affectedAssets: ['XAUUSD', 'BTCUSDT', 'NVDA', 'VNINDEX'],
              metricBadge: `FOMC còn ${hrs}h`,
            });
          }
        }

        fedPivot = {
          stance,
          stanceLabel,
          summary,
          effectiveRate,
          effectiveDate,
          targetRangeLow,
          targetRangeHigh,
          implied3mRate,
          implied6mRate,
          delta3mBps,
          delta6mBps,
          pricedMoves6m,
          cutProb3mPct,
          holdProb3mPct,
          hikeProb3mPct,
          passedConditionsCount,
          totalConditionsCount: checklist.length,
          rateCurve,
          checklist,
          nextFomc,
          sourceLabel: nyFedEffr
            ? 'NY Fed Official EFFR + CBOT 30-Day Fed Funds Futures (ZQ)'
            : 'CBOT 30-Day Fed Funds Futures (ZQ=F)',
        };

        // Prepend FED_FUNDS indicator card so it appears first in Macro Dashboard
        indicators.unshift({
          id: 'FED_FUNDS',
          label: 'Lãi suất Fed (EFFR) & Kỳ vọng ZQ 6T',
          shortLabel: 'FED WATCH',
          value: effectiveRate,
          displayValue: `${effectiveRate.toFixed(2)}% → ${implied6mRate.toFixed(2)}%`,
          changePercent: parseFloat((delta6mBps / 100).toFixed(2)),
          status:
            stance === 'DOVISH_PIVOT'
              ? 'FAVORABLE'
              : stance === 'HAWKISH_TIGHTENING'
              ? 'STRESS'
              : stance === 'EMERGENCY_EASING'
              ? 'ELEVATED'
              : 'NORMAL',
          impactSummary: `Mục tiêu FOMC: ${targetRangeLow.toFixed(2)}%–${targetRangeHigh.toFixed(2)}%. Hợp đồng ZQ 6 tháng định giá ${delta6mBps >= 0 ? '+' : ''}${delta6mBps} bps (${pricedMoves6m >= 0 ? '+' : ''}${pricedMoves6m} lần 25bps).`,
          source: 'NY Fed + CBOT (ZQ)',
        });

        if (stance === 'DOVISH_PIVOT') {
          alerts.unshift({
            id: 'alert-fed-dovish-pivot',
            severity: 'POSITIVE',
            title: 'Tín Hiệu Fed Pivot Xuất Hiện — Thị Trường Định Giá Hạ Lãi Suất!',
            message: summary,
            affectedAssets: ['XAUUSD', 'BTCUSDT', 'ETHUSDT', 'NVDA', 'VNINDEX', 'SSI'],
            metricBadge: `ZQ 6T ${delta6mBps} bps`,
          });
        } else if (stance === 'HAWKISH_TIGHTENING' && delta6mBps >= 20) {
          alerts.push({
            id: 'alert-fed-hawkish-repricing',
            severity: 'WARNING',
            title: 'Fed Pivot Watch: Phái Sinh Lãi Suất Định Giá Rủi Ro Thắt Chặt',
            message: `Hợp đồng tương lai Fed Funds 6 tháng (${zq6mSym.replace('.CBT', '')}) đang định giá lãi suất ngầm định ${implied6mRate.toFixed(2)}% (cao hơn EFFR hiện tại +${delta6mBps} bps ~ +${pricedMoves6m} đợt 25bps). Chưa xuất hiện tín hiệu Fed xoay trục hạ lãi suất.`,
            affectedAssets: ['NVDA', 'TSLA', 'BTCUSDT', 'XAUUSD', 'VNINDEX'],
            metricBadge: `ZQ +${delta6mBps} bps`,
          });
        }
      }

      regimeScore = Math.max(-100, Math.min(100, regimeScore));

      let regime: MacroRegime = 'NEUTRAL';
      let regimeLabel = 'Trung Lập • Chọn Lọc Cổ Phiếu';
      if (regimeScore <= -30) {
        regime = 'RISK_OFF';
        regimeLabel = 'Phòng Thủ Vĩ Mô (Risk-Off)';
        kellyDamper = Math.min(kellyDamper, 0.6);
      } else if (regimeScore <= -12) {
        regime = 'CAUTIOUS';
        regimeLabel = 'Thận Trọng • Rung Lắc Liên Thị Trường';
        kellyDamper = Math.min(kellyDamper, 0.78);
      } else if (regimeScore >= 18) {
        regime = 'RISK_ON';
        regimeLabel = 'Thuận Lợi Dòng Tiền (Risk-On)';
        kellyDamper = Math.max(kellyDamper, 1.0);
      }

      if (indicators.length === 0) return cachedMacroSnapshot;

      const snapshot: MacroIntelligenceSnapshot = {
        updatedAt: Date.now(),
        regime,
        regimeLabel,
        regimeScore,
        kellyDamper: parseFloat(kellyDamper.toFixed(2)),
        yieldCurveSpread,
        fedPivot,
        indicators,
        globalAlerts: alerts,
        upcomingEvents,
      };

      cachedMacroSnapshot = snapshot;
      return snapshot;
    } catch {
      return cachedMacroSnapshot;
    } finally {
      macroFetchInFlight = null;
    }
  })();

  return macroFetchInFlight;
}

// Evaluate exact cross-market macro impact on a specific symbol (used by AI Forecaster, Strategy Hub & UI Banner)
export function evaluateSymbolMacroImpact(
  symbolObj: Pick<MarketSymbol, 'symbol' | 'type' | 'quoteAsset'> | undefined,
  snapshot: MacroIntelligenceSnapshot | null | undefined
): SymbolMacroImpact | undefined {
  if (!symbolObj || !snapshot) return undefined;

  const sym = symbolObj.symbol.toUpperCase();
  const isVN = isVietnamMarketSymbol(symbolObj);
  const byId = new Map(snapshot.indicators.map(i => [i.id, i]));

  const dxy = byId.get('DXY');
  const usdvnd = byId.get('USDVND');
  const us10y = byId.get('US10Y');
  const vix = byId.get('VIX');
  const brent = byId.get('BRENT');
  const nasdaq = byId.get('NASDAQ');
  const funding = byId.get('BTC_FUNDING');

  let scoreAdjustment = 0;
  const bullets: string[] = [];

  if (isVN) {
    // 1. Sector-specific Oil effect on VN Equities
    if (brent && (brent.value >= 92 || Math.abs(brent.changePercent) >= 2.0)) {
      if (VN_OIL_BENEFICIARIES.has(sym)) {
        scoreAdjustment += 9;
        bullets.push(
          `Hưởng lợi ngành Dầu khí: Dầu Brent neo cao tại ${brent.displayValue} (${brent.changePercent >= 0 ? '+' : ''}${brent.changePercent}%) hỗ trợ biên lợi nhuận & khối lượng công việc thượng nguồn.`
        );
      } else if (VN_OIL_COST_SENSITIVE.has(sym)) {
        scoreAdjustment -= 7;
        bullets.push(
          `Áp lực chi phí đầu vào: Dầu Brent tại ${brent.displayValue} tạo sức ép chi phí vận tải/nhiên liệu và CPI tiêu dùng.`
        );
      }
    }

    // 2. USD/VND FX pressure vs USD exporters
    if (usdvnd && usdvnd.value >= 25500) {
      if (VN_FX_BENEFICIARIES.has(sym)) {
        scoreAdjustment += 4;
        bullets.push(
          `Đệm doanh thu ngoại tệ: Tỷ giá USD/VND ở mức cao (${usdvnd.displayValue}) có lợi cho mảng xuất khẩu phần mềm/hóa chất thu USD của ${sym}.`
        );
      } else if (VN_RATE_SENSITIVE.has(sym)) {
        scoreAdjustment -= usdvnd.value >= 25750 ? 8 : 5;
        bullets.push(
          `Áp lực tỷ giá USD/VND (${usdvnd.displayValue}): Nhóm tài chính/chỉ số nhạy cảm với động thái điều tiết thanh khoản và dòng vốn ngoại.`
        );
      }
    }

    // 3. Global equity & VIX spillover onto HOSE/HNX sentiment
    if ((nasdaq && nasdaq.changePercent <= -1.8) || (vix && (vix.value >= 22 || vix.changePercent >= 10))) {
      scoreAdjustment -= 6;
      bullets.push(
        `Tâm lý liên thị trường thận trọng: Phố Wall biến động (${nasdaq ? `Nasdaq ${nasdaq.changePercent}%` : ''}${vix ? `, VIX ${vix.displayValue}` : ''}) dễ gây rung lắc đầu phiên.`
      );
    } else if (nasdaq && nasdaq.changePercent >= 1.2 && (!vix || vix.value < 18)) {
      scoreAdjustment += 5;
      bullets.push(
        `Tâm lý quốc tế tích cực: Chứng khoán Mỹ tăng điểm (${nasdaq.changePercent >= 0 ? '+' : ''}${nasdaq.changePercent}%) ủng hộ dòng tiền đầu phiên.`
      );
    }
  } else if (sym === 'XAUUSD' || sym === 'PAXGUSDT' || sym === 'SILVER') {
    if (dxy && dxy.changePercent >= 0.5) {
      scoreAdjustment -= 7;
      bullets.push(`Đồng USD mạnh lên (DXY ${dxy.displayValue}, +${dxy.changePercent}%) kìm hãm đà bứt phá ngắn hạn của kim loại quý.`);
    } else if (dxy && dxy.changePercent <= -0.4) {
      scoreAdjustment += 7;
      bullets.push(`Đồng USD suy yếu (DXY ${dxy.displayValue}, ${dxy.changePercent}%) trợ lực trực tiếp cho giá Vàng/Bạc.`);
    }
    if (us10y && us10y.value >= 4.65) {
      scoreAdjustment -= 5;
      bullets.push(`Lợi suất Mỹ 10Y cao (${us10y.displayValue}) làm tăng chi phí cơ hội nắm giữ Vàng.`);
    }
    if (vix && (vix.value >= 21 || vix.changePercent >= 10)) {
      scoreAdjustment += 6;
      bullets.push(`Nhu cầu trú ẩn an toàn gia tăng khi chỉ số biến động VIX bật lên ${vix.displayValue} (+${vix.changePercent}%).`);
    }
  } else if (sym.includes('OIL')) {
    if (brent) {
      bullets.push(`Dầu chuẩn Brent quốc tế giao dịch tại ${brent.displayValue} (${brent.changePercent >= 0 ? '+' : ''}${brent.changePercent}%).`);
    }
    if (dxy && Math.abs(dxy.changePercent) >= 0.5) {
      scoreAdjustment += dxy.changePercent < 0 ? 5 : -5;
      bullets.push(`Biến động đồng USD (DXY ${dxy.displayValue}) tác động ngược chiều lên giá hàng hóa định giá bằng USD.`);
    }
  } else if (symbolObj.type === 'crypto') {
    if (funding) {
      if (funding.value >= 0.045) {
        scoreAdjustment -= 8;
        bullets.push(`Cảnh báo Phái sinh: BTC Funding Rate cao (${funding.displayValue}/8h), rủi ro quét thanh lý Long đòn bẩy.`);
      } else if (funding.value <= -0.015) {
        scoreAdjustment += 6;
        bullets.push(`Động lực Short Squeeze: BTC Funding Rate âm (${funding.displayValue}/8h) hỗ trợ lực hồi phục.`);
      } else {
        bullets.push(`Đòn bẩy phái sinh cân bằng: BTC Funding Rate ổn định tại ${funding.displayValue}/8h.`);
      }
    }
    if (nasdaq && nasdaq.changePercent <= -1.8) {
      scoreAdjustment -= 7;
      bullets.push(`Khẩu vị rủi ro công nghệ suy yếu (Nasdaq ${nasdaq.changePercent}%) tạo lực cản tương quan lên Crypto.`);
    } else if (nasdaq && nasdaq.changePercent >= 1.5) {
      scoreAdjustment += 6;
      bullets.push(`Dòng tiền Risk-On từ cổ phiếu công nghệ Mỹ (Nasdaq +${nasdaq.changePercent}%) đồng thuận xu hướng Crypto.`);
    }
    if (vix && vix.changePercent >= 10) {
      scoreAdjustment -= 5;
      bullets.push(`Chỉ số VIX tăng nóng (+${vix.changePercent}%) cảnh báo biên độ giật hai đầu mở rộng.`);
    }
  } else {
    // US Tech / Global Equities
    if (us10y && us10y.value >= 4.65) {
      scoreAdjustment -= 7;
      bullets.push(`Áp lực lợi suất US10Y (${us10y.displayValue}) lên hệ số định giá P/E nhóm cổ phiếu tăng trưởng Mỹ.`);
    }
    if (vix && (vix.value >= 20 || vix.changePercent >= 10)) {
      scoreAdjustment -= 8;
      bullets.push(`Biến động quyền chọn S&P 500 dâng cao (VIX ${vix.displayValue}, ${vix.changePercent >= 0 ? '+' : ''}${vix.changePercent}%).`);
    }
    if (nasdaq) {
      bullets.push(`Xu hướng chỉ số chung Nasdaq Composite: ${nasdaq.displayValue} (${nasdaq.changePercent >= 0 ? '+' : ''}${nasdaq.changePercent}%).`);
    }
  }

  // Cross-asset Fed Pivot Watch conditioning
  if (snapshot.fedPivot) {
    const fp = snapshot.fedPivot;
    if (fp.stance === 'DOVISH_PIVOT') {
      if (!sym.includes('OIL')) {
        scoreAdjustment += 5;
        bullets.push(
          `Trợ lực Fed Pivot: Hợp đồng ZQ định giá hạ lãi suất (${fp.delta6mBps} bps/6T, xác suất cắt 3T ${fp.cutProb3mPct}%) hỗ trợ định giá tài sản.`
        );
      }
    } else if (fp.stance === 'HAWKISH_TIGHTENING' && fp.delta6mBps >= 20) {
      if (
        (isVN && VN_RATE_SENSITIVE.has(sym)) ||
        symbolObj.type === 'crypto' ||
        (!isVN && symbolObj.type === 'stock')
      ) {
        scoreAdjustment -= 4;
        bullets.push(
          `Fed Pivot chưa kích hoạt: Hợp đồng ZQ 6T định giá +${fp.delta6mBps} bps (${fp.implied6mRate.toFixed(2)}% vs EFFR ${fp.effectiveRate.toFixed(2)}%), duy trì sức ép chi phí vốn.`
        );
      }
    }
  }

  scoreAdjustment = Math.max(-18, Math.min(12, scoreAdjustment));

  const bias: SymbolMacroImpact['bias'] =
    scoreAdjustment <= -11
      ? 'SEVERE_HEADWIND'
      : scoreAdjustment <= -4
      ? 'HEADWIND'
      : scoreAdjustment >= 4
      ? 'TAILWIND'
      : 'NEUTRAL';

  const headline =
    bias === 'SEVERE_HEADWIND'
      ? ` Lực cản Vĩ mô Mạnh (${scoreAdjustment}đ tin cậy) — Ưu tiên phòng thủ`
      : bias === 'HEADWIND'
      ? `Vĩ mô Ngược chiều Nhẹ (${scoreAdjustment}đ) — Giảm quy mô giải ngân`
      : bias === 'TAILWIND'
      ? `Vĩ mô Thuận chiều (+${scoreAdjustment}đ) — Ủng hộ xu hướng`
      : 'Bối cảnh Vĩ mô Trung lập đối với mã này';

  const relevantAlerts = snapshot.globalAlerts.filter(
    a =>
      a.affectedAssets.includes(sym) ||
      (isVN && (a.affectedAssets.includes('VNINDEX') || a.affectedAssets.includes('VN30'))) ||
      (symbolObj.type === 'crypto' && a.affectedAssets.includes('BTCUSDT'))
  );

  return {
    bias,
    scoreAdjustment,
    headline: headline.trim(),
    bullets,
    relevantAlerts,
  };
}
