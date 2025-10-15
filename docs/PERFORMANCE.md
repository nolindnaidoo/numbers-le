# Numbers-LE Performance Test Results

**Test Environment:**
- Node.js: v24.3.0
- Platform: darwin arm64
- Date: 2025-10-15T18:12:19.487Z

## Summary

- **Total Files Tested:** 12
- **Total Extraction Time:** 3581.72ms
- **Average Extraction Time:** 298.48ms
- **Fastest Format:** JSON
- **Slowest Format:** CSV

## Detailed Results

| Format | File | Size | Lines | Time (ms) | Extracted | Numbers/sec | MB/sec | Memory (MB) |
|--------|------|------|-------|-----------|-----------|-------------|--------|-----------|
| JSON | 100kb.json | 0.13MB | 5,362 | 1.1 | 1,340 | 1,218,182 | 118.86 | 0 |
| CSV | 500kb.csv | 0.5MB | 3,261 | 15.87 | 19,554 | 1,232,136 | 31.5 | 0 |
| ENV | 5k.env | 0.61MB | 30,001 | 19.21 | 30,000 | 1,561,687 | 31.79 | 0 |
| JSON | 1mb.json | 1.31MB | 53,682 | 8.42 | 13,420 | 1,593,824 | 155.53 | 0 |
| CSV | 3mb.csv | 3MB | 19,561 | 75.77 | 117,354 | 1,548,819 | 39.59 | 13.129999999999999 |
| INI | 25k.ini | 2.41MB | 200,001 | 204.16 | 150,000 | 734,718 | 11.79 | 25.17 |
| JSON | 5mb.json | 6.55MB | 268,402 | 49.46 | 67,100 | 1,356,652 | 132.4 | 0 |
| CSV | 10mb.csv | 10MB | 65,196 | 324.64 | 391,164 | 1,204,916 | 30.8 | 0.7000000000000028 |
| YAML | 50k.yaml | 5.02MB | 350,001 | 337.36 | 300,000 | 889,258 | 14.87 | 0 |
| JSON | 20mb.json | 26.19MB | 1,073,642 | 199.41 | 268,410 | 1,346,021 | 131.36 | 33.24000000000001 |
| CSV | 30mb.csv | 30MB | 195,592 | 1341.5 | 1,173,540 | 874,797 | 22.36 | 154.05999999999997 |
| TOML | 100k.toml | 14.57MB | 600,002 | 1004.82 | 600,000 | 597,122 | 14.5 | 0 |

## Performance Analysis

**JSON:** Average 64.6ms extraction time, 87,568 numbers extracted on average.

**CSV:** Average 439.45ms extraction time, 425,403 numbers extracted on average.

**ENV:** Average 19.21ms extraction time, 30,000 numbers extracted on average.

**INI:** Average 204.16ms extraction time, 150,000 numbers extracted on average.

**YAML:** Average 337.36ms extraction time, 300,000 numbers extracted on average.

**TOML:** Average 1004.82ms extraction time, 600,000 numbers extracted on average.