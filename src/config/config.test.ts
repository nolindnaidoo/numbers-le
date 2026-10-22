import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { _resetMockState, _setConfig } from '../__mocks__/vscode';
import {
	CONFIG_DEFAULTS,
	isValidNotificationLevel,
	isValidSortMode,
	readConfig,
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
		'numbers-le.clipboardIncludesPositions': 'clipboardIncludesPositions',
		'numbers-le.copyToClipboardEnabled': 'copyToClipboardEnabled',
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
		'numbers-le.showPositions': 'showPositions',
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

describe('a number setting is read as a number', () => {
	beforeEach(() => _resetMockState());

	it('falls back to the default when the stored value is not a number', () => {
		// `Number('')` and `Number(null)` are both 0, so a setting cleared to an
		// empty string or null read as 0 and was clamped to the floor: a 1,000
		// byte size guard in place of the 1,000,000 byte default.
		for (const stored of ['', null, true, 'abc']) {
			_resetMockState();
			_setConfig('numbers-le.safety.fileSizeWarnBytes', stored);
			expect(readConfig().safetyFileSizeWarnBytes, String(stored)).toBe(
				CONFIG_DEFAULTS.safetyFileSizeWarnBytes,
			);
		}
	});

	it('clamps a number below the floor to the floor', () => {
		_setConfig('numbers-le.safety.fileSizeWarnBytes', 5);
		expect(readConfig().safetyFileSizeWarnBytes).toBe(1000);
	});
});
