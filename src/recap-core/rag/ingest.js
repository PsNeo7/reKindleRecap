import { globalVectorStore } from '../../core/VectorDB.js';
import { fetchWithRetry } from '../fetchWithRetry.js';

/**
 * Fetches embeddings for an array of texts. Supports OpenAI and Gemini.
 */
export async function fetchEmbeddings(provider, apiKey, texts) {
    const BATCH_SIZE = 100;
    const allEmbeddings = [];

    let geminiTargetModel = "models/text-embedding-004";
    let geminiModelUrlId = "text-embedding-004";

    if (provider === 'gemini') {
        // First, let's discover the best available embedding model for this specific API key
        const modelsRes = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {}, 2, 500);
        if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            if (modelsData && modelsData.models) {
                const embedModels = modelsData.models.filter(m =>
                    m.supportedGenerationMethods && m.supportedGenerationMethods.includes('embedContent')
                );

                if (embedModels.length > 0) {
                    // Prefer text-embedding-004, otherwise take whatever is available
                    const preferred = embedModels.find(m => m.name.includes('text-embedding-004'));
                    geminiTargetModel = preferred ? preferred.name : embedModels[0].name;
                    geminiModelUrlId = geminiTargetModel.replace('models/', '');
                }
            }
        }
    }

    // Process in batches to avoid API limits (e.g., Gemini has a max 100 limit for batchEmbedContents)
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batchTexts = texts.slice(i, i + BATCH_SIZE);

        if (provider === 'gemini') {
            const requests = batchTexts.map(text => ({
                model: geminiTargetModel,
                content: { parts: [{ text }] }
            }));

            const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModelUrlId}:batchEmbedContents?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requests }),
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Gemini Embedding error: ${response.status} - ${err}`);
            }

            const data = await response.json();
            allEmbeddings.push(...data.embeddings.map(d => d.values));
        } else {
            // Default to OpenAI
            const response = await fetchWithRetry('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: batchTexts,
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`OpenAI Embedding error: ${response.status} - ${err}`);
            }

            const data = await response.json();
            allEmbeddings.push(...data.data.map(d => d.embedding));
        }
    }

    return allEmbeddings;
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
