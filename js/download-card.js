// MyFestival - Card Downloader Controller
import { getSupabase, parseMessageTags } from './supabase.js';
import { navigate, showToast } from './router.js';
import { getCurrentUser } from './auth.js';

let currentFestivalId = null;
let currentWishId = null;
let currentUser = null;
let customColors = [];
let editingColorIndex = null;
let pickingColorTarget = 'paper'; // 'paper' or 'text'
let customTextColors = [];
let editingTextColorIndex = null;

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
  
  // Try loading guest cached colors synchronously so they render immediately
  const guestColors = localStorage.getItem('myfestival_custom_colors_guest');
  customColors = guestColors ? guestColors.split(',').map(c => c.trim()).filter(Boolean) : [];
  
  const guestTextColors = localStorage.getItem('myfestival_custom_text_colors_guest');
  customTextColors = guestTextColors ? guestTextColors.split(',').map(c => c.trim()).filter(Boolean) : [];
  
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
  
  parseMessageTags(data);
  
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
    
    parseMessageTags(data);
    
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
    
    if (currentUser) {
      const localTextColors = localStorage.getItem(`myfestival_custom_text_colors_${currentUser.id}`);
      customTextColors = localTextColors ? localTextColors.split(',').map(c => c.trim()).filter(Boolean) : [];
    } else {
      const guestTextColors = localStorage.getItem('myfestival_custom_text_colors_guest');
      customTextColors = guestTextColors ? guestTextColors.split(',').map(c => c.trim()).filter(Boolean) : [];
    }
    
    renderPaperSheets();
    renderTextPencils();
  }

function selectColor(color) {
  // Update card background color
  const cardArea = document.getElementById('capture-card-area');
  if (cardArea) {
    cardArea.style.backgroundColor = color;
  }

  // Update selected active class on paper sheets
  const sheets = document.querySelectorAll('#paper-sheets-case .paper-sheet-item');
  sheets.forEach(s => {
    const sColor = s.getAttribute('data-color');
    if (sColor && sColor.toLowerCase() === color.toLowerCase()) {
      s.classList.add('active');
    } else {
      s.classList.remove('active');
    }
  });
}

function renderPaperSheets() {
  const caseContainer = document.getElementById('paper-sheets-case');
  if (!caseContainer) return;

  const presetColors = ['#fffefb', '#fde2e4', '#cce3f5', '#e2ece9', '#f0e6ef'];
  let html = '';

  // Render presets
  presetColors.forEach(color => {
    html += `
      <div class="paper-sheet-item group preset-paper-sheet" data-color="${color}" title="สี ${color}">
        <div class="paper-sheet-body" style="background-color: ${color};"></div>
      </div>
    `;
  });

  // Render custom colors (max 5)
  customColors.forEach((color, index) => {
    html += `
      <div class="paper-sheet-item group custom-paper-sheet" data-color="${color}" title="สีผสมเอง ${color}">
        <div class="paper-sheet-actions">
          <button type="button" class="pencil-action-btn edit" data-index="${index}" title="แก้ไขสี">✎</button>
          <button type="button" class="pencil-action-btn delete" data-index="${index}" title="ลบสี">×</button>
        </div>
        <div class="paper-sheet-body" style="background-color: ${color};"></div>
      </div>
    `;
  });

  // Plus button paper sheet (if custom colors count < 5)
  if (customColors.length < 5) {
    html += `
      <div class="paper-sheet-item group paper-sheet-plus" id="btn-open-color-picker" title="เพิ่มสีใหม่">
        <div class="paper-sheet-body">
          +
        </div>
      </div>
    `;
  }

  caseContainer.innerHTML = html;
  setupPaperSheetEvents();
}

