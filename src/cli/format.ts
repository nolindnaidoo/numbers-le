/**
 * Which extractor reads a document, as the Rust CLI's `extract/format.rs`
 * resolves it: the one resolver in `src/mcp/fileType.ts`, which the
 * extension's commands read through as well. The crate reads `.env.local`,
 * `.env.production` and their siblings as dotenv, and a second resolver here
 * once did while the server's split on the last dot; one implementation is
 * what keeps the three surfaces answering alike.
 */
export { canonical, FALLBACK_FORMAT, resolveFormat } from '../mcp/fileType';
