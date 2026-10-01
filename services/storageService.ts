
import { ParcelData, SavedTrack, AppSettings, UserProfile, ClientActivity } from '../types';
import { MOCK_TRACKING_DATA } from '../constants';

// --- GOOGLE SHEETS CONFIGURATION ---
// Client Sheet: A=ID, B=Name, C=Phone (Unchanged)
export const CLIENTS_SHEET_URL = "https://docs.google.com/spreadsheets/d/1iebmmqkTFlJt7OOqdtmr8B48FvlWIcOv8EUtLrYlukc/export?format=csv"; 
export const REYS_DIRECTORY_URL = "https://docs.google.com/spreadsheets/d/1eCuVFuY7BsblAaETCYA7C8hIWM51sfZxJ759fuxoxeg/export?format=csv"; 

// COMBINED SETTINGS & ARRIVED REYS SHEET
export const SETTINGS_SHEET_URL = "https://docs.google.com/spreadsheets/d/1M7J6v-vkVVtZpLqLsC9giRXKqkDL9NBZhLnY9SX_d94/export?format=csv"; 
export const ARRIVED_REYS_SHEET_URL = "https://docs.google.com/spreadsheets/d/1M7J6v-vkVVtZpLqLsC9giRXKqkDL9NBZhLnY9SX_d94/export?format=csv";

// Rebranded Database Keys
const DB_KEY_USER_TRACKS_PREFIX = 'yaqiin_cargo_user_tracks'; 
const DB_KEY_SETTINGS = 'yaqiin_cargo_settings';
const DB_KEY_USER_PROFILE = 'yaqiin_cargo_user_profile';
const DB_KEY_ALL_REGISTRATIONS = 'yaqiin_cargo_admin_registrations';

// --- CACHING SYSTEM ---
interface CacheEntry {
    data: string;
    timestamp: number;
}
const SHEET_CACHE: Record<string, CacheEntry> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export const clearDataCache = () => {
    Object.keys(SHEET_CACHE).forEach(key => delete SHEET_CACHE[key]);
};

const fetchWithCache = async (url: string): Promise<string | null> => {
    const now = Date.now();
    
    // Check Cache
    if (SHEET_CACHE[url] && (now - SHEET_CACHE[url].timestamp < CACHE_TTL)) {
        return SHEET_CACHE[url].data;
    }

    try {
        // Fetch fresh data
        const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}t=${now}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) return null;
        
        const text = await response.text();
        
        // Update Cache
        SHEET_CACHE[url] = { data: text, timestamp: now };
        return text;
    } catch (e) {
        return null;
    }
};

const splitCsvRow = (row: string) => {
    if (!row) return [];
    const res = [];
    let current = '';
    let inQuote = false;
    for(let i=0; i<row.length; i++){
        const char = row[i];
        if(char === '"'){
            inQuote = !inQuote;
        } else if(char === ',' && !inQuote){
            res.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
            continue;
        }
        current += char;
    }
    res.push(current.trim().replace(/^"|"$/g, ''));
    return res;
};

const getCsvUrl = (url: string): string => {
    if (url.includes('output=csv') || url.includes('format=csv')) return url;
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
    }
    return url;
};

const parsePrice = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/[^0-9.,]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
};

// --- Arrived Reys Logic ---
export const fetchArrivedReys = async (): Promise<{ avia: string[], avto: string[] }> => {
    try {
        const text = await fetchWithCache(ARRIVED_REYS_SHEET_URL);
        if (!text) return { avia: [], avto: [] };

        const rows = text.split('\n');
        
        const avia: string[] = [];
        const avto: string[] = [];

        // Skip Header (Row 1), start from Row 2
        for(let i = 1; i < rows.length; i++) {
            const cols = splitCsvRow(rows[i]);
            // Col A (0): Avia code
            if (cols[0] && cols[0].trim()) avia.push(cols[0].trim());
            // Col B (1): Avto code
            if (cols[1] && cols[1].trim()) avto.push(cols[1].trim());
        }
        return { avia, avto };
    } catch (e) {
        return { avia: [], avto: [] };
    }
};

