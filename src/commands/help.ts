import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';

/**
 * Register the help command
 */
export function registerHelpCommand(
	context: vscode.ExtensionContext,
	telemetry: Telemetry,
): void {
	const disposable = vscode.commands.registerCommand(
		'numbers-le.help',
		async () => {
			telemetry.event('command', { name: 'help' });
			await showHelp();
		},
	);

	context.subscriptions.push(disposable);
}

/**
 * Show help documentation in a new editor tab
 */
async function showHelp(): Promise<void> {
	const helpContent = generateHelpContent();

	const doc = await vscode.workspace.openTextDocument({
		content: helpContent,
		language: 'markdown',
	});

	await vscode.window.showTextDocument(doc, {
		preview: false,
		viewColumn: vscode.ViewColumn.Beside,
	});
}

/**
 * Generate comprehensive help content
 */
function generateHelpContent(): string {
	const lines: string[] = [];

	lines.push('# Numbers-LE Help & Documentation');
	lines.push('');
	lines.push(
		'**Version:** 1.0.0 | **Zero Hassle Number Extraction from JSON, YAML, CSV, TOML, INI, and .ENV**',
	);
	lines.push('');
	lines.push('---');
	lines.push('');

	// Quick Start
	lines.push('## Quick Start');
	lines.push('');
	lines.push(
		'1. Open any supported file (JSON, YAML, CSV, TOML, INI, or .ENV)',
	);
	lines.push(
		'2. Press `Ctrl+Alt+N` (Mac: `Cmd+Alt+N`) or use the command palette',
	);
	lines.push(
		'3. Run **"Numbers-LE: Extract Numbers"** to extract all numeric values',
	);
	lines.push(
		'4. Results open in a new editor or copy to clipboard automatically',
	);
	lines.push('');

	// Commands
	lines.push('## Available Commands');
	lines.push('');
	lines.push('### Extract Numbers (`Ctrl+Alt+N` / `Cmd+Alt+N`)');
	lines.push(
		'Extracts all numeric values from the active file in document order.',
	);
	lines.push('');
	lines.push('- **Supported formats:** JSON, YAML, CSV, TOML, INI, .ENV');
	lines.push(
		'- **Number types:** Integers, floats, percentages, scientific notation',
	);
	lines.push('- **CSV mode:** Stream large files or select specific columns');
	lines.push('');

	lines.push('### Post-Process: Deduplicate');
	lines.push(
		'Removes duplicate numbers from the extracted results, keeping only unique values.',
	);
	lines.push('');

	lines.push('### Post-Process: Sort');
	lines.push('Sorts extracted numbers using various methods:');
	lines.push('');
	lines.push('- **Numeric Ascending**: 1, 2, 3, 10, 20');
	lines.push('- **Numeric Descending**: 20, 10, 3, 2, 1');
	lines.push(
		'- **Magnitude Ascending**: -20, -10, 1, 2, 3 (by absolute value)',
	);
	lines.push(
		'- **Magnitude Descending**: -20, -10, 3, 2, 1 (by absolute value)',
	);
	lines.push('');

	lines.push('### Post-Process: Analyze');
	lines.push('Performs comprehensive statistical analysis:');
	lines.push('');
	lines.push(
		'- **Basic stats:** count, sum, average, min, max, median, mode, range',
	);
	lines.push(
		'- **Advanced stats:** standard deviation, variance, outlier detection',
	);
	lines.push('- Results copied to clipboard for easy sharing');
	lines.push('');

	lines.push('### Toggle CSV Streaming');
	lines.push(
		'Enable/disable incremental streaming mode for large CSV files (recommended for files >10MB).',
	);
	lines.push('');

	lines.push('### Open Settings');
	lines.push('Opens the Numbers-LE settings panel for configuration.');
	lines.push('');

	// Configuration
	lines.push('## Configuration');
	lines.push('');
	lines.push('### Essential Settings');
	lines.push('');
	lines.push(
		'- **`numbers-le.openResultsSideBySide`** - Open results in split view (default: `false`)',
	);
	lines.push(
		'- **`numbers-le.copyToClipboardEnabled`** - Auto-copy results to clipboard (default: `false`)',
	);
	lines.push(
		'- **`numbers-le.csv.streamingEnabled`** - Enable CSV streaming for large files (default: `false`)',
	);
	lines.push('');

	lines.push('### Automatic Processing');
	lines.push('');
	lines.push(
		'- **`numbers-le.dedupeEnabled`** - Automatically remove duplicates (default: `false`)',
	);
	lines.push(
		'- **`numbers-le.sortEnabled`** - Automatically sort results (default: `false`)',
	);
	lines.push(
		'- **`numbers-le.sortMode`** - Sort method: `numeric-asc`, `numeric-desc`, etc. (default: `"off"`)',
	);
	lines.push(
		'- **`numbers-le.analysis.enabled`** - Automatically analyze results (default: `true`)',
	);
	lines.push('');

	lines.push('### Safety & Performance');
	lines.push('');
	lines.push(
		'- **`numbers-le.safety.enabled`** - Enable safety warnings (default: `true`)',
	);
	lines.push(
		'- **`numbers-le.safety.fileSizeWarnBytes`** - Warn threshold in bytes (default: `1000000` = 1MB)',
	);
	lines.push(
		'- **`numbers-le.safety.largeOutputLinesThreshold`** - Warn before opening large results (default: `50000`)',
	);
	lines.push(
		'- **`numbers-le.performance.maxDuration`** - Max operation duration in ms (default: `5000`)',
	);
	lines.push('');

	lines.push('### Notifications');
	lines.push('');
	lines.push(
		'- **`numbers-le.notificationsLevel`** - Control verbosity: `"all"`, `"important"`, or `"silent"` (default: `"silent"`)',
	);
	lines.push(
		'- **`numbers-le.showParseErrors`** - Show parse error notifications (default: `false`)',
	);
	lines.push('');

	// Performance Tips
	lines.push('## Performance Tips');
	lines.push('');
	lines.push('### Working with Large Files');
	lines.push('');
	lines.push('1. **Enable CSV Streaming** for files >10MB');
	lines.push('   - Set `numbers-le.csv.streamingEnabled: true`');
	lines.push('   - Select specific columns to reduce data volume');
	lines.push('');

	lines.push('2. **Disable Automatic Processing**');
	lines.push(
		'   - Turn off auto-dedupe, sort, and analysis for faster extraction',
	);
	lines.push('   - Process results manually with post-process commands');
	lines.push('');

	lines.push('3. **Use Clipboard Instead of Editor**');
	lines.push('   - Enable `copyToClipboardEnabled` for large outputs');
	lines.push('   - Avoid opening 50K+ lines in editor');
	lines.push('');

	lines.push('4. **Adjust Safety Thresholds**');
	lines.push(
		'   - Increase `fileSizeWarnBytes` and `largeOutputLinesThreshold` if you regularly work with large files',
	);
	lines.push('');

	// Troubleshooting
	lines.push('## Troubleshooting');
	lines.push('');
	lines.push('### Extension Not Detecting Numbers');
	lines.push('');
	lines.push(
		'- **Verify file format:** Ensure file has a supported extension (`.json`, `.yaml`, `.csv`, etc.)',
	);
	lines.push(
		'- **Check syntax:** Parse errors prevent number extraction. Fix syntax issues first.',
	);
	lines.push(
		'- **Enable parse errors:** Set `showParseErrors: true` to see specific issues',
	);
	lines.push('');

	lines.push('### Performance Issues');
	lines.push('');
	lines.push('- **Large files:** Enable CSV streaming or reduce file size');
	lines.push(
		'- **Slow analysis:** Disable automatic analysis and run manually',
	);
	lines.push(
		'- **High memory:** Check Output panel → "Numbers-LE" for performance metrics',
	);
	lines.push('');

	lines.push('### CSV Extraction Issues');
	lines.push('');
	lines.push(
		'- **Wrong columns:** Verify CSV has proper headers and delimiters',
	);
	lines.push(
		'- **Mixed data:** Ensure selected columns contain numeric values',
	);
	lines.push(
		'- **Streaming mode:** Enable for files >10MB to avoid memory issues',
	);
	lines.push('');

	// Additional Resources
	lines.push('## Additional Resources');
	lines.push('');
	lines.push(
		'- **Documentation:** [GitHub Repository](https://github.com/OffensiveEdge/numbers-le)',
	);
	lines.push(
		'- **Report Issues:** [GitHub Issues](https://github.com/OffensiveEdge/numbers-le/issues)',
	);
	lines.push(
		'- **VS Code Marketplace:** [Extension Page](https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.numbers-le)',
	);
	lines.push('');

	lines.push('---');
	lines.push('');
	lines.push(
		'**Need more help?** Open an issue on GitHub or check the documentation at the repository.',
	);
	lines.push('');

	return lines.join('\n');
}
