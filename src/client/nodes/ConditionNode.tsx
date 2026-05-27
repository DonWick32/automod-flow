import { Handle, Position, useReactFlow } from '@xyflow/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NormalizedCondition } from '../utils/yamlCompiler';

export type ConditionNodeData = NormalizedCondition & {
  nodeId?: string;
};

type DropdownOption = {
  label: string;
  value: string;
};

const TARGET_OPTIONS: DropdownOption[] = [
  { label: 'Title', value: 'title' },
  { label: 'Body', value: 'body' },
  { label: 'Domain', value: 'domain' },
  { label: 'URL', value: 'url' },
  { label: 'Flair Text', value: 'flair_text' },
  { label: 'Flair CSS', value: 'flair_css_class' },
  { label: 'Flair Template ID', value: 'flair_template_id' },
  { label: 'Reports', value: 'reports' },
  { label: 'ID', value: 'id' },
  { label: 'Post Type', value: 'type' },
  { label: 'Author Name', value: 'author.name' },
  { label: 'Author Is Gold', value: 'author.is_gold' },
  { label: 'Author Is Submitter', value: 'author.is_submitter' },
  { label: 'Author Is Contributor', value: 'author.is_contributor' },
  { label: 'Author Is Moderator', value: 'author.is_moderator' },
  { label: 'Author Has Verified Email', value: 'author.has_verified_email' },
  { label: 'Author Satisfy Any Threshold', value: 'author.satisfy_any_threshold' },
  { label: 'Author Account Age', value: 'author.account_age' },
  { label: 'Author Post Karma', value: 'author.post_karma' },
  { label: 'Author Comment Karma', value: 'author.comment_karma' },
  { label: 'Author Combined Karma', value: 'author.combined_karma' },
  { label: 'Author Post Subreddit Karma', value: 'author.post_subreddit_karma' },
  { label: 'Author Comment Subreddit Karma', value: 'author.comment_subreddit_karma' },
];

const MODIFIER_OPTIONS: DropdownOption[] = [
  { label: 'Includes (default)', value: 'includes' },
  { label: 'Includes Word', value: 'includes-word' },
  { label: 'Match', value: 'match' },
  { label: 'Starts With', value: 'starts-with' },
  { label: 'Ends With', value: 'ends-with' },
  { label: 'Regex', value: 'regex' },
  { label: 'Case Sensitive', value: 'case-sensitive' },
];

const BOOLEAN_OPTIONS: DropdownOption[] = [
  { label: 'True', value: 'true' },
  { label: 'False', value: 'false' },
];

const TYPE_OPTIONS: DropdownOption[] = [
  { label: 'Any (default)', value: 'any' },
  { label: 'Comment', value: 'comment' },
  { label: 'Submission', value: 'submission' },
  { label: 'Text Submission', value: 'text submission' },
  { label: 'Link Submission', value: 'link submission' },
  { label: 'Crosspost Submission', value: 'crosspost submission' },
  { label: 'Poll Submission', value: 'poll submission' },
  { label: 'Gallery Submission', value: 'gallery submission' },
];

const THRESHOLD_OPERATOR_OPTIONS: DropdownOption[] = [
  { label: 'Less Than (<)', value: '<' },
  { label: 'Greater Than (>)', value: '>' },
  { label: 'Equal To (=)', value: '=' },
];

const ACCOUNT_AGE_UNITS: DropdownOption[] = [
  { label: 'Minutes', value: 'minutes' },
  { label: 'Hours', value: 'hours' },
  { label: 'Days', value: 'days' },
  { label: 'Weeks', value: 'weeks' },
  { label: 'Months', value: 'months' },
  { label: 'Years', value: 'years' },
];

type ConditionNodeProps = {
  data: ConditionNodeData;
  id: string;
};

type NodeDropdownProps = {
  value: string;
  options: DropdownOption[];
  placeholder: string;
  onChange: (nextValue: string) => void;
};

