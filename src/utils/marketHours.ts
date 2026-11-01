import { MarketSymbol } from '../types';

export type SessionState =
  | 'OPEN'
  | 'LUNCH_BREAK'
  | 'PRE_OPEN'
  | 'AFTER_HOURS'
  | 'WEEKEND_CLOSED'
  | 'HOLIDAY_CLOSED'
  | 'DAILY_CLOSED';

export interface TradingScheduleRow {
  label: string;
  timeRange: string;
  isActive?: boolean;
}

export interface MarketSessionInfo {
  exchangeName: string;
  shortExchange: string;
  isOpen: boolean;
  is24x7: boolean;
  hasRealOrderBook: boolean;
  state: SessionState;
  badgeText: string;
  shortBadge: string;
  statusHeadline: string;
  scheduleSummary: string;
  scheduleRows: TradingScheduleRow[];
  nextSessionLabel: string;
  priceBandNote?: string;
  currentExchangeTime: string;
}

const US_EQUITY_SET = new Set([
  'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD',
  'AVGO', 'TSM', 'ASML', 'ARM', 'MU', 'INTC', 'QCOM', 'SMCI',
  'PLTR', 'NFLX', 'CRM', 'ORCL', 'ADBE', 'UBER', 'PANW', 'CRWD',
  'MSTR', 'COIN', 'SQ', 'PYPL', 'V', 'MA',
  'JPM', 'GS', 'BAC', 'MS', 'WFC', 'BRK-B',
  'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK',
  'COST', 'WMT', 'HD', 'MCD', 'NKE', 'DIS',
  'XOM', 'CVX', 'COP', 'CAT', 'LMT', 'GE', 'BA',
  'SPY', 'QQQ', 'DIA', 'IWM', 'SOXX',
  'XLK', 'XLF', 'XLV', 'XLE', 'XLI', 'XLY', 'XLP', 'XLC', 'XLU', 'XLB', 'XLRE',
]);

const GLOBAL_INDEX_SET = new Set(['N225', 'HSI', 'DAX']);

const HNX_SET = new Set([
  'PVS', 'SHS', 'IDC', 'MBS', 'CEO', 'TNG', 'VCS', 'HUT', 'NVB', 'THD', 'PVI', 'BVS', 'LAS', 'DTD', 'VGS',
]);

const UPCOM_SET = new Set([
  'SJC', 'ACV', 'VEA', 'OIL', 'QNS', 'VGI', 'MCH', 'VGT', 'FOX',
]);

export function isVnDerivativeTicker(sym: string): boolean {
  return /^VN30F\d/i.test(sym.trim().toUpperCase());
}

const VN_FIXED_HOLIDAYS = new Set(['01-01', '04-30', '05-01', '09-02']);

const VN_WEEKDAY_LABELS: Record<number, string> = {
  0: 'Chủ Nhật',
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
};

interface ZonedParts {
  weekday: number; // 0 = Sun .. 6 = Sat
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  const wkMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  let hour = parseInt(map.hour || '0', 10);
  if (hour === 24) hour = 0;

