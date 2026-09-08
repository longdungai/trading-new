import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
      }
      if ('caches' in window) {
        caches.keys().then(names => {
          for (const name of names) caches.delete(name);
        });
      }
    } catch (e) {
      console.warn('Error clearing storage:', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#080b11] text-gray-100 flex items-center justify-center p-4 font-sans select-none">
          <div className="max-w-md w-full bg-[#0f172a] border border-rose-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white font-mono">Đã Xảy Ra Sự Cố Hiển Thị</h2>
              <p className="text-xs text-gray-400 mt-1">
                Có thể do dữ liệu bộ nhớ tạm cũ hoặc sự cố kết nối. Bạn có thể thử tải lại hoặc làm mới toàn bộ bộ nhớ đệm.
              </p>
            </div>

            {this.state.error && (
              <div className="p-2.5 rounded-lg bg-black/50 border border-gray-800 text-left font-mono text-[11px] text-rose-300 max-h-24 overflow-y-auto">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tải Lại Trang</span>
              </button>

              <button
                onClick={this.handleResetAndReload}
                className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa Cache & Khôi Phục</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
