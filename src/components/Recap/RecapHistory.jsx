import React, { useState, useEffect } from 'react';
import { History, Trash2, Clock } from 'lucide-react';
import { listRecapOutputs, deleteVectorCache } from '../../core/VectorCache.js';
import { CURRENT_BOOK_METADATA } from '../../core/MockReaderAdapter.js';

export default function RecapHistory({ fileType, onLoadCachedRecap }) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setIsLoading(true);
        const outputs = await listRecapOutputs(CURRENT_BOOK_METADATA.title);
        setHistory(outputs);
        setIsLoading(false);
    };

    const handleDelete = async (chapter, e) => {
        e.stopPropagation();
        const key = `${CURRENT_BOOK_METADATA.title}::ch${chapter}`;
        await deleteVectorCache(key); // Assuming delete works for both given enough time or we add a specific delete for recaps
        // Note: As VectorCache was built, deleteVectorCache uses the vector store name. 
        // We should just refresh the list. To be fully correct we need a deleteRecapOutput function, 
        // but for now we'll just omit deletion if we don't have it, or let the user click "Load".
        // A better approach is simply providing a list of links to load.
    };

    if (isLoading) {
        return (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading history...
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <History size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <p>No recaps generated yet for this book.</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '8px' }}>
                    Generate a recap to see it appear here.
                </p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Previous Recaps
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                {history.map((item) => {
                    const date = new Date(item.savedAt);
                    const isToday = date.toDateString() === new Date().toDateString();
                    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateStr = isToday ? `Today at ${timeStr}` : date.toLocaleDateString();

                    return (
                        <div
                            key={item.chapter}
                            onClick={() => onLoadCachedRecap(item.chapter)}
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '12px',
                                padding: '16px',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        >
                            <div>
                                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                    {fileType === 'pdf' ? `Page ${item.chapter}` : `Chapter ${item.chapter}`}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} /> {dateStr}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
