import { Handle, Position, useReactFlow } from '@xyflow/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NormalizedAction } from '../utils/yamlCompiler';

export type ActionNodeData = NormalizedAction & {
  nodeId?: string;
};

type ActionOption = {
  label: string;
  value: string;
  subValue: string;
};

type DropdownOption = {
  label: string;
  value: string;
};

const ACTION_OPTIONS: ActionOption[] = [
  { label: 'Remove', value: 'action', subValue: 'remove' },
  { label: 'Spam', value: 'action', subValue: 'spam' },
  { label: 'Approve', value: 'action', subValue: 'approve' },
  { label: 'Filter', value: 'action', subValue: 'filter' },
  { label: 'Report', value: 'action', subValue: 'report' },
  { label: 'Set Locked', value: 'set_locked', subValue: 'true' },
  { label: 'Set Sticky', value: 'set_sticky', subValue: 'true' },
  { label: 'Set NSFW', value: 'set_nsfw', subValue: 'true' },
  { label: 'Set Spoiler', value: 'set_spoiler', subValue: 'true' },
  { label: 'Send Comment', value: 'comment', subValue: '' },
  { label: 'Send Message', value: 'message', subValue: '' },
  { label: 'Send Modmail', value: 'modmail', subValue: '' },
  { label: 'Set Flair', value: 'set_flair', subValue: '' },
  { label: 'Overwrite Flair', value: 'overwrite_flair', subValue: '' },
];

const ACTION_DROPDOWN_OPTIONS: DropdownOption[] = ACTION_OPTIONS.map((option) => ({
  label: option.label,
  value: option.label,
}));

type ActionNodeProps = {
  data: ActionNodeData;
  id: string;
};

