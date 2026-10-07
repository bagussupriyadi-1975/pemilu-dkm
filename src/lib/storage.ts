import {
  School,
  ElectionPeriod,
  Committee,
  Candidate,
  Voter,
  Vote,
  AuditLog,
  QuickCountStat,
  ElectionMetrics,
  AppUser,
  UnsurJamaahType,
} from '../types';
import { generateRandomPin, verifyPin } from './security';
import {
  getSupabase,
  isSupabaseActive,
  setupRealtimeSubscription,
  getSupabaseConfig,
  testSupabaseConnection,
} from './supabase';

const STORAGE_KEYS = {
  SCHOOL: 'epilketmas_nh_school_v6',
  PERIODS: 'epilketmas_nh_periods_v6',
  COMMITTEES: 'epilketmas_nh_committees_v6',
  CANDIDATES: 'epilketmas_nh_candidates_v6',
  VOTERS: 'epilketmas_nh_voters_v6',
  VOTES: 'epilketmas_nh_votes_v6',
  AUDIT_LOGS: 'epilketmas_nh_audit_logs_v6',
  USERS: 'epilketmas_nh_users_v6',
};

// Generator Pool 300 Token Resmi (NH0001 s.d NH0300)
export const ALL_300_TOKENS: string[] = Array.from({ length: 300 }, (_, i) =>
  `NH${String(i + 1).padStart(4, '0')}`
);

// Event emitter untuk simulasi & sinkronisasi Supabase Realtime Listener
class RealtimeBus extends EventTarget {
  notify(eventName: string, data?: unknown) {
    this.dispatchEvent(new CustomEvent(eventName, { detail: data }));
  }
}
export const realtimeBus = new RealtimeBus();

// ============================================================================
// DATA AWAL RESMI: MASJID NURUL HIDAYAH - KEL. KURIPAN, TELUKBETUNG BARAT
// ============================================================================
const DEFAULT_SCHOOL: School = {
  id: 'sch-01',
  name: 'Dewan Kemakmuran Masjid (DKM) Nurul Hidayah',
  npsn: '01.4.08.01.04.000124',
  type: 'DKM',
  logo_url: 'https://bagus-supriyadi.biz.id/uploads/LOGO%20NURUL%20HIDAYAH.png',
  address:
    'Jalan Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan, Kec. Telukbetung Barat, Kota Bandar Lampung',
  principal_name: 'Feriyanto',
  principal_nip: 'SK-DKM/NH/04/LK-II/2026',
  voting_basis: 'semua',
  lingkungan_name:
    'Lingkungan II (RT.03, RT.04, RT.05) Kel. Kuripan, Kec. Telukbetung Barat, Kota Bandar Lampung',
  booth_lock_mode: 'auto',
  voting_start_datetime: '2026-10-18T08:00',
  voting_end_datetime: '2026-10-18T14:00',
  voting_location:
    'Ruang Utama Masjid Nurul Hidayah, Jl. Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan, Bandar Lampung',
};

// Helper Format Hari, Tanggal Lengkap, dan Waktu Lengkap Bahasa Indonesia
export function formatIndonesianDateTime(dateStr?: string): {
  dayName: string;
  dateFull: string;
  timeFull: string;
  fullSchedule: string;
} {
  if (!dateStr) {
    return {
      dayName: 'Minggu',
      dateFull: '18 Oktober 2026',
      timeFull: '08:00 WIB',
      fullSchedule: 'Minggu, 18 Oktober 2026 — Pukul 08:00 WIB',
    };
  }
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) {
    return {
      dayName: 'Minggu',
      dateFull: '18 Oktober 2026',
      timeFull: '08:00 WIB',
      fullSchedule: 'Minggu, 18 Oktober 2026 — Pukul 08:00 WIB',
    };
  }
  const dayName = dt.toLocaleDateString('id-ID', { weekday: 'long' });
  const dateFull = dt.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  const timeFull = `${hours}:${minutes} WIB`;
  return {
    dayName,
    dateFull,
    timeFull,
    fullSchedule: `${dayName}, ${dateFull} — Pukul ${timeFull}`,
  };
}

// Evaluasi Status Kunci Bilik Token & Jadwal Buka/Tutup Pemilihan
export function getBoothAccessStatus(
  school: School,
  now: Date = new Date()
): {
  isOpen: boolean;
  code: 'OPEN_MANUAL' | 'LOCKED_MANUAL' | 'WAITING_OPEN' | 'OPEN_SCHEDULED' | 'CLOSED_SCHEDULED';
  badgeText: string;
  title: string;
  reason: string;
  startInfo: ReturnType<typeof formatIndonesianDateTime>;
  endInfo: ReturnType<typeof formatIndonesianDateTime>;
  location: string;
  countdownTarget: Date | null;
  countdownMode: 'TO_OPEN' | 'TO_CLOSE' | 'ENDED';
} {
  const startRaw = school.voting_start_datetime || DEFAULT_SCHOOL.voting_start_datetime!;
  const endRaw = school.voting_end_datetime || DEFAULT_SCHOOL.voting_end_datetime!;
  const startDt = new Date(startRaw);
  const endDt = new Date(endRaw);
  const startInfo = formatIndonesianDateTime(startRaw);
  const endInfo = formatIndonesianDateTime(endRaw);
  const location =
    school.voting_location ||
    DEFAULT_SCHOOL.voting_location ||
    'Masjid Nurul Hidayah, Jl. Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan';
  const mode = school.booth_lock_mode || 'auto';

  if (mode === 'force_locked') {
    return {
      isOpen: false,
      code: 'LOCKED_MANUAL',
      badgeText: 'BILIK TOKEN DIKUNCI PANITIA',
      title: 'Bilik Suara & Input Token Sedang Dikunci oleh Panitia',
      reason:
        'Saat ini Bilik Suara dikunci oleh Panitia Pemilihan / Admin DKM. Jamaah belum dapat memasukkan Kode Token sebelum kunci dibuka oleh Panitia.',
      startInfo,
      endInfo,
      location,
      countdownTarget: now < startDt ? startDt : null,
      countdownMode: now < startDt ? 'TO_OPEN' : 'ENDED',
    };
  }

  if (mode === 'force_open') {
    if (!isNaN(endDt.getTime()) && now >= endDt) {
      return {
        isOpen: false,
        code: 'CLOSED_SCHEDULED',
        badgeText: 'DITUTUP — PEMILIHAN SELESAI',
        title: 'Bilik Token Telah Ditutup Kembali (Waktu Pemilihan Berakhir)',
        reason: `Waktu pemungutan suara telah berakhir pada ${endInfo.dayName}, ${endInfo.dateFull} Pukul ${endInfo.timeFull}. Bilik Suara otomatis dikunci kembali.`,
        startInfo,
        endInfo,
        location,
        countdownTarget: null,
        countdownMode: 'ENDED',
      };
    }

    const hasFutureClose = !isNaN(endDt.getTime()) && now < endDt;
    return {
      isOpen: true,
      code: 'OPEN_MANUAL',
      badgeText: 'BILIK TOKEN SEDANG DIBUKA',
      title: 'Bilik Suara & Token Sedang Dibuka',
      reason: hasFutureClose
        ? `Bilik Suara sedang dibuka dan akan ditutup kembali secara otomatis pada ${endInfo.dayName}, ${endInfo.dateFull} Pukul ${endInfo.timeFull}.`
        : 'Bilik Suara telah dibuka oleh Panitia Pemilihan. Silakan masukkan Kode Token Anda untuk memberikan hak suara.',
      startInfo,
      endInfo,
      location,
      countdownTarget: hasFutureClose ? endDt : null,
      countdownMode: 'TO_CLOSE',
    };
  }

  // Mode 'auto' (Mengikuti Jadwal Tanggal & Jam Buka s.d. Jam Tutup)
  if (!isNaN(startDt.getTime()) && now < startDt) {
    return {
      isOpen: false,
      code: 'WAITING_OPEN',
      badgeText: 'TERKUNCI — BELUM WAKTUNYA DIBUKA',
      title: 'Bilik Token Terkunci (Belum Waktunya Pemungutan Suara)',
      reason: `Pemungutan suara baru akan dibuka pada ${startInfo.dayName}, ${startInfo.dateFull} Pukul ${startInfo.timeFull} bertempat di ${location}. Kode Token belum dapat dimasukkan sebelum jadwal dibuka atau dibuka oleh Panitia.`,
      startInfo,
      endInfo,
      location,
      countdownTarget: startDt,
      countdownMode: 'TO_OPEN',
    };
  }

  if (!isNaN(endDt.getTime()) && now > endDt) {
    return {
      isOpen: false,
      code: 'CLOSED_SCHEDULED',
      badgeText: 'DITUTUP — PEMILIHAN SELESAI',
      title: 'Bilik Token Telah Ditutup (Waktu Pemilihan Berakhir)',
      reason: `Waktu pemungutan suara telah ditutup pada ${endInfo.dayName}, ${endInfo.dateFull} Pukul ${endInfo.timeFull}. Kode Token tidak dapat lagi digunakan agar tidak disalahgunakan setelah pemilihan selesai.`,
      startInfo,
      endInfo,
      location,
      countdownTarget: null,
      countdownMode: 'ENDED',
    };
  }

  return {
    isOpen: true,
    code: 'OPEN_SCHEDULED',
    badgeText: 'BILIK TOKEN SEDANG DIBUKA',
    title: 'Bilik Suara Sedang Dibuka Sesuai Jadwal Pemilihan',
    reason: `Bilik Suara dibuka sampai ${endInfo.dayName}, ${endInfo.dateFull} Pukul ${endInfo.timeFull}.`,
    startInfo,
    endInfo,
    location,
    countdownTarget: !isNaN(endDt.getTime()) ? endDt : null,
    countdownMode: 'TO_CLOSE',
  };
}

const DEFAULT_PERIODS: ElectionPeriod[] = [
  {
    id: 'period-2026',
    school_id: 'sch-01',
    period_name: 'Pemilihan Ketua Dewan Kemakmuran Masjid (DKM) Nurul Hidayah',
    academic_year: '2026 - 2028',
    status: 'aktif',
    start_date: '2026-10-05T07:30:00.000Z',
    end_date: '2026-10-05T22:00:00.000Z',
    created_at: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'period-2023',
    school_id: 'sch-01',
    period_name: 'Pemilihan Ketua Dewan Kemakmuran Masjid (DKM) Nurul Hidayah',
    academic_year: '2023 - 2025',
    status: 'selesai',
    start_date: '2023-09-15T07:30:00.000Z',
    end_date: '2023-09-15T15:00:00.000Z',
    created_at: '2023-09-01T08:00:00.000Z',
  },
];

