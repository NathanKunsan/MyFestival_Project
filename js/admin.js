// MyFestival - Admin Dashboard Controller
import { getSupabase } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { showToast, navigate } from './router.js';

let currentUserId = null;
let currentRejectionTarget = null; // { id, type }
let membersViewMode = 'table';
let profilesSubscription = null;
let messagesSubscription = null;
let revisionsSubscription = null;
let reportsSubscription = null;
let festivalsSubscription = null;
let notificationsSubscription = null;
let suggestionsSubscription = null;
let currentFestivalImageUrl = null;


// Initial Mock Data Fallbacks
const initialMockSuggestions = [
  {
    id: 'mock-sug-1',
    name: 'วันคริสต์มาส (Christmas)',
    description: 'วันเฉลิมฉลองคริสต์มาสแสนอบอุ่น ตกแต่งโคมไฟต้นสน และส่งการ์ดอวยพรให้กันในหน้าหนาว',
    suggested_wish: 'Merry Christmas! ขอให้เทศกาลนี้เต็มไปด้วยความสุข ความรัก และของขวัญกล่องใหญ่ในชีวิตครับ',
    signature: 'น้องคริส',
    is_anonymous: false,
    status: 'pending',
    profiles: { full_name: 'น้องคริส', email: 'chris@example.com' },
    created_at: new Date(Date.now() - 3600000 * 3).toISOString()
  }
];
const initialMockWishes = [
  {
    id: 'mock-wish-1',
    festival_id: '33333333-3333-3333-3333-333333333333',
    message_text: 'ขอให้มีความสุขชุ่มฉ่ำในวันปีใหม่ไทย สุขภาพแข็งแรงไร้โรคภัยไข้เจ็บครับ',
    signature: 'สมชาย รักเรียน',
    is_anonymous: false,
    status: 'pending',
    festivals: { name: 'วันสงกรานต์' },
    profiles: { full_name: 'สมชาย รักเรียน', email: 'somchai@gmail.com' },
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'mock-wish-2',
    festival_id: '33333333-3333-3333-3333-333333333333',
    message_text: 'เล่นน้ำสงกรานต์อย่างปลอดภัย รักษาสุขภาพกันด้วยนะทุกคน',
    signature: null,
    is_anonymous: true,
    status: 'pending',
    festivals: { name: 'วันสงกรานต์' },
    profiles: { full_name: 'นิรนาม', email: 'anonymous@myfestival.local' },
    created_at: new Date(Date.now() - 3600000).toISOString()
  }
];

const initialMockRevisions = [
  {
    id: 'mock-rev-1',
    message_id: 'mock-wish-3',
    message_text: 'สุขสันต์วันสงกรานต์ ขอให้มีความสุขความเจริญ รุ่งเรืองก้าวหน้ายิ่งๆ ขึ้นไปครับ',
    signature: 'คุณปู่ใจดี',
    is_anonymous: false,
    status: 'pending',
    created_at: new Date(Date.now() - 1800000).toISOString(),
    messages: {
      id: 'mock-wish-3',
      message_text: 'สุขสันต์วันสงกรานต์ ขอให้ร่ำรวยเงินทอง',
      signature: 'คุณปู่',
      is_anonymous: false,
      festivals: { name: 'วันสงกรานต์' },
      profiles: { full_name: 'คุณปู่ใจดี', email: 'grandpa@gmail.com' }
    }
  }
];

const initialMockReports = [
  {
    id: 'mock-rep-1',
    message_id: 'mock-wish-reported',
    reason: 'โฆษณาชวนเชื่อ สแปมและลิงก์ภายนอกที่ไม่เกี่ยวข้องกับงานประเพณีไทย',
    status: 'pending',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    profiles: { full_name: 'ผู้ดูแลความเรียบร้อย', email: 'moderator@myfestival.local' },
    messages: {
      id: 'mock-wish-reported',
      message_text: 'ด่วน! รับสมัครงานออนไลน์ รายได้วันละ 1,000 บาท แอดไลน์ไอดี @spambot',
      signature: 'งานเสริมทำที่บ้าน',
      is_anonymous: false,
      festivals: { name: 'วันสงกรานต์' }
    }
  }
];

const initialMockFestivals = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'วันปีใหม่',
    description: 'ก้าวเข้าสู่ปีใหม่ด้วยใจที่เปี่ยมสุข ส่งมอบสิ่งดีๆ ให้แก่กัน',
    image_url: 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800',
    start_date: '2026-01-01T00:00:00.000Z',
    end_date: '2026-01-05T23:59:59.000Z',
    messages: [{ id: 'm-ny-1' }, { id: 'm-ny-2' }]
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'วันสงกรานต์',
    description: 'ปีใหม่ไทย สาดน้ำคลายร้อน รดน้ำดำหัวผู้ใหญ่ และส่งต่อคำอวยพรชุ่มฉ่ำใจ',
    image_url: 'https://images.unsplash.com/photo-1610991148680-e83616b2cfd1?w=800',
    start_date: '2026-06-01T00:00:00.000Z',
    end_date: '2026-06-15T23:59:59.000Z',
    messages: [{ id: 'm-sk-1' }, { id: 'm-sk-2' }, { id: 'm-sk-3' }]
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    name: 'วันลอยกระทง',
    description: 'ขอขมาพระแม่คงคา ลอยทุกข์โศกโรคภัยไปกับสายน้ำ พร้อมรับพรใหม่ๆ',
    image_url: 'https://images.unsplash.com/photo-1545642055-e51c89f5bc5c?w=800',
    start_date: '2026-11-22T00:00:00.000Z',
    end_date: '2026-11-26T23:59:59.000Z',
    messages: [{ id: 'm-lk-1' }]
  }
];

const initialMockLogs = [
  {
    id: 'log-1',
    created_at: new Date(Date.now() - 600000).toISOString(),
    action: 'approve_new_message',
    profiles: { full_name: 'นารธาร คุณสาร', email: '6nathan.dev@gmail.com' }
  },
  {
    id: 'log-2',
    created_at: new Date(Date.now() - 1800000).toISOString(),
    action: 'add_message',
    profiles: { full_name: 'คุณปู่ใจดี', email: 'grandpa@gmail.com' }
  },
  {
    id: 'log-3',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    action: 'update_profile',
    profiles: { full_name: 'สมชาย รักเรียน', email: 'somchai@gmail.com' }
  }
];

const initialMockNotifications = [
  {
    id: 'notif-1',
    created_at: new Date(Date.now() - 300000).toISOString(),
    title: 'มีคำอวยพรใหม่ที่รอการอนุมัติ',
    content: 'ผู้ใช้งาน สมชาย รักเรียน ส่งข้อความใหม่ในเทศกาลวันสงกรานต์'
  },
  {
    id: 'notif-2',
    created_at: new Date(Date.now() - 1200000).toISOString(),
    title: 'รายงานข้อความไม่เหมาะสม',
    content: 'ข้อความ ID mock-wish-reported ได้รับการรายงานความไม่เหมาะสม'
  }
];

const getMockData = (key, fallback) => {
  const data = localStorage.getItem(`myfestival_mock_${key}`);
  if (!data) {
    localStorage.setItem(`myfestival_mock_${key}`, JSON.stringify(fallback));
    return fallback;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return fallback;
  }
};

const saveMockData = (key, data) => {
  localStorage.setItem(`myfestival_mock_${key}`, JSON.stringify(data));
};

// Initialize Page
export const init = async () => {
  const user = await getCurrentUser();
  if (!user || user.email !== '6nathan.dev@gmail.com') {
    showToast('สิทธิ์การเข้าใช้งานถูกปฏิเสธสำหรับบทบาทนี้', 'error');
    navigate('/');
    return;
  }
  
  currentUserId = user.id;
  
  // Initialize Flatpickr for custom sketchbook card-style datepicker
  if (window.flatpickr) {
    window.flatpickr('#fest-start', {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      locale: "th",
      time_24hr: true
    });
    window.flatpickr('#fest-end', {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      locale: "th",
      time_24hr: true
    });
  }
  
  setupTabNavigation();
  setupRejectionModal();
  setupFestivalForm();
  setupMembersViewToggle();
  setupRequestEditModal();
  setupDeleteReasonModal();
  
  // Subscribe to realtime changes on database tables to keep lists updated
  const supabase = await getSupabase();
  if (supabase) {
    // 1. Profiles Realtime
    if (profilesSubscription) profilesSubscription.unsubscribe();
    profilesSubscription = supabase
      .channel('admin-profiles-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        async (payload) => {
          console.log('Profiles change detected:', payload);
          const tab = document.getElementById('tab-members');
          if (tab && tab.classList.contains('btn-yellow')) {
            await loadMembersTab();
          }
        }
      )
      .subscribe();

    // 2. Messages Realtime (Wishes Queue and Wishes tab)
    if (messagesSubscription) messagesSubscription.unsubscribe();
    messagesSubscription = supabase
      .channel('admin-messages-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        async (payload) => {
          console.log('Messages change detected:', payload);
          const tabApproval = document.getElementById('tab-approval');
          const tabWishes = document.getElementById('tab-wishes');
          if (tabApproval && tabApproval.classList.contains('btn-yellow')) {
            await loadApprovalTab();
          } else if (tabWishes && tabWishes.classList.contains('btn-yellow')) {
            await loadWishesTab();
          }
        }
      )
      .subscribe();

    // 3. Message Revisions Realtime
    if (revisionsSubscription) revisionsSubscription.unsubscribe();
    revisionsSubscription = supabase
      .channel('admin-revisions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_revisions' },
        async (payload) => {
          console.log('Revisions change detected:', payload);
          const tab = document.getElementById('tab-approval');
          if (tab && tab.classList.contains('btn-yellow')) {
            await loadApprovalTab();
          }
        }
      )
      .subscribe();

    // 4. Reports Realtime
    if (reportsSubscription) reportsSubscription.unsubscribe();
    reportsSubscription = supabase
      .channel('admin-reports-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        async (payload) => {
          console.log('Reports change detected:', payload);
          const tab = document.getElementById('tab-reports');
          if (tab && tab.classList.contains('btn-yellow')) {
            await loadReportsTab();
          }
        }
      )
      .subscribe();

    // 5. Festivals Realtime
    if (festivalsSubscription) festivalsSubscription.unsubscribe();
    festivalsSubscription = supabase
      .channel('admin-festivals-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'festivals' },
        async (payload) => {
          console.log('Festivals change detected:', payload);
          const tab = document.getElementById('tab-festivals');
          if (tab && tab.classList.contains('btn-yellow')) {
            await loadFestivalsTab();
          }
        }
      )
      .subscribe();

    // 6. Notifications Realtime (Admin Alerts/Stats Tab)
    if (notificationsSubscription) notificationsSubscription.unsubscribe();
    notificationsSubscription = supabase
      .channel('admin-notifications-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        async (payload) => {
          console.log('Notifications change detected:', payload);
          const tab = document.getElementById('tab-stats');
          if (tab && tab.classList.contains('btn-yellow')) {
            await loadStatsTab();
          }
        }
      )
      .subscribe();

    // 7. Festival Suggestions Realtime
    if (suggestionsSubscription) suggestionsSubscription.unsubscribe();
    suggestionsSubscription = supabase
      .channel('admin-suggestions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'festival_suggestions' },
        async (payload) => {
          console.log('Suggestions change detected:', payload);
          const tab = document.getElementById('tab-approval');
          if (tab && tab.classList.contains('btn-yellow')) {
            await loadApprovalTab();
          }
        }
      )
      .subscribe();
  }
  
  // Default load Approval Tab
  await loadApprovalTab();
};

