-- ==============================================================================
-- SKEMA DATABASE SUPABASE (POSTGRESQL) - PEMILIHAN KETUA MASJID NURUL HIDAYAH
-- Jalan Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan, Kec. Telukbetung Barat, Kota Bandar Lampung
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABEL PROFIL MASJID / DKM (schools)
CREATE TABLE IF NOT EXISTS public.schools (
    id TEXT PRIMARY KEY DEFAULT 'sch-01',
    name TEXT NOT NULL,
    npsn TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'DKM',
    logo_url TEXT,
    address TEXT NOT NULL,
    principal_name TEXT NOT NULL,
    principal_nip TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABEL PERIODE PEMILIHAN (election_periods)
CREATE TABLE IF NOT EXISTS public.election_periods (
    id TEXT PRIMARY KEY,
    school_id TEXT REFERENCES public.schools(id) ON DELETE CASCADE,
    period_name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'aktif', 'selesai')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL SUSUNAN KEPANITIAAN SK (committees)
CREATE TABLE IF NOT EXISTS public.committees (
    id TEXT PRIMARY KEY,
    election_period_id TEXT REFERENCES public.election_periods(id) ON DELETE CASCADE,
    sk_number TEXT NOT NULL,
    sk_date DATE NOT NULL,
    sk_file_name TEXT,
    member_name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL CALON KETUA & PENGURUS MASJID (candidates)
CREATE TABLE IF NOT EXISTS public.candidates (
    id TEXT PRIMARY KEY,
    election_period_id TEXT REFERENCES public.election_periods(id) ON DELETE CASCADE,
    ballot_number INT NOT NULL,
    chairman_name TEXT NOT NULL,
    vice_chairman_name TEXT NOT NULL,
    chairman_class TEXT NOT NULL,
    vice_chairman_class TEXT NOT NULL,
    photo_url TEXT,
    vision TEXT NOT NULL,
    mission JSONB NOT NULL DEFAULT '[]'::jsonb,
    programs JSONB NOT NULL DEFAULT '[]'::jsonb,
    video_url TEXT,
    color_theme TEXT DEFAULT 'emerald',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL DAFTAR PEMILIH TETAP / JAMAAH RT.03, RT.04, RT.05 LK.II (voters)
CREATE TABLE IF NOT EXISTS public.voters (
    id TEXT PRIMARY KEY,
    election_period_id TEXT REFERENCES public.election_periods(id) ON DELETE CASCADE,
    nisn TEXT NOT NULL,
    full_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    gender VARCHAR(2) NOT NULL CHECK (gender IN ('L', 'P')),
    pin_plain TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    has_voted BOOLEAN NOT NULL DEFAULT FALSE,
    voted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_nisn_per_period UNIQUE (election_period_id, nisn)
);

-- 6. TABEL BRANKAS SUARA SAH - ANONIM (votes)
CREATE TABLE IF NOT EXISTS public.votes (
    id TEXT PRIMARY KEY,
    election_period_id TEXT REFERENCES public.election_periods(id) ON DELETE CASCADE,
    candidate_id TEXT REFERENCES public.candidates(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL AUDIT LOG & AKTIVITAS SISTEM (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    election_period_id TEXT,
    user_id TEXT,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    ip_address TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABEL PENGGUNA APLIKASI (users)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'panitia', 'operator', 'pengawas')),
    password TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- ==============================================================================
-- DATA AWAL RESMI: MASJID NURUL HIDAYAH (RT.03, RT.04, RT.05 LK.II KEL. KURIPAN)
-- ==============================================================================

INSERT INTO public.schools (id, name, npsn, type, logo_url, address, principal_name, principal_nip)
VALUES (
    'sch-01',
    'Dewan Kemakmuran Masjid (DKM) Nurul Hidayah',
    '01.4.08.01.04.000124',
    'DKM',
    'https://bagus-supriyadi.biz.id/uploads/LOGO%20NURUL%20HIDAYAH.png',
    'Jalan Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan, Kec. Telukbetung Barat, Kota Bandar Lampung',
    'Feriyanto',
    'SK-DKM/NH/04/LK-II/2026'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    npsn = EXCLUDED.npsn,
    type = EXCLUDED.type,
    logo_url = EXCLUDED.logo_url,
    address = EXCLUDED.address,
    principal_name = EXCLUDED.principal_name,
    principal_nip = EXCLUDED.principal_nip;

INSERT INTO public.election_periods (id, school_id, period_name, academic_year, status, start_date, end_date)
VALUES 
(
    'period-2026',
    'sch-01',
    'Pemilihan Ketua Dewan Kemakmuran Masjid (DKM) Nurul Hidayah',
    '2026 - 2028',
    'aktif',
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '10 hours'
) ON CONFLICT (id) DO UPDATE SET
    period_name = EXCLUDED.period_name,
    academic_year = EXCLUDED.academic_year,
    status = EXCLUDED.status;

-- Akun Admin Utama (Bagus Supriyadi) & Panitia Jamaah (Password awal: dkmnh12345)
INSERT INTO public.users (id, name, email, username, role, password, status)
VALUES
('user-01', 'Bagus Supriyadi', 'bagus.supriyadi.tbb@gmail.com', 'dkmnh12345', 'admin', 'dkmnh12345', 'aktif'),
('user-02', 'Yodi Purnawan (Ketua Panitia - RT.04 Lk.II)', 'yodi.purnawan@nurulhidayah.id', 'yodi', 'panitia', 'dkmnh12345', 'aktif'),
('user-03', 'David Firdaus (Sekretaris Panitia - RT.03 Lk.II)', 'david.firdaus@nurulhidayah.id', 'david', 'panitia', 'dkmnh12345', 'aktif'),
('user-04', 'Anton Hindratno (Bendahara Panitia - RT.05 Lk.II)', 'anton.hindratno@nurulhidayah.id', 'anton', 'panitia', 'dkmnh12345', 'aktif'),
('user-05', 'Nanda Feri Irawan (Petugas Bilik & IT - RT.04 Lk.II)', 'nanda.feri@nurulhidayah.id', 'nanda', 'operator', 'dkmnh12345', 'aktif'),
('user-06', 'Suhargito (Petugas Bilik & Saksi - RT.03 Lk.II)', 'suhargito@nurulhidayah.id', 'suhargito', 'pengawas', 'dkmnh12345', 'aktif')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    role = EXCLUDED.role,
    password = EXCLUDED.password;
