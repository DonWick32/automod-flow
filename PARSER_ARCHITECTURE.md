# AutoModFlow: Two-Way YAML Parser Architecture

## Overview

AutoModFlow features a **complete bidirectional YAML parser** that converts raw AutoModerator configurations into visual React Flow nodes, and vice versa. This document explains the implementation and architecture.

## Part 1: The Normalized Data Layer

The parser is built on three core TypeScript interfaces that enforce a predictable format:

```typescript
export interface NormalizedCondition {
  target: string;          // e.g., "title", "body", "author.account_age"
  modifier: string;        // e.g., "includes", "regex", "includes-word"
  negated: boolean;        // true if prefixed with ~
  value: string | string[]; // What we're searching for
}

export interface NormalizedAction {
  actionType: string;      // e.g., "remove", "filter", "comment"
  value: string | boolean | Record<string, unknown>;
  reason?: string;         // Optional: for action_reason
}

export interface NormalizedRule {
  id: string;              // UUID for React Flow Group Node
  type?: string;           // Default: "any"
  conditions: NormalizedCondition[];
  actions: NormalizedAction[];
}
```

## Part 2: YAML → Normalized State (Parsing)

The `yamlToState()` function converts raw multi-document YAML into normalized rules.

### Key Features:

1. **Multi-Document Splitting**: Uses `YAML.loadAll()` to handle multiple rules separated by `---`

2. **Negation Extraction**: Detects and extracts the `~` prefix
   ```
   ~title (regex): "spam"  →  { target: "title", modifier: "regex", negated: true }
   ```

3. **Modifier Parsing**: Extracts modifiers in parentheses (defaults to "includes")
   ```
   body (regex): "pattern"  →  { modifier: "regex" }
   title (includes-word): ["keyword"]  →  { modifier: "includes-word" }
   ```

4. **Key Combinations**: Splits combined keys into separate conditions
   ```
   title+body: ["spam"]  →  Two conditions (title and body)
   ```

5. **Nested Author Flattening**: Converts nested author objects to dot-notation
   ```
   author:
     account_age: "< 7 days"
     comment_karma: "< 50"
   
   Becomes:
   [
     { target: "author.account_age", value: "< 7 days" },
     { target: "author.comment_karma", value: "< 50" }
   ]
   ```

6. **Array Normalization**: Converts single values to arrays for consistency
   ```
   title: "spam"  →  { value: ["spam"] }
   ```

### Example Flow:

```yaml
# Raw YAML Input
- type: submission
  ~title (regex): "spam"
  author:
    account_age: "< 7 days"
  action: remove
  action_reason: "Spam detected"
```

→ (Parsing) →

```typescript
{
  id: "rule-1234567890-0",
  type: "submission",
  conditions: [
    {
      target: "title",
      modifier: "regex",
      negated: true,
      value: ["spam"]
    },
    {
      target: "author.account_age",
      modifier: "includes",
      negated: false,
      value: ["< 7 days"]
    }
  ],
  actions: [
    {
      actionType: "action",
      value: "remove",
      reason: "Spam detected"
    }
  ]
}
```

## Part 3: Normalized State → React Flow Nodes

The `generateNodesFromRules()` function converts normalized rules into React Flow nodes:

1. **Group Nodes**: Each rule becomes a group (dashed border) containing condition and action nodes
2. **Condition Nodes**: Blue nodes with target selector, modifier dropdown, negation checkbox, and value input
3. **Action Nodes**: Purple nodes with action type selector and value input
4. **Edges**: All conditions in a group connect to all actions in that group

### Generated Node Structure:

```typescript
{
  id: "rule-1234567890-0",  // Group ID
  data: { label: "Rule submission" },
  position: { x: 0, y: 0 },
  style: { /* group styling */ }
},
{
  id: "rule-1234567890-0-cond-0",
  type: "condition",
  data: { /* NormalizedCondition */ },
  parentId: "rule-1234567890-0"
},
{
  id: "rule-1234567890-0-action-0",
  type: "action",
  data: { /* NormalizedAction */ },
  parentId: "rule-1234567890-0"
}
```

## Part 4: Normalized State → YAML (Compiling)

The `stateToYaml()` function reverses the process:

1. **Reconstruct Conditions**: Applies modifiers and negation prefixes
2. **Rebuild Author Objects**: Converts dot-notation back to nested structure
3. **Add Actions**: Includes action types and reasons
4. **YAML Dump**: Uses `YAML.dump()` to generate final YAML

