


import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Character } from './types';
import { AVAILABLE_VOICES } from './constants';
import { generateMultiSpeakerSpeech, analyzeScriptEmotions } from './services/geminiService';
import { createWavBlobUrl, decodeBase64 } from './utils/audioUtils';
import CharacterInput from './components/CharacterInput';
import Spinner from './components/Spinner';
import { PlusIcon, SparklesIcon, KeyIcon, TerminalIcon, LogoutIcon, InfoIcon, CopyIcon, CheckIcon } from './components/icons';

// --- NEW TYPES FOR ACTIVATION SYSTEM ---
interface Token {
  token: string;
  txid: string;
  timestamp: number;
  status: 'new' | 'activated';
  developer: string;
  activationTimestamp?: number; // Added to track activation time
}

interface ActivationData {
  expiryDate: number;
  activatedWithToken: string;
}

const DEVELOPER_CODES = ['62333074747', '90084853627'];
const ACTIVATION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days


// --- COUNTDOWN TIMER COMPONENT ---
const CountdownTimer: React.FC<{ expiryDate: number }> = ({ expiryDate }) => {
    const calculateTimeLeft = useCallback(() => {
        const difference = expiryDate - new Date().getTime();
        let timeLeft: { days?: number, hours?: number, minutes?: number, seconds?: number } = {};

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            };
        }
        return timeLeft;
    }, [expiryDate]);

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [calculateTimeLeft]);

    const timerComponents: string[] = [];
    if (timeLeft.days) timerComponents.push(`${timeLeft.days} দিন`);
    if (timeLeft.hours) timerComponents.push(`${timeLeft.hours} ঘন্টা`);
    if (timeLeft.minutes) timerComponents.push(`${timeLeft.minutes} মিনিট`);
    if (typeof timeLeft.seconds !== 'undefined') timerComponents.push(`${timeLeft.seconds} সেকেন্ড`);

    return (
        <div className="text-sm text-gray-300 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700">
            {timerComponents.length ? `সময় বাকি: ${timerComponents.join(' ')}` : <span>মেয়াদ শেষ</span>}
        </div>
    );
};


// --- ORIGINAL TTS STUDIO COMPONENT ---
const TtsStudio: React.FC<{ onDeveloperClick: () => void; expiryDate: number | null; onLogout: () => void; }> = ({ onDeveloperClick, expiryDate, onLogout }) => {
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
          {expiryDate && (
            <div className="mt-4 flex flex-col items-center gap-3">
                 <CountdownTimer expiryDate={expiryDate} />
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
          )}
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
      <footer className="absolute bottom-6 text-center w-full px-4 flex justify-center items-center gap-4">
          <button
            title="Developer Access"
            onClick={onDeveloperClick}
            className="bg-transparent border-none p-2 text-2xl cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Developer Access"
            >
            🛠️
          </button>
      </footer>
    </div>
  );
};

// --- NEW ACTIVATION & DEVELOPER COMPONENTS ---

const TokenCountdown: React.FC<{ activationTimestamp: number }> = ({ activationTimestamp }) => {
    const expiryDate = activationTimestamp + ACTIVATION_DURATION_MS;
    
    const calculateTimeLeft = useCallback(() => {
        const difference = expiryDate - new Date().getTime();
        let timeLeft: { days?: number, hours?: number, minutes?: number, seconds?: number } = {};

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            };
        }
        return timeLeft;
    }, [expiryDate]);

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);
        return () => clearInterval(timer);
    }, [calculateTimeLeft]);

    const timerComponents: string[] = [];
    if (timeLeft.days) timerComponents.push(`${timeLeft.days}d`);
    if (timeLeft.hours) timerComponents.push(`${timeLeft.hours}h`);
    if (timeLeft.minutes) timerComponents.push(`${timeLeft.minutes}m`);
    
    if (timerComponents.length > 0) {
        return <span className="text-green-400">{timerComponents.join(' ')} বাকি</span>;
    }

    if (typeof timeLeft.seconds !== 'undefined') {
         return <span className="text-yellow-400">{timeLeft.seconds}s বাকি</span>;
    }

    return <span className="text-red-500">মেয়াদ শেষ</span>;
};

