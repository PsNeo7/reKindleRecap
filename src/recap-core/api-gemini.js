import { fetchWithRetry } from './fetchWithRetry.js';

/**
 * Fetches a streaming recap from Google's Gemini.
 */
export async function fetchGeminiStream(apiKey, systemPrompt, contextChunks = [], onChunk, onError) {
    const targetModel = "models/gemini-2.5-flash"; // Hardcoded to prevent 429 auto-discovery spam
    const modelUrlId = targetModel.replace('models/', '');
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelUrlId}:streamGenerateContent?key=${apiKey}`;

    let userContent = "Please provide the requested plot summary and character roster strictly in the requested markdown format, without outputting any other conversational text.";

    if (contextChunks && contextChunks.length > 0) {
        const contextText = contextChunks.map(c => c.text).join("\n\n---\n\n");
        userContent = `Here are the exact text excerpts from the book you MUST use to generate the recap:\n\n${contextText}\n\n${userContent}`;
    }

    try {
        const response = await fetchWithRetry(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: [{
                    role: "user",
                    parts: [{ text: userContent }]
                }],
                generationConfig: {
                    temperature: 0.3
                }
            }),
        });

        if (!response.ok) {
            if (response.status === 400 && (await response.clone().text()).includes('API key not valid')) {
                throw new Error('Unauthorized: Invalid Gemini API Key.');
            }
            const errorText = await response.text();
            throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        // Gemini's stream format is an array of JSON objects sent progressively. 
        // It looks like:
        // [
        //   { "candidates": [ { "content": { "parts": [{ "text": "Hello" }] } } ] }
        // ,
        //   { "candidates": [ { "content": { "parts": [{ "text": " world" }] } } ] }
        // ]

        // This regex aggressively grabs just the "text" values out of the raw stream to bypass brittle JSON chunking logic
        const textRegex = /"text":\s*"((?:[^"\\]|\\.)*)"/g;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkString = decoder.decode(value, { stream: true });

            let match;
            while ((match = textRegex.exec(chunkString)) !== null) {
                if (match[1]) {
                    // Unescape JSON string characters (e.g. \n, \", etc)
                    try {
                        const parsedStr = JSON.parse(`"${match[1]}"`);
                        onChunk(parsedStr);
                    } catch (e) {
                        // Fallback in case of weird escaping
                        onChunk(match[1]);
                    }
                }
            }
        }
    } catch (err) {
        console.error("fetchGeminiStream encountered an error:", err);
        if (onError) onError(err);
        throw err; // Re-throw so callers know the stream failed
    }
}
