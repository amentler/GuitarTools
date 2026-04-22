import { describe, expect, it, vi } from 'vitest';
import {
  closeAudioSession,
  createAudioSessionState,
  openAudioSession,
} from '../../js/shared/audio/audioSessionService.js';

function createMockAudioContext({ suspended = false } = {}) {
  const analyser = { fftSize: 2048 };
  const source = {
    connect: vi.fn(function connect() {
      return this;
    }),
  };

  return {
    state: suspended ? 'suspended' : 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createAnalyser: vi.fn(() => analyser),
    createMediaStreamSource: vi.fn(() => source),
    analyser,
    source,
  };
}

describe('audioSessionService', () => {
  it('creates context, analyser and media source and applies fftSize', async () => {
    const stream = { getTracks: () => [] };
    const audioContext = createMockAudioContext({ suspended: true });
    const session = createAudioSessionState();

    await openAudioSession(session, {
      stream,
      fftSize: 4096,
      audioContextFactory: () => audioContext,
    });

    expect(audioContext.resume).toHaveBeenCalledTimes(1);
    expect(audioContext.createAnalyser).toHaveBeenCalledTimes(1);
    expect(audioContext.createMediaStreamSource).toHaveBeenCalledWith(stream);
    expect(audioContext.analyser.fftSize).toBe(4096);
    expect(session.audioCtx).toBe(audioContext);
    expect(session.analyser).toBe(audioContext.analyser);
    expect(session.stream).toBe(stream);
  });

  it('cleans up tracks and closes the context on close', async () => {
    const track = { stop: vi.fn() };
    const session = createAudioSessionState({
      stream: { getTracks: () => [track] },
      audioCtx: createMockAudioContext(),
      analyser: {},
      currentFftSize: 4096,
    });

    await closeAudioSession(session, {
      reset: currentSession => {
        currentSession.currentFftSize = 0;
      },
    });

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(session.audioCtx).toBeNull();
    expect(session.analyser).toBeNull();
    expect(session.stream).toBeNull();
    expect(session.currentFftSize).toBe(0);
  });

  it('stops the stream and resets state when setup fails mid-open', async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    const audioContext = createMockAudioContext();
    const session = createAudioSessionState();

    await expect(openAudioSession(session, {
      stream,
      audioContextFactory: () => audioContext,
      connectSource: () => {
        throw new Error('boom');
      },
    })).rejects.toThrow('boom');

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(audioContext.close).toHaveBeenCalledTimes(1);
    expect(session.audioCtx).toBeNull();
    expect(session.analyser).toBeNull();
    expect(session.stream).toBeNull();
  });
});
