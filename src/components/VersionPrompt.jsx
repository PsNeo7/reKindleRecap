import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useApiConfig } from '../core/useApiConfig.js';
import { loadAllBooksFromLibrary } from '../core/VectorCache.js';
import { processBookIngestion } from '../core/ingestionWorkflow.js';

// IMPORTANT: Bump this version whenever parsing/chunking logic fundamentally changes
const REKINDLE_ENGINE_VERSION = '1.1.0';

export default function VersionPrompt() {
    const [isOpen, setIsOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [statusText, setStatusText] = useState('');
    const { provider, activeKey } = useApiConfig();

    useEffect(() => {
        const storedVersion = localStorage.getItem('rekindle_engine_version');
        if (storedVersion !== REKINDLE_ENGINE_VERSION) {
            // Only prompt if they actually have books in the library
            loadAllBooksFromLibrary().then(books => {
                if (books.length > 0) {
                    setIsOpen(true);
                } else {
                    // No library books, just instantly upgrade version
                    localStorage.setItem('rekindle_engine_version', REKINDLE_ENGINE_VERSION);
                }
            });
        }
    }, []);

    const handleUpdateLibrary = async () => {
        if (!activeKey) {
            alert('Please configure your API key in Settings first to re-ingest your books.');
            return;
        }

        setIsUpdating(true);
        setStatusText('Fetching library...');

        try {
            const library = await loadAllBooksFromLibrary();

            for (let i = 0; i < library.length; i++) {
                const book = library[i];
                setStatusText(`Updating book ${i + 1}/${library.length}: ${book.name}`);
                await processBookIngestion(book.file, provider, activeKey, () => { });
            }

            setStatusText('Complete! Library upgraded.');
            localStorage.setItem('rekindle_engine_version', REKINDLE_ENGINE_VERSION);

            setTimeout(() => {
                setIsOpen(false);
            }, 1000);
        } catch (err) {
            setStatusText(`Upgrade Error: ${err.message}`);
        }
    };

    const handleSkip = () => {
        localStorage.setItem('rekindle_engine_version', REKINDLE_ENGINE_VERSION);
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
            <div style={{
                background: 'var(--surface-color)', width: '100%', maxWidth: '480px',
                borderRadius: '16px', padding: '32px', border: '1px solid var(--glass-border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                boxShadow: '0 24px 48px rgba(0,0,0,0.4)', animation: 'fadeSlideIn 0.3s ease both'
            }}>
                <AlertTriangle size={48} color="var(--accent-color)" style={{ marginBottom: '16px' }} />
                <h2 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Recap Engine Update ({REKINDLE_ENGINE_VERSION})</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
                    Rekindle Recap's core AI logic has been upgraded to provide much better plot and character summaries!
                    We highly recommend clicking "Update Library" to automatically re-ingest your saved books using the new timeline extraction rules.
                </p>

                {isUpdating ? (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="skeleton" style={{ width: '100%', height: '8px', borderRadius: '4px' }} />
                        <span style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600 }}>{statusText}</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                        <button className="btn-secondary" style={{ flex: 1 }} onClick={handleSkip}>Skip For Now</button>
                        <button className="btn-primary" style={{ flex: 1 }} onClick={handleUpdateLibrary}>Update Library</button>
                    </div>
                )}
            </div>
        </div>
    );
}
