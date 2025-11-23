document.addEventListener("DOMContentLoaded", () => {
  const apiInput = document.getElementById("api-key");
  const saveBtn = document.getElementById("save-button");
  const errorMsg = document.getElementById("error-message");

  // ✅ Step Switch Function
  function switchStep(step) {
    document.querySelectorAll(".step-page").forEach(p => p.classList.remove("active"));
    document.querySelector("#step" + step).classList.add("active");

    document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
    document.querySelector(`.step[data-step="${step}"]`).classList.add("active");
  }

  // ✅ Reliable Key Validator (with 4-second timeout)
  async function validateKey(key) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        { signal: controller.signal }
      );

      clearTimeout(timeout);
      if (!resp.ok) return false;

      const data = await resp.json();
      return Array.isArray(data?.models); // Valid key returns models list

    } catch (e) {
      return false;
    }
  }

  // ✅ Load saved key (if any) and auto-validate
  chrome.storage.sync.get(["geminiApiKey"], async (res) => {
    const savedKey = res.geminiApiKey;
    if (savedKey) {
      apiInput.value = savedKey;
      
      const isValid = await validateKey(savedKey);
      
      if (isValid) {
        switchStep(2); // Auto-skip to Step 2 if saved key is valid
      } else {
        errorMsg.innerText = "The previously saved API Key appears to be invalid or expired. Please enter a new key.";
        errorMsg.style.display = "block";
      }
    }
  });


  // ✅ Save button click
  saveBtn.addEventListener("click", async () => {
    const key = apiInput.value.trim();
    if (!key) return;

    saveBtn.innerText = "Validating...";
    saveBtn.classList.add('loading'); 
    saveBtn.disabled = true;
    errorMsg.style.display = "none";

    const isValid = await validateKey(key);

    saveBtn.classList.remove('loading'); 

    if (!isValid) {
      errorMsg.innerText = "Invalid or expired API Key. Please ensure the key is correct and active.";
      errorMsg.style.display = "block";
      saveBtn.innerText = "Save API Key (Failed)";
      saveBtn.style.backgroundColor = '#dc3545';
      saveBtn.style.color = '#fff';
      saveBtn.disabled = false;
      return;
    }

    // Success State
    chrome.storage.sync.set({ geminiApiKey: key }, () => {
      errorMsg.style.display = "none";
      saveBtn.style.backgroundColor = '#28a745';
      saveBtn.innerText = "Successfully Saved! ✓";
      
      setTimeout(() => {
        // Reset button colors and text before switching
        saveBtn.style.backgroundColor = '';
        saveBtn.style.color = '';
        switchStep(2);
        saveBtn.innerText = "Save and Validate API Key";
        saveBtn.disabled = false;
      }, 1000);
    });
  });

  // ✅ Step 2 → Step 3
  document.getElementById("go-step3").addEventListener("click", () => switchStep(3));
  
  // ✅ FIX: Open AI Studio Button
  document.getElementById("open-ai-studio-btn").addEventListener("click", () => {
      window.open('https://makersuite.google.com/app/apikey', '_blank');
  });

  // ✅ Close Button (actually closes the options tab)
  const closeBtn = document.getElementById("close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      chrome.tabs.getCurrent((tab) => {
        if (tab) chrome.tabs.remove(tab.id);
        else window.close();
      });
    });
  }

});