# 31 — Backup and Restore

> **Status**: No database has been provisioned and no backup has ever been taken. Everything below describes the intended strategy for when services are live. None of it has been tested.

---

## Two distinct storage systems with different backup semantics

Submit Pulse stores data in two places with different durability models, different backup mechanisms, and different restore procedures. Treating them as one policy is a mistake.

| System | What it stores | Primary data loss concern |
|---|---|---|
| Supabase Postgres | All relational data: forms, submissions, users, workspaces, audit logs, subscriptions, webhooks | Corruption, accidental deletion, ransomware |
| Cloudflare R2 (intended) | Binary file attachments linked from `submission_files.storage_key` | Accidental deletion of individual objects; regional outage |

These require separate runbooks.

---

## Postgres backup policy (Supabase)

### What Supabase provides on paid plans

- **Continuous WAL archiving**: point-in-time recovery (PITR) to any second within the retention window (7 days on Pro, configurable on Enterprise). This is the primary recovery mechanism.
- **Daily base backups**: stored by Supabase; not directly downloadable by default on lower tiers.
- **Manual backups**: available via the Supabase dashboard ("Backups" tab) or `pg_dump` with the connection string.

Backup configuration is determined by the Supabase plan chosen at provisioning. The PITR window must be confirmed against the plan before relying on it.

### Additional backup recommended

Supabase-managed backups reside in the same cloud account. A second, independent backup — `pg_dump` exported to a separate provider — adds defence against account-level compromise. Recommended frequency: daily, retained 30 days in a separate storage account.

```bash
# Example: dump to compressed SQL, upload to a separate S3-compatible store
pg_dump --no-acl --no-owner \
  "$SUPABASE_CONNECTION_STRING" \
  | gzip > "submitpulse-$(date +%Y%m%d-%H%M%S).sql.gz"
```

### Recovery Point Objective (target, unverified)

With PITR enabled: 1 second. With daily backups only: up to 24 hours.

### Recovery Time Objective (target, unverified)

4–8 hours. Driven by: time to restore Supabase from PITR or backup, re-apply any un-applied migrations, verify RLS policies are active, redeploy application services.

---

## Cloudflare R2 object storage policy

R2 stores binary file attachments. The backup semantics are **different from the database**:

- R2 provides 11-nines (99.999999999%) durability by default — object loss from infrastructure failure is extremely rare, not the main risk.
- The main risks are **application-level deletion** (a bug or a user action deletes an object before its database reference is cleaned up, or vice versa) and **accidental bulk deletion**.
- R2 supports **versioning** and **Object Lock** on Enterprise tiers. Enable versioning to allow recovery from accidental deletion within a window.
- Cross-region replication is available; configure it if the SLA requires geo-redundancy.

**Important relationship**: `submission_files.storage_key` links a database row to an R2 object. If either side is deleted without the other, orphaned references or dangling objects result. The retention sweep worker (`handleSweepRetention`) must coordinate both deletions atomically or idempotently. This handler is currently a stub.

**Backup strategy for R2**: R2 data does not need to be replicated to a separate backup for durability (the native durability is already very high). The backup concern is logical consistency with the database. Periodically verify that every `storage_key` in the database exists as an object in R2 (reconciliation job — not yet implemented).

---

## Postgres restore runbook (intended, untested)

### Prerequisites

- Supabase PITR is enabled and within the retention window for the target timestamp.
- The connection string for the Supabase project is available.
- All Cloudflare Workers are accessible and can be paused via the dashboard.

### Steps

1. **Stop inbound traffic.** Pause the `apps/ingest` Cloudflare Worker via the Cloudflare dashboard (Workers & Pages → your worker → Settings → disable). This prevents new submissions from arriving during the restore window.

2. **Identify the recovery point.** Choose a timestamp before the data loss event. PITR allows recovery to any second within the retention window.

3. **Initiate restore from the Supabase dashboard.** Supabase → Database → Backups → Point in Time Recovery. Select the timestamp. Confirm. Supabase spins up a new database from WAL replay.

4. **Re-apply post-backup migrations.** If any schema migrations were applied after the backup timestamp (i.e. during the data loss window), re-apply them manually:

   ```bash
   psql "$NEW_CONNECTION_STRING" \
     -f packages/database/migrations/0001_row_level_security.sql
   # Apply any subsequent migration files in order
   ```

5. **Verify RLS policies are active.** Run a query as `sp_app` without setting `app.workspace_id` and confirm it returns no rows:

   ```sql
   SET ROLE sp_app;
   SELECT count(*) FROM submissions; -- must return 0 without workspace context
   ```

6. **Update application connection strings.** If the restore produces a new Supabase project URL, update `SP_SUPABASE_URL` and `SP_SUPABASE_SERVICE_ROLE_KEY` in all environments (Vercel env vars, Wrangler secrets).

7. **Resume Cloudflare Workers.** Re-enable the `apps/ingest` worker.

8. **Verify end-to-end.** Submit a test form via the UI. Confirm the submission appears in the dashboard. Check the `submission_events` timeline for expected processing stages.

9. **Notify affected users** if submission data was lost during the gap between the recovery point and the incident.

---

## Idempotency KV — no backup needed

The `IDEMPOTENCY_KV` Cloudflare KV namespace stores short-lived deduplication keys with a TTL. Loss of this data does not corrupt submissions — at worst, a duplicate submission might be accepted during the window when the key would have expired anyway. KV data does not require backup.

---

## Periodic restore testing

An untested backup is not a backup.

Once the database is provisioned, restore testing should run on a schedule:

1. Twice yearly: perform a full PITR restore to a staging Supabase project.
2. Verify all 34 tables are present, all RLS policies are active, and a test submission round-trip works.
3. Record the test date, duration, and any issues in the incident log.

No such test has ever been performed.
