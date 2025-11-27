const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Products
    products: {
        getAll: () => ipcRenderer.invoke('products:getAll'),
        search: (query) => ipcRenderer.invoke('products:search', query),
        getById: (id) => ipcRenderer.invoke('products:getById', id),
        create: (product) => ipcRenderer.invoke('products:create', product),
        update: (product) => ipcRenderer.invoke('products:update', product),
        delete: (id) => ipcRenderer.invoke('products:delete', id),
        getLowStock: () => ipcRenderer.invoke('products:getLowStock'),
        getByLocation: (location) => ipcRenderer.invoke('products:getByLocation', location)
    },
    
    // Suppliers
    suppliers: {
        getAll: () => ipcRenderer.invoke('suppliers:getAll'),
        search: (query) => ipcRenderer.invoke('suppliers:search', query),
        getById: (id) => ipcRenderer.invoke('suppliers:getById', id),
        create: (supplier) => ipcRenderer.invoke('suppliers:create', supplier),
        update: (supplier) => ipcRenderer.invoke('suppliers:update', supplier),
        delete: (id) => ipcRenderer.invoke('suppliers:delete', id),
        getProducts: (supplierId) => ipcRenderer.invoke('suppliers:getProducts', supplierId),
        checkStock: (data) => ipcRenderer.invoke('suppliers:checkStock', data)
    },
    
    // Clients
    clients: {
        getAll: () => ipcRenderer.invoke('clients:getAll'),
        search: (query) => ipcRenderer.invoke('clients:search', query),
        getById: (id) => ipcRenderer.invoke('clients:getById', id),
        create: (client) => ipcRenderer.invoke('clients:create', client),
        update: (client) => ipcRenderer.invoke('clients:update', client),
        delete: (id) => ipcRenderer.invoke('clients:delete', id),
        getOrderHistory: (clientId) => ipcRenderer.invoke('clients:getOrderHistory', clientId)
    },
    
    // Deals (Enhanced workflow - replaces broker)
    deals: {
        getAll: () => ipcRenderer.invoke('deals:getAll'),
        search: (query) => ipcRenderer.invoke('deals:search', query),
        getById: (id) => ipcRenderer.invoke('deals:getById', id),
        create: (deal) => ipcRenderer.invoke('deals:create', deal),
        update: (deal) => ipcRenderer.invoke('deals:update', deal),
        updateStage: (data) => ipcRenderer.invoke('deals:updateStage', data),
        delete: (id) => ipcRenderer.invoke('deals:delete', id),
        getAttachments: (dealId) => ipcRenderer.invoke('deals:getAttachments', dealId),
        addAttachment: (dealId) => ipcRenderer.invoke('deals:addAttachment', dealId),
        openAttachment: (filePath) => ipcRenderer.invoke('deals:openAttachment', filePath),
        deleteAttachment: (filePath) => ipcRenderer.invoke('deals:deleteAttachment', filePath)
    },
    
    // PDF Generation
    pdf: {
        generateOffer: (dealId) => ipcRenderer.invoke('pdf:generateOffer', dealId),
        generateInvoice: (dealId) => ipcRenderer.invoke('pdf:generateInvoice', dealId),
        generateDeliveryNote: (dealId) => ipcRenderer.invoke('pdf:generateDeliveryNote', dealId)
    },
    
    // Shipments (Logistics)
    shipments: {
        getAll: () => ipcRenderer.invoke('shipments:getAll'),
        getByDeal: (dealId) => ipcRenderer.invoke('shipments:getByDeal', dealId),
        create: (shipment) => ipcRenderer.invoke('shipments:create', shipment),
        update: (shipment) => ipcRenderer.invoke('shipments:update', shipment),
        delete: (id) => ipcRenderer.invoke('shipments:delete', id)
    },
    
    // Storage Locations
    locations: {
        getAll: () => ipcRenderer.invoke('locations:getAll'),
        create: (location) => ipcRenderer.invoke('locations:create', location),
        getStockByLocation: () => ipcRenderer.invoke('locations:getStockByLocation')
    },
    
    // Orders
    orders: {
        getAll: () => ipcRenderer.invoke('orders:getAll'),
        search: (query) => ipcRenderer.invoke('orders:search', query),
        getById: (id) => ipcRenderer.invoke('orders:getById', id),
        create: (order) => ipcRenderer.invoke('orders:create', order),
        update: (order) => ipcRenderer.invoke('orders:update', order),
        delete: (id) => ipcRenderer.invoke('orders:delete', id)
    },
    
    // Email
    email: {
        getSettings: () => ipcRenderer.invoke('email:getSettings'),
        saveSettings: (settings) => ipcRenderer.invoke('email:saveSettings', settings),
        getTemplates: () => ipcRenderer.invoke('email:getTemplates'),
        saveTemplate: (template) => ipcRenderer.invoke('email:saveTemplate', template),
        deleteTemplate: (id) => ipcRenderer.invoke('email:deleteTemplate', id),
        send: (emailData) => ipcRenderer.invoke('email:send', emailData),
        getSentEmails: () => ipcRenderer.invoke('email:getSentEmails'),
        openSentEmail: (filePath) => ipcRenderer.invoke('email:openSentEmail', filePath)
    },
    
    // Workflow
    workflow: {
        getData: () => ipcRenderer.invoke('workflow:getData')
    },
    
    // Backup
    backup: {
        export: () => ipcRenderer.invoke('backup:export'),
        import: () => ipcRenderer.invoke('backup:import')
    },
    
    // Settings
    settings: {
        get: () => ipcRenderer.invoke('settings:get'),
        save: (settings) => ipcRenderer.invoke('settings:save', settings),
        getLanguage: () => ipcRenderer.invoke('settings:getLanguage'),
        setLanguage: (lang) => ipcRenderer.invoke('settings:setLanguage', lang),
        getCurrency: () => ipcRenderer.invoke('settings:getCurrency'),
        setCurrency: (currency) => ipcRenderer.invoke('settings:setCurrency', currency)
    },
    
    // Update System (Simple - just opens browser)
    update: {
        check: () => ipcRenderer.invoke('update:check'),
        openReleases: () => ipcRenderer.invoke('update:openReleases')
    },
    
    // Todo List
    todo: {
        getAll: () => ipcRenderer.invoke('todo:getAll'),
        add: (text) => ipcRenderer.invoke('todo:add', text),
        toggle: (id) => ipcRenderer.invoke('todo:toggle', id),
        delete: (id) => ipcRenderer.invoke('todo:delete', id)
    },
    
    // Data Sync
    sync: {
        run: () => ipcRenderer.invoke('sync:run'),
        getStatus: () => ipcRenderer.invoke('sync:getStatus')
    },
    
    // App utilities
    app: {
        getVersion: () => ipcRenderer.invoke('app:getVersion'),
        isOnline: () => ipcRenderer.invoke('app:isOnline'),
        getDatabasePath: () => ipcRenderer.invoke('app:getDatabasePath')
    },
    
    dialog: {
        showMessage: (options) => ipcRenderer.invoke('dialog:showMessage', options)
    }
});
