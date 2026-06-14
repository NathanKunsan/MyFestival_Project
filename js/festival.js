// MyFestival - Festival Timeline Controller
import { getSupabase } from './supabase.js';
import { navigate, showToast } from './router.js';
import { getCurrentUser, getUserProfile } from './auth.js';

let festivalsData = [];
let currentSliderIndex = 0;
let messagesSubscription = null;
let festivalsSubscription = null;
let isInitialLoad = true;
let userRole = 'guest';
let sliderInterval = null;

// Initialize Festival Page
export const init = async () => {
  const supabase = await getSupabase();
  if (!supabase) return;
  
  const user = await getCurrentUser();
  if (user) {
    const profile = await getUserProfile(user.id);
    userRole = profile?.role || 'member';
  } else {
    userRole = 'guest';
  }
  
  await fetchAndRenderFestivals(supabase);
  setupSliderEvents();
  setupRealtime(supabase);
  setupGlobalLockEvents();
  startSliderAutoPlay();
};

function setupGlobalLockEvents() {
  const mainEl = document.getElementById('main-content');
  if (mainEl && !mainEl.dataset.lockListenersBound) {
    mainEl.dataset.lockListenersBound = 'true';
    mainEl.addEventListener('click', (e) => {
      const upcomingBtn = e.target.closest('.btn-upcoming-lock');
      const endedBtn = e.target.closest('.btn-ended-lock');
      
      if (upcomingBtn) {
        e.preventDefault();
        showToast('เทศกาลนี้ยังไม่เริ่มจัดงาน ไม่สามารถสุ่มคำอวยพรได้ครับ ⏳', 'warning');
      } else if (endedBtn) {
        e.preventDefault();
        showToast('เทศกาลนี้ได้สิ้นสุดลงแล้ว ไม่สามารถสุ่มคำอวยพรได้ครับ 💾', 'warning');
      }
    });
  }
}

// Helper for mock festivals data fallback
const getMockFestivals = () => {
  const now = new Date();
  
  // Make Songkran active right now for demonstration
  const songkranStart = new Date(now);
  songkranStart.setDate(now.getDate() - 3);
  const songkranEnd = new Date(now);
  songkranEnd.setDate(now.getDate() + 5);
  
  // Make Loy Krathong upcoming
  const loyStart = new Date(now);
  loyStart.setDate(now.getDate() + 15);
  const loyEnd = new Date(now);
  loyEnd.setDate(now.getDate() + 25);
  
  // Make New Year ended
  const nyStart = new Date(now);
  nyStart.setDate(now.getDate() - 25);
  const nyEnd = new Date(now);
  nyEnd.setDate(now.getDate() - 15);

  return [
    {
      id: "f1111111-1111-1111-1111-111111111111",
      name: "เทศกาลสงกรานต์ (Songkran Festival)",
      description: "เทศกาลขึ้นปีใหม่ไทยอันแสนอบอุ่น ร่วมสืบสานประเพณีรดน้ำดำหัวผู้ใหญ่ เล่นน้ำสงกรานต์กันอย่างสนุกสนาน และส่งต่อคำอวยพรดีๆ ให้กัน",
      image_url: "https://images.unsplash.com/photo-1582880786584-c5a45b85a3c0?w=800",
      start_date: songkranStart.toISOString(),
      end_date: songkranEnd.toISOString(),
      messages: [
        { id: "m1", status: "approved" },
        { id: "m2", status: "approved" },
        { id: "m3", status: "approved" }
      ]
    },
    {
      id: "f2222222-2222-2222-2222-222222222222",
      name: "เทศกาลลอยกระทง (Loy Krathong)",
      description: "ประเพณีลอยกระทงเพื่อขอขมาพระแม่คงคาในคืนวันเพ็ญเดือนสิบสอง ร่วมลอยกระทงประทีปโคมไฟ และขอพรส่งต่อความรักสุขใจ",
      image_url: "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=800",
      start_date: loyStart.toISOString(),
      end_date: loyEnd.toISOString(),
      messages: [
        { id: "m4", status: "approved" },
        { id: "m5", status: "approved" }
      ]
    },
    {
      id: "f3333333-3333-3333-3333-333333333333",
      name: "เทศกาลปีใหม่ (New Year Celebration)",
      description: "เฉลิมฉลองเทศกาลส่งท้ายปีเก่าต้อนรับปีใหม่ ร่วมเคาท์ดาวน์สวดมนต์ข้ามปี และตั้งปณิธานส่งมอบความหวังกำลังใจให้กันและกัน",
      image_url: "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800",
      start_date: nyStart.toISOString(),
      end_date: nyEnd.toISOString(),
      messages: [
        { id: "m6", status: "approved" }
      ]
    }
  ];
};

