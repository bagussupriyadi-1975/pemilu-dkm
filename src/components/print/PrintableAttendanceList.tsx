import React, { useState } from 'react';
import { School, ElectionPeriod, Voter, Committee } from '../../types';
import { generateAttendancePdf, PaperSizeOption } from '../../lib/pdfGenerator';
import { formatIndonesianDateTime } from '../../lib/storage';
import {
  Printer,
  ArrowLeft,
  FileText,
  Download,
  Sparkles,
  MapPin,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';

interface PrintableAttendanceListProps {
  school: School;
  activePeriod: ElectionPeriod | null;
  voters: Voter[];
  committees: Committee[];
  onBack: () => void;
}

export const PrintableAttendanceList: React.FC<PrintableAttendanceListProps> = ({
  school,
  activePeriod,
  voters,
  committees,
  onBack,
}) => {
  const [paperSize, setPaperSize] = useState<PaperSizeOption>('A4');
  const [selectedRt, setSelectedRt] = useState<string>('ALL');
  const [showTokenColumn, setShowTokenColumn] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const rtOptions = ['RT.03 Lk.II', 'RT.04 Lk.II', 'RT.05 Lk.II'];

  const activeRtGroups = (selectedRt === 'ALL' ? rtOptions : [selectedRt]).map((rtName) => ({
    rtName,
    voters: voters.filter((v) => v.class_name.toLowerCase() === rtName.toLowerCase()),
  }));

  const cssSizeMap: Record<PaperSizeOption, string> = {
    A4: 'A4 portrait',
    F4: '215mm 330mm',
    LETTER: 'letter portrait',
  };

  const ketuaPanitia = committees.find((c) => c.role === 'Ketua Panitia');
  const startSchedule = formatIndonesianDateTime(school.voting_start_datetime);
  const endSchedule = formatIndonesianDateTime(school.voting_end_datetime);
  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleAction = async (mode: 'PRINT' | 'DOWNLOAD') => {
    setIsProcessing(true);
    setFeedbackMsg(
      mode === 'PRINT'
        ? `Menyiapkan cetak Lembar Absensi / Daftar Hadir (${paperSize})...`
        : `Mengunduh PDF Lembar Absensi / Daftar Hadir (${paperSize})...`
    );

    try {
      const res = await generateAttendancePdf({
        school,
        activePeriod,
        rtGroupsData: activeRtGroups,
        committees,
        paperSize,
        showTokenColumn,
        autoPrint: mode === 'PRINT',
      });

      if (mode === 'PRINT') {
        try {
          window.print();
        } catch {
          // ignore sandbox print restriction
        }
      }

      setFeedbackMsg(
        `Berhasil! Dokumen "${res.fileName}" (${res.pageCount} halaman ${paperSize}) siap dicetak / telah diunduh.`
      );
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch {
      window.print();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-slate-200/80 min-h-screen p-4 sm:p-8 print:p-0 print:bg-white text-slate-900">
      <style>{`
        @media print {
          @page {
            size: ${cssSizeMap[paperSize]};
            margin: 12mm;
          }
          .a4-attendance-sheet {
            page-break-after: always;
            break-after: page;
          }
          .a4-attendance-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>

      {/* Toolbar Pengaturan Cetak Daftar Hadir Per RT (Hidden on Print) */}
      <div className="max-w-5xl mx-auto mb-6 bg-white p-4 sm:p-5 rounded-2xl border border-slate-300 shadow-md print:hidden space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer border border-slate-300"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Panel Data Jamaah</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Wilayah RT */}
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
              <select
                value={selectedRt}
                onChange={(e) => setSelectedRt(e.target.value)}
                className="bg-transparent text-xs font-extrabold text-emerald-950 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua RT (3 Lembar: RT.03, RT.04 &amp; RT.05 Lk.II)</option>
                <option value="RT.03 Lk.II">Khusus RT.03 Lk.II</option>
                <option value="RT.04 Lk.II">Khusus RT.04 Lk.II</option>
                <option value="RT.05 Lk.II">Khusus RT.05 Lk.II</option>
              </select>
            </div>

            {/* Pilihan Ukuran Kertas */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
              <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as PaperSizeOption)}
                className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="A4">Kertas A4 (Default)</option>
                <option value="F4">Kertas F4 / Folio</option>
                <option value="LETTER">Kertas Letter</option>
              </select>
            </div>

            {/* Toggle Tampilkan / Sembunyikan Kolom Token */}
            <button
              type="button"
              onClick={() => setShowTokenColumn(!showTokenColumn)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold cursor-pointer"
            >
              {showTokenColumn ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Kolom Token: Tampil</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Kolom Token: Sembunyi</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleAction('DOWNLOAD')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF ({paperSize})</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleAction('PRINT')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print Daftar Hadir ({paperSize})</span>
            </button>
          </div>
        </div>

        {feedbackMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}
      </div>

      {/* Pratinjau Lembar A4 Per RT */}
      <div className="max-w-5xl mx-auto space-y-8 print:space-y-0">
        {activeRtGroups.map((group) => (
          <div
            key={group.rtName}
            className="a4-attendance-sheet bg-white p-8 sm:p-12 rounded-2xl shadow-2xl print:shadow-none print:p-0 border-2 border-slate-300 print:border-none"
          >
            {/* KOP SURAT RESMI 2 BARIS */}
            <div className="border-b-4 border-double border-slate-900 pb-4 mb-5 flex items-center justify-center gap-5">
              {school.logo_url && (
                <img
                  src={school.logo_url}
                  alt="Logo DKM Nurul Hidayah"
                  className="w-20 h-20 object-contain shrink-0"
                />
              )}
              <div className="text-center">
                <div className="text-[11px] uppercase font-bold tracking-[0.2em] text-emerald-800">
                  PANITIA PEMILIHAN KETUA
                </div>
                <div className="text-sm sm:text-base font-extrabold uppercase text-slate-800 tracking-wider mt-0.5">
                  DEWAN KEMAKMURAN MASJID (DKM)
                </div>
                <h1 className="text-2xl sm:text-3xl font-black uppercase text-emerald-950 tracking-widest mt-0.5 leading-tight">
                  NURUL HIDAYAH
                </h1>
                <p className="text-xs text-slate-700 mt-1 font-medium">
                  {school.address.replace(/\s*\(Lingkungan II.*\)/i, '')}
                </p>
              </div>
            </div>

            {/* Judul Daftar Hadir & Info RT */}
            <div className="text-center mb-5">
              <h2 className="text-base sm:text-lg font-black underline uppercase tracking-wide text-slate-900">
                DAFTAR HADIR &amp; TANDA TERIMA KARTU TOKEN PEMILIHAN KETUA DKM NURUL HIDAYAH
              </h2>
              <p className="text-xs sm:text-sm font-extrabold text-emerald-800 mt-1 uppercase tracking-wider">
                KELOMPOK JAMAAH WILAYAH {group.rtName} &bull; MASA KHIDMAT{' '}
                {activePeriod?.academic_year || '2026 - 2028'}
              </p>
            </div>

            {/* Info Pelaksanaan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Hari / Tanggal Pelaksanaan:</span>{' '}
                <strong className="text-slate-900">
                  {startSchedule.dayName}, {startSchedule.dateFull}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Waktu Pemungutan Suara:</span>{' '}
                <strong className="text-slate-900">
                  {startSchedule.timeFull} s.d. {endSchedule.timeFull}
                </strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500">Tempat Pelaksanaan:</span>{' '}
                <strong className="text-slate-900">
                  {school.voting_location || school.address}
                </strong>
              </div>
            </div>

            {/* Tabel Absensi Jamaah Per RT */}
            <table className="w-full text-xs border-collapse border border-slate-400">
              <thead>
                <tr className="bg-emerald-900 text-white font-bold uppercase text-[11px]">
                  <th className="border border-slate-400 py-2.5 px-2 text-center w-10">No</th>
                  <th className="border border-slate-400 py-2.5 px-3 text-left">
                    Nama Lengkap Jamaah
                  </th>
                  <th className="border border-slate-400 py-2.5 px-3 text-left">
                    NIK / No. KK
                  </th>
                  <th className="border border-slate-400 py-2.5 px-2.5 text-left">
                    RT &amp; Unsur Jamaah
                  </th>
                  {showTokenColumn && (
                    <th className="border border-slate-400 py-2.5 px-2.5 text-center w-24">
                      Kode Token
                    </th>
                  )}
                  <th className="border border-slate-400 py-2.5 px-2.5 text-center w-24">
                    Status
                  </th>
                  <th className="border border-slate-400 py-2.5 px-3 text-left w-52">
                    Tanda Tangan / Paraf Kehadiran
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.voters.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showTokenColumn ? 7 : 6}
                      className="border border-slate-300 py-8 text-center text-slate-400"
                    >
                      Belum ada jamaah terdaftar di wilayah {group.rtName}.
                    </td>
                  </tr>
                ) : (
                  group.voters.map((v, idx) => (
                    <tr
                      key={v.id}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                    >
                      <td className="border border-slate-300 py-2.5 px-2 text-center font-mono font-bold">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 py-2.5 px-3 font-extrabold text-slate-900">
                        {v.full_name}
                      </td>
                      <td className="border border-slate-300 py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        <div>NIK: {v.nisn}</div>
                        {v.no_kk && <div className="text-[10px] text-slate-500">KK: {v.no_kk}</div>}
                      </td>
                      <td className="border border-slate-300 py-2.5 px-2.5 text-[11px]">
                        <div className="font-bold text-emerald-900">{v.class_name}</div>
                        <div className="text-slate-600">{v.unsur || 'Bapak-bapak'}</div>
                      </td>
                      {showTokenColumn && (
                        <td className="border border-slate-300 py-2.5 px-2.5 text-center font-mono font-black text-emerald-900">
                          {v.pin_plain}
                        </td>
                      )}
                      <td className="border border-slate-300 py-2.5 px-2 text-center text-[10px]">
                        {v.has_voted ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Sudah Memilih
                          </span>
                        ) : (
                          <span className="text-slate-400">Hadir / Paraf</span>
                        )}
                      </td>
                      <td className="border border-slate-300 py-3 px-3 font-mono text-[11px] text-slate-500">
                        <div className={idx % 2 === 0 ? 'text-left' : 'text-center pl-8'}>
                          {idx + 1}. ........................
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Kolom Tanda Tangan Meja Registrasi & Ketua Panitia (Tanpa Gambar Stempel) */}
            <div className="mt-8 grid grid-cols-2 gap-8 text-center text-xs break-inside-avoid">
              <div>
                <p className="text-slate-600">Mengetahui,</p>
                <p className="font-bold text-slate-900 mt-0.5">Ketua Panitia Pemilihan,</p>
                <div className="h-20 my-2" />
                <p className="font-bold underline text-slate-900">
                  {ketuaPanitia?.member_name || 'Yodi Purnawan'}
                </p>
                <p className="text-slate-500">Ketua Panitia Pemilihan</p>
              </div>

              <div>
                <p className="text-slate-600">Bandar Lampung, {todayStr}</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  Petugas Registrasi Wilayah {group.rtName},
                </p>
                <div className="h-20 my-2" />
                <p className="font-bold text-slate-900">
                  ( .................................................... )
                </p>
                <p className="text-slate-500">Koordinator / Petugas Bilik Suara</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
