/**
 * Simple IndexedDB wrapper for storing book text chunks in the extension.
 */
export class ExtensionVectorDB {
    constructor(dbName = "RekindleDocs") {
        this.dbName = dbName;
        this.version = 1;
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('chunks')) {
                    const store = db.createObjectStore('chunks', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('asin', 'asin', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Store a text chunk
     * @param {string} asin Book Identifier
     * @param {string} text Text content
     * @param {string} title Book Title
     */
    async addChunk(asin, text, title) {
        await this.init();

        // Check if this exact text chunk already exists to prevent duplicate entries from overlapping scrapes
        const existing = await this.getChunks(asin);
        const isDuplicate = existing.some(c => c.text.substring(0, 100) === text.substring(0, 100));

        if (isDuplicate) {
            console.log("Rekindle: Skipping duplicate chunk for", title);
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chunks'], 'readwrite');
            const store = transaction.objectStore('chunks');

            const chunk = {
                asin,
                title,
                text,
                timestamp: Date.now()
            };

            const request = store.add(chunk);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Retrieve all chunks for a book
     * @param {string} asin 
     */
    async getChunks(asin) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['chunks'], 'readonly');
            const store = transaction.objectStore('chunks');
            const index = store.index('asin');
            const request = index.getAll(asin);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

export const db = new ExtensionVectorDB();