const DEFAULT_COMMITTEES: Committee[] = [
  {
    id: 'com-01',
    election_period_id: 'period-2026',
    sk_number: '001/SK-PAN/DKM-NH/X/2026',
    sk_date: '2026-10-01',
    sk_file_name: 'SK_Panitia_Pemilihan_Masjid_Nurul_Hidayah_2026.pdf',
    member_name: 'Yodi Purnawan',
    role: 'Ketua Panitia',
    email: 'yodi.purnawan@nurulhidayah.id',
    status: 'aktif',
  },
  {
    id: 'com-02',
    election_period_id: 'period-2026',
    sk_number: '001/SK-PAN/DKM-NH/X/2026',
    sk_date: '2026-10-01',
    sk_file_name: 'SK_Panitia_Pemilihan_Masjid_Nurul_Hidayah_2026.pdf',
    member_name: 'David Firdaus',
    role: 'Sekretaris',
    email: 'david.firdaus@nurulhidayah.id',
    status: 'aktif',
  },
  {
    id: 'com-03',
    election_period_id: 'period-2026',
    sk_number: '001/SK-PAN/DKM-NH/X/2026',
    sk_date: '2026-10-01',
    sk_file_name: 'SK_Panitia_Pemilihan_Masjid_Nurul_Hidayah_2026.pdf',
    member_name: 'Anton Hindratno',
    role: 'Bendahara',
    email: 'anton.hindratno@nurulhidayah.id',
    status: 'aktif',
  },
  {
    id: 'com-04',
    election_period_id: 'period-2026',
    sk_number: '001/SK-PAN/DKM-NH/X/2026',
    sk_date: '2026-10-01',
    sk_file_name: 'SK_Panitia_Pemilihan_Masjid_Nurul_Hidayah_2026.pdf',
    member_name: 'Nanda Feri Irawan',
    role: 'Seksi Teknis IT',
    email: 'nanda.feri@nurulhidayah.id',
    status: 'aktif',
  },
  {
    id: 'com-05',
    election_period_id: 'period-2026',
    sk_number: '001/SK-PAN/DKM-NH/X/2026',
    sk_date: '2026-10-01',
    sk_file_name: 'SK_Panitia_Pemilihan_Masjid_Nurul_Hidayah_2026.pdf',
    member_name: 'Suhargito',
    role: 'Seksi Bilik Suara',
    email: 'suhargito@nurulhidayah.id',
    status: 'aktif',
  },
];

const DEFAULT_CANDIDATES: Candidate[] = [
  {
    id: 'cand-01',
    election_period_id: 'period-2026',
    ballot_number: 1,
    chairman_name: 'Feriyanto',
    vice_chairman_name: '',
    chairman_class: 'RT.05 Lk.II',
    vice_chairman_class: '',
    photo_url:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1000&auto=format&fit=crop&crop=faces,top&q=85',
    vision:
      'Mewujudkan Masjid Nurul Hidayah yang Makmur, Transparan, dan Menjadi Pusat Ukhuwah Jamaah Lingkungan II Kelurahan Kuripan.',
    mission: [
      'Menyelenggarakan pengelolaan kas dan infaq Masjid Nurul Hidayah secara terbuka dan akuntabel kepada seluruh jamaah.',
      'Meningkatkan kualitas ibadah berjamaah, kajian rutin, serta pembinaan Taman Pendidikan Al-Qur’an (TPA).',
      'Mempererat silaturahmi dan gotong royong warga RT.03, RT.04, dan RT.05 Lingkungan II.',
    ],
    programs: [
      'Laporan Keuangan & Kas Masjid Bulanan Secara Terbuka',
      'Kajian Rutin Pekanan, Pembinaan Majelis Taklim & Remaja Masjid (RISMA)',
      'Program Santunan Yatim, Dhuafa & Sosial Kemasyarakatan',
    ],
    video_url: 'https://www.youtube.com',
    color_theme: 'emerald',
  },
  {
    id: 'cand-02',
    election_period_id: 'period-2026',
    ballot_number: 2,
    chairman_name: 'Ust. Nur Fuad',
    vice_chairman_name: '',
    chairman_class: 'RT.05 Lk.II',
    vice_chairman_class: '',
    photo_url:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=1000&auto=format&fit=crop&crop=faces,top&q=85',
    vision:
      'Menjadikan Masjid Nurul Hidayah sebagai Sentra Pembinaan Ibadah, Majelis Taklim, dan Pemberdayaan Generasi Muda Masjid yang Amanah.',
    mission: [
      'Memakmurkan sholat fardhu berjamaah dan menghidupkan syiar Islam di Lingkungan II Kelurahan Kuripan.',
      'Mengoptimalkan pemeliharaan sarana fisik, kebersihan tempat wudhu, dan kenyamanan ruang ibadah masjid.',
      'Memberdayakan potensi pemuda/remaja masjid dan Ibu-ibu Majelis Taklim dalam kegiatan keumatan.',
    ],
    programs: [
      'Gerakan Subuh Berjamaah & Tahsin Al-Qur’an Lintas Usia',
      'Revitalisasi Sound System, Penyejuk Ruangan & Kebersihan Terpadu Masjid',
      'Semarak PHBI (Peringatan Hari Besar Islam) & Gebyar Ramadhan',
    ],
    video_url: 'https://www.youtube.com',
    color_theme: 'blue',
  },
  {
    id: 'cand-03',
    election_period_id: 'period-2026',
    ballot_number: 3,
    chairman_name: 'Ust. Nahrowi',
    vice_chairman_name: '',
    chairman_class: 'RT.03 Lk.II',
    vice_chairman_class: '',
    photo_url:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&h=1000&auto=format&fit=crop&crop=faces,top&q=85',
    vision:
      'Membangun Tata Kelola DKM Nurul Hidayah yang Kolaboratif, Tertib Administrasi, dan Peduli Kesejahteraan Jamaah.',
    mission: [
      'Membangun sinergi harmonis antara pengurus DKM, aparat RT.03, RT.04, RT.05, dan tokoh masyarakat.',
      'Menata manajemen inventaris, pengelolaan zakat/qurban, dan pelayanan rukun kifayah yang sigap.',
      'Menghadirkan suasana masjid yang ramah keluarga, ramah anak, dan menyejukkan bagi seluruh warga.',
    ],
    programs: [
      'Optimalisasi Layanan Rukun Kifayah & Sosial Kemasyarakatan',
      'Manajemen Panitia Qurban & Zakat Fitrah Terpadu',
      'Forum Musyawarah Jamaah Berkala Lingkungan II',
    ],
    video_url: 'https://www.youtube.com',
    color_theme: 'purple',
  },
];

// DAFTAR 27 JAMAAH RESMI MASJID NURUL HIDAYAH (RT.03, RT.04, RT.05 LK.II KEL. KURIPAN)
// Dilengkapi atribut lengkap setara KTP & KK (NIK, No. KK, TTL, Pekerjaan, Status, Unsur Jamaah)
interface RawJamaahSeed {
  nik: string;
  no_kk: string;
  name: string;
  rt_lk: 'RT.03 Lk.II' | 'RT.04 Lk.II' | 'RT.05 Lk.II';
  unsur: UnsurJamaahType;
  gender: 'L' | 'P';
  birth_place: string;
  birth_date: string;
  occupation: string;
  phone: string;
  token: string;
  voted: boolean;
}

export function normalizeUnsurJamaah(raw?: string): UnsurJamaahType {
  if (!raw) return 'Jamaah';
  if (raw.toLowerCase().includes('pengurus') || raw.toLowerCase().includes('tokoh')) {
    return 'Jamaah + Pengurus';
  }
  return 'Jamaah';
}

