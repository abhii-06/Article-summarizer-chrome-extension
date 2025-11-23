// background.js

// FIX: Convert to an async function to use promise-based API 
// and resolve the storage check faster, removing the startup delay warning.
chrome.runtime.onInstalled.addListener(async (details) => {
  // Check if the reason for the event is a fresh installation.
  // This ensures the storage check only runs quickly on first install.
  if (details.reason === "install") {
    
    // Use the promise-based chrome API to get the key.
    // This allows us to use await, which is cleaner.
    const result = await chrome.storage.sync.get("geminiApiKey");
    
    if (!result.geminiApiKey) {
      // Open options page only if no key is found on first install
      chrome.tabs.create({
        url: "options.html",
      });
    }
  }
});

// FIX 1: Stop TTS when the service worker is about to unload (most reliable hook for popup closure)
chrome.runtime.onSuspend.addListener(() => {
  console.log("Service Worker Suspending: Stopping TTS.");
  chrome.tts.stop();
});

// FIX 2 & 3: Stop TTS whenever the popup connects or sends a message (redundant safety measures)
chrome.runtime.onConnect.addListener(() => {
  chrome.tts.stop();
});

chrome.runtime.onMessage.addListener(() => {
  // Stop TTS every time any message is received from a content script or popup
  chrome.tts.stop(); 
});