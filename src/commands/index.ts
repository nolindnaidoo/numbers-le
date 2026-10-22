import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { RatingPrompt } from '../ui/ratingPrompt';
import type { StatusBar } from '../ui/statusBar';
import { dedupeNumbers } from './dedupe';
import { extractNumbers } from './extract';
import { guarded } from './guard';
import { sortNumbers } from './sort';

export interface CommandDependencies {
	notifier: Notifier;
	ratingPrompt: RatingPrompt;
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
			guarded(deps.notifier, async () => await extractNumbers(deps)),
		),
		vscode.commands.registerCommand(
			'numbers-le.postProcess.dedupe',
			guarded(deps.notifier, async () => await dedupeNumbers(deps)),
		),
		vscode.commands.registerCommand(
			'numbers-le.postProcess.sort',
			guarded(deps.notifier, async () => await sortNumbers(deps)),
		),
	];

	for (const command of commands) {
		context.subscriptions.push(command);
	}
}