function setupPaperSheetEvents() {
  const caseContainer = document.getElementById('paper-sheets-case');
  if (!caseContainer) return;

  // Click handler for paper sheets
  caseContainer.querySelectorAll('.paper-sheet-item:not(.paper-sheet-plus)').forEach(sheet => {
    sheet.addEventListener('click', (e) => {
      if (e.target.closest('.paper-sheet-actions')) return; // Ignore if clicking action buttons
      const color = sheet.getAttribute('data-color');
      if (color) selectColor(color);
    });
  });

  // Click handler for adding custom color
  const plusBtn = document.getElementById('btn-open-color-picker');
  plusBtn?.addEventListener('click', () => {
    pickingColorTarget = 'paper';
    updateModalPresetColors('paper');
    editingColorIndex = null;
    const modalTitle = document.getElementById('color-modal-title');
    const submitBtn = document.getElementById('btn-submit-color');

    if (modalTitle) modalTitle.textContent = '🎨 ผสมสีกระดาษใหม่';
    if (submitBtn) submitBtn.textContent = 'บันทึกสีนี้ 💾';

    const defaultColor = '#fffefb';
    updateWheelColor(defaultColor, true);
    drawWheelWithIndicator(defaultColor);

    document.getElementById('add-color-modal')?.classList.remove('hidden');
  });

  // Edit action
  caseContainer.querySelectorAll('.pencil-action-btn.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pickingColorTarget = 'paper';
      updateModalPresetColors('paper');
      const index = parseInt(btn.getAttribute('data-index'));
      if (isNaN(index)) return;

      editingColorIndex = index;
      const color = customColors[index];

      const modalTitle = document.getElementById('color-modal-title');
      const submitBtn = document.getElementById('btn-submit-color');

      if (modalTitle) modalTitle.textContent = '🎨 แก้ไขสีกระดาษ';
      if (submitBtn) submitBtn.textContent = 'บันทึกการแก้ไข 💾';

      updateWheelColor(color, true);
      drawWheelWithIndicator(color);

      document.getElementById('add-color-modal')?.classList.remove('hidden');
    });
  });

  // Delete action
  caseContainer.querySelectorAll('.pencil-action-btn.delete').forEach(btn => {
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
  renderPaperSheets();
}

function selectTextColor(color) {
  const cardText = document.getElementById('card-text');
  const cardSignature = document.getElementById('card-signature');
  const cardFestival = document.getElementById('card-festival-name');
  
  if (cardText) cardText.style.color = color;
  if (cardSignature) cardSignature.style.color = color;
  if (cardFestival) cardFestival.style.color = color;

  const pencils = document.querySelectorAll('#text-pencil-holder-case .pencil-item');
  pencils.forEach(p => {
    const pColor = p.getAttribute('data-color');
    if (pColor && pColor.toLowerCase() === color.toLowerCase()) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
}

function renderTextPencils() {
  const caseContainer = document.getElementById('text-pencil-holder-case');
  if (!caseContainer) return;

  const presetColors = ['#4a3c31', '#1d3557', '#386641', '#78290f', '#3d348b'];
  let html = '';

  presetColors.forEach(color => {
    html += `
      <div class="pencil-item group preset-pencil" data-color="${color}" title="สี ${color}">
        <div class="pencil-tip">
          <div class="pencil-lead" style="border-bottom-color: ${color};"></div>
        </div>
        <div class="pencil-body" style="background-color: ${color};"></div>
      </div>
    `;
  });

  customTextColors.forEach((color, index) => {
    html += `
      <div class="pencil-item group custom-pencil" data-color="${color}" title="สีผสมเอง ${color}">
        <div class="pencil-actions">
          <button type="button" class="pencil-action-btn edit" data-index="${index}" title="แก้ไขสี">✎</button>
          <button type="button" class="pencil-action-btn delete" data-index="${index}" title="ลบสี">×</button>
        </div>
        <div class="pencil-tip">
          <div class="pencil-lead" style="border-bottom-color: ${color};"></div>
        </div>
        <div class="pencil-body" style="background-color: ${color};"></div>
      </div>
    `;
  });

  if (customTextColors.length < 5) {
    html += `
      <div class="pencil-item group pencil-plus" id="btn-open-text-color-picker" title="เพิ่มสีตัวอักษรใหม่">
        <div class="pencil-tip">
          <div class="pencil-lead" style="border-bottom-color: #8c7a6b;"></div>
        </div>
        <div class="pencil-body flex items-center justify-center text-white font-extrabold text-lg bg-pencil-soft">
          +
        </div>
      </div>
    `;
  }

  caseContainer.innerHTML = html;
  setupTextPencilEvents();
  
  const cardText = document.getElementById('card-text');
  const currentColor = cardText ? window.getComputedStyle(cardText).color : '#4a3c31';
  let hexColor = '#4a3c31';
  if (currentColor.startsWith('rgb')) {
    const rgb = currentColor.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      const r = parseInt(rgb[0]).toString(16).padStart(2, '0');
      const g = parseInt(rgb[1]).toString(16).padStart(2, '0');
      const b = parseInt(rgb[2]).toString(16).padStart(2, '0');
      hexColor = `#${r}${g}${b}`;
    }
  } else {
    hexColor = currentColor;
  }
  
  const pencils = caseContainer.querySelectorAll('.pencil-item');
  pencils.forEach(p => {
    const pColor = p.getAttribute('data-color');
    if (pColor && pColor.toLowerCase() === hexColor.toLowerCase()) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });
}

function setupTextPencilEvents() {
  const caseContainer = document.getElementById('text-pencil-holder-case');
  if (!caseContainer) return;

  caseContainer.querySelectorAll('.pencil-item:not(.pencil-plus)').forEach(pencil => {
    pencil.addEventListener('click', (e) => {
      if (e.target.closest('.pencil-actions')) return;
      const color = pencil.getAttribute('data-color');
      if (color) selectTextColor(color);
    });
  });

  const plusBtn = document.getElementById('btn-open-text-color-picker');
  plusBtn?.addEventListener('click', () => {
    pickingColorTarget = 'text';
    updateModalPresetColors('text');
    editingTextColorIndex = null;
    const modalTitle = document.getElementById('color-modal-title');
    const submitBtn = document.getElementById('btn-submit-color');

    if (modalTitle) modalTitle.textContent = '🎨 ผสมสีตัวอักษรใหม่';
    if (submitBtn) submitBtn.textContent = 'บันทึกสีนี้ 💾';

    const defaultColor = '#4a3c31';
    updateWheelColor(defaultColor, true);
    drawWheelWithIndicator(defaultColor);

    document.getElementById('add-color-modal')?.classList.remove('hidden');
  });

  caseContainer.querySelectorAll('.pencil-action-btn.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pickingColorTarget = 'text';
      updateModalPresetColors('text');
      const index = parseInt(btn.getAttribute('data-index'));
      if (isNaN(index)) return;

      editingTextColorIndex = index;
      const color = customTextColors[index];

      const modalTitle = document.getElementById('color-modal-title');
      const submitBtn = document.getElementById('btn-submit-color');

      if (modalTitle) modalTitle.textContent = '🎨 แก้ไขสีตัวอักษร';
      if (submitBtn) submitBtn.textContent = 'บันทึกการแก้ไข 💾';

      updateWheelColor(color, true);
      drawWheelWithIndicator(color);

      document.getElementById('add-color-modal')?.classList.remove('hidden');
    });
  });

  caseContainer.querySelectorAll('.pencil-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-index'));
      if (isNaN(index)) return;

      customTextColors.splice(index, 1);
      await saveCustomTextColorsToDB();
    });
  });
}

