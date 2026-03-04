import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const avatarColors = [
    'var(--accent-color)',
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#3b82f6', // blue
    '#a855f7', // violet
    '#ec4899', // pink
];

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
            className={`timeline-event-card character-card ${open ? 'latest' : ''}`}
            style={{
                animation: isStreamingTarget && !open ? 'pulseOpacity 2s infinite' : 'none',
            }}
        >
            <button
                className="character-card-header"
                onClick={() => hasArc && setOpen(o => !o)}
                style={{ cursor: hasArc ? 'pointer' : 'default' }}
            >
                <div
                    className="character-avatar"
                    style={{
                        background: color,
                        boxShadow: open ? `0 0 14px ${color}66` : 'none'
                    }}
                >
                    {initials}
                </div>

                <div className="character-info">
                    <div className="character-name">{char.name}</div>
                    <p className={`character-summary ${isStreamingTarget ? 'typing-glow-active' : ''}`}
                        style={{ WebkitLineClamp: open ? 'unset' : 1, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {char.summary || '—'}
                    </p>
                </div>

                {hasArc && (
                    <div style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                )}
            </button>

            {open && hasArc && (
                <div className="character-arc-container">
                    <div className="character-arc-title">Character Arc</div>

                    <div className="character-arc-timeline">
                        <div className="character-arc-spine" style={{ background: color }} />

                        {char.arc.map((beat, i) => (
                            <div
                                key={i}
                                className="character-beat"
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                <div
                                    className="character-beat-dot"
                                    style={{
                                        background: color,
                                        opacity: i === 0 ? 0.9 : 0.4
                                    }}
                                />
                                <p className="character-beat-text">{beat}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CharacterRoster({ characters, isStreaming }) {
    if ((!characters || characters.length === 0) && isStreaming) {
        return (
            <div className="skeleton-container" style={{ padding: '24px 12px', gap: '16px' }}>
                <div className="skeleton" style={{ width: '100%', height: '70px', borderRadius: '12px' }} />
                <div className="skeleton" style={{ width: '100%', height: '70px', borderRadius: '12px', opacity: 0.6 }} />
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <span className="typing-glow-active" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        Extracting Characters
                    </span>
                </div>
            </div>
        );
    }

    if (!characters || characters.length === 0) return null;

    return (
        <div className="character-list">
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