  return {
    weekday: wkMap[map.weekday] ?? 0,
    month: parseInt(map.month || '1', 10),
    day: parseInt(map.day || '1', 10),
    hour,
    minute: parseInt(map.minute || '0', 10),
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDurationMinutes(totalMins: number): string {
  if (totalMins <= 0) return 'vài giây';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

function computeMinsUntilNextVNMorning(vn: ZonedParts): { minsUntil: number; dayName: string } {
  const curMins = vn.hour * 60 + vn.minute;
  // Next weekday 09:00 (540 mins)
  if (vn.weekday >= 1 && vn.weekday <= 5 && curMins < 540) {
    return { minsUntil: 540 - curMins, dayName: 'hôm nay' };
  }
  let daysAhead = 1;
  if (vn.weekday === 5) daysAhead = 3; // Friday after 09:00 -> Monday
  else if (vn.weekday === 6) daysAhead = 2; // Saturday -> Monday
  else if (vn.weekday === 0) daysAhead = 1; // Sunday -> Monday

  const nextWeekday = (vn.weekday + daysAhead) % 7;
  const minsUntil = (daysAhead * 1440) - curMins + 540;
  return {
    minsUntil,
    dayName: daysAhead === 1 && vn.weekday !== 0 ? 'ngày mai' : VN_WEEKDAY_LABELS[nextWeekday],
  };
}

export function isVietnamMarketSymbol(
  item: Pick<MarketSymbol, 'symbol' | 'type' | 'quoteAsset'>
): boolean {
  const sym = item.symbol.toUpperCase();
  if (sym === 'VNINDEX' || sym === 'VN30' || isVnDerivativeTicker(sym)) return true;
  if (US_EQUITY_SET.has(sym) || GLOBAL_INDEX_SET.has(sym)) return false;
  return item.quoteAsset === 'VND' || item.type === 'vn30';
}

export function getMarketSessionInfo(
  symbolObj: Pick<MarketSymbol, 'symbol' | 'type' | 'quoteAsset'>,
  now: Date = new Date()
): MarketSessionInfo {
  const sym = symbolObj.symbol.trim().toUpperCase();
  const vn = getZonedParts(now, 'Asia/Ho_Chi_Minh');
  const vnClock = `${pad2(vn.hour)}:${pad2(vn.minute)} ${VN_WEEKDAY_LABELS[vn.weekday]} (GMT+7)`;

  // 1. CRYPTO & TOKENIZED ASSETS ON BINANCE (24/7/365 REAL LIVE ORDERBOOK)
  if (symbolObj.type === 'crypto' || sym === 'PAXGUSDT') {
    return {
      exchangeName: 'Binance Spot (Giao dịch 24/7)',
      shortExchange: 'BINANCE',
      isOpen: true,
      is24x7: true,
      hasRealOrderBook: true,
      state: 'OPEN',
      badgeText: 'LIVE 24/7 • BINANCE',
      shortBadge: '24/7',
      statusHeadline: 'Thị trường mở cửa xuyên suốt 24/7 (Khớp lệnh thực tế)',
      scheduleSummary: 'Hoạt động liên tục 24 giờ / 7 ngày (kể cả Thứ Bảy, Chủ Nhật & ngày Lễ).',
      scheduleRows: [
        { label: 'Khớp lệnh Spot & Sổ lệnh Level-2', timeRange: '00:00 – 24:00 (24/7)', isActive: true },
      ],
      nextSessionLabel: 'Đang khớp lệnh trực tiếp 24/7',
      currentExchangeTime: vnClock,
    };
  }

  // 2. CHỨNG KHOÁN & PHÁI SINH VIỆT NAM (HOSE / HNX / UPCOM / HNX-PS VN30F1M) — MÚI GIỜ GMT+7
  if (isVietnamMarketSymbol(symbolObj)) {
    const isDeriv = isVnDerivativeTicker(sym);
    const isIndex = !isDeriv && (sym === 'VNINDEX' || sym === 'VN30' || symbolObj.type === 'index');
    const board: 'HOSE' | 'HNX' | 'UPCOM' | 'HNX-PS' = isDeriv
      ? 'HNX-PS'
      : UPCOM_SET.has(sym)
      ? 'UPCOM'
      : HNX_SET.has(sym)
      ? 'HNX'
      : 'HOSE';

    const exchangeName = isDeriv
      ? 'Sàn Phái sinh HNX (HĐTL Chỉ số VN30)'
      : isIndex
      ? 'Sở GDCK TP.HCM (Chỉ số HOSE)'
      : board === 'HNX'
      ? 'Sàn HNX (Sở GDCK Hà Nội)'
      : board === 'UPCOM'
      ? 'Sàn UPCOM (HNX)'
      : 'Sàn HOSE (Sở GDCK TP.HCM)';

    const priceBandNote = isDeriv
      ? 'Biên độ trần/sàn: ±7% • Bước giá 0.1 điểm (100k đ/điểm) • Thanh toán T+0'
      : isIndex
      ? undefined
      : board === 'HNX'
      ? 'Biên độ trần/sàn quy định: ±10% (Sàn HNX)'
      : board === 'UPCOM'
      ? 'Biên độ trần/sàn quy định: ±15% (Sàn UPCOM)'
      : 'Biên độ trần/sàn quy định: ±7% (Sàn HOSE)';

    const mins = vn.hour * 60 + vn.minute;
    const mmdd = `${pad2(vn.month)}-${pad2(vn.day)}`;
    const isHoliday = VN_FIXED_HOLIDAYS.has(mmdd);
    const isWeekend = vn.weekday === 0 || vn.weekday === 6;

    const baseRows: TradingScheduleRow[] =
      board === 'HNX-PS'
        ? [
            { label: 'Mở cửa Phái sinh (ATO)', timeRange: '08:45 – 09:00', isActive: !isWeekend && !isHoliday && mins >= 525 && mins < 540 },
            { label: 'Khớp lệnh liên tục Sáng', timeRange: '09:00 – 11:30', isActive: !isWeekend && !isHoliday && mins >= 540 && mins < 690 },
            { label: 'Nghỉ trưa giữa phiên', timeRange: '11:30 – 13:00', isActive: !isWeekend && !isHoliday && mins >= 690 && mins < 780 },
            { label: 'Khớp lệnh liên tục Chiều', timeRange: '13:00 – 14:30', isActive: !isWeekend && !isHoliday && mins >= 780 && mins < 870 },
            { label: 'Đóng cửa Phái sinh (ATC)', timeRange: '14:30 – 14:45', isActive: !isWeekend && !isHoliday && mins >= 870 && mins < 885 },
          ]
        : board === 'UPCOM'
        ? [
            { label: 'Phiên Sáng (Liên tục)', timeRange: '09:00 – 11:30', isActive: !isWeekend && !isHoliday && mins >= 540 && mins < 690 },
            { label: 'Nghỉ trưa giữa phiên', timeRange: '11:30 – 13:00', isActive: !isWeekend && !isHoliday && mins >= 690 && mins < 780 },
            { label: 'Phiên Chiều (Liên tục)', timeRange: '13:00 – 15:00', isActive: !isWeekend && !isHoliday && mins >= 780 && mins < 900 },
          ]
        : board === 'HNX'
        ? [
            { label: 'Phiên Sáng (Liên tục)', timeRange: '09:00 – 11:30', isActive: !isWeekend && !isHoliday && mins >= 540 && mins < 690 },
            { label: 'Nghỉ trưa giữa phiên', timeRange: '11:30 – 13:00', isActive: !isWeekend && !isHoliday && mins >= 690 && mins < 780 },
            { label: 'Phiên Chiều (Liên tục + ATC)', timeRange: '13:00 – 14:45', isActive: !isWeekend && !isHoliday && mins >= 780 && mins < 885 },
            { label: 'Phiên Sau giờ (PLO)', timeRange: '14:45 – 15:00', isActive: !isWeekend && !isHoliday && mins >= 885 && mins < 900 },
          ]
        : [
            { label: 'Mở cửa định kỳ (ATO)', timeRange: '09:00 – 09:15', isActive: !isWeekend && !isHoliday && mins >= 540 && mins < 555 },
            { label: 'Khớp lệnh liên tục Sáng', timeRange: '09:15 – 11:30', isActive: !isWeekend && !isHoliday && mins >= 555 && mins < 690 },
            { label: 'Nghỉ trưa giữa phiên', timeRange: '11:30 – 13:00', isActive: !isWeekend && !isHoliday && mins >= 690 && mins < 780 },
            { label: 'Khớp lệnh liên tục Chiều', timeRange: '13:00 – 14:30', isActive: !isWeekend && !isHoliday && mins >= 780 && mins < 870 },
            { label: 'Đóng cửa định kỳ (ATC)', timeRange: '14:30 – 14:45', isActive: !isWeekend && !isHoliday && mins >= 870 && mins < 885 },
          ];

    const scheduleSummary =
      board === 'HNX-PS'
        ? 'Thứ 2 – Thứ 6 (GMT+7): Sáng 08:45–11:30 (ATO 08:45–09:00, mở sớm 15p) • Nghỉ trưa 11:30–13:00 • Chiều 13:00–14:45 (ATC 14:30–14:45)'
        : board === 'UPCOM'
        ? 'Thứ 2 – Thứ 6 (GMT+7): Sáng 09:00–11:30 • Nghỉ trưa 11:30–13:00 • Chiều 13:00–15:00'
        : board === 'HNX'
        ? 'Thứ 2 – Thứ 6 (GMT+7): Sáng 09:00–11:30 • Nghỉ trưa 11:30–13:00 • Chiều 13:00–14:45 (ATC 14:30–14:45, PLO 14:45–15:00)'
        : 'Thứ 2 – Thứ 6 (GMT+7): Sáng 09:00–11:30 (ATO 09:00–09:15) • Nghỉ trưa 11:30–13:00 • Chiều 13:00–14:45 (ATC 14:30–14:45)';

    const openMins = board === 'HNX-PS' ? 525 : 540;
    const openClockStr = board === 'HNX-PS' ? '08:45' : '09:00';

    if (isHoliday) {
      const next = computeMinsUntilNextVNMorning(vn);
      return {
        exchangeName,
        shortExchange: board,
        isOpen: false,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'HOLIDAY_CLOSED',
        badgeText: `${board} NGHỈ LỄ`,
        shortBadge: 'Nghỉ lễ',
        statusHeadline: `Thị trường Chứng khoán Việt Nam đóng cửa nghỉ Lễ (${mmdd})`,
        scheduleSummary,
        scheduleRows: baseRows,
        nextSessionLabel: `Mở cửa lại lúc ${openClockStr} ${next.dayName}`,
        priceBandNote,
        currentExchangeTime: vnClock,
      };
    }

    if (isWeekend) {
      const next = computeMinsUntilNextVNMorning(vn);
      return {
        exchangeName,
        shortExchange: board,
        isOpen: false,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'WEEKEND_CLOSED',
        badgeText: `${board} ĐÓNG CỬA • ${VN_WEEKDAY_LABELS[vn.weekday]}`,
        shortBadge: 'Đóng cửa',
        statusHeadline: `Nghỉ cuối tuần (${VN_WEEKDAY_LABELS[vn.weekday]}) — Không phát sinh lệnh khớp mới`,
        scheduleSummary,
        scheduleRows: baseRows,
        nextSessionLabel: `Phiên mở cửa kế tiếp: ${openClockStr} Thứ Hai (còn ${formatDurationMinutes(next.minsUntil)})`,
        priceBandNote,
        currentExchangeTime: vnClock,
      };
    }

    // Weekday (Thứ 2 - Thứ 6)
    if (mins < openMins) {
      return {
        exchangeName,
        shortExchange: board,
        isOpen: false,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'PRE_OPEN',
        badgeText: `${board} CHƯA MỞ CỬA (Mở ${openClockStr})`,
        shortBadge: `Chờ ${openClockStr}`,
        statusHeadline: 'Chưa tới giờ giao dịch — Đang hiển thị giá chốt phiên liền trước',
        scheduleSummary,
        scheduleRows: baseRows,
        nextSessionLabel: `Bắt đầu phiên sáng lúc ${openClockStr} hôm nay (còn ${formatDurationMinutes(openMins - mins)})`,
        priceBandNote,
        currentExchangeTime: vnClock,
      };
    }

    if (mins >= 525 && mins < 540 && board === 'HNX-PS') {
      return {
        exchangeName,
        shortExchange: board,
        isOpen: true,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'OPEN',
        badgeText: 'HNX-PS • ATO (08:45–09:00)',
        shortBadge: 'ATO PS',
        statusHeadline: 'Phiên ATO Phái sinh VN30F1M mở sớm 15 phút trước cơ sở (08:45 – 09:00)',
        scheduleSummary,
        scheduleRows: baseRows,
        nextSessionLabel: 'Chuyển sang khớp lệnh liên tục lúc 09:00',
        priceBandNote,
        currentExchangeTime: vnClock,
      };
    }

    if (mins >= 540 && mins < 555 && board === 'HOSE') {
      return {
        exchangeName,
        shortExchange: board,
        isOpen: true,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'OPEN',
        badgeText: `${board} • PHIÊN ATO (09:00–09:15)`,
        shortBadge: 'ATO',
        statusHeadline: 'Đang trong Phiên khớp lệnh định kỳ mở cửa (ATO)',
        scheduleSummary,
        scheduleRows: baseRows,
        nextSessionLabel: 'Chuyển sang khớp lệnh liên tục lúc 09:15',
        priceBandNote,
        currentExchangeTime: vnClock,
      };
    }

    if (mins >= 540 && mins < 690) {
      return {
        exchangeName,
        shortExchange: board,
        isOpen: true,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'OPEN',
        badgeText: `${board} • PHIÊN SÁNG`,
        shortBadge: 'Phiên Sáng',
        statusHeadline: 'Đang khớp lệnh liên tục Phiên Sáng (09:00 – 11:30)',
        scheduleSummary,
        scheduleRows: baseRows,
        nextSessionLabel: `Nghỉ trưa lúc 11:30 (còn ${formatDurationMinutes(690 - mins)})`,
        priceBandNote,
        currentExchangeTime: vnClock,
      };
    }

    if (mins >= 690 && mins < 780) {
      return {
        exchangeName,
        shortExchange: board,
        isOpen: false,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'LUNCH_BREAK',
        badgeText: `${board} • NGHỈ TRƯA (11:30–13:00)`,
        shortBadge: 'Nghỉ trưa',
        statusHeadline: 'Tạm ngừng khớp lệnh nghỉ trưa (11:30 – 13:00)',
        scheduleSummary,
        scheduleRows: baseRows,
        nextSessionLabel: `Mở lại Phiên Chiều lúc 13:00 hôm nay (còn ${formatDurationMinutes(780 - mins)})`,
        priceBandNote,
        currentExchangeTime: vnClock,
      };
    }

    if (mins >= 780 && mins < 870) {
      return {
        exchangeName,
        shortExchange: board,
        isOpen: true,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'OPEN',
        badgeText: `${board} • PHIÊN CHIỀU`,
        shortBadge: 'Phiên Chiều',
        statusHeadline: 'Đang khớp lệnh liên tục Phiên Chiều (13:00 – 14:30)',
        scheduleSummary,
        scheduleRows: baseRows,
        nextSessionLabel: board === 'UPCOM' ? 'Đóng cửa lúc 15:00' : 'Bước vào phiên ATC lúc 14:30',
        priceBandNote,
        currentExchangeTime: vnClock,
      };
    }

    if (mins >= 870 && mins < 885) {
      return {
        exchangeName,
        shortExchange: board,
        isOpen: true,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'OPEN',
        badgeText: board === 'UPCOM' ? `${board} • PHIÊN CHIỀU` : `${board} • PHIÊN ATC (14:30–14:45)`,
        shortBadge: board === 'UPCOM' ? 'Phiên Chiều' : 'ATC',
        statusHeadline:
          board === 'UPCOM'
            ? 'Đang khớp lệnh liên tục Phiên Chiều (13:00 – 15:00)'
            : 'Đang trong Phiên khớp lệnh định kỳ đóng cửa (ATC 14:30 – 14:45)',
        scheduleSummary,
        scheduleRows: baseRows,
        nextSessionLabel: board === 'UPCOM' ? 'Đóng cửa lúc 15:00' : 'Chốt giá đóng cửa lúc 14:45',
        priceBandNote,
        currentExchangeTime: vnClock,
      };
    }

    if (mins >= 885 && mins < 900) {
      if (board === 'UPCOM') {
        return {
          exchangeName,
          shortExchange: board,
          isOpen: true,
          is24x7: false,
          hasRealOrderBook: false,
          state: 'OPEN',
          badgeText: 'UPCOM • PHIÊN CHIỀU',
          shortBadge: 'Phiên Chiều',
          statusHeadline: 'Đang khớp lệnh liên tục cuối Phiên Chiều (đến 15:00)',
          scheduleSummary,
          scheduleRows: baseRows,
          nextSessionLabel: `Đóng cửa lúc 15:00 (còn ${formatDurationMinutes(900 - mins)})`,
          priceBandNote,
          currentExchangeTime: vnClock,
        };
      }
      if (board === 'HNX') {
        return {
          exchangeName,
          shortExchange: board,
          isOpen: true,
          is24x7: false,
          hasRealOrderBook: false,
          state: 'AFTER_HOURS',
          badgeText: 'HNX • PHIÊN PLO (14:45–15:00)',
          shortBadge: 'PLO',
          statusHeadline: 'Phiên khớp lệnh sau giờ PLO tại giá đóng cửa (14:45 – 15:00)',
          scheduleSummary,
          scheduleRows: baseRows,
          nextSessionLabel: `Kết thúc ngày giao dịch lúc 15:00 (còn ${formatDurationMinutes(900 - mins)})`,
          priceBandNote,
          currentExchangeTime: vnClock,
        };
      }
      const next = computeMinsUntilNextVNMorning(vn);
      return {
        exchangeName,
        shortExchange: board,
        isOpen: false,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'AFTER_HOURS',
        badgeText: 'HOSE • THỎA THUẬN (14:45–15:00)',
        shortBadge: 'Sau ATC',
        statusHeadline: 'Đã chốt giá ATC lúc 14:45 — Chỉ còn giao dịch thỏa thuận tới 15:00',
        scheduleSummary,
        scheduleRows: baseRows,
        nextSessionLabel: `Mở cửa lại lúc 09:00 ${next.dayName}`,
        priceBandNote,
        currentExchangeTime: vnClock,
      };
    }

    // After 15:00 GMT+7
    const next = computeMinsUntilNextVNMorning(vn);
    return {
      exchangeName,
      shortExchange: board,
      isOpen: false,
      is24x7: false,
      hasRealOrderBook: false,
      state: 'DAILY_CLOSED',
      badgeText: `${board} ĐÃ ĐÓNG CỬA (15:00)`,
      shortBadge: 'Đóng cửa',
      statusHeadline: 'Đã kết thúc phiên giao dịch trong ngày — Giá hiển thị là giá chốt phiên',
      scheduleSummary,
      scheduleRows: baseRows,
      nextSessionLabel: `Phiên kế tiếp: 09:00 ${next.dayName} (còn ${formatDurationMinutes(next.minsUntil)})`,
      priceBandNote,
      currentExchangeTime: vnClock,
    };
  }

  // 3A. CHỈ SỐ QUỐC TẾ CHÂU Á & CHÂU ÂU (N225 Tokyo • HSI Hong Kong • DAX Frankfurt)
  if (GLOBAL_INDEX_SET.has(sym)) {
    const cfg =
      sym === 'N225'
        ? {
            tz: 'Asia/Tokyo',
            tzShort: 'JST',
            exchangeName: 'Tokyo Stock Exchange (Nikkei 225)',
            shortExchange: 'TSE',
            openMins: 540, // 09:00
            lunchStart: 690, // 11:30
            lunchEnd: 750, // 12:30
            closeMins: 930, // 15:30 JST
            summary: 'Thứ 2 – Thứ 6: Sáng 09:00–11:30 JST • Chiều 12:30–15:30 JST (07:00–13:30 giờ VN)',
          }
        : sym === 'HSI'
        ? {
            tz: 'Asia/Hong_Kong',
            tzShort: 'HKT',
            exchangeName: 'Hong Kong Stock Exchange (Hang Seng)',
            shortExchange: 'HKEX',
            openMins: 570, // 09:30
            lunchStart: 720, // 12:00
            lunchEnd: 780, // 13:00
            closeMins: 960, // 16:00 HKT
            summary: 'Thứ 2 – Thứ 6: Sáng 09:30–12:00 HKT • Chiều 13:00–16:00 HKT (08:30–15:00 giờ VN)',
          }
        : {
            tz: 'Europe/Berlin',
            tzShort: 'CET',
            exchangeName: 'Frankfurt XETRA (DAX 40)',
            shortExchange: 'XETRA',
            openMins: 540, // 09:00
            lunchStart: -1,
            lunchEnd: -1,
            closeMins: 1050, // 17:30 CET
            summary: 'Thứ 2 – Thứ 6: 09:00–17:30 CET/CEST (14:00–22:30 hoặc 15:00–23:30 giờ VN)',
          };

    const loc = getZonedParts(now, cfg.tz);
    const locMins = loc.hour * 60 + loc.minute;
    const isWeekendLoc = loc.weekday === 0 || loc.weekday === 6;
    const isLunchLoc =
      !isWeekendLoc && cfg.lunchStart > 0 && locMins >= cfg.lunchStart && locMins < cfg.lunchEnd;
    const isOpenLoc =
      !isWeekendLoc && !isLunchLoc && locMins >= cfg.openMins && locMins < cfg.closeMins;
    const locClock = `${pad2(loc.hour)}:${pad2(loc.minute)} ${cfg.tzShort} (${vnClock})`;
    const rows: TradingScheduleRow[] =
      cfg.lunchStart > 0
        ? [
            {
              label: 'Phiên Sáng',
              timeRange: `${pad2(Math.floor(cfg.openMins / 60))}:${pad2(cfg.openMins % 60)} – ${pad2(Math.floor(cfg.lunchStart / 60))}:${pad2(cfg.lunchStart % 60)} ${cfg.tzShort}`,
              isActive: !isWeekendLoc && locMins >= cfg.openMins && locMins < cfg.lunchStart,
            },
            {
              label: 'Nghỉ trưa',
              timeRange: `${pad2(Math.floor(cfg.lunchStart / 60))}:${pad2(cfg.lunchStart % 60)} – ${pad2(Math.floor(cfg.lunchEnd / 60))}:${pad2(cfg.lunchEnd % 60)} ${cfg.tzShort}`,
              isActive: isLunchLoc,
            },
            {
              label: 'Phiên Chiều',
              timeRange: `${pad2(Math.floor(cfg.lunchEnd / 60))}:${pad2(cfg.lunchEnd % 60)} – ${pad2(Math.floor(cfg.closeMins / 60))}:${pad2(cfg.closeMins % 60)} ${cfg.tzShort}`,
              isActive: !isWeekendLoc && locMins >= cfg.lunchEnd && locMins < cfg.closeMins,
            },
          ]
        : [
            {
              label: 'Phiên Khớp lệnh Liên tục XETRA',
              timeRange: '09:00 – 17:30 CET',
              isActive: isOpenLoc,
            },
          ];

    return {
      exchangeName: cfg.exchangeName,
      shortExchange: cfg.shortExchange,
      isOpen: isOpenLoc,
      is24x7: false,
      hasRealOrderBook: false,
      state: isWeekendLoc
        ? 'WEEKEND_CLOSED'
        : isOpenLoc
        ? 'OPEN'
        : isLunchLoc
        ? 'LUNCH_BREAK'
        : locMins < cfg.openMins
        ? 'PRE_OPEN'
        : 'DAILY_CLOSED',
      badgeText: isWeekendLoc
        ? `${cfg.shortExchange} ĐÓNG CỬA • CUỐI TUẦN`
        : isOpenLoc
        ? `${cfg.shortExchange} • ĐANG MỞ CỬA`
        : isLunchLoc
        ? `${cfg.shortExchange} • NGHỈ TRƯA`
        : `${cfg.shortExchange} ĐÃ ĐÓNG CỬA`,
      shortBadge: isOpenLoc ? cfg.shortExchange : isLunchLoc ? 'Nghỉ trưa' : 'Đóng cửa',
      statusHeadline: isOpenLoc
        ? `Đang giao dịch trực tiếp trên ${cfg.exchangeName}`
        : isLunchLoc
        ? `Tạm nghỉ trưa giữa phiên trên ${cfg.exchangeName}`
        : `Ngoài giờ giao dịch ${cfg.exchangeName}`,
      scheduleSummary: cfg.summary,
      scheduleRows: rows,
      nextSessionLabel: isOpenLoc
        ? `Đóng cửa lúc ${pad2(Math.floor(cfg.closeMins / 60))}:${pad2(cfg.closeMins % 60)} ${cfg.tzShort}`
        : `Mở cửa lúc ${pad2(Math.floor(cfg.openMins / 60))}:${pad2(cfg.openMins % 60)} ${cfg.tzShort}`,
      currentExchangeTime: locClock,
    };
  }

  // 3B. CỔ PHIẾU & ETF PHỐ WALL MỸ (NYSE / NASDAQ — America/New_York ET)
  const et = getZonedParts(now, 'America/New_York');
  const etMins = et.hour * 60 + et.minute;
  const etClock = `${pad2(et.hour)}:${pad2(et.minute)} ET (${vnClock})`;

  if (US_EQUITY_SET.has(sym) || (symbolObj.type === 'stock' && symbolObj.quoteAsset === 'USD') || symbolObj.type === 'index') {
    const isWeekendET = et.weekday === 0 || et.weekday === 6;
    const usPriceBandNote =
      'Không giới hạn biên độ trần/sàn • Thanh toán bù trừ SEC T+1 • Có Pre-Market & After-Hours';
    const usRows: TradingScheduleRow[] = [
      { label: 'Pre-Market (Trước giờ)', timeRange: '04:00 – 09:30 ET', isActive: !isWeekendET && etMins >= 240 && etMins < 570 },
      { label: 'Phiên Chính (NYSE/NASDAQ)', timeRange: '09:30 – 16:00 ET', isActive: !isWeekendET && etMins >= 570 && etMins < 960 },
      { label: 'After-Hours (Sau giờ)', timeRange: '16:00 – 20:00 ET', isActive: !isWeekendET && etMins >= 960 && etMins < 1200 },
    ];
    const scheduleSummary = 'Thứ 2 – Thứ 6: Phiên chính 09:30–16:00 ET (20:30–03:00 hoặc 21:30–04:00 giờ VN)';

    if (isWeekendET) {
      return {
        exchangeName: 'NYSE / NASDAQ (Chứng khoán Mỹ)',
        shortExchange: 'US',
        isOpen: false,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'WEEKEND_CLOSED',
        badgeText: 'US ĐÓNG CỬA • CUỐI TUẦN',
        shortBadge: 'Đóng cửa',
        statusHeadline: 'Thị trường Chứng khoán Mỹ đóng cửa nghỉ cuối tuần',
        scheduleSummary,
        scheduleRows: usRows,
        nextSessionLabel: 'Mở lại Pre-Market Thứ Hai 04:00 ET (Phiên chính 09:30 ET)',
        priceBandNote: usPriceBandNote,
        currentExchangeTime: etClock,
      };
    }

    if (etMins >= 570 && etMins < 960) {
      return {
        exchangeName: 'NYSE / NASDAQ (Chứng khoán Mỹ)',
        shortExchange: 'US',
        isOpen: true,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'OPEN',
        badgeText: 'NYSE/NASDAQ • ĐANG MỞ CỬA',
        shortBadge: 'Phiên Mỹ',
        statusHeadline: 'Đang trong Phiên giao dịch chính thức Chứng khoán Mỹ (09:30 – 16:00 ET)',
        scheduleSummary,
        scheduleRows: usRows,
        nextSessionLabel: `Kết thúc phiên chính lúc 16:00 ET (còn ${formatDurationMinutes(960 - etMins)})`,
        priceBandNote: usPriceBandNote,
        currentExchangeTime: etClock,
      };
    }

    if (etMins >= 240 && etMins < 570) {
      return {
        exchangeName: 'NYSE / NASDAQ (Pre-Market)',
        shortExchange: 'US',
        isOpen: true,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'PRE_OPEN',
        badgeText: 'US • PRE-MARKET',
        shortBadge: 'Pre-Market',
        statusHeadline: 'Đang giao dịch Pre-Market Mỹ (04:00 – 09:30 ET)',
        scheduleSummary,
        scheduleRows: usRows,
        nextSessionLabel: `Mở phiên chính lúc 09:30 ET (còn ${formatDurationMinutes(570 - etMins)})`,
        priceBandNote: usPriceBandNote,
        currentExchangeTime: etClock,
      };
    }

    if (etMins >= 960 && etMins < 1200) {
      return {
        exchangeName: 'NYSE / NASDAQ (After-Hours)',
        shortExchange: 'US',
        isOpen: true,
        is24x7: false,
        hasRealOrderBook: false,
        state: 'AFTER_HOURS',
        badgeText: 'US • AFTER-HOURS',
        shortBadge: 'After-Hours',
        statusHeadline: 'Đang giao dịch ngoài giờ After-Hours Mỹ (16:00 – 20:00 ET)',
        scheduleSummary,
        scheduleRows: usRows,
        nextSessionLabel: 'Đóng cửa hoàn toàn lúc 20:00 ET',
        priceBandNote: usPriceBandNote,
        currentExchangeTime: etClock,
      };
    }

    return {
      exchangeName: 'NYSE / NASDAQ (Chứng khoán Mỹ)',
      shortExchange: 'US',
      isOpen: false,
      is24x7: false,
      hasRealOrderBook: false,
      state: 'DAILY_CLOSED',
      badgeText: 'US ĐÃ ĐÓNG CỬA',
      shortBadge: 'Đóng cửa',
      statusHeadline: 'Ngoài giờ giao dịch Chứng khoán Mỹ — Hiển thị giá chốt phiên',
      scheduleSummary,
      scheduleRows: usRows,
      nextSessionLabel: 'Phiên chính kế tiếp: 09:30 ET (Pre-Market từ 04:00 ET)',
      priceBandNote: usPriceBandNote,
      currentExchangeTime: etClock,
    };
  }

  // 4. HÀNG HÓA QUỐC TẾ (XAUUSD, OIL_WTI, OIL_BRENT, SILVER — CME / COMEX / NYMEX)
  // CME Globex mở từ 18:00 Chủ Nhật ET đến 17:00 Thứ Sáu ET (nghỉ bảo trì 17:00-18:00 ET mỗi ngày)
  const isClosedWeekendCME =
    et.weekday === 6 || // Toàn bộ Thứ Bảy ET
    (et.weekday === 0 && etMins < 1080) || // Chủ Nhật trước 18:00 ET (tức trước 05:00/06:00 sáng Thứ Hai giờ VN)
    (et.weekday === 5 && etMins >= 1020);  // Thứ Sáu sau 17:00 ET

  const isDailyBreakCME = !isClosedWeekendCME && etMins >= 1020 && etMins < 1080;

  const cmeRows: TradingScheduleRow[] = [
    { label: 'Phiên Điện tử CME / Quốc tế', timeRange: '18:00 ET – 17:00 ET hôm sau', isActive: !isClosedWeekendCME && !isDailyBreakCME },
    { label: 'Nghỉ bảo trì hệ thống hàng ngày', timeRange: '17:00 – 18:00 ET (04:00/05:00 VN)', isActive: isDailyBreakCME },
    { label: 'Nghỉ cuối tuần', timeRange: 'T6 17:00 ET – CN 18:00 ET', isActive: isClosedWeekendCME },
  ];

  const cmeScheduleSummary =
    'Giao dịch T2–T6 (23h/ngày trên CME/COMEX/NYMEX), nghỉ cuối tuần từ sáng sớm Thứ Bảy đến 05:00/06:00 sáng Thứ Hai (giờ VN).';

  if (isClosedWeekendCME) {
    return {
      exchangeName: 'CME Globex / COMEX / NYMEX',
      shortExchange: 'COMEX/CME',
      isOpen: false,
      is24x7: false,
      hasRealOrderBook: false,
      state: 'WEEKEND_CLOSED',
      badgeText: 'HÀNG HÓA • NGHỈ CUỐI TUẦN',
      shortBadge: 'Đóng cửa',
      statusHeadline:
        sym === 'XAUUSD'
          ? 'Thị trường Vàng Spot/COMEX nghỉ cuối tuần (Lưu ý: Mã PAXGUSDT vẫn giao dịch 24/7 trên Binance)'
          : 'Sàn Hàng hóa Quốc tế (CME/NYMEX) đóng cửa nghỉ cuối tuần',
      scheduleSummary: cmeScheduleSummary,
      scheduleRows: cmeRows,
      nextSessionLabel: 'Mở cửa lại lúc 18:00 Chủ Nhật ET (05:00/06:00 sáng Thứ Hai giờ VN)',
      currentExchangeTime: etClock,
    };
  }

  if (isDailyBreakCME) {
    return {
      exchangeName: 'CME Globex / COMEX / NYMEX',
      shortExchange: 'COMEX/CME',
      isOpen: false,
      is24x7: false,
      hasRealOrderBook: false,
      state: 'LUNCH_BREAK',
      badgeText: 'CME • NGHỈ BẢO TRÌ 1H',
      shortBadge: 'Tạm nghỉ',
      statusHeadline: 'Tạm nghỉ chuyển phiên hàng ngày trên CME Globex (17:00 – 18:00 ET)',
      scheduleSummary: cmeScheduleSummary,
      scheduleRows: cmeRows,
      nextSessionLabel: `Mở lại lúc 18:00 ET (còn ${formatDurationMinutes(1080 - etMins)})`,
      currentExchangeTime: etClock,
    };
  }

  return {
    exchangeName: 'CME Globex / COMEX / NYMEX',
    shortExchange: 'COMEX/CME',
    isOpen: true,
    is24x7: false,
    hasRealOrderBook: false,
    state: 'OPEN',
    badgeText: 'CME/SPOT • ĐANG GIAO DỊCH',
    shortBadge: 'Trong phiên',
    statusHeadline: 'Thị trường Hàng hóa Quốc tế đang mở cửa giao dịch',
    scheduleSummary: cmeScheduleSummary,
    scheduleRows: cmeRows,
    nextSessionLabel: 'Nghỉ chuyển phiên lúc 17:00 ET',
    currentExchangeTime: etClock,
  };
}
