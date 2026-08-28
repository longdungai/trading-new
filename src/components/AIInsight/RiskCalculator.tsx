import React, { useState } from 'react';
import { Calculator, Shield, DollarSign } from 'lucide-react';
import { calculatePositionSize } from '../../services/ai/signalGenerator';
import { formatPrice } from '../../utils/formatters';

interface RiskCalculatorProps {
  currentPrice: number;
  stopLossPrice: number;
  quoteAsset?: string;
}

export const RiskCalculator: React.FC<RiskCalculatorProps> = ({ currentPrice, stopLossPrice, quoteAsset = 'USD' }) => {
  const [capital, setCapital] = useState<number>(5000);
  const [riskPercent, setRiskPercent] = useState<number>(2);
  const [leverage, setLeverage] = useState<number>(5);

  const isVND = quoteAsset === 'VND';
  const prefix = isVND ? '' : '$';
  const suffix = isVND ? 'k VNĐ' : '';

  const entry = currentPrice || 100;
  const sl = stopLossPrice || entry * 0.95;

  const result = calculatePositionSize(capital, riskPercent, entry, sl, leverage);

  return (
    <div className="p-4 rounded-xl bg-[#101622] border border-[#1f2a3e] flex flex-col gap-3 shadow-xl select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              Quản Lý Vốn & Kích Thước Lệnh
            </div>
            <div className="text-[11px] text-gray-400">Position Sizer & Risk Management</div>
          </div>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
            Tổng Vốn ({prefix || 'Đơn vị'})
          </label>
          <input
            type="number"
            value={capital}
            onChange={(e) => setCapital(Math.max(1, Number(e.target.value)))}
            className="w-full bg-[#141b27] border border-[#232f44] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
            Rủi Ro (%)
          </label>
          <input
            type="number"
            step="0.5"
            value={riskPercent}
            onChange={(e) => setRiskPercent(Math.max(0.1, Number(e.target.value)))}
            className="w-full bg-[#141b27] border border-[#232f44] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">
            Đòn Bẩy ({leverage}x)
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-3 accent-indigo-500"
          />
        </div>
      </div>

      {/* Computed Outputs */}
      <div className="grid grid-cols-2 gap-2 bg-[#0d131d] p-2.5 rounded-lg border border-[#1b2536] text-xs font-mono">
        <div>
          <div className="text-[10px] text-rose-400 uppercase font-semibold flex items-center gap-1">
            <Shield className="w-3 h-3 text-rose-400" />
            Lỗ Tối Đa (Max Loss)
          </div>
          <div className="text-sm font-bold text-rose-400 mt-0.5">
            -{prefix}{formatPrice(result.maxLossUSD ?? 0)}{suffix}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-blue-400 uppercase font-semibold flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-blue-400" />
            Ký Quỹ Cần Thiết (Margin)
          </div>
          <div className="text-sm font-bold text-blue-400 mt-0.5">
            {prefix}{formatPrice(result.marginRequired ?? 0)}{suffix}
          </div>
        </div>

        <div className="col-span-2 pt-1 border-t border-gray-800 flex justify-between items-center">
          <span className="text-gray-400 text-[11px]">Tổng Giá Trị Vị Thế:</span>
          <span className="font-bold text-white">{prefix}{formatPrice(result.positionSizeUSD ?? 0)}{suffix} ({result.positionSizeCoins ?? 0} Đơn Vị)</span>
        </div>
      </div>
    </div>
  );
};
