export const TOP_LEVEL_HELP = `etyma - command-line tools for Etyma message catalogs

Usage:
  etyma <command> [options]

Commands:
  validate    Validate local or remote JSON message catalogs against a source locale
  contract    Generate a typed message contract from a local source JSON catalog

Options:
  -h, --help     Show help
  -v, --version  Show the installed @etyma/cli version

Run "etyma <command> --help" for command-specific help.
`;

export const VALIDATE_HELP = `Usage:
  etyma validate <directory> --source <locale> [--format pretty|json]
  etyma validate --remote <url-template> --locales <list> --source <locale>
                 [--format pretty|json] [--timeout <ms>]

Validates JSON message catalogs against the source locale's key, MessageFormat 2
and variable contract, using @etyma/tooling. Two explicit modes:

  Local   Every *.json file directly inside <directory>. The locale is read from
          each file's name (en.json -> "en", pt-BR.json -> "pt-BR").

  Remote  One public http(s) catalog per locale, fetched from --remote with each
          "{locale}" replaced by a locale from --locales. Nothing is written to disk.

Arguments:
  <directory>          Local mode: directory containing en.json, es.json, ...

Options:
  --source <locale>    Required. The source/contract locale. Local: <locale>.json
                        must exist in <directory>. Remote: it must be in --locales.
  --remote <template>  Remote mode: URL template containing "{locale}", e.g.
                        "https://cdn.example.com/i18n/{locale}.json". http: or
                        https: only, no credentials. Quote it in your shell.
  --locales <list>     Remote mode: comma-separated locales to fetch, e.g. en,es,uk
  --timeout <ms>       Remote mode: per-catalog request timeout (default 10000)
  --format <format>    Output format: "pretty" (default) or "json"
  -h, --help           Show this help

Exit codes:
  0  catalogs are valid
  1  catalog validation found errors
  2  usage, configuration, filesystem or network error (validation did not run)

Examples:
  etyma validate ./src/app/i18n --source en
  etyma validate ./src/app/i18n --source en --format json
  etyma validate --remote "https://cdn.example.com/i18n/{locale}.json" \\
                 --locales en,es,uk --source en
`;

export const CONTRACT_HELP = `Usage:
  etyma contract <source.json> --output <file>

Generates a defineMessageContract module from one local source catalog: its
exact message keys and each message's MessageFormat 2 variable names. Pass it to
defineI18n({ source, contract }) and t() checks params for a JSON source too.
The source JSON stays the runtime catalog; the module holds no message text.

The output is deterministic and only written when it changes. Commit it, and
regenerate it whenever the source catalog changes. It does not check other
locales - run "etyma validate" for that.

Arguments:
  <source.json>        The source locale's catalog, e.g. ./src/i18n/en.json

Options:
  -o, --output <file>  Required. The .ts module to write; directories are created.
  -h, --help           Show this help

Exit codes:
  0  contract written, or already up to date
  2  usage, filesystem or JSON error, an invalid catalog shape, or a source
     message that is not valid MessageFormat 2 (nothing was written)

Example:
  etyma contract ./src/i18n/en.json --output ./src/i18n/etyma.generated.ts
`;
