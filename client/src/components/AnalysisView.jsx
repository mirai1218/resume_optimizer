import React, { useState, useRef, useEffect } from 'react';
import { extractJdName } from '../hooks/useHistory.js';

export default function AnalysisView({ profile, onAnalyze, onViewResume }) {
  const ownResumeText = profile ? profile.resumeText : '';
  const [resumeText, setResumeText] = useState('');
  const [resumeFileUrl, setResumeFileUrl] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [profileName, setProfileName] = useState('我的简历');
  const [jdText, setJdText] = useState('');
  const [jdName, setJdName] = useState('');
  const jdNameTouched = useRef(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const effectiveResumeText = profile ? ownResumeText : resumeText;

  // Auto-suggest version name from JD first line (only if user hasn't manually edited)
  useEffect(() => {
    if (!jdNameTouched.current && jdText.trim()) {
      setJdName(extractJdName(jdText));
    }
  }, [jdText]);

  const handleJdNameChange = (e) => {
    jdNameTouched.current = true;
    setJdName(e.target.value);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (!allowedTypes.includes(file.type)) {
      alert('请上传 PDF、DOC 或 DOCX 文件');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const response = await fetch('/api/resume', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setResumeText(data.text);
        if (data.fileUrl) setResumeFileUrl(data.fileUrl);
        if (data.fileName) setResumeFileName(data.fileName);
        setActiveTab('upload');
      } else {
        alert('文件解析失败: ' + (data.error || 'unknown'));
      }
    } catch {
      alert('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } };
      handleFileUpload(fakeEvent);
    }
  };

  const handleAnalyze = async () => {
    const resume = effectiveResumeText;
    if (!resume || !jdText) {
      alert('请先输入简历和职位描述');
      return;
    }
    const finalJdName = jdName.trim() || extractJdName(jdText);
    const finalProfileName = profile ? profile.name : (profileName.trim() || '我的简历');
    const finalFileUrl = profile ? profile.fileUrl : resumeFileUrl;
    const finalFileName = profile ? profile.fileName : resumeFileName;
    setLoading(true);
    try {
      await onAnalyze(resume, jdText, finalJdName, finalProfileName, finalFileUrl, finalFileName);
    } catch {
      alert('分析失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="input-section">
      <h2 className="section-title">简历分析</h2>

      {profile ? (
        <>
          <div className="profile-active-badge">
            <span className="profile-active-label">当前简历：</span>
            <span className="profile-active-name">{profile.name}</span>
            <button className="view-resume-btn" onClick={() => onViewResume(profile)}>
              查看简历原文
            </button>
            {profile.fileUrl && (
              <button
                className="view-file-btn"
                onClick={() => window.open(profile.fileUrl, '_blank', 'noreferrer')}
              >
                下载原文件
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="textarea-group">
            <label className="input-label">简历名称</label>
            <input
              className="version-name-input"
              type="text"
              placeholder="例：我的产品经理简历"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
          </div>

          <div className="tab-buttons" role="tablist">
            <button
              className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
              role="tab"
              aria-selected={activeTab === 'upload'}
            >
              <span className="tab-icon">{'↑'}</span>
              上传文档
            </button>
            <button
              className={`tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
              onClick={() => setActiveTab('paste')}
              role="tab"
              aria-selected={activeTab === 'paste'}
            >
              <span className="tab-icon">{'✎'}</span>
              粘贴文本
            </button>
          </div>

          {activeTab === 'upload' && (
            <div
              className={`upload-area ${isDragging ? 'dragging' : ''} ${resumeText ? 'success' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              aria-label="上传简历文件"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.doc,.docx"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              {uploading ? (
                <div className="upload-loading">
                  <div className="spinner"></div>
                  <p>解析中...</p>
                </div>
              ) : resumeText ? (
                <div className="upload-success">
                  <div className="success-icon">{'✓'}</div>
                  <p>文档解析成功</p>
                  <button
                    className="switch-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('paste');
                    }}
                  >
                    查看 / 编辑文本
                  </button>
                </div>
              ) : (
                <div className="upload-prompt">
                  <div className="upload-icon">{'📎'}</div>
                  <p className="upload-title">拖拽文件到此处</p>
                  <p className="upload-hint">或点击选择文件 · 支持 PDF、DOC、DOCX</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="textarea-group">
              <label className="input-label">简历内容</label>
              <textarea
                placeholder="请粘贴简历内容..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
              />
            </div>
          )}
        </>
      )}

      <div className="textarea-group">
        <label className="input-label">版本名称</label>
        <input
          className="version-name-input"
          type="text"
          placeholder="例：xx公司xx岗"
          value={jdName}
          onChange={handleJdNameChange}
        />
        <p className="version-name-hint">默认取 JD 第一行，可自行修改为易记的名称</p>
      </div>

      <div className="textarea-group">
        <label className="input-label">职位描述</label>
        <textarea
          className="jd-input"
          placeholder="请粘贴职位描述 (Job Description) ..."
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
        />
      </div>

      <button className="analyze-btn" onClick={handleAnalyze} disabled={loading}>
        {loading ? (
          <>
            <span className="btn-spinner"></span>
            <span className="btn-text">优化中...</span>
          </>
        ) : (
          <>
            <span className="btn-icon">{'→'}</span>
            <span className="btn-text">生成优化建议</span>
          </>
        )}
      </button>
    </section>
  );
}
