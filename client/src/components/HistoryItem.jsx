import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

function formatDate(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  );
}

export default function HistoryItem({
  entry,
  isSelected,
  onSelect,
  onRename,
  onViewJD,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entry.jdName);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const inputRef = useRef(null);
  const summaryRef = useRef(null);

  useEffect(() => {
    setName(entry.jdName);
  }, [entry.jdName]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== entry.jdName) {
      onRename(trimmed);
    } else {
      setName(entry.jdName);
    }
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') {
      setName(entry.jdName);
      setEditing(false);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm('确定删除该记录？')) {
      onDelete();
    }
  };

  return (
    <div
      className={`history-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <div className="history-item-main">
        {editing ? (
          <input
            ref={inputRef}
            className="history-item-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="history-item-title">{entry.jdName}</div>
        )}
        <div className="history-item-date">{formatDate(entry.createdAt)}</div>
        <div
          className="history-item-summary"
          ref={summaryRef}
          onMouseEnter={() => {
            if (summaryRef.current) {
              const rect = summaryRef.current.getBoundingClientRect();
              setTooltipPos({ top: rect.bottom + 8, left: rect.left });
            }
            setTooltipVisible(true);
          }}
          onMouseLeave={() => setTooltipVisible(false)}
        >
          {entry.matchSummary}
        </div>
      </div>

      {tooltipVisible &&
        createPortal(
          <div className="summary-tooltip" style={{ top: tooltipPos.top, left: tooltipPos.left }}>
            {entry.fullResult?.matchResult?.overall_summary || entry.matchSummary}
          </div>,
          document.body
        )}

      <div className="history-item-actions">
        <button
          className="history-item-action-btn"
          title="查看 JD 原文"
          onClick={(e) => {
            e.stopPropagation();
            onViewJD();
          }}
        >
          {'👁'}
        </button>
        <button
          className="history-item-action-btn"
          title="重命名"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {'✎'}
        </button>
        <button
          className="history-item-action-btn history-item-delete-btn"
          title="删除"
          onClick={handleDelete}
        >
          ×
        </button>
      </div>
    </div>
  );
}
