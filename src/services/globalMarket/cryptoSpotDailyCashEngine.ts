import { Candle, MarketSymbol } from '../../types';
import { calculateBollingerBands, calculateEMA, calculateRSI } from '../indicators';
import { UserHoldingItem } from '../portfolio/holdingsRecoveryEngine';
import {
  CryptoLiquidationAndCarryReport,
  LiveCryptoMacroData,
  LiveCryptoPerpCarry,
  computeCryptoLiquidationAndCarry,
} from './globalExecutionEngines';

export interface StinkBidTranche {
  trancheIndex: 1 | 2 | 3;
  labelVi: string;
  triggerSourceVi: string;
  limitPrice: number;
  discountFromSpotPct: number;
  usdtAllocationPct: number;
  usdtAmount: number;
  coinQuantity: number;
}

export interface LiquidationWickSniperPlan {
  symbol: string;
  spotPrice: number;
  tranches: StinkBidTranche[];
  weightedAvgEntryPrice: number;
  snapbackTargetPrice: number;
  hardInvalidationPrice: number;
  grossBounceTargetPct: number;
  roundTripSpotFeePct: number; // 0.20% standard Maker/Taker round-trip
  netBounceProfitPct: number;
  estimatedNetProfitUsdt: number;
  sniperHeadlineVi: string;
}

export interface CryptoT0CompoundingPlan {
  hasExistingHolding: boolean;
  baseCoinQuantity: number;
  pingPongSurfQuantity: number; // 30% of holding or simulated $1,000 tranche
  intradayDipBuyPrice: number;
  intradayRallySellPrice: number;
  netSpreadAfterFeePct: number;
  netUsdtEarnedPerCycle: number;
  freeCoinBagPlan: {
    entryPrice: number;
    rallyTargetPrice: number;
    rallyGainPct: number;
    sellPctToRecoverPrincipal: number; // e.g. 96.2% to get 100% original USDT back
    freeCoinsRetainedPct: number; // e.g. 3.8% of bag kept at $0 risk
    freeCoinsValueUsdt: number;
    summaryVi: string;
  };
  compoundingSummaryVi: string;
}

export type CryptoKillzoneSession =
  | 'ASIA_ACCUMULATION'
  | 'LONDON_OPEN_SWEEP'
  | 'NY_ETF_SPOT_POWER'
  | 'LATE_NY_ALGO_RESET';

export interface CryptoSessionKillzoneAndCmeReport {
  activeSession: CryptoKillzoneSession;
  sessionLabelVi: string;
  vnTimeWindowLabel: string;
  volatilityExpectationVi: string;
  bestTacticVi: string;
  cmeReferenceAnchorPrice: number;
  distanceToCmeAnchorPct: number;
  hasUnfilledCmeMagnet: boolean;
  cmeMagnetNoteVi: string;
}

export type SpotPurityRegime =
  | 'SPOT_LED_ACCUMULATION'
  | 'SHORT_SQUEEZE_FUEL'
  | 'BALANCED_ORGANIC'
  | 'LEVERAGE_FROTH_TRAP';

export interface SpotPurityAndFundingShield {
  spotPurityScore: number; // 0..100
  regime: SpotPurityRegime;
  regimeBadgeVi: string;
  isLeverageFrothVeto: boolean;
  fundingRate8hPct: number;
  perpSpotBasisPct: number;
  spotVolumeRvol: number;
  buyerAbsorptionPct: number;
  shieldAdviceVi: string;
}

export interface AltBtcRelativeStrengthReport {
  symbol: string;
  isBtcItself: boolean;
  symbolChange24hPct: number;
  btcChange24hPct: number;
  ethChange24hPct: number;
  rsSpreadVsBtcPct: number;
  rsRegime: 'OUTPERFORMING_BTC_LEADER' | 'TRACKING_BTC_BETA' | 'BLEEDING_VS_BTC_AVOID';
  rsBadgeVi: string;
  topAlphaLeaderSymbol: string;
  topAlphaLeaderChangePct: number;
  rotationAdviceVi: string;
}

export interface UsdtTreasuryBucketItem {
  bucketId: 'BUCKET_1_DAILY_SWING' | 'BUCKET_2_STINK_BID_WICK' | 'BUCKET_3_CRASH_GOLD_RESERVE';
  nameVi: string;
  weightPct: number;
  allocatedUsdt: number;
  deployPrice: number;
  coinUnits: number;
  roleDescriptionVi: string;
}

export interface UsdtThreeBucketTreasuryPlan {
  totalCapitalUsdt: number;
  buckets: UsdtTreasuryBucketItem[];
  expectedDailyTargetUsdt: [number, number]; // e.g. [$45, $110]
  treasurySummaryVi: string;
}

