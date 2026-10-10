import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { School, ElectionPeriod, Voter, QuickCountStat, ElectionMetrics, Committee } from '../types';

export type PaperSizeOption = 'A4' | 'F4' | 'LETTER';

interface PaperDimensions {
  widthMm: number;
  heightMm: number;
  cardsPerRow: number;
  rowsPerPage: number;
  cardsPerPage: number;
}

export const PAPER_DIMENSIONS: Record<PaperSizeOption, PaperDimensions> = {
  A4: {
    widthMm: 210,
    heightMm: 297,
    cardsPerRow: 3,
    rowsPerPage: 3,
    cardsPerPage: 9,
  },
  F4: {
    widthMm: 215,
    heightMm: 330,
    cardsPerRow: 3,
    rowsPerPage: 4,
    cardsPerPage: 12,
  },
  LETTER: {
    widthMm: 216,
    heightMm: 279,
    cardsPerRow: 3,
    rowsPerPage: 3,
    cardsPerPage: 9,
  },
};

/**
 * Helper membagi array menjadi potongan per halaman
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Helper memuat gambar URL menjadi Base64 Data URL agar dapat dirender di dalam PDF A4
 */
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Generate PDF Multi-Halaman untuk Kartu Token Suara (1 Halaman PDF = 1 Lembar A4 Penuh)
 */
