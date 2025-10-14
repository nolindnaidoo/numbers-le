# Numbers-LE Technical Specification

## Overview

This document defines the technical behavior, algorithms, and edge case handling for Numbers-LE's number extraction engine.

**Version:** 1.0.0  
**Last Updated:** October 2025

---

## Supported Number Formats

### Integer

**Pattern:** `-?[0-9]+`

**Examples:**

```
0, 1, 42, -17, 999999
```

**Edge cases:**

- Leading zeros: `007` → extracted as `7`
- Plus sign: `+42` → extracted as `42`
- Underscores: `1_000_000` → format-dependent (TOML: yes, JSON: no)

---

### Floating Point

**Pattern:** `-?[0-9]+\.[0-9]+`

**Examples:**

```
3.14, -0.5, 999.999, 0.0
```

**Edge cases:**

- Trailing zeros: `3.140` → extracted as `3.14`
- Leading decimal: `.5` → extracted as `0.5` (format-dependent)
- Trailing decimal: `5.` → extracted as `5.0` (format-dependent)

---

### Scientific Notation

**Pattern:** `-?[0-9]+(\.[0-9]+)?[eE][+-]?[0-9]+`

**Examples:**

```
1e10, 6.022e23, -1.6e-19, 2.5E+3
```

**Edge cases:**

- Uppercase E: `1E10` → same as `1e10`
- Implicit positive exponent: `1e3` → same as `1e+3`
- Decimal mantissa: `1.5e2` → `150.0`

---

### Special Values

**Handled:**

- `Infinity` / `-Infinity` (JSON, YAML)
- `NaN` (JSON, YAML)

**Extracted as:**

- `Infinity` → `Number.POSITIVE_INFINITY`
- `-Infinity` → `Number.NEGATIVE_INFINITY`
- `NaN` → `Number.NaN`

**Configuration:**

- `numbers-le.extractSpecialValues` (future): control extraction

---

## Format-Specific Behavior

### JSON

**Parser:** Native `JSON.parse()`

**Number extraction:**

1. Parse JSON structure
2. Traverse all values recursively
3. Extract primitive numbers
4. Preserve document order

**Edge cases:**

- String numbers: `"42"` → NOT extracted (type-safe)
- Boolean: `true`/`false` → NOT extracted
- `null` → NOT extracted
- Array of numbers: `[1, 2, 3]` → extracts `1`, `2`, `3` in order

**Example:**

```json
{
  "count": 42,
  "price": 19.99,
  "items": [1, 2, 3],
  "meta": {
    "version": "1.0"
  }
}
```

**Extracted:** `42`, `19.99`, `1`, `2`, `3` (note: `"1.0"` is a string, not extracted)

---

### YAML

**Parser:** `js-yaml`

**Number extraction:**

1. Parse YAML to JavaScript object
2. Traverse all values recursively
3. Extract primitive numbers
4. Handle YAML-specific number formats

**Edge cases:**

- Octal: `0o77` → `63`
- Hexadecimal: `0xFF` → `255`
- Underscore separators: `1_000_000` → `1000000`
- Infinity: `.inf` / `-.inf` → `Infinity` / `-Infinity`
- NaN: `.nan` / `.NaN` / `.NAN` → `NaN`

**Example:**

```yaml
count: 42
price: 19.99
hex: 0xFF
items:
  - 1
  - 2
  - 3
```

**Extracted:** `42`, `19.99`, `255`, `1`, `2`, `3`

---

### CSV

**Parser:** `csv-parse` (from `csv-parse` package)

**Number extraction:**

1. Parse CSV with headers
2. For each selected column:
   - Try to parse as number
   - Skip non-numeric values
3. Stream or batch based on settings

**Edge cases:**

- Mixed columns: Skip non-numeric cells
- Empty cells: Skip (not extracted as `0`)
- Quoted numbers: `"42"` → extract `42` if parseable
- Currency: `$1,234.56` → extract `1234.56` (format-dependent)

