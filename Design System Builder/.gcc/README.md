# .gcc — Git Context Controller

> Agent-agnostic persistent memory for AI agents working on DSB.
> Every agent reads `.gcc/index.md` at session start. Every agent writes learnings before session end.
> Git handles versioning, merging, and audit trail (`git blame` on AI decisions).

## Purpose

`.gcc/` stores **pre-digested, high-level knowledge** that any AI agent can consume cheaply.
Instead of re-reasoning the architecture every session (thousands of tokens), agents read
consolidated summaries here (hundreds of tokens).

## How It Reduces Token Cost

```
WITHOUT .gcc/:  Agent starts → reads 50+ files → reasons about architecture → 6,500+ tokens burned
WITH .gcc/:     Agent starts → reads .gcc/patterns/architecture.md → 1,000 tokens → starts working
```

Copilot (flat-rate Premium Requests) does the heavy reasoning and writes conclusions here.
Claude Code (per-token Anthropic API) reads pre-digested files and executes tasks directly.

## Folder Structure

```
.gcc/
├── README.md              ← You are here
├── index.md               ← Memory index — read this FIRST
├── patterns/              ← High-level consolidated knowledge
│   ├── architecture.md    ← Architecture decisions + rationale
│   ├── conventions.md     ← Coding conventions (promoted from sessions)
│   └── decisions.md       ← Key decision log with reasoning
├── agents/                ← Per-agent accumulated knowledge
│   ├── copilot.md         ← What Copilot has learned across sessions
│   ├── claude-code.md     ← What Claude Code tab has learned
│   └── claude-agent.md    ← What Claude third-party agent has learned
├── sessions/              ← Auto-exported session transcripts
│   └── (dated markdown files written by agents at session end)
└── knowledge/             ← Domain knowledge extracted during work
    └── (topic-specific files written as agents learn things)
```

## Rules

1. **Read `.gcc/index.md` at session start** — it points to what matters
2. **Write your learnings before session end** — update your agent file + any pattern files
3. **Never delete entries** — append or update. Git tracks the history.
4. **Patterns are promoted, not invented** — a pattern must appear in 2+ sessions before it goes in `patterns/`
5. **Sessions are transcripts, not summaries** — capture what was discussed, decided, and why
