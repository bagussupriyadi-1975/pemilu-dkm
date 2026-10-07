import React, { useState, useEffect } from 'react';
import {
  Candidate,
  School,
  ElectionPeriod,
  QuickCountStat,
  ElectionMetrics,
  Voter,
} from '../../types';
import { getBoothAccessStatus } from '../../lib/storage';
import {
  Award,
  Users,
  CheckCircle2,
  Clock3,
  Activity,
  MapPin,
  Calendar,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  X,
  Tv,
} from 'lucide-react';

interface WidescreenTvDisplayProps {
  school: School;
  activePeriod: ElectionPeriod | null;
  candidates: Candidate[];
  voters: Voter[];
  stats: QuickCountStat[];
  metrics: ElectionMetrics;
  lastUpdated: Date;
  onClose: () => void;
}

export const WidescreenTvDisplay: React.FC<WidescreenTvDisplayProps> = ({
  school,
  activePeriod,
  candidates,
  voters,
  stats,
  metrics,
  lastUpdated,
  onClose,
}) => {
  const [nowTime, setNowTime] = useState<Date>(new Date());
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(
    Boolean(document.fullscreenElement)
  );
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const toggleBrowserFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore if restricted by iframe permissions
    }
  };

  const handleExit = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
    onClose();
  };

  const boothStatus = getBoothAccessStatus(school, nowTime);
  const diffMs = boothStatus.countdownTarget
    ? Math.max(0, boothStatus.countdownTarget.getTime() - nowTime.getTime())
    : 0;
  const cdDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const cdHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const cdMinutes = Math.floor((diffMs / (1000 * 60)) % 60);
  const cdSeconds = Math.floor((diffMs / 1000) % 60);

  const leadingCandidate = [...stats].sort((a, b) => b.votes_count - a.votes_count)[0];

  // Rincian Partisipasi 3 RT Lingkungan II
  const rtGroups = ['RT.03 Lk.II', 'RT.04 Lk.II', 'RT.05 Lk.II'];
  const rtBreakdown = rtGroups.map((rt) => {
    const rtVoters = voters.filter((v) => v.class_name.toLowerCase() === rt.toLowerCase());
    const rtVoted = rtVoters.filter((v) => v.has_voted).length;
    return {
      rt,
      total: rtVoters.length,
      voted: rtVoted,
      unvoted: rtVoters.length - rtVoted,
      percent: rtVoters.length > 0 ? Math.round((rtVoted / rtVoters.length) * 100) : 0,
    };
  });

  // 4 Jamaah terakhir yang baru saja menggunakan hak suara
  const recentVoters = [...voters]
    .filter((v) => v.has_voted && v.voted_at)
    .sort((a, b) => new Date(b.voted_at!).getTime() - new Date(a.voted_at!).getTime())
    .slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen overflow-hidden bg-slate-950 text-white flex flex-col justify-between select-none">
      {/* Subtle Mosque Ambient Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-15 pointer-events-none"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=1800&auto=format&fit=crop&q=80')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/90 via-slate-950/95 to-slate-950 pointer-events-none" />

      {/* 1. TOP WIDESCREEN HEADER BAR (PRESISI & TIDAK TERPOTONG) */}
      <header className="relative z-10 px-5 py-2.5 bg-emerald-950/85 border-b border-emerald-800/60 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          {school.logo_url && !logoError ? (
            <div className="w-12 h-12 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-lg ring-2 ring-amber-400/50 shrink-0">
              <img
                src={school.logo_url}
                alt={school.name}
                onError={() => setLogoError(true)}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-amber-300 flex items-center justify-center font-black shrink-0">
              <Tv className="w-6 h-6" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold text-emerald-300 tracking-wider uppercase">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className=" whitespace-nowrap">
                LIVE QUICK COUNT &bull; MASA KHIDMAT {activePeriod?.academic_year || '2026 - 2028'}
              </span>
            </div>
            <h1 className="text-base sm:text-lg lg:text-xl font-black tracking-tight text-white leading-tight whitespace-nowrap">
              PEMILIHAN KETUA <span className="text-amber-400">DKM NURUL HIDAYAH</span>
            </h1>
            <p className="text-[10px] sm:text-[11px] text-emerald-200/90 font-medium leading-tight hidden sm:block">
              Dewan Kemakmuran Masjid (DKM) Nurul Hidayah &bull; RT.03, RT.04 &amp; RT.05 Lingkungan II Kel. Kuripan
            </p>
          </div>
        </div>

        {/* Center/Right: Status Bilik, Jam Real-time & Tombol Kontrol Layar */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Status Kunci Bilik */}
          <div
            className={`hidden xl:flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-extrabold uppercase tracking-wider ${
              boothStatus.isOpen
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                : 'bg-amber-500/20 text-amber-200 border-amber-400/40'
            }`}
          >
            {boothStatus.isOpen ? (
              <Unlock className="w-4 h-4 text-emerald-300" />
            ) : (
              <Lock className="w-4 h-4 text-amber-300" />
            )}
            <span>{boothStatus.badgeText}</span>
          </div>

          {/* Jam Digital WIB */}
          <div className="bg-slate-900/90 border border-slate-700/80 px-3.5 py-1.5 rounded-xl text-right">
            <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
              {nowTime.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </div>
            <div className="font-mono text-sm sm:text-base font-black text-amber-400 tabular-nums leading-tight">
              {nowTime.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}{' '}
              WIB
            </div>
          </div>

          {/* Tombol Fullscreen Browser */}
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            title="Layar Penuh Penuh (F11)"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            {isNativeFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Perkecil</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Layar Penuh</span>
              </>
            )}
          </button>

          {/* Tombol Kembali / Tutup Layar TV */}
          <button
            type="button"
            onClick={handleExit}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Tutup Layar TV</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN WIDESCREEN CONTENT AREA (NO SCROLL, FITS EXACTLY IN VIEWPORT) */}
      <main className="relative z-10 flex-1 min-h-0 px-5 py-3.5 grid grid-cols-12 gap-4 overflow-hidden">
        {/* KOLOM KIRI & TENGAH (8 KOLOM): PEROLEHAN SUARA CALON KETUA DKM NURUL HIDAYAH */}
        <div className="col-span-12 lg:col-span-8 flex flex-col min-h-0 gap-3">
          {/* Baris Ringkasan 4 Metrik Utama di Atas Kandidat */}
          <div className="grid grid-cols-4 gap-3 shrink-0">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total DPT Jamaah
                </span>
                <div className="font-mono text-xl sm:text-2xl font-black text-white tabular-nums mt-0.5">
                  {metrics.total_dpt}{' '}
                  <span className="text-xs font-sans font-semibold text-slate-400">Pemilih</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900/90 border border-emerald-800/60 rounded-2xl px-4 py-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Suara Sah Masuk
                </span>
                <div className="font-mono text-xl sm:text-2xl font-black text-emerald-400 tabular-nums mt-0.5">
                  {metrics.total_voted}{' '}
                  <span className="text-xs font-sans font-semibold text-emerald-300/80">Suara</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900/90 border border-amber-800/50 rounded-2xl px-4 py-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                  Belum Memilih
                </span>
                <div className="font-mono text-xl sm:text-2xl font-black text-amber-400 tabular-nums mt-0.5">
                  {metrics.total_unvoted}{' '}
                  <span className="text-xs font-sans font-semibold text-amber-200/80">Jamaah</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Clock3 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-800 to-teal-900 border border-emerald-600/50 rounded-2xl px-4 py-2.5 flex items-center justify-between">
              <div className="w-full">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                    Partisipasi
                  </span>
                  <Activity className="w-4 h-4 text-amber-300" />
                </div>
                <div className="font-mono text-xl sm:text-2xl font-black text-white tabular-nums mt-0.5">
                  {metrics.participation_rate}%
                </div>
                <div className="w-full bg-black/35 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(metrics.participation_rate, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* KARTU CALON KETUA DKM BERJEJER PENUH (FIT HEIGHT TANPA SCROLL) */}
          <div
            className="flex-1 min-h-0 grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${Math.max(stats.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            {stats.map((cand) => {
              const candidateDetail = candidates.find((c) => c.id === cand.candidate_id);
              const isLead =
                leadingCandidate &&
                leadingCandidate.candidate_id === cand.candidate_id &&
                cand.votes_count > 0;

              return (
                <div
                  key={cand.candidate_id}
                  className={`rounded-3xl border-2 flex flex-col justify-between p-4 min-h-0 overflow-hidden transition-all ${
                    isLead
                      ? 'bg-gradient-to-b from-emerald-900/75 via-slate-900/95 to-slate-900 border-amber-400 shadow-[0_0_30px_-5px_rgba(251,191,36,0.25)]'
                      : 'bg-slate-900/90 border-slate-800'
                  }`}
                >
                  {/* Header Nomor Urut & Status Unggul */}
                  <div className="flex items-center justify-between gap-2 shrink-0 mb-2">
                    <div
                      className="px-3.5 py-1 rounded-xl font-mono text-sm sm:text-base font-black text-white shadow-sm"
                      style={{ backgroundColor: cand.color }}
                    >
                      NO. URUT 0{cand.ballot_number}
                    </div>

                    {isLead ? (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wider">
                        <Award className="w-3.5 h-3.5" />
                        <span>TERBANYAK SEMENTARA</span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-400">
                        {candidateDetail?.chairman_class || 'Lingkungan II'}
                      </span>
                    )}
                  </div>

                  {/* Area Foto Kandidat Proporsional & Utuh (Tidak Terpotong) */}
                  <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-950/60 rounded-2xl border border-slate-800/80 p-2 overflow-hidden relative">
                    {candidateDetail?.photo_url ? (
                      <img
                        src={candidateDetail.photo_url}
                        alt={cand.chairman_name}
                        className="max-h-full max-w-full object-contain rounded-xl drop-shadow-md"
                      />
                    ) : (
                      <div className="text-slate-500 text-xs">Foto Calon Ketua</div>
                    )}
                  </div>

                  {/* Nama Calon & Perolehan Suara Jumbo */}
                  <div className="mt-2.5 shrink-0 space-y-2">
                    <div className="text-center">
                      <h2 className="text-sm sm:text-base lg:text-lg font-black text-white leading-snug">
                        {cand.chairman_name}
                      </h2>
                      <p className="text-[11px] font-semibold text-emerald-300">
                        Calon Ketua DKM Nurul Hidayah &bull; {candidateDetail?.chairman_class || 'Lk.II'}
                      </p>
                    </div>

                    {/* Kotak Angka Suara & Persentase */}
                    <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <div>
                          <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400 tabular-nums">
                            {cand.votes_count}
                          </span>
                          <span className="text-xs font-bold text-slate-300 ml-1.5">
                            Suara Sah
                          </span>
                        </div>
                        <div className="font-mono text-xl sm:text-2xl font-black text-white tabular-nums">
                          {cand.percentage}%
                        </div>
                      </div>

                      {/* Progress Bar Perolehan Suara */}
                      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.max(cand.percentage, cand.votes_count > 0 ? 4 : 0)}%`,
                            backgroundColor: cand.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* KOLOM KANAN (4 KOLOM): 1 KOTAK COUNTDOWN OTOMATIS (BUKA -> TUTUP), RINCIAN 3 RT, & SUARA MASUK */}
        <div className="col-span-12 lg:col-span-4 flex flex-col justify-between min-h-0 gap-3">
          {/* Panel 1: Satu Kotak Countdown Tunggal yang Otomatis Beralih dari Pembukaan ke Penutupan */}
          <div
            className={`rounded-2xl p-4 shrink-0 border transition-colors ${
              boothStatus.countdownMode === 'TO_CLOSE'
                ? 'bg-gradient-to-br from-emerald-900/90 via-slate-900 to-slate-900 border-emerald-500/70'
                : 'bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 border-emerald-700/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {boothStatus.countdownMode === 'TO_OPEN'
                    ? 'Hitung Mundur Bilik Suara Dibuka'
                    : boothStatus.countdownMode === 'TO_CLOSE'
                    ? 'Hitung Mundur Bilik Ditutup Kembali'
                    : 'Waktu Pemilihan Selesai'}
                </span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                  boothStatus.isOpen
                    ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                    : 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                }`}
              >
                {boothStatus.isOpen ? 'SEDANG DIBUKA' : 'TERKUNCI'}
              </span>
            </div>

            <div className="text-[11px] text-emerald-200 font-semibold mb-2">
              {boothStatus.countdownMode === 'TO_OPEN'
                ? `Dibuka Otomatis: ${boothStatus.startInfo.dayName}, ${boothStatus.startInfo.dateFull} • Pukul ${boothStatus.startInfo.timeFull}`
                : boothStatus.countdownMode === 'TO_CLOSE'
                ? `Ditutup Otomatis: ${boothStatus.endInfo.dayName}, ${boothStatus.endInfo.dateFull} • Pukul ${boothStatus.endInfo.timeFull}`
                : `Telah Ditutup: ${boothStatus.endInfo.dayName}, ${boothStatus.endInfo.dateFull} • Pukul ${boothStatus.endInfo.timeFull}`}
            </div>

            {boothStatus.countdownTarget && diffMs > 0 ? (
              <div className="grid grid-cols-4 gap-2 my-2">
                <div className="bg-black/45 border border-white/10 rounded-xl py-2 text-center">
                  <div className="font-mono text-xl sm:text-2xl font-black text-amber-400 tabular-nums leading-none">
                    {String(cdDays).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] font-bold uppercase text-emerald-200 mt-1">Hari</div>
                </div>
                <div className="bg-black/45 border border-white/10 rounded-xl py-2 text-center">
                  <div className="font-mono text-xl sm:text-2xl font-black text-white tabular-nums leading-none">
                    {String(cdHours).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] font-bold uppercase text-emerald-200 mt-1">Jam</div>
                </div>
                <div className="bg-black/45 border border-white/10 rounded-xl py-2 text-center">
                  <div className="font-mono text-xl sm:text-2xl font-black text-white tabular-nums leading-none">
                    {String(cdMinutes).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] font-bold uppercase text-emerald-200 mt-1">Menit</div>
                </div>
                <div className="bg-black/45 border border-white/10 rounded-xl py-2 text-center">
                  <div className="font-mono text-xl sm:text-2xl font-black text-emerald-400 tabular-nums leading-none">
                    {String(cdSeconds).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] font-bold uppercase text-emerald-200 mt-1">Detik</div>
                </div>
              </div>
            ) : (
              <div className="my-2 py-2 px-3 rounded-xl bg-black/35 border border-white/10 text-xs font-bold text-center text-amber-300">
                {boothStatus.title}
              </div>
            )}

            <div className="text-[11px] text-slate-300 space-y-1 pt-1.5 border-t border-white/10">
              <div className="flex justify-between">
                <span className="text-slate-400">
                  {boothStatus.countdownMode === 'TO_OPEN'
                    ? 'Setelah dibuka otomatis beralih ke:'
                    : 'Jadwal Jam Pelaksanaan:'}
                </span>
                <span className="font-bold text-amber-300">
                  {boothStatus.countdownMode === 'TO_OPEN'
                    ? `Hitung Mundur Tutup (${boothStatus.endInfo.timeFull})`
                    : `${boothStatus.startInfo.timeFull} s.d. ${boothStatus.endInfo.timeFull}`}
                </span>
              </div>
              <div className="flex items-start gap-1 text-emerald-200">
                <MapPin className="w-3 h-3 shrink-0 text-amber-400 mt-0.5" />
                <span className="leading-snug truncate">{boothStatus.location}</span>
              </div>
            </div>
          </div>

          {/* Panel 2: Partisipasi Per Wilayah RT (RT.03, RT.04, RT.05 Lk.II) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex-1 min-h-0 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Partisipasi Jamaah Per RT (Lingkungan II)</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400">3 Wilayah RT</span>
              </div>

              <div className="space-y-2.5">
                {rtBreakdown.map((item) => (
                  <div
                    key={item.rt}
                    className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/90"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-extrabold text-white">Kelompok Jamaah {item.rt}</span>
                      <span className="font-mono font-black text-amber-400 tabular-nums">
                        {item.voted}/{item.total} Jamaah ({item.percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(item.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Aktivitas Pemilih Terakhir yang Telah Memilih */}
            <div className="mt-3 pt-2.5 border-t border-slate-800">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Kehadiran Jamaah Terakhir di Bilik Suara:
              </div>
              {recentVoters.length === 0 ? (
                <div className="text-xs text-slate-500 italic py-1">
                  Menunggu suara pertama masuk dari Bilik Suara...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {recentVoters.map((rv) => (
                    <div
                      key={rv.id}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px]"
                    >
                      <div className="truncate pr-1">
                        <span className="font-bold text-emerald-300 block truncate">
                          {rv.full_name}
                        </span>
                        <span className="text-[10px] text-slate-400">{rv.class_name}</span>
                      </div>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 3. BOTTOM FOOTER TICKER BAR */}
      <footer className="relative z-10 px-5 py-2 bg-emerald-950/90 border-t border-emerald-800/60 text-xs flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 text-emerald-100">
          <span>
            Ketua DKM Saat Ini: <strong className="text-white">{school.principal_name}</strong>
          </span>
          <span>&bull;</span>
          <span>
            Alamat: <strong className="text-emerald-200">{school.address}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-amber-300">
          <span>1 KODE TOKEN = 1 SUARA SAH (RAHASIA &amp; TERKUNCI OTOMATIS)</span>
          <span>&bull;</span>
          <span>
            Sinkronisasi:{' '}
            {lastUpdated.toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}{' '}
            WIB
          </span>
        </div>
      </footer>
    </div>
  );
};
