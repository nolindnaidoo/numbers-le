import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FileType } from '../types';
import { extractNumber } from './extract';
import { extractFromCsvAsync } from './formats/csv';

/**
 * Characterization tests: pin the CURRENT extraction output per format,
 * including known bugs (collectNumber duplicated per format with divergent
 * string coercion — INI parseFloats strings while JSON/YAML/TOML do not;
 * parseFloat accepting leading-garbage like "12abc"; Infinity passing the
 * NaN-only guard in JSON/YAML/TOML/INI collectors; CSV sync parser
 * including the header row while the streaming parser skips it; js-yaml
 * rejecting multi-document streams). Behavior changes must update these
 * snapshots in the same commit, so every output diff is explicit.
 */

const FIXTURES: ReadonlyArray<{ fixture: string; fileType: FileType }> = [
	{ fixture: 'numbers.json', fileType: 'json' },
	{ fixture: 'numbers.yaml', fileType: 'yaml' },
	{ fixture: 'multi-doc.yaml', fileType: 'yaml' },
	{ fixture: 'numbers.csv', fileType: 'csv' },
	{ fixture: 'numbers.toml', fileType: 'toml' },
	{ fixture: 'mixed-array.toml', fileType: 'toml' },
	{ fixture: 'numeric-header.csv', fileType: 'csv' },
	{ fixture: 'numbers.ini', fileType: 'ini' },
	{ fixture: 'numbers.env', fileType: 'env' },
];

function readFixture(name: string): string {
	return readFileSync(join(__dirname, '__fixtures__', name), 'utf8');
}

describe('extraction characterization', () => {
	for (const { fixture, fileType } of FIXTURES) {
		it(`${fixture} as ${fileType}`, () => {
			const result = extractNumber(readFixture(fixture), fileType, fixture);
			expect(result).toMatchSnapshot();
		});
	}

	it('numbers.csv via streaming parser', async () => {
		const result = await extractFromCsvAsync(
			readFixture('numbers.csv'),
			'numbers.csv',
		);
		expect(result).toMatchSnapshot();
	});

	it('numeric-header.csv via streaming parser (header skipped, diverges from sync)', async () => {
		const result = await extractFromCsvAsync(
			readFixture('numeric-header.csv'),
			'numeric-header.csv',
		);
		expect(result).toMatchSnapshot();
	});

	it('unknown file type falls back to regex scan', () => {
		const result = extractNumber(
			'abc123 v1.2.3 -5 3.14.15 12px width:0',
			'unknown',
			'fallback.txt',
		);
		expect(result).toMatchSnapshot();
	});
});
