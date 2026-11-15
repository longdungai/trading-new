import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw, X } from 'lucide-react';
import { ColorType, createChart, LineStyle, Time, UTCTimestamp } from 'lightweight-charts';
import { Candle } from '../../types';
import {
  REBOUND_BAR, REBOUND_FEE, REBOUND_METHODS, REBOUND_RISK, REBOUND_SLIPPAGE, REBOUND_STAGES,
  ReboundEvent, ReboundHours, ReboundMethod, ReboundOutcome, ReboundSetup, summarizeRebounds,
} from '../../services/globalMarket/cryptoReboundEngine';
import {
  loadReboundScan, readReboundJournal, REBOUND_PAIRS, ReboundScan, updateReboundJournal,
} from '../../services/globalMarket/cryptoReboundScanner';

const METHOD_NAMES: Record<ReboundMethod, string> = {
  confirmed: 'A · Vào sau xác nhận',
  conditional: 'B · Rải có điều kiện',
  limits: 'C · Rải lệnh chờ',
};
const OUTCOME_NAMES: Record<ReboundOutcome, string> = {
  open: 'Đang theo dõi', target: 'Chạm mục tiêu', stop: 'Chạm mức vô hiệu',
  expired: 'Hết hạn', no_entry: 'Không vào',
};
const STAGE_NAMES = ['Thăm dò', 'Xác nhận', 'Kiểm định lại'];
const timeFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});
const formatTime = (time: number) => timeFormat.format(time * 1000);
const formatPrice = (price: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: price >= 100 ? 2 : price >= 1 ? 4 : 8,
}).format(price);
const signedR = (value: number | null) => value === null ? '—' : (value > 0 ? '+' : '') + value.toFixed(2) + ' R';

function ReboundChart({ candles, event }: { candles: Candle[]; event: ReboundEvent }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || !candles.length) return;
    const chart = createChart(container.current, {
      autoSize: true, height: 240,
      layout: { background: { type: ColorType.Solid, color: '#0b1220' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: '#172234' }, horzLines: { color: '#172234' } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#334155',
        tickMarkFormatter: (timestamp: Time) => formatTime(Number(timestamp)) },
      localization: { timeFormatter: (timestamp: Time) => formatTime(Number(timestamp)) },
    });
    const precision = event.setup.stop >= 100 ? 2 : event.setup.stop >= 1 ? 4 : 8;
    const series = chart.addCandlestickSeries({
      upColor: '#2dd4bf', downColor: '#fb7185', borderVisible: false,
      wickUpColor: '#2dd4bf', wickDownColor: '#fb7185',
      priceFormat: { type: 'price', precision, minMove: 10 ** -precision },
    });
    series.setData(candles.map(bar => ({ ...bar, time: bar.time as UTCTimestamp })));
    for (const level of [
      { price: event.setup.target, color: '#34d399', title: 'Mục tiêu' },
      { price: event.setup.upper, color: '#38bdf8', title: 'Vùng hỗ trợ' },
      { price: event.setup.lower, color: '#38bdf8', title: '' },
      { price: event.setup.stop, color: '#fb7185', title: 'Vô hiệu' },
    ]) series.createPriceLine({ ...level, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true });
    const fills = event.runs[12].conditional.fills;
    series.setMarkers(fills.map(fill => ({
      time: fill.time as UTCTimestamp, position: 'belowBar',
      color: '#fbbf24', shape: 'arrowUp', text: 'Đinh ' + (fill.step + 1),
    })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, event]);
  return <div ref={container} className="h-60 w-full min-w-0 overflow-hidden rounded-xl" aria-label="Biểu đồ nến 15 phút và các mốc giá" />;
}

