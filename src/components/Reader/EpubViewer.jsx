import React, { useState, useEffect, useRef } from 'react';
import { ReactReader } from 'react-reader';

export default function EpubViewer({ file, initialLocation, onLocationChange }) {
    const [buffer, setBuffer] = useState(null);
    const [location, setLocation] = useState(initialLocation || null);
    const [chapterLabel, setChapterLabel] = useState('');
    const renditionRef = useRef(null);
    const tocRef = useRef([]);

    // Convert local files to an ArrayBuffer.
    // Passing Blob URLs directly can fail in the epub.js iframe due to sandbox restrictions.
    useEffect(() => {
        if (!file) return;
        setBuffer(null); // Reset on new file
        setLocation(initialLocation || null);
        if (file instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => setBuffer(e.target.result);
            reader.readAsArrayBuffer(file);
        } else {
            setBuffer(file);
        }
    }, [file]);

    // Track location changes and map epubcfi -> chapter index using the book's TOC
    const handleLocationChange = (epubcfi) => {
        setLocation(epubcfi);

        if (!renditionRef.current || tocRef.current.length === 0) return;

        // Walk through the TOC spines to find which chapter this CFI belongs to.
        // We find the last TOC item whose href's CFI is <= the current CFI.
        const book = renditionRef.current.book;
        if (!book || !book.spine) return;

        try {
            // Find which spine item (chapter) the current epubcfi is within
            const spineItem = book.spine.get(epubcfi);
            if (!spineItem) return;

            // Match the spine item's href against the TOC to get a human-readable label
            const tocEntry = tocRef.current.find(
                (item) => item.href && spineItem.href && spineItem.href.includes(item.href.split('#')[0])
            );

            const chapterIndex = spineItem.index + 1; // 1-indexed
            const label = tocEntry?.label?.trim() || `Chapter ${chapterIndex}`;

            setChapterLabel(label);
            onLocationChange?.(epubcfi, chapterIndex, label);
        } catch (e) {
            // Silently ignore CFI parsing errors (common when navigating)
        }
    };

    if (!buffer) {
        return (
            <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
                Loading EPUB into viewer...
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            {chapterLabel && (
                <div style={{
                    position: 'absolute', top: 8, right: 12, zIndex: 10,
                    fontSize: '0.75rem', color: 'var(--text-secondary)',
                    background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: 6,
                    pointerEvents: 'none'
                }}>
                    {chapterLabel}
                </div>
            )}
            <ReactReader
                url={buffer}
                location={location}
                locationChanged={handleLocationChange}
                getRendition={(rendition) => {
                    renditionRef.current = rendition;
                    // Grab the TOC once the book is ready
                    rendition.book.loaded.navigation.then((nav) => {
                        tocRef.current = nav.toc;
                    });
                }}
                tocChanged={(toc) => {
                    tocRef.current = toc;
                }}
            />
        </div>
    );
}
