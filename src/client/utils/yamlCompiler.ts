import YAML from 'js-yaml';
import type { Node, Edge } from '@xyflow/react';

/**
 * PART 1: NORMALIZED DATA STRUCTURES
 * These strict TypeScript interfaces enforce a predictable format for the UI to consume
 */

export interface NormalizedCondition {
  target: string; // e.g., "title", "body", "author.account_age", "domain"
  modifier: string; // e.g., "includes", "includes-word", "regex", "match", "starts-with", "ends-with", "case-sensitive"
  negated: boolean; // true if prefixed with ~
  value: string | string[]; // What we are searching for
  sourceRef?: string; // Stable ref used by AutoModFlow to preserve grouped topology in YAML comments
}

export interface NormalizedAction {
  actionType: string; // e.g., "remove", "filter", "comment", "message", "set_flair"
  value: string | boolean | { text?: string; subject?: string } | Record<string, unknown>; // Action-specific value
  reason?: string; // For actions that support action_reason
  sourceRef?: string; // Stable ref used by AutoModFlow to preserve grouped topology in YAML comments
}

export type RuleGroupMeta = {
  conditionRefs: string[];
  actionRefs: string[];
  positions?: Record<string, { x: number; y: number }>;
};

export interface NormalizedRule {
  id: string; // UUID for React Flow Group Node
  conditions: NormalizedCondition[];
  actions: NormalizedAction[];
  groupMeta?: RuleGroupMeta;
}

const AUTOMODFLOW_META_PREFIX = '# automodflow:';

type ParsedYamlDocument = {
  doc: Record<string, unknown>;
  meta?: RuleGroupMeta;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeGroupMeta(meta: unknown): RuleGroupMeta | undefined {
  if (!meta || typeof meta !== 'object') {
    return undefined;
  }

  const maybeMeta = meta as Partial<RuleGroupMeta>;
  const conditionRefs = Array.isArray(maybeMeta.conditionRefs)
    ? maybeMeta.conditionRefs.filter((value): value is string => typeof value === 'string')
    : [];
  const actionRefs = Array.isArray(maybeMeta.actionRefs)
    ? maybeMeta.actionRefs.filter((value): value is string => typeof value === 'string')
    : [];
    
  const positions = maybeMeta.positions;

  if (conditionRefs.length === 0 && actionRefs.length === 0) {
    return undefined;
  }

  return { conditionRefs, actionRefs, positions };
}

function encodeGroupMeta(meta: RuleGroupMeta): string {
  // Use short keys to reduce base64 length
  const shortMeta = {
    c: meta.conditionRefs,
    a: meta.actionRefs,
    p: meta.positions,
  };
  const json = JSON.stringify(shortMeta);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeGroupMeta(encoded: string): RuleGroupMeta | undefined {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    
    // Map back from short keys
    const meta: any = {};
    if (parsed.c) meta.conditionRefs = parsed.c;
    if (parsed.a) meta.actionRefs = parsed.a;
    if (parsed.p) meta.positions = parsed.p;
    
    return normalizeGroupMeta(meta);
  } catch {
    return undefined;
  }
}

function extractGroupMetaFromDocText(docText: string): RuleGroupMeta | undefined {
  const lines = docText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) {
      continue;
    }
    if (!trimmed.startsWith(AUTOMODFLOW_META_PREFIX)) {
      continue;
    }
    const encoded = trimmed.slice(AUTOMODFLOW_META_PREFIX.length).trim();
    if (!encoded) {
      return undefined;
    }
    return decodeGroupMeta(encoded);
  }
  return undefined;
}

