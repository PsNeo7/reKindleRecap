import { globalVectorStore } from '../../core/VectorDB.js';
import { fetchEmbeddings } from './ingest.js';

/**
 * Executes a semantic search for contextual extracts, 
 * strictly filtering out any text that occurs AFTER the user's current progress marker.
 * Results are boosted by recency so chapters near the current position rank higher
 * than semantically similar but older chapters.
 * 
 * @param {string} provider - The embedding provider ('openai' | 'gemini')
 * @param {string} apiKey - API key for embedding the query
 * @param {string} queryText - The overarching plot question to anchor the search
 * @param {number} maxAllowedChapterIndex - The progress threshold. Chapters above this are banned.
 * @param {number} limit - Number of semantic chunks to return.
 * @returns {Array} List of retrieved text chunks safely below the spoiler threshold.
 */
export async function retrieveSafeContext(provider, apiKey, queryText, maxAllowedChapterIndex, limit = 6) {
    console.log(`Retrieving RAG context strictly up to chapter index ${maxAllowedChapterIndex}...`);

    // 1. Embed the user's semantic query
    const queryVectors = await fetchEmbeddings(provider, apiKey, [queryText]);
    const queryVector = queryVectors[0];

    // 2. Pull a larger candidate pool so the recency re-ranking has enough to work with
    const candidateLimit = Math.max(limit * 4, 20);

    // 3. Perform the Anti-Spoiler Semantic Search (hard ceiling on future chapters)
    const rawResults = await globalVectorStore.search(
        queryVector,
        candidateLimit,
        (doc) => (doc.metadata?.chapterIndex || 1) <= maxAllowedChapterIndex
    );

    // 4. Apply a recency boost: chunks near the current chapter get a multiplier.
    //    Score = cosine_similarity * (0.5 + 0.5 * (chapterIndex / maxAllowedChapterIndex))
    //    This means a chunk at the very current chapter gets a 1.0x multiplier,
    //    while a chunk at chapter 1 of a 100-chapter book only gets ~0.505x.
    const boosted = rawResults.map(doc => {
        const chapterIdx = doc.metadata?.chapterIndex || 1; // Fallback to 1 if undefined
        const relativePosition = maxAllowedChapterIndex > 0
            ? chapterIdx / maxAllowedChapterIndex
            : 1;
        const recencyMultiplier = 0.5 + 0.5 * relativePosition;
        // Ensure score never becomes NaN
        const finalScore = (doc.score || 0) * recencyMultiplier;
        return { ...doc, score: isNaN(finalScore) ? 0 : finalScore };
    });

    // 5. Re-sort by boosted score and return the top results
    boosted.sort((a, b) => b.score - a.score);
    const results = boosted.slice(0, limit);

    console.log(`Found ${results.length} safe contextual chunks (recency-boosted). Chapters: ${results.map(r => r.metadata.chapterIndex).join(', ')}`);
    return results;
}

/**
 * Multi-pass RAG retrieval: runs two specialised queries and merges results
 * for richer, more balanced recap context.
 *
 * Pass 1 — "What happened recently?" (recency-biased, plot-focused)
 * Pass 2 — "Who are the key characters?" (broader, foundational)
 *
 * @param {string} provider
 * @param {string} apiKey
 * @param {string} bookTitle
 * @param {number} maxChapter
 * @param {number} limit - Total chunks to return after merge
 * @param {string} fileType - 'epub' or 'pdf'
 * @returns {Array} Merged, deduplicated, re-ranked chunks
 */
export async function retrieveMultiPassContext(provider, apiKey, bookTitle, maxChapter, limit = 8, fileType = 'epub') {
    const progressUnit = fileType === 'pdf' ? `page ${maxChapter}` : `chapter ${maxChapter}`;

    // Allocate: 60% of limit to recency pass, 40% to foundational pass
    const recentLimit = Math.ceil(limit * 0.6);
    const foundationalLimit = Math.ceil(limit * 0.4);

    console.log(`[Multi-Pass RAG] Starting dual retrieval for "${bookTitle}" at ${progressUnit}`);

    // Execute both passes in parallel
    const [recentChunks, foundationalChunks] = await Promise.all([
        retrieveSafeContext(
            provider, apiKey,
            `What major plot events, conflicts, and turning points happened near ${progressUnit} of "${bookTitle}"?`,
            maxChapter,
            recentLimit
        ),
        retrieveSafeContext(
            provider, apiKey,
            `Who are the most important characters in "${bookTitle}" and how were they introduced? What are their key relationships and motivations?`,
            maxChapter,
            foundationalLimit
        ),
    ]);

    // Merge and deduplicate — prefer the higher-scoring version of any duplicate chunk
    const seen = new Map();
    for (const chunk of [...recentChunks, ...foundationalChunks]) {
        const key = chunk.text.substring(0, 100); // first 100 chars as dedup key
        const existing = seen.get(key);
        if (!existing || chunk.score > existing.score) {
            seen.set(key, chunk);
        }
    }

    // Re-sort by score and cap at limit
    const merged = [...seen.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    console.log(`[Multi-Pass RAG] Merged ${merged.length} unique chunks. Chapters: ${merged.map(r => r.metadata.chapterIndex).join(', ')}`);
    return merged;
}