**Streaming mode:**

- Batch size: 1000 rows
- Progress updates every 10 batches
- Cancellable via token

**Example:**

```csv
name,age,price,quantity
Alice,30,19.99,2
Bob,25,29.99,1
```

**Extracted (all columns):** `30`, `19.99`, `2`, `25`, `29.99`, `1`  
**Extracted (age column only):** `30`, `25`

---

### TOML

**Parser:** `@iarna/toml`

**Number extraction:**

1. Parse TOML to JavaScript object
2. Traverse all values recursively
3. Extract primitive numbers
4. Handle TOML-specific formats

**Edge cases:**

- Underscore separators: `1_000_000` → `1000000`
- Hexadecimal: `0xDEADBEEF` → `3735928559`
- Octal: `0o755` → `493`
- Binary: `0b11010110` → `214`
- Infinity/NaN: `inf`, `-inf`, `nan` → `Infinity`, `-Infinity`, `NaN`

**Example:**

```toml
count = 42
price = 19.99
hex = 0xFF
large = 1_000_000
```

**Extracted:** `42`, `19.99`, `255`, `1000000`

---

### INI

**Parser:** `ini` package

**Number extraction:**

1. Parse INI sections and keys
2. Try to parse each value as number
3. Skip non-numeric values

**Edge cases:**

- Section names: Not extracted
- String values: `"42"` → NOT extracted (kept as string)
- Boolean-like: `true`, `false` → NOT extracted
- Unquoted numbers: `42` → extracted

**Example:**

```ini
[database]
port = 5432
timeout = 30.5
name = mydb

[cache]
ttl = 3600
```

**Extracted:** `5432`, `30.5`, `3600`

---

### .ENV

**Parser:** `dotenv` package

**Number extraction:**

1. Parse environment variables
2. Try to parse each value as number
3. Skip non-numeric values

**Edge cases:**

- Quotes: `PORT="5432"` → extract `5432`
- Spaces: `PORT = 5432` → extract `5432`
- Comments: Ignored
- Multiline: Not supported (single line only)

**Example:**

```env
PORT=5432
TIMEOUT=30.5
API_KEY=abc123
MAX_CONNECTIONS=100
```

**Extracted:** `5432`, `30.5`, `100`

---

## Extraction Algorithm

### Core Algorithm

```
function extractNumbers(text, fileType):
  1. Parse text into structured data (format-specific parser)
  2. If parse fails, return error with details
  3. Traverse structure depth-first, left-to-right
  4. For each value:
     a. Check if primitive number
     b. If yes, add to results array
     c. If container (object/array), recurse
  5. Return results array (preserves document order)
```

### Order Preservation

Numbers are extracted in document order:

- JSON: Key order (insertion order in most parsers)
- YAML: Document order
- CSV: Row-then-column order
- TOML: Section-then-key order
- INI: Section-then-key order
- ENV: Line order

**Rationale:** Predictable, reproducible results.

---

## Post-Processing

### Deduplication

**Algorithm:** Hash set deduplication

```
function dedupe(numbers):
  seen = new Set()
  result = []
  for num in numbers:
    if num not in seen:
      seen.add(num)
      result.append(num)
  return result
```

**Edge cases:**

- `-0` vs `0`: Treated as same (JavaScript behavior)
- `NaN`: Each `NaN` is unique (kept as-is)
- `Infinity`: Deduplicated normally

---

### Sorting

**Modes:**

1. **Numeric Ascending:** `a - b`

   - `-10, -5, 0, 5, 10`

2. **Numeric Descending:** `b - a`

   - `10, 5, 0, -5, -10`

3. **Magnitude Ascending:** `Math.abs(a) - Math.abs(b)`

   - `0, 5, -5, 10, -10`

4. **Magnitude Descending:** `Math.abs(b) - Math.abs(a)`
   - `-10, 10, -5, 5, 0`

