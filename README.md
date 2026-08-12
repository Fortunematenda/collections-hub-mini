# Collections Hub Mini

A responsive multi-company collections and ISP equipment-recovery application.

## What this version includes

- Multi-company portfolio support with company-scoped data isolation
- Company CRUD (add / edit / archive) and Company Details pages
- Customer CRUD and full Customer Details pages with operational tabs
- Excel import with company + account number matching (history preserved on updates)
- Communications centre (WhatsApp / Email / Phone / Internal notes)
- Promises to pay, payments, follow-ups, notes and activity audit trail
- Equipment inventory and recovery job workflow
- Message templates and company settings
- Toast notifications, confirmation modals, empty states and mobile-responsive layouts

## Core workflow

1. Select or add the company you are collecting for.
2. Upload that company's Excel/XLS/CSV outstanding-clients file.
3. Review the detected column mapping and import.
4. Open a customer to work the account: message, call, promise, payment, note, follow-up.
5. Escalate cancelled/non-paying clients to equipment recovery and track until completion.
6. Review company-wide communication and activity history.

## Run locally

```bash
npm install
npm run dev
```

This starts both the Vite UI and the API server (`server/index.js` on port 8787).

Default admin login (from `.env`):

- Email: `admin@bretunetech.com`
- Password: set in `.env` as `ADMIN_PASSWORD`

Email sending uses the `SMTP_*` values in `.env` and requires a valid JWT. WhatsApp remains demo-only until a Business API is connected.

Then open the local URL shown by Vite.

## Build

```bash
npm run build
npm run preview
```

## Routes

| Path | Page |
|------|------|
| `/` | Dashboard |
| `/companies` | Company portfolios |
| `/companies/:companyId` | Company details |
| `/customers/:customerId` | Customer details |
| `/accounts` | Outstanding accounts |
| `/followups` | Follow-up queue |
| `/promises` | Promises to pay |
| `/recovery` | Equipment recovery |
| `/imports` | Excel imports |
| `/templates` | Message templates |
| `/communications` | Communication centre |
| `/settings` | Company settings |

## MVP notes

This remains a front-end MVP with in-memory demo data. Spreadsheet parsing works in the browser. Messaging is demo/queued locally until an official WhatsApp/email provider is connected.

Never place WhatsApp, SMTP, database or other production secrets in the browser application.
