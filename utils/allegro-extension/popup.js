// Popup script for extension
console.log('[Allegro Extension Popup] Loaded');

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
        statusEl.className = 'status';
    }, 3000);
}

// Get current tab
async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

// Check if we're on the right page
async function checkPage() {
    const tab = await getCurrentTab();
    const isAllegroPage = tab.url.includes('localhost:3000/products/allegro');
    const isSellersPage = tab.url.includes('localhost:3000/sellers/');

    if (!isAllegroPage && !isSellersPage) {
        showStatus('Please open /products/allegro or /sellers page', 'error');
        return false;
    }
    return true;
}

// Batch All button
document.getElementById('batchAll').addEventListener('click', async () => {
    console.log('[Allegro Extension Popup] Batch All clicked');

    if (!await checkPage()) return;

    const tab = await getCurrentTab();

    try {
        // Send message to content script
        chrome.tabs.sendMessage(tab.id, {
            action: 'startBatchProcessing',
            positiveOnly: false,
            suspiciousOnly: false
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Allegro Extension Popup] Error:', chrome.runtime.lastError);
                showStatus('Error: Please reload the page', 'error');
            } else {
                showStatus('Batch processing started!', 'success');
            }
        });
    } catch (error) {
        console.error('[Allegro Extension Popup] Error:', error);
        showStatus('Error starting batch processing', 'error');
    }
});

// Batch Suspicious button
document.getElementById('batchSuspicious').addEventListener('click', async () => {
    console.log('[Allegro Extension Popup] Batch Suspicious clicked');

    if (!await checkPage()) return;

    const tab = await getCurrentTab();

    try {
        // Send message to content script
        chrome.tabs.sendMessage(tab.id, {
            action: 'startBatchProcessing',
            positiveOnly: false,
            suspiciousOnly: true
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Allegro Extension Popup] Error:', chrome.runtime.lastError);
                showStatus('Error: Please reload the page', 'error');
            } else {
                showStatus('Batch processing started!', 'success');
            }
        });
    } catch (error) {
        console.error('[Allegro Extension Popup] Error:', error);
        showStatus('Error starting batch processing', 'error');
    }
});

// Check page on load
checkPage().then(isValid => {
    if (isValid) {
        showStatus('Ready to process', 'success');
    }
});
