// MyFestival - Festival Timeline Controller
import { getSupabase } from './supabase.js';
import { navigate, showToast } from './router.js';

let festivalsData = [];
let currentSliderIndex = 0;

// Initialize Festival Page
export const init = async () => {
  const supabase = await getSupabase();
  if (!supabase) return;
  
  await fetchAndRenderFestivals(supabase);
  setupSliderEvents();
};

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
    const startDate = new Date(festival.start_date);
    const endDate = new Date(festival.end_date);
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
}

// Helper to create a single card
function createFestivalCard(festival, approvedCount) {
  const startStr = formatDate(festival.start_date);
  const endStr = formatDate(festival.end_date);
  
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
        <p class="text-xs text-pencil-light font-bold mb-2">🗓️ ${startStr} - ${endStr}</p>
        <p class="text-sm line-clamp-3">${festival.description || 'ไม่มีคำอธิบายเพิ่มเติม'}</p>
      </div>
      
      <div class="mt-4 pt-3 border-t-2 border-pencil-soft flex gap-2">
        <a href="/message/${festival.id}" class="sketch-btn btn-yellow text-sm flex-1 text-center py-1.5 justify-center">
          🎲 สุ่มรับคำอวยพร
        </a>
      </div>
    </div>
  `;
}

// Render Hero Slider Content
function renderHeroSlider() {
  const heroSlider = document.getElementById('hero-slider');
  if (!heroSlider || festivalsData.length === 0) return;
  
  // Find current active festival, or default to first
  const now = new Date();
  const activeIndex = festivalsData.findIndex(f => new Date(f.start_date) <= now && new Date(f.end_date) >= now);
  
  if (activeIndex !== -1) {
    currentSliderIndex = activeIndex;
  }
  
  updateSliderContent();
}

// Update the DOM for the active slide in the Hero
function updateSliderContent() {
  const heroSlider = document.getElementById('hero-slider');
  if (!heroSlider || festivalsData.length === 0) return;
  
  const festival = festivalsData[currentSliderIndex];
  const approvedCount = festival.messages.filter(m => m.status === 'approved').length;
  const startStr = formatDate(festival.start_date);
  const endStr = formatDate(festival.end_date);
  
  const now = new Date();
  const isActive = new Date(festival.start_date) <= now && new Date(festival.end_date) >= now;
  const isUpcoming = new Date(festival.start_date) > now;
  
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
        🗓️ ${startStr} - ${endStr}
      </p>
      
      <p class="text-base text-pencil-light">
        ${festival.description || 'เชิญร่วมสุ่มเปิดรับการ์ดอวยพรหรือฝากคำอวยพรเพื่อส่งต่อความสุขให้เพื่อนพ้องพี่น้องชาวไทยได้เลย!'}
      </p>
      
      <div class="pt-4 flex flex-wrap gap-2">
        <a href="/message/${festival.id}" class="sketch-btn btn-yellow text-lg py-2.5 px-6">
          🎲 สุ่มคำอวยพร
        </a>
        <a href="/contributor" class="sketch-btn btn-cream py-2.5 px-6">
          ✍️ ส่งคำอวยพร
        </a>
      </div>
    </div>
  `;
}

// Setup navigation triggers for the Hero Slider
function setupSliderEvents() {
  const prevBtn = document.getElementById('slider-prev');
  const nextBtn = document.getElementById('slider-next');
  
  prevBtn?.addEventListener('click', () => {
    if (festivalsData.length === 0) return;
    currentSliderIndex = (currentSliderIndex - 1 + festivalsData.length) % festivalsData.length;
    updateSliderContent();
  });
  
  nextBtn?.addEventListener('click', () => {
    if (festivalsData.length === 0) return;
    currentSliderIndex = (currentSliderIndex + 1) % festivalsData.length;
    updateSliderContent();
  });
}

// Date Formatting Helper
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// Simple hash generator for unique indices
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}