// Fetch all festivals and count messages
async function fetchAndRenderFestivals(supabase) {
  renderSkeletons();
  try {
    // Fetch festivals along with message references
    const { data, error } = await supabase
      .from('festivals')
      .select('*, messages(id, status)');
      
    if (error) throw error;
    
    festivalsData = data || [];
    
    // Sort festivals by start_date
    festivalsData.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    
    renderCategories();
    renderHeroSlider();
  } catch (error) {
    console.warn('Error fetching festivals, falling back to mock data:', error.message);
    festivalsData = getMockFestivals();
    
    renderCategories();
    renderHeroSlider();
  }
}

// Render Skeleton Loading UI
function renderSkeletons() {
  const activeList = document.getElementById('active-list');
  const upcomingList = document.getElementById('upcoming-list');
  const endedList = document.getElementById('ended-list');
  
  const skeletonHtml = `
    <div class="sketch-card p-4 bg-white flex flex-col justify-between min-h-[300px] animate-pulse">
      <div>
        <div class="relative h-40 w-full mb-3 rounded-lg border-2 border-pencil bg-pencil-soft/30"></div>
        <div class="h-6 bg-pencil-soft/40 rounded w-3/4 mb-2 mt-1"></div>
        <div class="h-4 bg-pencil-soft/30 rounded w-1/2 mb-4 mt-2"></div>
        <div class="space-y-2 mt-4">
           <div class="h-3 bg-pencil-soft/30 rounded w-full"></div>
           <div class="h-3 bg-pencil-soft/30 rounded w-5/6"></div>
           <div class="h-3 bg-pencil-soft/30 rounded w-4/6"></div>
        </div>
      </div>
      <div class="mt-4 pt-3 border-t-2 border-pencil-soft flex gap-2">
         <div class="h-10 bg-pencil-soft/40 rounded flex-1"></div>
      </div>
    </div>
  `;
  
  const skeletonGroup = skeletonHtml + skeletonHtml + skeletonHtml;
  if (activeList) activeList.innerHTML = skeletonGroup;
  if (upcomingList) upcomingList.innerHTML = skeletonGroup;
  if (endedList) endedList.innerHTML = skeletonGroup;
}

// Render Categorized Sections (Active, Upcoming, Ended)
function renderCategories() {
  const now = new Date();
  
  const activeList = document.getElementById('active-list');
  const upcomingList = document.getElementById('upcoming-list');
  const endedList = document.getElementById('ended-list');
  
  if (!activeList || !upcomingList || !endedList) return;
  
  // Clear lists
  activeList.innerHTML = '';
  upcomingList.innerHTML = '';
  endedList.innerHTML = '';
  
  let activeCount = 0;
  let upcomingCount = 0;
  let endedCount = 0;
  
  festivalsData.forEach(festival => {
    const { startDate, endDate, isAnnual } = getFestivalDates(festival);
    const approvedCount = festival.messages.filter(m => m.status === 'approved').length;
    
    const cardHtml = createFestivalCard(festival, approvedCount);
    
    if (startDate <= now && endDate >= now) {
      activeList.innerHTML += cardHtml;
      activeCount++;
    } else if (startDate > now) {
      upcomingList.innerHTML += cardHtml;
      upcomingCount++;
    } else {
      endedList.innerHTML += cardHtml;
      endedCount++;
    }
  });
  
  // Fallbacks if groups are empty
  if (activeCount === 0) {
    activeList.innerHTML = `<p class="text-pencil-light font-bold italic col-span-full py-4 text-center">ไม่มีเทศกาลที่กำลังดำเนินอยู่ในขณะนี้... 🍃</p>`;
  }
  if (upcomingCount === 0) {
    upcomingList.innerHTML = `<p class="text-pencil-light font-bold italic col-span-full py-4 text-center">ไม่มีเทศกาลที่กำลังจะมาถึงในขณะนี้... 📅</p>`;
  }
  if (endedCount === 0) {
    endedList.innerHTML = `<p class="text-pencil-light font-bold italic col-span-full py-4 text-center">ไม่มีเทศกาลที่จบการบันทึกแล้ว... 💾</p>`;
  }

  adjustDescriptions();
}

