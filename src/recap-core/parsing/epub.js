import ePub from 'epubjs';
import { splitIntoWindows } from './chunker.js';

/**
 * Parses an EPUB file object and extracts all text into overlapping windows,
 * along with basic metadata. Each spine item (chapter) is split into
 * ~800-char windows with ~200-char overlap for fine-grained RAG retrieval.
 *
 * @param {File} file
 * @returns {Promise<{ metadata: { title: string, author: string }, chunks: Array<{ text: string, chapterIndex: number }> }>}
 */
export async function parseEpubFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const book = ePub(e.target.result);
                await book.ready;

                const meta = await book.loaded.metadata;
                const metadata = {
                    title: meta.title || "Unknown Title",
                    author: meta.creator || "Unknown Author"
                };

                const chunks = [];
                const spine = await book.loaded.spine;

                for (let i = 0; i < spine.length; i++) {
                    const item = spine.get(i);
                    await item.load(book.load.bind(book));

                    const text = item.document.body.textContent || item.document.body.innerText;
                    item.unload();

                    if (!text || text.trim().length < 50) continue;

                    const cleanText = text.replace(/\s+/g, ' ').trim();
                    const windows = splitIntoWindows(cleanText, 800, 200);

                    // Each window inherits the chapter (spine) index
                    const chapterIndex = i + 1; // 1-indexed
                    for (const windowText of windows) {
                        chunks.push({ text: windowText, chapterIndex });
                    }
                }

                resolve({ metadata, chunks });
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}
