import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Cloud,
  CloudUpload,
  CloudDownload,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap,
  ArrowUpRight,
} from 'lucide-react';
import { MarketSymbol } from '../../types';
import { formatPrice } from '../../utils/formatters';
import {
  AlertPreferences,
  checkTelegramServerStatus,
  clearTriggeredAlertHistory,
  createSmartAlertRule,
  dispatchTelegramNotification,
  getConditionLabelVi,
  loadAlertPreferences,
  loadSmartAlertRules,
  loadTriggeredAlertHistory,
  markAllAlertsAsRead,
  playTerminalAlertChime,
  saveAlertPreferences,
  saveSmartAlertRules,
  SMART_ALERTS_UPDATED_EVENT,
  SmartAlertConditionType,
  SmartAlertRule,
  TriggeredAlertEvent,
} from '../../services/alerts/smartAlertCenter';
import {
  checkAndPullCloudWorkspace,
  CloudSyncStatus,
  loadCloudWorkspaceId,
  pushLocalWorkspaceToCloud,
} from '../../services/storage/cloudSyncClient';
import {
  isVnDerivativeSymbol,
  isVnStockOrIndexSymbol,
} from '../../services/vnMarket/vnStockMicrostructure';

interface AlertCenterModalProps {
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
  initialPresetPrice?: number | null;
  onSelectSymbol: (sym: MarketSymbol) => void;
  onWorkspaceRestored?: () => void;
  onClose: () => void;
}

type ModalTab = 'rules' | 'history' | 'telegram_cloud';

