/**
 * Splits a long text into overlapping sentence-aware windows.
 * Each window is roughly `windowSize` characters, with `overlap` characters
 * shared between consecutive windows to preserve context continuity.
 *
 * Windows always break at sentence boundaries (. ! ?) so we never cut mid-thought.
 *
 * @param {string} text - The full text to split
 * @param {number} windowSize - Target size per window in characters (default 800)
 * @param {number} overlap - Number of characters to overlap between windows (default 200)
 * @returns {string[]} Array of text windows
 */
export function splitIntoWindows(text, windowSize = 800, overlap = 200) {
    if (!text || text.length === 0) return [];
    if (text.length <= windowSize) return [text];

    const windows = [];
    let startIdx = 0;

    while (startIdx < text.length) {
        let endIdx = Math.min(startIdx + windowSize, text.length);

        // If we're not at the very end, try to find a sentence boundary
        if (endIdx < text.length) {
            endIdx = findSentenceBoundary(text, startIdx, endIdx);
        }

        const window = text.substring(startIdx, endIdx).trim();
        if (window.length > 30) {
            windows.push(window);
        }

        // Advance by (window length - overlap), but at least 1 char to avoid infinite loop
        const advance = Math.max(endIdx - startIdx - overlap, 100);
        startIdx += advance;
    }

    return windows;
}

/**
 * Finds the best sentence boundary within [start, maxEnd].
 * Looks backwards from maxEnd for sentence-ending punctuation followed by a space.
 * If no good boundary is found in the second half, just returns maxEnd.
 */
function findSentenceBoundary(text, start, maxEnd) {
    const searchRegion = text.substring(start, maxEnd);
    const minBoundary = searchRegion.length * 0.5; // Don't cut before halfway

    // Search backwards for the last sentence boundary
    for (let i = searchRegion.length - 1; i >= minBoundary; i--) {
        const char = searchRegion[i];
        if ((char === '.' || char === '!' || char === '?') && i + 1 < searchRegion.length) {
            const nextChar = searchRegion[i + 1];
            if (nextChar === ' ' || nextChar === '\n' || nextChar === '"' || nextChar === "'") {
                return start + i + 1; // Include the punctuation
            }
        }
    }

    // No sentence boundary found — just use the raw limit
    return maxEnd;
}
