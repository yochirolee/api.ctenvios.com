# 🚀 Stress Testing Cheat Sheet

## Quick Commands (with npm scripts)

```bash
# 1. LIGHT TEST (Start here!) - 160 requests over 40s
npm run artillery:light

# 2. STANDARD TEST - 3,750 requests over 3 min
npm run artillery:test

# 3. ULTRA STRESS - 30,000+ requests over 7.5 min
npm run artillery:ultra

# 4. ENDURANCE TEST - 35,000+ requests over 17 min
npm run artillery:endurance

# 5. SPIKE TEST - 5,000+ requests with sudden spikes
npm run artillery:spike
```

## Or use Artillery directly

```bash
npx artillery run artillery-light.yml
npx artillery run artillery-test.yml
npx artillery run artillery-ultra.yml
npx artillery run artillery-endurance.yml
npx artillery run artillery-spike.yml
```

## Save Results

```bash
# Save to JSON
npx artillery run artillery-ultra.yml --output results.json

# Generate HTML report
npm run artillery:report results.json
```

## Quick Test Comparison

| Test          | Time | Max RPS | Total Reqs | When to Use        |
| ------------- | ---- | ------- | ---------- | ------------------ |
| **light**     | 40s  | 8       | 160        | ✅ First test, dev |
| **test**      | 3m   | 40      | 3,750      | Production ready   |
| **ultra**     | 7.5m | 150     | 30,000     | Find limits        |
| **endurance** | 17m  | 60      | 35,000     | Memory leaks       |
| **spike**     | 3m   | 250     | 5,000      | Traffic bursts     |

## Before Running

1. ✅ Server running: `npm run dev`
2. ✅ Add JWT token to `.yml` files (line 7)
3. ✅ Start with light test
4. ✅ Monitor logs in separate terminal

## What to Watch

```bash
# Server logs show:
⏱️  TOTAL TIME: 280-350ms  ← Should stay under 500ms

# Artillery shows:
http.response_time.p95: 450  ← Should be < 500ms
http.codes.200: 9850         ← Success count
scenarios.failed: 150         ← Should be < 5%
```

## Quick Targets

-  ✅ **p95 < 500ms** = Excellent
-  🟡 **p95 < 1000ms** = Good
-  🔴 **p95 > 2000ms** = Needs work

## Emergency Stop

Press `Ctrl+C` to stop any running test

## Full Documentation

-  `STRESS_TESTING_GUIDE.md` - Complete guide
-  `ARTILLERY_QUICKSTART.md` - Setup guide
