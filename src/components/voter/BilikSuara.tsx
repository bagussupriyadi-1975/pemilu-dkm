import React, { useState, useEffect } from 'react';
import { School, ElectionPeriod, Candidate, Voter } from '../../types';
import { db, getBoothAccessStatus } from '../../lib/storage';
import confetti from 'canvas-confetti';
import {
  Vote,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  LogOut,
  Check,
  RotateCcw,
  Sparkles,
  MapPin,
  Users,
  Lock,
  Unlock,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { CandidateDetailModal } from '../public/CandidateDetailModal';

interface BilikSuaraProps {
  school: School;
  activePeriod: ElectionPeriod | null;
  onExitToPublic: () => void;
}

type VotingStep = 'AUTH' | 'BALLOT' | 'SUCCESS';

export const BilikSuara: React.FC<BilikSuaraProps> = ({
  school,
  activePeriod,
  onExitToPublic,
}) => {
  // Authentication State (Token Only!)
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authWarningCode, setAuthWarningCode] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [nowTime, setNowTime] = useState<Date>(new Date());

  // Live 1-second ticker for schedule lock & countdown
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

  // Authenticated Jamaah State
  const [currentVoter, setCurrentVoter] = useState<Voter | null>(null);

  // Voting State
  const [currentStep, setCurrentStep] = useState<VotingStep>('AUTH');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [detailModalCand, setDetailModalCand] = useState<Candidate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Countdown for auto-logout
  const [countdown, setCountdown] = useState(5);

  const loadBoothData = () => {
    if (activePeriod) {
      setCandidates(db.getCandidates(activePeriod.id));
    }
  };

  useEffect(() => {
    loadBoothData();
  }, [activePeriod]);

  // Handle countdown on success screen
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (currentStep === 'SUCCESS' && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (currentStep === 'SUCCESS' && countdown === 0) {
      handleResetBooth();
    }
    return () => clearTimeout(timer);
  }, [currentStep, countdown]);

  const handleResetBooth = () => {
    setPinInput('');
    setAuthError(null);
    setAuthWarningCode(null);
    setCurrentVoter(null);
    setSelectedCandidate(null);
    setConfirmModalOpen(false);
    setCurrentStep('AUTH');
    setCountdown(5);
    loadBoothData();
  };

  // Verifikasi Token Jamaah (Cukup Gunakan Kode Token Saja)
  const handleAuthenticate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);
    setAuthWarningCode(null);

    const currentBooth = getBoothAccessStatus(school, new Date());
    if (!currentBooth.isOpen) {
      setAuthWarningCode('ERR-BOOTH-LOCKED');
      setAuthError(`${currentBooth.title}. ${currentBooth.reason}`);
      return;
    }

    if (!activePeriod) {
      setAuthWarningCode('ERR-PERIOD-INACTIVE');
      setAuthError('Tidak ada periode pemilihan yang sedang berstatus AKTIF.');
      return;
    }

    const cleanToken = pinInput.trim().toUpperCase();
    if (!cleanToken) {
      setAuthWarningCode('ERR-TOKEN-EMPTY');
      setAuthError('Harap masukkan Kode Token Suara Anda.');
      return;
    }

    setIsVerifying(true);

    setTimeout(() => {
      const voters = db.getVoters(activePeriod.id);
      const voter = voters.find(
        (v) =>
          v.pin_plain.toUpperCase() === cleanToken ||
          v.pin_hash.toUpperCase() === cleanToken
      );

      if (!voter) {
        setAuthWarningCode('ERR-TOKEN-INVALID-404');
        setAuthError(
          `Kode Token "${cleanToken}" tidak terdaftar dalam Daftar Pemilih Tetap (DPT) Jamaah ${school.name}. Silakan periksa kembali kartu token Anda atau hubungi Panitia Bilik Suara.`
        );
        setIsVerifying(false);
        return;
      }

      // Cek apakah sudah memilih (1 Token = 1 Kali Pakai, Tolak Otomatis!)
      if (voter.has_voted) {
        const usedAtFull = voter.voted_at
          ? new Date(voter.voted_at).toLocaleString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }) + ' WIB'
          : 'sebelumnya';

        db.addAuditLog(
          voter.id,
          'Sistem Keamanan Bilik Suara',
          'REJECT_DUPLICATE_TOKEN',
          `PENOLAKAN OTOMATIS TOKEN TERPAKAI: Token ${cleanToken} (${voter.full_name} - ${voter.class_name}) dicoba dimasukkan kembali padahal sudah digunakan pada ${usedAtFull}.`
        );

        setAuthWarningCode('ERR-TOKEN-USED-403 (TOKEN SUDAH TERPAKAI & TERKUNCI)');
        setAuthError(
          `DITOLAK OTOMATIS OLEH SISTEM! Kode Token "${cleanToken}" atas nama Bapak/Ibu/Sdr. ${voter.full_name} (${voter.class_name}) SUDAH PERNAH DIGUNAKAN pada ${usedAtFull}. Setiap Kode Token hanya berlaku 1 (satu) kali dan tidak dapat digunakan ulang!`
        );
        setIsVerifying(false);
        return;
      }

      // Jika basis pemilihan adalah 1 KK 1 Orang ('kk'), cek apakah KK yang sama sudah memilih
      if (school.voting_basis === 'kk' && voter.no_kk && voter.no_kk.length >= 6) {
        const familyVoted = voters.find(
          (v) => v.id !== voter.id && v.no_kk === voter.no_kk && v.has_voted
        );
        if (familyVoted) {
          setAuthWarningCode('ERR-KK-ALREADY-VOTED-403');
          setAuthError(
            `Berdasarkan ketentuan 1 Keluarga 1 Hak Suara (No. KK: ${voter.no_kk}), keluarga ini sudah menggunakan hak suara melalui ${familyVoted.full_name}.`
          );
          setIsVerifying(false);
          return;
        }
      }

      // Berhasil
      setCurrentVoter(voter);
      setCurrentStep('BALLOT');
      setIsVerifying(false);
    }, 300);
  };

  // Buka Modal Konfirmasi Pilihan
  const handleSelectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setConfirmModalOpen(true);
  };

  // Submit Suara Atomik
  const handleConfirmVote = async () => {
    if (!currentVoter || !selectedCandidate || !activePeriod) return;

    setIsSubmitting(true);
    try {
      const res = await db.castVote(
        currentVoter.nisn,
        currentVoter.pin_plain,
        selectedCandidate.id
      );

      if (res.success) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });

        setConfirmModalOpen(false);
        setCurrentStep('SUCCESS');
        setCountdown(5);
      } else {
        setConfirmModalOpen(false);
        setAuthError(res.message);
        setCurrentStep('AUTH');
      }
    } catch {
      setConfirmModalOpen(false);
      setAuthError('Terjadi kesalahan saat mencatat suara. Silakan coba kembali.');
      setCurrentStep('AUTH');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Kiosk Mode Navigation Bar */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 mb-6 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold">
            <Vote className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block leading-tight">
              Bilik Suara Elektronik Jamaah (Cukup Gunakan Kode Token)
            </span>
            <span className="text-[11px] text-slate-500">
              {school.name} &bull; RT.03, RT.04 &amp; RT.05 Lk.II Kel. Kuripan
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentStep === 'BALLOT' && (
            <button
              onClick={handleResetBooth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Batal &amp; Keluar</span>
            </button>
          )}

          {currentStep === 'AUTH' && (
            <button
              onClick={onExitToPublic}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Kembali ke Quick Count
            </button>
          )}
        </div>
      </div>

      {/* STEP 1: OTENTIKASI JAMAAH CUKUP DENGAN TOKEN SAJA */}
      {currentStep === 'AUTH' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden max-w-xl mx-auto">
            {/* Header Otentikasi 3 Baris Rapi */}
            <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 sm:p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center mx-auto mb-3 border border-white/25 shadow-inner">
                {boothStatus.isOpen ? (
                  <KeyRound className="w-8 h-8 text-amber-300" />
                ) : (
                  <Lock className="w-8 h-8 text-amber-300" />
                )}
              </div>
              <div className="space-y-0.5">
                <div className="text-sm sm:text-base font-extrabold tracking-[0.2em] uppercase text-amber-300">
                  BILIK SUARA
                </div>
                <div className="text-sm sm:text-lg font-extrabold tracking-wider uppercase text-emerald-100 whitespace-nowrap">
                  DEWAN KEMAKMURAN MASJID (DKM)
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-widest uppercase text-white">
                  NURUL HIDAYAH
                </h2>
              </div>

              {/* Badge Status Kunci Bilik Token */}
              <div className="mt-3 flex justify-center">
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
                    boothStatus.isOpen
                      ? 'bg-emerald-500/25 text-emerald-100 border-emerald-300/40'
                      : 'bg-rose-500/30 text-amber-200 border-amber-300/50'
                  }`}
                >
                  {boothStatus.isOpen ? (
                    <Unlock className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span>{boothStatus.badgeText}</span>
                </span>
              </div>

              <p className="text-xs sm:text-sm text-emerald-100 max-w-md mx-auto mt-2.5">
                Masukkan <strong>Kode Token Suara</strong> yang tertera pada kartu undangan pemilih Anda.
              </p>
            </div>

            {/* Info Jadwal Buka/Tutup & 1 Kotak Countdown Otomatis (Buka -> Tutup) di Bilik Suara */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 text-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>
                    Dibuka: {boothStatus.startInfo.dayName}, {boothStatus.startInfo.dateFull} ({boothStatus.startInfo.timeFull})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    Ditutup: {boothStatus.endInfo.dayName}, {boothStatus.endInfo.dateFull} ({boothStatus.endInfo.timeFull})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Lokasi: {boothStatus.location}</span>
              </div>

              {/* Satu Kotak Countdown Tunggal (Otomatis Beralih dari Menuju Dibuka -> Menuju Ditutup Kembali) */}
              {boothStatus.countdownTarget && diffMs > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-center text-emerald-900 mb-1.5">
                    {boothStatus.countdownMode === 'TO_OPEN'
                      ? 'Hitung Mundur Menuju Pembukaan Bilik Suara:'
                      : 'Bilik Suara Dibuka — Hitung Mundur Ditutup Kembali:'}
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto text-center">
                    <div className="bg-slate-900 text-white rounded-xl py-2 px-1">
                      <div className="font-mono text-base sm:text-lg font-black text-amber-400 tabular-nums">
                        {String(cdDays).padStart(2, '0')}
                      </div>
                      <div className="text-[9px] uppercase text-slate-300 font-bold">Hari</div>
                    </div>
                    <div className="bg-slate-900 text-white rounded-xl py-2 px-1">
                      <div className="font-mono text-base sm:text-lg font-black text-white tabular-nums">
                        {String(cdHours).padStart(2, '0')}
                      </div>
                      <div className="text-[9px] uppercase text-slate-300 font-bold">Jam</div>
                    </div>
                    <div className="bg-slate-900 text-white rounded-xl py-2 px-1">
                      <div className="font-mono text-base sm:text-lg font-black text-white tabular-nums">
                        {String(cdMinutes).padStart(2, '0')}
                      </div>
                      <div className="text-[9px] uppercase text-slate-300 font-bold">Menit</div>
                    </div>
                    <div className="bg-slate-900 text-white rounded-xl py-2 px-1">
                      <div className="font-mono text-base sm:text-lg font-black text-emerald-400 tabular-nums">
                        {String(cdSeconds).padStart(2, '0')}
                      </div>
                      <div className="text-[9px] uppercase text-slate-300 font-bold">Detik</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Form Input Token atau Layar Terkunci */}
            <form onSubmit={handleAuthenticate} className="p-6 sm:p-8 space-y-5">
              {/* Jika Bilik Token Sedang Terkunci (Belum Waktunya / Ditutup Panitia) */}
              {!boothStatus.isOpen && (
                <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2.5 text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-200/80 text-amber-950 text-[11px] font-black font-mono uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5" />
                    <span>STATUS: BILIK TOKEN TERKUNCI ({boothStatus.code})</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {boothStatus.title}
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {boothStatus.reason}
                  </p>
                </div>
              )}

              {/* Kotak Peringatan Validasi / Penolakan Otomatis Token Terpakai */}
              {authError && (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 text-xs flex items-start gap-3 shadow-sm">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {authWarningCode && (
                      <span className="inline-block px-2 py-0.5 rounded-md bg-rose-600 text-white font-mono font-black text-[10px] tracking-wider uppercase">
                        KODE PERINGATAN: {authWarningCode}
                      </span>
                    )}
                    <span className="font-extrabold block text-rose-900 text-xs sm:text-sm">
                      Peringatan Keamanan Bilik Suara:
                    </span>
                    <span className="block leading-relaxed font-medium">{authError}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2 text-center">
                  Masukkan Kode Token Pemilih (6 Karakter)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-emerald-600">
                    {boothStatus.isOpen ? (
                      <KeyRound className="w-5 h-5" />
                    ) : (
                      <Lock className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={8}
                    disabled={!boothStatus.isOpen}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                    placeholder={
                      boothStatus.isOpen ? 'MASUKKAN KODE TOKEN' : 'BILIK TOKEN TERKUNCI'
                    }
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 font-mono text-2xl font-black tracking-[0.25em] text-center text-slate-900 uppercase transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    required
                    autoFocus={boothStatus.isOpen}
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-2 block text-center">
                  Setiap Kode Token bersifat rahasia dan hanya berlaku untuk 1 kali pemilihan. Token yang sudah digunakan otomatis ditolak oleh sistem.
                </span>
              </div>

              <button
                type="submit"
                disabled={isVerifying || !boothStatus.isOpen}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-extrabold text-sm shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!boothStatus.isOpen ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Bilik Token Sedang Terkunci</span>
                  </>
                ) : isVerifying ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memverifikasi Token Jamaah...</span>
                  </>
                ) : (
                  <>
                    <span>Verifikasi Token &amp; Buka Surat Suara</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STEP 2: BILIK SURAT SUARA DIGITAL */}
      {currentStep === 'BALLOT' && currentVoter && (
        <div className="space-y-6">
          {/* Identity Bar Jamaah */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-emerald-800 font-bold">
                  Token Jamaah Terverifikasi ({currentVoter.pin_plain})
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {currentVoter.full_name} &bull; {currentVoter.class_name}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3 text-emerald-700" />
                    Unsur: <strong>{currentVoter.unsur || 'Bapak-bapak'}</strong>
                  </span>
                  <span>&bull;</span>
                  <span className="font-mono">
                    No. KK: {currentVoter.no_kk || '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Hak Suara Aktif (1 Suara Sah)</span>
            </div>
          </div>

          {/* Surat Suara Header */}
          <div className="text-center py-2 space-y-0.5">
            <div className="text-xs sm:text-sm font-extrabold text-emerald-800 uppercase tracking-widest">
              SURAT SUARA PEMILIHAN KETUA
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              <span className="whitespace-nowrap">DEWAN KEMAKMURAN MASJID (DKM)</span>{' '}
              <span className="whitespace-nowrap text-emerald-900">NURUL HIDAYAH</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl mx-auto">
              Silakan pilih salah satu Calon Ketua DKM Nurul Hidayah dengan mengklik tombol{' '}
              <strong className="text-emerald-700">&ldquo;PILIH CALON&rdquo;</strong>.
            </p>
          </div>

          {/* Grid Calon Ketua Surat Suara */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {candidates.map((cand) => (
              <div
                key={cand.id}
                className="bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-600 shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Nomor Urut Jumbo */}
                  <div className="bg-emerald-950 text-white py-3 text-center border-b border-emerald-900">
                    <span className="text-xs uppercase tracking-widest text-emerald-300 font-bold block">
                      NOMOR URUT
                    </span>
                    <span className="text-3xl font-black font-mono text-white tracking-wider">
                      0{cand.ballot_number}
                    </span>
                  </div>

                  {/* Foto Calon Rasio Kotak Portrait 4:5 Penuh Menyatu dengan Card */}
                  <div className="aspect-[4/5] w-full bg-slate-100 border-b border-slate-200 overflow-hidden relative">
                    <img
                      src={cand.photo_url}
                      alt={cand.chairman_name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />
                  </div>

                  {/* Biodata Calon Ketua Tunggal */}
                  <div className="p-4 space-y-3">
                    <div className="border-b border-slate-100 pb-2.5">
                      <div className="text-[11px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>Calon Ketua DKM &bull; {cand.chairman_class}</span>
                      </div>
                      <h4 className="font-extrabold text-base text-slate-900 leading-snug mt-0.5">
                        {cand.chairman_name}
                      </h4>
                    </div>

                    <div className="text-xs text-slate-600 italic line-clamp-2">
                      &ldquo;{cand.vision}&rdquo;
                    </div>

                    <button
                      type="button"
                      onClick={() => setDetailModalCand(cand)}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline block pt-1 cursor-pointer"
                    >
                      Baca Visi &amp; Program Kerja &rarr;
                    </button>
                  </div>
                </div>

                {/* Tombol Pilih */}
                <div className="p-4 pt-0">
                  <button
                    type="button"
                    onClick={() => handleSelectCandidate(cand)}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Vote className="w-4 h-4" />
                    <span>PILIH CALON 0{cand.ballot_number}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: SUKSES & COUNTDOWN LOGOUT */}
      {currentStep === 'SUCCESS' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 sm:p-12 text-center max-w-lg mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Alhamdulillah, Suara Anda Telah Tercatat!
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Jazakumullahu Khairan Katsiran atas partisipasi Anda dalam Pemilihan Ketua{' '}
            <strong>{school.name}</strong>. Pilihan Anda dicatat secara rahasia dan amanah.
          </p>

          <div className="mt-8 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-600">
            <Clock className="w-4 h-4 text-emerald-600 animate-spin" />
            <span>
              Layar bilik suara otomatis direset dalam{' '}
              <strong className="text-emerald-700 font-mono text-sm">{countdown} detik</strong>
            </span>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleResetBooth}
              className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Selesai (Jamaah Berikutnya)</span>
            </button>
            <button
              onClick={onExitToPublic}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Lihat Live Quick Count
            </button>
          </div>
        </div>
      )}

      {/* Modal Dialog Konfirmasi Pilihan Suara */}
      {confirmModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-amber-500 text-slate-950 p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="w-6 h-6 text-slate-950" />
              </div>
              <h3 className="font-extrabold text-lg">Konfirmasi Pilihan Jamaah</h3>
              <p className="text-xs text-amber-950 font-medium mt-0.5">
                Token Suara hanya berlaku 1 kali dan tidak dapat diubah setelah dikirim!
              </p>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="w-36 aspect-[4/5] rounded-2xl overflow-hidden mx-auto shadow-md border-2 border-slate-300 bg-slate-100">
                <img
                  src={selectedCandidate.photo_url}
                  alt={selectedCandidate.chairman_name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                />
              </div>

              <div>
                <span className="text-xs font-mono font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  CALON KETUA NOMOR URUT 0{selectedCandidate.ballot_number}
                </span>
                <h4 className="font-bold text-base text-slate-900 mt-2">
                  {selectedCandidate.chairman_name}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Wilayah {selectedCandidate.chairman_class}
                </p>
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                Bismillahirrahmanirrahim. Apakah Anda yakin memilih calon ini sebagai Ketua {school.name}?
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setConfirmModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Ubah Pilihan
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmVote}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Ya, Kirimkan Suara</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Detail Modal */}
      <CandidateDetailModal
        candidate={detailModalCand}
        onClose={() => setDetailModalCand(null)}
      />
    </div>
  );
};