// Setup Tab Navigation Controls
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.admin-tab');
  const panels = document.querySelectorAll('.admin-panel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', async (e) => {
      const targetId = e.currentTarget.id;
      
      // Update Tab Styles
      tabs.forEach(t => {
        t.classList.remove('btn-yellow');
        t.classList.add('btn-cream');
      });
      e.currentTarget.classList.remove('btn-cream');
      e.currentTarget.classList.add('btn-yellow');
      
      // Update Panels visibility
      panels.forEach(p => p.classList.add('hidden'));
      
      // Load specific tab data and show panel
      if (targetId === 'tab-approval') {
        document.getElementById('panel-approval').classList.remove('hidden');
        await loadApprovalTab();
      } else if (targetId === 'tab-reports') {
        document.getElementById('panel-reports').classList.remove('hidden');
        await loadReportsTab();
      } else if (targetId === 'tab-festivals') {
        document.getElementById('panel-festivals').classList.remove('hidden');
        await loadFestivalsTab();
      } else if (targetId === 'tab-stats') {
        document.getElementById('panel-stats').classList.remove('hidden');
        await loadStatsTab();
      } else if (targetId === 'tab-wishes') {
        document.getElementById('panel-wishes').classList.remove('hidden');
        await loadWishesTab();
      } else if (targetId === 'tab-members') {
        document.getElementById('panel-members').classList.remove('hidden');
        await loadMembersTab();
      }
    });
  });
}

// ----------------------------------------------------
// TAB 1: APPROVAL QUEUE
// ----------------------------------------------------
async function loadApprovalTab() {
  const supabase = await getSupabase();
  
  const newWishesContainer = document.getElementById('queue-new-wishes');
  const revisionsContainer = document.getElementById('queue-revisions');
  
  if (!newWishesContainer || !revisionsContainer) return;
  
  try {
    const { data: newWishes, error: errWishes } = await supabase
      .from('messages')
      .select('*, festivals(name), profiles(full_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
      
    if (errWishes) throw errWishes;
    
    const { data: revisions, error: errRevisions } = await supabase
      .from('message_revisions')
      .select('*, messages(id, message_text, signature, is_anonymous, festivals(name), profiles(full_name, email))')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
      
    if (errRevisions) throw errRevisions;

    const { data: suggestions, error: errSuggestions } = await supabase
      .from('festival_suggestions')
      .select('*, profiles(full_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
      
    if (errSuggestions) throw errSuggestions;
    
    const { data: nameChanges, error: errNameChanges } = await supabase
      .from('profiles')
      .select('*')
      .not('pending_name', 'is', null)
      .order('updated_at', { ascending: true });
      
    if (errNameChanges) throw errNameChanges;
    
    renderNewWishesQueue(newWishes);
    renderRevisionsQueue(revisions);
    renderSuggestionsQueue(suggestions || []);
    renderNameChangesQueue(nameChanges || []);
  } catch (error) {
    console.warn('Error fetching approval queue, falling back to mock:', error);
    const newWishes = getMockData('wishes', initialMockWishes).filter(w => w.status === 'pending');
    const revisions = getMockData('revisions', initialMockRevisions).filter(r => r.status === 'pending');
    const suggestions = getMockData('suggestions', initialMockSuggestions).filter(s => s.status === 'pending');
    const nameChanges = getMockData('name_changes', []).filter(n => n.pending_name);
    renderNewWishesQueue(newWishes);
    renderRevisionsQueue(revisions);
    renderSuggestionsQueue(suggestions);
    renderNameChangesQueue(nameChanges);
  }
}

function renderNewWishesQueue(wishes) {
  const container = document.getElementById('queue-new-wishes');
  if (!container) return;
  
  if (wishes.length === 0) {
    container.innerHTML = `<p class="text-pencil-light font-bold italic text-center py-6">ไม่มีรายการคำอวยพรส่งใหม่ในคิว... 🕊️</p>`;
    return;
  }
  
  container.innerHTML = wishes.map(wish => {
    const writerName = wish.profiles?.full_name || wish.profiles?.email || 'นิรนาม';
    const sig = wish.is_anonymous ? 'ส่งแบบนิรนาม' : wish.signature || 'ไม่ได้ระบุ';
    
    return `
      <div class="sketch-card p-4 bg-white shadow-[2px_2px_0px_0px_#4a3c31] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="sketch-badge btn-cream text-[10px] font-black">🎈 ${wish.festivals?.name}</span>
            <span class="text-xs text-pencil-light font-bold">✍️ ผู้เขียน: ${writerName} (ลายเซ็น: ${sig})</span>
          </div>
          <p class="text-base font-bold italic leading-relaxed">"${wish.message_text}"</p>
        </div>
        
        <div class="flex gap-2 self-end md:self-center">
          <button data-id="${wish.id}" class="btn-approve-new sketch-btn btn-green text-xs py-1 px-3">
            อนุมัติ
          </button>
          <button data-id="${wish.id}" class="btn-reject-new sketch-btn btn-red text-xs py-1 px-3">
            ปฏิเสธ
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners
  container.querySelectorAll('.btn-approve-new').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      await handleApproveNew(id);
    });
  });
  
  container.querySelectorAll('.btn-reject-new').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      openRejectionModal(id, 'new');
    });
  });
}

function renderRevisionsQueue(revisions) {
  const container = document.getElementById('queue-revisions');
  if (!container) return;
  
  if (revisions.length === 0) {
    container.innerHTML = `<p class="text-pencil-light font-bold italic text-center py-6">ไม่มีคำขอปรับปรุงแก้ไขข้อความในคิว... 🕊️</p>`;
    return;
  }
  
  container.innerHTML = revisions.map(rev => {
    const orig = rev.messages || {};
    const writerName = orig.profiles?.full_name || orig.profiles?.email || 'นิรนาม';
    const origSig = orig.is_anonymous ? 'นิรนาม' : orig.signature || 'ไม่ได้ระบุ';
    const newSig = rev.is_anonymous ? 'นิรนาม' : rev.signature || 'ไม่ได้ระบุ';
    
    return `
      <div class="sketch-card p-4 bg-white shadow-[2px_2px_0px_0px_#4a3c31] space-y-4">
        <div class="flex justify-between items-center flex-wrap gap-2">
          <span class="sketch-badge btn-orange text-[10px] font-black">🎈 ${orig.festivals?.name}</span>
          <span class="text-xs text-pencil-light font-bold">✍️ ผู้ร่วมเขียน: ${writerName}</span>
        </div>
        
        <!-- Compare Box -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Original -->
          <div class="bg-pencil-soft/20 border-2 border-dashed border-pencil p-3 rounded-lg">
            <p class="text-xs text-pencil-light font-black uppercase mb-1">ข้อความเดิมที่แสดงอยู่:</p>
            <p class="text-sm font-bold italic">"${orig.message_text}"</p>
            <p class="text-xs text-pencil-light font-bold mt-2">✍️ ลายเซ็นเดิม: ${origSig}</p>
          </div>
          <!-- Revision -->
          <div class="bg-wood-yellow/10 border-2 border-pencil p-3 rounded-lg">
            <p class="text-xs text-wood-orange font-black uppercase mb-1">ขอแก้ไขเป็นข้อความใหม่:</p>
            <p class="text-sm font-bold italic text-wood-orange">"${rev.message_text}"</p>
            <p class="text-xs text-pencil-light font-bold mt-2">✍️ ลายเซ็นใหม่: ${newSig}</p>
          </div>
        </div>
        
        <div class="flex gap-2 justify-end">
          <button data-id="${rev.id}" class="btn-approve-rev sketch-btn btn-green text-xs py-1 px-3">
            อนุมัติการแก้ไข
          </button>
          <button data-id="${rev.id}" class="btn-reject-rev sketch-btn btn-red text-xs py-1 px-3">
            ปฏิเสธการแก้ไข
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners
  container.querySelectorAll('.btn-approve-rev').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const rev = revisions.find(r => r.id === id);
      if (rev) await handleApproveRevision(rev);
    });
  });
  
  container.querySelectorAll('.btn-reject-rev').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      openRejectionModal(id, 'revision');
    });
  });
}

// Approval Operations
async function handleApproveNew(messageId) {
  const supabase = await getSupabase();
  let dbSuccess = false;
  let dbError = null;
  
  if (supabase && !messageId.startsWith('mock')) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ status: 'approved' })
        .eq('id', messageId);
        
      if (!error) {
        dbSuccess = true;
        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: currentUserId,
          action: 'approve_new_message',
          details: { message_id: messageId }
        });
        showToast('อนุมัติคำอวยพรชิ้นใหม่เรียบร้อยแล้ว!', 'success');
      } else {
        dbError = error;
      }
    } catch (error) {
      dbError = error;
    }
  }
  
  if (!dbSuccess) {
    console.warn('DB approve new failed, using mock:', dbError?.message);
    const wishes = getMockData('wishes', initialMockWishes);
    const wish = wishes.find(w => w.id === messageId);
    if (wish) {
      wish.status = 'approved';
      saveMockData('wishes', wishes);
      
      const logs = getMockData('logs', initialMockLogs);
      logs.unshift({
        id: `log-mock-${Date.now()}`,
        created_at: new Date().toISOString(),
        action: 'approve_new_message',
        profiles: { full_name: 'นารธาร คุณสาร', email: '6nathan.dev@gmail.com' }
      });
      saveMockData('logs', logs);
      
      showToast('อนุมัติคำอวยพรชิ้นใหม่เรียบร้อยแล้ว! (Mock)', 'success');
    }
  }
  await loadApprovalTab();
}

