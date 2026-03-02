import { useState, useEffect } from 'react';

const STORAGE_KEY_PROVIDER = 'rekindle_ai_provider';
const STORAGE_KEY_OPENAI = 'rekindle_openai_key';
const STORAGE_KEY_CLAUDE = 'rekindle_claude_key';
const STORAGE_KEY_GEMINI = 'rekindle_gemini_key';

export function useApiConfig() {
    const [provider, setProviderState] = useState(() => localStorage.getItem(STORAGE_KEY_PROVIDER) || 'openai');
    const [keys, setKeys] = useState(() => ({
        openai: localStorage.getItem(STORAGE_KEY_OPENAI) || '',
        claude: localStorage.getItem(STORAGE_KEY_CLAUDE) || '',
        gemini: localStorage.getItem(STORAGE_KEY_GEMINI) || ''
    }));

    const setProvider = (newProvider) => {
        localStorage.setItem(STORAGE_KEY_PROVIDER, newProvider);
        setProviderState(newProvider);
    };

    const setKey = (providerName, key) => {
        const storageKey = providerName === 'openai' ? STORAGE_KEY_OPENAI
            : providerName === 'claude' ? STORAGE_KEY_CLAUDE
                : STORAGE_KEY_GEMINI;

        if (key) {
            localStorage.setItem(storageKey, key);
        } else {
            localStorage.removeItem(storageKey);
        }

        setKeys(prev => ({ ...prev, [providerName]: key || '' }));
    };

    const activeKey = keys[provider];

    return {
        provider,
        setProvider,
        keys,
        setKey,
        activeKey,
        hasActiveKey: !!activeKey
    };
}
