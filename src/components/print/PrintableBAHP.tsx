import React, { useState } from 'react';
import { School, ElectionPeriod, Candidate, QuickCountStat, ElectionMetrics, Committee } from '../../types';
import { generateBahpPdf, PaperSizeOption } from '../../lib/pdfGenerator';
import { Printer, ArrowLeft, FileText, Download, Sparkles } from 'lucide-react';

interface PrintableBAHPProps {
  school: School;
  activePeriod: ElectionPeriod | null;
  candidates: Candidate[];
  stats: QuickCountStat[];
  metrics: ElectionMetrics;
  committees: Committee[];
  onBack: () => void;
}

export const PrintableBAHP: React.FC<PrintableBAHPProps> = ({
  school,
  activePeriod,
  stats,
  metrics,
  committees,
  onBack,
}) => {
  const [paperSize, setPaperSize] = useState<PaperSizeOption>('A4');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const cssSizeMap: Record<PaperSizeOption, string> = {
    A4: 'A4 portrait',
    F4: '215mm 330mm',
    LETTER: 'letter portrait',
  };

  const handleAction = async (mode: 'PRINT' | 'DOWNLOAD') => {
    setIsProcessing(true);
    setFeedbackMsg(
      mode === 'PRINT'
        ? `Menyiapkan cetak dokumen Berita Acara ukuran ${paperSize}...`
        : `Mengunduh PDF Berita Acara Resmi ukuran ${paperSize}...`
    );
    try {
      const res = await generateBahpPdf({
        school,
        activePeriod,
        stats,
        metrics,
        committees,
        paperSize,
        autoPrint: mode === 'PRINT',
      });

      if (mode === 'PRINT') {
        try {
          window.print();
        } catch {
          // ignore sandboxed print block
        }
      }

      setFeedbackMsg(
        `Berhasil! Dokumen Berita Acara "${res.fileName}" (${paperSize}) telah siap dicetak / diunduh.`
      );
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch {
      window.print();
    } finally {
      setIsProcessing(false);
    }
  };

  const winner = [...stats].sort((a, b) => b.votes_count - a.votes_count)[0];
  const ketuaPanitia = committees.find((c) => c.role === 'Ketua Panitia');

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-slate-200/80 min-h-screen p-4 sm:p-8 print:p-0 print:bg-white text-slate-900">
      <style>{`
        @media print {
          @page {
            size: ${cssSizeMap[paperSize]};
            margin: 12mm;
          }
        }
      `}</style>

      {/* Control Bar (Hidden on Print) */}
      <div className="max-w-4xl mx-auto mb-6 bg-white p-4 rounded-2xl border border-slate-300 shadow-md print:hidden space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer border border-slate-300"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Panel Admin</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pilihan Ukuran Kertas Default A4 */}
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
              <span>Print Berita Acara ({paperSize})</span>
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

      {/* Official A4 Document Sheet */}
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-14 rounded-2xl shadow-2xl print:shadow-none print:p-0 border-2 border-slate-300 print:border-none">
        {/* KOP SURAT RESMI 2 BARIS SESUAI PERMINTAAN USER */}
        <div className="border-b-4 border-double border-slate-900 pb-5 mb-6 flex items-center justify-center gap-6">
          {school.logo_url && (
            <img
              src={school.logo_url}
              alt="Logo DKM Nurul Hidayah"
              className="w-24 h-24 object-contain shrink-0 drop-shadow-xs"
            />
          )}
          <div className="text-center">
            <div className="text-[11px] uppercase font-bold tracking-[0.2em] text-emerald-800">
              PANITIA PEMILIHAN KETUA
            </div>
            {/* Baris 1: DEWAN KEMAKMURAN MASJID (DKM) */}
            <div className="text-sm sm:text-lg font-extrabold uppercase text-slate-800 tracking-wider mt-0.5">
              DEWAN KEMAKMURAN MASJID (DKM)
            </div>
            {/* Baris 2: NURUL HIDAYAH (Dibuat Besar & Tegas) */}
            <h1 className="text-2xl sm:text-4xl font-black uppercase text-emerald-950 tracking-widest mt-0.5 leading-tight">
              NURUL HIDAYAH
            </h1>
            <p className="text-xs text-slate-700 mt-1.5 font-medium">
              {school.address.replace(/\s*\(Lingkungan II.*\)/i, '')}
            </p>
          </div>
        </div>

        {/* Document Header */}
        <div className="text-center my-6">
          <h2 className="text-base sm:text-lg font-black underline tracking-wide uppercase text-slate-900">
            BERITA ACARA HASIL PEMILIHAN KETUA DKM NURUL HIDAYAH
          </h2>
          <p className="text-xs font-extrabold text-emerald-800 mt-1 uppercase tracking-wider">
            MASA KHIDMAT {activePeriod?.academic_year || '2026 - 2028'}
          </p>
          <p className="text-xs font-mono font-bold text-slate-600 mt-1">
            Nomor: 005/BAHP-DKM/NH-LK.II/{new Date().getFullYear()}
          </p>
        </div>

        {/* Pembuka Dokumen */}
        <div className="text-xs sm:text-sm text-slate-800 leading-relaxed text-justify space-y-3 mb-6">
          <p>
            Bismillahirrahmanirrahim. Pada hari ini, tanggal <strong>{todayStr}</strong>, bertempat di{' '}
            <strong>Masjid Nurul Hidayah</strong> ({school.address}), telah dilaksanakan pemungutan dan penghitungan suara
            secara elektronik menggunakan sistem Token Suara Digital dalam rangka{' '}
            <strong>
              Pemilihan Ketua Dewan Kemakmuran Masjid (DKM) Nurul Hidayah
            </strong>{' '}
            Masa Khidmat <strong>{activePeriod?.academic_year || '2026 - 2028'}</strong> oleh Jamaah dan Warga{' '}
            <strong>RT.03, RT.04, dan RT.05 Lingkungan II Kelurahan Kuripan</strong> dengan prinsip Musyawarah, Jujur,
            Amanah, Transparan, dan Rahasia.
          </p>
          <p>
            Pelaksanaan pemilihan ini diselenggarakan oleh Panitia Pemilihan berdasarkan Surat Keputusan Nomor:{' '}
            <strong>{ketuaPanitia?.sk_number || '001/SK-PAN/DKM-NH/X/2026'}</strong>.
          </p>
        </div>

        {/* Bagian I: Rekapitulasi Partisipasi Pemilih */}
        <div className="mb-6">
          <h3 className="text-xs sm:text-sm font-bold uppercase text-slate-900 border-b border-slate-300 pb-1 mb-2">
            I. REKAPITULASI PARTISIPASI DAFTAR PEMILIH TETAP (DPT JAMAAH RT.03, RT.04 &amp; RT.05 LK.II)
          </h3>
          <table className="w-full text-xs border border-slate-300">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-medium bg-slate-50 w-2/3">
                  1. Jumlah Jamaah Terdaftar dalam DPT (RT.03, RT.04 &amp; RT.05 Lk.II)
                </td>
                <td className="p-2 font-bold font-mono text-right">{metrics.total_dpt} Jamaah</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-medium bg-slate-50">
                  2. Jumlah Jamaah yang Menggunakan Hak Suara (Suara Sah)
                </td>
                <td className="p-2 font-bold font-mono text-right text-emerald-800">
                  {metrics.total_voted} Suara
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-medium bg-slate-50">
                  3. Jumlah Jamaah yang Berhalangan Hadir / Belum Memilih
                </td>
                <td className="p-2 font-bold font-mono text-right">{metrics.total_unvoted} Jamaah</td>
              </tr>
              <tr className="bg-slate-100 font-bold">
                <td className="p-2">Persentase Tingkat Partisipasi Kehadiran Jamaah</td>
                <td className="p-2 text-right font-mono text-emerald-800">
                  {metrics.participation_rate}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bagian II: Rekapitulasi Perolehan Suara */}
        <div className="mb-6">
          <h3 className="text-xs sm:text-sm font-bold uppercase text-slate-900 border-b border-slate-300 pb-1 mb-2">
            II. PEROLEHAN SUARA CALON KETUA DKM NURUL HIDAYAH
          </h3>
          <table className="w-full text-xs border border-slate-300 text-left">
            <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase">
              <tr>
                <th className="p-2 text-center w-12">No</th>
                <th className="p-2">Nama Calon Ketua DKM</th>
                <th className="p-2 text-right">Jumlah Suara</th>
                <th className="p-2 text-right">Persentase</th>
                <th className="p-2 text-center">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stats.map((cand) => {
                const isElected =
                  winner && cand.candidate_id === winner.candidate_id && cand.votes_count > 0;
                return (
                  <tr
                    key={cand.candidate_id}
                    className={isElected ? 'bg-emerald-50/60 font-semibold' : ''}
                  >
                    <td className="p-2 text-center font-mono font-bold">0{cand.ballot_number}</td>
                    <td className="p-2">
                      <div className="font-bold text-slate-900">{cand.chairman_name}</div>
                    </td>
                    <td className="p-2 text-right font-mono font-bold">{cand.votes_count} suara</td>
                    <td className="p-2 text-right font-mono font-bold">{cand.percentage}%</td>
                    <td className="p-2 text-center">
                      {isElected ? (
                        <span className="px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          TERPILIH
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bagian III: Penetapan Pemenang */}
        {winner && winner.votes_count > 0 && (
          <div className="mb-8 p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs sm:text-sm text-slate-800">
            <h3 className="font-bold text-emerald-950 uppercase mb-1">
              III. PENETAPAN KETUA DEWAN KEMAKMURAN MASJID (DKM) TERPILIH
            </h3>
            <p>
              Berdasarkan hasil penghitungan suara sah di atas, Panitia Pemilihan menetapkan:
            </p>
            <div className="mt-2 font-bold text-slate-900">
              Nomor Urut 0{winner.ballot_number}: {winner.chairman_name}
            </div>
            <p className="mt-1 text-slate-700">
              Sebagai <strong>Ketua Dewan Kemakmuran Masjid (DKM) Nurul Hidayah Terpilih</strong> Masa
              Khidmat {activePeriod?.academic_year || '2026 - 2028'} dengan perolehan sebanyak{' '}
              <strong>
                {winner.votes_count} suara ({winner.percentage}%)
              </strong>
              .
            </p>
          </div>
        )}

        {/* Penutup Dokumen & Tanda Tangan */}
        <div className="text-xs sm:text-sm text-slate-800 leading-relaxed mb-10 text-justify">
          Demikian Berita Acara Hasil Pemilihan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya
          sebagai dasar pengukuhan Pengurus Dewan Kemakmuran Masjid (DKM) Nurul Hidayah Masa Khidmat{' '}
          {activePeriod?.academic_year || '2026 - 2028'} Kelurahan Kuripan, Kecamatan Telukbetung Barat, Kota Bandar Lampung.
        </div>

        {/* Kolom Tanda Tangan Formal (Tanpa Gambar Cap/Stempel agar Dapat Ditandatangani & Dicap Basah) */}
        <div className="grid grid-cols-2 gap-8 text-center text-xs break-inside-avoid">
          <div>
            <p className="text-slate-600">Mengetahui &amp; Mengesahkan,</p>
            <p className="font-bold text-slate-900 mt-0.5">Ketua Panitia Pemilihan,</p>

            {/* Ruang Kosong Bersih untuk Tanda Tangan & Stempel Basah */}
            <div className="h-24 my-2" />

            <p className="font-bold underline text-slate-900">
              {ketuaPanitia?.member_name || 'Yodi Purnawan'}
            </p>
            <p className="text-slate-500">Ketua Panitia Pemilihan</p>
          </div>

          <div>
            <p className="text-slate-600">Ditetapkan di Bandar Lampung, {todayStr}</p>
            <p className="font-bold text-slate-900 mt-0.5">Ketua DKM Nurul Hidayah,</p>

            {/* Ruang Kosong Bersih untuk Tanda Tangan & Stempel Basah */}
            <div className="h-24 my-2" />

            <p className="font-bold underline text-slate-900">{school.principal_name}</p>
            <p className="text-slate-500 font-mono">{school.principal_nip}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
