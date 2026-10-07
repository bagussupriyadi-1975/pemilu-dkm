import React, { useState, useEffect } from 'react';
import { AuthUser, School } from '../../types';
import { db } from '../../lib/storage';
import {
  Lock,
  Mail,
  Key,
  ShieldCheck,
  Users,
  Eye,
  EyeOff,
  AlertCircle,
  X,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  initialRole?: 'panitia' | 'admin';
  onClose: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  school: School;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  initialRole = 'admin',
  onClose,
  onLoginSuccess,
  school,
}) => {
  const [selectedRole, setSelectedRole] = useState<'panitia' | 'admin'>(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedRole(initialRole);
      setErrorMsg(null);
    }
  }, [isOpen, initialRole]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);

      const allUsers = db.getUsers();
      const inputTrimmed = identifier.trim().toLowerCase();
      const passTrimmed = password.trim();

      if (!inputTrimmed || !passTrimmed) {
        setErrorMsg('Email/Username dan Kata Sandi wajib diisi.');
        return;
      }

      // Cari user yang sesuai dengan role tab yang dipilih terlebih dahulu, atau fallback ke semua user terdaftar
      const matchedByRole = allUsers.find(
        (u) =>
          (selectedRole === 'admin' ? u.role === 'admin' : u.role !== 'admin') &&
          (u.username.toLowerCase() === inputTrimmed ||
            (u.email && u.email.toLowerCase() === inputTrimmed))
      );

      const matchedAny =
        matchedByRole ||
        allUsers.find(
          (u) =>
            u.username.toLowerCase() === inputTrimmed ||
            (u.email && u.email.toLowerCase() === inputTrimmed)
        );

      if (matchedAny) {
        if (matchedAny.status === 'nonaktif') {
          setErrorMsg('Akun petugas ini sedang berstatus NONAKTIF.');
          return;
        }

        const storedPass = matchedAny.password || 'dkm12345';
        const isDefaultUnchanged =
          storedPass === 'dkm12345' || storedPass === 'dkmnh12345';

        const isPasswordValid =
          passTrimmed === storedPass ||
          (isDefaultUnchanged &&
            (passTrimmed === 'dkm12345' || passTrimmed === 'dkmnh12345'));

        if (!isPasswordValid) {
          setErrorMsg(
            'Email/Username atau Kata Sandi yang Anda masukkan tidak sesuai. Silakan periksa kembali.'
          );
          return;
        }

        // Gunakan portal sesuai tab yang dipilih user (Admin Utama DKM atau Panitia Pemilihan)
        const targetRole: 'admin' | 'panitia' = selectedRole;

        try {
          db.updateUser(matchedAny.id, { last_login: new Date().toISOString() });
        } catch {
          // ignore
        }

        const user: AuthUser = {
          id: matchedAny.id,
          role: targetRole,
          name: matchedAny.name,
          email: matchedAny.email || `${matchedAny.username}@nurulhidayah.id`,
          username: matchedAny.username,
        };

        db.addAuditLog(
          user.email,
          targetRole === 'admin' ? 'Admin Utama DKM' : 'Panitia Pemilihan',
          'AUTH_LOGIN',
          `Petugas ${user.name} berhasil masuk ke Portal ${
            targetRole === 'admin' ? 'Admin Utama DKM' : 'Panitia Pemilihan'
          }.`
        );

        setIdentifier('');
        setPassword('');
        onLoginSuccess(user);
        onClose();
        return;
      }

      setErrorMsg(
        'Email/Username atau Kata Sandi yang Anda masukkan tidak sesuai. Silakan periksa kembali.'
      );
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Modal */}
        <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white p-6 relative text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-400/30 uppercase mb-2.5">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Otentikasi Resmi Pengurus &amp; Panitia</span>
          </div>

          <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-emerald-200 whitespace-nowrap">
            DEWAN KEMAKMURAN MASJID (DKM)
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-widest uppercase text-white mt-0.5">
            NURUL HIDAYAH
          </h2>
          <p className="text-xs text-emerald-100 mt-1.5">
            Masukkan Email / Username dan Kata Sandi resmi untuk mengakses portal manajemen.
          </p>
        </div>

        {/* Role Switcher Tabs */}
        <div className="p-6 pt-5">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl mb-4">
            <button
              type="button"
              onClick={() => {
                setSelectedRole('admin');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Portal Admin DKM</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRole('panitia');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedRole === 'panitia'
                  ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-700" />
              <span>Portal Panitia</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs" autoComplete="off">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                {selectedRole === 'admin'
                  ? 'Email atau Username Admin'
                  : 'Email atau Username Panitia'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Masukkan email atau username..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 font-medium"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  selectedRole === 'panitia'
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {isSubmitting ? (
                  <span>Memverifikasi Akses...</span>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      Masuk ke{' '}
                      {selectedRole === 'admin'
                        ? 'Portal Admin Utama DKM'
                        : 'Portal Panitia Pemilihan'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer note */}
          <div className="mt-5 text-center text-[11px] text-slate-400">
            Akses Terproteksi &bull; DKM Nurul Hidayah &bull; Kel. Kuripan
          </div>
        </div>
      </div>
    </div>
  );
};
