import React, { useState, useEffect, useRef } from 'react';
import { ReactReader, ReactReaderStyle } from 'react-reader';

// Flatten a nested EPUB TOC tree into a single ordered list so that sub-items
// (e.g. individual chapters nested under "Book One: Dune") are included in search.
function flattenToc(items) {
    const result = [];
    for (const item of items) {
        result.push(item);
        if (item.subitems?.length) {
            result.push(...flattenToc(item.subitems));
        }
    }
    return result;
}

export default function EpubViewer({ file, initialLocation, onLocationChange, theme = 'dark' }) {
    const [buffer, setBuffer] = useState(null);
    const [location, setLocation] = useState(initialLocation || null);
    const [chapterLabel, setChapterLabel] = useState('');
    const [tocExpanded, setTocExpanded] = useState(false);
    const renditionRef = useRef(null);
    const tocRef = useRef([]);

    // Intercept clicks on the ReactReader wrapper to track TOC open/close state.
    // The TOC button occupies a ~42×42 area at top:10 left:10.
    // Clicking anywhere else while TOC is open (i.e. clicking the dark overlay) closes it.
    const handleWrapperClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const relY = e.clientY - rect.top;
        const onTocButton = relX <= 42 && relY <= 42;
        if (onTocButton) {
            setTocExpanded(prev => !prev);
        } else if (tocExpanded) {
            setTocExpanded(false);
        }
    };

    // Custom styles for ReactReader.
    // tocArea and tocBackground use opacity + transition so they never visually bleed
    // through the reader iframe during page-turn repaints — opacity:0 makes them truly
    // invisible (not just layered behind), unlike z-index alone.
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
            backgroundColor: 'var(--bg-color)',
        },
        readerArea: {
            ...ReactReaderStyle.readerArea,
            backgroundColor: 'transparent',
        },
        tocBackground: {
            ...ReactReaderStyle.tocBackground,
            background: 'rgba(0, 0, 0, 0.7)',
            opacity: tocExpanded ? 1 : 0,
            pointerEvents: tocExpanded ? 'auto' : 'none',
            transition: 'opacity 0.25s ease',
        },
        tocArea: {
            ...ReactReaderStyle.tocArea,
            background: theme === 'dark' ? '#1e293b' : '#ffffff',
            color: theme === 'dark' ? '#f8fafc' : '#0f172a',
            opacity: tocExpanded ? 1 : 0,
            pointerEvents: tocExpanded ? 'auto' : 'none',
            transition: 'opacity 0.25s ease',
        },
        tocAreaButton: {
            ...ReactReaderStyle.tocAreaButton,
            color: theme === 'dark' ? '#f8fafc' : '#0f172a',
            borderBottom: theme === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0',
        },
        tocButton: {
            ...ReactReaderStyle.tocButton,
            color: theme === 'dark' ? '#f8fafc' : '#0f172a',
            zIndex: 100,
        },
        tocButtonExpanded: {
            ...ReactReaderStyle.tocButtonExpanded,
            background: 'transparent',
        },
        tocButtonBar: {
            ...ReactReaderStyle.tocButtonBar,
            background: theme === 'dark' ? '#f8fafc' : '#0f172a',
        },
        tocButtonBarTop: {
            ...ReactReaderStyle.tocButtonBarTop,
        },
        tocButtonBottom: {
            ...ReactReaderStyle.tocButtonBottom,
        },
        arrow: {
            ...ReactReaderStyle.arrow,
            color: theme === 'dark' ? '#f8fafc' : '#0f172a',
        }
    };

    // Convert local files to an ArrayBuffer.
    useEffect(() => {
        if (!file) return;
        setBuffer(null);
        setLocation(initialLocation || null);

        if (file instanceof File || file instanceof Blob) {
            const reader = new FileReader();
            reader.onload = (e) => setBuffer(e.target.result);
            reader.readAsArrayBuffer(file);
        } else {
            setBuffer(file);
        }
    }, [file]);

    // Track location changes and resolve chapter label
    const handleLocationChange = (epubcfi) => {
        setLocation(epubcfi);

        if (!renditionRef.current || tocRef.current.length === 0) return;

        const book = renditionRef.current.book;
        if (!book || !book.spine) return;

        try {
            const spineItem = book.spine.get(epubcfi);
            if (!spineItem) return;

            // Flatten the full TOC tree so nested sub-items (e.g. individual chapters
            // nested under "Book One: Dune") are included in the search.
            const flatToc = flattenToc(tocRef.current);

            // Pass 1: exact href match in the flattened TOC.
            let tocIndex = flatToc.findIndex(
                (item) => item.href && spineItem.href &&
                    spineItem.href.includes(item.href.split('#')[0])
            );

            // Pass 2: no exact match — pick the last flattened entry whose spine
            // position is ≤ the current spine index (nearest preceding chapter).
            if (tocIndex === -1) {
                let closestIdx = -1;
                for (let i = 0; i < flatToc.length; i++) {
                    const tocSpineItem = book.spine.get(flatToc[i].href);
                    if (tocSpineItem && tocSpineItem.index <= spineItem.index) {
                        closestIdx = i;
                    }
                }
                tocIndex = closestIdx;
            }

            let chapterIndex, label;
            if (tocIndex !== -1) {
                chapterIndex = tocIndex + 1;
                label = flatToc[tocIndex]?.label?.trim() || `Chapter ${chapterIndex}`;
            } else {
                // Truly before any TOC entry (e.g. cover page)
                chapterIndex = spineItem.index + 1;
                label = '';
            }

            setChapterLabel(label);
            onLocationChange?.(epubcfi, chapterIndex, label);
        } catch (e) {
            // ignore
        }
    };

    // Apply themes when theme prop changes
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
        <div
            className="epub-viewer-wrapper"
            style={{
                position: 'relative',
                height: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                overflow: 'hidden',
            }}
        >


            {/* onClick intercepts all clicks to track TOC open/close state */}
            <div
                style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}
                onClick={handleWrapperClick}
            >
                <ReactReader
                    url={buffer}
                    location={location}
                    locationChanged={handleLocationChange}
                    readerStyles={ownStyles}
                    getRendition={(rendition) => {
                        renditionRef.current = rendition;
                        rendition.book.loaded.navigation.then((nav) => {
                            tocRef.current = nav.toc;
                        });

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
                                'overflow-wrap': 'break-word !important',
                                'word-wrap': 'break-word !important'
                            },
                            'p': { 'color': `${textColor} !important` },
                            'h1, h2, h3, h4, h5, h6': { 'color': `${textColor} !important` }
                        });
                    }}
                    tocChanged={(toc) => { tocRef.current = toc; }}
                    epubOptions={{ spread: "none" }}
                    epubInitOptions={{
                        sandbox: "allow-scripts allow-same-origin allow-popups",
                        manager: "continuous"
                    }}
                />
            </div>
        </div>
    );
}