export const AlertCenterModal: React.FC<AlertCenterModalProps> = ({
  currentSymbol,
  symbols,
  initialPresetPrice = null,
  onSelectSymbol,
  onWorkspaceRestored,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('rules');
  const [rules, setRules] = useState<SmartAlertRule[]>(() => loadSmartAlertRules());
  const [history, setHistory] = useState<TriggeredAlertEvent[]>(() => loadTriggeredAlertHistory());
  const [prefs, setPrefs] = useState<AlertPreferences>(() => loadAlertPreferences());

  // Form states
  const [targetSymbol, setTargetSymbol] = useState<string>(currentSymbol.symbol);
  const [condition, setCondition] = useState<SmartAlertConditionType>(() =>
    initialPresetPrice && initialPresetPrice < currentSymbol.price ? 'PRICE_BELOW' : 'PRICE_ABOVE'
  );
  const [thresholdInput, setThresholdInput] = useState<string>(() =>
    initialPresetPrice
      ? String(initialPresetPrice)
      : String(parseFloat((currentSymbol.price * 1.02).toFixed(4)))
  );
  const [noteInput, setNoteInput] = useState<string>('');
  const [oneShot, setOneShot] = useState<boolean>(true);

  // Telegram & Cloud Sync status
  const [tgServerReady, setTgServerReady] = useState<boolean>(false);
  const [tgStatusMsg, setTgStatusMsg] = useState<string>('');
  const [isTestingTg, setIsTestingTg] = useState<boolean>(false);

  const [workspaceInput, setWorkspaceInput] = useState<string>(() => loadCloudWorkspaceId());
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus | null>(null);
  const [cloudFeedback, setCloudFeedback] = useState<string>('');
  const [isCloudBusy, setIsCloudBusy] = useState<boolean>(false);

  useEffect(() => {
    const syncState = () => {
      setRules(loadSmartAlertRules());
      setHistory(loadTriggeredAlertHistory());
    };
    window.addEventListener(SMART_ALERTS_UPDATED_EVENT, syncState);
    return () => window.removeEventListener(SMART_ALERTS_UPDATED_EVENT, syncState);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    void checkTelegramServerStatus().then(res => {
      setTgServerReady(res.configured);
    });
    void checkAndPullCloudWorkspace(loadCloudWorkspaceId()).then(res => {
      setCloudStatus(res.status);
    });
  }, []);

  const selectedSymMeta =
    symbols.find(s => s.symbol.toUpperCase() === targetSymbol.toUpperCase()) || currentSymbol;

  const handleSymbolChange = (symCode: string) => {
    setTargetSymbol(symCode);
    const found = symbols.find(s => s.symbol === symCode);
    if (found && (condition === 'PRICE_ABOVE' || condition === 'PRICE_BELOW')) {
      const mult = condition === 'PRICE_ABOVE' ? 1.02 : 0.98;
      setThresholdInput(String(parseFloat((found.price * mult).toFixed(4))));
    }
  };

  const handleConditionChange = (nextCond: SmartAlertConditionType) => {
    setCondition(nextCond);
    if (nextCond === 'PRICE_ABOVE') {
      setThresholdInput(String(parseFloat((selectedSymMeta.price * 1.02).toFixed(4))));
    } else if (nextCond === 'PRICE_BELOW') {
      setThresholdInput(String(parseFloat((selectedSymMeta.price * 0.98).toFixed(4))));
    } else if (nextCond === 'CHANGE_24H_ABOVE' || nextCond === 'CHANGE_24H_BELOW') {
      setThresholdInput('3');
    } else if (nextCond === 'RSI_OVERBOUGHT') {
      setThresholdInput('70');
    } else if (nextCond === 'RSI_OVERSOLD') {
      setThresholdInput('30');
    } else if (nextCond === 'FED_PIVOT_AT_LEAST') {
      setThresholdInput('4.0');
    } else if (nextCond === 'ACCUMULATION_HOT_BUY') {
      setThresholdInput('1');
    } else if (nextCond === 'VN_VOLUME_BREAKOUT') {
      setThresholdInput('1.8');
    } else if (nextCond === 'VN_NEAR_FLOOR_WARNING') {
      setThresholdInput('1.2');
    } else if (nextCond === 'VN30F_BASIS_EXTREME') {
      setThresholdInput('6');
    } else if (nextCond === 'VN_FOREIGN_NET_BUY') {
      setThresholdInput('20');
    }
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(thresholdInput);
    if (condition !== 'ACCUMULATION_HOT_BUY' && (!Number.isFinite(num) || num <= 0)) {
      return;
    }
    createSmartAlertRule({
      symbol:
        condition === 'FED_PIVOT_AT_LEAST'
          ? 'FED_PIVOT'
          : condition === 'VN30F_BASIS_EXTREME'
          ? 'VN30F1M'
          : targetSymbol,
      condition,
      threshold: condition === 'ACCUMULATION_HOT_BUY' ? 1 : num,
      note: noteInput,
      oneShot,
      cooldownMinutes: 30,
    });
    setNoteInput('');
    setRules(loadSmartAlertRules());
  };

  const handleQuickPreset = (
    cond: SmartAlertConditionType,
    val: number,
    symOverride?: string,
    note?: string
  ) => {
    createSmartAlertRule({
      symbol: symOverride || currentSymbol.symbol,
      condition: cond,
      threshold: val,
      note,
      oneShot: true,
      cooldownMinutes: 30,
    });
    setRules(loadSmartAlertRules());
  };

  const handleToggleRule = (id: string) => {
    const next = rules.map(r => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    saveSmartAlertRules(next);
    setRules(next);
  };

  const handleDeleteRule = (id: string) => {
    const next = rules.filter(r => r.id !== id);
    saveSmartAlertRules(next);
    setRules(next);
  };

  const updatePref = <K extends keyof AlertPreferences>(key: K, value: AlertPreferences[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    saveAlertPreferences(next);
  };

  const handleEnableBrowserPush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setTgStatusMsg('Trình duyệt hiện tại không hỗ trợ Web Notification.');
      return;
    }
    if (Notification.permission === 'granted') {
      updatePref('browserPushEnabled', !prefs.browserPushEnabled);
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      updatePref('browserPushEnabled', true);
      setTgStatusMsg('Đã cấp quyền thông báo đẩy trên trình duyệt thành công!');
    } else {
      setTgStatusMsg('Bạn đã từ chối quyền thông báo trên trình duyệt.');
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTg(true);
    setTgStatusMsg('Đang gửi tin nhắn kiểm thử tới Telegram...');
    const res = await dispatchTelegramNotification({
      title: 'Kiểm thử kết nối Trading New Pro',
      message: `Hệ thống cảnh báo giá, Kronos AI & Fed Pivot Intelligence V2 đã sẵn sàng cho mã ${currentSymbol.symbol} (giá hiện tại: ${currentSymbol.price}).`,
      severity: 'SUCCESS',
      symbol: currentSymbol.symbol,
      chatId: prefs.customTelegramChatId || undefined,
    });
    setIsTestingTg(false);
    if (res.ok) {
      setTgServerReady(true);
      setTgStatusMsg('✓ Đã gửi tin nhắn kiểm thử thành công tới Telegram của bạn!');
    } else {
      setTgStatusMsg(`⚠ Chưa gửi được: ${res.error || 'Kiểm tra TELEGRAM_BOT_TOKEN trên Vercel'}`);
    }
  };

  const handleCloudPush = async () => {
    setIsCloudBusy(true);
    setCloudFeedback('Đang đồng bộ dữ liệu lên Cloud KV...');
    const status = await pushLocalWorkspaceToCloud(workspaceInput);
    setCloudStatus(status);
    setIsCloudBusy(false);
    if (status.configured) {
      setCloudFeedback(`✓ Đã lưu toàn bộ Cấu hình, Cảnh báo, Nét vẽ & Nhật ký lên Workspace "${status.workspaceId}".`);
    } else {
      setCloudFeedback(
        status.error ||
          'Máy chủ đang chạy ở Chế độ Lưu Trữ Cục Bộ (chưa gắn biến KV_REST_API_URL / UPSTASH_REDIS_REST_URL trên Vercel).'
      );
    }
  };

  const handleCloudPull = async () => {
    setIsCloudBusy(true);
    setCloudFeedback('Đang tải dữ liệu từ Cloud KV...');
    const { status, restoredKeys } = await checkAndPullCloudWorkspace(workspaceInput);
    setCloudStatus(status);
    setIsCloudBusy(false);
    if (status.configured) {
      setRules(loadSmartAlertRules());
      setPrefs(loadAlertPreferences());
      onWorkspaceRestored?.();
      setCloudFeedback(
        restoredKeys > 0
          ? `✓ Đã khôi phục ${restoredKeys} phân mục dữ liệu từ Workspace "${status.workspaceId}"!`
          : `Workspace "${status.workspaceId}" trên Cloud hiện chưa có bản sao lưu nào.`
      );
    } else {
      setCloudFeedback(
        'Máy chủ đang chạy ở Chế độ Lưu Trữ Cục Bộ (chưa gắn Vercel KV / Upstash Redis).'
      );
    }
  };

  const unreadCount = history.filter(h => !h.read).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#090e18] border border-slate-700/80 w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-3.5 sm:px-5 py-3 bg-gradient-to-r from-[#0e1729] via-[#0b1220] to-[#0e1729] border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-white font-mono truncate">
                  Trung Tâm Cảnh Báo Thông Minh & Đồng Bộ Cloud
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 font-mono">
                  {rules.filter(r => r.enabled).length} ĐANG BẬT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Theo dõi Giá, RSI(14), Vùng Gom Hàng, Fed Pivot V2 • Thông báo Web, Âm thanh & Telegram
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
            title="Đóng (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-3.5 sm:px-5 py-2 bg-[#0b101b] border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 ${
              activeTab === 'rules'
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30'
                : 'bg-[#11192a] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Quy Tắc Cảnh Báo ({rules.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('history');
              setHistory(markAllAlertsAsRead());
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 ${
              activeTab === 'history'
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30'
                : 'bg-[#11192a] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Nhật Ký Kích Hoạt ({history.length})</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-mono">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('telegram_cloud')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 ${
              activeTab === 'telegram_cloud'
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30'
                : 'bg-[#11192a] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            <span>Telegram & Cloud KV</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {activeTab === 'rules' && (
            <>
              {/* Quick 1-Click Presets for Current Symbol */}
              <div className="p-3 rounded-xl bg-[#0e1524] border border-cyan-500/25 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                    Tạo nhanh 1 chạm cho {currentSymbol.symbol} (Giá hiện tại:{' '}
                    {currentSymbol.quoteAsset === 'VND'
                      ? `${formatPrice(currentSymbol.price)}k`
                      : `$${formatPrice(currentSymbol.price)}`}
                    )
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 font-mono">
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickPreset(
                        'PRICE_ABOVE',
                        parseFloat((currentSymbol.price * 1.02).toFixed(4)),
                        currentSymbol.symbol,
                        'Breakout +2%'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-[11px] font-bold transition"
                  >
                    + Giá tăng +2% (≥ {formatPrice(currentSymbol.price * 1.02)})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickPreset(
                        'PRICE_BELOW',
                        parseFloat((currentSymbol.price * 0.98).toFixed(4)),
                        currentSymbol.symbol,
                        'Chạm hỗ trợ -2%'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[11px] font-bold transition"
                  >
                    + Giá lùi -2% (≤ {formatPrice(currentSymbol.price * 0.98)})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickPreset('RSI_OVERSOLD', 30, currentSymbol.symbol, 'Canh bắt nhịp hồi RSI ≤ 30')
                    }
                    className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-300 text-[11px] font-bold transition"
                  >
                    + RSI(14) ≤ 30 (Quá bán)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickPreset('ACCUMULATION_HOT_BUY', 1, currentSymbol.symbol, 'Vùng gom tích sản')
                    }
                    className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/35 text-purple-300 text-[11px] font-bold transition"
                  >
                    + Báo khi lọt HOT_BUY
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickPreset('FED_PIVOT_AT_LEAST', 4.0, 'FED_PIVOT', 'Cửa sổ Fed đảo chiều')
                    }
                    className="px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/35 text-teal-300 text-[11px] font-bold transition"
                  >
                    + Fed Pivot ≥ 4.0/7
                  </button>

                  {isVnStockOrIndexSymbol(currentSymbol) && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickPreset(
                            'VN_VOLUME_BREAKOUT',
                            1.8,
                            currentSymbol.symbol,
                            'Nổ Vol nội ngày vượt nền VN'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-lime-500/15 hover:bg-lime-500/25 border border-lime-500/35 text-lime-300 text-[11px] font-bold transition"
                      >
                        ⚡ VN Nổ Vol RVOL ≥ 1.8x
                      </button>

                      {!isVnDerivativeSymbol(currentSymbol.symbol) &&
                        currentSymbol.symbol !== 'VNINDEX' &&
                        currentSymbol.symbol !== 'VN30' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickPreset(
                                  'VN_NEAR_FLOOR_WARNING',
                                  1.2,
                                  currentSymbol.symbol,
                                  'Phòng vệ rủi ro khóa Sàn T+2'
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-[11px] font-bold transition"
                            >
                              🛡️ Cảnh báo Sát Sàn ≤ 1.2%
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleQuickPreset(
                                  'VN_FOREIGN_NET_BUY',
                                  20,
                                  currentSymbol.symbol,
                                  'Khối ngoại gom ròng ≥ 20 tỷ'
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/35 text-indigo-300 text-[11px] font-bold transition"
                            >
                              🌍 Ngoại mua ≥ 20 tỷ
                            </button>
                          </>
                        )}

                      <button
                        type="button"
                        onClick={() =>
                          handleQuickPreset(
                            'VN30F_BASIS_EXTREME',
                            6,
                            'VN30F1M',
                            'Lệch Basis phái sinh VN30F1M ≥ 6 điểm'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/35 text-orange-300 text-[11px] font-bold transition"
                      >
                        ⚖️ Lệch Basis VN30F ≥ 6đ
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Custom Rule Builder Form */}
              <form
                onSubmit={handleCreateRule}
                className="p-3.5 rounded-xl bg-[#0d1320] border border-slate-800 space-y-3"
              >
                <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                  Thiết lập điều kiện cảnh báo tùy chỉnh
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Mã tài sản</label>
                    <select
                      value={targetSymbol}
                      onChange={e => handleSymbolChange(e.target.value)}
                      disabled={
                        condition === 'FED_PIVOT_AT_LEAST' ||
                        condition === 'VN30F_BASIS_EXTREME'
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#080c14] border border-slate-700 text-white font-mono text-xs focus:border-cyan-500 outline-none"
                    >
                      {symbols.map(s => (
                        <option key={s.symbol} value={s.symbol}>
                          {s.symbol} — {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Loại điều kiện</label>
                    <select
                      value={condition}
                      onChange={e => handleConditionChange(e.target.value as SmartAlertConditionType)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#080c14] border border-slate-700 text-white text-xs focus:border-cyan-500 outline-none"
                    >
                      <option value="PRICE_ABOVE">Giá chạm / vượt lên ≥</option>
                      <option value="PRICE_BELOW">Giá chạm / giảm xuống ≤</option>
                      <option value="CHANGE_24H_ABOVE">Biến động 24h tăng ≥ (%)</option>
                      <option value="CHANGE_24H_BELOW">Biến động 24h giảm ≤ (%)</option>
                      <option value="RSI_OVERBOUGHT">RSI(14) Quá mua ≥</option>
                      <option value="RSI_OVERSOLD">RSI(14) Quá bán ≤</option>
                      <option value="ACCUMULATION_HOT_BUY">Lọt vùng gom HOT_BUY</option>
                      <option value="VN_VOLUME_BREAKOUT">🇻🇳 VN Nổ Vol RVOL nội ngày ≥ (x)</option>
                      <option value="VN_NEAR_FLOOR_WARNING">🇻🇳 VN Cảnh báo sát Sàn ≤ (%)</option>
                      <option value="VN_FOREIGN_NET_BUY">🇻🇳 VN Khối ngoại mua ròng ≥ (tỷ)</option>
                      <option value="VN30F_BASIS_EXTREME">🇻🇳 VN30F1M Lệch Basis |điểm| ≥</option>
                      <option value="FED_PIVOT_AT_LEAST">Fed Pivot Score ≥ (0–7)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Giá trị ngưỡng</label>
                    <input
                      type="number"
                      step="any"
                      value={thresholdInput}
                      disabled={condition === 'ACCUMULATION_HOT_BUY'}
                      onChange={e => setThresholdInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#080c14] border border-slate-700 text-white font-mono text-xs focus:border-cyan-500 outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <input
                    type="text"
                    placeholder="Ghi chú hành động (VD: Chốt lời 50% vị thế / Canh mua hỗ trợ EMA200)..."
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#080c14] border border-slate-700 text-slate-200 text-xs focus:border-cyan-500 outline-none"
                  />

                  <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={oneShot}
                      onChange={e => setOneShot(e.target.checked)}
                      className="accent-cyan-500"
                    />
                    <span>Báo 1 lần rồi tắt</span>
                  </label>

                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center justify-center gap-1.5 transition shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Cảnh Báo</span>
                  </button>
                </div>
              </form>

              {/* Active & Saved Rules List */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Danh sách điều kiện đang lưu ({rules.length})
                </div>

                {rules.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-[#0c121e] border border-slate-800/80 text-slate-400">
                    Chưa có quy tắc cảnh báo nào. Hãy chọn nút tạo nhanh 1 chạm phía trên hoặc kẻ đường ngang trên biểu đồ để đặt chuông!
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {rules.map(rule => (
                      <div
                        key={rule.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                          rule.enabled
                            ? 'bg-[#0e1524] border-slate-700/80'
                            : 'bg-[#0a0f19] border-slate-800/60 opacity-60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 font-mono font-bold text-[11px]">
                              {rule.symbol}
                            </span>
                            <span className="text-slate-200 font-semibold">
                              {getConditionLabelVi(rule.condition)}{' '}
                              {rule.condition !== 'ACCUMULATION_HOT_BUY' && (
                                <span className="font-mono text-white font-bold">{rule.threshold}</span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {rule.oneShot ? '• 1 lần' : `• Lặp cách ${rule.cooldownMinutes}p`}
                            </span>
                          </div>
                          {rule.note && (
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                              📝 {rule.note}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleToggleRule(rule.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                              rule.enabled
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {rule.enabled ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/25 transition"
                            title="Xóa cảnh báo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Lịch sử cảnh báo đã nổ ({history.length})
                </span>
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      clearTriggeredAlertHistory();
                      setHistory([]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Xóa lịch sử</span>
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-[#0c121e] border border-slate-800 text-slate-400">
                  Chưa có cảnh báo nào được kích hoạt. Hệ thống đang quét dữ liệu thời gian thực liên tục ở chế độ nền.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(evt => {
                    const matchedSym = symbols.find(
                      s => s.symbol.toUpperCase() === evt.symbol.toUpperCase()
                    );
                    return (
                      <div
                        key={evt.id}
                        className={`p-3 rounded-xl border space-y-1 ${
                          evt.severity === 'CRITICAL'
                            ? 'bg-rose-950/20 border-rose-500/40'
                            : evt.severity === 'WARNING'
                            ? 'bg-amber-950/20 border-amber-500/40'
                            : 'bg-emerald-950/15 border-emerald-500/35'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{evt.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {new Date(evt.triggeredAtMs).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">{evt.message}</p>
                        {matchedSym && (
                          <button
                            onClick={() => {
                              onSelectSymbol(matchedSym);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 pt-0.5"
                          >
                            <span>Mở biểu đồ {matchedSym.symbol}</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'telegram_cloud' && (
            <div className="space-y-4">
              {/* Notification Channels */}
              <div className="p-3.5 rounded-xl bg-[#0d1422] border border-slate-800 space-y-3">
                <div className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <span>Kênh Phát Cảnh Báo Trình Duyệt & Âm Thanh</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !prefs.soundEnabled;
                      updatePref('soundEnabled', next);
                      if (next) playTerminalAlertChime('SUCCESS');
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                      prefs.soundEnabled
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                        : 'bg-[#090e18] border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {prefs.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      Âm báo Terminal (Chime)
                    </span>
                    <span className="font-mono text-[10px] font-bold">
                      {prefs.soundEnabled ? 'BẬT' : 'TẮT'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleEnableBrowserPush}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                      prefs.browserPushEnabled
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                        : 'bg-[#090e18] border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <Bell className="w-4 h-4" />
                      Thông báo đẩy Trình duyệt
                    </span>
                    <span className="font-mono text-[10px] font-bold">
                      {prefs.browserPushEnabled ? 'ĐÃ CẤP QUYỀN' : 'BẤM CẤP QUYỀN'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Secure Telegram Serverless Section */}
              <div className="p-3.5 rounded-xl bg-[#0d1422] border border-sky-500/30 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-sky-400" />
                    <span>Bot Telegram Bảo Mật (Serverless Proxy `/api/telegram-notify`)</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      tgServerReady
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {tgServerReady ? 'SERVER ENV SẴN SÀNG' : 'CHỜ CẤU HÌNH VERCEL ENV'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Token của Bot Telegram được bảo vệ tuyệt đối trên máy chủ Vercel (`TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`), không bao giờ lưu hay lộ trên trình duyệt.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-[#080d17] border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.telegramAutoForward}
                      onChange={e => updatePref('telegramAutoForward', e.target.checked)}
                      className="accent-sky-500"
                    />
                    <span className="text-slate-200 font-medium">
                      Tự động đẩy mọi cảnh báo nổ về Telegram
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-[#080d17] border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.autoForwardMacroPivotAlerts}
                      onChange={e => updatePref('autoForwardMacroPivotAlerts', e.target.checked)}
                      className="accent-sky-500"
                    />
                    <span className="text-slate-200 font-medium">
                      Tự động báo khi Fed Pivot V2 đổi trạng thái
                    </span>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Chat ID nhận riêng (Tùy chọn — bỏ trống để dùng TELEGRAM_CHAT_ID mặc định trên Vercel)"
                    value={prefs.customTelegramChatId}
                    onChange={e => updatePref('customTelegramChatId', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#080c14] border border-slate-700 text-white font-mono text-xs outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    disabled={isTestingTg}
                    onClick={handleTestTelegram}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5 transition shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isTestingTg ? 'Đang gửi...' : 'Gửi Tin Thử Nghiệm'}</span>
                  </button>
                </div>

                {tgStatusMsg && (
                  <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-700 text-[11px] text-cyan-200 font-mono">
                    {tgStatusMsg}
                  </div>
                )}
              </div>

              {/* Cross-Device Cloud KV Sync */}
              <div className="p-3.5 rounded-xl bg-[#0d1422] border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-indigo-400" />
                    <span>Đồng Bộ Đa Thiết Bị PC • iPhone • iPad (`/api/cloud-sync`)</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      cloudStatus?.configured
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {cloudStatus?.configured ? 'VERCEL KV ĐÃ KẾT NỐI' : 'CHẾ ĐỘ LOCAL STORAGE'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Đồng bộ xuyên thiết bị cho Danh sách Yêu thích, Lệnh Paper Trading, Nét vẽ Biểu đồ, Quy tắc Cảnh báo, Nhật ký Kiểm định Kronos & Lịch sử Snapshot Fed Pivot V2 thông qua Vercel KV / Upstash Redis.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={workspaceInput}
                    onChange={e => setWorkspaceInput(e.target.value)}
                    placeholder="Mã không gian làm việc (VD: longdung-pro)"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#080c14] border border-slate-700 text-white font-mono text-xs outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    disabled={isCloudBusy}
                    onClick={handleCloudPush}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5 transition shrink-0"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>Sao Lưu Lên Cloud</span>
                  </button>
                  <button
                    type="button"
                    disabled={isCloudBusy}
                    onClick={handleCloudPull}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 border border-slate-600 font-bold flex items-center justify-center gap-1.5 transition shrink-0"
                  >
                    <CloudDownload className="w-3.5 h-3.5" />
                    <span>Tải Về Thiết Bị Này</span>
                  </button>
                </div>

                {cloudFeedback && (
                  <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-700 text-[11px] text-indigo-200 font-mono">
                    {cloudFeedback}
                  </div>
                )}

                {!cloudStatus?.configured && (
                  <div className="p-2.5 rounded-lg bg-[#080d17] border border-slate-800/90 text-[10.5px] text-slate-400 space-y-1">
                    <div className="font-semibold text-slate-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Hướng dẫn kích hoạt Cloud KV & Telegram miễn phí trên Vercel (1 phút):</span>
                    </div>
                    <div>
                      1. Vào dự án trên Vercel Dashboard → <b>Storage</b> → gắn <b>Upstash Redis / KV</b> (tự động điền `KV_REST_API_URL` & `KV_REST_API_TOKEN`).
                    </div>
                    <div>
                      2. Vào <b>Settings → Environment Variables</b> → thêm `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID` để bật cảnh báo đẩy về điện thoại.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
