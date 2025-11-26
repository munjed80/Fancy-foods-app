const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const archiver = require('archiver');
const extract = require('extract-zip');

// Paths
const userDataPath = app.getPath('userData');
const databasePath = path.join(userDataPath, 'database');
const attachmentsPath = path.join(userDataPath, 'attachments');
const emailsPath = path.join(userDataPath, 'emails');
const backupPath = path.join(userDataPath, 'backup');

// Ensure directories exist
[databasePath, attachmentsPath, emailsPath, backupPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const dbFile = path.join(databasePath, 'fancyfoods.db');
let db;
let mainWindow;

function initializeDatabase() {
    db = new Database(dbFile);
    
    // Products table
    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT DEFAULT 'nuts',
            unit TEXT DEFAULT 'kg',
            price REAL DEFAULT 0,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Clients table
    db.exec(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            whatsapp TEXT,
            city TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Broker deals table
    db.exec(`
        CREATE TABLE IF NOT EXISTS broker_deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trader_name TEXT NOT NULL,
            product TEXT NOT NULL,
            quantity REAL DEFAULT 0,
            price_per_ton REAL DEFAULT 0,
            supplier TEXT,
            status TEXT DEFAULT 'open',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
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
        title: 'FancyFoods Manager'
    };
    
    // Only set icon if file exists
    if (fs.existsSync(iconPath)) {
        windowOptions.icon = iconPath;
    }
    
    mainWindow = new BrowserWindow(windowOptions);

    mainWindow.loadFile('renderer/index.html');
    
    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    initializeDatabase();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
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
        INSERT INTO products (name, category, unit, price, notes)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(product.name, product.category, product.unit, product.price, product.notes);
    return { id: result.lastInsertRowid, ...product };
});

ipcMain.handle('products:update', (event, product) => {
    const stmt = db.prepare(`
        UPDATE products SET name = ?, category = ?, unit = ?, price = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    stmt.run(product.name, product.category, product.unit, product.price, product.notes, product.id);
    return product;
});

ipcMain.handle('products:delete', (event, id) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return true;
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
        INSERT INTO clients (name, phone, whatsapp, city, notes)
        VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(client.name, client.phone, client.whatsapp, client.city, client.notes);
    return { id: result.lastInsertRowid, ...client };
});

ipcMain.handle('clients:update', (event, client) => {
    const stmt = db.prepare(`
        UPDATE clients SET name = ?, phone = ?, whatsapp = ?, city = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    stmt.run(client.name, client.phone, client.whatsapp, client.city, client.notes, client.id);
    return client;
});

ipcMain.handle('clients:delete', (event, id) => {
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    return true;
});

// ============ BROKER DEALS IPC HANDLERS ============
ipcMain.handle('broker:getAll', () => {
    return db.prepare('SELECT * FROM broker_deals ORDER BY created_at DESC').all();
});

ipcMain.handle('broker:search', (event, query) => {
    return db.prepare('SELECT * FROM broker_deals WHERE trader_name LIKE ? OR product LIKE ? ORDER BY created_at DESC').all(`%${query}%`, `%${query}%`);
});

ipcMain.handle('broker:getById', (event, id) => {
    return db.prepare('SELECT * FROM broker_deals WHERE id = ?').get(id);
});

ipcMain.handle('broker:create', (event, deal) => {
    const stmt = db.prepare(`
        INSERT INTO broker_deals (trader_name, product, quantity, price_per_ton, supplier, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(deal.trader_name, deal.product, deal.quantity, deal.price_per_ton, deal.supplier, deal.status, deal.notes);
    
    // Create attachments folder for this deal
    const dealAttachPath = path.join(attachmentsPath, String(result.lastInsertRowid));
    if (!fs.existsSync(dealAttachPath)) {
        fs.mkdirSync(dealAttachPath, { recursive: true });
    }
    
    return { id: result.lastInsertRowid, ...deal };
});

ipcMain.handle('broker:update', (event, deal) => {
    const stmt = db.prepare(`
        UPDATE broker_deals SET trader_name = ?, product = ?, quantity = ?, price_per_ton = ?, supplier = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    stmt.run(deal.trader_name, deal.product, deal.quantity, deal.price_per_ton, deal.supplier, deal.status, deal.notes, deal.id);
    return deal;
});

ipcMain.handle('broker:delete', (event, id) => {
    db.prepare('DELETE FROM broker_deals WHERE id = ?').run(id);
    // Delete attachments folder
    const dealAttachPath = path.join(attachmentsPath, String(id));
    if (fs.existsSync(dealAttachPath)) {
        fs.rmSync(dealAttachPath, { recursive: true });
    }
    return true;
});

ipcMain.handle('broker:getAttachments', (event, dealId) => {
    const dealAttachPath = path.join(attachmentsPath, String(dealId));
    if (!fs.existsSync(dealAttachPath)) {
        return [];
    }
    return fs.readdirSync(dealAttachPath).map(file => ({
        name: file,
        path: path.join(dealAttachPath, file)
    }));
});

ipcMain.handle('broker:addAttachment', async (event, dealId) => {
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

ipcMain.handle('broker:openAttachment', (event, filePath) => {
    shell.openPath(filePath);
});

ipcMain.handle('broker:deleteAttachment', (event, filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    return true;
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
        WHERE c.name LIKE ? OR o.id LIKE ?
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
        SELECT COUNT(*) as count FROM broker_deals WHERE status = 'open'
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
        SELECT * FROM broker_deals WHERE status = 'open' ORDER BY created_at DESC LIMIT 5
    `).all();
    
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get();
    const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients').get();
    
    return {
        pendingOrdersCount: pendingOrders.count,
        openDealsCount: openDeals.count,
        recentOrders,
        openBrokerDeals,
        totalProducts: totalProducts.count,
        totalClients: totalClients.count
    };
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

// ============ UTILITY IPC HANDLERS ============
ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
});

ipcMain.handle('dialog:showMessage', async (event, options) => {
    return dialog.showMessageBox(mainWindow, options);
});
