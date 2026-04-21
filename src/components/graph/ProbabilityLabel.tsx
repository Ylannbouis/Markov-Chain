import { useState, useRef, useEffect } from 'react';

interface Props {
  value: number;
  x: number;
  y: number;
  darkMode: boolean;
  onCommit: (v: number) => void;
}

export function ProbabilityLabel({ value, x, y, darkMode, onCommit }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    setDraft((Math.round(value * 100) / 100).toFixed(2));
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) onCommit(parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <foreignObject x={x - 24} y={y - 12} width={48} height={24}>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className={`w-full h-full text-center text-xs border rounded outline-none px-1
            ${darkMode
              ? 'bg-gray-800 text-white border-gray-600'
              : 'bg-white text-gray-900 border-gray-300'
            }`}
          style={{ font: '11px system-ui' }}
        />
      </foreignObject>
    );
  }

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={11}
      className="cursor-pointer select-none"
      fill={darkMode ? '#a78bfa' : '#7c3aed'}
      onClick={start}
    >
      {value.toFixed(2)}
    </text>
  );
}
