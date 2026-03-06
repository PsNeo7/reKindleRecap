import { useState, useCallback, useEffect } from 'react'
import './App.css'
import SettingsModal from './components/SettingsModal.jsx'
import ProcessingNotice from './components/ProcessingNotice/ProcessingNotice.jsx'
import RecapOverlay from './components/Recap/RecapOverlay.jsx'
import VersionPrompt from './components/VersionPrompt.jsx'
import EpubViewer from './components/Reader/EpubViewer.jsx'
import PdfViewer from './components/Reader/PdfViewer.jsx'
import { Sparkles, Settings, Sun, Moon, X, ChevronLeft } from 'lucide-react'
import { useTheme } from './core/useTheme.js'
import { useKeyboardShortcuts } from './core/useKeyboardShortcuts.js'
import { useReadingSession } from './core/useReadingSession.js'
import { useApiConfig } from './core/useApiConfig.js'
import { loadAllBooksFromLibrary, saveBookToLibrary, deleteBookFromLibrary, updateBookProgress, updateBookMetadata } from './core/VectorCache.js'
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


function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isRecapOpen, setIsRecapOpen] = useState(false)

  const [file, setFile] = useState(null)
  const [fileType, setFileType] = useState(null)

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

  const handleDeleteBook = async (bookKey) => {
    if (confirm(`Remove ${bookKey} from your library?`)) {
      await deleteBookFromLibrary(bookKey)
      setLibrary(await loadAllBooksFromLibrary())
    }
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
      <header className="app-header" style={{
        padding: file ? '12px 20px' : undefined,
        marginBottom: file ? '0' : undefined
      }}>
        <h1 className="app-logo">
          <Sparkles size={24} style={{ color: 'var(--accent-color)' }} /> Rekindle
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
            style={{ padding: '8px', minWidth: '44px' }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="btn-secondary" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={18} /> <span className="hide-mobile">Settings</span>
          </button>
        </div>
      </header>

      <main className={`glass-panel main-content ${file ? 'reader-active' : ''}`}>
        {!file ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: library?.length > 0 ? '1.5rem' : '3rem', paddingBottom: '3rem', textAlign: 'center', overflowY: 'auto' }}>

            {/* Conditional Upload Hero / Compact Header */}
            {!(library && library.length > 0) ? (
              // Empty State - Large Hero
              <>
                <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Upload a Book</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px' }}>
                  Upload an EPUB or PDF file to start reading. Rekindle will analyze the text to provide context-aware recaps without spilling spoilers.
                </p>
                {isIngesting ? (
                  <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div className="skeleton" style={{ width: '200px', height: '6px', borderRadius: '4px' }} />
                    <p style={{ color: 'var(--accent-color)', fontSize: '0.9rem' }}>{ingestStatus || 'Processing book...'}</p>
                  </div>
                ) : (
                  <label className="btn-primary" style={{ cursor: 'pointer', padding: '12px 24px' }}>
                    Select EPUB / PDF
                    <input type="file" accept=".epub, .pdf, application/epub+zip, application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </>
            ) : (
              // Populated Library State - Compact Strip
              <div style={{
                display: 'flex', width: '100%', maxWidth: '850px', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem',
                padding: '16px 24px', background: 'var(--surface)', borderRadius: '12px',
                border: '1px solid var(--surface-hover)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}>
                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 600 }}>Rekindle Library</h2>
                  <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>Upload a new EPUB or PDF to start reading</p>
                </div>
                {isIngesting ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="skeleton" style={{ width: '100px', height: '6px', borderRadius: '4px' }} />
                    <span style={{ color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 500 }}>{ingestStatus || 'Processing...'}</span>
                  </div>
                ) : (
                  <label className="btn-primary" style={{ cursor: 'pointer', padding: '8px 20px', fontSize: '0.9rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)' }}>
                    Add Book
                    <input type="file" accept=".epub, .pdf, application/epub+zip, application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            )}

            {/* Application Library view */}
            {!isIngesting && library && library.length > 0 && (
              <div style={{ width: '100%', maxWidth: '850px', textAlign: 'left', animation: 'fadeSlideIn 0.3s ease both' }}>
                <div className="library-grid">
                  {library.map((book, index) => {
                    let titleStr = book.name.replace(/\.[^/.]+$/, ""); // remove extension
                    // Robust title cleaning for presentation
                    titleStr = titleStr
                      .replace(/_z-lib_org/ig, '')
                      .replace(/epub/ig, '')
                      .replace(/[_]/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim();

                    const initials = titleStr.substring(0, 2).toUpperCase();
                    const coverStyle = {
                      width: '60px',
                      height: '90px',
                      borderRadius: '8px',
                      background: getCoverGradient(titleStr),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(255,255,255,0.9)',
                      fontWeight: 'bold',
                      fontSize: '1.4rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      flexShrink: 0
                    };

                    return (
                      <div
                        key={book.bookKey}
                        className="book-card"
                        onClick={() => handleSelectBook(book)}
                        style={{
                          animation: 'slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards',
                          animationDelay: `${index * 0.08}s`
                        }}
                      >
                        {/* Top: Cover and Metadata */}
                        <div style={{ display: 'flex', padding: '16px', gap: '14px', alignItems: 'center' }}>
                          <div style={{
                            ...coverStyle,
                            background: book.metadata?.coverBase64 ? `url(${book.metadata.coverBase64}) center/cover no-repeat` : getCoverGradient(titleStr)
                          }}>
                            {!book.metadata?.coverBase64 && initials}
                          </div>

                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {titleStr}
                            </h4>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                              {book.metadata?.type?.toUpperCase()} • {new Date(book.addedAt).toLocaleDateString()}
                            </div>
                          </div>

                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteBook(book.bookKey); }}
                            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '4px', opacity: 0.4, transition: 'opacity 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0.4}
                            title="Remove book from library"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Bottom: The Hook */}
                        <div style={{ padding: '16px', paddingTop: '0', flex: 1 }}>
                          <div style={{
                            fontSize: '0.88rem',
                            lineHeight: '1.5',
                            color: 'var(--accent-color)',
                            fontWeight: 500,
                            padding: '12px',
                            background: 'rgba(0,0,0,0.15)',
                            borderRadius: '10px',
                            fontStyle: 'italic',
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
      {isRecapOpen && <RecapOverlay currentChapter={currentProgress} fileType={fileType} bookKey={bookKey} onClose={() => setIsRecapOpen(false)} />}
    </div>
  )
}

export default App
