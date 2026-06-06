# v3.0.0 — GitHub Sync Scope

> **Status:** Scoping only. Do **not** implement in this branch.
> Implementation lands in a later session on top of this doc.

**Branch:** `feature/github-sync-v3`
**Target version:** 3.0.0
**Author:** scope doc only — no code changes
**Last updated:** 2026-06-06

---

## 1. Why this exists

The plugin is already bidirectional (export + import) for Figma Variables and
Styles. Adding direct GitHub sync lets it write `tokens/*.json` straight to a
repo, which collapses the design-system architecture from **4 tools to 3**
(Penpot exits the loop).

The plugin's `figma` JSON format becomes the canonical write format on the
repo side, because it has higher fidelity than the plugin's `w3c` mode (which
the author has acknowledged is incomplete).

This doc scopes the v3.0.0 cut. Anything labelled "v3.1" or "later" is
explicitly **out of scope** here.

---

## 2. Manifest change

Today (v2.0.0):

```json
"networkAccess": {
  "allowedDomains": ["none"]
}
```

v3.0.0:

```json
"networkAccess": {
  "allowedDomains": ["api.github.com", "raw.githubusercontent.com"]
}
```

`api.github.com` covers the REST contents + branches endpoints.
`raw.githubusercontent.com` is included for fast read paths on large blobs
where we want to bypass the Base64-wrapped contents API (see §7).

Figma reviews manifest network changes — flag this in the Community submission
notes.

---

## 3. Auth strategy

**v3.0.0 — PAT in `clientStorage`** (~30 lines)

- User pastes a fine-grained Personal Access Token into the Settings tab.
- Token is stored via `figma.clientStorage.setAsync('github_pat', token)`.
- Token is sent only to `api.github.com` over HTTPS in the
  `Authorization: Bearer <pat>` header.
- "Disconnect" wipes the entry from `clientStorage`.

Required PAT scopes (fine-grained):

- **Repository access:** the single repo the user wants to sync to.
- **Repository permissions → Contents:** Read and write.
- **Repository permissions → Metadata:** Read-only (mandatory).

**v3.1 — OAuth Device Flow** (deferred)

- Better UX (no manual PAT minting), but adds a hosted callback / polling
  loop and a client-id we'd have to register. Not worth blocking v3.0.0 on.
- Track as a follow-up issue once v3.0.0 ships.

---

## 4. GitHub API operations

All requests go through `fetch()` from `ui.html` (the iframe is the only
runtime that can do network I/O — the QuickJS backend cannot). Results are
posted back to `code.ts` via `postMessage`.

| Op            | Method | Endpoint                                                  | Used by         |
|---------------|--------|-----------------------------------------------------------|-----------------|
| List branches | GET    | `/repos/:owner/:repo/branches`                            | Branch picker   |
| Pull file     | GET    | `/repos/:owner/:repo/contents/:path?ref=:branch`          | Import tab pull |
| Push file     | PUT    | `/repos/:owner/:repo/contents/:path`                      | Export tab push |

PUT payload shape (v3.0.0, single-file mode):

```json
{
  "message": "chore(tokens): sync from Figma plugin",
  "content": "<base64 of JSON>",
  "branch": "<selected-branch>",
  "sha": "<sha-of-current-blob-if-updating>"
}
```

The `sha` field is the GitHub contents API's optimistic-concurrency knob — we
populate it from the most recent pull (see §6).

Errors to handle explicitly:

- `401` → bad/expired PAT → prompt to re-enter in Settings.
- `403` with `x-ratelimit-remaining: 0` → surface rate-limit reset time.
- `404` on PUT → file doesn't exist yet → retry without `sha`.
- `409` / `sha` mismatch → conflict path (see §6).

---

## 5. UI additions

Three tabs become four. Keep the existing 4-column layout from v2.0.0; do not
re-flow.

**New: Settings tab**

- "Connect GitHub" section: owner, repo, default branch, PAT input
  (`type="password"`), Save, Disconnect.
- Status row: "Connected as `<login>` → `<owner>/<repo>` @ `<branch>`".

**Export tab — addition**

- New button: **📤 Push to GitHub** (next to existing copy/download).
- Path input (default `tokens/figma.json`).
- Branch picker (populated from GET `/branches`).
- Optional commit-message input (default `chore(tokens): sync from Figma plugin`).
- Optional **pre-push diff view**: show old-vs-new JSON in a collapsed
  side-by-side panel before the PUT fires. Stretch for v3.0.0 — drop if it
  pushes us past the upper effort bound in §7.

