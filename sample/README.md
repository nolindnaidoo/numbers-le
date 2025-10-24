# Numbers-LE Test Files

This directory contains test files for manually testing the Numbers-LE extension.

## Test Files

### Basic Format Tests

- **sample.json** - JSON file with nested objects, arrays, and various number types
- **sample.yaml** - YAML file with configuration-style data
- **sample.csv** - CSV file with product data and calculations
- **sample.toml** - TOML file with server configuration
- **sample.ini** - INI file with application settings
- **sample.env** - Environment variables file

### Advanced Tests

- **large-sample.json** - Large dataset with comprehensive number types
- **edge-cases.json** - Edge cases and boundary values

## Testing Workflow

1. Open VS Code with the numbers-le extension development host (F5)
2. Open any test file from this directory
3. Test the following commands:

### Quick Extract (Cmd+Alt+N or Ctrl+Alt+N)

- Should extract all numbers from the current file
- Should show results in a new editor tab
- Should show count in status bar

### Extract Numbers (Command Palette)

- Open Command Palette (Cmd+Shift+P)
- Type "Numbers-LE: Extract Numbers"
- Should extract with full options

### Sort Numbers

- Extract numbers first
- Run "Numbers-LE: Sort Numbers"
- Choose ascending or descending

### Deduplicate

- Extract numbers first
- Run "Numbers-LE: Deduplicate Numbers"
- Should remove duplicates

### Analyze

- Extract numbers first
- Run "Numbers-LE: Analyze Numbers"
- Should show statistical analysis

### Status Bar

- Open any supported file
- Should see numbers count in status bar
- Click to quick extract

## Expected Results

### sample.json

- Should extract: 99.99, 42, 0.15, -25.5, 1.23e-4, 85, -273.15, 1000000, 0.618, 1, 2, 3, 5, 8, 13, 21, 8080, 30.5, 3

### sample.csv

- Should extract all numeric values from the CSV
- Should handle CSV streaming for large files

### large-sample.json

- Should extract 50+ numbers
- Should handle various formats (scientific notation, negative, decimals)

### edge-cases.json

- Should handle zero, negative numbers, very small/large numbers
- Should handle boundary values correctly

## Performance Testing

Use `large-sample.json` to test:

- Extraction speed
- Memory usage
- Status bar responsiveness
- Output handling

## Notes

- All test files match the data used in the automated test suite
- These files are for manual verification and debugging
- Not included in the packaged extension