### Example Reverse Flow:

```typescript
// Normalized State
{
  target: "title",
  modifier: "regex",
  negated: true,
  value: ["spam"]
}
```

→ (Compiling) →

```yaml
~title (regex): ["spam"]
```

## Part 5: Supported AutoMod Syntax

### Target Types:
- Submission types: `submission`, `link`, `text`, `crosspost`, `poll`, `gallery`
- Content checks: `title`, `body`, `url`, `domain`, `flair_text`, `flair_css_class`, `flair_template_id`
- User/Author checks: `author.name`, `author.account_age`, `author.post_karma`, `author.comment_karma`, etc.

### Modifiers:
- `includes` (default)
- `includes-word`
- `match` (exact match)
- `regex` (regular expression)
- `starts-with`
- `ends-with`
- `case-sensitive`

### Actions:
- State: `action` (approve, remove, spam, filter, report), `action_reason`
- Communication: `message`, `message_subject`, `comment`, `modmail`, `modmail_subject`
- Thread: `set_locked`, `set_sticky`, `set_nsfw`, `set_spoiler`
- Flair: `set_flair`, `overwrite_flair`

## Part 6: The React Component Integration

The `ConditionNode` and `ActionNode` components consume the normalized data:

```typescript
// ConditionNode
<select onChange={handleTargetChange}>
  <option value="title">Title</option>
  <option value="author.account_age">Author Account Age</option>
  ...
</select>

<select onChange={handleModifierChange}>
  <option value="includes">Includes (default)</option>
  <option value="regex">Regex</option>
  ...
</select>

<input 
  type="checkbox" 
  checked={data.negated}
  onChange={handleNegateChange}
/>

<input 
  value={Array.isArray(data.value) ? data.value.join(', ') : data.value}
  onChange={handleValueChange}
/>
```

## Part 7: The Import/Export Flow

### Import (YAML → Nodes):
1. User pastes YAML in modal
2. Call `yamlToState()` → Get NormalizedRule[]
3. Call `generateNodesFromRules()` → Get { nodes, edges }
4. Update React Flow state

### Export (Nodes → YAML):
1. User clicks Export
2. Call `generateAutomodYAML()` → Get YAML string
3. Copy to clipboard or send via postMessage to Devvit

## Error Handling

The parser gracefully handles:
- Invalid YAML syntax (logs error, returns empty array)
- Nested author objects (flattens to dot-notation)
- Missing modifiers (defaults to "includes")
- Single vs. array values (normalizes to arrays)
- Modifier mismatches (preserves as-is for round-trip fidelity)

## Testing the Parser

```typescript
// Test: Parse complex YAML
const yaml = `
type: submission
~title (regex): "spam"
author:
  account_age: "< 7 days"
action: remove
---
title: ["bad word"]
action: filter
`;

const rules = yamlToState(yaml);  // → NormalizedRule[]
const { nodes, edges } = generateNodesFromRules(rules);  // → For React Flow
const backToYaml = stateToYaml(rules);  // Should match original
```

## Design Decisions

1. **Flattening Author Objects**: AutoMod has a unique nested structure for user checks. By flattening to `author.account_age`, we avoid building a separate UI component just for authors.

2. **Array Normalization**: All values are stored as arrays internally for consistency, even if the YAML uses a single string.

3. **Modifier Preservation**: If the user specifies a modifier, we preserve it. If not, we default to "includes" but don't store it (to keep YAML clean).

4. **Parent-Based Grouping**: In React Flow, we use `parentId` to group nodes logically, making rule management intuitive.

5. **Bidirectional Sync**: The architecture ensures `stateToYaml(yamlToState(yaml))` produces valid, equivalent YAML (with potential formatting differences).

## Files Involved

- `yamlCompiler.ts`: Core parser logic (yamlToState, stateToYaml, generateNodesFromRules)
- `ConditionNode.tsx`: UI for condition editing
- `ActionNode.tsx`: UI for action editing
- `splash.tsx`: Main React component with import/export modal

## Future Enhancements

- [ ] Multi-rule editing (edit multiple rules at once)
- [ ] Rule templates (save/load common patterns)
- [ ] YAML syntax highlighting in import modal
- [ ] Validation rules (warn on invalid modifier+target combos)
- [ ] Conditional groups (if X and Y, then Z)
- [ ] Rule duplication/cloning
