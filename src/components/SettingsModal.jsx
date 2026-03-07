import React, { useState } from 'react';
import { KeyRound, X, ChevronDown } from 'lucide-react';
import { useApiConfig } from '../core/useApiConfig.js';
import { streamRecap } from '../recap-core/ProviderRouter.js';
import './SettingsModal.css';

const PROVIDERS = [
    { id: 'openai', name: 'OpenAI (ChatGPT)' },
    { id: 'claude', name: 'Anthropic (Claude)' },
    { id: 'gemini', name: 'Google (Gemini)' },
];

export default function SettingsModal({ onClose }) {
    const { provider, setProvider, keys, setKey } = useApiConfig();

    const [localProvider, setLocalProvider] = useState(provider);
    const [localKey, setLocalKey] = useState(keys[localProvider] || '');

    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState('');
    const [testError, setTestError] = useState(false);

    const handleProviderChange = (e) => {
        const newProv = e.target.value;
        setLocalProvider(newProv);
        setLocalKey(keys[newProv] || '');
        setTestStatus('');
    };

    const handleSave = () => {
        setProvider(localProvider);
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
        <div className="settings-backdrop animate-in" style={{
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(0,0,0,0.4)'
        }}>
            <div className="glass-premium settings-modal">
                <div className="settings-header">
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                        <KeyRound size={22} style={{ color: 'var(--accent-color)' }} /> AI Configuration
                    </h2>
                    <button onClick={onClose} className="settings-close-btn"><X size={20} /></button>
                </div>

                <div className="settings-body">
                    <p className="settings-info-text">
                        Rekindle Recap requires a Bring-Your-Own-Key (BYOK) setup for privacy. Your API keys are stored securely in your browser's local storage and never sent anywhere else.
                    </p>

                    <div className="settings-field">
                        <label className="settings-label">AI Provider</label>
                        <div className="settings-select-wrapper">
                            <select
                                className="settings-select"
                                value={localProvider}
                                onChange={handleProviderChange}
                            >
                                {PROVIDERS.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="settings-select-icon" />
                        </div>
                    </div>

                    <div className="settings-field">
                        <label className="settings-label">
                            {PROVIDERS.find(p => p.id === localProvider)?.name} API Key
                        </label>
                        <div className="settings-input-group">
                            <input
                                className="settings-input"
                                type="password"
                                value={localKey}
                                onChange={(e) => setLocalKey(e.target.value)}
                                placeholder={localProvider === 'gemini' ? 'AIza...' : localProvider === 'claude' ? 'sk-ant-...' : 'sk-proj-...'}
                            />
                            <button
                                className="btn-secondary"
                                onClick={handleTestConnection}
                                disabled={isTesting}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                {isTesting ? 'Testing...' : 'Test Connection'}
                            </button>
                        </div>
                        {testStatus && (
                            <div className={`settings-test-status ${testError ? 'error' : 'success'}`}>
                                {testStatus}
                            </div>
                        )}
                    </div>
                </div>

                <div className="settings-footer">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={handleSave}>Save Settings</button>
                </div>
            </div>
        </div>
    );
}
