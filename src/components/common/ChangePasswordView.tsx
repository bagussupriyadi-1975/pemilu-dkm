import React, { useState } from 'react';
import { AuthUser } from '../../types';
import { db } from '../../lib/storage';
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Lock,
} from 'lucide-react';

interface ChangePasswordViewProps {
  user: AuthUser;
  userRoleLabel: string;
}

export const ChangePasswordView: React.FC<ChangePasswordViewProps> = ({
  user,
  userRoleLabel,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (newPassword.length < 6) {
      setStatusMsg({
        type: 'error',
        text: 'Kata sandi baru minimal harus terdiri dari 6 karakter.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMsg({
        type: 'error',
        text: 'Konfirmasi kata sandi baru tidak cocok. Silakan ketik ulang.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const allUsers = db.getUsers();
      // Cari user berdasarkan username atau email
      const matched = allUsers.find(
        (u) =>
          u.id === user.id ||
          (user.username && u.username.toLowerCase() === user.username.toLowerCase()) ||
          u.email.toLowerCase() === user.email.toLowerCase()
      );

      if (matched) {
        // Jika ada user di DB, cek old password jika diisi
        if (oldPassword && matched.password && matched.password !== oldPassword) {
          setIsSubmitting(false);
          setStatusMsg({
            type: 'error',
            text: 'Kata sandi saat ini (lama) yang Anda masukkan salah.',
          });
          return;
        }

        db.updateUser(matched.id, { password: newPassword });
      } else {
        // Jika user belum ada di db users (misal admin default), buat atau perbarui
        db.addUser({
          name: user.name,
          username: user.username || user.email.split('@')[0],
          email: user.email,
          role: user.role === 'admin' ? 'admin' : 'panitia',
          password: newPassword,
          status: 'aktif',
        });
      }

      db.addAuditLog(
        user.email,
        userRoleLabel,
        'AUTH_CHANGE_PASSWORD',
        `Pengguna ${user.name} (${user.email}) berhasil mengubah kata sandi akun.`
      );

      setIsSubmitting(false);
      setStatusMsg({
        type: 'success',
        text: 'Kata sandi berhasil diperbarui! Silakan gunakan kata sandi baru ini saat login kembali.',
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setIsSubmitting(false);
      setStatusMsg({
        type: 'error',
        text: err.message || 'Gagal memperbarui kata sandi.',
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Ganti Kata Sandi (Password)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola keamanan akun login Anda untuk akses portal {userRoleLabel}.
            </p>
          </div>
        </div>
      </div>

      {/* Account Profile Card */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">{user.name}</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-800">
                {userRoleLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{user.email}</p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[11px] text-slate-400 font-medium">Username login:</span>
          <p className="text-xs font-mono font-bold text-slate-800">
            @{user.username || user.email.split('@')[0]}
          </p>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs">
        {statusMsg && (
          <div
            className={`p-4 rounded-xl mb-6 text-xs font-semibold flex items-start gap-3 border ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="leading-relaxed">{statusMsg.text}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Kata Sandi Saat Ini (Lama)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="old-password-input"
                type={showPassword ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan kata sandi lama Anda..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-medium"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Kosongkan jika Anda sebelumnya login menggunakan default demo.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Kata Sandi Baru <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="new-password-input"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter..."
                required
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Konfirmasi Kata Sandi Baru <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="confirm-password-input"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi baru..."
                required
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>{showPassword ? 'Sembunyikan karakter' : 'Tampilkan karakter kata sandi'}</span>
            </button>
          </div>

          <div className="pt-3">
            <button
              id="save-new-password-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Perbarui Kata Sandi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
