// MyFestival - Profile Controller
import { getSupabase } from './supabase.js';
import { getCurrentUser, getUserProfile } from './auth.js';
import { showToast, navigate, refreshAuthUI } from './router.js';

let currentUserId = null;
let userProfile = null;

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
};

// Fetch and load profile data into form elements
async function loadProfileData(user) {
  try {
    userProfile = await getUserProfile(user.id);
    if (!userProfile) throw new Error('ไม่พบข้อมูลโปรไฟล์ผู้ใช้');
    
    // Fill values
    document.getElementById('profile-email').value = user.email;
    document.getElementById('profile-name').value = userProfile.full_name || '';
    
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
      roleContainer.className = "grid grid-cols-3 gap-3";
      
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
      const updateData = {
        full_name: name,
        avatar_url: avatarUrl,
        role: chosenRole
      };
      
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', currentUserId);
        
      if (error) throw error;

      // Send name change request notification to admin
      const nameChanged = name !== (userProfile.full_name || '');
      if (nameChanged && email !== '6nathan.dev@gmail.com') {
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