async function handleApproveRevision(revision) {
  const supabase = await getSupabase();
  let dbSuccess = false;
  let dbError = null;
  
  if (supabase && !revision.id.startsWith('mock')) {
    try {
      const updatePayload = {
        message_text: revision.message_text,
        signature: revision.signature,
        is_anonymous: revision.is_anonymous,
        status: 'approved'
      };
      if (revision.festival_id) {
        updatePayload.festival_id = revision.festival_id;
      }
      
      const { error: errUpdateMsg } = await supabase
        .from('messages')
        .update(updatePayload)
        .eq('id', revision.message_id);
        
      if (!errUpdateMsg) {
        const { error: errUpdateRev } = await supabase
          .from('message_revisions')
          .update({ status: 'approved' })
          .eq('id', revision.id);
          
        if (!errUpdateRev) {
          dbSuccess = true;
          // Log activity
          await supabase.from('activity_logs').insert({
            user_id: currentUserId,
            action: 'approve_revision',
            details: { message_id: revision.message_id, revision_id: revision.id }
          });
          showToast('อนุมัติการขอแก้ไขคำอวยพรเรียบร้อย!', 'success');
        } else {
          dbError = errUpdateRev;
        }
      } else {
        dbError = errUpdateMsg;
      }
    } catch (error) {
      dbError = error;
    }
  }
  
  if (!dbSuccess) {
    console.warn('DB approve revision failed, using mock:', dbError?.message);
    const revisions = getMockData('revisions', initialMockRevisions);
    const rev = revisions.find(r => r.id === revision.id);
    if (rev) {
      rev.status = 'approved';
      saveMockData('revisions', revisions);
      
      const wishes = getMockData('wishes', initialMockWishes);
      const wish = wishes.find(w => w.id === revision.message_id);
      if (wish) {
        wish.message_text = revision.message_text;
        wish.signature = revision.signature;
        wish.is_anonymous = revision.is_anonymous;
        if (revision.festival_id) {
          wish.festival_id = revision.festival_id;
        }
        wish.status = 'approved';
        saveMockData('wishes', wishes);
      }
      
      const logs = getMockData('logs', initialMockLogs);
      logs.unshift({
        id: `log-mock-${Date.now()}`,
        created_at: new Date().toISOString(),
        action: 'approve_revision',
        profiles: { full_name: 'นารธาร คุณสาร', email: '6nathan.dev@gmail.com' }
      });
      saveMockData('logs', logs);
      
      showToast('อนุมัติการขอแก้ไขคำอวยพรเรียบร้อย! (Mock)', 'success');
    }
  }
  await loadApprovalTab();
}

// ----------------------------------------------------
// TAB 2: REPORTS BOX
// ----------------------------------------------------
async function loadReportsTab() {
  const supabase = await getSupabase();
  const container = document.getElementById('queue-reports');
  if (!container) return;
  
  try {
    const { data: reports, error } = await supabase
      .from('reports')
      .select('*, messages(id, message_text, signature, is_anonymous, festivals(name)), profiles(full_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    renderReportsQueue(reports || []);
  } catch (error) {
    console.warn('Error fetching reports, falling back to mock:', error);
    const reports = getMockData('reports', initialMockReports).filter(r => r.status === 'pending');
    renderReportsQueue(reports);
  }
}

function renderReportsQueue(reports) {
  const container = document.getElementById('queue-reports');
  if (!container) return;
  
  if (reports.length === 0) {
    container.innerHTML = `<p class="text-pencil-light font-bold italic text-center py-6">ไม่มีการรายงานคำอวยพรไม่เหมาะสมในระบบ... 🕊️</p>`;
    return;
  }
  
  container.innerHTML = reports.map(report => {
    const reporterName = report.profiles?.full_name || report.profiles?.email || 'บุคคลทั่วไป (Guest)';
    const msg = report.messages || {};
    const sig = msg.is_anonymous ? 'นิรนาม' : msg.signature || 'ผู้เขียน';
    
    return `
      <div class="sketch-card p-4 bg-white shadow-[2px_2px_0px_0px_#4a3c31] space-y-3">
        <div class="flex justify-between items-center flex-wrap gap-2 border-b border-pencil-soft pb-2">
          <div class="flex items-center gap-2">
            <span class="sketch-badge btn-red text-[10px] font-black">🚨 REPORT</span>
            <span class="text-xs text-pencil-light font-bold">จากผู้แจ้ง: ${reporterName}</span>
          </div>
          <span class="text-xs text-pencil-light font-bold">${new Date(report.created_at).toLocaleString('th-TH')}</span>
        </div>
        
        <div class="space-y-1">
          <p class="text-xs text-pencil-light font-black uppercase">ข้อความคำอวยพร:</p>
          <p class="text-sm font-bold italic bg-pencil-soft/10 p-2.5 rounded border border-pencil">
            "${msg.message_text || 'ข้อความถูกลบแล้ว'}" <span class="text-xs text-pencil-light block mt-1">(เทศกาล: ${msg.festivals?.name || ''} / ผู้ส่ง: ${sig})</span>
          </p>
        </div>
        
        <div class="bg-wood-orange/10 border-2 border-pencil p-3 rounded-lg text-sm">
          ⚠️ <span class="font-extrabold text-wood-orange">เหตุผลการรายงาน:</span> ${report.reason}
        </div>
        
        <div class="flex gap-2 justify-end pt-2">
          <button data-id="${report.id}" class="btn-dismiss-report sketch-btn btn-cream text-xs py-1 px-3">
            ปัดตก (ข้อความเหมาะสม)
          </button>
          <button data-id="${report.id}" data-msg-id="${msg.id}" class="btn-hide-msg sketch-btn btn-red text-xs py-1 px-3">
            ปฏิเสธ & ซ่อนข้อความ
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach listeners
  container.querySelectorAll('.btn-dismiss-report').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      await handleResolveReport(id);
    });
  });
  
  container.querySelectorAll('.btn-hide-msg').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const reportId = e.target.getAttribute('data-id');
      const msgId = e.target.getAttribute('data-msg-id');
      await handleHideOffensiveMessage(reportId, msgId);
    });
  });
}

async function handleResolveReport(reportId) {
  const supabase = await getSupabase();
  let dbSuccess = false;
  let dbError = null;
  
  if (supabase && !reportId.startsWith('mock')) {
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: 'resolved' })
        .eq('id', reportId);
        
      if (!error) {
        dbSuccess = true;
        showToast('ปัดตกรายงานนี้แล้ว', 'info');
      } else {
        dbError = error;
      }
    } catch (error) {
      dbError = error;
    }
  }
  
  if (!dbSuccess) {
    console.warn('DB resolve report failed, using mock:', dbError?.message);
    const reports = getMockData('reports', initialMockReports);
    const rep = reports.find(r => r.id === reportId);
    if (rep) {
      rep.status = 'resolved';
      saveMockData('reports', reports);
      showToast('ปัดตกรายงานนี้แล้ว (Mock)', 'info');
    }
  }
  await loadReportsTab();
}

async function handleHideOffensiveMessage(reportId, messageId) {
  const supabase = await getSupabase();
  let dbSuccess = false;
  let dbError = null;
  
  if (supabase && !reportId.startsWith('mock')) {
    try {
      const { error: errMsg } = await supabase
        .from('messages')
        .update({
          status: 'rejected',
          rejection_reason: 'ข้อความถูกปฏิเสธและซ่อนโดยผู้ดูแลระบบเนื่องจากการรายงานเนื้อหาที่ไม่เหมาะสม'
        })
        .eq('id', messageId);
        
      if (!errMsg) {
        const { error: errRep } = await supabase
          .from('reports')
          .update({ status: 'resolved' })
          .eq('message_id', messageId);
          
        await supabase.from('activity_logs').insert({
          user_id: currentUserId,
          action: 'hide_reported_message',
          details: { message_id: messageId, report_id: reportId }
        });
        
        dbSuccess = true;
        showToast('ซ่อนข้อความคำอวยพรและแก้ไขรายงานข้อความเรียบร้อยแล้ว!', 'success');
      } else {
        dbError = errMsg;
      }
    } catch (error) {
      dbError = error;
    }
  }
  
  if (!dbSuccess) {
    console.warn('DB hide reported message failed, using mock:', dbError?.message);
    const reports = getMockData('reports', initialMockReports);
    reports.forEach(r => {
      if (r.message_id === messageId || r.id === reportId) {
        r.status = 'resolved';
      }
    });
    saveMockData('reports', reports);
    
    const wishes = getMockData('wishes', initialMockWishes);
    const wish = wishes.find(w => w.id === messageId);
    if (wish) {
      wish.status = 'rejected';
      wish.rejection_reason = 'ข้อความถูกปฏิเสธและซ่อนโดยผู้ดูแลระบบเนื่องจากการรายงานเนื้อหาที่ไม่เหมาะสม';
      saveMockData('wishes', wishes);
    }
    
    const logs = getMockData('logs', initialMockLogs);
    logs.unshift({
      id: `log-mock-${Date.now()}`,
      created_at: new Date().toISOString(),
      action: 'hide_reported_message',
      profiles: { full_name: 'นารธาร คุณสาร', email: '6nathan.dev@gmail.com' }
    });
    saveMockData('logs', logs);
    
    showToast('ซ่อนข้อความคำอวยพรและแก้ไขรายงานข้อความเรียบร้อยแล้ว! (Mock)', 'success');
  }
  await loadReportsTab();
}

// ----------------------------------------------------
// TAB 3: FESTIVAL MANAGEMENT
// ----------------------------------------------------
async function loadFestivalsTab() {
  const supabase = await getSupabase();
  const listContainer = document.getElementById('admin-festivals-list');
  if (!listContainer) return;
  
  try {
    const { data: festivals, error } = await supabase
      .from('festivals')
      .select('*, messages(id)')
      .order('start_date', { ascending: false });
      
    if (error) throw error;
    
    renderAdminFestivalsList(festivals || []);
  } catch (error) {
    console.warn('Error fetching festivals, falling back to mock:', error);
    const festivals = getMockData('festivals', initialMockFestivals);
    renderAdminFestivalsList(festivals);
  }
  setupFestivalListEvents();
}

function renderAdminFestivalsList(festivals) {
  const container = document.getElementById('admin-festivals-list');
  if (!container) return;
  
  if (festivals.length === 0) {
    container.innerHTML = `<p class="text-pencil-light font-bold italic text-center py-6">ไม่มีเทศกาลประเพณีในระบบ...</p>`;
    return;
  }
  
  container.innerHTML = festivals.map(f => {
    const count = f.messages?.length || 0;
    const startStr = new Date(f.start_date).toLocaleString('th-TH');
    const endStr = new Date(f.end_date).toLocaleString('th-TH');
    
    return `
      <div class="sketch-card p-3 bg-white flex justify-between items-center gap-4">
        <div>
          <h3 class="font-extrabold text-base">${f.name}</h3>
          <p class="text-xs text-pencil-light font-bold">🗓️ ${startStr} ถึง ${endStr}</p>
          <p class="text-xs text-pencil-light mt-1">${f.description || ''}</p>
        </div>
        <div class="flex flex-col items-end gap-2 shrink-0">
          <span class="sketch-badge btn-yellow text-xs font-black">💌 ${count} ข้อความ</span>
          <button class="sketch-btn btn-cream text-xs py-1 px-2.5 btn-edit-festival font-bold" data-id="${f.id}">
            แก้ไข ✏️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function setupFestivalListEvents() {
  const editButtons = document.querySelectorAll('.btn-edit-festival');
  editButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const festivalId = btn.getAttribute('data-id');
      await enterEditFestivalMode(festivalId);
    });
  });
}