**Special values:**

- `NaN`: Sorted to end
- `Infinity`: Sorted appropriately
- `-Infinity`: Sorted appropriately

---

### Analysis

**Basic Statistics:**

```
count: numbers.length
sum: numbers.reduce((a, b) => a + b, 0)
average: sum / count
min: Math.min(...numbers)
max: Math.max(...numbers)
range: max - min
```

**Median:**

```
sorted = sort(numbers)
if count is odd:
  median = sorted[count / 2]
else:
  median = (sorted[count / 2 - 1] + sorted[count / 2]) / 2
```

**Mode:**

```
frequency = count occurrences of each number
mode = number with highest frequency (or undefined if all unique)
```

**Standard Deviation:**

```
variance = sum((xi - mean)²) / count
std_dev = sqrt(variance)
```

**Outliers (IQR method):**

```
Q1 = 25th percentile
Q3 = 75th percentile
IQR = Q3 - Q1
lower_bound = Q1 - 1.5 * IQR
upper_bound = Q3 + 1.5 * IQR
outliers = numbers < lower_bound OR numbers > upper_bound
```

---

## Performance Characteristics

### Throughput Benchmarks

| Format | Numbers/Second | Tested On        |
| ------ | -------------- | ---------------- |
| ENV    | 4M+            | M1 Mac, Intel i7 |
| JSON   | 1.8M+          | M1 Mac, Intel i7 |
| INI    | 1.3M+          | M1 Mac, Intel i7 |
| TOML   | 530K+          | M1 Mac, Intel i7 |
| CSV    | 440K+          | M1 Mac, Intel i7 |
| YAML   | 190K+          | M1 Mac, Intel i7 |

**Note:** Benchmarks measured on files with optimal structure (one number per line/key).

### Memory Usage

```
Base: 100MB (extension runtime)
Per number: ~16 bytes (JavaScript number + array overhead)
CSV streaming: 100MB + (batch_size * 16 bytes)
```

**Example:**

- 1M numbers: ~116MB
- 10M numbers: ~260MB
- CSV streaming (1M numbers): ~116MB (constant)

### Time Complexity

- **Extraction:** O(n) where n = input size
- **Deduplication:** O(n) where n = number count
- **Sorting:** O(n log n) where n = number count
- **Analysis:** O(n) where n = number count

---

## Safety Thresholds

### Default Limits

```json
{
  "fileSizeWarnBytes": 1000000, // 1MB
  "largeOutputLinesThreshold": 50000, // 50K lines
  "manyDocumentsThreshold": 8, // 8 open editors
  "performanceMaxDuration": 5000, // 5 seconds
  "performanceMaxMemoryUsage": 104857600 // 100MB
}
```

### Warnings Triggered

- File size > threshold: Warning before parse
- Output > threshold: Prompt before opening in editor
- Open documents > threshold: Warning about memory
- Duration > threshold: Performance warning logged

---

## Error Handling

### Parse Errors

**Categories:**

- Syntax errors (malformed JSON, YAML, etc.)
- Encoding errors (invalid UTF-8)
- File access errors (permissions, not found)

**User Experience:**

- Show error notification (if `showParseErrors` enabled)
- Log to Output panel
- Return empty result with error details

### Recovery Strategies

- **Partial parse:** Not supported (all-or-nothing)
- **Retry:** File system errors only
- **Fallback:** None (fail safely)

---

## Future Enhancements

**v1.1.0:**

- Percentage parsing: `50%` → `0.5` or `50`
- Currency parsing: `$1,234.56` → `1234.56`
- Date-to-timestamp: `2025-01-01` → epoch (optional)

**v1.2.0:**

- Regex-based extraction mode
- Custom number patterns
- Localized number formats (`,` vs `.` decimal)

---

**Current specification:** v1.0.0 - Core extraction stable  
**Test coverage:** 100% on extraction logic, 95% overall
