# ReKindle Recap

ReKindle Recap is an interactive AI-powered reading companion that provides progressive, spoiler-free summaries of your EPUB and PDF books. It analyzes the text as you read and securely generates recaps of the plot and character arcs using the LLM of your choice (OpenAI, Gemini, or Claude).

By adhering to a strict **Amnesia Protocol**, the AI only accesses context up to your current reading position, ensuring future events are never spoiled.

## Key Features

- **Local File Support:** Read EPUB or PDF files locally. Your books never leave your device.
- **Dynamic RAG Context:** Intelligent text chunking and multi-pass Retrieval-Augmented Generation context retrieval.
- **Spoiler-Free Recaps:** Generates progressive plot timelines and expanding character arc cards.
- **"Ask a Question":** Chat with an AI assistant about the events of the book without encountering spoilers.
- **Recap Caching & History:** Previously generated recaps are stored locally using IndexedDB for instant, cost-free reloading.
- **Session Awareness:** Automatically detects when you resume reading after a break and offers a recap to refresh your memory.
- **Premium UI:** Glassmorphism design, dark/light theme options, keyboard shortcuts, and responsive layouts.

## Getting Started

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the local development server.
4. Access the web interface, add your preferred API Key (OpenAI, Gemini, or Claude) in the Settings panel, and upload a book!

## Tech Stack

- React
- Vite
- Lucide React (Icons)
- IndexedDB (Vector Cache Database)
- PDF.js / ePub.js


https://github.com/user-attachments/assets/58df1693-bce1-4191-b5ce-0d864ff4f600



