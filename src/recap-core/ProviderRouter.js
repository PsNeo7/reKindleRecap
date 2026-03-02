import { fetchRecapStream as fetchOpenAI } from './api.js';
import { fetchClaudeStream as fetchClaude } from './api-claude.js';
import { fetchGeminiStream as fetchGemini } from './api-gemini.js';

/**
 * Routes the streaming request to the appropriate API provider.
 * 
 * @param {string} provider - 'openai', 'claude', or 'gemini'
 * @param {string} apiKey - The corresponding API key
 * @param {string} systemPrompt - The generated amniotic prompt
 * @param {Array} contextChunks - RAG retrieved chunks
 * @param {Function} onChunk - Streaming callback
 * @param {Function} onError - Error callback
 */
export async function streamRecap(provider, apiKey, systemPrompt, contextChunks, onChunk, onError) {
    switch (provider) {
        case 'claude':
            return fetchClaude(apiKey, systemPrompt, contextChunks, onChunk, onError);
        case 'gemini':
            return fetchGemini(apiKey, systemPrompt, contextChunks, onChunk, onError);
        case 'openai':
        default:
            return fetchOpenAI(apiKey, systemPrompt, contextChunks, onChunk, onError);
    }
}
