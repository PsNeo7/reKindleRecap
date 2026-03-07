import { useState, useCallback, useEffect, useRef } from 'react'
import './App.css'
import SettingsModal from './components/SettingsModal.jsx'
import ProcessingNotice from './components/ProcessingNotice/ProcessingNotice.jsx'
import RecapOverlay from './components/Recap/RecapOverlay.jsx'
import VersionPrompt from './components/VersionPrompt.jsx'
import EpubViewer from './components/Reader/EpubViewer.jsx'
import PdfViewer from './components/Reader/PdfViewer.jsx'
import { Sparkles, Settings, Sun, Moon, X, ChevronLeft, AlertTriangle } from 'lucide-react'
import { useTheme } from './core/useTheme.js'
import { useKeyboardShortcuts } from './core/useKeyboardShortcuts.js'
import { useReadingSession } from './core/useReadingSession.js'
import { useApiConfig } from './core/useApiConfig.js'
import { loadAllBooksFromLibrary, saveBookToLibrary, deleteBookFromLibrary, updateBookProgress, updateBookMetadata, deleteVectorCache, deleteAllRecapsForBook } from './core/VectorCache.js'
import { processBookIngestion } from './core/ingestionWorkflow.js'
import { parseEpubFile } from './recap-core/parsing/epub.js'
import { parsePdfFile } from './recap-core/parsing/pdf.js'
import { retrieveSafeContext } from './recap-core/rag/retrieve.js'
import { streamRecap } from './recap-core/ProviderRouter.js'


