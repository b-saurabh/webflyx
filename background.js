/**
 * This is the background service worker for the Single Tab extension.
 * It enforces the rule that only one tab can be open at a time.
 */

// This is the core function to enforce the single tab rule.
async function enforceSingleTab() {
  // Get all tabs across all windows.
  const allTabs = await chrome.tabs.query({});

  // If 0 or 1 tab, nothing to do. If 1, just store its ID.
  if (allTabs.length <= 1) {
    if (allTabs.length === 1) {
        chrome.storage.local.set({ singleTabId: allTabs[0].id });
    }
    return;
  }

  // More than one tab exists. We must close the extras.
  let tabToKeep = null;
  const result = await chrome.storage.local.get('singleTabId');
  const storedTabId = result.singleTabId;

  // 1. Check if the stored tab is still open.
  if (storedTabId) {
    tabToKeep = allTabs.find(t => t.id === storedTabId);
  }

  // 2. If stored tab is gone, try to keep the currently active tab.
  if (!tabToKeep) {
    tabToKeep = allTabs.find(t => t.active);
  }

  // 3. If no tab is active (can happen), just pick the first one in the array.
  if (!tabToKeep) {
    tabToKeep = allTabs[0];
  }

  // Store the ID of the tab we are keeping.
  chrome.storage.local.set({ singleTabId: tabToKeep.id });

  // And close all other tabs.
  const tabsToCloseIds = allTabs
    .filter(t => t.id !== tabToKeep.id)
    .map(t => t.id);

  await chrome.tabs.remove(tabsToCloseIds);
}

// This function handles the edge case where the browser starts with zero tabs.
async function ensureAtLeastOneTab() {
    const tabs = await chrome.tabs.query({});
    if (tabs.length === 0) {
        const newTab = await chrome.tabs.create({});
        chrome.storage.local.set({ singleTabId: newTab.id });
    }
}

// --- Event Listeners ---

// On extension install, run the enforcement logic.
chrome.runtime.onInstalled.addListener(() => {
  console.log("Single Tab extension installed/updated.");
  enforceSingleTab();
});

// On browser startup, ensure we have at least one tab and then enforce the rule.
chrome.runtime.onStartup.addListener(() => {
    console.log("Browser started.");
    ensureAtLeastOneTab();
    enforceSingleTab();
});

// When a new tab is created, run the enforcement logic.
// This is the primary event that triggers the one-tab rule.
chrome.tabs.onCreated.addListener((tab) => {
    enforceSingleTab();
});

// Listen for messages from the content script.
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "openInSameTab" && request.url) {
    const result = await chrome.storage.local.get('singleTabId');
    const tabIdToUpdate = result.singleTabId;

    if (tabIdToUpdate) {
      try {
        // Try to update the one and only tab.
        await chrome.tabs.update(tabIdToUpdate, { url: request.url });
      } catch (error) {
        // This can happen if the tab was closed. Create a new one.
        console.error(`Failed to update tab ${tabIdToUpdate}:`, error);
        const newTab = await chrome.tabs.create({ url: request.url });
        chrome.storage.local.set({ singleTabId: newTab.id });
        enforceSingleTab(); // Clean up any other tabs that might have appeared.
      }
    } else {
      // This should be rare, but if we have no tab ID, create a new tab.
      const newTab = await chrome.tabs.create({ url: request.url });
      chrome.storage.local.set({ singleTabId: newTab.id });
      enforceSingleTab(); // Clean up any others.
    }
  }
});