// Helper to create a single card
function createFestivalCard(festival, approvedCount) {
  const { startDate, endDate, isAnnual } = getFestivalDates(festival);
  const startStr = formatDate(startDate, isAnnual);
  const endStr = formatDate(endDate, isAnnual);
  const dateRangeStr = isAnnual ? `${startStr} - ${endStr} (ประจำปี)` : `${startStr} - ${endStr}`;
  const cleanDesc = isAnnual ? festival.description.replace('[ประจำปี]', '').trim() : festival.description;
  
  // Pick border/bg color based on ID to make the screen look colorful like colored pencils
  const colors = ['btn-yellow', 'btn-green', 'btn-blue', 'btn-pink', 'btn-purple', 'btn-orange'];
  const colorIndex = Math.abs(hashCode(festival.id)) % colors.length;
  const cardColorClass = colors[colorIndex];
  
  return `
    <div class="sketch-card p-4 bg-white flex flex-col justify-between min-h-[300px]">
      <div>
        <div class="relative h-40 w-full mb-3 rounded-lg overflow-hidden border-2 border-pencil">
          <img src="${festival.image_url || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600'}" 
               alt="${festival.name}" 
               class="w-full h-full object-cover">
          <div class="absolute bottom-2 right-2 sketch-badge ${cardColorClass}">
            💌 ${approvedCount} คำอวยพร
          </div>
        </div>
        
        <h3 class="text-xl font-extrabold mb-1">${festival.name}</h3>
        <p class="text-xs text-pencil-light font-bold mb-2">🗓️ ${dateRangeStr}</p>
        <p class="festival-desc text-sm line-clamp-5 whitespace-pre-line">${cleanDesc || 'ไม่มีคำอธิบายเพิ่มเติม'}</p>
      </div>
      
      <div class="mt-4 pt-3 border-t-2 border-pencil-soft flex gap-2">
        ${startDate > new Date()
          ? `<button class="sketch-btn btn-cream text-sm flex-1 text-center py-1.5 justify-center opacity-60 btn-upcoming-lock">
               ⏳ ยังไม่เริ่มจัดงาน
             </button>`
          : endDate < new Date()
            ? `<button class="sketch-btn btn-cream text-sm flex-1 text-center py-1.5 justify-center opacity-60 btn-ended-lock">
                 💾 สิ้นสุดเทศกาลแล้ว
               </button>`
            : `<a href="/message/${festival.id}" class="sketch-btn btn-yellow text-sm flex-1 text-center py-1.5 justify-center">
                 🎲 สุ่มรับคำอวยพร
               </a>`
        }
      </div>
    </div>
  `;
}

// Render Hero Slider Content
function renderHeroSlider() {
  const heroSlider = document.getElementById('hero-slider');
  if (!heroSlider || festivalsData.length === 0) return;
  
  if (isInitialLoad) {
    // Find current active festival, or default to first
    const now = new Date();
    const activeIndex = festivalsData.findIndex(f => new Date(f.start_date) <= now && new Date(f.end_date) >= now);
    
    if (activeIndex !== -1) {
      currentSliderIndex = activeIndex;
    }
    isInitialLoad = false;
  } else if (currentSliderIndex >= festivalsData.length) {
    currentSliderIndex = 0;
  }
  
  updateSliderContent();
}

