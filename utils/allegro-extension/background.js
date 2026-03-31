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

    // First, get the best offer with price and offers link
    const articles = document.querySelectorAll('.opbox-listing li article');
    console.log('[Allegro Extension] Found articles:', articles.length);

    const offers = [...articles]
        .map(el => {
            const priceEl = el.querySelector('p[tabindex="0"]');
            const offersLink = el.querySelector('[data-role-type="product-fiche-link"]');

            if (!priceEl) return null;

            const priceText = priceEl.innerText;
            const price = parseFloat(priceText.replace(",", "."));

            console.log('[Allegro Extension] Article:', {
                price: price,
                hasOffersLink: !!offersLink,
                offersHref: offersLink?.href
            });

            return {
                price: price,
                offersLink: offersLink?.href || null
            };
        })
        .filter(offer => offer && !isNaN(offer.price))
        .sort((a, b) => a.price - b.price);

    console.log('[Allegro Extension] All offers (sorted):', offers);

    if (offers.length === 0) {
        console.log('[Allegro Extension] No offers found');
        return null;
    }

    const bestOffer = offers[0];
    console.log('[Allegro Extension] Best offer:', bestOffer);

    // If best offer has an offers link, we need to navigate there
    if (bestOffer.offersLink) {
        console.log('[Allegro Extension] Best offer has offers link, need to navigate');
        return {
            needsNavigation: true,
            url: bestOffer.offersLink
        };
    }

    // Otherwise, use the price directly
    console.log('[Allegro Extension] Using direct price:', bestOffer.price);
    return {
        needsNavigation: false,
        price: bestOffer.price
    };
}

// Function to extract price from offers page
function extractPriceFromOffers() {
    console.log('[Allegro Extension] Extracting price from offers page...');

    const elements = document.querySelectorAll('.opbox-listing li p[tabindex="0"]');
    console.log('[Allegro Extension] Found price elements:', elements.length);

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

// Helper function to extract price with optional navigation to offers page
function extractPriceWithNavigation(tabId, callback) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: extractPrice
    }).then((results) => {
        console.log('[Allegro Extension] Script results:', results);

        if (results && results[0] && results[0].result) {
            const result = results[0].result;
            console.log('[Allegro Extension] Extraction result:', result);

            // Check if we need to navigate to offers page
            if (result.needsNavigation) {
                console.log('[Allegro Extension] Navigating to offers page:', result.url);

                // Navigate to offers page
                chrome.tabs.update(tabId, { url: result.url }, () => {
                    // Wait for offers page to load
                    chrome.tabs.onUpdated.addListener(function offersListener(tabIdUpdated, info) {
                        if (tabIdUpdated === tabId && info.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(offersListener);

                            setTimeout(() => {
                                // Extract price from offers page
                                chrome.scripting.executeScript({
                                    target: { tabId: tabId },
                                    func: extractPriceFromOffers
                                }).then((offersResults) => {
                                    if (offersResults && offersResults[0] && offersResults[0].result) {
                                        const price = offersResults[0].result;
                                        console.log('[Allegro Extension] Price from offers:', price);
                                        callback({ success: true, price: price });
                                    } else {
                                        console.warn('[Allegro Extension] No price found on offers page');
                                        callback({ success: false, error: 'No price on offers page' });
                                    }
                                }).catch(err => {
                                    console.error('[Allegro Extension] Offers extraction error:', err);
                                    callback({ success: false, error: err });
                                });
                            }, 2000);
                        }
                    });
                });
            } else if (result.price) {
                // Use direct price
                console.log('[Allegro Extension] Using direct price:', result.price);
                callback({ success: true, price: result.price });
            } else {
                console.warn('[Allegro Extension] No price found');
                callback({ success: false, error: 'No price found' });
            }
        } else {
            console.warn('[Allegro Extension] No result from extraction');
            callback({ success: false, error: 'No result from extraction' });
        }
    }).catch(err => {
        console.error('[Allegro Extension] Script execution error:', err);
        callback({ success: false, error: err });
    });
}

