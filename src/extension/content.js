/**
 * Rekindle Content Script
 * Injected into read.amazon.com
 */

console.log("Rekindle extension loaded on Kindle Cloud Reader");

// Target for observing book content
const KINDLE_READER_ID = 'KindleReaderIFrame';

// Function to find the reading iframe
function getReadingIframe() {
    return document.getElementById(KINDLE_READER_ID) ||
        document.querySelector('iframe[id^="KindleReaderIFrame"]');
}

// Helper to recursively find text in all accessible iframes
function recursiveExtractText(win) {
    let text = "";
    try {
        // Extract text from current window
        const bodyText = win.document.body.innerText;
        if (bodyText && bodyText.length > 100) { // Only take windows with substantial text
            text += bodyText + "\n";
        }

        // Search nested iframes
        const iframes = win.document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                const innerWin = iframe.contentWindow;
                text += recursiveExtractText(innerWin);
            } catch (e) {
                // Cross-origin iframe, skip
            }
        }
    } catch (e) {
        // Window/Doc access denied
    }
    return text;
}

// Function to extract text from the page
function extractPageText() {
    console.log("Rekindle: Attempting text extraction...");

    // First try the specific Kindle Reader IFrame if it exists
    const mainIframe = getReadingIframe();
    if (mainIframe) {
        try {
            const text = recursiveExtractText(mainIframe.contentWindow);
            if (text && text.trim().length > 50) return text.trim();
        } catch (e) { }
    }

    // Fallback: search the entire top-level document and all sub-frames
    const allText = recursiveExtractText(window);

    // Clean up: remove common Kindle UI text that might get sucked in
    const cleanedText = allText
        .replace(/Kindle Library/g, '')
        .replace(/Settings/g, '')
        .replace(/Search/g, '')
        .trim();

    return cleanedText.length > 50 ? cleanedText : null;
}

// Function to extract book title
function getBookTitle() {
    const titleSelectors = [
        '#kindleReader_header_title',
        '.reader-header-title',
        '[class*="header-title"]',
        'title'
    ];

    for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) return el.innerText.trim();
    }

    return document.title.replace('Kindle Cloud Reader', '').trim() || "Unknown Book";
}

// UI: Sidebar for Recap
function createRecapSidebar() {
    if (document.getElementById('rekindle-sidebar')) return document.getElementById('rekindle-sidebar');

    const sidebar = document.createElement('div');
    sidebar.id = 'rekindle-sidebar';
    sidebar.style.cssText = `
        position: fixed;
        right: -400px;
        top: 0;
        width: 350px;
        height: 100vh;
        background: #1a1a1a;
        color: #e0e0e0;
        z-index: 10000;
        box-shadow: -5px 0 15px rgba(0,0,0,0.5);
        transition: right 0.4s cubic-bezier(0.19, 1, 0.22, 1);
        display: flex;
        flex-direction: column;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    sidebar.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
            <h3 style="margin:0; color:#8e44ad; font-size: 18px;">✨ Rekindle Recap</h3>
            <span id="rekindle-close-sidebar" style="cursor:pointer; font-size:20px; color:#666;">&times;</span>
        </div>
        <div id="rekindle-status-meta" style="font-size: 11px; color: #888; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 8px;">
            🔍 Ready to recap...
        </div>
        <div id="rekindle-content" style="flex:1; overflow-y:auto; line-height:1.6; font-size: 0.95rem; color: #ccc;">
            <p style="color:#666; font-style: italic;">Select "Recap" to generate a summary.</p>
        </div>
        <div style="font-size: 0.7rem; color: #444; margin-top: 24px; text-align: center; border-top: 1px solid #222; padding-top: 12px;">Rekindle AI Companion</div>
    `;

    document.body.appendChild(sidebar);

    document.getElementById('rekindle-close-sidebar').onclick = () => {
        sidebar.style.right = '-400px';
    };

    return sidebar;
}

function showRecap(text) {
    const sidebar = createRecapSidebar();
    const content = document.getElementById('rekindle-content');
    content.innerHTML = `<div style="animation: fadeSlideIn 0.4s ease both; white-space: pre-wrap;">${text}</div>`;
    sidebar.style.right = '0';
}

function showLoading() {
    const sidebar = createRecapSidebar();
    const content = document.getElementById('rekindle-content');
    content.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:16px; margin-top:64px;">
            <div class="rekindle-spinner"></div>
            <p style="color: #888; font-size: 0.9rem;">Reading between the lines...</p>
        </div>
    `;
    sidebar.style.right = '0';
}

// Inject Floating Recap Button
function injectFloatingButton() {
    if (document.getElementById('rekindle-floating-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'rekindle-floating-btn';
    btn.innerHTML = '✨ <span class="rekindle-btn-text">Recap</span>';
    btn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: #8e44ad;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 30px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    btn.onmouseenter = () => {
        btn.style.transform = 'scale(1.1) translateY(-5px)';
        btn.style.background = '#9b59b6';
    };
    btn.onmouseleave = () => {
        btn.style.transform = 'scale(1) translateY(0)';
        btn.style.background = '#8e44ad';
    };

    btn.onclick = () => {
        const title = getBookTitle();
        const text = extractPageText();

        if (!text) {
            alert("Could not extract text from current page. Please ensure a book is open and wait a second for it to load.");
            return;
        }

        showLoading();

        // Safety timeout for message response
        const sidebar = document.getElementById('rekindle-sidebar'); // Get sidebar reference for timeout check
        const timeout = setTimeout(() => {
            if (sidebar.style.right === '0px' && document.getElementById('rekindle-content').innerText.includes('Reading')) {
                showRecap(`<p style="color:#ff5252;">Recap hung or timed out. Please try reloading the page.</p>`);
            }
        }, 22000);

        chrome.runtime.sendMessage({
            type: 'GET_RECAP',
            payload: { title, text }
        }, (response) => {
            clearTimeout(timeout);
            if (response && response.recap) {
                showRecap(response.recap);
            } else if (response && response.error) {
                showRecap(`<p style="color:#ff5252; padding: 12px; background: rgba(255,82,82,0.1); border-radius: 8px;">Error: ${response.error}</p>`);
            }
        });
    };

    document.body.appendChild(btn);
}

// Passive Reading Observer: Captures text as the user reads
let lastTextCaptured = "";
let captureInterval = null;

function startReadingObserver() {
    if (captureInterval) return;

    captureInterval = setInterval(() => {
        const title = getBookTitle();
        const text = extractPageText();

        if (text && text !== lastTextCaptured && text.length > 200) {
            lastTextCaptured = text;
            chrome.runtime.sendMessage({
                type: 'INDEX_TEXT',
                payload: { asin: title, title, text }
            });
        }
    }, 5000); // Check every 5 seconds for new content
}

// Start injection and observer
if (window.top === window) {
    injectFloatingButton();
    startReadingObserver();
}
