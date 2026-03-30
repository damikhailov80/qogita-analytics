// Background service worker
let processingUrls = new Set();
let batchProcessingState = {
    isProcessing: false,
    links: [],
    currentIndex: 0,
    originTabId: null
};

// Function to extract price from Allegro page
function extractPrice() {
    console.log('[Allegro Extension] Extracting price from page...');

    const elements = document.querySelectorAll('.opbox-listing li p[tabindex="0"]');
    console.log('[Allegro Extension] Found elements:', elements.length);

    const prices = [...elements]
        .map(i => {
            const text = i.innerText;
            const parsed = parseFloat(text.replace(",", "."));
            console.log('[Allegro Extension] Element text:', text, '-> parsed:', parsed);
            return parsed;
        })
        .filter(i => !isNaN(i))
        .sort((a, b) => a - b);

    console.log('[Allegro Extension] All prices (sorted):', prices);
    const result = prices[0] || null;
    console.log('[Allegro Extension] Returning price:', result);

    return result;
}

// Function to copy text to clipboard (injected into page)
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        const successful = document.execCommand('copy');
        console.log('[Allegro Extension] Copy command:', successful ? 'successful' : 'failed');
    } catch (err) {
        console.error('[Allegro Extension] Copy error:', err);
    }

    document.body.removeChild(textarea);
}

// Function to fill price input on original page
function fillPriceInput(gtin, price, shouldClickAgain) {
    console.log('[Allegro Extension] Looking for button with gtin:', gtin);
    console.log('[Allegro Extension] Should click again:', shouldClickAgain);

    // Find button with data-gtin attribute
    const button = document.querySelector(`button[data-gtin="${gtin}"]`);
    if (!button) {
        console.error('[Allegro Extension] Button not found for gtin:', gtin);
        return false;
    }

    console.log('[Allegro Extension] Button found, clicking...');
    button.click();

    // Wait for input to appear and fill it
    const checkInput = setInterval(() => {
        const input = document.querySelector(`input[data-gtin="${gtin}"]`);
        if (input) {
            console.log('[Allegro Extension] Input found, filling with price:', price);
            input.value = price;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            clearInterval(checkInput);

            // If shouldClickAgain is true, click the button again after a short delay
            if (shouldClickAgain) {
                setTimeout(() => {
                    console.log('[Allegro Extension] Clicking button again...');
                    button.click();
                }, 300);
            }
        }
    }, 100);

    // Stop checking after 5 seconds
    setTimeout(() => clearInterval(checkInput), 5000);

    return true;
}

// Process single URL in batch
function processBatchItem(url, originTabId) {
    return new Promise((resolve, reject) => {
        console.log('[Allegro Extension] Processing batch item:', url);

        // Extract GTIN from URL
        const gtinMatch = url.match(/string=(\d+)/);
        if (!gtinMatch) {
            console.error('[Allegro Extension] Could not extract GTIN from URL:', url);
            resolve({ success: false, url });
            return;
        }
        const gtin = gtinMatch[1];

        // Open in new tab
        chrome.tabs.create({
            url: url,
            active: false
        }, (tab) => {
            // Wait for page to load
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);

                    // Add delay for DOM
                    setTimeout(() => {
                        // Extract price
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: extractPrice
                        }).then((results) => {
                            if (results && results[0] && results[0].result) {
                                const price = results[0].result;
                                console.log('[Allegro Extension] Batch price extracted:', price);

                                // Close the Allegro tab
                                chrome.tabs.remove(tab.id);

                                // Fill price on original page with auto-save
                                chrome.scripting.executeScript({
                                    target: { tabId: originTabId },
                                    func: fillPriceInput,
                                    args: [gtin, price.toString(), true] // Always auto-save in batch
                                }).then(() => {
                                    // Wait for save to complete before resolving
                                    setTimeout(() => {
                                        resolve({ success: true, url, price });
                                    }, 1000);
                                }).catch(err => {
                                    console.error('[Allegro Extension] Error filling price:', err);
                                    resolve({ success: false, url, error: err });
                                });
                            } else {
                                chrome.tabs.remove(tab.id);
                                resolve({ success: false, url, error: 'No price found' });
                            }
                        }).catch(err => {
                            chrome.tabs.remove(tab.id);
                            resolve({ success: false, url, error: err });
                        });
                    }, 2000);
                }
            });
        });
    });
}