// Helper function to handle extracted price
function handlePriceExtracted(allegroTabId, originTabId, gtin, price, shouldClickAgain) {
    console.log('[Allegro Extension] Handling extracted price:', price);

    // Copy to clipboard
    chrome.scripting.executeScript({
        target: { tabId: allegroTabId },
        func: copyToClipboard,
        args: [price.toString()]
    }).then(() => {
        console.log('[Allegro Extension] Copied to clipboard:', price);

        // Close the Allegro tab
        chrome.tabs.remove(allegroTabId, () => {
            console.log('[Allegro Extension] Tab closed:', allegroTabId);
        });

        // Fill price on original page
        chrome.scripting.executeScript({
            target: { tabId: originTabId },
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
                                const result = results[0].result;
                                console.log('[Allegro Extension] Batch extraction result:', result);

                                // Check if we need to navigate to offers page
                                if (result.needsNavigation) {
                                    console.log('[Allegro Extension] Batch: Navigating to offers page:', result.url);

                                    // Navigate to offers page
                                    chrome.tabs.update(tab.id, { url: result.url }, () => {
                                        // Wait for offers page to load
                                        chrome.tabs.onUpdated.addListener(function offersListener(tabId, info) {
                                            if (tabId === tab.id && info.status === 'complete') {
                                                chrome.tabs.onUpdated.removeListener(offersListener);

                                                setTimeout(() => {
                                                    // Extract price from offers page
                                                    chrome.scripting.executeScript({
                                                        target: { tabId: tab.id },
                                                        func: extractPriceFromOffers
                                                    }).then((offersResults) => {
                                                        if (offersResults && offersResults[0] && offersResults[0].result) {
                                                            const price = offersResults[0].result;
                                                            console.log('[Allegro Extension] Batch price from offers:', price);

                                                            // Close tab and fill price
                                                            chrome.tabs.remove(tab.id);
                                                            fillPriceAndResolve(originTabId, gtin, price, resolve, url);
                                                        } else {
                                                            console.warn('[Allegro Extension] Batch: No price found on offers page');
                                                            chrome.tabs.remove(tab.id);
                                                            resolve({ success: false, url, error: 'No price on offers page' });
                                                        }
                                                    }).catch(err => {
                                                        console.error('[Allegro Extension] Batch offers extraction error:', err);
                                                        chrome.tabs.remove(tab.id);
                                                        resolve({ success: false, url, error: err });
                                                    });
                                                }, 2000);
                                            }
                                        });
                                    });
                                } else if (result.price) {
                                    // Use direct price
                                    console.log('[Allegro Extension] Batch: Using direct price:', result.price);
                                    chrome.tabs.remove(tab.id);
                                    fillPriceAndResolve(originTabId, gtin, result.price, resolve, url);
                                } else {
                                    console.warn('[Allegro Extension] Batch: No price found');
                                    chrome.tabs.remove(tab.id);
                                    resolve({ success: false, url, error: 'No price found' });
                                }
                            } else {
                                chrome.tabs.remove(tab.id);
                                resolve({ success: false, url, error: 'No result from extraction' });
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

// Helper function to fill price and resolve batch promise
function fillPriceAndResolve(originTabId, gtin, price, resolve, url) {
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
                            // Extract price with optional navigation to offers
                            extractPriceWithNavigation(tab.id, (result) => {
                                if (result.success) {
                                    handlePriceExtracted(tab.id, sender.tab.id, gtin, result.price, shouldClickAgain);
                                } else {
                                    console.warn('[Allegro Extension] Failed to extract price:', result.error);
                                    chrome.tabs.remove(tab.id);
                                }

                                // Clean up
                                processingUrls.delete(url);
                            });
                        }, 2000); // Wait 2 seconds for dynamic content
                    }
                }
            });
        });
    }
});
