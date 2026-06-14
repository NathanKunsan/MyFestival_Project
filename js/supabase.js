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

// Parse tags from message_text (stored in format: [Text]\n\n__TAGS__:tag1,tag2)
export function parseMessageTags(msg) {
  if (!msg) return msg;
  if (typeof msg.message_text === 'string') {
    const markers = ['__TAGS__:', '__TAGSUIUI__:', '__TAGSUI__:'];
    for (const marker of markers) {
      const index = msg.message_text.indexOf(marker);
      if (index !== -1) {
        msg.tags = msg.message_text.substring(index + marker.length).trim();
        msg.message_text = msg.message_text.substring(0, index).trim();
        return msg;
      }
    }
  }
  if (!msg.tags) {
    msg.tags = '';
  }
  return msg;
}

// Serialize message text and tags back into message_text
export function serializeMessageTags(text, tags) {
  const cleanText = (text || '').trim();
  const cleanTags = (tags || '').trim();
  if (cleanTags) {
    return `${cleanText}\n\n__TAGS__:${cleanTags}`;
  }
  return cleanText;
}

