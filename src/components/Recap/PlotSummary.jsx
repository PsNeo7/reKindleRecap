import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';

const INITIAL_VISIBLE = 3;

export default function PlotSummary({ markdown, isStreaming }) {
    const [expanded, setExpanded] = useState(false);

    if (!markdown && isStreaming) {
        return (
            <div className="skeleton-container" style={{ padding: '24px 12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                    <div className="skeleton" style={{ width: '80%', height: '12px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ width: '64%', height: '12px', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                    <div className="skeleton" style={{ width: '70%', height: '12px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ width: '90%', height: '12px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ width: '50%', height: '12px', borderRadius: '4px' }} />
                </div>
                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <span className="typing-glow-active" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        Synthesizing Timeline
                    </span>
                </div>
            </div>
        );
    }

    if (!markdown) return null;

    const lines = markdown.split('\n');
    const events = [];
    let currentEvent = '';

    for (const line of lines) {
        if (line.trimStart().startsWith('#')) continue;
        if (/^[-*]\s+/.test(line.trimStart())) {
            if (currentEvent.trim()) events.push(currentEvent.trim().replace(/\*\*/g, ''));
            currentEvent = line.trimStart().replace(/^[-*]\s+/, '');
        } else {
            const text = line.trim();
            if (text.length > 0) {
                currentEvent += ' ' + text;
            }
        }
    }
    if (currentEvent.trim()) events.push(currentEvent.trim().replace(/\*\*/g, ''));

    for (let i = 0; i < events.length; i++) {
        const headerIdx = events[i].indexOf('###');
        if (headerIdx !== -1) {
            events[i] = events[i].substring(0, headerIdx).trim();
        }
    }

    const finalEvents = events.filter(e => e.length > 0);

    if (finalEvents.length === 0) {
        return (
            <div style={{ padding: '20px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {markdown}
            </div>
        );
    }

    const reversed = [...finalEvents].reverse();
    const olderCount = Math.max(0, reversed.length - INITIAL_VISIBLE);
    const visibleEvents = expanded ? reversed : reversed.slice(0, INITIAL_VISIBLE);

    return (
        <div className="animate-in">
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: '0.05em'
            }}>
                <Clock size={14} />
                Recent Progress
            </div>

            <div style={{ position: 'relative', paddingLeft: '32px' }}>
                <div style={{
                    position: 'absolute',
                    left: '11px',
                    top: '12px',
                    bottom: '12px',
                    width: '2px',
                    background: 'linear-gradient(to bottom, var(--accent-color) 0%, var(--surface-hover) 100%)',
                    borderRadius: '2px',
                }} />

                {visibleEvents.map((event, i) => {
                    const isNewest = i === 0;
                    const chronoLabel = reversed.length - i;

                    return (
                        <div
                            key={i}
                            className={`timeline-event-card ${isNewest ? 'latest' : ''}`}
                            style={{
                                position: 'relative',
                                animation: `fadeSlideIn 0.3s ease both`,
                                animationDelay: `${i * 50}ms`,
                            }}
                        >
                            <div style={{
                                position: 'absolute',
                                left: '-41px',
                                top: '18px',
                                width: isNewest ? '12px' : '8px',
                                height: isNewest ? '12px' : '8px',
                                borderRadius: '50%',
                                background: isNewest ? 'var(--accent-color)' : 'var(--surface-hover)',
                                boxShadow: isNewest ? '0 0 10px var(--accent-color)' : 'none',
                                border: isNewest ? '2px solid rgba(255,255,255,0.2)' : 'none'
                            }} />

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                {isNewest && (
                                    <span style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        background: 'var(--accent-color)',
                                        color: '#fff',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        textTransform: 'uppercase'
                                    }}>Latest</span>
                                )}
                                <span style={{
                                    fontSize: '0.7rem',
                                    color: isNewest ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                }}>Point {chronoLabel}</span>
                            </div>
                            <p className={isStreaming && isNewest ? 'typing-glow-active' : ''}
                                style={{
                                    margin: 0,
                                    fontSize: '0.94rem',
                                    color: isNewest ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    lineHeight: 1.6,
                                }}>
                                {event}
                            </p>
                        </div>
                    );
                })}
            </div>

            {olderCount > 0 && (
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="btn-secondary"
                    style={{
                        marginTop: '16px',
                        marginLeft: '32px',
                        width: 'calc(100% - 32px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px'
                    }}
                >
                    {expanded ? <><ChevronUp size={16} /> Hide earlier</> : <><ChevronDown size={16} /> Show {olderCount} more</>}
                </button>
            )}
        </div>
    );
}
