// MyFestival - Card Downloader Controller
import { getSupabase } from './supabase.js';
import { navigate, showToast } from './router.js';
import { getCurrentUser } from './auth.js';

let currentFestivalId = null;
let currentWishId = null;
let currentUser = null;
let customColors = [];
let editingColorIndex = null;

// Custom color coordinates slot layout mapped to the wooden palette curve (lower half)
const customColorSlots = [
  { left: '81%', top: '63%' }, // Custom 1
  { left: '72%', top: '76%' }, // Custom 2
  { left: '58%', top: '82%' }, // Custom 3
  { left: '44%', top: '81%' }, // Custom 4
  { left: '30%', top: '54%' }  // Custom 5 (above the bottom-left thumb hole)
];

// Plus (+) button position shifts dynamically depending on custom color count
const getPlusButtonPosition = () => {
  const count = customColors.length;
  if (count < customColorSlots.length) {
    return customColorSlots[count];
  }
  return { left: '30%', top: '54%' }; // fallback
};

// Initialize Card Downloader Page
export const init = async () => {
  const urlParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
  const wishId = urlParams.get('wishId');
  
  if (!wishId) {
    showToast('กรุณาระบุรหัสการ์ดอวยพร ❌', 'error');
    setTimeout(() => navigate('/'), 1500);
    return;
  }
  
  currentWishId = wishId;
  
  // Set up interactive customizer events immediately so UI is responsive
  setupCustomizerEvents();

  // Try rendering synchronously from cache before making the API request
  tryRenderFromCache(wishId);

  // Load database details asynchronously in the background
  getSupabase().then(async (supabase) => {
    if (!supabase) {
      console.warn('Supabase not configured, cannot load wish or database colors.');
      return;
    }
    
    // Fetch wish details immediately (no need to wait for user session)
    fetchAndRenderWish(supabase, wishId);
    
    // Fetch user and load colors in background
    getCurrentUser().then((user) => {
      currentUser = user;
      loadCustomColors(supabase);
    }).catch((err) => {
      console.warn('Error loading current user details, proceeding as guest:', err);
      currentUser = null;
      loadCustomColors(supabase);
    });
  }).catch((err) => {
    console.error('Error during background initialization of Supabase details:', err);
  });
};

function tryRenderFromCache(wishId) {
  // 1. Check sessionStorage
  const activeWishStr = sessionStorage.getItem('active_wish_download');
  if (activeWishStr) {
    try {
      const wish = JSON.parse(activeWishStr);
      if (wish && (wish.id === wishId || String(wish.id) === String(wishId))) {
        renderWishData(wish);
        return;
      }
    } catch (e) {
      console.warn('Error parsing active_wish_download:', e);
    }
  }

  // 2. Check myfestival_mock_wishes
  const mockWishesStr = localStorage.getItem('myfestival_mock_wishes');
  if (mockWishesStr) {
    try {
      const wishes = JSON.parse(mockWishesStr);
      const wish = wishes.find(w => w.id === wishId || String(w.id) === String(wishId));
      if (wish) {
        renderWishData(wish);
        return;
      }
    } catch (e) {
      console.warn('Error parsing mock wishes:', e);
    }
  }

  // 3. Check myfestival_admin_saved_messages
  const savedWishesStr = localStorage.getItem('myfestival_admin_saved_messages');
  if (savedWishesStr) {
    try {
      const wishes = JSON.parse(savedWishesStr);
      const wish = wishes.find(w => w.id === wishId || String(w.id) === String(wishId));
      if (wish) {
        renderWishData(wish);
        return;
      }
    } catch (e) {
      console.warn('Error parsing saved messages:', e);
    }
  }
}

