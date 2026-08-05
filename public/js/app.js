/**
 * AURA GOLD & JEWELRY - CORE APPLICATION CONTROLLER
 * Handles Router, Auth Session, API Requests, and UI State
 */

const app = {
  currentUser: null,
  token: localStorage.getItem('aura_token') || null,
  currentView: 'store',

  init() {
    this.checkSession();
    this.setupListeners();
    client.init();
    admin.init();
  },

  async checkSession() {
    if (!this.token) {
      this.updateAuthNav();
      return;
    }

    try {
      const data = await this.api('/auth/me');
      if (data.user) {
        this.currentUser = data.user;
        this.updateAuthNav();
      } else {
        this.logout();
      }
    } catch (err) {
      console.warn('Session check failed:', err.message);
      this.logout();
    }
  },

  updateAuthNav() {
    const navButtons = document.getElementById('authNavButtons');
    const adminNavLink = document.getElementById('navAdmin');

    if (this.currentUser) {
      // Toggle Admin nav link
      if (this.currentUser.role === 'admin') {
        adminNavLink.style.display = 'flex';
      } else {
        adminNavLink.style.display = 'none';
      }

      navButtons.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:0.85rem; color:var(--gold-bright); font-weight:600;">
            <i class="fa-solid fa-user"></i> ${this.escapeHtml(this.currentUser.full_name.split(' ')[0])}
            ${this.currentUser.role === 'admin' ? '<span class="addr-badge">ADMIN</span>' : ''}
          </span>
          <button class="btn btn-glass btn-sm" onclick="app.logout()">
            <i class="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        </div>
      `;
    } else {
      adminNavLink.style.display = 'none';
      navButtons.innerHTML = `
        <button class="btn btn-gold btn-sm" onclick="app.openAuthModal('login')">
          <i class="fa-solid fa-user"></i> Sign In / Register
        </button>
      `;
    }
  },

  navigateTo(viewId) {
    if (viewId === 'admin' && (!this.currentUser || this.currentUser.role !== 'admin')) {
      this.toast('Admin access required. Please sign in with admin credentials.', 'error');
      this.openAuthModal('login');
      return;
    }

    if (viewId === 'my-orders' && !this.currentUser) {
      this.toast('Please sign in to view your booked gold orders.', 'error');
      this.openAuthModal('login');
      return;
    }

    this.currentView = viewId;

    // Toggle active view sections
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    const targetSection = document.getElementById(`view${viewId.charAt(0).toUpperCase() + viewId.slice(1)}`) || document.getElementById('viewStore');
    if (targetSection) targetSection.classList.add('active');

    // Toggle nav active state
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeNavLink = document.getElementById(`nav${viewId.charAt(0).toUpperCase() + viewId.slice(1)}`) || document.getElementById('navStore');
    if (activeNavLink) activeNavLink.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh view specific data
    if (viewId === 'store') client.fetchProducts();
    if (viewId === 'my-orders') client.fetchMyOrders();
    if (viewId === 'admin') admin.loadDashboard();
  },

  // Generic API Helper
  async api(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const response = await fetch(`/api${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API Request failed');
    }

    return data;
  },

  // Auth Modals & Actions
  openAuthModal(tab = 'login') {
    document.getElementById('authModal').classList.add('active');
    this.switchAuthTab(tab);
  },

  closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
  },

  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    if (tab === 'login') {
      document.getElementById('tabLoginBtn').classList.add('active');
      document.getElementById('formLogin').classList.add('active');
    } else {
      document.getElementById('tabRegisterBtn').classList.add('active');
      document.getElementById('formRegister').classList.add('active');
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const data = await this.api('/auth/login', 'POST', { email, password });
      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('aura_token', data.token);

      this.updateAuthNav();
      this.closeAuthModal();
      this.toast(`Welcome back, ${data.user.full_name}!`, 'success');

      if (data.user.role === 'admin') {
        this.navigateTo('admin');
      } else {
        client.fetchMyOrders();
      }
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const full_name = document.getElementById('regFullName').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;

    try {
      const data = await this.api('/auth/register', 'POST', { full_name, email, phone, password });
      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('aura_token', data.token);

      this.updateAuthNav();
      this.closeAuthModal();
      this.toast('Account created successfully!', 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('aura_token');
    this.updateAuthNav();
    this.toast('Signed out successfully.', 'success');
    this.navigateTo('store');
  },

  toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  setupListeners() {
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
