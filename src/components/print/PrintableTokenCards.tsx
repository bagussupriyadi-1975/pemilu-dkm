import React, { useEffect, useState } from 'react';
import { Voter, School, ElectionPeriod } from '../../types';
import { ALL_300_TOKENS } from '../../lib/storage';
import {
  generateTokenCardsPdf,
  PAPER_DIMENSIONS,
  PaperSizeOption,
} from '../../lib/pdfGenerator';
import QRCode from 'qrcode';
import {
  Printer,
  ArrowLeft,
  Scissors,
  ShieldAlert,
  CheckSquare,
  Square,
  Eye,
  FileText,
  Lock,
  CheckCircle2,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';

interface PrintableTokenCardsProps {
  school: School;
  activePeriod: ElectionPeriod | null;
  voters: Voter[];
  onBack: () => void;
}

interface VoterCardData extends Voter {
  qrDataUrl?: string;
}

export const PrintableTokenCards: React.FC<PrintableTokenCardsProps> = ({
  school,
  activePeriod,
  voters,
  onBack,
}) => {
  const [cardsWithQr, setCardsWithQr] = useState<VoterCardData[]>(voters);
  const [paperSize, setPaperSize] = useState<PaperSizeOption>('A4');

  // Mode Sumber Token: Hanya Jamaah Terdaftar (DPT) atau Kuota Nomor Token (misal 90 Token = 10 Lembar A4 / s.d 300 Token)
  const [tokenRangeMode, setTokenRangeMode] = useState<'DPT' | '90' | '180' | '300'>('DPT');

  // Mode Tampilan Lembar A4: 'ALL_SHEETS' (tampilkan semua lembar A4 berurutan) atau 'SINGLE_SHEET' (per 1 lembar A4 dengan navigasi)
  const [viewMode, setViewMode] = useState<'ALL_SHEETS' | 'SINGLE_SHEET'>('ALL_SHEETS');
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);

  // State Conteng (Checkbox) Token yang dipilih untuk dicetak
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set(voters.map((v) => v.id));
  });

  // Filter di daftar conteng token
  const [rtFilter, setRtFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNVOTED' | 'VOTED'>('ALL');
  const [showChecklistPanel, setShowChecklistPanel] = useState<boolean>(false);

  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Bangun daftar kartu sesuai mode kuota (DPT Terdaftar atau Kuota 90/180/300 Token)
  useEffect(() => {
    let sourceList: Voter[] = [];
    if (tokenRangeMode === 'DPT') {
      sourceList = voters;
    } else {
      const limit = Number(tokenRangeMode);
      sourceList = ALL_300_TOKENS.slice(0, limit).map((tokenCode, idx) => {
        const existingVoter = voters.find((v) => v.pin_plain.toUpperCase() === tokenCode);
        if (existingVoter) return existingVoter;
        return {
          id: `kuota-token-${idx + 1}`,
          election_period_id: activePeriod?.id || 'period-2026',
          nisn: `No. Urut Token ${String(idx + 1).padStart(3, '0')}`,
          full_name: `Jamaah Pemilih #${String(idx + 1).padStart(3, '0')}`,
          class_name: 'RT.03 / 04 / 05 Lk.II',
          unsur: 'Jamaah',
          gender: 'L',
          pin_plain: tokenCode,
          pin_hash: tokenCode,
          has_voted: false,
          voted_at: null,
        };
      });
    }

    // Set initial cards immediately so buttons are never blocked
    setCardsWithQr(sourceList);
    setSelectedIds(new Set(sourceList.map((v) => v.id)));
    setCurrentSheetIndex(0);

    let isMounted = true;
    async function attachQrCodes() {
      const updated = await Promise.all(
        sourceList.map(async (v) => {
          try {
            const qrText = `TOKEN_DKM_NH:${v.pin_plain}:${v.full_name}:${v.class_name}`;
            const qrDataUrl = await QRCode.toDataURL(qrText, {
              width: 100,
              margin: 1,
              color: {
                dark: '#064e3b',
                light: '#ffffff',
              },
            });
            return { ...v, qrDataUrl };
          } catch {
            return v;
          }
        })
      );
      if (isMounted) {
        setCardsWithQr(updated);
      }
    }
    attachQrCodes();

    return () => {
      isMounted = false;
    };
  }, [voters, tokenRangeMode, activePeriod]);

  // Daftar jamaah terfilter di panel conteng
  const filteredForChecklist = cardsWithQr.filter((v) => {
    const matchRt = rtFilter === 'ALL' || v.class_name === rtFilter;
    return matchRt;
  });

  // Daftar kartu yang diconteng untuk masuk ke Lembar Pratinjau & Cetak
  const selectedCardsToPrint = cardsWithQr.filter((v) => selectedIds.has(v.id));

  // Bagi kartu terpilih ke dalam Lembar-Lembar Kertas A4 (9 Kartu per 1 Lembar A4)
  const dim = PAPER_DIMENSIONS[paperSize];
  const sheetsOfCards: VoterCardData[][] = [];
  for (let i = 0; i < selectedCardsToPrint.length; i += dim.cardsPerPage) {
    sheetsOfCards.push(selectedCardsToPrint.slice(i, i + dim.cardsPerPage));
  }

  const totalSheets = sheetsOfCards.length;

  // Toggle conteng 1 token
  const toggleSelectVoter = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setCurrentSheetIndex(0);
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredForChecklist.forEach((v) => next.add(v.id));
      return next;
    });
    setCurrentSheetIndex(0);
  };

  const handleSelectOnlyUnvoted = () => {
    const unvotedIds = cardsWithQr.filter((v) => !v.has_voted).map((v) => v.id);
    setSelectedIds(new Set(unvotedIds));
    setCurrentSheetIndex(0);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setCurrentSheetIndex(0);
  };

  // Fungsi Cetak / Download PDF (Semua Lembar A4 sekaligus atau 1 Lembar A4 spesifik)
  const handleExecutePrintOrDownload = async (
    mode: 'PRINT' | 'DOWNLOAD',
    specificSheetIndex?: number
  ) => {
    const targetVoters =
      specificSheetIndex !== undefined
        ? sheetsOfCards[specificSheetIndex] || []
        : selectedCardsToPrint;

    if (targetVoters.length === 0) {
      setFeedbackBanner('Pilih / conteng minimal 1 kartu token terlebih dahulu!');
      setTimeout(() => setFeedbackBanner(null), 4000);
      return;
    }

    setIsProcessingPdf(true);
    setFeedbackBanner(
      mode === 'PRINT'
        ? `Menyiapkan dokumen cetak ${paperSize} (${
            specificSheetIndex !== undefined
              ? `Lembar Ke-${specificSheetIndex + 1}`
              : `${totalSheets} Lembar ${paperSize}`
          })...`
        : `Mengunduh PDF ${paperSize} (${
            specificSheetIndex !== undefined
              ? `Lembar Ke-${specificSheetIndex + 1}`
              : `${totalSheets} Lembar ${paperSize}`
          })...`
    );

    try {
      // 1. Buat & Unduh PDF Resmi Berformat A4 (1 Halaman = 1 Lembar A4)
      const result = await generateTokenCardsPdf({
        school,
        activePeriod,
        voters: targetVoters,
        paperSize,
        autoPrint: mode === 'PRINT',
      });

      // 2. Jika user menekan tombol PRINT, panggil juga dialog cetak browser
      if (mode === 'PRINT') {
        try {
          window.print();
        } catch {
          // ignore sandboxed print block
        }
      }

      setFeedbackBanner(
        mode === 'PRINT'
          ? `Berhasil! File siap cetak "${result.fileName}" (${result.pageCount} Lembar ${paperSize}) telah diunduh otomatis dan siap dicetak.`
          : `Berhasil mengunduh "${result.fileName}" berisi ${result.pageCount} Lembar ${paperSize}!`
      );
      setTimeout(() => setFeedbackBanner(null), 6000);
    } catch (err) {
      console.error(err);
      window.print();
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const uniqueRts = Array.from(new Set(cardsWithQr.map((v) => v.class_name))).sort();
  const sheetsToRender =
    viewMode === 'SINGLE_SHEET'
      ? sheetsOfCards[currentSheetIndex]
        ? [{ cards: sheetsOfCards[currentSheetIndex], sheetNum: currentSheetIndex + 1 }]
        : []
      : sheetsOfCards.map((cards, idx) => ({ cards, sheetNum: idx + 1 }));

  return (
    <div className="bg-slate-200/80 min-h-screen p-3 sm:p-6 print:p-0 print:bg-white text-slate-900 space-y-6">
      <style>{`
        @media print {
          @page {
            size: ${paperSize === 'F4' ? '215mm 330mm' : paperSize === 'LETTER' ? 'letter portrait' : 'A4 portrait'};
            margin: 10mm;
          }
          .a4-sheet-page {
            page-break-after: always;
            break-after: page;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Top Control Toolbar (Hidden on Print) */}
      <div className="max-w-6xl mx-auto bg-white p-4 sm:p-5 rounded-2xl border border-slate-300 shadow-md print:hidden space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold transition-colors cursor-pointer border border-slate-300"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Pratinjau Per Lembar {paperSize} &amp; Cetak Kartu Token — {school.name}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Total <strong>{selectedCardsToPrint.length} Kartu Token</strong> &bull; Terbagi
                menjadi{' '}
                <strong className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {totalSheets} Lembar Kertas {paperSize}
                </strong>{' '}
                ({dim.cardsPerPage} kartu per lembar {paperSize})
              </p>
            </div>
          </div>

          {/* Tombol Utama: Ukuran Kertas, Print Langsung & Download PDF Per Lembar A4 */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pilihan Ukuran Kertas (Default A4) */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
              <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
              <div className="text-left">
                <label className="block text-[9px] font-bold uppercase text-slate-500 leading-none">
                  Ukuran Kertas
                </label>
                <select
                  value={paperSize}
                  onChange={(e) => {
                    setPaperSize(e.target.value as PaperSizeOption);
                    setCurrentSheetIndex(0);
                  }}
                  className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="A4">Kertas A4 (Default - 9 Token/Lembar)</option>
                  <option value="F4">Kertas F4 / Folio (12 Token/Lembar)</option>
                  <option value="LETTER">Kertas Letter (9 Token/Lembar)</option>
                </select>
              </div>
            </div>

            {/* Pilihan Jumlah Kuota Lembar Token (DPT 27 Token / 90 Token = 10 Lembar A4 / 300 Token) */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
              <Layers className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="text-left">
                <label className="block text-[9px] font-bold uppercase text-slate-500 leading-none">
                  Jumlah Kuota Token
                </label>
                <select
                  value={tokenRangeMode}
                  onChange={(e) => setTokenRangeMode(e.target.value as any)}
                  className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="DPT">
                    Sesuai DPT ({voters.length} Token = {Math.ceil(voters.length / dim.cardsPerPage)}{' '}
                    Lembar)
                  </option>
                  <option value="90">90 Token (NH0001–NH0090 = 10 Lembar A4)</option>
                  <option value="180">180 Token (NH0001–NH0180 = 20 Lembar A4)</option>
                  <option value="300">Semua 300 Token (NH0001–NH0300 = 34 Lembar A4)</option>
                </select>
              </div>
            </div>

            {/* Tombol Download PDF Multi-Halaman A4 */}
            <button
              type="button"
              disabled={isProcessingPdf}
              onClick={() => handleExecutePrintOrDownload('DOWNLOAD')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                Download PDF ({totalSheets} Lembar {paperSize})
              </span>
            </button>

            {/* Tombol Print Langsung Semua Lembar A4 */}
            <button
              type="button"
              disabled={isProcessingPdf}
              onClick={() => handleExecutePrintOrDownload('PRINT')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>
                Print Semua ({totalSheets} Lembar {paperSize})
              </span>
            </button>
          </div>
        </div>

        {/* Sub-Toolbar: Navigasi Per Lembar A4 & Tombol Conteng Pilihan Token */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('ALL_SHEETS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'ALL_SHEETS'
                  ? 'bg-emerald-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tampilkan Semua {totalSheets} Lembar {paperSize} Berurutan</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('SINGLE_SHEET')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'SINGLE_SHEET'
                  ? 'bg-emerald-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Lihat Per 1 Lembar {paperSize}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowChecklistPanel(!showChecklistPanel)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                showChecklistPanel
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
              <span>
                {showChecklistPanel
                  ? 'Tutup Daftar Conteng Token'
                  : `Pilih / Conteng Token (${selectedCardsToPrint.length} Terpilih)`}
              </span>
            </button>
          </div>

          {/* Navigasi Halaman jika dalam mode Per 1 Lembar A4 */}
          {totalSheets > 1 && (
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300">
              <button
                type="button"
                disabled={currentSheetIndex === 0}
                onClick={() => {
                  setViewMode('SINGLE_SHEET');
                  setCurrentSheetIndex((p) => Math.max(0, p - 1));
                }}
                className="p-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={currentSheetIndex}
                onChange={(e) => {
                  setViewMode('SINGLE_SHEET');
                  setCurrentSheetIndex(Number(e.target.value));
                }}
                className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer"
              >
                {sheetsOfCards.map((_, idx) => (
                  <option key={idx} value={idx}>
                    Lembar {paperSize} Ke-{idx + 1} dari {totalSheets}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={currentSheetIndex >= totalSheets - 1}
                onClick={() => {
                  setViewMode('SINGLE_SHEET');
                  setCurrentSheetIndex((p) => Math.min(totalSheets - 1, p + 1));
                }}
                className="p-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Notifikasi Status Cetak / Download */}
        {feedbackBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
        )}

        {/* PANEL PILIH / CONTENG TOKEN SEBELUM DICETAK */}
        {showChecklistPanel && (
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-emerald-700" />
                  Filter &amp; Conteng Token:
                </span>

                <select
                  value={rtFilter}
                  onChange={(e) => setRtFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
                >
                  <option value="ALL">Semua Wilayah RT ({cardsWithQr.length})</option>
                  {uniqueRts.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  Conteng Semua ({filteredForChecklist.length})
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold cursor-pointer"
                >
                  Hapus Semua Conteng
                </button>
              </div>
            </div>

            {/* Grid Daftar Conteng Token (Hijau Seragam) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-1">
              {filteredForChecklist.map((voter) => {
                const isChecked = selectedIds.has(voter.id);
                return (
                  <div
                    key={voter.id}
                    onClick={() => toggleSelectVoter(voter.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                      isChecked
                        ? 'bg-emerald-50/90 border-emerald-500 ring-1 ring-emerald-400'
                        : 'bg-white border-slate-200 hover:border-emerald-300 opacity-75'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-black text-xs text-emerald-900">
                          {voter.pin_plain}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                          {voter.class_name}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 truncate mt-0.5">
                        {voter.full_name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Unsur: {voter.unsur || 'Bapak-bapak'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* DAFTAR LEMBAR KERTAS A4 (TAMPIL PER 1 LEMBAR A4 SECARA NYATA) */}
      <div className="max-w-5xl mx-auto space-y-10 print:space-y-0">
        {sheetsToRender.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-500 border border-slate-300">
            Belum ada kartu token yang diconteng. Silakan klik tombol{' '}
            <strong>&ldquo;Pilih / Conteng Token&rdquo;</strong> di atas untuk memilih token yang
            ingin dicetak.
          </div>
        ) : (
          sheetsToRender.map(({ cards, sheetNum }) => (
            <div key={sheetNum} className="space-y-2.5">
              {/* Bar Kontrol Per 1 Lembar A4 (Hanya tampil di layar, tersembunyi saat kertas dicetak) */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-sm print:hidden">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-mono font-black text-xs">
                    LEMBAR {paperSize} #{sheetNum}
                  </span>
                  <span className="text-xs font-bold text-slate-200">
                    Halaman {sheetNum} dari {totalSheets} Lembar {paperSize} ({cards.length} Kartu
                    Token)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessingPdf}
                    onClick={() => handleExecutePrintOrDownload('DOWNLOAD', sheetNum - 1)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Lembar #{sheetNum} (PDF)</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingPdf}
                    onClick={() => handleExecutePrintOrDownload('PRINT', sheetNum - 1)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Lembar #{sheetNum} Saja</span>
                  </button>
                </div>
              </div>

              {/* Fisik 1 Lembar Kertas A4 (Proporsi Kertas A4 210mm x 297mm) */}
              <div className="a4-sheet-page bg-white mx-auto p-6 sm:p-8 rounded-xl shadow-2xl border-2 border-slate-300 flex flex-col justify-between min-h-[280mm]">
                <div>
                  {/* Kop Lembar A4 (2 Baris: DEWAN KEMAKMURAN MASJID (DKM) & NURUL HIDAYAH Besar) */}
                  <div className="border-b-2 border-emerald-900 pb-3 mb-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-left">
                      {school.logo_url && (
                        <img
                          src={school.logo_url}
                          alt="Logo DKM Nurul Hidayah"
                          className="w-12 h-12 object-contain shrink-0 drop-shadow-xs"
                        />
                      )}
                      <div>
                        <div className="text-[10px] sm:text-xs font-extrabold uppercase text-slate-700 tracking-wider">
                          LEMBAR KARTU TOKEN SUARA — DEWAN KEMAKMURAN MASJID (DKM)
                        </div>
                        <h3 className="text-base sm:text-xl font-black uppercase text-emerald-950 tracking-widest leading-tight">
                          NURUL HIDAYAH
                        </h3>
                        <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                          Masa Khidmat {activePeriod?.academic_year || '2026 - 2028'} &bull; Ukuran
                          Kertas: <strong>{paperSize}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 border border-slate-300 text-xs font-black text-slate-800">
                        LEMBAR {sheetNum} / {totalSheets}
                      </span>
                    </div>
                  </div>

                  {/* Grid 3x3 Kartu Token pada Lembar A4 ini (Hijau Seragam, Tanpa Status Aktif/Terkunci) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-4">
                    {cards.map((voter) => (
                      <div
                        key={voter.id}
                        className="border-2 border-dashed border-emerald-500 bg-white print:border-emerald-600 rounded-xl p-3.5 relative flex flex-col justify-between break-inside-avoid"
                      >
                        <div className="absolute -top-2.5 right-3 bg-white px-1.5 text-emerald-700 flex items-center gap-0.5 text-[9px] print:hidden">
                          <Scissors className="w-3 h-3" />
                          <span>potong di sini</span>
                        </div>

                        <div>
                          {/* Header Kartu */}
                          <div className="border-b border-emerald-100 pb-2 mb-2.5 flex items-center gap-2">
                            {school.logo_url && (
                              <img
                                src={school.logo_url}
                                alt={school.name}
                                className="w-8 h-8 object-contain shrink-0"
                              />
                            )}
                            <div className="text-left min-w-0">
                              <div className="text-[7.5px] font-extrabold text-emerald-800 uppercase tracking-wider whitespace-nowrap">
                                DEWAN KEMAKMURAN MASJID (DKM)
                              </div>
                              <div className="text-[11px] font-black text-emerald-950 leading-tight truncate">
                                NURUL HIDAYAH
                              </div>
                              <div className="text-[8px] text-slate-500 truncate">
                                Kartu Token Suara Jamaah
                              </div>
                            </div>
                          </div>

                          {/* Identity & QR Code */}
                          <div className="flex items-center justify-between gap-2 my-1.5">
                            <div className="space-y-1 text-left flex-1 min-w-0">
                              <div>
                                <span className="text-[7.5px] text-slate-400 font-semibold block uppercase">
                                  Nama Lengkap Jamaah
                                </span>
                                <span className="text-xs font-extrabold text-slate-900 block truncate">
                                  {voter.full_name}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <div>
                                  <span className="text-[7.5px] text-slate-400 font-semibold block uppercase">
                                    Wilayah
                                  </span>
                                  <span className="text-[10px] font-bold text-emerald-800 font-mono">
                                    {voter.class_name}
                                  </span>
                                </div>
                                <div className="ml-1">
                                  <span className="text-[7.5px] text-slate-400 font-semibold block uppercase">
                                    Unsur
                                  </span>
                                  <span className="text-[9.5px] font-semibold text-slate-700">
                                    {voter.unsur || 'Bapak-bapak'}
                                  </span>
                                </div>
                              </div>

                              <div>
                                <span className="text-[7.5px] text-slate-400 font-semibold block uppercase">
                                  NIK Identitas
                                </span>
                                <span className="text-[9.5px] font-mono text-slate-600 block truncate">
                                  {voter.nisn}
                                </span>
                              </div>
                            </div>

                            {/* QR Code Container */}
                            <div className="w-14 h-14 shrink-0 bg-slate-50 p-1 rounded-lg border border-slate-200 flex items-center justify-center">
                              {voter.qrDataUrl ? (
                                <img
                                  src={voter.qrDataUrl}
                                  alt={`QR ${voter.pin_plain}`}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="text-[9px] text-slate-400 font-mono">QR</div>
                              )}
                            </div>
                          </div>

                          {/* Big PIN Highlight */}
                          <div className="bg-emerald-950 text-white rounded-lg p-2 text-center my-2">
                            <span className="text-[7.5px] uppercase tracking-widest text-emerald-300 font-bold block">
                              KODE TOKEN BILIK SUARA
                            </span>
                            <span className="text-lg font-black font-mono tracking-widest text-amber-400">
                              {voter.pin_plain}
                            </span>
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="text-[8px] text-slate-500 border-t border-slate-100 pt-1 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <ShieldAlert className="w-2.5 h-2.5 text-emerald-700" />
                            <span>Cukup Ketik Kode Token</span>
                          </span>
                          <span className="font-mono font-semibold">1 Token = 1 Suara</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Lembar A4 */}
                <div className="mt-6 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>{school.name} — Kel. Kuripan, Kec. Telukbetung Barat</span>
                  <span>
                    Lembar Kertas {paperSize} &bull; Halaman {sheetNum} dari {totalSheets}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