async function saveCustomTextColorsToDB() {
  const colorStr = customTextColors.join(',');

  if (currentUser) {
    localStorage.setItem(`myfestival_custom_text_colors_${currentUser.id}`, colorStr);
  } else {
    localStorage.setItem('myfestival_custom_text_colors_guest', colorStr);
  }
  renderTextPencils();
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 90 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4))
  };
}

function drawColorWheel() {
  const canvas = document.getElementById('color-wheel-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = cx;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;

        const sat = dist / radius;
        // Keep it pastel but visible (70% lightness at edges fading to 98% white at center)
        const lightness = 0.70 + (1 - sat) * 0.28;

        const rgb = hslToRgb(angle, sat * 100, lightness * 100);

        const idx = (y * width + x) * 4;
        data[idx] = rgb.r;
        data[idx + 1] = rgb.g;
        data[idx + 2] = rgb.b;
        data[idx + 3] = 255;
      } else {
        const idx = (y * width + x) * 4;
        data[idx + 3] = 0;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function getColorAtCoords(clientX, clientY) {
  const canvas = document.getElementById('color-wheel-canvas');
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const clickX = clientX - rect.left;
  const clickY = clientY - rect.top;

  const canvasX = clickX * (canvas.width / rect.width);
  const canvasY = clickY * (canvas.height / rect.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = cx;

  const dx = canvasX - cx;
  const dy = canvasY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const clampedDist = Math.min(dist, radius);

  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;

  const sat = clampedDist / radius;
  const lightness = 0.70 + (1 - sat) * 0.28;

  return hslToHex(angle, sat * 100, lightness * 100);
}

function updateWheelColor(hexColor, updateInput = true) {
  const preview = document.getElementById('hsl-color-preview');
  const hexInput = document.getElementById('user-color-hex');

  if (!hexColor.startsWith('#')) hexColor = '#' + hexColor;

  if (preview) preview.style.backgroundColor = hexColor;
  if (updateInput && hexInput) hexInput.value = hexColor.toUpperCase();
}

function updateModalPresetColors(target) {
  const titleEl = document.getElementById('modal-preset-title');
  const containerEl = document.getElementById('modal-preset-colors-container');
  if (!containerEl) return;

  let title = 'จานสีกระดาษยอดนิยม (Pastel Presets):';
  let colors = ['#fffefb', '#fde2e4', '#cce3f5', '#e2ece9', '#f0e6ef', '#fefae0', '#faedcd', '#d8f3dc', '#ffe5ec', '#e8dbcd'];

  if (target === 'text') {
    title = 'จานสีตัวอักษรยอดนิยม (Dark Presets):';
    colors = ['#4a3c31', '#1d3557', '#386641', '#78290f', '#3d348b', '#000000', '#03045e', '#1b4332', '#660708', '#005f73'];
  }

  if (titleEl) titleEl.textContent = title;

  containerEl.innerHTML = colors.map(color => `
    <button type="button"
      class="modal-preset-color w-8 h-8 rounded-full border-2 border-pencil focus:scale-110 shadow-[1px_1px_0px_var(--color-pencil)] transition-all"
      style="background-color: ${color};" data-hex="${color}"></button>
  `).join('');
}

function drawWheelWithIndicator(hexColor) {
  const canvas = document.getElementById('color-wheel-canvas');
  if (!canvas) return;

  drawColorWheel();

  const hsl = hexToHsl(hexColor);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = cx;

  const dist = (hsl.s / 100) * radius;
  const angleRad = hsl.h * Math.PI / 180;

  const x = cx + dist * Math.cos(angleRad);
  const y = cy + dist * Math.sin(angleRad);

  const ctx = canvas.getContext('2d');
  
  // Outer brown ring
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, 2 * Math.PI);
  ctx.strokeStyle = '#4a3c31';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner white ring
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, 2 * Math.PI);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function setupColorWheelEvents() {
  const canvas = document.getElementById('color-wheel-canvas');
  const hexInput = document.getElementById('user-color-hex');
  if (!canvas) return;

  let isDragging = false;

  const handleSelection = (clientX, clientY) => {
    const hex = getColorAtCoords(clientX, clientY);
    if (hex) {
      updateWheelColor(hex, true);
      drawWheelWithIndicator(hex);
    }
  };

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    handleSelection(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      handleSelection(e.clientX, e.clientY);
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Touch Support
  canvas.addEventListener('touchstart', (e) => {
    isDragging = true;
    const touch = e.touches[0];
    handleSelection(touch.clientX, touch.clientY);
    e.preventDefault(); // Prevent page drag/scrolling
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (isDragging) {
      const touch = e.touches[0];
      handleSelection(touch.clientX, touch.clientY);
      e.preventDefault(); // Prevent page drag/scrolling
    }
  }, { passive: false });

  window.addEventListener('touchend', () => {
    isDragging = false;
  });

  // Modal Preset colors click inside modal using event delegation
  const presetContainer = document.getElementById('modal-preset-colors-container');
  presetContainer?.addEventListener('click', (e) => {
    const btn = e.target.closest('.modal-preset-color');
    if (btn) {
      const hex = btn.getAttribute('data-hex');
      if (hex) {
        updateWheelColor(hex, true);
        drawWheelWithIndicator(hex);
      }
    }
  });

  // HEX Input change handler
  hexInput?.addEventListener('input', () => {
    let val = hexInput.value.trim().toUpperCase();
    if (val && !val.startsWith('#')) {
      val = '#' + val;
    }
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      updateWheelColor(val, false);
      drawWheelWithIndicator(val);
    } else {
      const preview = document.getElementById('hsl-color-preview');
      if (preview) preview.style.backgroundColor = val;
    }
  });
}

async function handleAddCustomColor(e) {
  e.preventDefault();

  const hexInput = document.getElementById('user-color-hex');
  let color = hexInput?.value.trim();
  if (color && !color.startsWith('#')) {
    color = '#' + color;
  }

  if (!/^#[0-9A-F]{6}$/i.test(color)) {
    showToast('รหัสสีไม่ถูกต้อง 🎨', 'error');
    return;
  }

  const cleanColor = color.toLowerCase();

  if (pickingColorTarget === 'paper') {
    if (editingColorIndex !== null) {
      customColors[editingColorIndex] = cleanColor;
      await saveCustomColorsToDB();

      selectColor(cleanColor);
      showToast('แก้ไขสีกระดาษเรียบร้อย! ✨', 'success');
      closeColorModal();
      editingColorIndex = null;
    } else {
      if (customColors.length >= 5) {
        showToast('บันทึกสีกำหนดเองได้สูงสุด 5 สีเท่านั้นครับ 🎨', 'warning');
        return;
      }

      customColors.push(cleanColor);
      await saveCustomColorsToDB();

      selectColor(cleanColor);
      showToast('บันทึกสีกำหนดเองเรียบร้อย! ✨', 'success');
      closeColorModal();
    }
  } else {
    // pickingColorTarget === 'text'
    if (editingTextColorIndex !== null) {
      customTextColors[editingTextColorIndex] = cleanColor;
      await saveCustomTextColorsToDB();

      selectTextColor(cleanColor);
      showToast('แก้ไขสีตัวอักษรเรียบร้อย! ✨', 'success');
      closeColorModal();
      editingTextColorIndex = null;
    } else {
      if (customTextColors.length >= 5) {
        showToast('บันทึกสีกำหนดเองได้สูงสุด 5 สีเท่านั้นครับ 🎨', 'warning');
        return;
      }

      customTextColors.push(cleanColor);
      await saveCustomTextColorsToDB();

      selectTextColor(cleanColor);
      showToast('บันทึกสีกำหนดเองเรียบร้อย! ✨', 'success');
      closeColorModal();
    }
  }
}

function closeColorModal() {
  document.getElementById('add-color-modal')?.classList.add('hidden');
}

function setupCustomizerEvents() {
  const cardArea = document.getElementById('capture-card-area');
  const patternOverlay = document.getElementById('paper-pattern-overlay');

  // Render paper sheets immediately so they are visible on load
  renderPaperSheets();
  renderTextPencils();

  // Load wheel and binding
  drawColorWheel();
  setupColorWheelEvents();

  const colorModal = document.getElementById('add-color-modal');
  const closeModalX = document.getElementById('btn-close-color-modal-x');
  const addColorForm = document.getElementById('add-color-form');

  closeModalX?.addEventListener('click', closeColorModal);
  addColorForm?.addEventListener('submit', handleAddCustomColor);

  // Close Mobile Download modal listeners
  document.getElementById('btn-close-mobile-download-x')?.addEventListener('click', () => {
    document.getElementById('mobile-download-modal')?.classList.add('hidden');
  });
  document.getElementById('btn-close-mobile-download')?.addEventListener('click', () => {
    document.getElementById('mobile-download-modal')?.classList.add('hidden');
  });

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

      if (patternOverlay) {
        // Remove all pattern classes
        patternOverlay.classList.remove(
          'pattern-lined', 'pattern-grid', 'pattern-wood-frame',
          'pattern-washi-tape', 'pattern-botanical', 'pattern-ticket', 'pattern-sparkles'
        );

        if (pattern !== 'plain') {
          patternOverlay.classList.add(`pattern-${pattern}`);
        }
      }
    });
  });

  document.getElementById('btn-download-png')?.addEventListener('click', () => {
    downloadCardAsPNG();
  });

  document.getElementById('btn-back-to-wish')?.addEventListener('click', () => {
    if (currentFestivalId) {
      navigate(`/message/${currentFestivalId}`);
    } else {
      navigate('/');
    }
  });

  // Select initial default color
  selectColor('#fffefb');
}

