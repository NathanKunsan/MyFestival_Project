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

// Cache current session details
let currentSession = { user: null, profile: null, role: 'guest' };
let userProfileSubscription = null;
let activeControllerModule = null;

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

  // Handle browser back/forward buttons
  window.addEventListener('popstate', () => {
    routePage(window.location.pathname);
  });

  // Run router for initial load
  routePage(window.location.pathname);
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
  window.history.pushState({}, '', path);
  routePage(path);
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
    
    // Subscribe to realtime updates for this user's profile
    if (authStatus.user && authStatus.user.id !== 'mock-admin-id' && !userProfileSubscription) {
      const supabase = await getSupabase();
      if (supabase) {
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
                
                const accessDenied = checkAccessGuards(window.location.pathname);
                if (accessDenied) {
                  navigate(accessDenied);
                }
              }
            }
          )
          .subscribe();
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
    } else {
      // Guest view
      navLogin?.classList.remove('hidden');
      navRegister?.classList.remove('hidden');
      navLogout?.classList.add('hidden');
      navProfile?.classList.add('hidden');
      navSaved?.classList.add('hidden');
      navContributor?.classList.add('hidden');
      navAdmin?.classList.add('hidden');
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
  await signOut();
});

// Update active highlight styling on nav links
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
