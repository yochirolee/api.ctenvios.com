# Artillery Database Foreign Key Fix - Summary

## Problem Fixed
Artillery stress tests were failing with `P2003` foreign key constraint errors because they were using hardcoded customer and receiver IDs (1-200) that didn't exist in the database.

## Solution Implemented
Updated `artillery-processor.js` to fetch real customer, receiver, and user IDs from the database at startup, similar to how the Jest tests work with `TestDataGenerator`.

## Changes Made

### 1. artillery-processor.js
- **Added:** Prisma Client import and initialization
- **Added:** `initializeData()` async function that:
  - Fetches 50 real customers from database
  - Fetches 50 real receivers from database
  - Fetches 20 real users from agencies 1 & 2
  - Organizes users by agency ID
  - Validates data exists before running tests
- **Changed:** Replaced hardcoded ID arrays with database-populated arrays
- **Changed:** Removed `fallbackUsers` constant, now uses `sampleUsers` from database
- **Exported:** `initializeData` function for Artillery to call

### 2. All Artillery Config Files
Updated all 5 config files to initialize database data before running scenarios:
- artillery-test.yml
- artillery-light.yml
- artillery-ultra.yml
- artillery-endurance.yml
- artillery-spike.yml

**Added initialization scenario:**
```yaml
scenarios:
  # Initialize data from database before running any scenarios
  - name: "Initialize Database Data"
    weight: 1
    flow:
      - function: "initializeData"
```

### 3. YAML Indentation Fixed
Fixed all remaining indentation issues in config files to use consistent 2-space indentation.

## How It Works

1. **First Request:** When Artillery starts, it calls `initializeData()` which queries the database once
2. **Data Cached:** Customer, receiver, and user IDs are stored in module-level variables
3. **Subsequent Requests:** All test requests use real IDs from the cached arrays
4. **No More Foreign Key Errors:** All IDs are guaranteed to exist in the database

## Testing the Fix

Run the light test to verify:
```bash
yarn artillery:light
```

Expected output:
```
🔄 Initializing Artillery data from database...
✅ Artillery data initialized:
   - Customers: 50
   - Receivers: 50
   - Users: 20
   - Agency 1 Users: X
   - Agency 2 Users: Y
```

Then you should see successful order creation with 200/201 status codes instead of P2003 errors.

## Benefits

1. ✅ No more foreign key constraint errors
2. ✅ Uses real production data for accurate testing
3. ✅ Automatically adapts to your database state
4. ✅ Clear error messages if data is missing
5. ✅ Consistent with Jest test approach

## Maintenance

If you need to regenerate the token or the tests start failing with 401 errors, run:
```bash
node generate-test-token.js
```

And update the Bearer token in all `.yml` files.

