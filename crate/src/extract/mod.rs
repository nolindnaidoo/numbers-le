pub(crate) mod corpus;
pub(crate) mod csv;
pub(crate) mod dotenv;
pub(crate) mod fallback;
pub(crate) mod format;
pub(crate) mod ini;
pub(crate) mod js;
pub(crate) mod json;
pub(crate) mod locate;
pub(crate) mod policy;
pub(crate) mod position;
pub(crate) mod render;
pub(crate) mod source;
pub(crate) mod toml;
pub(crate) mod yaml;

use serde::Serialize;

pub(crate) use format::{FALLBACK_FORMAT, SUPPORTED_FORMATS, resolve_format};
pub(crate) use policy::{Literal, Notation};
pub(crate) use position::Position;
pub(crate) use render::js_number;

/// What a caller can change about how a document is read.
///
/// Nothing yet. The extension's extractors take no options and inventing
/// some here would be this crate growing behaviour the extension then
/// has to be held to; the struct exists so adding one later is not a
/// signature change across every surface.
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct Options;

/// One extracted number, printed, and how the source wrote it.
///
/// `value` is text, not a JSON number. Re-encoding through a number
/// would hand the reader whatever their parser prints, which is the one
/// thing this crate exists to control.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct Number {
    pub(crate) value: String,
    pub(crate) notation: Notation,
}

/// One extracted number, and where it was found.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct Found {
    pub(crate) value: String,
    pub(crate) notation: Notation,
    #[serde(flatten)]
    pub(crate) position: Option<Position>,
}

/// Every number in a document, printed as JavaScript would print it, in
/// document order.
pub(crate) fn extract(text: &str, format: &str, _options: Options) -> Vec<Number> {
    raw(text, format)
        .into_iter()
        .map(|literal| Number {
            value: js_number(literal.value),
            notation: literal.notation,
        })
        .collect()
}

/// The literals themselves, before rendering.
pub(crate) fn raw(text: &str, format: &str) -> Vec<Literal> {
    let key = format::canonical(format);
    match key {
        "json" => json::extract(text, false),
        "jsonc" => json::extract(text, true),
        "yaml" => yaml::extract(text),
        "toml" => toml::extract(text),
        "ini" => ini::extract(text),
        "env" => dotenv::extract(text),
        "csv" => csv::extract(text, csv::COMMA),
        "tsv" => csv::extract(text, csv::TAB),
        _ if format::is_source(key) => source::extract(text, key),
        _ => fallback::extract(text),
    }
}

/// Every number, printed and placed.
pub(crate) fn extract_located(text: &str, format: &str, _options: Options) -> Vec<Found> {
    locate::locate(text, format, &raw(text, format))
}

/// Why a document yielded nothing, when the reason is a parse failure.
pub(crate) fn parse_error(text: &str, format: &str) -> Option<String> {
    match format::canonical(format) {
        "json" => json::parse_error(text, false),
        "jsonc" => json::parse_error(text, true),
        "yaml" => yaml::parse_error(text),
        "toml" => toml::parse_error(text),
        "ini" => ini::parse_error(text),
        "csv" => csv::parse_error(text, csv::COMMA),
        "tsv" => csv::parse_error(text, csv::TAB),
        // dotenv reads lines and the fallback scans runs; neither has a
        // shape it can reject.
        _ => None,
    }
}
