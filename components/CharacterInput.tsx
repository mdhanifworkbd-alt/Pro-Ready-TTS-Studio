
import React from 'react';
import type { Character } from '../types';
import { AVAILABLE_VOICES, AVAILABLE_EMOTIONS } from '../constants';
import { EmotionIcon, TrashIcon, UserIcon, VoiceIcon } from './icons';

interface CharacterInputProps {
  character: Character;
  index: number;
  onChange: (index: number, updatedCharacter: Partial<Character>) => void;
  onRemove: (id: string) => void;
  isOnlyCharacter: boolean;
}

const CharacterInput: React.FC<CharacterInputProps> = ({ character, index, onChange, onRemove, isOnlyCharacter }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    onChange(index, { [e.target.name]: e.target.value });
  };

  const selectedVoice = AVAILABLE_VOICES.find(v => v.id === character.voice);
  const emotionIsOverridden = !!selectedVoice?.promptOverride;

  return (
    <div className="relative p-4 bg-gray-900/50 border border-gray-700 rounded-lg group transition-all duration-300 focus-within:border-cyan-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Character Name Input */}
        <div className="relative md:col-span-1">
          <label htmlFor={`name-${character.id}`} className="block text-sm font-medium text-gray-400 mb-1">চরিত্রের নাম</label>
           <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none mt-6">
             <UserIcon/>
           </div>
          <input
            id={`name-${character.id}`}
            name="name"
            type="text"
            value={character.name}
            onChange={handleInputChange}
            placeholder={`যেমন, নায়ক, খলনায়ক`}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition"
          />
        </div>

        {/* Voice Selection */}
        <div className="relative md:col-span-1">
          <label htmlFor={`voice-${character.id}`} className="block text-sm font-medium text-gray-400 mb-1">কণ্ঠস্বর</label>
           <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none mt-6">
            <VoiceIcon/>
           </div>
          <select
            id={`voice-${character.id}`}
            name="voice"
            value={character.voice}
            onChange={handleInputChange}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md appearance-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition"
          >
            {AVAILABLE_VOICES.map(voice => (
              <option key={voice.id} value={voice.id}>{voice.name}</option>
            ))}
          </select>
        </div>

        {/* Emotion Selection */}
        <div className="relative md:col-span-1">
          <label htmlFor={`emotion-${character.id}`} className="block text-sm font-medium text-gray-400 mb-1">আবেগ</label>
           <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none mt-6">
            <EmotionIcon />
           </div>
          <select
            id={`emotion-${character.id}`}
            name="emotion"
            value={character.emotion}
            onChange={handleInputChange}
            disabled={emotionIsOverridden}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md appearance-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition disabled:bg-gray-700/50 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            {AVAILABLE_EMOTIONS.map(emotion => (
              <option key={emotion.id} value={emotion.id}>{emotion.name}</option>
            ))}
          </select>
          {emotionIsOverridden && (
             <p className="text-xs text-gray-500 mt-1">কণ্ঠস্বরের দ্বারা আবেগ নির্ধারিত।</p>
          )}
        </div>


        {/* Dialogue Textarea */}
        <div className="md:col-span-3">
          <label htmlFor={`dialogue-${character.id}`} className="block text-sm font-medium text-gray-400 mb-1">সংলাপ</label>
          <textarea
            id={`dialogue-${character.id}`}
            name="dialogue"
            value={character.dialogue}
            onChange={handleInputChange}
            rows={3}
            placeholder="এখানে সংলাপ লিখুন।"
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition"
          />
        </div>

      </div>

      <button
        onClick={() => onRemove(character.id)}
        disabled={isOnlyCharacter}
        className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-gray-700 text-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-0 disabled:cursor-not-allowed"
        aria-label="চরিত্র মুছুন"
      >
        <TrashIcon />
      </button>
    </div>
  );
};

export default CharacterInput;