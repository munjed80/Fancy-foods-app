// Products Module
// This module provides functions for managing products (nuts, seeds, mixed, roasted)
// The main implementation is in app.js, this file serves as documentation

/**
 * Product fields:
 * - id: INTEGER PRIMARY KEY
 * - name: TEXT (required)
 * - category: TEXT (nuts, seeds, mixed, roasted)
 * - unit: TEXT (kg, box, bag)
 * - price: REAL
 * - notes: TEXT
 * - created_at: DATETIME
 * - updated_at: DATETIME
 */

// API methods available via window.api.products:
// - getAll(): Get all products
// - search(query): Search products by name
// - getById(id): Get product by ID
// - create(product): Create new product
// - update(product): Update existing product
// - delete(id): Delete product
