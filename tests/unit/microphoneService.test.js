import { describe, expect, it, vi } from 'vitest';
import {
  requestMicrophoneStream,
  resolveGetUserMedia,
  stopMicrophoneStream,
} from '../../js/shared/audio/microphoneService.js';

describe('microphoneService', () => {
  it('resolves getUserMedia from mediaDevices', () => {
    const getUserMedia = vi.fn();

    expect(resolveGetUserMedia({
      mediaDevices: { getUserMedia },
    })).toBeTypeOf('function');
  });

  it('requests the default microphone constraints', async () => {
    const stream = { id: 'stream-1' };
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    await expect(requestMicrophoneStream({ getUserMedia })).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
  });

  it('forwards custom constraints unchanged', async () => {
    const stream = { id: 'stream-2' };
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const constraints = {
      audio: { channelCount: { ideal: 1 } },
      video: false,
    };

    await expect(requestMicrophoneStream({ getUserMedia, constraints })).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith(constraints);
  });

  it('stops every track and tolerates repeated calls', () => {
    const trackA = { stop: vi.fn() };
    const trackB = { stop: vi.fn() };
    const stream = {
      getTracks: () => [trackA, trackB],
    };

    stopMicrophoneStream(stream);
    stopMicrophoneStream(stream);

    expect(trackA.stop).toHaveBeenCalledTimes(2);
    expect(trackB.stop).toHaveBeenCalledTimes(2);
  });
});