**Import tab — addition**

- New button: **📥 Pull from GitHub** (next to existing paste/upload).
- Same path + branch picker controls as Export.
- Pulled JSON drops into the existing textarea, then flows through the
  normal validate → preview → import pipeline.

---

## 6. Conflict handling (v3.0.0)

**Strategy:** last-write-wins with a guard.

- Every successful pull stashes the file's `sha` in memory (not in
  `clientStorage` — it goes stale fast).
- On push, we send that `sha`. If GitHub returns a mismatch, the UI shows:

  > **Remote changed since your last pull.** Pushing now will overwrite
  > someone else's commit. Overwrite anyway?

- User can:
  1. **Cancel** → re-pull, re-export from Figma, retry.
  2. **Overwrite** → second PUT without the `sha` field (force-write to
     branch tip).

**Out of scope for v3.0.0:**

- Real 3-way merge between Figma state, last-pulled JSON, and remote tip.
- Branch-on-conflict (auto-open a PR against the user's branch).
- Both deferred to v3.1+. Document in the open-issues tracker after
  v3.0.0 ships.

---

## 7. Estimated effort

**~300–500 lines** across:

| File           | Approx. lines | Notes                                              |
|----------------|---------------|----------------------------------------------------|
| `src/code.ts`  | ~80–120       | Message handlers for github push/pull/list-branches, clientStorage wiring. |
| `ui.html`      | ~220–380      | Settings tab, two buttons, branch picker, fetch wrappers, optional diff view, error toasts. |
| `manifest.json`| 1             | `allowedDomains` swap.                             |

Lower bound assumes diff view is dropped. Upper bound assumes diff view ships
and we add a "Recently synced files" history row.

No new dependencies. `fetch` + native `btoa` / `atob` cover everything.

---

## 8. Open questions

These need a decision **before** the implementation session starts.

### 8.1 Base64 / large-file handling

- The GitHub contents API wraps blobs in Base64 in both directions.
- Token files for design systems can hit several MB once you've got
  hundreds of variables × multiple modes.
- `btoa` works on strings, but it's slow on big payloads and synchronous —
  it will jank the iframe.
- **Options:**
  1. Cap single-file token JSON at ~1 MB; advise multi-file mode beyond that.
  2. Use the Web Worker (already in v2.0.0 for JSON parsing) for
     Base64 encode/decode.
  3. For **reads** only, hit `raw.githubusercontent.com` directly (no
     Base64 wrapping). Writes still go through the contents API.

  **Recommendation:** ship with (2) + (3). (1) is a fallback only if we run
  out of time.

### 8.2 Single-file vs multi-file token trees

- Current plugin assumes one JSON blob in / out.
- Real token repos often split by surface: `tokens/colors.json`,
  `tokens/typography.json`, `tokens/semantic/*.json`, etc.
- **Options:**
  1. v3.0.0 supports single-file only. Path is one input. Multi-file lands
     in v3.1 with a tree picker.
  2. v3.0.0 supports a flat list of paths (n × PUT). Skips tree UX but
     covers the common case.
  3. v3.0.0 supports a folder + glob (`tokens/**/*.json`) with one commit
     per push.

  **Recommendation:** start at (1) for v3.0.0 to keep scope honest; revisit
  during implementation if (2) turns out to be ~30 extra lines.

---

## 9. Out of scope for v3.0.0 (explicit)

- OAuth Device Flow (v3.1).
- Three-way merge / auto-PR on conflict (v3.1+).
- Multi-file / tree-picker UX (v3.1, see §8.2).
- GitHub Enterprise (custom hostnames in `allowedDomains`).
- Bitbucket / GitLab equivalents.
- Webhook-driven pull (Figma plugins can't receive inbound HTTP).
- Storing PAT anywhere but `clientStorage` (no remote secret store).

---

## 10. Acceptance criteria for v3.0.0

- [ ] Manifest `allowedDomains` updated, Figma review notes drafted.
- [ ] User can paste a PAT, see "Connected" status, and disconnect.
- [ ] Branch picker lists branches from the configured repo.
- [ ] Push button writes `tokens/figma.json` (or user-chosen path) to the
      selected branch.
- [ ] Pull button drops the remote JSON into the Import textarea and runs
      validation.
- [ ] Conflict path shows the warning and offers cancel/overwrite.
- [ ] PAT errors surface to the Settings tab and clear cleanly.
- [ ] CHANGELOG entry for 3.0.0 lists the manifest change up top (Figma
      reviewers look for this).