// Update the DOM for the active slide in the Hero
// Update the DOM for the active slide in the Hero with smooth transition (Plan 2)
function updateSliderContent() {
  const heroSlider = document.getElementById('hero-slider');
  if (!heroSlider || festivalsData.length === 0) return;
  
  // Fade out
  heroSlider.classList.remove('slide-fade-in');
  heroSlider.classList.add('slide-fade-out');
  
  setTimeout(() => {
    const festival = festivalsData[currentSliderIndex];
    const { startDate, endDate, isAnnual } = getFestivalDates(festival);
    const approvedCount = festival.messages.filter(m => m.status === 'approved').length;
    const startStr = formatDate(startDate, isAnnual);
    const endStr = formatDate(endDate, isAnnual);
    const dateRangeStr = isAnnual ? `${startStr} - ${endStr} (ประจำปี)` : `${startStr} - ${endStr}`;
    const cleanDesc = isAnnual ? festival.description.replace('[ประจำปี]', '').trim() : festival.description;
    
    const now = new Date();
    const isActive = startDate <= now && endDate >= now;
    const isUpcoming = startDate > now;
    
    let statusBadge = '';
    if (isActive) {
      statusBadge = '<span class="sketch-badge btn-green text-xs font-extrabold">🔴 กำลังจัดขึ้น</span>';
    } else if (isUpcoming) {
      statusBadge = '<span class="sketch-badge btn-orange text-xs font-extrabold">📅 เร็วๆ นี้</span>';
    } else {
      statusBadge = '<span class="sketch-badge btn-cream text-xs font-extrabold">💾 ผ่านไปแล้ว</span>';
    }
    
    heroSlider.innerHTML = `
      <!-- Slider Left: polaroid photo -->
      <div class="w-full md:w-1/2 flex justify-center">
        <div class="sketch-card sketch-card-alt p-3 bg-white rotate-[-1deg] max-w-sm">
          <div class="w-full aspect-[4/3] rounded border-2 border-pencil overflow-hidden mb-3">
            <img src="${festival.image_url || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800'}" 
                 alt="${festival.name}" 
                 class="w-full h-full object-cover">
          </div>
          <div class="text-center font-bold text-lg">${festival.name}</div>
        </div>
      </div>
      
      <!-- Slider Right: details & call to actions -->
      <div class="w-full md:w-1/2 space-y-4">
        <div class="flex items-center gap-2">
          ${statusBadge}
          <span class="sketch-badge btn-yellow text-xs font-extrabold">💌 ${approvedCount} คำอวยพร</span>
        </div>
        
        <h2 class="text-3xl font-extrabold">${festival.name}</h2>
        <p class="text-sm font-bold text-pencil-light">
          🗓️ ${dateRangeStr}
        </p>
        
        <p class="festival-desc text-base text-pencil-light line-clamp-5 whitespace-pre-line">
          ${cleanDesc || 'เชิญร่วมสุ่มเปิดรับการ์ดอวยพรหรือฝากคำอวยพรเพื่อส่งต่อความสุขให้เพื่อนพ้องพี่น้องชาวไทยได้เลย!'}
        </p>
        
        <div class="pt-4 flex flex-wrap gap-2">
          ${isUpcoming
            ? `<button class="sketch-btn btn-cream py-2.5 px-6 opacity-60 text-lg btn-upcoming-lock">
                 ⏳ ยังไม่เริ่ม
               </button>`
            : endDate < now
              ? `<button class="sketch-btn btn-cream py-2.5 px-6 opacity-60 text-lg btn-ended-lock">
                   💾 สิ้นสุดเทศกาลแล้ว
                 </button>`
              : `<a href="/message/${festival.id}" class="sketch-btn btn-yellow text-lg py-2.5 px-6">
                   🎲 สุ่มคำอวยพร
                 </a>`
          }
          ${(['contributor', 'admin'].includes(userRole) || localStorage.getItem('myfestival_dev_bypass') === 'true')
            ? `<a href="/contributor" class="sketch-btn btn-cream py-2.5 px-6">
                 ✍️ ส่งคำอวยพร
               </a>`
            : ''
          }
        </div>
      </div>
    `;
    
    // Trigger reflow to apply transition
    void heroSlider.offsetWidth;
    heroSlider.classList.remove('slide-fade-out');
    heroSlider.classList.add('slide-fade-in');
    
    adjustDescriptions();
  }, 400); // 400ms transition delay
}

// Setup navigation triggers for the Hero Slider
function setupSliderEvents() {
  const prevBtn = document.getElementById('slider-prev');
  const nextBtn = document.getElementById('slider-next');
  
  prevBtn?.addEventListener('click', () => {
    if (festivalsData.length === 0) return;
    currentSliderIndex = (currentSliderIndex - 1 + festivalsData.length) % festivalsData.length;
    updateSliderContent();
    startSliderAutoPlay(); // Reset timer
  });
  
  nextBtn?.addEventListener('click', () => {
    if (festivalsData.length === 0) return;
    currentSliderIndex = (currentSliderIndex + 1) % festivalsData.length;
    updateSliderContent();
    startSliderAutoPlay(); // Reset timer
  });

  // Touch swipe events for mobile support
  const heroSlider = document.getElementById('hero-slider');
  if (heroSlider) {
    let touchStartX = 0;
    let touchEndX = 0;
    
    heroSlider.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    heroSlider.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
      const swipeDistance = touchEndX - touchStartX;
      if (swipeDistance < -50) {
        // Swipe left -> Next slide
        if (festivalsData.length === 0) return;
        currentSliderIndex = (currentSliderIndex + 1) % festivalsData.length;
        updateSliderContent();
        startSliderAutoPlay(); // Reset timer
      } else if (swipeDistance > 50) {
        // Swipe right -> Prev slide
        if (festivalsData.length === 0) return;
        currentSliderIndex = (currentSliderIndex - 1 + festivalsData.length) % festivalsData.length;
        updateSliderContent();
        startSliderAutoPlay(); // Reset timer
      }
    }
  }
}