function renderWishData(data) {
  const cardText = document.getElementById('card-text');
  const cardFestival = document.getElementById('card-festival-name');
  const cardSignature = document.getElementById('card-signature');
  
  currentFestivalId = data.festival_id || data.festivals?.id || null;
  
  if (cardText) cardText.textContent = data.message_text;
  if (cardFestival) {
    cardFestival.textContent = `🏷️ ${data.festivals?.name || data.festival_name || 'เทศกาล'}`;
  }
  if (cardSignature) {
    cardSignature.textContent = data.is_anonymous ? '✍️ ผู้ไม่ประสงค์ออกนาม' : `✍️ ${data.signature || 'ผู้เขียนคำอวยพร'}`;
  }
}

async function fetchAndRenderWish(supabase, wishId) {
  const cardText = document.getElementById('card-text');
  const cardFestival = document.getElementById('card-festival-name');
  const cardSignature = document.getElementById('card-signature');
  
  if (String(wishId).startsWith('mock')) {
    console.log('Mock wish detected, skipping Supabase query');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, festivals(id, name)')
      .eq('id', wishId)
      .single();
      
    if (error) throw error;
    
    currentFestivalId = data.festivals?.id || null;
    
    // Render text
    if (cardText) cardText.textContent = data.message_text;
    if (cardFestival) cardFestival.textContent = `🏷️ ${data.festivals?.name || 'เทศกาล'}`;
    if (cardSignature) {
      cardSignature.textContent = data.is_anonymous ? '✍️ ผู้ไม่ประสงค์ออกนาม' : `✍️ ${data.signature || 'ผู้เขียนคำอวยพร'}`;
    }
  } catch (error) {
    console.error('Error loading wish details:', error);
    // Only overwrite if it is still displaying the loading state
    if (cardText && cardText.textContent.includes('กำลังดึงข้อมูล')) {
      cardText.textContent = 'ไม่สามารถดึงข้อมูลคำอวยพรได้ หรืออาจถูกแอดมินลบออกแล้ว 🍂';
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลคำอวยพร: ' + error.message, 'error');
    }
  }
}

async function loadCustomColors(supabase) {
  const plusBtn = document.getElementById('btn-open-color-picker');
  
  // Show plus button for everyone (both logged in and guest users)
  if (plusBtn) plusBtn.classList.remove('hidden');

  if (currentUser) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('custom_colors')
        .eq('id', currentUser.id)
        .single();
      
      if (error) throw error;
      
      if (data && data.custom_colors) {
        customColors = data.custom_colors.split(',').map(c => c.trim()).filter(Boolean);
      } else {
        // If table query is OK but data is null, fallback to localstorage
        const localColors = localStorage.getItem(`myfestival_custom_colors_${currentUser.id}`);
        customColors = localColors ? localColors.split(',').map(c => c.trim()).filter(Boolean) : [];
      }
    } catch (err) {
      console.warn('Could not load custom colors from profiles database table, using LocalStorage fallback:', err);
      const localColors = localStorage.getItem(`myfestival_custom_colors_${currentUser.id}`);
      customColors = localColors ? localColors.split(',').map(c => c.trim()).filter(Boolean) : [];
    }
  } else {
    // Guest user fallback to LocalStorage
    const guestColors = localStorage.getItem('myfestival_custom_colors_guest');
    customColors = guestColors ? guestColors.split(',').map(c => c.trim()).filter(Boolean) : [];
  }
  renderCustomColors();
}

function selectColor(color) {
  // Update card background color
  const cardArea = document.getElementById('capture-card-area');
  if (cardArea) {
    cardArea.style.backgroundColor = color;
  }

  // Update brush tip paint color
  const brushTip = document.getElementById('brush-tip-paint');
  if (brushTip) {
    brushTip.style.fill = color;
  }

  // Update center preview bubble color
  const centerPreviewInner = document.getElementById('palette-center-preview-inner');
  if (centerPreviewInner) {
    centerPreviewInner.style.backgroundColor = color;
  }
}

