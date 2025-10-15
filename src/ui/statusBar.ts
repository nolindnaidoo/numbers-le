import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { readConfig } from '../config/config';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export interface StatusBar {
	flash(text: string): void;
}

export function createStatusBar(context: vscode.ExtensionContext): StatusBar {
	const item = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100,
	);
	item.text = localize('runtime.statusbar.text', '$(symbol-number) Numbers-LE');
	item.tooltip = localize('runtime.status.tooltip', 'Run Numbers-LE: Extract');
	item.command = 'numbers-le.extractNumbers';
	context.subscriptions.push(item);

	function updateVisibility(): void {
		const enabled = readConfig().statusBarEnabled;
		if (enabled) item.show();
		else item.hide();

		const csvStreaming = readConfig().csvStreamingEnabled;
		item.text = csvStreaming
			? localize(
					'runtime.statusbar.text.csv-streaming',
					'$(symbol-number) Numbers-LE (CSV Streaming)',
				)
			: localize('runtime.statusbar.text', '$(symbol-number) Numbers-LE');
	}

	updateVisibility();
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (
				e.affectsConfiguration('numbers-le.statusBar.enabled') ||
				e.affectsConfiguration('numbers-le.csv.streamingEnabled')
			) {
				updateVisibility();
			}
		}),
	);

	let hideTimer: NodeJS.Timeout | undefined;

	// Clean up timer on deactivation
	context.subscriptions.push({
		dispose(): void {
			if (hideTimer) {
				clearTimeout(hideTimer);
				hideTimer = undefined;
			}
		},
	});

	return Object.freeze({
		flash(text: string): void {
			// Flash a short-lived status text without spamming notifications
			if (!readConfig().statusBarEnabled) return;
			item.text = localize(
				'runtime.statusbar.text.flash',
				'$(symbol-number) {0}',
				text,
			);
			if (hideTimer) {
				clearTimeout(hideTimer);
				hideTimer = undefined;
			}
			hideTimer = setTimeout(() => {
				const csvStreaming = readConfig().csvStreamingEnabled;
				item.text = csvStreaming
					? localize(
							'runtime.statusbar.text.csv-streaming',
							'$(symbol-number) Numbers-LE (CSV Streaming)',
						)
					: localize('runtime.statusbar.text', '$(symbol-number) Numbers-LE');
				hideTimer = undefined;
			}, 2000);
		},
	});
}

void localize;
