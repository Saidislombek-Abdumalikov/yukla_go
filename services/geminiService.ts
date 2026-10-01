
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { getAppSettings } from "./storageService";

// Safe access to API_KEY injected via Vite's define config
const API_KEY = (() => {
    try {
        // @ts-ignore
        const key = process.env.API_KEY;
        return key || "";
    } catch {
        return "";
    }
})();

let chatSession: Chat | null = null;
let aiClient: GoogleGenAI | null = null;

const getSystemInstruction = () => {
  const settings = getAppSettings();
  return `
You are the intelligent customer support agent for "YAQIIN CARGO", a logistics company sending goods from China (Guangzhou) to Uzbekistan (Tashkent).

**KEY RULES:**
1. **Language**: Match the user's language. If they speak Uzbek, reply in Uzbek. If Russian, reply in Russian. Default to Uzbek if unsure.
2. **Tone**: Professional, friendly, and concise.

**COMPANY INFO:**
- **Admin/Support**: If you cannot answer, or if the user needs human help, tell them to contact admin via Telegram (@yaqiin).
- **Warehouse Address**: 浙江省金华市义乌市荷叶塘东青路89号618仓库 (Yiwu/Guangzhou area).
- **Client ID**: Users must have a specific "YAQIIN..." or "YAQ..." ID code (e.g., YAQ-12345).

**SERVICES & PRICING:**
- **✈️ AVIA (Air Only)**:
  - Time: ${settings.deliveryTime.avia}.
  - Price: $${settings.prices.avia.standard}/kg.
  - Bulk Price: $${settings.prices.avia.bulk}/kg (For large volume/series).
- **Exchange Rate**: 1 USD = ${settings.exchangeRate.toLocaleString()} UZS.
- **NOTE**: We ONLY provide AVIA service. There is NO AVTO (Truck) service available.

**❌ STRICT RESTRICTIONS:**
The following items are **FORBIDDEN** in our AVIA service:
1. **Batteries** (Power banks, electronics with batteries).
2. **Magnets** (Speakers, specific electronics).
3. **Liquids** (Perfumes, creams, drinks, oils).
4. **Flammable items**.

**TRACKING:**
- If a user asks "Where is my cargo?", ask them for their **Tracking ID** (e.g., YAQ-12345).
- You cannot check the database directly. Tell them to use the "Yuklarim" or "Asosiy" tab in the app to track their parcel.
`;
};

const getClient = (): GoogleGenAI => {
  if (!aiClient) {
    if (!API_KEY) {
      console.warn("API_KEY is missing. Gemini AI will not function.");
    }
    aiClient = new GoogleGenAI({ apiKey: API_KEY });
  }
  return aiClient;
};

export const initializeChat = (): void => {
  const ai = getClient();
  chatSession = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: getSystemInstruction(),
      temperature: 0.7,
    },
  });
};

export const sendMessageToGemini = async function* (message: string): AsyncGenerator<string, void, unknown> {
  if (!chatSession) {
    initializeChat();
  }

  if (!chatSession) {
    yield "Tizimda xatolik yuz berdi. Iltimos, keyinroq urinib ko'ring.";
    return;
  }

  try {
    const result = await chatSession.sendMessageStream({ message });
    
    for await (const chunk of result) {
       const c = chunk as GenerateContentResponse;
       if (c.text) {
         yield c.text;
       }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    yield "Hozircha aloqa bilan muammo bor. Iltimos, keyinroq urinib ko'ring.";
  }
};
