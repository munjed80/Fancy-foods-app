const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const archiver = require('archiver');
const extract = require('extract-zip');
const PDFDocument = require('pdfkit');
const https = require('https');

const FORCE_PACKAGED_ENV = process.env.ELECTRON_FORCE_IS_PACKAGED === 'true' || process.env.ELECTRON_IS_DEV === '0';
const isPackagedLike = () => app.isPackaged || FORCE_PACKAGED_ENV;

let cachedPaths;
function getAppPaths() {
    if (cachedPaths) return cachedPaths;
    const userDataPath = app.getPath('userData');
    cachedPaths = {
        userDataPath,
        databasePath: path.join(userDataPath, 'database'),
        attachmentsPath: path.join(userDataPath, 'attachments'),
        emailsPath: path.join(userDataPath, 'emails'),
        backupPath: path.join(userDataPath, 'backup'),
        pdfsPath: path.join(userDataPath, 'pdfs'),
    };
    cachedPaths.dbFile = path.join(cachedPaths.databasePath, 'fancyfoods.db');
    return cachedPaths;
}

function getDatabasePath() {
    return getAppPaths().dbFile;
}

function ensureDataDirectories() {
    const { databasePath, attachmentsPath, emailsPath, backupPath, pdfsPath } = getAppPaths();
    [databasePath, attachmentsPath, emailsPath, backupPath, pdfsPath].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

const { databasePath, attachmentsPath, emailsPath, backupPath, pdfsPath } = getAppPaths();
const dbFile = getDatabasePath();
let db;
let mainWindow;

// App settings stored in memory
let appSettings = {
    language: 'ar',
    currency: 'SYP',
    lastSync: null
};

function ensureColumn(db, table, columnDef) {
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
        console.log(`Migration: added column ${columnDef} to ${table}`);
    } catch (e) {
        const message = String(e.message).toLowerCase();
        if (message.includes('duplicate column name') || message.includes('already exists')) {
            console.log(`Migration: column ${columnDef} already exists in ${table}`);
        } else {
            console.error('Migration error on', table, columnDef, e);
            throw e;
        }
    }
}

