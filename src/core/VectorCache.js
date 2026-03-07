/**
 * IndexedDB-backed persistence layer for the MemoryVectorDB vector store.
 * 
 * Cache key is formed from the file's name + size so that ingesting a new version
 * of the same file automatically invalidates the old cache.
 */

const DB_NAME = 'rekindleRecapCache';
const DB_VERSION = 3;
const STORE_VECTORS = 'vectorStores';
const STORE_RECAPS = 'recapOutputs';
const STORE_BOOKS = 'libraryBooks';

function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_VECTORS)) {
                db.createObjectStore(STORE_VECTORS, { keyPath: 'cacheKey' });
            }
            if (!db.objectStoreNames.contains(STORE_RECAPS)) {
                db.createObjectStore(STORE_RECAPS, { keyPath: 'recapKey' });
            }
            if (!db.objectStoreNames.contains(STORE_BOOKS)) {
                db.createObjectStore(STORE_BOOKS, { keyPath: 'bookKey' });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Build a stable cache key from a File object or a plain string identifier.
 */
export function buildCacheKey(fileOrId) {
    if (fileOrId instanceof File) {
        return `${fileOrId.name}::${fileOrId.size}`;
    }
    return String(fileOrId);
}

/**
 * Save a vector store snapshot to IndexedDB.
 * @param {string} cacheKey 
 * @param {Array}  documents  Array of {id, text, metadata, vector} from MemoryVectorDB.store
 */
export async function saveVectorCache(cacheKey, documents) {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_VECTORS, 'readwrite');
        tx.objectStore(STORE_VECTORS).put({ cacheKey, documents, savedAt: Date.now() });
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        console.log(`[VectorCache] Saved ${documents.length} chunks under key "${cacheKey}".`);
    } catch (err) {
        console.warn('[VectorCache] Failed to save cache:', err);
    }
}

/**
 * Load a vector store snapshot from IndexedDB.
 * @param {string} cacheKey
 * @returns {Array|null} Cached documents or null if not found.
 */
export async function loadVectorCache(cacheKey) {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_VECTORS, 'readonly');
        const result = await new Promise((res, rej) => {
            const req = tx.objectStore(STORE_VECTORS).get(cacheKey);
            req.onsuccess = (e) => res(e.target.result);
            req.onerror = (e) => rej(e.target.error);
        });
        if (result) {
            console.log(`[VectorCache] Cache hit: ${result.documents.length} chunks for "${cacheKey}".`);
            return result.documents;
        }
        return null;
    } catch (err) {
        console.warn('[VectorCache] Failed to load cache:', err);
        return null;
    }
}

/**
 * Delete a specific entry from the cache (e.g. to force a re-ingest).
 */
export async function deleteVectorCache(cacheKey) {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_VECTORS, 'readwrite');
        tx.objectStore(STORE_VECTORS).delete(cacheKey);
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        console.log(`[VectorCache] Deleted cache for "${cacheKey}".`);
    } catch (err) {
        console.warn('[VectorCache] Failed to delete cache:', err);
    }
}

/**
 * List all cached entries (for display in SettingsModal).
 * @returns {Array<{cacheKey, savedAt, chunkCount}>}
 */
export async function listVectorCaches() {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_VECTORS, 'readonly');
        const all = await new Promise((res, rej) => {
            const req = tx.objectStore(STORE_VECTORS).getAll();
            req.onsuccess = (e) => res(e.target.result);
            req.onerror = (e) => rej(e.target.error);
        });
        return all.map(entry => ({
            cacheKey: entry.cacheKey,
            savedAt: entry.savedAt,
            chunkCount: entry.documents?.length ?? 0,
        }));
    } catch (err) {
        return [];
    }
}

// ─── Recap Output Cache ────────────────────────────────────────────

/**
 * Save a generated recap markdown for a specific book + chapter.
 * @param {string} bookKey - Book identifier (title or cache key)
 * @param {number} chapter - Chapter/page index
 * @param {string} markdown - Full raw markdown output from the LLM
 */
export async function saveRecapOutput(bookKey, chapter, markdown) {
    try {
        const db = await openDb();
        const recapKey = `${bookKey}::ch${chapter}`;
        const tx = db.transaction(STORE_RECAPS, 'readwrite');
        tx.objectStore(STORE_RECAPS).put({
            recapKey,
            bookKey,
            chapter,
            markdown,
            savedAt: Date.now(),
        });
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        console.log(`[RecapCache] Saved recap for "${bookKey}" ch${chapter}.`);
    } catch (err) {
        console.warn('[RecapCache] Failed to save recap:', err);
    }
}

/**
 * Load a cached recap for a book + chapter.
 * @param {string} bookKey
 * @param {number} chapter
 * @returns {{ markdown: string, savedAt: number } | null}
 */
export async function loadRecapOutput(bookKey, chapter) {
    try {
        const db = await openDb();
        const recapKey = `${bookKey}::ch${chapter}`;
        const tx = db.transaction(STORE_RECAPS, 'readonly');
        const result = await new Promise((res, rej) => {
            const req = tx.objectStore(STORE_RECAPS).get(recapKey);
            req.onsuccess = (e) => res(e.target.result);
            req.onerror = (e) => rej(e.target.error);
        });
        if (result) {
            console.log(`[RecapCache] Cache hit for "${bookKey}" ch${chapter}.`);
            return { markdown: result.markdown, savedAt: result.savedAt };
        }
        return null;
    } catch (err) {
        console.warn('[RecapCache] Failed to load recap:', err);
        return null;
    }
}

