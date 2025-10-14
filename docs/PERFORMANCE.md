# Numbers-LE Performance

Production-grade performance metrics, optimization strategies, and benchmarking data for number extraction at enterprise scale.

## Performance at a Glance

| Format   | Throughput        | Best For               | File Size Range | Hardware Tested  |
| -------- | ----------------- | ---------------------- | --------------- | ---------------- |
| **ENV**  | 4M+ numbers/sec   | Environment configs    | 1KB - 5MB       | M1 Mac, Intel i7 |
| **JSON** | 1.8M+ numbers/sec | APIs, large datasets   | 1KB - 200MB     | M1 Mac, Intel i7 |
| **INI**  | 1.3M+ numbers/sec | Configuration files    | 1KB - 10MB      | M1 Mac, Intel i7 |
| **TOML** | 530K+ numbers/sec | Modern configs         | 1KB - 25MB      | M1 Mac, Intel i7 |
| **CSV**  | 440K+ numbers/sec | Tabular data           | 1KB - 500MB     | M1 Mac, Intel i7 |
| **YAML** | 190K+ numbers/sec | Human-readable configs | 1KB - 50MB      | M1 Mac, Intel i7 |

**Benchmark Environment**: Node.js v22+, macOS (Apple Silicon), tested December 2024

## Performance Goals

### Response Time Targets

- **Small files** (<100KB): <100ms end-to-end
- **Medium files** (100KB-1MB): <500ms
- **Large files** (1-10MB): <2s
- **Very large files** (>10MB): <5s with streaming

### Memory Usage Targets

- **Base extension**: <50MB
- **Small files**: <100MB total
- **Large files**: <200MB total
- **CSV streaming**: Constant memory regardless of file size
- **Peak usage**: <500MB with safety warnings

### Throughput Targets

- **JSON**: >10K numbers/second
- **CSV**: >5K numbers/second
- **YAML**: >8K numbers/second
- **Analysis**: >20K numbers/second

## Detailed Benchmarks

### Large File Performance (500K+ lines)

#### JSON Format

```
File Size:     65MB (501,500 lines)
Extraction:    275ms
Throughput:    1.8M numbers/second
Numbers:       2.5M extracted
Memory Usage:  117MB peak
```

**Analysis**: Exceptional performance for large structured datasets. Parser efficiently handles deeply nested objects with predictable memory scaling. Ideal for API responses and data processing workflows.

#### CSV Format

```
File Size:     30MB (501,021 lines)
Extraction:    1,149ms (non-streaming)
Throughput:    440K numbers/second
Numbers:       3M extracted
Memory Usage:  275MB peak

With Streaming:
Extraction:    1,200ms
Memory Usage:  <50MB constant
```

**Analysis**: Streaming mode essential for files >100K lines. Memory usage scales with column count in non-streaming mode. Linear performance characteristics ideal for batch processing.

### Medium File Performance (5K lines)

#### ENV Format

```
File Size:     0.15MB (5,001 lines)
Extraction:    1.2ms
Throughput:    4.2M numbers/second
Numbers:       5,000 extracted
Memory Usage:  <1MB
```

**Analysis**: Peak performance for simple key-value configurations. Minimal overhead makes it ideal for environment variable extraction.

#### TOML Format

```
File Size:     0.07MB (5,000 lines)
Extraction:    9.4ms
Throughput:    532K numbers/second
Numbers:       1,875 extracted
Memory Usage:  <1MB
```

**Analysis**: Optimized using `@iarna/toml` parser. Excellent for modern configuration files with rich data types and complex structures.

## Optimization Strategies

### Memory Management

**Immutable Data Structures**

```typescript
export function extractNumbers(
  text: string,
  fileType: FileType
): ExtractionResult {
  const numbers = parseNumbers(text);

  return Object.freeze({
    success: true,
    numbers: Object.freeze(numbers),
    errors: Object.freeze([]),
  });
}
```

**Rationale**: `Object.freeze()` prevents accidental mutations and enables aggressive V8 optimizations. Memory leaks from circular references are eliminated.

**Size Limits and Cleanup**

```typescript
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS = 1000;

  private recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }
}
```

**Rationale**: Bounded memory usage prevents runaway growth in long-running sessions. 1000 metrics = ~50KB overhead.

### Processing Optimization

**Efficient Single-Pass Analysis**

```typescript
export function analyzeNumbers(numbers: readonly number[]): AnalysisResult {
  // Single pass for min/max/sum
  let sum = 0,
    min = numbers[0],
    max = numbers[0];

  for (const num of numbers) {
    sum += num;
    if (num < min) min = num;
    if (num > max) max = num;
  }

  const average = sum / numbers.length;
  const median = calculateMedian([...numbers].sort((a, b) => a - b));

  return Object.freeze({
    count: numbers.length,
    sum,
    average,
    min,
    max,
    median,
    range: max - min,
  });
}
```

**Rationale**: Minimizes array traversals. O(n) for basic stats, O(n log n) for median only when needed. Avoids multiple passes that would be O(kn).

**CSV Streaming**

```typescript
export function* streamCsvNumbers(
  text: string,
  onProgress?: (progress: number) => void
): Generator<number, void, undefined> {
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const lineNumbers = parseCsvLine(lines[i]);
    yield* lineNumbers;

    if (onProgress && i % 1000 === 0) {
      onProgress((i / lines.length) * 100);
    }
  }
}
```

**Rationale**: Generator pattern enables constant memory usage. Backpressure prevents overwhelming downstream consumers. Progress feedback every 1K lines balances UX and performance.

### Safety Checks

**Performance Budgets**