// Process batch sequentially
async function processBatch(links, originTabId) {
    console.log('[Allegro Extension] Starting batch processing of', links.length, 'links');

    const results = [];

    for (let i = 0; i < links.length; i++) {
        batchProcessingState.currentIndex = i;

        // Send progress update
        chrome.tabs.sendMessage(originTabId, {
            action: 'batchProcessingProgress',
            current: i + 1,
            total: links.length
        }).catch(() => { });

        const result = await processBatchItem(links[i], originTabId);
        results.push(result);

        console.log(`[Allegro Extension] Processed ${i + 1}/${links.length}`);
    }

    // Send completion message
    chrome.tabs.sendMessage(originTabId, {
        action: 'batchProcessingComplete',
        count: results.filter(r => r.success).length,
        total: links.length
    }).catch(() => { });

    batchProcessingState.isProcessing = false;
    console.log('[Allegro Extension] Batch processing complete');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startBatchProcessing') {
        if (batchProcessingState.isProcessing) {
            console.log('[Allegro Extension] Batch processing already in progress');
            return;
        }

        batchProcessingState.isProcessing = true;
        batchProcessingState.links = message.links;
        batchProcessingState.currentIndex = 0;
        batchProcessingState.originTabId = sender.tab.id;

        processBatch(message.links, sender.tab.id);
        return;
    }

    if (message.action === 'extractPrice') {
        const url = message.url;
        const shouldClickAgain = message.shouldClickAgain || false;

        console.log('[Allegro Extension] Received request for URL:', url);
        console.log('[Allegro Extension] Should click again:', shouldClickAgain);

        // Extract GTIN from URL
        const gtinMatch = url.match(/string=(\d+)/);
        if (!gtinMatch) {
            console.error('[Allegro Extension] Could not extract GTIN from URL:', url);
            return;
        }
        const gtin = gtinMatch[1];
        console.log('[Allegro Extension] Extracted GTIN:', gtin);

        // Prevent duplicate processing
        if (processingUrls.has(url)) {
            console.log('[Allegro Extension] URL already processing, skipping:', url);
            return;
        }
        processingUrls.add(url);

        // Open in new tab next to current
        chrome.tabs.create({
            url: url,
            active: false,
            index: sender.tab.index + 1
        }, (tab) => {
            console.log('[Allegro Extension] Tab created:', tab.id);

            // Wait for page to load, then inject script
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id) {
                    console.log('[Allegro Extension] Tab update:', tabId, info.status);

                    if (info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        console.log('[Allegro Extension] Page loaded, executing script...');

                        // Add delay to ensure DOM is ready
                        setTimeout(() => {
                            // Inject and execute price extraction script
                            chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                func: extractPrice
                            }).then((results) => {
                                console.log('[Allegro Extension] Script results:', results);

                                if (results && results[0] && results[0].result) {
                                    const price = results[0].result;
                                    console.log('[Allegro Extension] Price extracted:', price);

                                    // Copy to clipboard using textarea method
                                    chrome.scripting.executeScript({
                                        target: { tabId: tab.id },
                                        func: copyToClipboard,
                                        args: [price.toString()]
                                    }).then(() => {
                                        console.log('[Allegro Extension] Copied to clipboard:', price);

                                        // Close the tab after copying
                                        chrome.tabs.remove(tab.id, () => {
                                            console.log('[Allegro Extension] Tab closed:', tab.id);
                                        });

                                        // Now interact with the original page
                                        chrome.scripting.executeScript({
                                            target: { tabId: sender.tab.id },
                                            func: fillPriceInput,
                                            args: [gtin, price.toString(), shouldClickAgain]
                                        }).then(() => {
                                            console.log('[Allegro Extension] Price filled on original page');
                                        }).catch(err => {
                                            console.error('[Allegro Extension] Error filling price:', err);
                                        });
                                    }).catch(err => {
                                        console.error('[Allegro Extension] Clipboard error:', err);
                                    });
                                } else {
                                    console.warn('[Allegro Extension] No price found on page');
                                }

                                // Clean up
                                processingUrls.delete(url);
                            }).catch(err => {
                                console.error('[Allegro Extension] Script execution error:', err);
                                processingUrls.delete(url);
                            });
                        }, 2000); // Wait 2 seconds for dynamic content
                    }
                }
            });
        });
    }
});
