const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const { run, get, all, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'aura_gold_secret_jwt_key_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
  }
  next();
}

// -------------------------------------------------------------
// AUTH ROUTES
// -------------------------------------------------------------

app.post('/api/auth/register', async (req, res) => {
  try {
    const { full_name, email, password, phone } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existing = await get(`SELECT id FROM users WHERE email = ?`, [email.toLowerCase().trim()]);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await run(
      `INSERT INTO users (full_name, email, password, phone, role) VALUES (?, ?, ?, ?, 'client')`,
      [full_name.trim(), email.toLowerCase().trim(), hashedPassword, phone || '']
    );

    const user = { id: result.id, full_name, email: email.toLowerCase().trim(), role: 'client' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ message: 'Account created successfully!', token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await get(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const payload = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Login successful', token, user: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await get(`SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = ?`, [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// GOLD RATES ROUTES
// -------------------------------------------------------------

app.get('/api/gold-rates', async (req, res) => {
  try {
    const rates = await get(`SELECT * FROM gold_rates ORDER BY id DESC LIMIT 1`);
    res.json(rates || { karat_24k: 78.5, karat_22k: 72.0, karat_18k: 58.8, currency: 'USD' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/gold-rates', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { karat_24k, karat_22k, karat_18k } = req.body;

    if (!karat_24k || !karat_22k || !karat_18k) {
      return res.status(400).json({ error: 'Must provide rates for 24K, 22K, and 18K gold.' });
    }

    await run(
      `INSERT INTO gold_rates (karat_24k, karat_22k, karat_18k, currency) VALUES (?, ?, ?, 'USD')`,
      [parseFloat(karat_24k), parseFloat(karat_22k), parseFloat(karat_18k)]
    );

    const latest = await get(`SELECT * FROM gold_rates ORDER BY id DESC LIMIT 1`);
    res.json({ message: 'Live Gold rates updated successfully across catalog!', rates: latest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// PRODUCTS ROUTES
// -------------------------------------------------------------

app.get('/api/products', async (req, res) => {
  try {
    const { category, karat } = req.query;
    let sql = `SELECT * FROM products WHERE is_active = 1`;
    const params = [];

    if (category && category !== 'All') {
      sql += ` AND category = ?`;
      params.push(category);
    }
    if (karat && karat !== 'All') {
      sql += ` AND karat = ?`;
      params.push(parseInt(karat));
    }

    sql += ` ORDER BY id DESC`;
    const products = await all(sql, params);

    // Fetch current rates to compute live prices
    const rates = await get(`SELECT * FROM gold_rates ORDER BY id DESC LIMIT 1`);
    const rateMap = {
      24: rates ? rates.karat_24k : 78.50,
      22: rates ? rates.karat_22k : 72.00,
      18: rates ? rates.karat_18k : 58.80
    };

    const calculatedProducts = products.map(p => {
      const goldRatePerGram = rateMap[p.karat] || rateMap[22];
      const baseGoldPrice = p.weight_grams * goldRatePerGram;
      const makingCharges = (baseGoldPrice * (p.making_charge_percent / 100)) + (p.making_charge_fixed || 0);
      const subtotal = baseGoldPrice + makingCharges;
      const taxAmount = subtotal * 0.03; // 3% Gold GST/tax standard
      const estimatedPrice = subtotal + taxAmount;

      return {
        ...p,
        gold_rate_per_gram: goldRatePerGram,
        base_gold_price: Math.round(baseGoldPrice * 100) / 100,
        making_charges: Math.round(makingCharges * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        calculated_price: Math.round(estimatedPrice * 100) / 100
      };
    });

    res.json({ products: calculatedProducts, live_rates: rates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, category, karat, weight_grams, making_charge_percent, making_charge_fixed, description, image_url, stock_quantity } = req.body;

    if (!title || !category || !karat || !weight_grams) {
      return res.status(400).json({ error: 'Title, category, karat, and weight in grams are required.' });
    }

    const result = await run(
      `INSERT INTO products (title, category, karat, weight_grams, making_charge_percent, making_charge_fixed, description, image_url, stock_quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        category,
        parseInt(karat),
        parseFloat(weight_grams),
        parseFloat(making_charge_percent || 12),
        parseFloat(making_charge_fixed || 0),
        description || '',
        image_url || '/assets/gold_ring_royal.png',
        parseInt(stock_quantity || 10)
      ]
    );

    const newProduct = await get(`SELECT * FROM products WHERE id = ?`, [result.id]);
    res.status(201).json({ message: 'Product added successfully!', product: newProduct });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, karat, weight_grams, making_charge_percent, making_charge_fixed, description, image_url, stock_quantity, is_active } = req.body;

    await run(
      `UPDATE products SET title=?, category=?, karat=?, weight_grams=?, making_charge_percent=?, making_charge_fixed=?, description=?, image_url=?, stock_quantity=?, is_active=?
       WHERE id=?`,
      [
        title,
        category,
        parseInt(karat),
        parseFloat(weight_grams),
        parseFloat(making_charge_percent),
        parseFloat(making_charge_fixed),
        description,
        image_url,
        parseInt(stock_quantity),
        is_active !== undefined ? is_active : 1,
        id
      ]
    );

    const updated = await get(`SELECT * FROM products WHERE id = ?`, [id]);
    res.json({ message: 'Product updated successfully!', product: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await run(`UPDATE products SET is_active = 0 WHERE id = ?`, [id]);
    res.json({ message: 'Product archived successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// ADDRESSES ROUTES (ADDRESS CONFIRMATION)
// -------------------------------------------------------------

app.get('/api/addresses', authenticateToken, async (req, res) => {
  try {
    const addresses = await all(`SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC`, [req.user.id]);
    res.json({ addresses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/addresses', authenticateToken, async (req, res) => {
  try {
    const { label, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default } = req.body;

    if (!full_name || !phone || !address_line1 || !city || !state || !postal_code) {
      return res.status(400).json({ error: 'Full name, phone, street address, city, state, and postal code are required.' });
    }

    if (is_default) {
      await run(`UPDATE addresses SET is_default = 0 WHERE user_id = ?`, [req.user.id]);
    }

    const result = await run(
      `INSERT INTO addresses (user_id, label, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        label || 'Home',
        full_name,
        phone,
        address_line1,
        address_line2 || '',
        city,
        state,
        postal_code,
        country || 'United States',
        is_default ? 1 : 0
      ]
    );

    const newAddress = await get(`SELECT * FROM addresses WHERE id = ?`, [result.id]);
    res.status(201).json({ message: 'Address saved successfully!', address: newAddress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// ORDER BOOKING & CHECKOUT ROUTES (NO PAYMENT REQUIRED)
// -------------------------------------------------------------

app.post('/api/orders/book', authenticateToken, async (req, res) => {
  try {
    const { items, shipping_address, billing_address, delivery_preference, booking_notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one gold item.' });
    }

    if (!shipping_address || !shipping_address.address_line1 || !shipping_address.city || !shipping_address.postal_code) {
      return res.status(400).json({ error: 'Verified shipping address is required for order booking.' });
    }

    // Fetch latest live gold rates
    const rates = await get(`SELECT * FROM gold_rates ORDER BY id DESC LIMIT 1`);
    const rateMap = {
      24: rates ? rates.karat_24k : 78.50,
      22: rates ? rates.karat_22k : 72.00,
      18: rates ? rates.karat_18k : 58.80
    };

    let totalWeightGrams = 0;
    let baseGoldAmount = 0;
    let totalMakingCharges = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await get(`SELECT * FROM products WHERE id = ?`, [item.product_id]);
      if (!product) {
        return res.status(400).json({ error: `Product ID ${item.product_id} is no longer available.` });
      }

      const qty = parseInt(item.quantity) || 1;
      const ratePerGram = rateMap[product.karat] || rateMap[22];
      const itemBaseGold = product.weight_grams * ratePerGram * qty;
      const itemMakingCharges = ((product.weight_grams * ratePerGram * (product.making_charge_percent / 100)) + (product.making_charge_fixed || 0)) * qty;
      const itemSubtotal = itemBaseGold + itemMakingCharges;
      const itemTax = itemSubtotal * 0.03;
      const itemUnitPrice = (itemSubtotal + itemTax) / qty;

      totalWeightGrams += product.weight_grams * qty;
      baseGoldAmount += itemBaseGold;
      totalMakingCharges += itemMakingCharges;

      processedItems.push({
        product_id: product.id,
        title: product.title,
        karat: product.karat,
        weight_grams: product.weight_grams,
        unit_price: Math.round(itemUnitPrice * 100) / 100,
        quantity: qty,
        subtotal: Math.round((itemSubtotal + itemTax) * 100) / 100
      });
    }

    const subtotal = baseGoldAmount + totalMakingCharges;
    const taxAmount = subtotal * 0.03;
    const grandTotal = subtotal + taxAmount;

    // Generate unique order number (e.g. AURA-2026-X9A2)
    const orderNumber = `AURA-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Create Order
    const orderResult = await run(
      `INSERT INTO orders (order_number, user_id, status, total_weight_grams, base_gold_amount, total_making_charges, tax_amount, total_amount, shipping_address, billing_address, delivery_preference, booking_notes)
       VALUES (?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber,
        req.user.id,
        Math.round(totalWeightGrams * 100) / 100,
        Math.round(baseGoldAmount * 100) / 100,
        Math.round(totalMakingCharges * 100) / 100,
        Math.round(taxAmount * 100) / 100,
        Math.round(grandTotal * 100) / 100,
        JSON.stringify(shipping_address),
        JSON.stringify(billing_address || shipping_address),
        delivery_preference || 'Secure Courier',
        booking_notes || ''
      ]
    );

    // Save Order Items
    for (const pItem of processedItems) {
      await run(
        `INSERT INTO order_items (order_id, product_id, title, karat, weight_grams, unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderResult.id, pItem.product_id, pItem.title, pItem.karat, pItem.weight_grams, pItem.unit_price, pItem.quantity, pItem.subtotal]
      );
    }

    const createdOrder = await get(`SELECT * FROM orders WHERE id = ?`, [orderResult.id]);
    res.status(201).json({
      message: 'Order reservation booked successfully! No payment required.',
      order: {
        ...createdOrder,
        items: processedItems,
        shipping_address: JSON.parse(createdOrder.shipping_address),
        billing_address: JSON.parse(createdOrder.billing_address)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/my-orders', authenticateToken, async (req, res) => {
  try {
    const orders = await all(`SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC`, [req.user.id]);
    
    for (let order of orders) {
      order.items = await all(`SELECT * FROM order_items WHERE order_id = ?`, [order.id]);
      order.shipping_address = JSON.parse(order.shipping_address || '{}');
      order.billing_address = JSON.parse(order.billing_address || '{}');
    }

    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// ADMIN MANAGEMENT ROUTES
// -------------------------------------------------------------

app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orders = await all(`
      SELECT o.*, u.full_name as customer_name, u.email as customer_email, u.phone as customer_phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.id DESC
    `);

    for (let order of orders) {
      order.items = await all(`SELECT * FROM order_items WHERE order_id = ?`, [order.id]);
      order.shipping_address = JSON.parse(order.shipping_address || '{}');
      order.billing_address = JSON.parse(order.billing_address || '{}');
    }

    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, booking_notes } = req.body;

    const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Ready for Pickup', 'Dispatched', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    await run(`UPDATE orders SET status = ?, booking_notes = COALESCE(?, booking_notes) WHERE id = ?`, [status, booking_notes, id]);
    
    const updated = await get(`SELECT * FROM orders WHERE id = ?`, [id]);
    res.json({ message: `Order #${updated.order_number} status updated to ${status}`, order: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalOrdersRow = await get(`SELECT COUNT(*) as total_count, SUM(total_amount) as total_val, SUM(total_weight_grams) as total_grams FROM orders`);
    const totalProductsRow = await get(`SELECT COUNT(*) as count FROM products WHERE is_active = 1`);
    const totalClientsRow = await get(`SELECT COUNT(*) as count FROM users WHERE role = 'client'`);
    const pendingOrdersRow = await get(`SELECT COUNT(*) as count FROM orders WHERE status = 'Pending'`);

    res.json({
      total_orders: totalOrdersRow.total_count || 0,
      total_revenue: Math.round((totalOrdersRow.total_val || 0) * 100) / 100,
      total_gold_grams: Math.round((totalOrdersRow.total_grams || 0) * 100) / 100,
      total_products: totalProductsRow.count || 0,
      total_clients: totalClientsRow.count || 0,
      pending_orders: pendingOrdersRow.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  AURA GOLD & JEWELRY SERVER RUNNING AT:            `);
    console.log(`  http://localhost:${PORT}                           `);
    console.log(`====================================================`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
