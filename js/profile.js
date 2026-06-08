// MyFestival - Profile Controller
import { getSupabase } from './supabase.js';
import { getCurrentUser, getUserProfile } from './auth.js';
import { showToast, navigate, refreshAuthUI } from './router.js';

let currentUserId = null;
let userProfile = null;
let notificationSubscription = null;

// Initialize Profile View
export const init = async () => {
  const user = await getCurrentUser();
  if (!user) {
    navigate('/login');
    return;
  }
  
  currentUserId = user.id;
  await loadProfileData(user);
  setupAvatarPreview();
  setupFormSubmit();
  await loadNotifications();
  setupNotificationEvents();
  subscribeNotifications();
};

// Fetch and load profile data into form elements
async function loadProfileData(user) {
  try {
    userProfile = await getUserProfile(user.id);
    if (!userProfile) throw new Error('ไม่พบข้อมูลโปรไฟล์ผู้ใช้');
    
    // Fill values
    document.getElementById('profile-email').value = user.email;
    document.getElementById('profile-name').value = userProfile.full_name || '';
    
    // Check if there is an existing pending name warning element, remove it first
    const existingNotice = document.getElementById('pending-name-notice');
    if (existingNotice) existingNotice.remove();
    
    if (userProfile.pending_name) {
      const nameNotice = document.createElement('p');
      nameNotice.id = 'pending-name-notice';
      nameNotice.className = 'text-xs text-wood-orange font-bold mt-1';
      nameNotice.innerHTML = `⏳ ชื่อใหม่ที่รอดำเนินการอนุมัติ: <span class="underline">${userProfile.pending_name}</span>`;
      document.getElementById('profile-name').parentNode.appendChild(nameNotice);
    }
    
    const avatarInput = document.getElementById('profile-avatar-url');
    avatarInput.value = userProfile.avatar_url || '';
    
    const roleBadge = document.getElementById('profile-role-badge');
    roleBadge.textContent = getRoleThai(userProfile.role);
    
    // Set dynamic badge colors
    roleBadge.classList.remove('btn-yellow', 'btn-orange', 'btn-cream');
    if (userProfile.role === 'admin') {
      roleBadge.classList.add('btn-yellow');
    } else if (userProfile.role === 'contributor') {
      roleBadge.classList.add('btn-orange');
    } else {
      roleBadge.classList.add('btn-cream');
    }
    
    // Set avatar preview
    const preview = document.getElementById('profile-avatar-preview');
    preview.src = userProfile.avatar_url || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${user.email}`;
    
    // Setup role radios
    const roleContainer = document.getElementById('profile-role-container');
    const adminNotice = document.getElementById('admin-notice');
    const roleSection = document.getElementById('profile-role-section');
    
    if (user.email === '6nathan.dev@gmail.com') {
      if (roleSection) roleSection.classList.remove('hidden');
      
      // Admin Mode: allow switching between all 3 roles for developer view simulation
      roleContainer.className = "grid grid-cols-1 sm:grid-cols-3 gap-3";
      
      let adminRadio = roleContainer.querySelector('input[value="admin"]');
      if (!adminRadio) {
        const adminLabel = document.createElement('label');
        adminLabel.className = "flex items-center gap-2 p-3 border-2 border-pencil rounded-lg cursor-pointer bg-wood-red/10 hover:bg-wood-red/20";
        adminLabel.innerHTML = `
          <input type="radio" name="profile-role" value="admin" class="accent-pencil">
          <div class="text-sm font-bold">
            <div>Admin (ผู้ดูแลระบบ)</div>
            <span class="text-xs text-pencil-light font-normal">คุมระบบทั้งหมด คลุมทุกมุมมอง</span>
          </div>
        `;
        roleContainer.appendChild(adminLabel);
      }
      
      const radios = roleContainer.querySelectorAll('input[name="profile-role"]');
      radios.forEach(radio => {
        radio.disabled = false;
        if (radio.value === userProfile.role) {
          radio.checked = true;
        }
      });
      
      adminNotice.innerHTML = "✨ <b>โหมดผู้พัฒนา:</b> คุณสามารถสลับบทบาทของคุณเป็นบทบาทใดก็ได้เพื่อทดลองเข้าดูมุมมองและการใช้งานของแต่ละ Role ได้ทันที";
      adminNotice.className = "text-xs text-wood-green font-black mt-1";
      adminNotice.classList.remove('hidden');
      
    } else {
      // Hide role section entirely for standard members/contributors
      if (roleSection) roleSection.classList.add('hidden');
      adminNotice.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    showToast(error.message, 'error');
  }
}

// Live-reload preview on Avatar URL change
function setupAvatarPreview() {
  const avatarInput = document.getElementById('profile-avatar-url');
  const preview = document.getElementById('profile-avatar-preview');
  
  avatarInput?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val) {
      preview.src = val;
    } else {
      const email = document.getElementById('profile-email').value;
      preview.src = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${email}`;
    }
  });
}

