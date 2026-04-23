# Email Proxy Service & Admin Panel Design

**Date:** 2026-04-23
**Status:** Approved

## Overview

A centralized email-sending service powered by Firebase Functions and Resend. Client websites' contact forms route through this single service instead of each managing their own email setup. An admin panel on the Franzke Technologies site provides client management via Firebase Auth and Firestore.

## Firebase Function — Email Proxy

### Endpoint

`POST /sendEmail`

### Request Flow

1. Client site's contact form sends a POST with `{ name, email, message }` plus an `x-api-key` header
2. Function checks the `Origin` header against the client's allowed domain in Firestore
3. Function validates the API key against Firestore
4. If both pass, sends the email via Resend to the client's configured recipient(s)
5. Returns success/error response

### Firestore Schema — `clients` Collection

```
clients/{clientId}
├── name: "KC360 Gym"
├── domain: "kc360gym.com"
├── recipients: ["tim@kc360gym.com"]
├── apiKey: "ft_abc123..."       // generated unique key
├── fromName: "Website Contact"  // optional, defaults to client name
├── createdAt: timestamp
└── active: boolean              // kill switch per client
```

### Resend Integration

- Single Resend API key stored in Firebase Functions secrets
- Sends from a shared verified domain (e.g., `noreply@franzketechnologies.com`)
- Subject line: `New Contact Form Submission — {client name}`

### Rate Limiting

Basic protection — reject if a client sends more than 50 emails/hour (tracked in-memory or a simple Firestore counter).

### CORS

Reads allowed origins from Firestore dynamically rather than hardcoding.

### Environment Secrets

- `RESEND_API_KEY` — stored via `firebase functions:secrets:set RESEND_API_KEY`

## Admin Page — Auth & UI

### Authentication

- Firebase Auth with email/password — single admin account, no signup flow
- Admin user created manually in the Firebase console
- Admin page lives at `/admin` on the Franzke Technologies site

### Page Setup

One Astro page as the route entry point (`src/pages/admin.astro`) with a thin shell:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import AdminApp from '../components/admin/AdminApp.jsx';
---
<BaseLayout title="Admin">
  <AdminApp client:only="react" />
</BaseLayout>
```

`client:only="react"` skips SSR entirely — necessary because Firebase Auth is browser-only.

### Admin UI — Client Management

**Client list view:**
- Table showing: name, domain, active status, date created
- Toggle switch to enable/disable a client
- "Add Client" button

**Add/Edit client form (modal or inline):**
- Fields: name, domain, recipient email(s), active toggle
- API key auto-generated on create (random `ft_` prefixed token)
- "Regenerate API Key" button with confirmation
- Copy-to-clipboard for the API key

### Component Structure

```
src/components/admin/
├── AdminApp.jsx          // Main wrapper, handles auth state
├── LoginForm.jsx         // Email/password login
├── ClientList.jsx        // Table of clients
└── ClientForm.jsx        // Add/edit form
```

### Styling

Match the existing site's dark theme — navy backgrounds, electric blue accents. Functional, not fancy.

## Firebase Function Project Structure

```
/functions/
├── package.json           // separate deps (firebase-admin, resend)
├── index.js               // function entry point
└── lib/
    ├── validateRequest.js  // API key + origin validation
    └── sendEmail.js        // Resend integration
```

## Deployment

- **Function:** `firebase deploy --only functions`
- **Site:** Deploys separately via Netlify as it does today

## Firestore Security Rules

Lock down the `clients` collection to authenticated users only.

## External Setup Required

- Resend account with a verified sending domain (e.g., `franzketechnologies.com`)
- Firebase Auth admin user created manually in the Firebase console
- Firebase Functions secrets configured for `RESEND_API_KEY`

## Client Integration

Client sites need to:
- POST to the function URL with their API key in the `x-api-key` header
- Send `{ name, email, message }` in the body
- That's it

## End-to-End Flow

```
Client site (kc360gym.com)
  → POST https://<region>-<project>.cloudfunctions.net/sendEmail
    Headers: { x-api-key: "ft_abc123..." }
    Body: { name, email, message }
  → Firebase Function
    1. Check Origin header against client's domain
    2. Look up API key in Firestore clients collection
    3. Verify client is active
    4. Send email via Resend to client's recipients
    5. Return { success: true }
  → Client site shows confirmation message
```
