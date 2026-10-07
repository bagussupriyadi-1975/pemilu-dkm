import React, { useState, useEffect } from 'react';
import {
  School,
  ElectionPeriod,
  Candidate,
  Voter,
  PanitiaTab,
  AuthUser,
  UnsurJamaahType,
  BoothLockMode,
} from '../../types';
import { db, realtimeBus, getBoothAccessStatus, formatIndonesianDateTime } from '../../lib/storage';
import { exportDptToCsv, downloadDptTemplate, parseDptCsv } from '../../lib/exportUtils';
import {
  Users,
  Award,
  KeyRound,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit,
  RotateCcw,
  Search,
  Printer,
  Download,
  Upload,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
  LogOut,
  CreditCard,
  MapPin,
  Lock,
  Unlock,
  Calendar,
  MessageCircle,
  ClipboardList,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { PrintableTokenCards } from '../print/PrintableTokenCards';
import { PrintableAttendanceList } from '../print/PrintableAttendanceList';
import { Pagination } from '../common/Pagination';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { ChangePasswordView } from '../common/ChangePasswordView';

interface PanitiaDashboardProps {
  school: School;
  activePeriod: ElectionPeriod | null;
  activeTab?: PanitiaTab;
  onTabChange?: (tab: PanitiaTab) => void;
  authUser?: AuthUser | null;
  onLogout?: () => void;
  embeddedInAdmin?: boolean;
  embeddedSection?: 'dpt' | 'paslon' | 'token';
}

export const PanitiaDashboard: React.FC<PanitiaDashboardProps> = ({
  school,
  activePeriod,
  activeTab: propTab,
  onTabChange,
  authUser,
  onLogout,
  embeddedInAdmin = false,
  embeddedSection = 'dpt',
}) => {
  const [internalTab, setInternalTab] = useState<PanitiaTab>('dpt');
  const activeTab = embeddedInAdmin ? embeddedSection : propTab || internalTab;

  const handleTabSelect = (tab: PanitiaTab) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [selectedUnsurFilter, setSelectedUnsurFilter] = useState('ALL');
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [isAttendancePrintMode, setIsAttendancePrintMode] = useState(false);
  const [waModalVoter, setWaModalVoter] = useState<Voter | null>(null);
  const [waPhoneInput, setWaPhoneInput] = useState('');
  const [waCopied, setWaCopied] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmRegenPins, setConfirmRegenPins] = useState(false);
  const [confirmUnlockAllTokens, setConfirmUnlockAllTokens] = useState(false);
  const [unlockTokenDropdown, setUnlockTokenDropdown] = useState(false);

  const handleOpenWaModal = (voter: Voter) => {
    setWaModalVoter(voter);
    setWaPhoneInput(voter.phone && voter.phone !== '-' ? voter.phone : '0812');
    setWaCopied(false);
  };

  const buildWhatsAppMessage = (voter: Voter) => {
    const startInfo = formatIndonesianDateTime(school.voting_start_datetime);
    const endInfo = formatIndonesianDateTime(school.voting_end_datetime);
    const loc =
      school.voting_location ||
      'Ruang Utama Masjid Nurul Hidayah, Jl. Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan';
    return (
      `*UNDANGAN & KARTU TOKEN SUARA DIGITAL*\n` +
      `*PEMILIHAN KETUA DEWAN KEMAKMURAN MASJID (DKM)*\n` +
      `*NURUL HIDAYAH — MASA KHIDMAT ${activePeriod?.academic_year || '2026 - 2028'}*\n` +
      `--------------------------------------------\n` +
      `Assalamu'alaikum Wr. Wb.\n` +
      `Kepada Yth. Bapak/Ibu/Sdr/i:\n` +
      `*Nama:* ${voter.full_name}\n` +
      `*Wilayah:* ${voter.class_name} (Lingkungan II Kel. Kuripan)\n` +
      `*Unsur:* ${voter.unsur || 'Jamaah'}\n\n` +
      `Berikut adalah *Kode Token Suara* Anda untuk memberikan hak suara pada Pemilihan Ketua DKM Nurul Hidayah:\n\n` +
      `🔑 *KODE TOKEN: ${voter.pin_plain}*\n` +
      `_(Rahasia — Berlaku untuk 1 kali pemberian suara di Bilik Suara)_\n\n` +
      `*Jadwal Pelaksanaan Pemilihan:*\n` +
      `📅 *Hari/Tanggal:* ${startInfo.dayName}, ${startInfo.dateFull}\n` +
      `⏰ *Waktu:* Pukul ${startInfo.timeFull} s.d. ${endInfo.timeFull}\n` +
      `📍 *Tempat:* ${loc}\n\n` +
      `Jazakumullahu Khairan Katsiran atas kehadiran dan partisipasi Anda demi kemakmuran Masjid Nurul Hidayah.\n` +
      `Wassalamu'alaikum Wr. Wb.\n` +
      `— *Panitia Pemilihan Ketua DKM Nurul Hidayah*`
    );
  };

  const formatWaNumber = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) {
      return '62' + digits.slice(1);
    }
    if (digits.startsWith('8')) {
      return '62' + digits;
    }
    return digits || '62812';
  };

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusNotice({ type, text });
    setTimeout(() => setStatusNotice(null), 4500);
  };

  // Delete Confirmation Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'voter' | 'candidate';
    item: any;
    name: string;
    warningDetails?: string;
  }>({
    isOpen: false,
    type: 'voter',
    item: null,
    name: '',
  });

  // Pagination state for DPT
  const [dptPage, setDptPage] = useState(1);
  const [dptPageSize, setDptPageSize] = useState(15);

  useEffect(() => {
    setDptPage(1);
  }, [searchQuery, selectedClassFilter, selectedUnsurFilter]);

  // Modal State for Candidate Add/Edit
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [candForm, setCandForm] = useState({
    ballot_number: 1,
    chairman_name: '',
    vice_chairman_name: '',
    chairman_class: 'RT.04 Lk.II',
    vice_chairman_class: 'RT.05 Lk.II',
    photo_url: '',
    vision: '',
    mission: '',
    programs: '',
    video_url: '',
  });

  // Complete KTP & KK Jamaah Modal State
  const [isVoterModalOpen, setIsVoterModalOpen] = useState(false);
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
  const [voterForm, setVoterForm] = useState({
    nisn: '',
    no_kk: '',
    full_name: '',
    class_name: 'RT.04 Lk.II',
    unsur: 'Jamaah' as UnsurJamaahType,
    gender: 'L' as 'L' | 'P',
    birth_place: 'Bandar Lampung',
    birth_date: '1975-05-10',
    address_ktp:
      'Jalan Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan, Kec. Telukbetung Barat, Kota Bandar Lampung',
    religion: 'Islam',
    marital_status: 'Kawin' as 'Kawin' | 'Belum Kawin' | 'Cerai Hidup' | 'Cerai Mati',
    occupation: 'Wiraswasta',
    phone: '',
    pin_plain: '',
    has_voted: false,
  });

  const handleOpenAddVoter = () => {
    setEditingVoter(null);
    setUnlockTokenDropdown(false);
    const tokenPool = db.getAvailableTokens(activePeriod?.id);
    const firstFree = tokenPool.find((t) => !t.isAssigned);
    const defaultToken = firstFree ? firstFree.token : `NH${String(voters.length + 1).padStart(4, '0')}`;
    setVoterForm({
      nisn: `187103${Math.floor(1000000000 + Math.random() * 8999999999)}`,
      no_kk: `1871030101${Math.floor(100000 + Math.random() * 899999)}`,
      full_name: '',
      class_name: 'RT.04 Lk.II',
      unsur: 'Jamaah',
      gender: 'L',
      birth_place: 'Bandar Lampung',
      birth_date: '1975-01-01',
      address_ktp:
        'Jalan Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan, Kec. Telukbetung Barat, Kota Bandar Lampung',
      religion: 'Islam',
      marital_status: 'Kawin',
      occupation: 'Wiraswasta',
      phone: '0812',
      pin_plain: defaultToken,
      has_voted: false,
    });
    setIsVoterModalOpen(true);
  };

  const handleEditVoter = (voter: Voter) => {
    setEditingVoter(voter);
    setUnlockTokenDropdown(false);
    setVoterForm({
      nisn: voter.nisn,
      no_kk: voter.no_kk || '1871030101100401',
      full_name: voter.full_name,
      class_name: voter.class_name || 'RT.04 Lk.II',
      unsur: voter.unsur || 'Jamaah',
      gender: voter.gender,
      birth_place: voter.birth_place || 'Bandar Lampung',
      birth_date: voter.birth_date || '1975-01-01',
      address_ktp:
        voter.address_ktp ||
        `Jalan Timor Gg. Masjid ${voter.class_name} Kel. Kuripan, Kec. Telukbetung Barat, Kota Bandar Lampung`,
      religion: voter.religion || 'Islam',
      marital_status: voter.marital_status || 'Kawin',
      occupation: voter.occupation || 'Wiraswasta',
      phone: voter.phone || '-',
      pin_plain: voter.pin_plain,
      has_voted: Boolean(voter.has_voted),
    });
    setIsVoterModalOpen(true);
  };

  const loadData = () => {
    if (!activePeriod) return;
    setCandidates(db.getCandidates(activePeriod.id));
    setVoters(db.getVoters(activePeriod.id));
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    realtimeBus.addEventListener('candidates_updated', handleUpdate);
    realtimeBus.addEventListener('voters_updated', handleUpdate);
    realtimeBus.addEventListener('vote_casted', handleUpdate);
    realtimeBus.addEventListener('data_reset', handleUpdate);
    realtimeBus.addEventListener('supabase_synced', handleUpdate);

    return () => {
      realtimeBus.removeEventListener('candidates_updated', handleUpdate);
      realtimeBus.removeEventListener('voters_updated', handleUpdate);
      realtimeBus.removeEventListener('vote_casted', handleUpdate);
      realtimeBus.removeEventListener('data_reset', handleUpdate);
      realtimeBus.removeEventListener('supabase_synced', handleUpdate);
    };
  }, [activePeriod]);

  // Handle Upload File Foto Kandidat dari Perangkat (Rasio Kotak Portrait 4:5 Menyatu dengan Card)
  const handleCandidatePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      // Format otomatis ke rasio kotak portrait 4:5 (800x1000) fokus bagian atas/wajah agar menyatu penuh dengan card
      const img = new Image();
      img.onload = () => {
        const targetW = 800;
        const targetH = 1000; // Rasio 4:5
        const targetRatio = targetW / targetH;
        const srcRatio = img.width / img.height;

        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (srcRatio > targetRatio) {
          // Gambar terlalu lebar -> ambil tengah secara horizontal
          sw = Math.round(img.height * targetRatio);
          sx = Math.round((img.width - sw) / 2);
        } else if (srcRatio < targetRatio) {
          // Gambar lebih tinggi -> ambil dari bagian atas (kepala/peci tidak terpotong)
          sh = Math.round(img.width / targetRatio);
          sy = 0;
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
          const compressed = canvas.toDataURL('image/jpeg', 0.9);
          setCandForm((prev) => ({ ...prev, photo_url: compressed }));
        } else {
          setCandForm((prev) => ({ ...prev, photo_url: dataUrl }));
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle Candidate Form Submit
  const handleSaveCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeriod) return;

    const missionArr = candForm.mission
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const programsArr = candForm.programs
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    db.saveCandidate(
      {
        election_period_id: activePeriod.id,
        ballot_number: Number(candForm.ballot_number),
        chairman_name: candForm.chairman_name,
        vice_chairman_name: candForm.vice_chairman_name,
        chairman_class: candForm.chairman_class,
        vice_chairman_class: candForm.vice_chairman_class,
        photo_url:
          candForm.photo_url ||
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
        vision: candForm.vision,
        mission: missionArr.length
          ? missionArr
          : ['Memakmurkan Masjid Nurul Hidayah dan melayani jamaah dengan amanah.'],
        programs: programsArr.length ? programsArr : ['Pengelolaan Kas Masjid Transparan'],
        video_url: candForm.video_url,
      },
      editingCandidate?.id
    );

    setIsCandidateModalOpen(false);
    setEditingCandidate(null);
    showNotice('Data pasangan calon Ketua Masjid berhasil disimpan.');
  };

  const handleEditCandidate = (cand: Candidate) => {
    setEditingCandidate(cand);
    setCandForm({
      ballot_number: cand.ballot_number,
      chairman_name: cand.chairman_name,
      vice_chairman_name: cand.vice_chairman_name,
      chairman_class: cand.chairman_class,
      vice_chairman_class: cand.vice_chairman_class,
      photo_url: cand.photo_url,
      vision: cand.vision,
      mission: cand.mission.join('\n'),
      programs: cand.programs.join('\n'),
      video_url: cand.video_url || '',
    });
    setIsCandidateModalOpen(true);
  };

  const handleDeleteCandidate = (cand: Candidate) => {
    setDeleteModal({
      isOpen: true,
      type: 'candidate',
      item: cand,
      name: `Calon No. 0${cand.ballot_number} (${cand.chairman_name} & ${cand.vice_chairman_name})`,
      warningDetails:
        'Data pasangan calon Ketua Masjid dan riwayat perolehan suaranya akan dihapus permanen.',
    });
  };

  const handleDeleteVoter = (voter: Voter) => {
    setDeleteModal({
      isOpen: true,
      type: 'voter',
      item: voter,
      name: `${voter.full_name} (${voter.class_name}) - Token: ${voter.pin_plain}`,
      warningDetails: voter.has_voted
        ? 'Perhatian: Jamaah ini tercatat telah memberikan suara di bilik suara.'
        : 'Data KTP/KK jamaah dan kode token akan dihapus dari Daftar Pemilih Tetap.',
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteModal.item) return;

    if (deleteModal.type === 'voter') {
      db.deleteVoter(deleteModal.item.id);
      loadData();
      showNotice(`Data jamaah ${deleteModal.name} berhasil dihapus.`);
    } else if (deleteModal.type === 'candidate') {
      db.deleteCandidate(deleteModal.item.id);
      loadData();
      showNotice(`Data calon ${deleteModal.name} berhasil dihapus.`);
    }

    setDeleteModal({ isOpen: false, type: 'voter', item: null, name: '' });
  };

  // Handle Add / Edit Voter (Complete KTP Data + Token Pool 1-300 Locking)
  const handleSaveVoter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeriod) return;
    if (!voterForm.full_name.trim() || !voterForm.nisn.trim()) {
      showNotice('Nama Lengkap dan NIK / Nomor Identitas wajib diisi!', 'error');
      return;
    }

    try {
      if (editingVoter) {
        const wasLocked = Boolean(editingVoter.has_voted);
        const isNowUnlocked = !voterForm.has_voted;
        db.updateVoter(
          editingVoter.id,
          {
            nisn: voterForm.nisn.trim(),
            no_kk: voterForm.no_kk.trim(),
            full_name: voterForm.full_name.trim(),
            class_name: voterForm.class_name.trim(),
            unsur: voterForm.unsur,
            gender: voterForm.gender,
            birth_place: voterForm.birth_place.trim(),
            birth_date: voterForm.birth_date,
            address_ktp: voterForm.address_ktp.trim(),
            religion: voterForm.religion,
            marital_status: voterForm.marital_status,
            occupation: voterForm.occupation.trim(),
            phone: voterForm.phone.trim(),
            pin_plain: voterForm.pin_plain.trim().toUpperCase(),
            has_voted: voterForm.has_voted,
          },
          { allowSwapToken: unlockTokenDropdown }
        );
        showNotice(
          wasLocked && isNowUnlocked
            ? `Kunci Token ${voterForm.pin_plain} milik "${voterForm.full_name}" berhasil dibuka menjadi BELUM DIGUNAKAN (Tetap No. Token ${voterForm.pin_plain})!`
            : `Data KTP & Token Jamaah "${voterForm.full_name}" (${voterForm.pin_plain}) berhasil diperbarui!`
        );
      } else {
        db.addSingleVoter({
          election_period_id: activePeriod.id,
          nisn: voterForm.nisn.trim(),
          no_kk: voterForm.no_kk.trim(),
          full_name: voterForm.full_name.trim(),
          class_name: voterForm.class_name.trim(),
          unsur: voterForm.unsur,
          gender: voterForm.gender,
          birth_place: voterForm.birth_place.trim(),
          birth_date: voterForm.birth_date,
          address_ktp: voterForm.address_ktp.trim(),
          religion: voterForm.religion,
          marital_status: voterForm.marital_status,
          occupation: voterForm.occupation.trim(),
          phone: voterForm.phone.trim(),
          is_kk_representative: true,
          custom_pin: voterForm.pin_plain.trim().toUpperCase(),
        });
        showNotice(
          `Jamaah baru "${voterForm.full_name}" berhasil ditambahkan dengan Token ${voterForm.pin_plain} (Terkunci).`
        );
      }

      setIsVoterModalOpen(false);
      setEditingVoter(null);
      loadData();
    } catch (err: any) {
      showNotice(err.message || 'Gagal menyimpan data jamaah.', 'error');
    }
  };

  // Handle CSV Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePeriod) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseDptCsv(text);
        if (parsed.length === 0) {
          showNotice(
            'Format CSV tidak sesuai atau kosong. Gunakan template CSV resmi.',
            'error'
          );
          return;
        }
        const added = db.importVoters(activePeriod.id, parsed);
        showNotice(`Berhasil mengimpor ${added} data jamaah baru beserta Token PIN otomatis!`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reset PIN Single Voter
  const handleResetPin = (voter: Voter) => {
    try {
      const newPin = db.resetVoterPin(voter.id);
      showNotice(`Token PIN baru untuk ${voter.full_name}: ${newPin}`);
    } catch (err: any) {
      showNotice(err.message, 'error');
    }
  };

  // Buka Kunci Token 1 Jamaah (Ubah Sudah Digunakan -> Belum Digunakan dengan Nomor Token yang Tetap Sama)
  const handleUnlockSingleToken = (voter: Voter) => {
    try {
      const updated = db.unlockVoterToken(voter.id);
      loadData();
      showNotice(
        `Kunci Token ${updated.pin_plain} milik ${updated.full_name} berhasil dibuka! Status kini "Belum Digunakan" dengan tetap memakai No. Token ${updated.pin_plain}.`
      );
    } catch (err: any) {
      showNotice(err.message, 'error');
    }
  };

  // Buka Kunci Semua Token yang Sudah Digunakan (Tetap Nomor Token Masing-Masing)
  const handleUnlockAllUsedTokens = () => {
    if (!activePeriod) return;
    const count = db.unlockAllVoterTokens(activePeriod.id);
    setConfirmUnlockAllTokens(false);
    loadData();
    showNotice(
      `Berhasil membuka kunci ${count} Token jamaah menjadi "Belum Digunakan" (Nomor Token masing-masing jamaah tetap sama)!`
    );
  };

  // Regenerate All Unvoted PINs
  const handleBulkRegeneratePins = () => {
    if (!activePeriod) return;
    const count = db.regenerateAllPins(activePeriod.id);
    setConfirmRegenPins(false);
    showNotice(`Berhasil memperbarui ${count} kode Token PIN jamaah!`);
  };

  // Unique RT list for filter
  const classList = Array.from(new Set(voters.map((v) => v.class_name))).sort();

  // Filtered voters
  const filteredVoters = voters.filter((v) => {
    const matchClass = selectedClassFilter === 'ALL' || v.class_name === selectedClassFilter;
    const matchUnsur =
      selectedUnsurFilter === 'ALL' || (v.unsur || 'Jamaah') === selectedUnsurFilter;
    const q = searchQuery.toLowerCase();
    const matchQuery =
      v.full_name.toLowerCase().includes(q) ||
      v.nisn.toLowerCase().includes(q) ||
      (v.no_kk && v.no_kk.toLowerCase().includes(q)) ||
      v.class_name.toLowerCase().includes(q) ||
      v.pin_plain.toLowerCase().includes(q) ||
      (v.occupation && v.occupation.toLowerCase().includes(q));
    return matchClass && matchUnsur && matchQuery;
  });

  if (isPrintMode) {
    return (
      <PrintableTokenCards
        school={school}
        activePeriod={activePeriod}
        voters={filteredVoters}
        onBack={() => setIsPrintMode(false)}
      />
    );
  }

  if (isAttendancePrintMode) {
    return (
      <PrintableAttendanceList
        school={school}
        activePeriod={activePeriod}
        voters={voters}
        committees={db.getCommittees(activePeriod?.id)}
        onBack={() => setIsAttendancePrintMode(false)}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Status Notice Toast */}
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

      {/* Header Banner (Only show if not embedded inside Admin) */}
      {!embeddedInAdmin && (
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-2 border border-emerald-200">
              <Users className="w-3.5 h-3.5" />
              <span>Portal Panitia Pemilihan &amp; Petugas Bilik Suara</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Manajemen Data Jamaah (KTP/KK), Token &amp; Paslon
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {school.name} &bull; RT.03, RT.04 &amp; RT.05 Lingkungan II Kel. Kuripan, Telukbetung
              Barat, Bandar Lampung
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsAttendancePrintMode(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Cetak Absensi / Daftar Hadir per RT (A4)</span>
            </button>

            <button
              onClick={() => setIsPrintMode(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Kartu Token Jamaah ({filteredVoters.length})</span>
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      {!embeddedInAdmin && (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
          <button
            onClick={() => handleTabSelect('dpt')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'dpt'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Data Jamaah KTP/KK ({voters.length})</span>
          </button>

          <button
            onClick={() => handleTabSelect('token')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'token'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Generator &amp; Distribusi Token</span>
          </button>

          <button
            onClick={() => handleTabSelect('paslon')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'paslon'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Calon Ketua Masjid ({candidates.length})</span>
          </button>

          <button
            onClick={() => handleTabSelect('monitoring')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'monitoring'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className="w-4 h-4 text-teal-400" />
            <span>Monitoring Kehadiran RT.03–05</span>
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
            <span>Ganti Kata Sandi</span>
          </button>
        </div>
      )}

      {/* TAB 1: MANAJEMEN DATA JAMAAH KOMPLIT SEPERTI KTP */}
      {activeTab === 'dpt' && (
        <div className="space-y-4">
          {/* Toolbar Filter & Action */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Nama Jamaah, NIK, No. KK, RT, atau Token..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {/* Filter RT & Lingkungan */}
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">Semua Wilayah RT (Lk.II)</option>
                {classList.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>

              {/* Filter Unsur Jamaah (2 Kategori: Jamaah & Jamaah + Pengurus) */}
              <select
                value={selectedUnsurFilter}
                onChange={(e) => setSelectedUnsurFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">Semua Unsur Jamaah</option>
                <option value="Jamaah">Jamaah</option>
                <option value="Jamaah + Pengurus">Jamaah + Pengurus</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleOpenAddVoter}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Data Jamaah (KTP)</span>
              </button>

              <button
                onClick={() => setIsAttendancePrintMode(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                title="Cetak Lembar Absensi / Daftar Hadir Jamaah Per RT (A4)"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Cetak Absensi per RT (A4)</span>
              </button>

              <button
                onClick={() => setIsPrintMode(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Token</span>
              </button>

              <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer border border-slate-300">
                <Upload className="w-3.5 h-3.5 text-emerald-700" />
                <span>Impor CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={downloadDptTemplate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                title="Unduh Format Template CSV Data KTP Jamaah"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Template CSV</span>
              </button>

              <button
                onClick={() =>
                  exportDptToCsv(filteredVoters, activePeriod?.academic_year || '2026-2029')
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Ekspor CSV</span>
              </button>
            </div>
          </div>

          {/* DPT Table Complete KTP Data */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">No</th>
                    <th className="py-3.5 px-4">Identitas KTP &amp; KK</th>
                    <th className="py-3.5 px-4">Nama Lengkap &amp; TTL</th>
                    <th className="py-3.5 px-4">RT &amp; Unsur Jamaah</th>
                    <th className="py-3.5 px-4">Pekerjaan &amp; Alamat</th>
                    <th className="py-3.5 px-4">Kode Token</th>
                    <th className="py-3.5 px-4">Status Suara</th>
                    <th className="py-3.5 px-4 text-right">Aksi Edit / Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredVoters.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Tidak ada data jamaah yang sesuai dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredVoters
                      .slice((dptPage - 1) * dptPageSize, dptPage * dptPageSize)
                      .map((voter, idx) => (
                        <tr key={voter.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {(dptPage - 1) * dptPageSize + idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-800 text-[11px]">
                              NIK: {voter.nisn}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500">
                              KK: {voter.no_kk || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-extrabold text-slate-900 text-xs">
                              {voter.full_name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {voter.birth_place || 'Bandar Lampung'},{' '}
                              {voter.birth_date || '1975-01-01'} ({voter.gender === 'L' ? 'Laki-laki' : 'Perempuan'})
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
                              <MapPin className="w-3 h-3" />
                              {voter.class_name}
                            </span>
                            <div className="text-[10px] font-semibold text-slate-600 mt-1">
                              {voter.unsur || 'Jamaah'}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-[200px]">
                            <div className="font-semibold text-slate-800 truncate">
                              {voter.occupation || 'Wiraswasta'} &bull; {voter.marital_status || 'Kawin'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {voter.address_ktp || 'Jl. Timor Gg. Masjid Kel. Kuripan'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 tracking-wider">
                              {voter.pin_plain}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {voter.has_voted ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <Lock className="w-3 h-3 text-rose-600" />
                                  Sudah Digunakan (Terkunci)
                                </span>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => handleUnlockSingleToken(voter)}
                                    title={`Buka kunci Token ${voter.pin_plain} agar menjadi Belum Digunakan (Tetap No. Token ${voter.pin_plain})`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[10px] shadow-2xs transition-colors cursor-pointer"
                                  >
                                    <Unlock className="w-2.5 h-2.5" />
                                    <span>Buka Kunci Token</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Belum Digunakan (Aktif)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenWaModal(voter)}
                                title="Kirim Kartu Token Digital via WhatsApp (1 Klik)"
                                className="px-2.5 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors cursor-pointer font-bold text-[11px] flex items-center gap-1 shadow-2xs"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Kirim WA</span>
                              </button>
                              <button
                                onClick={() => handleEditVoter(voter)}
                                title="Edit Data Lengkap KTP & Token Jamaah"
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer font-bold text-[11px] flex items-center gap-1"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit KTP</span>
                              </button>
                              <button
                                onClick={() => handleResetPin(voter)}
                                disabled={voter.has_voted}
                                title="Acak Ulang Token"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-30 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteVoter(voter)}
                                title="Hapus Jamaah"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={dptPage}
              totalItems={filteredVoters.length}
              pageSize={dptPageSize}
              onPageChange={(p) => setDptPage(p)}
              onPageSizeChange={(s) => {
                setDptPageSize(s);
                setDptPage(1);
              }}
              itemLabel="jamaah terdaftar"
            />
          </div>
        </div>
      )}

      {/* TAB 2: GENERATOR, KUNCI BILIK TOKEN & DISTRIBUSI KARTU TOKEN */}
      {activeTab === 'token' && (
        <div className="space-y-6">
          {/* PANEL KONTROL KUNCI BILIK TOKEN & JADWAL JAM BUKA / TUTUP OLEH PANITIA */}
          <div className="bg-white p-6 rounded-2xl border-2 border-emerald-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 block">
                  Pengamanan Bilik Suara &amp; Waktu Aktif Token
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Kontrol Kunci Bilik Token (Jam Buka &amp; Jam Tutup Pemilihan)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sebelum dibuka oleh Panitia atau sebelum jadwal jam buka, kode token terkunci otomatis. Setelah pemilihan selesai, Panitia dapat menutup kembali bilik suara.
                </p>
              </div>

              {(() => {
                const bStat = getBoothAccessStatus(school);
                return (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider shrink-0 border ${
                      bStat.isOpen
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    {bStat.isOpen ? (
                      <Unlock className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Lock className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{bStat.badgeText}</span>
                  </div>
                );
              })()}
            </div>

            {/* 3 Tombol Aksi Kunci / Buka Bilik Token */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  db.updateSchool({ booth_lock_mode: 'auto' as BoothLockMode });
                  showNotice('Bilik Token diatur mengikuti Jadwal Jam Buka & Jam Tutup Otomatis.');
                }}
                className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  (school.booth_lock_mode || 'auto') === 'auto'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-xs">
                  <Clock className="w-4 h-4 text-emerald-700" />
                  <span>Ikuti Jadwal Jam Buka/Tutup</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Otomatis terkunci sebelum waktu buka &amp; setelah waktu tutup.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  db.updateSchool({ booth_lock_mode: 'force_open' as BoothLockMode });
                  showNotice('Bilik Suara & Token DIBUKA oleh Panitia Pemilihan!');
                }}
                className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  school.booth_lock_mode === 'force_open'
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-xs">
                  <Unlock className="w-4 h-4" />
                  <span>Buka Bilik Token Sekarang</span>
                </div>
                <p
                  className={`text-[11px] mt-1 ${
                    school.booth_lock_mode === 'force_open' ? 'text-emerald-100' : 'text-slate-600'
                  }`}
                >
                  Buka bilik suara sekarang agar jamaah dapat memasukkan token.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  db.updateSchool({ booth_lock_mode: 'force_locked' as BoothLockMode });
                  showNotice('Bilik Suara & Token DIKUNCI / DITUTUP oleh Panitia Pemilihan!');
                }}
                className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  school.booth_lock_mode === 'force_locked'
                    ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-rose-50'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-xs">
                  <Lock className="w-4 h-4" />
                  <span>Kunci / Tutup Bilik Suara</span>
                </div>
                <p
                  className={`text-[11px] mt-1 ${
                    school.booth_lock_mode === 'force_locked' ? 'text-rose-100' : 'text-slate-600'
                  }`}
                >
                  Kunci bilik suara sebelum dimulai atau setelah selesai pemilihan.
                </p>
              </button>
            </div>

            {/* Pengaturan Tanggal & Jam Dibuka s.d. Ditutup langsung dari Tab Token */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Waktu Dibuka Token:</span>
                </label>
                <input
                  type="datetime-local"
                  value={school.voting_start_datetime || '2026-10-18T08:00'}
                  onChange={(e) => {
                    db.updateSchool({ voting_start_datetime: e.target.value });
                    showNotice('Jadwal waktu pembukaan token diperbarui.');
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-xs"
                />
                <div className="text-[10px] text-emerald-800 font-semibold mt-1">
                  {formatIndonesianDateTime(school.voting_start_datetime).fullSchedule}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Waktu Ditutup Token:</span>
                </label>
                <input
                  type="datetime-local"
                  value={school.voting_end_datetime || '2026-10-18T14:00'}
                  onChange={(e) => {
                    db.updateSchool({ voting_end_datetime: e.target.value });
                    showNotice('Jadwal waktu penutupan token diperbarui.');
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-xs"
                />
                <div className="text-[10px] text-amber-900 font-semibold mt-1">
                  {formatIndonesianDateTime(school.voting_end_datetime).fullSchedule}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <label className="font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Tempat Pelaksanaan:</span>
                </label>
                <input
                  type="text"
                  value={
                    school.voting_location ||
                    'Ruang Utama Masjid Nurul Hidayah, Jl. Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan'
                  }
                  onChange={(e) => {
                    db.updateSchool({ voting_location: e.target.value });
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs"
                />
                <div className="text-[10px] text-slate-500 mt-1 truncate">
                  Tampil di Countdown &amp; Bilik Suara
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Manajemen Token Suara Jamaah
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Pemilihan di Bilik Suara <strong>{school.name}</strong> cukup menggunakan{' '}
                <strong>Kode Token Unik</strong> tanpa perlu mengetik NIK panjang.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Token Jamaah:</span>
                <span className="font-bold font-mono text-slate-900">{voters.length} Token</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Token Belum Digunakan:</span>
                <span className="font-bold font-mono text-emerald-600">
                  {voters.filter((v) => !v.has_voted).length} Aktif
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Token Sudah Memilih:</span>
                <span className="font-bold font-mono text-slate-500">
                  {voters.filter((v) => v.has_voted).length} Hangus
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => setIsPrintMode(true)}
                className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Buka Layar Cetak Kartu Token (A4)</span>
              </button>

              <button
                onClick={() => setIsAttendancePrintMode(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ClipboardList className="w-4 h-4" />
                <span>Cetak Lembar Absensi / Daftar Hadir per RT (A4)</span>
              </button>

              {voters.some((v) => v.has_voted) && (
                <>
                  {!confirmUnlockAllTokens ? (
                    <button
                      type="button"
                      onClick={() => setConfirmUnlockAllTokens(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>
                        Buka Kunci Semua Token Terpakai ({voters.filter((v) => v.has_voted).length} Token)
                      </span>
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-400 space-y-2">
                      <p className="text-[11px] text-amber-950 font-bold leading-relaxed">
                        Ubah status semua token yang sudah digunakan ({voters.filter((v) => v.has_voted).length} token) kembali menjadi &ldquo;Belum Digunakan&rdquo; dengan TETAP mempertahankan Nomor Token masing-masing?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleUnlockAllUsedTokens}
                          className="flex-1 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Ya, Buka Kunci Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmUnlockAllTokens(false)}
                          className="flex-1 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!confirmRegenPins ? (
                <button
                  onClick={() => setConfirmRegenPins(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Acak Ulang Token (Belum Memilih)</span>
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-2">
                  <p className="text-[11px] text-amber-950 font-semibold">
                    Acak ulang seluruh Token untuk jamaah yang belum memilih?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleBulkRegeneratePins}
                      className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Ya, Acak Token
                    </button>
                    <button
                      onClick={() => setConfirmRegenPins(false)}
                      className="flex-1 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview Grid Kartu Token */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Pratinjau Kartu Token Jamaah (RT.03, RT.04 &amp; RT.05 Lk.II)
                </h4>
                <p className="text-xs text-slate-500">
                  Menampilkan 6 sampel kartu pertama
                </p>
              </div>
              <button
                onClick={() => setIsPrintMode(true)}
                className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Lihat Semua ({filteredVoters.length} Kartu) &rarr;
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredVoters.slice(0, 6).map((v) => (
                <div
                  key={v.id}
                  className="p-3.5 rounded-xl border-2 border-dashed border-emerald-200 bg-slate-50/60 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                      {school.name}
                    </span>
                    <h5 className="font-bold text-xs text-slate-900 truncate mt-0.5">
                      {v.full_name}
                    </h5>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {v.class_name} &bull; {v.unsur || 'Jamaah'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenWaModal(v)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold cursor-pointer"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Kirim WA Token</span>
                      </button>
                      {v.has_voted && (
                        <button
                          type="button"
                          onClick={() => handleUnlockSingleToken(v)}
                          title={`Buka kunci Token ${v.pin_plain} menjadi Belum Digunakan`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-extrabold cursor-pointer"
                        >
                          <Unlock className="w-3 h-3" />
                          <span>Buka Kunci</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bg-emerald-950 text-white px-3 py-2 rounded-lg text-center shrink-0">
                    <span className="text-[9px] text-emerald-300 block uppercase font-bold">
                      TOKEN
                    </span>
                    <span className="font-mono font-black text-sm text-amber-400 tracking-wider">
                      {v.pin_plain}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* TAB 3: MANAJEMEN CALON KETUA DKM (TUNGGAL TANPA WAKIL) */}
      {activeTab === 'paslon' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Manajemen Calon Ketua DKM Nurul Hidayah (Kandidat, Foto 4:5, Visi, Misi, Program &amp; Video)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tambah atau klik tombol <strong>&ldquo;Edit Kandidat&rdquo;</strong> pada kartu di bawah untuk mengisi Foto, Visi, Misi, Program Kerja, dan Link Video calon ketua
              </p>
            </div>

            <button
              onClick={() => {
                setEditingCandidate(null);
                setCandForm({
                  ballot_number: candidates.length + 1,
                  chairman_name: '',
                  vice_chairman_name: '',
                  chairman_class: 'RT.04 Lk.II',
                  vice_chairman_class: '',
                  photo_url: '',
                  vision: '',
                  mission: '',
                  programs: '',
                  video_url: '',
                });
                setIsCandidateModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Calon Ketua DKM</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {candidates.map((cand) => (
              <div
                key={cand.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Frame Foto Kandidat Rasio Kotak Portrait 4:5 Penuh Menyatu dengan Card */}
                  <div className="relative aspect-[4/5] w-full bg-slate-100 border-b border-slate-200 overflow-hidden">
                    <img
                      src={cand.photo_url}
                      alt={cand.chairman_name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-top"
                    />
                    <div className="absolute top-3 left-3 bg-emerald-950/90 text-white px-3 py-1 rounded-xl font-mono font-black text-sm">
                      No. 0{cand.ballot_number}
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-700">
                        Calon Ketua DKM &bull; Wilayah {cand.chairman_class}
                      </span>
                      <h4 className="font-extrabold text-base text-slate-900 mt-0.5">
                        {cand.chairman_name}
                      </h4>
                    </div>

                    <p className="text-xs text-slate-600 italic line-clamp-2">
                      &ldquo;{cand.vision}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEditCandidate(cand)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Foto, Visi Misi &amp; Video</span>
                  </button>
                  <button
                    onClick={() => handleDeleteCandidate(cand)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-xs font-semibold text-rose-700 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: MONITORING PARTISIPASI PER RT */}
      {!embeddedInAdmin && activeTab === 'monitoring' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Monitoring Kehadiran &amp; Partisipasi Jamaah per Wilayah RT (Lingkungan II)
            </h3>
            <p className="text-xs text-slate-500">
              Pantau persentase kehadiran pemilih RT.03, RT.04, dan RT.05 Lk.II secara langsung
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {classList.map((cls) => {
              const classVoters = voters.filter((v) => v.class_name === cls);
              const classVoted = classVoters.filter((v) => v.has_voted).length;
              const pct =
                classVoters.length > 0 ? Math.round((classVoted / classVoters.length) * 100) : 0;

              return (
                <div
                  key={cls}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">Wilayah {cls}</span>
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {pct}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Hadir Memilih: {classVoted} Jamaah</span>
                    <span>Total DPT: {classVoters.length}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: GANTI KATA SANDI */}
      {!embeddedInAdmin && activeTab === 'password' && authUser && (
        <ChangePasswordView user={authUser} userRoleLabel="Panitia Pemilihan Masjid" />
      )}

      {/* MODAL TAMBAH / EDIT CALON KETUA DKM */}
      {isCandidateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {editingCandidate
                  ? 'Edit Calon Ketua DKM Nurul Hidayah'
                  : 'Tambah Calon Ketua DKM Nurul Hidayah'}
              </h3>
              <button
                onClick={() => setIsCandidateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveCandidate}
              className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nomor Urut</label>
                  <input
                    type="number"
                    min={1}
                    max={9}
                    value={candForm.ballot_number}
                    onChange={(e) =>
                      setCandForm({ ...candForm, ballot_number: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                    required
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="font-bold text-slate-700 block">
                    Foto Calon Ketua (Tampil Utuh Tanpa Terpotong)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Foto dari Perangkat</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCandidatePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[11px] text-slate-500">atau tempel URL foto:</span>
                  </div>
                  <input
                    type="text"
                    value={candForm.photo_url}
                    onChange={(e) => setCandForm({ ...candForm, photo_url: e.target.value })}
                    placeholder="https://... atau upload file foto di atas"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                  {candForm.photo_url && (
                    <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-3">
                      <div className="w-20 aspect-[4/5] rounded-lg bg-white border border-slate-300 shrink-0 overflow-hidden">
                        <img
                          src={candForm.photo_url}
                          alt="Pratinjau Foto Calon"
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                      <div className="text-[11px] text-slate-600 leading-relaxed">
                        <strong className="text-emerald-800 block">
                          Pratinjau Foto Kandidat (Rasio Kotak Portrait 4:5)
                        </strong>
                        Foto pas menyatu dengan bingkai kartu kandidat tanpa ruang kosong.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Nama Calon Ketua DKM <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={candForm.chairman_name}
                    onChange={(e) => setCandForm({ ...candForm, chairman_name: e.target.value })}
                    placeholder="Contoh: Feriyanto"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Wilayah RT &amp; Lingkungan Calon <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={candForm.chairman_class}
                    onChange={(e) => setCandForm({ ...candForm, chairman_class: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    <option value="RT.03 Lk.II">RT.03 Lk.II</option>
                    <option value="RT.04 Lk.II">RT.04 Lk.II</option>
                    <option value="RT.05 Lk.II">RT.05 Lk.II</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Visi Kemakmuran Masjid <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={candForm.vision}
                  onChange={(e) => setCandForm({ ...candForm, vision: e.target.value })}
                  placeholder="Tuliskan visi utama calon Ketua DKM..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Misi Pelayanan &amp; Ketakmiran (Pisahkan tiap poin dengan Enter) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={candForm.mission}
                  onChange={(e) => setCandForm({ ...candForm, mission: e.target.value })}
                  placeholder="Baris 1: Misi pertama&#10;Baris 2: Misi kedua..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Program Kerja Unggulan DKM (Pisahkan tiap program dengan Enter) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={candForm.programs}
                  onChange={(e) => setCandForm({ ...candForm, programs: e.target.value })}
                  placeholder="Baris 1: Program pertama&#10;Baris 2: Program kedua..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Link Video Dokumentasi / Visi-Misi (YouTube / Google Drive — Opsional)
                </label>
                <input
                  type="text"
                  value={candForm.video_url}
                  onChange={(e) => setCandForm({ ...candForm, video_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=... (Kosongkan jika tidak ada)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCandidateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                >
                  Simpan Data Calon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT DATA JAMAAH KOMPLIT SEPERTI KTP */}
      {isVoterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {editingVoter
                      ? `Edit Data KTP & Token Jamaah: ${editingVoter.full_name}`
                      : 'Tambah Data Jamaah Lengkap (Format KTP & KK)'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {school.name} &bull; Kel. Kuripan, Kec. Telukbetung Barat, Kota Bandar Lampung
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsVoterModalOpen(false);
                  setEditingVoter(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveVoter}
              className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1"
            >
              {/* Baris 1: NIK KTP & No. KK */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    NIK KTP (16 Digit / ID Jamaah) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={voterForm.nisn}
                    onChange={(e) => setVoterForm({ ...voterForm, nisn: e.target.value })}
                    placeholder="Contoh: 1871031708790007"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Nomor Kartu Keluarga (No. KK - 1 KK 1 Suara)
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={voterForm.no_kk}
                    onChange={(e) => setVoterForm({ ...voterForm, no_kk: e.target.value })}
                    placeholder="Contoh: 1871030101100401"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono bg-white"
                  />
                </div>
              </div>

              {/* Baris 2: Nama Lengkap & Pilihan No. Token (1 s.d 300 + Akses Admin Buka Kunci) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="font-bold text-slate-700 block mb-1">
                    Nama Lengkap Jamaah (Sesuai KTP) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={voterForm.full_name}
                    onChange={(e) => setVoterForm({ ...voterForm, full_name: e.target.value })}
                    placeholder="Masukkan Nama Lengkap Jamaah"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                    required
                  />
                </div>
                <div className="sm:col-span-6">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-emerald-800">
                      Pilih No. Token (Urut 001 – 300) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setUnlockTokenDropdown(!unlockTokenDropdown)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-colors cursor-pointer ${
                        unlockTokenDropdown
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                      }`}
                      title="Aktifkan jika Admin ingin memilih/menukar nomor token yang sedang terkunci pada jamaah lain"
                    >
                      {unlockTokenDropdown ? (
                        <>
                          <Unlock className="w-3 h-3" />
                          <span>Pilihan Token Dibuka</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>Buka Kunci No. Token</span>
                        </>
                      )}
                    </button>
                  </div>
                  <select
                    value={voterForm.pin_plain}
                    onChange={(e) =>
                      setVoterForm({ ...voterForm, pin_plain: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 rounded-lg border-2 border-emerald-500 font-mono font-black text-emerald-950 bg-emerald-50/70 cursor-pointer"
                  >
                    {db
                      .getAvailableTokens(activePeriod?.id, editingVoter?.id)
                      .map((t) => (
                        <option
                          key={t.token}
                          value={t.token}
                          disabled={t.isAssigned && !unlockTokenDropdown}
                        >
                          {t.isAssigned
                            ? unlockTokenDropdown
                              ? `🔓 No.${String(t.number).padStart(3, '0')} — Token: ${t.token} (Tukar dengan: ${t.assignedTo})`
                              : `🔒 No.${String(t.number).padStart(3, '0')} - ${t.token} (TERDAFTAR: ${t.assignedTo} - TERKUNCI)`
                            : `✅ No.${String(t.number).padStart(3, '0')} — Token: ${t.token} (BELUM DIGUNAKAN)`}
                        </option>
                      ))}
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {unlockTokenDropdown
                      ? 'Mode Buka Kunci Aktif: Admin dapat memilih nomor token mana saja (otomatis bertukar jika sudah dipakai jamaah lain).'
                      : 'Token jamaah lain dikunci agar tidak dobel. Klik "Buka Kunci No. Token" di kanan atas jika ingin menukar nomor.'}
                  </span>
                </div>
              </div>

              {/* PANEL KHUSUS ADMIN: BUKA KUNCI STATUS PENGGUNAAN TOKEN (TETAP NO. TOKEN YANG SAMA) */}
              {editingVoter && (
                <div
                  className={`p-3.5 rounded-xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    voterForm.has_voted
                      ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                      : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-extrabold text-xs">
                      {voterForm.has_voted ? (
                        <>
                          <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            Status Token {voterForm.pin_plain}: SUDAH DIGUNAKAN (TERKUNCI DI BILIK SUARA)
                          </span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>
                            Status Token {voterForm.pin_plain}: BELUM DIGUNAKAN (AKTIF &amp; BISA DIPAKAI MEMILIH)
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] opacity-90">
                      {voterForm.has_voted
                        ? `Jika terjadi kesalahan yang tidak disengaja, Admin dapat membuka kunci Token ${voterForm.pin_plain} agar kembali "Belum Digunakan" dengan tetap memakai No. Token ${voterForm.pin_plain}.`
                        : `Kode Token ${voterForm.pin_plain} siap digunakan oleh ${voterForm.full_name} di Bilik Suara.`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {voterForm.has_voted ? (
                      <button
                        type="button"
                        onClick={() => setVoterForm({ ...voterForm, has_voted: false })}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Unlock className="w-4 h-4" />
                        <span>Buka Kunci Token (Tetap {voterForm.pin_plain})</span>
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white font-extrabold text-[11px] inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Token Aktif ({voterForm.pin_plain})</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Baris 3: Tempat Lahir, Tanggal Lahir, Jenis Kelamin */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tempat Lahir (KTP)
                  </label>
                  <input
                    type="text"
                    value={voterForm.birth_place}
                    onChange={(e) => setVoterForm({ ...voterForm, birth_place: e.target.value })}
                    placeholder="Bandar Lampung"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tanggal Lahir (KTP)
                  </label>
                  <input
                    type="date"
                    value={voterForm.birth_date}
                    onChange={(e) => setVoterForm({ ...voterForm, birth_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={voterForm.gender}
                    onChange={(e) =>
                      setVoterForm({ ...voterForm, gender: e.target.value as 'L' | 'P' })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              {/* Baris 4: Wilayah RT/Lingkungan & Unsur Jamaah (Hanya 2 Pilihan: Jamaah & Jamaah + Pengurus) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Kelompok Wilayah RT &amp; Lingkungan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={voterForm.class_name}
                    onChange={(e) => setVoterForm({ ...voterForm, class_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-emerald-900"
                  >
                    <option value="RT.03 Lk.II">RT.03 Lk.II (Kel. Kuripan)</option>
                    <option value="RT.04 Lk.II">RT.04 Lk.II (Kel. Kuripan)</option>
                    <option value="RT.05 Lk.II">RT.05 Lk.II (Kel. Kuripan)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Unsur Jamaah (Kategori Pemilih)
                  </label>
                  <select
                    value={voterForm.unsur}
                    onChange={(e) =>
                      setVoterForm({
                        ...voterForm,
                        unsur: e.target.value as UnsurJamaahType,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    <option value="Jamaah">Jamaah</option>
                    <option value="Jamaah + Pengurus">Jamaah + Pengurus</option>
                  </select>
                </div>
              </div>

              {/* Baris 5: Pekerjaan, Status Perkawinan, No HP */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Pekerjaan (Sesuai KTP)
                  </label>
                  <input
                    type="text"
                    value={voterForm.occupation}
                    onChange={(e) => setVoterForm({ ...voterForm, occupation: e.target.value })}
                    placeholder="Wiraswasta / PNS / Karyawan"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Status Perkawinan
                  </label>
                  <select
                    value={voterForm.marital_status}
                    onChange={(e) =>
                      setVoterForm({
                        ...voterForm,
                        marital_status: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Kawin">Kawin</option>
                    <option value="Belum Kawin">Belum Kawin</option>
                    <option value="Cerai Hidup">Cerai Hidup</option>
                    <option value="Cerai Mati">Cerai Mati</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    No. HP / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={voterForm.phone}
                    onChange={(e) => setVoterForm({ ...voterForm, phone: e.target.value })}
                    placeholder="0812..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              {/* Baris 6: Alamat KTP Lengkap */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Alamat Lengkap Sesuai KTP (Jalan, Gang, RT, Lingkungan, Kelurahan)
                </label>
                <input
                  type="text"
                  value={voterForm.address_ktp}
                  onChange={(e) => setVoterForm({ ...voterForm, address_ktp: e.target.value })}
                  placeholder="Jalan Timor Gg. Masjid RT.04 Lk.II Kel. Kuripan, Kec. Telukbetung Barat, Kota Bandar Lampung"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsVoterModalOpen(false);
                    setEditingVoter(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                >
                  {editingVoter ? 'Simpan Perubahan Data KTP Jamaah' : 'Tambahkan Jamaah & Buat Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KIRIM KARTU TOKEN DIGITAL VIA WHATSAPP (1 KLIK) */}
      {waModalVoter && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center shadow-xs">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Kirim Kartu Token Digital via WhatsApp
                  </h3>
                  <p className="text-xs text-slate-500">
                    {waModalVoter.full_name} &bull; {waModalVoter.class_name} (Token:{' '}
                    <strong className="font-mono text-emerald-800">{waModalVoter.pin_plain}</strong>)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaModalVoter(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nomor WhatsApp Jamaah (Format 08xx atau 628xx):
                </label>
                <input
                  type="text"
                  value={waPhoneInput}
                  onChange={(e) => setWaPhoneInput(e.target.value)}
                  placeholder="Contoh: 081279001234"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-sm text-slate-900"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Jika nomor WhatsApp diubah, sistem otomatis menyimpannya ke data KTP jamaah ini.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Pratinjau Pesan Undangan &amp; Kode Token WhatsApp:
                </label>
                <pre className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-[11px] font-sans whitespace-pre-wrap text-slate-800 leading-relaxed max-h-56 overflow-y-auto">
                  {buildWhatsAppMessage(waModalVoter)}
                </pre>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(buildWhatsAppMessage(waModalVoter));
                    setWaCopied(true);
                    showNotice(
                      `Pesan WhatsApp & Token (${waModalVoter.pin_plain}) untuk ${waModalVoter.full_name} berhasil disalin!`
                    );
                  } catch {
                    // ignore
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-300"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-700" />
                <span>{waCopied ? 'Teks Berhasil Disalin!' : 'Salin Teks Undangan'}</span>
              </button>

              <a
                href={`https://wa.me/${formatWaNumber(waPhoneInput)}?text=${encodeURIComponent(
                  buildWhatsAppMessage(waModalVoter)
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (waPhoneInput.trim() && waPhoneInput !== waModalVoter.phone) {
                    db.updateVoter(waModalVoter.id, { phone: waPhoneInput.trim() });
                  }
                  showNotice(
                    `Membuka WhatsApp untuk mengirim Kartu Token ${waModalVoter.pin_plain} kepada ${waModalVoter.full_name}...`
                  );
                }}
                className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Buka &amp; Kirim via WhatsApp Sekarang</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.type === 'voter' ? 'Hapus Data Jamaah' : 'Hapus Pasangan Calon'}
        itemName={deleteModal.name}
        warningDetails={deleteModal.warningDetails}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ ...deleteModal, isOpen: false })}
      />
    </div>
  );
};
