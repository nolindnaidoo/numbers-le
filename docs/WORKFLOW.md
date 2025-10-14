# Numbers-LE User Workflows

## Overview

This guide walks through common workflows and best practices for using Numbers-LE effectively in real-world scenarios.

---

## Quick Extraction Workflows

### Workflow 1: Basic JSON Number Extraction

**Scenario:** Extract all numbers from an API response for analysis.

**Steps:**

1. Open `response.json` in VS Code
2. Press `Ctrl+Alt+N` (Mac: `Cmd+Alt+N`)
3. Numbers open in new editor, one per line
4. Copy to spreadsheet or analysis tool

**Time:** 2 seconds  
**Best for:** Quick spot checks, small files

**Tip:** Enable `copyToClipboardEnabled` to skip the editor step.

---

### Workflow 2: CSV Column Analysis

**Scenario:** Extract numeric data from specific CSV columns for statistical analysis.

**Steps:**

1. Open large CSV file (e.g., sales data)
2. Run `Numbers-LE: Extract Numbers`
3. Select specific columns (e.g., "Revenue", "Quantity")
4. Numbers extract to new file
5. Run `Numbers-LE: Post-Process: Analyze`
6. View statistics in clipboard

**Time:** 10-15 seconds  
**Best for:** Financial data, metrics, logs

**Tip:** Enable CSV streaming for files >10MB.

---

### Workflow 3: Configuration Validation

**Scenario:** Verify all numeric settings in TOML/YAML config files match expected ranges.

**Steps:**

1. Open `config.toml` or `config.yaml`
2. Extract numbers with `Ctrl+Alt+N`
3. Scan results for unexpected values
4. Run analysis to check min/max/outliers
5. Fix any out-of-range values

**Time:** 5-10 seconds  
**Best for:** DevOps, system administration

**Pro workflow:**

- Extract from production config
- Extract from development config
- Diff the results to find discrepancies

---

## Advanced Workflows

### Workflow 4: Multi-File Comparison

**Scenario:** Compare numeric values across multiple environment configurations.

**Steps:**

1. Open `.env.production`
2. Extract numbers → Save as `prod-numbers.txt`
3. Open `.env.staging`
4. Extract numbers → Save as `staging-numbers.txt`
5. Use VS Code's diff feature: Right-click → "Compare With..."
6. Identify mismatched values

**Time:** 30 seconds  
**Best for:** Configuration management, deployment verification

**Automation tip:** Create a VS Code task to automate extraction.

---

### Workflow 5: Large CSV Batch Processing

**Scenario:** Extract numbers from 100MB CSV file without freezing editor.

**Setup:**

```json
{
  "numbers-le.csv.streamingEnabled": true,
  "numbers-le.copyToClipboardEnabled": false,
  "numbers-le.safety.largeOutputLinesThreshold": 100000
}
```

**Steps:**

1. Open large CSV file
2. Run extract (streaming mode auto-detects)
3. Select columns to reduce data volume
4. Watch incremental extraction in progress
5. Results stream to new editor
6. Process with post-processing commands

**Time:** 1-5 minutes (depending on file size)  
**Best for:** Data science, analytics, log analysis

---

### Workflow 6: Statistical Report Generation

**Scenario:** Create comprehensive statistical report for dataset.

**Steps:**

1. Extract numbers from source file
2. Run `Numbers-LE: Post-Process: Deduplicate`
   - Copy result → `unique-numbers.txt`
3. Run `Numbers-LE: Post-Process: Sort` → Numeric Ascending
   - Copy result → `sorted-numbers.txt`
4. Run `Numbers-LE: Post-Process: Analyze`
   - Report auto-copies to clipboard
5. Paste into documentation or ticket

**Output example:**

```
=== Number Analysis Report ===

File: metrics.json
Type: json
Numbers Found: 1,847

--- Basic Statistics ---
Count: 1847
Sum: 2,456,789.12
Average: 1330.4521
Median: 892.0
Mode: 500
Min: 0.01
Max: 15000.0
Range: 14999.99

--- Advanced Statistics ---
Standard Deviation: 1245.67
Variance: 1551693.45
Outliers: 12 (15000.0, 14500.0, ...)
```

**Time:** 30-60 seconds  
**Best for:** Code reviews, documentation, reports

---

## Keyboard-Driven Workflows

### Power User Setup

**Configuration:**

```json
{
  "numbers-le.openResultsSideBySide": true,
  "numbers-le.copyToClipboardEnabled": true,
  "numbers-le.notificationsLevel": "silent",
  "numbers-le.statusBar.enabled": true
}
```

**Key mappings:**

- `Ctrl+Alt+N` - Extract
- `Ctrl+Alt+D` - Dedupe
- `Ctrl+Alt+S` - Sort
- `Ctrl+Alt+A` - Analyze

**Workflow:**

1. Open file → `Ctrl+Alt+N` (extract, results on right)
2. `Ctrl+Alt+D` (dedupe, copied to clipboard)
3. `Ctrl+Alt+A` (analyze, report copied)
4. `Ctrl+V` (paste analysis into ticket/doc)
5. Close temp editors → `Ctrl+W`

**Time:** 10 seconds  
**Best for:** Repetitive tasks, muscle memory workflows

---

## Team Workflows

### Workflow 7: Code Review - Numeric Constants

**Scenario:** Reviewer wants to verify all hardcoded numbers in a PR are intentional.

