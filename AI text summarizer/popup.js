// --- GLOBAL STATE ---
// Variable to store the raw summary text across tab switches (CRITICAL FIX)
let currentSummaryText = ""; 
let isSpeaking = false;
let isPaused = false;
let ttsVoices = []; 

// --- INITIAL MESSAGE ---
const INITIAL_INSTRUCTION = "Select the summary and click summarize."; 


// --- GENERAL FUNCTIONS ---
function setResultHTML(html) {
  document.getElementById("result-content").innerHTML = html;
}

// FIX: Ensure this function correctly sets the global state and formats for display
function setResultText(text) {
  currentSummaryText = text; // <-- SAVE RAW TEXT
  // Convert raw newlines (\n) to HTML line breaks (<br>) for display
  setResultHTML(text.replace(/\n/g, "<br>"));
  // Ensure actions are visible on content set
  const actions = document.querySelector('.floating-actions');
  if (actions) actions.style.display = 'flex';
}

function showLoading(hint = "Summarizing...") {
  const loaderHtml = `
    <div class="loader-container">
      <div class="spinner"></div>
      <p class="loader-hint">${hint}</p>
    </div>
  `;
  document.getElementById("result-content").innerHTML = loaderHtml;
  // Hide actions while loading
  const actions = document.querySelector('.floating-actions');
  if (actions) actions.style.display = 'none'; 
}

// FIX 1: Restore the original, formatted content from the global state
function clearHighlightFormatting() {
  chrome.tts.stop();
  isSpeaking = false;
  isPaused = false;
  document.getElementById("listen-btn").textContent = "Listen";
  
  // Re-load the content from raw text to ensure correct <br> formatting is restored
  if (currentSummaryText) {
      setResultText(currentSummaryText);
  } else {
      loadSummaryResult();
  }
}

function loadSummaryResult() {
    // Buttons are now always visible by default
    if (currentSummaryText) {
        setResultText(currentSummaryText); 
    } else {
        setResultHTML(INITIAL_INSTRUCTION);
    }
}

function copyToClipboard(text) {
    const btn = document.getElementById("copy-btn");
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "Copied";
        setTimeout(() => { btn.textContent = "Copy"; }, 1200);
    }).catch(err => {
        console.error('Could not copy text: ', err);
        alert("Failed to copy text. Please try manually.");
    });
}
// -------------------------

// --- SETTINGS MANAGEMENT (UNCHANGED) ---
const SETTINGS_DEFAULTS = {
    theme: 'light',
    ttsRate: '1.0',
    ttsPitch: '1.0', 
    ttsVoice: '',
};

function applySettings(settings) {
    const body = document.body;
    body.classList.remove('dark-mode');
    if (settings.theme === 'dark') {
        body.classList.add('dark-mode');
    }

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = settings.theme; 

    const ttsRate = document.getElementById('tts-rate');
    if (ttsRate) ttsRate.value = settings.ttsRate;

    const ttsPitch = document.getElementById('tts-pitch');
    if (ttsPitch) ttsPitch.value = settings.ttsPitch;

    const summaryType = document.getElementById('summary-type');
    if (summaryType) summaryType.value = summaryType.value; 
}

function loadSettings() {
    chrome.storage.local.get({ settings: SETTINGS_DEFAULTS }, (result) => {
        applySettings(result.settings);
    });
}

function saveSettings(e) {
    const settingId = e.target.id;
    const value = e.target.value;
    
    chrome.storage.local.get({ settings: SETTINGS_DEFAULTS }, (result) => {
        const newSettings = { ...result.settings };
        
        if (settingId === 'theme-select') newSettings.theme = value;
        if (settingId === 'tts-rate') newSettings.ttsRate = value;
        if (settingId === 'tts-pitch') newSettings.ttsPitch = value;
        if (settingId === 'tts-voice') newSettings.ttsVoice = value;

        chrome.storage.local.set({ settings: newSettings }, () => {
            applySettings(newSettings);
        });
    });
}

// -------------------------

