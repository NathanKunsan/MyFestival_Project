// MyFestival - Contributor Dashboard Controller
import { getSupabase } from './supabase.js';
import { getCurrentUser, getUserProfile } from './auth.js';
import { showToast, navigate } from './router.js';

let currentUserId = null;
let userMessages = [];
let editMessageObj = null;
let userProfile = null;

// Initialize Page
export const init = async () => {
  const user = await getCurrentUser();
  if (!user) {
    navigate('/login');
    return;
  }
  
  currentUserId = user.id;
  userProfile = await getUserProfile(user.id);
  
  await fetchFestivalsList();
  await loadDashboardData();
  setupAddMessageForm();
  setupEditModalEvents();
};

// Fetch festivals for dropdown select option
async function fetchFestivalsList() {
  const select = document.getElementById('msg-festival-select');
  if (!select) return;
  
  const supabase = await getSupabase();
  try {
    const { data, error } = await supabase
      .from('festivals')
      .select('id, name')
      .order('start_date', { ascending: false });
      
    if (error) throw error;
    
    select.innerHTML = (data || []).map(f => `
      <option value="${f.id}">${f.name}</option>
    `).join('');
  } catch (error) {
    console.error('Error fetching festivals list:', error);
  }
}

// Load contributor's statistics and message board
async function loadDashboardData() {
  const supabase = await getSupabase();
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*, festivals(id, name), likes(id), saves(id), shares(id)')
      .eq('contributor_id', currentUserId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    userMessages = messages || [];
    renderStats();
    renderMessageList();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showToast('ดึงข้อมูลแดชบอร์ดไม่สำเร็จ: ' + error.message, 'error');
  }
}

// Render Stats elements
function renderStats() {
  const statsTotal = document.getElementById('stats-total');
  const statsApproved = document.getElementById('stats-approved');
  const statsPending = document.getElementById('stats-pending');
  const statsEngagement = document.getElementById('stats-engagement');
  
  if (!statsTotal) return;
  
  const total = userMessages.length;
  const approved = userMessages.filter(m => m.status === 'approved').length;
  const pending = userMessages.filter(m => m.status === 'pending').length;
  
  let totalEngagement = 0;
  userMessages.forEach(m => {
    totalEngagement += (m.likes?.length || 0) + (m.saves?.length || 0);
  });
  
  statsTotal.textContent = total;
  statsApproved.textContent = approved;
  statsPending.textContent = pending;
  statsEngagement.textContent = totalEngagement;
}

