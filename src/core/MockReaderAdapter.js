// ADAPTER FOR REKINDLE RECAP MVP
// This simulates the data pipeline that an actual epub.js or pdf.js reader would provide to the recap system.

export let CURRENT_BOOK_METADATA = {
    title: "Frankenstein",
    author: "Mary Shelley"
};

export function setCurrentBookMetadata(title, author) {
    CURRENT_BOOK_METADATA = { title, author };
}

// The current simulated reading limit. Anything > 10 is in the "future" and must be blocked by RAG.
export let MOCK_CURRENT_PROGRESS = {
    chapterIndex: 10,
    text: "Chapter 10"
};

export let MOCK_BOOK_CHUNKS = [];