// Autoplay slider logic
function startSliderAutoPlay() {
  stopSliderAutoPlay();
  sliderInterval = setInterval(() => {
    if (festivalsData.length === 0) return;
    currentSliderIndex = (currentSliderIndex + 1) % festivalsData.length;
    updateSliderContent();
  }, 8000); // Rotate every 8 seconds
}

function stopSliderAutoPlay() {
  if (sliderInterval) {
    clearInterval(sliderInterval);
    sliderInterval = null;
  }
}

// Date Formatting Helper
function formatDate(dateStr, isAnnual) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short'
  });
}

export function getFestivalDates(festival) {
  const now = new Date();
  let startDate = new Date(festival.start_date);
  let endDate = new Date(festival.end_date);
  const isAnnual = festival.description && festival.description.startsWith('[ประจำปี]');
  
  if (isAnnual) {
    const currentYear = now.getFullYear();
    startDate.setFullYear(currentYear);
    endDate.setFullYear(currentYear);
    
    if (startDate > endDate) {
      if (now >= startDate) {
        endDate.setFullYear(currentYear + 1);
      } else if (now <= endDate) {
        startDate.setFullYear(currentYear - 1);
      } else {
        endDate.setFullYear(currentYear + 1);
      }
    } else {
      if (now > endDate) {
        startDate.setFullYear(currentYear + 1);
        endDate.setFullYear(currentYear + 1);
      }
    }
  }
  
  return { startDate, endDate, isAnnual };
}

// Simple hash generator for unique indices
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function setupRealtime(supabase) {
  // Subscribe to messages changes to update counts in real-time
  if (messagesSubscription) messagesSubscription.unsubscribe();
  messagesSubscription = supabase
    .channel('festival-messages-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      async (payload) => {
        console.log('Messages change detected in homepage:', payload);
        await fetchAndRenderFestivals(supabase);
      }
    )
    .subscribe();

  // Subscribe to festivals changes
  if (festivalsSubscription) festivalsSubscription.unsubscribe();
  festivalsSubscription = supabase
    .channel('festival-festivals-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'festivals' },
      async (payload) => {
        console.log('Festivals change detected in homepage:', payload);
        await fetchAndRenderFestivals(supabase);
      }
    )
    .subscribe();
}

export const cleanup = () => {
  stopSliderAutoPlay();
  if (messagesSubscription) {
    messagesSubscription.unsubscribe();
    messagesSubscription = null;
  }
  if (festivalsSubscription) {
    festivalsSubscription.unsubscribe();
    festivalsSubscription = null;
  }
  isInitialLoad = true;
};

function adjustDescriptions() {
  setTimeout(() => {
    const descEls = document.querySelectorAll('.festival-desc');
    descEls.forEach(descEl => {
      // Check if button is already added
      if (descEl.nextElementSibling && descEl.nextElementSibling.classList.contains('btn-toggle-desc')) {
        return;
      }
      
      const isTruncated = descEl.scrollHeight > descEl.clientHeight;
      if (isTruncated) {
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'btn-toggle-desc sketch-btn px-3.5 py-1.5 text-xs font-bold mt-2 shadow-[2px_2px_0px_0px_#4a3c31]';
        toggleBtn.style.cssText = 'background-color: black !important; color: white !important; border-color: black !important;';
        toggleBtn.textContent = 'ดูเพิ่มเติม';
        
        descEl.parentNode.insertBefore(toggleBtn, descEl.nextSibling);
        
        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (descEl.classList.contains('line-clamp-5')) {
            descEl.classList.remove('line-clamp-5');
            descEl.classList.add('line-clamp-none');
            toggleBtn.textContent = 'ย่อ';
          } else {
            descEl.classList.remove('line-clamp-none');
            descEl.classList.add('line-clamp-5');
            toggleBtn.textContent = 'ดูเพิ่มเติม';
          }
        });
      }
    });
  }, 100);
}