// Handle Profile Updates Form Submission
function setupFormSubmit() {
  const form = document.getElementById('profile-form');
  
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supabase = await getSupabase();
    if (!supabase) return;
    
    const name = document.getElementById('profile-name').value.trim();
    const avatarUrl = document.getElementById('profile-avatar-url').value.trim();
    
    let chosenRole = userProfile.role; // Default stay same
    
    const email = document.getElementById('profile-email').value;
    if (email === '6nathan.dev@gmail.com') {
      const activeRadio = form.querySelector('input[name="profile-role"]:checked');
      if (activeRadio) {
        chosenRole = activeRadio.value;
      }
      localStorage.setItem('myfestival_admin_name_override', name);
      localStorage.setItem('myfestival_admin_avatar_override', avatarUrl);
      localStorage.setItem('myfestival_admin_role_override', chosenRole);
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังบันทึกข้อมูล... 💾';
    
    try {
      const nameChanged = name !== (userProfile.full_name || '');
      const isAdmin = userProfile.role === 'admin' || email === '6nathan.dev@gmail.com';
      
      const updateData = {
        avatar_url: avatarUrl
      };
      
      if (isAdmin) {
        updateData.full_name = name;
        updateData.pending_name = null;
        updateData.role = chosenRole;
      } else {
        if (nameChanged) {
          updateData.pending_name = name;
        }
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', currentUserId);
        
      if (error) throw error;

      // Send name change request notification to admin
      if (nameChanged && !isAdmin) {
        try {
          await supabase.from('notifications').insert({
            user_id: null,
            title: '📝 คำร้องขอเปลี่ยนชื่อสมาชิก',
            content: `ผู้ใช้งาน ${email} ขอเปลี่ยนชื่อจาก "${userProfile.full_name || 'ไม่ได้ระบุ'}" เป็น "${name}"`,
            type: 'system'
          });
          showToast('ส่งคำร้องขอเปลี่ยนชื่อไปยังผู้ดูแลระบบเรียบร้อยแล้ว!', 'info');
        } catch (err) {
          console.warn('Could not send name change request notification:', err);
        }
      }
      
      // Log profile change activity (skip errors if table doesn't exist for dev email)
      try {
        await supabase.from('activity_logs').insert({
          user_id: currentUserId,
          action: 'update_profile',
          details: { role: chosenRole }
        });
      } catch (logErr) {
        console.warn('Activity log insert skipped:', logErr);
      }
      
      showToast('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว!', 'success');
      
      // Refresh auth navbar details
      await refreshAuthUI();
      
      // Re-initialize view
      setTimeout(() => init(), 500);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('ไม่สามารถอัปเดตข้อมูลได้: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });
}

// Thai Translation Helper for Roles
function getRoleThai(role) {
  switch (role) {
    case 'admin': return '🔑 ผู้ดูแลระบบ (Admin)';
    case 'contributor': return '✍️ ผู้เขียนคำอวยพร (Contributor)';
    default: return '👤 สมาชิกทั่วไป (Member)';
  }
}

async function loadNotifications() {
  const listContainer = document.getElementById('profile-notifications-list');
  if (!listContainer) return;
  
  const supabase = await getSupabase();
  if (!supabase) return;
  
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(30);
      
    if (error) throw error;
    
    // Auto mark all retrieved notifications as read to reset badge
    const unreadIds = (notifications || []).filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);
        
      // Update badge count in navbar
      await refreshAuthUI();
    }
    
    if (!notifications || notifications.length === 0) {
      listContainer.innerHTML = `
        <p class="text-pencil-light font-bold italic text-center py-6">ไม่มีการแจ้งเตือนในขณะนี้... 🕊️</p>
      `;
      return;
    }
    
    listContainer.innerHTML = notifications.map(notif => {
      const dateStr = new Date(notif.created_at).toLocaleString('th-TH');
      
      let typeBadge = '';
      if (notif.type === 'approval') {
        typeBadge = '<span class="sketch-badge btn-green text-[9px] font-black uppercase">อนุมัติ</span>';
      } else if (notif.type === 'rejection') {
        typeBadge = '<span class="sketch-badge btn-red text-[9px] font-black uppercase">ปฏิเสธ</span>';
      } else {
        typeBadge = '<span class="sketch-badge btn-cream text-[9px] font-black uppercase">ระบบ</span>';
      }
      
      const readClass = notif.is_read ? 'opacity-75' : 'bg-wood-yellow/10 border-l-4 border-l-wood-yellow pl-3';
      
      return `
        <div class="sketch-card p-3 bg-white text-xs ${readClass} shadow-[1.5px_1.5px_0px_0px_#4a3c31] space-y-1">
          <div class="flex justify-between items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1.5">
              ${typeBadge}
              <span class="font-extrabold text-pencil">${notif.title}</span>
            </div>
            <span class="text-[10px] text-pencil-light font-bold">${dateStr}</span>
          </div>
          <p class="font-bold text-pencil-light leading-relaxed">
            ${notif.content}
          </p>
        </div>
      `;
    }).join('');
    
  } catch (err) {
    console.error('Error loading notifications:', err);
    listContainer.innerHTML = `<p class="text-wood-red font-bold text-center py-6 text-sm">ไม่สามารถโหลดการแจ้งเตือนได้: ${err.message}</p>`;
  }
}

function setupNotificationEvents() {
  const btnClear = document.getElementById('btn-clear-notifications');
  btnClear?.addEventListener('click', async () => {
    const supabase = await getSupabase();
    if (!supabase) return;
    
    const btnText = btnClear.textContent;
    btnClear.disabled = true;
    btnClear.textContent = 'กำลังล้าง... ⏳';
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUserId)
        .eq('is_read', false);
        
      if (error) throw error;
      
      showToast('ล้างการแจ้งเตือนทั้งหมดเป็นอ่านแล้วสำเร็จ!', 'success');
      await refreshAuthUI();
      await loadNotifications();
    } catch (err) {
      console.error('Error clearing notifications:', err);
      showToast('ไม่สามารถล้างการแจ้งเตือนได้: ' + err.message, 'error');
    } finally {
      btnClear.disabled = false;
      btnClear.textContent = btnText;
    }
  });
}

async function subscribeNotifications() {
  if (notificationSubscription) {
    notificationSubscription.unsubscribe();
    notificationSubscription = null;
  }

  const supabase = await getSupabase();
  if (!supabase || !currentUserId) return;

  notificationSubscription = supabase
    .channel('public:notifications')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${currentUserId}`
    }, async (payload) => {
      console.log('Realtime notification change detected:', payload);
      await loadNotifications();
    })
    .subscribe();
}

export const cleanup = () => {
  if (notificationSubscription) {
    notificationSubscription.unsubscribe();
    notificationSubscription = null;
  }
  console.log('Cleaning up profile controller...');
};