async function enterEditFestivalMode(id) {
  const supabase = await getSupabase();
  let festival = null;
  
  if (supabase && !id.startsWith('mock')) {
    try {
      const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .eq('id', id)
        .single();
      if (!error) festival = data;
    } catch (err) {
      console.warn('Error fetching festival details:', err);
    }
  }
  
  if (!festival) {
    const festivals = getMockData('festivals', initialMockFestivals);
    festival = festivals.find(f => f.id === id);
  }
  
  if (!festival) {
    showToast('ไม่พบข้อมูลเทศกาล', 'error');
    return;
  }
  
  // Populate form fields
  document.getElementById('fest-id').value = festival.id;
  document.getElementById('fest-name').value = festival.name;
  document.getElementById('fest-desc').value = festival.description || '';
  
  // Update image preview
  currentFestivalImageUrl = festival.image_url || null;
  const previewContainer = document.getElementById('fest-image-preview-container');
  const previewImg = document.getElementById('fest-image-preview');
  if (previewContainer && previewImg) {
    if (currentFestivalImageUrl) {
      previewImg.src = currentFestivalImageUrl;
      previewContainer.classList.remove('hidden');
    } else {
      previewImg.src = '';
      previewContainer.classList.add('hidden');
    }
  }
  
  // Format dates for flatpickr input (YYYY-MM-DD HH:MM)
  const formatDateTime = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  };
  
  document.getElementById('fest-start').value = formatDateTime(festival.start_date);
  document.getElementById('fest-end').value = formatDateTime(festival.end_date);
  
  // Update UI to Edit Mode
  document.getElementById('festival-form-title').textContent = `🎡 แก้ไขเทศกาล: ${festival.name}`;
  document.getElementById('btn-submit-festival').textContent = 'บันทึกการแก้ไข 💾';
  document.getElementById('btn-submit-festival').className = 'sketch-btn btn-yellow w-full py-2 text-base font-bold';
  document.getElementById('edit-festival-actions').classList.remove('hidden');
  
  // Scroll to form (for mobile user convenience)
  document.getElementById('festival-form-title').scrollIntoView({ behavior: 'smooth' });
}

function exitEditFestivalMode() {
  const form = document.getElementById('add-festival-form');
  if (form) form.reset();
  
  document.getElementById('fest-id').value = '';
  document.getElementById('festival-form-title').textContent = '🎡 เพิ่มเทศกาลใหม่';
  document.getElementById('btn-submit-festival').textContent = 'สร้างเทศกาลเข้าระบบ 💾';
  document.getElementById('btn-submit-festival').className = 'sketch-btn btn-green w-full py-2 text-base font-bold';
  document.getElementById('edit-festival-actions').classList.add('hidden');
  
  currentFestivalImageUrl = null;
  const previewContainer = document.getElementById('fest-image-preview-container');
  const previewImg = document.getElementById('fest-image-preview');
  if (previewContainer && previewImg) {
    previewImg.src = '';
    previewContainer.classList.add('hidden');
  }
}

function handleFestivalImageUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 533;
        const ctx = canvas.getContext('2d');
        const targetWidth = 800;
        const targetHeight = 533;
        const sourceAspect = img.width / img.height;
        const targetAspect = targetWidth / targetHeight;
        
        let srcX = 0, srcY = 0, srcWidth = img.width, srcHeight = img.height;
        if (sourceAspect > targetAspect) {
          srcWidth = img.height * targetAspect;
          srcX = (img.width - srcWidth) / 2;
        } else {
          srcHeight = img.width / targetAspect;
          srcY = (img.height - srcHeight) / 2;
        }
        
        ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, targetWidth, targetHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('รูปภาพไม่ถูกต้อง'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
    reader.readAsDataURL(file);
  });
}

function setupFestivalForm() {
  const form = document.getElementById('add-festival-form');
  if (!form) return;
  
  const fileInput = document.getElementById('fest-image');
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const resizedBase64 = await handleFestivalImageUpload(file);
      currentFestivalImageUrl = resizedBase64;
      
      const previewContainer = document.getElementById('fest-image-preview-container');
      const previewImg = document.getElementById('fest-image-preview');
      if (previewImg && previewContainer) {
        previewImg.src = resizedBase64;
        previewContainer.classList.remove('hidden');
      }
    } catch (err) {
      console.error(err);
      showToast('ไม่สามารถประมวลผลรูปภาพได้: ' + err.message, 'error');
    }
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supabase = await getSupabase();
    
    const id = document.getElementById('fest-id').value;
    const name = document.getElementById('fest-name').value.trim();
    const desc = document.getElementById('fest-desc').value.trim();
    const image = currentFestivalImageUrl;
    const start = document.getElementById('fest-start').value;
    const end = document.getElementById('fest-end').value;
    
    const submitBtn = document.getElementById('btn-submit-festival');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = id ? 'กำลังบันทึกการแก้ไข...' : 'กำลังสร้างเทศกาล...';
    
    let dbSuccess = false;
    let dbError = null;
    
    if (id) {
      // Edit Mode (Update)
      if (supabase && !id.startsWith('mock')) {
        try {
          const { error } = await supabase
            .from('festivals')
            .update({
              name,
              description: desc,
              image_url: image || null,
              start_date: new Date(start).toISOString(),
              end_date: new Date(end).toISOString()
            })
            .eq('id', id);
            
          if (!error) {
            dbSuccess = true;
            showToast(`แก้ไขเทศกาล "${name}" เรียบร้อยแล้ว!`, 'success');
          } else {
            dbError = error;
          }
        } catch (error) {
          dbError = error;
        }
      }
      
      if (!dbSuccess) {
        console.warn('DB update festival failed, using mock:', dbError?.message);
        const festivals = getMockData('festivals', initialMockFestivals);
        const index = festivals.findIndex(f => f.id === id);
        if (index !== -1) {
          festivals[index] = {
            ...festivals[index],
            name,
            description: desc,
            image_url: image || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600',
            start_date: new Date(start).toISOString(),
            end_date: new Date(end).toISOString()
          };
          saveMockData('festivals', festivals);
          showToast(`แก้ไขเทศกาล "${name}" เรียบร้อยแล้ว! (Mock)`, 'success');
        }
      }
      exitEditFestivalMode();
    } else {
      // Add Mode (Insert)
      if (supabase) {
        try {
          const { error } = await supabase
            .from('festivals')
            .insert({
              name,
              description: desc,
              image_url: image || null,
              start_date: new Date(start).toISOString(),
              end_date: new Date(end).toISOString()
            });
            
          if (!error) {
            dbSuccess = true;
            showToast(`สร้างเทศกาลใหม่ "${name}" สำเร็จแล้ว!`, 'success');
          } else {
            dbError = error;
          }
        } catch (error) {
          dbError = error;
        }
      }
      
      if (!dbSuccess) {
        console.warn('DB insert festival failed, using mock:', dbError?.message);
        const festivals = getMockData('festivals', initialMockFestivals);
        const newFest = {
          id: `mock-fest-${Date.now()}`,
          name,
          description: desc,
          image_url: image || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600',
          start_date: new Date(start).toISOString(),
          end_date: new Date(end).toISOString(),
          messages: []
        };
        festivals.unshift(newFest);
        saveMockData('festivals', festivals);
        showToast(`สร้างเทศกาลใหม่ "${name}" สำเร็จแล้ว! (Mock)`, 'success');
      }
      exitEditFestivalMode(); // resets preview and form
    }
    
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
    await loadFestivalsTab();
  });
  
  // Set up Cancel button listener
  const btnCancel = document.getElementById('btn-cancel-edit-festival');
  btnCancel?.addEventListener('click', () => {
    exitEditFestivalMode();
  });
  
  // Set up Delete button listener
  const btnDelete = document.getElementById('btn-delete-festival');
  btnDelete?.addEventListener('click', async () => {
    const id = document.getElementById('fest-id').value;
    const name = document.getElementById('fest-name').value;
    if (!id) return;
    
    const confirmed = confirm(`⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบเทศกาล "${name}"?\nการลบจะลบข้อมูลคำอวยพรทั้งหมดที่อยู่ในเทศกาลนี้ด้วย และไม่สามารถกู้คืนได้!`);
    if (!confirmed) return;
    
    const supabase = await getSupabase();
    let dbSuccess = false;
    let dbError = null;
    
    btnDelete.disabled = true;
    btnDelete.textContent = 'กำลังลบ...';
    
    if (supabase && !id.startsWith('mock')) {
      try {
        const { error } = await supabase
          .from('festivals')
          .delete()
          .eq('id', id);
          
        if (!error) {
          dbSuccess = true;
          showToast(`ลบเทศกาล "${name}" เรียบร้อยแล้ว`, 'success');
        } else {
          dbError = error;
        }
      } catch (error) {
        dbError = error;
      }
    }
    
    if (!dbSuccess) {
      console.warn('DB delete festival failed, using mock:', dbError?.message);
      const festivals = getMockData('festivals', initialMockFestivals);
      const filtered = festivals.filter(f => f.id !== id);
      saveMockData('festivals', filtered);
      
      // Also clean up mock wishes belonging to this festival
      const wishes = getMockData('wishes', initialMockWishes);
      const filteredWishes = wishes.filter(w => w.festival_id !== id);
      saveMockData('wishes', filteredWishes);
      
      showToast(`ลบเทศกาล "${name}" เรียบร้อยแล้ว (Mock)`, 'success');
    }
    
    exitEditFestivalMode();
    btnDelete.disabled = false;
    btnDelete.textContent = 'ลบเทศกาลนี้ 🗑️';
    await loadFestivalsTab();
  });
}

// ----------------------------------------------------
// TAB 4: STATS & ACTIVITIES
// ----------------------------------------------------
async function loadStatsTab() {
  const supabase = await getSupabase();
  
  try {
    // Get profiles count
    const { count: usersCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    // Get messages counts
    const { data: messages } = await supabase.from('messages').select('*, likes(id), saves(id)');
    // Get total reports count
    const { count: reportsCount } = await supabase.from('reports').select('id', { count: 'exact', head: true });
    
    const totalWishes = messages?.length || 0;
    const totalApproved = messages?.filter(m => m.status === 'approved').length || 0;
    
    // Set UI counts
    document.getElementById('total-users').textContent = usersCount || 0;
    document.getElementById('total-wishes').textContent = totalWishes;
    document.getElementById('total-reports').textContent = reportsCount || 0;
    document.getElementById('total-approved').textContent = totalApproved;
    
    // Query activities logs
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(25);
      
    // Query admin notifications from database
    const { data: adminAlerts } = await supabase
      .from('notifications')
      .select('*')
      .is('user_id', null)
      .order('created_at', { ascending: false })
      .limit(25);
      
    renderActivityLogs(logs || []);
    renderAdminNotifications(adminAlerts || []);
    renderLeaderboards(messages || []);
  } catch (error) {
    console.warn('Error fetching statistics, falling back to mock:', error);
    renderMockStatsTab();
  }
}

function renderMockStatsTab() {
  const wishes = getMockData('wishes', initialMockWishes);
  const reports = getMockData('reports', initialMockReports);
  const logs = getMockData('logs', initialMockLogs);
  const notifications = getMockData('notifications', initialMockNotifications);
  
  const totalWishes = wishes.length;
  const totalApproved = wishes.filter(w => w.status === 'approved').length;
  const totalReports = reports.length;
  
  document.getElementById('total-users').textContent = 12; // Realistic mock number
  document.getElementById('total-wishes').textContent = totalWishes;
  document.getElementById('total-reports').textContent = totalReports;
  document.getElementById('total-approved').textContent = totalApproved;
  
  renderActivityLogs(logs);
  renderAdminNotifications(notifications);
  renderMockLeaderboards(wishes);
}

function renderMockLeaderboards(wishes) {
  const topContribContainer = document.getElementById('top-contributors-list');
  const topMsgContainer = document.getElementById('top-messages-list');
  
  if (!topContribContainer || !topMsgContainer) return;
  
  // Aggregate contributors
  const contribs = {};
  wishes.forEach(w => {
    const name = w.profiles?.full_name || 'นิรนาม';
    if (!contribs[name]) {
      contribs[name] = { count: 0, likes: 0 };
    }
    if (w.status === 'approved') {
      contribs[name].count++;
    }
    contribs[name].likes += 3; // Mock some likes
  });
  
  const sortedContribs = Object.entries(contribs)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.likes - a.likes || b.count - a.count)
    .slice(0, 5);
    
  topContribContainer.innerHTML = sortedContribs.map((c, idx) => `
    <li class="flex justify-between items-center py-1">
      <span>${idx + 1}. 👑 ${c.name}</span>
      <span class="text-xs text-pencil-light">อนุมัติ ${c.count} (❤️ ได้ไลก์ ${c.likes})</span>
    </li>
  `).join('') || `<li class="text-pencil-light italic text-center py-2">ยังไม่มีผลอันดับ</li>`;
  
  const approvedWishes = wishes.filter(w => w.status === 'approved');
  topMsgContainer.innerHTML = approvedWishes.slice(0, 5).map((w, idx) => {
    const preview = w.message_text.substring(0, 25) + '...';
    return `
      <li class="flex justify-between items-center py-1 gap-4">
        <a href="/message/${w.id}" class="truncate text-pencil hover:underline font-bold">
          ${idx + 1}. "${preview}"
        </a>
        <span class="text-xs text-pencil-light shrink-0">❤️ 3 / ⭐ 1</span>
      </li>
    `;
  }).join('') || `<li class="text-pencil-light italic text-center py-2">ยังไม่มีการ์ดคำอวยพรยอดนิยม</li>`;
}

