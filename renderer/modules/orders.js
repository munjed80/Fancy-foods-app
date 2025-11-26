// Orders Module
// This module provides functions for managing sales orders
// The main implementation is in app.js, this file serves as documentation

/**
 * Order fields:
 * - id: INTEGER PRIMARY KEY
 * - client_id: INTEGER (references clients)
 * - order_date: DATE
 * - total_price: REAL (auto-calculated)
 * - status: TEXT (pending, processing, shipped, completed, cancelled)
 * - notes: TEXT
 * - created_at: DATETIME
 * - updated_at: DATETIME
 * 
 * Order Item fields:
 * - id: INTEGER PRIMARY KEY
 * - order_id: INTEGER (references orders)
 * - product_id: INTEGER (references products)
 * - quantity: REAL
 * - price: REAL
 */

// API methods available via window.api.orders:
// - getAll(): Get all orders with client names
// - search(query): Search orders by client name
// - getById(id): Get order by ID with items
// - create(order): Create new order with items
// - update(order): Update order and items
// - delete(id): Delete order and items
