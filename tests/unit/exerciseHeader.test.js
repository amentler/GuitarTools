// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import '../../js/components/gt-exercise-header.js';

describe('GtExerciseHeader', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should have a back link pointing to index.html', () => {
    // This test currently represents the status quo which might be "broken"
    // depending on where the page is located.
    document.body.innerHTML = '<gt-exercise-header title="Test"></gt-exercise-header>';
    const header = document.querySelector('gt-exercise-header');
    const backLink = header.querySelector('.btn-back');
    
    expect(backLink.getAttribute('href')).toBe('../../index.html');
  });
});
