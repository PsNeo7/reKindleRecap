import React, { useState, useEffect } from 'react';
import { History, Clock } from 'lucide-react';
import { listRecapOutputs } from '../../core/VectorCache.js';

export default function RecapHistory({ fileType, bookKey, onLoadCachedRecap }) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setIsLoading(true);
        const outputs = await listRecapOutputs(bookKey);
        setHistory(outputs);
        setIsLoading(false);
    };

    if (isLoading) {
        return (
            <div className="skeleton-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <span className="typing-glow-active">Consulting archives...</span>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="chat-empty" style={{ marginTop: '80px' }}>
                <History size={48} style={{ margin: '0 auto 20px', opacity: 0.3 }} />
                <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>No history yet</p>
                <p style={{ fontSize: '0.85rem', marginTop: '10px', opacity: 0.7 }}>
                    Generate your first recap to see it saved here.
                </p>
            </div>
        );
    }

    return (
        <div className="history-container animate-in">
            <h3 className="history-title">Stored Memories</h3>

            <div className="history-grid">
                {history.map((item) => {
                    const date = new Date(item.savedAt);
                    const isToday = date.toDateString() === new Date().toDateString();
                    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateStr = isToday ? `Today, ${timeStr}` : date.toLocaleDateString();

                    return (
                        <div
                            key={item.chapter}
                            className="history-item"
                            onClick={() => onLoadCachedRecap(item.chapter)}
                        >
                            <div>
                                <div className="history-item-title">
                                    {fileType === 'pdf' ? `Page ${item.chapter}` : `Chapter ${item.chapter}`}
                                </div>
                                <div className="history-item-meta">
                                    <Clock size={13} /> {dateStr}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
