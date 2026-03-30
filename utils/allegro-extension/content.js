// Content script for localhost:3000/products/allegro
console.log('[Allegro Extension] Content script loaded');

document.addEventListener('mouseover', (e) => {
    // Check if Shift key is pressed
    if (!e.shiftKey) return;

    const link = e.target.closest('a[href*="allegro.pl"]');
    if (!link) return;

    const url = link.href;
    if (!url.includes('allegro.pl')) return;

    console.log('[Allegro Extension] Allegro link hovered with Shift:', url);

    // Send message to background script to open tab and extract price
    try {
        chrome.runtime.sendMessage({
            action: 'extractPrice',
            url: url
        });
    } catch (error) {
        console.error('[Allegro Extension] Extension context invalidated. Please reload the page.');
    }
}, true);
