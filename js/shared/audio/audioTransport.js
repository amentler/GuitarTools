/**
 * audioTransport.js — Shared Web Audio playback transport.
 *
 * Manages AudioContext, BufferSourceNode lifecycle, and playback timing
 * (including loop ranges and mid-play rate changes).
 *
 * Usage:
 *   const transport = createAudioTransport();
 *   transport.start(audioBuffer, { offset, loopStart, loopEnd, playbackRate, onTick });
 *   transport.pause(); // → currentPositionSeconds
 *   transport.stop();
 *   transport.setRate(newRate);
 */

/**
 * @typedef {{ offset?: number, loopStart?: number, loopEnd?: number,
 *             playbackRate?: number, onTick?: (posSeconds: number) => void }} StartOpts
 */

export function createAudioTransport() {
  let _ctx         = null;
  let _sourceNode  = null;
  let _startCtxTime = 0;   // ctx.currentTime when playback started
  let _offset      = 0;    // position within buffer at last start/pause
  let _rate        = 1.0;
  let _loopStart   = 0;
  let _loopEnd     = 0;
  let _isPlaying   = false;
  let _rafId       = null;
  let _onTick      = null;
  let _audioBuf    = null; // cached AudioBuffer

  function getCtx() {
    if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
    return _ctx;
  }

  function getPosition() {
    if (!_isPlaying || !_ctx) return _offset;
    const elapsed = (_ctx.currentTime - _startCtxTime) * _rate;
    const loopLen = _loopEnd - _loopStart;
    return loopLen > 0
      ? _loopStart + ((_offset - _loopStart + elapsed) % loopLen)
      : _offset + elapsed;
  }

  function _startNode(audioBuffer, offset) {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const node = ctx.createBufferSource();
    node.buffer = audioBuffer;
    node.playbackRate.value = _rate;
    if (_loopEnd > _loopStart) {
      node.loop = true;
      node.loopStart = _loopStart;
      node.loopEnd   = _loopEnd;
    }
    node.connect(ctx.destination);
    node.start(0, offset);
    return node;
  }

  function _stopNode() {
    if (_sourceNode) {
      try { _sourceNode.stop(); } catch { /* already stopped */ }
      _sourceNode = null;
    }
  }

  function _cancelRaf() {
    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }
  }

  function _startRaf() {
    _cancelRaf();
    function tick() {
      if (!_isPlaying) return;
      if (_onTick) _onTick(getPosition());
      _rafId = requestAnimationFrame(tick);
    }
    _rafId = requestAnimationFrame(tick);
  }

  /**
   * Start playback. Stops any current playback first.
   * @param {AudioBuffer} audioBuffer
   * @param {StartOpts} [opts]
   */
  function start(audioBuffer, opts = {}) {
    stop();
    _audioBuf   = audioBuffer;
    _rate       = opts.playbackRate ?? _rate;
    _loopStart  = opts.loopStart ?? 0;
    _loopEnd    = opts.loopEnd ?? 0;
    _offset     = opts.offset ?? _offset;
    _onTick     = opts.onTick ?? null;

    const ctx = getCtx();
    _sourceNode   = _startNode(audioBuffer, _offset);
    _startCtxTime = ctx.currentTime;
    _isPlaying    = true;
    _startRaf();
  }

  /**
   * Pause playback. Returns the current position in seconds.
   * @returns {number}
   */
  function pause() {
    if (!_isPlaying) return _offset;
    _offset = getPosition();
    _stopNode();
    _cancelRaf();
    _isPlaying = false;
    return _offset;
  }

  /**
   * Stop playback and reset position to loopStart (or 0).
   */
  function stop() {
    _offset = _loopStart;
    _stopNode();
    _cancelRaf();
    _isPlaying = false;
  }

  /**
   * Change playback rate mid-play (rebases the timeline).
   * @param {number} rate
   */
  function setRate(rate) {
    if (_isPlaying && _audioBuf) {
      _offset = getPosition();
      _startCtxTime = getCtx().currentTime;
    }
    _rate = rate;
    if (_isPlaying && _sourceNode) {
      _sourceNode.playbackRate.value = rate;
    }
  }

  function isPlaying() { return _isPlaying; }
  function getOffset() { return _offset; }
  function setOffset(v) { _offset = v; }

  /** Close the AudioContext and release all resources. */
  function close() {
    stop();
    if (_ctx) { _ctx.close().catch(() => {}); _ctx = null; }
  }

  return { start, pause, stop, setRate, isPlaying, getPosition, getOffset, setOffset, getCtx, close };
}
