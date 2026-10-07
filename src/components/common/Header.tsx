import React, { useState, useEffect, useRef } from 'react';
import { School, ElectionPeriod, UserRole, AuthUser, PanitiaTab, AdminTab } from '../../types';
import {
  Vote,
  BarChart3,
  Users,
  ShieldCheck,
  Clock,
  RotateCcw,
  LogIn,
  LogOut,
  KeyRound,
  User,
  ChevronDown,
  MapPin,
} from 'lucide-react';
import { db } from '../../lib/storage';

interface HeaderProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  school: School;
  activePeriod: ElectionPeriod | null;
  authUser: AuthUser | null;
  onOpenLogin: (targetRole?: 'panitia' | 'admin') => void;
  onLogout: () => void;
  panitiaTab: PanitiaTab;
  onSelectPanitiaTab: (tab: PanitiaTab) => void;
  adminTab: AdminTab;
  onSelectAdminTab: (tab: AdminTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onSelectRole,
  school,
  activePeriod,
  authUser,
  onOpenLogin,
  onLogout,
  onSelectPanitiaTab,
  onSelectAdminTab,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogoError(false);
  }, [school.logo_url]);

  useEffect(() => {
    if (!userDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserDropdownOpen(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userDropdownOpen]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleResetData = () => {
    db.resetToDefault();
    setConfirmReset(false);
    window.location.reload();
  };

  const isTakmir = school.type === 'TAKMIR' || school.type === 'OSIM';
  const orgTitle = `PEMILIHAN KETUA ${school.name.toUpperCase()}`;
  const orgBadge = isTakmir ? 'TAKMIR' : 'DKM';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Banner Bar */}
      <div className="bg-emerald-950 text-emerald-100 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Bilik Suara Jamaah Aktif
          </span>
          <span className="hidden sm:inline text-emerald-700">|</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-200">
            <MapPin className="w-3 h-3 text-emerald-400" />
            <span>RT.03, RT.04 &amp; RT.05 Lk.II Kel. Kuripan, Telukbetung Barat</span>
          </span>
          <span className="hidden md:inline text-emerald-700">|</span>
          <span className="hidden md:inline text-emerald-200 font-medium">
            Ketua DKM: {school.principal_name}
          </span>
          {authUser && (
            <>
              <span className="hidden lg:inline text-emerald-700">|</span>
              <span className="hidden lg:inline text-amber-300 font-semibold">
                Sesi Aktif: {authUser.role === 'admin' ? 'Admin Utama' : 'Panitia Pemilihan'} (
                {authUser.name})
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-emerald-200">
          <div className="flex items-center gap-1.5 text-[11px] bg-emerald-900/80 px-2.5 py-0.5 rounded-full border border-emerald-700/60">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                db.isSupabaseConnected() ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span
              className={
                db.isSupabaseConnected()
                  ? 'text-emerald-300 font-semibold'
                  : 'text-emerald-200 font-normal'
              }
            >
              {db.isSupabaseConnected() ? 'Supabase Cloud Aktif' : 'Mode Penyimpanan Lokal'}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{timeStr}</span>
          </div>
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              title="Muat Ulang Data Awal Masjid Nurul Hidayah"
              className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset Data Awal</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded-lg">
              <span className="text-[10px] text-amber-200 font-bold">Reset ke Data Awal?</span>
              <button
                onClick={handleResetData}
                className="text-[10px] bg-amber-400 text-slate-950 font-extrabold px-1.5 py-0.5 rounded cursor-pointer"
              >
                Ya
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="text-[10px] text-emerald-200 hover:text-white px-1 cursor-pointer"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Nav & Identity */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-3 gap-3">
          {/* Masjid Branding with Official Logo */}
          <div className="flex items-center gap-3.5">
            {school.logo_url && !logoError ? (
              <div className="w-12 h-12 rounded-xl bg-white border border-emerald-200 p-1 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
                <img
                  src={school.logo_url}
                  alt={school.name}
                  onError={() => setLogoError(true)}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-emerald-100 shrink-0">
                <Vote className="w-6 h-6" />
              </div>
            )}

            <div className="min-w-0">
              <h1 className="font-black text-sm sm:text-base lg:text-lg text-slate-900 tracking-tight leading-tight">
                <span className="xl:hidden">PEMILIHAN KETUA DKM </span>
                <span className="hidden xl:inline">
                  PEMILIHAN KETUA DEWAN KEMAKMURAN MASJID (DKM){' '}
                </span>
                <span className="text-emerald-800">NURUL HIDAYAH</span>
              </h1>
              <p className="text-xs text-slate-600 font-medium truncate max-w-xs sm:max-w-lg">
                <span className="xl:hidden font-semibold text-emerald-800">
                  Dewan Kemakmuran Masjid (DKM) &bull;{' '}
                </span>
                {school.address}
              </p>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex items-center gap-2 flex-wrap sm:flex-nowrap relative overflow-visible">
            {/* PUBLIC NAVIGATION (When NOT Logged In) */}
            {!authUser && (
              <>
                <button
                  onClick={() => onSelectRole('public')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    currentRole === 'public'
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Live Quick Count</span>
                </button>

                <button
                  onClick={() => onSelectRole('siswa')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    currentRole === 'siswa'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <Vote className="w-4 h-4" />
                  <span>Bilik Suara Jamaah (Token)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                </button>

                {/* Gated Portal Panitia Button (Wajib Login) */}
                <button
                  onClick={() => onOpenLogin('panitia')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-emerald-800 hover:bg-emerald-900 text-white shadow-sm transition-all cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Portal Panitia</span>
                </button>

                {/* Gated Portal Admin Button (Wajib Login) */}
                <button
                  onClick={() => onOpenLogin('admin')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-400" />
                  <span>Portal Admin DKM</span>
                </button>
              </>
            )}

            {/* PANITIA NAVIGATION */}
            {authUser?.role === 'panitia' && (
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap relative">
                <button
                  onClick={() => onSelectRole('panitia')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    currentRole === 'panitia'
                      ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-200'
                      : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Portal Panitia &amp; DPT</span>
                </button>

                <button
                  onClick={() => onSelectRole('admin')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    currentRole === 'admin'
                      ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-300'
                      : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span>Portal Admin DKM</span>
                </button>

                <button
                  onClick={() => onSelectRole('siswa')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    currentRole === 'siswa'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Vote className="w-4 h-4" />
                  <span className="hidden sm:inline">Bilik Suara</span>
                </button>

                <button
                  onClick={() => onSelectRole('public')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    currentRole === 'public'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Quick Count</span>
                </button>

                <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setUserDropdownOpen((prev) => !prev);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-950"
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-slate-900 truncate max-w-[120px] leading-tight">
                        {authUser.name}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-medium leading-tight">
                        Panitia Pemilihan
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
                  </button>

                  {userDropdownOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 z-[100] text-xs"
                    >
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <p className="font-bold text-slate-900 truncate">{authUser.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">
                          {authUser.email}
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          Panitia Pemilihan DKM
                        </span>
                      </div>

                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            onSelectPanitiaTab('password');
                            onSelectRole('panitia');
                          }}
                          className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <KeyRound className="w-4 h-4 text-slate-400" />
                          <span>Ganti Kata Sandi</span>
                        </button>
                      </div>

                      <div className="border-t border-slate-100 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            onLogout();
                          }}
                          className="w-full px-4 py-2.5 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer font-bold"
                        >
                          <LogOut className="w-4 h-4 text-rose-600" />
                          <span>Keluar (Log-Out)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onLogout();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            )}

            {/* ADMIN NAVIGATION */}
            {authUser?.role === 'admin' && (
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap relative">
                <button
                  onClick={() => onSelectRole('admin')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    currentRole === 'admin'
                      ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-300'
                      : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Portal Admin DKM</span>
                </button>

                <button
                  onClick={() => onSelectRole('panitia')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    currentRole === 'panitia'
                      ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-200'
                      : 'text-slate-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <Users className="w-4 h-4 text-emerald-700" />
                  <span>Portal Panitia</span>
                </button>

                <button
                  onClick={() => onSelectRole('siswa')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    currentRole === 'siswa'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Vote className="w-4 h-4" />
                  <span className="hidden sm:inline">Bilik Suara</span>
                </button>

                <button
                  onClick={() => onSelectRole('public')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    currentRole === 'public'
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Quick Count</span>
                </button>

                <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setUserDropdownOpen((prev) => !prev);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900"
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-slate-800 truncate max-w-[120px] leading-tight">
                        {authUser.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium leading-tight">
                        Admin Utama DKM
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  </button>

                  {userDropdownOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 z-[100] text-xs"
                    >
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <p className="font-bold text-slate-900 truncate">{authUser.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">
                          {authUser.email}
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Admin Utama Masjid Nurul Hidayah
                        </span>
                      </div>

                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            onSelectAdminTab('password');
                            onSelectRole('admin');
                          }}
                          className="w-full px-4 py-2.5 text-left text-slate-700 hover:bg-slate-100 hover:text-slate-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <KeyRound className="w-4 h-4 text-slate-400" />
                          <span>Ganti Kata Sandi</span>
                        </button>
                      </div>

                      <div className="border-t border-slate-100 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            onLogout();
                          }}
                          className="w-full px-4 py-2.5 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer font-bold"
                        >
                          <LogOut className="w-4 h-4 text-rose-600" />
                          <span>Keluar (Log-Out)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onLogout();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
