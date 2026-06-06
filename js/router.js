// MyFestival Vanilla SPA Router
import { isConfigured, saveCredentials } from './config.js';
import { checkUserRole, signOut } from './auth.js';
import { getSupabase } from './supabase.js';

// Setup elements
const mainContent = document.getElementById('main-content');
const configBanner = document.getElementById('config-banner');
const configModal = document.getElementById('config-modal');
const configForm = document.getElementById('config-form');
const configUrlInput = document.getElementById('config-url');
const configKeyInput = document.getElementById('config-key');
const configCloseBtn = document.getElementById('config-close-btn');
const btnOpenConfig = document.getElementById('btn-open-config');

// Navigation links
const navSaved = document.getElementById('nav-saved');
const navContributor = document.getElementById('nav-contributor');
const navAdmin = document.getElementById('nav-admin');
const navProfile = document.getElementById('nav-profile');
const navLogin = document.getElementById('nav-login');
const navRegister = document.getElementById('nav-register');
const navLogout = document.getElementById('nav-logout');
const navAvatar = document.getElementById('nav-avatar');
const navUsername = document.getElementById('nav-username');
const navSuggest = document.getElementById('nav-suggest');

// Cache current session details
let currentSession = { user: null, profile: null, role: 'guest' };
let userProfileSubscription = null;
let activeControllerModule = null;
let notifChannels = [];

function clearNotifChannels() {
  notifChannels.forEach(c => c.unsubscribe());
  notifChannels = [];
}

export async function updateProfileNotificationCount(userId) {
  if (!userId) return;
  const supabase = await getSupabase();
  if (!supabase) return;
  
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
      
    if (error) throw error;
    
    const badge = document.getElementById('profile-notif-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  } catch (err) {
    console.warn('Error fetching user notification count:', err);
  }
}

export async function updateAdminNotificationCount() {
  const supabase = await getSupabase();
  if (!supabase) return;
  
  try {
    // 1. Pending wishes
    const { count: msgCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
      
    // 2. Pending revisions
    const { count: revCount } = await supabase
      .from('message_revisions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
      
    // 3. Pending suggestions
    const { count: sugCount } = await supabase
      .from('festival_suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
      
    // 4. Pending name changes
    const { count: nameCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('pending_name', 'is', null);
      
    const totalTasks = (msgCount || 0) + (revCount || 0) + (sugCount || 0) + (nameCount || 0);
    
    const badge = document.getElementById('admin-notif-badge');
    if (badge) {
      if (totalTasks > 0) {
        badge.textContent = totalTasks;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  } catch (err) {
    console.warn('Error fetching admin notification count:', err);
  }
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  // Setup Supabase config UI
  setupConfigEvents();
  
  if (!isConfigured()) {
    showConfigNeeded();
  } else {
    // Check user role on load
    await refreshAuthUI();
  }
  
  // Mobile menu elements
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mainNav = document.getElementById('main-nav');
  const hamIcon = document.getElementById('menu-icon-hamburger');
  const closeIcon = document.getElementById('menu-icon-close');

  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener('click', () => {
      mainNav.classList.toggle('hidden');
      mainNav.classList.toggle('flex');
      hamIcon?.classList.toggle('hidden');
      closeIcon?.classList.toggle('hidden');
    });
  }
  
  // Intercept links for SPA routing
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.getAttribute('href') && link.getAttribute('href').startsWith('/')) {
      e.preventDefault();
      
      // Close mobile menu on redirect if open
      if (mainNav && !mainNav.classList.contains('hidden') && window.innerWidth < 1024) {
        mainNav.classList.add('hidden');
        mainNav.classList.remove('flex');
        hamIcon?.classList.remove('hidden');
        closeIcon?.classList.add('hidden');
      }
      
      navigate(link.getAttribute('href'));
    }
  });

  // Handle browser back/forward buttons & hash changes
  window.addEventListener('hashchange', () => {
    const path = window.location.hash.slice(1) || '/';
    routePage(path);
  });

  // Run router for initial load
  const initialPath = window.location.hash.slice(1) || '/';
  
  // Initialize About System modal events
  initAboutModalEvents();
  
  // Initialize Suggest Festival modal events
  initSuggestModalEvents();
  
  routePage(initialPath);
});

// Setup config modal event handlers
function setupConfigEvents() {
  btnOpenConfig?.addEventListener('click', () => {
    configModal.classList.remove('hidden');
  });
  
  configCloseBtn?.addEventListener('click', () => {
    configModal.classList.add('hidden');
  });

  configForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = configUrlInput.value.trim();
    const key = configKeyInput.value.trim();
    if (url && key) {
      saveCredentials(url, key);
      showToast('บันทึกการตั้งค่าแล้ว ระบบจะโหลดหน้าเว็บใหม่', 'success');
      setTimeout(() => window.location.reload(), 1500);
    }
  });
}

