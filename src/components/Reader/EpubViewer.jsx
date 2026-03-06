import React, { useState, useEffect, useRef } from 'react';
import { ReactReader, ReactReaderStyle } from 'react-reader';

export default function EpubViewer({ file, initialLocation, onLocationChange, theme = 'dark' }) {
    const [buffer, setBuffer] = useState(null);
    const [location, setLocation] = useState(initialLocation || null);
    const [chapterLabel, setChapterLabel] = useState('');
    const renditionRef = useRef(null);
    const tocRef = useRef([]);

    // Custom styles for ReactReader to ensure it fills the container
    const ownStyles = {
        ...ReactReaderStyle,
        reader: {
            ...ReactReaderStyle.reader,
            position: 'absolute',
            width: '100%',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
        },
        container: {
            ...ReactReaderStyle.container,
            height: '100%',
        }
    };

    // Convert local files to an ArrayBuffer.
    // Passing Blob URLs directly can fail in the epub.js iframe due to sandbox restrictions.
    useEffect(() => {
        if (!file) return;
        setBuffer(null);
        setLocation(initialLocation || null);

        if (file instanceof File || file instanceof Blob) {
            const reader = new FileReader();
            reader.onload = (e) => setBuffer(e.target.result);
            reader.readAsArrayBuffer(file);
        } else {
            // Already an ArrayBuffer or other raw format
            setBuffer(file);
        }
    }, [file]);

    // Track location changes
    const handleLocationChange = (epubcfi) => {
        setLocation(epubcfi);

        if (!renditionRef.current || tocRef.current.length === 0) return;

        const book = renditionRef.current.book;
        if (!book || !book.spine) return;

        try {
            const spineItem = book.spine.get(epubcfi);
            if (!spineItem) return;

            const tocEntry = tocRef.current.find(
                (item) => item.href && spineItem.href && spineItem.href.includes(item.href.split('#')[0])
            );

            const chapterIndex = spineItem.index + 1;
            const label = tocEntry?.label?.trim() || `Chapter ${chapterIndex}`;

            setChapterLabel(label);
            onLocationChange?.(epubcfi, chapterIndex, label);
        } catch (e) {
            // ignore
        }
    };

    // Apply themes
    useEffect(() => {
        if (renditionRef.current) {
            const textColor = theme === 'dark' ? '#f8fafc' : '#0f172a';
            const bgColor = theme === 'dark' ? '#0f172a' : '#ffffff';

            renditionRef.current.themes.default({
                'body': {
                    'font-family': "var(--font-serif) !important",
                    'padding': '40px 5% !important',
                    'color': `${textColor} !important`,
                    'background': `${bgColor} !important`,
                    'font-size': '1.1rem !important',
                    'line-height': '1.7 !important',
                    'max-width': '800px !important',
                    'margin': '0 auto !important',
                    'overflow-wrap': 'break-word !important',
                    'word-wrap': 'break-word !important'
                },
                'p': { 'color': `${textColor} !important` },
                'h1, h2, h3, h4, h5, h6': { 'color': `${textColor} !important` }
            });
        }
    }, [theme, renditionRef.current]);

    if (!buffer) {
        return (
            <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
                Preparing book for display...
            </div>
        );
    }

    return (
        <div className="epub-viewer-wrapper" style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', overflow: 'hidden' }}>
            {chapterLabel && (
                <div style={{
                    position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
                    fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc',
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '6px 16px', borderRadius: 20,
                    pointerEvents: 'none', maxWidth: '85%', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    {chapterLabel}
                </div>
            )}
            <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
                <ReactReader
                    url={buffer}
                    location={location}
                    locationChanged={handleLocationChange}
                    styles={ownStyles}
                    getRendition={(rendition) => {
                        renditionRef.current = rendition;
                        rendition.book.loaded.navigation.then((nav) => {
                            tocRef.current = nav.toc;
                        });

                        // Initial theme application
                        const textColor = theme === 'dark' ? '#f8fafc' : '#0f172a';
                        const bgColor = theme === 'dark' ? '#0f172a' : '#ffffff';
                        rendition.themes.default({
                            'body': {
                                'font-family': "var(--font-serif) !important",
                                'padding': '40px 5% !important',
                                'color': `${textColor} !important`,
                                'background': `${bgColor} !important`,
                                'font-size': '1.1rem !important',
                                'line-height': '1.7 !important',
                                'max-width': '800px !important',
                                'margin': '0 auto !important',
                                'overflow-wrap': 'break-word !important',
                                'word-wrap': 'break-word !important'
                            },
                            'p': { 'color': `${textColor} !important` },
                            'h1, h2, h3, h4, h5, h6': { 'color': `${textColor} !important` }
                        });
                    }}
                    tocChanged={(toc) => { tocRef.current = toc; }}
                    epubInitOptions={{
                        sandbox: "allow-scripts allow-same-origin allow-popups"
                    }}
                />
            </div>
        </div>
    );
}
