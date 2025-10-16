# 🔥 Complete Stress Testing Guide

## 📊 Available Test Configurations

### 1. **Light Test** - `artillery-light.yml` ✅ **Start Here!**

**Best for:** Initial testing, development, debugging

-  **Duration:** 40 seconds
-  **Max load:** 8 req/s
-  **Total requests:** ~160
-  **Purpose:** Verify everything works before heavy testing

```bash
npx artillery run artillery-light.yml
```

---

### 2. **Standard Stress Test** - `artillery-test.yml` 💪

**Best for:** Regular stress testing, CI/CD pipelines

-  **Duration:** 180 seconds (3 minutes)
-  **Max load:** 40 req/s
-  **Total requests:** ~3,750
-  **Purpose:** Standard production-level stress test

```bash
npx artillery run artillery-test.yml
```

---

### 3. **Ultra Stress Test** - `artillery-ultra.yml` 🚀

**Best for:** Finding absolute limits, capacity planning

-  **Duration:** 450 seconds (7.5 minutes)
-  **Max load:** 150 req/s
-  **Total requests:** ~30,000+
-  **Purpose:** Push system to the limit

```bash
npx artillery run artillery-ultra.yml
```

⚠️ **Warning:** This will heavily stress your database and server!

---

### 4. **Endurance Test** - `artillery-endurance.yml` ⏱️

**Best for:** Memory leak detection, long-term stability

-  **Duration:** 1,020 seconds (17 minutes)
-  **Max load:** 60 req/s (sustained)
-  **Total requests:** ~35,000+
-  **Purpose:** Test system stability over time

```bash
npx artillery run artillery-endurance.yml
```

⚠️ **Warning:** Long duration test - monitor memory usage!

---

### 5. **Spike Test** - `artillery-spike.yml` ⚡

**Best for:** Testing sudden traffic bursts, recovery

-  **Duration:** 195 seconds (3.25 minutes)
-  **Max spike:** 250 req/s
-  **Total requests:** ~5,000+
-  **Purpose:** Simulate viral traffic spikes

```bash
npx artillery run artillery-spike.yml
```

⚠️ **Warning:** Expects some failures during spikes!

---

## 🎯 Recommended Testing Sequence

### **Phase 1: Validation** (Day 1)

```bash
# Step 1: Verify basic functionality
npx artillery run artillery-light.yml

# Step 2: If successful, run standard test
npx artillery run artillery-test.yml
```

### **Phase 2: Stress Testing** (Day 2)

```bash
# Step 3: Push the limits
npx artillery run artillery-ultra.yml

# Step 4: Test sudden spikes
npx artillery run artillery-spike.yml
```

### **Phase 3: Stability** (Day 3)

```bash
# Step 5: Long-term endurance
npx artillery run artillery-endurance.yml
```

---

## 📈 Understanding Artillery Metrics

### **Key Metrics to Watch:**

#### 1. **Response Time Percentiles**

```
http.response_time:
  min: 150
  max: 2500
  median: 300       ← p50: 50% of requests
  p95: 800          ← p95: 95% of requests ✅ IMPORTANT
  p99: 1500         ← p99: 99% of requests ✅ IMPORTANT
```

**What it means:**

-  **p95 < 500ms** = Excellent 🟢
-  **p95 < 1000ms** = Good 🟡
-  **p95 > 2000ms** = Needs optimization 🔴

#### 2. **Request Rate**

```
http.request_rate: 45/sec
```

**What it means:** Your server is handling 45 requests per second

#### 3. **Status Codes**

```
http.codes.200: 8500    ← Success
http.codes.201: 1200    ← Created
http.codes.500: 15      ← Server errors 🔴
http.codes.503: 5       ← Service unavailable 🔴
```

**What it means:**

-  **Error rate < 1%** = Excellent 🟢
-  **Error rate < 5%** = Acceptable 🟡
-  **Error rate > 10%** = Critical 🔴

#### 4. **Scenario Completion**

```
scenarios.completed: 9500
scenarios.failed: 300
```

**Success rate:** 96.9% ✅

---

## 🎛️ Customizing Test Intensity

### **Increase Request Rate**

Edit any `.yml` file and modify `arrivalRate`:

```yaml
phases:
   - duration: 60
     arrivalRate: 100 # ← Change this number
     name: "Custom load"
```

### **Increase Duration**

```yaml
phases:
   - duration: 300 # ← 5 minutes (in seconds)
     arrivalRate: 50
```

### **Add More Phases**

```yaml
phases:
   - duration: 30
     arrivalRate: 10
     name: "Warm up"
   - duration: 60
     arrivalRate: 50
     name: "Medium load"
   - duration: 120
     arrivalRate: 100
     name: "High load"
   - duration: 60
     arrivalRate: 200 # ← New peak phase
     name: "EXTREME"
```

