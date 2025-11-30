// FancyFoods Manager v2 - Main Application JavaScript

// ============ GLOBAL STATE ============
let productsData = [];
let clientsData = [];
let suppliersData = [];
let dealsData = [];
let shipmentsData = [];
let emailTemplates = [];
let todoItems = [];
let currentLanguage = 'en';
let currentCurrency = 'SYP';
let translations = {};
let currentDealId = null;

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async () => {
    await loadLanguage();
    setupNavigation();
    setupEventListeners();
    await loadInitialData();
    displayAppVersion();
    checkOnlineStatus();
    showModule('dashboard');
});

// ============ LANGUAGE SYSTEM ============
async function loadLanguage() {
    try {
        const settings = await window.api.settings.get();
        currentLanguage = settings.language || 'en';
        currentCurrency = settings.currency || 'SYP';
        // Load translation file
        const response = await fetch(`../locales/${currentLanguage}.json`);
        translations = await response.json();

        // Set document direction for RTL languages
        document.documentElement.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = currentLanguage;

        syncLanguageControls(currentLanguage);

        applyTranslations();
    } catch (error) {
        console.error('Error loading language:', error);
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const value = getNestedTranslation(key);
        if (value) el.textContent = value;
    });
}

function getNestedTranslation(key) {
    return key.split('.').reduce((obj, k) => obj?.[k], translations);
}

function t(key) {
    return getNestedTranslation(key) || key;
}

function syncLanguageControls(lang) {
    const langSelect = document.getElementById('language-select');
    if (langSelect) langSelect.value = lang;

    document.querySelectorAll('#language-toggle [data-lang]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
}

// ============ NAVIGATION ============
function setupNavigation() {
    document.querySelectorAll('[data-module]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showModule(link.dataset.module);
        });
    });
}

function showModule(moduleName) {
    document.querySelectorAll('.nav-link[data-module]').forEach(link => {
        link.classList.toggle('active', link.dataset.module === moduleName);
    });
    document.querySelectorAll('.module-section').forEach(section => {
        section.classList.toggle('active', section.id === `module-${moduleName}`);
    });

    switch (moduleName) {
        case 'dashboard': loadDashboardData(); break;
        case 'deals': loadDeals(); break;
        case 'products':
        case 'inventory':
            loadProducts(); break;
        case 'logistics': loadLogistics(); break;
        case 'suppliers': loadSuppliers(); break;
        case 'clients': loadClients(); break;
        case 'email': loadEmailData(); break;
        case 'settings': loadSettings(); break;
        case 'tasks':
            loadTodoList();
            break;
        case 'about':
            displayAppVersion();
            break;
    }
}

