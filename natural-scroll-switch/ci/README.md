# CI workflows

GitHub only executes workflows from the **repository root**, so these two files live here — the project
stays self-contained — and are copied up when the project is added to the repo. **These copies are the
source of truth**: the CI workflow diffs them against `.github/workflows/` on every run and fails if the
two ever drift, so edit them here and copy up again.

```bash
mkdir -p .github/workflows
cp natural-scroll-switch/ci/natural-scroll-switch-*.yml .github/workflows/
```

| File | Trigger | Does |
|---|---|---|
| `natural-scroll-switch-ci.yml` | push / PR touching `natural-scroll-switch/**` | builds debug + release, runs read-only commands, assembles and verifies the app bundle |
| `natural-scroll-switch-release.yml` | tag `natural-scroll-switch-v*` | builds the universal app, packages `.zip` + `.dmg` + `SHA256SUMS.txt`, publishes a GitHub Release |

Both use `macos-latest` and need no secrets — releases are ad-hoc signed. If a Developer ID is added
later, put the certificate and password in repository secrets, import it into a temporary keychain
before `build-app.sh`, and add a `notarytool submit --wait` + `stapler staple` step after it.