export async function generateTokenCardsPdf(params: {
  school: School;
  activePeriod: ElectionPeriod | null;
  voters: Array<Voter & { qrDataUrl?: string }>;
  paperSize: PaperSizeOption;
  autoPrint?: boolean;
}): Promise<{ blobUrl: string; fileName: string; pageCount: number }> {
  const { school, activePeriod, voters, paperSize, autoPrint = false } = params;
  const dim = PAPER_DIMENSIONS[paperSize];

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [dim.widthMm, dim.heightMm],
  });

  const logoDataUrl = await loadImageAsDataUrl(school.logo_url || '');
  const periodYear = activePeriod?.academic_year || '2026 - 2028';

  // Bagi daftar token menjadi per lembar A4 (masing-masing 9 kartu untuk A4, 12 kartu untuk F4)
  const pages: Array<Array<Voter & { qrDataUrl?: string }>> = [];
  for (let i = 0; i < voters.length; i += dim.cardsPerPage) {
    pages.push(voters.slice(i, i + dim.cardsPerPage));
  }
  if (pages.length === 0) {
    pages.push([]);
  }

  const marginX = 10;
  const marginY = 10;
  const headerHeight = 16;
  const footerHeight = 8;
  const usableWidth = dim.widthMm - marginX * 2;
  const usableHeight = dim.heightMm - marginY * 2 - headerHeight - footerHeight;

  const gapX = 4;
  const gapY = 4;
  const cardW = (usableWidth - gapX * (dim.cardsPerRow - 1)) / dim.cardsPerRow;
  const cardH = (usableHeight - gapY * (dim.rowsPerPage - 1)) / dim.rowsPerPage;

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage([dim.widthMm, dim.heightMm], 'portrait');
    }

    const pageCards = pages[pageIdx];

    // 1. KOP LEMBAR A4 (2 BARIS: DEWAN KEMAKMURAN MASJID (DKM) & NURUL HIDAYAH BESAR)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      'LEMBAR KARTU TOKEN SUARA — DEWAN KEMAKMURAN MASJID (DKM)',
      dim.widthMm / 2,
      marginY + 3.5,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(6, 78, 59);
    doc.text('NURUL HIDAYAH', dim.widthMm / 2, marginY + 8.8, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Masa Khidmat ${periodYear}  |  Ukuran Kertas: ${paperSize}  |  Lembar Ke-${pageIdx + 1} dari ${
        pages.length
      } (${pageCards.length} Kartu Token)`,
      dim.widthMm / 2,
      marginY + 13,
      { align: 'center' }
    );

    doc.setDrawColor(6, 78, 59);
    doc.setLineWidth(0.5);
    doc.line(marginX, marginY + 15, dim.widthMm - marginX, marginY + 15);

    // 2. GRID KARTU TOKEN PADA LEMBAR A4 INI
    for (let i = 0; i < pageCards.length; i++) {
      const voter = pageCards[i];
      const col = i % dim.cardsPerRow;
      const row = Math.floor(i / dim.cardsPerRow);

      const x = marginX + col * (cardW + gapX);
      const y = marginY + headerHeight + row * (cardH + gapY);

      // Card Border (Hijau Emerald Seragam untuk Semua Kartu Token yang Dibagikan)
      doc.setDrawColor(16, 185, 129);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.4);
      doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD');

      // Card Header (2 Baris: DEWAN KEMAKMURAN MASJID (DKM) & NURUL HIDAYAH)
      let textStartX = x + 3;
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'PNG', x + 2.5, y + 2.5, 8.5, 8.5);
          textStartX = x + 12.2;
        } catch {
          // ignore logo error
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(6, 95, 70);
      doc.text('DEWAN KEMAKMURAN MASJID (DKM)', textStartX, y + 5.2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(6, 78, 59);
      doc.text('NURUL HIDAYAH', textStartX, y + 9);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(100, 116, 139);
      doc.text('Kartu Undangan & Token Suara Jamaah', textStartX, y + 11.8);

      doc.setDrawColor(209, 250, 229);
      doc.setLineWidth(0.25);
      doc.line(x + 2.5, y + 13.8, x + cardW - 2.5, y + 13.8);

      // Voter Identity Details (Left) & QR Code (Right) — Tanpa Status Aktif/Terkunci
      const bodyY = y + 18;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text('NAMA LENGKAP JAMAAH', x + 3, bodyY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const cleanName =
        voter.full_name.length > 20 ? voter.full_name.slice(0, 19) + '...' : voter.full_name;
      doc.text(cleanName, x + 3, bodyY + 3.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text('WILAYAH RT / LK', x + 3, bodyY + 8.2);

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(6, 95, 70);
      doc.text(voter.class_name || 'RT.04 Lk.II', x + 3, bodyY + 11.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text('UNSUR / NIK', x + 3, bodyY + 15.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text(`${voter.unsur || 'Jamaah'} (${voter.nisn.slice(0, 10)}...)`, x + 3, bodyY + 18.8);

      // QR Code on the right
      let qrUrl = voter.qrDataUrl;
      if (!qrUrl) {
        try {
          qrUrl = await QRCode.toDataURL(
            `TOKEN_DKM_NH:${voter.pin_plain}:${voter.full_name}:${voter.class_name}`,
            { width: 100, margin: 1 }
          );
        } catch {
          qrUrl = undefined;
        }
      }
      if (qrUrl) {
        try {
          doc.setDrawColor(226, 232, 240);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(x + cardW - 19.5, bodyY - 1, 16.5, 16.5, 1.5, 1.5, 'FD');
          doc.addImage(qrUrl, 'PNG', x + cardW - 18.8, bodyY - 0.3, 15.1, 15.1);
        } catch {
          // ignore qr render error
        }
      }

      // Big PIN Highlight Box at the bottom of card
      const tokenBoxH = 14;
      const tokenBoxY = y + cardH - tokenBoxH - 6.5;
      doc.setFillColor(2, 44, 34);
      doc.roundedRect(x + 2.5, tokenBoxY, cardW - 5, tokenBoxH, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(110, 231, 183);
      doc.text('MASUKKAN KODE TOKEN DI BILIK SUARA', x + cardW / 2, tokenBoxY + 4.2, {
        align: 'center',
      });

      doc.setFont('courier', 'bold');
      doc.setFontSize(13.5);
      doc.setTextColor(251, 191, 36);
      doc.text(voter.pin_plain, x + cardW / 2, tokenBoxY + 11.2, {
        align: 'center',
      });

      // Card Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Cukup Ketik Kode Token', x + 3, y + cardH - 2.3);
      doc.setFont('courier', 'bold');
      doc.text('1 Token = 1 Suara', x + cardW - 3, y + cardH - 2.3, { align: 'right' });
    }

    // 3. FOOTER LEMBAR A4
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Lembar Kertas ${paperSize} — Halaman ${pageIdx + 1} dari ${pages.length}  |  DKM Nurul Hidayah Kel. Kuripan`,
      dim.widthMm / 2,
      dim.heightMm - 6,
      { align: 'center' }
    );
  }

  if (autoPrint) {
    doc.autoPrint();
  }

  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  const fileName = `Kartu_Token_${paperSize}_DKM_Nurul_Hidayah_${pages.length}_Lembar.pdf`;

  // Trigger direct download as well so user always gets the file immediately
  doc.save(fileName);

  return {
    blobUrl,
    fileName,
    pageCount: pages.length,
  };
}

