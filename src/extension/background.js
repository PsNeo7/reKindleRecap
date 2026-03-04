/**
 * Rekindle Background Service Worker
 * Handles AI API calls and Vector Storage
 */

// Initial state
let apiKey = null;
let provider = 'gemini';

// Listener for messages from Content Script
import { db } from './vector_db_extension.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_RECAP') {
        handleRecapRequest(message.payload, sendResponse);
        return true; // Keep channel open
    }

    if (message.type === 'GET_INDEX_COUNT') {
        db.getChunks(message.payload.asin).then(chunks => {
            sendResponse({ count: chunks.length });
        });
        return true;
    }

    if (message.type === 'INDEX_TEXT') {
        const { asin, text, title } = message.payload;
        db.addChunk(asin, text, title);
        console.log(`Rekindle: Indexed ${text.length} chars for ${title}`);
        return false;
    }
});

async function handleRecapRequest(payload, sendResponse) {
    const { title, text } = payload;
    const asin = title; // For now use title as the key if ASIN isn't easily reachable
    console.log(`Rekindle: Requesting recap for "${title}"`);

    try {
        // 1. Get API Config
        const config = await chrome.storage.local.get(['apiKey']);
        const activeKey = config.apiKey;

        if (!activeKey) {
            sendResponse({ error: "API Key missing. Click the extension icon to set it up." });
            return;
        }

        // 2. Retrieve history from Vector DB
        const chunks = await db.getChunks(asin);
        const historyText = chunks.length > 0
            ? chunks.map(c => c.text).join("\n\n---\n\n")
            : text; // Fallback to current page only if no history

        console.log(`Rekindle: Using ${chunks.length} historical chunks for context.`);

        // 3. List of endpoints to try in order of stability
        const attempts = [
            { ver: 'v1beta', model: 'gemini-2.5-flash' },
            { ver: 'v1', model: 'gemini-2.5-flash' },
            { ver: 'v1beta', model: 'gemini-1.5-flash' }
        ];

        let lastError = null;

        for (const attempt of attempts) {
            try {
                const url = `https://generativelanguage.googleapis.com/${attempt.ver}/models/${attempt.model}:generateContent?key=${activeKey}`;
                console.log(`Rekindle: Trying ${attempt.ver}/${attempt.model}...`);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `You are an AI assistant. Based on these excerpts from the book "${title}", provide a concise recap of the narrative so far. Focus on the main characters and current plot progress:\n\n${historyText}`
                            }]
                        }]
                    })
                });

                const data = await response.json();

                if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    console.log(`Rekindle: Success with ${attempt.model}`);
                    sendResponse({ recap: data.candidates[0].content.parts[0].text });
                    return;
                }

                lastError = data.error?.message || "Empty response";
                console.warn(`Rekindle: ${attempt.model} failed:`, lastError);
            } catch (e) {
                lastError = e.message;
            }
        }

        sendResponse({ error: `Recap failed. ${lastError}` });

    } catch (globalError) {
        console.error("Rekindle: Global Error", globalError);
        sendResponse({ error: globalError.message });
    }
}
