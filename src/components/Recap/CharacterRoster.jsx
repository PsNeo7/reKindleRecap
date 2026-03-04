import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const avatarColors = [
    'rgba(99,102,241,0.85)',   // indigo
    'rgba(16,185,129,0.85)',   // emerald
    'rgba(245,158,11,0.85)',   // amber
    'rgba(239,68,68,0.85)',    // red
    'rgba(59,130,246,0.85)',   // blue
    'rgba(168,85,247,0.85)',   // violet
    'rgba(236,72,153,0.85)',   // pink
];

/**
 * A single expandable character card.
 * Shows name + one-line summary. Clicking expands to reveal
 * the character's arc events as a mini chronological timeline.
 */
function CharacterCard({ char, colorIndex, isStreamingTarget }) {
    const [open, setOpen] = useState(false);
    const color = avatarColors[colorIndex % avatarColors.length];

    const initials = char.name
        .split(' ')
        .slice(0, 2)
        .map(w => w[0] || '')
        .join('')
        .toUpperCase();

    const hasArc = char.arc && char.arc.length > 0;

    return (
        <div
            style={{
                background: open ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${open ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '12px',
                overflow: 'hidden',
                transition: 'border-color 0.2s, background 0.2s',
                animation: isStreamingTarget && !open ? 'pulseOpacity 2s infinite' : 'none',
            }}
        >
            {/* Card header — always visible, clickable */}
            <button
                onClick={() => hasArc && setOpen(o => !o)}
                style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    cursor: hasArc ? 'pointer' : 'default',
                    textAlign: 'left',
                    fontFamily: 'var(--font-family)',
                }}
            >
                {/* Avatar */}
                <div style={{
                    flexShrink: 0,
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '0.05em',
                    boxShadow: open ? `0 0 14px ${color.replace('0.85', '0.4')}` : 'none',
                    transition: 'box-shadow 0.2s',
                }}>
                    {initials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontWeight: 600,
                        fontSize: '1rem',
                        color: 'var(--text-primary)',
                        marginBottom: '4px',
                    }}>
                        {char.name}
                    </div>
                    <p className={isStreamingTarget ? 'typing-glow-active' : ''} style={{
                        margin: 0,
                        fontSize: '0.85rem',
                        color: isStreamingTarget ? 'var(--text-primary)' : 'var(--text-secondary)',
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: open ? 'unset' : 2,
                        WebkitBoxOrient: 'vertical',
                    }}>
                        {char.summary || '—'}
                    </p>
                </div>

                {/* Expand toggle — only shown if arc data exists */}
                {hasArc && (
                    <div style={{
                        flexShrink: 0,
                        color: 'var(--accent-color)',
                        opacity: 0.7,
                        transition: 'opacity 0.2s',
                    }}>
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                )}
            </button>

            {/* Arc timeline — shown when expanded */}
            {open && hasArc && (
                <div style={{
                    padding: '0 20px 20px 20px',
                    animation: 'fadeSlideIn 0.2s ease both',
                }}>
                    <div style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--accent-color)',
                        marginBottom: '14px',
                        paddingLeft: '58px', // align with name text
                        opacity: 0.75,
                    }}>
                        Character Arc
                    </div>

                    <div style={{ position: 'relative', paddingLeft: '26px' }}>
                        {/* Spine */}
                        <div style={{
                            position: 'absolute',
                            left: '5px',
                            top: '8px',
                            bottom: '8px',
                            width: '2px',
                            background: `linear-gradient(to bottom, ${color.replace('0.85', '0.7')}, ${color.replace('0.85', '0.1')})`,
                            borderRadius: '2px',
                        }} />

                        {char.arc.map((beat, i) => (
                            <div
                                key={i}
                                style={{
                                    position: 'relative',
                                    marginBottom: i === char.arc.length - 1 ? 0 : '12px',
                                    animation: `fadeSlideIn 0.25s ease both${isStreamingTarget && i === char.arc.length - 1 ? ', pulseOpacity 2s infinite' : ''}`,
                                    animationDelay: `${i * 50}ms`,
                                }}
                            >
                                {/* Dot */}
                                <div style={{
                                    position: 'absolute',
                                    left: '-22px',
                                    top: '7px',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: color.replace('0.85', i === 0 ? '0.9' : '0.45'),
                                    border: `1px solid ${color.replace('0.85', '0.3')}`,
                                }} />

                                <p className={isStreamingTarget && i === char.arc.length - 1 ? 'typing-glow-active' : ''} style={{
                                    margin: 0,
                                    fontSize: '0.87rem',
                                    color: i === 0 && !isStreamingTarget ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    lineHeight: 1.6,
                                    transition: 'color 0.5s ease',
                                }}>
                                    {beat}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Tap to collapse hint */}
                    <div style={{
                        marginTop: '16px',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        opacity: 0.5,
                        textAlign: 'center',
                    }}>
                        Tap card to collapse
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Character roster — renders a list of expandable CharacterCard components.
 * Accepts an array of character objects: { name, summary, arc[] }
 */
export default function CharacterRoster({ characters, isStreaming }) {
    if ((!characters || characters.length === 0) && isStreaming) {
        return (
            <div style={{ padding: '32px 12px', display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeSlideIn 0.3s ease both' }}>
                <div className="streaming-skeleton-line" style={{ width: '100%', height: '80px', borderRadius: '12px', marginBottom: 0 }} />
                <div className="streaming-skeleton-line" style={{ width: '100%', height: '80px', borderRadius: '12px', marginBottom: 0, opacity: 0.7 }} />
                <div className="streaming-skeleton-line" style={{ width: '100%', height: '80px', borderRadius: '12px', marginBottom: 0, opacity: 0.4 }} />
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <span className="typing-glow-active" style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Extracting Characters
                    </span>
                </div>
            </div>
        );
    }

    if (!characters || characters.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {characters.map((char, i) => (
                <CharacterCard
                    key={char.name}
                    char={char}
                    colorIndex={i}
                    isStreamingTarget={isStreaming && i === characters.length - 1}
                />
            ))}
        </div>
    );
}
