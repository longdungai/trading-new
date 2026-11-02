import React from 'react';
import { IndicatorSettings } from '../../types';
import {
  BrainCircuit,
  GitCommit,
  Sliders,
  Sparkles,
  ShieldAlert,
  Zap,
  Activity,
  History,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  BarChart2,
  Play,
  GitCompare,
} from 'lucide-react';

interface IndicatorToolbarProps {
  settings: IndicatorSettings;
  onToggle: (key: keyof IndicatorSettings) => void;
  showLeftDock?: boolean;
  onToggleLeftDock?: () => void;
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
  isReplayMode?: boolean;
  onToggleReplayMode?: () => void;
  compareSymbol?: string | null;
  onChangeCompareSymbol?: (sym: string | null) => void;
  isVnAsset?: boolean;
}

export const IndicatorToolbar: React.FC<IndicatorToolbarProps> = ({
  settings,
  onToggle,
  showLeftDock = true,
  onToggleLeftDock,
  isZenMode = false,
  onToggleZenMode,
  isReplayMode = false,
  onToggleReplayMode,
  compareSymbol = null,
  onChangeCompareSymbol,
  isVnAsset = false,
}) => {
  return (
    <div className="h-9 sm:h-[38px] bg-[#080d16] border-b border-slate-800/80 px-2 sm:px-3 flex items-center justify-between gap-2 select-none shrink-0">
      {/* Left & Center Scrollable Indicators */}
      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap">
        {/* Left Dock Toggle Button (Desktop >= 1280px) */}
        {onToggleLeftDock && !isZenMode && (
          <>
            <button
              onClick={onToggleLeftDock}
              className={`hidden xl:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border shrink-0 transition ${
                showLeftDock
                  ? 'bg-[#121c2d] text-emerald-300 border-emerald-500/35'
                  : 'bg-[#0e1523] text-slate-400 border-slate-800 hover:text-white'
              }`}
              title={showLeftDock ? 'Thu gọn cột Danh mục bên trái' : 'Mở cột Danh mục bên trái'}
            >
              {showLeftDock ? (
                <PanelLeftClose className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <PanelLeftOpen className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>Danh Mục</span>
            </button>
            <div className="hidden xl:block h-4 w-px bg-slate-800 shrink-0 mx-0.5" />
          </>
        )}

        {/* Bar Replay & Compare Tools */}
        {onToggleReplayMode && (
          <button
            type="button"
            onClick={onToggleReplayMode}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 transition ${
              isReplayMode
                ? 'bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-500/30 animate-pulse'
                : 'bg-[#101726] text-purple-300 border-purple-500/35 hover:bg-purple-500/15'
            }`}
            title="Tua ngược lịch sử tập giao dịch từng cây nến (Không thiên kiến nhìn trước tương lai)"
          >
            <Play className="w-3 h-3" />
            <span>Bar Replay</span>
          </button>
        )}

        {onChangeCompareSymbol && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#101726] border border-slate-800 text-[11px] shrink-0">
            <GitCompare className="w-3 h-3 text-sky-400" />
            <select
              value={compareSymbol || ''}
              onChange={e => onChangeCompareSymbol(e.target.value ? e.target.value : null)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer text-[11px]"
              title="Chồng đường biến động % của tài sản khác lên biểu đồ để so sánh dẫn dắt giá"
            >
              <option value="" className="bg-[#0b111d]">
                So sánh: Tắt
              </option>
              <option value="BTCUSDT" className="bg-[#0b111d]">
                vs BTCUSDT
              </option>
              <option value="XAUUSD" className="bg-[#0b111d]">
                vs Vàng XAUUSD
              </option>
              <option value="VNINDEX" className="bg-[#0b111d]">
                vs VNINDEX
              </option>
              <option value="OIL_WTI" className="bg-[#0b111d]">
                vs Dầu WTI
              </option>
              <option value="NVDA" className="bg-[#0b111d]">
                vs NVDA
              </option>
            </select>
          </div>
        )}

        <div className="h-4 w-px bg-slate-800 shrink-0 mx-0.5" />

        {/* Cluster 1: Flagship Kronos AI Projections, Recommended Plan & Institutional Volume Profile */}
        <button
          onClick={() => onToggle('recommendedPlanLines')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 transition ${
            settings.recommendedPlanLines !== false
              ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/60 shadow-sm shadow-emerald-500/15'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
          title="Hiển thị đường vùng Entry, Cắt lỗ (SL) & Chốt lời (TP1/TP2) của Hội đồng Khuyến nghị 6 tầng trực tiếp trên biểu đồ"
        >
          <span>🎯 Kế Hoạch Lệnh</span>
        </button>

        <button
          onClick={() => onToggle('kronosGhostCandles')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 transition ${
            settings.kronosGhostCandles
              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/60 shadow-sm shadow-cyan-500/15'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <BrainCircuit className="w-3 h-3 text-cyan-400" />
          <span>Nến AI Kronos</span>
        </button>

        <button
          onClick={() => onToggle('volumeProfile')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 transition ${
            settings.volumeProfile
              ? 'bg-amber-500/20 text-amber-200 border-amber-400/60 shadow-sm shadow-amber-500/15'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
          title="Hiển thị Volume Profile (VPVR) với POC, VAH 70% & VAL 70% trực tiếp trên trục giá"
        >
          <BarChart2 className="w-3 h-3 text-amber-400" />
          <span>VPVR (POC/VA)</span>
        </button>

        <button
          onClick={() => onToggle('vwap')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border shrink-0 transition ${
            settings.vwap
              ? 'bg-teal-500/20 text-teal-200 border-teal-400/60'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
          title="Đường giá bình quân gia quyền khối lượng định chế (Institutional VWAP)"
        >
          <span>VWAP</span>
        </button>

        <button
          onClick={() => onToggle('kronosWalkForward')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 transition ${
            settings.kronosWalkForward
              ? 'bg-amber-500/20 text-amber-200 border-amber-400/60 shadow-sm shadow-amber-500/15'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <History className="w-3 h-3 text-amber-400" />
          <span>Kiểm Định AI</span>
        </button>

        <button
          onClick={() => onToggle('aiForecast')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border shrink-0 transition ${
            settings.aiForecast
              ? 'bg-blue-500/20 text-blue-200 border-blue-400/50'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Sparkles className="w-3 h-3 text-blue-400" />
          <span>Kịch Bản P85/P50/P15</span>
        </button>

        <button
          onClick={() => onToggle('monteCarloPaths')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border shrink-0 transition ${
            settings.monteCarloPaths
              ? 'bg-purple-500/20 text-purple-200 border-purple-400/50'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <BrainCircuit className="w-3 h-3 text-purple-400" />
          <span>Biên VaR 95%</span>
        </button>

        <div className="h-4 w-px bg-slate-800 shrink-0 mx-0.5" />

        {/* Cluster 2: Oscillators & Price Structure */}
        <button
          onClick={() => onToggle('autoSupportResistance')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border shrink-0 transition ${
            settings.autoSupportResistance
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/45'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-3 h-3 text-amber-400" />
          <span>Hỗ Trợ / Kháng Cự</span>
        </button>

        {isVnAsset ? (
          <>
            <button
              onClick={() => onToggle('vnPriceLimits')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 transition ${
                settings.vnPriceLimits !== false
                  ? 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/60 shadow-sm shadow-fuchsia-500/15'
                  : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="Hiển thị đường Giá Trần (Tím), Tham Chiếu (Vàng) & Giá Sàn (Xanh lơ) chuẩn HOSE/HNX/UPCOM trực tiếp trên đồ thị"
            >
              <span>🇻🇳 Trần/TC/Sàn</span>
            </button>
            <button
              onClick={() => onToggle('vnBottomFishingLines')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 transition ${
                settings.vnBottomFishingLines !== false
                  ? 'bg-teal-500/20 text-teal-200 border-teal-400/60 shadow-sm shadow-teal-500/15'
                  : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="Hiển thị đường Rải Đinh Lệnh Chờ Bắt Đáy B1 (20%) & B2 (30% hứng Force-Sell sát giá Sàn) trên đồ thị VN"
            >
              <span>🪝 Rải Đinh Bắt Đáy</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => onToggle('globalOptionsAndLiqLines')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 transition ${
              settings.globalOptionsAndLiqLines !== false
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/60 shadow-sm shadow-cyan-500/15'
                : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Hiển thị Call Wall / Max Pain / Put Wall (Deribit & CBOE) và Vùng Thanh Lý Đòn Bẩy 25x trên đồ thị"
          >
            <span>🧲 Options Wall / Liq</span>
          </button>
        )}

        <button
          onClick={() => onToggle('holdingCostLines')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 transition ${
            settings.holdingCostLines !== false
              ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/60 shadow-sm shadow-indigo-500/15'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
          title="Hiển thị đường Hòa Vốn Thực (gồm phí/thuế/margin) & Bờ Mới Sau DCA của vị thế đang nắm giữ trên đồ thị"
        >
          <span>💼 Đường Hòa Vốn</span>
        </button>

        <button
          onClick={() => onToggle('bollingerBands')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border shrink-0 transition ${
            settings.bollingerBands
              ? 'bg-sky-500/20 text-sky-300 border-sky-400/50'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Sliders className="w-3 h-3 text-sky-400" />
          <span>Bollinger (BB)</span>
        </button>

        <button
          onClick={() => onToggle('rsi')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border shrink-0 transition ${
            settings.rsi
              ? 'bg-indigo-500/25 text-indigo-200 border-indigo-400/50'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Activity className="w-3 h-3 text-indigo-400" />
          <span>RSI</span>
        </button>

        <button
          onClick={() => onToggle('macd')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border shrink-0 transition ${
            settings.macd
              ? 'bg-blue-500/25 text-blue-200 border-blue-400/50'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Activity className="w-3 h-3 text-blue-400" />
          <span>MACD</span>
        </button>

        <button
          onClick={() => onToggle('autoFibonacci')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border shrink-0 transition ${
            settings.autoFibonacci
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <GitCommit className="w-3 h-3 text-emerald-400" />
          <span>Auto Fib</span>
        </button>

        <button
          onClick={() => onToggle('smartMoneyConcepts')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border shrink-0 transition ${
            settings.smartMoneyConcepts
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/45'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Zap className="w-3 h-3 text-indigo-400" />
          <span>SMC</span>
        </button>

        <div className="h-4 w-px bg-slate-800 shrink-0 mx-0.5" />

        {/* Cluster 3: Trend Moving Averages */}
        <button
          onClick={() => onToggle('supertrend')}
          className={`px-2 py-1 rounded-lg text-[11px] font-medium border shrink-0 transition ${
            settings.supertrend
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          SuperTrend
        </button>

        <button
          onClick={() => onToggle('ema20')}
          className={`px-2 py-1 rounded-lg text-[11px] font-mono font-medium border shrink-0 transition ${
            settings.ema20
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/45'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          EMA 20
        </button>

        <button
          onClick={() => onToggle('ema50')}
          className={`px-2 py-1 rounded-lg text-[11px] font-mono font-medium border shrink-0 transition ${
            settings.ema50
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          EMA 50
        </button>

        <button
          onClick={() => onToggle('ema200')}
          className={`px-2 py-1 rounded-lg text-[11px] font-mono font-medium border shrink-0 transition ${
            settings.ema200
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/45'
              : 'bg-[#101726] text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          EMA 200
        </button>
      </div>

      {/* Right Pinned: Full-Chart Zen Mode Toggle (Desktop >= 768px) */}
      {onToggleZenMode && (
        <button
          onClick={onToggleZenMode}
          className={`hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 transition ${
            isZenMode
              ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm shadow-cyan-500/30'
              : 'bg-[#101726] text-slate-300 border-slate-700/80 hover:text-white hover:border-cyan-500/50'
          }`}
          title={isZenMode ? 'Thoát chế độ toàn màn hình biểu đồ' : 'Phóng rộng biểu đồ tối đa (Zen Mode)'}
        >
          {isZenMode ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          <span className="hidden lg:inline">{isZenMode ? 'Thu Nhỏ' : 'Mở Rộng'}</span>
        </button>
      )}
    </div>
  );
};
