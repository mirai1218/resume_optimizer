import React, { useState, useRef, useEffect } from 'react';
import HistoryItem from './HistoryItem.jsx';

function ProfileMenu({ onRename, onDelete, onEditResume, onBatchDelete, onNewAnalysis }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <div className="profile-menu-wrap" ref={menuRef}>
      <button
        className="profile-menu-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="更多操作"
      >
        {'···'}
      </button>
      {open && (
        <div className="profile-menu-dropdown">
          <button
            className="profile-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              const name = window.prompt('重命名简历档案：');
              if (name && name.trim()) onRename(name.trim());
            }}
          >
            重命名
          </button>
          <button
            className="profile-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onNewAnalysis();
            }}
          >
            新增岗位描述
          </button>
          <button
            className="profile-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onEditResume();
            }}
          >
            编辑原文
          </button>
          <button
            className="profile-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onBatchDelete();
            }}
          >
            批量删除
          </button>
          <button
            className="profile-menu-item danger"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              if (window.confirm('确定删除该简历档案及其所有分析记录？')) {
                onDelete();
              }
            }}
          >
            删除档案
          </button>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  profiles,
  activeProfileId,
  selectedEntryId,
  expandedProfiles,
  onToggleProfile,
  onSelectProfile,
  onSelectEntry,
  onNewProfile,
  onRenameProfile,
  onDeleteProfile,
  onRenameEntry,
  onViewJD,
  onDeleteEntry,
  onEditResume,
  onDeleteEntries,
  onNewAnalysis,
  isOpen,
}) {
  const [selectingProfileId, setSelectingProfileId] = useState(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState(new Set());

  const exitSelectMode = () => {
    setSelectingProfileId(null);
    setSelectedEntryIds(new Set());
  };

  const toggleEntrySelection = (entryId) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const toggleSelectAll = (profile) => {
    const allIds = profile.entries.map((e) => e.id);
    setSelectedEntryIds((prev) => {
      if (prev.size === allIds.length) {
        return new Set();
      }
      return new Set(allIds);
    });
  };

  const handleBatchDelete = () => {
    if (selectedEntryIds.size === 0) return;
    if (!window.confirm(`确定删除选中的 ${selectedEntryIds.size} 条分析记录？`)) return;
    onDeleteEntries(selectingProfileId, [...selectedEntryIds]);
    exitSelectMode();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <button className="new-analysis-btn new-profile-btn" onClick={onNewProfile}>
        <span className="new-analysis-icon">{'+'}</span>
        上传新简历
      </button>

      <div className="sidebar-divider" />

      <div className="sidebar-history">
        {profiles.length === 0 ? (
          <div className="empty-history">
            <div className="empty-history-icon">{'📋'}</div>
            <p className="empty-history-text">暂无简历档案</p>
            <p className="empty-history-hint">上传简历开始分析</p>
          </div>
        ) : (
          profiles.map((profile) => {
            const expanded = expandedProfiles.has(profile.id);
            const isActive = profile.id === activeProfileId;
            const isSelecting = selectingProfileId === profile.id;
            return (
              <div key={profile.id} className={`profile-group ${isActive ? 'active' : ''}`}>
                <div
                  className="profile-header"
                  onClick={() => {
                    onToggleProfile(profile.id);
                    onSelectProfile(profile.id);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onToggleProfile(profile.id);
                      onSelectProfile(profile.id);
                    }
                  }}
                >
                  <span className={`profile-arrow ${expanded ? 'expanded' : ''}`}>
                    {'▶'}
                  </span>
                  <span className="profile-name">{profile.name}</span>
                  <span className="profile-count">{profile.entries.length}</span>
                  <ProfileMenu
                    onRename={(name) => onRenameProfile(profile.id, name)}
                    onDelete={() => onDeleteProfile(profile.id)}
                    onEditResume={() => onEditResume(profile)}
                    onBatchDelete={() => {
                      setSelectingProfileId(profile.id);
                      setSelectedEntryIds(new Set());
                    }}
                    onNewAnalysis={() => onNewAnalysis(profile.id)}
                  />
                </div>
                {expanded && (
                  <div className="profile-entries">
                    {isSelecting && profile.entries.length > 0 && (
                      <div className="batch-action-bar">
                        <span className="batch-count">已选 {selectedEntryIds.size} 项</span>
                        <button
                          className="batch-select-all-btn"
                          onClick={() => toggleSelectAll(profile)}
                        >
                          {selectedEntryIds.size === profile.entries.length ? '取消全选' : '全选'}
                        </button>
                        <button
                          className="batch-delete-btn"
                          disabled={selectedEntryIds.size === 0}
                          onClick={handleBatchDelete}
                        >
                          删除所选
                        </button>
                        <button className="batch-cancel-btn" onClick={exitSelectMode}>
                          取消
                        </button>
                      </div>
                    )}
                    {profile.entries.length === 0 ? (
                      <div className="profile-entries-empty">
                        {isSelecting ? '选择模式已退出' : '暂无分析记录'}
                      </div>
                    ) : (
                      profile.entries.map((entry) => (
                        isSelecting ? (
                          <label key={entry.id} className="batch-entry">
                            <input
                              type="checkbox"
                              className="batch-checkbox"
                              checked={selectedEntryIds.has(entry.id)}
                              onChange={() => toggleEntrySelection(entry.id)}
                            />
                            <span className="batch-entry-name">{entry.jdName}</span>
                          </label>
                        ) : (
                          <HistoryItem
                            key={entry.id}
                            entry={entry}
                            isSelected={entry.id === selectedEntryId}
                            onSelect={() => onSelectEntry(profile.id, entry.id)}
                            onRename={(newName) =>
                              onRenameEntry(profile.id, entry.id, newName)
                            }
                            onViewJD={() => onViewJD(profile.id, entry.id)}
                            onDelete={() => onDeleteEntry(profile.id, entry.id)}
                          />
                        )
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