const INITIAL_VOTERS_RAW: RawJamaahSeed[] = [
  // ==================== RT.03 Lk.II (6 Jamaah) ====================
  {
    nik: '1871030302680001',
    no_kk: '1871030101100301',
    name: 'Suhargito',
    rt_lk: 'RT.03 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1968-02-03',
    occupation: 'Wiraswasta',
    phone: '081272003001',
    token: 'NH0001',
    voted: true,
  },
  {
    nik: '1871031405700002',
    no_kk: '1871030101100302',
    name: 'Supandi',
    rt_lk: 'RT.03 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1970-05-14',
    occupation: 'Karyawan Swasta',
    phone: '081272003002',
    token: 'NH0002',
    voted: true,
  },
  {
    nik: '1871032108650003',
    no_kk: '1871030101100303',
    name: 'Ust. Nahrowi',
    rt_lk: 'RT.03 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1965-08-21',
    occupation: 'Ustadz / Pengajar',
    phone: '081272003003',
    token: 'NH0003',
    voted: true,
  },
  {
    nik: '1871031111820004',
    no_kk: '1871030101100304',
    name: 'David Firdaus',
    rt_lk: 'RT.03 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1982-11-11',
    occupation: 'Karyawan Swasta',
    phone: '081272003004',
    token: 'NH0004',
    voted: false,
  },
  {
    nik: '1871030904740005',
    no_kk: '1871030101100305',
    name: 'Maryanto',
    rt_lk: 'RT.03 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Tanjung Karang',
    birth_date: '1974-04-09',
    occupation: 'Wiraswasta',
    phone: '081272003005',
    token: 'NH0005',
    voted: false,
  },
  {
    nik: '1871031907710006',
    no_kk: '1871030101100306',
    name: 'Slamet Imron',
    rt_lk: 'RT.03 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1971-07-19',
    occupation: 'Wiraswasta',
    phone: '081272003006',
    token: 'NH0006',
    voted: false,
  },

  // ==================== RT.04 Lk.II (11 Jamaah) ====================
  {
    nik: '1871031708790007',
    no_kk: '1871030101100401',
    name: 'Bagus Supriyadi',
    rt_lk: 'RT.04 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1979-08-17',
    occupation: 'IT & Profesional',
    phone: '081272004001',
    token: 'NH0007',
    voted: false,
  },
  {
    nik: '1871030503670008',
    no_kk: '1871030101100402',
    name: 'Sabar',
    rt_lk: 'RT.04 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1967-03-05',
    occupation: 'Wiraswasta',
    phone: '081272004002',
    token: 'NH0008',
    voted: true,
  },
  {
    nik: '1871031206720009',
    no_kk: '1871030101100403',
    name: 'Hasmardi',
    rt_lk: 'RT.04 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1972-06-12',
    occupation: 'Karyawan Swasta',
    phone: '081272004003',
    token: 'NH0009',
    voted: true,
  },
  {
    nik: '1871032509800010',
    no_kk: '1871030101100404',
    name: 'Yodi Purnawan',
    rt_lk: 'RT.04 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1980-09-25',
    occupation: 'Karyawan Swasta',
    phone: '081272004004',
    token: 'NH0010',
    voted: false,
  },
  {
    nik: '1871030810760011',
    no_kk: '1871030101100405',
    name: 'M. Nixon',
    rt_lk: 'RT.04 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1976-10-08',
    occupation: 'Wiraswasta',
    phone: '081272004005',
    token: 'NH0011',
    voted: true,
  },
  {
    nik: '1871031501690012',
    no_kk: '1871030101100406',
    name: 'Ust. Ahmad Muslih',
    rt_lk: 'RT.04 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1969-01-15',
    occupation: 'Ustadz / Penceramah',
    phone: '081272004006',
    token: 'NH0012',
    voted: true,
  },
  {
    nik: '1871032204750013',
    no_kk: '1871030101100407',
    name: 'Syaifullah',
    rt_lk: 'RT.04 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1975-04-22',
    occupation: 'Wiraswasta',
    phone: '081272004007',
    token: 'NH0013',
    voted: false,
  },
  {
    nik: '1871033011900014',
    no_kk: '1871030101100408',
    name: 'Nanda Feri Irawan',
    rt_lk: 'RT.04 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1990-11-30',
    occupation: 'Karyawan Swasta',
    phone: '081272004008',
    token: 'NH0014',
    voted: false,
  },
  {
    nik: '1871030407730015',
    no_kk: '1871030101100409',
    name: 'Alius',
    rt_lk: 'RT.04 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1973-07-04',
    occupation: 'Wiraswasta',
    phone: '081272004009',
    token: 'NH0015',
    voted: false,
  },
  {
    nik: '1871031802710016',
    no_kk: '1871030101100410',
    name: 'Haidir',
    rt_lk: 'RT.04 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1971-02-18',
    occupation: 'Wiraswasta',
    phone: '081272004010',
    token: 'NH0016',
    voted: false,
  },
  {
    nik: '1871032705810017',
    no_kk: '1871030101100411',
    name: 'Iwan Setiawan',
    rt_lk: 'RT.04 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1981-05-27',
    occupation: 'Karyawan Swasta',
    phone: '081272004011',
    token: 'NH0017',
    voted: false,
  },

  // ==================== RT.05 Lk.II (10 Jamaah) ====================
  {
    nik: '1871031003720018',
    no_kk: '1871030101100501',
    name: 'Feriyanto',
    rt_lk: 'RT.05 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1972-03-10',
    occupation: 'Wiraswasta / Ketua DKM',
    phone: '081272005001',
    token: 'NH0018',
    voted: true,
  },
  {
    nik: '1871030609680019',
    no_kk: '1871030101100502',
    name: 'Ust. Nur Fuad',
    rt_lk: 'RT.05 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1968-09-06',
    occupation: 'Ustadz / Tokoh Agama',
    phone: '081272005002',
    token: 'NH0019',
    voted: true,
  },
  {
    nik: '1871031412770020',
    no_kk: '1871030101100503',
    name: 'Anton Hindratno',
    rt_lk: 'RT.05 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1977-12-14',
    occupation: 'Karyawan Swasta',
    phone: '081272005003',
    token: 'NH0020',
    voted: false,
  },
  {
    nik: '1871032001660021',
    no_kk: '1871030101100504',
    name: 'Ir. Salfian',
    rt_lk: 'RT.05 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1966-01-20',
    occupation: 'Insinyur / Konsultan',
    phone: '081272005004',
    token: 'NH0021',
    voted: true,
  },
  {
    nik: '1871030308700022',
    no_kk: '1871030101100505',
    name: 'Suherman',
    rt_lk: 'RT.05 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1970-08-03',
    occupation: 'Wiraswasta',
    phone: '081272005005',
    token: 'NH0022',
    voted: false,
  },
  {
    nik: '1871031202620023',
    no_kk: '1871030101100506',
    name: 'H. Khairul',
    rt_lk: 'RT.05 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1962-02-12',
    occupation: 'Pensiunan / Tokoh Masyarakat',
    phone: '081272005006',
    token: 'NH0023',
    voted: false,
  },
  {
    nik: '1871032806640024',
    no_kk: '1871030101100507',
    name: 'Drs. Salwin Salim',
    rt_lk: 'RT.05 Lk.II',
    unsur: 'Jamaah + Pengurus',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1964-06-28',
    occupation: 'ASN / Pensiunan',
    phone: '081272005007',
    token: 'NH0024',
    voted: false,
  },
  {
    nik: '1871030711730025',
    no_kk: '1871030101100508',
    name: 'M. Usuf',
    rt_lk: 'RT.05 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1973-11-07',
    occupation: 'Wiraswasta',
    phone: '081272005008',
    token: 'NH0025',
    voted: false,
  },
  {
    nik: '1871031604750026',
    no_kk: '1871030101100509',
    name: 'Hasan',
    rt_lk: 'RT.05 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1975-04-16',
    occupation: 'Wiraswasta',
    phone: '081272005009',
    token: 'NH0026',
    voted: false,
  },
  {
    nik: '1871032309690027',
    no_kk: '1871030101100510',
    name: 'Sadeli',
    rt_lk: 'RT.05 Lk.II',
    unsur: 'Jamaah',
    gender: 'L',
    birth_place: 'Bandar Lampung',
    birth_date: '1969-09-23',
    occupation: 'Wiraswasta',
    phone: '081272005010',
    token: 'NH0027',
    voted: false,
  },
];

function generateInitialVoters(): Voter[] {
  return INITIAL_VOTERS_RAW.map((item, idx) => ({
    id: `voter-${idx + 1}`,
    election_period_id: 'period-2026',
    nisn: item.nik,
    no_kk: item.no_kk,
    full_name: item.name,
    class_name: item.rt_lk,
    unsur: item.unsur,
    gender: item.gender,
    birth_place: item.birth_place,
    birth_date: item.birth_date,
    address_ktp: `Jalan Timor Gg. Masjid ${item.rt_lk} Kel. Kuripan, Kec. Telukbetung Barat, Kota Bandar Lampung`,
    religion: 'Islam',
    marital_status: 'Kawin',
    occupation: item.occupation,
    phone: item.phone,
    is_kk_representative: true,
    pin_plain: item.token,
    pin_hash: item.token,
    has_voted: item.voted,
    voted_at: item.voted
      ? new Date(Date.now() - (12 - (idx % 10)) * 12 * 60 * 1000).toISOString()
      : null,
  }));
}

function generateInitialVotes(): Vote[] {
  // 10 suara awal sesuai 10 jamaah yang voted: true
  const candidateDistribution = [
    'cand-01',
    'cand-01',
    'cand-02',
    'cand-01',
    'cand-03',
    'cand-02',
    'cand-01',
    'cand-02',
    'cand-03',
    'cand-01',
  ];
  return candidateDistribution.map((candId, idx) => ({
    id: `vote-${idx + 1}`,
    election_period_id: 'period-2026',
    candidate_id: candId,
    created_at: new Date(Date.now() - (10 - idx) * 12 * 60 * 1000).toISOString(),
  }));
}

const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-01',
    election_period_id: 'period-2026',
    user_id: 'bagus.supriyadi.tbb@gmail.com',
    user_role: 'Admin Utama DKM',
    action: 'INIT_MASJID_CONFIG',
    details:
      'Mengatur profil Masjid Nurul Hidayah (RT.03, RT.04, RT.05 Lk.II Kel. Kuripan, Telukbetung Barat, Bandar Lampung)',
    ip_address: '192.168.1.10',
    timestamp: '2026-10-05T07:00:00.000Z',
  },
  {
    id: 'log-02',
    election_period_id: 'period-2026',
    user_id: 'bagus.supriyadi.tbb@gmail.com',
    user_role: 'Admin Utama DKM',
    action: 'UPLOAD_SK_COMMITTEE',
    details: 'Menerbitkan SK Panitia Pemilihan Ketua Masjid No. 001/SK-PAN/DKM-NH/X/2026',
    ip_address: '192.168.1.10',
    timestamp: '2026-10-05T07:15:00.000Z',
  },
  {
    id: 'log-03',
    election_period_id: 'period-2026',
    user_id: 'yodi.purnawan@nurulhidayah.id',
    user_role: 'Panitia Pemilihan',
    action: 'IMPORT_DPT_JAMAAH',
    details:
      'Memuat 27 data Kepala Keluarga / Jamaah (RT.03, RT.04, RT.05 Lk.II) lengkap dengan data KTP & Token Suara',
    ip_address: '192.168.1.44',
    timestamp: '2026-10-05T07:25:00.000Z',
  },
  {
    id: 'log-04',
    election_period_id: 'period-2026',
    user_id: 'bagus.supriyadi.tbb@gmail.com',
    user_role: 'Admin Utama DKM',
    action: 'ACTIVATE_PERIOD',
    details:
      'Mengaktifkan Pemungutan Suara Pemilihan Ketua Masjid Nurul Hidayah dengan metode Token PIN Unik',
    ip_address: '192.168.1.10',
    timestamp: '2026-10-05T07:30:00.000Z',
  },
];

// AKUN ADMIN UTAMA & PANITIA PEMILIHAN DARI DAFTAR JAMAAH MASJID NURUL HIDAYAH
const DEFAULT_USERS: AppUser[] = [
  {
    id: 'user-01',
    name: 'Bagus Supriyadi',
    email: 'bagus.supriyadi.tbb@gmail.com',
    username: 'dkm12345',
    role: 'admin',
    password: 'dkm12345',
    status: 'aktif',
    created_at: '2026-10-01T08:00:00.000Z',
    last_login: '2026-10-05T07:30:00.000Z',
  },
  {
    id: 'user-02',
    name: 'Yodi Purnawan (Ketua Panitia - RT.04 Lk.II)',
    email: 'bagus.supriyadi.tbb@gmail.com',
    username: 'yodi',
    role: 'panitia',
    password: 'dkm12345',
    status: 'aktif',
    created_at: '2026-10-01T08:00:00.000Z',
    last_login: '2026-10-05T07:20:00.000Z',
  },
  {
    id: 'user-03',
    name: 'David Firdaus (Sekretaris Panitia - RT.03 Lk.II)',
    email: 'david.firdaus@nurulhidayah.id',
    username: 'david',
    role: 'panitia',
    password: 'dkm12345',
    status: 'aktif',
    created_at: '2026-10-01T08:00:00.000Z',
    last_login: '2026-10-05T06:50:00.000Z',
  },
  {
    id: 'user-04',
    name: 'Anton Hindratno (Bendahara Panitia - RT.05 Lk.II)',
    email: 'anton.hindratno@nurulhidayah.id',
    username: 'anton',
    role: 'panitia',
    password: 'dkm12345',
    status: 'aktif',
    created_at: '2026-10-01T08:00:00.000Z',
    last_login: '2026-10-04T16:00:00.000Z',
  },
  {
    id: 'user-05',
    name: 'Nanda Feri Irawan (Petugas Bilik & IT - RT.04 Lk.II)',
    email: 'nanda.feri@nurulhidayah.id',
    username: 'nanda',
    role: 'operator',
    password: 'dkm12345',
    status: 'aktif',
    created_at: '2026-10-01T08:00:00.000Z',
    last_login: '2026-10-04T11:20:00.000Z',
  },
  {
    id: 'user-06',
    name: 'Suhargito (Petugas Bilik & Saksi - RT.03 Lk.II)',
    email: 'suhargito@nurulhidayah.id',
    username: 'suhargito',
    role: 'pengawas',
    password: 'dkm12345',
    status: 'aktif',
    created_at: '2026-10-01T08:00:00.000Z',
    last_login: '2026-10-04T10:00:00.000Z',
  },
];

