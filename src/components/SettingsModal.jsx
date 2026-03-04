import React, { useState } from 'react';
import { KeyRound, X, ChevronDown } from 'lucide-react';
import { useApiConfig } from '../core/useApiConfig.js';
import { streamRecap } from '../recap-core/ProviderRouter.js';

const PROVIDERS = [
    { id: 'openai', name: 'OpenAI (ChatGPT)' },
    { id: 'claude', name: 'Anthropic (Claude)' },
    { id: 'gemini', name: 'Google (Gemini)' },
];

export default function SettingsModal({ onClose }) {
    const { provider, setProvider, keys, setKey } = useApiConfig();

    // Local state for the UI before saving
    const [localProvider, setLocalProvider] = useState(provider);
    const [localKey, setLocalKey] = useState(keys[localProvider] || '');

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
