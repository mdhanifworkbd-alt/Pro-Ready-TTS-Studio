import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Character } from './types';
import { AVAILABLE_VOICES } from './constants';
import { generateMultiSpeakerSpeech, analyzeScriptEmotions } from './services/geminiService';
import { createWavBlobUrl, decodeBase64 } from './utils/audioUtils';
import CharacterInput from './components/CharacterInput';
import Spinner from './components/Spinner';
import { PlusIcon, SparklesIcon, LogoutIcon } from './components/icons';

// Add Netlify Identity to the window object for TypeScript
declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

// User type from Netlify Identity
interface User {
  email: string;
  user_metadata: {
    full_name: string;
  };
}

// Refreshes the Netlify JWT token
const refreshToken = (user: User) => {
  // The user object from Netlify has a `jwt` method, but it's not in our simple `User` type.
  // We'll check for it and call it to ensure the token is fresh.
  const netlifyUser = user as User & { jwt: (force?: boolean) => Promise<string> };
  if (netlifyUser && typeof netlifyUser.jwt === 'function') {
    netlifyUser.jwt(true) // force refresh
      .then(token => {
        console.log('Successfully refreshed Netlify identity token.');
      })
      .catch(err => console.error('Token refresh failed:', err));
  }
};

const TtsStudio: React.FC<{ user: User; onLogout: () => void; }> = ({ user, onLogout }) => {
  const [characters, setCharacters] = useState<Character[]>([
    { id: uuidv4(), name: 'রোবট', voice: 'Charon_robot', dialogue: 'বিপ-বুপ। অজানা জীবনের সংকেত সনাক্ত করা হয়েছে।', emotion: 'serious' },
    { id: uuidv4(), name: 'এলিয়েন', voice: 'Puck_alien', dialogue: 'নমস্কার, পৃথিবী-বাসী! আমি শান্তির জন্য এসেছি।', emotion: 'joyful' },
    { id: uuidv4(), name: 'দৈত্য', voice: 'Iapetus_monster', dialogue: 'হাহাহা! আমার জঙ্গলে তোমরা কী করছো?', emotion: 'angry' },
    { id: uuidv4(), name: 'ভূত', voice: 'Erinome_ghost', dialogue: 'উউউ... এখান থেকে চলে যাও...', emotion: 'whispering' },
  ]);
  const [script, setScript] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzingEmotions, setIsAnalyzingEmotions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleAddCharacter = useCallback(() => {
    setCharacters(prev => [
      ...prev,
      { id: uuidv4(), name: '', voice: AVAILABLE_VOICES[0].id, dialogue: '', emotion: 'normal' }
    ]);
  }, []);

  const handleCharacterChange = useCallback((index: number, updatedCharacter: Partial<Character>) => {
    setCharacters(prev =>
      prev.map((char, i) => (i === index ? { ...char, ...updatedCharacter } : char))
    );
  }, []);

  const handleRemoveCharacter = useCallback((id: string) => {
    setCharacters(prev => prev.filter(char => char.id !== id));
  }, []);
  
  const handleAnalyzeScript = useCallback(() => {
    if (!script.trim()) return;

    const lines = script.split('\n').filter(line => line.trim() !== '');
    const parsedCharacters: { name: string, dialogue: string }[] = [];
    let lastCharacterName: string | null = null;

    for (const line of lines) {
        const match = line.match(/^([^:]+):(.*)$/);
        if (match) {
            const name = match[1].trim();
            const dialogue = match[2].trim();
            parsedCharacters.push({ name, dialogue });
            lastCharacterName = name;
        } else if (lastCharacterName && line.trim()) {
             const lastEntry = parsedCharacters[parsedCharacters.length - 1];
             if (lastEntry) {
                lastEntry.dialogue += ' ' + line.trim();
             }
        }
    }

    if (parsedCharacters.length === 0) {
        setError("স্ক্রিপ্টটি বিশ্লেষণ করা যায়নি। অনুগ্রহ করে 'নাম: সংলাপ' ফর্ম্যাটটি ব্যবহার করুন।");
        return;
    }
    
    const characterDialogueMap = new Map<string, string[]>();
    for (const { name, dialogue } of parsedCharacters) {
        if (!characterDialogueMap.has(name)) {
            characterDialogueMap.set(name, []);
        }
        characterDialogueMap.get(name)!.push(dialogue);
    }
    
    const finalCharacters: Character[] = [];
    let voiceIdx = 0;
    const characterNames = Array.from(characterDialogueMap.keys());
    
    for (const name of characterNames) {
        const dialogues = characterDialogueMap.get(name)!.join(' ');
        finalCharacters.push({
            id: uuidv4(),
            name,
            dialogue: dialogues,
            voice: AVAILABLE_VOICES[voiceIdx % AVAILABLE_VOICES.length].id,
            emotion: 'normal',
        });
        voiceIdx++;
    }

    setCharacters(finalCharacters);
    setError(null);

  }, [script]);

  const handleAutoAssignEmotions = async () => {
    if (characters.length === 0) {
        setError("অনুগ্রহ করে প্রথমে একটি স্ক্রিপ্ট বিশ্লেষণ করুন বা চরিত্র যোগ করুন।");
        return;
    }
    setIsAnalyzingEmotions(true);
    setError(null);
    try {
        const scriptText = characters.map(c => `${c.name}: ${c.dialogue}`).join('\n');
        const analyzedEmotions = await analyzeScriptEmotions(scriptText);
        
        const emotionMap = new Map<string, string>();
        analyzedEmotions.forEach(item => {
            const key = `${item.name.trim()}:${item.dialogue.trim()}`;
            emotionMap.set(key, item.emotion);
        });

        const updatedCharacters = characters.map(char => {
            const key = `${char.name.trim()}:${char.dialogue.trim()}`;
            const foundEmotion = emotionMap.get(key);
            return foundEmotion ? { ...char, emotion: foundEmotion } : char;
        });

        setCharacters(updatedCharacters);

    } catch (err) {
        setError(err instanceof Error ? err.message : "আবেগ বিশ্লেষণ করার সময় একটি ত্রুটি ঘটেছে।");
    } finally {
        setIsAnalyzingEmotions(false);
    }
  };


  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    const validCharacters = characters.filter(c => c.name.trim() && c.dialogue.trim());

    if (validCharacters.length < 1) {
      setError("অনুগ্রহ করে নাম এবং সংলাপ সহ কমপক্ষে একটি চরিত্র যোগ করুন।");
      setIsLoading(false);
      return;
    }

    try {
      const base64Audio = await generateMultiSpeakerSpeech(validCharacters);
      if (base64Audio) {
        const pcmData = decodeBase64(base64Audio);
        const url = createWavBlobUrl(pcmData, 24000, 1);
        setAudioUrl(url);
      } else {
        throw new Error("API থেকে কোনো অডিও ডেটা পাওয়া যায়নি।");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "একটি অজানা ত্রুটি ঘটেছে।");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col items-center p-4 sm:p-6 md:p-8 relative">
      <main className="w-full max-w-4xl mx-auto flex flex-col gap-8">
        <header className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">
            বহু-কণ্ঠস্বর টিটিএস স্টুডিও
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Hanif's Ai Power দিয়ে ভাবপূর্ণ, বহু-বক্তার সংলাপ তৈরি করুন।
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
                 <div className="text-sm text-gray-300 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700">
                    Logged in as: <strong>{user.email}</strong>
                 </div>
                 <button
                    title="লগআউট"
                    onClick={onLogout}
                    className="flex items-center gap-1.5 text-gray-400 bg-gray-800/50 px-3 py-1 rounded-full hover:text-white hover:bg-gray-700/70 transition-colors text-xs"
                    aria-label="লগআউট"
                    >
                    <span className="w-4 h-4"><LogoutIcon /></span>
                    লগআউট
                </button>
            </div>
        </header>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700 opacity-60">
          <h2 className="text-xl font-semibold mb-4 text-cyan-300 flex items-center gap-2">
            ধাপ ১: স্ক্রিপ্ট থেকে চরিত্র তৈরি করুন
            <span className="text-xs bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded-full font-medium">Coming soo....</span>
          </h2>
          <p className="text-gray-400 text-sm">
            আপনার সম্পূর্ণ স্ক্রিপ্টটি এখানে পেস্ট করুন। অ্যাপটি স্বয়ংক্রিয়ভাবে চরিত্র এবং তাদের সংলাপ শনাক্ত করবে। ফরম্যাট: <code className="bg-gray-900 px-1 py-0.5 rounded">নাম: সংলাপ</code>
          </p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700 opacity-60">
          <h2 className="text-xl font-semibold mb-4 text-cyan-300 flex items-center gap-2">
            ধাপ ২: স্বয়ংক্রিয়ভাবে আবেগ যোগ করুন
            <span className="text-xs bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded-full font-medium">Coming soo....</span>
          </h2>
          <p className="text-gray-400 text-sm">
            গল্পের ক্লাইম্যাক্স এবং পরিস্থিতি অনুযায়ী প্রতিটি সংলাপের জন্য সঠিক আবেগ স্বয়ংক্রিয়ভাবে নির্ধারণ করতে জেমিনিকে ব্যবহার করুন।
          </p>
        </div>


        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-700"></div>
            <span className="flex-shrink mx-4 text-gray-400 font-medium">অথবা ম্যানুয়ালি সম্পাদনা করুন</span>
            <div className="flex-grow border-t border-gray-700"></div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-6 border border-gray-700">
           <h2 className="text-xl font-semibold mb-6 text-cyan-300">চরিত্র তালিকা</h2>
          <div className="space-y-6">
            {characters.map((char, index) => (
              <CharacterInput
                key={char.id}
                character={char}
                index={index}
                onChange={handleCharacterChange}
                onRemove={handleRemoveCharacter}
                isOnlyCharacter={characters.length === 1}
              />
            ))}
          </div>
          <button
            onClick={handleAddCharacter}
            className="mt-6 w-full flex items-center justify-center gap-2 text-cyan-300 border-2 border-cyan-700/50 rounded-lg py-2 px-4 hover:bg-cyan-900/50 hover:border-cyan-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <PlusIcon />
            চরিত্র যোগ করুন
          </button>
        </div>

        <div className="sticky bottom-4 w-full z-10">
            <button
              onClick={handleSubmit}
              disabled={isLoading || isAnalyzingEmotions}
              className="w-full flex items-center justify-center gap-3 text-lg font-semibold py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg hover:shadow-cyan-500/30 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            >
              {isLoading ? (
                <>
                  <Spinner />
                  তৈরি হচ্ছে...
                </>
              ) : (
                 <>
                  <SparklesIcon />
                  অডিও তৈরি করুন
                 </>
              )}
            </button>
        </div>


        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg text-center">
            <strong>ত্রুটি:</strong> {error}
          </div>
        )}

        {audioUrl && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 flex flex-col items-center gap-4">
            <h2 className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">আপনার সংলাপ প্রস্তুত!</h2>
            <audio controls src={audioUrl} className="w-full max-w-md">
              Your browser does not support the audio element.
            </audio>
             <a
                href={audioUrl}
                download="dialogue.wav"
                className="mt-2 text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                অডিও ডাউনলোড করুন
              </a>
          </div>
        )}
      </main>
    </div>
  );
};