// Helper get & set
function getItem<T>(key: string, defaultVal: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setItem<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.warn('Storage quota error', err);
  }
}

// Fungsi untuk mengunggah seluruh data Masjid Nurul Hidayah ke Supabase
export async function pushDataToSupabase(): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      message: 'Supabase belum terhubung. Silakan isi Project URL & Anon Key terlebih dahulu.',
    };
  }

  try {
    const school = getItem(STORAGE_KEYS.SCHOOL, DEFAULT_SCHOOL);
    const periods = getItem(STORAGE_KEYS.PERIODS, DEFAULT_PERIODS);
    const committees = getItem(STORAGE_KEYS.COMMITTEES, DEFAULT_COMMITTEES);
    const candidates = getItem(STORAGE_KEYS.CANDIDATES, DEFAULT_CANDIDATES);
    const voters = getItem(STORAGE_KEYS.VOTERS, generateInitialVoters());
    const users = getItem(STORAGE_KEYS.USERS, DEFAULT_USERS);

    // 1. Upsert School (hanya kolom standar tabel schools agar tidak error jika tabel lama belum di-alter)
    await supabase.from('schools').upsert({
      id: school.id,
      name: school.name,
      npsn: school.npsn,
      type: school.type,
      logo_url: school.logo_url,
      address: school.address,
      principal_name: school.principal_name,
      principal_nip: school.principal_nip,
    });

    // 2. Upsert Periods
    if (periods.length > 0) {
      await supabase.from('election_periods').upsert(periods);
    }

    // 3. Upsert Committees
    if (committees.length > 0) {
      await supabase.from('committees').upsert(committees);
    }

    // 4. Upsert Candidates
    if (candidates.length > 0) {
      await supabase.from('candidates').upsert(candidates);
    }

    // 5. Upsert Voters (map ke kolom tabel voters standar agar aman)
    if (voters.length > 0) {
      const dbVoters = voters.map((v) => ({
        id: v.id,
        election_period_id: v.election_period_id,
        nisn: v.nisn,
        full_name: v.full_name,
        class_name: v.class_name,
        gender: v.gender,
        pin_plain: v.pin_plain,
        pin_hash: v.pin_hash,
        has_voted: v.has_voted,
        voted_at: v.voted_at,
      }));
      await supabase.from('voters').upsert(dbVoters);
    }

    // 6. Upsert Users
    if (users.length > 0) {
      const dbUsers = users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        username: u.username,
        role: u.role,
        password: u.password || 'dkmnh12345',
        status: u.status,
      }));
      await supabase.from('users').upsert(dbUsers);
    }

    realtimeBus.notify('supabase_synced');
    return {
      success: true,
      message:
        'Berhasil mengunggah seluruh data Masjid Nurul Hidayah (Profil, 27 Jamaah RT.03-05 Lk.II, Paslon & Akun) ke Cloud Supabase!',
    };
  } catch (err) {
    console.warn('Error pushing to Supabase:', err);
    return {
      success: false,
      message: `Gagal mengunggah ke Supabase: ${(err as Error).message}`,
    };
  }
}

// Sinkronisasi data dari Supabase PostgreSQL ke local cache
export async function syncFromSupabase(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const [
      schoolRes,
      periodsRes,
      committeesRes,
      candidatesRes,
      votersRes,
      votesRes,
      logsRes,
      usersRes,
    ] = await Promise.all([
      supabase.from('schools').select('*').limit(1).maybeSingle(),
      supabase.from('election_periods').select('*').order('created_at', { ascending: false }),
      supabase.from('committees').select('*'),
      supabase.from('candidates').select('*').order('ballot_number', { ascending: true }),
      supabase.from('voters').select('*'),
      supabase.from('votes').select('*'),
      supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(300),
      supabase.from('users').select('*'),
    ]);

    // Jika di Supabase tabel voters masih kosong (baru jalankan CREATE TABLE) atau masih tersimpan nama lama,
    // otomatis unggah data lengkap DKM Nurul Hidayah 2026 - 2028 ke Supabase!
    if (
      !votersRes.data ||
      votersRes.data.length === 0 ||
      (schoolRes.data &&
        (schoolRes.data.name.includes('SMA Negeri') ||
          schoolRes.data.name.includes('Al-Ikhlas') ||
          schoolRes.data.name === 'Masjid Nurul Hidayah' ||
          schoolRes.data.type === 'OSIS'))
    ) {
      await pushDataToSupabase();
      return true;
    }

    if (schoolRes.data) {
      const currentLocal = getItem(STORAGE_KEYS.SCHOOL, DEFAULT_SCHOOL);
      setItem(STORAGE_KEYS.SCHOOL, {
        ...currentLocal,
        ...schoolRes.data,
      });
    }
    if (periodsRes.data && periodsRes.data.length > 0) {
      const normalizedPeriods = periodsRes.data.map((p: ElectionPeriod) => {
        if (p.id === 'period-2026') {
          return {
            ...p,
            period_name: 'Pemilihan Ketua Dewan Kemakmuran Masjid (DKM) Nurul Hidayah',
            academic_year: '2026 - 2028',
          };
        }
        return p;
      });
      setItem(STORAGE_KEYS.PERIODS, normalizedPeriods);
    }
    if (committeesRes.data && committeesRes.data.length > 0) {
      setItem(STORAGE_KEYS.COMMITTEES, committeesRes.data);
    }
    if (candidatesRes.data && candidatesRes.data.length > 0) {
      const singleCandidates = candidatesRes.data.map((c: Candidate) => ({
        ...c,
        vice_chairman_name: '',
        vice_chairman_class: '',
      }));
      setItem(STORAGE_KEYS.CANDIDATES, singleCandidates);
    }
    if (votersRes.data && votersRes.data.length > 0) {
      // Pertahankan metadata KTP lokal jika kolom tambahan belum ada di tabel Supabase
      const localVoters = getItem<Voter[]>(STORAGE_KEYS.VOTERS, generateInitialVoters());
      const mergedVoters = votersRes.data.map((remoteVoter: Voter) => {
        const localMatch = localVoters.find(
          (lv) => lv.id === remoteVoter.id || lv.nisn === remoteVoter.nisn
        );
        return {
          ...localMatch,
          ...remoteVoter,
        };
      });
      setItem(STORAGE_KEYS.VOTERS, mergedVoters);
    }
    if (votesRes.data) {
      setItem(STORAGE_KEYS.VOTES, votesRes.data);
    }
    if (logsRes.data && logsRes.data.length > 0) {
      setItem(STORAGE_KEYS.AUDIT_LOGS, logsRes.data);
    }
    if (usersRes.data && usersRes.data.length > 0) {
      setItem(STORAGE_KEYS.USERS, usersRes.data);
    }

    realtimeBus.notify('supabase_synced');
    realtimeBus.notify('school_updated');
    realtimeBus.notify('periods_updated');
    realtimeBus.notify('voters_updated');
    realtimeBus.notify('candidates_updated');
    return true;
  } catch (err) {
    console.warn('Gagal sinkronisasi data dari Supabase:', err);
    return false;
  }
}