/**
 * List all cached recaps for a given book.
 * @param {string} bookKey
 * @returns {Array<{ chapter: number, savedAt: number }>}
 */
export async function listRecapOutputs(bookKey) {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_RECAPS, 'readonly');
        const all = await new Promise((res, rej) => {
            const req = tx.objectStore(STORE_RECAPS).getAll();
            req.onsuccess = (e) => res(e.target.result);
            req.onerror = (e) => rej(e.target.error);
        });
        return all
            .filter(e => e.bookKey === bookKey)
            .map(e => ({ chapter: e.chapter, savedAt: e.savedAt }))
            .sort((a, b) => b.chapter - a.chapter);
    } catch (err) {
        return [];
    }
}

/**
 * Delete all cached recaps for a given book.
 * @param {string} bookKey
 */
export async function deleteAllRecapsForBook(bookKey) {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_RECAPS, 'readwrite');
        const store = tx.objectStore(STORE_RECAPS);

        // Standard approach: get all and delete matching
        const all = await new Promise((res, rej) => {
            const req = store.getAll();
            req.onsuccess = (e) => res(e.target.result);
            req.onerror = (e) => rej(e.target.error);
        });

        const targets = all.filter(e => e.bookKey === bookKey);
        for (const t of targets) {
            store.delete(t.recapKey);
        }

        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        console.log(`[RecapCache] Deleted ${targets.length} recaps for "${bookKey}".`);
    } catch (err) {
        console.warn('[RecapCache] Failed to delete recaps:', err);
    }
}

// ─── Library Storage ───────────────────────────────────────────────

/**
 * Save an uploaded book file to the permanent Library.
 * @param {File} file - The raw File object (EPUB or PDF)
 * @param {string} bookKey - Unique identifier (usually the title or filename)
 * @param {Object} metadata - Optional additional data
 */
export async function saveBookToLibrary(file, bookKey, metadata = {}) {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_BOOKS, 'readwrite');
        tx.objectStore(STORE_BOOKS).put({
            bookKey,
            file, // Files are natively cloneable by IndexedDB
            name: file.name,
            type: file.type,
            size: file.size,
            metadata,
            addedAt: Date.now()
        });
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        console.log(`[Library] Saved book "${bookKey}".`);
    } catch (err) {
        console.warn('[Library] Failed to save book:', err);
    }
}

/**
 * Load all books saved in the Library.
 * @returns {Array} List of book objects containing the raw `file` Blobs.
 */
export async function loadAllBooksFromLibrary() {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_BOOKS, 'readonly');
        const all = await new Promise((res, rej) => {
            const req = tx.objectStore(STORE_BOOKS).getAll();
            req.onsuccess = (e) => res(e.target.result);
            req.onerror = (e) => rej(e.target.error);
        });
        return all.sort((a, b) => (b.metadata?.lastOpenedAt ?? b.addedAt) - (a.metadata?.lastOpenedAt ?? a.addedAt));
    } catch (err) {
        console.warn('[Library] Failed to load books:', err);
        return [];
    }
}

/**
 * Delete a book from the Library.
 * @param {string} bookKey 
 */
export async function deleteBookFromLibrary(bookKey) {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_BOOKS, 'readwrite');
        tx.objectStore(STORE_BOOKS).delete(bookKey);
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        console.log(`[Library] Deleted book "${bookKey}".`);
    } catch (err) {
        console.warn('[Library] Failed to delete book:', err);
    }
}

/**
 * Update the reading progress metadata for a specific book.
 * @param {string} bookKey 
 * @param {Object} progress - { page, epubcfi, chapterIndex, chapterLabel }
 */
export async function updateBookProgress(bookKey, progress) {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_BOOKS, 'readwrite');
        const store = tx.objectStore(STORE_BOOKS);

        const book = await new Promise((res, rej) => {
            const req = store.get(bookKey);
            req.onsuccess = (e) => res(e.target.result);
            req.onerror = (e) => rej(e.target.error);
        });

        if (book) {
            book.metadata = { ...book.metadata, progress };
            store.put(book);
            await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        }
    } catch (err) {
        console.warn('[Library] Failed to update progress:', err);
    }
}

/**
 * Update arbitrary metadata for a specific book.
 * @param {string} bookKey 
 * @param {Object} newMetadata 
 */
export async function updateBookMetadata(bookKey, newMetadata) {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_BOOKS, 'readwrite');
        const store = tx.objectStore(STORE_BOOKS);

        const book = await new Promise((res, rej) => {
            const req = store.get(bookKey);
            req.onsuccess = (e) => res(e.target.result);
            req.onerror = (e) => rej(e.target.error);
        });

        if (book) {
            book.metadata = { ...book.metadata, ...newMetadata };
            store.put(book);
            await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
        }
    } catch (err) {
        console.warn('[Library] Failed to update metadata:', err);
    }
}
