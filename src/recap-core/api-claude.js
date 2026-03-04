import { fetchWithRetry } from './fetchWithRetry.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Fetches a streaming recap from Anthropic's Claude.
 * Note: Browser fetch to Anthropic API often fails due to CORS. 
 * For a production app, this usually requires a proxy backend.
 * For this MVP BYOK local version, we assume the user has a proxy or browser extension,
 * OR we use anthropic-dangerously-allow-browser (not recommended, but often done for BYOK tools).
 * We will enforce passing the 'anthropic-version' header.
 */
export async function fetchClaudeStream(apiKey, systemPrompt, contextChunks = [], onChunk, onError) {
    let userContent = "Please provide the requested plot summary and character roster strictly in the requested markdown format, without outputting any other conversational text.";

    if (contextChunks && contextChunks.length > 0) {
        const contextText = contextChunks.map(c => c.text).join("\n\n---\n\n");
        userContent = `Here are the exact text excerpts from the book you MUST use to generate the recap:\n\n${contextText}\n\n${userContent}`;
    }

    try {
        const response = await fetchWithRetry(CLAUDE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                // Required for browser-based CORS requests to Anthropic if allowed by the key
                'anthropic-dangerously-allow-browser': 'true'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1000,
                temperature: 0.3,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userContent }
                ],
                stream: true,
            }),
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Unauthorized: Invalid Anthropic API Key.');
            }
            const errorText = await response.text();
            throw new Error(`Anthropic API Error (${response.status}): ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (!dataStr) continue;

                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
                            onChunk(data.delta.text);
                        }
                    } catch (e) {
                        // Ignore parse errors for incomplete chunks
                    }
                }
            }
        }
    } catch (err) {
        console.error("fetchClaudeStream encountered an error:", err);
        if (onError) onError(err);
        throw err; // Re-throw so callers know the stream failed
    }
}
