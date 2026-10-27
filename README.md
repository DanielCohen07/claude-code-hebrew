# claude-code-hebrew

A Claude Code mod (`hebrew-rtl`) that makes Hebrew read right to left.

- **Desktop app, VS Code, mobile:** these draw the markdown themselves and take each block's direction from its first strong letter, so a list or paragraph that opens with an English word reads left to right. The mod hands them the same text with an invisible right-to-left mark (U+200F) opening every paragraph, list item, heading, quote and table cell. Code blocks are left alone.
- **Terminal:** Hebrew replies and prompts are redrawn right to left: paragraphs, headings, lists, quotes and tables flush right, code blocks left to right.
- **Replies in Hebrew:** a short system prompt note asks Claude to answer in Hebrew when you write in Hebrew, and to keep English identifiers, file paths and commands in backticks. Not added to `claude -p` or `--bare` runs.
- **`/rtl`** turns the mod on or off; the choice is kept across sessions.

## Install

At the prompt of a terminal session:

```
/plugin install hebrew-rtl --marketplace DanielCohen07/claude-code-hebrew
```

Or from a shell:

```
claude plugin install hebrew-rtl --marketplace DanielCohen07/claude-code-hebrew
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `DanielCohen07/claude-code-hebrew`, then Add plugin.

Needs a Claude Code build with mod support (2.1.308 or later).

## Limits

- The app's font cannot be changed from a mod.
- The prompt box is not touched.
- Text copied from a Hebrew reply in the desktop app carries the invisible mark at the start of each line.

## License

MIT