// ---------- COPY ----------
document.getElementById("copy-btn").onclick = () => {
  const txt = currentSummaryText.trim(); 
  if (!txt) {
    // If summary is empty, copy the instructional text instead
    copyToClipboard(document.getElementById("result-content").textContent.trim()); 
    return;
  }
  copyToClipboard(txt);
};

// ---------- LISTEN + HIGHLIGHT (UNCHANGED) ----------

function prepareTextForHighlight() {
  const contentNode = document.getElementById("result-content");
  let text = currentSummaryText; 

  const tokens = text.match(/[\w']+|[.,!?;:()"]|\s|\n/g) || [];
  
  let newHtml = '';
  tokens.forEach(token => {
      let tokenHtml = token;
      
      if (token === '\n') {
          tokenHtml = '<br>';
      } else if (token.trim().length > 0) {
          tokenHtml = `<span class="word">${tokenHtml}</span>`;
      }
      newHtml += tokenHtml;
  });
  
  contentNode.innerHTML = newHtml;
}

function highlightWord(charIndex) {
    const contentNode = document.getElementById("result-content");
    const textWithoutHtml = contentNode.textContent || "";
    const words = document.querySelectorAll("#result-content .word");
    
    let totalLength = 0;
    
    for (let i = 0; i < words.length; i++) {
        const wordText = words[i].textContent; 
        
        const wordStartIndex = textWithoutHtml.indexOf(wordText, totalLength);

        if (wordStartIndex === -1) {
            break;
        }

        const wordEndIndex = wordStartIndex + wordText.length;

        if (charIndex >= wordStartIndex && charIndex < wordEndIndex) {
            words.forEach(w => w.classList.remove("current"));
            words[i].classList.add("current");
            words[i].scrollIntoView({ behavior: "smooth", block: "center" });
            break;
        }

        totalLength = wordEndIndex;
    }
}


async function loadTtsVoices() {
  const voiceSelect = document.getElementById("tts-voice");
  if (!voiceSelect) return;
  voiceSelect.innerHTML = '<option value="">System Default Voice</option>';

  try {
    ttsVoices = await chrome.tts.getVoices(); 
    
    ttsVoices.forEach(voice => {
      if (!voice.remote || voiceSelect.options.length < 5) { 
        const option = document.createElement('option');
        option.value = voice.voiceName;
        option.textContent = `${voice.voiceName} (${voice.lang || 'N/A'})`;
        voiceSelect.appendChild(option);
      }
    });
    
    chrome.storage.local.get({ settings: SETTINGS_DEFAULTS }, (result) => {
        voiceSelect.value = result.settings.ttsVoice || '';
    });
    
  } catch(e) {
    console.error("Could not load TTS voices:", e);
  }
}

document.getElementById("listen-btn").onclick = () => {
  const btn = document.getElementById("listen-btn");
  const text = currentSummaryText.trim(); 
  
  if (!text) {
      alert("Please summarize some text first to enable the Listen function.");
      return;
  }

  const rate = parseFloat(document.getElementById("tts-rate").value);
  const pitch = parseFloat(document.getElementById("tts-pitch").value);
  const voiceName = document.getElementById("tts-voice").value;
  
  const options = {
    rate: rate,
    pitch: pitch,
    onEvent: (event) => {
      if (event.type === "word") highlightWord(event.charIndex);
      if (event.type === "end" || event.type === "interrupted" || event.type === "error") {
        isSpeaking = false;
        isPaused = false;
        btn.textContent = "Listen";
        setResultText(currentSummaryText); 
      }
    }
  };
  if (voiceName) options.voiceName = voiceName;
  
  if (!isSpeaking && !isPaused) {
    prepareTextForHighlight();
    isSpeaking = true;
    isPaused = false;
    btn.textContent = "Pause";
    chrome.tts.speak(text, options); 

  } else if (isSpeaking && !isPaused) {
    chrome.tts.pause();
    isPaused = true;
    btn.textContent = "Resume";

  } else if (isPaused) {
    chrome.tts.resume();
    isPaused = false;
    btn.textContent = "Pause";
  }
};

// -------------------------


// ---------- SUMMARIZE (UNCHANGED) ----------
document.getElementById("summarize").onclick = () => {
  chrome.tts.stop();
  isSpeaking = false;
  isPaused = false;
  document.getElementById("listen-btn").textContent = "Listen";
  clearHighlightFormatting(); 

  const input = document.getElementById("manual-input").value.trim();
  const type = document.getElementById("summary-type").value;

  chrome.storage.sync.get(["geminiApiKey"], (r) => {
    const key = r.geminiApiKey;
    
    if (!key) {
        return setResultHTML("🔑 Gemini API Key is missing. Please set it up in the **Settings** page.");
    }
    
    if (input) {
        const manualTitle = input.substring(0, 80) + (input.length > 80 ? '...' : '');
        return summarize(input, type, key, manualTitle); 
    }

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      const pageTitle = tab?.title || "Untitled Summary"; 
      
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          return setResultHTML("Cannot summarize content on internal Chrome pages (e.g., settings, store).");
      }
      
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { type: "GET_ARTICLE_TEXT" }, (res) =>
            summarize(res?.text || "", type, key, pageTitle)
          );
        }, 250);
      } catch (e) {
         setResultHTML("Error: Could not access or inject content script. Try refreshing the page or pasting text manually.");
      }
    });
  });
};