export const isReysArrived = (boxCode: string | undefined, arrivedData: { avia: string[], avto: string[] } | null): boolean => {
    if (!boxCode || !arrivedData) return false;
    const code = boxCode.trim().toUpperCase();
    
    // Check exact match first
    if (arrivedData.avia.includes(code) || arrivedData.avto.includes(code)) return true;

    // Check by number extraction if format differs
    const match = code.match(/(\d+)/);
    if (!match) return false;
    const number = match[1];
    
    const lower = code.toLowerCase();
    if (lower.includes('avia')) {
        return arrivedData.avia.some(r => r.includes(number));
    } else {
        return arrivedData.avto.some(r => r.includes(number));
    }
};

// --- User Profile & Admin Support ---
export const fetchAndVerifyClient = async (inputClientId: string, inputPhone: string): Promise<UserProfile> => {
    const cleanInputId = inputClientId.trim().toUpperCase().replace(/\s/g, '');
    const cleanInputPhone = inputPhone.replace(/\D/g, '').slice(-9);

    if (!CLIENTS_SHEET_URL) throw new Error("Tizim sozlanmagan.");
    
    try {
        const text = await fetchWithCache(CLIENTS_SHEET_URL);
        if (!text) throw new Error("Tarmoq xatosi");
        
        const trimmed = text.trim();
        if (trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE')) {
             throw new Error("Baza bilan aloqa xatoligi (Access Denied).");
        }
        
        const rows = text.split('\n');

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cols = splitCsvRow(row);
            if (cols.length < 3) continue;

            const sheetId = cols[0].toUpperCase().replace(/\s/g, '');
            const sheetPhone = cols[2].replace(/\D/g, '');

            // Verify ID match
            if (sheetId === cleanInputId) {
                // Verify Phone (last 9 digits)
                if (sheetPhone.endsWith(cleanInputPhone)) {
                    return { 
                        name: cols[1].trim() || "Mijoz", 
                        clientId: sheetId, 
                        phone: "+998 " + cleanInputPhone, 
                        registeredAt: Date.now() 
                    };
                }
            }
        }
        throw new Error("Bunday ID topilmadi yoki telefon raqam mos emas.");
    } catch (error: any) {
        throw new Error(error.message || "Xatolik.");
    }
};

export const fetchAllClientsFromSheet = async (): Promise<ClientActivity[]> => {
    if (!CLIENTS_SHEET_URL) return [];
    try {
        const text = await fetchWithCache(CLIENTS_SHEET_URL);
        if (!text) return [];

        const trimmed = text.trim();
        if (trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE')) {
             return [];
        }

        const rows = text.split('\n');
        const results: ClientActivity[] = [];

        for (let i = 1; i < rows.length; i++) {
            const cols = splitCsvRow(rows[i]);
            if (cols.length < 2) continue;
            
            // Col A: ID, Col B: Name, Col C: Phone
            const clientId = cols[0]?.trim();
            const name = cols[1]?.trim() || "Mijoz";
            const phoneVal = cols[2]?.replace(/\D/g, '') || "";
            
            if (clientId) {
                results.push({
                    id: String(i),
                    clientId,
                    name,
                    phone: phoneVal.length >= 9 ? `+998 ${phoneVal.slice(-9)}` : phoneVal
                });
            }
        }
        return results;
    } catch (e) {
        return [];
    }
};

export const getUserProfile = (): UserProfile | null => {
  try { return JSON.parse(localStorage.getItem(DB_KEY_USER_PROFILE) || 'null'); } catch (e) { return null; }
};
export const saveUserProfile = (profile: UserProfile) => localStorage.setItem(DB_KEY_USER_PROFILE, JSON.stringify(profile));
export const logoutUser = () => localStorage.removeItem(DB_KEY_USER_PROFILE);

// --- ACTIVE USER TRACKING ---
export const registerUserActivity = (profile: UserProfile) => {
    try {
        const stored = localStorage.getItem(DB_KEY_ALL_REGISTRATIONS);
        let users: UserProfile[] = stored ? JSON.parse(stored) : [];
        
        // Update existing user or add new one
        const existingIndex = users.findIndex(u => u.clientId === profile.clientId);
        
        if (existingIndex >= 0) {
            users[existingIndex] = {
                ...users[existingIndex],
                ...profile,
                lastActive: Date.now()
            };
        } else {
            users.unshift({
                ...profile,
                lastActive: Date.now()
            });
        }
        
        localStorage.setItem(DB_KEY_ALL_REGISTRATIONS, JSON.stringify(users));
    } catch (e) {
        console.error("Failed to register activity", e);
    }
};

