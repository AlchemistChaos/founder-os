// Popup script for Founder OS Chrome Extension

let currentTags = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Pre-fill title
  document.getElementById('title').value = tab.title;
  
  // Set up event listeners
  setupEventListeners();
  
  // Load settings
  loadSettings();
});

function setupEventListeners() {
  // Quick actions
  document.getElementById('savePageBtn').addEventListener('click', saveCurrentPage);
  document.getElementById('saveSelectionBtn').addEventListener('click', saveSelection);
  document.getElementById('openAppBtn').addEventListener('click', openApp);
  
  // Form submission
  document.getElementById('clipForm').addEventListener('submit', handleFormSubmit);
  
  // Generate flashcard
  document.getElementById('generateFlashcardBtn').addEventListener('click', generateFlashcard);
  
  // Tag input
  const tagInput = document.getElementById('tagInput');
  tagInput.addEventListener('keydown', handleTagInput);
  tagInput.addEventListener('blur', addCurrentTag);
}

async function saveCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractPageContent
    });
    
    if (results[0]?.result) {
      document.getElementById('title').value = results[0].result.title || tab.title;
      document.getElementById('content').value = results[0].result.content;
      currentTags = ['web-clip'];
      updateTagsDisplay();
    }
  } catch (error) {
    showStatus('Failed to extract page content', 'error');
  }
}

async function saveSelection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getSelectedText
    });
    
    if (results[0]?.result) {
      document.getElementById('content').value = results[0].result;
      document.getElementById('type').value = 'note';
      currentTags = ['selection'];
      updateTagsDisplay();
    } else {
      showStatus('No text selected', 'error');
    }
  } catch (error) {
    showStatus('Failed to get selection', 'error');
  }
}

async function openApp() {
  const settings = await chrome.storage.sync.get(['founderOsUrl']);
  const url = settings.founderOsUrl || 'http://localhost:3000';
  chrome.tabs.create({ url });
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const formData = {
    title: document.getElementById('title').value,
    content: document.getElementById('content').value,
    type: document.getElementById('type').value,
    tags: currentTags,
    source_url: (await chrome.tabs.query({ active: true, currentWindow: true }))[0].url,
    source_name: new URL((await chrome.tabs.query({ active: true, currentWindow: true }))[0].url).hostname
  };
  
  if (!formData.title || !formData.content) {
    showStatus('Title and content are required', 'error');
    return;
  }
  
  try {
    await saveToFounderOS(formData);
    showStatus('Saved to Founder OS! 🎉', 'success');
    
    // Clear form
    setTimeout(() => {
      window.close();
    }, 1500);
  } catch (error) {
    showStatus('Failed to save', 'error');
  }
}

async function generateFlashcard() {
  const content = document.getElementById('content').value;
  if (!content) {
    showStatus('Add content first', 'error');
    return;
  }
  
  try {
    const settings = await chrome.storage.sync.get(['founderOsUrl']);
    const baseUrl = settings.founderOsUrl || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/generate-flashcard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    
    if (response.ok) {
      showStatus('Flashcard generated! Check your app', 'success');
      currentTags = [...currentTags, 'flashcard'];
      updateTagsDisplay();
    } else {
      throw new Error('API error');
    }
  } catch (error) {
    showStatus('Failed to generate flashcard', 'error');
  }
}

function handleTagInput(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addCurrentTag();
  } else if (e.key === 'Backspace' && e.target.value === '' && currentTags.length > 0) {
    removeTag(currentTags.length - 1);
  }
}

function addCurrentTag() {
  const input = document.getElementById('tagInput');
  const tag = input.value.trim().toLowerCase();
  
  if (tag && !currentTags.includes(tag)) {
    currentTags.push(tag);
    input.value = '';
    updateTagsDisplay();
  }
}

function removeTag(index) {
  currentTags.splice(index, 1);
  updateTagsDisplay();
}

function updateTagsDisplay() {
  const container = document.getElementById('tagsContainer');
  const input = document.getElementById('tagInput');
  
  // Clear existing tags
  const existingTags = container.querySelectorAll('.tag');
  existingTags.forEach(tag => tag.remove());
  
  // Add current tags
  currentTags.forEach((tag, index) => {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag';
    tagElement.innerHTML = `${tag} <span class="tag-remove" onclick="removeTag(${index})">×</span>`;
    container.insertBefore(tagElement, input);
  });
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}

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

async function loadSettings() {
  const settings = await chrome.storage.sync.get(['founderOsUrl']);
  if (!settings.founderOsUrl) {
    // Show setup prompt
    showStatus('Configure your Founder OS URL in extension settings', 'error');
  }
}

// Functions to inject into page context
function extractPageContent() {
  const title = document.title;
  
  // Try to find main content
  let content = '';
  const selectors = ['main', '[role="main"]', 'article', '.content', '#content'];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      content = element.innerText;
      break;
    }
  }
  
  if (!content) {
    content = document.body.innerText;
  }
  
  // Clean up and limit content
  content = content.replace(/\s+/g, ' ').trim().slice(0, 2000);
  
  return { title, content };
}

function getSelectedText() {
  return window.getSelection().toString().trim();
}

// Make removeTag available globally
window.removeTag = removeTag;