/**
 * Generate PDF Berita Acara Hasil Pemilihan (BAHP) Ukuran A4/F4 Resmi
 * dengan Kop 2 Baris:
 * DEWAN KEMAKMURAN MASJID (DKM)
 * NURUL HIDAYAH (Huruf Besar)
 */
export async function generateBahpPdf(params: {
  school: School;
  activePeriod: ElectionPeriod | null;
  stats: QuickCountStat[];
  metrics: ElectionMetrics;
  committees: Committee[];
  paperSize: PaperSizeOption;
  autoPrint?: boolean;
}): Promise<{ blobUrl: string; fileName: string }> {
  const { school, activePeriod, stats, metrics, committees, paperSize, autoPrint = false } = params;
  const dim = PAPER_DIMENSIONS[paperSize];

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [dim.widthMm, dim.heightMm],
  });

  const logoDataUrl = await loadImageAsDataUrl(school.logo_url || '');
  const periodYear = activePeriod?.academic_year || '2026 - 2028';
  const winner = [...stats].sort((a, b) => b.votes_count - a.votes_count)[0];
  const ketuaPanitia = committees.find((c) => c.role === 'Ketua Panitia');
  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const marginX = 18;
  let y = 16;

  // 1. KOP SURAT RESMI 2 BARIS SESUAI INSTRUKSI USER
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', marginX, y - 2, 22, 22);
    } catch {
      // ignore
    }
  }

  const centerX = dim.widthMm / 2 + (logoDataUrl ? 8 : 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 95, 70);
  doc.text('PANITIA PEMILIHAN KETUA', centerX, y + 2, { align: 'center' });

  // Baris 1: DEWAN KEMAKMURAN MASJID (DKM)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('DEWAN KEMAKMURAN MASJID (DKM)', centerX, y + 7.5, { align: 'center' });

  // Baris 2: NURUL HIDAYAH (Ukuran Besar & Menonjol)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(6, 78, 59);
  doc.text('NURUL HIDAYAH', centerX, y + 14.5, { align: 'center' });

  // Alamat Masjid (1 Baris Bersih Tanpa Dobel)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(51, 65, 85);
  const cleanAddr = school.address.replace(/\s*\(Lingkungan II.*\)/i, '');
  doc.text(cleanAddr, centerX, y + 19.5, { align: 'center' });

  y += 24;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, dim.widthMm - marginX, y);
  doc.setLineWidth(0.3);
  doc.line(marginX, y + 1.2, dim.widthMm - marginX, y + 1.2);

  // 2. JUDUL BERITA ACARA
  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'BERITA ACARA HASIL PEMILIHAN KETUA DKM NURUL HIDAYAH',
    dim.widthMm / 2,
    y,
    { align: 'center' }
  );
  y += 4.5;
  doc.setFontSize(9.5);
  doc.setTextColor(6, 95, 70);
  doc.text(`MASA KHIDMAT ${periodYear}`, dim.widthMm / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Nomor: 005/BAHP-DKM/NH-LK.II/${new Date().getFullYear()}`,
    dim.widthMm / 2,
    y,
    { align: 'center' }
  );

  // 3. PARAGRAF PEMBUKA
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const introText = `Bismillahirrahmanirrahim. Pada hari ini, tanggal ${todayStr}, bertempat di Masjid Nurul Hidayah (${school.address}), telah dilaksanakan pemungutan dan penghitungan suara secara elektronik menggunakan sistem Token Suara Digital dalam rangka Pemilihan Ketua Dewan Kemakmuran Masjid (DKM) Nurul Hidayah Masa Khidmat ${periodYear} oleh Jamaah dan Warga RT.03, RT.04, dan RT.05 Lingkungan II Kelurahan Kuripan dengan prinsip Musyawarah, Jujur, Amanah, Transparan, dan Rahasia.`;
  const splitIntro = doc.splitTextToSize(introText, dim.widthMm - marginX * 2);
  doc.text(splitIntro, marginX, y);
  y += splitIntro.length * 4.5 + 4;

  // 4. BAGIAN I: REKAPITULASI PARTISIPASI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'I. REKAPITULASI PARTISIPASI DAFTAR PEMILIH TETAP (DPT JAMAAH RT.03, RT.04 & RT.05 LK.II)',
    marginX,
    y
  );
  y += 3;

  const tableW = dim.widthMm - marginX * 2;
  const rowsI = [
    ['1. Jumlah Jamaah Terdaftar dalam DPT (RT.03, RT.04 & RT.05 Lk.II)', `${metrics.total_dpt} Jamaah`],
    ['2. Jumlah Jamaah yang Menggunakan Hak Suara (Suara Sah)', `${metrics.total_voted} Suara`],
    ['3. Jumlah Jamaah yang Belum Menggunakan Hak Suara', `${metrics.total_unvoted} Jamaah`],
    ['Persentase Tingkat Partisipasi Kehadiran Jamaah', `${metrics.participation_rate}%`],
  ];

  rowsI.forEach((r, idx) => {
    const rowH = 7;
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(idx === 3 ? 241 : 255, idx === 3 ? 245 : 255, idx === 3 ? 249 : 255);
    doc.rect(marginX, y, tableW, rowH, 'FD');
    doc.setFont('helvetica', idx === 3 ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(r[0], marginX + 3, y + 4.8);
    doc.setFont('courier', 'bold');
    doc.text(r[1], marginX + tableW - 3, y + 4.8, { align: 'right' });
    y += rowH;
  });

  // 5. BAGIAN II: PEROLEHAN SUARA CALON KETUA DKM
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('II. PEROLEHAN SUARA CALON KETUA DKM NURUL HIDAYAH', marginX, y);
  y += 3;

  // Header Tabel II
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(marginX, y, tableW, 7.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('No', marginX + 4, y + 5);
  doc.text('Nama Calon Ketua DKM Nurul Hidayah', marginX + 20, y + 5);
  doc.text('Jumlah Suara', marginX + tableW - 55, y + 5, { align: 'right' });
  doc.text('Persentase', marginX + tableW - 28, y + 5, { align: 'right' });
  doc.text('Status', marginX + tableW - 4, y + 5, { align: 'right' });
  y += 7.5;

  stats.forEach((cand) => {
    const isElected =
      winner && cand.candidate_id === winner.candidate_id && cand.votes_count > 0;
    const rowH = 8;
    doc.setFillColor(isElected ? 236 : 255, isElected ? 253 : 255, isElected ? 245 : 255);
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginX, y, tableW, rowH, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`0${cand.ballot_number}`, marginX + 4, y + 5.3);

    doc.setFont('helvetica', 'bold');
    doc.text(cand.chairman_name, marginX + 20, y + 5.3);

    doc.setFont('courier', 'bold');
    doc.text(`${cand.votes_count} suara`, marginX + tableW - 55, y + 5.3, { align: 'right' });
    doc.text(`${cand.percentage}%`, marginX + tableW - 28, y + 5.3, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(isElected ? 6 : 148, isElected ? 95 : 163, isElected ? 70 : 184);
    doc.text(isElected ? 'TERPILIH' : '-', marginX + tableW - 4, y + 5.3, { align: 'right' });
    y += rowH;
  });

  // 6. BAGIAN III: PENETAPAN KETUA TERPILIH
  if (winner && winner.votes_count > 0) {
    y += 6;
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(marginX, y, tableW, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(6, 78, 59);
    doc.text('III. PENETAPAN KETUA DKM NURUL HIDAYAH TERPILIH', marginX + 4, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Berdasarkan hasil penghitungan suara sah di atas, Panitia Pemilihan menetapkan:`,
      marginX + 4,
      y + 10.5
    );
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Nomor Urut 0${winner.ballot_number}: ${winner.chairman_name} — Sebagai Ketua DKM Nurul Hidayah Terpilih`,
      marginX + 4,
      y + 15.2
    );
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Masa Khidmat ${periodYear} dengan perolehan sebanyak ${winner.votes_count} suara sah (${winner.percentage}%).`,
      marginX + 4,
      y + 19.5
    );
    y += 28;
  } else {
    y += 8;
  }

  // 7. PENUTUP & TANDA TANGAN
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(30, 41, 59);
  const closingText = `Demikian Berita Acara Hasil Pemilihan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya sebagai dasar pengukuhan Ketua Dewan Kemakmuran Masjid (DKM) Nurul Hidayah Masa Khidmat ${periodYear} Kelurahan Kuripan, Kecamatan Telukbetung Barat, Kota Bandar Lampung.`;
  const splitClosing = doc.splitTextToSize(closingText, tableW);
  doc.text(splitClosing, marginX, y);
  y += splitClosing.length * 4.5 + 8;

  const leftSignX = marginX + 32;
  const rightSignX = dim.widthMm - marginX - 32;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Mengetahui & Mengesahkan,', leftSignX, y, { align: 'center' });
  doc.text(`Bandar Lampung, ${todayStr}`, rightSignX, y, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('Ketua Panitia Pemilihan,', leftSignX, y + 4.5, { align: 'center' });
  doc.text('Ketua DKM Nurul Hidayah,', rightSignX, y + 4.5, { align: 'center' });

  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.text(ketuaPanitia?.member_name || 'Yodi Purnawan', leftSignX, y, { align: 'center' });
  doc.text(school.principal_name, rightSignX, y, { align: 'center' });

  doc.setDrawColor(15, 23, 42);
  doc.line(leftSignX - 24, y + 1, leftSignX + 24, y + 1);
  doc.line(rightSignX - 24, y + 1, rightSignX + 24, y + 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Ketua Panitia Pemilihan', leftSignX, y + 5, { align: 'center' });
  doc.text(school.principal_nip, rightSignX, y + 5, { align: 'center' });

  if (autoPrint) {
    doc.autoPrint();
  }

  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  const fileName = `Berita_Acara_${paperSize}_DKM_Nurul_Hidayah_2026_2028.pdf`;

  doc.save(fileName);

  return { blobUrl, fileName };
}

/**
 * Generate PDF Lembar Absensi / Daftar Hadir Jamaah Per RT (RT.03, RT.04, RT.05 Lk.II) Ukuran A4/F4
 */
export async function generateAttendancePdf(params: {
  school: School;
  activePeriod: ElectionPeriod | null;
  rtGroupsData: { rtName: string; voters: Voter[] }[];
  committees: Committee[];
  paperSize: PaperSizeOption;
  showTokenColumn: boolean;
  autoPrint?: boolean;
}): Promise<{ blobUrl: string; fileName: string; pageCount: number }> {
  const {
    school,
    activePeriod,
    rtGroupsData,
    committees,
    paperSize,
    showTokenColumn,
    autoPrint = false,
  } = params;
  const dim = PAPER_DIMENSIONS[paperSize];

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [dim.widthMm, dim.heightMm],
  });

  const logoDataUrl = await loadImageAsDataUrl(school.logo_url || '');
  const periodYear = activePeriod?.academic_year || '2026 - 2028';
  const ketuaPanitia = committees.find((c) => c.role === 'Ketua Panitia');
  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const marginX = 14;
  const tableW = dim.widthMm - marginX * 2;
  const rowsPerPage = paperSize === 'F4' ? 24 : 20;

  let totalPagesGenerated = 0;

  for (let gIdx = 0; gIdx < rtGroupsData.length; gIdx++) {
    const group = rtGroupsData[gIdx];
    const chunks = chunkArray(group.voters, rowsPerPage);
    if (chunks.length === 0) chunks.push([]);

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      if (totalPagesGenerated > 0) {
        doc.addPage([dim.widthMm, dim.heightMm], 'portrait');
      }
      totalPagesGenerated++;

      let y = 13;

      // KOP SURAT RESMI 2 BARIS
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'PNG', marginX, y - 1, 18, 18);
        } catch {
          // ignore
        }
      }

      const centerX = dim.widthMm / 2 + (logoDataUrl ? 6 : 0);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(6, 95, 70);
      doc.text('PANITIA PEMILIHAN KETUA', centerX, y + 2, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('DEWAN KEMAKMURAN MASJID (DKM)', centerX, y + 6.8, { align: 'center' });

      doc.setFontSize(16);
      doc.setTextColor(6, 78, 59);
      doc.text('NURUL HIDAYAH', centerX, y + 13, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const cleanAddr = school.address.replace(/\s*\(Lingkungan II.*\)/i, '');
      doc.text(cleanAddr, centerX, y + 17.2, { align: 'center' });

      y += 20.5;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.7);
      doc.line(marginX, y, dim.widthMm - marginX, y);
      doc.setLineWidth(0.25);
      doc.line(marginX, y + 1, dim.widthMm - marginX, y + 1);

      // JUDUL DAFTAR HADIR PER RT
      y += 7;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        'DAFTAR HADIR & REGISTRASI PEMILIH (DPT JAMAAH)',
        dim.widthMm / 2,
        y,
        { align: 'center' }
      );
      y += 4.5;
      doc.setFontSize(9);
      doc.setTextColor(6, 95, 70);
      doc.text(
        `WILAYAH KELOMPOK JAMAAH: ${group.rtName.toUpperCase()} — MASA KHIDMAT ${periodYear}`,
        dim.widthMm / 2,
        y,
        { align: 'center' }
      );

      // Tabel Header
      y += 5;
      const hRow = 7.5;
      doc.setFillColor(6, 78, 59);
      doc.setDrawColor(15, 23, 42);
      doc.rect(marginX, y, tableW, hRow, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(255, 255, 255);

      const colNo = 10;
      const colName = showTokenColumn ? 52 : 64;
      const colNik = 36;
      const colUnsur = 30;
      const colToken = showTokenColumn ? 20 : 0;

      let curX = marginX;
      doc.text('No', curX + 2.5, y + 5);
      curX += colNo;
      doc.text('Nama Lengkap Jamaah', curX + 2, y + 5);
      curX += colName;
      doc.text('NIK / No. KK', curX + 2, y + 5);
      curX += colNik;
      doc.text('RT & Unsur', curX + 2, y + 5);
      curX += colUnsur;
      if (showTokenColumn) {
        doc.text('Token', curX + 2, y + 5);
        curX += colToken;
      }
      doc.text('Tanda Tangan / Paraf Kehadiran', curX + 2, y + 5);

      y += hRow;

      // Isi Baris Jamaah
      const pageVoters = chunks[cIdx];
      const rowH = 8.2;

      pageVoters.forEach((v, idx) => {
        const globalNo = cIdx * rowsPerPage + idx + 1;
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.setDrawColor(203, 213, 225);
        doc.rect(marginX, y, tableW, rowH, 'FD');

        let rx = marginX;
        doc.setFont('courier', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(String(globalNo), rx + 2.5, y + 5.4);
        rx += colNo;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        const nameLines = doc.splitTextToSize(v.full_name, colName - 4);
        doc.text(nameLines[0] || v.full_name, rx + 2, y + 5.4);
        rx += colName;

        doc.setFont('courier', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(51, 65, 85);
        doc.text(v.nisn || '-', rx + 2, y + 5.4);
        rx += colNik;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(`${v.class_name} (${v.unsur || 'Jamaah'})`.slice(0, 22), rx + 2, y + 5.4);
        rx += colUnsur;

        if (showTokenColumn) {
          doc.setFont('courier', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(6, 78, 59);
          doc.text(v.pin_plain, rx + 2, y + 5.4);
          rx += colToken;
        }

        // Kolom Tanda Tangan Zig-zag (Ganjil di Kiri, Genap di Tengah/Kanan)
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(100, 116, 139);
        const signX = globalNo % 2 === 1 ? rx + 2 : rx + 20;
        doc.text(`${globalNo}. ..............`, signX, y + 5.6);

        y += rowH;
      });

      // Tanda Tangan Panitia Registrasi & Ketua Panitia pada halaman terakhir tiap RT
      if (cIdx === chunks.length - 1) {
        y += 6;
        if (y + 30 < dim.heightMm - 10) {
          const leftSignX = marginX + 32;
          const rightSignX = dim.widthMm - marginX - 32;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(15, 23, 42);
          doc.text('Mengetahui,', leftSignX, y, { align: 'center' });
          doc.text(`Bandar Lampung, ${todayStr}`, rightSignX, y, { align: 'center' });

          doc.setFont('helvetica', 'bold');
          doc.text('Ketua Panitia Pemilihan,', leftSignX, y + 4.2, { align: 'center' });
          doc.text(`Koordinator Meja Registrasi ${group.rtName},`, rightSignX, y + 4.2, {
            align: 'center',
          });

          y += 20;
          doc.text(ketuaPanitia?.member_name || 'Yodi Purnawan', leftSignX, y, {
            align: 'center',
          });
          doc.text('( ........................................ )', rightSignX, y, {
            align: 'center',
          });
        }
      }

      // Footer Halaman
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Daftar Hadir Jamaah ${group.rtName} — Halaman ${cIdx + 1} dari ${chunks.length}  |  DKM Nurul Hidayah Kel. Kuripan`,
        dim.widthMm / 2,
        dim.heightMm - 6,
        { align: 'center' }
      );
    }
  }

  if (autoPrint) {
    doc.autoPrint();
  }

  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  const fileName = `Daftar_Hadir_Absensi_Jamaah_${paperSize}_DKM_Nurul_Hidayah.pdf`;

  doc.save(fileName);

  return { blobUrl, fileName, pageCount: totalPagesGenerated };
}
