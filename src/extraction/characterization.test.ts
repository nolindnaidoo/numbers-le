import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FileType } from '../types';
import { extractNumber } from './extract';
import { extractFromCsvAsync } from './formats/csv';

/**
 * Characterization tests: pin the extraction output per format.
 * Behavior changes must update these snapshots in the same commit, so
 * every output diff is explicit.
 *
 * The 2.0 policy pinned here (see extraction/heuristics.ts): finite
 * numbers only; string coercion only in INI/.env/CSV and only when the
 * whole string is numeric ("12abc" and "1.2.3" extract nothing); CSV
 * sync and streaming agree, with no header inference; multi-document
 * YAML extracts from every document.
 *
 * 0.2.0 added two things every snapshot here shows: a `notation` on
 * every finding, and a numeric-literal reader for source languages —
 * where the text scan used to report `u32` as the number 32.
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

	it('numeric-header.csv via streaming parser (agrees with sync)', async () => {
		const result = await extractFromCsvAsync(
			readFixture('numeric-header.csv'),
			'numeric-header.csv',
		);
		expect(result).toMatchSnapshot();
	});

	it('a source language reads its literals whole', () => {
		const result = extractNumber(
			'const MODE: u32 = 0o755;\nconst BIG: usize = 1_000_000;\nconst M: u64 = 0xFF;\n',
			'rust',
			'limits.rs',
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
