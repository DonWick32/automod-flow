import './index.css';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ConditionNode } from './nodes/ConditionNode';
import { ActionNode } from './nodes/ActionNode';
import { generateAutomodYAML, yamlToState, generateNodesFromRules } from './utils/yamlCompiler';

type AutomodConfigResponse = {
  subredditName: string;
  yaml: string;
  wikiPage: string;
  wikiExists: boolean;
  ruleCount: number;
  wikiCreated?: boolean;
};

type DevvitGlobal = {
  context?: {
    subredditName?: string;
  };
};

const devvitGlobal = (
  globalThis as typeof globalThis & { devvit?: DevvitGlobal }
).devvit;
const subredditName = devvitGlobal?.context?.subredditName ?? '';

const nodeTypes = {
  condition: ConditionNode,
  action: ActionNode,
};

type FlowSnapshot = {
  nodes: Node[];
  edges: Edge[];
};

type ClipboardSelection = {
  nodes: Node[];
  edges: Edge[];
};

function cloneFlowState(nodes: Node[], edges: Edge[]): FlowSnapshot {
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
  };
}

/* ─── Inline SVG Icon Components ─── */
function SaveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9H3" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9h9" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function AlignIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="4" x2="20" y2="4"/>
      <line x1="4" y1="12" x2="20" y2="12"/>
      <line x1="4" y1="20" x2="20" y2="20"/>
      <line x1="8" y1="8" x2="8" y2="16"/>
      <line x1="16" y1="8" x2="16" y2="16"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* ─── Sidebar Button Component ─── */
type SidebarButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  accentColor: string;
  accentSoft: string;
  square?: boolean;
};

function SidebarButton({ onClick, disabled, icon, label, accentColor, accentSoft, square }: SidebarButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: square ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: square ? '4px' : '8px',
        padding: square ? '16px 0 8px 0' : '8px 12px',
        background: hovered && !disabled ? accentSoft : 'rgba(255, 255, 255, 0.03)',
        color: disabled ? '#4a4e69' : hovered ? accentColor : '#9399b2',
        border: `1px solid ${hovered && !disabled ? accentColor + '33' : 'rgba(255, 255, 255, 0.06)'}`,
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '12px',
        fontWeight: 500,
        fontFamily: 'inherit',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.4 : 1,
        width: '100%',
        minHeight: square ? '64px' : undefined,
        minWidth: square ? '64px' : undefined,
        textAlign: 'center',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, justifyContent: 'center', width: square ? '100%' : undefined }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const PRESETS = [
  {
    name: "Filter New/Low Karma Users",
    description: "Prevents Spam/Trolls",
    yaml: `---
author:
  account_age: "< 7 days"
  combined_karma: "< 10"
action: remove
action_reason: "Low karma/new account"
---`
  },
  {
    name: "Remove Common Spam Phrases",
    description: "Filters crypto scams and other spam",
    yaml: `---
type: comment
body (regex): ["(buy now|click here|free money|make \\\\$\\\\d+)"]
action: remove
action_reason: "Spammy phrase"
---`
  },
  {
    name: "Handle High Reports",
    description: "Automated Action after 3+ reports",
    yaml: `---
reports: 3
action: remove
action_reason: "High reports"
modmail: The above item was automatically removed due to receiving 3+ reports.
---`
  },
  {
    name: "Require Flair on Posts",
    description: "Forces flairs on all submissions",
    yaml: `---
type: submission
flair_text: null
action: filter
action_reason: "Missing flair"
comment: "Your post has been removed because it is not flaired."
---`
  },
  {
    name: "Filter Excessive Repetition",
    description: "Stops character spam",
    yaml: `---
body (regex): ["(.{3,})\\\\1{3,}"]
action: filter
action_reason: "Repeated characters"
---`
  },
  {
    name: "Block Crypto & Discord Invite Spam",
    description: "Anti-Bot aggressive filter",
    yaml: `---
body+title (regex): ['(crypto|whatsapp|telegram|signal|cashapp|venmo|airdrop|presale|whitelist)\\\\b.+(chat|group|join|invest|pump|giveaway)', 'discord(\\\\.gg|app\\\\.com/invite)/[a-zA-Z0-9=-]+']
action: filter
action_reason: "Potential crypto/chat group spam [{{match}}]"
---`
  },
  {
    name: "Enforce Descriptive Titles",
    description: "Anti-Clickbait",
    yaml: `---
type: submission
title (regex, matches-title): ['^.{0,10}$', '^[^a-z]*$', '([!?.]){3,}']
action: filter
action_reason: "Poor title formatting (too short, all caps, or spammy punctuation)"
comment: "Your post was filtered because the title is vague, all caps, or uses excessive punctuation. Please use a descriptive title."
---`
  }
];