function initializeDatabase() {
    ensureDataDirectories();
    const dbPath = getDatabasePath();
    console.log(`Initializing database at: ${dbPath}`);
    db = new Database(dbPath);

    const migrate = db.transaction(() => {
        // Products table with extended fields for inventory
        db.exec(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                ar TEXT,
                category TEXT DEFAULT 'nuts',
                unit TEXT DEFAULT 'kg',
                price REAL DEFAULT 0,
                stock REAL DEFAULT 0,
                min_stock REAL DEFAULT 0,
                location TEXT DEFAULT 'Main Warehouse',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add stock columns if they don't exist (migration for existing databases)
        ensureColumn(db, 'products', "stock REAL DEFAULT 0");
        ensureColumn(db, 'products', "min_stock REAL DEFAULT 0");
        ensureColumn(db, 'products', "location TEXT DEFAULT 'Main Warehouse'");
        ensureColumn(db, 'products', 'ar TEXT');

        // Suppliers table (NEW)
        db.exec(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                location TEXT,
                phone TEXT,
                email TEXT,
                lead_time INTEGER DEFAULT 7,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Supplier products table (NEW) - links suppliers to products with prices
        db.exec(`
            CREATE TABLE IF NOT EXISTS supplier_products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                supplier_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                price REAL DEFAULT 0,
                available_stock REAL DEFAULT 0,
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
            )
        `);

        // Clients table with extended fields
        db.exec(`
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                ar TEXT,
                phone TEXT,
                whatsapp TEXT,
                address TEXT,
                city TEXT,
                financial_status TEXT DEFAULT 'good',
                credit_limit REAL DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add new columns if they don't exist (migration)
        ensureColumn(db, 'clients', 'address TEXT');
        ensureColumn(db, 'clients', "financial_status TEXT DEFAULT 'good'");
        ensureColumn(db, 'clients', 'credit_limit REAL DEFAULT 0');
        ensureColumn(db, 'clients', 'ar TEXT');

        // Deals table (replaces broker_deals with enhanced workflow)
        db.exec(`
            CREATE TABLE IF NOT EXISTS deals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER,
                supplier_id INTEGER,
                product TEXT NOT NULL,
                quantity REAL DEFAULT 0,
                price_per_ton REAL DEFAULT 0,
                total_value REAL DEFAULT 0,
                commission_rate REAL DEFAULT 2.5,
                commission REAL DEFAULT 0,
                stage TEXT DEFAULT 'offer',
                status TEXT DEFAULT 'draft',
                offer_date DATE,
                order_date DATE,
                delivery_date DATE,
                payment_date DATE,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id),
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
            )
        `);
        ensureColumn(db, 'deals', 'commission_rate REAL DEFAULT 2.5');
        ensureColumn(db, 'deals', 'commission REAL DEFAULT 0');
        ensureColumn(db, 'deals', "stage TEXT DEFAULT 'offer'");
        ensureColumn(db, 'deals', "status TEXT DEFAULT 'draft'");
        ensureColumn(db, 'deals', 'offer_date DATE');
        ensureColumn(db, 'deals', 'order_date DATE');
        ensureColumn(db, 'deals', 'delivery_date DATE');
        ensureColumn(db, 'deals', 'payment_date DATE');

        // Migrate from broker_deals if exists
        const brokerDealsExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='broker_deals'").get();
        if (brokerDealsExists) {
            const oldDeals = db.prepare('SELECT * FROM broker_deals').all();
            if (oldDeals.length > 0) {
                const insertDeal = db.prepare(`
                    INSERT OR IGNORE INTO deals (id, product, quantity, price_per_ton, status, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                for (const deal of oldDeals) {
                    insertDeal.run(deal.id, deal.product, deal.quantity, deal.price_per_ton,
                        deal.status === 'open' ? 'draft' : 'completed', deal.notes, deal.created_at);
                }
            }
        }

        // Shipments table (NEW)
        db.exec(`
            CREATE TABLE IF NOT EXISTS shipments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id INTEGER,
                origin TEXT,
                destination TEXT,
                carrier TEXT,
                tracking_number TEXT,
                eta DATE,
                status TEXT DEFAULT 'pending',
                transport_notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
            )
        `);

        // Storage locations table (NEW)
        db.exec(`
            CREATE TABLE IF NOT EXISTS storage_locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                address TEXT,
                capacity REAL DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert default storage location if none exists
        const locCount = db.prepare('SELECT COUNT(*) as count FROM storage_locations').get();
        if (locCount.count === 0) {
            db.prepare("INSERT INTO storage_locations (name, address) VALUES ('Main Warehouse', 'Default Location')").run();
        }

        // Orders table
        db.exec(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER,
                order_date DATE DEFAULT CURRENT_DATE,
                total_price REAL DEFAULT 0,
                status TEXT DEFAULT 'pending',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        `);

        // Order items table
        db.exec(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER,
                quantity REAL DEFAULT 0,
                price REAL DEFAULT 0,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `);

        // Email templates table
        db.exec(`
            CREATE TABLE IF NOT EXISTS email_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                subject TEXT,
                body TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // SMTP settings table
        db.exec(`
            CREATE TABLE IF NOT EXISTS smtp_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                host TEXT DEFAULT 'smtp-mail.outlook.com',
                port INTEGER DEFAULT 587,
                secure INTEGER DEFAULT 0,
                user TEXT,
                pass TEXT
            )
        `);

        // Insert default SMTP settings if not exists
        const existingSettings = db.prepare('SELECT id FROM smtp_settings WHERE id = 1').get();
        if (!existingSettings) {
            db.prepare('INSERT INTO smtp_settings (id) VALUES (1)').run();
        }

        // Todo list table for simple task management
        db.exec(`
            CREATE TABLE IF NOT EXISTS todo_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                completed INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // App settings table (NEW)
        db.exec(`
            CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                language TEXT DEFAULT 'ar',
                currency TEXT DEFAULT 'SYP',
                last_sync TEXT,
                auto_update INTEGER DEFAULT 1
            )
        `);

        // Add currency column if not exists
        ensureColumn(db, 'app_settings', "currency TEXT DEFAULT 'SYP'");

        const existingAppSettings = db.prepare('SELECT id FROM app_settings WHERE id = 1').get();
        if (!existingAppSettings) {
            db.prepare('INSERT INTO app_settings (id, language, currency) VALUES (1, "ar", "SYP")').run();
        }
    });

    migrate();

    // Load app settings after migrations are done
    const savedSettings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get();
    if (savedSettings) {
        appSettings.language = savedSettings.language || 'ar';
        appSettings.currency = savedSettings.currency || 'SYP';
        appSettings.lastSync = savedSettings.last_sync;
    }
}

function createWindow() {
    const iconPath = path.join(__dirname, 'renderer/assets/icon.png');
    const windowOptions = {
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'FancyFoods Manager v2'
    };
    
    // Only set icon if file exists
    if (fs.existsSync(iconPath)) {
        windowOptions.icon = iconPath;
    }

    mainWindow = new BrowserWindow(windowOptions);

    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    // Open DevTools in development
    if (!isPackagedLike() && process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

async function startApp() {
    try {
        initializeDatabase();
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    } catch (error) {
        console.error('Startup error:', error);
        dialog.showErrorBox('Startup Error', `${error.message}\n\nDatabase path: ${getDatabasePath()}`);
        app.quit();
    }
}

app.whenReady().then(startApp).catch(error => {
    console.error('Unhandled startup rejection:', error);
    dialog.showErrorBox('Startup Error', error.message || 'Unknown error');
    app.quit();
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    if (app && typeof app.isReady === 'function' && app.isReady()) {
        dialog.showErrorBox('Unexpected Error', error.message || 'Unknown error');
    }
});

app.on('window-all-closed', () => {
    if (db) db.close();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ============ PRODUCTS IPC HANDLERS ============
ipcMain.handle('products:getAll', () => {
    return db.prepare('SELECT * FROM products ORDER BY name').all();
});

ipcMain.handle('products:search', (event, query) => {
    return db.prepare('SELECT * FROM products WHERE name LIKE ? ORDER BY name').all(`%${query}%`);
});

ipcMain.handle('products:getById', (event, id) => {
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
});

ipcMain.handle('products:create', (event, product) => {
    const stmt = db.prepare(`
        INSERT INTO products (name, category, unit, price, stock, min_stock, location, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(product.name, product.category, product.unit, product.price, 
        product.stock || 0, product.min_stock || 0, product.location || 'Main Warehouse', product.notes);
    return { id: result.lastInsertRowid, ...product };
});

ipcMain.handle('products:update', (event, product) => {
    const stmt = db.prepare(`
        UPDATE products SET name = ?, category = ?, unit = ?, price = ?, stock = ?, min_stock = ?, location = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    stmt.run(product.name, product.category, product.unit, product.price, 
        product.stock || 0, product.min_stock || 0, product.location || 'Main Warehouse', product.notes, product.id);
    return product;
});

ipcMain.handle('products:delete', (event, id) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return true;
});

ipcMain.handle('products:getLowStock', () => {
    return db.prepare('SELECT * FROM products WHERE stock <= min_stock AND min_stock > 0 ORDER BY name').all();
});

ipcMain.handle('products:getByLocation', (event, location) => {
    return db.prepare('SELECT * FROM products WHERE location = ? ORDER BY name').all(location);
});

// ============ SUPPLIERS IPC HANDLERS ============
ipcMain.handle('suppliers:getAll', () => {
    return db.prepare('SELECT * FROM suppliers ORDER BY name').all();
});

ipcMain.handle('suppliers:search', (event, query) => {
    return db.prepare('SELECT * FROM suppliers WHERE name LIKE ? OR location LIKE ? ORDER BY name').all(`%${query}%`, `%${query}%`);
});

ipcMain.handle('suppliers:getById', (event, id) => {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (supplier) {
        supplier.products = db.prepare('SELECT * FROM supplier_products WHERE supplier_id = ?').all(id);
    }
    return supplier;
});

ipcMain.handle('suppliers:create', (event, supplier) => {
    const stmt = db.prepare(`
        INSERT INTO suppliers (name, location, phone, email, lead_time, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(supplier.name, supplier.location, supplier.phone, supplier.email, supplier.lead_time || 7, supplier.notes);
    const supplierId = result.lastInsertRowid;
    
    // Insert supplier products if provided
    if (supplier.products && supplier.products.length > 0) {
        const prodStmt = db.prepare(`
            INSERT INTO supplier_products (supplier_id, product_name, price, available_stock)
            VALUES (?, ?, ?, ?)
        `);
        for (const prod of supplier.products) {
            prodStmt.run(supplierId, prod.product_name, prod.price || 0, prod.available_stock || 0);
        }
    }
    
    return { id: supplierId, ...supplier };
});

ipcMain.handle('suppliers:update', (event, supplier) => {
    const stmt = db.prepare(`
        UPDATE suppliers SET name = ?, location = ?, phone = ?, email = ?, lead_time = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    stmt.run(supplier.name, supplier.location, supplier.phone, supplier.email, supplier.lead_time || 7, supplier.notes, supplier.id);
    
    // Update supplier products
    db.prepare('DELETE FROM supplier_products WHERE supplier_id = ?').run(supplier.id);
    if (supplier.products && supplier.products.length > 0) {
        const prodStmt = db.prepare(`
            INSERT INTO supplier_products (supplier_id, product_name, price, available_stock)
            VALUES (?, ?, ?, ?)
        `);
        for (const prod of supplier.products) {
            prodStmt.run(supplier.id, prod.product_name, prod.price || 0, prod.available_stock || 0);
        }
    }
    
    return supplier;
});

ipcMain.handle('suppliers:delete', (event, id) => {
    db.prepare('DELETE FROM supplier_products WHERE supplier_id = ?').run(id);
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    return true;
});

ipcMain.handle('suppliers:getProducts', (event, supplierId) => {
    return db.prepare('SELECT * FROM supplier_products WHERE supplier_id = ?').all(supplierId);
});

ipcMain.handle('suppliers:checkStock', (event, { supplierId, productName, quantity }) => {
    const product = db.prepare('SELECT * FROM supplier_products WHERE supplier_id = ? AND product_name = ?').get(supplierId, productName);
    if (!product) return { available: false, stock: 0 };
    return { 
        available: product.available_stock >= quantity, 
        stock: product.available_stock,
        shortfall: quantity - product.available_stock
    };
});

// ============ CLIENTS IPC HANDLERS ============
ipcMain.handle('clients:getAll', () => {
    return db.prepare('SELECT * FROM clients ORDER BY name').all();
});

ipcMain.handle('clients:search', (event, query) => {
    return db.prepare('SELECT * FROM clients WHERE name LIKE ? OR phone LIKE ? ORDER BY name').all(`%${query}%`, `%${query}%`);
});

ipcMain.handle('clients:getById', (event, id) => {
    return db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
});

ipcMain.handle('clients:create', (event, client) => {
    const stmt = db.prepare(`
        INSERT INTO clients (name, phone, whatsapp, address, city, financial_status, credit_limit, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(client.name, client.phone, client.whatsapp, client.address, client.city, 
        client.financial_status || 'good', client.credit_limit || 0, client.notes);
    return { id: result.lastInsertRowid, ...client };
});

ipcMain.handle('clients:update', (event, client) => {
    const stmt = db.prepare(`
        UPDATE clients SET name = ?, phone = ?, whatsapp = ?, address = ?, city = ?, financial_status = ?, credit_limit = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    stmt.run(client.name, client.phone, client.whatsapp, client.address, client.city, 
        client.financial_status || 'good', client.credit_limit || 0, client.notes, client.id);
    return client;
});

ipcMain.handle('clients:delete', (event, id) => {
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    return true;
});

ipcMain.handle('clients:getOrderHistory', (event, clientId) => {
    return db.prepare(`
        SELECT o.*, 
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
        FROM orders o 
        WHERE o.client_id = ? 
        ORDER BY o.order_date DESC
    `).all(clientId);
});

// ============ DEALS IPC HANDLERS (Enhanced Workflow) ============
ipcMain.handle('deals:getAll', () => {
    return db.prepare(`
        SELECT d.*, c.name as client_name, s.name as supplier_name
        FROM deals d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN suppliers s ON d.supplier_id = s.id
        ORDER BY d.created_at DESC
    `).all();
});

ipcMain.handle('deals:search', (event, query) => {
    return db.prepare(`
        SELECT d.*, c.name as client_name, s.name as supplier_name
        FROM deals d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN suppliers s ON d.supplier_id = s.id
        WHERE d.product LIKE ? OR c.name LIKE ? OR s.name LIKE ?
        ORDER BY d.created_at DESC
    `).all(`%${query}%`, `%${query}%`, `%${query}%`);
});

ipcMain.handle('deals:getById', (event, id) => {
    const deal = db.prepare(`
        SELECT d.*, c.name as client_name, s.name as supplier_name
        FROM deals d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN suppliers s ON d.supplier_id = s.id
        WHERE d.id = ?
    `).get(id);
    
    if (deal) {
        deal.shipments = db.prepare('SELECT * FROM shipments WHERE deal_id = ?').all(id);
    }
    return deal;
});

ipcMain.handle('deals:create', (event, deal) => {
    const totalValue = (deal.quantity || 0) * (deal.price_per_ton || 0);
    const commission = totalValue * ((deal.commission_rate || 2.5) / 100);
    
    const stmt = db.prepare(`
        INSERT INTO deals (client_id, supplier_id, product, quantity, price_per_ton, total_value, commission_rate, commission, stage, status, offer_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
        deal.client_id || null, 
        deal.supplier_id || null, 
        deal.product, 
        deal.quantity || 0, 
        deal.price_per_ton || 0,
        totalValue,
        deal.commission_rate || 2.5,
        commission,
        deal.stage || 'offer',
        deal.status || 'draft',
        deal.offer_date || new Date().toISOString().split('T')[0],
        deal.notes
    );
    
    // Create attachments folder for this deal
    const dealAttachPath = path.join(attachmentsPath, String(result.lastInsertRowid));
    if (!fs.existsSync(dealAttachPath)) {
        fs.mkdirSync(dealAttachPath, { recursive: true });
    }
    
    return { 
        id: result.lastInsertRowid, 
        ...deal, 
        total_value: totalValue, 
        commission: commission 
    };
});

ipcMain.handle('deals:update', (event, deal) => {
    const totalValue = (deal.quantity || 0) * (deal.price_per_ton || 0);
    const commission = totalValue * ((deal.commission_rate || 2.5) / 100);
    
    const stmt = db.prepare(`
        UPDATE deals SET 
            client_id = ?, supplier_id = ?, product = ?, quantity = ?, price_per_ton = ?, 
            total_value = ?, commission_rate = ?, commission = ?, stage = ?, status = ?,
            offer_date = ?, order_date = ?, delivery_date = ?, payment_date = ?, notes = ?, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    stmt.run(
        deal.client_id || null, 
        deal.supplier_id || null, 
        deal.product, 
        deal.quantity || 0, 
        deal.price_per_ton || 0,
        totalValue,
        deal.commission_rate || 2.5,
        commission,
        deal.stage || 'offer',
        deal.status || 'draft',
        deal.offer_date,
        deal.order_date,
        deal.delivery_date,
        deal.payment_date,
        deal.notes, 
        deal.id
    );
    return { ...deal, total_value: totalValue, commission: commission };
});

ipcMain.handle('deals:updateStage', (event, { id, stage, status }) => {
    const dateField = {
        'offer': 'offer_date',
        'order': 'order_date',
        'delivery': 'delivery_date',
        'payment': 'payment_date'
    }[stage];
    
    let query = `UPDATE deals SET stage = ?, status = ?, updated_at = CURRENT_TIMESTAMP`;
    const params = [stage, status || stage];
    
    if (dateField) {
        query += `, ${dateField} = ?`;
        params.push(new Date().toISOString().split('T')[0]);
    }
    
    query += ` WHERE id = ?`;
    params.push(id);
    
    db.prepare(query).run(...params);
    return db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
});

ipcMain.handle('deals:delete', (event, id) => {
    db.prepare('DELETE FROM shipments WHERE deal_id = ?').run(id);
    db.prepare('DELETE FROM deals WHERE id = ?').run(id);
    // Delete attachments folder
    const dealAttachPath = path.join(attachmentsPath, String(id));
    if (fs.existsSync(dealAttachPath)) {
        fs.rmSync(dealAttachPath, { recursive: true });
    }
    return true;
});

ipcMain.handle('deals:getAttachments', (event, dealId) => {
    const dealAttachPath = path.join(attachmentsPath, String(dealId));
    if (!fs.existsSync(dealAttachPath)) {
        return [];
    }
    return fs.readdirSync(dealAttachPath).map(file => ({
        name: file,
        path: path.join(dealAttachPath, file)
    }));
});

ipcMain.handle('deals:addAttachment', async (event, dealId) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        const sourcePath = result.filePaths[0];
        const fileName = path.basename(sourcePath);
        const dealAttachPath = path.join(attachmentsPath, String(dealId));
        
        if (!fs.existsSync(dealAttachPath)) {
            fs.mkdirSync(dealAttachPath, { recursive: true });
        }
        
        const destPath = path.join(dealAttachPath, fileName);
        fs.copyFileSync(sourcePath, destPath);
        
        return { name: fileName, path: destPath };
    }
    return null;
});

ipcMain.handle('deals:openAttachment', (event, filePath) => {
    shell.openPath(filePath);
});

ipcMain.handle('deals:deleteAttachment', (event, filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    return true;
});

// ============ PDF GENERATION ============
ipcMain.handle('pdf:generateOffer', async (event, dealId) => {
    const deal = db.prepare(`
        SELECT d.*, c.name as client_name, c.address as client_address, c.phone as client_phone,
               s.name as supplier_name
        FROM deals d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN suppliers s ON d.supplier_id = s.id
        WHERE d.id = ?
    `).get(dealId);
    
    if (!deal) throw new Error('Deal not found');
    
    const fileName = `offer-${dealId}-${Date.now()}.pdf`;
    const filePath = path.join(pdfsPath, fileName);
    
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    
    // Header
    doc.fontSize(20).text('OFFER', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('FancyFoods Trading', { align: 'center' });
    doc.moveDown(2);
    
    // Offer details
    doc.fontSize(12);
    doc.text(`Offer #: ${deal.id}`);
    doc.text(`Date: ${deal.offer_date || new Date().toLocaleDateString()}`);
    doc.moveDown();
    
    doc.text(`To: ${deal.client_name || 'N/A'}`);
    if (deal.client_address) doc.text(`Address: ${deal.client_address}`);
    if (deal.client_phone) doc.text(`Phone: ${deal.client_phone}`);
    doc.moveDown();
    
    // Product details
    doc.fontSize(14).text('Product Details:', { underline: true });
    doc.fontSize(12);
    doc.text(`Product: ${deal.product}`);
    doc.text(`Quantity: ${deal.quantity} tons`);
    doc.text(`Price per ton: $${deal.price_per_ton.toFixed(2)}`);
    doc.text(`Total Value: $${deal.total_value.toFixed(2)}`);
    doc.moveDown();
    
    if (deal.notes) {
        doc.text(`Notes: ${deal.notes}`);
    }
    
    doc.moveDown(2);
    doc.text('This offer is valid for 7 days from the date above.');
    doc.moveDown(2);
    doc.text('_________________________');
    doc.text('Authorized Signature');
    
    doc.end();
    
    return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
            shell.openPath(filePath);
            resolve(filePath);
        });
        writeStream.on('error', reject);
    });
});

ipcMain.handle('pdf:generateInvoice', async (event, dealId) => {
    const deal = db.prepare(`
        SELECT d.*, c.name as client_name, c.address as client_address, c.phone as client_phone
        FROM deals d
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE d.id = ?
    `).get(dealId);
    
    if (!deal) throw new Error('Deal not found');
    
    const fileName = `invoice-${dealId}-${Date.now()}.pdf`;
    const filePath = path.join(pdfsPath, fileName);
    
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    
    // Header
    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('FancyFoods Trading', { align: 'center' });
    doc.moveDown(2);
    
    // Invoice details
    doc.fontSize(12);
    doc.text(`Invoice #: INV-${deal.id}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    
    doc.text(`Bill To: ${deal.client_name || 'N/A'}`);
    if (deal.client_address) doc.text(`Address: ${deal.client_address}`);
    doc.moveDown();
    
    // Table header
    doc.fontSize(11);
    const tableTop = doc.y;
    doc.text('Product', 50, tableTop);
    doc.text('Quantity', 200, tableTop);
    doc.text('Price/Ton', 300, tableTop);
    doc.text('Total', 420, tableTop);
    
    doc.moveTo(50, tableTop + 15).lineTo(520, tableTop + 15).stroke();
    
    // Table row
    const rowTop = tableTop + 25;
    doc.text(deal.product, 50, rowTop);
    doc.text(`${deal.quantity} tons`, 200, rowTop);
    doc.text(`$${deal.price_per_ton.toFixed(2)}`, 300, rowTop);
    doc.text(`$${deal.total_value.toFixed(2)}`, 420, rowTop);
    
    doc.moveTo(50, rowTop + 20).lineTo(520, rowTop + 20).stroke();
    
    // Total
    doc.fontSize(12);
    doc.text(`Total: $${deal.total_value.toFixed(2)}`, 420, rowTop + 35);
    
    doc.moveDown(4);
    doc.fontSize(10).text('Thank you for your business!', { align: 'center' });
    
    doc.end();
    
    return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
            shell.openPath(filePath);
            resolve(filePath);
        });
        writeStream.on('error', reject);
    });
});

ipcMain.handle('pdf:generateDeliveryNote', async (event, dealId) => {
    const deal = db.prepare(`
        SELECT d.*, c.name as client_name, c.address as client_address, s.name as supplier_name
        FROM deals d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN suppliers s ON d.supplier_id = s.id
        WHERE d.id = ?
    `).get(dealId);
    
    if (!deal) throw new Error('Deal not found');
    
    const shipment = db.prepare('SELECT * FROM shipments WHERE deal_id = ? ORDER BY id DESC LIMIT 1').get(dealId);
    
    const fileName = `delivery-note-${dealId}-${Date.now()}.pdf`;
    const filePath = path.join(pdfsPath, fileName);
    
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    
    // Header
    doc.fontSize(20).text('DELIVERY NOTE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('FancyFoods Trading', { align: 'center' });
    doc.moveDown(2);
    
    // Delivery details
    doc.fontSize(12);
    doc.text(`Delivery Note #: DN-${deal.id}`);
    doc.text(`Date: ${deal.delivery_date || new Date().toLocaleDateString()}`);
    doc.moveDown();
    
    doc.text(`Deliver To: ${deal.client_name || 'N/A'}`);
    if (deal.client_address) doc.text(`Address: ${deal.client_address}`);
    doc.moveDown();
    
    doc.text(`Supplier: ${deal.supplier_name || 'N/A'}`);
    doc.moveDown();
    
    // Shipment info
    if (shipment) {
        doc.text(`Carrier: ${shipment.carrier || 'N/A'}`);
        doc.text(`Tracking #: ${shipment.tracking_number || 'N/A'}`);
        doc.moveDown();
    }
    
    // Product details
    doc.fontSize(14).text('Items:', { underline: true });
    doc.fontSize(12);
    doc.text(`${deal.product} - ${deal.quantity} tons`);
    
    doc.moveDown(3);
    doc.text('Received by: _________________________');
    doc.moveDown();
    doc.text('Date: _________________________');
    doc.moveDown();
    doc.text('Signature: _________________________');
    
    doc.end();
    
    return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
            shell.openPath(filePath);
            resolve(filePath);
        });
        writeStream.on('error', reject);
    });
});

// ============ SHIPMENTS IPC HANDLERS ============
ipcMain.handle('shipments:getAll', () => {
    return db.prepare(`
        SELECT s.*, d.product as deal_product, d.quantity as deal_quantity,
               c.name as client_name
        FROM shipments s
        LEFT JOIN deals d ON s.deal_id = d.id
        LEFT JOIN clients c ON d.client_id = c.id
        ORDER BY s.created_at DESC
    `).all();
});

ipcMain.handle('shipments:getByDeal', (event, dealId) => {
    return db.prepare('SELECT * FROM shipments WHERE deal_id = ? ORDER BY created_at DESC').all(dealId);
});

ipcMain.handle('shipments:create', (event, shipment) => {
    const stmt = db.prepare(`
        INSERT INTO shipments (deal_id, origin, destination, carrier, tracking_number, eta, status, transport_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
        shipment.deal_id,
        shipment.origin,
        shipment.destination,
        shipment.carrier,
        shipment.tracking_number,
        shipment.eta,
        shipment.status || 'pending',
        shipment.transport_notes
    );
    return { id: result.lastInsertRowid, ...shipment };
});

ipcMain.handle('shipments:update', (event, shipment) => {
    const stmt = db.prepare(`
        UPDATE shipments SET 
            origin = ?, destination = ?, carrier = ?, tracking_number = ?, 
            eta = ?, status = ?, transport_notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    stmt.run(
        shipment.origin,
        shipment.destination,
        shipment.carrier,
        shipment.tracking_number,
        shipment.eta,
        shipment.status,
        shipment.transport_notes,
        shipment.id
    );
    return shipment;
});

ipcMain.handle('shipments:delete', (event, id) => {
    db.prepare('DELETE FROM shipments WHERE id = ?').run(id);
    return true;
});

// ============ STORAGE LOCATIONS IPC HANDLERS ============
ipcMain.handle('locations:getAll', () => {
    return db.prepare('SELECT * FROM storage_locations ORDER BY name').all();
});

ipcMain.handle('locations:create', (event, location) => {
    const stmt = db.prepare(`
        INSERT INTO storage_locations (name, address, capacity, notes)
        VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(location.name, location.address, location.capacity || 0, location.notes);
    return { id: result.lastInsertRowid, ...location };
});

ipcMain.handle('locations:getStockByLocation', () => {
    return db.prepare(`
        SELECT location, SUM(stock) as total_stock, COUNT(*) as product_count
        FROM products
        GROUP BY location
    `).all();
});

// ============ ORDERS IPC HANDLERS ============
ipcMain.handle('orders:getAll', () => {
    return db.prepare(`
        SELECT o.*, c.name as client_name 
        FROM orders o 
        LEFT JOIN clients c ON o.client_id = c.id 
        ORDER BY o.order_date DESC
    `).all();
});

ipcMain.handle('orders:search', (event, query) => {
    return db.prepare(`
        SELECT o.*, c.name as client_name 
        FROM orders o 
        LEFT JOIN clients c ON o.client_id = c.id 
        WHERE c.name LIKE ? OR CAST(o.id AS TEXT) LIKE ?
        ORDER BY o.order_date DESC
    `).all(`%${query}%`, `%${query}%`);
});

ipcMain.handle('orders:getById', (event, id) => {
    const order = db.prepare(`
        SELECT o.*, c.name as client_name 
        FROM orders o 
        LEFT JOIN clients c ON o.client_id = c.id 
        WHERE o.id = ?
    `).get(id);
    
    if (order) {
        order.items = db.prepare(`
            SELECT oi.*, p.name as product_name, p.unit as product_unit
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `).all(id);
    }
    return order;
});

ipcMain.handle('orders:create', (event, order) => {
    const orderStmt = db.prepare(`
        INSERT INTO orders (client_id, order_date, total_price, status, notes)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = orderStmt.run(order.client_id, order.order_date, order.total_price, order.status || 'pending', order.notes);
    const orderId = result.lastInsertRowid;
    
    if (order.items && order.items.length > 0) {
        const itemStmt = db.prepare(`
            INSERT INTO order_items (order_id, product_id, quantity, price)
            VALUES (?, ?, ?, ?)
        `);
        for (const item of order.items) {
            itemStmt.run(orderId, item.product_id, item.quantity, item.price);
        }
    }
    
    return { id: orderId, ...order };
});

ipcMain.handle('orders:update', (event, order) => {
    const orderStmt = db.prepare(`
        UPDATE orders SET client_id = ?, order_date = ?, total_price = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    orderStmt.run(order.client_id, order.order_date, order.total_price, order.status, order.notes, order.id);
    
    // Delete existing items and re-insert
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(order.id);
    
    if (order.items && order.items.length > 0) {
        const itemStmt = db.prepare(`
            INSERT INTO order_items (order_id, product_id, quantity, price)
            VALUES (?, ?, ?, ?)
        `);
        for (const item of order.items) {
            itemStmt.run(order.id, item.product_id, item.quantity, item.price);
        }
    }
    
    return order;
});

ipcMain.handle('orders:delete', (event, id) => {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    return true;
});

// ============ EMAIL IPC HANDLERS ============
ipcMain.handle('email:getSettings', () => {
    return db.prepare('SELECT * FROM smtp_settings WHERE id = 1').get();
});

ipcMain.handle('email:saveSettings', (event, settings) => {
    const stmt = db.prepare(`
        UPDATE smtp_settings SET host = ?, port = ?, secure = ?, user = ?, pass = ?
        WHERE id = 1
    `);
    stmt.run(settings.host, settings.port, settings.secure ? 1 : 0, settings.user, settings.pass);
    return true;
});

ipcMain.handle('email:getTemplates', () => {
    return db.prepare('SELECT * FROM email_templates ORDER BY name').all();
});

ipcMain.handle('email:saveTemplate', (event, template) => {
    if (template.id) {
        const stmt = db.prepare(`
            UPDATE email_templates SET name = ?, subject = ?, body = ?
            WHERE id = ?
        `);
        stmt.run(template.name, template.subject, template.body, template.id);
    } else {
        const stmt = db.prepare(`
            INSERT INTO email_templates (name, subject, body)
            VALUES (?, ?, ?)
        `);
        const result = stmt.run(template.name, template.subject, template.body);
        template.id = result.lastInsertRowid;
    }
    return template;
});

ipcMain.handle('email:deleteTemplate', (event, id) => {
    db.prepare('DELETE FROM email_templates WHERE id = ?').run(id);
    return true;
});

ipcMain.handle('email:send', async (event, emailData) => {
    const settings = db.prepare('SELECT * FROM smtp_settings WHERE id = 1').get();
    
    if (!settings.user || !settings.pass) {
        throw new Error('SMTP settings not configured');
    }
    
    const transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.secure === 1,
        auth: {
            user: settings.user,
            pass: settings.pass
        }
    });
    
    const mailOptions = {
        from: settings.user,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.body
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    // Save sent email as HTML file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `email-${timestamp}.html`;
    const emailContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${emailData.subject}</title></head>
<body>
<div style="padding: 20px; font-family: Arial, sans-serif;">
    <p><strong>To:</strong> ${emailData.to}</p>
    <p><strong>Subject:</strong> ${emailData.subject}</p>
    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    <hr>
    ${emailData.body}
</div>
</body>
</html>
    `;
    fs.writeFileSync(path.join(emailsPath, fileName), emailContent);
    
    return { success: true, messageId: info.messageId };
});

ipcMain.handle('email:getSentEmails', () => {
    if (!fs.existsSync(emailsPath)) {
        return [];
    }
    return fs.readdirSync(emailsPath)
        .filter(file => file.endsWith('.html'))
        .map(file => ({
            name: file,
            path: path.join(emailsPath, file)
        }))
        .reverse();
});

ipcMain.handle('email:openSentEmail', (event, filePath) => {
    shell.openPath(filePath);
});

// ============ WORKFLOW IPC HANDLERS ============
ipcMain.handle('workflow:getData', () => {
    const pendingOrders = db.prepare(`
        SELECT COUNT(*) as count FROM orders WHERE status = 'pending'
    `).get();
    
    const openDeals = db.prepare(`
        SELECT COUNT(*) as count FROM deals WHERE status NOT IN ('completed', 'cancelled')
    `).get();
    
    const recentOrders = db.prepare(`
        SELECT o.*, c.name as client_name 
        FROM orders o 
        LEFT JOIN clients c ON o.client_id = c.id 
        WHERE o.status = 'pending'
        ORDER BY o.order_date DESC
        LIMIT 5
    `).all();
    
    const openBrokerDeals = db.prepare(`
        SELECT d.*, c.name as client_name, s.name as supplier_name
        FROM deals d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN suppliers s ON d.supplier_id = s.id
        WHERE d.status NOT IN ('completed', 'cancelled')
        ORDER BY d.created_at DESC LIMIT 5
    `).all();
    
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get();
    const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients').get();
    const totalSuppliers = db.prepare('SELECT COUNT(*) as count FROM suppliers').get();
    
    const lowStockProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND min_stock > 0').get();
    
    return {
        pendingOrdersCount: pendingOrders.count,
        openDealsCount: openDeals.count,
        recentOrders,
        openBrokerDeals,
        totalProducts: totalProducts.count,
        totalClients: totalClients.count,
        totalSuppliers: totalSuppliers.count,
        lowStockCount: lowStockProducts.count
    };
});

// ============ TODO LIST HANDLERS ============
ipcMain.handle('todo:getAll', () => {
    return db.prepare('SELECT * FROM todo_items ORDER BY completed ASC, created_at DESC').all();
});

ipcMain.handle('todo:add', (event, text) => {
    const stmt = db.prepare('INSERT INTO todo_items (text) VALUES (?)');
    const result = stmt.run(text);
    return { id: result.lastInsertRowid, text, completed: 0 };
});

ipcMain.handle('todo:toggle', (event, id) => {
    db.prepare('UPDATE todo_items SET completed = NOT completed WHERE id = ?').run(id);
    return db.prepare('SELECT * FROM todo_items WHERE id = ?').get(id);
});

ipcMain.handle('todo:delete', (event, id) => {
    db.prepare('DELETE FROM todo_items WHERE id = ?').run(id);
    return true;
});

// ============ BACKUP IPC HANDLERS ============
ipcMain.handle('backup:export', async () => {
    const date = new Date().toISOString().split('T')[0];
    const defaultFileName = `fancyfoods-backup-${date}.zip`;
    
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultFileName,
        filters: [{ name: 'Backup Files', extensions: ['zip'] }]
    });
    
    if (result.canceled) return null;
    
    const output = fs.createWriteStream(result.filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    return new Promise((resolve, reject) => {
        output.on('close', () => resolve(result.filePath));
        archive.on('error', reject);
        
        archive.pipe(output);
        
        // Add database file
        if (fs.existsSync(dbFile)) {
            archive.file(dbFile, { name: 'database/fancyfoods.db' });
        }
        
        // Add attachments folder
        if (fs.existsSync(attachmentsPath)) {
            archive.directory(attachmentsPath, 'attachments');
        }
        
        // Add emails folder
        if (fs.existsSync(emailsPath)) {
            archive.directory(emailsPath, 'emails');
        }
        
        // Add PDFs folder
        if (fs.existsSync(pdfsPath)) {
            archive.directory(pdfsPath, 'pdfs');
        }
        
        archive.finalize();
    });
});

ipcMain.handle('backup:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Backup Files', extensions: ['zip'] }]
    });
    
    if (result.canceled || result.filePaths.length === 0) return null;
    
    const backupFile = result.filePaths[0];
    const tempDir = path.join(backupPath, 'temp_restore');
    
    try {
        // Close current database connection
        if (db) db.close();
        
        // Extract backup to temp directory
        await extract(backupFile, { dir: tempDir });
        
        // Restore database
        const backupDbPath = path.join(tempDir, 'database', 'fancyfoods.db');
        if (fs.existsSync(backupDbPath)) {
            fs.copyFileSync(backupDbPath, dbFile);
        }
        
        // Restore attachments
        const backupAttachPath = path.join(tempDir, 'attachments');
        if (fs.existsSync(backupAttachPath)) {
            fs.rmSync(attachmentsPath, { recursive: true, force: true });
            fs.mkdirSync(attachmentsPath, { recursive: true });
            copyDirRecursive(backupAttachPath, attachmentsPath);
        }
        
        // Restore emails
        const backupEmailsPath = path.join(tempDir, 'emails');
        if (fs.existsSync(backupEmailsPath)) {
            fs.rmSync(emailsPath, { recursive: true, force: true });
            fs.mkdirSync(emailsPath, { recursive: true });
            copyDirRecursive(backupEmailsPath, emailsPath);
        }
        
        // Restore PDFs
        const backupPdfsPath = path.join(tempDir, 'pdfs');
        if (fs.existsSync(backupPdfsPath)) {
            fs.rmSync(pdfsPath, { recursive: true, force: true });
            fs.mkdirSync(pdfsPath, { recursive: true });
            copyDirRecursive(backupPdfsPath, pdfsPath);
        }
        
        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        // Reopen database
        db = new Database(dbFile);
        
        return { success: true };
    } catch (error) {
        // Reopen database on error
        db = new Database(dbFile);
        throw error;
    }
});

function copyDirRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// ============ SETTINGS IPC HANDLERS ============
ipcMain.handle('settings:get', () => {
    const settings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get();
    return {
        language: settings?.language || 'ar',
        currency: settings?.currency || 'SYP',
        lastSync: settings?.last_sync,
        autoUpdate: settings?.auto_update === 1
    };
});

ipcMain.handle('settings:save', (event, settings) => {
    const stmt = db.prepare(`
        UPDATE app_settings SET language = ?, currency = ?, auto_update = ?
        WHERE id = 1
    `);
    stmt.run(settings.language, settings.currency || 'SYP', settings.autoUpdate ? 1 : 0);
    appSettings.language = settings.language;
    appSettings.currency = settings.currency || 'SYP';
    return true;
});

ipcMain.handle('settings:getLanguage', () => {
    return appSettings.language;
});

ipcMain.handle('settings:setLanguage', (event, lang) => {
    db.prepare('UPDATE app_settings SET language = ? WHERE id = 1').run(lang);
    appSettings.language = lang;
    return true;
});

ipcMain.handle('settings:getCurrency', () => {
    return appSettings.currency;
});

ipcMain.handle('settings:setCurrency', (event, currency) => {
    db.prepare('UPDATE app_settings SET currency = ? WHERE id = 1').run(currency);
    appSettings.currency = currency;
    return true;
});