function showConfigNeeded() {
  configBanner?.classList.remove('hidden');
  // Auto open modal on clean start
  configModal?.classList.remove('hidden');
}

// Initialize About MyFestival modal events and closing handlers
function initAboutModalEvents() {
  const modal = document.getElementById('about-system-modal');
  const btnCloseX = document.getElementById('btn-close-about-x');
  const btnCloseOk = document.getElementById('btn-close-about-ok');
  const checkbox = document.getElementById('chk-about-dismiss-forever');
  const floatingBtn = document.getElementById('btn-floating-info');

  const closeModal = () => {
    if (checkbox && checkbox.checked) {
      localStorage.setItem('myfestival_about_dismissed', 'true');
    } else {
      localStorage.removeItem('myfestival_about_dismissed');
    }
    modal?.classList.add('hidden');
  };

  btnCloseX?.addEventListener('click', closeModal);
  btnCloseOk?.addEventListener('click', closeModal);

  floatingBtn?.addEventListener('click', async () => {
    await loadAboutInfo();
    if (checkbox) {
      checkbox.checked = localStorage.getItem('myfestival_about_dismissed') === 'true';
    }
    modal?.classList.remove('hidden');
  });
}

// Load and render About MyFestival content from database
export async function loadAboutInfo() {
  const contentEl = document.getElementById('about-modal-content');
  if (!contentEl) return;

  const supabase = await getSupabase();
  if (!supabase) {
    contentEl.innerHTML = `<p class="italic text-pencil-light text-center">กำลังเชื่อมต่อฐานข้อมูล... ⏳</p>`;
    return;
  }

  try {
    const { data, error } = await supabase
      .from('about_info')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      contentEl.innerHTML = data.map(item => `
        <div class="mb-4 last:mb-0">
          <h4 class="text-base font-extrabold text-pencil mb-1">📢 ${item.title}</h4>
          <p class="whitespace-pre-wrap">${item.content}</p>
        </div>
      `).join('');
    } else {
      contentEl.innerHTML = `
        <div class="text-center py-4 text-pencil-light">
          <p class="text-2xl mb-1">ℹ️</p>
          <p class="text-sm italic">ไม่มีข้อมูลเกี่ยวกับ MyFestival ในขณะนี้</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading about info:', err);
    contentEl.innerHTML = `<p class="text-wood-red font-bold text-center">เกิดข้อผิดพลาดในการโหลดข้อมูล: ${err.message}</p>`;
  }
}

// Global Toast System
export function showToast(message, type = 'info') {
  const container = document.getElementById('global-toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = 'sketch-toast';
  
  let icon = 'ℹ️';
  let colorClass = 'border-pencil';
  if (type === 'success') {
    icon = '🎉';
    colorClass = 'border-pencil bg-wood-green/20';
  } else if (type === 'error') {
    icon = '⚠️';
    colorClass = 'border-pencil bg-wood-red/20';
  } else if (type === 'warning') {
    icon = '🚩';
    colorClass = 'border-pencil bg-wood-orange/20';
  }
  
  toast.innerHTML = `
    <span class="text-xl">${icon}</span>
    <span class="font-bold">${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Auto remove toast
  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Router Navigation Trigger
export function navigate(path) {
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  window.location.hash = cleanPath;
}

// Match URL paths to route templates
function matchRoute(path) {
  if (path === '/' || path === '/festival') {
    return { view: '/html/festival.html', controller: '/js/festival.js', params: {} };
  }
  if (path.startsWith('/message/')) {
    const id = path.split('/')[2];
    return { view: '/html/message.html', controller: '/js/message.js', params: { id } };
  }
  if (path === '/login') {
    return { view: '/html/login.html', controller: '/js/auth.js', initName: 'initLogin', params: {} };
  }
  if (path === '/register') {
    return { view: '/html/register.html', controller: '/js/auth.js', initName: 'initRegister', params: {} };
  }
  if (['/archive', '/saved', '/profile', '/admin', '/contributor'].includes(path)) {
    return { view: `/html${path}.html`, controller: `/js${path}.js`, params: {} };
  }
  
  // Default to 404
  return { 
    view: null, 
    controller: null, 
    htmlContent: `
      <div class="sketch-card p-12 text-center bg-white">
        <h2 class="text-5xl font-extrabold mb-4">404 ✏️</h2>
        <p class="text-xl font-bold mb-6">ไม่พบสมุดบันทึกหน้านี้ในระบบ</p>
        <a href="/" class="sketch-btn btn-yellow">กลับหน้าแรก</a>
      </div>
    `, 
    params: {} 
  };
}

// Load and render page views
async function routePage(path) {
  // Remove previous portaled modals from body (keep global #config-modal and #about-system-modal)
  const oldModals = document.body.querySelectorAll('[id$="-modal"]:not(#config-modal):not(#about-system-modal)');
  oldModals.forEach(m => m.remove());
  
  // If not configured, block navigation and display fallback
  if (!isConfigured()) {
    mainContent.innerHTML = `
      <div class="sketch-card p-12 text-center bg-white max-w-xl mx-auto my-12">
        <h2 class="text-4xl font-extrabold mb-4">⚙️ ต้องตั้งค่าระบบ</h2>
        <p class="text-lg font-bold mb-6">ระบบเชื่อมต่อฐานข้อมูล Supabase ยังไม่สมบูรณ์ โปรดเปิดกล่องตั้งค่าเพื่อกรอกรายละเอียด URL และ Anon Key</p>
        <button id="btn-content-config" class="sketch-btn btn-yellow">เปิดตั้งค่า</button>
      </div>
    `;
    document.getElementById('btn-content-config')?.addEventListener('click', () => {
      configModal?.classList.remove('hidden');
    });
    return;
  }

  // Check and refresh Auth status
  await refreshAuthUI();

  const matched = matchRoute(path);
  
  // Guard admin and authenticated routes
  const accessDenied = checkAccessGuards(path);
  if (accessDenied) {
    showToast('ไม่มีสิทธิ์เข้าถึงหน้านี้ หรือกรุณาเข้าสู่ระบบก่อน', 'error');
    navigate(accessDenied);
    return;
  }

  // Call cleanup on previous controller if exists
  if (activeControllerModule && typeof activeControllerModule.cleanup === 'function') {
    try {
      activeControllerModule.cleanup();
    } catch (err) {
      console.warn('Error cleaning up controller:', err);
    }
  }
  activeControllerModule = null;

  // Render view template
  try {
    if (matched.view) {
      const response = await fetch(matched.view);
      if (!response.ok) throw new Error('Failed to load view');
      let html = await response.text();
      
      // Parse fetched HTML and extract #page-content if it exists
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const pageContent = doc.getElementById('page-content');
      
      if (pageContent) {
        mainContent.innerHTML = pageContent.innerHTML;
      } else {
        mainContent.innerHTML = html; // fallback if no container
      }
      
      // Move sub-view modals to body to solve z-index issues
      const modals = mainContent.querySelectorAll('[id$="-modal"]');
      modals.forEach(modal => {
        document.body.appendChild(modal);
      });
      
      // Dynamically load controller module
      if (matched.controller) {
        const module = await import(/* @vite-ignore */ matched.controller);
        activeControllerModule = module;
        const initFn = matched.initName ? module[matched.initName] : module.init;
        if (module && typeof initFn === 'function') {
          initFn(matched.params);
        }
      }
    } else {
      mainContent.innerHTML = matched.htmlContent;
    }
    
    // Smooth scroll to top on routing
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Highlight active link in Navbar
    updateNavSelection(path);

    // Show/hide floating info button (On all pages)
    const floatingBtn = document.getElementById('btn-floating-info');
    if (floatingBtn) {
      floatingBtn.classList.remove('hidden');
      
      // Auto popup on index if not dismissed forever
      if (path === '/' || path === '/festival') {
        const isDismissed = localStorage.getItem('myfestival_about_dismissed') === 'true';
        if (!isDismissed) {
          const modal = document.getElementById('about-system-modal');
          if (modal && modal.classList.contains('hidden')) {
            await loadAboutInfo();
            modal.classList.remove('hidden');
          }
        }
      }
    }
  } catch (error) {
    console.error('Routing load error:', error);
    mainContent.innerHTML = `
      <div class="sketch-card p-12 text-center bg-white">
        <h2 class="text-3xl font-extrabold mb-4 text-wood-red">⚠️ เกิดข้อผิดพลาด</h2>
        <p class="text-lg font-bold mb-6">ไม่สามารถโหลดหน้าเว็บนี้ได้ หรือระบบกำลังอยู่ในระหว่างเตรียมความพร้อม</p>
        <p class="text-sm text-pencil-light">${error.message}</p>
        <a href="/" class="sketch-btn btn-yellow mt-4">ลองใหม่อีกครั้ง</a>
      </div>
    `;
  }
}

// Verify route permissions based on current user session
function checkAccessGuards(path) {
  const role = currentSession.role;
  const isSystemAdmin = currentSession.user?.email === '6nathan.dev@gmail.com' || localStorage.getItem('myfestival_dev_bypass') === 'true';
  
  if (path === '/admin' && role !== 'admin' && !isSystemAdmin) {
    return '/'; // Redirect admin locked pages to Home
  }
  if (path === '/contributor' && !['contributor', 'admin'].includes(role) && !isSystemAdmin) {
    return '/'; // Redirect contributor dashboard
  }
  if (path === '/saved' && role === 'guest') {
    return '/login'; // Must login to view saved
  }
  if (path === '/profile' && role === 'guest') {
    return '/login'; // Must login to view profile
  }
  if (['/login', '/register'].includes(path) && role !== 'guest') {
    return '/'; // Redirect logged in user from login/register
  }
  return null;
}

// Refresh Header Navigation Links based on active User roles
export async function refreshAuthUI() {
  if (!isConfigured()) return;
  
  try {
    let authStatus;
    if (localStorage.getItem('myfestival_dev_bypass') === 'true') {
      authStatus = {
        user: { id: 'mock-admin-id', email: '6nathan.dev@gmail.com' },
        profile: { id: 'mock-admin-id', email: '6nathan.dev@gmail.com', full_name: 'นารธาร คุณสาร (Dev Bypass)', role: 'admin' },
        role: 'admin'
      };
    } else {
      authStatus = await checkUserRole();
    }
    currentSession = authStatus;
    
    // Subscribe to realtime updates for this user's profile and notifications
    clearNotifChannels();
    if (authStatus.user && authStatus.user.id !== 'mock-admin-id') {
      const supabase = await getSupabase();
      if (supabase) {
        // Realtime profile details updates
        if (!userProfileSubscription) {
          userProfileSubscription = supabase
            .channel(`user-profile-${authStatus.user.id}`)
            .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${authStatus.user.id}` },
              async (payload) => {
                console.log('User profile updated in real-time:', payload.new);
                if (payload.new && payload.new.role !== currentSession.role) {
                  showToast(`บทบาทผู้ใช้งานของคุณถูกอัปเดตเป็น: ${payload.new.role === 'admin' ? 'Admin' : payload.new.role === 'contributor' ? 'Contributor' : 'Member'}`, 'info');
                  
                  if (payload.new.role !== 'admin' && authStatus.user.email === '6nathan.dev@gmail.com') {
                    localStorage.removeItem('myfestival_admin_role_override');
                  }
                  
                  await refreshAuthUI();
                  
                  if (window.location.pathname === '/profile') {
                    routePage('/profile');
                  }
                  
                  const accessDenied = checkAccessGuards(window.location.pathname);
                  if (accessDenied) {
                    navigate(accessDenied);
                  }
                }
              }
            )
            .subscribe();
        }

        // 1. Setup profile notification counts and realtime
        await updateProfileNotificationCount(authStatus.user.id);
        const chanNotif = supabase
          .channel(`nav-notifications-${authStatus.user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${authStatus.user.id}` },
            async () => {
              await updateProfileNotificationCount(authStatus.user.id);
            }
          )
          .subscribe();
        notifChannels.push(chanNotif);

        // 2. Setup admin tasks counts and realtime if user is admin
        const isSystemAdmin = authStatus.user.email === '6nathan.dev@gmail.com' || localStorage.getItem('myfestival_dev_bypass') === 'true';
        if (authStatus.role === 'admin' || isSystemAdmin) {
          await updateAdminNotificationCount();
          
          const chanAdminMsg = supabase
            .channel('nav-admin-messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
              await updateAdminNotificationCount();
            })
            .subscribe();
          notifChannels.push(chanAdminMsg);

          const chanAdminRev = supabase
            .channel('nav-admin-revisions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'message_revisions' }, async () => {
              await updateAdminNotificationCount();
            })
            .subscribe();
          notifChannels.push(chanAdminRev);

          const chanAdminSug = supabase
            .channel('nav-admin-suggestions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'festival_suggestions' }, async () => {
              await updateAdminNotificationCount();
            })
            .subscribe();
          notifChannels.push(chanAdminSug);

          const chanAdminProf = supabase
            .channel('nav-admin-profiles')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, async () => {
              await updateAdminNotificationCount();
            })
            .subscribe();
          notifChannels.push(chanAdminProf);
        }
      }
    }
    
    // Display elements accordingly
    if (authStatus.role !== 'guest') {
      navLogin?.classList.add('hidden');
      navRegister?.classList.add('hidden');
      navLogout?.classList.remove('hidden');
      
      navProfile?.classList.remove('hidden');
      if (navUsername) navUsername.textContent = authStatus.profile?.full_name || authStatus.user.email;
      if (navAvatar && authStatus.profile?.avatar_url) {
        navAvatar.src = authStatus.profile.avatar_url;
      }
      
      // Saved page
      navSaved?.classList.remove('hidden');
      
      const isSystemAdmin = authStatus.user?.email === '6nathan.dev@gmail.com';
      
      // Contributor dashboard
      if (['contributor', 'admin'].includes(authStatus.role) || isSystemAdmin) {
        navContributor?.classList.remove('hidden');
      } else {
        navContributor?.classList.add('hidden');
      }
      
      // Admin dashboard
      if (authStatus.role === 'admin' || isSystemAdmin) {
        navAdmin?.classList.remove('hidden');
      } else {
        navAdmin?.classList.add('hidden');
      }

      // Hide suggest tab for admin, show for standard members and contributors
      if (isAdmin) {
        navSuggest?.classList.add('hidden');
      } else {
        navSuggest?.classList.remove('hidden');
      }
    } else {
      // Guest view
      navLogin?.classList.remove('hidden');
      navRegister?.classList.remove('hidden');
      navLogout?.classList.add('hidden');
      navProfile?.classList.add('hidden');
      navSaved?.classList.add('hidden');
      navContributor?.classList.add('hidden');
      navAdmin?.classList.add('hidden');
      
      // Guest can see suggest tab (will show login alert on click)
      navSuggest?.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error refreshing Auth UI:', error);
  }
}

// Wire up logout button in Navbar
navLogout?.addEventListener('click', async () => {
  if (userProfileSubscription) {
    userProfileSubscription.unsubscribe();
    userProfileSubscription = null;
  }
  clearNotifChannels();
  await signOut();
});

// Highlight active link in Navbar
function updateNavSelection(path) {
  const links = document.querySelectorAll('#main-nav a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path.startsWith(href) && href !== '/')) {
      link.classList.add('bg-wood-yellow', 'shadow-[2px_2px_0px_0px_#4a3c31]', 'border-2', 'border-pencil');
      link.classList.remove('hover:bg-wood-yellow/30');
    } else {
      link.classList.remove('bg-wood-yellow', 'shadow-[2px_2px_0px_0px_#4a3c31]', 'border-2', 'border-pencil');
      link.classList.add('hover:bg-wood-yellow/30');
    }
  });
}

// Global variables & handlers for Suggest Festival modal
let suggestImageBase64 = null;

function handleSuggestImageResize(file) {
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

function initSuggestModalEvents() {
  const modal = document.getElementById('suggest-festival-modal');
  const navSuggestBtn = document.getElementById('nav-suggest');
  const btnClose = document.getElementById('btn-close-suggest');
  const form = document.getElementById('suggest-festival-form');
  const sigInput = document.getElementById('suggest-sig-input');
  const anonCheckbox = document.getElementById('suggest-anonymous-checkbox');
  const fileInput = document.getElementById('suggest-image-input');
  const previewContainer = document.getElementById('suggest-image-preview-container');
  const previewImg = document.getElementById('suggest-image-preview');
  const btnRemoveImage = document.getElementById('btn-remove-suggest-image');
  
  const clearSuggestImage = () => {
    suggestImageBase64 = null;
    if (fileInput) fileInput.value = '';
    if (previewContainer) previewContainer.classList.add('hidden');
    if (previewImg) previewImg.src = '';
  };
  
  navSuggestBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Check if user is guest
    if (!currentSession.user || currentSession.role === 'guest') {
      showToast('กรุณาสมัครบัญชี หรือเข้าสู่ระบบก่อนจึงจะเสนอเทศกาลได้', 'warning');
      return;
    }
    
    clearSuggestImage();
    form?.reset();
    
    // Pre-fill signature
    if (sigInput && currentSession.profile) {
      sigInput.readOnly = true;
      sigInput.classList.add('bg-pencil-soft/20', 'cursor-not-allowed');
      if (anonCheckbox && anonCheckbox.checked) {
        sigInput.value = 'ผู้ไม่ประสงค์ออกนาม';
      } else {
        sigInput.value = currentSession.profile.full_name || 'ผู้เขียน';
      }
    }
    
    modal?.classList.remove('hidden');
  });
  
  if (btnClose && modal) {
    btnClose.addEventListener('click', () => {
      modal.classList.add('hidden');
      form?.reset();
      clearSuggestImage();
    });
  }

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      showToast('กำลังประมวลผลและบีบอัดรูปภาพ...', 'info');
      const base64 = await handleSuggestImageResize(file);
      suggestImageBase64 = base64;
      
      if (previewImg && previewContainer) {
        previewImg.src = base64;
        previewContainer.classList.remove('hidden');
      }
    } catch (err) {
      console.error(err);
      showToast('เกิดข้อผิดพลาดในการโหลดรูปภาพ: ' + err.message, 'error');
      if (fileInput) fileInput.value = '';
    }
  });

  btnRemoveImage?.addEventListener('click', () => {
    clearSuggestImage();
  });
  
  anonCheckbox?.addEventListener('change', () => {
    if (anonCheckbox.checked) {
      sigInput.value = 'ผู้ไม่ประสงค์ออกนาม';
      sigInput.classList.add('text-gray-400');
      sigInput.classList.remove('text-pencil');
    } else {
      sigInput.value = currentSession.profile?.full_name || 'ผู้เขียน';
      sigInput.classList.remove('text-gray-400');
      sigInput.classList.add('text-pencil');
    }
  });
  
  // Initialize Date Pickers for Festival Suggestions
  if (document.getElementById('suggest-start-date')) {
    flatpickr('#suggest-start-date', {
      enableTime: false,
      dateFormat: 'Y-m-d',
      locale: 'th',
      defaultDate: new Date()
    });
  }
  if (document.getElementById('suggest-end-date')) {
    flatpickr('#suggest-end-date', {
      enableTime: false,
      dateFormat: 'Y-m-d',
      locale: 'th',
      defaultDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
  }
  
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supabase = await getSupabase();
    if (!supabase) return;
    
    const name = document.getElementById('suggest-name-input').value.trim();
    const desc = document.getElementById('suggest-desc-input').value.trim();
    const wish = document.getElementById('suggest-wish-input').value.trim();
    const sig = sigInput.value.trim();
    const anonymous = anonCheckbox.checked;
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
          suggested_by: currentSession.user?.id,
          image_url: suggestImageBase64,
          start_date: startDateVal ? new Date(startDateVal).toISOString() : null,
          end_date: endDateVal ? new Date(endDateVal).toISOString() : null,
          status: 'pending'
        });
        
      if (error) throw error;
      
      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: currentSession.user?.id,
        action: 'suggest_festival',
        details: { name: name }
      });
      
      showToast('เสนอชื่อเทศกาลใหม่สำเร็จแล้ว! โปรดรอผู้ดูแลระบบพิจารณา 🎡', 'success');
      modal?.classList.add('hidden');
      form.reset();
      clearSuggestImage();
    } catch (error) {
      console.error('Error suggesting festival:', error);
      showToast('ไม่สามารถส่งข้อเสนอแนะได้: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });
}
