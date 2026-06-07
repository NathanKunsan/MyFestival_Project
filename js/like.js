// MyFestival - Like System Service
import { getSupabase } from './supabase.js';

// Check if a user has liked a message
export const checkUserLike = async (messageId, userId) => {
  const supabase = await getSupabase();
  if (!supabase || !userId) return false;
  
  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .maybeSingle();
    
  if (error) {
    console.error('Error checking user like:', error);
    return false;
  }
  return !!data;
};

// Toggle like status (Like / Unlike)
export const toggleLike = async (messageId, userId) => {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');
  if (!userId) throw new Error('กรุณาเข้าสู่ระบบก่อนกดถูกใจ');
  
  const isLiked = await checkUserLike(messageId, userId);
  
  if (isLiked) {
    // Unlike
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);
      
    if (error) throw error;
    
    // Log activity
    await logLikeActivity(supabase, userId, 'unlike', messageId);
    return false;
  } else {
    // Like
    const { error } = await supabase
      .from('likes')
      .insert({
        message_id: messageId,
        user_id: userId
      });
      
    if (error) throw error;
    
    // Log activity
    await logLikeActivity(supabase, userId, 'like', messageId);
    return true;
  }
};

// Get total likes for a message
export const getLikesCount = async (messageId) => {
  const supabase = await getSupabase();
  if (!supabase) return 0;
  
  const { count, error } = await supabase
    .from('likes')
    .select('id', { count: 'exact', head: true })
    .eq('message_id', messageId);
    
  if (error) {
    console.error('Error fetching likes count:', error);
    return 0;
  }
  return count || 0;
};

// Internal activity logger
async function logLikeActivity(supabase, userId, action, messageId) {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: `${action}_message`,
      details: { message_id: messageId }
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}
