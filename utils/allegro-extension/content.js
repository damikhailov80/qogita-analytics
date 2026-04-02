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
    console.log('[Allegro Extension] Alt key pressed:', e.altKey);

    // Check for modifier key (Command on Mac, Alt on Windows)
    const modifierPressed = e.metaKey || e.altKey;

    // Send message to background script to open tab and extract price
    try {
        chrome.runtime.sendMessage({
            action: 'extractPrice',
            url: url,
            shouldClickAgain: modifierPressed // true if Shift+Command (Mac) or Shift+Alt (Windows)
        });
    } catch (error) {
        console.error('[Allegro Extension] Extension context invalidated. Please reload the page.');
    }
}, true);

// Listen for Command+Shift+U (Mac) or Alt+Shift+U (Windows) to start batch processing
document.addEventListener('keydown', (e) => {
    const modifierPressed = e.metaKey || e.altKey;

    console.log('[Allegro Extension] Key pressed:', {
        key: e.key,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        modifierPressed: modifierPressed
    });

    if (modifierPressed && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        console.log('[Allegro Extension] Modifier+Shift+U pressed - starting positive profit batch processing');
        startBatchProcessing('positive'); // positive = profit > 0
    }
});

function startBatchProcessing(mode = 'all') {
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

            const profit = parseFloat(row.dataset.profit);

            // Filter based on mode
            if (mode === 'positive') {
                // Positive mode: only include rows with profit > 0
                if (!isNaN(profit) && profit > 0) {
                    console.log('[Allegro Extension] Including positive profit row (profit:', profit, '):', link.href);
                    return link.href.includes('allegro.pl');
                }
                return false;
            }

            // All mode: include all non-manual rows
            return link.href.includes('allegro.pl');
        })
        .map(link => link.href);

    if (links.length === 0) {
        console.log(`[Allegro Extension] No Allegro links found for ${mode} processing`);
        alert(`No Allegro links found for ${mode} processing`);
        return;
    }

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
    console.log('[Allegro Extension] Message received:', message);

    if (message.action === 'batchProcessingComplete') {
        console.log('[Allegro Extension] Batch processing complete');
        isBatchProcessing = false;
        batchQueue = [];
        currentBatchIndex = 0;
        alert(`Batch processing complete! Processed ${message.count} items.`);
    } else if (message.action === 'batchProcessingProgress') {
        console.log(`[Allegro Extension] Progress: ${message.current}/${message.total}`);
    } else if (message.action === 'startBatchProcessing') {
        // Message from popup
        console.log('[Allegro Extension] Starting batch processing from popup');
        let mode = 'all';
        if (message.positiveOnly) {
            mode = 'positive';
        }
        startBatchProcessing(mode);
        sendResponse({ success: true });
    }

    return true; // Keep message channel open for async response
});
