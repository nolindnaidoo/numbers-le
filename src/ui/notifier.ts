import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { readConfig } from '../config/config';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export interface Notifier {
	info(message: string): void;
	warn(message: string): void;
	error(message: string): void;
	showMultilineRisk(count: number): void;
	showCsvNoCopy(): void;
	showPostProcessInfo(): void;
}

export function createNotifier(): Notifier {
	function level(): 'all' | 'important' | 'silent' {
		return readConfig().notificationsLevel;
	}

	return Object.freeze({
		info(message: string): void {
			const lv = level();
			if (lv === 'silent') return;
			if (lv === 'all') vscode.window.showInformationMessage(message);
		},

		warn(message: string): void {
			const lv = level();
			if (lv === 'silent') return;
			vscode.window.showWarningMessage(message);
		},

		error(message: string): void {
			const lv = level();
			if (lv === 'silent') return;
			vscode.window.showErrorMessage(message);
		},

		showMultilineRisk(_count: number): void {
			const lv = level();
			if (lv === 'silent') return;
			if (lv === 'all') {
				vscode.window.showInformationMessage(
					localize(
						'runtime.info.multiline-detected',
						'Detected multi‑line numbers. Rendering may vary by format. Prefer single‑line numbers for stable results.',
					),
				);
			}
		},

		showCsvNoCopy(): void {
			const lv = level();
			if (lv === 'silent') return;
			if (lv === 'all') {
				vscode.window.showInformationMessage(
					localize(
						'runtime.info.csv-no-clipboard',
						"CSV results aren't auto‑copied when streaming or extracting all columns. Use the editor output or Copy manually.",
					),
				);
			}
		},

		showPostProcessInfo(): void {
			const lv = level();
			if (lv === 'silent') return;
			if (lv === 'all') {
				vscode.window.showInformationMessage(
					localize(
						'runtime.info.postprocess-semantics',
						"Sorting and deduping operate on final numbers, not structured positions. Structural order/indices aren't preserved.",
					),
				);
			}
		},
	});
}