// ============ INITIAL DATA ============
async function loadInitialData() {
    try {
        [productsData, clientsData, suppliersData, dealsData] = await Promise.all([
            window.api.products.getAll(),
            window.api.clients.getAll(),
            window.api.suppliers.getAll(),
            window.api.deals.getAll()
        ]);
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

async function displayAppVersion() {
    try {
        const version = await window.api.app.getVersion();
        document.getElementById('app-version').textContent = `v${version}`;
        document.getElementById('current-version').textContent = version;
        const aboutVersion = document.getElementById('about-version');
        if (aboutVersion) aboutVersion.textContent = version;
    } catch (error) {
        document.getElementById('app-version').textContent = 'v2.0.0';
        const aboutVersion = document.getElementById('about-version');
        if (aboutVersion) aboutVersion.textContent = '2.0.0';
    }
}

// ============ ONLINE STATUS ============
async function checkOnlineStatus() {
    try {
        const online = await window.api.app.isOnline();
        const statusEl = document.getElementById('online-status');
        const dot = statusEl.querySelector('.status-dot');
        const text = statusEl.querySelector('.status-text');
        
        dot.className = 'status-dot ' + (online ? 'online' : 'offline');
        text.textContent = online ? 'متصل' : 'غير متصل';
    } catch (error) {
        console.error('Error checking online status:', error);
    }
}

// ============ UPDATE SYSTEM (Simple - opens browser) ============
async function checkForUpdatesButton() {
    try {
        const result = await window.api.update.check();
        if (result.offline) {
            showToast('تنبيه', 'غير متصل بالإنترنت');
        } else {
            // Open GitHub releases page
            await window.api.update.openReleases();
            showToast('نجاح', 'تم فتح صفحة التحديثات في المتصفح');
        }
    } catch (error) {
        showToast('خطأ', 'غير متصل بالإنترنت');
    }
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
    // Check for Updates button (simple - just opens browser)
    const btnCheckUpdates = document.getElementById('btn-check-updates');
    if (btnCheckUpdates) {
        btnCheckUpdates.addEventListener('click', checkForUpdatesButton);
    }
    
    // Settings Update Button
    const btnSettingsUpdate = document.getElementById('btn-settings-update');
    if (btnSettingsUpdate) {
        btnSettingsUpdate.addEventListener('click', checkForUpdatesButton);
    }
    
    // Todo List
    const btnAddTodo = document.getElementById('btn-add-todo');
    const todoInput = document.getElementById('todo-input');
    if (btnAddTodo) btnAddTodo.addEventListener('click', addTodoItem);
    if (todoInput) todoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTodoItem(); });
    
    // Products
    document.getElementById('btn-add-product').addEventListener('click', () => openProductModal());
    document.getElementById('btn-save-product').addEventListener('click', saveProduct);
    document.getElementById('products-search').addEventListener('input', debounce(searchProducts, 300));
    
    // Suppliers
    document.getElementById('btn-add-supplier').addEventListener('click', () => openSupplierModal());
    document.getElementById('btn-save-supplier').addEventListener('click', saveSupplier);
    document.getElementById('btn-add-supplier-product').addEventListener('click', addSupplierProductRow);
    document.getElementById('suppliers-search').addEventListener('input', debounce(searchSuppliers, 300));
    
    // Clients
    document.getElementById('btn-add-client').addEventListener('click', () => openClientModal());
    document.getElementById('btn-save-client').addEventListener('click', saveClient);
    document.getElementById('clients-search').addEventListener('input', debounce(searchClients, 300));
    
    // Deals
    document.getElementById('btn-add-deal').addEventListener('click', () => openDealModal());
    document.getElementById('btn-save-deal').addEventListener('click', saveDeal);
    document.getElementById('btn-add-deal-attachment').addEventListener('click', addDealAttachment);
    document.getElementById('deals-search').addEventListener('input', debounce(searchDeals, 300));
    document.getElementById('deal-quantity').addEventListener('input', calculateDealTotals);
    document.getElementById('deal-price').addEventListener('input', calculateDealTotals);
    document.getElementById('deal-commission-rate').addEventListener('input', calculateDealTotals);
    
    // PDF Generation
    document.getElementById('btn-generate-offer').addEventListener('click', () => generatePDF('offer'));
    document.getElementById('btn-generate-invoice').addEventListener('click', () => generatePDF('invoice'));
    document.getElementById('btn-generate-delivery').addEventListener('click', () => generatePDF('delivery'));
    
    // Shipments
    document.getElementById('btn-add-shipment').addEventListener('click', () => openShipmentModal());
    document.getElementById('btn-save-shipment').addEventListener('click', saveShipment);
    
    // Email
    document.getElementById('btn-email-settings').addEventListener('click', openSmtpSettings);
    document.getElementById('btn-save-smtp').addEventListener('click', saveSmtpSettings);
    document.getElementById('btn-send-email').addEventListener('click', sendEmail);
    document.getElementById('btn-save-template').addEventListener('click', openTemplateModal);
    document.getElementById('btn-confirm-save-template').addEventListener('click', saveEmailTemplate);
    
    // Settings
    const langSelect = document.getElementById('language-select');
    if (langSelect) langSelect.addEventListener('change', changeLanguage);

    document.querySelectorAll('#language-toggle [data-lang]').forEach(btn => {
        btn.addEventListener('click', () => changeLanguage(btn.dataset.lang));
    });

    const currencySelect = document.getElementById('currency-select');
    if (currencySelect) currencySelect.addEventListener('change', changeCurrency);

    const btnSettingsSave = document.getElementById('btn-settings-save');
    if (btnSettingsSave) btnSettingsSave.addEventListener('click', saveSettingsChanges);

    const btnSettingsClose = document.getElementById('btn-settings-close');
    if (btnSettingsClose) btnSettingsClose.addEventListener('click', closeSettings);

    const btnSettingsExport = document.getElementById('btn-settings-export');
    const btnSettingsImport = document.getElementById('btn-settings-import');
    if (btnSettingsExport) btnSettingsExport.addEventListener('click', exportBackup);
    if (btnSettingsImport) btnSettingsImport.addEventListener('click', importBackup);
}

// ============ UTILITY FUNCTIONS ============
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function showToast(title, message) {
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-message').textContent = message;
    new bootstrap.Toast(document.getElementById('app-toast')).show();
}