function parseYamlDocumentsWithMeta(yamlText: string): ParsedYamlDocument[] {
  const docTexts = yamlText.split(/^\s*---\s*$/m);
  const parsedDocs: ParsedYamlDocument[] = [];

  docTexts.forEach((docText) => {
    if (!docText.trim()) {
      return;
    }
    const loaded = YAML.load(docText);
    if (!isRecord(loaded)) {
      return;
    }

    const meta = extractGroupMetaFromDocText(docText);
    if (meta) {
      parsedDocs.push({
        doc: loaded,
        meta,
      });
      return;
    }

    parsedDocs.push({
      doc: loaded,
    });
  });

  return parsedDocs;
}

/**
 * PART 2: YAML TO NORMALIZED STATE
 * Parses raw multi-document AutoMod YAML into a strict, predictable format
 */

/**
 * Parse raw AutoMod YAML text into normalized rules
 * Handles:
 * - Multiple documents separated by ---
 * - Negation prefix (~title)
 * - Key combinations (title+body)
 * - Modifiers in parentheses (~title (regex): "spam")
 * - Nested author objects (flattened to author.account_age, etc.)
 */
export function yamlToState(yamlText: string): NormalizedRule[] {
  if (!yamlText.trim()) return [];

  try {
    // Step 1: Split and parse multiple YAML documents while preserving AutoModFlow metadata comments
    const documents = parseYamlDocumentsWithMeta(yamlText);
    const normalizedRules: NormalizedRule[] = [];

    documents.forEach(({ doc, meta }, index) => {
      if (!doc || typeof doc !== 'object') return;

      const rule: NormalizedRule = {
        id: `rule-${Date.now()}-${index}`,
        conditions: [],
        actions: [],
      };

      // Step 2: Iterate through keys and categorize as condition or action
      const rawActions: Record<string, unknown> = {};

      Object.entries(doc).forEach(([key, value]) => {
        // Check if it's an action
        if (isActionKey(key)) {
          const actionType = key.replace(/^~/, '').split('(')[0]?.trim() ?? '';
          rawActions[actionType] = value;
        } else {
          // It's a condition
          const conditions = parseConditionKey(key, value);
          rule.conditions.push(...conditions);
        }
      });

      // Combine related actions
      const processedActionKeys = new Set<string>();

      // Base action
      if (rawActions.action !== undefined) {
        const action: NormalizedAction = {
          actionType: 'action',
          value: rawActions.action as string,
        };
        const reason = (rawActions.action_reason as string | undefined) || (rawActions.report_reason as string | undefined);
        if (reason) action.reason = reason;
        
        rule.actions.push(action);
        processedActionKeys.add('action');
        processedActionKeys.add('action_reason');
        processedActionKeys.add('report_reason');
      }

      // Message
      if (rawActions.message !== undefined) {
        const action: NormalizedAction = {
          actionType: 'message',
          value: rawActions.message as string,
        };
        const reason = rawActions.message_subject as string | undefined;
        if (reason) action.reason = reason;

        rule.actions.push(action);
        processedActionKeys.add('message');
        processedActionKeys.add('message_subject');
      }

      // Modmail
      if (rawActions.modmail !== undefined) {
        const action: NormalizedAction = {
          actionType: 'modmail',
          value: rawActions.modmail as string,
        };
        const reason = rawActions.modmail_subject as string | undefined;
        if (reason) action.reason = reason;

        rule.actions.push(action);
        processedActionKeys.add('modmail');
        processedActionKeys.add('modmail_subject');
      }

      // Other actions
      Object.entries(rawActions).forEach(([key, value]) => {
        if (!processedActionKeys.has(key)) {
          rule.actions.push(parseAction(key, value));
        }
      });

      if (meta) {
        rule.groupMeta = meta;
        meta.conditionRefs.forEach((ref, conditionIdx) => {
          const condition = rule.conditions[conditionIdx];
          if (condition) {
            condition.sourceRef = ref;
          }
        });
        meta.actionRefs.forEach((ref, actionIdx) => {
          const action = rule.actions[actionIdx];
          if (action) {
            action.sourceRef = ref;
          }
        });
      }

      normalizedRules.push(rule);
    });

    return normalizedRules;
  } catch (error) {
    console.error('Failed to parse YAML:', error);
    throw new Error(`Invalid AutoModerator YAML format. Please check the text syntax. Details: ${(error as Error).message}`);
  }
}

