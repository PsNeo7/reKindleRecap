import { buildCacheKey, loadVectorCache, saveVectorCache, updateBookMetadata } from './VectorCache.js';
import { globalVectorStore } from './VectorDB.js';
import { parseEpubFile } from '../recap-core/parsing/epub.js';
import { parsePdfFile } from '../recap-core/parsing/pdf.js';
import { fetchEmbeddings } from '../recap-core/rag/ingest.js';


/**
 * Handles checking cache, parsing, embedding, and explicitly loading the global vector store.
 * @param {File} file 
 * @param {string} provider 
 * @param {string} apiKey 
 * @param {Function} onProgress 
 */
export async function processBookIngestion(file, provider, apiKey, onProgress = () => { }) {
    if (!file) return;

    try {
        const cacheKey = buildCacheKey(file);

        // 1. Check local indexedDB cache
        onProgress('Checking local cache...');
        const cached = await loadVectorCache(cacheKey);
        if (cached) {
            onProgress(`Cache hit! Loading ${cached.length} chunks into memory...`);
            await globalVectorStore.clear();
            await globalVectorStore.addDocuments(cached);

            const firstChunk = cached[0];

            onProgress(`Ready. Loaded from cache. (0 API calls)`);
            return;
        }

        // 2. We need to ingest. Do we have an API key?
        if (!apiKey) {
            onProgress('Skipped Auto-Ingest: No API key configured.');
            return;
        }

        // 3. Parse File
        onProgress(`Parsing ${file.name}...`);
        const isEpub = file.type === 'application/epub+zip' || file.name.endsWith('.epub');
        const parseResult = isEpub ? await parseEpubFile(file) : await parsePdfFile(file);

        // Save extracted metadata like actual covers back to the library view
        await updateBookMetadata(file.name, {
            title: parseResult.metadata.title,
            author: parseResult.metadata.author,
            coverBase64: parseResult.metadata.coverBase64
        });


        const bookChunks = parseResult.chunks.map((chunk) => ({
            text: chunk.text,
            metadata: {
                chapterIndex: chunk.chapterIndex,
                title: parseResult.metadata.title,
                author: parseResult.metadata.author
            }
        }));

        onProgress(`Embedding ${bookChunks.length} chunks using ${provider}...`);

        // 4. Fetch embeddings in batches
        const texts = bookChunks.map(c => c.text);
        const vectors = await fetchEmbeddings(provider, apiKey, texts);

        // 5. Store in global store
        const documents = bookChunks.map((chunk, idx) => ({
            id: `chunk_${idx}_${Date.now()}`,
            text: chunk.text,
            metadata: chunk.metadata,
            vector: vectors[idx]
        }));

        await globalVectorStore.clear();
        await globalVectorStore.addDocuments(documents);

        // 6. Save to DB Cache
        onProgress(`Saving ${documents.length} chunks to IndexedDB cache...`);
        await saveVectorCache(cacheKey, globalVectorStore.store);

        onProgress(`✅ Ingestion complete. Ready for recaps!`);
    } catch (err) {
        onProgress(`Error: ${err.message}`);
        console.error('Ingestion Workflow Error:', err);
    }
}