function renderCustomColors() {
  const list = document.getElementById('user-colors-list');
  if (!list) return;

  list.innerHTML = customColors.map((color, index) => {
    const slot = customColorSlots[index] || { left: '0px', top: '0px' };
    return `
      <div class="absolute group" style="left: ${slot.left}; top: ${slot.top}; transform: translate(-50%, -50%);">
        <button type="button" class="color-swatch custom-swatch w-8 h-8 rounded-full border-2 border-pencil focus:scale-110 shadow-[1.5px_1.5px_0px_var(--color-pencil)] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all" 
                style="background-color: ${color};" data-color="${color}"></button>
        <button type="button" class="btn-edit-color absolute -top-1 -left-1 bg-wood-yellow border border-pencil text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-[1px_1px_0px_0px_#4a3c31] hover:scale-110 active:scale-95 transition-all" data-index="${index}" title="แก้ไขสี">✎</button>
        <button type="button" class="btn-delete-color absolute -top-1 -right-1 bg-wood-red border border-pencil text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-[1px_1px_0px_0px_#4a3c31] hover:scale-110 active:scale-95 transition-all" data-index="${index}" title="ลบสี">×</button>
      </div>
    `;
  }).join('');

  // Position and display plus button dynamically
  const plusBtn = document.getElementById('btn-open-color-picker');
  if (plusBtn) {
    if (customColors.length >= 5) {
      plusBtn.classList.add('hidden');
    } else {
      plusBtn.classList.remove('hidden');
      const slot = getPlusButtonPosition();
      plusBtn.style.left = slot.left;
      plusBtn.style.top = slot.top;
      plusBtn.style.transform = 'translate(-50%, -50%)';
    }
  }

  // Setup click triggers on all color swatches (preset & custom)
  const swatches = document.querySelectorAll('.color-swatch');
  
  document.querySelectorAll('.custom-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('scale-110', 'ring-4', 'ring-pencil/30'));
      swatch.classList.add('scale-110', 'ring-4', 'ring-pencil/30');
      const color = swatch.getAttribute('data-color');
      selectColor(color);
    });
  });

  // Attach edit triggers
  list.querySelectorAll('.btn-edit-color').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-index'));
      if (isNaN(index)) return;

      editingColorIndex = index;
      const color = customColors[index];

      // Populate color modal fields
      const colorPicker = document.getElementById('user-color-picker');
      const colorHex = document.getElementById('user-color-hex');
      const modalTitle = document.getElementById('color-modal-title');
      const submitBtn = document.getElementById('btn-submit-color');

      if (colorPicker) colorPicker.value = color;
      if (colorHex) colorHex.value = color.toUpperCase();
      if (modalTitle) modalTitle.textContent = '🎨 แก้ไขสีกระดาษ';
      if (submitBtn) submitBtn.textContent = 'บันทึกการแก้ไข 💾';

      // Open modal
      document.getElementById('add-color-modal')?.classList.remove('hidden');
    });
  });

  // Attach delete triggers
  list.querySelectorAll('.btn-delete-color').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-index'));
      if (isNaN(index)) return;

      customColors.splice(index, 1);
      await saveCustomColorsToDB();
    });
  });
}

async function saveCustomColorsToDB() {
  const colorStr = customColors.join(',');

  if (currentUser) {
    // Sync to Supabase in the background (no await!)
    getSupabase().then(supabase => {
      if (supabase) {
        supabase
          .from('profiles')
          .update({ custom_colors: colorStr })
          .eq('id', currentUser.id)
          .then(({ error }) => {
            if (error) console.warn('Error syncing custom colors to profile:', error);
          });
      }
    }).catch(err => {
      console.warn('Error getting Supabase instance for background sync:', err);
    });
    localStorage.setItem(`myfestival_custom_colors_${currentUser.id}`, colorStr);
  } else {
    localStorage.setItem('myfestival_custom_colors_guest', colorStr);
  }
  renderCustomColors();
}

