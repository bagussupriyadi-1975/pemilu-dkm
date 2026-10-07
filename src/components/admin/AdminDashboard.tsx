import React, { useState, useEffect } from 'react';
import {
  School,
  ElectionPeriod,
  Committee,
  AuditLog,
  AdminTab,
  AppUser,
  AppUserRole,
  AuthUser,
  Voter,
  BoothLockMode,
} from '../../types';
import { db, realtimeBus, getBoothAccessStatus, formatIndonesianDateTime } from '../../lib/storage';
import {
  ShieldCheck,
  Building,
  Calendar,
  FileCheck2,
  ScrollText,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  X,
  Edit,
  UserPlus,
  User,
  KeyRound,
  Search,
  Users,
  Database,
  CreditCard,
  Award,
  Lock,
  Unlock,
  Clock,
  MapPin,
  ClipboardList,
} from 'lucide-react';
import { PrintableBAHP } from '../print/PrintableBAHP';
import { PrintableAttendanceList } from '../print/PrintableAttendanceList';
import { Pagination } from '../common/Pagination';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { ChangePasswordView } from '../common/ChangePasswordView';
import { SupabaseSettings } from './SupabaseSettings';
import { PanitiaDashboard } from '../panitia/PanitiaDashboard';

interface AdminDashboardProps {
  school: School;
  activePeriod: ElectionPeriod | null;
  onSchoolUpdated: (school: School) => void;
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
  authUser?: AuthUser | null;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  school,
  activePeriod,
  onSchoolUpdated,
  activeTab: propTab,
  onTabChange,
  authUser,
}) => {
  const [internalTab, setInternalTab] = useState<AdminTab>('sekolah');
  const activeTab = propTab && (propTab as string) !== 'prd_docs' ? propTab : internalTab;

  const handleTabSelect = (tab: AdminTab) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const [periods, setPeriods] = useState<ElectionPeriod[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [votersList, setVotersList] = useState<Voter[]>([]);
  const [isBahpPrintMode, setIsBahpPrintMode] = useState(false);
  const [isAttendancePrintMode, setIsAttendancePrintMode] = useState(false);

  const [schoolForm, setSchoolForm] = useState<School>(school);
  const [schoolSaveSuccess, setSchoolSaveSuccess] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setSchoolForm(school);
  }, [school]);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusNotice({ type, text });
    setTimeout(() => setStatusNotice(null), 4500);
  };

  // Period Modal
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<ElectionPeriod | null>(null);
  const [periodForm, setPeriodForm] = useState({
    period_name: '',
    academic_year: '2026–2029',
    status: 'draft' as 'draft' | 'aktif' | 'selesai',
    start_date: new Date().toISOString().slice(0, 16),
    end_date: new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 16),
  });

  // Committee Modal
  const [isCommitteeModalOpen, setIsCommitteeModalOpen] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
  const [committeeForm, setCommitteeForm] = useState({
    sk_number: '001/SK-PAN/DKM-NH/X/2026',
    sk_date: '2026-10-01',
    sk_file_name: 'SK_Panitia_Pemilihan_Masjid_Nurul_Hidayah_2026.pdf',
    member_name: '',
    role: 'Anggota' as Committee['role'],
    email: '',
    status: 'aktif' as 'aktif' | 'nonaktif',
  });

  // User Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    name: '',
    password: '',
    role: 'panitia' as AppUserRole,
    status: 'aktif' as 'aktif' | 'nonaktif',
  });

  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'period' | 'committee' | 'user';
    item: any;
    name: string;
    warningDetails?: string;
    errorMessage?: string | null;
  }>({
    isOpen: false,
    type: 'period',
    item: null,
    name: '',
    errorMessage: null,
  });

  // Pagination
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [committeePage, setCommitteePage] = useState(1);
  const [committeePageSize, setCommitteePageSize] = useState(10);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(15);

  useEffect(() => {
    setUserPage(1);
  }, [userSearchQuery]);

  const loadAll = () => {
    setPeriods(db.getPeriods());
    setCommittees(db.getCommittees());
    setAuditLogs(db.getAuditLogs());
    setUsers(db.getUsers());
    setVotersList(db.getVoters());
  };

  useEffect(() => {
    loadAll();
    const handleUpdate = () => loadAll();
    realtimeBus.addEventListener('periods_updated', handleUpdate);
    realtimeBus.addEventListener('committees_updated', handleUpdate);
    realtimeBus.addEventListener('audit_updated', handleUpdate);
    realtimeBus.addEventListener('school_updated', handleUpdate);
    realtimeBus.addEventListener('users_updated', handleUpdate);
    realtimeBus.addEventListener('voters_updated', handleUpdate);
    realtimeBus.addEventListener('supabase_synced', handleUpdate);

    return () => {
      realtimeBus.removeEventListener('periods_updated', handleUpdate);
      realtimeBus.removeEventListener('committees_updated', handleUpdate);
      realtimeBus.removeEventListener('audit_updated', handleUpdate);
      realtimeBus.removeEventListener('school_updated', handleUpdate);
      realtimeBus.removeEventListener('users_updated', handleUpdate);
      realtimeBus.removeEventListener('voters_updated', handleUpdate);
      realtimeBus.removeEventListener('supabase_synced', handleUpdate);
    };
  }, []);

  const handleSaveSchool = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = db.updateSchool(schoolForm);
    onSchoolUpdated(updated);
    setSchoolSaveSuccess(true);
    showNotice('Pengaturan Profil Masjid, Jadwal Pelaksanaan & Kunci Bilik Token berhasil disimpan!');
    setTimeout(() => setSchoolSaveSuccess(false), 3000);
  };

  const handleQuickBoothLock = (mode: BoothLockMode) => {
    const nextForm = { ...schoolForm, booth_lock_mode: mode };
    setSchoolForm(nextForm);
    const updated = db.updateSchool(nextForm);
    onSchoolUpdated(updated);
    const label =
      mode === 'force_open'
        ? 'Bilik Token DIBUKA secara langsung oleh Panitia/Admin!'
        : mode === 'force_locked'
        ? 'Bilik Token DIKUNCI / DITUTUP secara langsung oleh Panitia/Admin!'
        : 'Bilik Token diatur mengikuti Jadwal Jam Buka & Jam Tutup Otomatis!';
    showNotice(label);
  };

  const currentBoothStatus = getBoothAccessStatus(schoolForm);
  const previewStart = formatIndonesianDateTime(schoolForm.voting_start_datetime);
  const previewEnd = formatIndonesianDateTime(schoolForm.voting_end_datetime);

  const handleOpenAddPeriod = () => {
    setEditingPeriod(null);
    setPeriodForm({
      period_name: `Pemilihan Ketua ${school.name} Masa Khidmat 2029–2032`,
      academic_year: '2029–2032',
      status: 'draft',
      start_date: new Date().toISOString().slice(0, 16),
      end_date: new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 16),
    });
    setIsPeriodModalOpen(true);
  };

  const handleEditPeriod = (p: ElectionPeriod) => {
    setEditingPeriod(p);
    setPeriodForm({
      period_name: p.period_name,
      academic_year: p.academic_year,
      status: p.status,
      start_date: new Date(p.start_date).toISOString().slice(0, 16),
      end_date: new Date(p.end_date).toISOString().slice(0, 16),
    });
    setIsPeriodModalOpen(true);
  };

  const handleSavePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodForm.period_name.trim() || !periodForm.academic_year.trim()) {
      showNotice('Nama periode dan masa khidmat wajib diisi!', 'error');
      return;
    }

    if (editingPeriod) {
      db.updatePeriod(editingPeriod.id, {
        period_name: periodForm.period_name.trim(),
        academic_year: periodForm.academic_year.trim(),
        status: periodForm.status,
        start_date: periodForm.start_date,
        end_date: periodForm.end_date,
      });
      showNotice('Data periode pemilihan berhasil diperbarui.');
    } else {
      db.createPeriod({
        school_id: school.id,
        period_name: periodForm.period_name.trim(),
        academic_year: periodForm.academic_year.trim(),
        status: periodForm.status,
        start_date: periodForm.start_date,
        end_date: periodForm.end_date,
      });
      showNotice('Periode pemilihan baru berhasil dibuat.');
    }
    setIsPeriodModalOpen(false);
    setEditingPeriod(null);
  };

  const handleDeletePeriod = (p: ElectionPeriod) => {
    if (p.status === 'aktif') {
      setDeleteModal({
        isOpen: true,
        type: 'period',
        item: p,
        name: p.period_name,
        warningDetails: 'Periode ini tidak dapat dihapus karena saat ini berstatus AKTIF.',
        errorMessage:
          'Tidak dapat menghapus periode yang sedang berstatus AKTIF! Nonaktifkan terlebih dahulu.',
      });
      return;
    }
    setDeleteModal({
      isOpen: true,
      type: 'period',
      item: p,
      name: p.period_name,
      warningDetails: 'Semua data terkait periode ini akan dihapus secara permanen.',
      errorMessage: null,
    });
  };

  // Committee Handlers
  const handleOpenAddCommittee = () => {
    setEditingCommittee(null);
    setCommitteeForm({
      sk_number: '001/SK-PAN/DKM-NH/X/2026',
      sk_date: '2026-10-01',
      sk_file_name: 'SK_Panitia_Pemilihan_Masjid_Nurul_Hidayah_2026.pdf',
      member_name: '',
      role: 'Anggota',
      email: '',
      status: 'aktif',
    });
    setIsCommitteeModalOpen(true);
  };

  const handleEditCommittee = (c: Committee) => {
    setEditingCommittee(c);
    setCommitteeForm({
      sk_number: c.sk_number,
      sk_date: c.sk_date,
      sk_file_name: c.sk_file_name || 'SK_Panitia_Pemilihan_Masjid_Nurul_Hidayah_2026.pdf',
      member_name: c.member_name,
      role: c.role,
      email: c.email,
      status: c.status,
    });
    setIsCommitteeModalOpen(true);
  };

  const handleSaveCommittee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!committeeForm.member_name.trim()) return;

    if (editingCommittee) {
      db.updateCommittee(editingCommittee.id, {
        sk_number: committeeForm.sk_number.trim(),
        sk_date: committeeForm.sk_date,
        sk_file_name: committeeForm.sk_file_name,
        member_name: committeeForm.member_name.trim(),
        role: committeeForm.role,
        email:
          committeeForm.email.trim() ||
          `${committeeForm.member_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@nurulhidayah.id`,
        status: committeeForm.status,
      });
      showNotice(`Data panitia ${committeeForm.member_name} berhasil diperbarui.`);
    } else {
      db.addCommittee({
        election_period_id: activePeriod?.id || 'period-2026',
        sk_number: committeeForm.sk_number.trim(),
        sk_date: committeeForm.sk_date,
        sk_file_name: committeeForm.sk_file_name,
        member_name: committeeForm.member_name.trim(),
        role: committeeForm.role,
        email:
          committeeForm.email.trim() ||
          `${committeeForm.member_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@nurulhidayah.id`,
        status: committeeForm.status,
      });
      showNotice(`Anggota panitia ${committeeForm.member_name} berhasil ditambahkan.`);
    }
    setIsCommitteeModalOpen(false);
    setEditingCommittee(null);
  };

  // User CRUD Handlers
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserForm({
      username: '',
      email: '',
      name: '',
      password: 'dkmnh12345',
      role: 'panitia',
      status: 'aktif',
    });
    setIsUserModalOpen(true);
  };

  const handleEditUser = (u: AppUser) => {
    setEditingUser(u);
    setUserForm({
      username: u.username,
      email: u.email || `${u.username}@nurulhidayah.id`,
      name: u.name,
      password: u.password || 'dkmnh12345',
      role: u.role,
      status: u.status,
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username.trim() || !userForm.name.trim()) {
      showNotice('Nama lengkap dan username wajib diisi!', 'error');
      return;
    }

    try {
      if (editingUser) {
        const updatePayload: Partial<AppUser> = {
          username: userForm.username.trim(),
          email: userForm.email.trim() || `${userForm.username.trim()}@nurulhidayah.id`,
          name: userForm.name.trim(),
          role: userForm.role,
          status: userForm.status,
        };
        if (userForm.password.trim()) {
          updatePayload.password = userForm.password.trim();
        }
        db.updateUser(editingUser.id, updatePayload);
        showNotice(`Akun pengguna "${userForm.name}" berhasil diperbarui!`);
      } else {
        db.addUser({
          username: userForm.username.trim(),
          email: userForm.email.trim() || `${userForm.username.trim()}@nurulhidayah.id`,
          name: userForm.name.trim(),
          password: userForm.password.trim() || 'dkmnh12345',
          role: userForm.role,
          status: userForm.status,
        });
        showNotice(`Akun baru "${userForm.name}" berhasil ditambahkan!`);
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      showNotice(err.message || 'Gagal menyimpan data user', 'error');
    }
  };

  const handleDeleteUser = (u: AppUser) => {
    setDeleteModal({
      isOpen: true,
      type: 'user',
      item: u,
      name: `${u.name} (@${u.username})`,
      warningDetails: 'Akun petugas ini tidak akan dapat lagi mengakses portal.',
      errorMessage: null,
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteModal.item) return;

    try {
      if (deleteModal.type === 'period') {
        db.deletePeriod(deleteModal.item.id);
      } else if (deleteModal.type === 'committee') {
        db.deleteCommittee(deleteModal.item.id);
      } else if (deleteModal.type === 'user') {
        const ok = db.deleteUser(deleteModal.item.id);
        if (!ok) {
          setDeleteModal((prev) => ({
            ...prev,
            errorMessage: 'Tidak dapat menghapus satu-satunya akun Admin Utama yang aktif!',
          }));
          return;
        }
      }
      loadAll();
      setDeleteModal({
        isOpen: false,
        type: 'period',
        item: null,
        name: '',
        errorMessage: null,
      });
    } catch (err: any) {
      setDeleteModal((prev) => ({
        ...prev,
        errorMessage: err.message || 'Gagal menghapus data.',
      }));
    }
  };

  if (isBahpPrintMode) {
    const candidates = db.getCandidates(activePeriod?.id);
    const { candidates: stats, metrics } = db.getQuickCountStats(activePeriod?.id);
    return (
      <PrintableBAHP
        school={school}
        activePeriod={activePeriod}
        candidates={candidates}
        stats={stats}
        metrics={metrics}
        committees={committees}
        onBack={() => setIsBahpPrintMode(false)}
      />
    );
  }

  if (isAttendancePrintMode) {
    return (
      <PrintableAttendanceList
        school={school}
        activePeriod={activePeriod}
        voters={votersList}
        committees={committees}
        onBack={() => setIsAttendancePrintMode(false)}
      />
    );
  }

  const filteredUsers = users.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Status Toast Banner */}
      {statusNotice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-sm ${
            statusNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{statusNotice.text}</span>
          <button
            onClick={() => setStatusNotice(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Header Banner */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          {school.logo_url && (
            <img
              src={school.logo_url}
              alt={school.name}
              className="w-14 h-14 object-contain rounded-xl border border-emerald-200 p-1 bg-white hidden sm:block"
            />
          )}
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Portal Admin Utama &bull; {authUser?.name || 'Bagus Supriyadi'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
              Pusat Kendali Pemilihan Ketua{' '}
              <span className="whitespace-nowrap">Dewan Kemakmuran Masjid (DKM)</span>{' '}
              <span className="whitespace-nowrap text-emerald-800">Nurul Hidayah</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola Profil Masjid, Calon Ketua DKM (Foto, Visi-Misi, Video), Data Jamaah KTP &amp; Token (RT.03–05 Lk.II), serta Berita Acara
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleTabSelect('kandidat_admin')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Award className="w-4 h-4" />
            <span>Isi / Edit Kandidat Calon Ketua</span>
          </button>

          <button
            onClick={() => setIsAttendancePrintMode(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Cetak Absensi per RT (A4)</span>
          </button>

          <button
            onClick={() => setIsBahpPrintMode(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Berita Acara (BAHP)</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => handleTabSelect('sekolah')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'sekolah'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building className="w-4 h-4 text-emerald-400" />
          <span>Profil Masjid &amp; Mode Pemilihan</span>
        </button>

        <button
          onClick={() => handleTabSelect('kandidat_admin')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'kandidat_admin'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-amber-50 text-amber-950 hover:bg-amber-100 border border-amber-300'
          }`}
        >
          <Award className="w-4 h-4 text-amber-500" />
          <span>Calon Ketua DKM / Kandidat</span>
        </button>

        <button
          onClick={() => handleTabSelect('dpt_admin')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'dpt_admin'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <span>Data Jamaah KTP &amp; Token ({votersList.length})</span>
        </button>

        <button
          onClick={() => handleTabSelect('token_admin')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'token_admin'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Printer className="w-4 h-4 text-emerald-500" />
          <span>Cetak Kartu Token (A4)</span>
        </button>

        <button
          onClick={() => handleTabSelect('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'users'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Akun Admin &amp; Panitia ({users.length})</span>
        </button>

        <button
          onClick={() => handleTabSelect('panitia')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'panitia'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-teal-400" />
          <span>SK Kepanitiaan ({committees.length})</span>
        </button>

        <button
          onClick={() => handleTabSelect('periode')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'periode'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-400" />
          <span>Periode Pemilihan ({periods.length})</span>
        </button>

        <button
          onClick={() => handleTabSelect('audit_bahp')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'audit_bahp'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ScrollText className="w-4 h-4 text-blue-400" />
          <span>Log Audit &amp; BAHP</span>
        </button>

        <button
          onClick={() => handleTabSelect('supabase')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'supabase'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database Cloud Supabase</span>
        </button>

        <button
          onClick={() => handleTabSelect('password')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'password'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <KeyRound className="w-4 h-4 text-emerald-400" />
          <span>Ganti Sandi</span>
        </button>
      </div>

      {/* TAB 1: PROFIL MASJID NURUL HIDAYAH & PENGATURAN BASIS HAK SUARA */}
      {activeTab === 'sekolah' && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Pengaturan Identitas Masjid &amp; Aturan Hak Suara Jamaah
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Perubahan data ini langsung diterapkan pada Header, Surat Suara, Kartu Token, dan Berita Acara Resmi
              </p>
            </div>
            {schoolForm.logo_url && (
              <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <img
                  src={schoolForm.logo_url}
                  alt={schoolForm.name}
                  className="w-10 h-10 object-contain"
                />
                <span className="text-[11px] font-bold text-slate-700">Logo Aktif</span>
              </div>
            )}
          </div>

          {schoolSaveSuccess && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan Masjid Nurul Hidayah berhasil disimpan!</span>
            </div>
          )}

          <form onSubmit={handleSaveSchool} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Nama Masjid <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={schoolForm.name}
                  onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                  placeholder="Masjid Nurul Hidayah"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Nama Ketua Masjid / Pengurus Saat Ini
                </label>
                <input
                  type="text"
                  value={schoolForm.principal_name}
                  onChange={(e) =>
                    setSchoolForm({ ...schoolForm, principal_name: e.target.value })
                  }
                  placeholder="Feriyanto"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  URL Logo Masjid
                </label>
                <input
                  type="url"
                  value={schoolForm.logo_url}
                  onChange={(e) => setSchoolForm({ ...schoolForm, logo_url: e.target.value })}
                  placeholder="https://bagus-supriyadi.biz.id/uploads/LOGO%20NURUL%20HIDAYAH.png"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Tipe Kelembagaan Pengurus
                </label>
                <select
                  value={schoolForm.type}
                  onChange={(e) =>
                    setSchoolForm({
                      ...schoolForm,
                      type: e.target.value as any,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-semibold"
                >
                  <option value="DKM">DKM (Dewan Kemakmuran Masjid)</option>
                  <option value="TAKMIR">TAKMIR (Pengurus Takmir Masjid)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Alamat Lengkap Masjid (Jalan, Gang, RT, Lingkungan, Kelurahan, Kecamatan, Kota)
              </label>
              <input
                type="text"
                value={schoolForm.address}
                onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                placeholder="Jalan Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan, Kec. Telukbetung Barat, Kota Bandar Lampung"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Cakupan Kelompok Jamaah &amp; Lingkungan (Tanpa Istilah RW)
                </label>
                <input
                  type="text"
                  value={
                    schoolForm.lingkungan_name ||
                    'Lingkungan II (RT.03, RT.04, RT.05) Kel. Kuripan, Telukbetung Barat, Bandar Lampung'
                  }
                  onChange={(e) =>
                    setSchoolForm({ ...schoolForm, lingkungan_name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="font-bold text-emerald-800 block mb-1.5">
                  Aturan Basis Hak Suara Pemilihan (Opsional / Fleksibel)
                </label>
                <select
                  value={schoolForm.voting_basis || 'kk'}
                  onChange={(e) =>
                    setSchoolForm({
                      ...schoolForm,
                      voting_basis: e.target.value as 'kk' | 'unsur' | 'semua',
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 font-bold text-emerald-950"
                >
                  <option value="kk">
                    1 Keluarga 1 Orang Berdasarkan KK (Warga RT.03, RT.04, RT.05 Lk.II)
                  </option>
                  <option value="unsur">
                    Berdasarkan Unsur Jamaah (Bapak-bapak, Ibu Majelis Taklim, Remaja Masjid)
                  </option>
                  <option value="semua">
                    Seluruh Jamaah Terdaftar (1 Token = 1 Hak Suara)
                  </option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Nomor Registrasi / ID Masjid
                </label>
                <input
                  type="text"
                  value={schoolForm.npsn}
                  onChange={(e) => setSchoolForm({ ...schoolForm, npsn: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Nomor SK Pengurus / Keterangan Pengesahan
                </label>
                <input
                  type="text"
                  value={schoolForm.principal_nip}
                  onChange={(e) =>
                    setSchoolForm({ ...schoolForm, principal_nip: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono"
                />
              </div>
            </div>

            {/* BAGIAN KHUSUS: KONTROL KUNCI BILIK TOKEN & JADWAL PELAKSANAAN PEMILIHAN */}
            <div className="mt-6 pt-6 border-t-2 border-slate-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-2xl">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 block">
                    Pengamanan Bilik Suara &amp; Jadwal Pelaksanaan
                  </span>
                  <h4 className="text-sm sm:text-base font-extrabold mt-0.5">
                    Kontrol Kunci Bilik Token, Jam Buka/Tutup &amp; Tempat Pemilihan
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Atur kapan token dibuka dan ditutup agar tidak disalahgunakan sebelum atau sesudah pemilihan.
                  </p>
                </div>

                <div
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider shrink-0 border ${
                    currentBoothStatus.isOpen
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : 'bg-rose-500/25 text-amber-300 border-amber-400/40'
                  }`}
                >
                  {currentBoothStatus.isOpen ? (
                    <Unlock className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Lock className="w-4 h-4 text-amber-300" />
                  )}
                  <span>{currentBoothStatus.badgeText}</span>
                </div>
              </div>

              {/* Tombol Kunci / Buka Cepat Bilik Token */}
              <div>
                <label className="font-extrabold text-slate-800 block mb-2">
                  Mode Kunci Bilik Suara &amp; Token (Klik untuk Mengubah Status Langsung):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleQuickBoothLock('auto')}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      (schoolForm.booth_lock_mode || 'auto') === 'auto'
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-extrabold text-xs">
                      <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Otomatis Sesuai Jadwal</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Terkunci sebelum jam buka &amp; otomatis menutup saat jam selesai.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickBoothLock('force_open')}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      schoolForm.booth_lock_mode === 'force_open'
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-emerald-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-extrabold text-xs">
                      <Unlock className="w-4 h-4 shrink-0" />
                      <span>Buka Bilik Token Sekarang</span>
                    </div>
                    <p
                      className={`text-[11px] mt-1 ${
                        schoolForm.booth_lock_mode === 'force_open'
                          ? 'text-emerald-100'
                          : 'text-slate-600'
                      }`}
                    >
                      Buka kunci bilik suara sekarang oleh Panitia agar token bisa dimasukkan.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickBoothLock('force_locked')}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      schoolForm.booth_lock_mode === 'force_locked'
                        ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-rose-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-extrabold text-xs">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>Kunci / Tutup Bilik Sekarang</span>
                    </div>
                    <p
                      className={`text-[11px] mt-1 ${
                        schoolForm.booth_lock_mode === 'force_locked'
                          ? 'text-rose-100'
                          : 'text-slate-600'
                      }`}
                    >
                      Kunci bilik suara agar tidak ada yang bisa memasukkan token.
                    </p>
                  </button>
                </div>
              </div>

              {/* Input Tanggal & Jam Dibuka s.d. Tanggal & Jam Ditutup */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                  <label className="font-extrabold text-emerald-950 flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-4 h-4 text-emerald-700" />
                    <span>Tanggal &amp; Jam Dibuka Token / Bilik Suara</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={schoolForm.voting_start_datetime || '2026-10-18T08:00'}
                    onChange={(e) =>
                      setSchoolForm({
                        ...schoolForm,
                        voting_start_datetime: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-white font-mono font-bold text-slate-900"
                  />
                  <div className="mt-2 text-[11px] font-bold text-emerald-800">
                    Jadwal Buka: {previewStart.dayName}, {previewStart.dateFull} &bull; Pukul{' '}
                    {previewStart.timeFull}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
                  <label className="font-extrabold text-amber-950 flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-4 h-4 text-amber-700" />
                    <span>Tanggal &amp; Jam Ditutup Kembali Token / Bilik Suara</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={schoolForm.voting_end_datetime || '2026-10-18T14:00'}
                    onChange={(e) =>
                      setSchoolForm({
                        ...schoolForm,
                        voting_end_datetime: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 bg-white font-mono font-bold text-slate-900"
                  />
                  <div className="mt-2 text-[11px] font-bold text-amber-900">
                    Jadwal Tutup: {previewEnd.dayName}, {previewEnd.dateFull} &bull; Pukul{' '}
                    {previewEnd.timeFull}
                  </div>
                </div>
              </div>

              {/* Tempat Pelaksanaan Pemilihan */}
              <div>
                <label className="font-extrabold text-slate-800 flex items-center gap-1.5 mb-1.5">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <span>Tempat / Lokasi Pelaksanaan Pemilihan</span>
                </label>
                <input
                  type="text"
                  value={
                    schoolForm.voting_location ||
                    'Ruang Utama Masjid Nurul Hidayah, Jl. Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan, Bandar Lampung'
                  }
                  onChange={(e) =>
                    setSchoolForm({ ...schoolForm, voting_location: e.target.value })
                  }
                  placeholder="Contoh: Ruang Utama Masjid Nurul Hidayah, Jl. Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-900"
                />
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Simpan Pengaturan Masjid, Jadwal &amp; Kunci Bilik Suara
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB KANDIDAT: MANAJEMEN CALON KETUA DKM (FOTO 4:5, VISI, MISI, PROGRAM & VIDEO) */}
      {activeTab === 'kandidat_admin' && (
        <div className="space-y-4">
          <PanitiaDashboard
            school={school}
            activePeriod={activePeriod}
            authUser={authUser}
            embeddedInAdmin={true}
            embeddedSection="paslon"
          />
        </div>
      )}

      {/* TAB 2: MANAJEMEN DATA JAMAAH KOMPLIT SEPERTI KTP (LANGSUNG DARI ADMIN) */}
      {activeTab === 'dpt_admin' && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-emerald-950">
                Manajemen Data Jamaah (Format Lengkap KTP &amp; KK — RT.03, RT.04, RT.05 Lk.II)
              </h3>
              <p className="text-xs text-emerald-800">
                Sebagai Admin Utama, Anda dapat menambah, mengedit data KTP/KK jamaah, mengubah Unsur Jamaah (Bapak-bapak, Ibu Majelis Taklim, Remaja Masjid), serta mengatur Kode Token Bilik Suara (1–300).
              </p>
            </div>
          </div>
          <PanitiaDashboard
            school={school}
            activePeriod={activePeriod}
            authUser={authUser}
            embeddedInAdmin={true}
            embeddedSection="dpt"
          />
        </div>
      )}

      {/* TAB TOKEN: GENERATOR & CETAK KARTU TOKEN PER LEMBAR A4 */}
      {activeTab === 'token_admin' && (
        <div className="space-y-4">
          <PanitiaDashboard
            school={school}
            activePeriod={activePeriod}
            authUser={authUser}
            embeddedInAdmin={true}
            embeddedSection="token"
          />
        </div>
      )}

      {/* TAB 3: MANAJEMEN AKUN ADMIN UTAMA & PANITIA PEMILIHAN */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Manajemen Akun Admin Utama &amp; Panitia Pemilihan (1–5 Orang Jamaah)
              </h3>
              <p className="text-xs text-slate-500">
                Kelola akun login Admin Utama (Bagus Supriyadi) serta Panitia Pemilihan &amp; Petugas Bilik Suara yang diambil dari Daftar Jamaah
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Cari nama, email, username..."
                  className="pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <button
                onClick={handleOpenAddUser}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tambah Akun Panitia / Petugas</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-3.5 px-4">Nama Lengkap Petugas</th>
                    <th className="py-3.5 px-4">Email &amp; Username</th>
                    <th className="py-3.5 px-4">Password Awal / Aktif</th>
                    <th className="py-3.5 px-4">Peran (Role)</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Aksi Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers
                    .slice((userPage - 1) * userPageSize, userPage * userPageSize)
                    .map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                              <User className="w-4 h-4" />
                            </div>
                            <span>{u.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-800">{u.email}</div>
                          <div className="font-mono text-[11px] text-emerald-700">
                            Username: @{u.username}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 tracking-widest">
                            ••••••••
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                              u.role === 'admin'
                                ? 'bg-slate-900 text-amber-400'
                                : u.role === 'panitia'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {u.role === 'admin' ? 'Admin Utama' : u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              u.status === 'aktif'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {u.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleEditUser(u)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Ubah</span>
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={userPage}
              totalItems={filteredUsers.length}
              pageSize={userPageSize}
              onPageChange={(p) => setUserPage(p)}
              onPageSizeChange={(s) => {
                setUserPageSize(s);
                setUserPage(1);
              }}
              itemLabel="akun petugas"
            />
          </div>
        </div>
      )}

      {/* TAB 4: SK KEPANITIAAN */}
      {activeTab === 'panitia' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Susunan Panitia Pemilihan &amp; Petugas Bilik Suara ({school.name})
              </h3>
              <p className="text-xs text-slate-500">
                Daftar panitia yang diambil dari Jamaah RT.03, RT.04, dan RT.05 Lingkungan II Kelurahan Kuripan
              </p>
            </div>

            <button
              onClick={handleOpenAddCommittee}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Anggota Panitia</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-3.5 px-4">Nama Anggota Panitia (Jamaah)</th>
                    <th className="py-3.5 px-4">Jabatan Kepanitiaan</th>
                    <th className="py-3.5 px-4">Nomor SK</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {committees
                    .slice((committeePage - 1) * committeePageSize, committeePage * committeePageSize)
                    .map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{c.member_name}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[11px]">
                            {c.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{c.sk_number}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">{c.email}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleEditCommittee(c)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleteModal({
                                  isOpen: true,
                                  type: 'committee',
                                  item: c,
                                  name: `${c.member_name} (${c.role})`,
                                  errorMessage: null,
                                })
                              }
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={committeePage}
              totalItems={committees.length}
              pageSize={committeePageSize}
              onPageChange={(p) => setCommitteePage(p)}
              onPageSizeChange={(s) => {
                setCommitteePageSize(s);
                setCommitteePage(1);
              }}
              itemLabel="anggota panitia"
            />
          </div>
        </div>
      )}

      {/* TAB 5: MANAJEMEN PERIODE */}
      {activeTab === 'periode' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Daftar Periode Masa Khidmat Pemilihan {school.name}
              </h3>
              <p className="text-xs text-slate-500">
                Hanya satu periode yang dapat berstatus AKTIF pada satu waktu
              </p>
            </div>

            <button
              onClick={handleOpenAddPeriod}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Periode Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {periods.map((p) => (
              <div
                key={p.id}
                className={`bg-white rounded-2xl p-6 border-2 transition-all ${
                  p.status === 'aktif'
                    ? 'border-emerald-600 shadow-md'
                    : 'border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        p.status === 'aktif'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'selesai'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.status}
                    </span>
                    <h4 className="font-extrabold text-base text-slate-900 mt-2">
                      {p.period_name}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Masa Khidmat: {p.academic_year}
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {p.status !== 'aktif' && (
                      <button
                        onClick={() => db.setActivePeriod(p.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Jadikan Periode Aktif
                      </button>
                    )}
                    {p.status === 'aktif' && (
                      <button
                        onClick={() => db.updatePeriodStatus(p.id, 'selesai')}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Tutup Pemungutan Suara
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEditPeriod(p)}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePeriod(p)}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT TRAIL & BAHP */}
      {activeTab === 'audit_bahp' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-950 to-teal-900 text-white p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">
                Dokumen Berita Acara Hasil Pemilihan (BAHP) Ketua {school.name}
              </h3>
              <p className="text-xs text-emerald-200 mt-1">
                Cetak dokumen resmi rekapitulasi suara sah dan pengesahan Ketua Masjid terpilih ({school.principal_name})
              </p>
            </div>
            <button
              onClick={() => setIsBahpPrintMode(true)}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Buka &amp; Cetak BAHP Resmi</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-900">
                Rekam Jejak Audit Sistem (Audit Log Anonim)
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Peran</th>
                    <th className="py-3 px-4">Aksi</th>
                    <th className="py-3 px-4">Rincian Aktivitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs
                    .slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize)
                    .map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{log.user_role}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{log.details}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={auditPage}
              totalItems={auditLogs.length}
              pageSize={auditPageSize}
              onPageChange={(p) => setAuditPage(p)}
              onPageSizeChange={(s) => {
                setAuditPageSize(s);
                setAuditPage(1);
              }}
              itemLabel="log aktivitas"
            />
          </div>
        </div>
      )}

      {/* TAB 7: SUPABASE SETTINGS */}
      {activeTab === 'supabase' && <SupabaseSettings />}

      {/* TAB 8: GANTI PASSWORD */}
      {activeTab === 'password' && authUser && (
        <ChangePasswordView user={authUser} userRoleLabel="Admin Utama Masjid Nurul Hidayah" />
      )}

      {/* MODAL PERIODE */}
      {isPeriodModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {editingPeriod ? 'Edit Periode Pemilihan' : 'Tambah Periode Pemilihan'}
              </h3>
              <button
                onClick={() => setIsPeriodModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePeriod} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Periode</label>
                <input
                  type="text"
                  value={periodForm.period_name}
                  onChange={(e) => setPeriodForm({ ...periodForm, period_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Masa Khidmat (Tahun)
                </label>
                <input
                  type="text"
                  value={periodForm.academic_year}
                  onChange={(e) =>
                    setPeriodForm({ ...periodForm, academic_year: e.target.value })
                  }
                  placeholder="Contoh: 2026–2029"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Status</label>
                <select
                  value={periodForm.status}
                  onChange={(e) =>
                    setPeriodForm({
                      ...periodForm,
                      status: e.target.value as 'draft' | 'aktif' | 'selesai',
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="draft">Draft (Persiapan)</option>
                  <option value="aktif">Aktif (Pemungutan Suara Dibuka)</option>
                  <option value="selesai">Selesai (Ditutup)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPeriodModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PANITIA (DENGAN PILIH DARI DAFTAR JAMAAH) */}
      {isCommitteeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {editingCommittee ? 'Edit Anggota Panitia' : 'Tambah Panitia dari Jamaah'}
              </h3>
              <button
                onClick={() => setIsCommitteeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCommittee} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-emerald-800 block mb-1">
                  Pilih Cepat dari Daftar Jamaah (RT.03, RT.04, RT.05 Lk.II)
                </label>
                <select
                  onChange={(e) => {
                    const selected = votersList.find((v) => v.id === e.target.value);
                    if (selected) {
                      const slug = selected.full_name
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '')
                        .slice(0, 12);
                      setCommitteeForm({
                        ...committeeForm,
                        member_name: selected.full_name,
                        email: `${slug}@nurulhidayah.id`,
                      });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50/40 font-semibold text-emerald-950"
                >
                  <option value="">-- Pilih Nama Jamaah atau Ketik Manual di Bawah --</option>
                  {votersList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.full_name} ({v.class_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Lengkap Panitia</label>
                <input
                  type="text"
                  value={committeeForm.member_name}
                  onChange={(e) =>
                    setCommitteeForm({ ...committeeForm, member_name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Jabatan Kepanitiaan</label>
                <select
                  value={committeeForm.role}
                  onChange={(e) =>
                    setCommitteeForm({
                      ...committeeForm,
                      role: e.target.value as Committee['role'],
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Ketua Panitia">Ketua Panitia</option>
                  <option value="Sekretaris">Sekretaris</option>
                  <option value="Bendahara">Bendahara</option>
                  <option value="Seksi Teknis IT">Seksi Teknis IT</option>
                  <option value="Seksi Bilik Suara">Seksi Bilik Suara</option>
                  <option value="Anggota">Anggota</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nomor SK Panitia</label>
                <input
                  type="text"
                  value={committeeForm.sk_number}
                  onChange={(e) =>
                    setCommitteeForm({ ...committeeForm, sk_number: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={committeeForm.email}
                  onChange={(e) => setCommitteeForm({ ...committeeForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCommitteeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL USER SISTEM (PILIH DARI DAFTAR JAMAAH ATAU MANUAL) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {editingUser ? 'Ubah Akun Petugas / Admin' : 'Tambah Akun Panitia dari Jamaah'}
              </h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              {!editingUser && (
                <div>
                  <label className="font-bold text-emerald-800 block mb-1">
                    Ambil Nama dari Daftar Jamaah (RT.03, RT.04, RT.05 Lk.II)
                  </label>
                  <select
                    onChange={(e) => {
                      const selected = votersList.find((v) => v.id === e.target.value);
                      if (selected) {
                        const slug = selected.full_name
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, '')
                          .slice(0, 10);
                        setUserForm({
                          ...userForm,
                          name: `${selected.full_name} (${selected.class_name})`,
                          username: slug,
                          email: `${slug}@nurulhidayah.id`,
                          password: 'dkmnh12345',
                        });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50/50 font-semibold text-emerald-950"
                  >
                    <option value="">-- Pilih Jamaah untuk Dijadikan Panitia --</option>
                    {votersList.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.full_name} — {v.class_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Username Login</label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Password (Default: dkmnh12345)
                </label>
                <input
                  type="text"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="dkmnh12345"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-emerald-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Role Akses</label>
                  <select
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm({ ...userForm, role: e.target.value as AppUserRole })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="admin">Admin Utama DKM</option>
                    <option value="panitia">Panitia Pemilihan</option>
                    <option value="operator">Petugas Bilik Suara</option>
                    <option value="pengawas">Saksi / Pengawas</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Status</label>
                  <select
                    value={userForm.status}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        status: e.target.value as 'aktif' | 'nonaktif',
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        title="Konfirmasi Penghapusan Data"
        itemName={deleteModal.name}
        warningDetails={deleteModal.warningDetails}
        errorMessage={deleteModal.errorMessage}
        onConfirm={handleConfirmDelete}
        onCancel={() =>
          setDeleteModal({ ...deleteModal, isOpen: false, errorMessage: null })
        }
      />
    </div>
  );
};
