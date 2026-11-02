import React, { useState } from 'react';
import {
  Check,
  Edit2,
  Plus,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  createNewUserProfile,
  deleteUserProfile,
  LocalUserProfile,
  ProfileAvatarColor,
  switchActiveUserProfile,
  updateUserProfileMetadata,
} from '../../services/storage/userProfileManager';

interface UserProfileMenuProps {
  activeProfile: LocalUserProfile;
  profiles: LocalUserProfile[];
  onProfileSwitched: (profile: LocalUserProfile, allProfiles: LocalUserProfile[]) => void;
  onProfilesUpdated: (allProfiles: LocalUserProfile[], active: LocalUserProfile) => void;
}

const AVATAR_COLOR_MAP: Record<
  ProfileAvatarColor,
  { bg: string; border: string; text: string; dot: string }
> = {
  cyan: {
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-400/50',
    text: 'text-cyan-200',
    dot: 'bg-cyan-400',
  },
  emerald: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-400/50',
    text: 'text-emerald-200',
    dot: 'bg-emerald-400',
  },
  amber: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-400/50',
    text: 'text-amber-200',
    dot: 'bg-amber-400',
  },
  rose: {
    bg: 'bg-rose-500/20',
    border: 'border-rose-400/50',
    text: 'text-rose-200',
    dot: 'bg-rose-400',
  },
  indigo: {
    bg: 'bg-indigo-500/20',
    border: 'border-indigo-400/50',
    text: 'text-indigo-200',
    dot: 'bg-indigo-400',
  },
  purple: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-400/50',
    text: 'text-purple-200',
    dot: 'bg-purple-400',
  },
};

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  activeProfile,
  profiles,
  onProfileSwitched,
  onProfilesUpdated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<ProfileAvatarColor>('emerald');
  const [newPreset, setNewPreset] = useState<'clone_current' | 'vn_spot_pro' | 'gold_crypto_pro'>(
    'clone_current'
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const activeTheme = AVATAR_COLOR_MAP[activeProfile.avatarColor] || AVATAR_COLOR_MAP.cyan;

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const created = createNewUserProfile({
      name: newName.trim(),
      avatarColor: newColor,
      presetType: newPreset,
    });
    const nextList = [...profiles.filter((p) => p.id !== created.id), created];
    setNewName('');
    setIsCreating(false);
    onProfileSwitched(created, nextList);
  };

  const handleSwitch = (profileId: string) => {
    if (profileId === activeProfile.id) {
      setIsOpen(false);
      return;
    }
    const switched = switchActiveUserProfile(profileId);
    if (switched) {
      onProfileSwitched(switched, profiles);
      setIsOpen(false);
    }
  };

  const handleSaveRename = (profileId: string) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    const updatedList = updateUserProfileMetadata({
      profileId,
      name: editingName.trim(),
    });
    const updatedActive =
      updatedList.find((p) => p.id === activeProfile.id) || activeProfile;
    onProfilesUpdated(updatedList, updatedActive);
    setEditingId(null);
  };

  const handleDelete = (profileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (profiles.length <= 1) return;
    const { profiles: nextList, activeProfile: nextActive } = deleteUserProfile(profileId);
    if (nextActive.id !== activeProfile.id) {
      onProfileSwitched(nextActive, nextList);
    } else {
      onProfilesUpdated(nextList, nextActive);
    }
  };

  const enabledIndicatorCount = Object.values(activeProfile.indicatorSettings || {}).filter(
    Boolean
  ).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={`Hồ sơ người dùng đang mở: ${activeProfile.name} (${activeProfile.activeSymbol} • ${activeProfile.timeframe} • ${enabledIndicatorCount} chỉ báo). Nhấp để chuyển đổi hoặc tạo User mới.`}
        className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-bold transition shrink-0 ${activeTheme.bg} ${activeTheme.border} ${activeTheme.text} hover:brightness-110`}
      >
        <User className="w-3.5 h-3.5 shrink-0" />
        <span className="max-w-[76px] sm:max-w-[115px] truncate">{activeProfile.name}</span>
      </button>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0b1220] border border-slate-700/90 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden mt-4 sm:mt-14 flex flex-col max-h-[85dvh]"
          >
            {/* Header */}
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-[#10192b]">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-xs font-extrabold text-white uppercase tracking-wide">
                    Quản Lý User &amp; Không Gian Làm Việc Local
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Tự động lưu mã đang xem, khung giờ, chỉ báo, sao ⭐ &amp; sổ vị thế khi F5
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-3.5 overflow-y-auto space-y-3 text-xs">
              {/* Current Active User Summary Banner */}
              <div className="p-2.5 rounded-xl bg-[#070d18] border border-cyan-500/35 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${activeTheme.dot} animate-pulse`} />
                    <span>Đang sử dụng: {activeProfile.name}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono text-[9.5px] font-bold">
                    Auto-Save F5 Bật
                  </span>
                </div>
                <div className="text-[10.5px] font-mono text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span>
                    Mã đang xem: <strong className="text-white">{activeProfile.activeSymbol}</strong> (
                    {activeProfile.timeframe})
                  </span>
                  <span>
                    Chỉ báo bật: <strong className="text-cyan-300">{enabledIndicatorCount}</strong>
                  </span>
                  <span>
                    Mã gắn ⭐: <strong className="text-amber-300">{activeProfile.favorites.length}</strong>
                  </span>
                  <span>
                    Vị thế giữ:{' '}
                    <strong className="text-emerald-300">
                      {Object.keys(activeProfile.holdings || {}).length}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Saved User Profiles List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    Danh sách Hồ sơ User ({profiles.length})
                  </span>
                  {!isCreating && (
                    <button
                      type="button"
                      onClick={() => setIsCreating(true)}
                      className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-[10.5px] font-bold flex items-center gap-1 transition"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>+ Tạo User Mới</span>
                    </button>
                  )}
                </div>

                {profiles.map((prof) => {
                  const isCurrent = prof.id === activeProfile.id;
                  const theme = AVATAR_COLOR_MAP[prof.avatarColor] || AVATAR_COLOR_MAP.cyan;
                  const indCount = Object.values(prof.indicatorSettings || {}).filter(Boolean).length;
                  const holdCount = Object.keys(prof.holdings || {}).length;

                  return (
                    <div
                      key={prof.id}
                      onClick={() => handleSwitch(prof.id)}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                        isCurrent
                          ? 'bg-[#111e34] border-cyan-400/60 shadow-md'
                          : 'bg-[#090f1c] hover:bg-[#0f182b] border-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.dot}`} />
                          {editingId === prof.id ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 flex-1"
                            >
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="px-2 py-0.5 rounded bg-[#060a12] border border-cyan-400 text-white text-xs font-bold w-full focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(prof.id)}
                                className="p-1 rounded bg-emerald-600 text-white"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-bold text-white truncate text-xs">
                              {prof.name}
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-[9px] font-mono font-bold shrink-0">
                              ĐANG MỞ
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] font-mono text-slate-400 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                          <span>
                            Biểu đồ: <strong className="text-slate-200">{prof.activeSymbol}</strong> (
                            {prof.timeframe})
                          </span>
                          <span>• {indCount} chỉ báo</span>
                          <span>• {prof.favorites.length} mã ⭐</span>
                          {holdCount > 0 && (
                            <span className="text-amber-300">• {holdCount} vị thế giữ</span>
                          )}
                        </div>
                      </div>

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 shrink-0"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(prof.id);
                            setEditingName(prof.name);
                          }}
                          title="Đổi tên User"
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {profiles.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleDelete(prof.id, e)}
                            title="Xóa User này"
                            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Create New User Form */}
              {isCreating && (
                <form
                  onSubmit={handleCreateUser}
                  className="p-3 rounded-xl bg-[#070d18] border border-emerald-500/45 space-y-2.5 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 text-[11px] flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tạo Hồ Sơ User Mới (Lưu Local)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="text-[10px] text-slate-400 hover:text-white"
                    >
                      Hủy
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">
                      Tên hiển thị User (VD: Spot TTCK VN, Vàng &amp; Crypto, Đầu tư dài hạn)
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nhập tên User..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0f1829] border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-emerald-400"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">
                      Bộ thiết đặt khởi tạo (Chỉ báo &amp; Danh mục yêu thích ⭐)
                    </label>
                    <select
                      value={newPreset}
                      onChange={(e) =>
                        setNewPreset(
                          e.target.value as 'clone_current' | 'vn_spot_pro' | 'gold_crypto_pro'
                        )
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0f1829] border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-emerald-400"
                    >
                      <option value="clone_current">
                        Sao chép toàn bộ chỉ báo &amp; danh mục đang xem hiện tại
                      </option>
                      <option value="vn_spot_pro">
                        🇻🇳 Chuyên Spot TTCK Việt Nam (FPT, 1D, EMA20/50, VWAP, VPVR, Trần/Sàn)
                      </option>
                      <option value="gold_crypto_pro">
                        🌍 Chuyên Vàng &amp; Crypto (XAUUSD, 1h, Bollinger, SMC, Max Pain/Liq)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Màu nhận diện</label>
                    <div className="flex items-center gap-2">
                      {(
                        ['emerald', 'cyan', 'amber', 'rose', 'indigo', 'purple'] as ProfileAvatarColor[]
                      ).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                            AVATAR_COLOR_MAP[c].bg
                          } ${
                            newColor === c
                              ? 'border-white scale-110 ring-2 ring-white/30'
                              : AVATAR_COLOR_MAP[c].border
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${AVATAR_COLOR_MAP[c].dot}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition"
                  >
                    Tạo &amp; Chuyển Sang User Này
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
