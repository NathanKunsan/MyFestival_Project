// MyFestival Chat Widget Service
import { getSupabase } from './supabase.js';
import { showToast } from './router.js';

let activeUser = null;
let adminProfileId = null;
let realtimeChannel = null;
let isChatOpen = false;
let useMock = false;

// Initialize the Chat Widget
export const initChatWidget = async (user, profile) => {
  // If user is already initialized or is admin, clean up first
  cleanupChatWidget();
  
  if (!user) return;
  activeUser = { id: user.id, email: user.email, full_name: profile?.full_name || user.email.split('@')[0] };

  // If the user email is the developer, we don't display the user widget (they have the admin dashboard)
  if (user.email === '6nathan.dev@gmail.com') {
    return; 
  }

  const supabase = await getSupabase();
  if (supabase) {
    try {
      // Find Admin user id
      const { data: admin, error: adminError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', '6nathan.dev@gmail.com')
        .maybeSingle();

      if (!adminError && admin) {
        adminProfileId = admin.id;
      } else {
        // Fallback search
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
          .limit(1);
        if (admins && admins.length > 0) {
          adminProfileId = admins[0].id;
        } else {
          adminProfileId = 'mock-admin-id';
        }
      }

      // Check if chat_messages table exists by trying a limit query
      const { error: testError } = await supabase
        .from('chat_messages')
        .select('id')
        .limit(1);

      if (testError) {
        console.warn('Supabase chat_messages table not found or error. Using mock chat mode:', testError.message);
        useMock = true;
      }
    } catch (err) {
      console.warn('Error setting up Supabase chat, falling back to mock:', err);
      useMock = true;
    }
  } else {
    useMock = true;
  }

  renderWidgetHTML();
  setupEvents();
  
  if (!useMock && supabase) {
    setupRealtimeSubscription(supabase);
  }
};

// Remove the widget elements and listeners
export const cleanupChatWidget = () => {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
  const oldBtn = document.getElementById('floating-chat-toggle');
  const oldBox = document.getElementById('floating-chat-box');
  if (oldBtn) oldBtn.remove();
  if (oldBox) oldBox.remove();
  isChatOpen = false;
};

// Render Floating Toggle and Chat Box
function renderWidgetHTML() {
  // Remove existing if any
  const oldBtn = document.getElementById('floating-chat-toggle');
  const oldBox = document.getElementById('floating-chat-box');
  if (oldBtn) oldBtn.remove();
  if (oldBox) oldBox.remove();

  // Create Toggle Button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'floating-chat-toggle';
  toggleBtn.className = 'fixed bottom-6 right-6 z-50 bg-wood-yellow hover:bg-wood-orange border-3 border-pencil text-pencil font-bold rounded-full w-14 h-14 flex items-center justify-center shadow-[4px_4px_0px_0px_#4a3c31] hover:scale-105 active:scale-95 transition-all text-2xl';
  toggleBtn.innerHTML = '💬';
  toggleBtn.title = 'คุยกับผู้พัฒนา (Dev/Admin)';

  // Create Chat Box Window
  const chatBox = document.createElement('div');
  chatBox.id = 'floating-chat-box';
  chatBox.className = 'hidden fixed bottom-24 right-6 z-50 w-[330px] sm:w-[360px] h-[450px] bg-paper border-3 border-pencil rounded-2xl shadow-[6px_6px_0px_0px_#4a3c31] flex flex-col overflow-hidden';
  chatBox.style.fontFamily = "var(--font-handwriting)";

  chatBox.innerHTML = `
    <!-- Header -->
    <div class="bg-wood-yellow border-b-3 border-pencil p-3 flex justify-between items-center relative">
      <div class="chat-header-container" style="display: flex !important; align-items: center !important; gap: 10px !important; width: calc(100% - 30px) !important;">
        <div class="chat-avatar-circle" style="flex-shrink: 0 !important; width: 32px !important; height: 32px !important; border-radius: 50% !important; border: 2px solid var(--color-pencil) !important; background-color: white !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 14px !important;">👨‍💻</div>
        <div class="chat-header-text" style="display: flex !important; flex-direction: column !important; justify-content: center !important; overflow: hidden !important;">
          <p class="font-extrabold text-sm leading-tight text-pencil truncate">คุยกับผู้พัฒนา (Dev/Admin)</p>
          <p class="text-[10px] font-bold text-pencil-light truncate">ออนไลน์เรียลไทม์ ⚡${useMock ? ' (จำลอง)' : ''}</p>
        </div>
      </div>
      <button id="close-chat-btn" class="font-bold text-2xl text-pencil hover:text-wood-red transition-all cursor-pointer">×</button>
    </div>
    
    <!-- Messages Container -->
    <div id="chat-messages-list" class="flex-grow p-4 overflow-y-auto flex flex-col gap-3.5 bg-[#fffefb] pattern-lined">
      <div class="text-center py-4 text-pencil-light text-xs font-bold italic">
        🔒 ข้อความส่งตรงถึงผู้พัฒนาแบบปลอดภัย
      </div>
    </div>
    
    <!-- Input Field -->
    <form id="chat-send-form" class="border-t-3 border-pencil p-3 bg-paper flex gap-2">
      <input type="text" id="chat-input-msg" placeholder="พิมพ์ข้อความ..." class="sketch-input flex-grow py-1.5 px-3 text-sm" required autocomplete="off">
      <button type="submit" class="sketch-btn btn-green py-1.5 px-4 text-sm font-bold">ส่ง ✉️</button>
    </form>
  `;

  document.body.appendChild(toggleBtn);
  document.body.appendChild(chatBox);
}

// Setup Event Listeners
function setupEvents() {
  const toggleBtn = document.getElementById('floating-chat-toggle');
  const chatBox = document.getElementById('floating-chat-box');
  const closeBtn = document.getElementById('close-chat-btn');
  const sendForm = document.getElementById('chat-send-form');
  const inputEl = document.getElementById('chat-input-msg');

  if (!toggleBtn || !chatBox) return;

  toggleBtn.addEventListener('click', () => {
    isChatOpen = !isChatOpen;
    if (isChatOpen) {
      chatBox.classList.remove('hidden');
      toggleBtn.classList.add('hidden'); // Hide the toggle button when chat box is open to prevent overlapping
      loadChatHistory();
    }
  });

  const closeChat = () => {
    isChatOpen = false;
    chatBox.classList.add('hidden');
    toggleBtn.classList.remove('hidden'); // Show toggle button again when chat box is closed
  };

  closeBtn?.addEventListener('click', closeChat);

  sendForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = inputEl.value.trim();
    if (!message) return;

    inputEl.value = '';
    await sendMessage(message);
  });
}

