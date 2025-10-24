import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';

// Command to navigate users directly to numbers-le settings
export function registerOpenSettingsCommand(
	context: vscode.ExtensionContext,
	telemetry: Telemetry,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('numbers-le.openSettings', async () => {
			telemetry.event('command', { name: 'openSettings' });
			// Open Settings UI filtered by exact setting prefix to avoid unrelated matches
			await vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'numbers-le.',
			);
		}),
	);
}
