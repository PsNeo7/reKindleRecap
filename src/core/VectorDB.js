export class MemoryVectorDB {
    constructor() {
        this.store = [];
    }

    /**
     * Insert documents with vectors and metadata
     * @param {Array} documents Array of {id, text, metadata, vector}
     */
    async addDocuments(documents) {
        this.store.push(...documents);
    }

    /**
     * Reset the store (useful for changing books)
     */
    async clear() {
        this.store = [];
    }

    /**
     * Mathematical Cosine Similarity
     */
    static cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Search for similar vectors
     * @param {Array<number>} queryVector 
     * @param {number} limit 
     * @param {Function} filterFn 
     */
    async search(queryVector, limit = 5, filterFn = null) {
        let candidates = this.store;
        if (filterFn) {
            candidates = candidates.filter(filterFn);
        }

        const results = candidates.map(doc => ({
            ...doc,
            score: MemoryVectorDB.cosineSimilarity(queryVector, doc.vector)
        }));

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }
}

// Global singleton for the MVP to act as the in-browser database
export const globalVectorStore = new MemoryVectorDB();
