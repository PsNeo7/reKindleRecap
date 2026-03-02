import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'rekindle_reading_session';
const RETURN_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Tracks the user's reading session in localStorage.
 * Detects when a user returns after a gap (>30min) and exposes the
 * last chapter they were at, so the app can prompt a recap.
 *
 * @param {string|null} bookKey - Current book identifier (title or null if no book open)
 * @returns {{ isReturning: boolean, lastChapter: number|null, updateChapter: (ch: number) => void, dismissReturn: () => void }}
 */
export function useReadingSession(bookKey) {
    const [isReturning, setIsReturning] = useState(false);
    const [lastChapter, setLastChapter] = useState(null);

    useEffect(() => {
        if (!bookKey) return;

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const session = JSON.parse(raw);
                if (session.bookKey === bookKey) {
                    const gap = Date.now() - (session.lastTimestamp || 0);
                    if (gap > RETURN_THRESHOLD_MS && session.lastChapter != null) {
                        setIsReturning(true);
                        setLastChapter(session.lastChapter);
                    }
                }
            }
        } catch {
            // corrupted storage — ignore
        }

        // Update timestamp on mount
        saveSession(bookKey, null);
    }, [bookKey]);

    const updateChapter = useCallback((chapter) => {
        if (!bookKey) return;
        saveSession(bookKey, chapter);
        setLastChapter(chapter);
    }, [bookKey]);

    const dismissReturn = useCallback(() => {
        setIsReturning(false);
    }, []);

    return { isReturning, lastChapter, updateChapter, dismissReturn };
}

function saveSession(bookKey, chapter) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const existing = raw ? JSON.parse(raw) : {};
        const updated = {
            bookKey,
            lastChapter: chapter ?? existing.lastChapter ?? null,
            lastTimestamp: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
        // storage full or unavailable
    }
}
