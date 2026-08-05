/**
 * AURA GOLD & JEWELRY - SERVER ADMIN CONTROLLER
 * Handles Admin Dashboard, Live Gold Rates, Product Catalog CRUD, and Order Management
 */

const admin = {
  orders: [],
  products: [],
  activeTab: 'orders',

  init() {},

  async loadDashboard() {
    if (!app.currentUser || app.currentUser.role !== 'admin') return;
    await this.fetchStats();
    await this.fetchOrders();
    await this.fetchCatalog();
  },

  async fetchStats() {
    try {
      const stats = await app.api('/admin/stats');
      document.getElementById('adminStatOrders').textContent = stats.total_orders;
      document.getElementById('adminStatGrams').textContent = `${stats.total_gold_grams} g`;
      document.getElementById('adminStatPending').textContent = stats.pending_orders;
      document.getElementById('adminStatRevenue').textContent = `$${stats.total_revenue.toFixed(2)}`;
    } catch (err) {
      console.warn('Failed to load admin stats:', err.message);
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    if (tab === 'orders') {
      document.getElementById('tabOrdersBtn').classList.add('active');
      document.getElementById('adminTabOrders').classList.add('active');
      this.fetchOrders();
    } else {
      document.getElementById('tabCatalogBtn').classList.add('active');
      document.getElementById('adminTabCatalog').classList.add('active');
      this.fetchCatalog();
    }
  },

  // -------------------------------------------------------------
  // LIVE RATES MODAL & UPDATER
  // -------------------------------------------------------------
  openGoldRateModal() {
    if (!client.liveRates) return;
    document.getElementById('editRate24k').value = client.liveRates.karat_24k;
    document.getElementById('editRate22k').value = client.liveRates.karat_22k;
    document.getElementById('editRate18k').value = client.liveRates.karat_18k;
    document.getElementById('rateModal').classList.add('active');
  },

  closeGoldRateModal() {
    document.getElementById('rateModal').classList.remove('active');
  },

  async handleUpdateRates(e) {
    e.preventDefault();
    const karat_24k = parseFloat(document.getElementById('editRate24k').value);
    const karat_22k = parseFloat(document.getElementById('editRate22k').value);
    const karat_18k = parseFloat(document.getElementById('editRate18k').value);

    try {
      const data = await app.api('/gold-rates', 'PUT', { karat_24k, karat_22k, karat_18k });
      app.toast(data.message, 'success');
      client.liveRates = data.rates;
      client.updateTickerDisplay();
      this.closeGoldRateModal();
      client.fetchProducts();
    } catch (err) {
      app.toast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // ORDER MANAGEMENT & ADDRESS AUDIT
  // -------------------------------------------------------------
  async fetchOrders() {
    try {
      const data = await app.api('/admin/orders');
      this.orders = data.orders || [];
      this.renderOrdersTable();
    } catch (err) {
      app.toast(err.message, 'error');
    }
  },

  renderOrdersTable() {
    const tbody = document.getElementById('adminOrdersTableBody');
    if (!tbody) return;

    if (this.orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
            No customer order bookings recorded.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.orders.map(order => `
      <tr>
        <td>
          <strong style="color:var(--gold-bright);">${order.order_number}</strong><br>
          <span style="font-size:0.75rem; color:var(--text-muted);">${new Date(order.created_at).toLocaleDateString()}</span>
        </td>
        <td>
          <strong>${app.escapeHtml(order.customer_name)}</strong><br>
          <span style="font-size:0.8rem; color:var(--text-muted);">${app.escapeHtml(order.customer_email)}</span><br>
          <span style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-phone"></i> ${app.escapeHtml(order.customer_phone || '')}</span>
        </td>
        <td>
          <div style="font-size:0.85rem; max-width:240px;">
            <strong>${app.escapeHtml(order.shipping_address.full_name || '')}</strong><br>
            ${app.escapeHtml(order.shipping_address.address_line1 || '')}<br>
            ${app.escapeHtml(order.shipping_address.city || '')}, ${app.escapeHtml(order.shipping_address.state || '')} ${app.escapeHtml(order.shipping_address.postal_code || '')}
          </div>
        </td>
        <td><strong>${order.total_weight_grams} g</strong></td>
        <td><strong style="color:var(--gold-bright);">$${order.total_amount.toFixed(2)}</strong></td>
        <td>
          <span class="status-pill status-${order.status}">${order.status}</span>
        </td>
        <td>
          <select onchange="admin.updateOrderStatus(${order.id}, this.value)" style="padding:6px 10px; background:#111; border:1px solid var(--glass-border); color:#fff; border-radius:4px; font-size:0.8rem; outline:none;">
            <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending Verification</option>
            <option value="Confirmed" ${order.status === 'Confirmed' ? 'selected' : ''}>Address Confirmed</option>
            <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing / Vault Dispatch</option>
            <option value="Dispatched" ${order.status === 'Dispatched' ? 'selected' : ''}>Dispatched (In Transit)</option>
            <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Delivered / Completed</option>
            <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
      </tr>
    `).join('');
  },

  async updateOrderStatus(orderId, newStatus) {
    try {
      const data = await app.api(`/admin/orders/${orderId}/status`, 'PUT', { status: newStatus });
      app.toast(data.message, 'success');
      this.fetchOrders();
      this.fetchStats();
    } catch (err) {
      app.toast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------
  // CATALOG INVENTORY MANAGEMENT
  // -------------------------------------------------------------
  async fetchCatalog() {
    try {
      const data = await app.api('/products?category=All&karat=All');
      this.products = data.products || [];
      this.renderCatalogTable();
    } catch (err) {
      app.toast(err.message, 'error');
    }
  },

  renderCatalogTable() {
    const tbody = document.getElementById('adminCatalogTableBody');
    if (!tbody) return;

    if (this.products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">
            No products in inventory.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.products.map(p => `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${p.image_url}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;" onerror="this.src='/assets/gold_ring_royal.png'">
            <strong>${app.escapeHtml(p.title)}</strong>
          </div>
        </td>
        <td>${app.escapeHtml(p.category)}</td>
        <td><span class="addr-badge">${p.karat}K</span></td>
        <td>${p.weight_grams} g</td>
        <td>${p.making_charge_percent}% + $${p.making_charge_fixed}</td>
        <td><strong style="color:var(--gold-bright);">$${p.calculated_price.toFixed(2)}</strong></td>
        <td>${p.stock_quantity}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-glass btn-sm" onclick="admin.openProductModal(${p.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-outline btn-sm" onclick="admin.deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  openProductModal(productId = null) {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');

    if (productId) {
      const product = this.products.find(p => p.id === productId);
      if (!product) return;

      title.innerHTML = `<i class="fa-solid fa-pen gold-icon"></i> Edit Product #${product.id}`;
      document.getElementById('editProductId').value = product.id;
      document.getElementById('prodTitle').value = product.title;
      document.getElementById('prodCategory').value = product.category;
      document.getElementById('prodKarat').value = product.karat;
      document.getElementById('prodWeight').value = product.weight_grams;
      document.getElementById('prodMakingPercent').value = product.making_charge_percent;
      document.getElementById('prodMakingFixed').value = product.making_charge_fixed;
      document.getElementById('prodStock').value = product.stock_quantity;
      document.getElementById('prodImageUrl').value = product.image_url;
      document.getElementById('prodDescription').value = product.description || '';
    } else {
      title.innerHTML = `<i class="fa-solid fa-plus gold-icon"></i> Add New Product to Inventory`;
      document.getElementById('editProductId').value = '';
      document.getElementById('prodTitle').value = '';
      document.getElementById('prodCategory').value = 'Rings';
      document.getElementById('prodKarat').value = '22';
      document.getElementById('prodWeight').value = '10.0';
      document.getElementById('prodMakingPercent').value = '12.0';
      document.getElementById('prodMakingFixed').value = '0.0';
      document.getElementById('prodStock').value = '10';
      document.getElementById('prodImageUrl').value = '/assets/gold_ring_royal.png';
      document.getElementById('prodDescription').value = '';
    }

    modal.classList.add('active');
  },

  closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
  },

  async handleSaveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('editProductId').value;
    const title = document.getElementById('prodTitle').value;
    const category = document.getElementById('prodCategory').value;
    const karat = parseInt(document.getElementById('prodKarat').value);
    const weight_grams = parseFloat(document.getElementById('prodWeight').value);
    const making_charge_percent = parseFloat(document.getElementById('prodMakingPercent').value);
    const making_charge_fixed = parseFloat(document.getElementById('prodMakingFixed').value);
    const stock_quantity = parseInt(document.getElementById('prodStock').value);
    const image_url = document.getElementById('prodImageUrl').value;
    const description = document.getElementById('prodDescription').value;

    const payload = {
      title, category, karat, weight_grams, making_charge_percent, making_charge_fixed, stock_quantity, image_url, description
    };

    try {
      if (id) {
        await app.api(`/products/${id}`, 'PUT', payload);
        app.toast('Product updated successfully!', 'success');
      } else {
        await app.api('/products', 'POST', payload);
        app.toast('New product added to catalog!', 'success');
      }

      this.closeProductModal();
      this.fetchCatalog();
      client.fetchProducts();
    } catch (err) {
      app.toast(err.message, 'error');
    }
  },

  async deleteProduct(productId) {
    if (!confirm('Are you sure you want to remove this item from the active catalog?')) return;
    try {
      await app.api(`/products/${productId}`, 'DELETE');
      app.toast('Product archived.', 'success');
      this.fetchCatalog();
      client.fetchProducts();
    } catch (err) {
      app.toast(err.message, 'error');
    }
  }
};