function renderAdminNotifications(alerts) {
  const container = document.getElementById('admin-notifications-list');
  if (!container) return;
  
  if (alerts.length === 0) {
    container.innerHTML = `<p class="text-pencil-light italic text-center py-4">ไม่มีรายการแจ้งเตือนในขณะนี้...</p>`;
    return;
  }
  
  container.innerHTML = alerts.map(alert => {
    const time = new Date(alert.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="border-b border-pencil-soft/40 py-1.5 flex justify-between gap-4">
        <span><strong>${alert.title}</strong>: ${alert.content}</span>
        <span class="text-xs text-pencil-light shrink-0">${time}</span>
      </div>
    `;
  }).join('');
}

function renderActivityLogs(logs) {
  const container = document.getElementById('activity-logs-list');
  if (!container) return;
  
  if (logs.length === 0) {
    container.innerHTML = `<p class="text-pencil-light italic text-center py-4">ไม่มีประวัติกิจกรรมในระบบ...</p>`;
    return;
  }
  
  container.innerHTML = logs.map(log => {
    const time = new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const user = log.profiles?.full_name || log.profiles?.email || 'ระบบ / แขก';
    
    let actionDesc = log.action;
    if (log.action === 'like_message') actionDesc = '❤️ กดถูกใจคำอวยพร';
    else if (log.action === 'unlike_message') actionDesc = '🤍 ยกเลิกถูกใจคำอวยพร';
    else if (log.action === 'save_message') actionDesc = '⭐ บันทึกการ์ดคำอวยพร';
    else if (log.action === 'unsave_message') actionDesc = '🗑️ ยกเลิกบันทึกคำอวยพร';
    else if (log.action === 'report_message') actionDesc = '🚩 แจ้งรายงานความไม่เหมาะสม';
    else if (log.action === 'add_message') actionDesc = '✍️ ส่งข้อความอวยพรใหม่';
    else if (log.action === 'approve_new_message') actionDesc = '🔑 อนุมัติคำอวยพรเข้าสู่ระบบ';
    else if (log.action === 'create_revision') actionDesc = '🔄 เสนอใบแก้ไขข้อความ';
    else if (log.action === 'approve_revision') actionDesc = '🔑 อนุมัติคำขอแก้ไขข้อความ';
    else if (log.action === 'update_profile') actionDesc = '👤 แก้ไขประวัติส่วนตัว';
    else if (log.action === 'hide_reported_message') actionDesc = '🚨 สั่งบล็อกข้อความเนื่องจากการร้องเรียน';
    
    return `
      <div class="border-b border-pencil-soft/40 py-1.5 flex justify-between gap-4">
        <span><strong class="text-pencil">${user}</strong> - ${actionDesc}</span>
        <span class="text-xs text-pencil-light shrink-0">${time}</span>
      </div>
    `;
  }).join('');
}

function renderLeaderboards(messages) {
  const topContribContainer = document.getElementById('top-contributors-list');
  const topMsgContainer = document.getElementById('top-messages-list');
  
  if (!topContribContainer || !topMsgContainer) return;
  
  // 1. Top Contributors (Aggregated in JS)
  // We need contributor names, let's fetch contributor details or map from messages
  const contributorStats = {};
  messages.forEach(m => {
    const cId = m.contributor_id;
    if (!contributorStats[cId]) {
      contributorStats[cId] = { id: cId, count: 0, likes: 0 };
    }
    if (m.status === 'approved') {
      contributorStats[cId].count++;
    }
    contributorStats[cId].likes += (m.likes?.length || 0);
  });
  
  // Sort contributors by likes count
  const sortedContributors = Object.values(contributorStats)
    .sort((a, b) => b.likes - a.likes || b.count - a.count)
    .slice(0, 5);
    
  if (sortedContributors.length === 0) {
    topContribContainer.innerHTML = `<li class="text-pencil-light italic text-center py-2">ยังไม่มีผลอันดับ</li>`;
  } else {
    // Fetch contributor profiles to display names
    getSupabase().then(supabase => {
      supabase.from('profiles').select('id, full_name, email')
        .in('id', sortedContributors.map(c => c.id))
        .then(({ data: profiles }) => {
          const profileMap = {};
          (profiles || []).forEach(p => profileMap[p.id] = p.full_name || p.email);
          
          topContribContainer.innerHTML = sortedContributors.map((c, idx) => {
            const name = profileMap[c.id] || 'นิรนาม';
            return `
              <li class="flex justify-between items-center py-1">
                <span>${idx + 1}. 👑 ${name}</span>
                <span class="text-xs text-pencil-light">อนุมัติ ${c.count} (❤️ ได้ไลก์ ${c.likes})</span>
              </li>
            `;
          }).join('');
        });
    });
  }
  
  // 2. Top Messages
  const sortedMessages = [...messages]
    .filter(m => m.status === 'approved')
    .sort((a, b) => ((b.likes?.length || 0) + (b.saves?.length || 0)) - ((a.likes?.length || 0) + (a.saves?.length || 0)))
    .slice(0, 5);
    
  if (sortedMessages.length === 0) {
    topMsgContainer.innerHTML = `<li class="text-pencil-light italic text-center py-2">ยังไม่มีการ์ดคำอวยพรยอดนิยม</li>`;
  } else {
    topMsgContainer.innerHTML = sortedMessages.map((m, idx) => {
      const preview = m.message_text.substring(0, 25) + '...';
      const likes = m.likes?.length || 0;
      const saves = m.saves?.length || 0;
      return `
        <li class="flex justify-between items-center py-1 gap-4">
          <a href="/message/${m.id}" class="truncate text-pencil hover:underline font-bold">
            ${idx + 1}. "${preview}"
          </a>
          <span class="text-xs text-pencil-light shrink-0">❤️ ${likes} / ⭐ ${saves}</span>
        </li>
      `;
    }).join('');
  }
}

// ----------------------------------------------------
// REJECTION DIALOG LOGIC
// ----------------------------------------------------
function setupRejectionModal() {
  document.getElementById('btn-close-rejection')?.addEventListener('click', () => {
    document.getElementById('rejection-modal').classList.add('hidden');
    currentRejectionTarget = null;
  });
  
  const form = document.getElementById('rejection-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentRejectionTarget) return;
    
    const reason = document.getElementById('rejection-reason-input').value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังปฏิเสธ...';
    
    let dbSuccess = false;
    let dbError = null;
    const supabase = await getSupabase();
    
    if (supabase && !currentRejectionTarget.id.startsWith('mock')) {
      try {
        if (currentRejectionTarget.type === 'new') {
          // Reject Pending message
          const { error } = await supabase
            .from('messages')
            .update({
              status: 'rejected',
              rejection_reason: reason
            })
            .eq('id', currentRejectionTarget.id);
            
          if (!error) {
            await supabase.from('activity_logs').insert({
              user_id: currentUserId,
              action: 'reject_new_message',
              details: { message_id: currentRejectionTarget.id, reason }
            });
            dbSuccess = true;
            showToast('ปฏิเสธการพิจารณาคำอวยพรนี้แล้ว', 'info');
          } else {
            dbError = error;
          }
        } else if (currentRejectionTarget.type === 'revision') {
          // Reject Revision
          const { error } = await supabase
            .from('message_revisions')
            .update({
              status: 'rejected',
              rejection_reason: reason
            })
            .eq('id', currentRejectionTarget.id);
            
          if (!error) {
            const { data: revisionObj } = await supabase.from('message_revisions').select('message_id').eq('id', currentRejectionTarget.id).single();
            await supabase.from('activity_logs').insert({
              user_id: currentUserId,
              action: 'reject_revision',
              details: { message_id: revisionObj?.message_id, revision_id: currentRejectionTarget.id, reason }
            });
            dbSuccess = true;
            showToast('ปฏิเสธและปัดตกการเสนอขอแก้ไขเรียบร้อย', 'info');
          } else {
            dbError = error;
          }
        } else if (currentRejectionTarget.type === 'suggestion') {
          // Reject Festival Suggestion
          const { error } = await supabase
            .from('festival_suggestions')
            .update({ status: 'rejected' })
            .eq('id', currentRejectionTarget.id);
            
          if (!error) {
            const { data: sugObj } = await supabase
              .from('festival_suggestions')
              .select('suggested_by, name')
              .eq('id', currentRejectionTarget.id)
              .single();
              
            if (sugObj?.suggested_by) {
              await supabase
                .from('notifications')
                .insert({
                  user_id: sugObj.suggested_by,
                  title: '❌ ข้อเสนอแนะเทศกาลของคุณไม่ได้รับการอนุมัติ',
                  content: `ข้อเสนอแนะเทศกาล "${sugObj.name}" ถูกปฏิเสธเนื่องจาก: ${reason}`,
                  type: 'rejection'
                });
            }
            
            await supabase.from('activity_logs').insert({
              user_id: currentUserId,
              action: 'reject_festival_suggestion',
              details: { suggestion_id: currentRejectionTarget.id, reason }
            });
            dbSuccess = true;
            showToast('ปฏิเสธข้อเสนอแนะเทศกาลนี้เรียบร้อย', 'info');
          } else {
            dbError = error;
          }
        }
      } catch (error) {
        dbError = error;
      }
    }
    
    if (!dbSuccess) {
      console.warn('DB rejection failed, using mock:', dbError?.message);
      if (currentRejectionTarget.type === 'new') {
        const wishes = getMockData('wishes', initialMockWishes);
        const wish = wishes.find(w => w.id === currentRejectionTarget.id);
        if (wish) {
          wish.status = 'rejected';
          wish.rejection_reason = reason;
          saveMockData('wishes', wishes);
          
          const logs = getMockData('logs', initialMockLogs);
          logs.unshift({
            id: `log-mock-${Date.now()}`,
            created_at: new Date().toISOString(),
            action: 'reject_new_message',
            profiles: { full_name: 'นารธาร คุณสาร', email: '6nathan.dev@gmail.com' }
          });
          saveMockData('logs', logs);
          showToast('ปฏิเสธการพิจารณาคำอวยพรนี้แล้ว (Mock)', 'info');
        }
      } else if (currentRejectionTarget.type === 'revision') {
        const revisions = getMockData('revisions', initialMockRevisions);
        const rev = revisions.find(r => r.id === currentRejectionTarget.id);
        if (rev) {
          rev.status = 'rejected';
          rev.rejection_reason = reason;
          saveMockData('revisions', revisions);
          
          const logs = getMockData('logs', initialMockLogs);
          logs.unshift({
            id: `log-mock-${Date.now()}`,
            created_at: new Date().toISOString(),
            action: 'reject_revision',
            profiles: { full_name: 'นารธาร คุณสาร', email: '6nathan.dev@gmail.com' }
          });
          saveMockData('logs', logs);
          showToast('ปฏิเสธและปัดตกการเสนอขอแก้ไขเรียบร้อย (Mock)', 'info');
        }
      } else if (currentRejectionTarget.type === 'suggestion') {
        const suggestions = getMockData('suggestions', initialMockSuggestions);
        const sug = suggestions.find(s => s.id === currentRejectionTarget.id);
        if (sug) {
          sug.status = 'rejected';
          saveMockData('suggestions', suggestions);
          
          const logs = getMockData('logs', initialMockLogs);
          logs.unshift({
            id: `log-mock-${Date.now()}`,
            created_at: new Date().toISOString(),
            action: 'reject_festival_suggestion',
            profiles: { full_name: 'นารธาร คุณสาร', email: '6nathan.dev@gmail.com' }
          });
          saveMockData('logs', logs);
          showToast('ปฏิเสธข้อเสนอแนะเทศกาลนี้เรียบร้อย (Mock)', 'info');
        }
      }
    }
    
    document.getElementById('rejection-modal').classList.add('hidden');
    document.getElementById('rejection-reason-input').value = '';
    currentRejectionTarget = null;
    await loadApprovalTab();
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
  });
}

function openRejectionModal(targetId, targetType) {
  currentRejectionTarget = { id: targetId, type: targetType };
  document.getElementById('rejection-modal').classList.remove('hidden');
}

// ----------------------------------------------------
// TAB 5: MEMBER MANAGEMENT
// ----------------------------------------------------
function setupMembersViewToggle() {
  const btn = document.getElementById('btn-toggle-members-view');
  if (!btn) return;
  btn.addEventListener('click', () => {
    membersViewMode = membersViewMode === 'table' ? 'card' : 'table';
    btn.textContent = membersViewMode === 'table' ? '🖼️ สลับเป็นมุมมองการ์ด' : '📋 สลับเป็นมุมมองตาราง';
    loadMembersTab();
  });
}

async function loadMembersTab() {
  const supabase = await getSupabase();
  const container = document.getElementById('members-list-container');
  if (!container) return;

  container.innerHTML = `<p class="text-pencil-light font-bold italic text-center py-6">กำลังโหลดรายชื่อสมาชิก... 👥</p>`;

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    renderMembersList(profiles || []);
  } catch (error) {
    console.error('Error fetching profiles from Supabase:', error);
    container.innerHTML = `
      <div class="text-center py-6 sketch-card p-6 bg-white text-pencil">
        <p class="text-wood-red font-bold">⚠️ ไม่สามารถเชื่อมต่อตาราง profiles บน Supabase ได้</p>
        <p class="text-xs text-pencil-light mt-2">โปรดตรวจสอบว่าได้รันสคริปต์ฐานข้อมูล (schema.sql, seed.sql, rls.sql) ใน Supabase Dashboard เรียบร้อยแล้ว</p>
        <p class="text-[10px] text-pencil-light/60 mt-1 italic">รายละเอียดข้อผิดพลาด: ${error.message || error}</p>
      </div>
    `;
  }
}

function renderMembersList(profiles) {
  const container = document.getElementById('members-list-container');
  if (!container) return;

  if (profiles.length === 0) {
    container.innerHTML = `<p class="text-pencil-light font-bold italic text-center py-6">ไม่มีรายชื่อสมาชิกในขณะนี้...</p>`;
    return;
  }

  if (membersViewMode === 'table') {
    container.innerHTML = `
      <div class="overflow-x-auto w-full">
        <table class="w-full text-left border-collapse border-3 border-pencil notebook-lines bg-white">
          <thead>
            <tr class="border-b-3 border-pencil bg-pencil-soft/30 text-pencil font-black">
              <th class="p-3 border-r-2 border-pencil text-sm font-extrabold w-16 text-center">ลำดับ</th>
              <th class="p-3 border-r-2 border-pencil text-sm font-extrabold">ชื่อ</th>
              <th class="p-3 border-r-2 border-pencil text-sm font-extrabold">อีเมล</th>
              <th class="p-3 border-r-2 border-pencil text-sm font-extrabold w-44">บทบาท</th>
              <th class="p-3 border-r-2 border-pencil text-sm font-extrabold w-40 text-center">วันที่เข้าร่วม</th>
              <th class="p-3 text-sm font-extrabold w-32 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${profiles.map((profile, idx) => {
              const name = profile.full_name || 'ไม่ได้ระบุ';
              const createdDate = new Date(profile.created_at).toLocaleDateString('th-TH');
              const isSelf = profile.id === currentUserId || profile.email === '6nathan.dev@gmail.com';
              return `
                <tr class="border-b-2 border-pencil-soft hover:bg-pencil-soft/10 text-pencil font-bold">
                  <td class="p-3 border-r-2 border-pencil-soft text-sm text-center">${idx + 1}</td>
                  <td class="p-3 border-r-2 border-pencil-soft text-sm">${name}</td>
                  <td class="p-3 border-r-2 border-pencil-soft text-sm break-all">${profile.email}</td>
                  <td class="p-3 border-r-2 border-pencil-soft text-sm">
                    ${isSelf ? `
                      <select disabled class="select-role-dropdown sketch-input py-1 px-2 text-xs bg-pencil-soft/30 font-bold opacity-60 w-full cursor-not-allowed">
                        <option value="admin" selected>Admin 🔑</option>
                      </select>
                    ` : `
                      <select data-id="${profile.id}" class="select-role-dropdown sketch-input py-1 px-2 text-xs bg-white font-bold w-full">
                        <option value="member" ${profile.role === 'member' ? 'selected' : ''}>Member 👤</option>
                        <option value="contributor" ${profile.role === 'contributor' ? 'selected' : ''}>Contributor ✍️</option>
                        <option value="admin" ${profile.role === 'admin' ? 'selected' : ''}>Admin 🔑</option>
                      </select>
                    `}
                  </td>
                  <td class="p-3 border-r-2 border-pencil-soft text-sm text-center">${createdDate}</td>
                  <td class="p-3 text-sm text-center">
                    ${isSelf ? `
                      <button disabled class="sketch-btn btn-cream text-[11px] py-1 px-2.5 opacity-50 cursor-not-allowed">
                        🛡️ บัญชีของคุณ
                      </button>
                    ` : `
                      <button data-id="${profile.id}" class="btn-delete-profile sketch-btn btn-red text-[11px] py-1 px-2.5">
                        🗑️ ลบสมาชิก
                      </button>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        ${profiles.map((profile, idx) => {
          const name = profile.full_name || 'ไม่ได้ระบุ';
          const createdDate = new Date(profile.created_at).toLocaleDateString('th-TH');
          const firstChar = (profile.full_name || profile.email || '?').charAt(0).toUpperCase();
          const isSelf = profile.id === currentUserId || profile.email === '6nathan.dev@gmail.com';
          
          let roleColor = 'btn-blue';
          if (profile.role === 'admin') roleColor = 'btn-red';
          else if (profile.role === 'contributor') roleColor = 'btn-yellow';

          return `
            <div class="sketch-card p-4 bg-white flex flex-col items-center text-center space-y-3 relative hover-wiggle text-pencil">
              <div class="w-16 h-16 rounded-full border-3 border-pencil flex items-center justify-center text-2xl font-black bg-cream shadow-[2px_2px_0px_0px_#4a3c31]">
                ${firstChar}
              </div>
              
              <div class="space-y-1 w-full">
                <h3 class="font-extrabold text-base leading-tight truncate px-2" title="${name}">${name}</h3>
                <p class="text-xs text-pencil-light font-bold truncate px-2 break-all" title="${profile.email}">${profile.email}</p>
                <p class="text-[10px] text-pencil-light font-bold">เข้าร่วมเมื่อ: ${createdDate}</p>
              </div>
              
              <div class="w-full">
                <span class="sketch-badge ${roleColor} text-[10px] uppercase font-black">
                  ${profile.role}
                </span>
              </div>
              
              <div class="sketch-divider w-full my-2"></div>
              
              <div class="w-full space-y-2 mt-auto">
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-bold text-pencil-light text-left">ปรับบทบาท:</label>
                  ${isSelf ? `
                    <select disabled class="select-role-dropdown sketch-input w-full py-1 px-2 text-xs bg-pencil-soft/30 font-bold opacity-60 cursor-not-allowed">
                      <option value="admin" selected>Admin 🔑</option>
                    </select>
                  ` : `
                    <select data-id="${profile.id}" class="select-role-dropdown sketch-input w-full py-1 px-2 text-xs bg-white font-bold">
                      <option value="member" ${profile.role === 'member' ? 'selected' : ''}>Member 👤</option>
                      <option value="contributor" ${profile.role === 'contributor' ? 'selected' : ''}>Contributor ✍️</option>
                      <option value="admin" ${profile.role === 'admin' ? 'selected' : ''}>Admin 🔑</option>
                    </select>
                  `}
                </div>
                ${isSelf ? `
                  <button disabled class="sketch-btn btn-cream text-xs py-1 w-full justify-center opacity-50 cursor-not-allowed">
                    🛡️ บัญชีของคุณ
                  </button>
                ` : `
                  <button data-id="${profile.id}" class="btn-delete-profile sketch-btn btn-red text-xs py-1 w-full justify-center">
                    🗑️ ลบสมาชิก
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Attach event listeners for role selection
  container.querySelectorAll('.select-role-dropdown').forEach(select => {
    select.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      const val = e.target.value;
      await handleUpdateRole(id, val);
    });
  });

  // Attach event listeners for delete button
  container.querySelectorAll('.btn-delete-profile').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      await handleDeleteMember(id);
    });
  });
}

