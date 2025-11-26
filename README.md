# FancyFoods Manager

A full local desktop application for Windows and macOS built with Electron.js + Node.js + SQLite.

**Company:** Fancy Foods  
**Type:** Local-only (NO internet required except for email sending)

## Purpose

This app manages the business operations of a wholesale nuts and seeds company. The user acts as both a wholesaler and a broker for other food products like rice, starch, coffee, and spices.

## Features

### Modules

1. **Products Module** - Add/Edit/Delete products with categories (nuts, seeds, mixed, roasted), units, and pricing
2. **Clients Module** - Store shop owners and wholesalers with contact information
3. **Broker Deals Module** - Manage brokerage deals for bulk food items with attachment support
4. **Orders Module** - Create and manage sales orders for local shops
5. **Email Writer Module** - Built-in email composer with SMTP support for Hotmail/Outlook
6. **Workflow Module** - Daily routine checklist and dashboard

### Backup System

- Export database + attachments + emails into a ZIP backup file
- Import backup files to restore application data

## Installation

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd Fancy-foods-app

# Install dependencies
npm install

# Start the application
npm start
```

### Development

```bash
# Run in development mode
NODE_ENV=development npm start
```

## Building Installers

### Windows (.exe)

```bash
npm run build:win
```

### macOS (.dmg)

```bash
npm run build:mac
```

### All platforms

```bash
npm run build
```

Built installers will be placed in the `dist/` folder.

## Folder Structure

```
/fancyfoods-app
    /main.js           - Electron main process
    /preload.js        - Secure IPC bridge
    /renderer
        index.html     - Main UI
        style.css      - Custom styles
        app.js         - Application logic
        bootstrap.min.css
        bootstrap.bundle.min.js
    /database          - SQLite database location (created at runtime)
    /attachments       - Deal attachments storage
    /emails            - Sent emails archive
    /backup            - Temporary backup extraction
```

## Technology Stack

- **Electron** - Cross-platform desktop framework
- **better-sqlite3** - Fast SQLite database
- **nodemailer** - Email sending via SMTP
- **Bootstrap 5** - UI framework (bundled locally)
- **archiver / extract-zip** - Backup compression

## Database Schema

- **products** - Product catalog
- **clients** - Customer information
- **broker_deals** - Brokerage deals with traders
- **orders** - Sales orders
- **order_items** - Order line items
- **email_templates** - Saved email templates
- **smtp_settings** - Email configuration

## SMTP Configuration

The email module supports Hotmail/Outlook SMTP:
- Host: smtp-mail.outlook.com
- Port: 587
- Secure: No (STARTTLS)

Configure your email credentials in the Email module settings.

## License

MIT
