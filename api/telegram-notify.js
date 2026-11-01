/**
 * Vercel Serverless Function: Secure Telegram Alert Dispatcher
 * Environment Variables (configured in Vercel Dashboard -> Settings -> Environment Variables):
 *   - TELEGRAM_BOT_TOKEN: Bot token from @BotFather (NEVER exposed to frontend)
 *   - TELEGRAM_CHAT_ID: Default target Chat ID / Channel ID
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const defaultChatId = process.env.TELEGRAM_CHAT_ID || '';
  const configured = Boolean(botToken && defaultChatId);

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      configured,
      mode: configured ? 'SERVER_ENV_READY' : 'ENV_NOT_SET',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  if (!botToken) {
    return res.status(200).json({
      ok: false,
      configured: false,
      error: 'Chưa cấu hình TELEGRAM_BOT_TOKEN trên biến môi trường Vercel Server.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const targetChatId = String(body.chatId || defaultChatId || '').trim();
    const title = String(body.title || 'Cảnh Báo Trading New').slice(0, 180);
    const message = String(body.message || '').slice(0, 1800);
    const severity = String(body.severity || 'INFO').toUpperCase();
    const symbol = body.symbol ? String(body.symbol).slice(0, 24) : '';

    if (!targetChatId) {
      return res.status(200).json({
        ok: false,
        configured: false,
        error: 'Thiếu TELEGRAM_CHAT_ID trên Vercel hoặc trong cấu hình người nhận.',
      });
    }

    const icon =
      severity === 'CRITICAL'
        ? '🚨'
        : severity === 'WARNING'
        ? '⚠️'
        : severity === 'SUCCESS'
        ? '🟢'
        : '🔔';

    const textLines = [
      `${icon} *${escapeTelegramMarkdown(title)}*`,
      symbol ? `📌 Mã: \`${escapeTelegramMarkdown(symbol)}\`` : '',
      message ? `\n${escapeTelegramMarkdown(message)}` : '',
      `\n⏱ _${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} (GMT+7)_`,
    ].filter(Boolean);

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: textLines.join('\n'),
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    const tgJson = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || !tgJson.ok) {
      return res.status(200).json({
        ok: false,
        configured,
        error: tgJson.description || `Telegram HTTP ${tgRes.status}`,
      });
    }

    return res.status(200).json({
      ok: true,
      configured: true,
      deliveredAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      configured,
      error: err instanceof Error ? err.message : 'Unexpected server error',
    });
  }
}

function escapeTelegramMarkdown(input) {
  return String(input).replace(/([_*`\[])/g, '\\$1');
}
