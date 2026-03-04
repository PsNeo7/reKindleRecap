import { fetchWithRetry } from './fetchWithRetry.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Fetches a streaming recap from OpenAI.
 * @param {string} apiKey - The OpenAI API key.
 * @param {string} systemPrompt - The strict Amnesia Prompt.
 * @param {Array} contextChunks - RAG retrieved chunks.
 * @param {Function} onChunk - Callback strictly for streamed markdown content.
 * @param {Function} [onError] - Error callback.
 */
export async function fetchRecapStream(apiKey, systemPrompt, contextChunks = [], onChunk, onError) {
    const messages = [
        { role: 'system', content: systemPrompt }
    ];

    if (contextChunks && contextChunks.length > 0) {
        const contextText = contextChunks.map(c => c.text).join("\n\n---\n\n");
        messages.push({
            role: 'user',
            content: `Here are the exact text excerpts from the book you MUST use to generate the recap:\n\n${contextText}`
        });
    }

    messages.push({
        role: 'user',
        content: 'Please provide the requested plot summary and character roster strictly in the requested markdown format, without outputting any other conversational text.'
    });

    try {
        const response = await fetchWithRetry(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                temperature: 0.3, // Lower temperature to strictly adhere to instructions
                stream: true,
            }),
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Unauthorized: Invalid OpenAI API Key.');
            }
            const errorText = await response.text();
            throw new Error(`OpenAI API Error (${response.status}): ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
                            onChunk(data.choices[0].delta.content);
                        }
                    } catch (e) {
                        console.warn("Error parsing JSON chunk from OpenAI stream:", line, e);
                    }
                }
            }
        }
    } catch (err) {
        console.error("fetchRecapStream encountered an error:", err);
        if (onError) onError(err);
        throw err; // Re-throw so callers know the stream failed
    }
}
