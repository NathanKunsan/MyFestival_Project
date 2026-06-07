// MyFestival - Archive Controller
import { getSupabase } from './supabase.js';
import { showToast } from './router.js';

let archivedFestivals = [];

// Initialize Page
export const init = async () => {
  const supabase = await getSupabase();
  if (!supabase) return;
  
  await fetchArchivedFestivals(supabase);
  setupSearchFilter();
  setupLockEvents();
};

function setupLockEvents() {
  const grid = document.getElementById('archive-grid');
  if (grid && !grid.dataset.listenerAttached) {
    grid.dataset.listenerAttached = 'true';
    grid.addEventListener('click', (e) => {
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

// Fetch and filter ended festivals from database
async function fetchArchivedFestivals(supabase) {
  try {
    const { data, error } = await supabase
      .from('festivals')
      .select('*, messages(id, status)')
      .order('end_date', { ascending: false });
      
    if (error) throw error;
    
    archivedFestivals = data || [];
    renderArchiveList(archivedFestivals);
  } catch (error) {
    console.warn('Error fetching archives, using mock data:', error.message);
    archivedFestivals = getMockFestivals();
    renderArchiveList(archivedFestivals);
  }
}

// Render the filtered festival list
function renderArchiveList(list) {
  const grid = document.getElementById('archive-grid');
  if (!grid) return;
  
  if (list.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <p class="text-lg font-bold text-pencil-light italic">🍂 ไม่พบสารบัญเทศกาลตามคำค้นหา</p>
      </div>
    `;
    return;
  }
  
  const now = new Date();
  
  grid.innerHTML = list.map(festival => {
    const approvedCount = festival.messages.filter(m => m.status === 'approved').length;
    const startStr = formatDate(festival.start_date);
    const endStr = formatDate(festival.end_date);
    const startDate = new Date(festival.start_date);
    const endDate = new Date(festival.end_date);
    
    let statusBadge = '';
    if (startDate <= now && endDate >= now) {
      statusBadge = '<span class="sketch-badge btn-green text-[10px] font-black">🔴 ACTIVE</span>';
    } else if (startDate > now) {
      statusBadge = '<span class="sketch-badge btn-orange text-[10px] font-black">📅 UPCOMING</span>';
    } else {
      statusBadge = '<span class="sketch-badge btn-cream text-[10px] font-black">💾 ARCHIVED</span>';
    }
    
    return `
      <div class="sketch-card sketch-card-alt p-4 bg-white flex flex-col md:flex-row gap-4 items-center">
        <!-- Thumbnail -->
        <div class="w-full md:w-1/3 aspect-[4/3] rounded border-2 border-pencil overflow-hidden bg-pencil-soft">
          <img src="${festival.image_url || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400'}" 
               alt="${festival.name}" 
               class="w-full h-full object-cover">
        </div>
        
        <!-- Details -->
        <div class="w-full md:w-2/3 flex flex-col justify-between h-full space-y-2">
          <div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <h3 class="text-xl font-extrabold">${festival.name}</h3>
              ${statusBadge}
            </div>
            <p class="text-xs text-pencil-light font-bold">🗓️ ${startStr} - ${endStr}</p>
            <p class="text-sm line-clamp-2 text-pencil-light">${festival.description || ''}</p>
          </div>
          
          <div class="flex justify-between items-center pt-2">
            <span class="text-xs font-bold text-wood-orange">💌 ${approvedCount} คำอวยพร</span>
            ${startDate > now
              ? `<button class="sketch-btn btn-cream text-xs py-1 px-3 opacity-60 btn-upcoming-lock">
                   ⏳ ยังไม่เริ่มจัดงาน
                 </button>`
              : endDate < now
                ? `<button class="sketch-btn btn-cream text-xs py-1 px-3 opacity-60 btn-ended-lock">
                     💾 สิ้นสุดเทศกาลแล้ว
                   </button>`
                : `<a href="/message/${festival.id}" class="sketch-btn btn-yellow text-xs py-1 px-3">
                     🎲 สุ่มรับคำอวยพร
                   </a>`
            }
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Attach Live Search input listeners
function setupSearchFilter() {
  const searchInput = document.getElementById('archive-search');
  searchInput?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
      renderArchiveList(archivedFestivals);
      return;
    }
    
    const filtered = archivedFestivals.filter(f => 
      f.name.toLowerCase().includes(term) || 
      (f.description && f.description.toLowerCase().includes(term))
    );
    renderArchiveList(filtered);
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