async function handleUpdateRole(profileId, newRole) {
  const supabase = await getSupabase();
  
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId);

    if (error) throw error;

    // Log activity
    try {
      const { error: logError } = await supabase.from('activity_logs').insert({
        user_id: currentUserId,
        action: 'update_profile',
        details: { target_profile_id: profileId, new_role: newRole }
      });
      if (logError) {
        console.warn('Could not log activity:', logError);
      }
    } catch (err) {
      console.warn('Could not log activity:', err);
    }

    showToast('อัปเดตบทบาทสมาชิกเรียบร้อยแล้ว!', 'success');
  } catch (error) {
    console.error('Failed to update role:', error);
    showToast(`เกิดข้อผิดพลาด: ${error.message || error}`, 'error');
  }
  await loadMembersTab();
}

async function handleDeleteMember(profileId) {
  if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบสมาชิกคนนี้? ข้อมูลโปรไฟล์จะถูกลบออกจากระบบเป็นการถาวร')) {
    return;
  }

  const supabase = await getSupabase();

  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId);

    if (error) throw error;

    showToast('ลบสมาชิกออกจากระบบเรียบร้อยแล้ว!', 'success');
  } catch (error) {
    console.error('Failed to delete member:', error);
    showToast(`เกิดข้อผิดพลาด: ${error.message || error}`, 'error');
  }
  await loadMembersTab();
}