function isActionKey(key: string): boolean {
  const cleanKey = (key.replace(/^~/, '').split('(')[0] ?? '').trim();
  const actionKeys = [
    'action',
    'action_reason',
    'report_reason',
    'message',
    'message_subject',
    'comment',
    'modmail',
    'modmail_subject',
    'set_locked',
    'set_sticky',
    'set_nsfw',
    'set_spoiler',
    'set_suggested_sort',
    'set_flair',
    'overwrite_flair',
  ];
  return actionKeys.includes(cleanKey);
}

/**
 * Parse a condition key into NormalizedCondition objects
 * Handles:
 * - Negation: ~title => { negated: true }
 * - Combination: title+body => two separate conditions
 * - Modifiers: title (regex) => { modifier: "regex" }
 */
function parseConditionKey(key: string, value: unknown): NormalizedCondition[] {
  const conditions: NormalizedCondition[] = [];

  // Extract negation
  const negated = key.startsWith('~');
  let cleanKey = negated ? key.slice(1) : key;

  // Extract modifier from parentheses
  const modifierMatch = cleanKey.match(/\s*\(([^)]+)\)/);
  const modifier = modifierMatch?.[1] ?? 'includes';
  cleanKey = cleanKey.replace(/\s*\([^)]+\)/, '').trim();

  // Split combination keys (e.g., "title+body")
  const targets = cleanKey.split('+').map((t) => t.trim());

  // Handle nested author object
  if (cleanKey === 'author' && typeof value === 'object' && value !== null) {
    const authorConditions = parseAuthorObject(value as Record<string, unknown>, negated);
    conditions.push(...authorConditions);
  } else {
    // Standard condition: normalize value to array
    const normalizedValue = normalizeValue(value);

    targets.forEach((target) => {
      conditions.push({
        target,
        modifier,
        negated,
        value: normalizedValue,
      });
    });
  }

  return conditions;
}

/**
 * Flatten nested author object into dot-notation conditions
 */
function parseAuthorObject(
  authorObj: Record<string, unknown>,
  negated: boolean
): NormalizedCondition[] {
  const conditions: NormalizedCondition[] = [];

  Object.entries(authorObj).forEach(([key, value]) => {
    const target = `author.${key}`;
    const normalizedValue = normalizeValue(value);

    conditions.push({
      target,
      modifier: 'includes', // Default modifier for author fields
      negated,
      value: normalizedValue,
    });
  });

  return conditions;
}

/**
 * Convert single values into arrays, handle special cases
 */
function normalizeValue(value: unknown): string | string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  return [''];
}

/**
 * Parse action key-value pairs
 */
function parseAction(key: string, value: unknown): NormalizedAction {
  const actionType = key.replace(/^~/, '').split('(')[0]?.trim() ?? '';

  return {
    actionType,
    value: value ?? '',
  };
}

/**
 * PART 3: NORMALIZED STATE TO YAML
 * Reverse the process: compile React Flow nodes back to AutoMod YAML
 */

