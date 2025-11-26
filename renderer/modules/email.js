// Email Module
// This module provides functions for composing and sending emails via SMTP
// The main implementation is in app.js, this file serves as documentation

/**
 * Email Template fields:
 * - id: INTEGER PRIMARY KEY
 * - name: TEXT (required)
 * - subject: TEXT
 * - body: TEXT
 * - created_at: DATETIME
 * 
 * SMTP Settings fields:
 * - host: TEXT (default: smtp-mail.outlook.com)
 * - port: INTEGER (default: 587)
 * - secure: BOOLEAN (default: false)
 * - user: TEXT (email address)
 * - pass: TEXT (password)
 * 
 * Sent emails are saved as HTML files in /emails folder
 */

// API methods available via window.api.email:
// - getSettings(): Get SMTP settings
// - saveSettings(settings): Save SMTP settings
// - getTemplates(): Get all email templates
// - saveTemplate(template): Save new or update template
// - deleteTemplate(id): Delete template
// - send(emailData): Send email via SMTP
// - getSentEmails(): Get list of sent email files
// - openSentEmail(filePath): Open sent email in browser
