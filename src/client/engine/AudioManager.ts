import { WeaponType } from '../../shared/types.js';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sharedNoiseBuffer: AudioBuffer | null = null;
  private isMuted: boolean = false;
  public masterVolume: number = 0.8;
  public sfxVolume: number = 0.8;
  public voiceVolume: number = 0.8;

  constructor() {
    // Lazy init on first user touch / interaction
  }

  private initContext(): void {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.updateMasterVolume();
        this.masterGain.connect(this.ctx.destination);

        // Pre-generate 1.0 second of white noise buffer once to avoid per-sound memory allocations
        const length = Math.floor(this.ctx.sampleRate * 1.0);
        this.sharedNoiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = this.sharedNoiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMasterVolume(val: number): void {
    this.masterVolume = Math.max(0, Math.min(1, val));
    this.updateMasterVolume();
  }

  public setSfxVolume(val: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, val));
  }

  public setVoiceVolume(val: number): void {
    this.voiceVolume = Math.max(0, Math.min(1, val));
  }

  private updateMasterVolume(): void {
    if (this.masterGain && this.ctx) {
      const vol = this.isMuted ? 0 : this.masterVolume * 0.5;
      this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }

  public touchUnlock(): void {
    this.initContext();
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.updateMasterVolume();
  }

  public playShoot(weapon: WeaponType): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    if (weapon === 'katana') {
      // Blade swoosh
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.12);
      return;
    }

    if (weapon === 'plasma_launcher') {
      // Deep sub-bass EM launch thump
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.28);
      gain.gain.setValueAtTime(0.7 * this.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.28);

      // Plasma ionization hiss
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.sharedNoiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + 0.22);
      filter.Q.setValueAtTime(4.0, t);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.45 * this.sfxVolume, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.22);
      return;
    }

    if (weapon === 'railgun') {
      // Supersonic beam crack + high voltage discharge
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.sharedNoiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2200, t);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.85 * this.sfxVolume, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.25);

      // Concussive linear spike
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(480, t);
      sub.frequency.exponentialRampToValueAtTime(50, t + 0.35);
      subGain.gain.setValueAtTime(0.8 * this.sfxVolume, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      sub.connect(subGain);
      subGain.connect(this.masterGain);
      sub.start(t);
      sub.stop(t + 0.35);

      // Resonant metallic magnetic ring
      const ring = this.ctx.createOscillator();
      const ringGain = this.ctx.createGain();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(920, t);
      ringGain.gain.setValueAtTime(0.35 * this.sfxVolume, t);
      ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      ring.connect(ringGain);
      ringGain.connect(this.masterGain);
      ring.start(t);
      ring.stop(t + 0.4);
      return;
    }

    if (weapon === 'arc_disruptor') {
      // Rapid electric spark arc tick
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95 + Math.random() * 60, t);
      oscGain.gain.setValueAtTime(0.35 * this.sfxVolume, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.08);

      // Electric sizzle noise
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.sharedNoiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400 + Math.random() * 800, t);
      filter.Q.setValueAtTime(3.0, t);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.3 * this.sfxVolume, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.08);
      return;
    }

    if (weapon === 'needle_carbine') {
      // Harmonic crystal ping
      const f1 = 1240;
      const f2 = 1860;
      [f1, f2].forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.12);
        gain.gain.setValueAtTime(0.25 * this.sfxVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t);
        osc.stop(t + 0.12);
      });
      return;
    }

    // Gunshot noise burst from shared noise buffer
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.sharedNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = weapon === 'shotgun' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(weapon === 'sniper' ? 800 : 1600, t);

    const noiseGain = this.ctx.createGain();
    const duration = weapon === 'sniper' ? 0.35 : weapon === 'shotgun' ? 0.28 : 0.1;
    noiseGain.gain.setValueAtTime(weapon === 'sniper' ? 0.8 : 0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + duration);

    // Punch sub-oscillator
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    const startFreq = weapon === 'sniper' ? 180 : weapon === 'shotgun' ? 150 : 130;
    subOsc.frequency.setValueAtTime(startFreq, t);
    subOsc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

    subGain.gain.setValueAtTime(0.6, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(t);
    subOsc.stop(t + 0.08);
  }

  public playHit(isHeadshot: boolean): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (isHeadshot) {
      // High crisp headshot chime ("ding-dong")
      osc.frequency.setValueAtTime(2400, t);
      osc.frequency.setValueAtTime(3200, t + 0.05);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.22);
    } else {
      // Standard body hit tic
      osc.frequency.setValueAtTime(1400, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  public playJump(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(550, t + 0.12);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playTeleport(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // 1. Low warp whoosh swell
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(140, t);
    osc1.frequency.exponentialRampToValueAtTime(840, t + 0.22);
    gain1.gain.setValueAtTime(0.28 * this.sfxVolume, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.32);

    // 2. Crystalline warp shimmer
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, t);
    osc2.frequency.exponentialRampToValueAtTime(320, t + 0.3);
    gain2.gain.setValueAtTime(0.22 * this.sfxVolume, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(t);
    osc2.stop(t + 0.36);
  }

  public playSlide(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Friction whoosh from shared noise buffer
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.sharedNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.linearRampToValueAtTime(300, t + 0.4);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.4);
  }

  public playReload(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Two mechanical clicks
    [0, 0.18].forEach((offset) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, t + offset);
      gain.gain.setValueAtTime(0.15, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.04);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + offset);
      osc.stop(t + offset + 0.04);
    });
  }

  public playOofDeath(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Classic Roblox "Oof" pitch bend
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.25);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.28);
  }

  public playCountdownTick(count: number): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(count === 0 ? 880 : 440, t);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (count === 0 ? 0.3 : 0.1));

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + (count === 0 ? 0.3 : 0.1));
  }

  public playGrammarCorrect(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, t); // D5
    osc.frequency.setValueAtTime(880.0, t + 0.08); // A5

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  public playGrammarWrong(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.18);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playGrammarSuccess(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((f, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + i * 0.09;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, startTime);

      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  public playPowerupShield(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.35);
    gain.gain.setValueAtTime(0.4 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  public playPowerupSpeed(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.28);
    gain.gain.setValueAtTime(0.25 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playPowerupQuadDamage(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const freqs = [150, 225, 300, 450];
    freqs.forEach((f, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t + i * 0.04);
      gain.gain.setValueAtTime(0.3 * this.sfxVolume, t + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.04);
      osc.stop(t + i * 0.04 + 0.3);
    });
  }

  public playPowerupRadar(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.setValueAtTime(2100, t + 0.08);
    gain.gain.setValueAtTime(0.35 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  public playPowerupPhaseShift(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(250, t + 0.3);
    gain.gain.setValueAtTime(0.3 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  public playPowerupAirstrike(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    // Siren descending
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.6);
    gain.gain.setValueAtTime(0.4 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  public playPowerupInstantRefill(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.setValueAtTime(900, t + 0.05);
    gain.gain.setValueAtTime(0.3 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playWaveStart(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Dramatic warning horn (low sawtooth chord)
    const freqs = [110, 164.81, 220]; // A2, E3, A3
    freqs.forEach((f) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.95, t + 0.8);
      gain.gain.setValueAtTime(0.25 * this.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.85);
    });
  }

  public playWaveClear(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Triumphant ascending major triad: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
    const notes = [
      { f: 523.25, time: 0.0, dur: 0.2 },
      { f: 659.25, time: 0.12, dur: 0.2 },
      { f: 783.99, time: 0.24, dur: 0.2 },
      { f: 1046.5, time: 0.36, dur: 0.6 }
    ];

    notes.forEach((n) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t + n.time);
      gain.gain.setValueAtTime(0.3 * this.sfxVolume, t + n.time);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.time + n.dur);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + n.time);
      osc.stop(t + n.time + n.dur);
    });
  }

  public playRailgunCharge(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Capacitor pitch whistle ramp (300Hz -> 1800Hz)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(1750, t + 0.45);
    gain.gain.setValueAtTime(0.05 * this.sfxVolume, t);
    gain.gain.linearRampToValueAtTime(0.3 * this.sfxVolume, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.48);
  }

  public playSupercombineDetonation(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Explosive crystalline detonation
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.sharedNoiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1400, t);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.7 * this.sfxVolume, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.45);

    // High crystalline glass crash tones
    const shatterFreqs = [1850, 2400, 3100];
    shatterFreqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.02);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.35);
      gain.gain.setValueAtTime(0.35 * this.sfxVolume, t + idx * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + idx * 0.02);
      osc.stop(t + 0.35);
    });
  }

  public playPlasmaExplosion(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Deep concussive plasma burst
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    gain.gain.setValueAtTime(0.85 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.5);

    // Electric plasma sizzle rumble
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.sharedNoiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.45);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.6 * this.sfxVolume, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.45);
  }

  public playGrappleShoot(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Pneumatic cable launch burst
    if (this.sharedNoiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.sharedNoiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, t);
      filter.frequency.exponentialRampToValueAtTime(700, t + 0.18);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.45 * this.sfxVolume, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.18);
    }

    // High-tech winch spool whir
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(720, t + 0.16);
    gain.gain.setValueAtTime(0.35 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  public playGrappleLatch(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Crisp metallic anchor strike
    [1400, 2600].forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, t + 0.09);
      gain.gain.setValueAtTime(0.4 * this.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.09);
    });

    // Solid anchor thud
    const oscThud = this.ctx.createOscillator();
    const gainThud = this.ctx.createGain();
    oscThud.type = 'triangle';
    oscThud.frequency.setValueAtTime(170, t);
    oscThud.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    gainThud.gain.setValueAtTime(0.55 * this.sfxVolume, t);
    gainThud.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    oscThud.connect(gainThud);
    gainThud.connect(this.masterGain);
    oscThud.start(t);
    oscThud.stop(t + 0.12);
  }

  public playGrappleRelease(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // High velocity aerodynamic whoosh / slingshot snap
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.18);
    gain.gain.setValueAtTime(0.4 * this.sfxVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}