function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    if (currentCurrency === 'SYP') {
        return num.toLocaleString('ar-SY') + ' ل.س';
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusBadge(status) {
    const colors = { open: 'primary', closed: 'success', pending: 'warning', draft: 'secondary', completed: 'success', cancelled: 'danger', good: 'success', overdue: 'danger' };
    return `<span class="badge bg-${colors[status] || 'secondary'}">${status}</span>`;
}

function getStageBadge(stage) {
    const colors = { offer: 'info', order: 'primary', sourcing: 'warning', logistics: 'secondary', delivery: 'info', payment: 'success', commission: 'success' };
    return `<span class="badge bg-${colors[stage] || 'secondary'}">${stage}</span>`;
}

// ============ DASHBOARD ============
async function loadDashboardData() {
    try {
        const data = await window.api.workflow.getData();
        document.getElementById('stat-products').textContent = data.totalProducts;
        document.getElementById('stat-clients').textContent = data.totalClients;
        document.getElementById('stat-suppliers').textContent = data.totalSuppliers;
        document.getElementById('stat-open-deals').textContent = data.openDealsCount;

        const lowStockBadge = document.getElementById('summary-low-stock');
        if (lowStockBadge) lowStockBadge.textContent = data.lowStockCount || 0;
        const pendingDealsBadge = document.getElementById('summary-open-deals');
        if (pendingDealsBadge) pendingDealsBadge.textContent = data.openDealsCount || 0;

        if (data.lowStockCount > 0) {
            document.getElementById('low-stock-alert').style.display = 'block';
            document.getElementById('low-stock-count').textContent = data.lowStockCount;
        }
        
        document.getElementById('open-deals-list').innerHTML = data.openBrokerDeals.length > 0
            ? data.openBrokerDeals.map(d => `<div class="list-group-item"><strong>${escapeHtml(d.product)}</strong> - ${d.quantity} طن ${getStageBadge(d.stage)}</div>`).join('')
            : '<p class="text-muted text-center">لا توجد صفقات مفتوحة</p>';

        // Load todo list
        await loadTodoList();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// ============ TODO LIST ============
async function loadTodoList() {
    try {
        todoItems = await window.api.todo.getAll();
        renderTodoList();
    } catch (error) {
        console.error('Error loading todo list:', error);
    }
}

function renderTodoList() {
    const container = document.getElementById('todo-list');
    if (!container) return;

    if (todoItems.length === 0) {
        container.innerHTML = '<p class="text-muted text-center small">لا توجد مهام</p>';
        updateTaskBadges();
        return;
    }

    container.innerHTML = todoItems.map(item => `
        <div class="list-group-item d-flex justify-content-between align-items-center ${item.completed ? 'text-decoration-line-through text-muted' : ''}">
            <div class="form-check">
                <input class="form-check-input" type="checkbox" ${item.completed ? 'checked' : ''} onchange="toggleTodoItem(${item.id})">
                <label class="form-check-label">${escapeHtml(item.text)}</label>
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteTodoItem(${item.id})">×</button>
        </div>
    `).join('');
    updateTaskBadges();
}

async function addTodoItem() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (!text) return;
    
    try {
        await window.api.todo.add(text);
        input.value = '';
        await loadTodoList();
    } catch (error) {
        showToast('خطأ', 'فشل في إضافة المهمة');
    }
}

window.toggleTodoItem = async (id) => {
    try {
        await window.api.todo.toggle(id);
        await loadTodoList();
    } catch (error) {
        showToast('خطأ', 'فشل في تحديث المهمة');
    }
};

window.deleteTodoItem = async (id) => {
    try {
        await window.api.todo.delete(id);
        await loadTodoList();
    } catch (error) {
        showToast('خطأ', 'فشل في حذف المهمة');
    }
};

function updateTaskBadges() {
    const count = todoItems.length;
    const tasksCount = document.getElementById('tasks-count');
    if (tasksCount) tasksCount.textContent = count;

    const summaryTasks = document.getElementById('summary-open-tasks');
    if (summaryTasks) summaryTasks.textContent = count;
}

// ============ PRODUCTS (INVENTORY) ============
async function loadProducts() {
    productsData = await window.api.products.getAll();
    renderProductsTable(productsData);
}

async function searchProducts(e) {
    const results = e.target.value.trim() ? await window.api.products.search(e.target.value) : await window.api.products.getAll();
    renderProductsTable(results);
}

function renderProductsTable(products) {
    const tbody = document.querySelector('#products-table tbody');
    tbody.innerHTML = products.length === 0 ? '<tr><td colspan="9" class="text-center py-4">No products found</td></tr>' :
        products.map(p => `<tr class="${p.stock <= p.min_stock && p.min_stock > 0 ? 'table-warning' : ''}">
            <td>${p.id}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)}</td><td>${p.unit}</td>
            <td>${formatCurrency(p.price)}</td><td>${p.stock}</td><td>${p.min_stock}</td><td>${escapeHtml(p.location)}</td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="editProduct(${p.id})">✏️</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.id})">🗑️</button></td></tr>`).join('');
}

function openProductModal(product = null) {
    document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add Product';
    document.getElementById('product-id').value = product?.id || '';
    document.getElementById('product-name').value = product?.name || '';
    document.getElementById('product-category').value = product?.category || 'nuts';
    document.getElementById('product-unit').value = product?.unit || 'kg';
    document.getElementById('product-price').value = product?.price || '';
    document.getElementById('product-stock').value = product?.stock || '';
    document.getElementById('product-min-stock').value = product?.min_stock || '';
    document.getElementById('product-location').value = product?.location || 'Main Warehouse';
    document.getElementById('product-notes').value = product?.notes || '';
    new bootstrap.Modal(document.getElementById('product-modal')).show();
}

window.editProduct = async (id) => { openProductModal(await window.api.products.getById(id)); };
window.deleteProduct = async (id) => {
    if ((await window.api.dialog.showMessage({ type: 'question', buttons: ['Cancel', 'Delete'], message: 'Delete this product?' })).response === 1) {
        await window.api.products.delete(id);
        showToast('Success', 'Product deleted');
        loadProducts();
    }
};

async function saveProduct() {
    const product = {
        id: document.getElementById('product-id').value || null,
        name: document.getElementById('product-name').value.trim(),
        category: document.getElementById('product-category').value,
        unit: document.getElementById('product-unit').value,
        price: parseFloat(document.getElementById('product-price').value) || 0,
        stock: parseFloat(document.getElementById('product-stock').value) || 0,
        min_stock: parseFloat(document.getElementById('product-min-stock').value) || 0,
        location: document.getElementById('product-location').value.trim() || 'Main Warehouse',
        notes: document.getElementById('product-notes').value.trim()
    };
    if (!product.name) { showToast('Error', 'Name is required'); return; }
    product.id ? await window.api.products.update(product) : await window.api.products.create(product);
    bootstrap.Modal.getInstance(document.getElementById('product-modal')).hide();
    showToast('Success', 'Product saved');
    loadProducts();
}

// ============ SUPPLIERS ============
async function loadSuppliers() {
    suppliersData = await window.api.suppliers.getAll();
    renderSuppliersTable(suppliersData);
}

async function searchSuppliers(e) {
    const results = e.target.value.trim() ? await window.api.suppliers.search(e.target.value) : await window.api.suppliers.getAll();
    renderSuppliersTable(results);
}

function renderSuppliersTable(suppliers) {
    const tbody = document.querySelector('#suppliers-table tbody');
    tbody.innerHTML = suppliers.length === 0 ? '<tr><td colspan="8" class="text-center py-4">No suppliers found</td></tr>' :
        suppliers.map(s => `<tr><td>${s.id}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.location)}</td>
            <td>${escapeHtml(s.phone)}</td><td>${escapeHtml(s.email)}</td><td>${s.lead_time} days</td><td>-</td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="editSupplier(${s.id})">✏️</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteSupplier(${s.id})">🗑️</button></td></tr>`).join('');
}

function openSupplierModal(supplier = null) {
    document.getElementById('supplier-modal-title').textContent = supplier ? 'Edit Supplier' : 'Add Supplier';
    document.getElementById('supplier-id').value = supplier?.id || '';
    document.getElementById('supplier-name').value = supplier?.name || '';
    document.getElementById('supplier-location').value = supplier?.location || '';
    document.getElementById('supplier-phone').value = supplier?.phone || '';
    document.getElementById('supplier-email').value = supplier?.email || '';
    document.getElementById('supplier-lead-time').value = supplier?.lead_time || 7;
    document.getElementById('supplier-notes').value = supplier?.notes || '';
    document.getElementById('supplier-products-list').innerHTML = '';
    if (supplier?.products) supplier.products.forEach(p => addSupplierProductRow(p));
    new bootstrap.Modal(document.getElementById('supplier-modal')).show();
}

function addSupplierProductRow(product = null) {
    const container = document.getElementById('supplier-products-list');
    const row = document.createElement('div');
    row.className = 'row mb-2 supplier-product-row';
    row.innerHTML = `<div class="col-5"><input type="text" class="form-control form-control-sm" placeholder="Product name" value="${escapeHtml(product?.product_name || '')}"></div>
        <div class="col-3"><input type="number" class="form-control form-control-sm" placeholder="Price" value="${product?.price || ''}"></div>
        <div class="col-3"><input type="number" class="form-control form-control-sm" placeholder="Stock" value="${product?.available_stock || ''}"></div>
        <div class="col-1"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.supplier-product-row').remove()">×</button></div>`;
    container.appendChild(row);
}

window.editSupplier = async (id) => { openSupplierModal(await window.api.suppliers.getById(id)); };
window.deleteSupplier = async (id) => {
    if ((await window.api.dialog.showMessage({ type: 'question', buttons: ['Cancel', 'Delete'], message: 'Delete this supplier?' })).response === 1) {
        await window.api.suppliers.delete(id);
        showToast('Success', 'Supplier deleted');
        loadSuppliers();
    }
};

async function saveSupplier() {
    const products = [];
    document.querySelectorAll('.supplier-product-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        if (inputs[0].value.trim()) {
            products.push({ product_name: inputs[0].value.trim(), price: parseFloat(inputs[1].value) || 0, available_stock: parseFloat(inputs[2].value) || 0 });
        }
    });
    const supplier = {
        id: document.getElementById('supplier-id').value || null,
        name: document.getElementById('supplier-name').value.trim(),
        location: document.getElementById('supplier-location').value.trim(),
        phone: document.getElementById('supplier-phone').value.trim(),
        email: document.getElementById('supplier-email').value.trim(),
        lead_time: parseInt(document.getElementById('supplier-lead-time').value) || 7,
        notes: document.getElementById('supplier-notes').value.trim(),
        products
    };
    if (!supplier.name) { showToast('Error', 'Name is required'); return; }
    supplier.id ? await window.api.suppliers.update(supplier) : await window.api.suppliers.create(supplier);
    bootstrap.Modal.getInstance(document.getElementById('supplier-modal')).hide();
    showToast('Success', 'Supplier saved');
    loadSuppliers();
}