async function handleAddCustomColor(e) {
  e.preventDefault();

  const hexInput = document.getElementById('user-color-hex');
  const color = hexInput?.value.trim();

  if (!/^#[0-9A-F]{6}$/i.test(color)) {
    showToast('รหัสสีไม่ถูกต้อง รูปแบบต้องระบุเป็น #RRGGBB 🎨', 'error');
    return;
  }

  const cleanColor = color.toLowerCase();

  if (editingColorIndex !== null) {
    // Editing existing custom color
    customColors[editingColorIndex] = cleanColor;
    saveCustomColorsToDB();

    selectColor(cleanColor);
    showToast('แก้ไขสีกระดาษเรียบร้อย! ✨', 'success');
    closeColorModal();

    // Highlight the modified color swatch
    const modifiedIndex = editingColorIndex;
    editingColorIndex = null;
    
    setTimeout(() => {
      const swatches = document.querySelectorAll('.color-swatch');
      swatches.forEach(s => s.classList.remove('scale-110', 'ring-4', 'ring-pencil/30'));
      const customSwatches = document.querySelectorAll('.custom-swatch');
      if (customSwatches[modifiedIndex]) {
        customSwatches[modifiedIndex].classList.add('scale-110', 'ring-4', 'ring-pencil/30');
      }
    }, 50);

  } else {
    // Adding new custom color
    if (customColors.length >= 5) {
      showToast('บันทึกสีกำหนดเองได้สูงสุด 5 สีเท่านั้นครับ 🎨', 'warning');
      return;
    }

    customColors.push(cleanColor);
    saveCustomColorsToDB(); // Instant update to localStorage and rendering

    selectColor(cleanColor);
    showToast('บันทึกสีกำหนดเองเรียบร้อย! ✨', 'success');
    closeColorModal();

    // Highlight the newly added color swatch
    setTimeout(() => {
      const swatches = document.querySelectorAll('.color-swatch');
      swatches.forEach(s => s.classList.remove('scale-110', 'ring-4', 'ring-pencil/30'));
      const newSwatch = Array.from(swatches).find(s => s.getAttribute('data-color') === cleanColor);
      if (newSwatch) {
        newSwatch.classList.add('scale-110', 'ring-4', 'ring-pencil/30');
      }
    }, 50);
  }
}

function closeColorModal() {
  document.getElementById('add-color-modal')?.classList.add('hidden');
}

