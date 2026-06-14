// MyFestival - Suggest Festival Controller
import { getSupabase } from './supabase.js';
import { getCurrentUser, getUserProfile } from './auth.js';
import { showToast, navigate } from './router.js';

let suggestImageBase64 = null;
let userProfile = null;
let userSession = null;

// Initialize Suggest Page
export const init = async () => {
  const supabase = await getSupabase();
  if (!supabase) return;
  
  userSession = await getCurrentUser();
  if (!userSession) {
    showToast('กรุณาสมัครบัญชี หรือเข้าสู่ระบบก่อนจึงจะเสนอเทศกาลได้', 'warning');
    navigate('/login');
    return;
  }
  
  userProfile = await getUserProfile(userSession.id);
  const role = userProfile?.role || 'member';
  
  // Set up inputs and role checks
  setupFormControls(role);
  setupDatePickers();
  setupImageHandler();
  setupFormSubmit(supabase, role);
};

// Handle role-based UI constraints
function setupFormControls(role) {
  const wishContainer = document.getElementById('suggest-wish-container');
  const wishInput = document.getElementById('suggest-wish-input');
  const sigInput = document.getElementById('suggest-sig-input');
  const anonCheckbox = document.getElementById('suggest-anonymous-checkbox');
  
  // Hide first wish input for standard Members, show for Contributors/Admins
  if (role === 'member') {
    if (wishContainer) wishContainer.classList.add('hidden');
    if (wishInput) {
      wishInput.required = false;
      wishInput.value = '';
    }
  } else {
    if (wishContainer) wishContainer.classList.remove('hidden');
    if (wishInput) wishInput.required = true;
  }
  
  // Prefill signature with user's profile name
  if (sigInput && userProfile) {
    sigInput.readOnly = true;
    sigInput.classList.add('bg-pencil-soft/20', 'cursor-not-allowed');
    if (anonCheckbox && anonCheckbox.checked) {
      sigInput.value = 'ผู้ไม่ประสงค์ออกนาม';
    } else {
      sigInput.value = userProfile.full_name || 'ผู้เขียน';
    }
  }
  
  // Signature toggle checkbox change
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
}

// Setup Flatpickr for Date Inputs
function setupDatePickers() {
  if (window.flatpickr) {
    window.flatpickr('#suggest-start-date', {
      enableTime: false,
      dateFormat: 'Y-m-d',
      locale: 'th',
      defaultDate: new Date()
    });
    
    window.flatpickr('#suggest-end-date', {
      enableTime: false,
      dateFormat: 'Y-m-d',
      locale: 'th',
      defaultDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
  }
}

// Setup image compression and preview
function setupImageHandler() {
  const fileInput = document.getElementById('suggest-image-input');
  const fileLabelText = document.getElementById('suggest-file-label-text');
  const previewContainer = document.getElementById('suggest-image-preview-container');
  const previewImg = document.getElementById('suggest-image-preview');
  const btnRemoveImage = document.getElementById('btn-remove-suggest-image');
  
  const clearSuggestImage = () => {
    suggestImageBase64 = null;
    if (fileInput) fileInput.value = '';
    if (previewContainer) previewContainer.classList.add('hidden');
    if (previewImg) previewImg.src = '';
    if (fileLabelText) fileLabelText.textContent = 'คลิกเพื่อเลือกภาพประกอบ...';
  };
  
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (fileLabelText) fileLabelText.textContent = `📂 ${file.name}`;
    
    try {
      showToast('กำลังประมวลผลและบีบอัดรูปภาพ...', 'info');
      const base64 = await resizeImage(file);
      suggestImageBase64 = base64;
      
      if (previewImg && previewContainer) {
        previewImg.src = base64;
        previewContainer.classList.remove('hidden');
      }
    } catch (err) {
      console.error(err);
      showToast('เกิดข้อผิดพลาดในการโหลดรูปภาพ: ' + err.message, 'error');
      clearSuggestImage();
    }
  });
  
  btnRemoveImage?.addEventListener('click', () => {
    clearSuggestImage();
  });
}

// Resize/Compress uploaded image
function resizeImage(file) {
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

// Handle Form Submission
function setupFormSubmit(supabase, role) {
  const form = document.getElementById('suggest-festival-form');
  const sigInput = document.getElementById('suggest-sig-input');
  const anonCheckbox = document.getElementById('suggest-anonymous-checkbox');
  
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('suggest-name-input').value.trim();
    let desc = document.getElementById('suggest-desc-input').value.trim();
    const isAnnual = document.getElementById('suggest-annual-checkbox')?.checked || false;
    if (isAnnual) {
      desc = `[ประจำปี] ${desc}`;
    }
    let wish = document.getElementById('suggest-wish-input')?.value.trim();
    
    // Assign fallback wish value for members
    if (role === 'member' || !wish) {
      wish = 'เสนอโดยสมาชิก (ไม่มีคำอวยพรเริ่มต้น)';
    }
    
    const sig = sigInput?.value.trim() || '';
    const anonymous = anonCheckbox?.checked || false;
    const startDateVal = document.getElementById('suggest-start-date').value;
    const endDateVal = document.getElementById('suggest-end-date').value;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังส่งข้อมูล... ⏳';
    
    try {
      const { error } = await supabase
        .from('festival_suggestions')
        .insert({
          name: name,
          description: desc,
          suggested_wish: wish,
          signature: sig || null,
          is_anonymous: anonymous,
          suggested_by: userSession.id,
          image_url: suggestImageBase64,
          start_date: startDateVal ? new Date(startDateVal).toISOString() : null,
          end_date: endDateVal ? new Date(endDateVal).toISOString() : null,
          status: 'pending'
        });
        
      if (error) throw error;
      
      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: userSession.id,
        action: 'suggest_festival',
        details: { name: name }
      });
      
      showToast('เสนอชื่อเทศกาลใหม่สำเร็จแล้ว! โปรดรอผู้ดูแลระบบพิจารณา 🎡', 'success');
      
      // Reset form and cache
      form.reset();
      suggestImageBase64 = null;
      
      // Navigate back to home
      setTimeout(() => {
        navigate('/');
      }, 1500);
      
    } catch (error) {
      console.error('Error suggesting festival:', error);
      showToast('ไม่สามารถส่งข้อเสนอแนะได้: ' + error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });
}
