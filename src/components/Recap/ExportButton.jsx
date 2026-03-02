import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Export/copy button for the recap overlay.
 * Copies the raw recap markdown to clipboard.
 */
export default function ExportButton({ rawMarkdown }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(rawMarkdown);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = rawMarkdown;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!rawMarkdown) return null;

    return (
        <button
            onClick={handleCopy}
            title="Copy recap to clipboard"
            style={{
                background: 'none',
                border: 'none',
                color: copied ? 'var(--accent-color)' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                transition: 'color 0.2s',
            }}
        >
            {copied ? <><Check size={16} /> Copied!</> : <Copy size={16} />}
        </button>
    );
}