const BOOLEAN_TARGETS = [
  'author.is_gold',
  'author.is_submitter',
  'author.is_contributor',
  'author.is_moderator',
  'author.has_verified_email',
  'author.satisfy_any_threshold',
];

const THRESHOLD_TARGETS = [
  'author.account_age',
  'author.post_karma',
  'author.comment_karma',
  'author.combined_karma',
  'author.post_subreddit_karma',
  'author.comment_subreddit_karma',
  'reports',
];

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
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
            ? '1px solid rgba(99, 132, 255, 0.5)'
            : '1px solid rgba(99, 132, 255, 0.2)',
          background: 'rgba(15, 17, 23, 0.72)',
          color: value ? '#e4e6ef' : '#8b92b1',
          fontSize: '11px',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: open ? '0 0 0 2px rgba(99, 132, 255, 0.14)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <span style={{ color: '#7f87ab', display: 'flex', flexShrink: 0, marginLeft: '8px' }}>
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
            border: '1px solid rgba(99, 132, 255, 0.26)',
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
                    background: selected ? 'rgba(99, 132, 255, 0.26)' : 'transparent',
                    color: selected ? '#dbe8ff' : '#c2c9e4',
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
  border: '1px solid rgba(99, 132, 255, 0.2)',
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

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: '#9399b2',
  letterSpacing: '0.03em',
  marginBottom: '3px',
  display: 'block',
  textTransform: 'uppercase',
};

