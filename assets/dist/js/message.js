// MyFestival - Message Randomizer and Detail Controller
import { getSupabase } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { checkUserLike, toggleLike, getLikesCount } from './like.js';
import { checkUserSave, toggleSave } from './saved.js';
import { submitReport } from './report.js';
import { drawShareCard, logShare } from './share.js';
import { showToast, navigate } from './router.js';

let currentMessage = null;
let currentFestival = null;
let currentUserId = null;
let isLikePending = false;
let isSavePending = false;

// Initialize View
export const init = async (params) => {
  const id = params.id;
  if (!id) {
    navigate('/');
    return;
  }
  
  const supabase = await getSupabase();
  if (!supabase) return;
  
  const user = await getCurrentUser();
  currentUserId = user ? user.id : null;
  
  // Set up elements
  setupInteractiveEvents();
  
  // Detect if parameter ID is a Festival or a Message
  try {
    const { data: festival } = await supabase
      .from('festivals')
      .select('*')
      .eq('id', id)
      .maybeSingle();
      
    if (festival) {
      currentFestival = festival;
      document.getElementById('festival-title').textContent = `🎈 ${festival.name}`;
      await drawRandomMessage(festival.id);
    } else {
      // Assume it's a message ID
      await loadSpecificMessage(id);
    }
  } catch (error) {
    console.error('Error determining route context:', error);
    renderErrorState('ไม่สามารถเชื่อมต่อระบบฐานข้อมูลได้');
  }
};

// Fetch a specific message by ID
async function loadSpecificMessage(messageId) {
  const supabase = await getSupabase();
  
  try {
    const { data: message, error } = await supabase
      .from('messages')
      .select('*, festivals(*)')
      .eq('id', messageId)
      .maybeSingle();
      
    if (error || !message) {
      renderErrorState('ไม่พบคำอวยพรที่คุณค้นหา หรือข้อความนี้อาจกำลังรอการตรวจสอบ');
      return;
    }
    
    // Check if the message is approved. If not, only contributor or admin can view
    if (message.status !== 'approved' && message.contributor_id !== currentUserId) {
      // Check if admin
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUserId).maybeSingle();
      if (!profile || profile.role !== 'admin') {
        renderErrorState('คำอวยพรนี้ยังไม่ผ่านการอนุมัติจากผู้ดูแลระบบ');
        return;
      }
    }
    
    currentMessage = message;
    currentFestival = message.festivals;
    
    document.getElementById('festival-title').textContent = `🎈 ${currentFestival.name}`;
    await renderMessageCard();
  } catch (error) {
    console.error('Error loading specific message:', error);
    renderErrorState('เกิดข้อผิดพลาดในการโหลดข้อความ');
  }
}

