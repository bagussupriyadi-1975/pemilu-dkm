import { Voter, UnsurJamaahType } from '../types';

/**
 * Ekspor DPT Jamaah ke format CSV Lengkap (Setara Data KTP & KK)
 */
export function exportDptToCsv(voters: Voter[], periodName: string): void {
  const headers = [
    'No',
    'NIK KTP',
    'No KK',
    'Nama Lengkap Jamaah',
    'RT & Lingkungan',
    'Unsur Jamaah',
    'L/P',
    'Tempat Lahir',
    'Tanggal Lahir',
    'Pekerjaan',
    'No HP',
    'Token PIN',
    'Status Memilih',
    'Waktu Memilih',
  ];
  const rows = voters.map((v, i) => [
    i + 1,
    `"${v.nisn}"`,
    `"${v.no_kk || '-'}"`,
    `"${v.full_name}"`,
    `"${v.class_name}"`,
    `"${v.unsur || 'Jamaah'}"`,
    v.gender,
    `"${v.birth_place || 'Bandar Lampung'}"`,
    `"${v.birth_date || '-'}"`,
    `"${v.occupation || '-'}"`,
    `"${v.phone || '-'}"`,
    `"${v.pin_plain}"`,
    v.has_voted ? 'SUDAH MEMILIH' : 'BELUM MEMILIH',
    v.voted_at ? `"${new Date(v.voted_at).toLocaleString('id-ID')}"` : '-',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `DPT_Jamaah_Nurul_Hidayah_${periodName.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Unduh Template CSV untuk impor data DPT Jamaah Masjid Nurul Hidayah
 */
export function downloadDptTemplate(): void {
  const template = `NIK_KTP,No_KK,Nama_Lengkap_Jamaah,RT_Lingkungan,Unsur_Jamaah,Jenis_Kelamin,Tempat_Lahir,Tanggal_Lahir,Pekerjaan,No_HP
1871030302680001,1871030101100301,Suhargito,RT.03 Lk.II,Jamaah,L,Bandar Lampung,1968-02-03,Wiraswasta,081272003001
1871031708790007,1871030101100401,Bagus Supriyadi,RT.04 Lk.II,Jamaah + Pengurus,L,Bandar Lampung,1979-08-17,IT & Profesional,081272004001
1871031003720018,1871030101100501,Feriyanto,RT.05 Lk.II,Jamaah + Pengurus,L,Bandar Lampung,1972-03-10,Wiraswasta,081272005001`;

  const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'Template_Import_Jamaah_Nurul_Hidayah.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Parsing teks CSV menjadi data voter mentah lengkap
 */
export function parseDptCsv(csvText: string): Array<{
  nisn: string;
  no_kk?: string;
  full_name: string;
  class_name: string;
  unsur?: UnsurJamaahType;
  gender: 'L' | 'P';
  birth_place?: string;
  birth_date?: string;
  occupation?: string;
  phone?: string;
}> {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const results: Array<{
    nisn: string;
    no_kk?: string;
    full_name: string;
    class_name: string;
    unsur?: UnsurJamaahType;
    gender: 'L' | 'P';
    birth_place?: string;
    birth_date?: string;
    occupation?: string;
    phone?: string;
  }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.includes(';') ? line.split(';') : line.split(',');
    if (parts.length >= 3) {
      // Cek apakah format 4 kolom lama atau format KTP lengkap 10 kolom
      if (parts.length >= 6) {
        const nisn = parts[0].replace(/["']/g, '').trim();
        const no_kk = parts[1].replace(/["']/g, '').trim();
        const full_name = parts[2].replace(/["']/g, '').trim();
        const class_name = parts[3].replace(/["']/g, '').trim() || 'RT.04 Lk.II';
        const rawUnsur = parts[4].replace(/["']/g, '').trim();
        const rawGender = parts[5] ? parts[5].replace(/["']/g, '').trim().toUpperCase() : 'L';
        const gender: 'L' | 'P' = rawGender === 'P' || rawGender === 'PEREMPUAN' ? 'P' : 'L';
        const birth_place = parts[6]?.replace(/["']/g, '').trim() || 'Bandar Lampung';
        const birth_date = parts[7]?.replace(/["']/g, '').trim() || '1975-01-01';
        const occupation = parts[8]?.replace(/["']/g, '').trim() || 'Wiraswasta';
        const phone = parts[9]?.replace(/["']/g, '').trim() || '-';

        const unsur: UnsurJamaahType =
          rawUnsur.toLowerCase().includes('pengurus') || rawUnsur.toLowerCase().includes('tokoh')
            ? 'Jamaah + Pengurus'
            : 'Jamaah';

        if (nisn && full_name) {
          results.push({
            nisn,
            no_kk,
            full_name,
            class_name,
            unsur,
            gender,
            birth_place,
            birth_date,
            occupation,
            phone,
          });
        }
      } else {
        const nisn = parts[0].replace(/["']/g, '').trim();
        const full_name = parts[1].replace(/["']/g, '').trim();
        const class_name = parts[2].replace(/["']/g, '').trim() || 'RT.04 Lk.II';
        const rawGender = parts[3] ? parts[3].replace(/["']/g, '').trim().toUpperCase() : 'L';
        const gender: 'L' | 'P' = rawGender === 'P' || rawGender === 'PEREMPUAN' ? 'P' : 'L';

        if (nisn && full_name) {
          results.push({ nisn, full_name, class_name, gender });
        }
      }
    }
  }

  return results;
}
