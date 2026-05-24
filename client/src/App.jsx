import React, { useState, useCallback } from 'react';
import './App.css';
import { useHistory } from './hooks/useHistory.js';
import Sidebar from './components/Sidebar.jsx';
import AnalysisView from './components/AnalysisView.jsx';
import ResultView from './components/ResultView.jsx';
import JDDetailModal from './components/JDDetailModal.jsx';

function App() {
  const {
    profiles,
    createProfile,
    deleteProfile,
    renameProfile,
    addEntry,
    deleteEntry,
    deleteEntries,
    renameEntry,
    getEntry,
    updateProfileResume,
  } = useHistory();

  // When null: creating a new profile (full form)
  // When set: working within this profile (JD-only form)
  const [activeProfileId, setActiveProfileId] = useState(null);

  // When null: show analysis form. When set: show result view
  const [selectedEntryId, setSelectedEntryId] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Which profiles are expanded in the sidebar
  const [expandedProfiles, setExpandedProfiles] = useState(() => new Set());

  // JD detail modal
  const [jdModalEntry, setJdModalEntry] = useState(null);

  // Toast notification
  const [toast, setToast] = useState(null);

  // Resume viewer modal
  const [resumeModal, setResumeModal] = useState(null);

  // Edit resume modal
  const [editResumeProfile, setEditResumeProfile] = useState(null);
  const [editResumeText, setEditResumeText] = useState('');

  const activeProfile = activeProfileId
    ? profiles.find((p) => p.id === activeProfileId) || null
    : null;

  // Look up the selected entry across the active profile
  const selectedEntry =
    selectedEntryId && activeProfile
      ? activeProfile.entries.find((e) => e.id === selectedEntryId) || null
      : null;

  const handleAnalyze = async (resumeText, jdText, jdName, profileName, fileUrl, fileName, explicitProfileId) => {
    const response = await fetch('/api/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText, jdText }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Analysis failed');

    const matchSummary =
      data.matchResult?.overall_summary?.slice(0, 80) || '暂无摘要';

    let profileId = explicitProfileId ?? activeProfileId;
    const finalProfileName = profileName || '我的简历';

    if (!profileId) {
      const profile = createProfile(resumeText, finalProfileName, fileUrl, fileName);
      profileId = profile.id;
      setActiveProfileId(profileId);
    }

    setExpandedProfiles((prev) => new Set(prev).add(profileId));

    const entry = addEntry(profileId, {
      jdName,
      jdText,
      matchSummary,
      fullResult: data,
    });

    setSelectedEntryId(entry.id);

    const toastMsg = { profileName: finalProfileName, jdName };
    setToast(toastMsg);
    setTimeout(() => setToast((prev) => (prev === toastMsg ? null : prev)), 3000);
  };

  const handleToggleProfile = useCallback((profileId) => {
    setExpandedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  }, []);

  const handleSelectProfile = useCallback(
    (profileId) => {
      setActiveProfileId(profileId);
      // If viewing an entry from a different profile, clear it
      const profile = profiles.find((p) => p.id === profileId);
      if (
        profile &&
        !profile.entries.find((e) => e.id === selectedEntryId)
      ) {
        setSelectedEntryId(null);
      }
    },
    [profiles, selectedEntryId],
  );

  const handleSelectEntry = useCallback((profileId, entryId) => {
    setActiveProfileId(profileId);
    setSelectedEntryId(entryId);
    setSidebarOpen(false);
  }, []);

  const handleNewProfile = useCallback(() => {
    setActiveProfileId(null);
    setSelectedEntryId(null);
    setSidebarOpen(false);
  }, []);

  const handleNewAnalysis = useCallback(() => {
    setSelectedEntryId(null);
  }, []);

  const handleNewAnalysisForProfile = useCallback((profileId) => {
    setActiveProfileId(profileId);
    setSelectedEntryId(null);
  }, []);

  const handleViewResume = useCallback((profile) => {
    setResumeModal({ name: profile.name, text: profile.resumeText });
  }, []);

  const handleEditResume = useCallback((profile) => {
    setEditResumeText(profile.resumeText);
    setEditResumeProfile(profile);
  }, []);

  const handleSaveResume = useCallback(() => {
    if (!editResumeProfile) return;
    updateProfileResume(editResumeProfile.id, editResumeText);
    setEditResumeProfile(null);
    setEditResumeText('');
    setToast({ profileName: editResumeProfile.name, jdName: '', isEdit: true });
    setTimeout(() => setToast(null), 3000);
  }, [editResumeProfile, editResumeText, updateProfileResume]);

  const [reanalyzing, setReanalyzing] = useState(false);

  const handleReanalyze = async (jdText, jdName) => {
    if (!activeProfile) return;

    // Auto-increment version: "xx岗" → "xx岗 (2)" → "xx岗 (3)"
    const baseName = jdName.replace(/\s*\(\d+\)$/, '');
    const versionPattern = new RegExp(
      '^' + baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s*\\(\\d+\\))?$'
    );
    const sameBaseCount = activeProfile.entries.filter((e) =>
      versionPattern.test(e.jdName)
    ).length;
    const versionedName = sameBaseCount > 0 ? `${baseName} (${sameBaseCount + 1})` : baseName;

    setReanalyzing(true);
    try {
      await handleAnalyze(
        activeProfile.resumeText, jdText, versionedName,
        activeProfile.name, activeProfile.fileUrl, activeProfile.fileName,
        activeProfile.id
      );
    } catch {
      alert('重新优化失败，请重试');
    } finally {
      setReanalyzing(false);
    }
  };

  const handleDeleteProfile = useCallback(
    (profileId) => {
      if (profileId === activeProfileId) {
        setActiveProfileId(null);
        setSelectedEntryId(null);
      }
      deleteProfile(profileId);
    },
    [activeProfileId, deleteProfile],
  );

  const handleDeleteEntry = useCallback(
    (profileId, entryId) => {
      if (entryId === selectedEntryId) {
        setSelectedEntryId(null);
      }
      deleteEntry(profileId, entryId);
    },
    [selectedEntryId, deleteEntry],
  );

  const handleDeleteEntries = useCallback(
    (profileId, entryIds) => {
      if (entryIds.includes(selectedEntryId)) {
        setSelectedEntryId(null);
      }
      deleteEntries(profileId, entryIds);
    },
    [selectedEntryId, deleteEntries],
  );

  const handleViewJD = useCallback(
    (profileId, entryId) => {
      const entry = getEntry(profileId, entryId);
      if (entry) {
        setJdModalEntry({ profileId, ...entry });
      }
    },
    [getEntry],
  );

  const viewMode = selectedEntry
    ? 'view-entry'
    : activeProfile
      ? 'profile-analysis'
      : 'new-profile';

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="菜单"
            >
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
            </button>
            <span className="logo-icon">R</span>
            <div className="logo-text-group">
              <span className="logo-text">简历智改</span>
              <span className="logo-tagline">懂岗位，更懂你的简历优势；智能分析，精准优化。</span>
            </div>
          </div>
          <span className="header-subtitle">AI-Powered Resume Optimization</span>
        </div>
      </header>

      <div className="app-body">
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          profiles={profiles}
          activeProfileId={activeProfileId}
          selectedEntryId={selectedEntryId}
          expandedProfiles={expandedProfiles}
          onToggleProfile={handleToggleProfile}
          onSelectProfile={handleSelectProfile}
          onSelectEntry={handleSelectEntry}
          onNewProfile={handleNewProfile}
          onRenameProfile={renameProfile}
          onDeleteProfile={handleDeleteProfile}
          onRenameEntry={renameEntry}
          onViewJD={handleViewJD}
          onDeleteEntry={handleDeleteEntry}
          onEditResume={handleEditResume}
          onDeleteEntries={handleDeleteEntries}
          onNewAnalysis={handleNewAnalysisForProfile}
          isOpen={sidebarOpen}
        />

        <main className="main-content">
          {viewMode === 'view-entry' && selectedEntry ? (
            <ResultView
              key={selectedEntryId}
              entry={selectedEntry}
              profile={activeProfile}
              onNewAnalysis={handleNewAnalysis}
              onViewResume={handleViewResume}
              onReanalyze={handleReanalyze}
              reanalyzing={reanalyzing}
            />
          ) : (
            <AnalysisView
              profile={activeProfile}
              onAnalyze={handleAnalyze}
              onViewResume={handleViewResume}
            />
          )}
        </main>
      </div>

      <footer className="footer">
        <p>
          <span>{'✦'}</span> 简历智改宝 · Powered by AI
        </p>
      </footer>

      {jdModalEntry && (
        <JDDetailModal
          entry={jdModalEntry}
          onClose={() => setJdModalEntry(null)}
        />
      )}

      {toast && (
        <div className="toast">
          <div className="toast-icon">{toast.isEdit ? '✎' : '✓'}</div>
          <div className="toast-text">
            {toast.isEdit
              ? <>简历「<strong>{toast.profileName}</strong>」已更新，建议重新分析</>
              : <>已为「<strong>{toast.profileName}</strong>」新增「{toast.jdName}」优化版本</>
            }
          </div>
        </div>
      )}

      {resumeModal && (
        <div className="modal-overlay" onClick={() => setResumeModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">简历原文：{resumeModal.name}</h3>
              <button className="modal-close" onClick={() => setResumeModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <pre className="jd-full-text">{resumeModal.text}</pre>
            </div>
          </div>
        </div>
      )}

      {editResumeProfile && (
        <div className="modal-overlay" onClick={() => setEditResumeProfile(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">编辑原文：{editResumeProfile.name}</h3>
              <button className="modal-close" onClick={() => setEditResumeProfile(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="edit-resume-hint">
                你正在修改简历内容，为保证后续分析结果的准确性，建议保存修改后，重新优化该简历下的所有岗位分析记录哦～
              </div>
              <textarea
                className="edit-resume-textarea"
                value={editResumeText}
                onChange={(e) => setEditResumeText(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={() => setEditResumeProfile(null)}>取消</button>
              <button className="modal-save-btn" onClick={handleSaveResume}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
