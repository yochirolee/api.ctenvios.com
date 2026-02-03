# Fix Prisma migration history without reset

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