// Load message history from DB or Mock
async function loadChatHistory() {
  const messagesList = document.getElementById('chat-messages-list');
  if (!messagesList) return;

  // Clear previous chat items, leaving the lock banner
  messagesList.innerHTML = `
    <div class="text-center py-2 text-pencil-light text-xs font-bold italic">
      🔒 ข้อความส่งตรงถึงผู้พัฒนาแบบปลอดภัย
    </div>
  `;

  if (useMock) {
    const history = getMockMessages();
    history.forEach(renderMessage);
    scrollToBottom();
  } else {
    const supabase = await getSupabase();
    if (!supabase || !activeUser || !adminProfileId) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`and(sender_id.eq.${activeUser.id},receiver_id.eq.${adminProfileId}),and(sender_id.eq.${adminProfileId},receiver_id.eq.${activeUser.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        data.forEach(msg => {
          renderMessage({
            sender_id: msg.sender_id,
            message: msg.message,
            created_at: msg.created_at
          });
        });
      } else {
        // Render welcoming message
        renderMessage({
          sender_id: adminProfileId,
          message: `สวัสดีครับคุณ ${activeUser.full_name}! ยินดีต้อนรับสู่ MyFestival ✏️ มีข้อสงสัยหรือเจอบั๊กตรงไหนสามารถพิมพ์คุยกับทีมพัฒนาตรงนี้ได้เลยนะครับ!`,
          created_at: new Date().toISOString()
        });
      }
      
      // Mark received messages as read
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('sender_id', adminProfileId)
        .eq('receiver_id', activeUser.id)
        .eq('is_read', false);

      scrollToBottom();
    } catch (err) {
      console.error('Error fetching chat history:', err);
      showToast('ไม่สามารถโหลดประวัติแชทได้', 'error');
    }
  }
}

// Send Message
async function sendMessage(text) {
  if (useMock) {
    const mockMsg = {
      id: `m-user-${Date.now()}`,
      sender_id: activeUser.id,
      receiver_id: 'mock-admin-id',
      message: text,
      is_read: false,
      created_at: new Date().toISOString()
    };
    saveMockMessage(mockMsg);
    renderMessage(mockMsg);
    scrollToBottom();

    // Trigger mock admin automated response
    setTimeout(() => {
      const replies = [
        "รับทราบครับผม! ได้รับข้อความเรียบร้อยแล้ว มีอะไรให้ช่วยเหลือพิมพ์ทิ้งไว้ได้เลยนะครับ ✏️✨",
        "ขอบคุณสำหรับฟีดแบ็กนะครับ! ตอนนี้ผมและทีมงานกำลังเร่งปรับปรุงระบบความสวยงามของเว็บอยู่พอดีครับ 🛠️",
        "ได้รับคำแนะนำแล้วครับ! เดี๋ยวข้อความนี้ผมจะนำไปประชุมและแก้ไขในอัปเดตถัดไปของ MyFestival แน่นอนครับ 📚",
        "แชทเรียลไทม์ใช้งานได้ลื่นไหลดีนะครับ! หากมีข้อความอื่นพิมพ์คุยกันต่อได้ตลอดเลยครับ! 🎉"
      ];
      const replyText = replies[Math.floor(Math.random() * replies.length)];
      
      const adminMsg = {
        id: `m-admin-${Date.now()}`,
        sender_id: 'mock-admin-id',
        receiver_id: activeUser.id,
        message: replyText,
        is_read: true,
        created_at: new Date().toISOString()
      };
      
      saveMockMessage(adminMsg);
      renderMessage(adminMsg);
      scrollToBottom();
      
      // Play soft sound or show bubble toast
      showToast('ได้รับคำตอบกลับจากผู้พัฒนาแล้ว 💬', 'success');
    }, 1500);

  } else {
    const supabase = await getSupabase();
    if (!supabase || !activeUser || !adminProfileId) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          sender_id: activeUser.id,
          receiver_id: adminProfileId,
          message: text
        });

      if (error) throw error;
      
      // Note: the sender's UI will append automatically via Supabase Realtime channel!
    } catch (err) {
      console.error('Error sending message:', err);
      showToast('ไม่สามารถส่งข้อความได้', 'error');
    }
  }
}

// Render message in chat box
function renderMessage(msg) {
  const messagesList = document.getElementById('chat-messages-list');
  if (!messagesList) return;

  const isSender = msg.sender_id === activeUser.id;
  const bubble = document.createElement('div');
  bubble.className = isSender ? 'chat-bubble-sent' : 'chat-bubble-received';
  
  const time = new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  
  bubble.innerHTML = `
    <p class="text-sm font-bold">${escapeHTML(msg.message)}</p>
    <span class="block text-[8px] text-right mt-1 opacity-70 font-semibold">${time}</span>
  `;

  messagesList.appendChild(bubble);
}

// Subscribe to real-time table inserts
function setupRealtimeSubscription(supabase) {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
  }

  realtimeChannel = supabase
    .channel(`chat-channel-${activeUser.id}`)
    .on(
      'postgres_changes',
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages'
      },
      async (payload) => {
        const newMsg = payload.new;
        if (!newMsg) return;

        // Check if message belongs to this conversation
        const isFromAdminToMe = newMsg.sender_id === adminProfileId && newMsg.receiver_id === activeUser.id;
        const isFromMeToAdmin = newMsg.sender_id === activeUser.id && newMsg.receiver_id === adminProfileId;

        if (isFromAdminToMe || isFromMeToAdmin) {
          renderMessage(newMsg);
          scrollToBottom();

          if (isFromAdminToMe) {
            // Mark as read in background
            await supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', newMsg.id);
            
            // Show toast if chat is closed
            if (!isChatOpen) {
              showToast('ข้อความใหม่จากผู้พัฒนา: ' + newMsg.message, 'success');
            }
          }
        }
      }
    )
    .subscribe();
}

// Helper to scroll messages list to bottom
function scrollToBottom() {
  const messagesList = document.getElementById('chat-messages-list');
  if (messagesList) {
    messagesList.scrollTop = messagesList.scrollHeight;
  }
}

// HTML escape helper
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// --- MOCK STORAGE HELPERS ---
function getMockMessages() {
  const key = `myfestival_mock_chat_${activeUser.id}`;
  const data = localStorage.getItem(key);
  if (!data) {
    const welcome = [
      {
        id: 'welcome-m',
        sender_id: 'mock-admin-id',
        receiver_id: activeUser.id,
        message: `สวัสดีครับคุณ ${activeUser.full_name}! ยินดีต้อนรับสู่ MyFestival ✏️ มีข้อสงสัยหรือเจอบั๊กตรงไหนสามารถพิมพ์คุยกับทีมพัฒนาตรงนี้ได้เลยนะครับ!`,
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(key, JSON.stringify(welcome));
    return welcome;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveMockMessage(msg) {
  const key = `myfestival_mock_chat_${activeUser.id}`;
  const messages = getMockMessages();
  messages.push(msg);
  localStorage.setItem(key, JSON.stringify(messages));
  
  // Update global mock chat messages database list for Admin synchronization
  const dbKey = 'myfestival_mock_chat_messages';
  const dbData = localStorage.getItem(dbKey);
  let dbList = [];
  if (dbData) {
    try {
      dbList = JSON.parse(dbData);
    } catch (e) {}
  }
  dbList.push(msg);
  localStorage.setItem(dbKey, JSON.stringify(dbList));
}
