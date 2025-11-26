// Workflow Module
// This module provides the daily workflow dashboard functionality
// The main implementation is in app.js, this file serves as documentation

/**
 * Daily Workflow Steps:
 * 1. Review new orders
 * 2. Check inventory items low stock
 * 3. Pending brokerage deals
 * 4. Prepare shipments
 * 5. Contact traders
 * 
 * Dashboard displays:
 * - Total products count
 * - Total clients count
 * - Pending orders count
 * - Open deals count
 * - Recent pending orders list
 * - Open broker deals list
 * - Interactive daily checklist
 */

// API methods available via window.api.workflow:
// - getData(): Get all workflow dashboard data including:
//   - pendingOrdersCount
//   - openDealsCount
//   - recentOrders
//   - openBrokerDeals
//   - totalProducts
//   - totalClients
