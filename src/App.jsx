import { useState, useCallback } from 'react'
import SettingsModal from './components/SettingsModal.jsx'
import RecapOverlay from './components/Recap/RecapOverlay.jsx'
import VersionPrompt from './components/VersionPrompt.jsx'
import EpubViewer from './components/Reader/EpubViewer.jsx'
import PdfViewer from './components/Reader/PdfViewer.jsx'
import { Sparkles, Settings, Sun, Moon, X } from 'lucide-react'
import { useTheme } from './core/useTheme.js'
import { useKeyboardShortcuts } from './core/useKeyboardShortcuts.js'
import { useReadingSession } from './core/useReadingSession.js'
import { CURRENT_BOOK_METADATA } from './core/MockReaderAdapter.js'
import { useApiConfig } from './core/useApiConfig.js'
import { loadAllBooksFromLibrary, saveBookToLibrary, deleteBookFromLibrary, updateBookProgress } from './core/VectorCache.js'
import { processBookIngestion } from './core/ingestionWorkflow.js'
import { useEffect } from 'react'

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
  const [ingestStatus, setIngestStatus] = useState('')

  const { theme, toggleTheme } = useTheme()
  const { provider, activeKey } = useApiConfig()

  useEffect(() => {
    loadAllBooksFromLibrary().then(setLibrary)
  }, [])

  // Reading session awareness
  const bookKey = file ? CURRENT_BOOK_METADATA.title : null
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

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Rekindle Recap</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {file && (
            <button
              className="btn-primary"
              onClick={() => setIsRecapOpen(true)}
              disabled={isVectorLoading || isIngesting}
              style={{ display: 'flex', gap: '8px', alignItems: 'center', opacity: (isVectorLoading || isIngesting) ? 0.6 : 1, cursor: (isVectorLoading || isIngesting) ? 'not-allowed' : 'pointer' }}
            >
              <Sparkles size={18} /> {isVectorLoading ? 'Loading Context...' : 'Get Recap'}
            </button>
          )}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              background: 'none',
              border: '1px solid var(--surface-hover)',
              borderRadius: '8px',
              padding: '8px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="btn-secondary" onClick={() => setIsSettingsOpen(true)} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Settings size={18} /> Settings
          </button>
        </div>
      </header>

      <main className="glass-panel" style={{ flex: 1, padding: '2.5rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {!file ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
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
              <>
                <label className="btn-primary" style={{ cursor: 'pointer', padding: '12px 24px' }}>
                  Select EPUB / PDF
                  <input type="file" accept=".epub, .pdf, application/epub+zip, application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
                <p style={{ marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                  Keyboard: <kbd style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', fontSize: '0.7rem' }}>R</kbd> Recap · <kbd style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', fontSize: '0.7rem' }}>S</kbd> Settings · <kbd style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', fontSize: '0.7rem' }}>Esc</kbd> Close
                </p>
              </>
            )}

            {/* Application Library view */}
            {!isIngesting && library && library.length > 0 && (
              <div style={{ marginTop: '3rem', width: '100%', maxWidth: '600px', textAlign: 'left', animation: 'fadeSlideIn 0.3s ease both' }}>
                <h3 style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--surface-hover)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Your Library
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {library.map(book => (
                    <div key={book.bookKey} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--surface-hover)',
                      padding: '14px 18px', borderRadius: '12px'
                    }}>
                      <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => handleSelectBook(book)}>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{book.name}</h4>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {book.metadata?.type?.toUpperCase()} • Added {new Date(book.addedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteBook(book.bookKey)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '8px', opacity: 0.7, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.7}>
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{file.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {fileType === 'pdf' ? `Page ${currentProgress}` : (chapterLabel || 'Reading EPUB')}
                </p>
              </div>
              <button className="btn-secondary" onClick={() => setFile(null)} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                Close Book
              </button>
            </div>

            <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'hidden' }}>
              {fileType === 'epub' && (
                <EpubViewer
                  file={file}
                  initialLocation={currentEpubLocation}
                  onLocationChange={handleLocationChange}
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
      {isRecapOpen && <RecapOverlay currentChapter={currentProgress} fileType={fileType} onClose={() => setIsRecapOpen(false)} />}
    </div>
  )
}

export default App
