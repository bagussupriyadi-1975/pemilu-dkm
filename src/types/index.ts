export type OrganizationType = 'DKM' | 'TAKMIR' | 'OSIS' | 'OSIM';

export type ElectionStatus = 'draft' | 'aktif' | 'selesai';

export type UserRole = 'public' | 'siswa' | 'panitia' | 'admin';

export type PanitiaTab = 'dpt' | 'token' | 'paslon' | 'monitoring' | 'password';
export type AdminTab =
  | 'sekolah'
  | 'kandidat_admin'
  | 'dpt_admin'
  | 'token_admin'
  | 'users'
  | 'panitia'
  | 'periode'
  | 'audit_bahp'
  | 'password'
  | 'supabase';

export type AppUserRole = 'admin' | 'panitia' | 'operator' | 'pengawas';

export type UnsurJamaahType = 'Jamaah' | 'Jamaah + Pengurus';

export type VotingBasisMode = 'kk' | 'unsur' | 'semua';

export interface AppUser {
  id: string;
  name: string;
  email?: string;
  username: string;
  role: AppUserRole;
  password?: string;
  status: 'aktif' | 'nonaktif';
  created_at: string;
  last_login?: string;
}

export interface AuthUser {
  id?: string;
  role: 'panitia' | 'admin';
  name: string;
  email: string;
  username?: string;
  avatar?: string;
}

export type BoothLockMode = 'auto' | 'force_open' | 'force_locked';

export interface School {
  id: string;
  name: string;
  npsn: string; // Nomor ID Masjid / NKM / SK Kemendagri
  type: OrganizationType;
  logo_url: string;
  address: string;
  principal_name: string; // Ketua Masjid / DKM Saat Ini (Feriyanto)
  principal_nip: string; // Masa Khidmat / No. SK Pengurus
  voting_basis?: VotingBasisMode; // 'kk' (1 KK 1 Suara) | 'unsur' (Berdasarkan Unsur Jamaah) | 'semua'
  lingkungan_name?: string; // e.g., "Lingkungan II Kel. Kuripan, Kec. Telukbetung Barat, Bandar Lampung"
  booth_lock_mode?: BoothLockMode; // 'auto' (Ikuti Jadwal) | 'force_open' (Dibuka Panitia) | 'force_locked' (Dikunci Panitia)
  voting_start_datetime?: string; // Waktu dibuka token/bilik suara (YYYY-MM-DDTHH:mm)
  voting_end_datetime?: string; // Waktu ditutup token/bilik suara (YYYY-MM-DDTHH:mm)
  voting_location?: string; // Tempat pelaksanaan pemilihan
}

export interface ElectionPeriod {
  id: string;
  school_id: string;
  period_name: string;
  academic_year: string;
  status: ElectionStatus;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface Committee {
  id: string;
  election_period_id: string;
  sk_number: string;
  sk_date: string;
  sk_file_name?: string;
  member_name: string;
  role: 'Ketua Panitia' | 'Sekretaris' | 'Bendahara' | 'Seksi Bilik Suara' | 'Seksi Teknis IT' | 'Anggota';
  email: string;
  status: 'aktif' | 'nonaktif';
}

export interface Candidate {
  id: string;
  election_period_id: string;
  ballot_number: number;
  chairman_name: string;
  vice_chairman_name: string;
  chairman_class: string; // RT / Lingkungan Calon Ketua
  vice_chairman_class: string; // RT / Lingkungan Calon Wakil/Sekretaris
  photo_url: string;
  vision: string;
  mission: string[];
  programs: string[];
  video_url?: string;
  color_theme?: string;
}

export interface Voter {
  id: string;
  election_period_id: string;
  nisn: string; // Digunakan sebagai NIK KTP (16 digit) / No. ID Jamaah (kompatibel dengan kolom nisn di Supabase)
  no_kk?: string; // Nomor Kartu Keluarga (16 digit) untuk opsi 1 KK 1 Orang
  full_name: string; // Nama Lengkap sesuai KTP
  class_name: string; // Wilayah RT & Lingkungan: "RT.03 Lk.II", "RT.04 Lk.II", "RT.05 Lk.II"
  unsur?: UnsurJamaahType; // Unsur Jamaah: Bapak-bapak, Ibu Majelis Taklim, Remaja Masjid
  gender: 'L' | 'P';
  birth_place?: string; // Tempat Lahir (KTP)
  birth_date?: string; // Tanggal Lahir (KTP)
  address_ktp?: string; // Alamat Lengkap sesuai KTP
  religion?: string; // Agama (Islam)
  marital_status?: 'Kawin' | 'Belum Kawin' | 'Cerai Hidup' | 'Cerai Mati'; // Status Perkawinan KTP
  occupation?: string; // Pekerjaan sesuai KTP
  phone?: string; // Nomor WhatsApp / HP
  is_kk_representative?: boolean; // Penanda perwakilan 1 Keluarga 1 Suara (Berdasarkan KK)
  pin_hash: string;
  pin_plain: string; // Kode Token Unik untuk memilih di Bilik Suara
  has_voted: boolean;
  voted_at: string | null;
}

export interface Vote {
  id: string;
  election_period_id: string;
  candidate_id: string;
  created_at: string; // Anonymous, decoupled from voter_id to preserve secrecy
}

export interface AuditLog {
  id: string;
  election_period_id: string;
  user_id: string;
  user_role: string;
  action: string;
  details: string;
  ip_address: string;
  timestamp: string;
}

export interface QuickCountStat {
  candidate_id: string;
  ballot_number: number;
  chairman_name: string;
  vice_chairman_name: string;
  votes_count: number;
  percentage: number;
  color: string;
}

export interface ElectionMetrics {
  total_dpt: number;
  total_voted: number;
  total_unvoted: number;
  participation_rate: number;
}
