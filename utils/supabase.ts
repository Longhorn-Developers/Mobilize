import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from '~/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

//FOR TESTING, (chetan) USE NGROK EXPOSED URL. FOR PRODUCTION SWITCH BACK TO SUPABASE URL
export const supabase = createClient<Database>("https://ff018fa4462d.ngrok-free.app", supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