export const getRegisteredUsers = (): UserProfile[] => {
     try {
        const stored = localStorage.getItem(DB_KEY_ALL_REGISTRATIONS);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
};

// --- APP SETTINGS ---
const DEFAULT_SETTINGS: AppSettings = {
  exchangeRate: 12850, 
  prices: { avto: { standard: 6.0, bulk: 7.5 }, avia: { standard: 9.5, bulk: 11.0 } },
  deliveryTime: { avto: "14-18 Kun", avia: "3-5 Kun" }
};

export const getAppSettings = (): AppSettings => {
  try { 
      const stored = JSON.parse(localStorage.getItem(DB_KEY_SETTINGS) || 'null');
      if (!stored) return DEFAULT_SETTINGS;

      return {
          ...DEFAULT_SETTINGS,
          ...stored,
          prices: { ...DEFAULT_SETTINGS.prices, ...stored.prices },
          deliveryTime: { ...DEFAULT_SETTINGS.deliveryTime, ...stored.deliveryTime }
      };
  } catch (e) { 
      return DEFAULT_SETTINGS; 
  }
};

export const saveAppSettings = (settings: AppSettings) => localStorage.setItem(DB_KEY_SETTINGS, JSON.stringify(settings));

export const syncGlobalSettings = async (): Promise<void> => {
    if (!SETTINGS_SHEET_URL) return; 
    try {
        const text = await fetchWithCache(SETTINGS_SHEET_URL);
        if (!text || text.startsWith('<')) return; // Safety check
        
        const rows = text.split('\n').map(r => splitCsvRow(r));
        // We look at Row 2 (Index 1) based on recent requirements
        // Col C(2): Avia Std
        // Col D(3): Avto Std
        // Col E(4): Avia Bulk
        // Col F(5): Avto Bulk
        // Col G(6): Avia Time
        // Col H(7): Avto Time
        // Col I(8): Rate (Optional)
        
        if (rows.length > 1) {
            const dataRow = rows[1];
            if (dataRow.length >= 6) {
                const newSettings = { ...getAppSettings() };
                
                newSettings.prices.avia.standard = parsePrice(dataRow[2]) || newSettings.prices.avia.standard;
                newSettings.prices.avto.standard = parsePrice(dataRow[3]) || newSettings.prices.avto.standard;
                newSettings.prices.avia.bulk = parsePrice(dataRow[4]) || newSettings.prices.avia.bulk;
                newSettings.prices.avto.bulk = parsePrice(dataRow[5]) || newSettings.prices.avto.bulk;
                
                if(dataRow[6]) newSettings.deliveryTime.avia = dataRow[6];
                if(dataRow[7]) newSettings.deliveryTime.avto = dataRow[7];
                
                // Exchange Rate (Col I / Index 8)
                if(dataRow[8]) newSettings.exchangeRate = parsePrice(dataRow[8]) || newSettings.exchangeRate;

                saveAppSettings(newSettings);
            }
        }
    } catch (e) {}
};

const parseReysRow = (rowStr: string, reysName: string, searchId: string): ParcelData | null => {
    const cols = splitCsvRow(rowStr);
    if (cols.length < 3) return null;
    if (!cols[2] || !cols[2].toUpperCase().includes(searchId)) return null; 

    const id = cols[2];
    const date = cols[1] || new Date().toLocaleDateString();
    const weightVal = parseFloat(cols[6]?.replace(',', '.').replace(/[^\d.]/g, '') || "0") || 0;
    const isAvia = reysName.toLowerCase().includes('avia');
    const settings = getAppSettings();
    const rate = isAvia ? settings.prices.avia.standard : settings.prices.avto.standard;

    return {
        id: id,
        sender: cols[3] || "Yuk",
        receiver: cols[7] || "Mijoz",
        weight: weightVal.toString(),
        boxCode: reysName,
        price: weightVal * rate,
        history: [{
            date: date,
            time: "12:00",
            status: `Yo'lga chiqdi (${reysName})`,
            location: isAvia ? 'Guangzhou Aeroport' : 'Guangzhou Ombori',
            completed: false
        }]
    };
};

const promiseAny = <T>(promises: Promise<T>[]): Promise<T> => {
    return new Promise((resolve, reject) => {
        let rejectedCount = 0;
        if (promises.length === 0) {
            reject(new Error("No promises"));
            return;
        }
        promises.forEach(p => {
            Promise.resolve(p).then(resolve).catch(() => {
                rejectedCount++;
                if (rejectedCount === promises.length) {
                    reject(new Error("All promises rejected"));
                }
            });
        });
    });
};

export const findParcel = async (id: string): Promise<ParcelData | null> => {
  if (!id) return null;
  const cleanId = id.toUpperCase().trim().replace(/\s/g, '');
  
  // Check MOCK first
  if (MOCK_TRACKING_DATA[cleanId]) return MOCK_TRACKING_DATA[cleanId];

  // Then check Global storage (from Excel uploads)
  try {
      const globalData = JSON.parse(localStorage.getItem('global_tracking_data') || '{}');
      if (globalData[cleanId]) return globalData[cleanId];
  } catch {}

  // Then check Reys Directory
  if (REYS_DIRECTORY_URL) {
      try {
        const dirText = await fetchWithCache(REYS_DIRECTORY_URL);
        if (dirText && !dirText.startsWith('<')) {
            const dirRows = dirText.split('\n');
            const tasks: { name: string, url: string }[] = [];

            for (const row of dirRows) {
                const cols = splitCsvRow(row);
                if (cols.length >= 2 && cols[1].includes('http')) {
                    tasks.push({
                        name: cols[0],
                        url: getCsvUrl(cols[1])
                    });
                }
            }

            const searchPromises = tasks.map(async (task) => {
                const text = await fetchWithCache(task.url);
                if (!text || text.startsWith('<')) throw new Error('Invalid sheet');

                if (text.indexOf(cleanId) === -1) {
                     throw new Error('Not found in this sheet');
                }

                const lines = text.split('\n');
                for (const line of lines) {
                    if (line.includes(cleanId)) {
                        const parsed = parseReysRow(line, task.name, cleanId);
                        if (parsed) return parsed;
                    }
                }
                
                throw new Error('Not found after parsing');
            });

            try {
                return await promiseAny(searchPromises);
            } catch (e) {
                return null;
            }
        }
      } catch (e) {
          console.error("Search error:", e);
      }
  }
  return null;
};

const getUserTracksKey = () => {
    const profile = getUserProfile();
    return profile ? `${DB_KEY_USER_TRACKS_PREFIX}_${profile.clientId}` : DB_KEY_USER_TRACKS_PREFIX;
};

export const getUserTracks = (): SavedTrack[] => {
  try { return JSON.parse(localStorage.getItem(getUserTracksKey()) || '[]'); } catch (e) { return []; }
};

export const saveUserTrack = (id: string) => {
  const cleanId = id.trim().toUpperCase().replace(/\s/g, '');
  if (!cleanId) return;
  const tracks = getUserTracks();
  if (tracks.some(t => t.id === cleanId)) return;
  const updated = [{ id: cleanId, addedAt: Date.now() }, ...tracks];
  localStorage.setItem(getUserTracksKey(), JSON.stringify(updated));
};

export const removeUserTrack = (id: string) => {
  const cleanId = id.trim().toUpperCase().replace(/\s/g, '');
  const updated = getUserTracks().filter(t => t.id !== cleanId);
  localStorage.setItem(getUserTracksKey(), JSON.stringify(updated));
};

export const updateGlobalTrackingData = (newParcels: ParcelData[]) => {
    try {
        const existingStr = localStorage.getItem('global_tracking_data');
        const existingData = existingStr ? JSON.parse(existingStr) : {};
        
        newParcels.forEach(p => {
            existingData[p.id] = p;
        });
        
        localStorage.setItem('global_tracking_data', JSON.stringify(existingData));
    } catch (e) {
        console.error("Error saving global tracking data", e);
    }
};

export const convertExcelRowToParcel = (row: any): ParcelData | null => {
  try {
    const keys = Object.keys(row);
    const idKey = keys.find(k => /track|id|code|追踪/i.test(k)) || "";
    const id = String(row[idKey] || "").trim();
    if (!id) return null;
    
    return {
        id, 
        sender: row['Sender'] || 'Imported', 
        receiver: row['Receiver'] || 'Imported',
        weight: String(row['Weight'] || '0'),
        history: [{ date: new Date().toLocaleDateString(), time: "", status: 'Ma\'lumot yangilandi', location: 'Xitoy', completed: false }]
    };
  } catch (e) { return null; }
};
