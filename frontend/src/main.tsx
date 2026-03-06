import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'react-open-source-grid/dist/lib/index.css'
import App from './App.tsx'

let noSuggestCounter = 0;

function disableBrowserSuggestions(root: ParentNode = document): void {
  const fields = root.querySelectorAll('input, textarea');
  fields.forEach((field) => {
    // "off" is often ignored by Chromium; "new-password" is more reliable to suppress saved suggestions.
    field.setAttribute('autocomplete', 'new-password');
    field.setAttribute('autocorrect', 'off');
    field.setAttribute('autocapitalize', 'off');
    field.setAttribute('spellcheck', 'false');
    field.setAttribute('aria-autocomplete', 'none');
    field.setAttribute('data-form-type', 'other');
    field.setAttribute('data-lpignore', 'true');

    if (!field.getAttribute('name')) {
      noSuggestCounter += 1;
      field.setAttribute('name', `no_suggest_${noSuggestCounter}`);
    }
  });
}

disableBrowserSuggestions();

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type !== 'childList') continue;
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as Element;
      if (element.matches('input, textarea')) {
        disableBrowserSuggestions(element.parentNode ?? document);
      } else {
        disableBrowserSuggestions(element);
      }
    });
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
