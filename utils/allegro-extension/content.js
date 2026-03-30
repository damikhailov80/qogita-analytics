// Content script for localhost:3000/products/allegro
console.log('[Allegro Extension] Content script loaded');

// Batch processing state
let isBatchProcessing = false;
let batchQueue = [];
let currentBatchIndex = 0;

document.addEventListener('mouseover', (e) => {
    // Check if Shift key is pressed
    if (!e.shiftKey) return;

    // Use closest to find the link even if hovering over child elements
    const link = e.target.closest('a[href*="allegro.pl"]');
    if (!link) return;

    const url = link.href;
    if (!url.includes('allegro.pl')) return;

    // Check if we already processed this link recently (debounce)
    const now = Date.now();
    if (link.dataset.lastProcessed && (now - parseInt(link.dataset.lastProcessed)) < 2000) {
        console.log('[Allegro Extension] Link recently processed, skipping');
        return;
    }
    link.dataset.lastProcessed = now.toString();

    console.log('[Allegro Extension] Allegro link hovered with Shift:', url);
    console.log('[Allegro Extension] Command/Meta key pressed:', e.metaKey);

    // Send message to background script to open tab and extract price
    try {
        chrome.runtime.sendMessage({
            action: 'extractPrice',
            url: url,
            shouldClickAgain: e.metaKey // true if Shift+Command
        });
    } catch (error) {
        console.error('[Allegro Extension] Extension context invalidated. Please reload the page.');
    }
}, true);

// Listen for Command+Shift+U to start batch processing
document.addEventListener('keydown', (e) => {
    if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        console.log('[Allegro Extension] Command+Shift+U pressed - starting batch processing');
        startBatchProcessing();
    } else if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        console.log('[Allegro Extension] Command+Shift+S pressed - starting suspicious batch processing');
        startBatchProcessing(true); // true = suspicious only
    }
});

function startBatchProcessing(suspiciousOnly = false) {
    if (isBatchProcessing) {
        console.log('[Allegro Extension] Batch processing already in progress');
        return;
    }

    // Find all Allegro links on the page
    const allLinks = document.querySelectorAll('a[href*="allegro.pl"]');
    const links = [...allLinks]
        .filter(link => {
            const row = link.closest('tr');
            if (!row) return false;

            // Skip manual price rows in all modes
            if (row.dataset.priceManual === 'true') {
                console.log('[Allegro Extension] Skipping manual price row:', link.href);
                return false;
            }

            // If suspicious only mode, only include suspicious rows
            if (suspiciousOnly) {
                if (row.dataset.roiSuspicious === 'true') {
                    console.log('[Allegro Extension] Including suspicious row:', link.href);
                    return link.href.includes('allegro.pl');
                }
                return false;
            }

            // Normal mode: include all non-manual rows
            return link.href.includes('allegro.pl');
        })
        .map(link => link.href);

    if (links.length === 0) {
        const mode = suspiciousOnly ? 'suspicious' : 'batch';
        console.log(`[Allegro Extension] No Allegro links found for ${mode} processing`);
        alert(`No Allegro links found for ${mode} processing`);
        return;
    }

    const mode = suspiciousOnly ? 'suspicious' : 'all';
    console.log(`[Allegro Extension] Found ${links.length} Allegro links (${mode} mode)`);

    isBatchProcessing = true;
    batchQueue = links;
    currentBatchIndex = 0;

    // Send message to start batch processing
    try {
        chrome.runtime.sendMessage({
            action: 'startBatchProcessing',
            links: links
        });
    } catch (error) {
        console.error('[Allegro Extension] Error starting batch processing:', error);
        isBatchProcessing = false;
    }
}

// Listen for batch processing completion messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'batchProcessingComplete') {
        console.log('[Allegro Extension] Batch processing complete');
        isBatchProcessing = false;
        batchQueue = [];
        currentBatchIndex = 0;
        alert(`Batch processing complete! Processed ${message.count} items.`);
    } else if (message.action === 'batchProcessingProgress') {
        console.log(`[Allegro Extension] Progress: ${message.current}/${message.total}`);
    }
});
