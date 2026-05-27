const fs = require('fs');
const filePath = 'src/client/utils/yamlCompiler.ts';
let code = fs.readFileSync(filePath, 'utf-8');

const splitIndex = code.indexOf('export function generateNodesFromRules(');

const newLogic = \export function generateNodesFromRules(
  rules: NormalizedRule[]
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let yOffset = 0;

  rules.forEach((rule, ruleIdx) => {
    let prevNodeId: string | null = null;
    let currentX = 50;

    rule.conditions.forEach((condition, idx) => {
      const nodeId = \\\ule-\\\-cond-\\\\\\;
      const node: Node = {
        id: nodeId,
        type: 'condition',
        data: condition as unknown as Record<string, unknown>,
        position: { x: currentX, y: yOffset },
      };
      nodes.push(node);

      if (prevNodeId) {
        edges.push({
          id: \\\e-\\\-\\\\\\,
          source: prevNodeId,
          target: nodeId,
        });
      }
      prevNodeId = nodeId;
      currentX += 350;
    });

    rule.actions.forEach((action, idx) => {
      const actionId = \\\ule-\\\-action-\\\\\\;
      const node: Node = {
        id: actionId,
        type: 'action',
        data: action as unknown as Record<string, unknown>,
        position: { x: currentX, y: yOffset + (idx * 160) },
      };
      nodes.push(node);

      if (prevNodeId) {
        edges.push({
          id: \\\e-\\\-\\\\\\,
          source: prevNodeId,
          target: actionId,
        });
      }
    });

    yOffset += Math.max(250, rule.actions.length * 160 + 50);
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

  const rulesMap = new Map<string, { conditions: NormalizedCondition[], actions: NormalizedAction[] }>();

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
        rulesMap.set(key, { conditions: [], actions: [] });
      }
      rulesMap.get(key)!.actions.push(actionNode.data as unknown as NormalizedAction);
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
        rulesMap.set(pathKey, { conditions, actions: [] });
      }
      rulesMap.get(pathKey)!.actions.push(actionNode.data as unknown as NormalizedAction);
    }
  });

  const rulesToExport: NormalizedRule[] = [];
  let ruleIdx = 0;
  rulesMap.forEach((ruleData) => {
    rulesToExport.push({
      id: \\\ule-\\\\\\,
      conditions: ruleData.conditions,
      actions: ruleData.actions
    });
  });

  return stateToYaml(rulesToExport);
}\;

fs.writeFileSync(filePath, code.substring(0, splitIndex) + newLogic);