export function stateToYaml(rules: NormalizedRule[], groupMetaByRule: Array<RuleGroupMeta | undefined> = []): string {
  const yamlDocs: string[] = [];

  rules.forEach((rule, ruleIdx) => {
    const doc: Record<string, unknown> = {};

    // Reconstruct conditions
    const authorConditions: Record<string, unknown> = {};
    let hasAuthorConditions = false;

    rule.conditions.forEach((condition) => {
      let key = condition.target;

      // Add negation prefix
      if (condition.negated) {
        key = `~${key}`;
      }

      // Add modifier if not default
      if (condition.modifier && condition.modifier !== 'includes') {
        key = `${key} (${condition.modifier})`;
      }

      // Handle author nested object
      if (condition.target.startsWith('author.')) {
        hasAuthorConditions = true;
        const authorKey = condition.target.replace('author.', '');
        let val: string | string[] | boolean | number = '';
        if (Array.isArray(condition.value)) {
          val = condition.value.length === 1 ? (condition.value[0] ?? '') : condition.value;
        } else if (condition.value !== undefined) {
          val = condition.value;
        }
          
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') val = Number(val); // parse pure numbers just in case? no, thresholds have operators like `< 10` so they stay strings

        authorConditions[authorKey] = val;
      } else {
        // Add condition to doc
        let val: string | string[] | boolean = '';
        if (Array.isArray(condition.value)) {
          val = condition.value.length === 1 ? (condition.value[0] ?? '') : condition.value;
        } else if (condition.value !== undefined) {
          val = condition.value;
        }
            
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        
        doc[key] = val;
      }
    });

    // Rebuild author object if needed
    if (hasAuthorConditions && Object.keys(authorConditions).length > 0) {
      doc.author = authorConditions;
    }

    // Reconstruct actions
    rule.actions.forEach((action) => {
      if (action.actionType) {
        let actionVal: NormalizedAction['value'] = action.value;
        if (actionVal === 'true') actionVal = true;
        else if (actionVal === 'false') actionVal = false;
        
        doc[action.actionType] = actionVal;
      }
      if (action.reason) {
        if (action.actionType === 'action') {
          doc[action.value === 'report' ? 'report_reason' : 'action_reason'] = action.reason;
        } else if (action.actionType === 'message') {
          doc.message_subject = action.reason;
        } else if (action.actionType === 'modmail') {
          doc.modmail_subject = action.reason;
        } else {
          doc.action_reason = action.reason;
        }
      }
    });

    const dumped = YAML.dump(doc, { lineWidth: -1, noRefs: true }).trim();
    if (!dumped) {
      return;
    }

    const explicitMeta = groupMetaByRule[ruleIdx];
    const fallbackMeta = rule.groupMeta;
    const resolvedMeta = normalizeGroupMeta(explicitMeta ?? fallbackMeta);
    if (resolvedMeta) {
      const encoded = encodeGroupMeta(resolvedMeta);
      yamlDocs.push(`${AUTOMODFLOW_META_PREFIX} ${encoded}\n${dumped}`);
      return;
    }

    yamlDocs.push(dumped);
  });

  if (yamlDocs.length === 0) {
    return '';
  }

  return yamlDocs.join('\n---\n');
}

/**
 * PART 4: REACT FLOW INTEGRATION
 * Generate nodes and edges from normalized state
 */

