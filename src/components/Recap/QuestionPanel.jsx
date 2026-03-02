import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { useApiConfig } from '../../core/useApiConfig.js';
import { CURRENT_BOOK_METADATA } from '../../core/MockReaderAdapter.js';
import { retrieveSafeContext } from '../../recap-core/rag/retrieve.js';
import { generateQuestionPrompt } from '../../recap-core/prompt-question.js';
import { streamRecap } from '../../recap-core/ProviderRouter.js';

/**
 * "Ask a Question" panel — user types a free-text question about the book,
 * RAG context is retrieved, and the AI answers in a chat-style UI.
 * All answers are spoiler-safe (Amnesia Protocol).
 */
export default function QuestionPanel({ currentChapter, fileType = 'epub' }) {
    const { provider, activeKey } = useApiConfig();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef(null);

    const handleAsk = async () => {
        const question = input.trim();
        if (!question || isLoading) return;

        // Add user message
        setMessages(prev => [...prev, { role: 'user', text: question }]);
        setInput('');
        setIsLoading(true);

        try {
            // Determine RAG provider (same fallback logic as RecapOverlay)
            let ragProvider = provider;
            let ragKey = activeKey;

            if (provider === 'claude') {
                const geminiKey = localStorage.getItem('rekindle_gemini_key');
                const openAiKey = localStorage.getItem('rekindle_openai_key');
                if (geminiKey) { ragProvider = 'gemini'; ragKey = geminiKey; }
                else if (openAiKey) { ragProvider = 'openai'; ragKey = openAiKey; }
                else throw new Error('Need an OpenAI or Gemini key for RAG.');
            }

            // Retrieve context relevant to the question
            const chunks = await retrieveSafeContext(
                ragProvider, ragKey, question, currentChapter, 4
            );

            // Build system prompt with the question embedded
            const progressText = fileType === 'pdf' ? `Page ${currentChapter}` : `Chapter ${currentChapter}`;
            const basePrompt = generateQuestionPrompt(
                CURRENT_BOOK_METADATA.title,
                CURRENT_BOOK_METADATA.author,
                progressText
            );
            const fullPrompt = `${basePrompt}\n\nThe reader asks: "${question}"`;

            // Stream the answer
            let answer = '';
            // Add a placeholder assistant message
            setMessages(prev => [...prev, { role: 'assistant', text: '' }]);

            await streamRecap(
                provider, activeKey, fullPrompt, chunks,
                (chunkText) => {
                    answer += chunkText;
                    setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: 'assistant', text: answer };
                        return updated;
                    });
                }
            );

        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: `Sorry, I couldn't answer that: ${err.message}`,
                isError: true,
            }]);
        } finally {
            setIsLoading(false);
            // Scroll to bottom
            setTimeout(() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
            }, 50);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAsk();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Messages area */}
            <div ref={scrollRef} style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
            }}>
                {messages.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem',
                        marginTop: '40px',
                        opacity: 0.7,
                    }}>
                        <p style={{ marginBottom: '8px', fontSize: '1.1rem' }}>💬</p>
                        <p>Ask anything about the book so far.</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                            e.g. "Who is Duncan Idaho?" or "Why did they go to Arrakis?"
                        </p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            animation: 'fadeSlideIn 0.2s ease both',
                        }}
                    >
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                            background: msg.role === 'user'
                                ? 'var(--accent-color)'
                                : msg.isError
                                    ? 'rgba(239,68,68,0.1)'
                                    : 'rgba(255,255,255,0.06)',
                            color: msg.role === 'user' ? '#fff' : msg.isError ? 'var(--danger-color)' : 'var(--text-primary)',
                            fontSize: '0.92rem',
                            lineHeight: 1.6,
                            border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.06)',
                        }}>
                            {msg.text || (isLoading ? '...' : '')}
                        </div>
                        <div style={{
                            fontSize: '0.68rem',
                            color: 'var(--text-secondary)',
                            marginTop: '4px',
                            textAlign: msg.role === 'user' ? 'right' : 'left',
                            opacity: 0.5,
                        }}>
                            {msg.role === 'user' ? 'You' : 'AI'}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input area */}
            <div style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--surface-hover)',
                display: 'flex',
                gap: '10px',
                background: 'rgba(15, 23, 42, 0.4)',
            }}>
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about the book..."
                    disabled={isLoading}
                    style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontFamily: 'var(--font-family)',
                        outline: 'none',
                    }}
                />
                <button
                    onClick={handleAsk}
                    disabled={isLoading || !input.trim()}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isLoading || !input.trim() ? 'rgba(99,102,241,0.3)' : 'var(--accent-color)',
                        color: '#fff',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'background 0.15s',
                    }}
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}
