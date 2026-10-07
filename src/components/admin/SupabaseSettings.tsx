import React, { useState, useEffect } from 'react';
import { db } from '../../lib/storage';
import { saveCustomSupabaseConfig, clearCustomSupabaseConfig } from '../../lib/supabase';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Server,
  Zap,
  HelpCircle,
  Eye,
  EyeOff,
  Code,
  UploadCloud,
  Table,
  ListChecks,
} from 'lucide-react';

export const SupabaseSettings: React.FC = () => {
  const [supabaseStatus, setSupabaseStatus] = useState(db.getSupabaseStatus());
  const [urlInput, setUrlInput] = useState(supabaseStatus.config.url || '');
  const [keyInput, setKeyInput] = useState(supabaseStatus.config.key || '');
  const [showKey, setShowKey] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  // State Pembuktian / Live Inspector Tabel Supabase
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectData, setInspectData] = useState<{
    success: boolean;
    message: string;
    tables: Array<{
      tableName: string;
      label: string;
      rowCount: number;
      sampleInfo: string;
    }>;
  } | null>(null);

  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlViewer, setShowSqlViewer] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const current = db.getSupabaseStatus();
    setSupabaseStatus(current);
    setUrlInput(current.config.url);
    setKeyInput(current.config.key);
    if (current.isActive) {
      handleInspectTables();
    }
  }, []);

  const handleInspectTables = async () => {
    setIsInspecting(true);
    try {
      const res = await db.inspectSupabaseTables();
      setInspectData(res);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await db.testSupabase();
      setTestResult(res);
      setSupabaseStatus(db.getSupabaseStatus());
      if (res.success) {
        await handleInspectTables();
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `Terjadi kendala koneksi: ${(err as Error).message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !keyInput.trim()) {
      setTestResult({
        success: false,
        message: 'Mohon isi Project URL dan Anon Key Supabase Anda!',
      });
      return;
    }

    if (!urlInput.startsWith('http')) {
      setTestResult({
        success: false,
        message: 'URL harus berawalan https://',
      });
      return;
    }

    saveCustomSupabaseConfig(urlInput.trim(), keyInput.trim());
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3500);

    const updated = db.getSupabaseStatus();
    setSupabaseStatus(updated);

    setIsTesting(true);
    const res = await db.testSupabase();
    setTestResult(res);
    setIsTesting(false);
    if (res.success) {
      await handleInspectTables();
    }
  };

  const handleResetConfig = () => {
    clearCustomSupabaseConfig();
    const updated = db.getSupabaseStatus();
    setSupabaseStatus(updated);
    setUrlInput(updated.config.url);
    setKeyInput(updated.config.key);
    setTestResult(null);
    setInspectData(null);
    setConfirmReset(false);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncSuccess(null);
    try {
      const ok = await db.syncFromSupabase();
      setSyncSuccess(
        ok
          ? 'Sinkronisasi berhasil! Data terbaru dari Supabase telah dimuat.'
          : 'Gagal menyinkronkan data dari Supabase.'
      );
      await handleInspectTables();
      setTimeout(() => setSyncSuccess(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushToSupabase = async () => {
    setIsPushing(true);
    setSyncSuccess(null);
    try {
      const res = await db.pushDataToSupabase();
      setSyncSuccess(res.message);
      await handleInspectTables();
      setTimeout(() => setSyncSuccess(null), 5000);
    } finally {
      setIsPushing(false);
    }
  };

  const sqlSample = `-- ==============================================================================
-- SKEMA DATABASE SUPABASE (POSTGRESQL) - DKM NURUL HIDAYAH (2026 - 2028)
-- Jalan Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan, Kec. Telukbetung Barat, Bandar Lampung
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabel Profil DKM Masjid (schools)
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

-- 2. Tabel Periode Pemilihan (election_periods)
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

-- 3. Tabel SK & Panitia Pemilihan (committees)
CREATE TABLE IF NOT EXISTS public.committees (
    id TEXT PRIMARY KEY,
    election_period_id TEXT REFERENCES public.election_periods(id) ON DELETE CASCADE,
    sk_number TEXT NOT NULL,
    sk_date DATE NOT NULL,
    sk_file_name TEXT,
    member_name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'aktif',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel Calon Ketua DKM (candidates)
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

-- 5. Tabel Daftar Pemilih Tetap / Jamaah RT.03, RT.04, RT.05 Lk.II (voters)
CREATE TABLE IF NOT EXISTS public.voters (
    id TEXT PRIMARY KEY,
    election_period_id TEXT REFERENCES public.election_periods(id) ON DELETE CASCADE,
    nisn TEXT NOT NULL,
    full_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    gender TEXT NOT NULL,
    pin_plain TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    has_voted BOOLEAN DEFAULT FALSE,
    voted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_voter_period_nisn UNIQUE (election_period_id, nisn)
);

-- 6. Tabel Suara Anonim (votes)
CREATE TABLE IF NOT EXISTS public.votes (
    id TEXT PRIMARY KEY,
    election_period_id TEXT REFERENCES public.election_periods(id) ON DELETE CASCADE,
    candidate_id TEXT REFERENCES public.candidates(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabel Audit Trail Sistem (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    election_period_id TEXT,
    user_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    ip_address TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabel Akun Admin Utama & Panitia (users)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aktif',
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Seed Data Profil DKM Nurul Hidayah
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
    type = EXCLUDED.type,
    logo_url = EXCLUDED.logo_url,
    address = EXCLUDED.address,
    principal_name = EXCLUDED.principal_name,
    principal_nip = EXCLUDED.principal_nip;

-- Tampilkan hasil pembuatan tabel agar muncul baris di SQL Editor:
SELECT id, name, principal_name, address FROM public.schools;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSample);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900">
                  Integrasi Database Cloud Supabase — DKM Nurul Hidayah
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1 ${
                    supabaseStatus.isActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      supabaseStatus.isActive ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  {supabaseStatus.isActive ? 'Cloud Aktif & Terhubung' : 'Mode Penyimpanan Lokal'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Menyimpan seluruh data DKM Nurul Hidayah Masa Khidmat 2026 - 2028, 27 Jamaah RT.03–05 Lk.II, Token Suara (NH0001–NH0300), dan hasil pemilihan ke database PostgreSQL Supabase Anda.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handlePushToSupabase}
              disabled={isPushing || !supabaseStatus.isActive}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
              title="Unggah Data DKM Nurul Hidayah ke Supabase"
            >
              <UploadCloud className={`w-3.5 h-3.5 ${isPushing ? 'animate-bounce' : ''}`} />
              <span>
                {isPushing ? 'Mengunggah...' : '1. Unggah Data DKM ke Supabase'}
              </span>
            </button>
            <button
              onClick={handleInspectTables}
              disabled={isInspecting || !supabaseStatus.isActive}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <Table className={`w-3.5 h-3.5 ${isInspecting ? 'animate-spin' : ''}`} />
              <span>{isInspecting ? 'Memeriksa...' : '2. Buktikan & Cek Isi Tabel Cloud'}</span>
            </button>
            <button
              onClick={handleSyncNow}
              disabled={isSyncing || !supabaseStatus.isActive}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Tarik Data Supabase'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {testResult && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {syncSuccess && (
          <div className="mt-4 p-3.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncSuccess}</span>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="mt-4 p-3.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Kredensial Supabase berhasil disimpan dan diaktifkan.</span>
          </div>
        )}
      </div>

      {/* PANEL PEMBUKTIAN LIVE: ISI TABEL DI SERVER SUPABASE */}
      <div className="bg-white p-6 rounded-2xl border-2 border-emerald-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold uppercase">
              <ListChecks className="w-3.5 h-3.5" />
              Pembuktian Koneksi &amp; Isi Tabel Supabase
            </span>
            <h4 className="text-sm sm:text-base font-black text-slate-900 mt-1">
              Apakah pesan &ldquo;Success. No rows returned&rdquo; di SQL Editor Supabase itu benar?
            </h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              <strong>YA, 100% BENAR &amp; BERHASIL!</strong> Di PostgreSQL Supabase, perintah{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-emerald-800">
                CREATE TABLE
              </code>{' '}
              berfungsi membuat struktur tabel sehingga keterangannya memang{' '}
              <em>&ldquo;Success. No rows returned&rdquo;</em>. Selanjutnya, klik tombol kuning{' '}
              <strong>&ldquo;1. Unggah Data DKM ke Supabase&rdquo;</strong> di atas agar ke-27 data Jamaah &amp; Calon Ketua masuk ke dalam tabel Supabase Anda.
            </p>
          </div>
          <button
            type="button"
            onClick={handleInspectTables}
            disabled={isInspecting || !supabaseStatus.isActive}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isInspecting ? 'animate-spin' : ''}`} />
            <span>Segarkan Bukti Tabel Cloud</span>
          </button>
        </div>

        {/* Tabel Live Jumlah Baris di Supabase */}
        {inspectData && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Nama Tabel di Supabase</th>
                  <th className="py-2.5 px-4">Fungsi Tabel</th>
                  <th className="py-2.5 px-4 text-center">Jumlah Data Tersimpan di Cloud</th>
                  <th className="py-2.5 px-4">Cuplikan Isi Data Langsung dari Supabase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inspectData.tables.map((t) => (
                  <tr key={t.tableName} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-emerald-800">
                      {t.tableName}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{t.label}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-black text-xs ${
                          t.rowCount > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.rowCount} Baris
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{t.sampleInfo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Langkah-langkah melihat perubahan di Dashboard Supabase */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-extrabold text-emerald-800 mb-1">
              Langkah 1: Unggah Data Awal
            </div>
            <p className="text-slate-600 leading-relaxed">
              Pastikan Project URL &amp; Anon Key sudah tersimpan, lalu klik tombol{' '}
              <strong>&ldquo;1. Unggah Data DKM ke Supabase&rdquo;</strong> di pojok kanan atas halaman ini.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-extrabold text-emerald-800 mb-1">
              Langkah 2: Buka Menu Table Editor
            </div>
            <p className="text-slate-600 leading-relaxed">
              Di website Supabase Anda, klik ikon <strong>Table Editor</strong> (ikon tabel di menu kiri atas, tepat di atas SQL Editor), lalu pilih tabel <strong>voters</strong> atau <strong>schools</strong>.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-extrabold text-emerald-800 mb-1">
              Langkah 3: Uji Perubahan Real-Time
            </div>
            <p className="text-slate-600 leading-relaxed">
              Coba tambah/edit 1 Jamaah di tab <strong>Data Jamaah (KTP)</strong> atau lakukan pemilihan di <strong>Bilik Suara</strong>, maka kolom <code className="font-mono">has_voted</code> di tabel <code className="font-mono">voters</code> Supabase otomatis berubah menjadi <code className="font-mono">TRUE</code>!
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Form Konfigurasi Kredensial */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h4 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600" />
              Kredensial Koneksi API Supabase
            </h4>
            <p className="text-xs text-slate-500 mb-5">
              Dapatkan data ini di dashboard Supabase Anda melalui menu{' '}
              <strong>Project Settings &rarr; API</strong>.
            </p>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Project URL Supabase
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://abcdefghijklmnop.supabase.co"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Project API Key (anon / public)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showKey ? 'Sembunyikan' : 'Tampilkan'}</span>
                  </button>
                </div>
                <input
                  type={showKey ? 'text' : 'password'}
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                  >
                    Reset Konfigurasi
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetConfig}
                      className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Ya, Hapus
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="text-xs text-slate-500 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !supabaseStatus.config.isConfigured}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Uji Koneksi</span>
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Simpan &amp; Hubungkan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Kolom Kanan: Panduan */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                Skema SQL DKM Nurul Hidayah
              </h4>
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <span>Buka Supabase</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Karena Anda sudah menjalankan SQL di Supabase dan muncul pesan{' '}
              <strong>&ldquo;Success. No rows returned&rdquo;</strong>, itu artinya ke-8 tabel sudah siap. Sekarang Anda cukup menekan tombol{' '}
              <strong>&ldquo;1. Unggah Data DKM ke Supabase&rdquo;</strong> di atas untuk mengisi tabel dengan data DKM Nurul Hidayah 2026 - 2028.
            </p>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={handleCopySql}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedSql ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedSql ? 'Kode SQL Tersalin!' : 'Salin Kode Skema SQL'}</span>
              </button>

              <button
                onClick={() => setShowSqlViewer(!showSqlViewer)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <Code className="w-3.5 h-3.5" />
                <span>{showSqlViewer ? 'Tutup Pratinjau' : 'Lihat Skema'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSqlViewer && (
        <div className="bg-slate-900 text-slate-200 p-6 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-emerald-400" />
              <h5 className="text-xs font-mono font-bold text-white">
                supabase_schema.sql (DKM Nurul Hidayah 2026 - 2028)
              </h5>
            </div>
            <button
              onClick={handleCopySql}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {copiedSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSql ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>
          <pre className="p-4 bg-slate-950 rounded-xl text-[11px] font-mono overflow-x-auto max-h-80 text-slate-300">
            {sqlSample}
          </pre>
        </div>
      )}
    </div>
  );
};
