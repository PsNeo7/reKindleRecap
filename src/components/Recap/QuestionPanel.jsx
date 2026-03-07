import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { useApiConfig } from '../../core/useApiConfig.js';

import { retrieveSafeContext } from '../../recap-core/rag/retrieve.js';
import { generateQuestionPrompt } from '../../recap-core/prompt-question.js';
import { streamRecap } from '../../recap-core/ProviderRouter.js';

/**
 * "Ask a Question" panel — user types a free-text question about the book,
 * RAG context is retrieved, and the AI answers in a chat-style UI.
 * All answers are spoiler-safe (Amnesia Protocol).
 */
export default function QuestionPanel({ currentChapter, fileType = 'epub', bookKey, messages, setMessages }) {
    const { provider, activeKey } = useApiConfig();
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef(null);

    const handleAsk = async () => {
        const question = input.trim();
        if (!question || isLoading) return;

        setMessages(prev => [...prev, { role: 'user', text: question }]);
        setInput('');
        setIsLoading(true);

        try {
            let ragProvider = provider;
            let ragKey = activeKey;

            if (provider === 'claude') {
                const geminiKey = localStorage.getItem('rekindle_gemini_key');
                const openAiKey = localStorage.getItem('rekindle_openai_key');
                if (geminiKey) { ragProvider = 'gemini'; ragKey = geminiKey; }
                else if (openAiKey) { ragProvider = 'openai'; ragKey = openAiKey; }
                else throw new Error('Need an OpenAI or Gemini key for RAG.');
            }

            const chunks = await retrieveSafeContext(
                ragProvider, ragKey, question, currentChapter, 4
            );

            const progressText = fileType === 'pdf' ? `Page ${currentChapter}` : `Chapter ${currentChapter}`;
            const basePrompt = generateQuestionPrompt(
                bookKey || "Unknown Book",
                "",
                progressText
            );
            const fullPrompt = `${basePrompt}\n\nThe reader asks: "${question}"`;

            let answer = '';
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

    const renderMessageText = (text) => {
        if (!text) return null;

        const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={i} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return (
                    <code key={i} className="inline-code">
                        {part.slice(1, -1)}
                    </code>
                );
            }
            return part.split('\n').map((line, j) => (
                <React.Fragment key={`${i}-${j}`}>
                    {j > 0 && <br />}
                    {line}
                </React.Fragment>
            ));
        });
    };

    return (
        <div className="chat-container">
            <div ref={scrollRef} className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <p style={{ marginBottom: '12px', fontSize: '1.5rem' }}>💬</p>
                        <p style={{ fontWeight: 500 }}>The Oracle is listening.</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '8px', maxWidth: '240px', margin: '8px auto' }}>
                            Ask anything about characters or plot points encountered so far.
                        </p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`chat-bubble-container ${msg.role}`}
                    >
                        <div className={`chat-bubble ${msg.role} ${msg.isError ? 'error' : ''}`}>
                            {msg.text ? renderMessageText(msg.text) : (isLoading ? <span className="typing-glow-active">...</span> : '')}
                        </div>
                        <div className="chat-meta">
                            {msg.role === 'user' ? 'Reader' : 'Oracle'}
                        </div>
                    </div>
                ))}
            </div>

            <div className="chat-input-area">
                <input
                    className="chat-input"
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about the book..."
                    disabled={isLoading}
                />
                <button
                    className="chat-send-btn"
                    onClick={handleAsk}
                    disabled={isLoading || !input.trim()}
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}
