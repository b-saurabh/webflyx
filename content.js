/**
 * This content script is injected into every page.
 * Its purpose is to prevent new tabs from being opened from the page's content.
 */

// --- 1. Intercept window.open() ---
// Some websites use window.open() to create popups or new tabs.
// We override it to redirect the URL to our background script,
// which will open it in the single existing tab.
const originalWindowOpen = window.open;
window.open = function(url, name, features) {
  console.log(`Single Tab: Intercepted window.open call for URL: ${url}`);
  if (url) {
    chrome.runtime.sendMessage({
      action: "openInSameTab",
      url: url
    });
  }
  // Return null to prevent the original window from being opened.
  return null;
};


// --- 2. Modify links with target="_blank" ---
// Links with `target="_blank"` are designed to open in a new tab.
// We need to change them to `target="_self"` to open in the same tab.

function modifyLinks() {
  const links = document.querySelectorAll('a[target="_blank"]');
  links.forEach(link => {
    link.target = '_self';
  });
}

// Run the function once the initial DOM is loaded.
modifyLinks();

// --- 3. Handle dynamically added content ---
// Modern websites often load content dynamically. A MutationObserver
// allows us to react to changes in the DOM and modify new links as they are added.
const observer = new MutationObserver((mutationsList, observer) => {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      // A new node was added, so we re-run our link modification logic.
      modifyLinks();
    }
  }
});

// Start observing the entire document body for changes.
observer.observe(document.body, { childList: true, subtree: true });

console.log("Single Tab content script loaded and active.");