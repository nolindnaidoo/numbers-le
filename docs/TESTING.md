# Numbers-LE Testing

Comprehensive testing strategy ensuring reliability, performance, and production-grade quality.

## Testing Philosophy

- **Unit tests** validate pure functions in isolation
- **Integration tests** prove resilience with real-world data
- **Performance tests** ensure scalability with large datasets
- **Thin activation** isolates VS Code API from testable core logic
- **High coverage** maintained with fast feedback in CI

## Test Organization

```
src/
├── commands/
│   ├── extract.test.ts     # Command orchestration
│   ├── dedupe.test.ts      # Deduplication logic
│   ├── sort.test.ts        # Sorting logic
│   └── analyze.test.ts     # Statistical analysis
├── config/
│   └── config.test.ts      # Configuration validation
├── extraction/
│   ├── formats/
│   │   ├── json.test.ts    # JSON extraction
│   │   ├── csv.test.ts     # CSV extraction + streaming
│   │   ├── yaml.test.ts    # YAML extraction
│   │   ├── toml.test.ts    # TOML extraction
│   │   ├── ini.test.ts     # INI extraction
│   │   └── env.test.ts     # Environment file extraction
│   └── extract.test.ts     # Router and orchestration
├── utils/
│   ├── analysis.test.ts    # Statistical functions
│   ├── sort.test.ts        # Sorting algorithms
│   └── validation.test.ts  # Input validation
└── __mocks__/
    └── vscode.ts           # VS Code API mocks
```

Test data:

```
src/extraction/__data__/
├── sample.json             # Realistic test data
├── sample.csv              # Multi-column tabular data
├── sample.yaml             # Hierarchical configuration
├── sample.toml             # Modern config format
├── sample.ini              # Legacy configuration
└── sample.env              # Environment variables
```

## Running Tests

```bash
# Full test suite
bun test

# Coverage report (text + HTML)
bun run test:coverage
# Output: coverage/index.html

# Watch mode for development
bun run test:watch

# Linting
bun run lint
bun run lint --write
```

## Test Structure

### Unit Tests (Pure Functions)

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import { analyzeNumbers } from "../utils/analysis";

describe("analyzeNumbers", () => {
  it("calculates comprehensive statistics", () => {
    const numbers = [1, 2, 3, 4, 5, 5];
    const result = analyzeNumbers(numbers);

    assert.strictEqual(result.count, 6);
    assert.strictEqual(result.sum, 20);
    assert.strictEqual(result.average, 3.33);
    assert.strictEqual(result.min, 1);
    assert.strictEqual(result.max, 5);
    assert.strictEqual(result.median, 3.5);
    assert.deepStrictEqual(result.mode, [5]);
    assert.strictEqual(result.range, 4);
  });

  it("handles empty arrays gracefully", () => {
    const result = analyzeNumbers([]);
    assert.strictEqual(result.count, 0);
    assert.strictEqual(result.sum, 0);
  });
});
```

### Integration Tests (Real Data)

```typescript
import { readFileSync } from "fs";
import { join } from "path";

describe("CSV extraction integration", () => {
  const dataDir = join(__dirname, "__data__");

  it("extracts all numeric values from multi-column CSV", () => {
    const content = readFileSync(join(dataDir, "sample.csv"), "utf-8");
    const result = extractNumbersFromCsvSync(content, "sample.csv");

    assert.strictEqual(result.success, true);
    assert.ok(result.numbers.length > 0);
    assert.strictEqual(result.errors.length, 0);

    // Verify all extracted values are valid numbers
    result.numbers.forEach((n) => assert.ok(Number.isFinite(n)));
  });
});
```

### Command Tests

```typescript
import { beforeEach, describe, it, vi } from "vitest";
import * as vscode from "vscode";

vi.mock("vscode", () => ({
  window: {
    activeTextEditor: undefined,
    showInformationMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key, defaultValue) => defaultValue),
    })),
  },
}));

