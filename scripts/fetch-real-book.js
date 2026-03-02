import fs from 'fs';
import https from 'https';

// Download Mary Shelley's Frankenstein from Project Gutenberg
const url = 'https://www.gutenberg.org/cache/epub/84/pg84.txt';
const dest = 'public/test_document.txt';

console.log("Downloading a realistic 100+ page novel (Frankenstein) for testing...");

https.get(url, (res) => {
    let rawData = '';

    // Handle redirects if any
    if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, processResponse);
    } else {
        processResponse(res);
    }

    function processResponse(response) {
        response.on('data', (chunk) => { rawData += chunk; });
        response.on('end', () => {
            // Clean up the Project Gutenberg boilerplate headers and footers
            const startMarker = "*** START OF THE PROJECT GUTENBERG EBOOK FRANKENSTEIN ***";
            const endMarker = "*** END OF THE PROJECT GUTENBERG EBOOK FRANKENSTEIN ***";

            let startIndex = rawData.indexOf(startMarker);
            let endIndex = rawData.indexOf(endMarker);

            if (startIndex !== -1 && endIndex !== -1) {
                // Extract just the story text
                let bookText = rawData.substring(startIndex + startMarker.length, endIndex).trim();
                fs.writeFileSync(dest, bookText);
                console.log("Successfully downloaded and cleaned Frankenstein!");
            } else {
                // Fallback: save the whole thing if markers changed
                fs.writeFileSync(dest, rawData);
                console.log("Downloaded novel, but couldn't find exact Gutenberg markers. Saved raw version.");
            }
        });
    }
}).on('error', (e) => {
    console.error(`Error downloading the novel: ${e.message}`);
});
