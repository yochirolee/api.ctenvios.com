# Fix Prisma migration history without reset

## Fix: init migration "modified after applied" (no reset, safe for prod)

If you see: **The migration `20260212013506_init` was modified after it was applied.**

Do **not** run `prisma migrate reset` (that drops all data). Fix the history so the stored checksum matches the current file:

### Step 1: Remove the init migration row (checksum is wrong)

Run against the DB that shows the error (dev or prod):

```sql
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260212013506_init';
```

Example with `psql` (adjust from your `.env` / connection):

```bash
# From project root; set connection from .env or pass -h -U -d -p
psql "$DATABASE_URL" -c "DELETE FROM \"_prisma_migrations\" WHERE \"migration_name\" = '20260212013506_init';"
```

### Step 2: Record the current init migration as applied (no SQL re-run)

```bash
npx prisma migrate resolve --applied "20260212013506_init"
```

This writes a new row with the **current** file’s checksum. Schema is unchanged; only migration history is updated.

### Step 3: Verify

```bash
npx prisma migrate status
```

You should see all migrations applied. Then you can run `prisma migrate dev` or `prisma migrate deploy` as usual.

### Alternative: update the checksum in place (no delete)

If you prefer not to delete the row, update the stored checksum to match the **current** migration file. No `resolve` needed.

**1. Get the current file checksum** (from project root):

```bash
CHECKSUM=$(shasum -a 256 prisma/migrations/20260212013506_init/migration.sql | awk '{print $1}')
echo $CHECKSUM
```

**2. Update the row** (use the printed checksum in the SQL, or with a variable):

```sql
UPDATE "_prisma_migrations"
SET "checksum" = '901eac0457f4428639dbe47fd96797b7fcb3e04a16e5951cda02c8328bc5291f'
WHERE "migration_name" = '20260212013506_init';
```

Or in one shot with `psql`:

```bash
CHECKSUM=$(shasum -a 256 prisma/migrations/20260212013506_init/migration.sql | awk '{print $1}')
psql "$DATABASE_URL" -c "UPDATE \"_prisma_migrations\" SET \"checksum\" = '$CHECKSUM' WHERE \"migration_name\" = '20260212013506_init';"
```

**3. Verify:**

```bash
npx prisma migrate status
```

If you change the init migration file again later, recompute the checksum (step 1) and run the UPDATE again with the new value.

---

## (Legacy) Other migration history issues

Your DB has:

-  One migration `20260128150000_add_parcel_soft_delete` applied but **modified after apply** (checksum mismatch).
-  Three applied migrations `20260128150000_add_soft_delete_to_parcel_and_order_item` that are **missing** from the local migrations folder.

The schema changes (e.g. `deleted_at` on Parcel and OrderItem) are already applied; we only need to fix the `_prisma_migrations` table.

## Option 1: Fix via SQL + resolve (recommended, no data loss)

### Step 1: Remove wrong migration rows from the DB

Connect to your DB and run:

```sql
-- Remove the 4 problematic migration rows (wrong name or wrong checksum).
-- The actual schema is already applied, so this only cleans history.
DELETE FROM "_prisma_migrations"
WHERE "migration_name" IN (
  '20260128150000_add_parcel_soft_delete',
  '20260128150000_add_soft_delete_to_parcel_and_order_item'
);
```

Example with `psql` (from project root, uses `DATABASE_URL` from `.env`):

```bash
PGPASSWORD=audioslave psql -h localhost -p 5432 -U yosho -d ctenvios -c "DELETE FROM \"_prisma_migrations\" WHERE \"migration_name\" IN ( '20260128150000_add_parcel_soft_delete', '20260128150000_add_soft_delete_to_parcel_and_order_item' );"
```

### Step 2: Record the current local migration as applied

From the project root:

```bash
npx prisma migrate resolve --applied "20260128150000_add_parcel_soft_delete"
```

This inserts one row in `_prisma_migrations` for your current local migration (with the correct checksum) without running the SQL again.

### Step 3: Verify

```bash
npx prisma migrate status
```

You should see something like: all migrations applied, no pending.

---

## Option 2: Nuclear option (only if you can lose all data)

```bash
npx prisma migrate reset
```

This drops the database and reapplies all migrations from scratch. Use only in development when data loss is acceptable.