**Steps:**

1. Open changed files in PR
2. For each file:
   - Run `Numbers-LE: Extract Numbers`
   - Review extracted numbers
   - Flag suspicious values (magic numbers)
3. Comment on PR with findings

**Example findings:**

```
Found hardcoded numbers in api.ts:
- Line 42: 86400 (seconds in day - OK)
- Line 105: 7.3 (unclear - needs comment)
- Line 203: 999999 (magic number - extract to constant)
```

**Time:** 2-5 minutes per file  
**Best for:** Code quality, maintainability reviews

---

### Workflow 8: Documentation - Performance Benchmarks

**Scenario:** Document performance metrics for README.

**Steps:**

1. Run performance tests, save results to `bench-results.json`
2. Extract numbers from results
3. Run analysis to get min/max/average
4. Format for markdown table
5. Update README with benchmarks

**Example:**

```markdown
| Operation | Min (ms) | Avg (ms) | Max (ms) |
| --------- | -------- | -------- | -------- |
| Extract   | 12       | 15       | 23       |
| Dedupe    | 3        | 5        | 8        |
| Sort      | 18       | 22       | 35       |
```

**Time:** 10 minutes  
**Best for:** Documentation, transparency

---

## Integration Workflows

### Workflow 9: VS Code Tasks Integration

**Scenario:** Automate number extraction as part of build/test process.

**`.vscode/tasks.json`:**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Extract Build Metrics",
      "type": "shell",
      "command": "code",
      "args": ["--command", "numbers-le.extractNumbers"],
      "presentation": {
        "reveal": "silent"
      }
    }
  ]
}
```

**Usage:** Run via `Terminal → Run Task → Extract Build Metrics`

---

### Workflow 10: CI/CD Pipeline Integration

**Scenario:** Extract and validate numeric thresholds in CI.

**GitHub Actions example:**

```yaml
- name: Extract and Validate Metrics
  run: |
    code --install-extension nolindnaidoo.numbers-le
    code --command numbers-le.extractNumbers config.json
    # Validate extracted numbers against thresholds
    if [ $(cat extracted.txt | wc -l) -gt 100 ]; then
      echo "Too many numeric configs"
      exit 1
    fi
```

**Best for:** Automated quality checks, compliance

---

## Troubleshooting Workflows

### Workflow 11: Parse Error Debugging

**Scenario:** File won't parse, need to identify the issue.

**Steps:**

1. Enable parse errors:
   ```json
   {
     "numbers-le.showParseErrors": true
   }
   ```
2. Run extract → See specific error
3. Check Output panel → "Numbers-LE" for full details
4. Fix syntax error at reported line
5. Re-run extraction

**Time:** 1-2 minutes  
**Best for:** Debugging malformed data files

---

### Workflow 12: Performance Profiling

**Scenario:** Extraction is slow, need to optimize.

**Steps:**

1. Enable telemetry:
   ```json
   {
     "numbers-le.telemetryEnabled": true
   }
   ```
2. Run extraction
3. Open Output panel → "Numbers-LE"
4. Review performance metrics:
   - Duration
   - Throughput
   - Memory usage
5. Adjust settings based on recommendations

**Example output:**

```
Performance Metrics:
- Duration: 8,234ms
- Numbers: 150,000
- Throughput: 18,204 numbers/sec
- Memory: 152MB

Recommendations:
- Enable CSV streaming for better performance
- Disable automatic analysis
```

**Best for:** Optimization, large file handling

---

## Best Practices Summary

### Do's

✅ **Enable clipboard mode** for quick extraction  
✅ **Use CSV streaming** for files >10MB  
✅ **Run analysis separately** for large datasets  
✅ **Keep notification level at "important"** for balance  
✅ **Use side-by-side view** for comparison workflows  
✅ **Save common extractions** as VS Code tasks

### Don'ts

❌ **Don't open 100K+ numbers in editor** (use clipboard instead)  
❌ **Don't auto-enable all features** (impacts performance)  
❌ **Don't ignore safety warnings** (they're there for a reason)  
❌ **Don't extract from unsaved files** (save first)  
❌ **Don't expect string numbers to extract** (type-safe by design)

---

## Workflow Templates

### Template: Data Analysis Project

**Initial setup:**

```json
{
  "numbers-le.openResultsSideBySide": true,
  "numbers-le.analysis.enabled": true,
  "numbers-le.analysis.includeStats": true,
  "numbers-le.copyToClipboardEnabled": false
}
```

**Workflow:**

1. Extract → Analyze visually
2. Dedupe if needed
3. Sort for patterns
4. Analyze for report
5. Document findings

---

### Template: DevOps Configuration Audit

**Initial setup:**

```json
{
  "numbers-le.notificationsLevel": "silent",
  "numbers-le.copyToClipboardEnabled": true,
  "numbers-le.safety.enabled": true
}
```

**Workflow:**

1. Extract from multiple config files
2. Compare extractions
3. Validate against known ranges
4. Flag anomalies
5. Document discrepancies

---

### Template: Code Quality Review

**Initial setup:**

```json
{
  "numbers-le.notificationsLevel": "important",
  "numbers-le.showParseErrors": true
}
```

**Workflow:**

1. Review changed files in PR
2. Extract hardcoded numbers
3. Identify magic numbers
4. Request constants/comments
5. Approve when resolved

---

**Next Steps:** Try these workflows in your projects and adapt to your needs!