function SetupLevels({ setup }: { setup: ReboundSetup }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
      {[
        ['Vùng hỗ trợ', formatPrice(setup.lower) + ' – ' + formatPrice(setup.upper)],
        ['Mục tiêu hồi', formatPrice(setup.target)],
        ['Mức vô hiệu', formatPrice(setup.stop)],
      ].map(([label, value]) => (
        <div key={label} className="rounded-lg bg-slate-800/60 px-3 py-2">
          <dt className="text-xs text-slate-400">{label}</dt>
          <dd className="mt-1 break-words font-mono font-semibold text-slate-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CryptoReboundModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [scan, setScan] = useState<ReboundScan | null>(null);
  const [journal, setJournal] = useState(readReboundJournal);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<'scan' | 'journal'>('scan');
  const [hours, setHours] = useState<ReboundHours>(12);
  const [group, setGroup] = useState<'majors' | 'alts'>('majors');
  const [selectedId, setSelectedId] = useState<string>();
  const lastAttempt = useRef(0);

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const now = Math.floor(Date.now() / 1000);
    lastAttempt.current = Math.floor(now / REBOUND_BAR) * REBOUND_BAR;
    setLoading(true);
    setFailed(false);
    const timeout = window.setTimeout(() => {
      controller.abort();
      setFailed(true);
      setLoading(false);
    }, 30_000);
    loadReboundScan(controller.signal, now).then(result => {
      if (controller.signal.aborted) return;
      if (!Object.keys(result.charts).length) {
        setFailed(true);
        return;
      }
      setScan(result);
      setJournal(updateReboundJournal(result));
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    }).finally(() => {
      window.clearTimeout(timeout);
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      if (!loading && now >= lastAttempt.current + REBOUND_BAR + 10) setRefresh(value => value + 1);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [loading]);

  const active = (scan?.events ?? []).filter(event => event.runs[12].conditional.outcome === 'open');
  const completed = journal.filter(event => event.runs[12].conditional.outcome !== 'open');
  const list = tab === 'scan' ? active : completed.slice(0, 60);
  const selected = list.find(event => event.setup.id === selectedId) ?? list[0];
  const bars = selected && scan?.charts[selected.setup.symbol]?.filter(bar =>
    bar.time >= selected.setup.start - 4 * 3600 && bar.time < selected.setup.start + 12 * 3600
  );
  const sample = journal.filter(event => {
    const major = event.setup.symbol === 'BTCUSDT' || event.setup.symbol === 'ETHUSDT';
    return major === (group === 'majors');
  });

  return (
    <dialog
      ref={dialog}
      aria-labelledby="rebound-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[92dvh] w-[calc(100%-1rem)] max-w-6xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#0b1220] p-0 text-slate-100 shadow-2xl backdrop:bg-black/75"
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800 bg-[#0b1220] p-4 sm:px-6">
        <div>
          <h2 id="rebound-title" className="flex items-center gap-2 text-lg font-bold sm:text-xl">
            <ArrowUpRight className="h-5 w-5 shrink-0 text-teal-300" /> Bắt sóng hồi Crypto
          </h2>
          <p className="mt-1 text-xs text-slate-400">Binance Spot · Nến 15 phút · Mô phỏng chỉ xem</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" aria-label="Quét lại" title="Quét lại" disabled={loading} onClick={() => setRefresh(value => value + 1)}
            className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800 disabled:opacity-50">
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </button>
          <button type="button" aria-label="Đóng" onClick={onClose} className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {([['scan', 'Bảng quét'], ['journal', 'Kiểm chứng và nhật ký']] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => { setTab(id); setSelectedId(undefined); }}
              className={'rounded-lg border px-3 py-2 text-sm font-semibold ' + (tab === id
                ? 'border-teal-400/50 bg-teal-400/15 text-teal-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800')}>
              {label}
            </button>
          ))}
          <span role="status" className="text-xs text-slate-400 sm:ml-auto">
            {loading ? 'Đang quét nến…' : scan && (REBOUND_PAIRS.length - scan.unavailable.length) + '/' +
              REBOUND_PAIRS.length + ' cặp · Dữ liệu đến ' + formatTime(scan.cutoff) + ' ICT'}
          </span>
        </div>
        {failed && <p role="alert" className="rounded-lg border border-rose-400/30 p-3 text-sm text-rose-200">
          Quét Binance thất bại. {scan ? 'Đang hiển thị dữ liệu lần quét gần nhất.' : 'Hãy thử quét lại.'}
        </p>}
        {!!scan?.unavailable.length && <p className="text-xs text-amber-200">
          Thiếu dữ liệu {scan.unavailable.join(', ')}.
          {scan.unavailable.includes('BTCUSDT') && ' Tạm khóa đinh thăm dò altcoin và bỏ qua các mẫu altcoin của lần quét này trong thống kê.'}
        </p>}

        {tab === 'journal' && (
          <section className="space-y-3 rounded-xl border border-slate-800 p-3 sm:p-4" aria-label="So sánh ba phương án">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="mr-auto font-semibold">Kết quả kiểm chứng</h3>
              <select aria-label="Nhóm coin" value={group}
                onChange={event => setGroup(event.target.value === 'majors' ? 'majors' : 'alts')}
                className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs">
                <option value="majors">BTC và ETH</option>
                <option value="alts">Altcoin</option>
              </select>
              <select aria-label="Thời hạn kiểm chứng" value={hours}
                onChange={event => setHours(event.target.value === '4' ? 4 : 12)}
                className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs">
                <option value="4">4 giờ</option>
                <option value="12">12 giờ</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="text-slate-400">
                  <tr>{['Phương án', 'Đạt mục tiêu / đã vào', 'Vô hiệu', 'Đủ 3 đinh rồi vô hiệu', 'Trung bình / cơ hội'].map(label =>
                    <th key={label} scope="col" className="px-2 py-2 font-medium">{label}</th>)}</tr>
                </thead>
                <tbody>
                  {REBOUND_METHODS.map(method => {
                    const stat = summarizeRebounds(sample, hours, method);
                    return <tr key={method} className="border-t border-slate-800">
                      <th scope="row" className="px-2 py-2 font-medium">{METHOD_NAMES[method]}</th>
                      <td className="px-2 py-2 font-mono">{stat.entered ? stat.targets + '/' + stat.entered : '—'}</td>
                      <td className="px-2 py-2 font-mono">{stat.stops}</td>
                      <td className="px-2 py-2 font-mono">{method === 'confirmed' ? '—' : stat.allFillsStopped}</td>
                      <td className="px-2 py-2 font-mono">{signedR(stat.meanR)} · {stat.count} mẫu</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs leading-5 text-slate-400">
              R là ngân sách lỗ dự kiến của một cơ hội. Tính cả cơ hội không khớp (0 R).
              Phí giả định {REBOUND_FEE * 100}% mỗi chiều, trượt giá {REBOUND_SLIPPAGE * 100}% ở giá thị trường và giá thoát.
              Lệnh chờ mua cần có giá đi xuyên qua mức đặt. Nhật ký được lưu trên trình duyệt.
            </p>
          </section>
        )}

        {!list.length && <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
          {tab === 'scan' ? (loading ? 'Đang tìm kịch bản hồi còn hiệu lực…' : scan
            ? 'Chưa có kịch bản hồi còn hiệu lực.' : 'Chưa có dữ liệu quét.') : 'Chưa có kịch bản đã phân giải.'}
        </p>}

        {!!selected && (
          <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
            <ul className="max-h-52 space-y-2 overflow-y-auto md:max-h-[32rem]" aria-label={tab === 'scan' ? 'Cơ hội đang theo dõi' : 'Nhật ký kịch bản'}>
              {list.map(event => <li key={event.setup.id}>
                <button type="button" aria-pressed={event.setup.id === selected.setup.id}
                  onClick={() => setSelectedId(event.setup.id)}
                  className={'w-full rounded-xl border p-3 text-left ' + (event.setup.id === selected.setup.id
                    ? 'border-teal-400/50 bg-teal-400/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600')}>
                  <span className="block font-mono text-sm font-bold">{event.setup.symbol}</span>
                  <span className="mt-1 block text-xs text-slate-400">{formatTime(event.setup.start)} · {
                    tab === 'scan' && event.stages.confirm ? 'Đã xác nhận' : OUTCOME_NAMES[event.runs[12].conditional.outcome]
                  }</span>
                </button>
              </li>)}
            </ul>
            <section className="min-w-0 space-y-3" aria-label={'Kịch bản ' + selected.setup.symbol}>
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <h3 className="font-mono text-base font-bold">{selected.setup.symbol}</h3>
                <span className="text-xs text-slate-400">
                  Giảm {selected.setup.dropAtr.toFixed(1)} ATR · Khối lượng ×{selected.setup.volumeRatio.toFixed(1)} ·
                  hết hạn {formatTime(selected.setup.start + 12 * 3600)} ICT
                </span>
              </div>
              <SetupLevels setup={selected.setup} />
              {!!bars?.length && <ReboundChart candles={bars} event={selected} />}
              <ol className="grid gap-2 sm:grid-cols-3">
                {REBOUND_STAGES.map((stage, index) => {
                  const run = selected.runs[12].conditional;
                  const fill = run.fills.find(item => item.step === index);
                  const skipped = selected.skipped[stage];
                  const entryOpen = !!scan && scan.cutoff < selected.setup.start + 4 * 3600;
                  const status = fill ? 'Giá mô phỏng ' + formatPrice(fill.price) : skipped === 'btc'
                    ? 'Tạm khóa vì BTC' : skipped === 'reward' ? 'Dư địa hồi dưới 1,5 R'
                    : run.outcome !== 'open' || !entryOpen ? 'Không kích hoạt'
                    : selected.stages[stage] ? 'Chờ dữ liệu giá vào' : 'Chờ tín hiệu';
                  return <li key={stage} className="rounded-lg border border-slate-800 p-3">
                    <span className="text-xs text-slate-400">Đinh {index + 1} · {REBOUND_RISK[index] * 100}% rủi ro</span>
                    <strong className="mt-1 block text-sm">{STAGE_NAMES[index]}</strong>
                    <span className="block text-xs text-teal-200">{status}</span>
                  </li>;
                })}
              </ol>
              {tab === 'journal' && <p className="text-xs text-slate-400">
                Sau {hours} giờ · {REBOUND_METHODS.map((method, index) =>
                  'ABC'[index] + ' ' + OUTCOME_NAMES[selected.runs[hours][method].outcome] +
                  ' (' + signedR(selected.runs[hours][method].netR) + ')').join(' · ')}
              </p>}
            </section>
          </div>
        )}
      </div>
    </dialog>
  );
}
