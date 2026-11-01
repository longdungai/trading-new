/**
 * Vercel Serverless Cron & Webhook Monitor (/api/cron-macro-watch)
 * Performs background server-side checks on live market benchmarks & macro indicators
 * even when all browser tabs are closed, and dispatches significant regime alerts to Telegram.
 *
 * Security:
 * - Never exposes TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.
 * - If CRON_SECRET is configured in Vercel Environment Variables, verifies Authorization: Bearer <CRON_SECRET>.
 * - Scheduled at "0 1 * * *" (08:00 ICT daily briefing) for 100% compatibility with Vercel Hobby & Pro plans,
 *   and can also be pinged every 5-15m via external cron services (UptimeRobot / cron-job.org).
 */

async function fetchJsonWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization || '';
    const queryKey = req.query?.key || '';
    if (authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized cron invocation' });
    }
  }

  // Fetch real-time BTC, PAXG (Gold proxy), NY Fed EFFR & Alternative.me Fear & Greed in parallel
  const [btcTicker, paxgTicker, nyFedEffr, fngData] = await Promise.all([
    fetchJsonWithTimeout('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT'),
    fetchJsonWithTimeout('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=PAXGUSDT'),
    fetchJsonWithTimeout('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json'),
    fetchJsonWithTimeout('https://api.alternative.me/fng/?limit=1'),
  ]);

  const btcPrice = btcTicker ? parseFloat(btcTicker.lastPrice) : null;
  const btcChg24h = btcTicker ? parseFloat(btcTicker.priceChangePercent) : null;
  const goldPrice = paxgTicker ? parseFloat(paxgTicker.lastPrice) : null;
  const goldChg24h = paxgTicker ? parseFloat(paxgTicker.priceChangePercent) : null;
  const effrRate = nyFedEffr?.refRates?.[0]?.percentRate ?? null;
  const fngVal = fngData?.data?.[0]?.value ? parseInt(fngData.data[0].value, 10) : null;
  const fngClass = fngData?.data?.[0]?.value_classification || 'N/A';

  const anomalies = [];
  if (btcChg24h !== null && Math.abs(btcChg24h) >= 4.5) {
    anomalies.push(`BTC biến động mạnh 24h: ${btcChg24h >= 0 ? '+' : ''}${btcChg24h.toFixed(2)}% ($${btcPrice?.toLocaleString('en-US')})`);
  }
  if (goldChg24h !== null && Math.abs(goldChg24h) >= 1.8) {
    anomalies.push(`Vàng quốc tế biến động mạnh 24h: ${goldChg24h >= 0 ? '+' : ''}${goldChg24h.toFixed(2)}% ($${goldPrice?.toFixed(1)}/oz)`);
  }
  if (fngVal !== null && (fngVal <= 20 || fngVal >= 82)) {
    anomalies.push(`Tâm lý Crypto chạm vùng cực trị: ${fngVal}/100 (${fngClass})`);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const forceBriefing = req.query?.briefing === '1' || req.headers['x-vercel-cron'] === '1';

  let telegramSent = false;
  if (botToken && chatId && (anomalies.length > 0 || forceBriefing)) {
    const lines = [
      anomalies.length > 0
        ? '🚨 *TRADING NEW — CẢNH BÁO BIẾN ĐỘNG TỰ ĐỘNG 24/7*'
        : '📊 *TRADING NEW — BẢN TIN VĨ MÔ & THỊ TRƯỜNG ĐẦU NGÀY*',
      '',
      btcPrice !== null
        ? `• *BTC/USDT:* $${btcPrice.toLocaleString('en-US', { maximumFractionDigits: 1 })} (${btcChg24h >= 0 ? '+' : ''}${btcChg24h?.toFixed(2)}%)`
        : null,
      goldPrice !== null
        ? `• *Vàng Quốc tế (PAXG/XAU):* $${goldPrice.toFixed(1)}/oz (${goldChg24h >= 0 ? '+' : ''}${goldChg24h?.toFixed(2)}%)`
        : null,
      effrRate !== null ? `• *NY Fed EFFR:* ${effrRate}%` : null,
      fngVal !== null ? `• *Fear & Greed:* ${fngVal}/100 (${fngClass})` : null,
      anomalies.length > 0 ? `\n⚡ *Điểm nóng:*\n${anomalies.map((a) => `- ${a}`).join('\n')}` : null,
      `\n🕒 _${new Date().toISOString()}_`,
    ].filter(Boolean);

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: lines.join('\n'),
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });
      telegramSent = tgRes.ok;
    } catch {
      telegramSent = false;
    }
  }

  return res.status(200).json({
    ok: true,
    checkedAtISO: new Date().toISOString(),
    snapshot: {
      btcPrice,
      btcChg24h,
      goldPrice,
      goldChg24h,
      effrRate,
      fngVal,
      fngClass,
    },
    anomalies,
    telegramConfigured: Boolean(botToken && chatId),
    telegramSent,
  });
}