type NodeDropdownProps = {
  value: string;
  options: DropdownOption[];
  placeholder: string;
  onChange: (nextValue: string) => void;
};

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function NodeDropdown({ value, options, placeholder, onChange }: NodeDropdownProps): React.ReactNode {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? placeholder;

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      if (!container.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocMouseDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="nodrag nopan nowheel"
      style={{ position: 'relative', width: '100%' }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="nodrag nopan nowheel"
        onClick={() => setOpen((prev) => !prev)}
        onBlur={() => {
          // Delay closing to allow clicks on options to register
          setTimeout(() => setOpen(false), 150);
        }}
        style={{
          width: '100%',
          minHeight: '32px',
          padding: '6px 10px',
          borderRadius: '8px',
          border: open
            ? '1px solid rgba(167, 139, 250, 0.5)'
            : '1px solid rgba(167, 139, 250, 0.2)',
          background: 'rgba(15, 17, 23, 0.72)',
          color: value ? '#e4e6ef' : '#8b92b1',
          fontSize: '11px',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: open ? '0 0 0 2px rgba(167, 139, 250, 0.14)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <span style={{ color: '#8d81b8', display: 'flex', flexShrink: 0, marginLeft: '8px' }}>
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div
          className="nodrag nopan nowheel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 50,
            borderRadius: '8px',
            border: '1px solid rgba(167, 139, 250, 0.26)',
            background: 'rgba(17, 20, 31, 0.98)',
            boxShadow: '0 14px 40px rgba(0, 0, 0, 0.45)',
            overflow: 'hidden',
          }}
        >
          <div className="nodrag nopan nowheel" style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className="nodrag nopan nowheel"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: selected ? 'rgba(167, 139, 250, 0.26)' : 'transparent',
                    color: selected ? '#efe7ff' : '#d3c8ff',
                    fontSize: '11px',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid rgba(167, 139, 250, 0.2)',
  fontSize: '11px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  backgroundColor: 'rgba(15, 17, 23, 0.6)',
  color: '#e4e6ef',
  outline: 'none',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: '48px',
  resize: 'vertical',
};

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: '#9399b2',
  letterSpacing: '0.03em',
  marginBottom: '3px',
  display: 'block',
  textTransform: 'uppercase',
};

export function ActionNode({ data, id }: ActionNodeProps): React.ReactNode {
  const { deleteElements, updateNodeData, getNodes } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  const [deleteHovered, setDeleteHovered] = useState(false);

  const handleDelete = useCallback(() => {
    const nodes = getNodes();
    const currentNode = nodes.find((n) => n.id === id);
    if (currentNode?.selected) {
      const selectedNodes = nodes.filter((n) => n.selected);
      void deleteElements({ nodes: selectedNodes });
    } else {
      void deleteElements({ nodes: [{ id }] });
    }
  }, [id, deleteElements, getNodes]);

  const handleActionTypeChange = useCallback((selectedLabel: string) => {
    const selectedOption = ACTION_OPTIONS.find((option) => option.label === selectedLabel);
    if (selectedOption) {
      updateNodeData(id, {
        actionType: selectedOption.value,
        value: selectedOption.subValue,
      });
    }
  }, [id, updateNodeData]);

  const handleValueChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { value: event.target.value });
  }, [id, updateNodeData]);

  const handleReasonChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { reason: event.target.value });
  }, [id, updateNodeData]);

  const selectedLabel =
    ACTION_OPTIONS.find((option) => option.value === data.actionType && option.subValue === data.value)?.label ||
    ACTION_OPTIONS.find((option) => option.value === data.actionType && option.value !== 'action')?.label ||
    '';
  const isTextAction = ['comment', 'message', 'modmail', 'set_flair', 'overwrite_flair'].includes(
    data.actionType
  );
  const valueString = typeof data.value === 'string' ? data.value : '';

  return (
    <div
      className="node-pop-in"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(30, 28, 42, 0.95), rgba(28, 24, 40, 0.98))',
        border: isHovered
          ? '1px solid rgba(167, 139, 250, 0.45)'
          : '1px solid rgba(167, 139, 250, 0.15)',
        minWidth: '240px',
        maxWidth: '260px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: isHovered
          ? '0 4px 24px rgba(167, 139, 250, 0.12), 0 0 0 1px rgba(167, 139, 250, 0.08)'
          : '0 2px 12px rgba(0, 0, 0, 0.3)',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease',
        transform: isHovered ? 'translateY(-1px)' : 'none',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '5px',
              background: 'rgba(167, 139, 250, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a78bfa',
            }}
          >
            <ZapIcon />
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#a78bfa',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Action
          </span>
        </div>
        <button
          onClick={handleDelete}
          onMouseEnter={() => setDeleteHovered(true)}
          onMouseLeave={() => setDeleteHovered(false)}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: 'none',
            background: deleteHovered ? 'rgba(248, 113, 113, 0.2)' : 'transparent',
            color: deleteHovered ? '#f87171' : '#636983',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            padding: 0,
          }}
          title="Delete node"
        >
          <TrashIcon />
        </button>
      </div>

      <div style={{ marginBottom: '6px' }}>
        <label style={labelStyle}>Action</label>
        <NodeDropdown
          value={selectedLabel}
          options={ACTION_DROPDOWN_OPTIONS}
          placeholder="Select action..."
          onChange={handleActionTypeChange}
        />
      </div>

      {isTextAction && (
        <div style={{ marginBottom: '6px' }}>
          <label style={labelStyle}>
            {data.actionType === 'comment' ? 'Comment Text' : 'Message/Content'}
          </label>
          <textarea
            className="nodrag nopan"
            value={valueString}
            onChange={handleValueChange}
            placeholder="Enter text content..."
            style={textareaStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.5)';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      )}

      {data.actionType === 'action' && (
        <div style={{ marginBottom: '6px' }}>
          <label style={labelStyle}>
            Reason (optional)
          </label>
          <input
            className="nodrag nopan"
            type="text"
            value={data.reason || ''}
            onChange={handleReasonChange}
            placeholder="Enter reason..."
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.5)';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(167, 139, 250, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      )}

      <Handle type="target" position={Position.Left} />
    </div>
  );
}
