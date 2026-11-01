import {
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

async function fetchYahooMacroSpark(): Promise<Record<string, ParsedSparkMetric>> {
  const symbols = ['DX-Y.NYB', 'VND=X', '^TNX', '^IRX', '^VIX', 'BZ=F', '^GSPC', '^IXIC'];
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

  return events
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime())
    .slice(0, 5);
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
      const [spark, btcFunding] = await Promise.all([
        fetchYahooMacroSpark(),
        fetchRealBinanceBtcFunding(),
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
      const upcomingEvents = buildUpcomingMacroCalendar(new Date());
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