// ============ UPDATE SYSTEM (Simple - just opens browser) ============
ipcMain.handle('update:check', async () => {
    try {
        // Check internet connectivity first
        const online = await checkInternet();
        if (!online) {
            return { available: false, offline: true };
        }
        // Just return online status - user clicks button to go to releases
        return { available: false, online: true };
    } catch (error) {
        return { available: false, offline: true };
    }
});

ipcMain.handle('update:openReleases', async () => {
    // Simply open the GitHub releases page in browser
    shell.openExternal('https://github.com/munjed80/Fancy-foods-app/releases/latest');
    return true;
});

function checkInternet() {
    return new Promise((resolve) => {
        const req = https.get('https://api.github.com', { timeout: 5000 }, (res) => {
            resolve(res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

// ============ SYNC PLACEHOLDER ============
ipcMain.handle('sync:run', async () => {
    // Placeholder for future cloud sync functionality
    // For now, just update the last sync timestamp
    const online = await checkInternet();
    if (!online) {
        return { success: false, offline: true };
    }
    
    const timestamp = new Date().toISOString();
    db.prepare('UPDATE app_settings SET last_sync = ? WHERE id = 1').run(timestamp);
    appSettings.lastSync = timestamp;
    
    return { success: true, timestamp };
});

ipcMain.handle('sync:getStatus', () => {
    return {
        lastSync: appSettings.lastSync,
        enabled: true
    };
});

// ============ UTILITY IPC HANDLERS ============
ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});

ipcMain.handle('app:isOnline', async () => {
    return await checkInternet();
});

ipcMain.handle('dialog:showMessage', async (event, options) => {
    return dialog.showMessageBox(mainWindow, options);
});

ipcMain.handle('app:getDatabasePath', () => {
    return dbFile;
});
