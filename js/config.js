// MyFestival Configuration
// Detect environment variables from Vite or fallback to hardcoded values

export const SUPABASE_URL = 
  import.meta.env?.VITE_SUPABASE_URL || 
  localStorage.getItem('MYFESTIVAL_SUPABASE_URL') || 
  'https://xvqctqpmvjqarzabaxtm.supabase.co';

export const SUPABASE_ANON_KEY = 
  import.meta.env?.VITE_SUPABASE_ANON_KEY || 
  localStorage.getItem('MYFESTIVAL_SUPABASE_ANON_KEY') || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cWN0cXBtdmpxYXJ6YWJheHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MzA1NTYsImV4cCI6MjA5NjMwNjU1Nn0.dJanr0sQcdOpS-4fO2dO6Fnjuq3RZZOiNYC-VvESXio';

export const isConfigured = () => {
  return SUPABASE_URL.trim() !== '' && SUPABASE_ANON_KEY.trim() !== '';
};

export const saveCredentials = (url, key) => {
  localStorage.setItem('MYFESTIVAL_SUPABASE_URL', url.trim());
  localStorage.setItem('MYFESTIVAL_SUPABASE_ANON_KEY', key.trim());
};

export const clearCredentials = () => {
  localStorage.removeItem('MYFESTIVAL_SUPABASE_URL');
  localStorage.removeItem('MYFESTIVAL_SUPABASE_ANON_KEY');
};