function renderSuggestionsQueue(suggestions) {
  const container = document.getElementById('queue-suggestions');
  if (!container) return;
  
  if (suggestions.length === 0) {
    container.innerHTML = `<p class="text-pencil-light font-bold italic text-center py-6">ไม่มีข้อเสนอแนะนำเทศกาลใหม่ในคิว... 🕊️</p>`;
    return;
  }
  
  container.innerHTML = suggestions.map(sug => {
    const suggesterName = sug.profiles?.full_name || sug.profiles?.email || 'นิรนาม';
    const sig = sug.is_anonymous ? 'ส่งแบบนิรนาม' : sug.signature || 'ไม่ได้ระบุ';
    
    return `
      <div class="sketch-card p-4 bg-white shadow-[2px_2px_0px_0px_#4a3c31] space-y-4">
        <div class="flex justify-between items-center flex-wrap gap-2">
          <span class="sketch-badge btn-yellow text-[10px] font-black">🎡 เสนอเทศกาล</span>
          <span class="text-xs text-pencil-light font-bold">✍️ ผู้เสนอ: ${suggesterName} (ลายเซ็น: ${sig})</span>
        </div>
        
        <div class="space-y-2">
          <p class="text-lg font-extrabold text-wood-orange">🎪 ชื่อที่เสนอ: ${sug.name}</p>
          <p class="text-sm font-bold text-pencil-light">📝 คำอธิบาย: ${sug.description}</p>
          <div class="bg-wood-yellow/10 border-2 border-pencil p-3 rounded-lg">
            <p class="text-xs text-pencil-light font-black uppercase mb-1">คำอวยพรร่วมสร้างชิ้นแรก:</p>
            <p class="text-sm font-bold italic text-pencil">"${sug.suggested_wish}"</p>
          </div>
        </div>
        
        <div class="flex gap-2 justify-end">
          <button data-id="${sug.id}" class="btn-approve-sug sketch-btn btn-green text-xs py-1 px-3 font-bold">
            อนุมัติเทศกาล 👍
          </button>
          <button data-id="${sug.id}" class="btn-reject-sug sketch-btn btn-red text-xs py-1 px-3 font-bold">
            ปฏิเสธ
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners
  container.querySelectorAll('.btn-approve-sug').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const sug = suggestions.find(s => s.id === id);
      if (sug) await handleApproveSuggestion(sug);
    });
  });
  
  container.querySelectorAll('.btn-reject-sug').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      openRejectionModal(id, 'suggestion');
    });
  });
}

function renderNameChangesQueue(nameChanges) {
  const container = document.getElementById('queue-name-changes');
  if (!container) return;
  
  if (nameChanges.length === 0) {
    container.innerHTML = `<p class="text-pencil-light font-bold italic text-center py-6">ไม่มีคำร้องขอเปลี่ยนชื่อสมาชิกในคิว... 🕊️</p>`;
    return;
  }
  
  container.innerHTML = nameChanges.map(profile => {
    const origName = profile.full_name || 'ไม่ได้ระบุ';
    const pendingName = profile.pending_name;
    const email = profile.email;
    
    return `
      <div class="sketch-card p-4 bg-white shadow-[2px_2px_0px_0px_#4a3c31] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="sketch-badge btn-cream text-[10px] font-black">👤 บัญชี: ${email}</span>
          </div>
          <div class="flex items-center gap-2 text-sm font-bold">
            <span class="text-pencil-light line-through">${origName}</span>
            <span class="text-pencil">➡️</span>
            <span class="text-wood-green underline decoration-wavy decoration-wood-yellow font-extrabold">${pendingName}</span>
          </div>
        </div>
        
        <div class="flex gap-2 self-end md:self-center">
          <button data-id="${profile.id}" class="btn-approve-name sketch-btn btn-green text-xs py-1 px-3">
            อนุมัติ
          </button>
          <button data-id="${profile.id}" class="btn-reject-name sketch-btn btn-red text-xs py-1 px-3">
            ปฏิเสธ
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners
  container.querySelectorAll('.btn-approve-name').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const profile = nameChanges.find(p => p.id === id);
      if (profile) await handleApproveNameChange(profile);
    });
  });
  
  container.querySelectorAll('.btn-reject-name').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const profile = nameChanges.find(p => p.id === id);
      if (profile) await handleRejectNameChange(profile);
    });
  });
}

async function handleApproveNameChange(profile) {
  const supabase = await getSupabase();
  let dbSuccess = false;
  let dbError = null;
  
  if (supabase && !profile.id.startsWith('mock')) {
    try {
      const { error: errUpdate } = await supabase
        .from('profiles')
        .update({
          full_name: profile.pending_name,
          pending_name: null
        })
        .eq('id', profile.id);
        
      if (!errUpdate) {
        dbSuccess = true;
        await supabase.from('notifications').insert({
          user_id: profile.id,
          title: '✅ อนุมัติการเปลี่ยนชื่อสำเร็จ!',
          content: `ชื่อเล่น/นามปากกาของคุณถูกเปลี่ยนเป็น "${profile.pending_name}" ตามคำขอแล้ว`,
          type: 'approval'
        });
        
        await supabase.from('activity_logs').insert({
          user_id: currentUserId,
          action: 'approve_name_change',
          details: { profile_id: profile.id, new_name: profile.pending_name }
        });
        
        showToast('อนุมัติการเปลี่ยนชื่อเรียบร้อยแล้ว!', 'success');
      } else {
        dbError = errUpdate;
      }
    } catch (error) {
      dbError = error;
    }
  }
  
  if (!dbSuccess) {
    console.warn('DB approve name change failed, using mock:', dbError?.message);
    const mockProfiles = getMockData('name_changes', []);
    const p = mockProfiles.find(x => x.id === profile.id);
    if (p) {
      p.full_name = p.pending_name;
      p.pending_name = null;
      saveMockData('name_changes', mockProfiles);
      showToast('อนุมัติการเปลี่ยนชื่อเรียบร้อยแล้ว! (Mock)', 'success');
    }
  }
  
  await loadApprovalTab();
}

async function handleRejectNameChange(profile) {
  const supabase = await getSupabase();
  let dbSuccess = false;
  let dbError = null;
  
  if (supabase && !profile.id.startsWith('mock')) {
    try {
      const { error: errUpdate } = await supabase
        .from('profiles')
        .update({
          pending_name: null
        })
        .eq('id', profile.id);
        
      if (!errUpdate) {
        dbSuccess = true;
        await supabase.from('notifications').insert({
          user_id: profile.id,
          title: '❌ ปฏิเสธการเปลี่ยนชื่อ',
          content: `คำขอเปลี่ยนชื่อเป็น "${profile.pending_name}" ถูกปฏิเสธโดยผู้ดูแลระบบ`,
          type: 'rejection'
        });
        
        await supabase.from('activity_logs').insert({
          user_id: currentUserId,
          action: 'reject_name_change',
          details: { profile_id: profile.id, requested_name: profile.pending_name }
        });
        
        showToast('ปฏิเสธการเปลี่ยนชื่อเรียบร้อยแล้ว!', 'info');
      } else {
        dbError = errUpdate;
      }
    } catch (error) {
      dbError = error;
    }
  }
  
  if (!dbSuccess) {
    console.warn('DB reject name change failed, using mock:', dbError?.message);
    const mockProfiles = getMockData('name_changes', []);
    const p = mockProfiles.find(x => x.id === profile.id);
    if (p) {
      p.pending_name = null;
      saveMockData('name_changes', mockProfiles);
      showToast('ปฏิเสธการเปลี่ยนชื่อเรียบร้อยแล้ว! (Mock)', 'info');
    }
  }
  
  await loadApprovalTab();
}


async function handleApproveSuggestion(sug) {
  const supabase = await getSupabase();
  let dbSuccess = false;
  let dbError = null;
  
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + 7); // Active for 7 days
  
  if (supabase && !sug.id.startsWith('mock')) {
    try {
      // 1. Insert festival
      const { data: newFest, error: errFest } = await supabase
        .from('festivals')
        .insert({
          name: sug.name,
          description: sug.description,
          image_url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        })
        .select()
        .single();
        
      if (errFest) throw errFest;
      
      // 2. Insert initial wish message as approved
      const { error: errWish } = await supabase
        .from('messages')
        .insert({
          festival_id: newFest.id,
          contributor_id: sug.suggested_by,
          message_text: sug.suggested_wish,
          signature: sug.signature || null,
          is_anonymous: sug.is_anonymous,
          status: 'approved'
        });
        
      if (errWish) throw errWish;
      
      // 3. Update suggestion status
      const { error: errSug } = await supabase
        .from('festival_suggestions')
        .update({ status: 'approved' })
        .eq('id', sug.id);
        
      if (errSug) throw errSug;
      
      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: currentUserId,
        action: 'approve_festival_suggestion',
        details: { suggestion_id: sug.id, festival_id: newFest.id, festival_name: sug.name }
      });
      
      dbSuccess = true;
      showToast(`อนุมัติเทศกาลใหม่ "${sug.name}" เรียบร้อยแล้ว!`, 'success');
    } catch (error) {
      dbError = error;
    }
  }
  
  if (!dbSuccess) {
    console.warn('DB approve suggestion failed, using mock:', dbError?.message);
    const suggestions = getMockData('suggestions', initialMockSuggestions);
    const targetSug = suggestions.find(s => s.id === sug.id);
    if (targetSug) {
      targetSug.status = 'approved';
      saveMockData('suggestions', suggestions);
      
      const festivals = getMockData('festivals', initialMockFestivals);
      const newFestId = `mock-fest-${Date.now()}`;
      festivals.unshift({
        id: newFestId,
        name: sug.name,
        description: sug.description,
        image_url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        messages: []
      });
      saveMockData('festivals', festivals);
      
      const wishes = getMockData('wishes', initialMockWishes);
      wishes.unshift({
        id: `mock-wish-${Date.now()}`,
        festival_id: newFestId,
        message_text: sug.suggested_wish,
        signature: sug.signature,
        is_anonymous: sug.is_anonymous,
        status: 'approved',
        festivals: { name: sug.name },
        profiles: { full_name: sug.profiles?.full_name || 'ผู้เสนอ', email: sug.profiles?.email || '' },
        created_at: new Date().toISOString()
      });
      saveMockData('wishes', wishes);
      
      const logs = getMockData('logs', initialMockLogs);
      logs.unshift({
        id: `log-mock-${Date.now()}`,
        created_at: new Date().toISOString(),
        action: 'approve_festival_suggestion',
        profiles: { full_name: 'นารธาร คุณสาร', email: '6nathan.dev@gmail.com' }
      });
      saveMockData('logs', logs);
      
      showToast(`อนุมัติเทศกาลใหม่ "${sug.name}" เรียบร้อยแล้ว! (Mock)`, 'success');
    }
  }
  await loadApprovalTab();
}

