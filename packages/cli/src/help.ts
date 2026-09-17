export const TOP_LEVEL_HELP = `etyma - command-line tools for Etyma message catalogs

Usage:
  etyma <command> [options]

Commands:
  validate    Validate local JSON message catalogs against a source locale

Options:
  -h, --help     Show help
  -v, --version  Show the installed @etyma/cli version

Run "etyma validate --help" for command-specific help.
`;

export const VALIDATE_HELP = `Usage:
  etyma validate <directory> --source <locale> [--format pretty|json]

Validates every *.json catalog file directly inside <directory> against the
source locale's key, MessageFormat 2 and variable contract, using
@etyma/tooling. Locale is read from each file's name (en.json -> "en",
pt-BR.json -> "pt-BR").

Arguments:
  <directory>          Directory containing locale catalog files (e.g. en.json, es.json)

Options:
  --source <locale>    Required. The source/contract locale. <locale>.json must
                        exist in <directory>.
  --format <format>    Output format: "pretty" (default) or "json"
  -h, --help           Show this help

Exit codes:
  0  catalogs are valid
  1  catalog validation found errors
  2  usage, configuration or filesystem error

Examples:
  etyma validate ./src/app/i18n --source en
  etyma validate ./src/app/i18n --source en --format json
`;