// Inisialisasi awal saat load
export function initializeStorage(): void {
  // Bersihkan key versi lama jika masih ada
  try {
    localStorage.removeItem('epilketos_school_v1');
    localStorage.removeItem('epilketos_periods_v1');
    localStorage.removeItem('epilketos_auth_user_v1');
  } catch {
    // ignore
  }

  const existingSchool = getItem<School | null>(STORAGE_KEYS.SCHOOL, null);
  if (
    !existingSchool ||
    existingSchool.name.includes('SMA Negeri') ||
    existingSchool.name.includes('Al-Ikhlas')
  ) {
    setItem(STORAGE_KEYS.SCHOOL, DEFAULT_SCHOOL);
  }
  if (!localStorage.getItem(STORAGE_KEYS.PERIODS)) {
    setItem(STORAGE_KEYS.PERIODS, DEFAULT_PERIODS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.COMMITTEES)) {
    setItem(STORAGE_KEYS.COMMITTEES, DEFAULT_COMMITTEES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CANDIDATES)) {
    setItem(STORAGE_KEYS.CANDIDATES, DEFAULT_CANDIDATES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.VOTERS)) {
    setItem(STORAGE_KEYS.VOTERS, generateInitialVoters());
  }
  if (!localStorage.getItem(STORAGE_KEYS.VOTES)) {
    setItem(STORAGE_KEYS.VOTES, generateInitialVotes());
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
    setItem(STORAGE_KEYS.AUDIT_LOGS, DEFAULT_AUDIT_LOGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    setItem(STORAGE_KEYS.USERS, DEFAULT_USERS);
  }

  // Jika Supabase aktif, sinkronkan data & daftarkan listener WebSocket realtime
  if (isSupabaseActive()) {
    syncFromSupabase();
    setupRealtimeSubscription((table) => {
      console.log(`[Supabase Realtime] Perubahan pada tabel: ${table}. Sinkronisasi...`);
      syncFromSupabase();
    });
  }
}

// API DATABASE PERSISTENT (HYBRID LOCAL + SUPABASE)
export const db = {
  // PROFIL MASJID / DKM
  getSchool(): School {
    const saved = getItem(STORAGE_KEYS.SCHOOL, DEFAULT_SCHOOL);
    return {
      ...DEFAULT_SCHOOL,
      ...saved,
    };
  },
  updateSchool(school: Partial<School>): School {
    const current = this.getSchool();
    const updated = { ...current, ...school };
    setItem(STORAGE_KEYS.SCHOOL, updated);
    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'UPDATE_MASJID_CONFIG',
      `Memperbarui profil & pengaturan masjid: ${updated.name}`
    );
    realtimeBus.notify('school_updated', updated);

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('schools')
        .upsert({
          id: updated.id,
          name: updated.name,
          npsn: updated.npsn,
          type: updated.type,
          logo_url: updated.logo_url,
          address: updated.address,
          principal_name: updated.principal_name,
          principal_nip: updated.principal_nip,
        })
        .then(({ error }) => {
          if (error) console.warn('Supabase updateSchool error:', error);
        });
    }

    return updated;
  },

  // PERIODE MASA KHIDMAT PEMILIHAN
  getPeriods(): ElectionPeriod[] {
    return getItem(STORAGE_KEYS.PERIODS, DEFAULT_PERIODS);
  },
  getActivePeriod(): ElectionPeriod | null {
    const periods = this.getPeriods();
    return periods.find((p) => p.status === 'aktif') || null;
  },
  createPeriod(periodData: Omit<ElectionPeriod, 'id' | 'created_at'>): ElectionPeriod {
    const periods = this.getPeriods();
    if (periodData.status === 'aktif') {
      periods.forEach((p) => {
        if (p.status === 'aktif') p.status = 'selesai';
      });
    }
    const newPeriod: ElectionPeriod = {
      ...periodData,
      id: `period-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    periods.unshift(newPeriod);
    setItem(STORAGE_KEYS.PERIODS, periods);
    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'CREATE_PERIOD',
      `Membuat periode pemilihan: ${newPeriod.period_name}`
    );
    realtimeBus.notify('periods_updated', periods);

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('election_periods')
        .insert(newPeriod)
        .then(({ error }) => {
          if (error) console.warn('Supabase createPeriod error:', error);
        });
    }

    return newPeriod;
  },
  setActivePeriod(periodId: string): void {
    const periods = this.getPeriods();
    periods.forEach((p) => {
      if (p.id === periodId) {
        p.status = 'aktif';
      } else if (p.status === 'aktif') {
        p.status = 'selesai';
      }
    });
    setItem(STORAGE_KEYS.PERIODS, periods);
    const active = periods.find((p) => p.id === periodId);
    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'ACTIVATE_PERIOD',
      `Mengaktifkan periode pemilihan: ${active?.period_name}`
    );
    realtimeBus.notify('periods_updated', periods);

    const supabase = getSupabase();
    if (supabase) {
      periods.forEach((p) => {
        supabase.from('election_periods').update({ status: p.status }).eq('id', p.id).then();
      });
    }
  },
  updatePeriodStatus(periodId: string, status: 'draft' | 'aktif' | 'selesai'): void {
    const periods = this.getPeriods();
    if (status === 'aktif') {
      periods.forEach((p) => {
        if (p.id !== periodId && p.status === 'aktif') p.status = 'selesai';
      });
    }
    const target = periods.find((p) => p.id === periodId);
    if (target) {
      target.status = status;
      setItem(STORAGE_KEYS.PERIODS, periods);
      this.addAuditLog(
        'admin',
        'Admin Utama DKM',
        'UPDATE_PERIOD_STATUS',
        `Mengubah status periode "${target.period_name}" menjadi ${status.toUpperCase()}`
      );
      realtimeBus.notify('periods_updated', periods);

      const supabase = getSupabase();
      if (supabase) {
        periods.forEach((p) => {
          supabase.from('election_periods').update({ status: p.status }).eq('id', p.id).then();
        });
      }
    }
  },
  updatePeriod(id: string, periodData: Partial<ElectionPeriod>): ElectionPeriod {
    const periods = this.getPeriods();
    const idx = periods.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Periode tidak ditemukan');

    if (periodData.status === 'aktif') {
      periods.forEach((p) => {
        if (p.id !== id && p.status === 'aktif') p.status = 'selesai';
      });
    }

    periods[idx] = { ...periods[idx], ...periodData };
    setItem(STORAGE_KEYS.PERIODS, periods);
    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'UPDATE_PERIOD',
      `Memperbarui periode: ${periods[idx].period_name}`
    );
    realtimeBus.notify('periods_updated', periods);

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('election_periods').update(periodData).eq('id', id).then();
    }

    return periods[idx];
  },
  deletePeriod(id: string): void {
    let periods = this.getPeriods();
    const target = periods.find((p) => p.id === id);
    if (!target) return;
    if (target.status === 'aktif') {
      throw new Error(
        'Tidak dapat menghapus periode yang sedang berstatus AKTIF! Nonaktifkan atau selesaikan periode terlebih dahulu.'
      );
    }
    periods = periods.filter((p) => p.id !== id);
    setItem(STORAGE_KEYS.PERIODS, periods);
    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'DELETE_PERIOD',
      `Menghapus periode: ${target.period_name}`
    );
    realtimeBus.notify('periods_updated', periods);

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('election_periods').delete().eq('id', id).then();
    }
  },

  // PANITIA PEMILIHAN DKM
  getCommittees(periodId?: string): Committee[] {
    const committees = getItem<Committee[]>(STORAGE_KEYS.COMMITTEES, DEFAULT_COMMITTEES);
    if (!periodId) return committees;
    return committees.filter((c) => c.election_period_id === periodId);
  },
  addCommittee(data: Omit<Committee, 'id'>): Committee {
    const all = this.getCommittees();
    const newComm: Committee = { ...data, id: `com-${Date.now()}` };
    all.push(newComm);
    setItem(STORAGE_KEYS.COMMITTEES, all);
    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'ADD_COMMITTEE',
      `Menambahkan panitia pemilihan: ${newComm.member_name} (${newComm.role})`
    );
    realtimeBus.notify('committees_updated', all);

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('committees').insert(newComm).then();
    }

    return newComm;
  },
  updateCommittee(id: string, data: Partial<Committee>): Committee {
    const all = this.getCommittees();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Panitia tidak ditemukan');
    all[idx] = { ...all[idx], ...data };
    setItem(STORAGE_KEYS.COMMITTEES, all);
    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'UPDATE_COMMITTEE',
      `Memperbarui data panitia: ${all[idx].member_name} (${all[idx].role})`
    );
    realtimeBus.notify('committees_updated', all);

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('committees').update(data).eq('id', id).then();
    }

    return all[idx];
  },
  deleteCommittee(id: string): void {
    let all = this.getCommittees();
    const target = all.find((c) => c.id === id);
    all = all.filter((c) => c.id !== id);
    setItem(STORAGE_KEYS.COMMITTEES, all);
    if (target) {
      this.addAuditLog(
        'admin',
        'Admin Utama DKM',
        'DELETE_COMMITTEE',
        `Menghapus panitia: ${target.member_name}`
      );
    }
    realtimeBus.notify('committees_updated', all);

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('committees').delete().eq('id', id).then();
    }
  },

  // KANDIDAT CALON KETUA MASJID
  getCandidates(periodId?: string): Candidate[] {
    const candidates = getItem<Candidate[]>(STORAGE_KEYS.CANDIDATES, DEFAULT_CANDIDATES);
    const targetPeriod = periodId || this.getActivePeriod()?.id;
    if (!targetPeriod) return candidates;
    return candidates
      .filter((c) => c.election_period_id === targetPeriod)
      .sort((a, b) => a.ballot_number - b.ballot_number);
  },
  saveCandidate(candData: Omit<Candidate, 'id'>, existingId?: string): Candidate {
    const all = getItem<Candidate[]>(STORAGE_KEYS.CANDIDATES, DEFAULT_CANDIDATES);
    const supabase = getSupabase();

    if (existingId) {
      const idx = all.findIndex((c) => c.id === existingId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...candData };
        setItem(STORAGE_KEYS.CANDIDATES, all);
        this.addAuditLog(
          'panitia',
          'Panitia Pemilihan',
          'UPDATE_CANDIDATE',
          `Memperbarui calon ketua no. ${candData.ballot_number}: ${candData.chairman_name}`
        );
        realtimeBus.notify('candidates_updated', all);

        if (supabase) {
          supabase.from('candidates').upsert(all[idx]).then();
        }

        return all[idx];
      }
    }
    const newCand: Candidate = { ...candData, id: `cand-${Date.now()}` };
    all.push(newCand);
    setItem(STORAGE_KEYS.CANDIDATES, all);
    this.addAuditLog(
      'panitia',
      'Panitia Pemilihan',
      'ADD_CANDIDATE',
      `Menambahkan calon ketua no. ${newCand.ballot_number}: ${newCand.chairman_name}`
    );
    realtimeBus.notify('candidates_updated', all);

    if (supabase) {
      supabase.from('candidates').insert(newCand).then();
    }

    return newCand;
  },
  deleteCandidate(id: string): void {
    let all = getItem<Candidate[]>(STORAGE_KEYS.CANDIDATES, DEFAULT_CANDIDATES);
    const target = all.find((c) => c.id === id);
    all = all.filter((c) => c.id !== id);
    setItem(STORAGE_KEYS.CANDIDATES, all);
    if (target) {
      this.addAuditLog(
        'panitia',
        'Panitia Pemilihan',
        'DELETE_CANDIDATE',
        `Menghapus calon ketua no. ${target.ballot_number}`
      );
    }
    realtimeBus.notify('candidates_updated', all);

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('candidates').delete().eq('id', id).then();
    }
  },

  // PEMILIH / DATA JAMAAH (DPT KOMPLIT KTP & KK)
  getVoters(periodId?: string): Voter[] {
    const rawVoters = getItem<Voter[]>(STORAGE_KEYS.VOTERS, generateInitialVoters());
    const voters = rawVoters.map((v) => ({
      ...v,
      unsur: normalizeUnsurJamaah(v.unsur),
    }));
    const targetPeriod = periodId || this.getActivePeriod()?.id;
    if (!targetPeriod) return voters;
    return voters.filter((v) => v.election_period_id === targetPeriod);
  },
  importVoters(
    periodId: string,
    rawVoters: Array<{
      nisn: string;
      no_kk?: string;
      full_name: string;
      class_name: string;
      unsur?: UnsurJamaahType;
      gender: 'L' | 'P';
      birth_place?: string;
      birth_date?: string;
      address_ktp?: string;
      occupation?: string;
      phone?: string;
    }>
  ): number {
    const all = getItem<Voter[]>(STORAGE_KEYS.VOTERS, generateInitialVoters());
    const newItems: Voter[] = [];
    let count = 0;
    rawVoters.forEach((item) => {
      const exists = all.some(
        (v) => v.election_period_id === periodId && v.nisn === item.nisn.trim()
      );
      if (!exists && item.nisn && item.full_name) {
        const pin = generateRandomPin(6);
        const newV: Voter = {
          id: `voter-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          election_period_id: periodId,
          nisn: item.nisn.trim(),
          no_kk: item.no_kk?.trim() || `1871030101${Math.floor(100000 + Math.random() * 900000)}`,
          full_name: item.full_name.trim(),
          class_name: item.class_name.trim() || 'RT.04 Lk.II',
          unsur: normalizeUnsurJamaah(item.unsur),
          gender: item.gender,
          birth_place: item.birth_place || 'Bandar Lampung',
          birth_date: item.birth_date || '1975-01-01',
          address_ktp:
            item.address_ktp ||
            `Jalan Timor Gg. Masjid ${item.class_name.trim()} Kel. Kuripan, Telukbetung Barat`,
          religion: 'Islam',
          marital_status: 'Kawin',
          occupation: item.occupation || 'Wiraswasta',
          phone: item.phone || '-',
          is_kk_representative: true,
          pin_plain: pin,
          pin_hash: pin,
          has_voted: false,
          voted_at: null,
        };
        all.push(newV);
        newItems.push(newV);
        count++;
      }
    });
    setItem(STORAGE_KEYS.VOTERS, all);
    this.addAuditLog(
      'panitia',
      'Panitia Pemilihan',
      'IMPORT_DPT_JAMAAH',
      `Mengimpor ${count} data jamaah baru ke DPT Masjid Nurul Hidayah.`
    );
    realtimeBus.notify('voters_updated', all);

    const supabase = getSupabase();
    if (supabase && newItems.length > 0) {
      const dbVoters = newItems.map((v) => ({
        id: v.id,
        election_period_id: v.election_period_id,
        nisn: v.nisn,
        full_name: v.full_name,
        class_name: v.class_name,
        gender: v.gender,
        pin_plain: v.pin_plain,
        pin_hash: v.pin_hash,
        has_voted: v.has_voted,
        voted_at: v.voted_at,
      }));
      supabase
        .from('voters')
        .insert(dbVoters)
        .then(({ error }) => {
          if (error) console.warn('Supabase importVoters error:', error);
        });
    }

    return count;
  },
  getAvailableTokens(periodId?: string, excludeVoterId?: string): Array<{
    token: string;
    number: number;
    isAssigned: boolean;
    assignedTo?: string;
    hasVoted: boolean;
  }> {
    const voters = this.getVoters(periodId);
    return ALL_300_TOKENS.map((token, idx) => {
      const owner = voters.find(
        (v) => v.id !== excludeVoterId && v.pin_plain.toUpperCase() === token
      );
      return {
        token,
        number: idx + 1,
        isAssigned: Boolean(owner),
        assignedTo: owner?.full_name,
        hasVoted: Boolean(owner?.has_voted),
      };
    });
  },
  addSingleVoter(
    voter: Omit<Voter, 'id' | 'has_voted' | 'voted_at' | 'pin_plain' | 'pin_hash'> & {
      custom_pin?: string;
    }
  ): Voter {
    const all = getItem<Voter[]>(STORAGE_KEYS.VOTERS, generateInitialVoters());
    const periodVoters = all.filter((v) => v.election_period_id === voter.election_period_id);

    // Cari token pertama dari NH0001-NH0300 yang belum dipakai jika custom_pin kosong
    let pin = voter.custom_pin?.trim().toUpperCase() || '';
    if (!pin) {
      const freeToken = ALL_300_TOKENS.find(
        (t) => !periodVoters.some((v) => v.pin_plain.toUpperCase() === t)
      );
      pin = freeToken || generateRandomPin(6);
    } else {
      const duplicateToken = periodVoters.find((v) => v.pin_plain.toUpperCase() === pin);
      if (duplicateToken) {
        throw new Error(
          `Kode Token ${pin} sudah terkunci / digunakan oleh jamaah: ${duplicateToken.full_name}. Silakan pilih nomor token lain!`
        );
      }
    }

    const { custom_pin, ...voterClean } = voter;
    const newVoter: Voter = {
      ...voterClean,
      id: `voter-${Date.now()}`,
      pin_plain: pin,
      pin_hash: pin,
      has_voted: false,
      voted_at: null,
    };
    all.push(newVoter);
    setItem(STORAGE_KEYS.VOTERS, all);
    this.addAuditLog(
      'panitia',
      'Panitia / Admin DKM',
      'ADD_JAMAAH',
      `Menambahkan data jamaah: ${newVoter.full_name} (${newVoter.class_name} - Token: ${pin})`
    );
    realtimeBus.notify('voters_updated', all);

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('voters')
        .insert({
          id: newVoter.id,
          election_period_id: newVoter.election_period_id,
          nisn: newVoter.nisn,
          full_name: newVoter.full_name,
          class_name: newVoter.class_name,
          gender: newVoter.gender,
          pin_plain: newVoter.pin_plain,
          pin_hash: newVoter.pin_hash,
          has_voted: newVoter.has_voted,
          voted_at: newVoter.voted_at,
        })
        .then();
    }

    return newVoter;
  },
  updateVoter(
    id: string,
    voterData: Partial<Voter>,
    options?: { allowSwapToken?: boolean }
  ): Voter {
    const all = getItem<Voter[]>(STORAGE_KEYS.VOTERS, generateInitialVoters());
    const idx = all.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error('Data jamaah tidak ditemukan');

    const prevVoter = all[idx];
    const oldToken = prevVoter.pin_plain.toUpperCase();
    const wasVoted = Boolean(prevVoter.has_voted);

    if (voterData.pin_plain) {
      const cleanToken = voterData.pin_plain.trim().toUpperCase();
      // Cek apakah nomor token sedang dipakai jamaah lain
      const duplicateIdx = all.findIndex(
        (v) =>
          v.id !== id &&
          v.election_period_id === prevVoter.election_period_id &&
          v.pin_plain.toUpperCase() === cleanToken
      );

      if (duplicateIdx !== -1) {
        if (options?.allowSwapToken) {
          // Tukar otomatis (swap) nomor token dengan jamaah tersebut agar tidak dobel
          const otherVoter = all[duplicateIdx];
          otherVoter.pin_plain = oldToken;
          otherVoter.pin_hash = oldToken;
          this.addAuditLog(
            'admin',
            'Admin / Panitia DKM',
            'SWAP_TOKEN_NUMBER',
            `Menukar Nomor Token ${cleanToken} milik ${otherVoter.full_name} dengan ${oldToken} milik ${
              voterData.full_name || prevVoter.full_name
            }.`
          );
        } else {
          throw new Error(
            `Kode Token ${cleanToken} sedang terdaftar atas nama jamaah: ${all[duplicateIdx].full_name}. Aktifkan opsi "Buka Kunci Pilihan No. Token" jika ingin menukar nomor token ini.`
          );
        }
      }
      voterData.pin_plain = cleanToken;
      voterData.pin_hash = cleanToken;
    }

    // Jika status has_voted diubah dari true (Sudah Digunakan) -> false (Belum Digunakan / Dibuka Kembali)
    if (wasVoted && voterData.has_voted === false) {
      voterData.voted_at = null;
      const allVotes = getItem<Vote[]>(STORAGE_KEYS.VOTES, generateInitialVotes());
      const periodVoteIdx = [...allVotes]
        .reverse()
        .findIndex((vt) => vt.election_period_id === prevVoter.election_period_id);
      if (periodVoteIdx !== -1) {
        const actualIdx = allVotes.length - 1 - periodVoteIdx;
        allVotes.splice(actualIdx, 1);
        setItem(STORAGE_KEYS.VOTES, allVotes);
        realtimeBus.notify('vote_casted', { periodId: prevVoter.election_period_id });
      }
      this.addAuditLog(
        'admin',
        'Admin Utama DKM',
        'UNLOCK_USED_TOKEN',
        `Membuka kunci status Token ${
          voterData.pin_plain || oldToken
        } atas nama ${voterData.full_name || prevVoter.full_name} menjadi BELUM DIGUNAKAN (Aktif Kembali dengan No. Token yang sama).`
      );
    }

    all[idx] = {
      ...prevVoter,
      ...voterData,
      unsur: normalizeUnsurJamaah(voterData.unsur || prevVoter.unsur),
    };
    setItem(STORAGE_KEYS.VOTERS, all);
    this.addAuditLog(
      'panitia',
      'Panitia / Admin DKM',
      'UPDATE_JAMAAH',
      `Memperbarui data KTP/KK & Token jamaah: ${all[idx].full_name} (${all[idx].class_name} - Token: ${all[idx].pin_plain})`
    );
    realtimeBus.notify('voters_updated', all);

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('voters')
        .update({
          nisn: all[idx].nisn,
          full_name: all[idx].full_name,
          class_name: all[idx].class_name,
          gender: all[idx].gender,
          pin_plain: all[idx].pin_plain,
          pin_hash: all[idx].pin_hash,
          has_voted: all[idx].has_voted,
          voted_at: all[idx].voted_at,
        })
        .eq('id', id)
        .then();
    }

    return all[idx];
  },

  /**
   * Buka Kunci Token yang Sudah Digunakan kembali menjadi Belum Digunakan
   * DENGAN TETAP MENGGUNAKAN NOMOR TOKEN YANG SAMA (Misal tetap NH0001)
   */
  unlockVoterToken(voterId: string): Voter {
    const all = getItem<Voter[]>(STORAGE_KEYS.VOTERS, generateInitialVoters());
    const idx = all.findIndex((v) => v.id === voterId);
    if (idx === -1) throw new Error('Data jamaah tidak ditemukan');

    const voter = all[idx];
    const wasVoted = voter.has_voted;
    voter.has_voted = false;
    voter.voted_at = null;
    setItem(STORAGE_KEYS.VOTERS, all);

    if (wasVoted) {
      const allVotes = getItem<Vote[]>(STORAGE_KEYS.VOTES, generateInitialVotes());
      const periodVoteIdx = [...allVotes]
        .reverse()
        .findIndex((vt) => vt.election_period_id === voter.election_period_id);
      if (periodVoteIdx !== -1) {
        const actualIdx = allVotes.length - 1 - periodVoteIdx;
        allVotes.splice(actualIdx, 1);
        setItem(STORAGE_KEYS.VOTES, allVotes);
      }
    }

    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'UNLOCK_VOTER_TOKEN',
      `Membuka kembali kunci Token ${voter.pin_plain} milik ${voter.full_name} (${voter.class_name}) menjadi BELUM DIGUNAKAN (Tetap No. Token ${voter.pin_plain}).`
    );

    realtimeBus.notify('voters_updated', all);
    realtimeBus.notify('vote_casted', { periodId: voter.election_period_id });

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('voters')
        .update({
          has_voted: false,
          voted_at: null,
        })
        .eq('id', voter.id)
        .then();
    }

    return voter;
  },

  /**
   * Buka Kunci SEMUA Token yang Sudah Digunakan menjadi Belum Digunakan
   * DENGAN TETAP MEMPERTAHANKAN NOMOR TOKEN MASING-MASING JAMAAH
   */
  unlockAllVoterTokens(periodId: string): number {
    const all = getItem<Voter[]>(STORAGE_KEYS.VOTERS, generateInitialVoters());
    let unlockedCount = 0;

    all.forEach((v) => {
      if (v.election_period_id === periodId && v.has_voted) {
        v.has_voted = false;
        v.voted_at = null;
        unlockedCount++;
      }
    });

    setItem(STORAGE_KEYS.VOTERS, all);

    // Bersihkan suara pada periode ini agar sinkron dengan status token yang belum digunakan
    const allVotes = getItem<Vote[]>(STORAGE_KEYS.VOTES, generateInitialVotes()).filter(
      (vt) => vt.election_period_id !== periodId
    );
    setItem(STORAGE_KEYS.VOTES, allVotes);

    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'UNLOCK_ALL_TOKENS',
      `Membuka kunci ${unlockedCount} Token jamaah menjadi BELUM DIGUNAKAN (Nomor Token masing-masing jamaah tetap sama).`
    );

    realtimeBus.notify('voters_updated', all);
    realtimeBus.notify('vote_casted', { periodId });

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('voters')
        .update({ has_voted: false, voted_at: null })
        .eq('election_period_id', periodId)
        .then();
      supabase.from('votes').delete().eq('election_period_id', periodId).then();
    }

    return unlockedCount;
  },
  resetVoterPin(voterId: string): string {
    const all = getItem<Voter[]>(STORAGE_KEYS.VOTERS, generateInitialVoters());
    const voter = all.find((v) => v.id === voterId);
    if (!voter) throw new Error('Jamaah tidak ditemukan');
    if (voter.has_voted)
      throw new Error('Tidak dapat mereset Token jamaah yang sudah menggunakan hak suara!');

    const periodVoters = all.filter((v) => v.election_period_id === voter.election_period_id);
    const availablePool = ALL_300_TOKENS.filter(
      (t) => !periodVoters.some((v) => v.pin_plain.toUpperCase() === t)
    );
    const newPin =
      availablePool.length > 0
        ? availablePool[Math.floor(Math.random() * availablePool.length)]
        : generateRandomPin(6);

    voter.pin_plain = newPin;
    voter.pin_hash = newPin;
    setItem(STORAGE_KEYS.VOTERS, all);
    this.addAuditLog(
      'panitia',
      'Panitia Pemilihan',
      'RESET_TOKEN',
      `Mereset Token PIN jamaah ${voter.full_name} (${voter.class_name}) menjadi ${newPin}`
    );
    realtimeBus.notify('voters_updated', all);

    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('voters')
        .update({ pin_plain: newPin, pin_hash: newPin })
        .eq('id', voterId)
        .then();
    }

    return newPin;
  },
  deleteVoter(voterId: string): void {
    let all = getItem<Voter[]>(STORAGE_KEYS.VOTERS, generateInitialVoters());
    const target = all.find((v) => v.id === voterId);
    all = all.filter((v) => v.id !== voterId);
    setItem(STORAGE_KEYS.VOTERS, all);
    if (target) {
      this.addAuditLog(
        'panitia',
        'Panitia / Admin DKM',
        'DELETE_JAMAAH',
        `Menghapus data jamaah: ${target.full_name} (${target.class_name})`
      );
    }
    realtimeBus.notify('voters_updated', all);

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('voters').delete().eq('id', voterId).then();
    }
  },
  regenerateAllPins(periodId: string): number {
    const all = getItem<Voter[]>(STORAGE_KEYS.VOTERS, generateInitialVoters());
    const updatedVoters: Voter[] = [];
    let count = 0;

    // Kumpulkan token yang sudah dipakai oleh jamaah yang sudah memilih (terkunci)
    const lockedTokens = new Set(
      all
        .filter((v) => v.election_period_id === periodId && v.has_voted)
        .map((v) => v.pin_plain.toUpperCase())
    );
    const availableTokens = ALL_300_TOKENS.filter((t) => !lockedTokens.has(t));
    let poolIdx = 0;

    all.forEach((v) => {
      if (v.election_period_id === periodId && !v.has_voted) {
        const pin = availableTokens[poolIdx++] || generateRandomPin(6);
        v.pin_plain = pin;
        v.pin_hash = pin;
        updatedVoters.push(v);
        count++;
      }
    });
    setItem(STORAGE_KEYS.VOTERS, all);
    this.addAuditLog(
      'panitia',
      'Panitia Pemilihan',
      'BULK_GENERATE_TOKENS',
      `Menata ulang nomor urut Token (NH0001-NH0300) untuk ${count} jamaah yang belum memilih.`
    );
    realtimeBus.notify('voters_updated', all);

    const supabase = getSupabase();
    if (supabase && updatedVoters.length > 0) {
      const dbVoters = updatedVoters.map((v) => ({
        id: v.id,
        election_period_id: v.election_period_id,
        nisn: v.nisn,
        full_name: v.full_name,
        class_name: v.class_name,
        gender: v.gender,
        pin_plain: v.pin_plain,
        pin_hash: v.pin_hash,
        has_voted: v.has_voted,
        voted_at: v.voted_at,
      }));
      supabase.from('voters').upsert(dbVoters).then();
    }

    return count;
  },

  // SUARA (VOTES - TRANSAKSI ATOMIK BERBASIS TOKEN PIN UNIK)
  getVotes(periodId?: string): Vote[] {
    const votes = getItem<Vote[]>(STORAGE_KEYS.VOTES, generateInitialVotes());
    const targetPeriod = periodId || this.getActivePeriod()?.id;
    if (!targetPeriod) return votes;
    return votes.filter((v) => v.election_period_id === targetPeriod);
  },

  /**
   * Transaksi Pemilihan Atomik (Mendukung Login Cukup Gunakan Token PIN Saja):
   */
  async castVote(
    nisnOrToken: string,
    pin: string,
    candidateId: string
  ): Promise<{ success: boolean; message: string; voterName?: string }> {
    const activePeriod = this.getActivePeriod();
    if (!activePeriod) {
      return {
        success: false,
        message: 'Tidak ada periode pemilihan yang sedang berstatus AKTIF.',
      };
    }

    const school = this.getSchool();
    const boothAccess = getBoothAccessStatus(school);
    if (!boothAccess.isOpen) {
      return {
        success: false,
        message: `[KODE PERINGATAN: ERR-BOOTH-LOCKED] ${boothAccess.title}. ${boothAccess.reason}`,
      };
    }

    const allVoters = getItem<Voter[]>(STORAGE_KEYS.VOTERS, generateInitialVoters());
    const cleanPin = pin.trim().toUpperCase();
    const cleanNisn = nisnOrToken.trim();

    // Cari jamaah berdasarkan Token PIN saja ATAU kombinasi NIK + Token PIN
    let voter = allVoters.find(
      (v) =>
        v.election_period_id === activePeriod.id &&
        v.nisn.trim() === cleanNisn &&
        v.pin_plain.toUpperCase() === cleanPin
    );

    if (!voter) {
      // Fallback: cari berdasarkan Token PIN unik saja
      voter = allVoters.find(
        (v) =>
          v.election_period_id === activePeriod.id &&
          (v.pin_plain.toUpperCase() === cleanPin ||
            v.pin_plain.toUpperCase() === cleanNisn.toUpperCase())
      );
    }

    if (!voter) {
      return {
        success: false,
        message:
          '[KODE PERINGATAN: ERR-TOKEN-INVALID-404] Kode Token tidak ditemukan dalam Daftar Pemilih Tetap (DPT) Jamaah Masjid Nurul Hidayah.',
      };
    }

    if (voter.has_voted) {
      const usedTimeStr = voter.voted_at
        ? new Date(voter.voted_at).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }) + ' WIB'
        : 'sebelumnya';

      this.addAuditLog(
        voter.id,
        'Sistem Keamanan Bilik Suara',
        'REJECT_DUPLICATE_TOKEN',
        `PERCOBAAN PENGGUNAAN ULANG TOKEN DITOLAK: Token ${voter.pin_plain} (${voter.full_name} - ${voter.class_name}) sudah digunakan pada ${usedTimeStr}.`
      );

      return {
        success: false,
        message: `[KODE PERINGATAN: ERR-TOKEN-USED-403] DITOLAK OTOMATIS OLEH SISTEM! Kode Token "${voter.pin_plain}" atas nama Bapak/Ibu/Sdr. ${voter.full_name} (${voter.class_name}) SUDAH PERNAH DIGUNAKAN pada ${usedTimeStr}. Setiap Token hanya berlaku 1 (satu) kali pemberian suara dan terkunci permanen!`,
      };
    }

    // Jika mode pemilihan adalah 1 KK 1 Orang ('kk'), cek apakah ada anggota keluarga dengan No. KK yang sama yang sudah memilih
    if (school.voting_basis === 'kk' && voter.no_kk && voter.no_kk.length >= 6) {
      const familyAlreadyVoted = allVoters.find(
        (v) =>
          v.election_period_id === activePeriod.id &&
          v.id !== voter!.id &&
          v.no_kk === voter!.no_kk &&
          v.has_voted
      );
      if (familyAlreadyVoted) {
        return {
          success: false,
          message: `Berdasarkan aturan 1 Keluarga 1 Suara (No. KK: ${voter.no_kk}), hak suara keluarga ini telah diwakilkan oleh ${familyAlreadyVoted.full_name}.`,
        };
      }
    }

    // Verifikasi PIN
    const isPinValid =
      voter.pin_plain.toUpperCase() === cleanPin || (await verifyPin(cleanPin, voter.pin_hash));

    if (!isPinValid) {
      return {
        success: false,
        message: 'Kode Token PIN yang Anda masukkan tidak sesuai. Harap periksa kartu token Anda!',
      };
    }

    // Validasi Paslon
    const candidates = this.getCandidates(activePeriod.id);
    const candidateExists = candidates.some((c) => c.id === candidateId);
    if (!candidateExists) {
      return { success: false, message: 'Calon Ketua Masjid yang dipilih tidak valid.' };
    }

    // EKSEKUSI ATOMIK
    // 1. Simpan suara anonim ke tabel votes
    const allVotes = getItem<Vote[]>(STORAGE_KEYS.VOTES, generateInitialVotes());
    const newVote: Vote = {
      id: `vote-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      election_period_id: activePeriod.id,
      candidate_id: candidateId,
      created_at: new Date().toISOString(),
    };
    allVotes.push(newVote);
    setItem(STORAGE_KEYS.VOTES, allVotes);

    // 2. Tandai jamaah telah memilih
    voter.has_voted = true;
    voter.voted_at = new Date().toISOString();
    setItem(STORAGE_KEYS.VOTERS, allVoters);

    // 3. Catat audit trail secara anonim (tanpa merekam kandidat yang dipilih)
    this.addAuditLog(
      voter.id,
      'Jamaah (Pemilih)',
      'VOTE_CAST_ANONYMOUS',
      `Jamaah wilayah ${voter.class_name} (${voter.unsur || 'Warga'}) telah menyalurkan hak suaranya menggunakan Token di bilik suara.`
    );

    // 4. Emit realtime events
    realtimeBus.notify('vote_casted', { periodId: activePeriod.id });
    realtimeBus.notify('voters_updated', allVoters);

    // 5. Simpan ke Supabase jika aktif
    const supabase = getSupabase();
    if (supabase) {
      supabase
        .from('votes')
        .insert({
          id: newVote.id,
          election_period_id: newVote.election_period_id,
          candidate_id: newVote.candidate_id,
          created_at: newVote.created_at,
        })
        .then(({ error }) => {
          if (error) console.warn('Supabase castVote error:', error);
        });

      supabase
        .from('voters')
        .update({
          has_voted: true,
          voted_at: voter.voted_at,
        })
        .eq('id', voter.id)
        .then();
    }

    return {
      success: true,
      message: 'Alhamdulillah, suara Anda berhasil dicatat secara resmi dan amanah.',
      voterName: voter.full_name,
    };
  },

  // METRIK & STATISTIK HITUNG CEPAT (QUICK COUNT)
  getQuickCountStats(periodId?: string): {
    candidates: QuickCountStat[];
    metrics: ElectionMetrics;
  } {
    const targetPeriod = periodId || this.getActivePeriod()?.id;
    const candidates = this.getCandidates(targetPeriod);
    const votes = this.getVotes(targetPeriod);
    const voters = this.getVoters(targetPeriod);

    const totalVotes = votes.length;
    const totalDpt = voters.length;
    const totalVoted = voters.filter((v) => v.has_voted).length;
    const totalUnvoted = totalDpt - totalVoted;
    const participationRate = totalDpt > 0 ? (totalVoted / totalDpt) * 100 : 0;

    const palette = ['#059669', '#2563eb', '#7c3aed', '#d97706', '#db2777'];

    const candidateStats: QuickCountStat[] = candidates.map((cand, idx) => {
      const candVotes = votes.filter((v) => v.candidate_id === cand.id).length;
      const percentage = totalVotes > 0 ? (candVotes / totalVotes) * 100 : 0;
      return {
        candidate_id: cand.id,
        ballot_number: cand.ballot_number,
        chairman_name: cand.chairman_name,
        vice_chairman_name: cand.vice_chairman_name,
        votes_count: candVotes,
        percentage: Number(percentage.toFixed(1)),
        color: palette[idx % palette.length],
      };
    });

    return {
      candidates: candidateStats,
      metrics: {
        total_dpt: totalDpt,
        total_voted: totalVoted,
        total_unvoted: totalUnvoted,
        participation_rate: Number(participationRate.toFixed(1)),
      },
    };
  },

  // AUDIT TRAIL
  getAuditLogs(periodId?: string): AuditLog[] {
    const logs = getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, DEFAULT_AUDIT_LOGS);
    const targetPeriod = periodId || this.getActivePeriod()?.id;
    if (!targetPeriod) return logs;
    return logs
      .filter((l) => l.election_period_id === targetPeriod)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
  addAuditLog(userId: string, userRole: string, action: string, details: string): void {
    const logs = getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, DEFAULT_AUDIT_LOGS);
    const activePeriod = this.getActivePeriod();
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      election_period_id: activePeriod?.id || 'system',
      user_id: userId,
      user_role: userRole,
      action,
      details,
      ip_address: '192.168.1.100',
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    if (logs.length > 300) logs.pop();
    setItem(STORAGE_KEYS.AUDIT_LOGS, logs);
    realtimeBus.notify('audit_updated', logs);

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('audit_logs').insert(newLog).then();
    }
  },

  // MANAJEMEN USER SISTEM (ADMIN & PANITIA)
  getUsers(): AppUser[] {
    return getItem<AppUser[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
  },
  addUser(userData: Omit<AppUser, 'id' | 'created_at'>): AppUser {
    const users = this.getUsers();
    const userEmail = userData.email?.trim() || `${userData.username.trim()}@nurulhidayah.id`;
    const existing = users.find(
      (u) =>
        u.username.toLowerCase() === userData.username.toLowerCase() ||
        (u.email && u.email.toLowerCase() === userEmail.toLowerCase())
    );
    if (existing) {
      throw new Error('Username atau Email sudah terdaftar dalam sistem!');
    }
    const newUser: AppUser = {
      ...userData,
      email: userEmail,
      id: `user-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    users.push(newUser);
    setItem(STORAGE_KEYS.USERS, users);
    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'CREATE_USER',
      `Menambahkan akun petugas baru: ${newUser.name} (${newUser.username} - Role: ${newUser.role})`
    );
    realtimeBus.notify('users_updated', users);

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('users').insert(newUser).then();
    }

    return newUser;
  },
  updateUser(id: string, userData: Partial<AppUser>): AppUser {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('User tidak ditemukan');

    if (userData.username || userData.email) {
      const duplicate = users.find(
        (u) =>
          u.id !== id &&
          ((userData.username && u.username.toLowerCase() === userData.username.toLowerCase()) ||
            (userData.email && u.email && u.email.toLowerCase() === userData.email.toLowerCase()))
      );
      if (duplicate) {
        throw new Error('Username atau Email baru sudah digunakan oleh akun lain!');
      }
    }

    users[idx] = { ...users[idx], ...userData };
    setItem(STORAGE_KEYS.USERS, users);
    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'UPDATE_USER',
      `Memperbarui profil akun: ${users[idx].name} (${users[idx].username} - Role: ${users[idx].role})`
    );
    realtimeBus.notify('users_updated', users);

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('users').update(userData).eq('id', id).then();
    }

    return users[idx];
  },
  deleteUser(id: string): boolean {
    let users = this.getUsers();
    const target = users.find((u) => u.id === id);
    if (!target) return false;
    const adminCount = users.filter((u) => u.role === 'admin' && u.status === 'aktif').length;
    if (target.role === 'admin' && adminCount <= 1) {
      return false;
    }

    users = users.filter((u) => u.id !== id);
    setItem(STORAGE_KEYS.USERS, users);
    this.addAuditLog(
      'admin',
      'Admin Utama DKM',
      'DELETE_USER',
      `Menghapus akun petugas: ${target.name} (${target.username})`
    );
    realtimeBus.notify('users_updated', users);

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('users').delete().eq('id', id).then();
    }

    return true;
  },

  // STATUS & KONEKSI SUPABASE
  isSupabaseConnected(): boolean {
    return isSupabaseActive();
  },
  getSupabaseStatus() {
    return {
      isActive: isSupabaseActive(),
      config: getSupabaseConfig(),
    };
  },
  async syncFromSupabase(): Promise<boolean> {
    return syncFromSupabase();
  },
  async pushDataToSupabase(): Promise<{ success: boolean; message: string }> {
    return pushDataToSupabase();
  },
  async testSupabase(): Promise<{ success: boolean; message: string }> {
    return testSupabaseConnection();
  },
  async inspectSupabaseTables(): Promise<{
    success: boolean;
    message: string;
    tables: Array<{
      tableName: string;
      label: string;
      rowCount: number;
      sampleInfo: string;
    }>;
  }> {
    const supabase = getSupabase();
    if (!supabase) {
      return {
        success: false,
        message: 'Koneksi Supabase belum aktif. Simpan Project URL dan Anon Key terlebih dahulu.',
        tables: [],
      };
    }

    try {
      const [schoolsRes, periodsRes, committeesRes, candidatesRes, votersRes, votesRes, usersRes] =
        await Promise.all([
          supabase.from('schools').select('*'),
          supabase.from('election_periods').select('*'),
          supabase.from('committees').select('*'),
          supabase.from('candidates').select('*'),
          supabase.from('voters').select('*'),
          supabase.from('votes').select('*'),
          supabase.from('users').select('*'),
        ]);

      if (schoolsRes.error) {
        return {
          success: false,
          message: `Gagal membaca tabel Supabase: ${schoolsRes.error.message}`,
          tables: [],
        };
      }

      const schoolRow = schoolsRes.data?.[0];
      const activePeriodRow = periodsRes.data?.find((p: any) => p.status === 'aktif') || periodsRes.data?.[0];
      const votedCount = (votersRes.data || []).filter((v: any) => v.has_voted).length;

      return {
        success: true,
        message: 'Berhasil membaca data langsung (Real-Time) dari server PostgreSQL Supabase Anda!',
        tables: [
          {
            tableName: 'public.schools',
            label: 'Profil DKM Masjid',
            rowCount: schoolsRes.data?.length || 0,
            sampleInfo: schoolRow
              ? `${schoolRow.name} (Ketua: ${schoolRow.principal_name})`
              : 'Belum ada baris (Klik tombol Unggah Data ke Supabase)',
          },
          {
            tableName: 'public.election_periods',
            label: 'Periode Masa Khidmat',
            rowCount: periodsRes.data?.length || 0,
            sampleInfo: activePeriodRow
              ? `${activePeriodRow.period_name} (${activePeriodRow.academic_year})`
              : 'Belum ada baris',
          },
          {
            tableName: 'public.voters',
            label: 'DPT Jamaah & Token',
            rowCount: votersRes.data?.length || 0,
            sampleInfo:
              (votersRes.data?.length || 0) > 0
                ? `${votersRes.data?.length} Jamaah terdaftar (${votedCount} sudah memilih)`
                : 'Belum ada data jamaah di cloud',
          },
          {
            tableName: 'public.candidates',
            label: 'Calon Ketua DKM',
            rowCount: candidatesRes.data?.length || 0,
            sampleInfo:
              (candidatesRes.data?.length || 0) > 0
                ? candidatesRes.data.map((c: any) => `0${c.ballot_number}. ${c.chairman_name}`).join(', ')
                : 'Belum ada kandidat',
          },
          {
            tableName: 'public.votes',
            label: 'Kotak Suara Masuk',
            rowCount: votesRes.data?.length || 0,
            sampleInfo: `${votesRes.data?.length || 0} suara sah tersimpan di Cloud`,
          },
          {
            tableName: 'public.committees',
            label: 'SK Panitia Pemilihan',
            rowCount: committeesRes.data?.length || 0,
            sampleInfo:
              (committeesRes.data?.length || 0) > 0
                ? `${committeesRes.data?.length} anggota panitia terdaftar`
                : 'Belum ada panitia',
          },
          {
            tableName: 'public.users',
            label: 'Akun Admin & Panitia',
            rowCount: usersRes.data?.length || 0,
            sampleInfo:
              (usersRes.data?.length || 0) > 0
                ? `${usersRes.data?.length} akun petugas aktif`
                : 'Belum ada akun',
          },
        ],
      };
    } catch (err) {
      return {
        success: false,
        message: `Kesalahan saat memeriksa tabel Supabase: ${(err as Error).message}`,
        tables: [],
      };
    }
  },

  // RESET KE DATA AWAL MASJID NURUL HIDAYAH
  resetToDefault(): void {
    localStorage.removeItem(STORAGE_KEYS.SCHOOL);
    localStorage.removeItem(STORAGE_KEYS.PERIODS);
    localStorage.removeItem(STORAGE_KEYS.COMMITTEES);
    localStorage.removeItem(STORAGE_KEYS.CANDIDATES);
    localStorage.removeItem(STORAGE_KEYS.VOTERS);
    localStorage.removeItem(STORAGE_KEYS.VOTES);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    initializeStorage();
    if (isSupabaseActive()) {
      pushDataToSupabase();
    }
    realtimeBus.notify('data_reset');
  },
};

// Auto inisialisasi pada load
initializeStorage();
