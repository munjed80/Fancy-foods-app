// Broker Deals Module
// This module provides functions for managing brokerage deals for bulk food items
// The main implementation is in app.js, this file serves as documentation

/**
 * Broker Deal fields:
 * - id: INTEGER PRIMARY KEY
 * - trader_name: TEXT (required)
 * - product: TEXT (required) - e.g., rice, starch, coffee, spices
 * - quantity: REAL (tons)
 * - price_per_ton: REAL
 * - supplier: TEXT
 * - status: TEXT (open, closed)
 * - notes: TEXT
 * - created_at: DATETIME
 * - updated_at: DATETIME
 * 
 * Attachments are stored in /attachments/{deal_id}/ folder
 */

// API methods available via window.api.broker:
// - getAll(): Get all deals
// - search(query): Search deals by trader or product
// - getById(id): Get deal by ID
// - create(deal): Create new deal
// - update(deal): Update existing deal
// - delete(id): Delete deal and attachments
// - getAttachments(dealId): Get list of attachments
// - addAttachment(dealId): Open file picker and add attachment
// - openAttachment(filePath): Open attachment in default app
// - deleteAttachment(filePath): Delete specific attachment
