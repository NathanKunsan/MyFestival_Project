// MyFestival Auth Service
import { getSupabase } from './supabase.js';

// Get current session user
export const getCurrentUser = async () => {
  const supabase = await getSupabase();
  if (!supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
};

// Fetch user profile from profiles table
export const getUserProfile = async (userId) => {
  const supabase = await getSupabase();
  if (!supabase) return null;

  // Force Admin profile for 6nathan.dev@gmail.com
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id === userId && user.email === '6nathan.dev@gmail.com') {
      const overrideRole = localStorage.getItem('myfestival_admin_role_override') || 'admin';
      const overrideName = localStorage.getItem('myfestival_admin_name_override') || user.user_metadata?.full_name || '6nathan.dev';
      const overrideAvatar = localStorage.getItem('myfestival_admin_avatar_override') || user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${user.email}`;

      // Ensure the profile row exists in the DB so foreign keys don't fail!
      try {
        const { data: existing, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (!existing || checkError) {
          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            full_name: overrideName,
            avatar_url: overrideAvatar,
            role: overrideRole
          });
          console.log('Admin profile auto-inserted into DB');
        }
      } catch (dbErr) {
        console.error('Error ensuring admin profile in DB:', dbErr);
      }

      return {
        id: user.id,
        email: user.email,
        full_name: overrideName,
        avatar_url: overrideAvatar,
        role: overrideRole
      };
    }
  } catch (e) {
    console.error('Error fetching user for hardcode profile:', e);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn('Profile not found, attempting to auto-create profile row for user:', userId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === userId) {
        const defaultRole = user.email === '6nathan.dev@gmail.com' ? 'admin' : 'member';
        const defaultName = user.user_metadata?.full_name || user.email.split('@')[0];
        const defaultAvatar = user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${user.email}`;

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: defaultName,
            avatar_url: defaultAvatar,
            role: defaultRole
          })
          .select()
          .single();

        if (!insertError) {
          console.log('Successfully auto-created profile:', newProfile);
          return newProfile;
        } else {
          console.error('Failed to auto-create profile:', insertError);
        }
      }
    } catch (err) {
      console.error('Error in auto-creating profile:', err);
    }
    return null;
  }
  return data;
};

// Sign Up with Email and Password
export const signUp = async (email, password, fullName, role = 'member') => {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  // Sign up using auth.signUp
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role // 'member' or 'contributor'
      }
    }
  });

  if (error) throw error;
  return data;
};

// Sign In with Email and Password
export const signIn = async (email, password) => {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
};

// Sign In with Google
export const signInWithGoogle = async () => {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) throw error;
  return data;
};

// Sign Out
export const signOut = async () => {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) console.error('Sign out error:', error);

  // Clear cached data if any
  localStorage.removeItem('myfestival_user_role');
  window.location.href = '/#/login';
};

// Check if current user has a specific role
export const checkUserRole = async () => {
  const user = await getCurrentUser();
  if (!user) return { user: null, profile: null, role: 'guest' };

  // Force Admin role for 6nathan.dev@gmail.com
  if (user.email === '6nathan.dev@gmail.com') {
    const overrideRole = localStorage.getItem('myfestival_admin_role_override') || 'admin';
    const overrideName = localStorage.getItem('myfestival_admin_name_override') || user.user_metadata?.full_name || '6nathan.dev';
    const overrideAvatar = localStorage.getItem('myfestival_admin_avatar_override') || user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${user.email}`;
    return {
      user,
      profile: {
        id: user.id,
        email: user.email,
        full_name: overrideName,
        avatar_url: overrideAvatar,
        role: overrideRole
      },
      role: overrideRole
    };
  }

  const profile = await getUserProfile(user.id);
  if (!profile) return { user, profile: null, role: 'member' }; // fallback

  // Admin lock security rule: email must match 6nathan.dev@gmail.com
  if (profile.role === 'admin' && user.email !== '6nathan.dev@gmail.com') {
    // Force downgrade or reject in security context
    return { user, profile, role: 'member' };
  }

  return { user, profile, role: profile.role };
};

// Initialize Login View Actions
export const initLogin = () => {
  const form = document.getElementById('login-form');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังยืนยันตัวตน... ✏️';

      try {
        const { showToast, navigate } = await import('./router.js');
        await signIn(email, password);
        showToast('เข้าสู่ระบบสำเร็จแล้ว!', 'success');
        setTimeout(() => {
          navigate('/');
        }, 1000);
      } catch (error) {
        const { showToast } = await import('./router.js');
        showToast(error.message || 'รหัสผ่านหรืออีเมลไม่ถูกต้อง', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

};

export const initRegister = () => {
  const form = document.getElementById('register-form');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังสร้างสมุดบัญชี... ✨';

      try {
        const { showToast, navigate } = await import('./router.js');
        await signUp(email, password, name, 'member');
        showToast('สมัครสมาชิกสำเร็จ! โปรดตรวจสอบอีเมลของคุณเพื่อยืนยันบัญชี', 'success');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } catch (error) {
        const { showToast } = await import('./router.js');
        showToast(error.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
};
