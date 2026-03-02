/**
 * Parses the raw markdown text received from the streaming LLM response
 * into two distinct sections: Plot Summary and Characters.
 * @param {string} markdownText - The accumulated markdown text so far.
 * @returns {Object} { plotSummary: string, characters: Array<CharacterObject> }
 */
export function parseRecapStream(markdownText) {
    let plotSummary = '';
    let characters = [];

    const plotMatches = [...markdownText.matchAll(/#+.*Plot Summary/gi)];
    const charMatches = [...markdownText.matchAll(/#+.*Characters/gi)];

    const plotIndex = plotMatches.length > 0 ? plotMatches[0].index : -1;
    const charIndex = charMatches.length > 0 ? charMatches[0].index : -1;

    if (plotIndex !== -1 && charIndex !== -1) {
        const plotHeaderEnd = plotIndex + plotMatches[0][0].length;
        plotSummary = markdownText.substring(plotHeaderEnd, charIndex).trim();

        const charHeaderEnd = charIndex + charMatches[0][0].length;
        characters = parseCharacters(markdownText.substring(charHeaderEnd).trim());

    } else if (plotIndex !== -1) {
        const plotHeaderEnd = plotIndex + plotMatches[0][0].length;
        plotSummary = markdownText.substring(plotHeaderEnd).trim();
    } else {
        plotSummary = markdownText.trim();
    }

    return { plotSummary, characters };
}

/**
 * Parses the Characters section markdown into structured character objects.
 * 
 * Expected input format:
 *   - **Name**: One-line status summary
 *     - Arc beat 1
 *     - Arc beat 2
 *
 * @param {string} markdown
 * @returns {Array<{ name: string, summary: string, arc: string[] }>}
 */
export function parseCharacters(markdown) {
    if (!markdown) return [];

    const lines = markdown.split('\n');
    const characters = [];
    let current = null;

    for (const line of lines) {
        // Skip stray section headers (### Characters etc.)
        if (line.trimStart().startsWith('#')) continue;

        // Top-level character line: "- **Name**: summary text"
        const topBullet = line.match(/^-\s+\*\*([^*]+)\*\*[:\s]*(.*)/);
        if (topBullet) {
            if (current) characters.push(current);
            current = {
                name: topBullet[1].trim(),
                summary: topBullet[2].trim(),
                arc: [],
            };
            continue;
        }

        if (!current) continue;

        // Indented arc beat: "  - Arc event text"
        const arcBullet = line.match(/^\s{2,}-\s+(.*)/);
        if (arcBullet) {
            const beat = arcBullet[1].replace(/\*\*/g, '').trim();
            if (beat.length > 0 && !beat.startsWith('#')) {
                current.arc.push(beat);
            }
            continue;
        }

        // Continuation of the summary on a new (non-bullet) line
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
            current.summary += ' ' + trimmed;
        }
    }
    if (current) characters.push(current);

    // Clean up any stray "### ..." fragments that slipped into summaries
    for (const char of characters) {
        const headerIdx = char.summary.indexOf('###');
        if (headerIdx !== -1) char.summary = char.summary.substring(0, headerIdx).trim();
        char.summary = char.summary.replace(/\*\*/g, '').trim();
    }

    // Deduplicate by name — keep the last occurrence (most complete from latest chunk)
    const seen = new Map();
    for (const char of characters) {
        seen.set(char.name.toLowerCase(), char);
    }

    return [...seen.values()];
}