async function summarize(text, type, key, title) { 
  const actions = document.querySelector('.floating-actions');
  if (actions) actions.style.display = 'none';

  if (text.length < 30) {
      setResultHTML("Not enough text. Select more or ensure a key article element exists.");
      if (actions) actions.style.display = 'flex'; 
      return;
  }
  
  let sourceHint = "Summarizing entire article...";
  if (document.getElementById("manual-input").value.trim()) {
      sourceHint = "Summarizing pasted text...";
  } else if (text.length < 500 && !document.getElementById("manual-input").value.trim()) { 
      sourceHint = "Summarizing selected text...";
  }
  showLoading(sourceHint);
  
  try {
    const result = await callGemini(text, type, key);
    setResultText(result); 
    saveHistory(result, title); 
    if (actions) actions.style.display = 'flex'; 

  } catch (e) {
    setResultHTML(e.message);
    if (actions) actions.style.display = 'flex'; 
  }
}

// --- callGemini FUNCTION (UNCHANGED) ---
async function callGemini(text, type, key) {
  const COMMON_INSTRUCTION = "Do not use special formatting like bolding or italics. Use newline characters for paragraph or line separation.";
  const BULLET_FORMAT_INSTRUCTION = "Start any bullet points with a dash (-). Do not use asterisks (*).";
  
  let contentInstruction = "";
  
  if (type === "brief") { 
      contentInstruction = `Provide a concise summary in a single paragraph, approximately 6 to 7 lines long. Your output MUST NOT contain any bullet points or lists. ${COMMON_INSTRUCTION}\n`;
      
  } else if (type === "detailed") { 
      contentInstruction = `Provide a detailed summary, structuring the output into 5 to 6 distinct paragraphs. Focus on a narrative, paragraph format, but you may use up to 5 bullet points within the summary ONLY if they are absolutely necessary to clearly itemize facts. The primary structure must be paragraphs. ${BULLET_FORMAT_INSTRUCTION} ${COMMON_INSTRUCTION}\n`;
      
  } else { 
      contentInstruction = `Create a list of exactly 10 distinct, well-organized bullet points. Start each point with a dash (-). ${BULLET_FORMAT_INSTRUCTION} ${COMMON_INSTRUCTION}\n`;
  }
  
  const prompt = contentInstruction + text;

  for (let i = 0; i < 4; i++) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    
    const d = await r.json();
    const out = d?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (r.status === 400 && d.error.message.includes("API key not valid")) {
         throw new Error("Invalid Gemini API Key. Please check the **Settings** page.");
    }
    
    if (out) return out.trim();
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("Server busy. Try again.");
}

// ---------- HISTORY (UPDATED) ----------
function saveHistory(summary, title) { 
  const finalTitle = title.substring(0, 80) + (title.length > 80 ? '...' : ''); 
  
  chrome.storage.local.get(["summaryHistory"], (res) => {
    const list = res.summaryHistory || [];
    list.unshift({ title: finalTitle, summary, date: new Date().toLocaleString(), isPinned: false }); 
    chrome.storage.local.set({ summaryHistory: list.slice(0, 30) });
  });
}

