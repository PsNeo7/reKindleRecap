import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';

// Number of recent events shown before the "show more" fold
const INITIAL_VISIBLE = 3;

/**
 * Renders the plot summary as a reverse-chronological timeline.
 * The most recent events are shown first; older events are hidden
 * behind a progressive-reveal toggle so the user digs back in time.
 */
export default function PlotSummary({ markdown, isStreaming }) {
    const [expanded, setExpanded] = useState(false);

    if (!markdown && isStreaming) {
        return (
            <div style={{ padding: '32px 12px', color: 'var(--text-secondary)', animation: 'fadeSlideIn 0.3s ease both' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
                    <div className="streaming-skeleton-line" style={{ width: '80%' }} />
                    <div className="streaming-skeleton-line" style={{ width: '64%' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
                    <div className="streaming-skeleton-line" style={{ width: '70%' }} />
                    <div className="streaming-skeleton-line" style={{ width: '90%' }} />
                    <div className="streaming-skeleton-line" style={{ width: '50%' }} />
                </div>
                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <span className="typing-glow-active" style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Synthesizing Timeline
                    </span>
                </div>
            </div>
        );
    }

    if (!markdown) return null;

    // Parse bullet lines, skipping stray headers
    const lines = markdown.split('\n');
    const events = [];
    let currentEvent = '';

    for (const line of lines) {
        if (line.trimStart().startsWith('#')) continue;

        // If it looks like a new bullet
        if (/^[-*]\s+/.test(line.trimStart())) {
            if (currentEvent.trim()) events.push(currentEvent.trim().replace(/\*\*/g, ''));
            currentEvent = line.trimStart().replace(/^[-*]\s+/, '');
        } else {
            // Continuation of a bullet
            const text = line.trim();
            if (text.length > 0) {
                currentEvent += ' ' + text;
            }
        }
    }
    if (currentEvent.trim()) events.push(currentEvent.trim().replace(/\*\*/g, ''));

    // Strip out stray ### fragments that might have leaked into the text inline
    for (let i = 0; i < events.length; i++) {
        const headerIdx = events[i].indexOf('###');
        if (headerIdx !== -1) {
            events[i] = events[i].substring(0, headerIdx).trim();
        }
    }

    // Filter out empties that might have resulted from stripping
    const finalEvents = events.filter(e => e.length > 0);

    if (finalEvents.length === 0) {
        return (
            <div style={{ padding: '24px', color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1rem' }}>
                {markdown}
            </div>
        );
    }

    // Reverse so the most recent (last from AI) is index 0
    const reversed = [...finalEvents].reverse();
    const olderCount = Math.max(0, reversed.length - INITIAL_VISIBLE);
    const visibleEvents = expanded ? reversed : reversed.slice(0, INITIAL_VISIBLE);

    return (
        <div>
            {/* Recency label */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '20px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: 500,
            }}>
                <Clock size={13} />
                Most Recent First
            </div>

            <div style={{ position: 'relative', paddingLeft: '36px' }}>
                {/* Spine — gradient fades towards the past (bottom) */}
                <div style={{
                    position: 'absolute',
                    left: '11px',
                    top: '16px',
                    bottom: '16px',
                    width: '2px',
                    background: 'linear-gradient(to bottom, var(--accent-color) 0%, rgba(99,102,241,0.1) 100%)',
                    borderRadius: '2px',
                }} />

                {visibleEvents.map((event, i) => {
                    const isNewest = i === 0;
                    // Original chronological index (for label)
                    const chronoLabel = reversed.length - i;

                    return (
                        <div
                            key={i}
                            style={{
                                position: 'relative',
                                marginBottom: i === visibleEvents.length - 1 ? 0 : '16px',
                                animation: `fadeSlideIn 0.3s ease both`,
                                animationDelay: `${i * 40}ms`,
                            }}
                        >
                            {/* Dot */}
                            <div style={{
                                position: 'absolute',
                                left: '-30px',
                                top: '18px',
                                width: isNewest ? '12px' : '9px',
                                height: isNewest ? '12px' : '9px',
                                marginLeft: isNewest ? '-1px' : '0',
                                borderRadius: '50%',
                                background: isNewest
                                    ? 'var(--accent-color)'
                                    : `rgba(99,102,241,${Math.max(0.15, 0.5 - i * 0.08)})`,
                                border: isNewest
                                    ? '2px solid rgba(99,102,241,0.5)'
                                    : '2px solid rgba(99,102,241,0.15)',
                                boxShadow: isNewest ? '0 0 12px rgba(99,102,241,0.7)' : 'none',
                            }} />

                            {/* Card */}
                            <div style={{
                                background: isNewest
                                    ? 'rgba(99,102,241,0.1)'
                                    : `rgba(255,255,255,${Math.max(0.015, 0.035 - i * 0.006)})`,
                                border: `1px solid ${isNewest ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)'}`,
                                borderRadius: '10px',
                                padding: '13px 16px',
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '6px',
                                }}>
                                    {isNewest && (
                                        <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            letterSpacing: '0.1em',
                                            textTransform: 'uppercase',
                                            background: 'var(--accent-color)',
                                            color: '#fff',
                                            padding: '2px 7px',
                                            borderRadius: '4px',
                                        }}>
                                            Latest
                                        </span>
                                    )}
                                    <span style={{
                                        fontSize: '0.68rem',
                                        color: isNewest ? 'var(--accent-color)' : 'var(--text-secondary)',
                                        fontWeight: 600,
                                        letterSpacing: '0.07em',
                                        textTransform: 'uppercase',
                                        opacity: isNewest ? 1 : 0.6,
                                    }}>
                                        Event {chronoLabel}
                                    </span>
                                </div>
                                <p className={isStreaming && isNewest ? 'typing-glow-active' : (isStreaming ? 'typing-glow-dimmed' : '')}
                                    style={{
                                        margin: 0,
                                        fontSize: '0.96rem',
                                        color: isNewest && !isStreaming ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        lineHeight: 1.7,
                                        transition: 'color 0.5s ease',
                                    }}>
                                    {event}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Progressive reveal toggle — only shown when there are older events */}
            {olderCount > 0 && (
                <button
                    onClick={() => setExpanded(e => !e)}
                    style={{
                        marginTop: '20px',
                        marginLeft: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        background: 'rgba(99,102,241,0.07)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: '8px',
                        color: 'var(--accent-color)',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        fontFamily: 'var(--font-family)',
                        padding: '9px 16px',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        width: 'calc(100% - 36px)',
                        justifyContent: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.14)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.07)'}
                >
                    {expanded
                        ? <><ChevronUp size={15} /> Hide earlier events</>
                        : <><ChevronDown size={15} /> Show {olderCount} earlier event{olderCount !== 1 ? 's' : ''}</>
                    }
                </button>
            )}
        </div>
    );
}
