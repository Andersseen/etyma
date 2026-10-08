export const TOP_LEVEL_HELP = `etyma - command-line tools for Etyma message catalogs

Usage:
  etyma <command> [options]

Commands:
  validate    Validate local or remote JSON message catalogs against a source locale
  contract    Generate a typed message contract from a local source JSON catalog
  analyze     Analyze static JS/TS message-key usage

Options:
  -h, --help     Show help
  -v, --version  Show the installed @etyma/cli version

Run "etyma <command> --help" for command-specific help.
`;

export const ANALYZE_HELP = `Usage:
  etyma analyze <directory> --catalog <source.json>
                [--exclude <glob> ...]
                [--format pretty|json] [--angular | --astro]

Recursively scans JavaScript and TypeScript files for statically recognisable Etyma
message-key usages. Reports unknown literal keys, dynamic-key warnings, and
unreferenced candidates from one local source catalog. By default it does not analyse
templates. With --angular it also analyses recognized Angular component templates and
templateUrl files when the component class proves its translator binding. With --astro it
analyses JS/TS plus Astro frontmatter and template expressions. These options are mutually
exclusive. Neither mode follows wrappers or general data flow; unreferenced candidates are
not proof that a message is unused or safe to delete.

Arguments:
  <directory>          Source directory to scan recursively

Options:
  --catalog <file>     Required local source JSON catalog
  --exclude <glob>     Exclude a relative path; may be repeated. Paths use / separators
  --format <format>    Output format: "pretty" (default) or "json"
  --angular            Analyze recognized Angular component templates (requires @angular/compiler ^21 or ^22)
  --astro              Analyze Astro frontmatter and template expressions (Astro 6/7)
  -h, --help           Show this help

Exit codes:
  0  analysis completed with no error-severity diagnostics; warnings and
     unreferenced candidates are allowed
  1  analysis completed with an error-severity source diagnostic
  2  usage, catalog, filesystem, or other operational error; analysis did not run

Examples:
  etyma analyze ./src --catalog ./src/i18n/en.json
  etyma analyze ./src --catalog ./src/i18n/en.json \\
    --exclude "**/*.spec.ts" --exclude "**/*.test.ts"
  etyma analyze ./src --catalog ./src/i18n/en.json --format json
  etyma analyze ./src --catalog ./src/i18n/en.json --angular
  etyma analyze ./src --catalog ./src/i18n/en.json --astro
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
  etyma contract <source.json> --output <file> --check

Generates a defineMessageContract module from one local source catalog: its
exact message keys, each message's MessageFormat 2 variable names, and the
MF2 functions each variable's value reaches (e.g. {$count :number}), which
narrow param value types. Pass it to defineI18n({ source, contract }) and t()
checks params for a JSON source too. The source JSON stays the runtime
catalog; the module holds no message text.

The output is deterministic and only written when it changes. Commit it, and
regenerate it whenever the source catalog changes. With --check, nothing is
written: the command only verifies that <file> is exactly what it would
generate - run that in CI. It does not check other locales - run
"etyma validate" for that.

Arguments:
  <source.json>        The source locale's catalog, e.g. ./src/i18n/en.json

Options:
  -o, --output <file>  Required. The .ts module to write; directories are created.
  --check              Verify <file> is current instead of writing it. Never
                        writes, creates or touches any file or directory.
  -h, --help           Show this help

Exit codes:
  0  contract written, or already up to date (with --check: up to date)
  1  --check only: <file> is missing or out of date
  2  usage, filesystem or JSON error, an invalid catalog shape, or a source
     message that is not valid MessageFormat 2 (nothing was written)

Examples:
  etyma contract ./src/i18n/en.json --output ./src/i18n/etyma.generated.ts
  etyma contract ./src/i18n/en.json --output ./src/i18n/etyma.generated.ts --check
`;
