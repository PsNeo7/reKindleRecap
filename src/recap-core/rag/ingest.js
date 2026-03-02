import { globalVectorStore } from '../../core/VectorDB.js';

/**
 * Fetches embeddings for an array of texts. Supports OpenAI and Gemini.
 */
export async function fetchEmbeddings(provider, apiKey, texts) {
    if (provider === 'gemini') {
        // First, let's discover the best available embedding model for this specific API key
        const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        let targetModel = "models/text-embedding-004"; // Fallback default
        let modelUrlId = "text-embedding-004";

        if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            if (modelsData && modelsData.models) {
                const embedModels = modelsData.models.filter(m =>
                    m.supportedGenerationMethods && m.supportedGenerationMethods.includes('embedContent')
                );

                if (embedModels.length > 0) {
                    // Prefer text-embedding-004, otherwise take whatever is available
                    const preferred = embedModels.find(m => m.name.includes('text-embedding-004'));
                    targetModel = preferred ? preferred.name : embedModels[0].name;
                    modelUrlId = targetModel.replace('models/', '');
                }
            }
        }

        const requests = texts.map(text => ({
            model: targetModel,
            content: { parts: [{ text }] }
        }));

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelUrlId}:batchEmbedContents?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini Embedding error: ${response.status} - ${err}`);
        }

        const data = await response.json();
        return data.embeddings.map(d => d.values);
    }

    // Default to OpenAI
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: texts,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI Embedding error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.data.map(d => d.embedding);
}

/**
 * Simulates the ingestion of a book into the VectorDB.
 * Requires an array of chunks: { text: "...", metadata: { chapterIndex: 1 } }
 */
export async function ingestBookChunks(provider, apiKey, chunks) {
    console.log(`Ingesting ${chunks.length} chunks into local VectorDB using ${provider}...`);

    const texts = chunks.map(c => c.text);
    const vectors = await fetchEmbeddings(provider, apiKey, texts);

    const documents = chunks.map((chunk, idx) => ({
        id: `chunk_${idx}_${Date.now()}`,
        text: chunk.text,
        metadata: chunk.metadata,
        vector: vectors[idx]
    }));

    await globalVectorStore.addDocuments(documents);
    console.log('Ingestion complete!');
}
