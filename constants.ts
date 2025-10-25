import type { VoiceOption, EmotionOption } from './types';

export const AVAILABLE_VOICES: VoiceOption[] = [
  // Standard Male Voices
  { id: 'Puck_male_friendly', name: 'পাক (বন্ধুত্বপূর্ণ পুরুষ কণ্ঠ)', apiVoice: 'Puck' },
  { id: 'Charon_male_deep', name: 'ক্যারন (গম্ভীর পুরুষ কণ্ঠ)', apiVoice: 'Charon' },
  { id: 'Fenrir_male_strong', name: 'ফেনরির (শক্তিশালী পুরুষ কণ্ঠ)', apiVoice: 'Fenrir' },
  { id: 'Gacrux_male_young', name: 'গ্যাক্রাক্স (তরুণ পুরুষ কণ্ঠ)', apiVoice: 'Gacrux' },
  { id: 'Zubenelgenubi_male_authoritative', name: 'জুবেনেলজেনুবি (কর্তৃত্বপূর্ণ পুরুষ কণ্ঠ)', apiVoice: 'Zubenelgenubi' },

  // Standard Female Voices
  { id: 'Kore_female_clear', name: 'কোর (পরিষ্কার মহিলা কণ্ঠ)', apiVoice: 'Kore' },
  { id: 'Zephyr_female_bright', name: 'জেফির (উজ্জ্বল মহিলা কণ্ঠ)', apiVoice: 'Zephyr' },
  { id: 'Autonoe_female_calm', name: 'অটোনো (শান্ত মহিলা কণ্ঠ)', apiVoice: 'Autonoe' },
  
  // Character/Fantasy voices
  { id: 'Umbriel_child_boy', name: 'বালক (শিশুর কণ্ঠ)', apiVoice: 'Umbriel' },
  { id: 'Leda_child_girl', name: 'বালিকা (শিশুর কণ্ঠ)', apiVoice: 'Leda' },
  { id: 'Iapetus_monster', name: 'দৈত্য (দানবীয় পুরুষ কণ্ঠ)', apiVoice: 'Iapetus' },
  { id: 'Erinome_ghost', name: 'ভূত (ফিসফিসে মহিলা কণ্ঠ)', apiVoice: 'Erinome' },
  { id: 'Puck_alien', name: 'এলিয়েন (বন্ধুত্বপূর্ণ পুরুষ কণ্ঠ)', apiVoice: 'Puck' },
  { id: 'Charon_robot', name: 'রোবট (যান্ত্রিক পুরুষ কণ্ঠ)', apiVoice: 'Charon' },
  { 
    id: 'youtube_voice_artist', 
    name: 'ইউটিউব ভয়েস আর্টিস্ট', 
    apiVoice: 'Charon',
    promptOverride: 'Say it in a low, immersive, and slightly husky voice with a dramatic but controlled tone. Use cinematic pacing to build tension and suspense. Sound intentional, confident, and emotionally charged.'
  },
  { 
    id: 'youtube_voice_artist_dramatic', 
    name: 'ইউটিউব ভয়েস আর্টিস্ট (ড্রামাটিক)', 
    apiVoice: 'Charon',
    promptOverride: 'Low and cinematic tone. Natural human rhythm. Speak with emotion and micro-pauses like a real storyteller. Each sentence should feel alive — not read. Add subtle breath sounds before emotional words. Keep pacing varied: short punchy lines, then slow dramatic pauses. Slight intensity build-up before key phrases. Sound confident, expressive, and immersive — like a professional YouTube narrator. Avoid robotic consistency; mimic real human speech flow. End each segment with a clean fade of energy.'
  },
  { 
    id: 'human_news_explainer', 
    name: 'হিউম্যান নিউজ এক্সপ্লেইনার', 
    apiVoice: 'Zubenelgenubi',
    promptOverride: 'Deliver this like a professional news explainer. Use a mature, confident, and well-informed journalistic tone. The rhythm should be conversational and engaging, with natural human pacing and micro-pauses. Emphasize key words with a subtle tonal lift. Sound intentional, grounded, and subtly emotional—serious for key facts, and warm for transitions. Avoid a robotic delivery.'
  },
];

export const AVAILABLE_EMOTIONS: EmotionOption[] = [
  { id: 'cinematic', name: 'সিনেমাটিক', prompt: 'Say it in a dramatic and emotional voice' },
  { id: 'normal', name: 'স্বাভাবিক', prompt: 'Say it in a normal voice' },
  { id: 'joyful', name: 'আনন্দিত', prompt: 'Say it in a joyful and cheerful voice' },
  { id: 'happy', name: 'খুশিতে', prompt: 'Say it in a happy and delighted voice' },
  { id: 'excited', name: 'উত্তেজিত', prompt: 'Say it in an excited and energetic voice' },
  { id: 'sad', name: 'দুঃখিত', prompt: 'Say it in a sad and melancholic voice' },
  { id: 'angry', name: 'রাগান্বিত', prompt: 'Say it in an angry and agitated voice' },
  { id: 'scolding', name: 'ধমকের সুরে', prompt: 'Say it in a scolding and stern tone' },
  { id: 'fearful', name: 'ভীত', prompt: 'Say it in a fearful and panicked voice' },
  { id: 'surprised', name: 'আশ্চর্য', prompt: 'Say it in a surprised voice' },
  { id: 'astonished', name: 'অবাক হয়ে', prompt: 'Say it in an astonished and wide-eyed voice' },
  { id: 'disgusted', name: 'বিরক্ত', prompt: 'Say it in a disgusted and resentful voice' },
  { id: 'sarcastic', name: 'ব্যঙ্গাত্মক', prompt: 'Say it in a sarcastic and mocking voice' },
  { id: 'calm', name: 'শান্ত', prompt: 'Say it in a calm and soothing voice' },
  { id: 'serious', name: 'গম্ভীর', prompt: 'Say it in a serious and stern voice' },
  { id: 'hopeful', name: 'আশাবাদী', prompt: 'Say it in a hopeful and optimistic voice' },
  { id: 'worried', name: 'চিন্তিত হয়ে', prompt: 'Say it in a worried and concerned voice' },
  { id: 'hurt', name: 'আহত হয়ে', prompt: 'Say it in a hurt and pained voice' },
  { id: 'shouting', name: 'চিৎকার', prompt: 'Say it as if you are shouting' },
  { id: 'laughing', name: 'হাস্যোজ্জ্বল', prompt: 'Say it while laughing' },
  { id: 'whispering', name: 'ফিসফিস', prompt: 'Say it in a whispering voice' },
  { id: 'sighing', name: 'দীর্ঘশ্বাস ফেলে', prompt: 'Say it with a sigh' },
  { id: 'choked', name: 'শ্বাসরুদ্ধ কণ্ঠে', prompt: 'Say it in a choked and breathless voice' },
];
