// FancyFoods Manager - Main Application JavaScript

// ============ GLOBAL STATE ============
let productsData = [];
let clientsData = [];
let dealsData = [];
let ordersData = [];
let emailTemplates = [];

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    setupEventListeners();
    await loadInitialData();
    displayAppVersion();
    
    // Show workflow/dashboard by default
    showModule('workflow');
});

function setupNavigation() {
    document.querySelectorAll('.nav-link[data-module]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const module = link.dataset.module;
            showModule(module);
        });
    });
}

function showModule(moduleName) {
    // Update nav links
    document.querySelectorAll('.nav-link[data-module]').forEach(link => {
        link.classList.toggle('active', link.dataset.module === moduleName);
    });
    
    // Show/hide module sections
    document.querySelectorAll('.module-section').forEach(section => {
        section.classList.toggle('active', section.id === `module-${moduleName}`);
    });
    
    // Load module data
    switch (moduleName) {
        case 'workflow':
            loadWorkflowData();
            break;
        case 'products':
            loadProducts();
            break;
        case 'clients':
            loadClients();
            break;
        case 'broker':
            loadBrokerDeals();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'email':
            loadEmailData();
            break;
    }
}

async function loadInitialData() {
    try {
        [productsData, clientsData, dealsData, ordersData] = await Promise.all([
            window.api.products.getAll(),
            window.api.clients.getAll(),
            window.api.broker.getAll(),
            window.api.orders.getAll()
        ]);
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

async function displayAppVersion() {
    try {
        const version = await window.api.app.getVersion();
        document.getElementById('app-version').textContent = `v${version}`;
    } catch (error) {
        document.getElementById('app-version').textContent = 'v1.0.0';
    }
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
    // Products
    document.getElementById('btn-add-product').addEventListener('click', () => openProductModal());
    document.getElementById('btn-save-product').addEventListener('click', saveProduct);
    document.getElementById('products-search').addEventListener('input', debounce(searchProducts, 300));
    
    // Clients
    document.getElementById('btn-add-client').addEventListener('click', () => openClientModal());
    document.getElementById('btn-save-client').addEventListener('click', saveClient);
    document.getElementById('clients-search').addEventListener('input', debounce(searchClients, 300));
    
    // Broker Deals
    document.getElementById('btn-add-deal').addEventListener('click', () => openDealModal());
    document.getElementById('btn-save-deal').addEventListener('click', saveDeal);
    document.getElementById('btn-add-attachment').addEventListener('click', addAttachment);
    document.getElementById('broker-search').addEventListener('input', debounce(searchDeals, 300));
    
    // Orders
    document.getElementById('btn-add-order').addEventListener('click', () => openOrderModal());
    document.getElementById('btn-save-order').addEventListener('click', saveOrder);
    document.getElementById('btn-add-order-item').addEventListener('click', addOrderItem);
    document.getElementById('orders-search').addEventListener('input', debounce(searchOrders, 300));
    
    // Email
    document.getElementById('btn-email-settings').addEventListener('click', openSmtpSettings);
    document.getElementById('btn-save-smtp').addEventListener('click', saveSmtpSettings);
    document.getElementById('btn-send-email').addEventListener('click', sendEmail);
    document.getElementById('btn-save-template').addEventListener('click', openTemplateModal);
    document.getElementById('btn-confirm-save-template').addEventListener('click', saveEmailTemplate);
    
    // Backup
    document.getElementById('btn-export-backup').addEventListener('click', exportBackup);
    document.getElementById('btn-import-backup').addEventListener('click', importBackup);
}

// ============ UTILITY FUNCTIONS ============
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showToast(title, message, type = 'info') {
    const toast = document.getElementById('app-toast');
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-message').textContent = message;
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getStatusBadge(status) {
    const statusClass = `badge-${status}`;
    return `<span class="badge-status ${statusClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ WORKFLOW MODULE ============
async function loadWorkflowData() {
    try {
        const data = await window.api.workflow.getData();
        
        // Update stats
        document.getElementById('stat-products').textContent = data.totalProducts;
        document.getElementById('stat-clients').textContent = data.totalClients;
        document.getElementById('stat-pending-orders').textContent = data.pendingOrdersCount;
        document.getElementById('stat-open-deals').textContent = data.openDealsCount;
        
        // Recent pending orders
        const ordersHtml = data.recentOrders.length > 0 
            ? data.recentOrders.map(order => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>Order #${order.id}</strong> - ${escapeHtml(order.client_name || 'Unknown Client')}
                        <br><small class="text-muted">${formatDate(order.order_date)}</small>
                    </div>
                    <span class="badge bg-warning text-dark">${formatCurrency(order.total_price)}</span>
                </div>
            `).join('')
            : '<div class="empty-state"><div class="empty-state-icon">✅</div><p class="empty-state-text">No pending orders</p></div>';
        document.getElementById('recent-orders-list').innerHTML = ordersHtml;
        
        // Open broker deals
        const dealsHtml = data.openBrokerDeals.length > 0
            ? data.openBrokerDeals.map(deal => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${escapeHtml(deal.trader_name)}</strong> - ${escapeHtml(deal.product)}
                        <br><small class="text-muted">${deal.quantity} tons @ ${formatCurrency(deal.price_per_ton)}/ton</small>
                    </div>
                    ${getStatusBadge(deal.status)}
                </div>
            `).join('')
            : '<div class="empty-state"><div class="empty-state-icon">✅</div><p class="empty-state-text">No open deals</p></div>';
        document.getElementById('open-deals-list').innerHTML = dealsHtml;
        
    } catch (error) {
        console.error('Error loading workflow data:', error);
        showToast('Error', 'Failed to load dashboard data', 'error');
    }
}

// ============ PRODUCTS MODULE ============
async function loadProducts() {
    try {
        productsData = await window.api.products.getAll();
        renderProductsTable(productsData);
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Error', 'Failed to load products', 'error');
    }
}

async function searchProducts(e) {
    const query = e.target.value.trim();
    try {
        const results = query ? await window.api.products.search(query) : await window.api.products.getAll();
        renderProductsTable(results);
    } catch (error) {
        console.error('Error searching products:', error);
    }
}

function renderProductsTable(products) {
    const tbody = document.querySelector('#products-table tbody');
    
    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="empty-state">
                        <div class="empty-state-icon">📦</div>
                        <p class="empty-state-text">No products found. Click "Add Product" to create one.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.id}</td>
            <td>${escapeHtml(product.name)}</td>
            <td><span class="badge bg-secondary">${escapeHtml(product.category)}</span></td>
            <td>${escapeHtml(product.unit)}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${escapeHtml(product.notes) || '-'}</td>
            <td class="row-actions">
                <button class="btn btn-outline-primary btn-action" onclick="editProduct(${product.id})">✏️</button>
                <button class="btn btn-outline-danger btn-action" onclick="deleteProduct(${product.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function openProductModal(product = null) {
    document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add Product';
    document.getElementById('product-id').value = product?.id || '';
    document.getElementById('product-name').value = product?.name || '';
    document.getElementById('product-category').value = product?.category || 'nuts';
    document.getElementById('product-unit').value = product?.unit || 'kg';
    document.getElementById('product-price').value = product?.price || '';
    document.getElementById('product-notes').value = product?.notes || '';
    
    const modal = new bootstrap.Modal(document.getElementById('product-modal'));
    modal.show();
}

async function editProduct(id) {
    try {
        const product = await window.api.products.getById(id);
        openProductModal(product);
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Error', 'Failed to load product', 'error');
    }
}

async function saveProduct() {
    const product = {
        id: document.getElementById('product-id').value || null,
        name: document.getElementById('product-name').value.trim(),
        category: document.getElementById('product-category').value,
        unit: document.getElementById('product-unit').value,
        price: parseFloat(document.getElementById('product-price').value) || 0,
        notes: document.getElementById('product-notes').value.trim()
    };
    
    if (!product.name) {
        showToast('Validation', 'Product name is required', 'warning');
        return;
    }
    
    try {
        if (product.id) {
            await window.api.products.update(product);
            showToast('Success', 'Product updated successfully', 'success');
        } else {
            await window.api.products.create(product);
            showToast('Success', 'Product created successfully', 'success');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('product-modal')).hide();
        await loadProducts();
    } catch (error) {
        console.error('Error saving product:', error);
        showToast('Error', 'Failed to save product', 'error');
    }
}

async function deleteProduct(id) {
    const result = await window.api.dialog.showMessage({
        type: 'question',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this product?'
    });
    
    if (result.response === 1) {
        try {
            await window.api.products.delete(id);
            showToast('Success', 'Product deleted successfully', 'success');
            await loadProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            showToast('Error', 'Failed to delete product', 'error');
        }
    }
}

// ============ CLIENTS MODULE ============
async function loadClients() {
    try {
        clientsData = await window.api.clients.getAll();
        renderClientsTable(clientsData);
    } catch (error) {
        console.error('Error loading clients:', error);
        showToast('Error', 'Failed to load clients', 'error');
    }
}

async function searchClients(e) {
    const query = e.target.value.trim();
    try {
        const results = query ? await window.api.clients.search(query) : await window.api.clients.getAll();
        renderClientsTable(results);
    } catch (error) {
        console.error('Error searching clients:', error);
    }
}

function renderClientsTable(clients) {
    const tbody = document.querySelector('#clients-table tbody');
    
    if (clients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <p class="empty-state-text">No clients found. Click "Add Client" to create one.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = clients.map(client => `
        <tr>
            <td>${client.id}</td>
            <td>${escapeHtml(client.name)}</td>
            <td>${escapeHtml(client.phone) || '-'}</td>
            <td>${escapeHtml(client.whatsapp) || '-'}</td>
            <td>${escapeHtml(client.city) || '-'}</td>
            <td>${escapeHtml(client.notes) || '-'}</td>
            <td class="row-actions">
                <button class="btn btn-outline-primary btn-action" onclick="editClient(${client.id})">✏️</button>
                <button class="btn btn-outline-danger btn-action" onclick="deleteClient(${client.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function openClientModal(client = null) {
    document.getElementById('client-modal-title').textContent = client ? 'Edit Client' : 'Add Client';
    document.getElementById('client-id').value = client?.id || '';
    document.getElementById('client-name').value = client?.name || '';
    document.getElementById('client-phone').value = client?.phone || '';
    document.getElementById('client-whatsapp').value = client?.whatsapp || '';
    document.getElementById('client-city').value = client?.city || '';
    document.getElementById('client-notes').value = client?.notes || '';
    
    const modal = new bootstrap.Modal(document.getElementById('client-modal'));
    modal.show();
}

async function editClient(id) {
    try {
        const client = await window.api.clients.getById(id);
        openClientModal(client);
    } catch (error) {
        console.error('Error loading client:', error);
        showToast('Error', 'Failed to load client', 'error');
    }
}

async function saveClient() {
    const client = {
        id: document.getElementById('client-id').value || null,
        name: document.getElementById('client-name').value.trim(),
        phone: document.getElementById('client-phone').value.trim(),
        whatsapp: document.getElementById('client-whatsapp').value.trim(),
        city: document.getElementById('client-city').value.trim(),
        notes: document.getElementById('client-notes').value.trim()
    };
    
    if (!client.name) {
        showToast('Validation', 'Client name is required', 'warning');
        return;
    }
    
    try {
        if (client.id) {
            await window.api.clients.update(client);
            showToast('Success', 'Client updated successfully', 'success');
        } else {
            await window.api.clients.create(client);
            showToast('Success', 'Client created successfully', 'success');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('client-modal')).hide();
        await loadClients();
    } catch (error) {
        console.error('Error saving client:', error);
        showToast('Error', 'Failed to save client', 'error');
    }
}

async function deleteClient(id) {
    const result = await window.api.dialog.showMessage({
        type: 'question',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this client?'
    });
    
    if (result.response === 1) {
        try {
            await window.api.clients.delete(id);
            showToast('Success', 'Client deleted successfully', 'success');
            await loadClients();
        } catch (error) {
            console.error('Error deleting client:', error);
            showToast('Error', 'Failed to delete client', 'error');
        }
    }
}

// ============ BROKER DEALS MODULE ============
let currentDealId = null;

async function loadBrokerDeals() {
    try {
        dealsData = await window.api.broker.getAll();
        renderDealsTable(dealsData);
    } catch (error) {
        console.error('Error loading deals:', error);
        showToast('Error', 'Failed to load broker deals', 'error');
    }
}

async function searchDeals(e) {
    const query = e.target.value.trim();
    try {
        const results = query ? await window.api.broker.search(query) : await window.api.broker.getAll();
        renderDealsTable(results);
    } catch (error) {
        console.error('Error searching deals:', error);
    }
}

function renderDealsTable(deals) {
    const tbody = document.querySelector('#broker-table tbody');
    
    if (deals.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="empty-state">
                        <div class="empty-state-icon">🤝</div>
                        <p class="empty-state-text">No broker deals found. Click "Add Deal" to create one.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = deals.map(deal => `
        <tr>
            <td>${deal.id}</td>
            <td>${escapeHtml(deal.trader_name)}</td>
            <td>${escapeHtml(deal.product)}</td>
            <td>${deal.quantity} tons</td>
            <td>${formatCurrency(deal.price_per_ton)}</td>
            <td>${escapeHtml(deal.supplier) || '-'}</td>
            <td>${getStatusBadge(deal.status)}</td>
            <td class="row-actions">
                <button class="btn btn-outline-primary btn-action" onclick="editDeal(${deal.id})">✏️</button>
                <button class="btn btn-outline-danger btn-action" onclick="deleteDeal(${deal.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function openDealModal(deal = null) {
    currentDealId = deal?.id || null;
    document.getElementById('deal-modal-title').textContent = deal ? 'Edit Broker Deal' : 'Add Broker Deal';
    document.getElementById('deal-id').value = deal?.id || '';
    document.getElementById('deal-trader').value = deal?.trader_name || '';
    document.getElementById('deal-product').value = deal?.product || '';
    document.getElementById('deal-quantity').value = deal?.quantity || '';
    document.getElementById('deal-price').value = deal?.price_per_ton || '';
    document.getElementById('deal-supplier').value = deal?.supplier || '';
    document.getElementById('deal-status').value = deal?.status || 'open';
    document.getElementById('deal-notes').value = deal?.notes || '';
    
    // Show/hide attachments section
    const attachmentsSection = document.getElementById('attachments-section');
    if (deal?.id) {
        attachmentsSection.style.display = 'block';
        loadDealAttachments(deal.id);
    } else {
        attachmentsSection.style.display = 'none';
    }
    
    const modal = new bootstrap.Modal(document.getElementById('deal-modal'));
    modal.show();
}

async function loadDealAttachments(dealId) {
    try {
        const attachments = await window.api.broker.getAttachments(dealId);
        renderAttachments(attachments);
    } catch (error) {
        console.error('Error loading attachments:', error);
    }
}

function renderAttachments(attachments) {
    const container = document.getElementById('deal-attachments');
    container.innerHTML = attachments.map(att => `
        <div class="attachment-item">
            <span onclick="openAttachment('${att.path.replace(/\\/g, '\\\\')}')" style="cursor: pointer;">📎 ${escapeHtml(att.name)}</span>
            <button type="button" class="btn-remove" onclick="deleteAttachment('${att.path.replace(/\\/g, '\\\\')}')">×</button>
        </div>
    `).join('');
}

async function addAttachment() {
    if (!currentDealId) return;
    
    try {
        const result = await window.api.broker.addAttachment(currentDealId);
        if (result) {
            showToast('Success', 'Attachment added', 'success');
            await loadDealAttachments(currentDealId);
        }
    } catch (error) {
        console.error('Error adding attachment:', error);
        showToast('Error', 'Failed to add attachment', 'error');
    }
}

async function openAttachment(filePath) {
    await window.api.broker.openAttachment(filePath);
}

async function deleteAttachment(filePath) {
    const result = await window.api.dialog.showMessage({
        type: 'question',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        title: 'Confirm Delete',
        message: 'Delete this attachment?'
    });
    
    if (result.response === 1) {
        try {
            await window.api.broker.deleteAttachment(filePath);
            showToast('Success', 'Attachment deleted', 'success');
            if (currentDealId) {
                await loadDealAttachments(currentDealId);
            }
        } catch (error) {
            console.error('Error deleting attachment:', error);
            showToast('Error', 'Failed to delete attachment', 'error');
        }
    }
}

async function editDeal(id) {
    try {
        const deal = await window.api.broker.getById(id);
        openDealModal(deal);
    } catch (error) {
        console.error('Error loading deal:', error);
        showToast('Error', 'Failed to load deal', 'error');
    }
}

async function saveDeal() {
    const deal = {
        id: document.getElementById('deal-id').value || null,
        trader_name: document.getElementById('deal-trader').value.trim(),
        product: document.getElementById('deal-product').value.trim(),
        quantity: parseFloat(document.getElementById('deal-quantity').value) || 0,
        price_per_ton: parseFloat(document.getElementById('deal-price').value) || 0,
        supplier: document.getElementById('deal-supplier').value.trim(),
        status: document.getElementById('deal-status').value,
        notes: document.getElementById('deal-notes').value.trim()
    };
    
    if (!deal.trader_name || !deal.product) {
        showToast('Validation', 'Trader name and product are required', 'warning');
        return;
    }
    
    try {
        if (deal.id) {
            await window.api.broker.update(deal);
            showToast('Success', 'Deal updated successfully', 'success');
        } else {
            const created = await window.api.broker.create(deal);
            showToast('Success', 'Deal created successfully. You can now add attachments.', 'success');
            // Reopen modal to show attachments section
            await editDeal(created.id);
            return;
        }
        
        bootstrap.Modal.getInstance(document.getElementById('deal-modal')).hide();
        await loadBrokerDeals();
    } catch (error) {
        console.error('Error saving deal:', error);
        showToast('Error', 'Failed to save deal', 'error');
    }
}

async function deleteDeal(id) {
    const result = await window.api.dialog.showMessage({
        type: 'question',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this broker deal and all its attachments?'
    });
    
    if (result.response === 1) {
        try {
            await window.api.broker.delete(id);
            showToast('Success', 'Deal deleted successfully', 'success');
            await loadBrokerDeals();
        } catch (error) {
            console.error('Error deleting deal:', error);
            showToast('Error', 'Failed to delete deal', 'error');
        }
    }
}

// ============ ORDERS MODULE ============
async function loadOrders() {
    try {
        ordersData = await window.api.orders.getAll();
        renderOrdersTable(ordersData);
    } catch (error) {
        console.error('Error loading orders:', error);
        showToast('Error', 'Failed to load orders', 'error');
    }
}

async function searchOrders(e) {
    const query = e.target.value.trim();
    try {
        const results = query ? await window.api.orders.search(query) : await window.api.orders.getAll();
        renderOrdersTable(results);
    } catch (error) {
        console.error('Error searching orders:', error);
    }
}

function renderOrdersTable(orders) {
    const tbody = document.querySelector('#orders-table tbody');
    
    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="empty-state">
                        <div class="empty-state-icon">🛒</div>
                        <p class="empty-state-text">No orders found. Click "New Order" to create one.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${escapeHtml(order.client_name) || 'Unknown'}</td>
            <td>${formatDate(order.order_date)}</td>
            <td>${formatCurrency(order.total_price)}</td>
            <td>${getStatusBadge(order.status)}</td>
            <td class="row-actions">
                <button class="btn btn-outline-info btn-action" onclick="viewOrder(${order.id})">👁️</button>
                <button class="btn btn-outline-primary btn-action" onclick="editOrder(${order.id})">✏️</button>
                <button class="btn btn-outline-danger btn-action" onclick="deleteOrder(${order.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function openOrderModal(order = null) {
    document.getElementById('order-modal-title').textContent = order ? 'Edit Order' : 'New Order';
    document.getElementById('order-id').value = order?.id || '';
    document.getElementById('order-date').value = order?.order_date || new Date().toISOString().split('T')[0];
    document.getElementById('order-status').value = order?.status || 'pending';
    document.getElementById('order-notes').value = order?.notes || '';
    
    // Load clients dropdown
    const clientSelect = document.getElementById('order-client');
    clientSelect.innerHTML = '<option value="">Select client...</option>';
    clientsData = await window.api.clients.getAll();
    clientsData.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.name;
        if (order?.client_id == client.id) option.selected = true;
        clientSelect.appendChild(option);
    });
    
    // Load order items
    const itemsBody = document.getElementById('order-items-body');
    itemsBody.innerHTML = '';
    
    if (order?.items && order.items.length > 0) {
        for (const item of order.items) {
            addOrderItemRow(item);
        }
    } else {
        addOrderItemRow();
    }
    
    updateOrderTotal();
    
    const modal = new bootstrap.Modal(document.getElementById('order-modal'));
    modal.show();
}

async function addOrderItem() {
    addOrderItemRow();
}

async function addOrderItemRow(item = null) {
    const tbody = document.getElementById('order-items-body');
    const row = document.createElement('tr');
    
    productsData = await window.api.products.getAll();
    
    row.innerHTML = `
        <td>
            <select class="form-select form-select-sm order-item-product" onchange="onProductSelect(this)">
                <option value="">Select product...</option>
                ${productsData.map(p => `
                    <option value="${p.id}" data-price="${p.price}" ${item?.product_id == p.id ? 'selected' : ''}>
                        ${escapeHtml(p.name)} (${p.unit})
                    </option>
                `).join('')}
            </select>
        </td>
        <td>
            <input type="number" class="form-control form-control-sm order-item-qty" value="${item?.quantity || 1}" min="0.01" step="0.01" onchange="updateOrderTotal()">
        </td>
        <td>
            <input type="number" class="form-control form-control-sm order-item-price" value="${item?.price || ''}" min="0" step="0.01" onchange="updateOrderTotal()">
        </td>
        <td class="order-item-subtotal">$0.00</td>
        <td>
            <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeOrderItem(this)">×</button>
        </td>
    `;
    
    tbody.appendChild(row);
    updateOrderTotal();
}

function onProductSelect(select) {
    const row = select.closest('tr');
    const selectedOption = select.options[select.selectedIndex];
    const price = selectedOption.dataset.price || 0;
    row.querySelector('.order-item-price').value = price;
    updateOrderTotal();
}

function removeOrderItem(btn) {
    const row = btn.closest('tr');
    row.remove();
    updateOrderTotal();
}

function updateOrderTotal() {
    let total = 0;
    document.querySelectorAll('#order-items-body tr').forEach(row => {
        const qty = parseFloat(row.querySelector('.order-item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.order-item-price').value) || 0;
        const subtotal = qty * price;
        row.querySelector('.order-item-subtotal').textContent = formatCurrency(subtotal);
        total += subtotal;
    });
    document.getElementById('order-total').textContent = formatCurrency(total);
}

async function viewOrder(id) {
    const order = await window.api.orders.getById(id);
    openOrderModal(order);
}

async function editOrder(id) {
    const order = await window.api.orders.getById(id);
    openOrderModal(order);
}

async function saveOrder() {
    const clientId = document.getElementById('order-client').value;
    if (!clientId) {
        showToast('Validation', 'Please select a client', 'warning');
        return;
    }
    
    const items = [];
    document.querySelectorAll('#order-items-body tr').forEach(row => {
        const productId = row.querySelector('.order-item-product').value;
        const qty = parseFloat(row.querySelector('.order-item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.order-item-price').value) || 0;
        
        if (productId && qty > 0) {
            items.push({
                product_id: parseInt(productId),
                quantity: qty,
                price: price
            });
        }
    });
    
    if (items.length === 0) {
        showToast('Validation', 'Please add at least one item', 'warning');
        return;
    }
    
    const totalPrice = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    const order = {
        id: document.getElementById('order-id').value || null,
        client_id: parseInt(clientId),
        order_date: document.getElementById('order-date').value,
        total_price: totalPrice,
        status: document.getElementById('order-status').value,
        notes: document.getElementById('order-notes').value.trim(),
        items: items
    };
    
    try {
        if (order.id) {
            await window.api.orders.update(order);
            showToast('Success', 'Order updated successfully', 'success');
        } else {
            await window.api.orders.create(order);
            showToast('Success', 'Order created successfully', 'success');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('order-modal')).hide();
        await loadOrders();
    } catch (error) {
        console.error('Error saving order:', error);
        showToast('Error', 'Failed to save order', 'error');
    }
}

async function deleteOrder(id) {
    const result = await window.api.dialog.showMessage({
        type: 'question',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this order?'
    });
    
    if (result.response === 1) {
        try {
            await window.api.orders.delete(id);
            showToast('Success', 'Order deleted successfully', 'success');
            await loadOrders();
        } catch (error) {
            console.error('Error deleting order:', error);
            showToast('Error', 'Failed to delete order', 'error');
        }
    }
}

// ============ EMAIL MODULE ============
async function loadEmailData() {
    await loadEmailTemplates();
    await loadSentEmails();
    await loadSmtpSettingsToForm();
}

async function loadSmtpSettingsToForm() {
    try {
        const settings = await window.api.email.getSettings();
        document.getElementById('smtp-host').value = settings?.host || 'smtp-mail.outlook.com';
        document.getElementById('smtp-port').value = settings?.port || 587;
        document.getElementById('smtp-secure').checked = settings?.secure === 1;
        document.getElementById('smtp-user').value = settings?.user || '';
        document.getElementById('smtp-pass').value = settings?.pass || '';
    } catch (error) {
        console.error('Error loading SMTP settings:', error);
    }
}

function openSmtpSettings() {
    loadSmtpSettingsToForm();
    const modal = new bootstrap.Modal(document.getElementById('smtp-modal'));
    modal.show();
}

async function saveSmtpSettings() {
    const settings = {
        host: document.getElementById('smtp-host').value.trim(),
        port: parseInt(document.getElementById('smtp-port').value) || 587,
        secure: document.getElementById('smtp-secure').checked,
        user: document.getElementById('smtp-user').value.trim(),
        pass: document.getElementById('smtp-pass').value
    };
    
    try {
        await window.api.email.saveSettings(settings);
        showToast('Success', 'SMTP settings saved', 'success');
        bootstrap.Modal.getInstance(document.getElementById('smtp-modal')).hide();
    } catch (error) {
        console.error('Error saving SMTP settings:', error);
        showToast('Error', 'Failed to save settings', 'error');
    }
}

async function loadEmailTemplates() {
    try {
        emailTemplates = await window.api.email.getTemplates();
        renderTemplatesList(emailTemplates);
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

function renderTemplatesList(templates) {
    const container = document.getElementById('email-templates-list');
    
    if (templates.length === 0) {
        container.innerHTML = '<p class="text-muted text-center small py-2">No templates saved</p>';
        return;
    }
    
    container.innerHTML = templates.map(t => `
        <div class="list-group-item template-item" onclick="loadTemplate(${t.id})">
            <span class="template-name">📄 ${escapeHtml(t.name)}</span>
            <button class="btn btn-sm btn-outline-danger btn-delete-template" onclick="event.stopPropagation(); deleteTemplate(${t.id})">🗑️</button>
        </div>
    `).join('');
}

async function loadTemplate(id) {
    try {
        const templates = await window.api.email.getTemplates();
        const template = templates.find(t => t.id === id);
        if (template) {
            document.getElementById('email-subject').value = template.subject || '';
            document.getElementById('email-body').value = template.body || '';
            showToast('Template Loaded', template.name, 'info');
        }
    } catch (error) {
        console.error('Error loading template:', error);
    }
}

function openTemplateModal() {
    document.getElementById('template-name').value = '';
    const modal = new bootstrap.Modal(document.getElementById('template-modal'));
    modal.show();
}

async function saveEmailTemplate() {
    const name = document.getElementById('template-name').value.trim();
    if (!name) {
        showToast('Validation', 'Template name is required', 'warning');
        return;
    }
    
    const template = {
        name: name,
        subject: document.getElementById('email-subject').value,
        body: document.getElementById('email-body').value
    };
    
    try {
        await window.api.email.saveTemplate(template);
        showToast('Success', 'Template saved', 'success');
        bootstrap.Modal.getInstance(document.getElementById('template-modal')).hide();
        await loadEmailTemplates();
    } catch (error) {
        console.error('Error saving template:', error);
        showToast('Error', 'Failed to save template', 'error');
    }
}

async function deleteTemplate(id) {
    const result = await window.api.dialog.showMessage({
        type: 'question',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        title: 'Confirm Delete',
        message: 'Delete this template?'
    });
    
    if (result.response === 1) {
        try {
            await window.api.email.deleteTemplate(id);
            showToast('Success', 'Template deleted', 'success');
            await loadEmailTemplates();
        } catch (error) {
            console.error('Error deleting template:', error);
        }
    }
}

async function loadSentEmails() {
    try {
        const emails = await window.api.email.getSentEmails();
        const container = document.getElementById('sent-emails-list');
        
        if (emails.length === 0) {
            container.innerHTML = '<p class="text-muted text-center small py-2">No sent emails</p>';
            return;
        }
        
        container.innerHTML = emails.slice(0, 10).map(e => `
            <div class="sent-email-item" onclick="openSentEmail('${e.path.replace(/\\/g, '\\\\')}')">
                📧 ${escapeHtml(e.name)}
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading sent emails:', error);
    }
}

async function openSentEmail(filePath) {
    await window.api.email.openSentEmail(filePath);
}

async function sendEmail() {
    const emailData = {
        to: document.getElementById('email-to').value.trim(),
        subject: document.getElementById('email-subject').value.trim(),
        body: document.getElementById('email-body').value
    };
    
    if (!emailData.to) {
        showToast('Validation', 'Recipient email is required', 'warning');
        return;
    }
    
    if (!emailData.subject) {
        showToast('Validation', 'Subject is required', 'warning');
        return;
    }
    
    try {
        const btn = document.getElementById('btn-send-email');
        btn.disabled = true;
        btn.textContent = '📤 Sending...';
        
        await window.api.email.send(emailData);
        showToast('Success', 'Email sent successfully!', 'success');
        
        // Clear form
        document.getElementById('email-to').value = '';
        document.getElementById('email-subject').value = '';
        document.getElementById('email-body').value = '';
        
        await loadSentEmails();
    } catch (error) {
        console.error('Error sending email:', error);
        showToast('Error', error.message || 'Failed to send email. Check your SMTP settings.', 'error');
    } finally {
        const btn = document.getElementById('btn-send-email');
        btn.disabled = false;
        btn.textContent = '📤 Send Email';
    }
}

// ============ BACKUP MODULE ============
async function exportBackup() {
    try {
        const btn = document.getElementById('btn-export-backup');
        btn.disabled = true;
        btn.textContent = '💾 Exporting...';
        
        const result = await window.api.backup.export();
        if (result) {
            showToast('Success', 'Backup exported successfully!', 'success');
        }
    } catch (error) {
        console.error('Error exporting backup:', error);
        showToast('Error', 'Failed to export backup', 'error');
    } finally {
        const btn = document.getElementById('btn-export-backup');
        btn.disabled = false;
        btn.innerHTML = '💾 Export Backup';
    }
}

async function importBackup() {
    const result = await window.api.dialog.showMessage({
        type: 'warning',
        buttons: ['Cancel', 'Continue'],
        defaultId: 0,
        title: 'Import Backup',
        message: 'This will replace all current data with the backup data. Are you sure you want to continue?'
    });
    
    if (result.response === 1) {
        try {
            const btn = document.getElementById('btn-import-backup');
            btn.disabled = true;
            btn.textContent = '📥 Importing...';
            
            const importResult = await window.api.backup.import();
            if (importResult) {
                showToast('Success', 'Backup restored successfully! The app will reload.', 'success');
                setTimeout(() => {
                    location.reload();
                }, 2000);
            }
        } catch (error) {
            console.error('Error importing backup:', error);
            showToast('Error', 'Failed to import backup', 'error');
        } finally {
            const btn = document.getElementById('btn-import-backup');
            btn.disabled = false;
            btn.innerHTML = '📥 Import Backup';
        }
    }
}

// Make functions globally available for onclick handlers
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.editClient = editClient;
window.deleteClient = deleteClient;
window.editDeal = editDeal;
window.deleteDeal = deleteDeal;
window.openAttachment = openAttachment;
window.deleteAttachment = deleteAttachment;
window.viewOrder = viewOrder;
window.editOrder = editOrder;
window.deleteOrder = deleteOrder;
window.onProductSelect = onProductSelect;
window.removeOrderItem = removeOrderItem;
window.updateOrderTotal = updateOrderTotal;
window.loadTemplate = loadTemplate;
window.deleteTemplate = deleteTemplate;
window.openSentEmail = openSentEmail;
