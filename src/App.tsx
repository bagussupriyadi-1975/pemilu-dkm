import React, { useState, useEffect } from 'react';
import { UserRole, School, ElectionPeriod, AuthUser, PanitiaTab, AdminTab } from './types';
import { db, realtimeBus } from './lib/storage';
import { Header } from './components/common/Header';
import { LiveQuickCount } from './components/public/LiveQuickCount';
import { BilikSuara } from './components/voter/BilikSuara';
import { PanitiaDashboard } from './components/panitia/PanitiaDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { LoginModal } from './components/auth/LoginModal';
import { Shield, Vote } from 'lucide-react';

const AUTH_STORAGE_KEY = 'epilketmas_nh_auth_user_v4';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('public');
  const [school, setSchool] = useState<School>(db.getSchool());
  const [activePeriod, setActivePeriod] = useState<ElectionPeriod | null>(db.getActivePeriod());

  // Gated Authentication State
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalInitialRole, setLoginModalInitialRole] = useState<'panitia' | 'admin'>('admin');

  // Sub-tab states for Panitia and Admin
  const [panitiaTab, setPanitiaTab] = useState<PanitiaTab>('dpt');
  const [adminTab, setAdminTab] = useState<AdminTab>('sekolah');

  const refreshGlobal = () => {
    setSchool(db.getSchool());
    setActivePeriod(db.getActivePeriod());
  };

  useEffect(() => {
    refreshGlobal();

    const handleUpdate = () => refreshGlobal();
    realtimeBus.addEventListener('school_updated', handleUpdate);
    realtimeBus.addEventListener('periods_updated', handleUpdate);
    realtimeBus.addEventListener('data_reset', handleUpdate);
    realtimeBus.addEventListener('supabase_synced', handleUpdate);

    return () => {
      realtimeBus.removeEventListener('school_updated', handleUpdate);
      realtimeBus.removeEventListener('periods_updated', handleUpdate);
      realtimeBus.removeEventListener('data_reset', handleUpdate);
      realtimeBus.removeEventListener('supabase_synced', handleUpdate);
    };
  }, []);

  // Guard: if currentRole requires auth but user is not logged in, fallback to public
  useEffect(() => {
    if ((currentRole === 'panitia' || currentRole === 'admin') && !authUser) {
      setCurrentRole('public');
    }
  }, [authUser, currentRole]);

  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore storage error
    }

    if (user.role === 'panitia') {
      setCurrentRole('panitia');
      setPanitiaTab('dpt');
    } else if (user.role === 'admin') {
      setCurrentRole('admin');
      setAdminTab('sekolah');
    }
  };

  const handleLogout = () => {
    if (authUser) {
      db.addAuditLog(
        authUser.email,
        authUser.role === 'admin' ? 'Admin Utama DKM' : 'Panitia Pemilihan',
        'AUTH_LOGOUT',
        `Petugas ${authUser.name} keluar dari sistem portal.`
      );
    }
    setAuthUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    setCurrentRole('public');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-600 selection:text-white">
      {/* Universal Role & Auth-Aware Header */}
      <Header
        currentRole={currentRole}
        onSelectRole={(role) => setCurrentRole(role)}
        school={school}
        activePeriod={activePeriod}
        authUser={authUser}
        onOpenLogin={(targetRole = 'admin') => {
          setLoginModalInitialRole(targetRole);
          setIsLoginModalOpen(true);
        }}
        onLogout={handleLogout}
        panitiaTab={panitiaTab}
        onSelectPanitiaTab={(tab) => {
          setPanitiaTab(tab);
          setCurrentRole('panitia');
        }}
        adminTab={adminTab}
        onSelectAdminTab={(tab) => {
          setAdminTab(tab);
          setCurrentRole('admin');
        }}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentRole === 'public' && (
          <LiveQuickCount
            school={school}
            activePeriod={activePeriod}
            onGoToBilikSuara={() => setCurrentRole('siswa')}
          />
        )}

        {currentRole === 'siswa' && (
          <BilikSuara
            school={school}
            activePeriod={activePeriod}
            onExitToPublic={() => setCurrentRole('public')}
          />
        )}

        {currentRole === 'panitia' && authUser && (
          <PanitiaDashboard
            school={school}
            activePeriod={activePeriod}
            activeTab={panitiaTab}
            onTabChange={(tab) => setPanitiaTab(tab)}
            authUser={authUser}
            onLogout={handleLogout}
          />
        )}

        {currentRole === 'admin' && authUser && (
          <AdminDashboard
            school={school}
            activePeriod={activePeriod}
            onSchoolUpdated={(updated) => setSchool(updated)}
            activeTab={adminTab}
            onTabChange={(tab) => setAdminTab(tab)}
            authUser={authUser}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Login Modal for Panitia and Admin */}
      <LoginModal
        isOpen={isLoginModalOpen}
        initialRole={loginModalInitialRole}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        school={school}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px]">
              <Vote className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-800">
              Pemilihan Ketua Masjid Digital &bull; {school.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              Jamaah RT.03, RT.04 &amp; RT.05 Lingkungan II Kel. Kuripan, Telukbetung Barat, Bandar
              Lampung
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
            <span>Masa Khidmat {activePeriod?.academic_year || '2026–2029'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
