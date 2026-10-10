# Connecting Claude to Fusion (and checking it is online)

Fusion's MCP server runs **inside the Fusion desktop app on your computer**. Claude talks to
it over `localhost` — a network address that only means "this same machine". That one fact
explains most of the steps below.

## Last check from this repo

| Date | Where the check ran | Result |
|------|---------------------|--------|
| 2026-10-10 | Claude Code cloud session (claude.ai/code) | **Offline / not reachable.** No Fusion connector in the account's connector list, no Fusion tools loaded, nothing listening on port 27182. Expected: a cloud container is a different machine from the one running Fusion. |

## Step by step

### 1. Open Fusion and open (or create) a design

**Why:** the MCP server acts on the document that is open right now. It does not start Fusion
or open files for you, so with no active design its tools have nothing to work on.

### 2. Turn on the MCP server inside Fusion

`Preferences → General → API → Fusion MCP Server` → enable, then **note the port number**
(the default is usually `27182`).

**Why:** the server is off by default, and the port is the "door number" Claude knocks on.
If Fusion and Claude disagree about the port, they never meet.

### 3. Prove the server side is up — before involving Claude

macOS (Terminal):

```bash
lsof -nP -iTCP:27182 -sTCP:LISTEN
```

Windows (PowerShell):

```powershell
netstat -ano | findstr :27182
```

A line of output means Fusion is listening. No output means step 2 did not take effect
(or the port is different — use the number you noted).

**Why this order:** it splits the problem in half. If nothing is listening, no amount of
Claude configuration will help; fix Fusion first.

### 4. Connect a client that runs on the same computer

In **Claude Desktop**, add the **Autodesk Fusion** connector and make sure its port matches
step 2.

**Why Claude Desktop and not the browser:** claude.ai in a browser and Claude Code cloud
sessions run on Anthropic's servers, and `localhost` there is *their* machine, not yours.
Claude Desktop (or Claude Code run locally in your terminal) shares your computer, so it can
reach Fusion's port.

### 5. End-to-end test

In a new Claude Desktop chat, ask: *"What Fusion tools do you have, and what is the name of
the active design?"* A correct design name means the whole chain works.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Claude lists no Fusion tools | Connector not added/enabled for this chat | Enable it in the chat's connector menu |
| Tools listed but calls fail | Fusion closed, or no design open | Open a design, retry |
| Step 3 shows nothing | MCP server toggle off, or a different port | Re-check step 2 |
| Works in Desktop, not on claude.ai/code | Expected — cloud can't reach `localhost` | Do Fusion work from Desktop or local Claude Code; commit results here |

## Related

Autodesk also offers MCP servers that run in the cloud (for example for Fusion Team project
data), which do not need Fusion open. They read and write cloud data, not the live
document, and are a separate setup.

## Sources

- [Autodesk Fusion connector (Claude)](https://claude.com/connectors/autodesk-fusion)
- [Build Your Own Fusion Add-ins with the Fusion MCP (Autodesk blog)](https://www.autodesk.com/products/fusion-360/blog/?p=87994)
- [Fusion MCP explainer (adam.new)](https://adam.new/fusion-mcp)
