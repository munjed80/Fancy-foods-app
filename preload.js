const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Products
    products: {
        getAll: () => ipcRenderer.invoke('products:getAll'),
        search: (query) => ipcRenderer.invoke('products:search', query),
        getById: (id) => ipcRenderer.invoke('products:getById', id),
        create: (product) => ipcRenderer.invoke('products:create', product),
        update: (product) => ipcRenderer.invoke('products:update', product),
        delete: (id) => ipcRenderer.invoke('products:delete', id)
    },
    
    // Clients
    clients: {
        getAll: () => ipcRenderer.invoke('clients:getAll'),
        search: (query) => ipcRenderer.invoke('clients:search', query),
        getById: (id) => ipcRenderer.invoke('clients:getById', id),
        create: (client) => ipcRenderer.invoke('clients:create', client),
        update: (client) => ipcRenderer.invoke('clients:update', client),
        delete: (id) => ipcRenderer.invoke('clients:delete', id)
    },
    
    // Broker Deals
    broker: {
        getAll: () => ipcRenderer.invoke('broker:getAll'),
        search: (query) => ipcRenderer.invoke('broker:search', query),
        getById: (id) => ipcRenderer.invoke('broker:getById', id),
        create: (deal) => ipcRenderer.invoke('broker:create', deal),
        update: (deal) => ipcRenderer.invoke('broker:update', deal),
        delete: (id) => ipcRenderer.invoke('broker:delete', id),
        getAttachments: (dealId) => ipcRenderer.invoke('broker:getAttachments', dealId),
        addAttachment: (dealId) => ipcRenderer.invoke('broker:addAttachment', dealId),
        openAttachment: (filePath) => ipcRenderer.invoke('broker:openAttachment', filePath),
        deleteAttachment: (filePath) => ipcRenderer.invoke('broker:deleteAttachment', filePath)
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
    
    // App utilities
    app: {
        getVersion: () => ipcRenderer.invoke('app:getVersion')
    },
    
    dialog: {
        showMessage: (options) => ipcRenderer.invoke('dialog:showMessage', options)
    }
});
