# Moving Veloce to another Vercel account

## Transfer the existing project

Prefer the existing project's **Settings → General → Transfer Project** when moving ownership. Vercel copies project environment variables, including values its CLI cannot export. Review the transfer screen before proceeding.

Vercel Blob uses a separate transfer process. Reconfigure integrations on the destination team and confirm the existing Neon database remains accessible. Keep the original production secrets and database; changing accounts does not require rotating them.

Official instructions: https://vercel.com/docs/projects/transferring-projects

## If creating a new project instead

The local preparation files are ignored by Git:

- `.env.vercel-import.local`: recovered local values for importing into **Production**. This is incomplete; fill every applicable `TODO` before importing.
- `.env.vercel-transfer-status.local`: variable names, recovery sources, and unresolved entries. No secret values are included in this report.
- `.env.vercel-source.production.local`: raw Vercel export. Production secrets are redacted as `[SENSITIVE]`; do not import this file.

Recovered local credentials have not been verified against production. Recover missing values from the original secret store or service provider. Preserve the original production `HASH_SECRET`, authentication hashes, session secrets, and enrolled TOTP secret. Do not copy development login credentials or Vercel-generated `VERCEL_*` variables.

The import file retains `https://veloceapp.dev` as the production origin. If the domain changes, update `NEXT_PUBLIC_SITE_URL` before building, plus Cal.com webhook URLs and email provider domain settings. Cal.com must use the actual configured webhook signing secret, not the text `CAL_WEBHOOK_SECRET`.

Import the completed file under the new project's **Settings → Environment Variables**, targeting **Production**. Use a separate database and configuration for Preview and Development.

Run the existing production configuration check with the completed import explicitly loaded:

```bash
VERCEL=1 node --env-file=.env.vercel-import.local scripts/check-production.mjs
```

The check does not prove credential validity or connectivity. Before switching traffic, verify `/api/health`, a booking and its webhook delivery, email delivery, Blob image access/uploads, and configured owner/developer logins. Reconnect booking and privacy maintenance schedules. Review database migrations using the deployment guide; do not seed or reset the existing production database.

## Repository-specific Vercel login

This checkout uses an isolated CLI login stored in ignored `.vercel/account`. Pass that configuration explicitly so commands use the Veloce account:

```bash
vercel project inspect veloce-dev --scope veloceappdev-5296 --global-config .vercel/account
vercel env ls production --scope veloceappdev-5296 --global-config .vercel/account
```

On a new checkout, authenticate with `vercel login --global-config .vercel/account`, then link with `vercel link --yes --project veloce-dev --scope veloceappdev-5296 --global-config .vercel/account`.

The current hosted event is `7769040`, owned by Cal.com user `3437505`. Its configured duration is 120 minutes and location is Cal Video. Current credentials are kept in ignored `.env.cal-new-account.local` and Vercel Production; the original migration import still contains old-account values and must not be used to overwrite this setup. Real availability is controlled by Cal.com and its connected Google Calendar.
