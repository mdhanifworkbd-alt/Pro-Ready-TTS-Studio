
export interface Character {
  id: string;
  name: string;
  voice: string;
  dialogue: string;
  emotion: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  apiVoice: string;
  promptOverride?: string;
}

export interface EmotionOption {
    id: string;
    name: string;
    prompt: string;
}

export interface AnalyzedCharacterEmotion {
  name: string;
  dialogue: string;
  emotion: string;
}