export interface CryptoSpotDailyCashReport {
  symbol: string;
  spotPrice: number;
  dailyOpportunityScore: number; // 0..100
  dailyPlaybookState:
    | 'SNIPE_LIQUIDATION_WICK'
    | 'RIDE_SPOT_BREAKOUT_SQUEEZE'
    | 'PING_PONG_T0_RANGE'
    | 'DEFENSIVE_HOLD_USDT_PAXG';
  playbookBadgeVi: string;
  playbookHeadlineVi: string;
  wickSniper: LiquidationWickSniperPlan;
  t0Compounding: CryptoT0CompoundingPlan;
  sessionKillzone: CryptoSessionKillzoneAndCmeReport;
  spotPurityShield: SpotPurityAndFundingShield;
  altBtcStrength: AltBtcRelativeStrengthReport;
  usdtTreasury: UsdtThreeBucketTreasuryPlan;
}

function roundCryptoPrice(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (price >= 1000) return Math.round(price * 100) / 100;
  if (price >= 10) return Math.round(price * 1000) / 1000;
  if (price >= 1) return Math.round(price * 10000) / 10000;
  return Math.round(price * 1000000) / 1000000;
}

function roundQty(qty: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (qty >= 100) return Math.round(qty * 10) / 10;
  if (qty >= 1) return Math.round(qty * 1000) / 1000;
  return Math.round(qty * 100000) / 100000;
}

/**
 * Master Engine: Evaluate 6 Zero-Leverage Crypto Spot Daily Cash Engines
 */
