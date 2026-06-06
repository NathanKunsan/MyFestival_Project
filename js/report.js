// MyFestival - Report System Service
import { getSupabase } from './supabase.js';

// Submit a message report
export const submitReport = async (messageId, reporterId, reason) => {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');
  
  const reportPayload = {
    message_id: messageId,
    reason: reason.trim()
  };
  
  if (reporterId) {
    reportPayload.reporter_id = reporterId;
  }
  
  const { data, error } = await supabase
    .from('reports')
    .insert(reportPayload)
    .select()
    .single();
    
  if (error) {
    console.error('Error submitting report:', error);
    throw error;
  }
  
  // Log activity
  try {
    await supabase.from('activity_logs').insert({
      user_id: reporterId || null,
      action: 'report_message',
      details: { message_id: messageId, report_id: data.id }
    });
  } catch (err) {
    console.error('Failed to log report activity:', err);
  }
  
  return data;
};
