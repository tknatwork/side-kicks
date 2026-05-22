# Security Policy

## Supported Versions

Only the latest published version of each plugin in this repository receives
security updates. Older versions are not maintained.

| Plugin | Supported Versions |
| ------ | ------------------ |
| Variables & Styles Extractor | 2.0.x (latest) |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Public issues are visible to anyone scanning the repository and can give
attackers a head start before a fix is available.

Instead, report vulnerabilities privately via one of the following channels:

1. **GitHub Private Vulnerability Reporting** (preferred):
   - Go to the Security tab → "Report a vulnerability"
   - Fill in the form; only repository maintainers see the report
   - https://github.com/tknatwork/side-kicks/security/advisories/new

2. **Email**: hi@tusharkantnaik.com
   - Subject line: `[SECURITY] <brief description>`
   - Include: affected version, reproduction steps, expected impact

## What to Expect

| Stage | Timeline |
| ----- | -------- |
| Acknowledgement | Within 72 hours |
| Initial assessment | Within 7 days |
| Fix + coordinated disclosure | Within 30 days for high-severity issues |

## Scope

In scope:
- Source code in this repository
- Released artifacts (GitHub Releases + Figma Community listing)
- CI/CD workflows (`.github/workflows/*.yml`)

Out of scope:
- Vulnerabilities in Figma itself (report to Figma directly)
- Issues in unmaintained plugin versions
- Theoretical attacks without a working proof of concept

## Disclosure Policy

We follow coordinated disclosure: please give us a reasonable window to ship
a fix before publicly disclosing the vulnerability. Once a fix is released,
we will publish a GitHub Security Advisory crediting the reporter (unless
anonymity is requested).
