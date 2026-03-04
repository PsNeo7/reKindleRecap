import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, BookOpen, Users, MessageCircle, History, RefreshCw } from 'lucide-react';
import { useApiConfig } from '../../core/useApiConfig.js';
import './RecapOverlay.css';

import { retrieveMultiPassContext } from '../../recap-core/rag/retrieve.js';
// ... rest of imports
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

export default function RecapOverlay({ onClose, currentChapter = 10, fileType = 'epub', bookKey }) {
    const { provider, activeKey, hasActiveKey } = useApiConfig();
    const [status, setStatus] = useState('initializing'); // initializing, streaming, complete, error
    const [errorObj, setErrorObj] = useState(null);
    const [rawMarkdown, setRawMarkdown] = useState('');
    const [activeTab, setActiveTab] = useState('plot');
    const [forceRefresh, setForceRefresh] = useState(false); // 'plot' | 'characters'

    const hasStarted = useRef(false);

    // Reset guard whenever the chapter changes
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
            const safeBookKey = bookKey || "Unknown Book";
            const skipCache = force || forceRefresh;
            if (!skipCache) {
                const cached = await loadRecapOutput(safeBookKey, targetChapter);
                if (cached) {
                    setRawMarkdown(cached.markdown);
                    setStatus('complete');
                    if (overrideChapter !== null) setActiveTab('plot');
                    return;
                }
            }
            setForceRefresh(false);

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

            const safeContextChunks = await retrieveMultiPassContext(
                ragProvider,
                ragKey,
                safeBookKey,
                currentChapter,
                8,
                fileType
            );

            const progressText = fileType === 'pdf' ? `Page ${currentChapter}` : `Chapter ${currentChapter}`;
            const systemPrompt = generateSystemPrompt(
                safeBookKey,
                "",
                progressText
            );

            setStatus('streaming');

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

            await saveRecapOutput(safeBookKey, currentChapter, accumulated);
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
        <div className="recap-modal-backdrop animate-in">
            <div className="recap-modal glass-panel">

                {/* Header */}
                <div className="recap-header">
                    <div>
                        <h2 className="recap-header-title">
                            {status === 'initializing' ? 'Preparing Recap...' :
                                status === 'streaming' ? 'Generating Recap...' :
                                    status === 'error' ? 'Error' : 'Recap'}
                        </h2>
                        {status !== 'error' && (
                            <p className="recap-header-subtitle">
                                {bookKey || "Unknown Book"} · {progressLabel}
                            </p>
                        )}
                    </div>
                    <div className="recap-header-actions">
                        {status === 'complete' && (
                            <button
                                onClick={() => startRecapProcess(null, true)}
                                className="btn-secondary"
                                style={{
                                    background: 'none', border: 'none', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                                title="Regenerate Recap"
                            >
                                <RefreshCw size={14} /> <span className="hide-mobile">Regenerate</span>
                            </button>
                        )}
                        <ExportButton rawMarkdown={status === 'complete' ? rawMarkdown : ''} />
                        <button onClick={onClose} className="recap-close-btn"><X size={20} /></button>
                    </div>
                </div>

                {/* Tab Bar */}
                {(isActive || status === 'initializing') && (
                    <div className="recap-tab-bar">
                        <button
                            className={`recap-tab ${activeTab === 'plot' ? 'active' : ''}`}
                            onClick={() => setActiveTab('plot')}
                        >
                            <BookOpen size={15} /> <span>Plot</span>
                        </button>
                        <button
                            className={`recap-tab ${activeTab === 'characters' ? 'active' : ''}`}
                            onClick={() => setActiveTab('characters')}
                        >
                            <Users size={15} /> <span>Characters</span>
                        </button>
                        <button
                            className={`recap-tab ${activeTab === 'ask' ? 'active' : ''}`}
                            onClick={() => setActiveTab('ask')}
                        >
                            <MessageCircle size={15} /> <span>Ask</span>
                        </button>
                        <button
                            className={`recap-tab ${activeTab === 'history' ? 'active' : ''}`}
                            onClick={() => setActiveTab('history')}
                        >
                            <History size={15} /> <span>History</span>
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="recap-content">
                    <div className="recap-scroll-area">
                        {status === 'initializing' && <RecapSkeleton />}

                        {status === 'error' && (
                            <div className="error-box-recap" style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '8px',
                                padding: '12px 16px',
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
                                    className="btn-secondary"
                                    style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <RefreshCw size={14} /> Retry
                                </button>
                            </div>
                        )}

                        {isActive && activeTab !== 'ask' && activeTab !== 'history' && (
                            <div className="tab-content-recap">
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
                                bookKey={bookKey}
                            />
                        )}

                        {activeTab === 'history' && (
                            <RecapHistory
                                fileType={fileType}
                                bookKey={bookKey}
                                onLoadCachedRecap={(chapter) => {
                                    startRecapProcess(chapter);
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* Streaming indicator */}
                {status === 'streaming' && (
                    <div className="recap-streaming-indicator">
                        <div className="streaming-dot" style={{
                            width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-color)', animation: 'pulse 1.2s infinite'
                        }} />
                        Generating...
                    </div>
                )}
            </div>
        </div>
    );
}
