import React, { useState } from 'react';
import { KeyRound, X, Database, ChevronDown } from 'lucide-react';
import { useApiConfig } from '../core/useApiConfig.js';
import { MOCK_BOOK_CHUNKS, setCurrentBookMetadata } from '../core/MockReaderAdapter.js';
import { ingestBookChunks } from '../recap-core/rag/ingest.js';
import { streamRecap } from '../recap-core/ProviderRouter.js';
import { parseEpubFile } from '../recap-core/parsing/epub.js';
import { parsePdfFile } from '../recap-core/parsing/pdf.js';
import { globalVectorStore } from '../core/VectorDB.js';
import { buildCacheKey, saveVectorCache, loadVectorCache, deleteVectorCache } from '../core/VectorCache.js';

const PROVIDERS = [
    { id: 'openai', name: 'OpenAI (ChatGPT)' },
    { id: 'claude', name: 'Anthropic (Claude)' },
    { id: 'gemini', name: 'Google (Gemini)' },
];

export default function SettingsModal({ uploadedFile, onClose }) {
    const { provider, setProvider, keys, setKey } = useApiConfig();

    // Local state for the UI before saving
    const [localProvider, setLocalProvider] = useState(provider);
    const [localKey, setLocalKey] = useState(keys[localProvider] || '');

    const [isIngesting, setIsIngesting] = useState(false);
    const [ingestStatus, setIngestStatus] = useState('');

    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState('');
    const [testError, setTestError] = useState(false);

    // When dropdown changes, immediately update the local key input to match that provider's saved key
    const handleProviderChange = (e) => {
        const newProv = e.target.value;
        setLocalProvider(newProv);
        setLocalKey(keys[newProv] || '');
    };

    const handleSave = () => {
        // Save the global provider choice
        setProvider(localProvider);
        // Save the specific key for this provider
        setKey(localProvider, localKey.trim());
        onClose();
    };

    const handleTestConnection = async () => {
        if (!localKey) {
            setTestError(true);
            setTestStatus("Please enter an API key first.");
            return;
        }

        setIsTesting(true);
        setTestStatus("Testing generation connection...");
        setTestError(false);

        try {
            let receivedData = false;
            await streamRecap(
                localProvider,
                localKey.trim(),
                "You are an API connection tester.",
                [{ text: "Say 'Connection OK' and nothing else." }],
                (chunk) => {
                    if (chunk) receivedData = true;
                },
                (err) => {
                    throw err;
                }
            );

            if (receivedData) {
                setTestStatus("✅ Connection verified! Stream generation is working.");
                setTestError(false);
            } else {
                throw new Error("API connected but no generated text was returned.");
            }
        } catch (err) {
            console.error("Connection QA test failed", err);
            setTestStatus(`❌ Failed: ${err.message}`);
            setTestError(true);
        } finally {
            setIsTesting(false);
        }
    };

    /**
     * Truncates text at the last sentence boundary before maxLen characters.
     * Prevents mid-sentence chunk cuts that cause the LLM to produce incomplete
     * or merged bullet points in the recap output.
     */
    const truncateAtSentenceBoundary = (text, maxLen = 1500) => {
        if (text.length <= maxLen) return text;
        const candidate = text.substring(0, maxLen);
        // Find the last sentence-ending punctuation followed by a space or newline
        const lastDot = candidate.lastIndexOf('. ');
        const lastBang = candidate.lastIndexOf('! ');
        const lastQuery = candidate.lastIndexOf('? ');
        const lastNewlineDot = candidate.lastIndexOf('.\n');
        const boundary = Math.max(lastDot, lastBang, lastQuery, lastNewlineDot);
        // Only use the boundary if it's in the second half — otherwise just hard-cut
        if (boundary > maxLen * 0.5) {
            return candidate.substring(0, boundary + 1).trim();
        }
        return candidate.trim();
    };
    const handleForceReIngest = async () => {
        const cacheKey = uploadedFile ? buildCacheKey(uploadedFile) : 'frankenstein_builtin';
        setIngestStatus('🗑️ Clearing cached embeddings...');
        await deleteVectorCache(cacheKey);
        await globalVectorStore.clear();
        setIngestStatus('Cache cleared. Starting fresh ingestion...');
        await handleSimulateIngestion();
    };

    const handleSimulateIngestion = async () => {
        let ragProvider = localProvider;
        let ragKey = localKey;

        // If the user hasn't saved yet, simulate using local state if available
        const getFallbackKey = (prov) => (localProvider === prov) ? localKey : keys[prov];

        if (ragProvider === 'claude') {
            const geminiKey = getFallbackKey('gemini');
            const openAiKey = getFallbackKey('openai');

            if (geminiKey) {
                ragProvider = 'gemini';
                ragKey = geminiKey;
            } else if (openAiKey) {
                ragProvider = 'openai';
                ragKey = openAiKey;
            } else {
                alert("Anthropic Claude requires either an OpenAI or Gemini API key configured for local RAG embedding generation.");
                return;
            }
        }

        if (!ragKey) {
            alert(`Please configure your ${ragProvider} API key for local vector embeddings first.`);
            return;
        }

        setIsIngesting(true);
        try {
            let bookChunks = [];
            const cacheKey = uploadedFile
                ? buildCacheKey(uploadedFile)
                : 'frankenstein_builtin';

            // --- Cache check: skip expensive API embedding if we already have this book ---
            const cached = await loadVectorCache(cacheKey);
            if (cached) {
                setIngestStatus(`⚡ Cache hit! Loading ${cached.length} pre-embedded chunks from local cache...`);
                await globalVectorStore.clear();
                await globalVectorStore.addDocuments(cached);
                // Restore metadata from first chunk so Recap overlay has the right title
                const firstChunk = cached[0];
                if (firstChunk?.metadata?.title) {
                    setCurrentBookMetadata(firstChunk.metadata.title, firstChunk.metadata.author);
                }
                setIngestStatus(`✅ Loaded from cache! ${cached.length} sections ready. (0 API calls used)`);
                return;
            }

            // --- Fresh ingestion (no cache found) ---
            if (uploadedFile) {
                setIngestStatus(`Parsing ${uploadedFile.name}...`);
                const isEpub = uploadedFile.type === 'application/epub+zip' || uploadedFile.name.endsWith('.epub');

                const parseResult = isEpub ? await parseEpubFile(uploadedFile) : await parsePdfFile(uploadedFile);

                setIngestStatus(`Chunked ${parseResult.metadata.title} into ${parseResult.chunks.length} overlapping windows...`);

                // Parsers now return { text, chapterIndex } objects with sentence-aware
                // windowing already applied — just attach book metadata.
                bookChunks = parseResult.chunks.map((chunk) => ({
                    text: chunk.text,
                    metadata: {
                        chapterIndex: chunk.chapterIndex,
                        title: parseResult.metadata.title,
                        author: parseResult.metadata.author
                    }
                }));
                setCurrentBookMetadata(parseResult.metadata.title, parseResult.metadata.author);

            } else {
                // Dynamic import chunker for the test path
                const { splitIntoWindows } = await import('../recap-core/parsing/chunker.js');

                setIngestStatus('No file uploaded. Downloading Frankenstein (Test Book)...');
                const response = await fetch('/test_document.txt');
                const text = await response.text();

                setIngestStatus('Chunking book into overlapping windows...');

                // Split by chapter/letter boundaries first
                const rawChapters = text.split(/(?=\nChapter |\nLetter )/g);

                // Then window each chapter
                for (let i = 0; i < rawChapters.length; i++) {
                    const chapterText = rawChapters[i].trim();
                    if (chapterText.length < 50) continue;

                    const windows = splitIntoWindows(chapterText, 800, 200);
                    for (const windowText of windows) {
                        bookChunks.push({
                            text: windowText,
                            metadata: {
                                chapterIndex: i,
                                title: "Frankenstein",
                                author: "Mary Shelley"
                            }
                        });
                    }
                }
                setCurrentBookMetadata("Frankenstein", "Mary Shelley");
            }

            setIngestStatus(`Generating embeddings for ${bookChunks.length} sections using ${ragProvider}...`);
            await ingestBookChunks(ragProvider, ragKey, bookChunks);

            // Save to IndexedDB so next session skips API calls entirely
            setIngestStatus('Saving to local cache...');
            await saveVectorCache(cacheKey, globalVectorStore.store);

            setIngestStatus(`✅ Done! ${bookChunks.length} sections embedded & cached. Future loads will be instant.`);
        } catch (err) {
            setIngestStatus(`Error: ${err.message}`);
        } finally {
            setIsIngesting(false);
        }
    };

    return (
        <div className="modal-backdrop animate-in" style={styles.backdrop}>
            <div className="glass-panel" style={styles.modal}>
                <div style={styles.header}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <KeyRound size={20} /> AI Configuration
                    </h2>
                    <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
                </div>

                <div style={styles.body}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
                        Rekindle Recap requires a Bring-Your-Own-Key (BYOK) setup for privacy. Your API keys are stored securely in your browser's local storage and never sent anywhere else.
                    </p>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>AI Provider</label>
                        <div style={styles.selectWrapper}>
                            <select
                                value={localProvider}
                                onChange={handleProviderChange}
                                style={styles.select}
                            >
                                {PROVIDERS.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} style={styles.selectIcon} />
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                            {PROVIDERS.find(p => p.id === localProvider)?.name} API Key
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="password"
                                value={localKey}
                                onChange={(e) => setLocalKey(e.target.value)}
                                placeholder={localProvider === 'gemini' ? 'AIza...' : localProvider === 'claude' ? 'sk-ant-...' : 'sk-proj-...'}
                                style={{ ...styles.input, flex: 1 }}
                            />
                            <button className="btn-secondary" onClick={handleTestConnection} disabled={isTesting} style={{ padding: '0 16px', fontSize: '0.9rem' }}>
                                {isTesting ? 'Testing...' : 'Test Connection'}
                            </button>
                        </div>
                        {testStatus && <div style={{ marginTop: '8px', fontSize: '0.85rem', color: testError ? '#ef4444' : '#10b981' }}>{testStatus}</div>}
                    </div>

                    <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <h3 style={{ fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Database size={16} /> RAG Pre-computation
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            Before requesting a recap, the book must be embedded into the local Vector Database to ensure spoiler-free accuracy. Note: Embeddings currently use OpenAI or Gemini.
                        </p>
                        <button
                            className="btn-secondary"
                            onClick={handleSimulateIngestion}
                            disabled={isIngesting}
                            style={{ width: '100%', fontSize: '0.85rem' }}
                        >
                            {isIngesting ? 'Processing...' : (uploadedFile ? `Ingest ${uploadedFile.name}` : 'Simulate Book Ingestion (Frankenstein)')}
                        </button>
                        <button
                            onClick={handleForceReIngest}
                            disabled={isIngesting}
                            style={{
                                marginTop: '8px',
                                width: '100%',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                cursor: isIngesting ? 'not-allowed' : 'pointer',
                                textDecoration: 'underline',
                                fontFamily: 'var(--font-family)',
                                opacity: isIngesting ? 0.4 : 0.7,
                                padding: '4px 0',
                            }}
                        >
                            🗑 Clear cache &amp; force re-ingest
                        </button>
                        {ingestStatus && <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--accent-color)' }}>{ingestStatus}</div>}
                    </div>
                </div>

                <div style={styles.footer}>
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={handleSave}>Save Settings</button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    backdrop: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
    },
    modal: {
        width: '100%',
        maxWidth: '500px',
        backgroundColor: 'var(--surface-color)',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        padding: '20px 24px',
        borderBottom: '1px solid var(--surface-hover)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    body: {
        padding: '24px',
    },
    footer: {
        padding: '16px 24px',
        borderTop: '1px solid var(--surface-hover)',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px'
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: 'pointer'
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid var(--surface-hover)',
        backgroundColor: 'rgba(0,0,0,0.2)',
        color: 'var(--text-primary)',
        fontSize: '1rem',
        fontFamily: 'var(--font-family)',
        outline: 'none'
    },
    selectWrapper: {
        position: 'relative',
        width: '100%',
    },
    select: {
        width: '100%',
        appearance: 'none',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid var(--surface-hover)',
        backgroundColor: 'rgba(0,0,0,0.2)',
        color: 'var(--text-primary)',
        fontSize: '1rem',
        fontFamily: 'var(--font-family)',
        outline: 'none',
        cursor: 'pointer'
    },
    selectIcon: {
        position: 'absolute',
        right: '16px',
        top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        color: 'var(--text-secondary)'
    }
};
