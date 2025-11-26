// Clients Module
// This module provides functions for managing clients (shop owners and wholesalers)
// The main implementation is in app.js, this file serves as documentation

/**
 * Client fields:
 * - id: INTEGER PRIMARY KEY
 * - name: TEXT (required)
 * - phone: TEXT
 * - whatsapp: TEXT
 * - city: TEXT
 * - notes: TEXT
 * - created_at: DATETIME
 * - updated_at: DATETIME
 */

// API methods available via window.api.clients:
// - getAll(): Get all clients
// - search(query): Search clients by name or phone
// - getById(id): Get client by ID
// - create(client): Create new client
// - update(client): Update existing client
// - delete(id): Delete client
