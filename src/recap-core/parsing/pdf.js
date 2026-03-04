import * as pdfjsLib from 'pdfjs-dist';
import { splitIntoWindows } from './chunker.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

/**
 * Parses an uploaded PDF file and extracts text into overlapping windows.
 * Each page's text is split into ~800-char windows with ~200-char overlap.
 *
 * @param {File} file
 * @returns {Promise<{ metadata: { title: string, author: string }, chunks: Array<{ text: string, chapterIndex: number }> }>}
 */
export async function parsePdfFile(file) {
    return new Promise(async (resolve, reject) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            const meta = await pdf.getMetadata();
            let coverBase64 = null;
            try {
                const page1 = await pdf.getPage(1);
                const viewport = page1.getViewport({ scale: 0.5 }); // lower resolution for thumb
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page1.render({ canvasContext: context, viewport: viewport }).promise;
                coverBase64 = canvas.toDataURL('image/jpeg', 0.8);
            } catch (e) {
                console.warn('Failed to extract PDF cover', e);
            }

            const metadata = {
                title: meta?.info?.Title || file.name.replace('.pdf', ''),
                author: meta?.info?.Author || "Unknown Author",
                coverBase64
            };

            const chunks = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');

                if (!pageText || pageText.trim().length < 10) continue;

                const cleanText = pageText.replace(/\s+/g, ' ').trim();
                const windows = splitIntoWindows(cleanText, 800, 200);

                // Each window inherits the page number as its chapterIndex
                for (const windowText of windows) {
                    chunks.push({ text: windowText, chapterIndex: i });
                }
            }

            resolve({ metadata, chunks });
        } catch (err) {
            reject(err);
        }
    });
}
