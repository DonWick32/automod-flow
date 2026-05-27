# AutoModFlow

Visual editor for subreddit AutoModerator YAML. Moderators open a dedicated custom post from the subreddit menu and edit rules on a React Flow canvas—import existing YAML, connect condition and action nodes, then export or save.

## 🚀 Full List of Features

### 🖌️ Visual Canvas Editor
- **Node-Based Rule Creation**: Drag and drop Condition and Action nodes onto an infinite canvas.
- **Visual Connections**: Connect condition nodes to action nodes using an intuitive curve line mapping.
- **Pan & Zoom Controls**: Easily navigate large graph networks of rules using interactive controls and a mini-map.
- **Node Selection & Shortcuts**: Support for partial multi-selection (using Shift/Cmd) and moving multiple nodes simultaneously.

### 💾 Smart Save & Load
- **Two-Way Synchronization**: Loads current rules from the `config/automoderator` wiki page and saves them back seamlessly.
- **Position Persistence**: Automatically saves and restores the exact X/Y positions of your nodes in the canvas using custom hidden metadata in the YAML file!
- **Auto-Alignment**: Features a dedicated "Align" button that neatly reorganizes messy nodes into a clean grid layout (wraps column after 5 rows).
- **Unsaved Changes Indicator**: Warns you if you have unsaved modifications on your canvas.

### 📜 AutoMod YAML Interoperability
- **Import YAML**: Paste raw AutoModerator YAML snippets. It intelligently converts them into connected condition and action nodes on the fly.
- **Copy YAML**: Generates AutoMod-compliant YAML from your visual graph and copies it to your clipboard.
- **Preset Rules Gallery**: Access a gallery of popular templates (e.g., "Filter Low Karma", "Remove Crypto Spam") and instantly inject them into your graph.

### 🔄 History & Canvas Management
- **Undo / Redo**: Full action history tracking. Easily undo mistakes using keyboard shortcuts (`Ctrl+Z`/`Cmd+Z`) or the sidebar buttons.
- **Copy & Paste Nodes**: Duplicate sub-graphs quickly with keyboard shortcuts (`Ctrl+C`/`Ctrl+V`).
- **Clear Canvas**: A dedicated trash button with a safety confirmation modal to wipe the board clean.

### 🎛️ Condition & Action Node Logic
- **Dropdown Builders**: Configure `target` and `modifier` in condition nodes (e.g. `body (regex)` or `author.account_age`).
- **Complex Combinations**: Build complex AND logic chains where multiple conditions point to a single action.
- **Multiple Actions**: Fire multiple actions (e.g. remove, comment, and send modmail) from the same condition tree.

## How it works

1. Use the subreddit mod menu action **Config AutoMod like a pro**.
2. The app creates or reuses a moderator-only custom post (hidden from the public feed) and navigates you to it.
3. The post renders the flow editor, which **loads your current rules** from the subreddit wiki page `config/automoderator`.
4. Edit rules visually (conditions → actions), then **Save to Wiki** to update `config/automoderator` — the same page AutoModerator reads.

This is a two-way flow: wiki YAML → canvas on load, canvas → wiki YAML on save.

## Development

```bash
npm install
npm run dev
```

Requires Node 22+ and the [Devvit CLI](https://developers.reddit.com/docs).

## Commands

- `npm run dev` — playtest with live rebuild
- `npm run build` — build client and server
- `npm run deploy` — upload to Reddit
- `npm run type-check` — TypeScript, lint, format check

See `redditautomoderatordocs.txt` for AutoModerator syntax and `PARSER_ARCHITECTURE.md` for the YAML ↔ flow parser design.
