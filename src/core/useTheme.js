import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'rekindle_theme';

/**
 * Theme management hook.
 * Reads/writes to localStorage, sets data-theme attribute on <html>,
 * and defaults to system preference via prefers-color-scheme.
 *
 * @returns {{ theme: 'dark'|'light', toggleTheme: () => void }}
 */
export function useTheme() {
    const [theme, setTheme] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'light' || stored === 'dark') return stored;
        } catch { }
        // Default to system preference
        if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
        return 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch { }
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme(t => t === 'dark' ? 'light' : 'dark');
    }, []);

    return { theme, toggleTheme };
}
