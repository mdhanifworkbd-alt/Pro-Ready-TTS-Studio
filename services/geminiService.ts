
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { Character, AnalyzedCharacterEmotion } from '../types';
import { AVAILABLE_EMOTIONS, AVAILABLE_VOICES } from "../constants";
import { decodeBase64, encodeBase64 } from "../utils/audioUtils";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function generateSingleSpeakerSpeech(character: Character): Promise<Uint8Array | null> {
    const model = "gemini-2.5-flash-preview-tts";
    
    if (!character.dialogue.trim()) {
        return null;
    }

    const voiceOption = AVAILABLE_VOICES.find(v => v.id === character.voice);
    if (!voiceOption) {
        console.error(`Voice with id "${character.voice}" not found.`);
        throw new Error(`"${character.name}" চরিত্রের জন্য "${character.voice}" কণ্ঠস্বরটি খুঁজে পাওয়া যায়নি।`);
    }

    const instruction = voiceOption.promptOverride 
        ? voiceOption.promptOverride
        : (AVAILABLE_EMOTIONS.find(e => e.id === character.emotion)?.prompt || 'Say it in a normal voice');

    const prompt = `${instruction}: ${character.dialogue}`;
    
    const apiVoiceName = voiceOption.apiVoice;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: apiVoiceName }
                    }
                }
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            return decodeBase64(base64Audio);
        }
        return null;
    } catch (error)
    {
        console.error(`Failed to generate audio for character "${character.name}":`, error);
        throw new Error(`"${character.name}" চরিত্রের জন্য অডিও তৈরি করা যায়নি। এপিআই থেকে একটি ত্রুটি পাওয়া গেছে।`);
    }
}


export async function generateMultiSpeakerSpeech(characters: Character[]): Promise<string | null> {
    const generationPromises = characters
        .map(character => generateSingleSpeakerSpeech(character));

    const audioChunks = await Promise.all(generationPromises);
    const validChunks = audioChunks.filter((chunk): chunk is Uint8Array => chunk !== null);
    
    if (validChunks.length === 0) {
        return null;
    }

    // Concatenate all Uint8Array chunks
    const totalLength = validChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const concatenatedPcm = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of validChunks) {
        concatenatedPcm.set(chunk, offset);
        offset += chunk.length;
    }

    // Return as a single base64 string
    return encodeBase64(concatenatedPcm);
}

export async function analyzeScriptEmotions(script: string): Promise<AnalyzedCharacterEmotion[]> {
    const model = 'gemini-2.5-flash';
    const availableEmotionIds = AVAILABLE_EMOTIONS.map(e => e.id).join(', ');

    const systemInstruction = `You are an expert script analyst and film director. Your task is to read a script and determine the most fitting emotion for each line of dialogue to create a cinematic experience. Consider the story's overall emotional arc, character development, and the climax.`;
    
    const prompt = `
        Here is the script:
        ---
        ${script}
        ---
        Analyze the script and for each distinct character and dialogue combination, assign an emotion from the following list: [${availableEmotionIds}].

        Return your analysis as a JSON array of objects. Each object must have three keys: "name" (the character's name), "dialogue" (the exact dialogue from the script), and "emotion" (the assigned emotion ID from the list).
        Ensure every line of dialogue from the script is present in your response.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            dialogue: { type: Type.STRING },
                            emotion: { type: Type.STRING },
                        },
                        required: ["name", "dialogue", "emotion"],
                    },
                },
            },
        });

        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);
        return parsedJson as AnalyzedCharacterEmotion[];
        
    } catch (error) {
        console.error("Failed to analyze script emotions:", error);
        throw new Error("স্বয়ংক্রিয় আবেগ বিশ্লেষণ করা যায়নি। দয়া করে আবার চেষ্টা করুন।");
    }
}