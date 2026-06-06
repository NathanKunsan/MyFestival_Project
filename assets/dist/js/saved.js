// MyFestival - Saved Messages Controller
import { getSupabase } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { showToast, navigate } from './router.js';

let currentUserId = null;

// Initialize View
export const init = async () => {
  const user = await getCurrentUser();
  if (!user) {
    navigate('/login');
    return;
  }
  
  currentUserId = user.id;
  await loadAndRenderSavedList();
};

// Load saved lists and update DOM
async function loadAndRenderSavedList() {
  const listContainer = document.getElementById('saved-list');
  const totalBadge = document.getElementById('saved-total-badge');
  if (!listContainer) return;
  
  try {
    const rawSavedItems = await fetchUserSaved(currentUserId);
    const savedItems = (rawSavedItems || []).filter(item => item && item.id);
    
    // Update total count
    if (totalBadge) {
      totalBadge.textContent = `ทั้งหมด ${savedItems.length} ข้อความ`;
    }
    
    if (savedItems.length === 0) {
      listContainer.innerHTML = `
        <div class="col-span-full text-center py-12 flex flex-col items-center justify-center">
          <p class="text-3xl mb-4">📖</p>
          <p class="text-lg font-bold text-pencil-light italic mb-4">สมุดบันทึกเล่มนี้ยังไม่มีรายการคำอวยพรที่เซฟไว้...</p>
          <a href="/" class="sketch-btn btn-yellow">ไปลองสุ่มรับพรกันสักหน่อย 🎲</a>
        </div>
      `;
      return;
    }
    
    listContainer.innerHTML = savedItems.map(item => {
      const sig = item.is_anonymous || !item.signature ? 'ผู้ปรารถนาดี' : item.signature;
      
      return `
        <div class="sketch-card p-5 bg-white flex flex-col justify-between min-h-[180px] shadow-[4px_4px_0px_0px_#4a3c31]">
          <div>
            <div class="flex justify-between items-start mb-2">
              <span class="sketch-badge btn-cream text-[10px] font-black uppercase">
                🎉 ${item.festivalName || 'ทั่วไป'}
              </span>
              <button data-id="${item.id}" class="btn-unsave text-wood-red font-bold hover:underline text-sm flex items-center gap-0.5">
                🗑️ ลบออก
              </button>
            </div>
            
            <p class="text-base font-bold text-pencil italic mb-4 leading-relaxed">
              "${item.message_text || ''}"
            </p>
          </div>
          
          <div class="flex justify-between items-center pt-2 border-t border-pencil-soft">
            <span class="text-xs text-pencil-light font-bold">✍️ จาก: ${sig}</span>
            <a href="/message/${item.id}" class="sketch-btn btn-yellow text-xs py-1 px-3">
              💌 เปิดการ์ดเต็ม
            </a>
          </div>
        </div>
      `;
    }).join('');
    
    // Attach event listeners for unsaving
    listContainer.querySelectorAll('.btn-unsave').forEach(button => {
      button.addEventListener('click', async (e) => {
        const msgId = e.target.getAttribute('data-id');
        if (msgId) {
          await handleRemoveSave(msgId);
        }
      });
    });
    
  } catch (error) {
    console.error('Error rendering saved wishes:', error);
    listContainer.innerHTML = `
      <div class="col-span-full text-center py-12">
        <p class="text-wood-red font-bold text-lg">⚠️ เกิดข้อผิดพลาดในการโหลดรายการบันทึก</p>
        <p class="text-sm text-pencil-light mt-1">${error.message}</p>
      </div>
    `;
    showToast('เกิดข้อผิดพลาดในการดึงข้อมูลรายการที่บันทึกไว้', 'error');
  }
}

// Remove wish from saved list
async function handleRemoveSave(messageId) {
  try {
    await toggleSave(messageId, currentUserId);
    showToast('ลบการ์ดคำอวยพรออกจากรายการบันทึกแล้ว', 'info');
    await loadAndRenderSavedList(); // Re-render
  } catch (error) {
    showToast('ไม่สามารถลบข้อความได้: ' + error.message, 'error');
  }
}