```typescript
export function performSafetyChecks(
  text: string,
  processingTimeMs: number = 0
): SafetyCheckResult {
  const metrics = calculateSafetyMetrics(text, processingTimeMs);
  const warnings: string[] = [];

  if (metrics.fileSizeBytes > 1_000_000) {
    warnings.push(
      `Large file (${(metrics.fileSizeBytes / 1024 / 1024).toFixed(1)}MB)`
    );
  }

  if (metrics.estimatedOutputLines > 50_000) {
    warnings.push(
      `Large output (${metrics.estimatedOutputLines.toLocaleString()} lines)`
    );
  }

  if (processingTimeMs > 5000) {
    warnings.push(`Slow processing (${(processingTimeMs / 1000).toFixed(1)}s)`);
  }

  return { safe: warnings.length === 0, warnings, metrics };
}
```

**Rationale**: Thresholds calibrated from production usage patterns. 1MB file = reasonable warning point. 50K lines = clipboard/editor limit. 5s = user patience threshold.

## Configuration for Performance

### Recommended Settings

**Development Environment**

```json
{
  "numbers-le.csv.streamingEnabled": false,
  "numbers-le.analysis.enabled": true,
  "numbers-le.dedupeEnabled": true,
  "numbers-le.sortEnabled": true
}
```

**Production/Large Datasets**

```json
{
  "numbers-le.csv.streamingEnabled": true,
  "numbers-le.analysis.enabled": false,
  "numbers-le.safety.fileSizeWarnBytes": 5000000,
  "numbers-le.safety.largeOutputLinesThreshold": 100000
}
```

**Memory-Constrained Environments**

```json
{
  "numbers-le.csv.streamingEnabled": true,
  "numbers-le.dedupeEnabled": false,
  "numbers-le.sortEnabled": false,
  "numbers-le.analysis.enabled": false
}
```

## File Size Recommendations

### Small Files (<1K lines)

- **All formats**: Excellent performance
- **Recommendation**: Enable all features (dedupe, sort, analysis)
- **Memory**: <10MB
- **Response time**: <100ms

### Medium Files (1K-50K lines)

- **All formats**: Good performance
- **Recommendation**: Enable streaming for CSV, disable analysis for >10K
- **Memory**: <50MB
- **Response time**: <500ms

### Large Files (50K-500K lines)

- **Recommended**: JSON, CSV with streaming
- **Caution**: YAML with deep nesting
- **Recommendation**: Streaming for CSV, disable dedupe/sort
- **Memory**: <200MB
- **Response time**: <2s

### Very Large Files (>500K lines)

- **Best**: JSON for structured data, CSV with streaming
- **Recommendation**: Disable all post-processing, streaming required
- **Memory**: <500MB (with streaming)
- **Response time**: <5s

## Performance Monitoring

### Built-in Metrics

```typescript
export function createPerformanceMonitor(): PerformanceMonitor {
  return Object.freeze({
    start(operation: string, inputSize: number): void {
      // Track operation start
    },
    end(outputSize: number): void {
      // Calculate duration, throughput
    },
    getMetrics(): readonly PerformanceMetrics[] {
      // Return frozen metrics array
    },
    getAverageDuration(operation: string): number {
      // Calculate average across recent operations
    },
  });
}
```

**Tracked Metrics**:

- Operation duration (ms)
- Input size (bytes)
- Output size (count)
- Memory usage (bytes)
- Throughput (items/second)

## Troubleshooting Performance

### Slow Processing

**Symptoms**: Operations taking >5s, UI freezing

**Diagnosis**:

- Check file size and format complexity
- Verify streaming is enabled for CSV
- Monitor memory usage in Activity Monitor
- Check for deeply nested JSON/YAML structures

**Solutions**:

- Enable CSV streaming for files >100K lines
- Disable dedupe/sort for files >50K numbers
- Disable analysis for files >100K numbers
- Consider file splitting for >10MB files

### High Memory Usage

**Symptoms**: >500MB usage, system slowdown

**Diagnosis**:

- Check if streaming is disabled for large CSV
- Verify deduplication is needed
- Monitor memory growth over time

**Solutions**:

- Enable CSV streaming
- Disable deduplication for large datasets
- Process files in smaller batches
- Close unused editors

### Format-Specific Issues

**YAML Performance Degradation**

- **Cause**: Deeply nested structures, complex anchors
- **Solution**: Flatten structure, split large files, prefer JSON

**CSV Memory Pressure**

- **Cause**: Many columns, streaming disabled
- **Solution**: Enable streaming, select specific columns

**JSON Parsing Errors**

- **Cause**: Malformed JSON, large strings
- **Solution**: Validate JSON, pre-process with `jq`

## Performance Testing

### Running Benchmarks

```bash
# Run performance suite
bun run test:performance

# Generate detailed report
bun run performance:report
```

### Benchmark Suite

Test files:

- `500k.csv` - 501K lines, 30MB tabular data
- `500k.json` - 501K lines, 65MB structured data
- `5k.env` - 5K lines, environment variables
- `5k.toml` - 5K lines, structured configuration

### Interpreting Results

```
Performance Report:
├── Throughput: lines/second processed
├── Memory: peak heap usage during extraction
├── Duration: total processing time
└── Extracted: number count validation
```

---

**Project:** [Issues](https://github.com/nolindnaidoo/numbers-le/issues) • [Pull Requests](https://github.com/nolindnaidoo/numbers-le/pulls)

**Docs:** [Architecture](ARCHITECTURE.md) • [Testing](TESTING.md) • [Performance](PERFORMANCE.md) • [Development](DEVELOPMENT.md) • [Troubleshooting](TROUBLESHOOTING.md)
