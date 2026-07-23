import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine, so scrollHeight/scrollWidth/offsetHeight etc. are always 0.
// useChat writes scrollTop from scrollHeight, which will always read as 0 in tests.
window.matchMedia = window.matchMedia || function matchMedia(query: string) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
};

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function scrollIntoView() {};
