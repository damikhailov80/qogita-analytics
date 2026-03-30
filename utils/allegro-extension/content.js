// Content script for localhost:3000/products/allegro
console.log('[Allegro Extension] Content script loaded');

// Batch processing state
let isBatchProcessing = false;
let batchQueue = [];
let currentBatchIndex = 0;

document.addEventListener('mouseover', (e) => {
    // Check if Shift key is pressed
    if (!e.shiftKey) return;

    const link = e.target.closest('a[href*="allegro.pl"]');
    if (!link) return;

    const url = link.href;
    if (!url.includes('allegro.pl')) return;

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
    }
});

function startBatchProcessing() {
    if (isBatchProcessing) {
        console.log('[Allegro Extension] Batch processing already in progress');
        return;
    }

    // Find all Allegro links on the page
    const links = [...document.querySelectorAll('a[href*="allegro.pl"]')]
        .filter(link => link.href.includes('allegro.pl'))
        .map(link => link.href);

    if (links.length === 0) {
        console.log('[Allegro Extension] No Allegro links found');
        alert('No Allegro links found on this page');
        return;
    }

    console.log('[Allegro Extension] Found', links.length, 'Allegro links');

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