describe("Extract command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts numbers from active editor", async () => {
    const mockEditor = {
      document: {
        getText: () => '{"count": 42, "price": 19.99}',
        fileName: "test.json",
      },
    };

    vscode.window.activeTextEditor = mockEditor;

    await extractCommand();

    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });
});
```

## Test Categories

### Core Logic Tests

- **Parser tests**: Number extraction from each format
- **Analysis tests**: Statistical calculations and edge cases
- **Sorting tests**: Various sort modes and data types
- **Config tests**: Settings validation and defaults

### Performance Tests

- **Large files**: 10K+ numbers, verify <2s processing
- **Memory usage**: Monitor heap usage, prevent leaks
- **Streaming**: CSV files >5MB with constant memory
- **Throughput**: Verify format-specific performance targets

### Edge Case Tests

- **Malformed input**: Invalid JSON, broken CSV, corrupted YAML
- **Empty data**: Zero numbers, empty files, whitespace-only
- **Boundary values**: `Number.MAX_VALUE`, `-Infinity`, `NaN`
- **Mixed types**: Numbers as strings, booleans as 0/1

## Fixture Conventions

- One comprehensive sample per format + real-world edge cases
- Expected outputs validated against production data
- CSV fixtures include multi-column, headers, quoted values
- JSON fixtures include deeply nested structures
- Performance fixtures scaled for realistic load testing

## Coverage Requirements

### Minimum Thresholds

- **Overall**: >80% line coverage
- **Core logic**: >90% for extraction/ and utils/
- **Commands**: >75% for commands/
- **Error handling**: All error branches covered

### Coverage Exclusions

- Type definitions (`src/types.ts`)
- Test files (`*.test.ts`)
- Mock files (`src/__mocks__/`)
- VS Code API thin wrappers

### Coverage Reporting

```bash
bun run test:coverage
```

Output:

- **Text report**: Console summary with coverage percentages
- **HTML report**: `coverage/index.html` for detailed analysis
- **LCOV report**: `coverage/lcov.info` for CI integration

## CI Integration

### GitHub Actions Pipeline

```yaml
- name: Run Tests
  run: bun test

- name: Generate Coverage
  run: bun run test:coverage

- name: Lint Code
  run: bun run lint
```

Requirements:

- All tests pass (zero failures)
- Coverage >80% overall
- No linting errors
- TypeScript compilation succeeds

## Performance Testing

### Benchmark Tests

```typescript
describe("Performance benchmarks", () => {
  it("processes 10K numbers in <1s", () => {
    const largeJson = generateLargeJson(10000);
    const startTime = performance.now();

    const result = extractNumbersFromJson(largeJson, "test.json");

    const duration = performance.now() - startTime;
    assert.ok(duration < 1000, `Took ${duration}ms, expected <1000ms`);
    assert.strictEqual(result.numbers.length, 10000);
  });

  it("streams large CSV with constant memory", () => {
    const initialMemory = process.memoryUsage().heapUsed;

    const largeCsv = generateLargeCsv(50000); // 50K rows
    const result = extractNumbersFromCsvSync(largeCsv, "large.csv");

    const finalMemory = process.memoryUsage().heapUsed;
    const increase = finalMemory - initialMemory;

    assert.ok(increase < 100 * 1024 * 1024, "Memory increase >100MB");
    assert.strictEqual(result.success, true);
  });
});
```

## Debugging Tests

### Common Issues

- **Mock not working**: Check `vi.clearAllMocks()` in `beforeEach`
- **Async timing**: Use proper `async/await` patterns
- **File paths**: Use `__dirname` for fixture paths
- **Floating point**: Use approximate equality for statistical calculations

### Debug Strategies

- Use `console.log` sparingly for debugging
- Set breakpoints in VS Code test debugger
- Check mock call counts with `expect(mock).toHaveBeenCalledTimes(n)`
- Isolate failing tests with `.only`

## Best Practices

### Test Organization

- Group related tests in `describe` blocks
- Use descriptive test names that explain behavior
- One assertion per test when possible
- Follow Arrange-Act-Assert pattern

### Test Data

- Use realistic fixtures from production scenarios
- Include edge cases and boundary conditions
- Keep test data minimal but representative
- Mock external dependencies consistently

### Performance

- Keep tests fast (<5s total suite time)
- Use parallel execution (Vitest default)
- Mock slow operations (file I/O, network)
- Avoid unnecessary setup/teardown

### Maintenance

- Update fixtures when formats change
- Review coverage reports regularly
- Refactor tests alongside code
- Document complex test scenarios

---

**Project:** [Issues](https://github.com/nolindnaidoo/numbers-le/issues) • [Pull Requests](https://github.com/nolindnaidoo/numbers-le/pulls)

**Docs:** [Architecture](ARCHITECTURE.md) • [Testing](TESTING.md) • [Performance](PERFORMANCE.md) • [Development](DEVELOPMENT.md) • [Troubleshooting](TROUBLESHOOTING.md)