// ============ CLIENTS ============
async function loadClients() {
    clientsData = await window.api.clients.getAll();
    renderClientsTable(clientsData);
}

async function searchClients(e) {
    const results = e.target.value.trim() ? await window.api.clients.search(e.target.value) : await window.api.clients.getAll();
    renderClientsTable(results);
}

function renderClientsTable(clients) {
    const tbody = document.querySelector('#clients-table tbody');
    tbody.innerHTML = clients.length === 0 ? '<tr><td colspan="8" class="text-center py-4">No clients found</td></tr>' :
        clients.map(c => `<tr><td>${c.id}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.phone)}</td>
            <td>${escapeHtml(c.whatsapp)}</td><td>${escapeHtml(c.city)}</td><td>${getStatusBadge(c.financial_status)}</td>
            <td>${formatCurrency(c.credit_limit)}</td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="editClient(${c.id})">✏️</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteClient(${c.id})">🗑️</button></td></tr>`).join('');
}

function openClientModal(client = null) {
    document.getElementById('client-modal-title').textContent = client ? 'Edit Client' : 'Add Client';
    document.getElementById('client-id').value = client?.id || '';
    document.getElementById('client-name').value = client?.name || '';
    document.getElementById('client-phone').value = client?.phone || '';
    document.getElementById('client-whatsapp').value = client?.whatsapp || '';
    document.getElementById('client-address').value = client?.address || '';
    document.getElementById('client-city').value = client?.city || '';
    document.getElementById('client-financial-status').value = client?.financial_status || 'good';
    document.getElementById('client-credit-limit').value = client?.credit_limit || '';
    document.getElementById('client-notes').value = client?.notes || '';
    new bootstrap.Modal(document.getElementById('client-modal')).show();
}

