import * as vscode from 'vscode';
import { detectFileType, extractNumbers } from '../extraction/extract';
import {
	analyzeNumbers as analyzeNumbersUtil,
	calculateStandardDeviation,
	calculateVariance,
	findOutliers,
} from '../utils/analysis';
import type { CommandDependencies } from './index';

export async function analyzeNumbers(deps: CommandDependencies): Promise<void> {
	const tracker = deps.performanceMonitor.startOperation('analyze');

	try {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			deps.notifier.warn('No active editor found');
			return;
		}

		const text = editor.document.getText();

		// Check if this looks like a numbers file (simple heuristic)
		const lines = text.split('\n').filter((line) => line.trim());
		const isNumbersFile =
			lines.length > 0 &&
			lines.every((line) => {
				const trimmed = line.trim();
				return trimmed === '' || !Number.isNaN(Number(trimmed));
			});

		let numbers: readonly number[];

		if (isNumbersFile) {
			// Parse numbers directly from the current file
			numbers = Object.freeze(
				lines
					.map((line) => Number(line.trim()))
					.filter((n) => !Number.isNaN(n) && Number.isFinite(n)),
			);

			if (numbers.length === 0) {
				deps.notifier.info('No valid numbers found in the current file');
				return;
			}
		} else {
			// Extract numbers from the file content
			const fileType = detectFileType(editor.document.fileName);
			deps.notifier.info(`Analyzing numbers from ${fileType} file...`);

			const result = extractNumbers(text, fileType, editor.document.fileName);

			if (!result.success) {
				deps.notifier.error(
					`Failed to extract numbers: ${result.errors[0]?.message}`,
				);
				return;
			}

			numbers = result.numbers;

			if (numbers.length === 0) {
				deps.notifier.info('No numbers found in the file');
				return;
			}
		}

		// Perform comprehensive analysis
		const basicAnalysis = analyzeNumbersUtil(numbers);
		const stdDev = calculateStandardDeviation(numbers);
		const variance = calculateVariance(numbers);
		const outliers = findOutliers(numbers);

		// Create detailed analysis report
		const currentFileType = isNumbersFile
			? 'numbers'
			: detectFileType(editor.document.fileName);
		let report = `=== Number Analysis Report ===\n\n`;
		report += `File: ${editor.document.fileName}\n`;
		report += `Type: ${currentFileType}\n`;
		report += `Numbers Found: ${numbers.length}\n\n`;

		report += `--- Basic Statistics ---\n`;
		report += `Count: ${basicAnalysis.count}\n`;
		report += `Sum: ${basicAnalysis.sum}\n`;
		report += `Average: ${basicAnalysis.average.toFixed(4)}\n`;
		report += `Median: ${basicAnalysis.median}\n`;
		if (basicAnalysis.mode !== undefined) {
			report += `Mode: ${basicAnalysis.mode}\n`;
		}
		report += `Min: ${basicAnalysis.min}\n`;
		report += `Max: ${basicAnalysis.max}\n`;
		report += `Range: ${basicAnalysis.range}\n\n`;

		report += `--- Advanced Statistics ---\n`;
		report += `Standard Deviation: ${stdDev.toFixed(4)}\n`;
		report += `Variance: ${variance.toFixed(4)}\n`;

		if (outliers.length > 0) {
			report += `Outliers: ${outliers.length} (${outliers.join(', ')})\n`;
		} else {
			report += `Outliers: None detected\n`;
		}

		// Replace the content of the current editor with the analysis report
		const success = await editor.edit((editBuilder) => {
			const fullRange = new vscode.Range(
				editor.document.positionAt(0),
				editor.document.positionAt(editor.document.getText().length),
			);
			editBuilder.replace(fullRange, report);
		});

		if (success) {
			deps.notifier.info(
				`Analysis complete! Found ${numbers.length} numbers (report displayed in current editor)`,
			);
		} else {
			deps.notifier.error('Failed to update the editor content');
		}

		deps.telemetry.event('numbers.analyzed', {
			count: String(numbers.length),
			fileType: isNumbersFile
				? 'numbers'
				: detectFileType(editor.document.fileName),
			outliers: String(outliers.length),
		});
	} finally {
		const metrics = tracker.end(0, 0);
		deps.performanceMonitor.recordMetrics(metrics);
	}
}
