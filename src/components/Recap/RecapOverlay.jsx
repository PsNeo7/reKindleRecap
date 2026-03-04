import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, BookOpen, Users, MessageCircle, History, RefreshCw } from 'lucide-react';
import { useApiConfig } from '../../core/useApiConfig.js';
import { CURRENT_BOOK_METADATA } from '../../core/MockReaderAdapter.js';
import { retrieveMultiPassContext } from '../../recap-core/rag/retrieve.js';
import { generateSystemPrompt } from '../../recap-core/prompt.js';
import { streamRecap } from '../../recap-core/ProviderRouter.js';
import { parseRecapStream } from '../../recap-core/parser.js';
import { loadRecapOutput, saveRecapOutput } from '../../core/VectorCache.js';
import ExportButton from './ExportButton.jsx';

import RecapSkeleton from './RecapSkeleton.jsx';
import PlotSummary from './PlotSummary.jsx';
import CharacterRoster from './CharacterRoster.jsx';
import QuestionPanel from './QuestionPanel.jsx';
import RecapHistory from './RecapHistory.jsx';

export default function RecapOverlay({ onClose, currentChapter = 10, fileType = 'epub' }) {
    const { provider, activeKey, hasActiveKey } = useApiConfig();
    const [status, setStatus] = useState('initializing'); // initializing, streaming, complete, error
    const [errorObj, setErrorObj] = useState(null);
    const [rawMarkdown, setRawMarkdown] = useState('');
    const [activeTab, setActiveTab] = useState('plot');
    const [forceRefresh, setForceRefresh] = useState(false); // 'plot' | 'characters'

    const hasStarted = useRef(false);

    // Reset guard whenever the chapter changes so re-opening at a new position
    // always triggers a fresh recap (not the cached one from the previous position).
    useEffect(() => {
        hasStarted.current = false;
    }, [currentChapter]);

    useEffect(() => {
        if (hasStarted.current) return;
        hasStarted.current = true;

        if (!hasActiveKey) {
            setStatus('error');
            setErrorObj(new Error("Missing API Key. Please configure it in settings."));
            return;
        }

        startRecapProcess();
    }, [hasActiveKey, currentChapter]);

    const startRecapProcess = async (overrideChapter = null, force = false) => {
        try {
            setStatus('initializing');
            const targetChapter = overrideChapter ?? currentChapter;

            // 0. Check recap output cache first (instant if cached)
            const bookKey = CURRENT_BOOK_METADATA.title;
            const skipCache = force || forceRefresh;
            if (!skipCache) {
                const cached = await loadRecapOutput(bookKey, targetChapter);
                if (cached) {
                    setRawMarkdown(cached.markdown);
                    setStatus('complete');
                    // If we loaded a different chapter from history, switch back to plot tab
                    if (overrideChapter !== null) setActiveTab('plot');
                    return;
                }
            }
            setForceRefresh(false); // Reset for next time

            // 1. RAG Retrieve Safe Context. This explicitly bans future text.
            let ragProvider = provider;
            let ragKey = activeKey;

            if (provider === 'claude') {
                const openAiKey = localStorage.getItem('rekindle_openai_key');
                const geminiKey = localStorage.getItem('rekindle_gemini_key');
                if (geminiKey) {
                    ragProvider = 'gemini';
                    ragKey = geminiKey;
                } else if (openAiKey) {
                    ragProvider = 'openai';
                    ragKey = openAiKey;
                } else {
                    throw new Error("Anthropic Claude requires either an OpenAI or Gemini API key configured for local RAG context retrieval.");
                }
            } else if (!ragKey) {
                throw new Error(`Local RAG context retrieval requires a configured ${provider} key.`);
            }

            // 2. Multi-pass RAG retrieval: recent plot + foundational characters
            const safeContextChunks = await retrieveMultiPassContext(
                ragProvider,
                ragKey,
                CURRENT_BOOK_METADATA.title,
                currentChapter,
                8,
                fileType
            );

            // 3. Build Prompt
            const progressText = fileType === 'pdf' ? `Page ${currentChapter}` : `Chapter ${currentChapter}`;
            const systemPrompt = generateSystemPrompt(
                CURRENT_BOOK_METADATA.title,
                CURRENT_BOOK_METADATA.author,
                progressText
            );

            setStatus('streaming');

            // 4. Stream from selected provider.
            let accumulated = '';
            await streamRecap(
                provider,
                activeKey,
                systemPrompt,
                safeContextChunks,
                (chunkText) => {
                    accumulated += chunkText;
                    setRawMarkdown(prev => prev + chunkText);
                }
            );

            // 5. Cache the completed recap output
            await saveRecapOutput(bookKey, currentChapter, accumulated);

            setStatus('complete');

        } catch (err) {
            setStatus('error');
            setErrorObj(err);
        }
    };

    const parsedData = parseRecapStream(rawMarkdown);
    const isActive = status === 'streaming' || status === 'complete' || status === 'error';
    const progressLabel = fileType === 'pdf' ? `Page ${currentChapter}` : `Chapter ${currentChapter}`;

    return (
        <div className="modal-backdrop animate-in" style={styles.backdrop}>
            <div className="glass-panel" style={styles.modal}>

                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '2px' }}>
                            {status === 'initializing' ? 'Preparing Recap...' :
                                status === 'streaming' ? 'Generating Recap...' :
                                    status === 'error' ? 'Error' : 'Recap'}
                        </h2>
                        {status !== 'error' && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                                {CURRENT_BOOK_METADATA.title} · {progressLabel}
                            </p>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {status === 'complete' && (
                            <button
                                onClick={() => startRecapProcess(null, true)}
                                style={{
                                    background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontFamily: 'var(--font-family)', transition: 'color 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                title="Regenerate Recap"
                            >
                                <RefreshCw size={14} /> Regenerate
                            </button>
                        )}
                        <ExportButton rawMarkdown={status === 'complete' ? rawMarkdown : ''} />
                        <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
                    </div>
                </div>

                {/* Tab Bar — always show once recap has any state */}
                {(isActive || status === 'initializing') && (
                    <div style={styles.tabBar}>
                        <button
                            style={styles.tab(activeTab === 'plot')}
                            onClick={() => setActiveTab('plot')}
                        >
                            <BookOpen size={15} />
                            Plot
                        </button>
                        <button
                            style={styles.tab(activeTab === 'characters')}
                            onClick={() => setActiveTab('characters')}
                        >
                            <Users size={15} />
                            Characters
                        </button>
                        <button
                            style={styles.tab(activeTab === 'ask')}
                            onClick={() => setActiveTab('ask')}
                        >
                            <MessageCircle size={15} />
                            Ask
                        </button>
                        <button
                            style={styles.tab(activeTab === 'history')}
                            onClick={() => setActiveTab('history')}
                        >
                            <History size={15} />
                            History
                        </button>
                    </div>
                )}

                {/* Content */}
                <div style={styles.content}>
                    {status === 'initializing' && <RecapSkeleton />}

                    {status === 'error' && (
                        <div style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            animation: 'fadeSlideIn 0.3s ease both'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <AlertCircle size={20} color="var(--danger-color)" />
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Generation Interrupted</h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{errorObj?.message || 'A network error occurred.'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => startRecapProcess(null, true)}
                                style={{
                                    background: 'rgba(239,68,68,0.15)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    color: 'var(--text-primary)',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'background 0.2s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                            >
                                <RefreshCw size={14} /> Retry
                            </button>
                        </div>
                    )}

                    {isActive && activeTab !== 'ask' && activeTab !== 'history' && (
                        <div style={styles.tabContent}>
                            {activeTab === 'plot' && (
                                <PlotSummary
                                    markdown={parsedData.plotSummary}
                                    isStreaming={status === 'streaming'}
                                />
                            )}
                            {activeTab === 'characters' && (
                                <CharacterRoster
                                    characters={parsedData.characters}
                                    isStreaming={status === 'streaming'}
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'ask' && (
                        <QuestionPanel
                            currentChapter={currentChapter}
                            fileType={fileType}
                        />
                    )}

                    {activeTab === 'history' && (
                        <RecapHistory
                            fileType={fileType}
                            onLoadCachedRecap={(chapter) => {
                                // Bypassing normal effect dependencies to explicitly trigger loads
                                startRecapProcess(chapter);
                            }}
                        />
                    )}
                </div>

                {/* Streaming indicator */}
                {
                    status === 'streaming' && (
                        <div style={styles.streamingBar}>
                            <span style={styles.streamingDot} />
                            Generating...
                        </div>
                    )
                }
            </div >
        </div >
    );
}

const styles = {
    backdrop: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px'
    },
    modal: {
        width: '100%',
        maxWidth: '760px',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--surface-color)', /* Opaque background to prevent text bleed-through */
    },
    header: {
        padding: '20px 28px',
        borderBottom: '1px solid var(--surface-hover)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(15, 23, 42, 0.4)',
        flexShrink: 0,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '4px',
    },
    tabBar: {
        display: 'flex',
        gap: '4px',
        padding: '12px 28px 0',
        borderBottom: '1px solid var(--surface-hover)',
        background: 'rgba(15, 23, 42, 0.3)',
        flexShrink: 0,
    },
    tab: (active) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '9px 18px',
        borderRadius: '8px 8px 0 0',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent-color)' : '2px solid transparent',
        background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
        color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
        fontWeight: active ? 600 : 400,
        fontSize: '0.9rem',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        marginBottom: '-1px', // tuck under the border
        fontFamily: 'var(--font-family)',
    }),
    content: {
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
    },
    tabContent: {
        height: '100%',
        overflowY: 'auto',
        padding: '28px 32px',
    },
    errorBox: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '40px',
        textAlign: 'center',
    },
    streamingBar: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 28px',
        borderTop: '1px solid var(--surface-hover)',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        background: 'rgba(15, 23, 42, 0.3)',
        flexShrink: 0,
    },
    streamingDot: {
        display: 'inline-block',
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: 'var(--accent-color)',
        animation: 'pulse 1.2s ease-in-out infinite',
    },
};