export function generateNodesFromRules(
  rules: NormalizedRule[],
  startRuleIdx: number = 0,
  startYOffset: number = 0,
  useSavedPositions: boolean = true
): { nodes: Node[]; edges: Edge[] } {
  const RULE_START_X = 80;
  const NODE_HORIZONTAL_GAP = 360;
  const ACTION_VERTICAL_GAP = 160; // Reduced from 230
  const RULE_VERTICAL_GAP = 100; // Reduced from 170
  const MIN_RULE_HEIGHT = 150; // Reduced from 280
  const ESTIMATED_NODE_HEIGHT = 120; // Reduced from 220

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const conditionRefToNodeId = new Map<string, string>();
  const actionRefToNodeId = new Map<string, string>();
  const addedEdgeIds = new Set<string>();
  
  let yOffset = startYOffset;
  let currentColumnXOffset = 0;
  let currentRow = 0;
  const MAX_ROWS = 5;
  let nextColumnXOffset = 0;

  rules.forEach((rule, ruleIdx) => {
    const actualRuleIdx = startRuleIdx + ruleIdx;
    let prevNodeId: string | null = null;
    let currentX = RULE_START_X + currentColumnXOffset;
    const actionStackHeight =
      rule.actions.length > 0
        ? ESTIMATED_NODE_HEIGHT + (rule.actions.length - 1) * ACTION_VERTICAL_GAP
        : 0;
    const ruleHeight = Math.max(MIN_RULE_HEIGHT, ESTIMATED_NODE_HEIGHT, actionStackHeight);

    rule.conditions.forEach((condition, idx) => {
      const sourceRef = condition.sourceRef;
      const existingNodeId = sourceRef ? conditionRefToNodeId.get(sourceRef) : undefined;
      const nodeId = existingNodeId ?? `rule-${actualRuleIdx}-cond-${idx}`;

      if (!existingNodeId) {
        let finalPos = { x: currentX, y: yOffset };
        if (useSavedPositions && sourceRef && rule.groupMeta?.positions && rule.groupMeta.positions[sourceRef]) {
            finalPos = rule.groupMeta.positions[sourceRef];
        }

        const node: Node = {
          id: nodeId,
          type: 'condition',
          data: condition as unknown as Record<string, unknown>,
          position: finalPos,
        };
        nodes.push(node);
        if (sourceRef) {
          conditionRefToNodeId.set(sourceRef, nodeId);
        }
      }

      if (prevNodeId) {
        const edgeId = `e-${prevNodeId}-${nodeId}`;
        if (!addedEdgeIds.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: prevNodeId,
            target: nodeId,
            animated: true,
            style: { stroke: '#38bdf8', strokeWidth: 2 },
          });
          addedEdgeIds.add(edgeId);
        }
      }
      prevNodeId = nodeId;
      currentX += NODE_HORIZONTAL_GAP;
    });

    rule.actions.forEach((action, idx) => {
      const sourceRef = action.sourceRef;
      const existingNodeId = sourceRef ? actionRefToNodeId.get(sourceRef) : undefined;
      const actionId = existingNodeId ?? `rule-${actualRuleIdx}-action-${idx}`;

      if (!existingNodeId) {
        let finalPos = { x: currentX, y: yOffset + (idx * ACTION_VERTICAL_GAP) };
        if (useSavedPositions && sourceRef && rule.groupMeta?.positions && rule.groupMeta.positions[sourceRef]) {
            finalPos = rule.groupMeta.positions[sourceRef];
        }

        const node: Node = {
          id: actionId,
          type: 'action',
          data: action as unknown as Record<string, unknown>,
          position: finalPos,
        };
        nodes.push(node);
        if (sourceRef) {
          actionRefToNodeId.set(sourceRef, actionId);
        }
      }

      if (prevNodeId) {
        const edgeId = `e-${prevNodeId}-${actionId}`;
        if (!addedEdgeIds.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: prevNodeId,
            target: actionId,
            animated: true,
            style: { stroke: '#e879f9', strokeWidth: 2 },
          });
          addedEdgeIds.add(edgeId);
        }
      }
    });

    nextColumnXOffset = Math.max(nextColumnXOffset, currentX - RULE_START_X + NODE_HORIZONTAL_GAP);

    currentRow++;
    if (currentRow >= MAX_ROWS) {
        currentRow = 0;
        currentColumnXOffset = nextColumnXOffset;
        yOffset = startYOffset;
    } else {
        yOffset += ruleHeight + RULE_VERTICAL_GAP;
    }
  });

  return { nodes, edges };
}


