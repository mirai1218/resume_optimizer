import { useState, useCallback } from 'react';

const OLD_KEY = 'resume-history-v1';
const STORAGE_KEY = 'resume-history-v2';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const extractJdName = (jdText) => {
  const firstLine = jdText.trim().split('\n')[0]?.trim();
  if (!firstLine) return '未命名职位';
  return firstLine.length > 40 ? firstLine.slice(0, 40) + '...' : firstLine;
};

function migrateV1ToV2() {
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return null;
    const oldEntries = JSON.parse(raw);
    if (!Array.isArray(oldEntries) || oldEntries.length === 0) return null;

    // Group by resumeText
    const grouped = new Map();
    for (const e of oldEntries) {
      const key = e.resumeText?.trim();
      if (!key) continue;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: generateId(),
          name: '我的简历',
          resumeText: e.resumeText,
          createdAt: e.createdAt,
          entries: [],
        });
      }
      const profile = grouped.get(key);
      profile.entries.push({
        id: e.id || generateId(),
        createdAt: e.createdAt || new Date().toISOString(),
        jdName: e.jdTitle || '未命名职位',
        jdText: e.jdText || '',
        matchSummary: e.matchSummary || '',
        fullResult: e.fullResult || {},
      });
    }

    // Sort entries within each profile by date desc
    const profiles = Array.from(grouped.values());
    for (const p of profiles) {
      p.entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    // Sort profiles by newest entry
    profiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Save to new key and remove old
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    localStorage.removeItem(OLD_KEY);
    return profiles;
  } catch {
    return null;
  }
}

function loadProfiles() {
  try {
    const migrated = migrateV1ToV2();
    if (migrated !== null) return migrated;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

function persist(profiles) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    alert('存储空间不足，请删除部分历史记录');
  }
}

export function useHistory() {
  const [profiles, setProfiles] = useState(loadProfiles);

  const createProfile = useCallback((resumeText, name, fileUrl, fileName) => {
    const profile = {
      id: generateId(),
      name: name || '我的简历',
      resumeText,
      fileUrl: fileUrl || '',
      fileName: fileName || '',
      createdAt: new Date().toISOString(),
      entries: [],
    };
    setProfiles((prev) => {
      const next = [profile, ...prev];
      persist(next);
      return next;
    });
    return profile;
  }, []);

  const deleteProfile = useCallback((profileId) => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== profileId);
      persist(next);
      return next;
    });
  }, []);

  const updateProfileResume = useCallback((profileId, newText) => {
    setProfiles((prev) => {
      const next = prev.map((p) =>
        p.id === profileId ? { ...p, resumeText: newText } : p,
      );
      persist(next);
      return next;
    });
  }, []);

  const renameProfile = useCallback((profileId, newName) => {
    setProfiles((prev) => {
      const next = prev.map((p) =>
        p.id === profileId ? { ...p, name: newName } : p,
      );
      persist(next);
      return next;
    });
  }, []);

  const addEntry = useCallback((profileId, rawEntry) => {
    const entry = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      ...rawEntry,
    };
    setProfiles((prev) => {
      const next = prev.map((p) => {
        if (p.id !== profileId) return p;
        // Update profile's createdAt to the latest entry's time
        return {
          ...p,
          createdAt: entry.createdAt,
          entries: [entry, ...p.entries],
        };
      });
      // Re-sort: profile with newest entry first
      next.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      persist(next);
      return next;
    });
    return entry;
  }, []);

  const deleteEntry = useCallback((profileId, entryId) => {
    setProfiles((prev) => {
      const next = prev
        .map((p) => {
          if (p.id !== profileId) return p;
          const entries = p.entries.filter((e) => e.id !== entryId);
          return { ...p, entries };
        })
      persist(next);
      return next;
    });
  }, []);

  const deleteEntries = useCallback((profileId, entryIds) => {
    const idSet = new Set(entryIds);
    setProfiles((prev) => {
      const next = prev.map((p) => {
        if (p.id !== profileId) return p;
        return { ...p, entries: p.entries.filter((e) => !idSet.has(e.id)) };
      });
      persist(next);
      return next;
    });
  }, []);

  const renameEntry = useCallback((profileId, entryId, newName) => {
    setProfiles((prev) => {
      const next = prev.map((p) => {
        if (p.id !== profileId) return p;
        return {
          ...p,
          entries: p.entries.map((e) =>
            e.id === entryId ? { ...e, jdName: newName } : e,
          ),
        };
      });
      persist(next);
      return next;
    });
  }, []);

  const getEntry = useCallback(
    (profileId, entryId) => {
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) return null;
      return profile.entries.find((e) => e.id === entryId) || null;
    },
    [profiles],
  );

  const getProfile = useCallback(
    (profileId) => profiles.find((p) => p.id === profileId) || null,
    [profiles],
  );

  return {
    profiles,
    createProfile,
    deleteProfile,
    renameProfile,
    updateProfileResume,
    addEntry,
    deleteEntry,
    deleteEntries,
    renameEntry,
    getEntry,
    getProfile,
  };
}
