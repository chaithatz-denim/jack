# JACK RUSSEL Production Sample Tracking

Standalone HTML prototype for production sample tracking, weekly reporting, workflow status updates, approvals, pattern-file uploads, and role-based access.

## Open the prototype

Open [`outputs/production_sample_tracking_prototype.html`](outputs/production_sample_tracking_prototype.html) in a browser.

## Deploy on Vercel

The repository includes `vercel.json`, which maps the production domain root to the standalone prototype. Vercel requires no build command or framework preset for this static deployment.

Demo login:

- User: `jack`
- Password: `russel`
- Role: `HEAD ADMIN`

## Prototype roles

- **HEAD ADMIN** — full access and role assignment
- **ADMIN** — update sample status only
- **ช่าง PATTERN** — upload pattern files only

All data is mock data stored in browser memory and resets when the page is refreshed.