export function ConditionNode({ data, id }: ConditionNodeProps): React.ReactNode {
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

  const handleNegateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { negated: event.target.checked });
  }, [id, updateNodeData]);

  const handleValueChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target.value;
    const newValue = input.includes(',')
      ? input.split(',').map((token) => token.trim())
      : [input];
    updateNodeData(id, { value: newValue });
  }, [id, updateNodeData]);

  const valueString = Array.isArray(data.value) ? data.value.join(', ') : data.value || '';
  const valueBadges = useMemo(() => {
    if (!Array.isArray(data.value)) {
      if (typeof data.value !== 'string') {
        return [];
      }
      const singleValue = data.value.trim();
      return singleValue ? [singleValue] : [];
    }
    return data.value.map((value) => value.trim()).filter((value) => value.length > 0);
  }, [data.value]);

  const isBooleanTarget = data.target ? BOOLEAN_TARGETS.includes(data.target) : false;
  const isThresholdTarget = data.target ? THRESHOLD_TARGETS.includes(data.target) : false;
  const isTypeTarget = data.target === 'type';
  const showModifierAndNegate = !isBooleanTarget && !isThresholdTarget && !isTypeTarget;
  const isAccountAge = data.target === 'author.account_age';

  let thresholdOp = '<';
  let thresholdVal = '';
  let thresholdUnit = 'days';

  if (isThresholdTarget) {
    const match = valueString.match(/^([<>=])?\s*([\d.]+)\s*(minutes|hours|days|weeks|months|years)?$/i);
    if (match) {
      if (match[1]) thresholdOp = match[1];
      if (match[2]) thresholdVal = match[2];
      if (match[3]) thresholdUnit = match[3].toLowerCase();
    } else {
      thresholdVal = valueString.replace(/^[<>=]\s*/, '').trim();
      if (valueString.startsWith('>')) thresholdOp = '>';
      else if (valueString.startsWith('=')) thresholdOp = '=';
    }
  }

  const updateThreshold = (op: string, val: string, unit: string) => {
    let formatted = `${op} ${val}`;
    if (isAccountAge) {
      formatted = `${op} ${val} ${unit}`;
    }
    updateNodeData(id, { value: [formatted] });
  };

  return (
    <div
      className="node-pop-in"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(30, 32, 48, 0.95), rgba(25, 27, 42, 0.98))',
        border: isHovered
          ? '1px solid rgba(99, 132, 255, 0.45)'
          : '1px solid rgba(99, 132, 255, 0.15)',
        minWidth: '240px',
        maxWidth: '260px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: isHovered
          ? '0 4px 24px rgba(99, 132, 255, 0.12), 0 0 0 1px rgba(99, 132, 255, 0.08)'
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
              background: 'rgba(99, 132, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6384ff',
            }}
          >
            <FilterIcon />
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#6384ff',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Condition
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
        <label style={labelStyle}>Target</label>
        <NodeDropdown
          value={data.target || ''}
          options={TARGET_OPTIONS}
          placeholder="Select target..."
          onChange={(nextValue) => updateNodeData(id, { target: nextValue })}
        />
      </div>

      {showModifierAndNegate && (
        <div style={{ marginBottom: '8px' }}>
          <label style={labelStyle}>Modifier</label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <NodeDropdown
              value={data.modifier || 'includes'}
              options={MODIFIER_OPTIONS}
              placeholder="Select modifier..."
              onChange={(nextValue) => updateNodeData(id, { modifier: nextValue })}
            />
            <button
              className="nodrag nopan"
              type="button"
              onClick={() => updateNodeData(id, { negated: !data.negated })}
              title="Negate (~)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                background: data.negated ? 'rgba(244, 63, 94, 0.15)' : 'rgba(15, 17, 23, 0.72)',
                border: data.negated 
                  ? '1px solid rgba(244, 63, 94, 0.4)' 
                  : '1px solid rgba(99, 132, 255, 0.2)',
                color: data.negated ? '#f43f5e' : '#636983',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              Negate (~)
            </button>
          </div>
        </div>
      )}

      <div>
        <label style={labelStyle}>Value</label>
        {isBooleanTarget ? (
          <NodeDropdown
            value={valueString === 'false' ? 'false' : 'true'}
            options={BOOLEAN_OPTIONS}
            placeholder="Select value..."
            onChange={(nextValue) => updateNodeData(id, { value: [nextValue] })}
          />
        ) : isTypeTarget ? (
          <NodeDropdown
            value={valueString || 'any'}
            options={TYPE_OPTIONS}
            placeholder="Select post type..."
            onChange={(nextValue) => updateNodeData(id, { value: [nextValue] })}
          />
        ) : isThresholdTarget ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ flex: '0 0 100px' }}>
                <NodeDropdown
                  value={thresholdOp}
                  options={THRESHOLD_OPERATOR_OPTIONS}
                  placeholder="Operator"
                  onChange={(nextValue) => updateThreshold(nextValue, thresholdVal, thresholdUnit)}
                />
              </div>
              <input
                className="nodrag nopan"
                type="number"
                value={thresholdVal}
                onChange={(e) => updateThreshold(thresholdOp, e.target.value, thresholdUnit)}
                placeholder="Value"
                style={{ ...inputStyle, flex: 1 }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(99, 132, 255, 0.5)';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 132, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(99, 132, 255, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
            {isAccountAge && (
              <NodeDropdown
                value={thresholdUnit}
                options={ACCOUNT_AGE_UNITS}
                placeholder="Unit"
                onChange={(nextValue) => updateThreshold(thresholdOp, thresholdVal, nextValue)}
              />
            )}
          </div>
        ) : (
          <input
            className="nodrag nopan"
            type="text"
            value={valueString}
            onChange={handleValueChange}
            placeholder={isThresholdTarget ? 'e.g. < 10, > 7 days' : 'Value (comma-sep)'}
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(99, 132, 255, 0.5)';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 132, 255, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(99, 132, 255, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        )}
      </div>

      {!isBooleanTarget && !isThresholdTarget && valueBadges.length > 0 && (
        <div
          className="nodrag nopan"
          style={{
            marginTop: '8px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          {valueBadges.map((token, index) => (
            <span
              key={`${token}-${index}`}
              title={token}
              style={{
                fontSize: '10px',
                color: '#c7d3ff',
                background: 'rgba(99, 132, 255, 0.18)',
                border: '1px solid rgba(99, 132, 255, 0.28)',
                borderRadius: '999px',
                padding: '3px 8px',
                lineHeight: 1.2,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                boxSizing: 'border-box',
              }}
            >
              {token}
            </span>
          ))}
        </div>
      )}

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
