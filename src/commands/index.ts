import * as vscode from 'vscode';
import { readConfig } from '../config/config';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { dedupeNumbers } from './dedupe';
import { extractNumbers } from './extract';
import { sortNumbers } from './sort';

export interface CommandDependencies {
	notifier: Notifier;
	statusBar: StatusBar;
	telemetry: Telemetry;
}

export function registerCommands(
	context: vscode.ExtensionContext,
	deps: CommandDependencies,
): void {
	const commands = [
		vscode.commands.registerCommand(
			'numbers-le.extractNumbers',
			async () => await extractNumbers(deps),
		),
		vscode.commands.registerCommand(
			'numbers-le.postProcess.dedupe',
			async () => await dedupeNumbers(deps),
		),
		vscode.commands.registerCommand(
			'numbers-le.postProcess.sort',
			async () => await sortNumbers(deps),
		),
		vscode.commands.registerCommand(
			'numbers-le.csv.toggleStreaming',
			async () => {
				const enabled = !readConfig().csvStreamingEnabled;
				await vscode.workspace
					.getConfiguration('numbers-le')
					.update(
						'csv.streamingEnabled',
						enabled,
						vscode.ConfigurationTarget.Global,
					);
				deps.telemetry.event('command', { name: 'csv.toggleStreaming' });
				deps.statusBar.flash(
					enabled ? 'CSV streaming on' : 'CSV streaming off',
				);
			},
		),
	];

	for (const command of commands) {
		context.subscriptions.push(command);
	}
}
