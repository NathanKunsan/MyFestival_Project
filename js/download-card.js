// MyFestival - Card Downloader Controller
import { getSupabase } from './supabase.js';
import { navigate, showToast } from './router.js';

let currentFestivalId = null;
let currentWishId = null;

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
  const supabase = await getSupabase();
  if (!supabase) return;
  
  await fetchAndRenderWish(supabase, wishId);
  setupCustomizerEvents();
};

async function fetchAndRenderWish(supabase, wishId) {
  const cardText = document.getElementById('card-text');
  const cardFestival = document.getElementById('card-festival-name');
  const cardSignature = document.getElementById('card-signature');
  
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
    if (cardText) cardText.textContent = 'ไม่สามารถดึงข้อมูลคำอวยพรได้ หรืออาจถูกแอดมินลบออกแล้ว 🍂';
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลคำอวยพร: ' + error.message, 'error');
  }
}

function setupCustomizerEvents() {
  const cardArea = document.getElementById('capture-card-area');
  const patternOverlay = document.getElementById('paper-pattern-overlay');
  
  // 1. Color Pickers
  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      // Clear outline scale from other swatches
      swatches.forEach(s => s.classList.remove('scale-110', 'ring-4', 'ring-pencil/30'));
      
      // Apply active states
      swatch.classList.add('scale-110', 'ring-4', 'ring-pencil/30');
      
      const color = swatch.getAttribute('data-color');
      if (cardArea) {
        cardArea.style.backgroundColor = color;
      }
    });
  });
  
  // Trigger click on first swatch to initialize highlight
  if (swatches.length > 0) swatches[0].click();

  // 2. Pattern Selectors
  const patternBtns = document.querySelectorAll('.pattern-btn');
  patternBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle button styles
      patternBtns.forEach(b => {
        b.classList.remove('btn-yellow');
        b.classList.add('btn-cream');
      });
      btn.classList.add('btn-yellow');
      btn.classList.remove('btn-cream');
      
      const pattern = btn.getAttribute('data-pattern');
      
      // Remove all patterns
      if (patternOverlay) {
        patternOverlay.classList.remove('pattern-lined', 'pattern-grid', 'pattern-dotted');
        
        // Add new pattern
        if (pattern !== 'plain') {
          patternOverlay.classList.add(`pattern-${pattern}`);
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
  
  // Temporarily disable offset transformations / shadows for pristine canvas crop
  cardArea.style.boxShadow = 'none';
  cardArea.style.transform = 'none';
  
  showToast('กำลังประมวลผลรูปภาพคำอวยพร... 🎨', 'info');
  
  setTimeout(() => {
    window.html2canvas(cardArea, {
      scale: 3, // Premium quality scaling
      backgroundColor: null,
      useCORS: true,
      allowTaint: true
    }).then(canvas => {
      // Revert styling changes
      cardArea.style.boxShadow = originalShadow;
      cardArea.style.transform = originalTransform;
      
      try {
        const link = document.createElement('a');
        link.download = `MyFestival-Card-${currentWishId || 'gift'}.png`;
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
  }, 100); // Small timeout to allow styles to settle
}

export const cleanup = () => {
  console.log('Cleaning up download card controller...');
};