---

## 🔍 Monitoring During Tests

### **1. Server Console Logs**

Watch for performance metrics:

```
⏱️  Validation: 1-3ms
⏱️  DB Validation: 40-70ms
⏱️  HBL Generation: 80-150ms
⏱️  Transaction: 150-180ms
⏱️  TOTAL TIME: 280-350ms
```

### **2. Database Monitoring**

```bash
# Monitor PostgreSQL connections
# In psql:
SELECT count(*) FROM pg_stat_activity;

# Monitor slow queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '1 second';
```

### **3. System Resources**

```bash
# Monitor CPU and Memory
top

# Or use htop for better visualization
htop

# Monitor Node.js memory
node --max-old-space-size=4096 your-server.js
```

---

## 🚨 Troubleshooting

### **Problem: High Error Rate (>5%)**

**Causes:**

-  Database connection pool exhausted
-  Transaction timeouts
-  Memory issues

**Solutions:**

```javascript
// In your prisma config, increase pool size:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connection_limit = 20  // Increase from default 10
}
```

---

### **Problem: Response Times Increasing Over Time**

**Causes:**

-  Memory leak
-  Database connection not being released
-  Cache building up

**Solutions:**

-  Run endurance test to identify memory leaks
-  Check connection pool usage
-  Monitor heap memory with `node --inspect`

---

### **Problem: Sudden Spike Failures**

**Expected!** Spike tests are designed to overwhelm the system temporarily.

**Good metrics:**

-  System recovers within 30-60 seconds
-  No cascading failures
-  Error rate drops back to <5% after spike

**Bad metrics:**

-  System doesn't recover
-  Errors continue after spike ends
-  Server crashes

---

## 💡 Pro Tips

### **1. Run Tests Incrementally**

Don't jump straight to ultra tests. Always start light!

### **2. Use Database Connection Pooling**

```javascript
// Good practice
const prisma = new PrismaClient({
   datasources: {
      db: {
         url: process.env.DATABASE_URL,
      },
   },
   log: ["error", "warn"],
});
```

### **3. Monitor in Real-Time**

Open multiple terminals:

-  Terminal 1: Run Artillery
-  Terminal 2: Watch server logs
-  Terminal 3: Monitor database (`watch "psql -c 'SELECT count(*) FROM pg_stat_activity;'"`)

### **4. Save Results**

```bash
# Save results to file
npx artillery run artillery-ultra.yml --output results.json

# Generate HTML report
npx artillery report results.json
```

### **5. Test with Real Data**

Update `artillery-processor.js` with actual IDs from your database.

---

## 📊 Performance Targets

Based on your optimizations, target metrics:

| Test Type     | p95 Response Time | p99 Response Time | Error Rate           |
| ------------- | ----------------- | ----------------- | -------------------- |
| **Light**     | < 400ms           | < 600ms           | < 0.5%               |
| **Standard**  | < 500ms           | < 800ms           | < 1%                 |
| **Ultra**     | < 800ms           | < 1500ms          | < 3%                 |
| **Endurance** | < 600ms           | < 1000ms          | < 2%                 |
| **Spike**     | < 2000ms          | < 5000ms          | < 15% (during spike) |

---

## 🎯 Next Steps After Testing

### **If tests pass:**

✅ Document your findings
✅ Set up monitoring alerts
✅ Schedule regular stress tests
✅ Consider horizontal scaling

### **If tests fail:**

🔍 Analyze bottlenecks (check logs)
🔍 Optimize database queries
🔍 Increase connection pools
🔍 Add caching layer
🔍 Consider read replicas

---

## 📝 Test Comparison Chart

| Configuration | Duration | Max RPS | Total Reqs | Use Case    |
| ------------- | -------- | ------- | ---------- | ----------- |
| **Light**     | 40s      | 8       | ~160       | Development |
| **Standard**  | 180s     | 40      | ~3,750     | CI/CD       |
| **Ultra**     | 450s     | 150     | ~30,000    | Capacity    |
| **Endurance** | 1020s    | 60      | ~35,000    | Stability   |
| **Spike**     | 195s     | 250     | ~5,000     | Recovery    |

---

## 🚀 Ready to Test?

1. **Add your JWT token** to all `.yml` files (line 7)
2. **Start your server:** `npm run dev`
3. **Run light test first:** `npx artillery run artillery-light.yml`
4. **Gradually increase:** Work your way up to heavier tests
5. **Monitor everything:** Logs, database, system resources
6. **Document results:** Save metrics for comparison

Happy stress testing! 🎉
