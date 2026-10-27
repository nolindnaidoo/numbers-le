/**
 * The terminal surface, as the Rust CLI's `cli.rs` runs it.
 *
 * stdout is protocol: one JSON report per line whenever something is reading
 * it, and nothing when it is a terminal, because the stderr listing already
 * shows every number a person reads there. `--values` prints wherever stdout
 * goes, because asking for the values is asking to see them.
 */
import { type Cli, parse } from './args';
import { FALLBACK_FORMAT } from './format';
import { decodeUtf8OrThrow, rustIoMessage } from './ioError';
import {
	describe,
	exitCode,
	type FileReport,
	scanContent,
	scanFile,
	unreadable,
} from './scan';
import { USAGE } from './usage';
import { collect } from './walk';

export interface RunIo {
	readonly stdout: (text: string) => void;
	readonly stderr: (text: string) => void;
	readonly stdoutIsTerminal: boolean;
	readonly readStdin: () => Promise<Uint8Array>;
	readonly version: string;
}

export type Read = Readonly<{
	reports: readonly FileReport[];
	binary: number;
	symlinks: number;
}>;

export async function run(args: readonly string[], io: RunIo): Promise<number> {
	const first = args[0];
	if (first === '--help' || first === '-h') {
		io.stdout(`${USAGE}\n`);
		return 0;
	}
	if (first === '--version' || first === '-V') {
		io.stdout(`numbers-le ${io.version}\n`);
		return 0;
	}

	try {
		return await execute(args, io);
	} catch (error) {
		io.stderr(
			`numbers-le: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		return 2;
	}
}

async function execute(args: readonly string[], io: RunIo): Promise<number> {
	const options = parse(args);
	const { reports, binary, symlinks } = options.stdin
		? { reports: [await scanStdin(options, io)], binary: 0, symlinks: 0 }
		: readTree(options.inputs, options);

	io.stdout(
		options.valuesOnly
			? values(reports)
			: jsonLines(reports, io.stdoutIsTerminal),
	);
	io.stderr(summary(reports, binary, symlinks, options.valuesOnly));
	return exitCode(reports, options.strict);
}

/**
 * A binary file gets no report line, since it was never a text candidate, but
 * it is counted. A path the walk could not open is a report line rather than
 * the end of the run, appended after the files that were read, as the crate
 * appends them.
 */
export function readTree(
	inputs: readonly string[],
	options: Pick<Cli, 'scan' | 'walk'>,
): Read {
	const walked = collect(inputs, options.walk);
	const reports: FileReport[] = [];
	let binary = 0;
	for (const target of walked.files) {
		const scanned = scanFile(target, options.scan);
		if (scanned.kind === 'binary') {
			binary += 1;
			continue;
		}
		reports.push(scanned.report);
	}
	for (const refused of walked.unreadable) {
		reports.push(unreadable(refused.path, refused.reason));
	}
	return { reports, binary, symlinks: walked.symlinks };
}

/**
 * No file name to infer from, so an unnamed format falls back, the same answer
 * a source file gets. The stdin document keeps any byte-order mark, as the
 * crate's does.
 */
async function scanStdin(options: Cli, io: RunIo): Promise<FileReport> {
	let content: string;
	try {
		content = decodeUtf8OrThrow(await io.readStdin());
	} catch (error) {
		throw new Error(`could not read stdin: ${rustIoMessage(error)}`);
	}
	const format = options.scan.format ?? FALLBACK_FORMAT;
	return scanContent(content, '<stdin>', format, options.scan);
}

function jsonLines(reports: readonly FileReport[], terminal: boolean): string {
	if (terminal) return '';
	return reports.map((report) => `${JSON.stringify(report)}\n`).join('');
}

function values(reports: readonly FileReport[]): string {
	return reports
		.flatMap((report) => report.numbers.map((found) => `${found.value}\n`))
		.join('');
}

/**
 * The human half. Every line restates something already on stdout, except the
 * binary count and the link count, which stdout cannot carry. Under `--values`
 * the numbers are on stdout already, so they are not repeated here.
 */
function summary(
	reports: readonly FileReport[],
	binary: number,
	symlinks: number,
	valuesOnStdout: boolean,
): string {
	const lines: string[] = [];
	for (const report of reports) {
		for (const diagnostic of report.diagnostics) {
			lines.push(`${report.file}: ${diagnostic.message}`);
		}
		if (valuesOnStdout) continue;
		for (const found of report.numbers) lines.push(describe(report, found));
	}

	const numbers = sum(reports, (report) => report.summary.numbers);
	const unlocated = sum(reports, (report) => report.summary.unlocated);
	lines.push(
		`${plural(numbers, 'number', 'numbers')} in ${plural(reports.length, 'file', 'files')}`,
	);
	if (binary > 0) {
		lines.push(`${plural(binary, 'binary file', 'binary files')} skipped`);
	}
	if (symlinks > 0) {
		// Never followed, by design; still not a silence.
		lines.push(
			`${plural(symlinks, 'symbolic link', 'symbolic links')} not followed`,
		);
	}
	if (unlocated > 0) {
		lines.push(
			`${plural(unlocated, 'value', 'values')} could not be located in the source`,
		);
	}
	return lines.map((line) => `${line}\n`).join('');
}

export function sum(
	reports: readonly FileReport[],
	count: (report: FileReport) => number,
): number {
	return reports.reduce((total, report) => total + count(report), 0);
}

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}
