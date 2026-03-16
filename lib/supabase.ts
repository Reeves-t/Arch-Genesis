import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://hyzhryvbdfdqrvyurhej.supabase.co';

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5emhyeXZiZGZkcXJ2eXVyaGVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTMyNDAsImV4cCI6MjA4ODk4OTI0MH0.GjWAFrIOOSOtXaQLXuxEHQuffXMo1WUYNNjbqP21Q84';

// In-memory storage that works in Expo Go (no native module needed).
// Sessions won't survive full app kills, but sign-in/up works fine.
const memoryStorage = new Map<string, string>();

const storage = {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => { memoryStorage.set(key, value); },
  removeItem: (key: string) => { memoryStorage.delete(key); },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