function setupCustomizerEvents() {
  const cardArea = document.getElementById('capture-card-area');
  const patternOverlay = document.getElementById('paper-pattern-overlay');
  
  // Show plus button immediately so users can add custom colors without delay
  const plusBtn = document.getElementById('btn-open-color-picker');
  if (plusBtn) plusBtn.classList.remove('hidden');
  
  // 1. Preset Color Swatches click events
  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('scale-110', 'ring-4', 'ring-pencil/30'));
      swatch.classList.add('scale-110', 'ring-4', 'ring-pencil/30');
      
      const color = swatch.getAttribute('data-color');
      selectColor(color);
    });
  });
  
  if (swatches.length > 0) swatches[0].click();

  // 1.5 Custom Colors UI & Modal Trigger setup
  const colorModal = document.getElementById('add-color-modal');
  const colorPicker = document.getElementById('user-color-picker');
  const colorHex = document.getElementById('user-color-hex');
  const openModalBtn = document.getElementById('btn-open-color-picker');
  const closeModalX = document.getElementById('btn-close-color-modal-x');
  const closeModalBtn = document.getElementById('btn-close-color-modal');
  const addColorForm = document.getElementById('add-color-form');

  // Trigger modal open
  openModalBtn?.addEventListener('click', () => {
    editingColorIndex = null;
    const modalTitle = document.getElementById('color-modal-title');
    const submitBtn = document.getElementById('btn-submit-color');

    if (modalTitle) modalTitle.textContent = '🎨 ผสมสีกระดาษใหม่';
    if (submitBtn) submitBtn.textContent = 'บันทึกสีนี้ 💾';

    if (colorHex && colorPicker) {
      colorPicker.value = '#FFFFFF';
      colorHex.value = '#FFFFFF';
    }
    colorModal?.classList.remove('hidden');
  });

  // Modal closing events
  closeModalX?.addEventListener('click', closeColorModal);
  closeModalBtn?.addEventListener('click', closeColorModal);

  // Sync Color picker input and Hex text input
  colorPicker?.addEventListener('input', (e) => {
    if (colorHex) colorHex.value = e.target.value.toUpperCase();
  });
  
  colorHex?.addEventListener('input', (e) => {
    let val = e.target.value.trim();
    if (val && !val.startsWith('#')) {
      val = '#' + val;
      colorHex.value = val;
    }
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      if (colorPicker) colorPicker.value = val;
    }
  });

  // Add Custom Color Submission
  addColorForm?.addEventListener('submit', handleAddCustomColor);

  // 2. Pattern Selectors
  const patternBtns = document.querySelectorAll('.pattern-btn');
  patternBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      patternBtns.forEach(b => {
        b.classList.remove('btn-yellow');
        b.classList.add('btn-cream');
      });
      btn.classList.add('btn-yellow');
      btn.classList.remove('btn-cream');
      
      const pattern = btn.getAttribute('data-pattern');
      const spiralRings = document.getElementById('paper-spiral-rings');
      
      if (patternOverlay) {
        patternOverlay.classList.remove('pattern-lined', 'pattern-grid', 'pattern-dotted', 'pattern-spiral');
        cardArea?.classList.remove('pattern-spiral-pad');
        if (spiralRings) spiralRings.classList.add('hidden');
        
        if (pattern !== 'plain') {
          patternOverlay.classList.add(`pattern-${pattern}`);
          if (pattern === 'spiral') {
            cardArea?.classList.add('pattern-spiral-pad');
            if (spiralRings) spiralRings.classList.remove('hidden');
          }
        }
      }
    });
  });

  // 3. Download Action
  document.getElementById('btn-download-png')?.addEventListener('click', () => {
    downloadCardAsPNG();
  });

  // 4. Back Button Action
  document.getElementById('btn-back-to-wish')?.addEventListener('click', () => {
    if (currentFestivalId) {
      navigate(`/message/${currentFestivalId}`);
    } else {
      navigate('/');
    }
  });
}

function downloadCardAsPNG() {
  const cardArea = document.getElementById('capture-card-area');
  if (!cardArea) return;
  
  const originalShadow = cardArea.style.boxShadow;
  const originalTransform = cardArea.style.transform;
  
  cardArea.style.boxShadow = 'none';
  cardArea.style.transform = 'none';
  
  showToast('กำลังประมวลผลรูปภาพคำอวยพร... 🎨', 'info');
  
  setTimeout(() => {
    window.html2canvas(cardArea, {
      scale: 3,
      backgroundColor: null,
      useCORS: true,
      allowTaint: true
    }).then(canvas => {
      cardArea.style.boxShadow = originalShadow;
      cardArea.style.transform = originalTransform;
      
      try {
        const link = document.createElement('a');
        const rawFestivalName = document.getElementById('card-festival-name')?.textContent || 'Festival';
        const cleanFestivalName = rawFestivalName.replace('🏷️ ', '').trim();
        link.download = `MyFestival-${cleanFestivalName}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('ดาวน์โหลดรูปภาพการ์ดอวยพรสำเร็จแล้ว! ✨', 'success');
      } catch (err) {
        console.error('Error generating data URL:', err);
        showToast('ไม่สามารถเซฟรูปภาพได้: ' + err.message, 'error');
      }
    }).catch(err => {
      cardArea.style.boxShadow = originalShadow;
      cardArea.style.transform = originalTransform;
      console.error('html2canvas error:', err);
      showToast('การสร้างการ์ดผิดพลาด: ' + err.message, 'error');
    });
  }, 100);
}

export const cleanup = () => {
  console.log('Cleaning up download card controller...');
};
