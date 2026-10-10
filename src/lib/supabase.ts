import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

// Otomatis tangkap parameter ?sb_url=...&sb_key=... dari URL jika dibuka di perangkat/akun lain
try {
  if (typeof window !== 'undefined' && window.location && window.location.search) {
    const params = new URLSearchParams(window.location.search);
    const urlParam = (params.get('sb_url') || '').trim();
    const keyParam = (params.get('sb_key') || '').trim();
    if (urlParam && keyParam && urlParam.startsWith('http')) {
      localStorage.setItem('epilketos_custom_supabase_url', urlParam);
      localStorage.setItem('epilketos_custom_supabase_key', keyParam);
      // Bersihkan query string dari address bar setelah tersimpan
      params.delete('sb_url');
      params.delete('sb_key');
      const cleanSearch = params.toString();
      const newUrl =
        window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }
} catch {
  // ignore
}

// Kredensial bawaan Cloud Supabase resmi DKM Nurul Hidayah (Public Anon Key)
// Memastikan aplikasi di AI Studio maupun Vercel (pemilu-dkm.vercel.app) otomatis terhubung di semua perangkat/akun
export const DEFAULT_DKM_SUPABASE_URL = 'https://nrpjgkocqvgczorwrayr.supabase.co';
export const DEFAULT_DKM_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ycGpna29jcXZnY3pvcndyYXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNzMxMzgsImV4cCI6MjEwNjg0OTEzOH0.-u0CPTNEC9R7X3rD79ox4U4_Setdnh-sVbgzlnO1EBY';

// Baca URL dan Anon Key dari LocalStorage, Environment Variables, atau Default DKM Nurul Hidayah
export function getSupabaseConfig(): { url: string; key: string; isConfigured: boolean; source: 'env' | 'custom' | 'none' } {
  const customUrl = (localStorage.getItem('epilketos_custom_supabase_url') || '').trim();
  const customKey = (localStorage.getItem('epilketos_custom_supabase_key') || '').trim();

  if (customUrl && customKey && customUrl.startsWith('http')) {
    return {
      url: customUrl,
      key: customKey,
      isConfigured: true,
      source: 'custom',
    };
  }

  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envKey && envUrl.startsWith('http')) {
    return {
      url: envUrl,
      key: envKey,
      isConfigured: true,
      source: 'env',
    };
  }

  if (DEFAULT_DKM_SUPABASE_URL && DEFAULT_DKM_SUPABASE_ANON_KEY) {
    return {
      url: DEFAULT_DKM_SUPABASE_URL,
      key: DEFAULT_DKM_SUPABASE_ANON_KEY,
      isConfigured: true,
      source: 'env',
    };
  }

  return {
    url: '',
    key: '',
    isConfigured: false,
    source: 'none',
  };
}

export function saveCustomSupabaseConfig(url: string, key: string): void {
  localStorage.setItem('epilketos_custom_supabase_url', url.trim());
  localStorage.setItem('epilketos_custom_supabase_key', key.trim());
  supabaseInstance = null; // Reset client agar dire-create dengan credential baru
}

export function clearCustomSupabaseConfig(): void {
  localStorage.removeItem('epilketos_custom_supabase_url');
  localStorage.removeItem('epilketos_custom_supabase_key');
  supabaseInstance = null;
}

let supabaseInstance: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: false,
        },
      });
    } catch (err) {
      console.warn('Inisialisasi Supabase gagal:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export function isSupabaseActive(): boolean {
  return Boolean(getSupabase());
}

/**
 * Uji koneksi ke Supabase
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabase();
  if (!client) {
    return {
      success: false,
      message: 'Variabel VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum dikonfigurasi.',
    };
  }

  try {
    const { data, error } = await client.from('schools').select('id, name').limit(1);
    if (error) {
      return {
        success: false,
        message: `Koneksi gagal: ${error.message}. Pastikan Anda telah menjalankan kode SQL di Supabase SQL Editor.`,
      };
    }
    return {
      success: true,
      message: `Terhubung ke Supabase! (Ditemukan: ${data?.length || 0} profil masjid terdaftar).`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Koneksi gagal: ${(err as Error).message}`,
    };
  }
}

/**
 * Pasang listener Supabase Realtime untuk menyinkronkan data antar-perangkat secara instan
 */
export function setupRealtimeSubscription(onChange: (table: string, eventType: string) => void): () => void {
  const client = getSupabase();
  if (!client) return () => {};

  try {
    if (realtimeChannel) {
      client.removeChannel(realtimeChannel);
    }

    realtimeChannel = client
      .channel('epilketos-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          onChange(payload.table, payload.eventType);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Terhubung ke kanal realtime perubahan database.');
        }
      });

    return () => {
      if (realtimeChannel && client) {
        client.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
    };
  } catch (err) {
    console.warn('Gagal memasang Supabase Realtime channel:', err);
    return () => {};
  }
}