export function evaluateCryptoSpotDailyCashEngine(params: {
  currentSymbol: MarketSymbol;
  candles: Candle[];
  symbols?: MarketSymbol[];
  perpCarry?: LiveCryptoPerpCarry | null;
  cryptoMacro?: LiveCryptoMacroData | null;
  liqReport?: CryptoLiquidationAndCarryReport | null;
  existingHolding?: UserHoldingItem | null;
  totalCapitalUsdt?: number;
  nowMs?: number;
}): CryptoSpotDailyCashReport {
  const {
    currentSymbol,
    candles,
    symbols = [],
    perpCarry = null,
    existingHolding = null,
    totalCapitalUsdt = 5000,
    nowMs = Date.now(),
  } = params;

  const symUpper = currentSymbol.symbol.toUpperCase();
  const lastCandle = candles[candles.length - 1];
  const spotPrice = lastCandle?.close || currentSymbol.price || 1;
  const sanitizedCapitalUsdt = Math.max(100, Number.isFinite(totalCapitalUsdt) ? totalCapitalUsdt : 5000);
  const roundTripSpotFeePct = 0.2;

  const liqReport =
    params.liqReport ||
    computeCryptoLiquidationAndCarry(symUpper, spotPrice, candles, perpCarry, nowMs);

  const closes = candles.map((c) => c.close);
  const ema20Arr = calculateEMA(closes, 20);
  const ema50Arr = calculateEMA(closes, 50);
  const ema20 = ema20Arr[ema20Arr.length - 1] ?? spotPrice;
  const ema50 = ema50Arr[ema50Arr.length - 1] ?? spotPrice;

  const bbArr = calculateBollingerBands(candles, 20, 2);
  const lastBb = bbArr[bbArr.length - 1];
  const bbLower = lastBb?.lower ?? spotPrice * 0.975;
  const bbUpper = lastBb?.upper ?? spotPrice * 1.025;

  const rsiArr = calculateRSI(candles, 14);
  const latestRsi = rsiArr[rsiArr.length - 1]?.value ?? 50;

  // =========================================================================
  // ENGINE 1: LEVERAGE LIQUIDATION WICK SNIPER (Stink-Bid Ladder)
  // =========================================================================
  const sbidBudgetUsdt = sanitizedCapitalUsdt * 0.35; // Bucket 2 allocation
  const t1Price = roundCryptoPrice(Math.min(spotPrice * 0.982, (liqReport.longLiq50x + bbLower) / 2));
  const t2Price = roundCryptoPrice(Math.min(t1Price * 0.986, liqReport.longLiq25x));
  const t3Price = roundCryptoPrice(t2Price * 0.982); // 20x deep flush wick

  const t1Usdt = Math.round(sbidBudgetUsdt * 0.3);
  const t2Usdt = Math.round(sbidBudgetUsdt * 0.4);
  const t3Usdt = Math.round(sbidBudgetUsdt * 0.3);

  const tranches: StinkBidTranche[] = [
    {
      trancheIndex: 1,
      labelVi: 'Tầng 1 (Quét Long 50x & BB Dưới)',
      triggerSourceVi: 'Cụm thanh lý Long 50x + Biên dưới Bollinger',
      limitPrice: t1Price,
      discountFromSpotPct: Number((((spotPrice - t1Price) / spotPrice) * 100).toFixed(2)),
      usdtAllocationPct: 30,
      usdtAmount: t1Usdt,
      coinQuantity: roundQty(t1Usdt / Math.max(0.000001, t1Price)),
    },
    {
      trancheIndex: 2,
      labelVi: 'Tầng 2 (Tâm Bão Quét Long 25x–33x)',
      triggerSourceVi: 'Vùng rũ bỏ đòn bẩy cao & Hấp thụ thanh khoản cá voi',
      limitPrice: t2Price,
      discountFromSpotPct: Number((((spotPrice - t2Price) / spotPrice) * 100).toFixed(2)),
      usdtAllocationPct: 40,
      usdtAmount: t2Usdt,
      coinQuantity: roundQty(t2Usdt / Math.max(0.000001, t2Price)),
    },
    {
      trancheIndex: 3,
      labelVi: 'Tầng 3 (Râu Nến Hoảng Loạn Long 20x)',
      triggerSourceVi: 'Đinh hứng râu nến quét Stop-Hunt lúc nửa đêm',
      limitPrice: t3Price,
      discountFromSpotPct: Number((((spotPrice - t3Price) / spotPrice) * 100).toFixed(2)),
      usdtAllocationPct: 30,
      usdtAmount: t3Usdt,
      coinQuantity: roundQty(t3Usdt / Math.max(0.000001, t3Price)),
    },
  ];

  const totalSniperCoins = tranches.reduce((acc, t) => acc + t.coinQuantity, 0);
  const weightedAvgEntryPrice = roundCryptoPrice(
    totalSniperCoins > 0 ? sbidBudgetUsdt / totalSniperCoins : t2Price
  );
  const snapbackTargetPrice = roundCryptoPrice(Math.max(spotPrice * 0.996, ema20));
  const hardInvalidationPrice = roundCryptoPrice(t3Price * 0.972);

  const grossBounceTargetPct = Number(
    (((snapbackTargetPrice - weightedAvgEntryPrice) / weightedAvgEntryPrice) * 100).toFixed(2)
  );
  const netBounceProfitPct = Number(
    Math.max(0.4, grossBounceTargetPct - roundTripSpotFeePct).toFixed(2)
  );
  const estimatedNetProfitUsdt = Number(
    ((sbidBudgetUsdt * netBounceProfitPct) / 100).toFixed(2)
  );

  const wickSniper: LiquidationWickSniperPlan = {
    symbol: symUpper,
    spotPrice: roundCryptoPrice(spotPrice),
    tranches,
    weightedAvgEntryPrice,
    snapbackTargetPrice,
    hardInvalidationPrice,
    grossBounceTargetPct,
    roundTripSpotFeePct,
    netBounceProfitPct,
    estimatedNetProfitUsdt,
    sniperHeadlineVi: `Đặt sẵn 3 lệnh Limit hứng râu thanh lý Long từ $${t1Price.toLocaleString()} → $${t3Price.toLocaleString()} (Giá khớp TB $${weightedAvgEntryPrice.toLocaleString()}). Chốt lời nhịp rút chân tại $${snapbackTargetPrice.toLocaleString()} (+${netBounceProfitPct}% ròng ≈ +$${estimatedNetProfitUsdt}).`,
  };

  // =========================================================================
  // ENGINE 2: ZERO-LEVERAGE T+0 COMPOUNDING & "FREE COIN BAG"
  // =========================================================================
  const hasExistingHolding = Boolean(existingHolding && existingHolding.quantity > 0);
  const baseCoinQuantity = hasExistingHolding
    ? (existingHolding as UserHoldingItem).quantity
    : roundQty((sanitizedCapitalUsdt * 0.4) / spotPrice);
  const pingPongSurfQuantity = roundQty(baseCoinQuantity * (hasExistingHolding ? 0.35 : 0.5));

  const intradayDipBuyPrice = roundCryptoPrice(Math.min(spotPrice * 0.986, Math.max(bbLower, t1Price)));
  const intradayRallySellPrice = roundCryptoPrice(
    Math.max(spotPrice * 1.018, Math.min(bbUpper, spotPrice * 1.032))
  );
  const grossSpreadPct =
    ((intradayRallySellPrice - intradayDipBuyPrice) / intradayDipBuyPrice) * 100;
  const netSpreadAfterFeePct = Number(
    Math.max(0.5, grossSpreadPct - roundTripSpotFeePct).toFixed(2)
  );
  const surfNotionalUsdt = pingPongSurfQuantity * intradayDipBuyPrice;
  const netUsdtEarnedPerCycle = Number(
    ((surfNotionalUsdt * netSpreadAfterFeePct) / 100).toFixed(2)
  );

  // Free Coin Bag ("House Money") calculation on a +4.5% swing
  const rallyGainPct = 4.5;
  const rallyTargetPrice = roundCryptoPrice(spotPrice * (1 + rallyGainPct / 100));
  const sellPctToRecoverPrincipal = Number(
    ((100 / (1 + (rallyGainPct - roundTripSpotFeePct) / 100))).toFixed(1)
  );
  const freeCoinsRetainedPct = Number((100 - sellPctToRecoverPrincipal).toFixed(1));
  const freeCoinsValueUsdt = Number(
    ((baseCoinQuantity * (freeCoinsRetainedPct / 100)) * rallyTargetPrice).toFixed(2)
  );

  const t0Compounding: CryptoT0CompoundingPlan = {
    hasExistingHolding,
    baseCoinQuantity,
    pingPongSurfQuantity,
    intradayDipBuyPrice,
    intradayRallySellPrice,
    netSpreadAfterFeePct,
    netUsdtEarnedPerCycle,
    freeCoinBagPlan: {
      entryPrice: roundCryptoPrice(spotPrice),
      rallyTargetPrice,
      rallyGainPct,
      sellPctToRecoverPrincipal,
      freeCoinsRetainedPct,
      freeCoinsValueUsdt,
      summaryVi: `Khi ${symUpper} tăng chạm $${rallyTargetPrice.toLocaleString()} (+${rallyGainPct}%), bán ${sellPctToRecoverPrincipal}% vị thế để thu hồi 100% vốn gốc USDT. Giữ lại ${freeCoinsRetainedPct}% lượng Coin (≈ $${freeCoinsValueUsdt}) làm "Tài sản lãi ròng 0đ rủi ro" để gồng dài hạn.`,
    },
    compoundingSummaryVi: hasExistingHolding
      ? `Kho đang có ${baseCoinQuantity} ${symUpper}: Dùng 35% kho (${pingPongSurfQuantity} ĐV) lướt T+0 mua $${intradayDipBuyPrice.toLocaleString()} → bán $${intradayRallySellPrice.toLocaleString()}, bỏ túi +$${netUsdtEarnedPerCycle}/vòng (+${netSpreadAfterFeePct}% ròng).`
      : `Lướt T+0 trong biên độ ngày: Kê mua ${pingPongSurfQuantity} ĐV tại $${intradayDipBuyPrice.toLocaleString()} → chốt lời tại $${intradayRallySellPrice.toLocaleString()}, lãi ròng +${netSpreadAfterFeePct}% (+$${netUsdtEarnedPerCycle}/vòng sau phí 0.20%).`,
  };

  // =========================================================================
  // ENGINE 3: 24/7 ASIA / LONDON / NY KILLZONE & CME GAP TRACKER
  // =========================================================================
  const vnHour = new Date(nowMs + 7 * 3600_000).getUTCHours();
  let activeSession: CryptoKillzoneSession = 'ASIA_ACCUMULATION';
  let sessionLabelVi = 'Phiên Á (Tokyo / Singapore / Việt Nam)';
  let vnTimeWindowLabel = '07:00 – 14:00 (Giờ VN)';
  let volatilityExpectationVi = 'Biên độ tích lũy vừa phải — Hay tạo nhịp quét giả đầu ngày (Judas Swing)';
  let bestTacticVi = 'Không mua đuổi nến xanh lúc 08:00–09:30 sáng; ưu tiên kê lệnh Limit dưới VWAP.';

  if (vnHour >= 14 && vnHour < 19) {
    activeSession = 'LONDON_OPEN_SWEEP';
    sessionLabelVi = 'Phiên Âu Mở Cửa (London Killzone Sweep)';
    vnTimeWindowLabel = '14:00 – 19:30 (Giờ VN)';
    volatilityExpectationVi = 'Thanh khoản tăng vọt — Thường quét thủng đáy hoặc đỉnh phiên Á trước khi chọn hướng';
    bestTacticVi = 'Canh bắt râu nến khi giá quét qua đáy phiên Á kèm phân kỳ RSI/MACD.';
  } else if (vnHour >= 19 || vnHour < 3) {
    activeSession = 'NY_ETF_SPOT_POWER';
    sessionLabelVi = 'Phiên Mỹ & Dòng Tiền ETF Spot (Wall Street Killzone)';
    vnTimeWindowLabel = '19:30 – 03:00 (Giờ VN)';
    volatilityExpectationVi = 'Đỉnh điểm thanh khoản toàn cầu (Quỹ ETF Spot IBIT/FBTC & CME hoạt động mạnh nhất)';
    bestTacticVi = 'Khung giờ vàng để đánh Breakout thực chất hoặc chốt lời các lệnh gom từ phiên Á/Âu.';
  } else {
    activeSession = 'LATE_NY_ALGO_RESET';
    sessionLabelVi = 'Cuối Phiên Mỹ & Khớp Kỳ Funding 07:00 Sáng';
    vnTimeWindowLabel = '03:00 – 07:00 (Giờ VN)';
    volatilityExpectationVi = 'Thanh khoản sổ lệnh mỏng — Dễ xuất hiện râu nến quét thanh lý tự động';
    bestTacticVi = 'Treo sẵn lệnh Stink-Bid Ngăn 2 (-2% đến -4%) trước khi ngủ để hứng râu thanh lý.';
  }

  // Estimate CME / Institutional Anchor Reference from 20-bar volume-weighted equilibrium
  const recent20 = candles.slice(-20);
  const cmeReferenceAnchorPrice = roundCryptoPrice(
    recent20.length > 0
      ? recent20.reduce((acc, c) => acc + c.close, 0) / recent20.length
      : ema20
  );
  const distanceToCmeAnchorPct = Number(
    (((spotPrice - cmeReferenceAnchorPrice) / cmeReferenceAnchorPrice) * 100).toFixed(2)
  );
  const hasUnfilledCmeMagnet = Math.abs(distanceToCmeAnchorPct) >= 1.8;

  const sessionKillzone: CryptoSessionKillzoneAndCmeReport = {
    activeSession,
    sessionLabelVi,
    vnTimeWindowLabel,
    volatilityExpectationVi,
    bestTacticVi,
    cmeReferenceAnchorPrice,
    distanceToCmeAnchorPct,
    hasUnfilledCmeMagnet,
    cmeMagnetNoteVi: hasUnfilledCmeMagnet
      ? `Giá Spot đang lệch ${distanceToCmeAnchorPct >= 0 ? '+' : ''}${distanceToCmeAnchorPct}% so với trục định chế CME/VWAP ($${cmeReferenceAnchorPrice.toLocaleString()}) — chú ý lực hút lấp Gap về vùng cân bằng.`
      : `Giá đang bám sát trục cân bằng định chế CME/VWAP ($${cmeReferenceAnchorPrice.toLocaleString()}), cấu trúc tăng/giảm bền vững.`,
  };

  // =========================================================================
  // ENGINE 4: SPOT CVD vs. PERP FUNDING DIVERGENCE SHIELD
  // =========================================================================
  const recentVols = candles.slice(-21, -1).map((c) => c.volume || 0).filter((v) => v > 0);
  const avgVol20 =
    recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 1;
  const latestVol = lastCandle?.volume || avgVol20;
  const spotVolumeRvol = Number((avgVol20 > 0 ? latestVol / avgVol20 : 1).toFixed(2));

  // Buyer absorption from lower wicks and green closes over last 5 bars
  const last5 = candles.slice(-5);
  let buyPressureSum = 0;
  for (const c of last5) {
    const range = Math.max(0.000001, c.high - c.low);
    const closePos = (c.close - c.low) / range; // 0..1
    buyPressureSum += closePos;
  }
  const buyerAbsorptionPct = Math.round((buyPressureSum / Math.max(1, last5.length)) * 100);

  const funding8h = liqReport.fundingRate8hPct;
  const basisPct = liqReport.perpSpotBasisPct;

  let spotPurityScore = 65;
  let purityRegime: SpotPurityRegime = 'BALANCED_ORGANIC';
  let regimeBadgeVi = 'DÒNG TIỀN CÂN BẰNG TỰ NHIÊN';
  let isLeverageFrothVeto = false;
  let shieldAdviceVi =
    'Tỷ lệ giữa lực mua Spot và hợp đồng tương lai Perp ở trạng thái lành mạnh. Có thể giao dịch theo kỷ luật chuẩn.';

  if (funding8h <= -0.003 && buyerAbsorptionPct >= 52) {
    spotPurityScore = 88;
    purityRegime = 'SHORT_SQUEEZE_FUEL';
    regimeBadgeVi = '🔥 NÉN LÒ XO ÉP SHORT (Funding Âm + Cá Voi Gom Spot)';
    shieldAdviceVi = `Funding đang âm (${funding8h.toFixed(4)}%) nghĩa là đám đông đang Short đuổi nhưng lực hấp thụ Spot đạt ${buyerAbsorptionPct}% — cơ hội vàng để mua Spot đón nhịp Short Squeeze!`;
  } else if (funding8h > 0.028 || (funding8h > 0.018 && spotVolumeRvol < 0.85 && latestRsi > 68)) {
    spotPurityScore = 32;
    purityRegime = 'LEVERAGE_FROTH_TRAP';
    regimeBadgeVi = '⚠️ BẪY BƠM ĐÒN BẨY QUÁ NHIỆT (Cấm FOMO Mua Đuổi)';
    isLeverageFrothVeto = true;
    shieldAdviceVi = `Funding Rate quá nóng (+${funding8h.toFixed(4)}%) trong khi Volume Spot thực tế yếu (RVOL ${spotVolumeRvol}x). Cảnh giác cú đạp quét Long — chỉ kê lệnh hứng râu ở Ngăn 2!`;
  } else if (spotVolumeRvol >= 1.15 && buyerAbsorptionPct >= 58 && funding8h <= 0.015) {
    spotPurityScore = 84;
    purityRegime = 'SPOT_LED_ACCUMULATION';
    regimeBadgeVi = '🟢 DÒNG TIỀN SPOT THẬT DẪN SÓNG (Spot-Led Bull)';
    shieldAdviceVi = `Volume Spot tăng thực chất (${spotVolumeRvol}x TB 20 phiên, hấp thụ ${buyerAbsorptionPct}%) mà Funding không bị quá nhiệt (+${funding8h.toFixed(4)}%) — an toàn để giải ngân Ngăn 1.`;
  }

  const spotPurityShield: SpotPurityAndFundingShield = {
    spotPurityScore,
    regime: purityRegime,
    regimeBadgeVi,
    isLeverageFrothVeto,
    fundingRate8hPct: funding8h,
    perpSpotBasisPct: basisPct,
    spotVolumeRvol,
    buyerAbsorptionPct,
    shieldAdviceVi,
  };

  // =========================================================================
  // ENGINE 5: ALTCOIN vs. BTC PAIR RELATIVE STRENGTH (ALT/BTC) & ALPHA ROTATION
  // =========================================================================
  const btcObj = symbols.find((s) => s.symbol.toUpperCase() === 'BTCUSDT');
  const ethObj = symbols.find((s) => s.symbol.toUpperCase() === 'ETHUSDT');
  const btcChange24hPct = btcObj?.change24h ?? (symUpper === 'BTCUSDT' ? currentSymbol.change24h : 0.8);
  const ethChange24hPct = ethObj?.change24h ?? (symUpper === 'ETHUSDT' ? currentSymbol.change24h : 0.6);
  const symbolChange24hPct = currentSymbol.change24h;
  const isBtcItself = symUpper === 'BTCUSDT';
  const rsSpreadVsBtcPct = Number((symbolChange24hPct - btcChange24hPct).toFixed(2));

  const cryptoWatchlist = symbols.filter(
    (s) =>
      s.type === 'crypto' ||
      s.symbol.toUpperCase().endsWith('USDT')
  );
  const sortedCryptoLeaders = [...cryptoWatchlist].sort((a, b) => b.change24h - a.change24h);
  const topAlphaLeaderSymbol = sortedCryptoLeaders[0]?.symbol.toUpperCase() || symUpper;
  const topAlphaLeaderChangePct = Number(
    (sortedCryptoLeaders[0]?.change24h ?? symbolChange24hPct).toFixed(2)
  );

  let rsRegime: AltBtcRelativeStrengthReport['rsRegime'] = 'TRACKING_BTC_BETA';
  let rsBadgeVi = 'ĐỒNG PHA VỚI BITCOIN';
  let rotationAdviceVi = `${symUpper} đang di chuyển đồng pha với BTC (${rsSpreadVsBtcPct >= 0 ? '+' : ''}${rsSpreadVsBtcPct}% so với BTC). Giao dịch bám sát nhịp hỗ trợ/kháng cự của BTC.`;

  if (isBtcItself) {
    rsRegime = 'OUTPERFORMING_BTC_LEADER';
    rsBadgeVi = '👑 TRỤ CỘT DẪN DẮT THỊ TRƯỜNG (King BTC)';
    rotationAdviceVi = `BTC là tài sản gốc thanh khoản cao nhất thị trường. Mã dẫn đầu hiệu suất 24h toàn danh mục hiện tại là ${topAlphaLeaderSymbol} (${topAlphaLeaderChangePct >= 0 ? '+' : ''}${topAlphaLeaderChangePct}%).`;
  } else if (rsSpreadVsBtcPct >= 1.2) {
    rsRegime = 'OUTPERFORMING_BTC_LEADER';
    rsBadgeVi = `🚀 MẠNH HƠN BTC (+${rsSpreadVsBtcPct}% Alpha)`;
    rotationAdviceVi = `Cặp ${symUpper}/BTC đang hút dòng tiền khỏe hơn Bitcoin (+${rsSpreadVsBtcPct}%). Ưu tiên giữ vị thế và mua gia tăng khi nhúng về EMA20.`;
  } else if (rsSpreadVsBtcPct <= -1.5) {
    rsRegime = 'BLEEDING_VS_BTC_AVOID';
    rsBadgeVi = `🩸 SUY YẾU SO VỚI BTC (${rsSpreadVsBtcPct}%)`;
    rotationAdviceVi = `Cặp ${symUpper}/BTC đang chảy máu so với Bitcoin (${rsSpreadVsBtcPct}%). Khi BTC rung lắc nhẹ, mã này dễ giảm sâu hơn — ưu tiên cơ cấu sang ${topAlphaLeaderSymbol} hoặc BTC/PAXG.`;
  }

  const altBtcStrength: AltBtcRelativeStrengthReport = {
    symbol: symUpper,
    isBtcItself,
    symbolChange24hPct: Number(symbolChange24hPct.toFixed(2)),
    btcChange24hPct: Number(btcChange24hPct.toFixed(2)),
    ethChange24hPct: Number(ethChange24hPct.toFixed(2)),
    rsSpreadVsBtcPct,
    rsRegime,
    rsBadgeVi,
    topAlphaLeaderSymbol,
    topAlphaLeaderChangePct,
    rotationAdviceVi,
  };

  // =========================================================================
  // ENGINE 6: 3-BUCKET ZERO-LEVERAGE USDT TREASURY ALLOCATOR
  // =========================================================================
  const b1Usdt = Math.round(sanitizedCapitalUsdt * 0.4);
  const b2Usdt = Math.round(sanitizedCapitalUsdt * 0.35);
  const b3Usdt = sanitizedCapitalUsdt - b1Usdt - b2Usdt;

  const b1Price = roundCryptoPrice(Math.min(spotPrice, ema20));
  const b2Price = weightedAvgEntryPrice;
  const b3Price = roundCryptoPrice(Math.min(ema50 * 0.94, t3Price * 0.96));

  const buckets: UsdtTreasuryBucketItem[] = [
    {
      bucketId: 'BUCKET_1_DAILY_SWING',
      nameVi: 'Ngăn 1 (40%): Vốn Lướt Sóng Spot Hàng Ngày',
      weightPct: 40,
      allocatedUsdt: b1Usdt,
      deployPrice: b1Price,
      coinUnits: roundQty(b1Usdt / Math.max(0.000001, b1Price)),
      roleDescriptionVi:
        'Đánh nhịp Pullback EMA20/VWAP hoặc Breakout có Volume Spot xác nhận, thu lời T+0 từ +1.8% đến +4.5%/vòng.',
    },
    {
      bucketId: 'BUCKET_2_STINK_BID_WICK',
      nameVi: 'Ngăn 2 (35%): Kê Lệnh Hứng Râu Thanh Lý Long',
      weightPct: 35,
      allocatedUsdt: b2Usdt,
      deployPrice: b2Price,
      coinUnits: roundQty(b2Usdt / Math.max(0.000001, b2Price)),
      roleDescriptionVi:
        'Rải sẵn 3 tầng Limit tại cụm thanh lý Long 20x–50x để khớp giá chiết khấu lúc sàn quét râu ban đêm.',
    },
    {
      bucketId: 'BUCKET_3_CRASH_GOLD_RESERVE',
      nameVi: 'Ngăn 3 (25%): Két Sắt Dự Phòng Sập Sâu & Vàng Số PAXG',
      weightPct: 25,
      allocatedUsdt: b3Usdt,
      deployPrice: b3Price,
      coinUnits: roundQty(b3Usdt / Math.max(0.000001, b3Price)),
      roleDescriptionVi:
        'Tuyệt đối không đụng vào khi thị trường bình thường; chỉ giải ngân khi RSI(1D) < 30 hoặc trú ẩn vào PAXGUSDT.',
    },
  ];

  const minDailyUsdt = Math.round(sanitizedCapitalUsdt * 0.0075); // 0.75% of total capital
  const maxDailyUsdt = Math.round(sanitizedCapitalUsdt * 0.022); // 2.2% of total capital

  const usdtTreasury: UsdtThreeBucketTreasuryPlan = {
    totalCapitalUsdt: sanitizedCapitalUsdt,
    buckets,
    expectedDailyTargetUsdt: [minDailyUsdt, maxDailyUsdt],
    treasurySummaryVi: `Với tổng vốn $${sanitizedCapitalUsdt.toLocaleString()} USDT (Spot 1x — Không đòn bẩy), chia kỷ luật $${b1Usdt.toLocaleString()} đánh sóng ngày, $${b2Usdt.toLocaleString()} hứng râu thanh lý và $${b3Usdt.toLocaleString()} dự phòng giúp kiếm mục tiêu +$${minDailyUsdt} → +$${maxDailyUsdt}/ngày mà không bao giờ cháy tài khoản.`,
  };

  // =========================================================================
  // COMPOSITE DAILY OPPORTUNITY SCORE & PLAYBOOK STATE
  // =========================================================================
  let dailyOpportunityScore = Math.round(
    spotPurityScore * 0.45 +
      (rsRegime === 'OUTPERFORMING_BTC_LEADER' ? 28 : rsRegime === 'TRACKING_BTC_BETA' ? 18 : 8) +
      (latestRsi >= 32 && latestRsi <= 64 ? 22 : 10)
  );
  dailyOpportunityScore = Math.max(15, Math.min(98, dailyOpportunityScore));

  let dailyPlaybookState: CryptoSpotDailyCashReport['dailyPlaybookState'] =
    'PING_PONG_T0_RANGE';
  let playbookBadgeVi = '🔄 LƯỚT T+0 TRONG BIÊN & HỨNG RÂU';
  let playbookHeadlineVi = `Thị trường đang dao động tạo biên — Ưu tiên lướt T+0 (${fmtPriceShort(intradayDipBuyPrice)} → ${fmtPriceShort(intradayRallySellPrice)}) và treo lệnh Ngăn 2 hứng râu thanh lý.`;

  if (isLeverageFrothVeto) {
    dailyPlaybookState = 'DEFENSIVE_HOLD_USDT_PAXG';
    playbookBadgeVi = '🛡️ PHÒNG THỦ USDT — CHỜ QUÉT LONG';
    playbookHeadlineVi = `Funding đang quá nhiệt (+${funding8h.toFixed(4)}%). Không mua đuổi giá hiện tại; giữ USDT và chờ khớp lệnh hứng râu tại $${t1Price.toLocaleString()} – $${t2Price.toLocaleString()}.`;
  } else if (
    purityRegime === 'SHORT_SQUEEZE_FUEL' ||
    (purityRegime === 'SPOT_LED_ACCUMULATION' && rsRegime === 'OUTPERFORMING_BTC_LEADER')
  ) {
    dailyPlaybookState = 'RIDE_SPOT_BREAKOUT_SQUEEZE';
    playbookBadgeVi = '🚀 GIẢI NGÂN NGĂN 1 — SÓNG SPOT THẬT';
    playbookHeadlineVi = `Dòng tiền Spot thực đang dẫn sóng trên ${symUpper} (Điểm tinh khiết ${spotPurityScore}/100). Giải ngân Ngăn 1 quanh $${b1Price.toLocaleString()} và áp dụng quy tắc "Free Coin Bag" tại $${rallyTargetPrice.toLocaleString()}.`;
  } else if (latestRsi <= 38) {
    dailyPlaybookState = 'SNIPE_LIQUIDATION_WICK';
    playbookBadgeVi = '🎯 BẮT RÂU THANH LÝ QUÁ BÁN';
    playbookHeadlineVi = `RSI đã lùi về vùng quá bán (${latestRsi.toFixed(0)}) — Kích hoạt thang lệnh hứng râu thanh lý từ $${t1Price.toLocaleString()} ăn nhịp bật lại EMA20 ($${snapbackTargetPrice.toLocaleString()}).`;
  }

  return {
    symbol: symUpper,
    spotPrice: roundCryptoPrice(spotPrice),
    dailyOpportunityScore,
    dailyPlaybookState,
    playbookBadgeVi,
    playbookHeadlineVi,
    wickSniper,
    t0Compounding,
    sessionKillzone,
    spotPurityShield,
    altBtcStrength,
    usdtTreasury,
  };
}

function fmtPriceShort(p: number): string {
  return `$${p.toLocaleString('en-US')}`;
}