const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ni = window.netlifyIdentity;
        if (ni) {
            ni.on('init', (user: User | null) => {
                setUser(user);
                if (user) {
                    refreshToken(user);
                }
                setLoading(false);
            });

            ni.on('login', (user: User) => {
                setUser(user);
                refreshToken(user);
                ni.close();
            });

            ni.on('logout', () => {
                setUser(null);
            });
            
            ni.init();
        } else {
           setLoading(false);
        }
        
        return () => {
          if (ni) {
            ni.off('init');
            ni.off('login');
            ni.off('logout');
          }
        };
    }, []);

    const handleLogin = () => {
        if (window.netlifyIdentity) {
            window.netlifyIdentity.open();
        }
    };

    const handleLogout = () => {
        if (window.netlifyIdentity) {
            window.netlifyIdentity.logout();
        }
    };
    
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (user) {
        return <TtsStudio user={user} onLogout={handleLogout} />;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col items-center justify-center p-4">
             <main className="w-full max-w-2xl mx-auto flex flex-col gap-8 text-center">
                <header className="text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 animate-explode">
                        বাংলাদেশে প্রথম! 💥
                    </h1>
                    <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-100">
                        Hanif's Ai Power দিয়ে এখন আপনার পকেটে আস্ত একটি ভয়েস স্টুডিও!
                    </h2>
                </header>

                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-8 border border-gray-700">
                    <div className="text-gray-300 text-left space-y-6 mb-8">
                        <p>আপনি কি ইউটিউবার বা কন্টেন্ট ক্রিয়েটর? ভয়েস ওভার নিয়ে টেনশনে দিন শেষ! 😥 ঘন্টার পর ঘন্টা ভয়েস এডিটিং-এর ঝামেলা অথবা ভয়েস আর্টিস্ট খোঁজার দিন এখন অতীত। বাংলাদেশে এই প্রথম Hanif's Ai Power নিয়ে এলো বহু-কণ্ঠস্বর সমৃদ্ধ এক অবিশ্বাস্য টেক্সট-টু-স্পিচ (Text-to-Speech) স্টুডিও!</p>
                        <div>
                            <h3 className="font-semibold text-cyan-300 mb-2 text-lg">কেন Hanif's Ai Power ব্যবহার করবেন?</h3>
                            <ul className="list-none space-y-2 pl-2 text-gray-400">
                                <li className="flex items-start gap-3"><span className="text-cyan-400 mt-1">✓</span><div><strong className="text-gray-200">সিনেমাটিক কার্টুন ভয়েস:</strong> কোনো রকম এডিটিং ছাড়াই আপনার কার্টুন বা অ্যানিমেশন ক্যারেক্টারকে দিন জীবন্ত কণ্ঠ।</div></li>
                                <li className="flex items-start gap-3"><span className="text-cyan-400 mt-1">✓</span><div><strong className="text-gray-200">প্রফেশনাল ইউটিউব ভয়েস:</strong> এমন প্রফেশনাল ভয়েস জেনারেট করুন যা দিয়ে আপনার চ্যানেল ১০০% মনিটাইজেশন পাবেই! 💯</div></li>
                                <li className="flex items-start gap-3"><span className="text-cyan-400 mt-1">✓</span><div><strong className="text-gray-200">নিউজরুমের মতো ভয়েস:</strong> খবরের চ্যানেলের মতো দুর্দান্ত ভয়েস ওভার দিয়ে তৈরি করুন আপনার নিজস্ব নিউজ পোর্টাল। 🎤</div></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-semibold text-yellow-300 mb-2 text-lg">সাফল্যের গ্যারান্টি! 💸</h3>
                            <p className="text-gray-400">আপনি কি জানেন? বর্তমানে আমাদের এই AI ভয়েস ব্যবহার করে বহু কন্টেন্ট ক্রিয়েটর সফলভাবে মনিটাইজেশন পেয়ে লাখ লাখ টাকা উপার্জন করছেন!</p>
                        </div>
                        <p className="text-center font-semibold text-lg text-purple-300 pt-2">এই অবিশ্বাস্য সুযোগ আর মিস করবেন না। ইউটিউবে নিজের জায়গা করে নেওয়ার এটাই সেরা সময়! 🚀</p>
                    </div>

                    <div className="border-t border-gray-700 pt-8">
                         <h2 className="text-2xl font-bold mb-6 text-white text-center animate-neon-glow tracking-widest">
                            Get Started
                        </h2>
                        <button 
                            onClick={handleLogin}
                            className="w-full max-w-sm mx-auto flex items-center justify-center gap-3 text-lg font-semibold py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg hover:shadow-cyan-500/30 transform hover:scale-105 transition-all duration-300"
                        >
                            লগইন / সাইন আপ
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;