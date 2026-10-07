import React, { useState, useEffect } from 'react';
import { Candidate, School, ElectionPeriod, QuickCountStat, ElectionMetrics, Voter } from '../../types';
import { db, realtimeBus, getBoothAccessStatus } from '../../lib/storage';
import {
  Users,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Award,
  Vote,
  ExternalLink,
  Shield,
  Activity,
  Sparkles,
  MapPin,
  Calendar,
  Lock,
  Unlock,
  Tv,
} from 'lucide-react';
import { CandidateDetailModal } from './CandidateDetailModal';
import { WidescreenTvDisplay } from './WidescreenTvDisplay';

interface LiveQuickCountProps {
  school: School;
  activePeriod: ElectionPeriod | null;
  onGoToBilikSuara: () => void;
}

export const LiveQuickCount: React.FC<LiveQuickCountProps> = ({
  school,
  activePeriod,
  onGoToBilikSuara,
}) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [stats, setStats] = useState<QuickCountStat[]>([]);
  const [metrics, setMetrics] = useState<ElectionMetrics>({
    total_dpt: 0,
    total_voted: 0,
    total_unvoted: 0,
    participation_rate: 0,
  });
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [nowTime, setNowTime] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'bar' | 'donut'>('bar');
  const [logoError, setLogoError] = useState(false);
  const [isTvModeOpen, setIsTvModeOpen] = useState(false);

  // Live 1-second ticker for Countdown Menuju Hari Pemilihan
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const boothStatus = getBoothAccessStatus(school, nowTime);
  const diffMs = boothStatus.countdownTarget
    ? Math.max(0, boothStatus.countdownTarget.getTime() - nowTime.getTime())
    : 0;
  const cdDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const cdHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const cdMinutes = Math.floor((diffMs / (1000 * 60)) % 60);
  const cdSeconds = Math.floor((diffMs / 1000) % 60);

  const refreshData = () => {
    if (!activePeriod) return;
    const cands = db.getCandidates(activePeriod.id);
    const vtrs = db.getVoters(activePeriod.id);
    const { candidates: candidateStats, metrics: m } = db.getQuickCountStats(activePeriod.id);
    setCandidates(cands);
    setVoters(vtrs);
    setStats(candidateStats);
    setMetrics(m);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    refreshData();

    const handleUpdate = () => refreshData();
    realtimeBus.addEventListener('vote_casted', handleUpdate);
    realtimeBus.addEventListener('data_reset', handleUpdate);
    realtimeBus.addEventListener('periods_updated', handleUpdate);
    realtimeBus.addEventListener('voters_updated', handleUpdate);
    realtimeBus.addEventListener('candidates_updated', handleUpdate);
    realtimeBus.addEventListener('supabase_synced', handleUpdate);

    return () => {
      realtimeBus.removeEventListener('vote_casted', handleUpdate);
      realtimeBus.removeEventListener('data_reset', handleUpdate);
      realtimeBus.removeEventListener('periods_updated', handleUpdate);
      realtimeBus.removeEventListener('voters_updated', handleUpdate);
      realtimeBus.removeEventListener('candidates_updated', handleUpdate);
      realtimeBus.removeEventListener('supabase_synced', handleUpdate);
    };
  }, [activePeriod]);

  const leadingCandidate = [...stats].sort((a, b) => b.votes_count - a.votes_count)[0];

  // Statistik Per Wilayah RT (RT.03 Lk.II, RT.04 Lk.II, RT.05 Lk.II)
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

  return (
    <div className="space-y-8 pb-12">
      {/* Dynamic Hero Banner Dewan Kemakmuran Masjid (DKM) Nurul Hidayah */}
      <section className="relative overflow-hidden rounded-3xl bg-emerald-950 text-white p-6 sm:p-10 shadow-xl border border-emerald-800">
        {/* Background Gambar Masjid Online / Unsplash Lebih Terang & Merata */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-45 pointer-events-none"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=1800&auto=format&fit=crop&q=85')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/45 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 text-xs font-semibold tracking-wide uppercase backdrop-blur-xs mb-4">
              <Activity className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
              <span>Live Quick Count Jamaah</span>
            </div>

            <h2 className="font-extrabold tracking-tight text-white leading-tight drop-shadow-sm space-y-0.5">
              <span className="block text-sm sm:text-base lg:text-lg font-bold text-emerald-200 uppercase tracking-wider">
                Pemilihan Ketua
              </span>
              <span className="block text-lg sm:text-2xl lg:text-3xl font-black text-white leading-snug">
                Dewan Kemakmuran Masjid (DKM)
              </span>
              <span className="block text-2xl sm:text-3xl lg:text-4xl font-black text-amber-300 leading-tight">
                Nurul Hidayah
              </span>
            </h2>
            <p className="mt-1.5 text-sm sm:text-lg font-bold text-amber-300 drop-shadow-xs">
              Masa Khidmat {activePeriod?.academic_year || '2026 - 2028'}
            </p>
            <p className="mt-3 text-xs sm:text-sm text-emerald-50/95 font-normal max-w-xl leading-relaxed drop-shadow-xs">
              Satu suara Anda menentukan arah kemakmuran rumah Allah. Mari bersama memilih pemimpin
              yang amanah untuk memakmurkan ibadah, mempererat ukhuwah, serta menghadirkan tata
              kelola masjid yang transparan bagi seluruh Jamaah{' '}
              <strong>RT.03, RT.04, dan RT.05 Lingkungan II Kelurahan Kuripan</strong>. Salurkan hak
              pilih Anda menggunakan <strong>Kode Token Unik</strong>—jujur, rahasia, dan penuh
              keberkahan.
            </p>

            {/* Action Row */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={onGoToBilikSuara}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Vote className="w-4 h-4 text-slate-950" />
                <span>Masuk Bilik Suara (Gunakan Token)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTvModeOpen(true)}
                className="px-5 py-3 bg-white/15 hover:bg-white/25 text-white font-extrabold text-sm rounded-xl border border-amber-300/40 backdrop-blur-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Tv className="w-4 h-4 text-amber-300" />
                <span>Layar Lebar TV / Proyektor (Full 1 Layar)</span>
              </button>

              <div className="flex items-center gap-2 text-xs text-emerald-100 px-3 py-2 rounded-lg bg-black/25 backdrop-blur-xs border border-white/15">
                <Clock3 className="w-3.5 h-3.5 text-emerald-300" />
                <span>
                  Pembaruan:{' '}
                  {lastUpdated.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}{' '}
                  WIB
                </span>
              </div>
            </div>
          </div>

          {/* Logo DKM Nurul Hidayah dengan Efek 3D Shadow & Cahaya Hidup */}
          {school.logo_url && !logoError && (
            <div className="relative flex items-center justify-center shrink-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 md:mr-4 group">
              {/* Ambient Backlight Glow agar logo tampak hidup & berdimensi */}
              <div className="absolute inset-2 rounded-full bg-amber-400/30 blur-2xl group-hover:bg-amber-300/40 transition-all duration-500 pointer-events-none" />
              <div className="absolute inset-6 rounded-full bg-white/25 blur-xl pointer-events-none" />
              {/* Lingkaran Halo Lembut */}
              <div className="relative w-full h-full rounded-full bg-radial from-white/95 via-white/80 to-emerald-950/10 p-4 flex items-center justify-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] ring-2 ring-amber-300/40 backdrop-blur-xs transition-transform duration-500 group-hover:scale-105">
                <img
                  src={school.logo_url}
                  alt={school.name}
                  onError={() => setLogoError(true)}
                  className="w-full h-full object-contain filter drop-shadow-[0_14px_18px_rgba(6,78,59,0.55)]"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* COUNTDOWN MENUJU HARI PEMILIHAN & JADWAL PELAKSANAAN LENGKAP */}
      <section className="bg-white rounded-3xl border-2 border-emerald-200/80 shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">
              Jadwal Pelaksanaan &amp; Hitung Mundur Pemilihan Ketua DKM Nurul Hidayah
            </span>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
              boothStatus.isOpen
                ? 'bg-emerald-500/25 text-emerald-100 border-emerald-300/40'
                : 'bg-amber-500/25 text-amber-200 border-amber-300/40'
            }`}
          >
            {boothStatus.isOpen ? (
              <Unlock className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>{boothStatus.badgeText}</span>
          </div>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Detail Hari, Tanggal Lengkap, Jam Buka-Tutup & Tempat */}
          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Hari &amp; Tanggal Dibuka</span>
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {boothStatus.startInfo.dayName}, {boothStatus.startInfo.dateFull}
                </div>
                <div className="text-xs font-bold text-emerald-800 mt-0.5">
                  Mulai Pukul {boothStatus.startInfo.timeFull}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Clock3 className="w-3.5 h-3.5 text-amber-700" />
                  <span>Batas Waktu Penutupan Token</span>
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {boothStatus.endInfo.dayName}, {boothStatus.endInfo.dateFull}
                </div>
                <div className="text-xs font-bold text-amber-900 mt-0.5">
                  Ditutup Pukul {boothStatus.endInfo.timeFull}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-extrabold text-slate-700 uppercase tracking-wider block text-[10px]">
                  Tempat Pelaksanaan Pemilihan
                </span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm block mt-0.5">
                  {boothStatus.location}
                </span>
              </div>
            </div>
          </div>

          {/* Kotak Countdown Real-Time Tunggal (Otomatis Beralih dari Buka -> Tutup) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white p-5 rounded-2xl border border-emerald-800/60 shadow-inner text-center">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300 mb-1">
              {boothStatus.countdownMode === 'TO_OPEN'
                ? 'Hitung Mundur Bilik Suara Dibuka'
                : boothStatus.countdownMode === 'TO_CLOSE'
                ? 'Hitung Mundur Bilik Ditutup Kembali'
                : 'Status Waktu Pelaksanaan'}
            </div>
            <p className="text-[11px] text-emerald-100/90 mb-3">
              {boothStatus.countdownMode === 'TO_OPEN'
                ? `Dibuka Otomatis: ${boothStatus.startInfo.dayName}, ${boothStatus.startInfo.dateFull} • Pukul ${boothStatus.startInfo.timeFull}`
                : boothStatus.countdownMode === 'TO_CLOSE'
                ? `Ditutup Otomatis: ${boothStatus.endInfo.dayName}, ${boothStatus.endInfo.dateFull} • Pukul ${boothStatus.endInfo.timeFull}`
                : `${boothStatus.endInfo.dayName}, ${boothStatus.endInfo.dateFull} • Pukul ${boothStatus.endInfo.timeFull}`}
            </p>

            {boothStatus.countdownTarget && diffMs > 0 ? (
              <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
                <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl py-2.5 px-2">
                  <div className="font-mono text-2xl sm:text-3xl font-black text-amber-400 leading-none">
                    {String(cdDays).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 mt-1">
                    Hari
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl py-2.5 px-2">
                  <div className="font-mono text-2xl sm:text-3xl font-black text-white leading-none">
                    {String(cdHours).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 mt-1">
                    Jam
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl py-2.5 px-2">
                  <div className="font-mono text-2xl sm:text-3xl font-black text-white leading-none">
                    {String(cdMinutes).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 mt-1">
                    Menit
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl py-2.5 px-2">
                  <div className="font-mono text-2xl sm:text-3xl font-black text-emerald-300 leading-none">
                    {String(cdSeconds).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 mt-1">
                    Detik
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-3 px-4 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-amber-300">
                {boothStatus.isOpen
                  ? 'Bilik Suara Sedang Dibuka — Silakan Gunakan Kode Token Anda'
                  : 'Waktu Pemungutan Suara Telah Ditutup / Dikunci Panitia'}
              </div>
            )}

            <div className="mt-2.5 text-[10px] text-emerald-200/80 font-medium">
              {boothStatus.countdownMode === 'TO_OPEN'
                ? `Otomatis berubah menjadi Hitung Mundur Penutupan (${boothStatus.endInfo.timeFull}) saat bilik dibuka`
                : boothStatus.countdownMode === 'TO_CLOSE'
                ? 'Bilik suara otomatis terkunci kembali saat hitung mundur penutupan habis'
                : 'Pemungutan suara telah selesai'}
            </div>
          </div>
        </div>
      </section>

      {/* Metrik Partisipasi DPT Jamaah Cards */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-700" />
              Metrik Partisipasi Jamaah &amp; Warga (Lingkungan II Kel. Kuripan)
            </h3>
            <p className="text-xs text-slate-500">
              Akumulasi Daftar Pemilih Tetap (DPT) dari RT.03, RT.04, dan RT.05 Lingkungan II
            </p>
          </div>
          <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
            Ketua Pengurus Masjid Saat Ini: <strong>{school.principal_name}</strong>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total DPT */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total DPT Jamaah
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                {metrics.total_dpt}
              </span>
              <span className="text-xs text-slate-500 ml-1.5">KK / Jamaah</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Terdaftar di RT.03, RT.04 &amp; RT.05 Lk.II
            </div>
          </div>

          {/* Suara Masuk */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                Suara Masuk
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono">
                {metrics.total_voted}
              </span>
              <span className="text-xs text-emerald-700 ml-1.5 font-medium">Suara Sah</span>
            </div>
            <div className="mt-2 text-[11px] text-emerald-600 font-medium">
              Token telah digunakan di bilik suara
            </div>
          </div>

          {/* Belum Memilih */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                Belum Memilih
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock3 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 font-mono">
                {metrics.total_unvoted}
              </span>
              <span className="text-xs text-amber-700 ml-1.5 font-medium">Jamaah</span>
            </div>
            <div className="mt-2 text-[11px] text-amber-600 font-medium">
              Token aktif siap digunakan
            </div>
          </div>

          {/* Persentase Partisipasi */}
          <div className="bg-gradient-to-br from-emerald-700 to-teal-800 p-5 rounded-2xl text-white shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">
                Tingkat Partisipasi
              </span>
              <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono">
                {metrics.participation_rate}%
              </span>
            </div>
            <div className="mt-2.5 w-full bg-emerald-950/40 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(metrics.participation_rate, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Breakdown Partisipasi 3 RT Lingkungan II Kel. Kuripan */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {rtBreakdown.map((item) => (
            <div
              key={item.rt}
              className="bg-white px-4 py-3.5 rounded-2xl border border-slate-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    Kelompok Jamaah {item.rt}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Hadir: <strong>{item.voted}</strong> dari <strong>{item.total}</strong> Jamaah
                  </div>
                </div>
              </div>
              <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                {item.percent}%
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Visualisasi Quick Count Real-time */}
      <section className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Perolehan Suara Calon Ketua {school.name} (Quick Count)
            </h3>
            <p className="text-xs text-slate-500">
              Rekapitulasi suara langsung dari bilik suara token digital secara real-time
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setIsTvModeOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-extrabold shadow-xs transition-all cursor-pointer"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Buka Mode Layar Lebar TV (Tanpa Scroll)</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('bar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'bar'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Diagram Batang
              </button>
              <button
                onClick={() => setActiveTab('donut')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'donut'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Diagram Lingkaran
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'bar' ? (
          <div className="relative pt-6 pb-2">
            <div className="absolute inset-0 top-6 bottom-48 flex flex-col justify-between pointer-events-none text-[11px] font-mono text-slate-400">
              {[100, 75, 50, 25, 0].map((tick) => (
                <div key={tick} className="flex items-center w-full">
                  <span className="w-9 pr-2 text-right shrink-0">{tick}%</span>
                  <div className="flex-1 border-b border-dashed border-slate-200"></div>
                </div>
              ))}
            </div>

            <div className="relative pl-10 pr-2">
              <div
                className="grid gap-3 sm:gap-6 md:gap-8 items-end"
                style={{
                  gridTemplateColumns: `repeat(${stats.length || 1}, minmax(0, 1fr))`,
                }}
              >
                {stats.map((cand) => {
                  const isLead =
                    leadingCandidate &&
                    leadingCandidate.candidate_id === cand.candidate_id &&
                    cand.votes_count > 0;
                  const candidateDetail = candidates.find((c) => c.id === cand.candidate_id);

                  return (
                    <div key={cand.candidate_id} className="flex flex-col items-center group">
                      <div className="mb-2 text-center flex flex-col items-center min-h-[58px] justify-end">
                        {isLead && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs mb-1 animate-pulse">
                            <Award className="w-3 h-3 text-amber-600" />
                            Unggul Sementara
                          </span>
                        )}
                        <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900">
                          {cand.percentage}%
                        </div>
                        <div className="text-[11px] font-bold font-mono text-slate-500">
                          {cand.votes_count} suara
                        </div>
                      </div>

                      <div className="w-full max-w-[120px] h-64 sm:h-72 bg-slate-100/90 rounded-2xl flex flex-col justify-end p-1.5 border border-slate-200 shadow-inner relative overflow-hidden group-hover:border-slate-300 transition-colors">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-200/30 to-transparent pointer-events-none" />
                        <div
                          className="w-full rounded-xl transition-all duration-700 ease-out relative flex flex-col justify-between items-center py-2 shadow-sm"
                          style={{
                            height: `${Math.max(cand.percentage, cand.votes_count > 0 ? 6 : 3)}%`,
                            backgroundColor: cand.color,
                          }}
                        >
                          <div className="w-8 h-1 rounded-full bg-white/40 mb-auto" />
                          {cand.percentage >= 15 && (
                            <span className="text-[11px] font-black text-white font-mono drop-shadow-xs">
                              {cand.percentage}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 w-full text-center flex flex-col items-center">
                        <div
                          className="inline-flex items-center justify-center px-3 py-1 rounded-xl text-xs font-black text-white shadow-xs mb-2"
                          style={{ backgroundColor: cand.color }}
                        >
                          No. 0{cand.ballot_number}
                        </div>

                        {candidateDetail?.photo_url && (
                          <div
                            className="w-16 aspect-[4/5] rounded-xl overflow-hidden border-2 shadow-xs mb-2 bg-slate-100"
                            style={{ borderColor: cand.color }}
                          >
                            <img
                              src={candidateDetail.photo_url}
                              alt={cand.chairman_name}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                        )}

                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 leading-snug">
                          {cand.chairman_name}
                        </h4>
                        {candidateDetail && (
                          <span className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            {candidateDetail.chairman_class}
                          </span>
                        )}

                        {candidateDetail && (
                          <button
                            type="button"
                            onClick={() => setSelectedCandidate(candidateDetail)}
                            className="mt-2 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Visi &amp; Program</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-4">
            <div className="flex justify-center">
              <div className="relative w-56 h-56 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="16"
                  />
                  {(() => {
                    let cumulativeOffset = 0;
                    const circumference = 2 * Math.PI * 40;
                    return stats.map((cand) => {
                      const strokeDash = (cand.percentage / 100) * circumference;
                      const rotation = (cumulativeOffset / 100) * 360;
                      cumulativeOffset += cand.percentage;

                      return (
                        <circle
                          key={cand.candidate_id}
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke={cand.color}
                          strokeWidth="16"
                          strokeDasharray={`${strokeDash} ${circumference}`}
                          strokeDashoffset={0}
                          transform={`rotate(${rotation} 50 50)`}
                          className="transition-all duration-700"
                        />
                      );
                    });
                  })()}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                    Total Suara
                  </span>
                  <span className="text-3xl font-extrabold font-mono text-slate-900">
                    {metrics.total_voted}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold">Suara Jamaah</span>
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              {stats.map((cand) => {
                const candidateDetail = candidates.find((c) => c.id === cand.candidate_id);
                return (
                  <div
                    key={cand.candidate_id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: cand.color }}
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          No. 0{cand.ballot_number}: {cand.chairman_name}
                        </div>
                        {candidateDetail && (
                          <div className="text-[11px] text-slate-500">
                            Calon Ketua DKM &bull; {candidateDetail.chairman_class}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold font-mono text-slate-900 block">
                        {cand.votes_count} suara
                      </span>
                      <span className="text-xs font-semibold text-emerald-700">
                        {cand.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Profil Calon Ketua DKM (Tunggal) */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-700" />
              Profil Calon Ketua DKM Nurul Hidayah
            </h3>
            <p className="text-xs text-slate-500">
              Kenali profil, visi kemakmuran masjid, dan program kerja masing-masing calon ketua
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {candidates.map((cand) => {
            const stat = stats.find((s) => s.candidate_id === cand.id);
            return (
              <div
                key={cand.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  {/* Frame Foto Kandidat Rasio Kotak Portrait 4:5 Menyatu Penuh dengan Card */}
                  <div className="relative aspect-[4/5] w-full bg-slate-100 border-b border-slate-200 overflow-hidden">
                    <img
                      src={cand.photo_url}
                      alt={cand.chairman_name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-500"
                    />

                    <div className="absolute top-3 left-3 bg-emerald-950/95 text-white px-3 py-1 rounded-xl shadow-md font-mono font-extrabold text-sm flex items-center gap-1.5 border border-emerald-700">
                      <span className="text-emerald-300 text-xs">NO.</span>
                      <span className="text-amber-400 text-base">0{cand.ballot_number}</span>
                    </div>
                  </div>

                  {/* Identitas Calon Ketua DKM di Bawah Foto agar Foto Tidak Tertutup Teks */}
                  <div className="px-5 pt-4 pb-2 border-b border-slate-100 bg-emerald-50/40">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                      Calon Ketua DKM Nurul Hidayah
                    </span>
                    <h4 className="font-extrabold text-lg text-slate-900 leading-snug mt-0.5">
                      {cand.chairman_name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Wilayah {cand.chairman_class}</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3.5">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Visi Kemakmuran Masjid
                      </span>
                      <p className="text-xs text-slate-700 italic font-medium mt-1 line-clamp-3 leading-relaxed">
                        &ldquo;{cand.vision}&rdquo;
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Program Kerja Utama
                      </span>
                      <ul className="mt-1 space-y-1">
                        {cand.programs.slice(0, 2).map((prog, i) => (
                          <li
                            key={i}
                            className="text-xs text-slate-600 flex items-start gap-2 truncate"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="truncate">{prog}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {stat && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Perolehan Sementara:</span>
                        <span className="font-bold font-mono text-slate-900">
                          {stat.votes_count} suara ({stat.percentage}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <button
                    onClick={() => setSelectedCandidate(cand)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Lihat Detail Visi, Misi &amp; Program</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Keamanan & Transparansi Notice */}
      <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-950 flex flex-col sm:flex-row items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
          <Shield className="w-6 h-6" />
        </div>
        <div className="text-center sm:text-left">
          <h4 className="font-bold text-sm">
            Musyawarah &amp; Pemilihan Berbasis Token Jamaah yang Jujur, Amanah, dan Rahasia
          </h4>
          <p className="text-xs text-emerald-800/90 mt-0.5">
            Sistem memisahkan data identitas KTP/KK Jamaah dari tabel suara yang tersimpan di database. Pilihan suara setiap Jamaah RT.03, RT.04, dan RT.05 Lingkungan II Kelurahan Kuripan dijamin kerahasiaannya 100%.
          </p>
        </div>
      </section>

      <CandidateDetailModal
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />

      {isTvModeOpen && (
        <WidescreenTvDisplay
          school={school}
          activePeriod={activePeriod}
          candidates={candidates}
          voters={voters}
          stats={stats}
          metrics={metrics}
          lastUpdated={lastUpdated}
          onClose={() => setIsTvModeOpen(false)}
        />
      )}
    </div>
  );
};
