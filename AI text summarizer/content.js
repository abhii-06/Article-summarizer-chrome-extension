function getArticleText() {
  // NEW CODE: Check for selection first
  const selection = window.getSelection().toString().trim();
  if (selection.length > 30) {
    return selection; // Return selected text if it's substantial
  }
  
  // Existing logic for entire page follows if no selection is found
  let text = "";

  const article = document.querySelector("article");
  if (article) text = article.innerText;

  if (!text.trim()) {
    const main = document.querySelector("main");
    if (main) text = main.innerText;
  }

  if (!text.trim()) {
    const paragraphs = Array.from(document.querySelectorAll("p"));
    text = paragraphs.map((p) => p.innerText).join("\n");
  }

  if (!text.trim()) {
    const divs = Array.from(document.querySelectorAll("div"));
    const goodDivs = divs.filter((d) => d.innerText && d.innerText.length > 100);
    text = goodDivs.map((d) => d.innerText).join("\n");
  }

  return text.trim();
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_ARTICLE_TEXT") {
    const text = getArticleText();
    sendResponse({ text });
  }
  return true;
});