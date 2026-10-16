/**
 * The command line's help text and the flags it names.
 *
 * Word for word the Rust CLI's, because both install as `numbers-le` and a
 * person reading `--help` cannot tell which one they have.
 * `scripts/check-cli-parity.ts` compares the two outputs, and `cli.test.ts`
 * holds FLAGS equal to the flags this text names.
 */

export const USAGE = `usage: numbers-le [options] <file|dir>...
       numbers-le [options] --stdin [--format <format>]
       numbers-le mcp
       numbers-le --version | --help

Finds every hardcoded number in a tree and puts it where a person can
check it: JSON, YAML, CSV, TOML, INI and dotenv are parsed, and anything
else falls back to a text scan — so a .ts or .sql file yields its
constants rather than nothing.

Numbers are printed exactly as JavaScript prints them, which is what
keeps this and the editor extension answering the same.

It reports what is there and nothing else. Which numbers matter is yours
to decide.

One JSON report per line on stdout when it is piped or redirected, every
number listed on stderr.

Options:
  --dedupe             collapse repeated values to their first occurrence
  --format <format>    force a format instead of inferring it from the
                       file name; an unknown name falls back rather than
                       failing
  --values             print only the values, one per line, for piping
  --strict             exit 2 if any file could not be read, rather than
                       reporting it and carrying on
  --stdin              read one document from stdin
  --hidden             walk hidden files and directories too
  --no-ignore          walk files that .gitignore excludes

A binary file — a NUL byte in its first 8 KiB, ripgrep's own test — is
never a text candidate: it produces no report line, is counted on stderr,
and never fails the run. A file that looked like text and could not be
read is named on stderr, carried in the report, and does not fail the run
by itself; --strict turns that one into a failure.

Exit codes follow grep: 0 numbers found · 1 none found · 2 malformed
question. Finding none is an answer, not an error.`;

export const FLAGS: readonly string[] = Object.freeze([
	'--strict',
	'--dedupe',
	'--format',
	'--values',
	'--stdin',
	'--hidden',
	'--no-ignore',
]);
