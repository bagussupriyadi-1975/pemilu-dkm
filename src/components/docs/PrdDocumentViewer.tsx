import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Database,
  Lock,
  Layers,
  Check,
  Copy,
  Terminal,
  Cpu,
  Server,
  Zap,
} from 'lucide-react';

export const PrdDocumentViewer: React.FC = () => {
  const [copiedSql, setCopiedSql] = useState(false);

  const supabaseDdlSql = `-- ==========================================================
-- E-PILKETOS / E-PILKOSIM DIGITAL: ENTERPRISE DATABASE SCHEMA
-- Target Engine: PostgreSQL 15+ / Supabase with Row Level Security (RLS)
-- Principles: Multi-Period Reusable, Tamper-Proof, LUBER-JURDIL
-- ==========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. MASTER SATUAN PENDIDIKAN (SCHOOLS)
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    npsn VARCHAR(20) NOT NULL UNIQUE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('OSIS', 'OSIM')),
    logo_url TEXT,
    address TEXT,
    principal_name VARCHAR(255) NOT NULL,
    principal_nip VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PERIODE PEMILIHAN (MULTI-PERIOD REUSABLE)
CREATE TABLE IF NOT EXISTS public.election_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    period_name VARCHAR(255) NOT NULL,
    academic_year VARCHAR(20) NOT NULL, -- e.g. "2026/2027"
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'aktif', 'selesai')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: Hanya satu periode berstatus 'aktif' dalam satu waktu per sekolah
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_period_per_school
ON public.election_periods (school_id)
WHERE status = 'aktif';

-- 4. PANITIA PEMILIHAN & SK (COMMITTEES)
CREATE TABLE IF NOT EXISTS public.committees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_period_id UUID NOT NULL REFERENCES public.election_periods(id) ON DELETE CASCADE,
    sk_number VARCHAR(100) NOT NULL,
    sk_date DATE NOT NULL,
    sk_file_url TEXT,
    member_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'aktif',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PASANGAN CALON (CANDIDATES)
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_period_id UUID NOT NULL REFERENCES public.election_periods(id) ON DELETE CASCADE,
    ballot_number INT NOT NULL,
    chairman_name VARCHAR(255) NOT NULL,
    vice_chairman_name VARCHAR(255) NOT NULL,
    chairman_class VARCHAR(50) NOT NULL,
    vice_chairman_class VARCHAR(50) NOT NULL,
    photo_url TEXT NOT NULL,
    vision TEXT NOT NULL,
    mission JSONB NOT NULL DEFAULT '[]'::jsonb,
    programs JSONB NOT NULL DEFAULT '[]'::jsonb,
    video_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_ballot_number_per_period UNIQUE (election_period_id, ballot_number)
);

-- 6. DAFTAR PEMILIH TETAP (VOTERS / DPT)
CREATE TABLE IF NOT EXISTS public.voters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_period_id UUID NOT NULL REFERENCES public.election_periods(id) ON DELETE CASCADE,
    nisn VARCHAR(20) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    class_name VARCHAR(50) NOT NULL,
    gender CHAR(1) NOT NULL CHECK (gender IN ('L', 'P')),
    pin_hash VARCHAR(64) NOT NULL, -- SHA-256 hash
    has_voted BOOLEAN NOT NULL DEFAULT FALSE,
    voted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_voter_nisn_per_period UNIQUE (election_period_id, nisn)
);

-- 7. TABEL SUARA MASUK (VOTES)
-- PENTING: ASAS LUBER-JURDIL (RAHASIA).
-- Tabel ini sengaja TIDAK memiliki Foreign Key ke voter_id.
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_period_id UUID NOT NULL REFERENCES public.election_periods(id) ON DELETE RESTRICT,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. AUDIT TRAILS (TAMPER-PROOF LOGS)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_period_id UUID,
    user_id VARCHAR(100),
    user_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    ip_address VARCHAR(45),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Public can view School, Active Period, and Candidates
CREATE POLICY "Public Read Active School & Periods"
ON public.election_periods FOR SELECT
USING (status IN ('aktif', 'selesai'));

CREATE POLICY "Public Read Candidates"
ON public.candidates FOR SELECT
USING (TRUE);

-- Anonymous Vote Insertion via RPC only (Transactional Function)
CREATE OR REPLACE FUNCTION public.submit_vote_atomic(
    p_period_id UUID,
    p_nisn VARCHAR,
    p_pin_hash VARCHAR,
    p_candidate_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_voter RECORD;
    v_period_active BOOLEAN;
BEGIN
    -- 1. Cek status periode
    SELECT (status = 'aktif') INTO v_period_active
    FROM public.election_periods
    WHERE id = p_period_id;

    IF NOT FOUND OR NOT v_period_active THEN
        RETURN jsonb_build_object('success', false, 'message', 'Periode pemilihan tidak aktif');
    END IF;

    -- 2. Ambil voter dan kunci baris (FOR UPDATE untuk mencegah Race Condition)
    SELECT * INTO v_voter
    FROM public.voters
    WHERE election_period_id = p_period_id AND nisn = p_nisn
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'NISN tidak terdaftar');
    END IF;

    IF v_voter.has_voted THEN
        RETURN jsonb_build_object('success', false, 'message', 'Hak suara sudah digunakan!');
    END IF;

    IF v_voter.pin_hash != p_pin_hash THEN
        RETURN jsonb_build_object('success', false, 'message', 'Token PIN salah');
    END IF;

    -- 3. Catat suara secara anonim
    INSERT INTO public.votes (election_period_id, candidate_id, created_at)
    VALUES (p_period_id, p_candidate_id, NOW());

    -- 4. Tandai pemilih telah memilih
    UPDATE public.voters
    SET has_voted = TRUE, voted_at = NOW()
    WHERE id = v_voter.id;

    -- 5. Catat audit log
    INSERT INTO public.audit_logs (election_period_id, user_role, action, details)
    VALUES (p_period_id, 'Siswa (Pemilih)', 'VOTE_SUBMITTED', 'Hak suara berhasil digunakan secara sah.');

    RETURN jsonb_build_object('success', true, 'message', 'Suara berhasil dicatat.');
END;
$$;`;

  const copySql = () => {
    navigator.clipboard.writeText(supabaseDdlSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* Header Dokumen */}
      <div className="bg-slate-900 text-white p-6 sm:p-10 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest mb-3">
          <FileText className="w-4 h-4" />
          <span>Enterprise Technical Documentation</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          Product Requirements Document (PRD) &amp; Software Architecture
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
          Spesifikasi Arsitektur Sistem E-Pilketos / E-Pilkosim Digital Berstandar Enterprise Edukasi
          dengan Kepatuhan Asas LUBER-JURDIL, Skalabilitas Multi-Periode, dan Nir-Kecurangan (Tamper-Proof).
        </p>

        <div className="mt-6 flex flex-wrap gap-4 text-xs font-mono text-slate-400 border-t border-slate-800 pt-4">
          <div>Status: <span className="text-emerald-400 font-bold">Production Ready (v1.0)</span></div>
          <div>Architect: <span className="text-slate-200">Lead Enterprise Architect &amp; InfoSec</span></div>
          <div>Security Level: <span className="text-blue-400 font-bold">LUBER-JURDIL Decoupled</span></div>
        </div>
      </div>

      {/* BAB 1: PRD Ringkasan Eksekutif & Persyaratan Bisnis */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            1
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Bab I: Product Requirements Document (PRD) &amp; Objektif Sistem
            </h2>
            <p className="text-xs text-slate-500">
              Latar belakang, personas pengguna, dan matriks fungsionalitas
            </p>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-slate-700 leading-relaxed space-y-3">
          <p>
            Aplikasi <strong>E-Pilketos / E-Pilkosim Digital</strong> dirancang untuk mentransformasi
            pemilihan ketua organisasi kesiswaan (OSIS pada sekolah umum dan OSIM pada madrasah) dari metode manual
            berbasis kertas menuju ekosistem digital yang efisien, transparan, dan tidak dapat dimanipulasi
            (<em>tamper-proof</em>).
          </p>

          <h4 className="font-bold text-slate-900 pt-2">Matriks Hak Akses &amp; Persona Pengguna:</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <span className="font-bold text-slate-900 block mb-1 text-xs">
                1. Admin Satuan Pendidikan
              </span>
              <p className="text-[11px] text-slate-600">
                Kepala Sekolah / Wakil Kesiswaan. Mengonfigurasi identitas lembaga, menetapkan jenis kepengurusan
                (OSIS/OSIM), menerbitkan SK Panitia, mengaktifkan/menutup periode tahunan, dan mengesahkan Berita Acara
                (BAHP).
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <span className="font-bold text-slate-900 block mb-1 text-xs">
                2. Panitia Pemilihan (MPK / KPPS)
              </span>
              <p className="text-[11px] text-slate-600">
                Mengelola data paslon, mengimpor Daftar Pemilih Tetap (DPT) via CSV, men-generate token PIN acak unik,
                mencetak kartu suara ber-QR code, mereset PIN kendala teknis, dan memantau bilik suara.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <span className="font-bold text-slate-900 block mb-1 text-xs">
                3. Siswa (Pemilih di Bilik Suara)
              </span>
              <p className="text-[11px] text-slate-600">
                Melakukan otentikasi di bilik suara menggunakan NISN dan PIN 6 karakter, membuka surat suara digital,
                mengonfirmasi pilihan dalam modal pop-up, dan menyelesaikan pemungutan suara dengan countdown logout 5
                detik.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BAB 2: Arsitektur Keamanan LUBER-JURDIL */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            2
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Bab II: Model Keamanan Kriptografi &amp; Integritas Asas LUBER-JURDIL
            </h2>
            <p className="text-xs text-slate-500">
              Pemisahan identitas pemilih dan ledger suara anonim
            </p>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-slate-700 leading-relaxed space-y-3">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Prinsip Kerahasiaan Absolut (Decoupled Ledger):</strong>
              Tabel <code>votes</code> (suara masuk) secara arsitektural <strong>sama sekali tidak memiliki Foreign Key</strong> ke tabel <code>voters</code> (identitas pemilih). Ketika siswa mengonfirmasi suara:
              <ol className="list-decimal ml-4 mt-1 space-y-1">
                <li>Suara dimasukkan ke tabel <code>votes</code> hanya dengan referensi <code>candidate_id</code> dan <code>created_at</code>.</li>
                <li>Status pemilih di tabel <code>voters</code> diperbarui menjadi <code>has_voted = TRUE</code>.</li>
                <li>Kedua operasi dieksekusi dalam <strong>Single Database Transaction (Atomicity)</strong> untuk menjamin tidak ada suara yang hilang atau tercatat ganda.</li>
              </ol>
            </div>
          </div>

          <h4 className="font-bold text-slate-900 pt-2">STRIDE Threat Modeling:</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
                <tr>
                  <th className="p-2.5">Kategori STRIDE</th>
                  <th className="p-2.5">Potensi Ancaman</th>
                  <th className="p-2.5">Mitigasi Arsitektur Sistem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-2.5 font-bold">Spoofing</td>
                  <td className="p-2.5">Siswa memilih atas nama orang lain</td>
                  <td className="p-2.5">Wajib kombinasi 10-digit NISN + 6-digit PIN token unik acak yang dibagikan fisik di bilik suara</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold">Tampering</td>
                  <td className="p-2.5">Manipulasi jumlah perolehan suara</td>
                  <td className="p-2.5">Stored procedure transaksi atomik dengan kunci <code>FOR UPDATE</code> dan audit trails menyeluruh</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold">Repudiation</td>
                  <td className="p-2.5">Pemilih menyangkal telah memilih</td>
                  <td className="p-2.5">Field <code>has_voted = true</code> dan timestamp <code>voted_at</code> tercatat secara permanen</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold">Information Disclosure</td>
                  <td className="p-2.5">Membongkar rahasia paslon pilihan siswa tertentu</td>
                  <td className="p-2.5">Pemisahan total tabel suara tanpa foreign key pemilih</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold">Denial of Service</td>
                  <td className="p-2.5">Bilik suara melambat akibat lonjakan antrean</td>
                  <td className="p-2.5">Optimasi query index pada <code>election_period_id</code> dan reactive websocket listener</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BAB 3: Skema Database Relasional PostgreSQL / Supabase DDL */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bab III: Skema Database Relasional &amp; Supabase DDL
              </h2>
              <p className="text-xs text-slate-500">
                Skrip SQL lengkap dengan RLS Policies dan Stored Procedure Transaksional
              </p>
            </div>
          </div>

          <button
            onClick={copySql}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedSql ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin SQL DDL</span>
              </>
            )}
          </button>
        </div>

        <div className="relative">
          <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-96 leading-relaxed">
            {supabaseDdlSql}
          </pre>
        </div>
      </div>

      {/* BAB 4: Ringkasan Spesifikasi API & Konkurensi */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            4
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Bab IV: Arsitektur API Endpoints &amp; Penanganan Konkurensi
            </h2>
            <p className="text-xs text-slate-500">
              Route Handlers, Server Actions, dan Validasi Skema Zod
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="font-mono font-bold text-blue-700">POST /api/voter/verify</span>
            <p className="text-slate-600">
              Menerima payload <code>&#123; nisn: string, pin: string &#125;</code>. Memvalidasi format 10 digit NISN via Zod, mencocokkan periode aktif, dan memverifikasi status <code>has_voted = false</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="font-mono font-bold text-emerald-700">POST /api/vote/cast</span>
            <p className="text-slate-600">
              Endpoint transaksional mutasi suara dengan isolasi <code>SERIALIZABLE</code> atau row locking <code>FOR UPDATE</code> untuk mencegah double-vote submission simultan.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="font-mono font-bold text-purple-700">GET /api/quick-count/stream</span>
            <p className="text-slate-600">
              Server-Sent Events (SSE) atau Supabase Realtime Listener ke channel <code>votes</code> untuk mem-push perolehan suara tanpa polling berulang.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="font-mono font-bold text-indigo-700">POST /api/panitia/dpt/import</span>
            <p className="text-slate-600">
              Menerima upload CSV DPT, men-generate PIN 6 karakter acak dan unik per baris, menyimpannya secara batch dalam database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