window.editClient = async (id) => { openClientModal(await window.api.clients.getById(id)); };
window.deleteClient = async (id) => {
    if ((await window.api.dialog.showMessage({ type: 'question', buttons: ['Cancel', 'Delete'], message: 'Delete this client?' })).response === 1) {
        await window.api.clients.delete(id);
        showToast('Success', 'Client deleted');
        loadClients();
    }
};

async function saveClient() {
    const client = {
        id: document.getElementById('client-id').value || null,
        name: document.getElementById('client-name').value.trim(),
        phone: document.getElementById('client-phone').value.trim(),
        whatsapp: document.getElementById('client-whatsapp').value.trim(),
        address: document.getElementById('client-address').value.trim(),
        city: document.getElementById('client-city').value.trim(),
        financial_status: document.getElementById('client-financial-status').value,
        credit_limit: parseFloat(document.getElementById('client-credit-limit').value) || 0,
        notes: document.getElementById('client-notes').value.trim()
    };
    if (!client.name) { showToast('Error', 'Name is required'); return; }
    client.id ? await window.api.clients.update(client) : await window.api.clients.create(client);
    bootstrap.Modal.getInstance(document.getElementById('client-modal')).hide();
    showToast('Success', 'Client saved');
    loadClients();
}

// ============ DEALS ============
async function loadDeals() {
    dealsData = await window.api.deals.getAll();
    await populateDealDropdowns();
    renderDealsTable(dealsData);
}

async function searchDeals(e) {
    const results = e.target.value.trim() ? await window.api.deals.search(e.target.value) : await window.api.deals.getAll();
    renderDealsTable(results);
}

