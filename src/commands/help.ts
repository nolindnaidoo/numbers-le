import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import { guarded } from './guard';

/**
 * Register the help command
 */
export function registerHelpCommand(
	context: vscode.ExtensionContext,
	telemetry: Telemetry,
): void {
	const disposable = vscode.commands.registerCommand(
		'numbers-le.help',
		guarded(createNotifier(), async () => {
			telemetry.event('command', { name: 'help' });
			await showHelp();
		}),
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

const REPOSITORY = 'https://github.com/nolindnaidoo/numbers-le';
const MARKETPLACE_REVIEWS =
	'https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le&ssr=false#review-details';
const OPEN_VSX_REVIEWS =
	'https://open-vsx.org/extension/nolindnaidoo/numbers-le/reviews';

/** A setting line: the key and its default are code, the description is prose. */
function setting(key: string, description: string, value: string): string {
	return `- **\`numbers-le.${key}\`** - ${description} (${vscode.l10n.t('default: {0}', `\`${value}\``)})`;
}

/**
 * Generate the help document. Every sentence goes through the bundle, so the
 * document reads in the host's language; format names, setting keys, defaults
 * and links are code and stay as they are.
 */
function generateHelpContent(): string {
	const lines: string[] = [];

	lines.push(`# ${vscode.l10n.t('Numbers-LE Help & Documentation')}`);
	lines.push('');
	lines.push(
		`**${vscode.l10n.t('Zero Hassle Number Extraction from JSON, YAML, CSV, TOML, INI, .ENV and source code')}**`,
	);
	lines.push('');
	lines.push('---');
	lines.push('');

	// Quick Start
	lines.push(`## ${vscode.l10n.t('Quick Start')}`);
	lines.push('');
	lines.push(
		`1. ${vscode.l10n.t('Open any supported file (JSON, YAML, CSV, TOML, INI, .ENV, or a source file)')}`,
	);
	lines.push(
		`2. ${vscode.l10n.t('Run "Numbers-LE: Extract Numbers" from the command palette')}`,
	);
	lines.push(
		`3. ${vscode.l10n.t('Results open in a new editor beside the current one, or copy to the clipboard when that setting is on')}`,
	);
	lines.push('');

	// Commands
	lines.push(`## ${vscode.l10n.t('Available Commands')}`);
	lines.push('');
	lines.push(`### ${vscode.l10n.t('Extract Numbers')}`);
	lines.push(
		vscode.l10n.t(
			'Extracts all numeric values from the active file in document order.',
		),
	);
	lines.push('');
	lines.push(
		`- **${vscode.l10n.t('Supported formats')}:** JSON, JSONC, YAML, CSV, TSV, TOML, INI, .ENV`,
	);
	lines.push(
		`- **${vscode.l10n.t('Source files')}:** ${vscode.l10n.t('{0}, read for their number literals', 'Python, Rust, Go, Java, Kotlin, C#, C, C++, JavaScript, TypeScript, SQL, shell')}`,
	);
	lines.push(
		`- **${vscode.l10n.t('Anything else')}:** ${vscode.l10n.t('scanned as plain text for the numbers it holds')}`,
	);
	lines.push(
		`- **${vscode.l10n.t('Number types')}:** ${vscode.l10n.t('integers, floats, scientific notation')}`,
	);
	lines.push(
		`- **${vscode.l10n.t('CSV mode')}:** ${vscode.l10n.t('pick one column, several, or all; several open one results document each')}`,
	);
	lines.push('');

	lines.push(`### ${vscode.l10n.t('Post-Process: Deduplicate')}`);
	lines.push(
		vscode.l10n.t(
			'Removes duplicate numbers from the extracted results, keeping only unique values.',
		),
	);
	lines.push('');

	lines.push(`### ${vscode.l10n.t('Post-Process: Sort')}`);
	lines.push(vscode.l10n.t('Sorts extracted numbers using various methods:'));
	lines.push('');
	lines.push(`- **${vscode.l10n.t('Numeric Ascending')}**: 1, 2, 3, 10, 20`);
	lines.push(`- **${vscode.l10n.t('Numeric Descending')}**: 20, 10, 3, 2, 1`);
	lines.push(
		`- **${vscode.l10n.t('Magnitude Ascending')}**: -20, -10, 1, 2, 3 (${vscode.l10n.t('by absolute value')})`,
	);
	lines.push(
		`- **${vscode.l10n.t('Magnitude Descending')}**: -20, -10, 3, 2, 1 (${vscode.l10n.t('by absolute value')})`,
	);
	lines.push('');

	lines.push(`### ${vscode.l10n.t('Open Settings')}`);
	lines.push(
		vscode.l10n.t('Opens the Numbers-LE settings panel for configuration.'),
	);
	lines.push('');

	// Configuration
	lines.push(`## ${vscode.l10n.t('Configuration')}`);
	lines.push('');
	lines.push(`### ${vscode.l10n.t('Essential Settings')}`);
	lines.push('');
	lines.push(
		setting(
			'openResultsSideBySide',
			vscode.l10n.t('Open results in split view'),
			'true',
		),
	);
	lines.push(
		setting(
			'copyToClipboardEnabled',
			vscode.l10n.t('Auto-copy results to the clipboard'),
			'false',
		),
	);
	lines.push(
		setting(
			'showPositions',
			vscode.l10n.t('Show the line and column of each number'),
			'false',
		),
	);
	lines.push(
		setting(
			'clipboardIncludesPositions',
			vscode.l10n.t(
				'Include each line and column in the copy on the clipboard',
			),
			'false',
		),
	);
	lines.push('');

	lines.push(`### ${vscode.l10n.t('Automatic Processing')}`);
	lines.push('');
	lines.push(
		setting(
			'dedupeEnabled',
			vscode.l10n.t('Automatically remove duplicates'),
			'false',
		),
	);
	lines.push(
		setting(
			'sortEnabled',
			vscode.l10n.t('Automatically sort results'),
			'false',
		),
	);
	lines.push(
		setting(
			'sortMode',
			vscode.l10n.t(
				'Sort method: {0}',
				'`numeric-asc`, `numeric-desc`, `magnitude-asc`, `magnitude-desc`',
			),
			'"off"',
		),
	);
	lines.push(
		setting(
			'postProcess.openInNewFile',
			vscode.l10n.t(
				'Open post-processed content in a new editor rather than in place',
			),
			'true',
		),
	);
	lines.push('');

	lines.push(`### ${vscode.l10n.t('Safety & Performance')}`);
	lines.push('');
	lines.push(
		setting('safety.enabled', vscode.l10n.t('Enable safety warnings'), 'true'),
	);
	lines.push(
		setting(
			'safety.fileSizeWarnBytes',
			vscode.l10n.t('Warn when the input file exceeds this many bytes'),
			'1000000',
		),
	);
	lines.push(
		setting(
			'safety.largeOutputLinesThreshold',
			vscode.l10n.t('Warn before opening results longer than this many lines'),
			'50000',
		),
	);
	lines.push(
		setting(
			'safety.manyDocumentsThreshold',
			vscode.l10n.t('Warn before opening this many CSV column documents'),
			'8',
		),
	);
	lines.push('');

	lines.push(`### ${vscode.l10n.t('Notifications')}`);
	lines.push('');
	lines.push(
		setting(
			'notificationsLevel',
			vscode.l10n.t(
				'Control verbosity: {0}',
				'`"all"`, `"important"`, `"silent"`',
			),
			'"silent"',
		),
	);
	lines.push(
		setting(
			'showParseErrors',
			vscode.l10n.t('Show parse errors as notifications'),
			'false',
		),
	);
	lines.push(
		setting(
			'statusBar.enabled',
			vscode.l10n.t('Show the Numbers-LE status bar entry'),
			'true',
		),
	);
	lines.push(
		setting(
			'telemetryEnabled',
			vscode.l10n.t('Write local-only telemetry to the Output panel'),
			'false',
		),
	);
	lines.push('');

	// Performance Tips
	lines.push(`## ${vscode.l10n.t('Performance Tips')}`);
	lines.push('');
	lines.push(`### ${vscode.l10n.t('Working with Large Files')}`);
	lines.push('');
	lines.push(
		`1. **${vscode.l10n.t('Select specific CSV columns')}** ${vscode.l10n.t('to reduce data volume')}`,
	);
	lines.push('');
	lines.push(`2. **${vscode.l10n.t('Disable automatic processing')}**`);
	lines.push(
		`   - ${vscode.l10n.t('Turn off automatic dedupe and sort for faster extraction')}`,
	);
	lines.push(
		`   - ${vscode.l10n.t('Process results with the post-process commands instead')}`,
	);
	lines.push('');
	lines.push(
		`3. **${vscode.l10n.t('Use the clipboard instead of the editor')}**`,
	);
	lines.push(
		`   - ${vscode.l10n.t('Enable {0} for large outputs', '`copyToClipboardEnabled`')}`,
	);
	lines.push(`   - ${vscode.l10n.t('Avoid opening 50K+ lines in the editor')}`);
	lines.push('');
	lines.push(`4. **${vscode.l10n.t('Adjust the safety thresholds')}**`);
	lines.push(
		`   - ${vscode.l10n.t('Raise {0} and {1} if you regularly work with large files', '`fileSizeWarnBytes`', '`largeOutputLinesThreshold`')}`,
	);
	lines.push('');

	// Troubleshooting
	lines.push(`## ${vscode.l10n.t('Troubleshooting')}`);
	lines.push('');
	lines.push(`### ${vscode.l10n.t('Numbers are not detected')}`);
	lines.push('');
	lines.push(
		`- **${vscode.l10n.t('Verify the file format')}:** ${vscode.l10n.t('the file needs a supported extension ({0})', '`.json`, `.yaml`, `.csv`, …')}`,
	);
	lines.push(
		`- **${vscode.l10n.t('Check the syntax')}:** ${vscode.l10n.t('a parse error prevents extraction, so fix the document first')}`,
	);
	lines.push(
		`- **${vscode.l10n.t('Enable parse errors')}:** ${vscode.l10n.t('set {0} to see the specific issue', '`showParseErrors: true`')}`,
	);
	lines.push('');

	lines.push(`### ${vscode.l10n.t('Performance Issues')}`);
	lines.push('');
	lines.push(
		`- **${vscode.l10n.t('Large files')}:** ${vscode.l10n.t('select fewer CSV columns or reduce the file size')}`,
	);
	lines.push(
		`- **${vscode.l10n.t('Slow post-processing')}:** ${vscode.l10n.t('disable automatic dedupe and sort, and run them by hand')}`,
	);
	lines.push('');

	lines.push(`### ${vscode.l10n.t('CSV Extraction Issues')}`);
	lines.push('');
	lines.push(
		`- **${vscode.l10n.t('Wrong columns')}:** ${vscode.l10n.t('verify the CSV has proper headers and delimiters')}`,
	);
	lines.push(
		`- **${vscode.l10n.t('Mixed data')}:** ${vscode.l10n.t('ensure the selected columns contain numeric values')}`,
	);
	lines.push('');

	// Additional Resources
	lines.push(`## ${vscode.l10n.t('Additional Resources')}`);
	lines.push('');
	lines.push(
		`- **${vscode.l10n.t('Documentation')}:** [${vscode.l10n.t('GitHub Repository')}](${REPOSITORY})`,
	);
	lines.push(
		`- **${vscode.l10n.t('Report Issues')}:** [${vscode.l10n.t('GitHub Issues')}](${REPOSITORY}/issues)`,
	);
	lines.push('- **LE Tools:** [letools.dev](https://letools.dev)');
	lines.push('');
	lines.push(
		`**${vscode.l10n.t("Enjoying it? A rating helps more than you'd think:")}**`,
	);
	lines.push(
		`- [${vscode.l10n.t('Rate on VS Code Marketplace')}](${MARKETPLACE_REVIEWS})`,
	);
	lines.push(`- [${vscode.l10n.t('Rate on Open VSX')}](${OPEN_VSX_REVIEWS})`);
	lines.push('');

	lines.push('---');
	lines.push('');
	lines.push(
		`**${vscode.l10n.t('Need more help?')}** ${vscode.l10n.t('Open an issue on GitHub or check the documentation at the repository.')}`,
	);
	lines.push('');
	lines.push(
		vscode.l10n.t(
			'Built by {0} — MIT licensed.',
			'[nolindnaidoo](https://github.com/nolindnaidoo)',
		),
	);
	lines.push('');

	return lines.join('\n');
}
