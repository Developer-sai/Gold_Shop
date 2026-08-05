/**
 * AURA GOLD & JEWELRY - CLIENT STOREFRONT CONTROLLER
 * Handles Catalog Listing, Cart Management, Address Confirmation, and Order Booking Flow
 */

const client = {
  products: [],
  liveRates: null,
  cart: [],
  addresses: [],
  selectedAddressId: null,
  checkoutStep: 'cart', // 'cart' or 'address'

  async init() {
    await this.fetchGoldRates();
    await this.fetchProducts();
    this.recalculateCustomGold();
  },

  async fetchGoldRates() {
    try {
      const data = await app.api('/gold-rates');
      this.liveRates = data;
      this.updateTickerDisplay();
    } catch (err) {
      console.warn('Failed to load gold rates:', err.message);
    }
  },

  updateTickerDisplay() {
    if (!this.liveRates) return;
    document.getElementById('rate24k').textContent = `$${parseFloat(this.liveRates.karat_24k).toFixed(2)}`;
    document.getElementById('rate22k').textContent = `$${parseFloat(this.liveRates.karat_22k).toFixed(2)}`;
    document.getElementById('rate18k').textContent = `$${parseFloat(this.liveRates.karat_18k).toFixed(2)}`;
  },

  async fetchProducts() {
    try {
      const category = document.getElementById('filterCategory').value;
      const karat = document.getElementById('filterKarat').value;

      let query = `?category=${encodeURIComponent(category)}&karat=${encodeURIComponent(karat)}`;
      const data = await app.api(`/products${query}`);
      this.products = data.products;
      if (data.live_rates) {
        this.liveRates = data.live_rates;
        this.updateTickerDisplay();
      }

      this.renderCatalog();
    } catch (err) {
      app.toast(err.message, 'error');
    }
  },

  filterCatalog() {
    this.fetchProducts();
  },

  renderCatalog() {
    const grid = document.getElementById('catalogGrid');
    if (!grid) return;

    if (!this.products || this.products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 60px 20px;" class="glass-card">
          <i class="fa-solid fa-gem" style="font-size:3rem; color:var(--text-muted); margin-bottom:16px;"></i>
          <h3>No gold items found matching filter criteria</h3>
          <p style="color:var(--text-muted);">Try resetting the category or karat selection.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.products.map(p => `
      <div class="product-card">
        <div class="product-img-wrapper">
          <img src="${p.image_url}" alt="${app.escapeHtml(p.title)}" class="product-img" onerror="this.src='/assets/gold_ring_royal.png'">
          <span class="karat-tag">${p.karat}K Gold</span>
          <span class="weight-tag"><i class="fa-solid fa-weight-hanging"></i> ${p.weight_grams} g</span>
        </div>
        <div class="product-info">
          <span class="product-category">${app.escapeHtml(p.category)}</span>
          <h3 class="product-name">${app.escapeHtml(p.title)}</h3>
          <p class="product-desc">${app.escapeHtml(p.description || '')}</p>

          <div class="price-breakdown-box">
            <div class="p-row">
              <span>Live Metal Rate (${p.karat}K):</span>
              <span>$${p.gold_rate_per_gram.toFixed(2)}/g</span>
            </div>
            <div class="p-row">
              <span>Base Gold Weight (${p.weight_grams}g):</span>
              <span>$${p.base_gold_price.toFixed(2)}</span>
            </div>
            <div class="p-row">
              <span>Crafting & Making Fee (${p.making_charge_percent}%):</span>
              <span>$${p.making_charges.toFixed(2)}</span>
            </div>
            <div class="p-row">
              <span>State Tax (3% GST):</span>
              <span>$${p.tax_amount.toFixed(2)}</span>
            </div>
            <div class="p-row total-row">
              <span>Calculated Price:</span>
              <span>$${p.calculated_price.toFixed(2)}</span>
            </div>
          </div>

          <div class="product-actions">
            <button class="btn btn-gold btn-block" onclick="client.addToCart(${p.id})">
              <i class="fa-solid fa-cart-plus"></i> Reserve & Add to Cart
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  // -------------------------------------------------------------
  // CUSTOM GOLD PRICE CALCULATOR
  // -------------------------------------------------------------
  recalculateCustomGold() {
    const karat = parseInt(document.getElementById('calcKarat').value) || 22;
    const weight = parseFloat(document.getElementById('calcWeight').value) || 10.0;
    const makingPercent = parseFloat(document.getElementById('calcMakingPercent').value) || 12.0;
    const makingFixed = parseFloat(document.getElementById('calcMakingFixed').value) || 20.0;

    const rateMap = {
      24: this.liveRates ? this.liveRates.karat_24k : 78.50,
      22: this.liveRates ? this.liveRates.karat_22k : 72.00,
      18: this.liveRates ? this.liveRates.karat_18k : 58.80
    };

    const ratePerGram = rateMap[karat] || rateMap[22];
    const baseGoldVal = weight * ratePerGram;
    const makingVal = (baseGoldVal * (makingPercent / 100)) + makingFixed;
    const subtotal = baseGoldVal + makingVal;
    const taxVal = subtotal * 0.03;
    const grandTotal = subtotal + taxVal;

    document.getElementById('calcRatePerGram').textContent = `$${ratePerGram.toFixed(2)} / gram`;
    document.getElementById('calcNetWeight').textContent = `${weight.toFixed(1)} grams`;
    document.getElementById('calcBaseVal').textContent = `$${baseGoldVal.toFixed(2)}`;
    document.getElementById('calcMakingVal').textContent = `$${makingVal.toFixed(2)}`;
    document.getElementById('calcTaxVal').textContent = `$${taxVal.toFixed(2)}`;
    document.getElementById('calcGrandTotal').textContent = `$${grandTotal.toFixed(2)}`;
  },

  // -------------------------------------------------------------
  // CART DRAWER & ADDRESS CHECKOUT FLOW
  // -------------------------------------------------------------
  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = this.cart.findIndex(item => item.product.id === productId);
    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += 1;
    } else {
      this.cart.push({ product, quantity: 1 });
    }

    this.updateCartBadge();
    app.toast(`Added "${product.title}" to reservation cart!`, 'success');
    this.openCartDrawer('cart');
  },

  updateCartBadge() {
    const totalQty = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartBadge').textContent = totalQty;
  },

  toggleCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('drawerOverlay');
    const isActive = drawer.classList.contains('active');

    if (isActive) {
      drawer.classList.remove('active');
      overlay.classList.remove('active');
    } else {
      this.openCartDrawer('cart');
    }
  },

  openCartDrawer(step = 'cart') {
    this.checkoutStep = step;
    document.getElementById('cartDrawer').classList.add('active');
    document.getElementById('drawerOverlay').classList.add('active');
    this.renderCartDrawer();
  },

  updateQty(productId, delta) {
    const index = this.cart.findIndex(item => item.product.id === productId);
    if (index > -1) {
      this.cart[index].quantity += delta;
      if (this.cart[index].quantity <= 0) {
        this.cart.splice(index, 1);
      }
    }
    this.updateCartBadge();
    this.renderCartDrawer();
  },

  async renderCartDrawer() {
    const bodyContainer = document.getElementById('cartItemsContainer');
    const footerContainer = document.getElementById('cartDrawerFooter');

    if (this.cart.length === 0) {
      bodyContainer.innerHTML = `
        <div style="text-align:center; padding: 40px 10px;">
          <i class="fa-solid fa-bag-shopping" style="font-size:3rem; color:var(--text-muted); margin-bottom:16px;"></i>
          <h3>Your Reservation Cart is Empty</h3>
          <p style="color:var(--text-muted); font-size:0.9rem;">Browse our 24K, 22K and 18K fine gold catalog to add items.</p>
        </div>
      `;
      footerContainer.innerHTML = '';
      return;
    }

    // Step 1: Cart Items Summary View
    if (this.checkoutStep === 'cart') {
      const grandTotal = this.cart.reduce((sum, item) => sum + (item.product.calculated_price * item.quantity), 0);
      const totalWeight = this.cart.reduce((sum, item) => sum + (item.product.weight_grams * item.quantity), 0);

      bodyContainer.innerHTML = `
        <div style="margin-bottom:16px; font-size:0.85rem; color:var(--text-muted);">
          <i class="fa-solid fa-shield-halved gold-icon"></i> Direct Reservation & Booking (No online payment needed)
        </div>
        ${this.cart.map(item => `
          <div class="cart-item">
            <img src="${item.product.image_url}" class="cart-item-img" onerror="this.src='/assets/gold_ring_royal.png'">
            <div class="cart-item-info">
              <h4 class="cart-item-title">${app.escapeHtml(item.product.title)}</h4>
              <div class="cart-item-meta">${item.product.karat}K Gold • Net Wt: ${item.product.weight_grams}g</div>
              <div class="cart-item-price">$${item.product.calculated_price.toFixed(2)}</div>
              <div class="cart-qty-ctrl">
                <button class="qty-btn" onclick="client.updateQty(${item.product.id}, -1)">-</button>
                <span>Qty: <strong>${item.quantity}</strong></span>
                <button class="qty-btn" onclick="client.updateQty(${item.product.id}, 1)">+</button>
              </div>
            </div>
          </div>
        `).join('')}
      `;

      footerContainer.innerHTML = `
        <div style="margin-bottom: 14px;">
          <div class="p-row">
            <span>Total Gold Weight:</span>
            <strong style="color:#fff;">${totalWeight.toFixed(1)} grams</strong>
          </div>
          <div class="p-row total-row">
            <span>Estimated Booking Total:</span>
            <strong style="color:var(--gold-bright); font-size:1.4rem;">$${grandTotal.toFixed(2)}</strong>
          </div>
        </div>
        <button class="btn btn-gold btn-block" onclick="client.proceedToAddressStep()">
          Proceed to Address Confirmation <i class="fa-solid fa-arrow-right"></i>
        </button>
      `;
    }

    // Step 2: Address Confirmation & Booking Notes View
    else if (this.checkoutStep === 'address') {
      if (!app.currentUser) {
        bodyContainer.innerHTML = `
          <div class="glass-card" style="text-align:center; padding:30px 20px;">
            <i class="fa-solid fa-user-lock" style="font-size:2.5rem; color:var(--gold-bright); margin-bottom:12px;"></i>
            <h3>Account Required for Address Confirmation</h3>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:20px;">Please sign in or create an account to confirm your shipping and billing details.</p>
            <button class="btn btn-gold btn-block" onclick="app.openAuthModal('login')"><i class="fa-solid fa-user"></i> Sign In / Register</button>
          </div>
        `;
        footerContainer.innerHTML = `
          <button class="btn btn-glass btn-block" onclick="client.openCartDrawer('cart')"><i class="fa-solid fa-arrow-left"></i> Back to Cart</button>
        `;
        return;
      }

      await this.fetchUserAddresses();

      bodyContainer.innerHTML = `
        <div style="margin-bottom:16px;">
          <h4 style="font-family:var(--font-serif); color:var(--gold-bright); font-size:1.1rem; margin-bottom:6px;">
            <i class="fa-solid fa-location-dot"></i> Step 2: Delivery & Address Confirmation
          </h4>
          <p style="font-size:0.8rem; color:var(--text-muted);">Confirm where your insured gold booking should be delivered.</p>
        </div>

        <div id="addressSelectionList">
          ${this.addresses.map(addr => `
            <div class="address-card-option ${this.selectedAddressId === addr.id ? 'selected' : ''}" onclick="client.selectAddress(${addr.id})">
              <div class="addr-header">
                <span><i class="fa-solid fa-house"></i> ${app.escapeHtml(addr.label)} - ${app.escapeHtml(addr.full_name)}</span>
                ${addr.is_default ? '<span class="addr-badge">DEFAULT</span>' : ''}
              </div>
              <div class="addr-body">
                <div>${app.escapeHtml(addr.address_line1)} ${app.escapeHtml(addr.address_line2 || '')}</div>
                <div>${app.escapeHtml(addr.city)}, ${app.escapeHtml(addr.state)} ${app.escapeHtml(addr.postal_code)} (${app.escapeHtml(addr.country)})</div>
                <div><i class="fa-solid fa-phone"></i> ${app.escapeHtml(addr.phone)}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- NEW ADDRESS ACCORDION / FORM -->
        <details style="margin-top:16px; background:rgba(20,20,28,0.7); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--glass-border-light);">
          <summary style="cursor:pointer; color:var(--gold-bright); font-weight:600; font-size:0.9rem;">
            <i class="fa-solid fa-plus-circle"></i> Add New Address
          </summary>
          <form onsubmit="client.handleSaveNewAddress(event)" style="margin-top:12px;">
            <div class="form-group">
              <label>Address Label (e.g. Home, Office):</label>
              <input type="text" id="newAddrLabel" value="Home" required>
            </div>
            <div class="form-group">
              <label>Recipient Name:</label>
              <input type="text" id="newAddrName" value="${app.escapeHtml(app.currentUser.full_name)}" required>
            </div>
            <div class="form-group">
              <label>Contact Phone Number:</label>
              <input type="tel" id="newAddrPhone" value="${app.escapeHtml(app.currentUser.phone || '')}" required>
            </div>
            <div class="form-group">
              <label>Street Address Line 1:</label>
              <input type="text" id="newAddrLine1" placeholder="House / Flat No, Street, Landmark" required>
            </div>
            <div class="form-group">
              <label>Street Address Line 2 (Optional):</label>
              <input type="text" id="newAddrLine2" placeholder="Apartment, suite, unit">
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>City:</label>
                <input type="text" id="newAddrCity" placeholder="City" required>
              </div>
              <div class="form-group">
                <label>State / Province:</label>
                <input type="text" id="newAddrState" placeholder="State" required>
              </div>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label>Postal Code / PIN:</label>
                <input type="text" id="newAddrZip" placeholder="90210" required>
              </div>
              <div class="form-group">
                <label>Country:</label>
                <input type="text" id="newAddrCountry" value="United States" required>
              </div>
            </div>
            <button type="submit" class="btn btn-outline btn-block btn-sm"><i class="fa-solid fa-floppy-disk"></i> Save & Use Address</button>
          </form>
        </details>

        <div class="form-group" style="margin-top:20px;">
          <label><i class="fa-solid fa-truck-shield"></i> Delivery Preference:</label>
          <select id="bookingDeliveryPref">
            <option value="Secure Armored Courier">Insured Armored Courier Delivery</option>
            <option value="Store Pickup Verification">In-Store VIP Pickup & Vault Inspection</option>
          </select>
        </div>

        <div class="form-group">
          <label><i class="fa-solid fa-comment-dots"></i> Special Delivery / Booking Notes:</label>
          <textarea id="bookingNotes" rows="2" placeholder="e.g. Ring size preferences, delivery time slot, ID verification notes..."></textarea>
        </div>
      `;

      footerContainer.innerHTML = `
        <div style="display:flex; gap:12px;">
          <button class="btn btn-glass" onclick="client.openCartDrawer('cart')" style="flex:1;"><i class="fa-solid fa-arrow-left"></i> Cart</button>
          <button class="btn btn-gold" onclick="client.submitOrderBooking()" style="flex:2;">
            <i class="fa-solid fa-check-double"></i> Confirm & Book Reservation
          </button>
        </div>
      `;
    }
  },

  proceedToAddressStep() {
    if (!app.currentUser) {
      app.toast('Please sign in or register to complete address confirmation.', 'info');
      app.openAuthModal('login');
      return;
    }
    this.openCartDrawer('address');
  },

  async fetchUserAddresses() {
    try {
      const data = await app.api('/addresses');
      this.addresses = data.addresses || [];
      if (this.addresses.length > 0 && !this.selectedAddressId) {
        const defaultAddr = this.addresses.find(a => a.is_default) || this.addresses[0];
        this.selectedAddressId = defaultAddr.id;
      }
    } catch (err) {
      console.warn('Failed to load user addresses:', err.message);
    }
  },

  selectAddress(id) {
    this.selectedAddressId = id;
    this.renderCartDrawer();
  },

  async handleSaveNewAddress(e) {
    e.preventDefault();
    const label = document.getElementById('newAddrLabel').value;
    const full_name = document.getElementById('newAddrName').value;
    const phone = document.getElementById('newAddrPhone').value;
    const address_line1 = document.getElementById('newAddrLine1').value;
    const address_line2 = document.getElementById('newAddrLine2').value;
    const city = document.getElementById('newAddrCity').value;
    const state = document.getElementById('newAddrState').value;
    const postal_code = document.getElementById('newAddrZip').value;
    const country = document.getElementById('newAddrCountry').value;

    try {
      const data = await app.api('/addresses', 'POST', {
        label, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default: 1
      });
      app.toast('Address added and confirmed!', 'success');
      this.selectedAddressId = data.address.id;
      this.renderCartDrawer();
    } catch (err) {
      app.toast(err.message, 'error');
    }
  },

  async submitOrderBooking() {
    if (this.cart.length === 0) {
      app.toast('Your cart is empty.', 'error');
      return;
    }

    const addressObj = this.addresses.find(a => a.id === this.selectedAddressId);
    if (!addressObj) {
      app.toast('Please select or add a verified shipping address.', 'error');
      return;
    }

    const delivery_preference = document.getElementById('bookingDeliveryPref').value;
    const booking_notes = document.getElementById('bookingNotes').value;

    const payload = {
      items: this.cart.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
      shipping_address: addressObj,
      billing_address: addressObj,
      delivery_preference,
      booking_notes
    };

    try {
      const data = await app.api('/orders/book', 'POST', payload);
      app.toast('Order successfully booked!', 'success');

      // Clear Cart & Close Drawer
      this.cart = [];
      this.updateCartBadge();
      this.toggleCartDrawer();

      // Show Receipt Modal
      this.showReceiptModal(data.order);
    } catch (err) {
      app.toast(err.message, 'error');
    }
  },

  showReceiptModal(order) {
    const modal = document.getElementById('receiptModal');
    const container = document.getElementById('receiptContent');

    container.innerHTML = `
      <div class="receipt-header">
        <div class="receipt-brand">AURA GOLD & JEWELRY</div>
        <div class="receipt-sub">OFFICIAL GOLD BOOKING & RESERVATION RECEIPT</div>
      </div>

      <div style="font-size:0.85rem; color:#333; margin-bottom:16px;">
        <div><strong>Booking Ref #:</strong> ${order.order_number}</div>
        <div><strong>Date & Time:</strong> ${new Date(order.created_at).toLocaleString()}</div>
        <div><strong>Customer Name:</strong> ${app.escapeHtml(app.currentUser.full_name)} (${app.escapeHtml(app.currentUser.email)})</div>
        <div><strong>Delivery Mode:</strong> ${app.escapeHtml(order.delivery_preference)}</div>
      </div>

      <div style="background:#F8F9FA; border:1px solid #DDD; padding:10px; font-size:0.8rem; margin-bottom:16px;">
        <strong>Confirmed Shipping Address:</strong><br>
        ${app.escapeHtml(order.shipping_address.full_name)} | Phone: ${app.escapeHtml(order.shipping_address.phone)}<br>
        ${app.escapeHtml(order.shipping_address.address_line1)}, ${app.escapeHtml(order.shipping_address.city)}, ${app.escapeHtml(order.shipping_address.state)} ${app.escapeHtml(order.shipping_address.postal_code)}
      </div>

      <table class="receipt-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Karat</th>
            <th>Qty</th>
            <th>Net Wt</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td>${app.escapeHtml(item.title)}</td>
              <td>${item.karat}K</td>
              <td>${item.quantity}</td>
              <td>${item.weight_grams * item.quantity}g</td>
              <td>$${item.subtotal.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="receipt-total">
        Reserved Gold Weight: ${order.total_weight_grams} grams<br>
        Total Amount: $${order.total_amount.toFixed(2)}
      </div>

      <div style="margin-top:20px; font-size:0.75rem; color:#666; text-align:center; border-top:1px solid #DDD; padding-top:10px;">
        * No online payment required for booking. Our concierge will contact you for final delivery dispatch verification.
      </div>

      <div style="display:flex; gap:10px; margin-top:20px;">
        <button class="btn btn-outline btn-block" onclick="window.print()"><i class="fa-solid fa-print"></i> Print Receipt</button>
        <button class="btn btn-gold btn-block" onclick="document.getElementById('receiptModal').classList.remove('active'); app.navigateTo('my-orders');">
          <i class="fa-solid fa-box-archive"></i> View in My Bookings
        </button>
      </div>
    `;

    modal.classList.add('active');
  },

  // -------------------------------------------------------------
  // MY ORDERS VIEW
  // -------------------------------------------------------------
  async fetchMyOrders() {
    if (!app.currentUser) return;
    try {
      const data = await app.api('/orders/my-orders');
      this.renderMyOrders(data.orders || []);
    } catch (err) {
      app.toast(err.message, 'error');
    }
  },

  renderMyOrders(orders) {
    const list = document.getElementById('myOrdersList');
    if (!list) return;

    if (orders.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding: 60px 20px;" class="glass-card">
          <i class="fa-solid fa-box-open" style="font-size:3rem; color:var(--text-muted); margin-bottom:16px;"></i>
          <h3>No Gold Reservations Found</h3>
          <p style="color:var(--text-muted);">Explore our collections to reserve fine gold jewelry.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = orders.map(order => `
      <div class="order-card">
        <div class="order-card-header">
          <div>
            <span class="order-number"><i class="fa-solid fa-receipt"></i> ${order.order_number}</span>
            <div class="order-date">Booked on: ${new Date(order.created_at).toLocaleString()}</div>
          </div>
          <span class="status-pill status-${order.status}"><i class="fa-solid fa-circle"></i> ${order.status}</span>
        </div>

        <div class="order-grid-details">
          <div>
            <h4 style="font-size:0.9rem; color:var(--gold-bright); margin-bottom:8px;">Reserved Items:</h4>
            ${order.items.map(item => `
              <div style="display:flex; justify-style:space-between; margin-bottom:4px; font-size:0.85rem;">
                <span>${item.quantity}x ${app.escapeHtml(item.title)} (${item.karat}K Gold • ${item.weight_grams}g)</span>
                <strong style="margin-left:auto; color:#fff;">$${item.subtotal.toFixed(2)}</strong>
              </div>
            `).join('')}
          </div>

          <div>
            <h4 style="font-size:0.9rem; color:var(--gold-bright); margin-bottom:8px;">Confirmed Shipping Address:</h4>
            <div class="address-box-confirmed">
              <div><strong>${app.escapeHtml(order.shipping_address.full_name || '')}</strong></div>
              <div>${app.escapeHtml(order.shipping_address.address_line1 || '')}</div>
              <div>${app.escapeHtml(order.shipping_address.city || '')}, ${app.escapeHtml(order.shipping_address.state || '')} ${app.escapeHtml(order.shipping_address.postal_code || '')}</div>
              <div>Phone: ${app.escapeHtml(order.shipping_address.phone || '')}</div>
            </div>
            <div style="margin-top:10px; font-size:0.9rem;">
              Total Gold Wt: <strong>${order.total_weight_grams} g</strong> | Total: <strong style="color:var(--gold-bright);">$${order.total_amount.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }
};