const getCoverGradient = (title) => {
  const colors = [
    ['#FF9A9E', '#FECFEF'],
    ['#a18cd1', '#fbc2eb'],
    ['#84fab0', '#8fd3f4'],
    ['#fccb90', '#d57eeb'],
    ['#e0c3fc', '#8ec5fc'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140']
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  return `linear-gradient(135deg, ${colors[colorIndex][0]} 0%, ${colors[colorIndex][1]} 100%)`;
};

const getOneLiner = (metadata) => {
  if (metadata?.miniRecap) return metadata.miniRecap.replace(/^"|"$/g, '').trim();
  const progress = metadata?.progress;
  const type = metadata?.type;
  if (!progress) return "Start your journey into this book.";
  if (type === 'epub') {
    const chapter = progress.chapterLabel || `Chapter ${progress.chapterIndex || 1}`;
    return `Ready to uncover what happens next in ${chapter}?`;
  }
  return `Pick up right where you left off on Page ${progress.page || 1}.`;
};

const BackgroundGlows = () => (
  <div className="bg-glow-container">
    <div className="bg-glow-blob blob-purple" />
    <div className="bg-glow-blob blob-blue" />
    <div className="bg-glow-blob blob-red" />
  </div>
);


function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isRecapOpen, setIsRecapOpen] = useState(false)

  // Persists chat history across Recap open/close cycles, keyed by bookKey
  const chatHistoryRef = useRef({})

  const [file, setFile] = useState(null)
  const [fileType, setFileType] = useState(null)
  const [bookToDelete, setBookToDelete] = useState(null)

  const [currentProgress, setCurrentProgress] = useState(1)
  const [chapterLabel, setChapterLabel] = useState('')
  const [currentEpubLocation, setCurrentEpubLocation] = useState(null)

  const [library, setLibrary] = useState([])
  const [isIngesting, setIsIngesting] = useState(false)
  const [isVectorLoading, setIsVectorLoading] = useState(false) // Non-blocking loading state for library cache hit swaps
  const [showProcessingNotice, setShowProcessingNotice] = useState(false)
  const [ingestStatus, setIngestStatus] = useState('')

  const { theme, toggleTheme } = useTheme()
  const { provider, activeKey } = useApiConfig()

  useEffect(() => {
    loadAllBooksFromLibrary().then(setLibrary)
  }, [])

  // Reading session awareness
  const bookKey = file ? file.name : null
  const { isReturning, lastChapter, updateChapter, dismissReturn } = useReadingSession(bookKey)

  // Manage body scroll lock for Recap overlay
  useEffect(() => {
    if (isRecapOpen) {
      document.body.classList.add('antigravity-scroll-lock');
    } else {
      document.body.classList.remove('antigravity-scroll-lock');
    }
    return () => document.body.classList.remove('antigravity-scroll-lock');
  }, [isRecapOpen]);

  // Keyboard shortcuts
  const isModalOpen = isSettingsOpen || isRecapOpen
  useKeyboardShortcuts({
    onOpenRecap: useCallback(() => { if (file && !isVectorLoading && !isIngesting) setIsRecapOpen(true) }, [file, isVectorLoading, isIngesting]),
    onCloseModal: useCallback(() => {
      setIsSettingsOpen(false)
      setIsRecapOpen(false)
    }, []),
    onOpenSettings: useCallback(() => setIsSettingsOpen(true), []),
    isModalOpen,
  })

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0]
    if (!uploadedFile) return

    const isEpub = uploadedFile.type === 'application/epub+zip' || uploadedFile.name.endsWith('.epub')
    const isPdf = uploadedFile.type === 'application/pdf' || uploadedFile.name.endsWith('.pdf')

    if (!isEpub && !isPdf) {
      alert("Unsupported file type. Please upload an EPUB or PDF.")
      return
    }

    const type = isEpub ? 'epub' : 'pdf'

    setIsIngesting(true)
    await saveBookToLibrary(uploadedFile, uploadedFile.name, { type })

    // Extract Cover early and save to metadata
    try {
      const parseResult = isEpub ? await parseEpubFile(uploadedFile) : await parsePdfFile(uploadedFile);
      if (parseResult.metadata.coverBase64) {
        await updateBookMetadata(uploadedFile.name, {
          title: parseResult.metadata.title,
          author: parseResult.metadata.author,
          coverBase64: parseResult.metadata.coverBase64
        });
      }
    } catch (e) { console.warn("Background cover extraction failed", e); }

    // Update library state so the new book appears immediately while processing
    setLibrary(await loadAllBooksFromLibrary())

    await processBookIngestion(uploadedFile, provider, activeKey, setIngestStatus)
    setIsIngesting(false)

    setLibrary(await loadAllBooksFromLibrary())

    setFile(uploadedFile)
    setFileType(type)
    setCurrentProgress(1)
    setChapterLabel('')
    setCurrentEpubLocation(null)
  }

  const handleSelectBook = async (book) => {
    // Open the book instantly for reading, zero UI blocking!
    setFile(book.file)
    setFileType(book.metadata.type)

    // Stamp last-opened time so the library sorts by recency of access
    updateBookMetadata(book.bookKey, { lastOpenedAt: Date.now() }).catch(() => { })

    if (book.metadata.progress) {
      if (book.metadata.type === 'epub') {
        setCurrentEpubLocation(book.metadata.progress.epubcfi || null)
        setCurrentProgress(book.metadata.progress.chapterIndex || 1)
        setChapterLabel(book.metadata.progress.chapterLabel || '')
      } else {
        setCurrentProgress(book.metadata.progress.page || 1)
      }
    } else {
      setCurrentEpubLocation(null)
      setCurrentProgress(1)
      setChapterLabel('')
    }

    // Proactively extract the cover if it's missing (helps with older cache entries)
    if (!book.metadata.coverBase64) {
      try {
        const isEpub = book.metadata.type === 'epub';
        const parseResult = isEpub ? await parseEpubFile(book.file) : await parsePdfFile(book.file);
        if (parseResult.metadata.coverBase64) {
          await updateBookMetadata(book.name, {
            coverBase64: parseResult.metadata.coverBase64
          });
          setLibrary(await loadAllBooksFromLibrary());
        }
      } catch (e) {
        console.warn("Lazy cover load failed", e);
      }
    }

    // Render a lightweight "Loading Vector Cache" state on the Recap button 
    setIsVectorLoading(true)
    try {
      await processBookIngestion(book.file, provider, activeKey)
    } catch (err) {
      console.warn("Background ingestion failed or cache missed:", err)
    } finally {
      setIsVectorLoading(false)
    }
  }

  const confirmDeleteBook = async () => {
    if (!bookToDelete) return;
    const bKey = bookToDelete.bookKey;
    const fileName = bookToDelete.name;
    const fileSize = bookToDelete.size;

    // 1. Delete the book file from library
    await deleteBookFromLibrary(bKey)

    // 2. Delete all chapter recaps for this book
    await deleteAllRecapsForBook(bKey);

    // 3. Delete the vector cache (key is filename::size)
    const cacheKey = `${fileName}::${fileSize}`;
    await deleteVectorCache(cacheKey);

    setLibrary(await loadAllBooksFromLibrary())
    setBookToDelete(null)
  }

  const cancelDeleteBook = () => {
    setBookToDelete(null)
  }

  const handleLocationChange = (epubcfi, chapterIndex, label) => {
    setCurrentProgress(chapterIndex)
    setChapterLabel(label)
    setCurrentEpubLocation(epubcfi)
    updateChapter(chapterIndex)
    if (file) {
      updateBookProgress(file.name, { epubcfi, chapterIndex, chapterLabel: label }).catch(console.error)
    }
  }

  const handlePageChange = (page) => {
    setCurrentProgress(page)
    updateChapter(page)
    if (file) {
      updateBookProgress(file.name, { page }).catch(console.error)
    }
  }

  const handleCloseBook = async () => {
    const closedBookName = file?.name;
    const closedProgress = currentProgress;
    const closedType = fileType;
    setFile(null);

    // CRITICAL: Always reload library on close to update the local state with the latest saved progress
    try {
      setLibrary(await loadAllBooksFromLibrary());
    } catch (e) { console.error(e); }

    if (provider && activeKey && closedBookName) {
      try {
        const progressUnit = closedType === 'pdf' ? `page ${closedProgress}` : `chapter ${closedProgress}`;

        const chunks = await retrieveSafeContext(
          provider, activeKey,
          `Summary of events exactly at and immediately before ${progressUnit}.`,
          closedProgress, 4
        );

        if (chunks && chunks.length > 0) {
          const prompt = `You are an expert copywriter tasked with pulling a reader back into a book they paused. The user just finished reading up to ${progressUnit} of "${closedBookName}". Based strictly on the provided context, write an alluring, punchy "hook" (maximum 2 sentences) that highlights the immediate suspense, dilemma, or impending event they left off at. Make it irresistible to click "Read More," but DO NOT reveal spoilers beyond ${progressUnit}. Do not use quotes or complex markdown, just return the plain string.`;

          let miniRecap = '';
          await streamRecap(provider, activeKey, prompt, chunks, (chunk) => { miniRecap += chunk; }, () => { });

          if (miniRecap) {
            await updateBookMetadata(closedBookName, { miniRecap });
            setLibrary(await loadAllBooksFromLibrary());
          }
        }
      } catch (err) {
        console.warn("Background mini-recap failed:", err);
      }
    }
  }

  return (
    <div className={`app-container ${file ? 'reader-active' : ''}`}>
      {!file && <BackgroundGlows />}

      <header className={`app-header ${file ? 'reader-header-active' : 'glass-premium'}`} style={{
        padding: file ? '16px 24px' : '24px 40px',
        marginBottom: file ? '0' : '4rem',
        borderBottom: file ? '1px solid rgba(255,255,255,0.1)' : 'none',
        borderRadius: file ? '0' : '0 0 40px 40px',
        boxShadow: file ? 'none' : undefined,
        width: '100%',
        maxWidth: file ? '100%' : '1100px',
        margin: file ? '0' : '0 auto 4rem',
        minHeight: file ? 'auto' : '100px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <h1 className="app-logo" style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
          <Sparkles size={28} style={{ color: 'var(--accent-color)', filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))' }} /> Rekindle
        </h1>
        <div className="header-actions">
          {file && (
            <div style={{ position: 'relative' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  if (isVectorLoading || isIngesting) {
                    setShowProcessingNotice(true);
                  } else {
                    setIsRecapOpen(true);
                  }
                }}
              >
                <Sparkles size={18} className={isVectorLoading || isIngesting ? 'processing-notice-icon' : ''} />
                <span className="hide-mobile">
                  {isVectorLoading || isIngesting ? 'Loading Context...' : 'Get Recap'}
                </span>
              </button>
              {showProcessingNotice && (
                <ProcessingNotice
                  isOpen={showProcessingNotice}
                  onClose={() => setShowProcessingNotice(false)}
                />
              )}
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="btn-secondary"
            style={{
              padding: '8px',
              minWidth: '44px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="btn-secondary"
            onClick={() => setIsSettingsOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <Settings size={18} /> <span className="hide-mobile">Settings</span>
          </button>
        </div>
      </header>

      <main className={`${file ? 'reader-main-active' : 'glass-premium'}`} style={{
        width: '100%',
        maxWidth: file ? '100%' : '1100px',
        margin: '0 auto',
        padding: file ? '0' : '0 3rem 6rem',
        borderRadius: file ? '0' : undefined,
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {!file ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>

            {/* Conditional Upload Hero / Compact Header */}
            {!(library && library.length > 0) ? (
              // Empty State - Large Hero
              <div className="glass-premium" style={{ padding: '80px 60px', maxWidth: '700px', margin: '6rem auto', textAlign: 'center' }}>
                <h2 style={{ fontSize: '2.5rem', marginBottom: '1.2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
                  {isIngesting ? "Analyzing Book..." : "Start Reading"}
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.1rem', lineHeight: 1.6, opacity: 0.8 }}>
                  {isIngesting
                    ? "Please wait while we process the text to provide context-aware recaps."
                    : "Upload an EPUB or PDF file to start reading. Rekindle will provide context-aware recaps without spilling spoilers."}
                </p>
                {isIngesting ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div className="streaming-skeleton-line" style={{ width: '240px' }} />
                    <p style={{ color: 'var(--accent-color)', fontSize: '0.95rem', fontWeight: 600 }}>{ingestStatus || 'Processing book...'}</p>
                  </div>
                ) : (
                  <label className="btn-primary" style={{ cursor: 'pointer', padding: '16px 32px', fontSize: '1.1rem', margin: '0 auto' }}>
                    Select EPUB / PDF
                    <input type="file" accept=".epub, .pdf, application/epub+zip, application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            ) : (
              // Populated Library State - Compact Strip
              <div className="glass-premium" style={{
                display: 'flex', width: '100%', maxWidth: '1000px', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '4rem', flexWrap: 'wrap', gap: '2rem',
                padding: '32px 48px', borderRadius: '40px',
              }}>
                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <h2 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    {isIngesting ? "Adding new book..." : "Rekindle Library"}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem', fontWeight: 500, opacity: 0.7 }}>
                    {isIngesting ? "Processing text for context-aware recaps" : "Your personal shelf of intelligent reading"}
                  </p>
                </div>
                {isIngesting ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="streaming-skeleton-line" style={{ width: '120px', marginBottom: 0 }} />
                    <span style={{ color: 'var(--accent-color)', fontSize: '0.9rem', fontWeight: 600 }}>{ingestStatus || 'Processing...'}</span>
                  </div>
                ) : (
                  <label className="btn-primary" style={{ cursor: 'pointer', padding: '12px 24px', fontSize: '0.95rem' }}>
                    Add Book
                    <input type="file" accept=".epub, .pdf, application/epub+zip, application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            )}

            {/* Application Library view */}
            {library && library.length > 0 && (
              <div style={{ width: '100%', maxWidth: '900px', textAlign: 'left', animation: 'fadeSlideIn 0.4s ease both' }}>
                <div className="library-grid" style={{ gap: '24px' }}>
                  {library.map((book, index) => {
                    let titleStr = book.name.replace(/\.[^/.]+$/, ""); // remove extension
                    titleStr = titleStr
                      .replace(/_z-lib_org/ig, '')
                      .replace(/epub/ig, '')
                      .replace(/[_]/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim();

                    const initials = titleStr.substring(0, 2).toUpperCase();

                    return (
                      <div
                        key={book.name}
                        className="book-card glass-premium-card animate-in"
                        onClick={() => handleSelectBook(book)}
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                          animationDelay: `${index * 0.1}s`,
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        {/* Top: Cover and Metadata */}
                        <div style={{ display: 'flex', padding: '16px 8px 16px 16px', gap: '24px', alignItems: 'center' }}>
                          <div style={{
                            width: '70px',
                            height: '100px',
                            borderRadius: '12px',
                            background: book.metadata?.coverBase64 ? `url(${book.metadata.coverBase64}) center/cover no-repeat` : getCoverGradient(titleStr),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(255,255,255,0.9)',
                            fontWeight: 'bold',
                            fontSize: '1.6rem',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                            flexShrink: 0,
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            {!book.metadata?.coverBase64 && initials}
                          </div>

                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, lineHeight: 1.2, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {titleStr}
                            </h4>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em', opacity: 0.6 }}>
                              {book.metadata?.type?.toUpperCase()} • {new Date(book.addedAt).toLocaleDateString()}
                            </div>
                          </div>

                          <button
                            onClick={(e) => { e.stopPropagation(); setBookToDelete(book); }}
                            style={{
                              alignSelf: 'center',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: 'var(--danger-color)',
                              cursor: 'pointer',
                              padding: '8px',
                              borderRadius: '10px',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                              e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            title="Remove book"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Bottom: The Hook */}
                        <div style={{ padding: '0 8px 16px 16px', flex: 1 }}>
                          <div style={{
                            fontSize: '0.9rem',
                            lineHeight: '1.5',
                            color: 'var(--text-secondary)',
                            fontWeight: 450,
                            padding: '12px 16px',
                            background: 'rgba(var(--accent-color-rgb, 99, 102, 241), 0.05)',
                            borderRadius: '12px',
                            border: '1px solid var(--glass-border)',
                            position: 'relative',
                            opacity: 0.9
                          }}>
                            {book.metadata?.miniRecap ? `"${getOneLiner(book.metadata)}"` : getOneLiner(book.metadata)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="reader-header" style={{ position: 'relative' }}>
              <button onClick={handleCloseBook} className="btn-secondary" style={{ border: 'none', background: 'transparent', padding: '8px', gap: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <ChevronLeft size={20} /> <span className="hide-mobile">Library</span>
              </button>
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0, marginTop: '2px' }}>
                  {fileType === 'pdf' ? `Page ${currentProgress}` : (chapterLabel || 'Reading EPUB')}
                </p>
              </div>
              <div style={{ width: '80px' }}></div> {/* Spacer for symmetry */}
            </div>

            <div className="reader-container">
              {fileType === 'epub' && (
                <EpubViewer
                  file={file}
                  initialLocation={currentEpubLocation}
                  onLocationChange={handleLocationChange}
                  theme={theme}
                />
              )}
              {fileType === 'pdf' && (
                <PdfViewer
                  file={file}
                  pageNumber={currentProgress}
                  onPageChange={handlePageChange}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Welcome-back toast */}
      {isReturning && file && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 900,
          animation: 'fadeSlideIn 0.3s ease both',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <span style={{ fontSize: '0.9rem' }}>
            Welcome back! You left off at {fileType === 'pdf' ? `Page ${lastChapter}` : `Chapter ${lastChapter}`}.
          </span>
          <button
            className="btn-primary"
            onClick={() => { setIsRecapOpen(true); dismissReturn(); }}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            Get Recap
          </button>
          <button
            onClick={dismissReturn}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <VersionPrompt />
      {isSettingsOpen && <SettingsModal uploadedFile={file} onClose={() => setIsSettingsOpen(false)} />}
      {isRecapOpen && <RecapOverlay currentChapter={currentProgress} fileType={fileType} bookKey={bookKey} onClose={() => setIsRecapOpen(false)} chatHistoryRef={chatHistoryRef} />}

      {/* Delete Confirmation Modal */}
      {bookToDelete && (
        <div
          className="modal-overlay"
          onClick={cancelDeleteBook}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            overflow: 'hidden'
          }}
        >
          {/* Atmospheric Background Glows */}
          <div style={{
            position: 'absolute',
            top: '20%',
            left: '30%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
            zIndex: -1,
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '10%',
            right: '25%',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, transparent 70%)',
            filter: 'blur(100px)',
            zIndex: -1,
            pointerEvents: 'none'
          }} />

          <div
            className="modal-content glass-premium animate-in"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '440px',
              width: '90%',
              textAlign: 'center',
              padding: '60px 40px',
              position: 'relative'
            }}
          >
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ff4d4d',
              width: '72px',
              height: '72px',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 28px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.15)'
            }}>
              <AlertTriangle size={36} />
            </div>

            <h3 style={{
              margin: '0 0 14px 0',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.04em',
              fontFamily: 'Inter, var(--font-heading), sans-serif'
            }}>
              Delete Book?
            </h3>

            <p style={{
              margin: '0 0 36px 0',
              fontSize: '1.05rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              fontWeight: 400
            }}>
              Are you sure you want to permanently delete <br />
              <strong style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>{bookToDelete.metadata?.title || bookToDelete.name}</strong>?<br />
              <span style={{ fontSize: '0.9rem', color: 'var(--danger-color)', display: 'block', marginTop: '10px', fontWeight: 500, opacity: 0.8 }}>
                This will erase all progress, recaps and data.
              </span>
            </p>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button
                className="btn-secondary"
                onClick={cancelDeleteBook}
                style={{
                  flex: 1,
                  padding: '16px',
                  fontSize: '1.05rem',
                  borderRadius: '20px',
                  background: 'var(--surface-color)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--surface-hover)';
                  e.currentTarget.style.borderColor = 'var(--accent-color)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--surface-color)';
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={confirmDeleteBook}
                style={{
                  flex: 1,
                  padding: '16px',
                  background: 'linear-gradient(180deg, #ff4d4d 0%, #d63031 100%)',
                  boxShadow: '0 12px 32px -8px rgba(214, 48, 49, 0.6)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '1.05rem',
                  borderRadius: '20px',
                  fontWeight: 700,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 16px 40px -8px rgba(214, 48, 49, 0.7)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(214, 48, 49, 0.6)';
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