// Render contributor's message cards list
function renderMessageList() {
  const listContainer = document.getElementById('contributor-msg-list');
  if (!listContainer) return;
  
  if (userMessages.length === 0) {
    listContainer.innerHTML = `
      <div class="text-center py-12">
        <p class="text-3xl mb-4">🍃</p>
        <p class="text-lg font-bold text-pencil-light italic">คุณยังไม่เคยฝากคำอวยพรไว้ในระบบ เขียนชิ้นแรกที่ฟอร์มด้านซ้ายได้เลย!</p>
      </div>
    `;
    return;
  }
  
  listContainer.innerHTML = userMessages.map(msg => {
    const startStr = new Date(msg.created_at).toLocaleDateString('th-TH');
    let statusClass = 'btn-yellow';
    let statusText = '⏳ รอการตรวจสอบ';
    
    if (msg.status === 'approved') {
      statusClass = 'btn-green';
      statusText = '✅ อนุมัติแล้ว';
    } else if (msg.status === 'rejected') {
      statusClass = 'btn-red';
      statusText = '❌ ปฏิเสธการอนุมัติ';
    }
    
    const signatureText = msg.is_anonymous ? 'จาก ผู้ปรารถนาดี (ไม่แสดงชื่อ)' : `จาก ${msg.signature || 'ผู้เขียน'}`;
    const rejectionBlock = msg.status === 'rejected' && msg.rejection_reason
      ? `<div class="bg-wood-red/10 border-2 border-pencil p-2.5 rounded-lg text-sm mt-3 font-bold">
           ⚠️ เหตุผลที่ปฏิเสธ: <span class="text-wood-red">${msg.rejection_reason}</span>
         </div>`
      : '';
      
    return `
      <div class="sketch-card p-4 bg-white flex flex-col justify-between shadow-[2px_2px_0px_0px_#4a3c31]">
        <div>
          <div class="flex justify-between items-center gap-2 flex-wrap mb-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="sketch-badge btn-cream text-[10px] font-black uppercase">
                🎈 ${msg.festivals?.name}
              </span>
              <span class="sketch-badge ${statusClass} text-[10px] font-black uppercase">
                ${statusText}
              </span>
            </div>
            <span class="text-xs text-pencil-light font-bold">${startStr}</span>
          </div>
          
          <p class="text-base font-bold leading-relaxed mb-3 italic">
            "${msg.message_text}"
          </p>
          <p class="text-xs font-bold text-pencil-light mb-1">✍️ ลายเซ็น: ${signatureText}</p>
          
          <div class="flex gap-4 text-xs font-bold text-pencil-light my-2">
            <span>❤️ ถูกใจ: ${msg.likes?.length || 0}</span>
            <span>⭐ บันทึก: ${msg.saves?.length || 0}</span>
            <span>🔗 แชร์สะสม: ${msg.shares?.length || 0}</span>
          </div>
          
          ${rejectionBlock}
        </div>
        
        <div class="flex gap-2 justify-end mt-4 pt-3 border-t border-pencil-soft">
          <button data-id="${msg.id}" class="btn-edit-msg sketch-btn btn-cream text-xs py-1 px-3">
            ✏️ แก้ไขคำอวยพร
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach edit buttons listener
  listContainer.querySelectorAll('.btn-edit-msg').forEach(button => {
    button.addEventListener('click', (e) => {
      const msgId = e.target.getAttribute('data-id');
      const target = userMessages.find(m => m.id === msgId);
      if (target) {
        openEditModal(target);
      }
    });
  });
}

// Handle Add Message Submission
function setupAddMessageForm() {
  const form = document.getElementById('add-message-form');
  const sigInput = document.getElementById('msg-sig-input');
  const anonCheckbox = document.getElementById('msg-anonymous-checkbox');
  
  if (sigInput && userProfile) {
    sigInput.readOnly = true;
    sigInput.classList.add('bg-pencil-soft/20', 'cursor-not-allowed');
    sigInput.value = userProfile.full_name || 'ผู้เขียน';
  }
  
  anonCheckbox?.addEventListener('change', () => {
    if (anonCheckbox.checked) {
      sigInput.value = 'ผู้ไม่ประสงค์ออกนาม';
      sigInput.classList.add('text-gray-400');
      sigInput.classList.remove('text-pencil');
    } else {
      sigInput.value = userProfile?.full_name || 'ผู้เขียน';
      sigInput.classList.remove('text-gray-400');
      sigInput.classList.add('text-pencil');
    }
  });
  
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supabase = await getSupabase();
    if (!supabase) return;
    
    const festivalId = document.getElementById('msg-festival-select').value;
    const text = document.getElementById('msg-text-input').value.trim();
    const sig = document.getElementById('msg-sig-input').value.trim();
    const anonymous = document.getElementById('msg-anonymous-checkbox').checked;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังส่งข้อมูล... ⏳';
    
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          festival_id: festivalId,
          contributor_id: currentUserId,
          message_text: text,
          signature: sig || null,
          is_anonymous: anonymous,
          status: 'pending' // Defaults to pending
        });
        
      if (error) throw error;
      
      // Log add activity
      await supabase.from('activity_logs').insert({
        user_id: currentUserId,
        action: 'add_message',
        details: { festival_id: festivalId }
      });
      
      showToast('ฝากคำอวยพรสำเร็จแล้ว! โปรดรอผู้ดูแลระบบตรวจสอบและอนุมัติ', 'success');
      form.reset();
      
      // Reload Dashboard
      await loadDashboardData();
    } catch (error) {
      console.error('Error adding message:', error);
      showToast('ไม่สามารถส่งข้อความได้: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });
}

// Open Edit message modal
function openEditModal(message) {
  editMessageObj = message;
  
  document.getElementById('edit-msg-id').value = message.id;
  document.getElementById('edit-msg-status').value = message.status;
  document.getElementById('edit-festival-name').value = message.festivals?.name || '';
  document.getElementById('edit-text-input').value = message.message_text;
  
  const editSigInput = document.getElementById('edit-sig-input');
  const editAnonCheckbox = document.getElementById('edit-anonymous-checkbox');
  
  if (editSigInput) {
    editSigInput.readOnly = true;
    editSigInput.classList.add('bg-pencil-soft/20', 'cursor-not-allowed');
    if (message.is_anonymous) {
      editSigInput.value = 'ผู้ไม่ประสงค์ออกนาม';
      editSigInput.classList.add('text-gray-400');
      editSigInput.classList.remove('text-pencil');
    } else {
      editSigInput.value = userProfile?.full_name || 'ผู้เขียน';
      editSigInput.classList.remove('text-gray-400');
      editSigInput.classList.add('text-pencil');
    }
  }
  editAnonCheckbox.checked = message.is_anonymous;
  
  const notice = document.getElementById('edit-notice');
  if (message.status === 'approved') {
    notice.classList.remove('hidden');
  } else {
    notice.classList.add('hidden');
  }
  
  document.getElementById('edit-message-modal').classList.remove('hidden');
}

// Setup edit modal closing and submission
function setupEditModalEvents() {
  const editSigInput = document.getElementById('edit-sig-input');
  const editAnonCheckbox = document.getElementById('edit-anonymous-checkbox');
  
  editAnonCheckbox?.addEventListener('change', () => {
    if (editAnonCheckbox.checked) {
      editSigInput.value = 'ผู้ไม่ประสงค์ออกนาม';
      editSigInput.classList.add('text-gray-400');
      editSigInput.classList.remove('text-pencil');
    } else {
      editSigInput.value = userProfile?.full_name || 'ผู้เขียน';
      editSigInput.classList.remove('text-gray-400');
      editSigInput.classList.add('text-pencil');
    }
  });

  document.getElementById('btn-close-edit')?.addEventListener('click', () => {
    document.getElementById('edit-message-modal').classList.add('hidden');
    editMessageObj = null;
  });
  
  const editForm = document.getElementById('edit-message-form');
  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editMessageObj) return;
    
    const supabase = await getSupabase();
    if (!supabase) return;
    
    const text = document.getElementById('edit-text-input').value.trim();
    const sig = document.getElementById('edit-sig-input').value.trim();
    const anonymous = document.getElementById('edit-anonymous-checkbox').checked;
    
    const submitBtn = editForm.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังบันทึก...';
    
    try {
      if (editMessageObj.status === 'approved') {
        // Edit Approved Message -> Create a new revision entry in message_revisions
        const { error } = await supabase
          .from('message_revisions')
          .insert({
            message_id: editMessageObj.id,
            message_text: text,
            signature: sig || null,
            is_anonymous: anonymous,
            status: 'pending'
          });
          
        if (error) throw error;
        
        await supabase.from('activity_logs').insert({
          user_id: currentUserId,
          action: 'create_revision',
          details: { message_id: editMessageObj.id }
        });
        
        showToast('ส่งข้อความแก้ไขเข้ารอการตรวจสอบใหม่สำเร็จแล้ว! ข้อความออริจินัลยังคงแสดงผลอยู่ตามปกติ', 'success');
      } else {
        // Edit Pending / Rejected Message -> Update messages table directly and set status to pending
        const { error } = await supabase
          .from('messages')
          .update({
            message_text: text,
            signature: sig || null,
            is_anonymous: anonymous,
            status: 'pending',
            rejection_reason: null // Clear previous rejection reason
          })
          .eq('id', editMessageObj.id);
          
        if (error) throw error;
        
        await supabase.from('activity_logs').insert({
          user_id: currentUserId,
          action: 'update_message_directly',
          details: { message_id: editMessageObj.id }
        });
        
        showToast('อัปเดตคำอวยพรเรียบร้อยและส่งตรวจสอบซ้ำสำเร็จแล้ว!', 'success');
      }
      
      document.getElementById('edit-message-modal').classList.add('hidden');
      editMessageObj = null;
      await loadDashboardData(); // Reload
    } catch (error) {
      console.error('Error saving edited message:', error);
      showToast('ไม่สามารถบันทึกข้อความได้: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });
}
