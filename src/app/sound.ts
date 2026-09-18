/**
 * 打印机的几个声音，用 WebAudio 合成，不下载任何音频文件。
 *
 * AudioContext 只在用户第一次按下按钮时创建 —— 浏览器要求音频由手势触发，
 * 提前创建只会得到一个 suspended 的上下文。
 */

let context: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    if (!context) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** 一段衰减的噪声，机械声的基本形状。 */
function noiseBuffer(audio: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.floor(audio.sampleRate * seconds));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.exp((-decay * i) / length);
  }
  return buffer;
}

/** 按下面板按钮：一记硬塑料的「嗒」。 */
export function press(gain = 0.2): void {
  const audio = ctx();
  if (!audio) return;
  const source = audio.createBufferSource();
  source.buffer = noiseBuffer(audio, 0.05, 20);

  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 4;

  const volume = audio.createGain();
  volume.gain.value = gain;

  source.connect(filter).connect(volume).connect(audio.destination);
  source.start();
}

/**
 * 走纸：低频马达 + 一层滚动的纸噪声，持续 `ms` 毫秒。
 * 返回一个提前停下来的函数，动画被打断时不至于让马达一直响。
 */
export function motor(ms: number): () => void {
  const audio = ctx();
  if (!audio) return () => undefined;
  const start = audio.currentTime;
  const seconds = ms / 1000;

  const hum = audio.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.setValueAtTime(52, start);
  hum.frequency.linearRampToValueAtTime(61, start + seconds * 0.35);
  hum.frequency.linearRampToValueAtTime(46, start + seconds);

  const humFilter = audio.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 320;

  const humGain = audio.createGain();
  humGain.gain.setValueAtTime(0.0001, start);
  humGain.gain.exponentialRampToValueAtTime(0.07, start + 0.12);
  humGain.gain.setValueAtTime(0.07, start + seconds - 0.18);
  humGain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);

  const paper = audio.createBufferSource();
  paper.buffer = noiseBuffer(audio, seconds, 0.4);
  paper.loop = false;

  const paperFilter = audio.createBiquadFilter();
  paperFilter.type = 'bandpass';
  paperFilter.frequency.value = 2600;
  paperFilter.Q.value = 0.8;

  const paperGain = audio.createGain();
  paperGain.gain.setValueAtTime(0.0001, start);
  paperGain.gain.exponentialRampToValueAtTime(0.03, start + 0.2);
  paperGain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);

  hum.connect(humFilter).connect(humGain).connect(audio.destination);
  paper.connect(paperFilter).connect(paperGain).connect(audio.destination);
  hum.start(start);
  hum.stop(start + seconds + 0.05);
  paper.start(start);

  return () => {
    try {
      hum.stop();
      paper.stop();
    } catch {
      /* 已经停了 */
    }
  };
}

/** 打印完成：一个干净的泛音，告诉用户这一支已经定下来了。 */
export function chime(): void {
  const audio = ctx();
  if (!audio) return;
  const start = audio.currentTime;
  const oscillator = audio.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, start);
  oscillator.frequency.exponentialRampToValueAtTime(660, start + 0.9);

  const volume = audio.createGain();
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);

  oscillator.connect(volume).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + 1.2);
}
