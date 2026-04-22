import { describe, expect, it } from 'vitest';
import {
  createAudioContext,
  createAudioContextFactory,
  resolveAudioContextCtor,
} from '../../js/shared/audio/audioContextFactory.js';

describe('audioContextFactory', () => {
  it('prefers an explicitly injected constructor', () => {
    class ExplicitAudioContext {}

    expect(resolveAudioContextCtor({ AudioContextCtor: ExplicitAudioContext })).toBe(ExplicitAudioContext);
  });

  it('falls back to webkitAudioContext when AudioContext is missing', () => {
    class WebkitAudioContext {}

    expect(resolveAudioContextCtor({
      windowObject: { webkitAudioContext: WebkitAudioContext },
    })).toBe(WebkitAudioContext);
  });

  it('creates an instance through the shared factory', () => {
    class MockAudioContext {
      constructor() {
        this.created = true;
      }
    }

    const audioContext = createAudioContext({ AudioContextCtor: MockAudioContext });
    expect(audioContext).toBeInstanceOf(MockAudioContext);
    expect(audioContext.created).toBe(true);
  });

  it('supports preconfigured factory instances', () => {
    class MockAudioContext {}
    const factory = createAudioContextFactory({ AudioContextCtor: MockAudioContext });

    expect(factory()).toBeInstanceOf(MockAudioContext);
  });
});
