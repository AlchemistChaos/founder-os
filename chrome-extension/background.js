// Background script for Founder OS Chrome Extension

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu
  chrome.contextMenus.create({
    id: "saveToFounderOS",
    title: "Save to Founder OS",
    contexts: ["selection", "page", "link", "image"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveToFounderOS") {
    handleSave(info, tab);
  }
});

// Handle save action
async function handleSave(info, tab) {
  try {
    let content = '';
    let title = tab.title;
    let type = 'clip';

    if (info.selectionText) {
      content = info.selectionText;
      type = 'note';
    } else if (info.linkUrl) {
      content = `Link: ${info.linkUrl}`;
      title = info.linkUrl;
    } else {
      // Get page content via content script
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPageContent
      });
      
      if (results[0]?.result) {
        content = results[0].result.content;
        title = results[0].result.title || tab.title;
      }
    }

    // Send to Founder OS
    await saveToFounderOS({
      title,
      content,
      source_url: tab.url,
      source_name: new URL(tab.url).hostname,
      type,
      tags: await generateTags(content)
    });

    // Show success notification
    chrome.action.setBadgeText({ text: '✓' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 2000);

  } catch (error) {
    console.error('Failed to save:', error);
    chrome.action.setBadgeText({ text: '✗' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 2000);
  }
}

// Function to be injected into page
function extractPageContent() {
  // Remove scripts, styles, and other non-content elements
  const elementsToRemove = ['script', 'style', 'nav', 'header', 'footer', 'aside'];
  elementsToRemove.forEach(tag => {
    const elements = document.getElementsByTagName(tag);
    for (let i = elements.length - 1; i >= 0; i--) {
      elements[i].remove();
    }
  });

  // Get main content
  const main = document.querySelector('main') || 
                document.querySelector('[role="main"]') || 
                document.querySelector('article') ||
                document.body;

  const title = document.title;
  const content = main ? main.innerText.slice(0, 2000) : document.body.innerText.slice(0, 2000);

  return { title, content };
}

// Save to Founder OS API
async function saveToFounderOS(data) {
  const settings = await chrome.storage.sync.get(['founderOsUrl', 'apiKey']);
  const baseUrl = settings.founderOsUrl || 'http://localhost:3000';

  const response = await fetch(`${baseUrl}/api/entries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey || ''}`
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Generate tags for content
async function generateTags(content) {
  // Simple keyword extraction for demo
  const keywords = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .slice(0, 50);

  const businessTerms = ['strategy', 'growth', 'customer', 'product', 'market', 'revenue', 'pricing', 'team', 'funding', 'metrics'];
  const foundTerms = businessTerms.filter(term => keywords.includes(term));

  return foundTerms.length > 0 ? foundTerms.slice(0, 3) : ['general'];
}