export function generateAutomodYAML(nodes: Node[], edges: Edge[]): string {
  const conditionNodes = new Map<string, Node>();
  const actionNodes = new Map<string, Node>();

  nodes.forEach(n => {
    if (n.type === 'condition') conditionNodes.set(n.id, n);
    if (n.type === 'action') actionNodes.set(n.id, n);
  });

  const incoming = new Map<string, string[]>();
  
  edges.forEach(e => {
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e.source);
  });

  const rulesMap = new Map<
    string,
    {
      conditionNodeIds: string[];
      actionNodeIds: string[];
      conditions: NormalizedCondition[];
      actions: NormalizedAction[];
    }
  >();

  function getConditionPaths(nodeId: string): string[][] {
    const node = conditionNodes.get(nodeId);
    if (!node) return [];

    const inEdges = incoming.get(nodeId) || [];
    const conditionInEdges = inEdges.filter(id => conditionNodes.has(id));

    if (conditionInEdges.length === 0) {
      return [[nodeId]];
    }

    const paths: string[][] = [];
    for (const prevId of conditionInEdges) {
      const prevPaths = getConditionPaths(prevId);
      for (const p of prevPaths) {
        paths.push([...p, nodeId]);
      }
    }
    return paths;
  }

  actionNodes.forEach((actionNode, actionId) => {
    const inEdges = incoming.get(actionId) || [];
    const conditionInEdges = inEdges.filter(id => conditionNodes.has(id));

    if (conditionInEdges.length === 0) {
      const key = "no-conditions";
      if (!rulesMap.has(key)) {
        rulesMap.set(key, {
          conditionNodeIds: [],
          actionNodeIds: [],
          conditions: [],
          actions: [],
        });
      }
      const noConditionRule = rulesMap.get(key)!;
      if (!noConditionRule.actionNodeIds.includes(actionId)) {
        noConditionRule.actionNodeIds.push(actionId);
      }
      noConditionRule.actions.push(actionNode.data as unknown as NormalizedAction);
      return;
    }

    const allPaths: string[][] = [];
    for (const prevId of conditionInEdges) {
      allPaths.push(...getConditionPaths(prevId));
    }

    for (const path of allPaths) {
      const pathKey = [...path].sort().join(',');

      if (!rulesMap.has(pathKey)) {
        const conditions = path.map(id => conditionNodes.get(id)!.data as unknown as NormalizedCondition);
        rulesMap.set(pathKey, {
          conditionNodeIds: [...path],
          actionNodeIds: [],
          conditions,
          actions: [],
        });
      }
      const ruleEntry = rulesMap.get(pathKey)!;
      if (!ruleEntry.actionNodeIds.includes(actionId)) {
        ruleEntry.actionNodeIds.push(actionId);
      }
      ruleEntry.actions.push(actionNode.data as unknown as NormalizedAction);
    }
  });

  const rulesToExport: NormalizedRule[] = [];
  const groupMetaByRule: RuleGroupMeta[] = [];
  let ruleIdx = 0;
  rulesMap.forEach((ruleData) => {
    const conditionsWithRefs = ruleData.conditions.map((condition, idx) => {
      const sourceRef = ruleData.conditionNodeIds[idx] ?? condition.sourceRef;
      if (sourceRef) {
        return { ...condition, sourceRef };
      }
      return condition;
    });
    const actionsWithRefs = ruleData.actions.map((action, idx) => {
      const sourceRef = ruleData.actionNodeIds[idx] ?? action.sourceRef;
      if (sourceRef) {
        return { ...action, sourceRef };
      }
      return action;
    });

    const positions: Record<string, { x: number; y: number }> = {};
    ruleData.conditionNodeIds.forEach((id) => {
      const node = conditionNodes.get(id);
      if (node) positions[id] = { x: node.position.x, y: node.position.y };
    });
    ruleData.actionNodeIds.forEach((id) => {
      const node = actionNodes.get(id);
      if (node) positions[id] = { x: node.position.x, y: node.position.y };
    });

    groupMetaByRule.push({
      conditionRefs: [...ruleData.conditionNodeIds],
      actionRefs: [...ruleData.actionNodeIds],
      positions,
    });
    rulesToExport.push({
      id: `rule-${ruleIdx++}`,
      conditions: conditionsWithRefs,
      actions: actionsWithRefs,
    });
  });

  return stateToYaml(rulesToExport, groupMetaByRule);
}
