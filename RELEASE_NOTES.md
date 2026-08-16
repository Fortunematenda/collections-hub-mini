# Collections Hub 1.0

## Product areas

- Responsive multi-company portfolio dashboard
- Customer, outstanding-account and payment-promise management
- Excel/CSV imports with account matching and history
- Email, WhatsApp, phone and internal communication records
- Equipment inventory and ISP recovery workflow
- Company-scoped users, roles and permissions
- Splynx, Xero, Sage, Excel, WhatsApp and email connection workspace
- Collection automation builder with approval protection
- PostgreSQL production mode and local JSON development fallback
- Linux systemd and Nginx deployment examples

## Integration boundary

The application includes persistent connection configuration, health status and sync controls. A live Splynx, Xero or Sage synchronisation requires credentials and API access for the customer's specific product and must be implemented against that tenant's supported endpoints. No secret is included in this release.

## Safe production defaults

- Copy `.env.example` to `.env` and set strong secrets.
- Set `ALLOWED_ORIGIN` to the deployed web origin.
- Configure PostgreSQL before importing live customer data.
- Keep suspension and equipment-recovery automations behind manager approval.
- Obtain customer consent before automated WhatsApp communication.
