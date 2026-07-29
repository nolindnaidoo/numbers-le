import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	CONFIG_DEFAULTS,
	isValidNotificationLevel,
	isValidSortMode,
} from './config';

/**
 * CONFIG_DEFAULTS must stay identical to the defaults declared in
 * package.json contributes.configuration — v1.x shipped with the two
 * silently disagreeing (openResultsSideBySide and
 * postProcess.openInNewFile were true in the manifest, false in code).
 */
describe('config defaults parity with package.json', () => {
	const manifest = JSON.parse(
		readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
	) as {
		contributes: {
			configuration: { properties: Record<string, { default: unknown }> };
		};
	};
	const props = manifest.contributes.configuration.properties;

	const KEY_MAP: Record<string, keyof typeof CONFIG_DEFAULTS> = {
		'numbers-le.copyToClipboardEnabled': 'copyToClipboardEnabled',
		'numbers-le.csv.streamingEnabled': 'csvStreamingEnabled',
		'numbers-le.dedupeEnabled': 'dedupeEnabled',
		'numbers-le.notificationsLevel': 'notificationsLevel',
		'numbers-le.postProcess.openInNewFile': 'postProcessOpenInNewFile',
		'numbers-le.openResultsSideBySide': 'openResultsSideBySide',
		'numbers-le.safety.enabled': 'safetyEnabled',
		'numbers-le.safety.fileSizeWarnBytes': 'safetyFileSizeWarnBytes',
		'numbers-le.safety.largeOutputLinesThreshold':
			'safetyLargeOutputLinesThreshold',
		'numbers-le.safety.manyDocumentsThreshold': 'safetyManyDocumentsThreshold',
		'numbers-le.showParseErrors': 'showParseErrors',
		'numbers-le.sortEnabled': 'sortEnabled',
		'numbers-le.sortMode': 'sortMode',
		'numbers-le.statusBar.enabled': 'statusBarEnabled',
		'numbers-le.telemetryEnabled': 'telemetryEnabled',
	};

	it('covers every declared setting', () => {
		expect(Object.keys(props).sort()).toEqual(Object.keys(KEY_MAP).sort());
	});

	for (const [manifestKey, defaultsKey] of Object.entries(KEY_MAP)) {
		it(`${manifestKey} default matches`, () => {
			expect(CONFIG_DEFAULTS[defaultsKey]).toBe(props[manifestKey]?.default);
		});
	}
});

describe('isValidSortMode', () => {
	it('accepts the five declared modes', () => {
		for (const mode of [
			'off',
			'numeric-asc',
			'numeric-desc',
			'magnitude-asc',
			'magnitude-desc',
		]) {
			expect(isValidSortMode(mode)).toBe(true);
		}
	});

	it('rejects anything else', () => {
		expect(isValidSortMode('asc')).toBe(false);
		expect(isValidSortMode('')).toBe(false);
		expect(isValidSortMode(undefined)).toBe(false);
		expect(isValidSortMode(3)).toBe(false);
	});
});

describe('isValidNotificationLevel', () => {
	it('accepts the three declared levels', () => {
		for (const level of ['all', 'important', 'silent']) {
			expect(isValidNotificationLevel(level)).toBe(true);
		}
	});

	it('rejects anything else', () => {
		expect(isValidNotificationLevel('verbose')).toBe(false);
		expect(isValidNotificationLevel(null)).toBe(false);
	});
});
