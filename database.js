const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'gold_shop.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to local SQLite database at:', DB_PATH);
  }
});

// Helper for promise-based queries
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  // Create Users table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'client',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Addresses table
  await run(`
    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      label TEXT DEFAULT 'Home',
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      country TEXT DEFAULT 'United States',
      is_default INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create Gold Rates table
  await run(`
    CREATE TABLE IF NOT EXISTS gold_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      karat_24k REAL NOT NULL,
      karat_22k REAL NOT NULL,
      karat_18k REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Products table
  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      karat INTEGER NOT NULL,
      weight_grams REAL NOT NULL,
      making_charge_percent REAL DEFAULT 12.0,
      making_charge_fixed REAL DEFAULT 0.0,
      description TEXT,
      image_url TEXT,
      stock_quantity INTEGER DEFAULT 10,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Orders table
  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'Pending',
      total_weight_grams REAL NOT NULL,
      base_gold_amount REAL NOT NULL,
      total_making_charges REAL NOT NULL,
      tax_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      shipping_address TEXT NOT NULL,
      billing_address TEXT NOT NULL,
      delivery_preference TEXT DEFAULT 'Secure Courier',
      booking_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Create Order Items table
  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      karat INTEGER NOT NULL,
      weight_grams REAL NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  await seedInitialData();
}

async function seedInitialData() {
  // Check if admin user exists
  const adminExists = await get(`SELECT id FROM users WHERE email = ?`, ['admin@auragold.com']);
  if (!adminExists) {
    const adminHashedPassword = await bcrypt.hash('admin123', 10);
    await run(
      `INSERT INTO users (full_name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)`,
      ['Aura Admin Manager', 'admin@auragold.com', adminHashedPassword, '+1 (555) 019-2831', 'admin']
    );

    const clientHashedPassword = await bcrypt.hash('client123', 10);
    const clientRes = await run(
      `INSERT INTO users (full_name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)`,
      ['Eleanor Vance', 'eleanor@example.com', clientHashedPassword, '+1 (555) 839-1029', 'client']
    );

    // Seed address for client
    await run(
      `INSERT INTO addresses (user_id, label, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientRes.id,
        'Home',
        'Eleanor Vance',
        '+1 (555) 839-1029',
        '742 Evergreen Terrace',
        'Apt 4B',
        'Beverly Hills',
        'California',
        '90210',
        'United States',
        1
      ]
    );

    console.log('Seeded default Admin (admin@auragold.com / admin123) and Client user.');
  }

  // Seed Gold Rates if empty
  const ratesExist = await get(`SELECT id FROM gold_rates LIMIT 1`);
  if (!ratesExist) {
    await run(
      `INSERT INTO gold_rates (karat_24k, karat_22k, karat_18k, currency) VALUES (?, ?, ?, ?)`,
      [78.50, 72.00, 58.80, 'USD']
    );
    console.log('Seeded initial gold live rates (24K: $78.50/g, 22K: $72.00/g, 18K: $58.80/g).');
  }

  // Seed Products if empty
  const productsExist = await get(`SELECT id FROM products LIMIT 1`);
  if (!productsExist) {
    const products = [
      {
        title: 'Royal Emperor 22K Solitaire Ring',
        category: 'Rings',
        karat: 22,
        weight_grams: 8.5,
        making_charge_percent: 10.0,
        making_charge_fixed: 25.0,
        description: 'Hand-sculpted 22-Karat gold ring featuring bespoke filigree artwork and polished mirror finish.',
        image_url: '/assets/gold_ring_royal.png',
        stock_quantity: 15
      },
      {
        title: 'Empress Dowager 22K Choker Necklace',
        category: 'Necklaces',
        karat: 22,
        weight_grams: 34.2,
        making_charge_percent: 14.0,
        making_charge_fixed: 60.0,
        description: 'Statement ceremonial choker crafted in solid 22K gold with high-polish beaded links and secure safety clasp.',
        image_url: '/assets/gold_necklace_queen.png',
        stock_quantity: 8
      },
      {
        title: 'Aura Reserve 24K Pure Bullion Bar (10g)',
        category: 'Coins & Bars',
        karat: 24,
        weight_grams: 10.0,
        making_charge_percent: 3.5,
        making_charge_fixed: 15.0,
        description: 'Certified 999.9 Fine Gold Bullion Bar sealed in tampered-evident security assay packaging.',
        image_url: '/assets/gold_coin_bar.png',
        stock_quantity: 50
      },
      {
        title: 'Majestic Heritage 22K Bangles (Set of 2)',
        category: 'Bangles',
        karat: 22,
        weight_grams: 28.0,
        making_charge_percent: 12.5,
        making_charge_fixed: 40.0,
        description: 'Pair of traditional solid 22K gold bangles decorated with intricate hand-engraved motif scrollwork.',
        image_url: '/assets/gold_bangles_set.png',
        stock_quantity: 12
      },
      {
        title: 'Celestial Pearl & 18K Gold Drop Earrings',
        category: 'Earrings',
        karat: 18,
        weight_grams: 6.2,
        making_charge_percent: 15.0,
        making_charge_fixed: 20.0,
        description: 'Graceful 18K gold earrings with natural freshwater pearls and comfortable push-back post fittings.',
        image_url: '/assets/gold_ring_royal.png',
        stock_quantity: 20
      },
      {
        title: 'Sovereign Crown 24K Minted Gold Coin (5g)',
        category: 'Coins & Bars',
        karat: 24,
        weight_grams: 5.0,
        making_charge_percent: 4.0,
        making_charge_fixed: 10.0,
        description: 'Collector edition 24K gold bullion coin featuring precision micro-minted emblem.',
        image_url: '/assets/gold_coin_bar.png',
        stock_quantity: 35
      }
    ];

    for (const p of products) {
      await run(
        `INSERT INTO products (title, category, karat, weight_grams, making_charge_percent, making_charge_fixed, description, image_url, stock_quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.title, p.category, p.karat, p.weight_grams, p.making_charge_percent, p.making_charge_fixed, p.description, p.image_url, p.stock_quantity]
      );
    }
    console.log('Seeded initial luxury product catalog with images.');
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase
};