const App: React.FC = () => {
    // App state: null = checking, false = needs activation, true = activated
    const [isActivated, setIsActivated] = useState<boolean | null>(null);
    const [isExpired, setIsExpired] = useState<boolean>(false);
    const [expiryTimestamp, setExpiryTimestamp] = useState<number | null>(null);
    const [isDeveloper, setIsDeveloper] = useState<boolean>(false);
    const [showDeveloperLogin, setShowDeveloperLogin] = useState<boolean>(false);

    // Form state
    const [inputCode, setInputCode] = useState('');
    const [txid, setTxid] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [lastGeneratedToken, setLastGeneratedToken] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    // Token "database"
    const [tokens, setTokens] = useState<Token[]>([]);

    useEffect(() => {
        // Load tokens from localStorage
        try {
            const storedTokens = localStorage.getItem('tts_tokens');
            if (storedTokens) {
                setTokens(JSON.parse(storedTokens));
            }
        } catch (e) {
            console.error("Failed to parse tokens from localStorage", e);
        }
        
        // Don't check activation status on load, forcing login on refresh
        setIsActivated(false);
    }, []);
    
    const saveTokens = (updatedTokens: Token[]) => {
        setTokens(updatedTokens);
        localStorage.setItem('tts_tokens', JSON.stringify(updatedTokens));
    };

    const handleTokenSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        const tokenRecord = tokens.find(t => t.token === inputCode);

        if (!tokenRecord) {
            setError('ভুল অ্যাক্টিভেশন টোকেন।');
            setInputCode('');
            return;
        }

        // Token found, check its status
        if (tokenRecord.status === 'new') {
            // First-time activation for this token
            const activationTime = new Date().getTime();
            const newExpiryDate = activationTime + ACTIVATION_DURATION_MS;

            // Update the token's status and timestamp in our "database"
            const updatedTokens = tokens.map(t => 
                t.token === inputCode 
                ? { ...t, status: 'activated' as const, activationTimestamp: activationTime } 
                : t
            );
            saveTokens(updatedTokens);

            // Don't save activation data in localStorage to force re-login on refresh
            
            // Update app state to enter the main studio
            setIsActivated(true);
            setExpiryTimestamp(newExpiryDate);
            setIsExpired(false);

        } else { // status is 'activated'
            // This token has been used before. Let's check if it's expired.
            const activationTime = tokenRecord.activationTimestamp;

            // This is a safety check for data consistency.
            if (!activationTime) {
                setError('টোকেন ডেটাতে একটি অসঙ্গতি রয়েছে। অনুগ্রহ করে ডেভেলপারের সাথে যোগাযোগ করুন।');
                setInputCode('');
                return;
            }
            
            const expiryDate = activationTime + ACTIVATION_DURATION_MS;

            if (new Date().getTime() > expiryDate) {
                setError('এই টোকেনটির মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে নতুন টোকেন ব্যবহার করুন।');
            } else {
                // Token is still valid, so log the user in for this session.

                // Update app state to enter the main studio
                setIsActivated(true);
                setExpiryTimestamp(expiryDate);
                setIsExpired(false);
            }
        }
        
        setInputCode('');
    };
    
    const handleDeveloperLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (DEVELOPER_CODES.includes(inputCode)) {
            setIsDeveloper(true);
            setInputCode('');
        } else {
            setError('ভুল সিক্রেট কোড।');
        }
    };

    const handleGenerateToken = (e: React.FormEvent) => {
        e.preventDefault();
        if (!txid.trim()) {
            setError("TXID খালি রাখা যাবে না।");
            return;
        }
        setError(null);

        const newTokenValue = Math.random().toString().slice(2, 13); // 11 digit token
        const newToken: Token = {
            token: newTokenValue,
            txid: txid,
            timestamp: new Date().getTime(),
            status: 'new',
            developer: 'developer' // Hardcoded for this example
        };
        
        saveTokens([...tokens, newToken]);
        setLastGeneratedToken(newTokenValue);
        setTxid('');
    };

    const handleLogout = () => {
        setIsDeveloper(false);
        setError(null);
    };

    const handleResetActivation = () => {
        setIsActivated(false);
        setExpiryTimestamp(null);
        setIsExpired(false);
    };

    const handleCopyNumber = () => {
        navigator.clipboard.writeText('01704045466').then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    };

    // --- RENDER LOGIC ---

    if (isActivated === null) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <Spinner />
            </div>
        );
    }
    
    if (isDeveloper) {
        return (
            <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 md:p-8">
                <main className="w-full max-w-4xl mx-auto flex flex-col gap-8">
                    <header className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">Developer Panel</h1>
                        <button onClick={handleLogout} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
                            <LogoutIcon />
                            Logout
                        </button>
                    </header>

                    {/* Statistics */}
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4 text-cyan-300">পরিসংখ্যান</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <div className="bg-gray-900 p-4 rounded-lg">
                                <p className="text-sm text-gray-400">মোট টোকেন</p>
                                <p className="text-2xl font-bold text-cyan-400">{tokens.length}</p>
                            </div>
                            <div className="bg-gray-900 p-4 rounded-lg">
                                <p className="text-sm text-gray-400">অ্যাক্টিভেটেড</p>
                                <p className="text-2xl font-bold text-green-400">{tokens.filter(t => t.status === 'activated').length}</p>
                            </div>
                            <div className="bg-gray-900 p-4 rounded-lg">
                                <p className="text-sm text-gray-400">উপলব্ধ</p>
                                <p className="text-2xl font-bold text-yellow-400">{tokens.filter(t => t.status === 'new').length}</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Token Generation */}
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4 text-cyan-300">Generate New Token</h2>
                        <form onSubmit={handleGenerateToken} className="flex flex-col sm:flex-row gap-4">
                            <input
                                type="text"
                                value={txid}
                                onChange={(e) => setTxid(e.target.value)}
                                placeholder="Enter Customer TXID"
                                className="flex-grow p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition"
                            />
                            <button type="submit" className="flex items-center justify-center gap-2 text-white bg-purple-600 rounded-lg py-2 px-4 hover:bg-purple-700 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold">
                                <SparklesIcon />
                                Generate
                            </button>
                        </form>
                        {error && <p className="text-red-400 mt-2">{error}</p>}
                        {lastGeneratedToken && (
                            <div className="mt-4 p-3 bg-gray-900 border border-cyan-700 rounded-md">
                                <p className="text-gray-400">New Token: <strong className="text-cyan-300 font-mono">{lastGeneratedToken}</strong></p>
                            </div>
                        )}
                    </div>
                    
                    {/* Token List */}
                     <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4 text-cyan-300">Generated Tokens</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="p-2">Token</th>
                                        <th className="p-2">TXID</th>
                                        <th className="p-2">Timestamp</th>
                                        <th className="p-2">Status</th>
                                        <th className="p-2">মেয়াদ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...tokens].reverse().map(t => (
                                        <tr key={t.token} className="border-b border-gray-800 font-mono text-sm">
                                            <td className="p-2 text-cyan-400">{t.token}</td>
                                            <td className="p-2">{t.txid}</td>
                                            <td className="p-2">{new Date(t.timestamp).toLocaleString()}</td>
                                            <td className={`p-2 font-sans font-semibold ${t.status === 'new' ? 'text-yellow-400' : 'text-green-400'}`}>{t.status.toUpperCase()}</td>
                                            <td className="p-2 font-sans">
                                                {t.status === 'activated' && t.activationTimestamp ? (
                                                    <TokenCountdown activationTimestamp={t.activationTimestamp} />
                                                ) : (
                                                    <span className="text-gray-600">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        );
    }
    
    if (showDeveloperLogin) {
        return (
            <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col items-center justify-center p-4 relative">
                 <main className="w-full max-w-md mx-auto flex flex-col gap-8 text-center">
                      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-8 border border-gray-700">
                         <h2 className="text-xl font-semibold mb-4 text-cyan-300">Developer Access</h2>
                         <p className="text-gray-400 mb-6 text-sm">
                             আপনার সিক্রেট ডেভেলপার কোডটি লিখুন।
                         </p>
                         <form onSubmit={handleDeveloperLoginSubmit}>
                             <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                  <TerminalIcon />
                                </div>
                                <input
                                 type="password"
                                 value={inputCode}
                                 onChange={(e) => setInputCode(e.target.value)}
                                 placeholder="Secret Code"
                                 className="w-full p-3 pl-10 text-center tracking-[0.2em] font-mono bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition"
                                 />
                             </div>
                             {error && (
                                 <p className="text-red-400 text-sm mt-3">{error}</p>
                             )}
                              <div className="mt-6 flex flex-col sm:flex-row gap-4">
                                  <button type="button" onClick={() => { setShowDeveloperLogin(false); setError(null); }} className="w-full flex items-center justify-center text-lg font-semibold py-3 px-6 rounded-xl bg-gray-600 hover:bg-gray-700 text-white transition-all">
                                     বাতিল
                                 </button>
                                 <button type="submit" className="w-full flex items-center justify-center gap-3 text-lg font-semibold py-3 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-600 text-white shadow-lg hover:shadow-cyan-500/30 transform hover:scale-105 transition-all duration-300 disabled:opacity-50">
                                     প্রবেশ করুন
                                 </button>
                             </div>
                         </form>
                      </div>
                 </main>
                <footer className="absolute bottom-6 text-center w-full px-4">
                    <button
                      title="Developer Access"
                      onClick={() => { setShowDeveloperLogin(true); setInputCode(''); setError(null); }}
                      className="bg-transparent border-none p-2 text-2xl cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                      aria-label="Developer Access"
                      >
                      🛠️
                    </button>
                </footer>
            </div>
        );
    }

    if (isActivated && !isExpired) {
        return <TtsStudio 
            onDeveloperClick={() => { setShowDeveloperLogin(true); setInputCode(''); setError(null); }} 
            expiryDate={expiryTimestamp} 
            onLogout={handleResetActivation} 
        />;
    }

    if (isExpired) {
       return (
           <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md mx-auto text-center bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-8 border border-gray-700">
                    <InfoIcon />
                    <h1 className="text-3xl font-bold text-red-400 mt-4">Subscription Expired</h1>
                    <p className="mt-2 text-lg text-gray-400">আপনার ৩০-দিনের অ্যাক্সেসের মেয়াদ শেষ হয়ে গেছে। আপনার সাবস্ক্রিপশন পুনর্নবীকরণ করতে একটি নতুন টোকেন লিখুন।</p>
                    <button onClick={handleResetActivation} className="mt-6 w-full flex items-center justify-center gap-2 text-white bg-cyan-600 rounded-lg py-3 px-4 hover:bg-cyan-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold">
                       নতুন টোকেন লিখুন
                    </button>
                </div>
           </div>
       );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col items-center justify-center p-4 relative">
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
                            সফটওয়্যার অ্যাক্টিভেশন
                        </h2>
                        <div className="text-gray-400 mb-6 text-sm text-center space-y-3">
                            <p className="text-green-400 font-bold">Subscription নিতে <span className="inline-block text-lg bg-gradient-to-r from-yellow-300 via-red-500 to-purple-500 bg-clip-text text-transparent animate-gradient-flow">২৫০ টাকা</span> সেন্ড মানি করুন বিকাশে এবং ট্রান্সজেকশন আইডি Whatsapp করুন এই নাম্বারে।</p>
                            <div className="flex items-center justify-center bg-gray-900 border border-gray-700 rounded-lg p-2 max-w-xs mx-auto">
                                <span className="font-mono text-lg text-cyan-300 tracking-wider flex-grow text-center">01704045466</span>
                                <button
                                    onClick={handleCopyNumber}
                                    type="button"
                                    className={`ml-2 px-3 py-1 text-xs font-semibold rounded-md transition-colors duration-200 flex items-center justify-center ${copySuccess ? 'bg-green-600 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
                                    aria-label="Copy number"
                                >
                                    {copySuccess ? (
                                        <span className="flex items-center gap-1">
                                            <CheckIcon /> Copied
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1">
                                            <CopyIcon /> Copy
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleTokenSubmit}>
                            <div className="relative max-w-sm mx-auto">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <KeyIcon />
                                </div>
                                <input
                                    type="text"
                                    value={inputCode}
                                    onChange={(e) => setInputCode(e.target.value)}
                                    placeholder="_ _ _ _ _ _ _ _ _ _ _"
                                    className="w-full p-3 pl-10 text-center tracking-[0.2em] font-mono bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition"
                                />
                            </div>
                            {error && (
                                <p className="text-red-400 text-sm mt-3">{error}</p>
                            )}
                            <button type="submit" className="mt-6 w-full max-w-sm mx-auto flex items-center justify-center gap-3 text-lg font-semibold py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg hover:shadow-cyan-500/30 transform hover:scale-105 transition-all duration-300 disabled:opacity-50">
                                অ্যাক্টিভেট করুন
                            </button>
                        </form>
                    </div>
                </div>
            </main>
            <footer className="absolute bottom-6 text-center w-full px-4">
                <button
                  title="Developer Access"
                  onClick={() => { setShowDeveloperLogin(true); setInputCode(''); setError(null); }}
                  className="bg-transparent border-none p-2 text-2xl cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Developer Access"
                  >
                  🛠️
                </button>
            </footer>
        </div>
    );
};

export default App;