async function populateDealDropdowns() {
    clientsData = await window.api.clients.getAll();
    suppliersData = await window.api.suppliers.getAll();
    
    const clientSelect = document.getElementById('deal-client');
    clientSelect.innerHTML = '<option value="">Select client...</option>' + clientsData.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    
    const supplierSelect = document.getElementById('deal-supplier');
    supplierSelect.innerHTML = '<option value="">Select supplier...</option>' + suppliersData.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

function renderDealsTable(deals) {
    const tbody = document.querySelector('#deals-table tbody');
    tbody.innerHTML = deals.length === 0 ? '<tr><td colspan="10" class="text-center py-4">No deals found</td></tr>' :
        deals.map(d => `<tr><td>${d.id}</td><td>${escapeHtml(d.client_name || '-')}</td><td>${escapeHtml(d.supplier_name || '-')}</td>
            <td>${escapeHtml(d.product)}</td><td>${d.quantity}</td><td>${formatCurrency(d.price_per_ton)}</td>
            <td>${formatCurrency(d.total_value)}</td><td>${formatCurrency(d.commission)}</td><td>${getStageBadge(d.stage)}</td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="editDeal(${d.id})">✏️</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteDeal(${d.id})">🗑️</button></td></tr>`).join('');
}

function openDealModal(deal = null) {
    currentDealId = deal?.id || null;
    document.getElementById('deal-modal-title').textContent = deal ? 'Edit Deal' : 'New Deal';
    document.getElementById('deal-id').value = deal?.id || '';
    document.getElementById('deal-client').value = deal?.client_id || '';
    document.getElementById('deal-supplier').value = deal?.supplier_id || '';
    document.getElementById('deal-product').value = deal?.product || '';
    document.getElementById('deal-quantity').value = deal?.quantity || '';
    document.getElementById('deal-price').value = deal?.price_per_ton || '';
    document.getElementById('deal-commission-rate').value = deal?.commission_rate || 2.5;
    document.getElementById('deal-stage').value = deal?.stage || 'offer';
    document.getElementById('deal-status').value = deal?.status || 'draft';
    document.getElementById('deal-notes').value = deal?.notes || '';
    calculateDealTotals();
    
    const attachSection = document.getElementById('deal-attachments-section');
    const pdfButtons = document.getElementById('deal-pdf-buttons');
    if (deal?.id) {
        attachSection.style.display = 'block';
        pdfButtons.style.display = 'block';
        loadDealAttachments(deal.id);
    } else {
        attachSection.style.display = 'none';
        pdfButtons.style.display = 'none';
    }
    
    new bootstrap.Modal(document.getElementById('deal-modal')).show();
}

function calculateDealTotals() {
    const qty = parseFloat(document.getElementById('deal-quantity').value) || 0;
    const price = parseFloat(document.getElementById('deal-price').value) || 0;
    const rate = parseFloat(document.getElementById('deal-commission-rate').value) || 0;
    const total = qty * price;
    const commission = total * (rate / 100);
    document.getElementById('deal-total').value = formatCurrency(total);
    document.getElementById('deal-commission').value = formatCurrency(commission);
}

async function loadDealAttachments(dealId) {
    const attachments = await window.api.deals.getAttachments(dealId);
    document.getElementById('deal-attachments').innerHTML = attachments.map(a => 
        `<span class="badge bg-secondary me-1">${escapeHtml(a.name)} <button type="button" class="btn-close btn-close-white ms-1" style="font-size:0.5em" onclick="deleteDealAttachment('${a.path.replace(/\\/g, '\\\\')}')"></button></span>`
    ).join('');
}

async function addDealAttachment() {
    if (!currentDealId) return;
    const result = await window.api.deals.addAttachment(currentDealId);
    if (result) { showToast('Success', 'Attachment added'); loadDealAttachments(currentDealId); }
}

window.deleteDealAttachment = async (path) => {
    await window.api.deals.deleteAttachment(path);
    if (currentDealId) loadDealAttachments(currentDealId);
};

window.editDeal = async (id) => { await populateDealDropdowns(); openDealModal(await window.api.deals.getById(id)); };
window.deleteDeal = async (id) => {
    if ((await window.api.dialog.showMessage({ type: 'question', buttons: ['Cancel', 'Delete'], message: 'Delete this deal?' })).response === 1) {
        await window.api.deals.delete(id);
        showToast('Success', 'Deal deleted');
        loadDeals();
    }
};

async function saveDeal() {
    const deal = {
        id: document.getElementById('deal-id').value || null,
        client_id: document.getElementById('deal-client').value || null,
        supplier_id: document.getElementById('deal-supplier').value || null,
        product: document.getElementById('deal-product').value.trim(),
        quantity: parseFloat(document.getElementById('deal-quantity').value) || 0,
        price_per_ton: parseFloat(document.getElementById('deal-price').value) || 0,
        commission_rate: parseFloat(document.getElementById('deal-commission-rate').value) || 2.5,
        stage: document.getElementById('deal-stage').value,
        status: document.getElementById('deal-status').value,
        notes: document.getElementById('deal-notes').value.trim()
    };
    if (!deal.product) { showToast('Error', 'Product is required'); return; }
    
    const result = deal.id ? await window.api.deals.update(deal) : await window.api.deals.create(deal);
    if (!deal.id) { currentDealId = result.id; await editDeal(result.id); return; }
    
    bootstrap.Modal.getInstance(document.getElementById('deal-modal')).hide();
    showToast('Success', 'Deal saved');
    loadDeals();
}

async function generatePDF(type) {
    if (!currentDealId) return;
    try {
        if (type === 'offer') await window.api.pdf.generateOffer(currentDealId);
        else if (type === 'invoice') await window.api.pdf.generateInvoice(currentDealId);
        else if (type === 'delivery') await window.api.pdf.generateDeliveryNote(currentDealId);
        showToast('Success', 'PDF generated');
    } catch (error) { showToast('Error', error.message); }
}

// ============ LOGISTICS ============
async function loadLogistics() {
    shipmentsData = await window.api.shipments.getAll();
    renderShipmentsTable(shipmentsData);
    loadStockByLocation();
}

async function loadStockByLocation() {
    const stockData = await window.api.locations.getStockByLocation();
    document.getElementById('stock-by-location').innerHTML = stockData.map(loc => 
        `<div class="col-md-4 mb-3"><div class="card"><div class="card-body">
            <h6>${escapeHtml(loc.location)}</h6>
            <p class="mb-0">${loc.product_count} products, ${loc.total_stock} units</p>
        </div></div></div>`
    ).join('') || '<p class="text-muted">No stock data</p>';
}

function renderShipmentsTable(shipments) {
    const tbody = document.querySelector('#shipments-table tbody');
    tbody.innerHTML = shipments.length === 0 ? '<tr><td colspan="8" class="text-center py-4">No shipments found</td></tr>' :
        shipments.map(s => `<tr><td>${s.id}</td><td>${s.deal_id || '-'}</td><td>${escapeHtml(s.origin)}</td>
            <td>${escapeHtml(s.destination)}</td><td>${escapeHtml(s.carrier)}</td><td>${formatDate(s.eta)}</td>
            <td>${getStatusBadge(s.status)}</td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="editShipment(${s.id})">✏️</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteShipment(${s.id})">🗑️</button></td></tr>`).join('');
}

async function openShipmentModal(shipment = null) {
    dealsData = await window.api.deals.getAll();
    document.getElementById('shipment-deal').innerHTML = '<option value="">Select deal...</option>' + 
        dealsData.map(d => `<option value="${d.id}">${d.id} - ${escapeHtml(d.product)}</option>`).join('');
    
    document.getElementById('shipment-modal-title').textContent = shipment ? 'Edit Shipment' : 'New Shipment';
    document.getElementById('shipment-id').value = shipment?.id || '';
    document.getElementById('shipment-deal').value = shipment?.deal_id || '';
    document.getElementById('shipment-origin').value = shipment?.origin || '';
    document.getElementById('shipment-destination').value = shipment?.destination || '';
    document.getElementById('shipment-carrier').value = shipment?.carrier || '';
    document.getElementById('shipment-tracking').value = shipment?.tracking_number || '';
    document.getElementById('shipment-eta').value = shipment?.eta || '';
    document.getElementById('shipment-status').value = shipment?.status || 'pending';
    document.getElementById('shipment-notes').value = shipment?.transport_notes || '';
    new bootstrap.Modal(document.getElementById('shipment-modal')).show();
}

window.editShipment = async (id) => { openShipmentModal(shipmentsData.find(s => s.id === id)); };
window.deleteShipment = async (id) => {
    if ((await window.api.dialog.showMessage({ type: 'question', buttons: ['Cancel', 'Delete'], message: 'Delete this shipment?' })).response === 1) {
        await window.api.shipments.delete(id);
        showToast('Success', 'Shipment deleted');
        loadLogistics();
    }
};

async function saveShipment() {
    const shipment = {
        id: document.getElementById('shipment-id').value || null,
        deal_id: document.getElementById('shipment-deal').value || null,
        origin: document.getElementById('shipment-origin').value.trim(),
        destination: document.getElementById('shipment-destination').value.trim(),
        carrier: document.getElementById('shipment-carrier').value.trim(),
        tracking_number: document.getElementById('shipment-tracking').value.trim(),
        eta: document.getElementById('shipment-eta').value,
        status: document.getElementById('shipment-status').value,
        transport_notes: document.getElementById('shipment-notes').value.trim()
    };
    shipment.id ? await window.api.shipments.update(shipment) : await window.api.shipments.create(shipment);
    bootstrap.Modal.getInstance(document.getElementById('shipment-modal')).hide();
    showToast('Success', 'Shipment saved');
    loadLogistics();
}

// ============ EMAIL ============
async function loadEmailData() {
    await loadEmailTemplates();
    await loadSentEmails();
}

async function loadEmailTemplates() {
    emailTemplates = await window.api.email.getTemplates();
    document.getElementById('email-templates-list').innerHTML = emailTemplates.length === 0 ? '<p class="text-muted small">No templates</p>' :
        emailTemplates.map(t => `<div class="list-group-item" onclick="loadTemplate(${t.id})">${escapeHtml(t.name)}</div>`).join('');
}

window.loadTemplate = async (id) => {
    const template = emailTemplates.find(t => t.id === id);
    if (template) {
        document.getElementById('email-subject').value = template.subject || '';
        document.getElementById('email-body').value = template.body || '';
    }
};

async function loadSentEmails() {
    const emails = await window.api.email.getSentEmails();
    document.getElementById('sent-emails-list').innerHTML = emails.slice(0, 10).map(e => 
        `<div class="list-group-item small" onclick="window.api.email.openSentEmail('${e.path.replace(/\\/g, '\\\\')}')">${escapeHtml(e.name)}</div>`
    ).join('') || '<p class="text-muted small">No sent emails</p>';
}

function openSmtpSettings() {
    window.api.email.getSettings().then(settings => {
        document.getElementById('smtp-host').value = settings?.host || 'smtp-mail.outlook.com';
        document.getElementById('smtp-port').value = settings?.port || 587;
        document.getElementById('smtp-secure').checked = settings?.secure === 1;
        document.getElementById('smtp-user').value = settings?.user || '';
        document.getElementById('smtp-pass').value = settings?.pass || '';
    });
    new bootstrap.Modal(document.getElementById('smtp-modal')).show();
}

async function saveSmtpSettings() {
    await window.api.email.saveSettings({
        host: document.getElementById('smtp-host').value.trim(),
        port: parseInt(document.getElementById('smtp-port').value) || 587,
        secure: document.getElementById('smtp-secure').checked,
        user: document.getElementById('smtp-user').value.trim(),
        pass: document.getElementById('smtp-pass').value
    });
    bootstrap.Modal.getInstance(document.getElementById('smtp-modal')).hide();
    showToast('Success', 'SMTP settings saved');
}

async function sendEmail() {
    const emailData = {
        to: document.getElementById('email-to').value.trim(),
        subject: document.getElementById('email-subject').value.trim(),
        body: document.getElementById('email-body').value
    };
    if (!emailData.to || !emailData.subject) { showToast('Error', 'To and Subject are required'); return; }
    
    try {
        await window.api.email.send(emailData);
        showToast('Success', 'Email sent');
        document.getElementById('email-to').value = '';
        document.getElementById('email-subject').value = '';
        document.getElementById('email-body').value = '';
        loadSentEmails();
    } catch (error) { showToast('Error', error.message); }
}

function openTemplateModal() {
    document.getElementById('template-name').value = '';
    new bootstrap.Modal(document.getElementById('template-modal')).show();
}

async function saveEmailTemplate() {
    const name = document.getElementById('template-name').value.trim();
    if (!name) { showToast('Error', 'Template name is required'); return; }
    await window.api.email.saveTemplate({
        name,
        subject: document.getElementById('email-subject').value,
        body: document.getElementById('email-body').value
    });
    bootstrap.Modal.getInstance(document.getElementById('template-modal')).hide();
    showToast('Success', 'Template saved');
    loadEmailTemplates();
}

// ============ SETTINGS ============
async function loadSettings() {
    const settings = await window.api.settings.get();
    const langSelect = document.getElementById('language-select');
    if (langSelect) langSelect.value = settings.language || 'en';
    syncLanguageControls(settings.language || 'en');
    
    const currencySelect = document.getElementById('currency-select');
    if (currencySelect) currencySelect.value = settings.currency || 'SYP';
    
    const lastSyncTime = document.getElementById('last-sync-time');
    if (lastSyncTime) lastSyncTime.textContent = settings.lastSync ? formatDate(settings.lastSync) : 'أبداً';
    
    const dbPath = document.getElementById('database-path');
    if (dbPath) dbPath.textContent = await window.api.app.getDatabasePath();
}

async function changeLanguage(langOrEvent) {
    const lang = typeof langOrEvent === 'string'
        ? langOrEvent
        : document.getElementById('language-select')?.value || 'en';
    await window.api.settings.setLanguage(lang);
    currentLanguage = lang;
    await loadLanguage();
    syncLanguageControls(lang);
    const languageChangedMessage = currentLanguage === 'ar' ? 'تم تغيير اللغة' : 'Language changed';
    showToast(t('common.success'), languageChangedMessage);
}

async function changeCurrency() {
    const currency = document.getElementById('currency-select').value;
    await window.api.settings.setCurrency(currency);
    currentCurrency = currency;
    showToast(t('common.success'), currentLanguage === 'ar' ? 'تم تغيير العملة' : 'Currency changed');
    // Refresh current module to update currency display
    showModule('dashboard');
}

async function saveSettingsChanges() {
    const language = document.getElementById('language-select')?.value || currentLanguage || 'en';
    const currency = document.getElementById('currency-select')?.value || currentCurrency || 'SYP';

    await window.api.settings.save({ language, currency });
    currentLanguage = language;
    currentCurrency = currency;
    await loadLanguage();

    const savedMessage = t('settings.saved') || (currentLanguage === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved');
    showToast(t('common.success'), savedMessage);
}

function closeSettings() {
    showModule('dashboard');
}

// ============ BACKUP ============
async function exportBackup() {
    const result = await window.api.backup.export();
    if (result) showToast('نجاح', 'تم تصدير النسخة الاحتياطية');
}

async function importBackup() {
    const confirm = await window.api.dialog.showMessage({ type: 'warning', buttons: ['إلغاء', 'متابعة'], message: 'سيتم استبدال جميع البيانات الحالية. هل تريد المتابعة؟' });
    if (confirm.response === 1) {
        const result = await window.api.backup.import();
        if (result) { showToast('نجاح', 'تم استعادة النسخة الاحتياطية. جاري إعادة التحميل...'); setTimeout(() => location.reload(), 2000); }
    }
}