// Draw a random message for a festival (Handles duplicate prevention)
async function drawRandomMessage(festivalId) {
  const supabase = await getSupabase();
  
  try {
    // 1. Get all approved messages for this festival
    const { data: allMessages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('festival_id', festivalId)
      .eq('status', 'approved');
      
    if (msgError) throw msgError;
    
    if (!allMessages || allMessages.length === 0) {
      renderEmptyState();
      return;
    }
    
    let targetMessage = null;
    
    // 2. If User is Logged In (Member / Contributor / Admin) - Avoid duplicates
    if (currentUserId) {
      // Get random history for this user & festival
      const { data: history, error: histError } = await supabase
        .from('random_history')
        .select('message_id')
        .eq('user_id', currentUserId)
        .eq('festival_id', festivalId);
        
      if (histError) throw histError;
      
      const seenIds = new Set((history || []).map(h => h.message_id));
      
      // Filter out seen messages
      const pool = allMessages.filter(m => !seenIds.has(m.id));
      
      if (pool.length > 0) {
        // Pick from pool
        targetMessage = pool[Math.floor(Math.random() * pool.length)];
        
        // Save to history
        await supabase.from('random_history').insert({
          user_id: currentUserId,
          festival_id: festivalId,
          message_id: targetMessage.id
        });
      } else {
        // Logged in user saw ALL messages, reset the history cycle!
        await supabase
          .from('random_history')
          .delete()
          .eq('user_id', currentUserId)
          .eq('festival_id', festivalId);
          
        showToast('คุณได้อ่านคำอวยพรครบทุกข้อความแล้ว! ระบบกำลังรีเซ็ตเริ่มสุ่มรอบใหม่ให้ครับ', 'info');
        
        // Pick from full list and log as the first of the new cycle
        targetMessage = allMessages[Math.floor(Math.random() * allMessages.length)];
        
        await supabase.from('random_history').insert({
          user_id: currentUserId,
          festival_id: festivalId,
          message_id: targetMessage.id
        });
      }
    } else {
      // 3. Guest User: Draw completely at random (duplicates allowed)
      targetMessage = allMessages[Math.floor(Math.random() * allMessages.length)];
    }
    
    currentMessage = targetMessage;
    
    // Replace URL in address bar to represent the actual message ID for sharing, without reload
    window.history.replaceState({}, '', `/message/${currentMessage.id}`);
    
    await renderMessageCard();
  } catch (error) {
    console.error('Error drawing random message:', error);
    renderErrorState('เกิดข้อผิดพลาดในการสุ่มคำอวยพร');
  }
}

// Render the drawn message on a sketchbook card
async function renderMessageCard() {
  const container = document.getElementById('message-container');
  const controls = document.getElementById('message-controls');
  if (!container || !currentMessage) return;
  
  // Show controller buttons
  controls.classList.remove('hidden');
  
  // Load interaction metrics
  const likesCount = await getLikesCount(currentMessage.id);
  const isLiked = currentUserId ? await checkUserLike(currentMessage.id, currentUserId) : false;
  const isSaved = currentUserId ? await checkUserSave(currentMessage.id, currentUserId) : false;
  
  const signature = currentMessage.is_anonymous || !currentMessage.signature 
    ? 'ผู้ปรารถนาดี' 
    : currentMessage.signature;
    
  container.innerHTML = `
    <div class="sketch-card p-8 md:p-12 bg-white relative notebook-lines shadow-[6px_6px_0px_0px_#4a3c31] transition-all hover:rotate-[0.5deg]">
      
      <!-- Lined paper background pattern -->
      <div class="space-y-6 flex flex-col justify-between min-h-[250px] relative z-10">
        
        <!-- Wish text -->
        <div class="text-center py-6">
          <p class="text-2xl md:text-3xl font-extrabold leading-loose text-pencil italic">
            "${currentMessage.message_text}"
          </p>
        </div>
        
        <!-- Signature & Footer actions -->
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t-2 border-pencil-soft">
          <!-- Sender Signature -->
          <div class="text-lg font-bold text-pencil-light">
            ✍️ ส่งต่อโดย: <span class="text-pencil underline decoration-wavy decoration-wood-yellow font-extrabold">${signature}</span>
          </div>
          
          <!-- User Interactions -->
          <div class="flex items-center gap-2">
            <!-- Like Button -->
            <button id="btn-like-msg" class="sketch-btn ${isLiked ? 'btn-red' : 'btn-cream'} py-1.5 px-3.5 text-sm flex items-center gap-1.5">
              <span>${isLiked ? '❤️' : '🤍'}</span>
              <span>ถูกใจ</span>
              <span id="like-count" class="font-black bg-white px-1.5 rounded border border-pencil text-xs text-pencil">${likesCount}</span>
            </button>
            
            <!-- Save Button -->
            <button id="btn-save-msg" class="sketch-btn ${isSaved ? 'btn-yellow' : 'btn-cream'} py-1.5 px-3.5 text-sm flex items-center gap-1.5">
              <span>${isSaved ? '⭐️' : '☆'}</span>
              <span>${isSaved ? 'บันทึกแล้ว' : 'บันทึก'}</span>
            </button>
            
            <!-- Report Button -->
            <button id="btn-report-trigger" class="sketch-btn btn-cream hover:bg-wood-orange/20 py-1.5 px-3.5 text-sm text-wood-orange">
              🚩 รายงาน
            </button>
          </div>
        </div>
      </div>
      
    </div>
  `;
  
  // Attach event handlers to card interactions
  document.getElementById('btn-like-msg')?.addEventListener('click', handleLikeToggle);
  document.getElementById('btn-save-msg')?.addEventListener('click', handleSaveToggle);
  document.getElementById('btn-report-trigger')?.addEventListener('click', () => {
    document.getElementById('report-modal')?.classList.remove('hidden');
  });

  // Toggle Admin delete post button visibility
  const deleteBtn = document.getElementById('btn-delete-post');
  if (deleteBtn) {
    const { checkUserRole } = await import('./auth.js');
    const authStatus = await checkUserRole();
    const isAdmin = authStatus.role === 'admin' || authStatus.user?.email === '6nathan.dev@gmail.com' || localStorage.getItem('myfestival_dev_bypass') === 'true';
    if (isAdmin) {
      deleteBtn.classList.remove('hidden');
    } else {
      deleteBtn.classList.add('hidden');
    }
  }
}

// Handle Like Toggle
async function handleLikeToggle() {
  if (!currentMessage) return;
  if (!currentUserId) {
    showToast('กรุณาเข้าสู่ระบบก่อนกดถูกใจคำอวยพร', 'warning');
    setTimeout(() => navigate('/login'), 1500);
    return;
  }
  
  if (isLikePending) return;
  isLikePending = true;
  
  try {
    const isNowLiked = await toggleLike(currentMessage.id, currentUserId);
    const likeBtn = document.getElementById('btn-like-msg');
    const likeCountSpan = document.getElementById('like-count');
    
    if (likeBtn && likeCountSpan) {
      let count = parseInt(likeCountSpan.textContent) || 0;
      if (isNowLiked) {
        likeBtn.classList.remove('btn-cream');
        likeBtn.classList.add('btn-red');
        likeBtn.querySelector('span').textContent = '❤️';
        count++;
        showToast('ถูกใจคำอวยพรนี้แล้ว', 'success');
      } else {
        likeBtn.classList.remove('btn-red');
        likeBtn.classList.add('btn-cream');
        likeBtn.querySelector('span').textContent = '🤍';
        count = Math.max(0, count - 1);
        showToast('ยกเลิกการถูกใจแล้ว', 'info');
      }
      likeCountSpan.textContent = count;
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    isLikePending = false;
  }
}

// Handle Save Toggle
async function handleSaveToggle() {
  if (!currentMessage) return;
  if (!currentUserId) {
    showToast('กรุณาเข้าสู่ระบบก่อนบันทึกคำอวยพร', 'warning');
    setTimeout(() => navigate('/login'), 1500);
    return;
  }
  
  if (isSavePending) return;
  isSavePending = true;
  
  try {
    const isNowSaved = await toggleSave(currentMessage.id, currentUserId);
    const saveBtn = document.getElementById('btn-save-msg');
    
    if (saveBtn) {
      if (isNowSaved) {
        saveBtn.classList.remove('btn-cream');
        saveBtn.classList.add('btn-yellow');
        saveBtn.querySelector('span').textContent = '⭐️';
        saveBtn.querySelector('span:nth-child(2)').textContent = 'บันทึกแล้ว';
        showToast('บันทึกคำอวยพรเก็บไว้แล้ว เปิดดูได้ที่หน้าบันทึก', 'success');
      } else {
        saveBtn.classList.remove('btn-yellow');
        saveBtn.classList.add('btn-cream');
        saveBtn.querySelector('span').textContent = '☆';
        saveBtn.querySelector('span:nth-child(2)').textContent = 'บันทึก';
        showToast('นำออกจากรายการที่บันทึกแล้ว', 'info');
      }
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    isSavePending = false;
  }
}

// Setup outer action listeners
function setupInteractiveEvents() {
  // 1. Draw random message again
  document.getElementById('btn-draw-random')?.addEventListener('click', async () => {
    if (currentFestival) {
      await drawRandomMessage(currentFestival.id);
    }
  });
  
  // 2. Copy Share Link
  document.getElementById('btn-copy-link')?.addEventListener('click', async () => {
    if (!currentMessage) return;
    
    const shareUrl = `${window.location.origin}/message/${currentMessage.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('คัดลอกลิงก์แชร์ใส่คลิปบอร์ดแล้ว! ส่งต่อให้เพื่อนได้เลย', 'success');
      await logShare(currentMessage.id, 'url');
    } catch (err) {
      console.error('Copy link error:', err);
      showToast('ไม่สามารถคัดลอกลิงก์ได้อัตโนมัติ ลิงก์ของคุณคือ: ' + shareUrl, 'warning');
    }
  });
  
  // 3. Download Card as PNG Image
  document.getElementById('btn-download-card')?.addEventListener('click', async () => {
    if (!currentMessage || !currentFestival) return;
    
    const downloadBtn = document.getElementById('btn-download-card');
    const originalText = downloadBtn.textContent;
    downloadBtn.disabled = true;
    downloadBtn.textContent = '🎨 กำลังวาดภาพการ์ด...';
    
    try {
      const canvas = document.getElementById('share-card-canvas');
      const text = currentMessage.message_text;
      const signature = currentMessage.is_anonymous || !currentMessage.signature ? 'ผู้ปรารถนาดี' : currentMessage.signature;
      
      // Draw canvas
      await drawShareCard(canvas, text, signature, currentFestival.name);
      
      // Log share metric
      await logShare(currentMessage.id, 'card');
      
      // Trigger download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `myfestival-card-${currentMessage.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('ดาวน์โหลดรูปภาพการ์ดคำอวยพรสำเร็จแล้ว!', 'success');
    } catch (err) {
      console.error('Download card error:', err);
      showToast('เกิดข้อผิดพลาดในการแปลงไฟล์การ์ดรูปภาพ', 'error');
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = originalText;
    }
  });
  
  // 4. Close Report Modal
  document.getElementById('btn-close-report')?.addEventListener('click', () => {
    document.getElementById('report-modal')?.classList.add('hidden');
  });
  
  // 5. Submit Report Form
  const reportForm = document.getElementById('report-form');
  reportForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentMessage) return;
    
    const reason = document.getElementById('report-reason').value.trim();
    const submitBtn = reportForm.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังส่ง...';
    
    try {
      await submitReport(currentMessage.id, currentUserId, reason);
      showToast('ส่งรายงานความไม่เหมาะสมให้ผู้ดูแลระบบตรวจสอบแล้ว ขอบคุณครับ', 'success');
      document.getElementById('report-modal').classList.add('hidden');
      document.getElementById('report-reason').value = '';
    } catch (error) {
      showToast('ไม่สามารถส่งรายงานได้: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });

  // 6. Admin Delete Post
  document.getElementById('btn-delete-post')?.addEventListener('click', async () => {
    if (!currentMessage) return;
    
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบโพสต์คำอวยพรนี้ออกจากระบบ? ข้อมูลการถูกใจ การบันทึก และการรายงานทั้งหมดที่เกี่ยวข้องจะถูกลบออกด้วย')) {
      return;
    }

    const deleteBtn = document.getElementById('btn-delete-post');
    const origText = deleteBtn.textContent;
    deleteBtn.disabled = true;
    deleteBtn.textContent = '🗑️ กำลังลบ...';

    const supabase = await getSupabase();
    let success = false;
    let errorMsg = '';

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', currentMessage.id);

      if (error) throw error;
      success = true;
      showToast('ลบข้อความคำอวยพรสำเร็จแล้ว!', 'success');
    } catch (err) {
      console.error('Failed to delete post from Supabase:', err);
      errorMsg = err.message || JSON.stringify(err);
      if (errorMsg.toLowerCase().includes('policy') || errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('violates') || errorMsg.toLowerCase().includes('row-level security')) {
        errorMsg = 'สิทธิ์ฐานข้อมูลไม่เพียงพอ! โปรดตรวจสอบว่าได้รันคำสั่ง SQL ใน Supabase เพื่อตั้งให้บัญชีของคุณเป็น admin หรือยัง';
      }
    }

    // Fallback if supabase delete fails or it's a mock message
    if (!success) {
      const mockData = localStorage.getItem('myfestival_mock_wishes');
      if (mockData) {
        try {
          const wishes = JSON.parse(mockData);
          const index = wishes.findIndex(w => w.id === currentMessage.id);
          if (index !== -1) {
            wishes.splice(index, 1);
            localStorage.setItem('myfestival_mock_wishes', JSON.stringify(wishes));
            success = true;
            showToast('ลบข้อความคำอวยพรสำเร็จแล้ว! (Mock)', 'success');
          }
        } catch (e) {
          console.error('Error parsing mock wishes:', e);
        }
      }
    }

    if (success) {
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } else {
      showToast(`เกิดข้อผิดพลาดในการลบ: ${errorMsg}`, 'error');
      deleteBtn.disabled = false;
      deleteBtn.textContent = origText;
    }
  });
}

// Render states helpers
function renderErrorState(message) {
  const container = document.getElementById('message-container');
  const controls = document.getElementById('message-controls');
  if (controls) controls.classList.add('hidden');
  if (container) {
    container.innerHTML = `
      <div class="sketch-card p-12 text-center bg-white">
        <h3 class="text-3xl font-extrabold mb-4 text-wood-red">⚠️ ไม่สามารถเปิดบันทึกได้</h3>
        <p class="text-lg font-bold mb-6">${message}</p>
        <a href="/" class="sketch-btn btn-yellow">กลับไปเริ่มต้นใหม่ที่หน้าหลัก</a>
      </div>
    `;
  }
}

function renderEmptyState() {
  const container = document.getElementById('message-container');
  const controls = document.getElementById('message-controls');
  if (controls) controls.classList.add('hidden');
  if (container) {
    container.innerHTML = `
      <div class="sketch-card p-12 text-center bg-white flex flex-col items-center justify-center min-h-[300px]">
        <h3 class="text-3xl font-extrabold mb-3">🍃 ความกระดาษว่างเปล่า</h3>
        <p class="text-lg font-bold text-pencil-light mb-6">
          ยังไม่มีคำอวยพรที่ได้รับการอนุมัติในเทศกาลนี้... มาร่วมเป็นคนแรกที่ส่งต่อสิ่งดีๆ กันไหมครับ?
        </p>
        <div class="flex gap-2">
          <a href="/contributor" class="sketch-btn btn-orange">✍️ ฝากคำอวยพรแรก</a>
          <a href="/" class="sketch-btn btn-cream">กลับหน้าแรก</a>
        </div>
      </div>
    `;
  }
}