// Database & LocalStorage saves functionality implementations
export const checkUserSave = async (messageId, userId) => {
  const supabase = await getSupabase();
  if (!supabase || !userId) return checkUserSaveLocal(messageId);
  
  try {
    const { data, error } = await supabase
      .from('saves')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) throw error;
    return !!data;
  } catch (err) {
    console.warn('Database checkUserSave failed, checking localStorage:', err.message);
    return checkUserSaveLocal(messageId);
  }
};

export const toggleSave = async (messageId, userId) => {
  const supabase = await getSupabase();
  const msgDetails = await getMessageDetailsForLocalSave(supabase, messageId);
  
  if (!supabase) {
    return toggleSaveLocal(messageId, msgDetails);
  }
  
  const isSaved = await checkUserSave(messageId, userId);
  
  try {
    if (isSaved) {
      const { error } = await supabase
        .from('saves')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId);
      if (error) throw error;
      
      await logSaveActivity(supabase, userId, 'unsave', messageId);
      toggleSaveLocal(messageId, msgDetails);
      return false;
    } else {
      const { error } = await supabase
        .from('saves')
        .insert({
          message_id: messageId,
          user_id: userId
        });
      if (error) throw error;
      
      await logSaveActivity(supabase, userId, 'save', messageId);
      toggleSaveLocal(messageId, msgDetails);
      return true;
    }
  } catch (err) {
    console.warn('Database save failed, using localStorage fallback:', err.message);
    return toggleSaveLocal(messageId, msgDetails);
  }
};

export const fetchUserSaved = async (userId) => {
  const supabase = await getSupabase();
  if (!supabase || !userId) return getLocalSaved();
  
  try {
    const { data, error } = await supabase
      .from('saves')
      .select(`
        message_id,
        messages (
          id,
          message_text,
          signature,
          is_anonymous,
          festival_id,
          festivals (
            name
          )
        )
      `)
      .eq('user_id', userId);
      
    if (error) throw error;
    
    return (data || []).map(row => {
      const msg = row.messages;
      if (!msg) return null;
      return {
        id: msg.id,
        message_text: msg.message_text,
        signature: msg.signature,
        is_anonymous: msg.is_anonymous,
        festivalName: msg.festivals?.name || 'ทั่วไป'
      };
    }).filter(Boolean);
  } catch (err) {
    console.warn('Database fetchUserSaved failed, using localStorage fallback:', err.message);
    return getLocalSaved();
  }
};

// Local Storage helpers for saved messages
function getLocalSaved() {
  try {
    return JSON.parse(localStorage.getItem('myfestival_admin_saved_messages') || '[]');
  } catch (e) {
    return [];
  }
}

function checkUserSaveLocal(messageId) {
  const list = getLocalSaved();
  return list.some(item => item.id === messageId);
}

function toggleSaveLocal(messageId, messageData) {
  let list = getLocalSaved();
  const index = list.findIndex(item => item.id === messageId);
  if (index > -1) {
    list.splice(index, 1);
    localStorage.setItem('myfestival_admin_saved_messages', JSON.stringify(list));
    return false;
  } else {
    list.push(messageData);
    localStorage.setItem('myfestival_admin_saved_messages', JSON.stringify(list));
    return true;
  }
}

async function getMessageDetailsForLocalSave(supabase, messageId) {
  if (!supabase) {
    return {
      id: messageId,
      message_text: 'ขอให้มีความสุขในเทศกาลอันเป็นมงคลนี้!',
      signature: 'ผู้ปรารถนาดี',
      is_anonymous: true,
      festivalName: 'เทศกาลสุขสันต์'
    };
  }
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        message_text,
        signature,
        is_anonymous,
        festivals (
          name
        )
      `)
      .eq('id', messageId)
      .single();
      
    if (!error && data) {
      return {
        id: data.id,
        message_text: data.message_text,
        signature: data.signature,
        is_anonymous: data.is_anonymous,
        festivalName: data.festivals?.name || 'ทั่วไป'
      };
    }
  } catch (e) {
    console.error('Error fetching details:', e);
  }
  
  return {
    id: messageId,
    message_text: 'ขอให้มีความสุขในเทศกาลอันเป็นมงคลนี้!',
    signature: 'ผู้ปรารถนาดี',
    is_anonymous: true,
    festivalName: 'เทศกาลสุขสันต์'
  };
}

async function logSaveActivity(supabase, userId, action, messageId) {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: `${action}_message`,
      details: { message_id: messageId }
    });
  } catch (err) {
    console.error('Failed to log save activity:', err);
  }
}