async function loadWishesTab() {
  const supabase = await getSupabase();
  const container = document.getElementById('wishes-list-container');
  if (!container) return;
  
  container.innerHTML = `<p class="text-pencil-light font-bold italic text-center py-6 col-span-full">กำลังโหลดคำอวยพรทั้งหมด... 💌</p>`;
  
  let allWishes = [];
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, festivals(name), profiles(full_name, email)')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    allWishes = data || [];
  } catch (error) {
    console.warn('Error fetching all messages, using mock:', error);
    allWishes = getMockData('wishes', initialMockWishes);
  }
  
  renderWishesList(allWishes);
  setupWishesSearch(allWishes);
}

function renderWishesList(wishes) {
  const container = document.getElementById('wishes-list-container');
  if (!container) return;
  
  const term = (document.getElementById('wishes-search-input')?.value || '').toLowerCase().trim();
  let filtered = wishes;
  if (term) {
    filtered = wishes.filter(w => 
      w.message_text.toLowerCase().includes(term) || 
      (w.signature && w.signature.toLowerCase().includes(term)) ||
      (w.profiles?.full_name && w.profiles.full_name.toLowerCase().includes(term)) ||
      (w.profiles?.email && w.profiles.email.toLowerCase().includes(term)) ||
      (w.festivals?.name && w.festivals.name.toLowerCase().includes(term))
    );
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `<p class="text-pencil-light font-bold italic text-center py-6 col-span-full">ไม่พบการ์ดคำอวยพรตามคำค้นหา... 🍃</p>`;
    return;
  }
  
  container.innerHTML = filtered.map(w => {
    const writerName = w.profiles?.full_name || w.profiles?.email || 'นิรนาม';
    const sig = w.is_anonymous ? 'ส่งแบบนิรนาม' : w.signature || 'ไม่ได้ระบุ';
    const dateStr = new Date(w.created_at).toLocaleString('th-TH');
    
    let statusClass = 'btn-yellow';
    let statusText = '⏳ รออนุมัติ';
    if (w.status === 'approved') {
      statusClass = 'btn-green';
      statusText = '✅ อนุมัติแล้ว';
    } else if (w.status === 'rejected') {
      statusClass = 'btn-red';
      statusText = '❌ ปฏิเสธ/ขอแก้ไข';
    }
    
    return `
      <div class="sketch-card p-4 bg-white shadow-[2px_2px_0px_0px_#4a3c31] flex flex-col justify-between space-y-3">
        <div class="space-y-2">
          <div class="flex justify-between items-start gap-2 flex-wrap">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="sketch-badge btn-cream text-[10px] font-black">🎈 ${w.festivals?.name || 'ทั่วไป'}</span>
              <span class="sketch-badge ${statusClass} text-[10px] font-black">${statusText}</span>
            </div>
            <span class="text-[10px] text-pencil-light font-bold">${dateStr}</span>
          </div>
          <p class="text-sm font-bold italic leading-relaxed">"${w.message_text}"</p>
          <p class="text-xs text-pencil-light font-bold">✍️ ผู้เขียน: ${writerName} (ลายเซ็น: ${sig})</p>
          ${w.rejection_reason ? `
            <p class="text-[11px] font-bold text-wood-orange bg-wood-orange/10 border-2 border-pencil p-2 rounded">
              📝 บันทึกแอดมิน: ${w.rejection_reason}
            </p>
          ` : ''}
        </div>
        
        <div class="flex gap-2 justify-end border-t border-pencil-soft pt-3 mt-1">
          <button data-id="${w.id}" class="btn-wish-request-edit sketch-btn btn-cream text-xs py-1 px-3">
            ขอให้แก้ไข 📝
          </button>
          <button data-id="${w.id}" class="btn-wish-delete-reason sketch-btn btn-red text-xs py-1 px-3">
            ลบการ์ด 🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners
  container.querySelectorAll('.btn-wish-request-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      openRequestEditModal(id);
    });
  });
  
  container.querySelectorAll('.btn-wish-delete-reason').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      openDeleteReasonModal(id);
    });
  });
}

function setupWishesSearch(allWishes) {
  const searchInput = document.getElementById('wishes-search-input');
  if (!searchInput) return;
  
  searchInput.oninput = () => {
    renderWishesList(allWishes);
  };
}

function setupRequestEditModal() {
  document.getElementById('btn-close-request-edit')?.addEventListener('click', () => {
    document.getElementById('request-edit-modal').classList.add('hidden');
    document.getElementById('request-edit-target-id').value = '';
    document.getElementById('request-edit-reason-input').value = '';
  });
  
  const form = document.getElementById('request-edit-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('request-edit-target-id').value;
    const reason = document.getElementById('request-edit-reason-input').value.trim();
    if (!id || !reason) return;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังส่งคำขอ...';
    
    const supabase = await getSupabase();
    let dbSuccess = false;
    let dbError = null;
    
    if (supabase && !id.startsWith('mock')) {
      try {
        const { error } = await supabase
          .from('messages')
          .update({
            status: 'rejected',
            rejection_reason: reason
          })
          .eq('id', id);
          
        if (!error) {
          await supabase.from('activity_logs').insert({
            user_id: currentUserId,
            action: 'request_edit_message',
            details: { message_id: id, reason }
          });
          dbSuccess = true;
          showToast('ส่งคำขอขอให้ผู้เขียนแก้ไขข้อความเรียบร้อย!', 'success');
        } else {
          dbError = error;
        }
      } catch (error) {
        dbError = error;
      }
    }
    
    if (!dbSuccess) {
      console.warn('DB request edit failed, using mock:', dbError?.message);
      const wishes = getMockData('wishes', initialMockWishes);
      const wish = wishes.find(w => w.id === id);
      if (wish) {
        wish.status = 'rejected';
        wish.rejection_reason = reason;
        saveMockData('wishes', wishes);
        showToast('ส่งคำขอขอให้ผู้เขียนแก้ไขข้อความเรียบร้อย! (Mock)', 'success');
      }
    }
    
    document.getElementById('request-edit-modal').classList.add('hidden');
    document.getElementById('request-edit-target-id').value = '';
    document.getElementById('request-edit-reason-input').value = '';
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
    await loadWishesTab();
  });
}

function openRequestEditModal(id) {
  document.getElementById('request-edit-target-id').value = id;
  document.getElementById('request-edit-modal').classList.remove('hidden');
}

function setupDeleteReasonModal() {
  document.getElementById('btn-close-delete-reason')?.addEventListener('click', () => {
    document.getElementById('delete-reason-modal').classList.add('hidden');
    document.getElementById('delete-reason-target-id').value = '';
    document.getElementById('delete-reason-input').value = '';
  });
  
  const form = document.getElementById('delete-reason-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('delete-reason-target-id').value;
    const reason = document.getElementById('delete-reason-input').value.trim();
    if (!id || !reason) return;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังลบการ์ด...';
    
    const supabase = await getSupabase();
    let dbSuccess = false;
    let dbError = null;
    
    if (supabase && !id.startsWith('mock')) {
      try {
        const { data: msgObj } = await supabase
          .from('messages')
          .select('contributor_id, message_text')
          .eq('id', id)
          .single();
          
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', id);
          
        if (!error) {
          if (msgObj?.contributor_id) {
            await supabase
              .from('notifications')
              .insert({
                user_id: msgObj.contributor_id,
                title: '🗑️ การ์ดคำอวยพรของคุณถูกลบโดยแอดมิน',
                content: `ข้อความของคุณ: "${msgObj.message_text.substring(0, 30)}..." ถูกลบเนื่องจาก: ${reason}`,
                type: 'rejection'
              });
          }
          
          await supabase.from('activity_logs').insert({
            user_id: currentUserId,
            action: 'delete_message_by_admin',
            details: { message_id: id, reason }
          });
          dbSuccess = true;
          showToast('ลบการ์ดคำอวยพรและแจ้งเตือนเหตุผลเรียบร้อยแล้ว!', 'success');
        } else {
          dbError = error;
        }
      } catch (error) {
        dbError = error;
      }
    }
    
    if (!dbSuccess) {
      console.warn('DB delete with reason failed, using mock:', dbError?.message);
      const wishes = getMockData('wishes', initialMockWishes);
      const wishIndex = wishes.findIndex(w => w.id === id);
      if (wishIndex !== -1) {
        const wishObj = wishes[wishIndex];
        wishes.splice(wishIndex, 1);
        saveMockData('wishes', wishes);
        
        const notifications = getMockData('notifications', initialMockNotifications);
        notifications.unshift({
          id: `notif-mock-${Date.now()}`,
          created_at: new Date().toISOString(),
          title: '🗑️ การ์ดคำอวยพรของคุณถูกลบโดยแอดมิน',
          content: `ข้อความของคุณ: "${wishObj.message_text.substring(0, 30)}..." ถูกลบเนื่องจาก: ${reason}`
        });
        saveMockData('notifications', notifications);
        
        showToast('ลบการ์ดคำอวยพรและแจ้งเตือนเหตุผลเรียบร้อยแล้ว! (Mock)', 'success');
      }
    }
    
    document.getElementById('delete-reason-modal').classList.add('hidden');
    document.getElementById('delete-reason-target-id').value = '';
    document.getElementById('delete-reason-input').value = '';
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
    await loadWishesTab();
  });
}

function openDeleteReasonModal(id) {
  document.getElementById('delete-reason-target-id').value = id;
  document.getElementById('delete-reason-modal').classList.remove('hidden');
}

export const cleanup = () => {
  console.log('Cleaning up admin realtime subscriptions...');
  if (profilesSubscription) {
    profilesSubscription.unsubscribe();
    profilesSubscription = null;
  }
  if (messagesSubscription) {
    messagesSubscription.unsubscribe();
    messagesSubscription = null;
  }
  if (revisionsSubscription) {
    revisionsSubscription.unsubscribe();
    revisionsSubscription = null;
  }
  if (reportsSubscription) {
    reportsSubscription.unsubscribe();
    reportsSubscription = null;
  }
  if (festivalsSubscription) {
    festivalsSubscription.unsubscribe();
    festivalsSubscription = null;
  }
  if (notificationsSubscription) {
    notificationsSubscription.unsubscribe();
    notificationsSubscription = null;
  }
  if (suggestionsSubscription) {
    suggestionsSubscription.unsubscribe();
    suggestionsSubscription = null;
  }
};
