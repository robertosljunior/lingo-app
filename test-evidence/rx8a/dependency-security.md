# RX-8A dependency security

## Scope

Remove the reviewed high-severity npm advisory debt without changing application behavior.

## Vulnerable packages observed in CI

- `brace-expansion` 5.0.7 and nested 2.1.1
- `fast-uri` 3.1.3
- `js-yaml` 4.3.0
- `postcss` 8.5.16

## Patched floors

- `brace-expansion` 5.0.9 / 2.1.4
- `fast-uri` 3.1.5
- `js-yaml` 4.3.1
- `postcss` 8.5.23

## Acceptance

- `npm ci` succeeds from the committed lockfile.
- `npm audit` reports zero critical and zero high vulnerabilities.
- The dependency audit budget is reduced to `{ critical: 0, high: 0 }`.
- Unit, pedagogy, build, IndexedDB and Playwright gates remain green.
