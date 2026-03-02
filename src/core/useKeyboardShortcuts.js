import { useEffect, useCallback } from 'react';

/**
 * Registers global keyboard shortcuts for the ReKindle app.
 *
 * Shortcuts:
 *   R       → Open recap overlay
 *   Escape  → Close any open modal
 *   S       → Open settings
 *   1/2/3   → Switch recap tabs (Plot / Characters / Ask)
 *
 * @param {Object} handlers
 * @param {Function} handlers.onOpenRecap
 * @param {Function} handlers.onCloseModal
 * @param {Function} handlers.onOpenSettings
 * @param {boolean}  handlers.isModalOpen - Whether any modal is currently open
 */
export function useKeyboardShortcuts({ onOpenRecap, onCloseModal, onOpenSettings, isModalOpen }) {
    const handleKeyDown = useCallback((e) => {
        // Don't fire shortcuts when typing in an input/textarea
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        switch (e.key) {
            case 'Escape':
                if (isModalOpen) {
                    e.preventDefault();
                    onCloseModal?.();
                }
                break;

            case 'r':
            case 'R':
                if (!isModalOpen) {
                    e.preventDefault();
                    onOpenRecap?.();
                }
                break;

            case 's':
            case 'S':
                if (!isModalOpen) {
                    e.preventDefault();
                    onOpenSettings?.();
                }
                break;

            default:
                break;
        }
    }, [isModalOpen, onOpenRecap, onCloseModal, onOpenSettings]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}