function exportSummaryToPdf(index) {
    chrome.storage.local.get(["summaryHistory"], (res) => {
        const sortedList = res.summaryHistory.slice().sort((a, b) => { // Use slice() to prevent sorting the stored list
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.date) - new Date(a.date);
        });
        const item = sortedList[index];

        if (!item) return;

        const title = item.title || "Summary Export";
        const content = item.summary; 

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>AI SummarizerV1 - ${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    h1 { color: #4a6cf7; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
                    .article-title { font-size: 1.8em; font-weight: bold; margin-bottom: 20px; }
                    pre { white-space: pre-wrap; word-wrap: break-word; font-family: Arial, sans-serif; font-size: 1em; }
                    @media print { .export-note { display: none; } }
                </style>
            </head>
            <body>
                <h1 class="article-title">${title}</h1>
                <p>Summary generated on: ${item.date}</p>
                <pre>${content}</pre>
            </body>
            </html>
        `;

        const newWindow = window.open();
        newWindow.document.write(htmlContent);
        newWindow.document.close();

        newWindow.onload = () => {
            setTimeout(() => {
                newWindow.print();
            }, 300);
        };
    });
}

function togglePin(index) {
    chrome.storage.local.get(["summaryHistory"], (res) => {
        const list = res.summaryHistory || [];
        const sortedList = list.slice().sort((a, b) => { // Use slice() to prevent sorting the stored list
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.date) - new Date(a.date);
        });
        
        const originalItem = sortedList[index];
        // Find the index of the original item (by date/summary) in the unsorted list
        const originalIndex = list.findIndex(item => item.date === originalItem.date && item.summary === originalItem.summary);

        if (originalIndex !== -1) {
            list[originalIndex].isPinned = !list[originalIndex].isPinned;
            chrome.storage.local.set({ summaryHistory: list }, loadHistory);
        }
    });
}


function renderHistoryList(list) {
    const box = document.getElementById("history-list");
    if (!list.length) return box.innerHTML = "No saved summaries.";
    
    // Sort a copy of the list for display purposes
    const sortedList = list.slice().sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1; 
        if (!a.isPinned && b.isPinned) return 1; 
        return new Date(b.date) - new Date(a.date); 
    });

    box.innerHTML = sortedList.map((h, i) => `
      <div class="history-item ${h.isPinned ? 'pinned' : ''}" data-i="${i}">
        <small>${h.date}</small>
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
            <p style="font-weight: bold; margin: 0; padding-right: 10px; max-width: 70%;">${h.title || 'Untitled Summary'}</p>
            
            <div style="display: flex; align-items: center; gap: 5px;">
                <button class="pin-btn icon-btn ${h.isPinned ? 'pinned-active' : ''}" data-i="${i}" title="${h.isPinned ? 'Unpin' : 'Pin'} Summary" style="background: none; border: none; padding: 0; margin: 0; font-size: 16px; color: ${h.isPinned ? '#ffc107' : '#999'}; cursor: pointer;">
                    &#128204;
                </button>
            
                <div class="history-actions" style="position: relative;">
                    <button class="options-btn icon-btn" data-i="${i}" style="margin-left: 0; padding: 0 4px; font-size: 16px; line-height: 1; background: none; color: inherit;">&#8942;</button>
                    
                    <div class="options-menu" data-i="${i}" style="position: absolute; right: 0; top: 100%; z-index: 10; background: white; border: 1px solid #ccc; border-radius: 4px; display: none; min-width: 130px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                        <button class="export-pdf-btn" data-i="${i}" style="width: 100%; text-align: left; padding: 8px; background: none; border: none; cursor: pointer; font-size: 13px;">Export as PDF</button>
                    </div>
                </div>
            </div>
        </div>

        <p style="margin: 0 0 10px; font-size: 14px; color: #555;">${h.summary.substring(0,120)}...</p>
        <button class="view-btn" data-i="${i}">View</button>
        <button class="delete-btn" data-i="${i}">Delete</button>
      </div>
    `).join("");
}


function loadHistory() {
  chrome.storage.local.get(["summaryHistory"], (res) => {
    const list = res.summaryHistory || [];
    renderHistoryList(list);
  });
}


function clearAllHistory() {
  if (!confirm("Are you sure you want to delete all summary history? This cannot be undone.")) return;
  chrome.storage.local.set({ summaryHistory: [] }, loadHistory);
}

document.addEventListener("click", (e) => {
  const target = e.target;
    
  if (target.classList.contains("view-btn")) {
    clearHighlightFormatting();
    
    // FIX 2: Correctly retrieve the item from the sorted list using the data-i index
    chrome.storage.local.get(["summaryHistory"], (res) => {
      const list = res.summaryHistory || [];
      const sortedList = list.slice().sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.date) - new Date(a.date);
      });
      const summary = sortedList[target.dataset.i]?.summary;
      if (summary) {
          document.getElementById('manual-input').value = ''; 
          setResultText(summary); 
      }
    });

    switchTab("summary");
  }

  if (target.classList.contains("delete-btn")) {
    chrome.storage.local.get(["summaryHistory"], (res) => {
      const list = res.summaryHistory || [];
      // FIX 3: Correctly retrieve the item from the sorted list using the data-i index
      const sortedList = list.slice().sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.date) - new Date(a.date);
      });
      
      const originalItem = sortedList[target.dataset.i];
      // Find the index of the original item (by date/summary) in the unsorted list
      const originalIndex = list.findIndex(item => item.date === originalItem.date && item.summary === originalItem.summary);
      
      if (originalIndex !== -1) {
          list.splice(originalIndex, 1);
          chrome.storage.local.set({ summaryHistory: list }, loadHistory);
      }
    });
  }

  if (target.classList.contains("pin-btn")) {
      togglePin(parseInt(target.dataset.i));
  }
  
  if (target.classList.contains("options-btn")) {
      const index = target.dataset.i;
      document.querySelectorAll('.options-menu').forEach(menu => {
          if (menu.dataset.i !== index || menu.style.display === 'block') {
              menu.style.display = 'none';
          }
      });
      const menu = target.parentNode.querySelector('.options-menu');
      if (menu) {
          menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      }
      e.stopPropagation(); 
  }
  
  if (target.classList.contains("export-pdf-btn")) {
      exportSummaryToPdf(target.dataset.i);
      target.closest('.options-menu').style.display = 'none'; 
  }

  if (!target.classList.contains('options-btn') && !target.closest('.options-menu')) {
      document.querySelectorAll('.options-menu').forEach(menu => {
          menu.style.display = 'none';
      });
  }
});

document.getElementById("clear-history-btn").addEventListener("click", clearAllHistory);

document.getElementById("open-options-page").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
});

document.getElementById("settings-icon").onclick = () => switchTab("settings");


// TAB SWITCH 
function switchTab(tab) {
  clearHighlightFormatting(); 

  document.querySelectorAll('.options-menu').forEach(menu => menu.style.display = 'none');


  document.querySelectorAll(".tab-btn").forEach(e => e.classList.remove("active"));
  if (tab === "summary") document.getElementById("tab-summary").classList.add("active");
  if (tab === "history") document.getElementById("tab-history").classList.add("active");
  
  document.querySelectorAll(".tab-content").forEach(e => e.classList.remove("active"));
  document.getElementById("tab-" + tab + "-content").classList.add("active");
  
  if (tab === "history") loadHistory();
  if (tab === "settings") loadTtsVoices(); 
  if (tab === "summary") loadSummaryResult();
}

document.getElementById("tab-summary").onclick = () => switchTab("summary");
document.getElementById("tab-history").onclick = () => switchTab("history");


// Initialization
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#tab-settings-content .setting-control').forEach(control => {
        control.addEventListener('change', saveSettings);
    });
    
    loadSettings();
    loadSummaryResult(); 
    
    const actions = document.querySelector('.floating-actions');
    if (actions) actions.style.display = 'flex';
});