import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createExtensionContext,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
} from '../__mocks__/vscode';
import { registerHelpCommand } from './help';

/**
 * The help document against the manifest it describes. It claimed CSV
 * streaming, which nothing implements, named `openResultsSideBySide` as off
 * by default when the manifest says on, repeated a Quick Start step and left
 * six settings out; prose has no compiler, so this is the one it gets.
 */

type Manifest = {
	contributes: {
		configuration:
			| { properties: Record<string, { default: unknown }> }
			| Array<{ properties: Record<string, { default: unknown }> }>;
	};
};

function declaredDefaults(): Record<string, string> {
	const manifest = JSON.parse(
		readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
	) as Manifest;
	const configuration = manifest.contributes.configuration;
	const sections = Array.isArray(configuration)
		? configuration
		: [configuration];
	return Object.fromEntries(
		sections.flatMap((section) =>
			Object.entries(section.properties).map(([key, property]) => [
				key,
				JSON.stringify(property.default),
			]),
		),
	);
}

async function helpText(): Promise<string> {
	registerHelpCommand(_createExtensionContext() as never, {
		event: () => {},
		dispose: () => {},
	});
	const handler = _registeredCommands().get('numbers-le.help');
	if (!handler) throw new Error('help command not registered');
	await handler();
	const opened = _openedDocuments();
	return opened[opened.length - 1]?.getText() ?? '';
}

beforeEach(() => {
	_resetMockState();
});

describe('help', () => {
	it('states every setting, with the default the manifest declares', async () => {
		const help = await helpText();
		const stated: Record<string, string> = {};
		for (const match of help.matchAll(
			/`(numbers-le\.[\w.-]+)`\*\* - [^\n]*?\(default: `([^`]+)`/g,
		)) {
			stated[match[1] as string] = match[2] as string;
		}
		expect(stated).toEqual(declaredDefaults());
	});

	it('numbers the quick start without repeating a step', async () => {
		const help = await helpText();
		const section = help.split('## Quick Start')[1]?.split('\n## ')[0] ?? '';
		const steps = [...section.matchAll(/^(\d+)\. (.+)$/gm)];
		expect(steps.map((step) => step[1])).toEqual(
			steps.map((_, index) => String(index + 1)),
		);
		const texts = steps.map((step) =>
			(step[2] as string).replace(/\*\*/g, '').trim(),
		);
		expect(new Set(texts).size).toBe(texts.length);
	});

	it('claims no streaming, which nothing implements', async () => {
		expect(await helpText()).not.toMatch(/stream/i);
	});
});
