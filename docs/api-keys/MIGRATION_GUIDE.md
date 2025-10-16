# Database Migration Guide - API Key System

## Overview

This guide explains how to migrate from the old API key system (simple string field) to the new secure API key system (separate table with hashing).

## Changes Summary

### Schema Changes

1. **ApiKey Model** - Updated fields:

   -  `key` → `key_hash` (stores SHA-256 hash)
   -  `prefix` - No longer unique (multiple keys can have same prefix)
   -  Added `name` field for key descriptions
   -  Added proper indexes

2. **PartnerLog Model** - Fixed relations:

   -  Properly linked to both `ApiKey` and `Partner`
   -  Added `user_agent` field
   -  Consistent field naming

3. **Partner Model** - Removed direct `api_key` field
   -  Now uses `api_keys` relation

## Migration Steps

### Step 1: Backup Your Database

```bash
# PostgreSQL backup
pg_dump -h localhost -U your_user -d your_database > backup_before_migration.sql
```

### Step 2: Review Schema Changes

Check the updated schema in `prisma/schema.prisma`:

```prisma
model ApiKey {
  id         String       @id @default(uuid())
  key_hash   String       @unique // Store hashed version of API key
  prefix     String // Prefix for identification (ct_live, ct_test) - not unique
  name       String? // Optional name for the key
  partner_id Int
  partner    Partner      @relation(...)
  is_active  Boolean      @default(true)
  expires_at DateTime?
  created_at DateTime     @default(now())
  last_used  DateTime?
  logs       PartnerLog[]
}
```

### Step 3: Create Migration

```bash
cd /path/to/api.ctenvios.com
npx prisma migrate dev --name api_key_security_update
```

### Step 4: Handle Existing Data

If you have existing partners with API keys, you need to migrate them:

```typescript
// migration-script.ts
import prisma from "./src/config/prisma_db";
import { generateApiKey } from "./src/utils/apiKeyUtils";

async function migrateExistingApiKeys() {
   // Note: If you had an old 'api_key' field on Partner model,
   // you would fetch it here and create new ApiKey records

   // For each partner without API keys, create one
   const partners = await prisma.partner.findMany({
      include: {
         api_keys: true,
      },
   });

   for (const partner of partners) {
      if (partner.api_keys.length === 0) {
         console.log(`Creating API key for partner: ${partner.name}`);

         const { displayKey, hashedKey, prefix } = generateApiKey("live");

         await prisma.apiKey.create({
            data: {
               key_hash: hashedKey,
               prefix,
               name: "Default Production Key",
               partner_id: partner.id,
            },
         });

         // IMPORTANT: Send the displayKey to the partner via secure channel
         // This is the only time they'll see it!
         console.log(`Partner ${partner.name}: ${displayKey}`);
         console.log("^^^ SEND THIS TO THE PARTNER SECURELY ^^^");
      }
   }
}

migrateExistingApiKeys()
   .catch(console.error)
   .finally(() => prisma.$disconnect());
```

Run the migration script:

```bash
npx ts-node migration-script.ts
```

### Step 5: Generate Prisma Client

```bash
npx prisma generate
```

### Step 6: Test the System

```bash
# Run tests
npm test

# Test creating a new API key
curl -X POST http://localhost:3000/partners/1/api-keys \\
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Test Key", "environment": "test"}'

# Test using the API key
curl -X GET http://localhost:3000/partners/test \\
  -H "Authorization: Bearer ct_test_YOUR_KEY_HERE"
```

### Step 7: Update Environment Variables

Partners need to update their environment variables with new API keys:

**Old:**

```env
CTENVIOS_API_KEY=simple-uuid-key
```

**New:**

```env
CTENVIOS_API_KEY=ct_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v
```

### Step 8: Deploy

```bash
# Deploy to production
git add .
git commit -m "feat: implement secure API key system with hashing"
git push origin main

# Vercel will auto-deploy
```

## Rollback Plan

If you need to rollback:

```bash
# Restore database backup
psql -h localhost -U your_user -d your_database < backup_before_migration.sql

# Revert code changes
git revert HEAD

# Regenerate Prisma client
npx prisma generate
```

## Communication to Partners

Send this template to all partners:

---

**Subject: Important: API Key System Update**

Dear Partner,

We're upgrading our API key system to enhance security. Here's what you need to know:

**What's Changing:**

-  New API key format: `ct_live_...` or `ct_test_...`
-  Improved security with hashing
-  Support for multiple keys per account
-  Key expiration support

**Action Required:**

1. Log into your admin dashboard
2. Navigate to API Settings
3. Generate a new API key
4. Update your application with the new key
5. Test your integration

**Timeline:**

-  New system available: [DATE]
-  Old keys disabled: [DATE + 30 days]

**Support:**
If you need assistance, contact support@ctenvios.com

Best regards,
CTEnvios Team

---

## Verification Checklist

After migration, verify:

-  [ ] All existing partners have at least one API key
-  [ ] API key authentication works correctly
-  [ ] Rate limiting functions properly
-  [ ] Logging captures all requests
-  [ ] Old API keys (if any) are disabled
-  [ ] Partners have been notified
-  [ ] Documentation is updated
-  [ ] Monitoring is in place
-  [ ] Backup is current
-  [ ] Tests pass

## Common Issues

### Issue: "key_hash field not found"

**Solution:** Regenerate Prisma client

```bash
npx prisma generate
```

### Issue: Partners can't authenticate

**Solution:** Check that:

1. API key is correctly formatted
2. Partner account is active
3. API key is active and not expired
4. Request includes Authorization header

### Issue: Migration fails

**Solution:**

1. Check for existing data conflicts
2. Review error messages carefully
3. Ensure database connection is stable
4. Try running migration with `--create-only` flag first

## Performance Considerations

The new system includes:

-  **Indexes** on `key_hash`, `partner_id`, and `is_active`
-  **Async updates** for `last_used` timestamp
-  **Optimized queries** with proper select statements

Expected performance:

-  API key lookup: < 10ms
-  Authentication check: < 50ms
-  No impact on existing invoice operations

## Security Improvements

Compared to the old system:

| Feature            | Old              | New                       |
| ------------------ | ---------------- | ------------------------- |
| Storage            | Plain text       | SHA-256 hash              |
| Format             | UUID             | Prefixed + 256-bit random |
| Rotation           | Manual DB update | API endpoint              |
| Expiration         | No               | Yes                       |
| Multiple keys      | No               | Yes                       |
| Audit trail        | Basic            | Detailed                  |
| Last used tracking | No               | Yes                       |

## Monitoring

Set up alerts for:

-  Failed authentication attempts > 10/hour
-  API keys nearing expiration (< 7 days)
-  Unusual request patterns
-  Rate limit violations

Example monitoring query:

```sql
-- Check authentication failures
SELECT
  partner_id,
  COUNT(*) as failed_attempts
FROM partner_log
WHERE status_code = 401
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY partner_id
HAVING COUNT(*) > 10;
```

## Next Steps

After successful migration:

1. **Monitor for 1 week** - Watch for any issues
2. **Collect feedback** - Survey partners about the new system
3. **Optimize** - Review performance metrics
4. **Document** - Update internal procedures
5. **Train** - Ensure team knows new system

## Questions?

Contact the development team or refer to:

-  [API_KEY_GUIDE.md](./API_KEY_GUIDE.md) - Usage guide
-  [PARTNERS_API_DOCUMENTATION.md](./PARTNERS_API_DOCUMENTATION.md) - Full API docs

---

**Migration Version:** 1.0  
**Last Updated:** January 2025
