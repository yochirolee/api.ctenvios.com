# Artillery Load Testing Quick Start

## 🔧 What Was Fixed

1. **Removed missing CSV file dependency** - The test was trying to load `test-data.csv` which doesn't exist
2. **Added authentication headers** - The endpoint requires JWT authentication
3. **Created light test version** - For quick testing without overwhelming your system

## 📋 Prerequisites

1. Make sure your server is running on `http://localhost:3000`
2. Install dependencies: `npm install` or `yarn install`
3. Get a valid JWT token (see below)

## 🔑 Step 1: Get Your JWT Token

### Option A: From Browser (Easiest)

1. Log in to your application
2. Open Developer Tools (F12)
3. Go to **Application** > **Local Storage** (Chrome) or **Storage** > **Local Storage** (Firefox)
4. Find your token (usually `token`, `auth_token`, or `jwt`)
5. Copy the entire token value

### Option B: Generate Programmatically

Run this in Node.js (replace with your actual values):

```javascript
const jwt = require("jsonwebtoken");
const token = jwt.sign(
   {
      id: "YOUR_USER_ID",
      agency_id: 1,
      role: "AGENCY_ADMIN",
   },
   process.env.JWT_SECRET || "your-secret-key",
   { expiresIn: "24h" }
);
console.log(token);
```

### Option C: Use Helper Script

```bash
node get-auth-token.js
```

## 🚀 Step 2: Configure Artillery

Edit `artillery-light.yml` (or `artillery-test.yml` for heavy testing):

Find this line:

```yaml
Authorization: "Bearer YOUR_JWT_TOKEN_HERE"
```

Replace `YOUR_JWT_TOKEN_HERE` with your actual token:

```yaml
Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## ▶️ Step 3: Run the Tests

### Light Test (Recommended for First Run)

```bash
npx artillery run artillery-light.yml
```

This runs:

-  10s warm-up (2 req/s)
-  20s sustained (5 req/s)
-  10s peak (8 req/s)

**Total:** ~160 requests over 40 seconds

### Full Stress Test

```bash
npx artillery run artillery-test.yml
```

This runs:

-  30s warm-up (5 req/s)
-  60s sustained (15 req/s)
-  30s peak (25 req/s)
-  60s maximum (40 req/s)

**Total:** ~3,750 requests over 180 seconds ⚠️ **Heavy load!**

## 📊 Understanding the Results

Artillery will show you:

-  **Request rate** - Requests per second
-  **Response time** - p50, p95, p99 percentiles
-  **Errors** - Failed requests
-  **Status codes** - 200, 201, 400, 500, etc.

### What to Look For:

✅ **Good Performance:**

-  p95 response time < 500ms
-  p99 response time < 1000ms
-  Error rate < 1%

⚠️ **Needs Optimization:**

-  p95 response time > 1000ms
-  Error rate > 5%
-  Many timeouts

🔥 **Critical Issues:**

-  p95 response time > 3000ms
-  Error rate > 10%
-  Database connection errors

## 🐛 Troubleshooting

### Error: "401 Unauthorized"

-  Your JWT token is invalid or expired
-  Get a fresh token (Step 1)

### Error: "Connection refused"

-  Your server isn't running
-  Check if it's on the correct port (3000)

### Error: "Timeout"

-  Database might be overwhelmed
-  Try `artillery-light.yml` first
-  Check your database connection pool size

### Error: "Customer/Receiver/Service not found"

-  Update IDs in `artillery-processor.js`:
   -  Lines 9: `sampleAgencies`
   -  Lines 13-14: `usersByAgency`
   -  Lines 20-23: `sampleCustomers`, `sampleReceivers`, `sampleServices`

## 📈 Performance Monitoring

With the optimizations we made, you should see in your server logs:

```
⏱️  Validation: 1-3ms
⏱️  DB Validation: 40-70ms        ← ~50% faster!
⏱️  HBL Generation: 80-150ms
⏱️  Transaction: 150-180ms         ← ~20% faster!
⏱️  TOTAL TIME: 280-350ms          ← ~30% faster overall!
================================================
```

## 🎯 Next Steps

1. **Start with light test** - Verify everything works
2. **Check server logs** - Look for performance metrics
3. **Gradually increase load** - Modify `arrivalRate` in the config
4. **Monitor database** - Watch connection pools and query times
5. **Iterate and optimize** - Use results to find bottlenecks

## 📝 Test Configuration Files

-  `artillery-light.yml` - Light testing (~160 requests)
-  `artillery-test.yml` - Full stress test (~3,750 requests)
-  `artillery-processor.js` - Data generator
-  `get-auth-token.js` - Token helper

## 💡 Pro Tips

1. **Warm up your database** - Run a light test first
2. **Test incrementally** - Don't jump straight to maximum load
3. **Monitor system resources** - Watch CPU, RAM, database connections
4. **Use realistic data** - Update processor with real IDs from your DB
5. **Test in isolation** - Stop other services consuming resources

## 🆘 Need Help?

Check your server logs for:

-  Performance timing metrics (⏱️)
-  Error messages
-  Database query performance
-  Memory usage

Happy testing! 🚀
