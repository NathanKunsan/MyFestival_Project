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
  renderArchiveSkeletons();
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

// Render Skeleton Loading UI
function renderArchiveSkeletons() {
  const grid = document.getElementById('archive-grid');
  if (!grid) return;
  
  const skeletonHtml = `
    <div class="sketch-card sketch-card-alt p-4 bg-white flex flex-col md:flex-row gap-4 items-center animate-pulse">
      <div class="w-full md:w-1/3 aspect-[4/3] rounded border-2 border-pencil bg-pencil-soft/30"></div>
      <div class="w-full md:w-2/3 flex flex-col justify-between h-full space-y-3">
        <div class="space-y-2 w-full">
          <div class="h-7 bg-pencil-soft/40 rounded w-3/4"></div>
          <div class="h-4 bg-pencil-soft/30 rounded w-1/3 mb-4 mt-2"></div>
          <div class="space-y-2 mt-4 w-full">
             <div class="h-3 bg-pencil-soft/30 rounded w-full"></div>
             <div class="h-3 bg-pencil-soft/30 rounded w-5/6"></div>
             <div class="h-3 bg-pencil-soft/30 rounded w-4/6"></div>
          </div>
        </div>
        <div class="flex justify-between items-center pt-2 w-full mt-4">
          <div class="h-4 bg-pencil-soft/40 rounded w-1/4"></div>
          <div class="h-8 bg-pencil-soft/40 rounded w-1/3"></div>
        </div>
      </div>
    </div>
  `;
  grid.innerHTML = skeletonHtml + skeletonHtml + skeletonHtml;
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
    const { startDate, endDate, isAnnual } = getFestivalDates(festival);
    const startStr = formatDate(startDate, isAnnual);
    const endStr = formatDate(endDate, isAnnual);
    const dateRangeStr = isAnnual ? `${startStr} - ${endStr} (ประจำปี)` : `${startStr} - ${endStr}`;
    const cleanDesc = isAnnual ? festival.description.replace('[ประจำปี]', '').trim() : festival.description;
    
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
            <p class="text-xs text-pencil-light font-bold">🗓️ ${dateRangeStr}</p>
            <p class="festival-desc text-sm line-clamp-5 text-pencil-light whitespace-pre-line">${cleanDesc || ''}</p>
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
  
  adjustDescriptions();
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
function formatDate(dateStr, isAnnual) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short'
  });
}

function getFestivalDates(festival) {
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