function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();
  const [nodes, setNodes, _onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, _onEdgesChange] = useEdgesState<Edge>([]);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<FlowSnapshot[]>([]);
  const redoRef = useRef<FlowSnapshot[]>([]);
  const clipboardRef = useRef<ClipboardSelection | null>(null);
  const pasteCountRef = useRef(0);
  const isRestoringRef = useRef(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const refreshHistoryCounters = useCallback(() => {
    setUndoCount(historyRef.current.length);
    setRedoCount(redoRef.current.length);
  }, []);

  const pushHistorySnapshot = useCallback(() => {
    if (isRestoringRef.current) {
      return;
    }

    historyRef.current.push(cloneFlowState(getNodes(), getEdges()));
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    redoRef.current = [];
    refreshHistoryCounters();
  }, [getEdges, getNodes, refreshHistoryCounters]);

  const restoreSnapshot = useCallback(
    (snapshot: FlowSnapshot) => {
      isRestoringRef.current = true;
      const cloned = cloneFlowState(snapshot.nodes, snapshot.edges);
      setNodes(cloned.nodes);
      setEdges(cloned.edges);
      isRestoringRef.current = false;
    },
    [setEdges, setNodes]
  );

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) {
      showToast('Nothing to undo.', 'info');
      return;
    }

    const current = cloneFlowState(getNodes(), getEdges());
    const previous = historyRef.current.pop();
    if (!previous) {
      return;
    }
    redoRef.current.push(current);
    restoreSnapshot(previous);
    setDirty(true);
    refreshHistoryCounters();
    showToast('Undid last edit', 'info');
  }, [getEdges, getNodes, refreshHistoryCounters, restoreSnapshot, showToast]);

  const handleRedo = useCallback(() => {
    if (redoRef.current.length === 0) {
      showToast('Nothing to redo.', 'info');
      return;
    }

    const current = cloneFlowState(getNodes(), getEdges());
    const next = redoRef.current.pop();
    if (!next) {
      return;
    }
    historyRef.current.push(current);
    restoreSnapshot(next);
    setDirty(true);
    refreshHistoryCounters();
    showToast('Redid edit', 'info');
  }, [getEdges, getNodes, refreshHistoryCounters, restoreSnapshot, showToast]);

  const hasMeaningfulNodeChange = useCallback(
    (changes: NodeChange[]) =>
      changes.some(
        (change) =>
          change.type === 'add' || change.type === 'remove' || change.type === 'replace'
      ),
    []
  );

  const hasMeaningfulEdgeChange = useCallback(
    (changes: EdgeChange[]) =>
      changes.some(
        (change) =>
          change.type === 'add' || change.type === 'remove' || change.type === 'replace'
      ),
    []
  );

  // Track unsaved changes, but ignore pure node movement/selection changes.
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (hasMeaningfulNodeChange(changes)) {
        pushHistorySnapshot();
        setDirty(true);
      }
      _onNodesChange(changes);
    },
    [_onNodesChange, hasMeaningfulNodeChange, pushHistorySnapshot]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (hasMeaningfulEdgeChange(changes)) {
        pushHistorySnapshot();
        setDirty(true);
      }
      _onEdgesChange(changes);
    },
    [_onEdgesChange, hasMeaningfulEdgeChange, pushHistorySnapshot]
  );
  const [yamlInput, setYamlInput] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadedRuleCount, setLoadedRuleCount] = useState(0);
  const [wikiExists, setWikiExists] = useState(true);

  // Confirmation state
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const applyYamlToCanvas = useCallback(
    (yaml: string, append: boolean = false) => {
      if (!append) {
        historyRef.current = [];
        redoRef.current = [];
        refreshHistoryCounters();
        setDirty(false);
      }
      if (!yaml.trim()) {
        if (!append) {
          setNodes([]);
          setEdges([]);
          setLoadedRuleCount(0);
        }
        return 0;
      }

      let rules;
      try {
        rules = yamlToState(yaml);
      } catch (e) {
        showToast((e as Error).message, 'error');
        return 0;
      }

      if (rules.length === 0) {
        if (!append) {
          setNodes([]);
          setEdges([]);
          setLoadedRuleCount(0);
        }
        return 0;
      }

      if (append) {
        pushHistorySnapshot();
        const currentNodes = getNodes();
        let maxRuleIdx = -1;
        let maxY = 0;

        currentNodes.forEach((node) => {
          const match = node.id.match(/^rule-(\d+)-(?:cond|action)-\d+/);
          if (match && match[1]) {
            const idx = parseInt(match[1], 10);
            if (idx > maxRuleIdx) {
              maxRuleIdx = idx;
            }
          }
          if (node.position.y > maxY) {
            maxY = node.position.y;
          }
        });

        const nextRuleIdx = maxRuleIdx + 1;
        const nextYOffset = maxY > 0 ? maxY + 300 : 0;

        const { nodes: newNodes, edges: newEdges } = generateNodesFromRules(
          rules,
          nextRuleIdx,
          nextYOffset
        );

        setNodes((prevNodes) => [...prevNodes, ...newNodes]);
        setEdges((prevEdges) => [...prevEdges, ...newEdges]);
        setLoadedRuleCount((prevCount) => prevCount + rules.length);
        setDirty(true);
      } else {
        const { nodes: newNodes, edges: newEdges } = generateNodesFromRules(rules);
        setNodes(newNodes);
        setEdges(newEdges);
        setLoadedRuleCount(rules.length);
      }

      return rules.length;
    },
    [setNodes, setEdges, getNodes, pushHistorySnapshot, refreshHistoryCounters]
  );

  const loadWikiConfig = useCallback(async () => {
    if (!subredditName) {
      setIsLoadingConfig(false);
      showToast('Subreddit context was not available.', 'error');
      return;
    }

    setIsLoadingConfig(true);

    try {
      const response = await fetch(
        `/api/automod-config?subredditName=${encodeURIComponent(subredditName)}`
      );
      const body = (await response.json().catch(() => ({}))) as AutomodConfigResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? `Failed to load config (${response.status})`);
      }

      setWikiExists(body.wikiExists);
      const count = applyYamlToCanvas(body.yaml);

      if (!body.wikiExists) {
        showToast(
          `No wiki/${body.wikiPage} page yet. Drag nodes from the left, then Save to Wiki — we will create it for AutoModerator.`,
          'info'
        );
      } else if (count > 0) {
        showToast(
          `Loaded ${count} existing rule(s) from wiki/${body.wikiPage}`,
          'success'
        );
      } else {
        showToast(
          `Wiki/${body.wikiPage} exists but is empty. Build rules here or Import YAML.`,
          'info'
        );
      }
    } catch (error) {
      console.error('Load wiki config error:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to load AutoModerator config',
        'error'
      );
    } finally {
      setIsLoadingConfig(false);
    }
  }, [applyYamlToCanvas, showToast]);

  useEffect(() => {
    let isMounted = true;
    void Promise.resolve().then(() => {
      if (isMounted) {
        void loadWikiConfig();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [loadWikiConfig]);

  // (Removed duplicate handleNodesChange here)

  const onConnect = useCallback(
    (connection: Connection) => {
      pushHistorySnapshot();
      setEdges((eds) => addEdge(connection, eds));
      setDirty(true);
      showToast('Connected nodes', 'info');
    },
    [pushHistorySnapshot, setEdges, showToast]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) return;

      const data = event.dataTransfer.getData('application/reactflow');
      if (!data) return;

      const type = data as 'condition' | 'action';

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node =
        type === 'condition'
          ? {
              id: `condition-${Date.now()}`,
              type: 'condition',
              position,
              data: {
                target: '',
                modifier: 'includes',
                negated: false,
                value: [],
              },
            }
          : {
              id: `action-${Date.now()}`,
              type: 'action',
              position,
              data: {
                actionType: '',
                value: '',
              },
            };

      pushHistorySnapshot();
      setNodes((nds) => [...nds, newNode]);
      setDirty(true);
      showToast(`Added ${type} node`, 'success');
    },
    [pushHistorySnapshot, screenToFlowPosition, setNodes, showToast]
  );

  const handleImportYAML = () => {
    try {
      if (!yamlInput.trim()) {
        showToast('Please paste YAML content', 'error');
        return;
      }

      const count = applyYamlToCanvas(yamlInput, true);
      if (count === 0) {
        showToast('Failed to parse YAML. Check the format and try again.', 'error');
        return;
      }

      setShowImportModal(false);
      setYamlInput('');
      showToast(`Imported ${count} rule(s) onto the canvas`, 'success');
    } catch (error) {
      console.error('Import YAML error:', error);
      showToast(
        `Error importing YAML: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
    }
  };

  const handleSaveRules = async () => {
    if (!subredditName) {
      showToast('Subreddit context was not available.', 'error');
      return;
    }

    if (nodes.length === 0) {
      showToast('Cannot save an empty canvas. Add condition and action nodes first.', 'error');
      return;
    }

    const hasCondition = nodes.some(n => n.type === 'condition');
    const hasAction = nodes.some(n => n.type === 'action');
    if (!hasCondition || !hasAction) {
      showToast('Cannot save. Your canvas must contain both condition and action nodes.', 'error');
      return;
    }

    const hasEmptyCondition = nodes.some(n => n.type === 'condition' && (!n.data || !n.data.target));
    const hasEmptyAction = nodes.some(n => n.type === 'action' && (!n.data || !n.data.actionType));

    if (hasEmptyCondition) {
      showToast('Cannot save. One or more condition nodes have an empty target drop-down.', 'error');
      return;
    }

    if (hasEmptyAction) {
      showToast('Cannot save. One or more action nodes have an empty action drop-down.', 'error');
      return;
    }

    const yaml = generateAutomodYAML(nodes, edges);
    if (!yaml.trim()) {
      showToast('No valid rules to save. Please connect your condition and action nodes properly.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/automod-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subredditName, yaml }),
      });
      const body = (await response.json().catch(() => ({}))) as AutomodConfigResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? `Failed to save config (${response.status})`);
      }

      setWikiExists(true);
      setLoadedRuleCount(body.ruleCount);
      setDirty(false);
      historyRef.current = [];
      redoRef.current = [];
      refreshHistoryCounters();
      if (body.wikiCreated) {
        showToast(
          `Created wiki/${body.wikiPage} and saved ${body.ruleCount} rule(s). AutoModerator will use this config.`,
          'success'
        );
      } else {
        showToast(
          `Saved ${body.ruleCount} rule(s) to wiki/${body.wikiPage}`,
          'success'
        );
      }
    } catch (error) {
      console.error('Save rules error:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to save AutoModerator config',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyYAML = () => {
    try {
      console.log('Copy YAML triggered, nodes:', nodes);
      if (nodes.length === 0) {
        showToast('No rules to copy', 'error');
        return;
      }

      const yaml = generateAutomodYAML(nodes, edges);
      console.log('Generated YAML:', yaml);
      if (!yaml || yaml.trim() === '') {
        showToast('No valid rules to copy.', 'error');
        return;
      }

      // Copy to clipboard
      navigator.clipboard.writeText(yaml).then(() => {
        console.log('YAML copied to clipboard');
        showToast('YAML copied to clipboard!', 'success');
      }).catch((err) => {
        console.error('Clipboard error:', err);
        showToast(`Failed to copy: ${err}`, 'error');
      });
    } catch (error) {
      console.error('Copy YAML error:', error);
      showToast(`Error copying YAML: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleClearAll = useCallback(() => {
    console.log('Clear All triggered');
    setShowClearConfirm(true);
  }, []);

  const confirmClearAll = useCallback(() => {
    console.log('Clearing nodes and edges');
    pushHistorySnapshot();
    setNodes([]);
    setEdges([]);
    setDirty(true);
    setShowClearConfirm(false);
    showToast('Cleared all rules', 'info');
  }, [pushHistorySnapshot, setEdges, setNodes, showToast]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/reactflow', nodeType);
  };

  const handleCopySelection = useCallback(() => {
    const selectedNodes = getNodes().filter((node) => node.selected);
    if (selectedNodes.length === 0) {
      return false;
    }

    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
    const selectedEdges = getEdges().filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );

    clipboardRef.current = cloneFlowState(selectedNodes, selectedEdges);
    showToast(
      `Copied ${selectedNodes.length} node(s)${
        selectedEdges.length > 0 ? ` and ${selectedEdges.length} edge(s)` : ''
      }`,
      'info'
    );
    return true;
  }, [getEdges, getNodes, showToast]);

  const handlePasteSelection = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard || clipboard.nodes.length === 0) {
      return false;
    }

    pushHistorySnapshot();
    pasteCountRef.current += 1;
    const offset = 44 * pasteCountRef.current;
    const idMap = new Map<string, string>();

    const pastedNodes = clipboard.nodes.map((node, index) => {
      const newId = `${node.id}-copy-${Date.now()}-${index}`;
      idMap.set(node.id, newId);
      return {
        ...structuredClone(node),
        id: newId,
        selected: true,
        position: {
          x: node.position.x + offset,
          y: node.position.y + offset,
        },
      };
    });

    const pastedEdges = clipboard.edges.map((edge, index) => {
      const newSource = idMap.get(edge.source);
      const newTarget = idMap.get(edge.target);
      return {
        ...structuredClone(edge),
        id: `${edge.id}-copy-${Date.now()}-${index}`,
        source: newSource ?? edge.source,
        target: newTarget ?? edge.target,
        selected: false,
      };
    });

    setNodes((previousNodes) => {
      const clearedSelection = previousNodes.map((node) =>
        node.selected ? { ...node, selected: false } : node
      );
      return [...clearedSelection, ...pastedNodes];
    });
    setEdges((previousEdges) => {
      const clearedSelection = previousEdges.map((edge) =>
        edge.selected ? { ...edge, selected: false } : edge
      );
      return [...clearedSelection, ...pastedEdges];
    });
    setDirty(true);
    showToast(
      `Pasted ${pastedNodes.length} node(s)${
        pastedEdges.length > 0 ? ` and ${pastedEdges.length} edge(s)` : ''
      }`,
      'success'
    );
    return true;
  }, [pushHistorySnapshot, setEdges, setNodes, showToast]);

  const busy = isLoadingConfig || isSaving;
  const canUndo = undoCount > 0;
  const canRedo = redoCount > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (busy) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMetaOrCtrl = event.metaKey || event.ctrlKey;
      if (!isMetaOrCtrl) {
        return;
      }

      const key = event.key.toLowerCase();
      const isCopy = key === 'c' && !event.shiftKey;
      const isPaste = key === 'v' && !event.shiftKey;
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = (key === 'z' && event.shiftKey) || key === 'y';

      if (isCopy) {
        const copied = handleCopySelection();
        if (copied) {
          event.preventDefault();
        }
      }

      if (isPaste) {
        const pasted = handlePasteSelection();
        if (pasted) {
          event.preventDefault();
        }
      }

      if (isUndo && canUndo) {
        event.preventDefault();
        handleUndo();
      }

      if (isRedo && canRedo) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, canRedo, canUndo, handleCopySelection, handlePasteSelection, handleRedo, handleUndo]);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0f1117' }}>
      {/* ─── Sidebar ─── */}
      <div
        style={{
          width: '230px',
          background: '#151722',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto',
        }}
      >
        {/* Branding */}
        <div>
          <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: '#636983', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            r/{subredditName || '…'}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 style={{ margin: '0 0 2px 0', fontSize: '17px', fontWeight: 700, color: '#e4e6ef', letterSpacing: '-0.01em' }}>
              AutoMod<span style={{ color: '#6384ff' }}>Flow</span>
            </h2>
            {subredditName && (
              <a
                href={`https://reddit.com/r/${subredditName}/about/wiki/config/automoderator`}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '10px',
                  color: '#818cf8',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Wiki View <ExternalLinkIcon />
              </a>
            )}
          </div>
          <p style={{ margin: '0', fontSize: '11px', color: '#636983', lineHeight: 1.4 }}>
            {isLoadingConfig
              ? 'Loading config…'
              : wikiExists
                ? `${loadedRuleCount} rule(s) on wiki`
                : 'No wiki page yet'}
          </p>
          {!isLoadingConfig && !wikiExists && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px 10px',
                fontSize: '10px',
                lineHeight: 1.4,
                color: '#fb923c',
                background: 'rgba(251, 146, 60, 0.08)',
                borderRadius: '8px',
                border: '1px solid rgba(251, 146, 60, 0.15)',
              }}
            >
              Create rules below, then <strong>Save to Wiki</strong> to set up{' '}
              <code style={{ fontSize: '10px', color: '#fb923c' }}>config/automoderator</code>.
            </div>
          )}
        </div>

        {/* ─── Draggable Nodes ─── */}
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '10px', fontWeight: 600, color: '#636983', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Nodes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <DraggableNodeChip
              type="condition"
              icon={<FilterIcon />}
              label="Condition"
              color="#6384ff"
              bgColor="rgba(99, 132, 255, 0.08)"
              borderColor="rgba(99, 132, 255, 0.2)"
              onDragStart={handleDragStart}
            />
            <DraggableNodeChip
              type="action"
              icon={<ZapIcon />}
              label="Action"
              color="#a78bfa"
              bgColor="rgba(167, 139, 250, 0.08)"
              borderColor="rgba(167, 139, 250, 0.2)"
              onDragStart={handleDragStart}
            />
          </div>
        </div>

        {/* ─── Actions ─── */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px', position: 'relative' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '10px', fontWeight: 600, color: '#636983', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Actions
            {dirty && (
              <span style={{
                background: '#f87171',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                borderRadius: '6px',
                padding: '2px 8px',
                marginLeft: '8px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                boxShadow: '0 1px 4px 0 rgba(0,0,0,0.08)'
              }}>Unsaved</span>
            )}
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '12px',
          }}>
            <SidebarButton
              onClick={() => void handleSaveRules()}
              disabled={busy}
              icon={<SaveIcon />}
              label={isSaving ? 'Saving…' : 'Save'}
              accentColor="#34d399"
              accentSoft="rgba(52, 211, 153, 0.1)"
              square
            />
            <SidebarButton
              onClick={() => void loadWikiConfig()}
              disabled={busy}
              icon={<RefreshIcon />}
              label="Reload"
              accentColor="#9399b2"
              accentSoft="rgba(147, 153, 178, 0.08)"
              square
            />
            <SidebarButton
              onClick={handleCopyYAML}
              disabled={busy || nodes.length === 0}
              icon={<CopyIcon />}
              label="Copy"
              accentColor="#6384ff"
              accentSoft="rgba(99, 132, 255, 0.1)"
              square
            />
            <SidebarButton
              onClick={() => setShowImportModal(true)}
              disabled={busy}
              icon={<ImportIcon />}
              label="Import"
              accentColor="#fb923c"
              accentSoft="rgba(251, 146, 60, 0.1)"
              square
            />
            <SidebarButton
              onClick={() => setShowPresetsModal(true)}
              disabled={busy}
              icon={<ZapIcon />}
              label="Presets"
              accentColor="#818cf8"
              accentSoft="rgba(129, 140, 248, 0.1)"
              square
            />
            <SidebarButton
              onClick={() => {
                const yaml = generateAutomodYAML(nodes, edges);
                const rules = yamlToState(yaml);
                const { nodes: newNodes, edges: newEdges } = generateNodesFromRules(rules, 0, 0, false);
                setNodes(newNodes);
                setEdges(newEdges);
              }}
              disabled={busy || nodes.length === 0}
              icon={<AlignIcon />}
              label="Align Nodes"
              accentColor="#f472b6"
              accentSoft="rgba(244, 114, 182, 0.1)"
              square
            />
          </div>
        </div>

        {/* ─── Tips ─── */}
        <div style={{ fontSize: '10px', color: '#4a4e69', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px', marginTop: 'auto' }}>
          <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#636983', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Tips
          </p>
          <ul style={{ margin: 0, paddingLeft: '14px', lineHeight: '1.6', color: '#636983' }}>
            <li>Rules load from config/automoderator</li>
            <li>Drag nodes and connect conditions → actions</li>
            <li>Save writes back to the subreddit wiki</li>
            <li>Use Import for pasted YAML</li>
          </ul>
        </div>

        {/* ─── Clear All Button (moved down) ─── */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '10px', fontWeight: 600, color: '#636983', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            History
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
            }}
          >
            <SidebarButton
              onClick={handleUndo}
              disabled={busy || !canUndo}
              icon={<UndoIcon />}
              label="Undo"
              accentColor="#60a5fa"
              accentSoft="rgba(96, 165, 250, 0.1)"
              square
            />
            <SidebarButton
              onClick={handleRedo}
              disabled={busy || !canRedo}
              icon={<RedoIcon />}
              label="Redo"
              accentColor="#22d3ee"
              accentSoft="rgba(34, 211, 238, 0.1)"
              square
            />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <SidebarButton
            onClick={handleClearAll}
            disabled={busy || nodes.length === 0}
            icon={<TrashIcon />}
            label="Clear All"
            accentColor="#f87171"
            accentSoft="rgba(248, 113, 113, 0.1)"
          />
        </div>
      </div>

      {/* ─── Canvas ─── */}
      <div
        ref={reactFlowWrapper}
        style={{ flex: 1, position: 'relative' }}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {isLoadingConfig && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(15, 17, 23, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 10,
              gap: '12px',
            }}
          >
            <div className="loading-spinner" />
            <span style={{ fontSize: '13px', color: '#9399b2', fontWeight: 500 }}>
              Loading AutoModerator rules…
            </span>
          </div>
        )}
        {!isLoadingConfig && nodes.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 5,
              padding: '24px',
            }}
          >
            <div
              style={{
                maxWidth: '380px',
                textAlign: 'center',
                padding: '28px 32px',
                background: 'rgba(30, 32, 48, 0.8)',
                border: '2px dashed rgba(99, 132, 255, 0.2)',
                borderRadius: '16px',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'rgba(99, 132, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: '#6384ff',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <p
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#e4e6ef',
                }}
              >
                {wikiExists ? 'Empty canvas' : 'No AutoModerator config yet'}
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#636983', lineHeight: 1.6 }}>
                Drag <strong style={{ color: '#6384ff' }}>Condition</strong> and{' '}
                <strong style={{ color: '#a78bfa' }}>Action</strong> nodes from the sidebar
                onto this area. Connect them, then use{' '}
                <strong style={{ color: '#34d399' }}>Save to Wiki</strong>.
                {!wikiExists &&
                  ' That creates wiki/config/automoderator for your subreddit.'}
              </p>
            </div>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          selectionMode={SelectionMode.Partial}
          multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
          selectionKeyCode={['Meta', 'Control', 'Shift']}
          fitView
        >
          <Background color="rgba(99, 132, 255, 0.06)" gap={24} size={1} />
          <Controls />
          <MiniMap 
            nodeColor={(n) => n.type === 'condition' ? '#6384ff' : '#a78bfa'}
            maskColor="rgba(0, 0, 0, 0.5)"
            style={{ 
              backgroundColor: '#1e2030', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px'
            }}
          />
        </ReactFlow>
      </div>

      {/* ─── Import Modal ─── */}
      {showImportModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="modal-content"
            style={{
              background: '#1e2030',
              padding: '24px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
              maxWidth: '560px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#e4e6ef' }}>
                Import AutoMod YAML
              </h2>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#636983',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '6px',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#e4e6ef')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#636983')}
              >
                <XIcon />
              </button>
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#636983', lineHeight: 1.5 }}>
              Paste your AutoMod YAML configuration below. It will be converted to visual nodes.
            </p>
            <textarea
              value={yamlInput}
              onChange={(e) => setYamlInput(e.target.value)}
              placeholder="Paste your YAML here…"
              style={{
                width: '100%',
                minHeight: '260px',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
                fontSize: '12px',
                boxSizing: 'border-box',
                marginBottom: '16px',
                backgroundColor: 'rgba(15, 17, 23, 0.6)',
                color: '#e4e6ef',
                outline: 'none',
                resize: 'vertical',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(99, 132, 255, 0.4)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <ModalButton
                onClick={() => setShowImportModal(false)}
                label="Cancel"
                variant="secondary"
              />
              <ModalButton
                onClick={handleImportYAML}
                label="Import"
                variant="primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Presets Modal ─── */}
      {showPresetsModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowPresetsModal(false)}
        >
          <div
            className="modal-content"
            style={{
              background: '#1e2030',
              padding: '24px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#e4e6ef' }}>
                Preset Rules Gallery
              </h2>
              <button
                onClick={() => setShowPresetsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#636983',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '6px',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#e4e6ef')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#636983')}
              >
                <XIcon />
              </button>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#636983', lineHeight: 1.5 }}>
              Select a predefined popular rule to add to your canvas.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {PRESETS.map((preset, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    const count = applyYamlToCanvas(preset.yaml, true);
                    if (count > 0) {
                      showToast(`Imported ${preset.name} to the canvas`, 'success');
                      setShowPresetsModal(false);
                    } else {
                      showToast('Failed to load preset', 'error');
                    }
                  }}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(99, 132, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(99, 132, 255, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#e4e6ef' }}>{preset.name}</h3>
                  <p style={{ margin: 0, fontSize: '11px', color: '#9399b2' }}>{preset.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Clear Confirmation Modal ─── */}
      {showClearConfirm && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="modal-content"
            style={{
              background: '#1e2030',
              padding: '24px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
              maxWidth: '380px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px',
                background: 'rgba(248, 113, 113, 0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#f87171',
              }}>
                <TrashIcon />
              </div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#e4e6ef' }}>
                Clear Canvas?
              </h3>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#636983', lineHeight: '1.5' }}>
              Are you sure you want to clear all nodes and edges? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <ModalButton
                onClick={() => setShowClearConfirm(false)}
                label="Cancel"
                variant="secondary"
              />
              <ModalButton
                onClick={confirmClearAll}
                label="Clear All"
                variant="danger"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Toast Notification ─── */}
      {toast && (
        <div
          className="toast-enter"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background:
              toast.type === 'success'
                ? 'rgba(30, 32, 48, 0.95)'
                : toast.type === 'error'
                  ? 'rgba(30, 32, 48, 0.95)'
                  : 'rgba(30, 32, 48, 0.95)',
            color: '#e4e6ef',
            padding: '10px 16px',
            borderRadius: '10px',
            border: `1px solid ${toast.type === 'success' ? 'rgba(52, 211, 153, 0.3)' : toast.type === 'error' ? 'rgba(248, 113, 113, 0.3)' : 'rgba(99, 132, 255, 0.3)'}`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(12px)',
            zIndex: 2000,
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '400px',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              color:
                toast.type === 'success'
                  ? '#34d399'
                  : toast.type === 'error'
                    ? '#f87171'
                    : '#6384ff',
            }}
          >
            {toast.type === 'success' && <CheckIcon />}
            {toast.type === 'error' && <AlertIcon />}
            {toast.type === 'info' && <InfoIcon />}
          </span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Draggable Node Chip ─── */
type DraggableNodeChipProps = {
  type: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, nodeType: string) => void;
};

function DraggableNodeChip({ type, icon, label, color, bgColor, borderColor, onDragStart }: DraggableNodeChipProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, type)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '11px 14px',
        background: hovered ? bgColor : 'transparent',
        border: `1px solid ${hovered ? borderColor : 'rgba(255, 255, 255, 0.06)'}`,
        borderRadius: '10px',
        cursor: 'grab',
        fontSize: '13px',
        fontWeight: 600,
        color: hovered ? color : '#9399b2',
        userSelect: 'none',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateX(2px)' : 'none',
        minHeight: '44px',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', color: hovered ? color : '#636983', transition: 'color 0.2s ease' }}>
        {icon}
      </span>
      {label}
    </div>
  );
}

/* ─── Modal Button Component ─── */
type ModalButtonProps = {
  onClick: () => void;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
};

function ModalButton({ onClick, label, variant }: ModalButtonProps) {
  const [hovered, setHovered] = useState(false);

  const colors = {
    primary: { bg: 'rgba(99, 132, 255, 0.15)', hoverBg: 'rgba(99, 132, 255, 0.25)', text: '#6384ff', border: 'rgba(99, 132, 255, 0.2)' },
    secondary: { bg: 'rgba(255, 255, 255, 0.04)', hoverBg: 'rgba(255, 255, 255, 0.08)', text: '#9399b2', border: 'rgba(255, 255, 255, 0.08)' },
    danger: { bg: 'rgba(248, 113, 113, 0.15)', hoverBg: 'rgba(248, 113, 113, 0.25)', text: '#f87171', border: 'rgba(248, 113, 113, 0.2)' },
  };

  const c = colors[variant];

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 18px',
        background: hovered ? c.hoverBg : c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '12px',
        fontFamily: 'inherit',
        transition: 'all 0.2s ease',
      }}
    >
      {label}
    </button>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