function downloadCardAsPNG() {
  const cardArea = document.getElementById('capture-card-area');
  if (!cardArea) return;
  
  showToast('กำลังประมวลผลรูปภาพคำอวยพร... 🎨', 'info');
  
  // Clone the card to a temporary padded transparent container to prevent clipping of shadows/washi tape/etc.
  const cloneContainer = document.createElement('div');
  cloneContainer.style.position = 'fixed';
  cloneContainer.style.top = '-9999px';
  cloneContainer.style.left = '-9999px';
  cloneContainer.style.background = 'transparent';
  cloneContainer.style.padding = '32px';
  cloneContainer.style.boxSizing = 'border-box';
  cloneContainer.style.display = 'flex';
  cloneContainer.style.justifyContent = 'center';
  cloneContainer.style.alignItems = 'center';
  cloneContainer.style.zIndex = '-9999';
  
  const cardClone = cardArea.cloneNode(true);
  
  // Keep same width and height
  const rect = cardArea.getBoundingClientRect();
  cardClone.style.width = `${rect.width}px`;
  cardClone.style.minHeight = `${rect.height}px`;
  cardClone.style.transform = 'none';
  cardClone.style.margin = '0';
  
  // Ensure background color is preserved in the clone
  cardClone.style.backgroundColor = window.getComputedStyle(cardArea).backgroundColor;
  
  cloneContainer.appendChild(cardClone);
  document.body.appendChild(cloneContainer);
  
  setTimeout(() => {
    window.html2canvas(cloneContainer, {
      scale: 3,
      backgroundColor: null,
      useCORS: true,
      allowTaint: true
    }).then(canvas => {
      // Clean up the clone container
      if (document.body.contains(cloneContainer)) {
        document.body.removeChild(cloneContainer);
      }
      
      try {
        const imgDataUrl = canvas.toDataURL('image/png');
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          const proceed = confirm('คุณต้องการดาวน์โหลดรูปภาพการ์ดอวยพรนี้ใช่หรือไม่?');
          if (!proceed) return;
        }

        const rawFestivalName = document.getElementById('card-festival-name')?.textContent || 'Festival';
        const cleanFestivalName = rawFestivalName.replace('🏷️ ', '').trim();
        
        // Convert to Blob URL for more reliable downloading on mobile devices (including Safari)
        const blob = dataURLtoBlob(imgDataUrl);
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = `MyFestival-${cleanFestivalName}.png`;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Revoke URL to release memory
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        showToast('ดาวน์โหลดรูปภาพการ์ดอวยพรสำเร็จแล้ว! ✨', 'success');
      } catch (err) {
        console.error('Error generating data URL:', err);
        showToast('ไม่สามารถเซฟรูปภาพได้: ' + err.message, 'error');
      }
    }).catch(err => {
      if (document.body.contains(cloneContainer)) {
        document.body.removeChild(cloneContainer);
      }
      console.error('html2canvas error:', err);
      showToast('การสร้างการ์ดผิดพลาด: ' + err.message, 'error');
    });
  }, 100);
}

// Utility to convert DataURL to Blob
function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}

export const cleanup = () => {
  console.log('Cleaning up download card controller...');
};
