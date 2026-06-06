// MyFestival Supabase Client Instance (Browser Global from CDN)
import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from './config.js';

let supabaseClient = null;

// Retrieve the Supabase Client initialized from window.supabase loaded via CDN
export const getSupabase = () => {
  if (supabaseClient) return supabaseClient;
  
  if (!isConfigured()) {
    return null;
  }
  
  if (!window.supabase) {
    console.error('Supabase library is not loaded from CDN yet.');
    return null;
  }
  
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
};
