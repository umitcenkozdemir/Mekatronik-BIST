import { db, collection, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, getDocs, query, where, Timestamp, handleFirestoreError, OperationType, orderBy } from '../firebase.ts';

export interface Stock {
  id?: string;
  symbol: string;
  name: string;
  sector: string;
  current_k: number;
  adaptive_k?: boolean;
  current_atr?: number;
  max_position_pct?: number;
  is_active: boolean;
  last_price: number;
  logoid?: string | null;
}

export interface PortfolioItem {
  id?: string;
  uid: string;
  stock_id: string;
  symbol: string;
  current_lots: number;
  avg_cost: number;
  allocated_capital: number; // Initial capital
  injected_capital: number;  // Total capital (Initial + Additions - Withdrawals)
  cash_reserve: number;
  initial_ratio: number;
  trailing_stop_pct?: number;
  highest_price?: number;
  take_profit_pct?: number;
  take_profit_amount_pct?: number;
  monthly_start_equity?: number; // Equity at the start of the current month
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved';
  created_at: Timestamp;
}

export interface BistStock {
  id?: string;
  symbol: string;
  name: string;
  last_price?: number;
  daily_change?: number;
  logoid?: string | null;
  volume?: number | null;
}

export interface Transaction {
  id?: string;
  uid?: string;
  stock_id: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';
  amount: number;
  price: number;
  commission?: number;
  reason?: string;
  timestamp: Timestamp;
}

export interface SystemSettings {
  initial_buy_ratio: number;
  dead_band: number;
  commission_rate: number;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  initial_buy_ratio: 0.6,
  dead_band: 0.01, // 1%
  commission_rate: 0.0004,
};

/**
 * P-Control Algorithm Logic
 * İşlem Lotu = Mevcut Lot * (|Δ Fiyat %| * K)
 */
export function calculateTrade(
  currentLots: number,
  priceChangePercent: number,
  kFactor: number,
  deadBand: number,
  atr?: number,
  useAdaptiveK?: boolean
): number {
  const absChange = Math.abs(priceChangePercent);
  
  if (absChange <= deadBand) {
    return 0; // Inertia mode
  }

  let effectiveK = kFactor;
  if (useAdaptiveK && atr) {
    // Adaptive K based on ATR: Higher volatility (ATR) -> Lower K to reduce risk
    // This is a simplified model: K_adaptive = K_base * (Price / ATR) / NormalizationFactor
    // For now, let's just use a simple inverse relationship for demonstration
    const volatilityFactor = Math.max(0.5, Math.min(2, 1 / (atr / 2))); // Clamp between 0.5 and 2
    effectiveK = kFactor * volatilityFactor;
  }

  // Formula: Lot = CurrentLot * (|Change%| * K)
  const tradeLots = Math.floor(currentLots * (absChange * effectiveK));
  return tradeLots;
}

export async function registerUser(uid: string, email: string) {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email,
        role: email === 'umitcenkozdemir@gmail.com' ? 'admin' : 'user',
        status: email === 'umitcenkozdemir@gmail.com' ? 'approved' : 'pending',
        created_at: Timestamp.now()
      });
    }
  } catch (error) {
    // If it's a permission error, it might be because the user is already registered
    // and the rules don't allow them to write to their own doc if they are already an admin (update rules)
    console.error("User registration error:", error);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return { uid, ...userSnap.data() } as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users');
    return null;
  }
}

export async function getPendingUsers(): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users'), where('status', '==', 'pending'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users');
    return [];
  }
}

export async function approveUser(uid: string) {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { status: 'approved' });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'users');
  }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users'), orderBy('created_at', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users');
    return [];
  }
}

export async function updateUserStatus(uid: string, status: 'pending' | 'approved') {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'users');
  }
}

export async function updateUserRole(uid: string, role: 'admin' | 'user') {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { role });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'users');
  }
}

export async function getBistStocks(): Promise<BistStock[]> {
  try {
    const blacklist = await getBlacklist();
    const blacklistSet = new Set(blacklist.map(s => s.trim().toUpperCase()));
    
    const querySnapshot = await getDocs(collection(db, 'bist_stocks'));
    const stocks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BistStock));
    
    // Deduplicate by symbol and filter out blacklisted stocks
    const seen = new Set<string>();
    return stocks.filter(s => {
      const symbol = s.symbol.trim().toUpperCase();
      const baseSymbol = symbol.split('.')[0];
      
      if (blacklistSet.has(symbol) || blacklistSet.has(baseSymbol)) return false;
      if (seen.has(symbol)) return false;
      
      seen.add(symbol);
      return true;
    });
  } catch (error) {
    console.error("Error fetching BIST stocks:", error);
    return [];
  }
}

export async function getBlacklist(): Promise<string[]> {
  try {
    const docRef = doc(db, 'settings', 'blacklist');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().symbols || [];
    }
    return [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'settings/blacklist');
    return [];
  }
}

export async function updateBlacklist(symbols: string[]) {
  try {
    const docRef = doc(db, 'settings', 'blacklist');
    await setDoc(docRef, { symbols, updated_at: Timestamp.now() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/blacklist');
  }
}

export async function clearBistStocks() {
  try {
    const querySnapshot = await getDocs(collection(db, 'bist_stocks'));
    const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, 'bist_stocks', docSnap.id)));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Error clearing BIST stocks:", error);
    throw error;
  }
}

export async function syncBistStocks() {
  try {
    const response = await fetch('/api/bist-stocks');
    if (!response.ok) throw new Error('API error');
    const list = await response.json();
    
    const blacklist = await getBlacklist();
    const blacklistSet = new Set(blacklist.map(s => s.trim().toUpperCase()));

    const stocksSnap = await getDocs(collection(db, 'bist_stocks'));
    // Use uppercase symbols for the map to handle case-insensitivity
    const existingStocks = new Map(stocksSnap.docs.map(doc => [doc.data().symbol.trim().toUpperCase(), doc.id]));
    
    let addedCount = 0;
    let updatedCount = 0;
    
    // First, remove blacklisted stocks that are already in the database
    for (const [symbol, docId] of existingStocks.entries()) {
      const baseSymbol = symbol.split('.')[0];
      if (blacklistSet.has(symbol) || blacklistSet.has(baseSymbol)) {
        await deleteDoc(doc(db, 'bist_stocks', docId));
        existingStocks.delete(symbol);
      }
    }
    
    for (const s of list) {
      const symbol = s.symbol.trim().toUpperCase();
      const baseSymbol = symbol.split('.')[0];
      
      if (blacklistSet.has(symbol) || blacklistSet.has(baseSymbol)) {
        continue;
      }

      if (existingStocks.has(symbol)) {
        const docId = existingStocks.get(symbol)!;
        await updateDoc(doc(db, 'bist_stocks', docId), {
          last_price: s.last_price,
          daily_change: s.daily_change,
          name: s.name,
          logoid: s.logoid || null,
          volume: s.volume || null,
          updated_at: Timestamp.now()
        });
        updatedCount++;
      } else {
        await addDoc(collection(db, 'bist_stocks'), {
          ...s,
          logoid: s.logoid || null,
          volume: s.volume || null,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        });
        addedCount++;
        // Add to existingStocks to prevent adding duplicates if API returns duplicates
        existingStocks.set(symbol, 'temp-id');
      }
    }
    return { addedCount, updatedCount };
  } catch (error) {
    console.error("Sync error:", error);
    throw error;
  }
}

export async function seedBistStocks() {
  const list = [
    { symbol: 'THYAO.IS', name: 'Türk Hava Yolları', last_price: 285.50, daily_change: 1.2 },
    { symbol: 'EREGL.IS', name: 'Erdemir', last_price: 45.20, daily_change: -0.5 },
    { symbol: 'ASELS.IS', name: 'Aselsan', last_price: 58.75, daily_change: 2.1 },
    { symbol: 'KCHOL.IS', name: 'Koç Holding', last_price: 165.40, daily_change: 0.8 },
    { symbol: 'SISE.IS', name: 'Şişecam', last_price: 48.12, daily_change: -1.1 },
    { symbol: 'TUPRS.IS', name: 'Tüpraş', last_price: 155.30, daily_change: 3.4 },
    { symbol: 'AKBNK.IS', name: 'Akbank', last_price: 38.45, daily_change: 0.2 },
    { symbol: 'GARAN.IS', name: 'Garanti BBVA', last_price: 62.10, daily_change: 1.5 },
    { symbol: 'BIMAS.IS', name: 'BİM Mağazalar', last_price: 385.00, daily_change: -0.3 },
    { symbol: 'SASAS.IS', name: 'Sasa Polyester', last_price: 38.20, daily_change: -2.5 },
    { symbol: 'HEKTS.IS', name: 'Hektaş', last_price: 15.40, daily_change: -3.1 },
    { symbol: 'FROTO.IS', name: 'Ford Otosan', last_price: 985.00, daily_change: 0.5 },
    { symbol: 'TOASO.IS', name: 'Tofaş Oto', last_price: 245.00, daily_change: 1.1 },
    { symbol: 'ARCLK.IS', name: 'Arçelik', last_price: 145.00, daily_change: -0.8 },
    { symbol: 'SAHOL.IS', name: 'Sabancı Holding', last_price: 78.40, daily_change: 0.4 },
    { symbol: 'YKBNK.IS', name: 'Yapı Kredi Bankası', last_price: 22.10, daily_change: 1.2 },
    { symbol: 'ISCTR.IS', name: 'İş Bankası (C)', last_price: 25.40, daily_change: 0.9 },
    { symbol: 'PETKM.IS', name: 'Petkim', last_price: 21.30, daily_change: -1.5 },
    { symbol: 'KRDMD.IS', name: 'Kardemir (D)', last_price: 24.15, daily_change: 2.3 },
    { symbol: 'PGSUS.IS', name: 'Pegasus', last_price: 785.00, daily_change: 4.2 },
    { symbol: 'ASTOR.IS', name: 'Astor Enerji', last_price: 112.40, daily_change: 2.5 },
    { symbol: 'KONTR.IS', name: 'Kontrolmatik', last_price: 245.60, daily_change: 1.8 },
    { symbol: 'SMRTG.IS', name: 'Smart Güneş', last_price: 65.30, daily_change: -0.4 },
    { symbol: 'YEOTK.IS', name: 'Yeo Teknoloji', last_price: 215.00, daily_change: 3.1 },
    { symbol: 'ALARK.IS', name: 'Alarko Holding', last_price: 128.50, daily_change: 0.7 },
    { symbol: 'ENKAI.IS', name: 'Enka İnşaat', last_price: 38.40, daily_change: -0.2 },
    { symbol: 'TKFEN.IS', name: 'Tekfen Holding', last_price: 42.10, daily_change: 1.1 },
    { symbol: 'GUBRF.IS', name: 'Gübre Fabrikaları', last_price: 185.00, daily_change: -4.5 },
    { symbol: 'KOZAL.IS', name: 'Koza Altın', last_price: 22.40, daily_change: 0.3 },
    { symbol: 'KOZAA.IS', name: 'Koza Anadolu', last_price: 48.50, daily_change: 0.9 },
    { symbol: 'IPEKE.IS', name: 'İpek Enerji', last_price: 35.20, daily_change: 1.2 },
    { symbol: 'AEFES.IS', name: 'Anadolu Efes', last_price: 145.60, daily_change: 0.5 },
    { symbol: 'CCOLA.IS', name: 'Coca-Cola İçecek', last_price: 585.00, daily_change: 1.4 },
    { symbol: 'MGROS.IS', name: 'Migros', last_price: 425.00, daily_change: 0.8 },
    { symbol: 'SOKM.IS', name: 'Şok Marketler', last_price: 62.40, daily_change: -0.3 },
    { symbol: 'ULKER.IS', name: 'Ülker Bisküvi', last_price: 85.30, daily_change: 2.1 },
    { symbol: 'TATGD.IS', name: 'Tat Gıda', last_price: 32.40, daily_change: -1.2 },
    { symbol: 'KAYSE.IS', name: 'Kayseri Şeker', last_price: 38.50, daily_change: 0.4 },
    { symbol: 'MAVI.IS', name: 'Mavi Giyim', last_price: 142.00, daily_change: 1.7 },
    { symbol: 'VAKBN.IS', name: 'Vakıfbank', last_price: 14.50, daily_change: 0.6 },
    { symbol: 'HALKB.IS', name: 'Halkbank', last_price: 13.80, daily_change: 0.4 },
    { symbol: 'TSKB.IS', name: 'TSKB', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'SKBNK.IS', name: 'Şekerbank', last_price: 4.52, daily_change: 0.2 },
    { symbol: 'ALBRK.IS', name: 'Albaraka Türk', last_price: 3.85, daily_change: 0.5 },
    { symbol: 'QNBFB.IS', name: 'QNB Finansbank', last_price: 325.00, daily_change: 0.0 },
    { symbol: 'DOAS.IS', name: 'Doğuş Otomotiv', last_price: 285.00, daily_change: 2.4 },
    { symbol: 'OTKAR.IS', name: 'Otokar', last_price: 485.00, daily_change: 1.2 },
    { symbol: 'TMSN.IS', name: 'Tümosan', last_price: 95.40, daily_change: 3.5 },
    { symbol: 'ASUZU.IS', name: 'Anadolu Isuzu', last_price: 245.00, daily_change: 0.8 },
    { symbol: 'KORDS.IS', name: 'Kordsa', last_price: 88.50, daily_change: -0.4 },
    { symbol: 'BRISA.IS', name: 'Brisa', last_price: 92.30, daily_change: 1.1 },
    { symbol: 'GOZDE.IS', name: 'Gözde Girişim', last_price: 28.40, daily_change: 0.5 },
    { symbol: 'TKNSA.IS', name: 'Teknosa', last_price: 35.60, daily_change: 2.3 },
    { symbol: 'VESTL.IS', name: 'Vestel', last_price: 82.40, daily_change: 1.5 },
    { symbol: 'VESBE.IS', name: 'Vestel Beyaz Eşya', last_price: 18.50, daily_change: 0.9 },
    { symbol: 'KMPUR.IS', name: 'Kimteks Poliüretan', last_price: 72.40, daily_change: -1.2 },
    { symbol: 'EUPWR.IS', name: 'Europower Enerji', last_price: 165.00, daily_change: 2.8 },
    { symbol: 'CWENE.IS', name: 'CW Enerji', last_price: 285.00, daily_change: 1.4 },
    { symbol: 'ALFAS.IS', name: 'Alfa Solar', last_price: 92.50, daily_change: -2.1 },
    { symbol: 'GESAN.IS', name: 'Girişim Elektrik', last_price: 78.40, daily_change: 0.5 },
    { symbol: 'ZOREN.IS', name: 'Zorlu Enerji', last_price: 5.42, daily_change: 1.2 },
    { symbol: 'AKSEN.IS', name: 'Aksa Enerji', last_price: 38.50, daily_change: 0.8 },
    { symbol: 'ODAS.IS', name: 'Odaş Elektrik', last_price: 9.45, daily_change: -1.5 },
    { symbol: 'CANTE.IS', name: 'Çan2 Termik', last_price: 18.20, daily_change: -0.5 },
    { symbol: 'AYDEM.IS', name: 'Aydem Enerji', last_price: 22.40, daily_change: 1.1 },
    { symbol: 'GWIND.IS', name: 'Galata Wind', last_price: 25.60, daily_change: 0.7 },
    { symbol: 'HUNER.IS', name: 'Hun Enerji', last_price: 6.45, daily_change: 0.2 },
    { symbol: 'ENJSA.IS', name: 'Enerjisa', last_price: 58.40, daily_change: 1.4 },
    { symbol: 'DOHOL.IS', name: 'Doğan Holding', last_price: 12.85, daily_change: 0.5 },
    { symbol: 'AGHOL.IS', name: 'Anadolu Grubu Holding', last_price: 245.00, daily_change: 1.2 },
    { symbol: 'GSDHO.IS', name: 'GSD Holding', last_price: 4.12, daily_change: 0.8 },
    { symbol: 'GLYHO.IS', name: 'Global Yatırım Holding', last_price: 11.45, daily_change: 1.5 },
    { symbol: 'BERA.IS', name: 'Bera Holding', last_price: 15.60, daily_change: -0.4 },
    { symbol: 'INVEO.IS', name: 'Inveo Yatırım', last_price: 48.50, daily_change: 2.1 },
    { symbol: 'PENTA.IS', name: 'Penta Teknoloji', last_price: 18.40, daily_change: -3.5 },
    { symbol: 'MIATK.IS', name: 'Mia Teknoloji', last_price: 65.40, daily_change: 4.2 },
    { symbol: 'ARDYZ.IS', name: 'Ard Bilişim', last_price: 42.10, daily_change: 2.8 },
    { symbol: 'EDATA.IS', name: 'E-Data Teknoloji', last_price: 15.45, daily_change: 1.1 },
    { symbol: 'AZTEK.IS', name: 'Aztek Teknoloji', last_price: 115.00, daily_change: 0.5 },
    { symbol: 'LOGO.IS', name: 'Logo Yazılım', last_price: 85.40, daily_change: 1.2 },
    { symbol: 'INDES.IS', name: 'İndeks Bilgisayar', last_price: 8.45, daily_change: 0.7 },
    { symbol: 'ARENA.IS', name: 'Arena Bilgisayar', last_price: 32.40, daily_change: 1.4 },
    { symbol: 'DESPC.IS', name: 'Despec Bilgisayar', last_price: 35.60, daily_change: 0.9 },
    { symbol: 'DGATE.IS', name: 'Datagate Bilgisayar', last_price: 28.40, daily_change: 0.5 },
    { symbol: 'TCELL.IS', name: 'Turkcell', last_price: 68.40, daily_change: 1.1 },
    { symbol: 'TTKOM.IS', name: 'Türk Telekom', last_price: 32.50, daily_change: 0.8 },
    { symbol: 'NETAS.IS', name: 'Netaş', last_price: 145.00, daily_change: 3.4 },
    { symbol: 'ALCTL.IS', name: 'Alcatel Lucent Teletaş', last_price: 112.00, daily_change: 2.1 },
    { symbol: 'KRVGD.IS', name: 'Kervan Gıda', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'OYYAT.IS', name: 'Oyak Yatırım Ort.', last_price: 42.10, daily_change: 1.2 },
    { symbol: 'ISMEN.IS', name: 'İş Yatırım Menkul', last_price: 38.45, daily_change: 1.5 },
    { symbol: 'OSMEN.IS', name: 'Osmanlı Menkul', last_price: 245.00, daily_change: 2.4 },
    { symbol: 'INFO.IS', name: 'İnfo Yatırım', last_price: 14.50, daily_change: 0.8 },
    { symbol: 'GLBMD.IS', name: 'Global Menkul', last_price: 32.40, daily_change: 1.1 },
    { symbol: 'TAVHL.IS', name: 'TAV Havalimanları', last_price: 165.40, daily_change: 1.8 },
    { symbol: 'CLEBI.IS', name: 'Çelebi Hava Servisi', last_price: 1150.00, daily_change: 0.5 },
    { symbol: 'DOCO.IS', name: 'DO & CO', last_price: 4850.00, daily_change: 1.2 },
    { symbol: 'GSDDE.IS', name: 'GSD Denizcilik', last_price: 8.45, daily_change: 0.4 },
    { symbol: 'TURSG.IS', name: 'Türkiye Sigorta', last_price: 42.10, daily_change: 1.5 },
    { symbol: 'AKGRT.IS', name: 'Aksigorta', last_price: 6.45, daily_change: 0.8 },
    { symbol: 'ANHYT.IS', name: 'Anadolu Hayat Emeklilik', last_price: 48.50, daily_change: 1.1 },
    { symbol: 'AGESA.IS', name: 'Agesa Hayat Emeklilik', last_price: 72.40, daily_change: 0.5 },
    { symbol: 'QUAGR.IS', name: 'Qua Granite', last_price: 4.52, daily_change: -2.1 },
    { symbol: 'BIENY.IS', name: 'Bien Yapı Ürünleri', last_price: 45.60, daily_change: -1.2 },
    { symbol: 'EGEEN.IS', name: 'Ege Endüstri', last_price: 14500.00, daily_change: 2.4 },
    { symbol: 'BFREN.IS', name: 'Bosch Fren', last_price: 1150.00, daily_change: 1.5 },
    { symbol: 'JANTS.IS', name: 'Jantsa Jant Sanayi', last_price: 185.00, daily_change: 0.8 },
    { symbol: 'BRYAT.IS', name: 'Borusan Yatırım', last_price: 2450.00, daily_change: 3.1 },
    { symbol: 'BRSAN.IS', name: 'Borusan Boru', last_price: 585.00, daily_change: 2.4 },
    { symbol: 'KONYA.IS', name: 'Konya Çimento', last_price: 9850.00, daily_change: 1.2 },
    { symbol: 'KARTN.IS', name: 'Kartonsan', last_price: 115.00, daily_change: 0.5 },
    { symbol: 'ALCAR.IS', name: 'Alarko Carrier', last_price: 1250.00, daily_change: 1.4 },
    { symbol: 'PKENT.IS', name: 'Petrokent Turizm', last_price: 325.00, daily_change: 0.0 },
    { symbol: 'POLTK.IS', name: 'Politeknik Metal', last_price: 18500.00, daily_change: 2.1 },
    { symbol: 'SDTTR.IS', name: 'SDT Savunma', last_price: 385.00, daily_change: 4.5 },
    { symbol: 'ONCSM.IS', name: 'Oncosem Onkolojik', last_price: 145.00, daily_change: 1.2 },
    { symbol: 'SAYAS.IS', name: 'Say Yenilenebilir', last_price: 92.40, daily_change: 0.8 },
    { symbol: 'ALMAD.IS', name: 'Altınyağ Madencilik', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'IEYHO.IS', name: 'Işıklar Enerji', last_price: 3.12, daily_change: 0.5 },
    { symbol: 'NIBAS.IS', name: 'Niğbaş Niğde Beton', last_price: 15.40, daily_change: 0.8 },
    { symbol: 'CUSAN.IS', name: 'Çuhadaroğlu Metal', last_price: 22.10, daily_change: 1.2 },
    { symbol: 'PRKME.IS', name: 'Park Elek.Madencilik', last_price: 25.40, daily_change: 0.9 },
    { symbol: 'KENT.IS', name: 'Kent Gıda', last_price: 850.00, daily_change: 0.5 },
    { symbol: 'PNSUT.IS', name: 'Pınar Süt', last_price: 85.40, daily_change: 1.2 },
    { symbol: 'PETUN.IS', name: 'Pınar Et ve Un', last_price: 72.30, daily_change: 0.8 },
    { symbol: 'BANVT.IS', name: 'Banvit', last_price: 145.00, daily_change: 2.1 },
    { symbol: 'KNFRT.IS', name: 'Konfrut Gıda', last_price: 18.40, daily_change: 0.5 },
    { symbol: 'SELGD.IS', name: 'Selçuk Gıda', last_price: 12.45, daily_change: 1.1 },
    { symbol: 'MERKO.IS', name: 'Merko Gıda', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'AVOD.IS', name: 'A.V.O.D. Gıda ve Tarım', last_price: 4.12, daily_change: 0.5 },
    { symbol: 'FRIGO.IS', name: 'Frigo-Pak Gıda', last_price: 9.45, daily_change: 1.2 },
    { symbol: 'KEREV.IS', name: 'Kerevitaş Gıda', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'KRSTL.IS', name: 'Kristal Kola', last_price: 11.45, daily_change: 0.5 },
    { symbol: 'PINSU.IS', name: 'Pınar Su', last_price: 14.50, daily_change: 1.1 },
    { symbol: 'DARDL.IS', name: 'Dardanel Önentaş', last_price: 6.45, daily_change: 0.8 },
    { symbol: 'TUKAS.IS', name: 'Tukaş Gıda', last_price: 12.85, daily_change: 0.5 },
    { symbol: 'YAYLA.IS', name: 'Yayla Agro Gıda', last_price: 18.40, daily_change: 1.2 },
    { symbol: 'GOKNR.IS', name: 'Göknur Gıda', last_price: 25.60, daily_change: 0.8 },
    { symbol: 'OBAMS.IS', name: 'Oba Makarnacılık', last_price: 42.10, daily_change: 1.5 },
    { symbol: 'SOKE.IS', name: 'Söke Değirmencilik', last_price: 15.45, daily_change: 0.8 },
    { symbol: 'EKSUN.IS', name: 'Eksun Gıda', last_price: 72.40, daily_change: 1.1 },
    { symbol: 'BYDNR.IS', name: 'Baydöner Restoranları', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'TABGD.IS', name: 'TAB Gıda', last_price: 145.00, daily_change: 1.2 },
    { symbol: 'BIGCH.IS', name: 'BigChefs', last_price: 28.40, daily_change: 0.8 },
    { symbol: 'AKFGY.IS', name: 'Akfen GYO', last_price: 2.45, daily_change: 0.5 },
    { symbol: 'EKGYO.IS', name: 'Emlak Konut GYO', last_price: 10.45, daily_change: 1.2 },
    { symbol: 'TRGYO.IS', name: 'Torunlar GYO', last_price: 32.40, daily_change: 0.8 },
    { symbol: 'SNGYO.IS', name: 'Sinpaş GYO', last_price: 3.12, daily_change: 0.5 },
    { symbol: 'OZKGY.IS', name: 'Özak GYO', last_price: 9.45, daily_change: 1.1 },
    { symbol: 'ASGYO.IS', name: 'Asce GYO', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'KGYO.IS', name: 'Koray GYO', last_price: 42.10, daily_change: 1.5 },
    { symbol: 'PEKGY.IS', name: 'Peker GYO', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'MSGYO.IS', name: 'Mistral GYO', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'VKGYO.IS', name: 'Vakıf GYO', last_price: 3.85, daily_change: 0.5 },
    { symbol: 'HLGYO.IS', name: 'Halk GYO', last_price: 4.12, daily_change: 0.8 },
    { symbol: 'ISGYO.IS', name: 'İş GYO', last_price: 18.40, daily_change: 1.2 },
    { symbol: 'TSGYO.IS', name: 'TSGYO', last_price: 6.45, daily_change: 0.5 },
    { symbol: 'KLGYO.IS', name: 'Kiler GYO', last_price: 3.45, daily_change: 1.1 },
    { symbol: 'ALGYO.IS', name: 'Alarko GYO', last_price: 45.60, daily_change: 0.8 },
    { symbol: 'RYGYO.IS', name: 'Reysaş GYO', last_price: 28.40, daily_change: 1.5 },
    { symbol: 'MHRGY.IS', name: 'Maher GYO', last_price: 5.42, daily_change: 0.5 },
    { symbol: 'SURGY.IS', name: 'Sur Tatil Evleri GYO', last_price: 48.50, daily_change: 1.2 },
    { symbol: 'AVPGY.IS', name: 'Avrupakent GYO', last_price: 52.40, daily_change: 0.8 },
    { symbol: 'BEGYO.IS', name: 'Batı Ege GYO', last_price: 3.12, daily_change: 0.5 },
    { symbol: 'PAGYO.IS', name: 'Panora GYO', last_price: 35.60, daily_change: 1.1 },
    { symbol: 'YGGYO.IS', name: 'Yeni Gimat GYO', last_price: 62.40, daily_change: 0.8 },
    { symbol: 'IDGYO.IS', name: 'İdealist GYO', last_price: 8.45, daily_change: 1.5 },
    { symbol: 'TDGYO.IS', name: 'Trend GYO', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'DZGYO.IS', name: 'Deniz GYO', last_price: 4.52, daily_change: 1.1 },
    { symbol: 'KZGYO.IS', name: 'Kuzey Gayrimenkul', last_price: 22.10, daily_change: 0.8 },
    { symbol: 'MRGYO.IS', name: 'Martı GYO', last_price: 5.85, daily_change: 0.5 },
    { symbol: 'SASA.IS', name: 'Sasa Polyester', last_price: 38.40, daily_change: -1.2 },
    { symbol: 'HEKTS.IS', name: 'Hektaş', last_price: 15.20, daily_change: -2.5 },
    { symbol: 'KRDMD.IS', name: 'Kardemir (D)', last_price: 24.50, daily_change: 1.8 },
    { symbol: 'PETKM.IS', name: 'Petkim', last_price: 21.40, daily_change: -0.5 },
    { symbol: 'ALARK.IS', name: 'Alarko Holding', last_price: 128.50, daily_change: 0.7 },
    { symbol: 'ENKAI.IS', name: 'Enka İnşaat', last_price: 38.40, daily_change: -0.2 },
    { symbol: 'TKFEN.IS', name: 'Tekfen Holding', last_price: 42.10, daily_change: 1.1 },
    { symbol: 'GUBRF.IS', name: 'Gübre Fabrikaları', last_price: 185.00, daily_change: -4.5 },
    { symbol: 'KOZAL.IS', name: 'Koza Altın', last_price: 22.40, daily_change: 0.3 },
    { symbol: 'KOZAA.IS', name: 'Koza Anadolu', last_price: 48.50, daily_change: 0.9 },
    { symbol: 'IPEKE.IS', name: 'İpek Enerji', last_price: 35.20, daily_change: 1.2 },
    { symbol: 'OTKAR.IS', name: 'Otokar', last_price: 485.00, daily_change: 1.2 },
    { symbol: 'TMSN.IS', name: 'Tümosan', last_price: 95.40, daily_change: 3.5 },
    { symbol: 'ASUZU.IS', name: 'Anadolu Isuzu', last_price: 245.00, daily_change: 0.8 },
    { symbol: 'KORDS.IS', name: 'Kordsa', last_price: 88.50, daily_change: -0.4 },
    { symbol: 'BRISA.IS', name: 'Brisa', last_price: 92.30, daily_change: 1.1 },
    { symbol: 'VESTL.IS', name: 'Vestel', last_price: 82.40, daily_change: 1.5 },
    { symbol: 'VESBE.IS', name: 'Vestel Beyaz Eşya', last_price: 18.50, daily_change: 0.9 },
    { symbol: 'TCELL.IS', name: 'Turkcell', last_price: 68.40, daily_change: 1.1 },
    { symbol: 'TTKOM.IS', name: 'Türk Telekom', last_price: 32.50, daily_change: 0.8 },
    { symbol: 'AEFES.IS', name: 'Anadolu Efes', last_price: 145.60, daily_change: 0.5 },
    { symbol: 'CCOLA.IS', name: 'Coca-Cola İçecek', last_price: 585.00, daily_change: 1.4 },
    { symbol: 'MGROS.IS', name: 'Migros', last_price: 425.00, daily_change: 0.8 },
    { symbol: 'SOKM.IS', name: 'Şok Marketler', last_price: 62.40, daily_change: -0.3 },
    { symbol: 'BIMAS.IS', name: 'BİM Mağazalar', last_price: 385.00, daily_change: -0.3 },
    { symbol: 'ULKER.IS', name: 'Ülker Bisküvi', last_price: 85.30, daily_change: 2.1 },
    { symbol: 'MAVI.IS', name: 'Mavi Giyim', last_price: 142.00, daily_change: 1.7 },
    { symbol: 'VAKBN.IS', name: 'Vakıfbank', last_price: 14.50, daily_change: 0.6 },
    { symbol: 'HALKB.IS', name: 'Halkbank', last_price: 13.80, daily_change: 0.4 },
    { symbol: 'TSKB.IS', name: 'TSKB', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'SKBNK.IS', name: 'Şekerbank', last_price: 4.52, daily_change: 0.2 },
    { symbol: 'ALBRK.IS', name: 'Albaraka Türk', last_price: 3.85, daily_change: 0.5 },
    { symbol: 'DOAS.IS', name: 'Doğuş Otomotiv', last_price: 285.00, daily_change: 2.4 },
    { symbol: 'TAVHL.IS', name: 'TAV Havalimanları', last_price: 165.40, daily_change: 1.8 },
    { symbol: 'PGSUS.IS', name: 'Pegasus', last_price: 785.00, daily_change: 4.2 },
    { symbol: 'THYAO.IS', name: 'Türk Hava Yolları', last_price: 285.50, daily_change: 1.2 },
    { symbol: 'EREGL.IS', name: 'Erdemir', last_price: 45.20, daily_change: -0.5 },
    { symbol: 'ASELS.IS', name: 'Aselsan', last_price: 58.75, daily_change: 2.1 },
    { symbol: 'KCHOL.IS', name: 'Koç Holding', last_price: 165.40, daily_change: 0.8 },
    { symbol: 'SAHOL.IS', name: 'Sabancı Holding', last_price: 78.40, daily_change: 0.4 },
    { symbol: 'SISE.IS', name: 'Şişecam', last_price: 48.12, daily_change: -1.1 },
    { symbol: 'TUPRS.IS', name: 'Tüpraş', last_price: 155.30, daily_change: 3.4 },
    { symbol: 'AKBNK.IS', name: 'Akbank', last_price: 38.45, daily_change: 0.2 },
    { symbol: 'GARAN.IS', name: 'Garanti BBVA', last_price: 62.10, daily_change: 1.5 },
    { symbol: 'YKBNK.IS', name: 'Yapı Kredi Bankası', last_price: 22.10, daily_change: 1.2 },
    { symbol: 'ISCTR.IS', name: 'İş Bankası (C)', last_price: 25.40, daily_change: 0.9 },
    { symbol: 'ASTOR.IS', name: 'Astor Enerji', last_price: 112.40, daily_change: 2.5 },
    { symbol: 'KONTR.IS', name: 'Kontrolmatik', last_price: 245.60, daily_change: 1.8 },
    { symbol: 'SMRTG.IS', name: 'Smart Güneş', last_price: 65.30, daily_change: -0.4 },
    { symbol: 'YEOTK.IS', name: 'Yeo Teknoloji', last_price: 215.00, daily_change: 3.1 },
    { symbol: 'EUPWR.IS', name: 'Europower Enerji', last_price: 165.00, daily_change: 2.8 },
    { symbol: 'CWENE.IS', name: 'CW Enerji', last_price: 285.00, daily_change: 1.4 },
    { symbol: 'ALFAS.IS', name: 'Alfa Solar', last_price: 92.50, daily_change: -2.1 },
    { symbol: 'GESAN.IS', name: 'Girişim Elektrik', last_price: 78.40, daily_change: 0.5 },
    { symbol: 'ZOREN.IS', name: 'Zorlu Enerji', last_price: 5.42, daily_change: 1.2 },
    { symbol: 'AKSEN.IS', name: 'Aksa Enerji', last_price: 38.50, daily_change: 0.8 },
    { symbol: 'ODAS.IS', name: 'Odaş Elektrik', last_price: 9.45, daily_change: -1.5 },
    { symbol: 'CANTE.IS', name: 'Çan2 Termik', last_price: 18.20, daily_change: -0.5 },
    { symbol: 'AYDEM.IS', name: 'Aydem Enerji', last_price: 22.40, daily_change: 1.1 },
    { symbol: 'GWIND.IS', name: 'Galata Wind', last_price: 25.60, daily_change: 0.7 },
    { symbol: 'ENJSA.IS', name: 'Enerjisa', last_price: 58.40, daily_change: 1.4 },
    { symbol: 'DOHOL.IS', name: 'Doğan Holding', last_price: 12.85, daily_change: 0.5 },
    { symbol: 'AGHOL.IS', name: 'Anadolu Grubu Holding', last_price: 245.00, daily_change: 1.2 },
    { symbol: 'GSDHO.IS', name: 'GSD Holding', last_price: 4.12, daily_change: 0.8 },
    { symbol: 'GLYHO.IS', name: 'Global Yatırım Holding', last_price: 11.45, daily_change: 1.5 },
    { symbol: 'BERA.IS', name: 'Bera Holding', last_price: 15.60, daily_change: -0.4 },
    { symbol: 'INVEO.IS', name: 'Inveo Yatırım', last_price: 48.50, daily_change: 2.1 },
    { symbol: 'MIATK.IS', name: 'Mia Teknoloji', last_price: 65.40, daily_change: 4.2 },
    { symbol: 'ARDYZ.IS', name: 'Ard Bilişim', last_price: 42.10, daily_change: 2.8 },
    { symbol: 'LOGO.IS', name: 'Logo Yazılım', last_price: 85.40, daily_change: 1.2 },
    { symbol: 'INDES.IS', name: 'İndeks Bilgisayar', last_price: 8.45, daily_change: 0.7 },
    { symbol: 'ARENA.IS', name: 'Arena Bilgisayar', last_price: 32.40, daily_change: 1.4 },
    { symbol: 'NETAS.IS', name: 'Netaş', last_price: 145.00, daily_change: 3.4 },
    { symbol: 'ALCTL.IS', name: 'Alcatel Lucent Teletaş', last_price: 112.00, daily_change: 2.1 },
    { symbol: 'KRVGD.IS', name: 'Kervan Gıda', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'ISMEN.IS', name: 'İş Yatırım Menkul', last_price: 38.45, daily_change: 1.5 },
    { symbol: 'OSMEN.IS', name: 'Osmanlı Menkul', last_price: 245.00, daily_change: 2.4 },
    { symbol: 'INFO.IS', name: 'İnfo Yatırım', last_price: 14.50, daily_change: 0.8 },
    { symbol: 'TURSG.IS', name: 'Türkiye Sigorta', last_price: 42.10, daily_change: 1.5 },
    { symbol: 'AKGRT.IS', name: 'Aksigorta', last_price: 6.45, daily_change: 0.8 },
    { symbol: 'ANHYT.IS', name: 'Anadolu Hayat Emeklilik', last_price: 48.50, daily_change: 1.1 },
    { symbol: 'AGESA.IS', name: 'Agesa Hayat Emeklilik', last_price: 72.40, daily_change: 0.5 },
    { symbol: 'QUAGR.IS', name: 'Qua Granite', last_price: 4.52, daily_change: -2.1 },
    { symbol: 'BIENY.IS', name: 'Bien Yapı Ürünleri', last_price: 45.60, daily_change: -1.2 },
    { symbol: 'EGEEN.IS', name: 'Ege Endüstri', last_price: 14500.00, daily_change: 2.4 },
    { symbol: 'BFREN.IS', name: 'Bosch Fren', last_price: 1150.00, daily_change: 1.5 },
    { symbol: 'JANTS.IS', name: 'Jantsa Jant Sanayi', last_price: 185.00, daily_change: 0.8 },
    { symbol: 'BRYAT.IS', name: 'Borusan Yatırım', last_price: 2450.00, daily_change: 3.1 },
    { symbol: 'BRSAN.IS', name: 'Borusan Boru', last_price: 585.00, daily_change: 2.4 },
    { symbol: 'KONYA.IS', name: 'Konya Çimento', last_price: 9850.00, daily_change: 1.2 },
    { symbol: 'KARTN.IS', name: 'Kartonsan', last_price: 115.00, daily_change: 0.5 },
    { symbol: 'ALCAR.IS', name: 'Alarko Carrier', last_price: 1250.00, daily_change: 1.4 },
    { symbol: 'SDTTR.IS', name: 'SDT Savunma', last_price: 385.00, daily_change: 4.5 },
    { symbol: 'ONCSM.IS', name: 'Oncosem Onkolojik', last_price: 145.00, daily_change: 1.2 },
    { symbol: 'SAYAS.IS', name: 'Say Yenilenebilir', last_price: 92.40, daily_change: 0.8 },
    { symbol: 'PNSUT.IS', name: 'Pınar Süt', last_price: 85.40, daily_change: 1.2 },
    { symbol: 'PETUN.IS', name: 'Pınar Et ve Un', last_price: 72.30, daily_change: 0.8 },
    { symbol: 'BANVT.IS', name: 'Banvit', last_price: 145.00, daily_change: 2.1 },
    { symbol: 'KNFRT.IS', name: 'Konfrut Gıda', last_price: 18.40, daily_change: 0.5 },
    { symbol: 'KEREV.IS', name: 'Kerevitaş Gıda', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'PINSU.IS', name: 'Pınar Su', last_price: 14.50, daily_change: 1.1 },
    { symbol: 'TUKAS.IS', name: 'Tukaş Gıda', last_price: 12.85, daily_change: 0.5 },
    { symbol: 'YAYLA.IS', name: 'Yayla Agro Gıda', last_price: 18.40, daily_change: 1.2 },
    { symbol: 'GOKNR.IS', name: 'Göknur Gıda', last_price: 25.60, daily_change: 0.8 },
    { symbol: 'OBAMS.IS', name: 'Oba Makarnacılık', last_price: 42.10, daily_change: 1.5 },
    { symbol: 'SOKE.IS', name: 'Söke Değirmencilik', last_price: 15.45, daily_change: 0.8 },
    { symbol: 'EKSUN.IS', name: 'Eksun Gıda', last_price: 72.40, daily_change: 1.1 },
    { symbol: 'TABGD.IS', name: 'TAB Gıda', last_price: 145.00, daily_change: 1.2 },
    { symbol: 'EKGYO.IS', name: 'Emlak Konut GYO', last_price: 10.45, daily_change: 1.2 },
    { symbol: 'TRGYO.IS', name: 'Torunlar GYO', last_price: 32.40, daily_change: 0.8 },
    { symbol: 'SNGYO.IS', name: 'Sinpaş GYO', last_price: 3.12, daily_change: 0.5 },
    { symbol: 'OZKGY.IS', name: 'Özak GYO', last_price: 9.45, daily_change: 1.1 },
    { symbol: 'ASGYO.IS', name: 'Asce GYO', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'ISGYO.IS', name: 'İş GYO', last_price: 18.40, daily_change: 1.2 },
    { symbol: 'ALGYO.IS', name: 'Alarko GYO', last_price: 45.60, daily_change: 0.8 },
    { symbol: 'RYGYO.IS', name: 'Reysaş GYO', last_price: 28.40, daily_change: 1.5 },
    { symbol: 'SURGY.IS', name: 'Sur Tatil Evleri GYO', last_price: 48.50, daily_change: 1.2 },
    { symbol: 'AVPGY.IS', name: 'Avrupakent GYO', last_price: 52.40, daily_change: 0.8 },
    { symbol: 'YGGYO.IS', name: 'Yeni Gimat GYO', last_price: 62.40, daily_change: 0.8 },
    { symbol: 'KZGYO.IS', name: 'Kuzey Gayrimenkul', last_price: 22.10, daily_change: 0.8 },
    { symbol: 'MRGYO.IS', name: 'Martı GYO', last_price: 5.85, daily_change: 0.5 },
    { symbol: 'AGROT.IS', name: 'Agrotech Teknoloji', last_price: 15.40, daily_change: 2.1 },
    { symbol: 'AHGAZ.IS', name: 'Ahlatcı Doğal Gaz', last_price: 12.45, daily_change: 0.8 },
    { symbol: 'AKFYE.IS', name: 'Akfen Yenilenebilir Enerji', last_price: 22.10, daily_change: 1.5 },
    { symbol: 'AKSUE.IS', name: 'Aksu Enerji', last_price: 45.60, daily_change: 0.5 },
    { symbol: 'ALKIM.IS', name: 'Alkim Kimya', last_price: 38.40, daily_change: 1.2 },
    { symbol: 'ANGEN.IS', name: 'Anatolia Tanı ve Biyoteknoloji', last_price: 12.85, daily_change: 0.8 },
    { symbol: 'ARCLK.IS', name: 'Arçelik', last_price: 165.40, daily_change: 1.1 },
    { symbol: 'ATAKP.IS', name: 'Atakey Patates', last_price: 48.50, daily_change: 0.5 },
    { symbol: 'ATEKS.IS', name: 'Akın Tekstil', last_price: 145.00, daily_change: 1.2 },
    { symbol: 'AVHOL.IS', name: 'Avrupa Yatırım Holding', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'AYCES.IS', name: 'Altınyunus Çeşme', last_price: 585.00, daily_change: 0.5 },
    { symbol: 'AYEN.IS', name: 'Ayen Enerji', last_price: 32.40, daily_change: 1.1 },
    { symbol: 'AZTEK.IS', name: 'Aztek Teknoloji', last_price: 72.40, daily_change: 1.5 },
    { symbol: 'BAGFS.IS', name: 'Bağfaş', last_price: 25.60, daily_change: 0.8 },
    { symbol: 'BAKAB.IS', name: 'Bak Ambalaj', last_price: 112.00, daily_change: 1.2 },
    { symbol: 'BALAT.IS', name: 'Balatacılar Balatacı', last_price: 18.40, daily_change: 0.5 },
    { symbol: 'BARMA.IS', name: 'Barem Ambalaj', last_price: 22.10, daily_change: 1.1 },
    { symbol: 'BASGZ.IS', name: 'Başkent Doğalgaz', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'BAYRK.IS', name: 'Bayrak EBT Taban', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'BEYAZ.IS', name: 'Beyaz Filo', last_price: 35.60, daily_change: 1.2 },
    { symbol: 'BINHO.IS', name: 'Bin Yatırım Holding', last_price: 425.00, daily_change: 2.1 },
    { symbol: 'BIOEN.IS', name: 'Biotrend Enerji', last_price: 18.40, daily_change: 0.8 },
    { symbol: 'BOBET.IS', name: 'Boğaziçi Beton', last_price: 25.40, daily_change: 1.1 },
    { symbol: 'BORLS.IS', name: 'Borlease Otomotiv', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'BOSSA.IS', name: 'Bossa', last_price: 12.85, daily_change: 0.8 },
    { symbol: 'BRKO.IS', name: 'Birko Birleşik Koyunlulular', last_price: 4.52, daily_change: 0.5 },
    { symbol: 'BRKSN.IS', name: 'Berikosan Yalıtım', last_price: 15.40, daily_change: 1.2 },
    { symbol: 'BRMEN.IS', name: 'Birlik Mensucat', last_price: 6.45, daily_change: 0.8 },
    { symbol: 'BUCIM.IS', name: 'Bursa Çimento', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'BURCE.IS', name: 'Burçelik', last_price: 145.00, daily_change: 2.1 },
    { symbol: 'BURVA.IS', name: 'Burçelik Vana', last_price: 112.00, daily_change: 1.5 },
    { symbol: 'BVSAN.IS', name: 'Bülbüloğlu Vinç', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'CANTE.IS', name: 'Çan2 Termik', last_price: 18.20, daily_change: -0.5 },
    { symbol: 'CASA.IS', name: 'Casa Emtia Petrol', last_price: 125.00, daily_change: 0.5 },
    { symbol: 'CELHA.IS', name: 'Çelik Halat', last_price: 45.60, daily_change: 1.2 },
    { symbol: 'CEMAS.IS', name: 'Çemaş Döküm', last_price: 4.12, daily_change: 0.8 },
    { symbol: 'CEMTS.IS', name: 'Çemtaş', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'CEOEM.IS', name: 'CEO Event Medya', last_price: 18.40, daily_change: 1.1 },
    { symbol: 'CIMSA.IS', name: 'Çimsa', last_price: 32.40, daily_change: 0.8 },
    { symbol: 'CLEBI.IS', name: 'Çelebi', last_price: 1250.00, daily_change: 1.5 },
    { symbol: 'CMBTN.IS', name: 'Çimbeton', last_price: 3250.00, daily_change: 2.1 },
    { symbol: 'CMENT.IS', name: 'Çimentaş', last_price: 425.00, daily_change: 0.5 },
    { symbol: 'CONSE.IS', name: 'Consus Enerji', last_price: 6.45, daily_change: 0.8 },
    { symbol: 'COSMO.IS', name: 'Cosmos Yatırım Holding', last_price: 112.00, daily_change: 1.2 },
    { symbol: 'CRDFA.IS', name: 'Creditwest Faktoring', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'CVKMD.IS', name: 'CVK Maden', last_price: 425.00, daily_change: 3.1 },
    { symbol: 'DAGHL.IS', name: 'Dağ Mühendislik', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'DAGI.IS', name: 'Dagi Giyim', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'DAPGM.IS', name: 'Dap Gayrimenkul', last_price: 35.60, daily_change: 1.1 },
    { symbol: 'DERHL.IS', name: 'Derlüks Yatırım Holding', last_price: 18.40, daily_change: 0.8 },
    { symbol: 'DERIM.IS', name: 'Derimod', last_price: 42.10, daily_change: 0.5 },
    { symbol: 'DESA.IS', name: 'Desa Deri', last_price: 22.10, daily_change: 1.2 },
    { symbol: 'DESPC.IS', name: 'Despec Bilgisayar', last_price: 32.40, daily_change: 0.8 },
    { symbol: 'DEVA.IS', name: 'Deva Holding', last_price: 85.40, daily_change: 1.1 },
    { symbol: 'DGGYO.IS', name: 'Doğuş GYO', last_price: 45.60, daily_change: 0.5 },
    { symbol: 'DGNMO.IS', name: 'Doğanlar Mobilya', last_price: 12.85, daily_change: 0.8 },
    { symbol: 'DIRIT.IS', name: 'Diriliş Tekstil', last_price: 4.52, daily_change: 0.5 },
    { symbol: 'DITAS.IS', name: 'Ditaş Doğan', last_price: 35.60, daily_change: 1.2 },
    { symbol: 'DMSAS.IS', name: 'Demsaş Döküm', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'DNISI.IS', name: 'Dinamik Isı', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'DOBUR.IS', name: 'Doğan Burda', last_price: 112.00, daily_change: 1.1 },
    { symbol: 'DOCO.IS', name: 'DO & CO', last_price: 5850.00, daily_change: 2.1 },
    { symbol: 'DOGUB.IS', name: 'Doğusan', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'DOKTA.IS', name: 'Döktaş Dökümcülük', last_price: 72.40, daily_change: 0.5 },
    { symbol: 'DURDO.IS', name: 'Duran Doğan Basım', last_price: 42.10, daily_change: 1.2 },
    { symbol: 'DYOBY.IS', name: 'Dyo Boya', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'EDATA.IS', name: 'E-Data Teknoloji', last_price: 18.40, daily_change: 0.5 },
    { symbol: 'EDIP.IS', name: 'Edip Gayrimenkul', last_price: 12.45, daily_change: 1.1 },
    { symbol: 'EGEPO.IS', name: 'Egepol Hastanesi', last_price: 22.10, daily_change: 0.8 },
    { symbol: 'EGGUB.IS', name: 'Ege Gübre', last_price: 65.40, daily_change: 1.2 },
    { symbol: 'EGPRO.IS', name: 'Ege Profil', last_price: 185.00, daily_change: 0.5 },
    { symbol: 'EGSER.IS', name: 'Ege Seramik', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'EKIZ.IS', name: 'Ekiz Kimya', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'ELITE.IS', name: 'Elite Naturel', last_price: 45.60, daily_change: 1.1 },
    { symbol: 'EMKEL.IS', name: 'Emek Elektrik', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'EMNIS.IS', name: 'Eminiş Ambalaj', last_price: 112.00, daily_change: 1.2 },
    { symbol: 'ENERY.IS', name: 'Enerya Enerji', last_price: 145.00, daily_change: 0.5 },
    { symbol: 'ENSRI.IS', name: 'Ensari Deri', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'EPLAS.IS', name: 'Egeplast', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'ERCB.IS', name: 'Erciyas Çelik Boru', last_price: 185.00, daily_change: 1.1 },
    { symbol: 'ERSU.IS', name: 'Ersu Meyve Suları', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'ESCAR.IS', name: 'Escar Filo', last_price: 165.00, daily_change: 1.2 },
    { symbol: 'ESCOM.IS', name: 'Escort Teknoloji', last_price: 42.10, daily_change: 0.5 },
    { symbol: 'ESEN.IS', name: 'Esenboğa Elektrik', last_price: 22.10, daily_change: 0.8 },
    { symbol: 'ETILR.IS', name: 'Etiler Gıda', last_price: 15.60, daily_change: 1.1 },
    { symbol: 'EUHOL.IS', name: 'Euro Yatırım Holding', last_price: 4.12, daily_change: 0.5 },
    { symbol: 'EYGYO.IS', name: 'EYG GYO', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'FADE.IS', name: 'Fade Gıda', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'FENER.IS', name: 'Fenerbahçe Futbol', last_price: 112.00, daily_change: 1.2 },
    { symbol: 'FLAP.IS', name: 'Flap Kongre Toplantı', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'FMIZP.IS', name: 'Federal-Mogul İzmit Piston', last_price: 245.00, daily_change: 0.5 },
    { symbol: 'FONET.IS', name: 'Fonet Bilgi Teknolojileri', last_price: 32.40, daily_change: 1.1 },
    { symbol: 'FORMT.IS', name: 'Formet Metal ve Cam', last_price: 4.52, daily_change: 0.8 },
    { symbol: 'FORTE.IS', name: 'Forte Bilgi Teknolojileri', last_price: 85.40, daily_change: 2.1 },
    { symbol: 'FROTO.IS', name: 'Ford Otosan', last_price: 985.00, daily_change: 1.5 },
    { symbol: 'FZLGY.IS', name: 'Fuzul GYO', last_price: 18.40, daily_change: 0.8 },
    { symbol: 'GEDIK.IS', name: 'Gedik Yatırım', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'GEDZA.IS', name: 'Gediz Ambalaj', last_price: 25.40, daily_change: 1.1 },
    { symbol: 'GENIL.IS', name: 'Gen İlaç', last_price: 72.40, daily_change: 0.8 },
    { symbol: 'GEREL.IS', name: 'Gersan Elektrik', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'GIPTA.IS', name: 'Gıpta Ofis Kırtasiye', last_price: 35.60, daily_change: 1.2 },
    { symbol: 'GLBMD.IS', name: 'Global Menkul Değerler', last_price: 42.10, daily_change: 0.8 },
    { symbol: 'GLCVY.IS', name: 'Gelecek Varlık Yönetimi', last_price: 45.60, daily_change: 0.5 },
    { symbol: 'GLRYH.IS', name: 'Güler Yatırım Holding', last_price: 12.85, daily_change: 1.1 },
    { symbol: 'GMTAS.IS', name: 'Gimat Mağazacılık', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'GOLTS.IS', name: 'Göltaş Çimento', last_price: 385.00, daily_change: 1.2 },
    { symbol: 'GOODY.IS', name: 'Good-Year', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'GOZDE.IS', name: 'Gözde Girişim', last_price: 32.40, daily_change: 1.1 },
    { symbol: 'GRNYO.IS', name: 'Garanti Yatırım Ortaklığı', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'GRSEL.IS', name: 'Gür-Sel Turizm', last_price: 72.40, daily_change: 1.5 },
    { symbol: 'GSDDE.IS', name: 'GSD Denizcilik', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'GSRAY.IS', name: 'Galatasaray Sportif', last_price: 10.45, daily_change: 1.2 },
    { symbol: 'GZNMI.IS', name: 'Gezinomi Seyahat', last_price: 22.10, daily_change: 0.8 },
    { symbol: 'HATEK.IS', name: 'Hateks Hatay Tekstil', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'HATSN.IS', name: 'Hatsan Gemi İnşa', last_price: 72.40, daily_change: 1.1 },
    { symbol: 'HDFGS.IS', name: 'Hedef Girişim', last_price: 3.12, daily_change: 0.8 },
    { symbol: 'HEDEF.IS', name: 'Hedef Holding', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'HKTM.IS', name: 'Hidropar Hareket Kontrol', last_price: 65.40, daily_change: 1.2 },
    { symbol: 'HLGYO.IS', name: 'Halk GYO', last_price: 4.12, daily_change: 0.8 },
    { symbol: 'HTTBT.IS', name: 'Hitit Bilgisayar', last_price: 85.40, daily_change: 1.5 },
    { symbol: 'HUBVC.IS', name: 'Hub Girişim', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'HUNER.IS', name: 'Hun Enerji', last_price: 6.45, daily_change: 1.1 },
    { symbol: 'HURGZ.IS', name: 'Hürriyet Gzt.', last_price: 5.42, daily_change: 0.8 },
    { symbol: 'ICBCT.IS', name: 'ICBC Turkey Bank', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'IDEAS.IS', name: 'İdeal Finansal Teknolojiler', last_price: 112.00, daily_change: 1.2 },
    { symbol: 'IDGYO.IS', name: 'İdealist GYO', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'IHEVA.IS', name: 'İhlas Ev Aletleri', last_price: 3.12, daily_change: 0.5 },
    { symbol: 'IHLGM.IS', name: 'İhlas Gayrimenkul', last_price: 2.45, daily_change: 0.8 },
    { symbol: 'IHLAS.IS', name: 'İhlas Holding', last_price: 1.85, daily_change: 0.5 },
    { symbol: 'IHYAY.IS', name: 'İhlas Yayın Holding', last_price: 2.12, daily_change: 1.1 },
    { symbol: 'IMASM.IS', name: 'İmaş Makina', last_price: 18.40, daily_change: 0.8 },
    { symbol: 'INGRM.IS', name: 'Ingram Micro Bilişim', last_price: 585.00, daily_change: 2.1 },
    { symbol: 'INTEM.IS', name: 'İntema', last_price: 325.00, daily_change: 0.5 },
    { symbol: 'INVEO.IS', name: 'Inveo Yatırım', last_price: 48.50, daily_change: 1.2 },
    { symbol: 'INVES.IS', name: 'Investco Holding', last_price: 325.00, daily_change: 0.8 },
    { symbol: 'ISATR.IS', name: 'İş Bankası (A)', last_price: 1500000.00, daily_change: 0.0 },
    { symbol: 'ISBTR.IS', name: 'İş Bankası (B)', last_price: 450000.00, daily_change: 0.0 },
    { symbol: 'ISCUR.IS', name: 'İş Bankası (Kurucu)', last_price: 1250000.00, daily_change: 0.0 },
    { symbol: 'ISDMR.IS', name: 'İskenderun Demir Çelik', last_price: 38.40, daily_change: 0.5 },
    { symbol: 'ISFIN.IS', name: 'İş Finansal Kiralama', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'ISGSY.IS', name: 'İş Girişim', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'ISKPL.IS', name: 'Işık Plastik', last_price: 12.45, daily_change: 1.1 },
    { symbol: 'ISMEN.IS', name: 'İş Yatırım Menkul', last_price: 38.45, daily_change: 1.5 },
    { symbol: 'ISSEN.IS', name: 'İşbir Sentetik', last_price: 18.40, daily_change: 0.8 },
    { symbol: 'IZENR.IS', name: 'İzdemir Enerji', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'IZFAS.IS', name: 'İzmir Fırça', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'IZMDC.IS', name: 'İzmir Demir Çelik', last_price: 7.42, daily_change: 0.8 },
    { symbol: 'JANTS.IS', name: 'Jantsa Jant Sanayi', last_price: 185.00, daily_change: 0.5 },
    { symbol: 'KAPLM.IS', name: 'Kaplamin', last_price: 112.00, daily_change: 1.2 },
    { symbol: 'KAREL.IS', name: 'Karel Elektronik', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'KARSN.IS', name: 'Karsan Otomotiv', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'KARYE.IS', name: 'Kartal Yenilenebilir Enerji', last_price: 35.60, daily_change: 1.1 },
    { symbol: 'KATMR.IS', name: 'Katmerciler Araç Üstü Ekipman', last_price: 2.45, daily_change: 0.8 },
    { symbol: 'KAYSE.IS', name: 'Kayseri Şeker Fabrikası', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'KCAER.IS', name: 'Kocaer Çelik', last_price: 45.60, daily_change: 1.2 },
    { symbol: 'KFEIN.IS', name: 'Kafein Yazılım', last_price: 112.00, daily_change: 0.8 },
    { symbol: 'KGYO.IS', name: 'Koray GYO', last_price: 42.10, daily_change: 0.5 },
    { symbol: 'KIMMR.IS', name: 'Kimteks Poliüretan', last_price: 12.45, daily_change: 1.1 },
    { symbol: 'KLMSN.IS', name: 'Klimasan Klima', last_price: 35.60, daily_change: 0.8 },
    { symbol: 'KLNMA.IS', name: 'T. Kalkınma Bankası', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'KLRHO.IS', name: 'Kiler Holding', last_price: 45.60, daily_change: 1.2 },
    { symbol: 'KLSYN.IS', name: 'Kaleseramik', last_price: 72.40, daily_change: 0.8 },
    { symbol: 'KMPUR.IS', name: 'Kimteks Poliüretan', last_price: 85.40, daily_change: 1.1 },
    { symbol: 'KNFRT.IS', name: 'Konfrut Gıda', last_price: 18.40, daily_change: 0.5 },
    { symbol: 'KOPOL.IS', name: 'Koza Polyester', last_price: 65.40, daily_change: 1.2 },
    { symbol: 'KOTON.IS', name: 'Koton Mağazacılık', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'KRONT.IS', name: 'Kron Teknoloji', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'KRPLS.IS', name: 'Koroplast Temizlik Ambalaj', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'KRVGD.IS', name: 'Kervan Gıda', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'KSTUR.IS', name: 'Kuşadası Turizm', last_price: 5850.00, daily_change: 0.0 },
    { symbol: 'KTLEV.IS', name: 'Katılımevim', last_price: 72.40, daily_change: 1.5 },
    { symbol: 'KTSKR.IS', name: 'Kütahya Şeker Fabrikası', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'KUTPO.IS', name: 'Kütahya Porselen', last_price: 72.40, daily_change: 0.5 },
    { symbol: 'KUVVA.IS', name: 'Kuvva Gıda', last_price: 42.10, daily_change: 1.1 },
    { symbol: 'KYAS.IS', name: 'Kuyas Yatırım', last_price: 45.60, daily_change: 0.8 },
    { symbol: 'LIDER.IS', name: 'Lider Faktoring', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'LIDFA.IS', name: 'Lider Faktoring', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'LINK.IS', name: 'Link Bilgisayar', last_price: 425.00, daily_change: 2.1 },
    { symbol: 'LKMNH.IS', name: 'Lokman Hekim Sağlık', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'LUKSK.IS', name: 'Lüks Kadife', last_price: 112.00, daily_change: 0.5 },
    { symbol: 'MAALT.IS', name: 'Marmaris Altınyunus', last_price: 1250.00, daily_change: 1.2 },
    { symbol: 'MACKO.IS', name: 'Maçkolik İnternet Hizmetleri', last_price: 112.00, daily_change: 0.8 },
    { symbol: 'MAGEN.IS', name: 'Margün Enerji', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'MAKIM.IS', name: 'Makim Makina', last_price: 42.10, daily_change: 1.1 },
    { symbol: 'MAKTK.IS', name: 'Makina Takım', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'MANAS.IS', name: 'Manas Enerji Yönetimi', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'MARKA.IS', name: 'Marka Yatırım Holding', last_price: 15.60, daily_change: 1.2 },
    { symbol: 'MARTI.IS', name: 'Martı Otel', last_price: 5.42, daily_change: 0.8 },
    { symbol: 'MAVI.IS', name: 'Mavi Giyim', last_price: 142.00, daily_change: 1.1 },
    { symbol: 'MEDTR.IS', name: 'Mediterra Tıbbi Malzeme', last_price: 45.60, daily_change: 0.5 },
    { symbol: 'MEGAP.IS', name: 'Mega Polietilen', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'MEPET.IS', name: 'Mepet Metro Petrol', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'MERCN.IS', name: 'Mercan Kimya', last_price: 15.60, daily_change: 1.1 },
    { symbol: 'MERKO.IS', name: 'Merko Gıda', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'METRO.IS', name: 'Metro Holding', last_price: 3.12, daily_change: 0.5 },
    { symbol: 'METUR.IS', name: 'Metemtur Otelcilik', last_price: 12.45, daily_change: 1.2 },
    { symbol: 'MHRGY.IS', name: 'Maher GYO', last_price: 5.42, daily_change: 0.8 },
    { symbol: 'MIATK.IS', name: 'Mia Teknoloji', last_price: 65.40, daily_change: 2.1 },
    { symbol: 'MIPAZ.IS', name: 'Milpa', last_price: 35.60, daily_change: 0.5 },
    { symbol: 'MMCAS.IS', name: 'MMC Sanayi', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'MNDRS.IS', name: 'Menderes Tekstil', last_price: 12.45, daily_change: 0.8 },
    { symbol: 'MNDTR.IS', name: 'Mondı Turkey', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'MOBTL.IS', name: 'Mobiltel İletişim', last_price: 4.12, daily_change: 1.2 },
    { symbol: 'MPARK.IS', name: 'MLP Sağlık', last_price: 245.00, daily_change: 1.1 },
    { symbol: 'MRGYO.IS', name: 'Martı GYO', last_price: 5.85, daily_change: 0.8 },
    { symbol: 'MRSHL.IS', name: 'Marshall', last_price: 2450.00, daily_change: 0.5 },
    { symbol: 'MSGYO.IS', name: 'Mistral GYO', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'MTRKS.IS', name: 'Matriks Bilgi Dağıtım', last_price: 65.40, daily_change: 0.8 },
    { symbol: 'MZHLD.IS', name: 'Mazhar Zorlu Holding', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'NATEN.IS', name: 'Naturel Enerji', last_price: 72.40, daily_change: 1.2 },
    { symbol: 'NETAS.IS', name: 'Netaş', last_price: 145.00, daily_change: 0.8 },
    { symbol: 'NIBAS.IS', name: 'Niğbaş Niğde Beton', last_price: 15.40, daily_change: 0.5 },
    { symbol: 'NTGAZ.IS', name: 'Naturelgaz', last_price: 18.40, daily_change: 1.1 },
    { symbol: 'NTHOL.IS', name: 'Net Holding', last_price: 32.40, daily_change: 0.8 },
    { symbol: 'NUGYO.IS', name: 'Nurol GYO', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'OBAMS.IS', name: 'Oba Makarnacılık', last_price: 42.10, daily_change: 1.5 },
    { symbol: 'OBASE.IS', name: 'Obase Bilgisayar', last_price: 45.60, daily_change: 0.8 },
    { symbol: 'ODAS.IS', name: 'Odaş Elektrik', last_price: 9.45, daily_change: 0.5 },
    { symbol: 'OFSYM.IS', name: 'Ofis Yem Gıda', last_price: 65.40, daily_change: 1.2 },
    { symbol: 'ONCSM.IS', name: 'Oncosem Onkolojik', last_price: 145.00, daily_change: 0.8 },
    { symbol: 'ORCA.IS', name: 'Orçay Ortaköy Çay', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'ORGE.IS', name: 'Orge Enerji Elektrik', last_price: 85.40, daily_change: 1.1 },
    { symbol: 'ORMA.IS', name: 'Orma Orman Mahsulleri', last_price: 112.00, daily_change: 0.8 },
    { symbol: 'OSMEN.IS', name: 'Osmanlı Menkul', last_price: 245.00, daily_change: 1.5 },
    { symbol: 'OSTIM.IS', name: 'Ostim Endüstriyel Yatırım', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'OTKAR.IS', name: 'Otokar', last_price: 485.00, daily_change: 1.2 },
    { symbol: 'OYAKC.IS', name: 'Oyak Çimento', last_price: 72.40, daily_change: 0.8 },
    { symbol: 'OYAYO.IS', name: 'Oyak Yatırım Ortaklığı', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'OYLUM.IS', name: 'Oylum Sınai Yatırımlar', last_price: 12.45, daily_change: 1.1 },
    { symbol: 'OYYAT.IS', name: 'Oyak Yatırım Menkul', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'OZGYO.IS', name: 'Özderici GYO', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'OZKGY.IS', name: 'Özak GYO', last_price: 9.45, daily_change: 1.2 },
    { symbol: 'OZRDN.IS', name: 'Özerden Plastik', last_price: 32.40, daily_change: 0.8 },
    { symbol: 'OZSUB.IS', name: 'Özsu Balık', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'PAGYO.IS', name: 'Panora GYO', last_price: 35.60, daily_change: 1.1 },
    { symbol: 'PAMEL.IS', name: 'Pamel Yenilenebilir Enerji', last_price: 145.00, daily_change: 0.8 },
    { symbol: 'PAPIL.IS', name: 'Papilon Savunma', last_price: 85.40, daily_change: 0.5 },
    { symbol: 'PARSN.IS', name: 'Parsan', last_price: 112.00, daily_change: 1.2 },
    { symbol: 'PASEU.IS', name: 'Pasifik Eurasia Lojistik', last_price: 72.40, daily_change: 0.8 },
    { symbol: 'PATEK.IS', name: 'Pasifik Teknoloji', last_price: 145.00, daily_change: 2.1 },
    { symbol: 'PCILT.IS', name: 'PC İletişim Medya', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'PEGYO.IS', name: 'Pera GYO', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'PEKGY.IS', name: 'Peker GYO', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'PENTA.IS', name: 'Penta Teknoloji', last_price: 18.40, daily_change: 0.5 },
    { symbol: 'PETKM.IS', name: 'Petkim', last_price: 21.40, daily_change: 1.2 },
    { symbol: 'PETUN.IS', name: 'Pınar Et ve Un', last_price: 72.30, daily_change: 0.8 },
    { symbol: 'PINSU.IS', name: 'Pınar Su', last_price: 14.50, daily_change: 0.5 },
    { symbol: 'PKART.IS', name: 'Plastikkart', last_price: 85.40, daily_change: 1.1 },
    { symbol: 'PKENT.IS', name: 'Petrokent Turizm', last_price: 325.00, daily_change: 0.8 },
    { symbol: 'PLTUR.IS', name: 'Platform Turizm', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'PNLSN.IS', name: 'Panelsan', last_price: 85.40, daily_change: 1.2 },
    { symbol: 'PNSUT.IS', name: 'Pınar Süt', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'POLHO.IS', name: 'Polisan Holding', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'POLTK.IS', name: 'Politeknik Metal', last_price: 18500.00, daily_change: 1.1 },
    { symbol: 'PRDGS.IS', name: 'Pardus Girişim', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'PRKAB.IS', name: 'Türk Prysmian Kablo', last_price: 35.60, daily_change: 0.5 },
    { symbol: 'PRKME.IS', name: 'Park Elek.Madencilik', last_price: 25.40, daily_change: 1.2 },
    { symbol: 'PSGYO.IS', name: 'Pasifik GYO', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'QNBFB.IS', name: 'QNB Finansbank', last_price: 325.00, daily_change: 0.5 },
    { symbol: 'QNBFL.IS', name: 'QNB Finans Finansal Kiralama', last_price: 245.00, daily_change: 1.1 },
    { symbol: 'QUAGR.IS', name: 'Qua Granite', last_price: 4.52, daily_change: 0.8 },
    { symbol: 'RALYH.IS', name: 'Ral Yatırım Holding', last_price: 112.00, daily_change: 1.5 },
    { symbol: 'RAYYS.IS', name: 'Ray Sigorta', last_price: 245.00, daily_change: 0.8 },
    { symbol: 'REEDR.IS', name: 'Reeder Teknoloji', last_price: 45.60, daily_change: 2.1 },
    { symbol: 'RNPOL.IS', name: 'Rainbow Polikarbonat', last_price: 22.10, daily_change: 0.5 },
    { symbol: 'RODRG.IS', name: 'Rodrigo Tekstil', last_price: 85.40, daily_change: 1.1 },
    { symbol: 'RTALB.IS', name: 'RTA Laboratuvarları', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'RUBNS.IS', name: 'Rubenis Tekstil', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'RYGYO.IS', name: 'Reysaş GYO', last_price: 28.40, daily_change: 1.2 },
    { symbol: 'RYSAS.IS', name: 'Reysaş Lojistik', last_price: 45.60, daily_change: 0.8 },
    { symbol: 'SAFKR.IS', name: 'Safkar Ege Soğutmacılık', last_price: 35.60, daily_change: 0.5 },
    { symbol: 'SAMAT.IS', name: 'Saray Matbaacılık', last_price: 12.45, daily_change: 1.1 },
    { symbol: 'SANEL.IS', name: 'Sanel Mühendislik', last_price: 18.40, daily_change: 0.8 },
    { symbol: 'SANFO.IS', name: 'Sanifoam Sünger', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'SANKO.IS', name: 'Sanko Pazarlama', last_price: 32.40, daily_change: 1.2 },
    { symbol: 'SARKY.IS', name: 'Sarkuysan', last_price: 38.40, daily_change: 0.8 },
    { symbol: 'SASA.IS', name: 'Sasa Polyester', last_price: 38.40, daily_change: 0.5 },
    { symbol: 'SAYAS.IS', name: 'Say Yenilenebilir', last_price: 92.40, daily_change: 1.1 },
    { symbol: 'SDTTR.IS', name: 'SDT Savunma', last_price: 385.00, daily_change: 1.5 },
    { symbol: 'SEKFK.IS', name: 'Şeker Faktoring', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'SEKUR.IS', name: 'Sekuro Plastik', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'SELEC.IS', name: 'Selçuk Ecza Deposu', last_price: 65.40, daily_change: 1.2 },
    { symbol: 'SELGD.IS', name: 'Selçuk Gıda', last_price: 12.45, daily_change: 0.8 },
    { symbol: 'SERVE.IS', name: 'Serve Film Prodüksiyon', last_price: 18.40, daily_change: 0.5 },
    { symbol: 'SEYKM.IS', name: 'Seyitler Kimya', last_price: 12.45, daily_change: 1.1 },
    { symbol: 'SILVR.IS', name: 'Silverline Endüstri', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'SNGYO.IS', name: 'Sinpaş GYO', last_price: 3.12, daily_change: 0.5 },
    { symbol: 'SNICA.IS', name: 'Sanica Isı', last_price: 35.60, daily_change: 1.2 },
    { symbol: 'SOKE.IS', name: 'Söke Değirmencilik', last_price: 15.45, daily_change: 0.8 },
    { symbol: 'SOKM.IS', name: 'Şok Marketler', last_price: 62.40, daily_change: 0.5 },
    { symbol: 'SONME.IS', name: 'Sönmez Filament', last_price: 85.40, daily_change: 1.1 },
    { symbol: 'SRVGY.IS', name: 'Servet GYO', last_price: 425.00, daily_change: 0.8 },
    { symbol: 'SUMAS.IS', name: 'Sumaş Suni Tahta', last_price: 112.00, daily_change: 0.5 },
    { symbol: 'SURGY.IS', name: 'Sur Tatil Evleri GYO', last_price: 48.50, daily_change: 1.2 },
    { symbol: 'SUWEN.IS', name: 'Suwen Tekstil', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'TABGD.IS', name: 'TAB Gıda', last_price: 145.00, daily_change: 0.5 },
    { symbol: 'TAPDI.IS', name: 'Tapdi Oksijen', last_price: 45.60, daily_change: 1.1 },
    { symbol: 'TATEN.IS', name: 'Tatlıpınar Enerji', last_price: 48.50, daily_change: 0.8 },
    { symbol: 'TATGD.IS', name: 'Tat Gıda', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'TAVHL.IS', name: 'TAV Havalimanları', last_price: 165.40, daily_change: 1.2 },
    { symbol: 'TBORG.IS', name: 'Türk Tuborg', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'TCELL.IS', name: 'Turkcell', last_price: 68.40, daily_change: 0.5 },
    { symbol: 'TDGYO.IS', name: 'Trend GYO', last_price: 12.45, daily_change: 1.1 },
    { symbol: 'TEKTU.IS', name: 'Tek-Art Turizm', last_price: 4.12, daily_change: 0.8 },
    { symbol: 'TERA.IS', name: 'Tera Yatırım', last_price: 45.60, daily_change: 0.5 },
    { symbol: 'TETMT.IS', name: 'Tetamat Gıda', last_price: 5850.00, daily_change: 0.0 },
    { symbol: 'TEZOL.IS', name: 'Europap Tezol Kağıt', last_price: 22.10, daily_change: 1.2 },
    { symbol: 'THYAO.IS', name: 'Türk Hava Yolları', last_price: 285.50, daily_change: 0.8 },
    { symbol: 'TKFEN.IS', name: 'Tekfen Holding', last_price: 42.10, daily_change: 0.5 },
    { symbol: 'TMPOL.IS', name: 'Temapol Polimer', last_price: 85.40, daily_change: 1.1 },
    { symbol: 'TMSN.IS', name: 'Tümosan', last_price: 95.40, daily_change: 0.8 },
    { symbol: 'TNZTP.IS', name: 'Tapdi Oksijen', last_price: 45.60, daily_change: 0.5 },
    { symbol: 'TOASO.IS', name: 'Tofaş Oto. Fab.', last_price: 245.00, daily_change: 1.2 },
    { symbol: 'TRCAS.IS', name: 'Turcas Petrol', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'TRGYO.IS', name: 'Torunlar GYO', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'TRILC.IS', name: 'Turk İlaç Serum', last_price: 15.60, daily_change: 1.1 },
    { symbol: 'TSGYO.IS', name: 'TSGYO', last_price: 6.45, daily_change: 0.8 },
    { symbol: 'TSKB.IS', name: 'TSKB', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'TSPOR.IS', name: 'Trabzonspor Sportif', last_price: 2.45, daily_change: 1.2 },
    { symbol: 'TTKOM.IS', name: 'Türk Telekom', last_price: 32.50, daily_change: 0.8 },
    { symbol: 'TTRAK.IS', name: 'Türk Traktör', last_price: 850.00, daily_change: 0.5 },
    { symbol: 'TUCLK.IS', name: 'Tuğçelik', last_price: 15.60, daily_change: 1.1 },
    { symbol: 'TUKAS.IS', name: 'Tukaş Gıda', last_price: 12.85, daily_change: 0.8 },
    { symbol: 'TUPRS.IS', name: 'Tüpraş', last_price: 155.30, daily_change: 0.5 },
    { symbol: 'TUREX.IS', name: 'Turex Turizm', last_price: 45.60, daily_change: 1.2 },
    { symbol: 'TURSG.IS', name: 'Türkiye Sigorta', last_price: 42.10, daily_change: 0.8 },
    { symbol: 'UFUK.IS', name: 'Ufuk Yatırım', last_price: 112.00, daily_change: 0.5 },
    { symbol: 'ULAS.IS', name: 'Ulaşlar Turizm', last_price: 18.40, daily_change: 1.1 },
    { symbol: 'ULKER.IS', name: 'Ülker Bisküvi', last_price: 85.30, daily_change: 0.8 },
    { symbol: 'ULUFA.IS', name: 'Ulusal Faktoring', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'ULUSE.IS', name: 'Ulusoy Elektrik', last_price: 185.00, daily_change: 1.2 },
    { symbol: 'UNLU.IS', name: 'Ünlü Yatırım Holding', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'USAK.IS', name: 'Uşak Seramik', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'UTPYA.IS', name: 'Ütopya Turizm', last_price: 35.60, daily_change: 1.1 },
    { symbol: 'UZERB.IS', name: 'Uzertaş Boya', last_price: 425.00, daily_change: 0.8 },
    { symbol: 'VAKBN.IS', name: 'Vakıfbank', last_price: 14.50, daily_change: 0.5 },
    { symbol: 'VAKFN.IS', name: 'Vakıf Finansal Kiralama', last_price: 12.45, daily_change: 1.2 },
    { symbol: 'VAKKO.IS', name: 'Vakko', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'VANGD.IS', name: 'Vanet Gıda', last_price: 18.40, daily_change: 0.5 },
    { symbol: 'VBTYM.IS', name: 'VBT Yazılım', last_price: 42.10, daily_change: 1.1 },
    { symbol: 'VERTU.IS', name: 'Verusaturk Girişim', last_price: 45.60, daily_change: 0.8 },
    { symbol: 'VERUS.IS', name: 'Verusa Holding', last_price: 245.00, daily_change: 0.5 },
    { symbol: 'VESBE.IS', name: 'Vestel Beyaz Eşya', last_price: 18.50, daily_change: 1.2 },
    { symbol: 'VESTL.IS', name: 'Vestel', last_price: 82.40, daily_change: 0.8 },
    { symbol: 'VKFYO.IS', name: 'Vakıf Yatırım Ortaklığı', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'VKGYO.IS', name: 'Vakıf GYO', last_price: 3.85, daily_change: 1.1 },
    { symbol: 'VKING.IS', name: 'Viking Kağıt', last_price: 32.40, daily_change: 0.8 },
    { symbol: 'YAPRK.IS', name: 'Yaprak Süt ve Besi Çift.', last_price: 85.40, daily_change: 0.5 },
    { symbol: 'YATAS.IS', name: 'Yataş', last_price: 35.60, daily_change: 1.2 },
    { symbol: 'YAYLA.IS', name: 'Yayla Agro Gıda', last_price: 18.40, daily_change: 0.8 },
    { symbol: 'YBTAS.IS', name: 'Yibitaş Yozgat İşçi Birliği İnşaat', last_price: 125000.00, daily_change: 0.0 },
    { symbol: 'YEOTK.IS', name: 'Yeo Teknoloji', last_price: 215.00, daily_change: 1.1 },
    { symbol: 'YESIL.IS', name: 'Yeşil Yatırım Holding', last_price: 5.42, daily_change: 0.8 },
    { symbol: 'YGGYO.IS', name: 'Yeni Gimat GYO', last_price: 62.40, daily_change: 0.5 },
    { symbol: 'YGYO.IS', name: 'Yeşil GYO', last_price: 4.12, daily_change: 1.2 },
    { symbol: 'YKBNK.IS', name: 'Yapı Kredi Bankası', last_price: 22.10, daily_change: 0.8 },
    { symbol: 'YKSLN.IS', name: 'Yükselen Çelik', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'YONGA.IS', name: 'Yonga Mobilya', last_price: 85.40, daily_change: 1.1 },
    { symbol: 'YUNSA.IS', name: 'Yünsa', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'YYAPI.IS', name: 'Yeşil Yapı', last_price: 4.52, daily_change: 0.5 },
    { symbol: 'YYLGD.IS', name: 'Yayla Agro Gıda', last_price: 18.40, daily_change: 1.2 },
    { symbol: 'ZEDUR.IS', name: 'Zedur Enerji', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'ZOREN.IS', name: 'Zorlu Enerji', last_price: 5.42, daily_change: 0.5 },
    { symbol: 'ZRGYO.IS', name: 'Ziraat GYO', last_price: 6.45, daily_change: 1.1 },
    { symbol: 'ACSEL.IS', name: 'Acıselsan Acıpayam Selüloz', last_price: 145.00, daily_change: 0.8 },
    { symbol: 'ADEL.IS', name: 'Adel Kalemcilik', last_price: 585.00, daily_change: 1.2 },
    { symbol: 'ADESE.IS', name: 'Adese Gayrimenkul', last_price: 2.45, daily_change: 0.5 },
    { symbol: 'AFYON.IS', name: 'Afyon Çimento', last_price: 12.45, daily_change: 1.1 },
    { symbol: 'AGESA.IS', name: 'Agesa Hayat ve Emeklilik', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'AGHOL.IS', name: 'Anadolu Grubu Holding', last_price: 245.00, daily_change: 0.5 },
    { symbol: 'AGYO.IS', name: 'Atakule GYO', last_price: 8.45, daily_change: 1.2 },
    { symbol: 'AKBNK.IS', name: 'Akbank', last_price: 42.10, daily_change: 0.8 },
    { symbol: 'AKCNS.IS', name: 'Akçansa', last_price: 145.00, daily_change: 0.5 },
    { symbol: 'AKENR.IS', name: 'Akenerji', last_price: 5.42, daily_change: 1.1 },
    { symbol: 'AKFGY.IS', name: 'Akfen GYO', last_price: 4.12, daily_change: 0.8 },
    { symbol: 'AKGRT.IS', name: 'Aksigorta', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'AKMGY.IS', name: 'Akmerkez GYO', last_price: 185.00, daily_change: 1.2 },
    { symbol: 'AKSA.IS', name: 'Aksa', last_price: 92.40, daily_change: 0.8 },
    { symbol: 'AKSEN.IS', name: 'Aksa Enerji', last_price: 35.60, daily_change: 0.5 },
    { symbol: 'ALARK.IS', name: 'Alarko Holding', last_price: 112.00, daily_change: 1.1 },
    { symbol: 'ALBRK.IS', name: 'Albaraka Türk', last_price: 4.52, daily_change: 0.8 },
    { symbol: 'ALCAR.IS', name: 'Alarko Carrier', last_price: 1250.00, daily_change: 0.5 },
    { symbol: 'ALCTL.IS', name: 'Alcatel Lucent Teletaş', last_price: 112.00, daily_change: 1.2 },
    { symbol: 'ALGYO.IS', name: 'Alarko GYO', last_price: 42.10, daily_change: 0.8 },
    { symbol: 'ALKA.IS', name: 'Alka Kağıt', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'ALMAD.IS', name: 'Altınyağ Madencilik', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'ANELE.IS', name: 'Anel Elektrik', last_price: 12.45, daily_change: 0.8 },
    { symbol: 'ANHYT.IS', name: 'Anadolu Hayat Emek.', last_price: 45.60, daily_change: 0.5 },
    { symbol: 'ANSGR.IS', name: 'Anadolu Sigorta', last_price: 65.40, daily_change: 1.2 },
    { symbol: 'ARASE.IS', name: 'Aras Elektrik', last_price: 65.40, daily_change: 0.8 },
    { symbol: 'ARDYZ.IS', name: 'Ard Bilişim Teknolojileri', last_price: 45.60, daily_change: 0.5 },
    { symbol: 'ARENA.IS', name: 'Arena Bilgisayar', last_price: 32.40, daily_change: 1.1 },
    { symbol: 'ARSAN.IS', name: 'Arsan Tekstil', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'ASUZU.IS', name: 'Anadolu Isuzu', last_price: 245.00, daily_change: 0.5 },
    { symbol: 'ATLAS.IS', name: 'Atlas Menkul Kıymetler', last_price: 4.12, daily_change: 1.2 },
    { symbol: 'ATSYH.IS', name: 'Atlantis Yatırım Holding', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'AVOD.IS', name: 'A.V.O.D. Gıda ve Tarım', last_price: 4.52, daily_change: 0.5 },
    { symbol: 'AYGAZ.IS', name: 'Aygaz', last_price: 165.00, daily_change: 1.1 },
    { symbol: 'BANVT.IS', name: 'Banvit', last_price: 245.00, daily_change: 0.8 },
    { symbol: 'BERA.IS', name: 'Bera Holding', last_price: 18.40, daily_change: 0.5 },
    { symbol: 'BFREN.IS', name: 'Bosch Fren Sistemleri', last_price: 12500.00, daily_change: 1.2 },
    { symbol: 'BIZIM.IS', name: 'Bizim Mağazaları', last_price: 42.10, daily_change: 0.8 },
    { symbol: 'BJKAS.IS', name: 'Beşiktaş Futbol Yat.', last_price: 45.60, daily_change: 0.5 },
    { symbol: 'BLCYT.IS', name: 'Bilici Yatırım', last_price: 18.40, daily_change: 1.1 },
    { symbol: 'BRISA.IS', name: 'Brisa', last_price: 112.00, daily_change: 0.8 },
    { symbol: 'BRYAT.IS', name: 'Borusan Yatırım', last_price: 2450.00, daily_change: 0.5 },
    { symbol: 'BSOKE.IS', name: 'Batısöke Çimento', last_price: 12.45, daily_change: 1.2 },
    { symbol: 'BTCIM.IS', name: 'Batıçim Çimento', last_price: 145.00, daily_change: 0.8 },
    { symbol: 'BURCE.IS', name: 'Burçelik', last_price: 145.00, daily_change: 0.5 },
    { symbol: 'CANTE.IS', name: 'Çan2 Termik', last_price: 18.20, daily_change: 1.1 },
    { symbol: 'CCOLA.IS', name: 'Coca-Cola İçecek', last_price: 585.00, daily_change: 0.8 },
    { symbol: 'CELHA.IS', name: 'Çelik Halat', last_price: 45.60, daily_change: 0.5 },
    { symbol: 'CEMAS.IS', name: 'Çemaş Döküm', last_price: 4.12, daily_change: 1.2 },
    { symbol: 'CEMTS.IS', name: 'Çemtaş', last_price: 12.45, daily_change: 0.8 },
    { symbol: 'CIMSA.IS', name: 'Çimsa', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'CLEBI.IS', name: 'Çelebi', last_price: 1250.00, daily_change: 1.1 },
    { symbol: 'CRDFA.IS', name: 'Creditwest Faktoring', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'CUSAN.IS', name: 'Çuhadaroğlu Metal', last_price: 18.40, daily_change: 0.5 },
    { symbol: 'DARDL.IS', name: 'Dardanel', last_price: 6.45, daily_change: 1.2 },
    { symbol: 'DENGE.IS', name: 'Denge Yatırım Holding', last_price: 3.12, daily_change: 0.8 },
    { symbol: 'DESPC.IS', name: 'Despec Bilgisayar', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'DEVA.IS', name: 'Deva Holding', last_price: 85.40, daily_change: 1.1 },
    { symbol: 'DGKLB.IS', name: 'Doğanlar Mobilya', last_price: 12.85, daily_change: 0.8 },
    { symbol: 'DITAS.IS', name: 'Ditaş Doğan', last_price: 35.60, daily_change: 0.5 },
    { symbol: 'DMSAS.IS', name: 'Demsaş Döküm', last_price: 8.45, daily_change: 1.2 },
    { symbol: 'DOAS.IS', name: 'Doğuş Otomotiv', last_price: 285.00, daily_change: 0.8 },
    { symbol: 'DOCO.IS', name: 'DO & CO', last_price: 5850.00, daily_change: 0.5 },
    { symbol: 'DOGUB.IS', name: 'Doğusan', last_price: 15.60, daily_change: 1.1 },
    { symbol: 'DOKTA.IS', name: 'Döktaş Dökümcülük', last_price: 72.40, daily_change: 0.8 },
    { symbol: 'DYOBY.IS', name: 'Dyo Boya', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'ECILC.IS', name: 'Eczacıbaşı İlaç', last_price: 52.40, daily_change: 1.2 },
    { symbol: 'ECZYT.IS', name: 'Eczacıbaşı Yatırım', last_price: 245.00, daily_change: 0.8 },
    { symbol: 'EDIP.IS', name: 'Edip Gayrimenkul', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'EGEEN.IS', name: 'Ege Endüstri', last_price: 12500.00, daily_change: 1.1 },
    { symbol: 'EGGUB.IS', name: 'Ege Gübre', last_price: 65.40, daily_change: 0.8 },
    { symbol: 'EGSER.IS', name: 'Ege Seramik', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'EMKEL.IS', name: 'Emek Elektrik', last_price: 15.60, daily_change: 1.2 },
    { symbol: 'ENJSA.IS', name: 'Enerjisa Enerji', last_price: 62.40, daily_change: 0.8 },
    { symbol: 'ENKAI.IS', name: 'Enka İnşaat', last_price: 38.40, daily_change: 0.5 },
    { symbol: 'ERBOS.IS', name: 'Erbosan', last_price: 185.00, daily_change: 1.1 },
    { symbol: 'EREGL.IS', name: 'Ereğli Demir Çelik', last_price: 48.50, daily_change: 0.8 },
    { symbol: 'ERSU.IS', name: 'Ersu Meyve Suları', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'ESCOM.IS', name: 'Escort Teknoloji', last_price: 42.10, daily_change: 1.2 },
    { symbol: 'ESEN.IS', name: 'Esenboğa Elektrik', last_price: 22.10, daily_change: 0.8 },
    { symbol: 'ETILR.IS', name: 'Etiler Gıda', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'EUYO.IS', name: 'Euro Menkul Kıymet Yat. Ort.', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'FADE.IS', name: 'Fade Gıda', last_price: 12.45, daily_change: 0.8 },
    { symbol: 'FENER.IS', name: 'Fenerbahçe Futbol', last_price: 112.00, daily_change: 0.5 },
    { symbol: 'FLAP.IS', name: 'Flap Kongre Toplantı', last_price: 15.60, daily_change: 1.2 },
    { symbol: 'FMIZP.IS', name: 'Federal-Mogul İzmit Piston', last_price: 245.00, daily_change: 0.8 },
    { symbol: 'FROTO.IS', name: 'Ford Otosan', last_price: 985.00, daily_change: 0.5 },
    { symbol: 'GARAN.IS', name: 'Garanti Bankası', last_price: 72.40, daily_change: 1.1 },
    { symbol: 'GEDIK.IS', name: 'Gedik Yatırım', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'GEDZA.IS', name: 'Gediz Ambalaj', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'GENTS.IS', name: 'Gentaş', last_price: 8.45, daily_change: 1.2 },
    { symbol: 'GEREL.IS', name: 'Gersan Elektrik', last_price: 32.40, daily_change: 0.8 },
    { symbol: 'GLYHO.IS', name: 'Global Yatırım Holding', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'GOLTS.IS', name: 'Göltaş Çimento', last_price: 385.00, daily_change: 1.1 },
    { symbol: 'GOODY.IS', name: 'Good-Year', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'GOZDE.IS', name: 'Gözde Girişim', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'GSDHO.IS', name: 'GSD Holding', last_price: 4.12, daily_change: 1.2 },
    { symbol: 'GSRAY.IS', name: 'Galatasaray Sportif', last_price: 10.45, daily_change: 0.8 },
    { symbol: 'GUBRF.IS', name: 'Gübre Fabrikaları', last_price: 185.00, daily_change: 0.5 },
    { symbol: 'GWIND.IS', name: 'Galata Wind Enerji', last_price: 28.40, daily_change: 1.1 },
    { symbol: 'HALKB.IS', name: 'Halkbank', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'HDFGS.IS', name: 'Hedef Girişim', last_price: 3.12, daily_change: 0.5 },
    { symbol: 'HEKTS.IS', name: 'Hektaş', last_price: 18.40, daily_change: 1.2 },
    { symbol: 'HLGYO.IS', name: 'Halk GYO', last_price: 4.12, daily_change: 0.8 },
    { symbol: 'HUBVC.IS', name: 'Hub Girişim', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'HURGZ.IS', name: 'Hürriyet Gzt.', last_price: 5.42, daily_change: 1.1 },
    { symbol: 'ICBCT.IS', name: 'ICBC Turkey Bank', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'IHEVA.IS', name: 'İhlas Ev Aletleri', last_price: 3.12, daily_change: 0.5 },
    { symbol: 'IHLGM.IS', name: 'İhlas Gayrimenkul', last_price: 2.45, daily_change: 1.2 },
    { symbol: 'IHLAS.IS', name: 'İhlas Holding', last_price: 1.85, daily_change: 0.8 },
    { symbol: 'IHYAY.IS', name: 'İhlas Yayın Holding', last_price: 2.12, daily_change: 0.5 },
    { symbol: 'INDES.IS', name: 'İndeks Bilgisayar', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'INFO.IS', name: 'İnfo Yatırım', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'INTEM.IS', name: 'İntema', last_price: 325.00, daily_change: 0.5 },
    { symbol: 'IPEKE.IS', name: 'İpek Doğal Enerji', last_price: 42.10, daily_change: 1.2 },
    { symbol: 'ISCTR.IS', name: 'İş Bankası (C)', last_price: 12.45, daily_change: 0.8 },
    { symbol: 'ISDMR.IS', name: 'İskenderun Demir Çelik', last_price: 38.40, daily_change: 0.5 },
    { symbol: 'ISFIN.IS', name: 'İş Finansal Kiralama', last_price: 15.60, daily_change: 1.1 },
    { symbol: 'ISGSY.IS', name: 'İş Girişim', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'ISGYO.IS', name: 'İş GYO', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'ISMEN.IS', name: 'İş Yatırım Menkul', last_price: 38.45, daily_change: 1.2 },
    { symbol: 'ITTFH.IS', name: 'İttifak Holding', last_price: 4.52, daily_change: 0.8 },
    { symbol: 'IZMDC.IS', name: 'İzmir Demir Çelik', last_price: 7.42, daily_change: 0.5 },
    { symbol: 'KARDB.IS', name: 'Kardemir (B)', last_price: 22.10, daily_change: 1.1 },
    { symbol: 'KARDD.IS', name: 'Kardemir (D)', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'KAREL.IS', name: 'Karel Elektronik', last_price: 15.60, daily_change: 0.5 },
    { symbol: 'KARSN.IS', name: 'Karsan Otomotiv', last_price: 12.45, daily_change: 1.2 },
    { symbol: 'KARTN.IS', name: 'Kartonsan', last_price: 112.00, daily_change: 0.8 },
    { symbol: 'KATMR.IS', name: 'Katmerciler Araç Üstü Ekipman', last_price: 2.45, daily_change: 0.5 },
    { symbol: 'KCHOL.IS', name: 'Koç Holding', last_price: 185.00, daily_change: 1.1 },
    { symbol: 'KERVT.IS', name: 'Kerevitaş Gıda', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'KFEIN.IS', name: 'Kafein Yazılım', last_price: 112.00, daily_change: 0.5 },
    { symbol: 'KLMSN.IS', name: 'Klimasan Klima', last_price: 35.60, daily_change: 1.2 },
    { symbol: 'KLRHO.IS', name: 'Kiler Holding', last_price: 45.60, daily_change: 0.8 },
    { symbol: 'KNFRT.IS', name: 'Konfrut Gıda', last_price: 18.40, daily_change: 0.5 },
    { symbol: 'KONYA.IS', name: 'Konya Çimento', last_price: 12500.00, daily_change: 1.1 },
    { symbol: 'KORDS.IS', name: 'Kordsa Teknik Tekstil', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'KOZAA.IS', name: 'Koza Madencilik', last_price: 52.40, daily_change: 0.5 },
    { symbol: 'KOZAL.IS', name: 'Koza Altın', last_price: 22.10, daily_change: 1.2 },
    { symbol: 'KRDMA.IS', name: 'Kardemir (A)', last_price: 21.40, daily_change: 0.8 },
    { symbol: 'KRONT.IS', name: 'Kron Teknoloji', last_price: 32.40, daily_change: 0.5 },
    { symbol: 'KRVGD.IS', name: 'Kervan Gıda', last_price: 25.40, daily_change: 1.1 },
    { symbol: 'KUTPO.IS', name: 'Kütahya Porselen', last_price: 72.40, daily_change: 0.8 },
    { symbol: 'LINK.IS', name: 'Link Bilgisayar', last_price: 425.00, daily_change: 0.5 },
    { symbol: 'LOGO.IS', name: 'Logo Yazılım', last_price: 85.40, daily_change: 1.2 },
    { symbol: 'MAALT.IS', name: 'Marmaris Altınyunus', last_price: 1250.00, daily_change: 0.8 },
    { symbol: 'MAKTK.IS', name: 'Makina Takım', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'MARTI.IS', name: 'Martı Otel', last_price: 5.42, daily_change: 1.1 },
    { symbol: 'MAVI.IS', name: 'Mavi Giyim', last_price: 142.00, daily_change: 0.8 },
    { symbol: 'MEGAP.IS', name: 'Mega Polietilen', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'MNDRS.IS', name: 'Menderes Tekstil', last_price: 12.45, daily_change: 1.2 },
    { symbol: 'MPARK.IS', name: 'MLP Sağlık', last_price: 245.00, daily_change: 0.8 },
    { symbol: 'MSGYO.IS', name: 'Mistral GYO', last_price: 8.45, daily_change: 0.5 },
    { symbol: 'NETAS.IS', name: 'Netaş', last_price: 145.00, daily_change: 1.1 },
    { symbol: 'NTHOL.IS', name: 'Net Holding', last_price: 32.40, daily_change: 0.8 },
    { symbol: 'NUGYO.IS', name: 'Nurol GYO', last_price: 12.45, daily_change: 0.5 },
    { symbol: 'ODAS.IS', name: 'Odaş Elektrik', last_price: 9.45, daily_change: 1.2 },
    { symbol: 'OTKAR.IS', name: 'Otokar', last_price: 485.00, daily_change: 0.8 },
    { symbol: 'OYAKC.IS', name: 'Oyak Çimento', last_price: 72.40, daily_change: 0.5 },
    { symbol: 'OZGYO.IS', name: 'Özderici GYO', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'OZKGY.IS', name: 'Özak GYO', last_price: 9.45, daily_change: 0.8 },
    { symbol: 'PAGYO.IS', name: 'Panora GYO', last_price: 35.60, daily_change: 0.5 },
    { symbol: 'PARSN.IS', name: 'Parsan', last_price: 112.00, daily_change: 1.2 },
    { symbol: 'PEKGY.IS', name: 'Peker GYO', last_price: 25.40, daily_change: 0.8 },
    { symbol: 'PETKM.IS', name: 'Petkim', last_price: 21.40, daily_change: 0.5 },
    { symbol: 'PGSUS.IS', name: 'Pegasus', last_price: 825.00, daily_change: 1.1 },
    { symbol: 'PINSU.IS', name: 'Pınar Su', last_price: 14.50, daily_change: 0.8 },
    { symbol: 'PKART.IS', name: 'Plastikkart', last_price: 85.40, daily_change: 0.5 },
    { symbol: 'PNSUT.IS', name: 'Pınar Süt', last_price: 85.40, daily_change: 1.2 },
    { symbol: 'POLHO.IS', name: 'Polisan Holding', last_price: 15.60, daily_change: 0.8 },
    { symbol: 'PRKME.IS', name: 'Park Elek.Madencilik', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'PSGYO.IS', name: 'Pasifik GYO', last_price: 8.45, daily_change: 1.1 },
    { symbol: 'QNBFB.IS', name: 'QNB Finansbank', last_price: 325.00, daily_change: 0.8 },
    { symbol: 'QUAGR.IS', name: 'Qua Granite', last_price: 4.52, daily_change: 0.5 },
    { symbol: 'RYSAS.IS', name: 'Reysaş Lojistik', last_price: 45.60, daily_change: 1.2 },
    { symbol: 'SAHOL.IS', name: 'Sabancı Holding', last_price: 85.40, daily_change: 0.8 },
    { symbol: 'SARKY.IS', name: 'Sarkuysan', last_price: 38.40, daily_change: 0.5 },
    { symbol: 'SASA.IS', name: 'Sasa Polyester', last_price: 38.40, daily_change: 1.1 },
    { symbol: 'SELEC.IS', name: 'Selçuk Ecza Deposu', last_price: 65.40, daily_change: 0.8 },
    { symbol: 'SISE.IS', name: 'Şişe Cam', last_price: 48.50, daily_change: 0.5 },
    { symbol: 'SKBNK.IS', name: 'Şekerbank', last_price: 4.52, daily_change: 1.2 },
    { symbol: 'SNGYO.IS', name: 'Sinpaş GYO', last_price: 3.12, daily_change: 0.8 },
    { symbol: 'SOKM.IS', name: 'Şok Marketler', last_price: 62.40, daily_change: 0.5 },
    { symbol: 'TAVHL.IS', name: 'TAV Havalimanları', last_price: 165.40, daily_change: 1.1 },
    { symbol: 'TCELL.IS', name: 'Turkcell', last_price: 68.40, daily_change: 0.8 },
    { symbol: 'THYAO.IS', name: 'Türk Hava Yolları', last_price: 285.50, daily_change: 0.5 },
    { symbol: 'TKFEN.IS', name: 'Tekfen Holding', last_price: 42.10, daily_change: 1.2 },
    { symbol: 'TMSN.IS', name: 'Tümosan', last_price: 95.40, daily_change: 0.8 },
    { symbol: 'TOASO.IS', name: 'Tofaş Oto. Fab.', last_price: 245.00, daily_change: 0.5 },
    { symbol: 'TRCAS.IS', name: 'Turcas Petrol', last_price: 25.40, daily_change: 1.1 },
    { symbol: 'TSKB.IS', name: 'TSKB', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'TTKOM.IS', name: 'Türk Telekom', last_price: 32.50, daily_change: 0.5 },
    { symbol: 'TTRAK.IS', name: 'Türk Traktör', last_price: 850.00, daily_change: 1.2 },
    { symbol: 'TUPRS.IS', name: 'Tüpraş', last_price: 155.30, daily_change: 0.8 },
    { symbol: 'TURSG.IS', name: 'Türkiye Sigorta', last_price: 42.10, daily_change: 0.5 },
    { symbol: 'ULKER.IS', name: 'Ülker Bisküvi', last_price: 85.30, daily_change: 1.1 },
    { symbol: 'VAKBN.IS', name: 'Vakıfbank', last_price: 14.50, daily_change: 0.8 },
    { symbol: 'VESBE.IS', name: 'Vestel Beyaz Eşya', last_price: 18.50, daily_change: 0.5 },
    { symbol: 'VESTL.IS', name: 'Vestel', last_price: 82.40, daily_change: 1.2 },
    { symbol: 'YKBNK.IS', name: 'Yapı Kredi Bankası', last_price: 22.10, daily_change: 0.8 },
    { symbol: 'ZOREN.IS', name: 'Zorlu Enerji', last_price: 5.42, daily_change: 0.5 },
    { symbol: 'ACSEL.IS', name: 'Acıselsan Acıpayam Selüloz', last_price: 145.20, daily_change: 1.2 },
    { symbol: 'ADEL.IS', name: 'Adel Kalemcilik', last_price: 645.00, daily_change: -0.5 },
    { symbol: 'ADESE.IS', name: 'Adese Gayrimenkul', last_price: 2.15, daily_change: 0.8 },
    { symbol: 'AFYON.IS', name: 'Afyon Çimento', last_price: 12.40, daily_change: 1.1 },
    { symbol: 'AGESA.IS', name: 'Agesa Hayat ve Emeklilik', last_price: 85.30, daily_change: 0.5 },
    { symbol: 'AGHOL.IS', name: 'Anadolu Grubu Holding', last_price: 320.00, daily_change: 1.4 },
    { symbol: 'AGYO.IS', name: 'Atakule GYO', last_price: 8.45, daily_change: 0.2 },
    { symbol: 'AKBNK.IS', name: 'Akbank', last_price: 42.10, daily_change: 0.5 },
    { symbol: 'AKCNS.IS', name: 'Akçansa', last_price: 145.00, daily_change: 0.8 },
    { symbol: 'AKENR.IS', name: 'Akenerji', last_price: 5.42, daily_change: 1.1 },
    { symbol: 'AKFGY.IS', name: 'Akfen GYO', last_price: 4.12, daily_change: 0.5 },
    { symbol: 'AKGRT.IS', name: 'Aksigorta', last_price: 6.45, daily_change: 0.8 },
    { symbol: 'AKMGY.IS', name: 'Akkök GYO', last_price: 185.00, daily_change: 0.2 },
    { symbol: 'AKSA.IS', name: 'Aksa', last_price: 95.40, daily_change: 1.2 },
    { symbol: 'AKSEN.IS', name: 'Aksa Enerji', last_price: 38.40, daily_change: 0.5 },
    { symbol: 'ALARK.IS', name: 'Alarko Holding', last_price: 125.40, daily_change: 0.8 },
    { symbol: 'ALBRK.IS', name: 'Albaraka Türk', last_price: 4.12, daily_change: 1.1 },
    { symbol: 'ALCTL.IS', name: 'Alcatel Lucent Teletaş', last_price: 115.00, daily_change: 0.5 },
    { symbol: 'ALGYO.IS', name: 'Alarko GYO', last_price: 42.10, daily_change: 0.8 },
    { symbol: 'ALKA.IS', name: 'Alkim Kağıt', last_price: 32.40, daily_change: 1.2 },
    { symbol: 'ALKIM.IS', name: 'Alkim Kimya', last_price: 38.50, daily_change: 0.5 },
    { symbol: 'ANELE.IS', name: 'Anel Elektrik', last_price: 12.40, daily_change: 0.8 },
    { symbol: 'ANGEN.IS', name: 'Anatolia Tanı ve Biyoteknoloji', last_price: 14.50, daily_change: 1.1 },
    { symbol: 'ANHYT.IS', name: 'Anadolu Hayat Emeklilik', last_price: 42.10, daily_change: 0.5 },
    { symbol: 'ANSGR.IS', name: 'Anadolu Sigorta', last_price: 65.40, daily_change: 0.8 },
    { symbol: 'ARCLK.IS', name: 'Arçelik', last_price: 145.00, daily_change: 1.2 },
    { symbol: 'ARDYZ.IS', name: 'ARD Bilişim Teknolojileri', last_price: 42.10, daily_change: 0.5 },
    { symbol: 'ARENA.IS', name: 'Arena Bilgisayar', last_price: 35.40, daily_change: 0.8 },
    { symbol: 'ARSAN.IS', name: 'Arsan Tekstil', last_price: 12.50, daily_change: 1.1 },
    { symbol: 'ARZUM.IS', name: 'Arzum Elektrikli Ev Aletleri', last_price: 45.30, daily_change: 0.5 },
    { symbol: 'ASELS.IS', name: 'Aselsan', last_price: 58.40, daily_change: 1.2 },
    { symbol: 'ASGYO.IS', name: 'Asce GYO', last_price: 15.40, daily_change: 0.8 },
    { symbol: 'ASTOR.IS', name: 'Astor Enerji', last_price: 115.40, daily_change: 0.5 },
    { symbol: 'ASUZU.IS', name: 'Anadolu Isuzu', last_price: 245.00, daily_change: 1.1 },
    { symbol: 'ATAGY.IS', name: 'Ata GYO', last_price: 6.45, daily_change: 0.8 },
    { symbol: 'ATAKP.IS', name: 'Atakey Patates', last_price: 45.10, daily_change: 0.5 },
    { symbol: 'ATATP.IS', name: 'ATP Ticari Bilgisayar', last_price: 85.30, daily_change: 1.2 },
    { symbol: 'ATEK.IS', name: 'Atlantis Yatırım Holding', last_price: 125.00, daily_change: 0.8 },
    { symbol: 'ATLAS.IS', name: 'Atlas Menkul Kıymetler', last_price: 4.12, daily_change: 0.5 },
    { symbol: 'ATSYH.IS', name: 'Atlantis Yatırım Holding', last_price: 18.50, daily_change: 1.1 },
    { symbol: 'AVGYO.IS', name: 'Avrasya GYO', last_price: 8.45, daily_change: 0.8 },
    { symbol: 'AVHOL.IS', name: 'Avrupa Yatırım Holding', last_price: 65.40, daily_change: 0.5 },
    { symbol: 'AVOD.IS', name: 'A.V.O.D. Gıda ve Tarım', last_price: 3.12, daily_change: 1.2 },
    { symbol: 'AVTUR.IS', name: 'Avrasya Petrol ve Turizm', last_price: 12.40, daily_change: 0.8 },
    { symbol: 'AYCES.IS', name: 'Altınyunus Çeşme', last_price: 645.00, daily_change: 0.5 },
    { symbol: 'AYDEM.IS', name: 'Aydem Enerji', last_price: 25.40, daily_change: 1.1 },
    { symbol: 'AYEN.IS', name: 'Ayen Enerji', last_price: 32.50, daily_change: 0.8 },
    { symbol: 'AYES.IS', name: 'Ayes Çelik Hasır', last_price: 38.40, daily_change: 0.5 },
    { symbol: 'AYGAZ.IS', name: 'Aygaz', last_price: 145.00, daily_change: 1.2 },
    { symbol: 'AZTEK.IS', name: 'Aztek Teknoloji', last_price: 85.30, daily_change: 0.8 },
    { symbol: 'BAGFS.IS', name: 'Bagfaş', last_price: 25.40, daily_change: 0.5 },
    { symbol: 'BAKAB.IS', name: 'Bak Ambalaj', last_price: 65.40, daily_change: 1.1 },
    { symbol: 'BALAT.IS', name: 'Balatacılar Balatacılık', last_price: 12.40, daily_change: 0.8 },
    { symbol: 'BANVT.IS', name: 'Banvit', last_price: 145.00, daily_change: 0.5 },
    { symbol: 'BARMA.IS', name: 'Barem Ambalaj', last_price: 18.50, daily_change: 1.2 },
    { symbol: 'BASGZ.IS', name: 'Başkent Doğalgaz', last_price: 22.10, daily_change: 0.8 },
    { symbol: 'BAYRK.IS', name: 'Bayrak Ebt Taban', last_price: 14.50, daily_change: 0.5 }
  ];
  
  const blacklist = await getBlacklist();
  const blacklistSet = new Set(blacklist.map(s => s.trim().toUpperCase()));
  
  const stocksSnap = await getDocs(collection(db, 'bist_stocks'));
  const existingSymbols = new Set(stocksSnap.docs.map(doc => doc.data().symbol.trim().toUpperCase()));
  
  let addedCount = 0;
  for (const s of list) {
    const symbol = s.symbol.trim().toUpperCase();
    const baseSymbol = symbol.split('.')[0];
    
    if (blacklistSet.has(symbol) || blacklistSet.has(baseSymbol)) {
      continue;
    }

    if (!existingSymbols.has(symbol)) {
      await addDoc(collection(db, 'bist_stocks'), s);
      addedCount++;
      existingSymbols.add(symbol);
    }
  }
  return addedCount;
}

export async function calculateKFactor(stockId: string): Promise<{ k: number, stats: any }> {
  // Fetch 2 years of data
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);
  const startStr = startDate.toISOString().split('T')[0];

  const prices = await fetchPriceHistory(stockId, startStr, endDate);
  if (prices.length < 2) return { k: 1.0, stats: null };

  const sortedPrices = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const closePrices = sortedPrices.map(p => p.close_price);
  
  const min = Math.min(...closePrices);
  const max = Math.max(...closePrices);
  const avg = closePrices.reduce((a, b) => a + b, 0) / closePrices.length;
  
  // Simple volatility based K calculation
  // Higher volatility -> Lower K
  const returns = [];
  for (let i = 1; i < closePrices.length; i++) {
    returns.push((closePrices[i] - closePrices[i-1]) / closePrices[i-1]);
  }
  const stdDev = Math.sqrt(returns.map(x => Math.pow(x - (returns.reduce((a, b) => a + b, 0) / returns.length), 2)).reduce((a, b) => a + b, 0) / returns.length);
  
  // Normalize K between 0.5 and 2.0
  // Standard deviation of 0.02 (2%) might be "average"
  let k = 1.0;
  if (stdDev > 0) {
    k = 0.02 / stdDev;
    k = Math.max(0.5, Math.min(2.0, k));
  }

  // Trend analysis (Simple Moving Average comparison)
  const last10 = closePrices.slice(-10);
  const last10Avg = last10.reduce((a, b) => a + b, 0) / 10;
  const prev10 = closePrices.slice(-20, -10);
  const prev10Avg = prev10.reduce((a, b) => a + b, 0) / 10;
  const trend = last10Avg > prev10Avg ? 'UP' : 'DOWN';

  return {
    k,
    stats: {
      min,
      max,
      avg,
      trend,
      volatility: stdDev,
      count: closePrices.length
    }
  };
}

export async function addStockToPortfolio(
  uid: string,
  stock: Stock,
  totalCapital: number,
  initialRatio: number,
  commissionRate: number,
  riskSettings?: {
    trailing_stop_pct?: number;
    take_profit_pct?: number;
    take_profit_amount_pct?: number;
  }
) {
  try {
    const buyCapital = totalCapital * initialRatio;
    const reserveCapital = totalCapital * (1 - initialRatio);
    
    const initialLots = Math.floor(buyCapital / (stock.last_price * (1 + commissionRate)));
    const actualCost = initialLots * stock.last_price;
    const commission = actualCost * commissionRate;
    
    // 1. Create Stock (or get existing)
    let stockId = stock.id;
    if (!stockId) {
      const stockRef = await addDoc(collection(db, 'stocks'), stock);
      stockId = stockRef.id;
    }
    
    // 2. Create Portfolio Entry
    const portfolioData: PortfolioItem = {
      uid,
      stock_id: stockId,
      symbol: stock.symbol,
      current_lots: initialLots,
      avg_cost: stock.last_price,
      allocated_capital: totalCapital,
      injected_capital: totalCapital,
      cash_reserve: reserveCapital - commission,
      initial_ratio: initialRatio,
      highest_price: stock.last_price,
      monthly_start_equity: totalCapital,
      ...riskSettings
    };
    await addDoc(collection(db, 'portfolio'), portfolioData);
    
    // 3. Record Initial Transaction
    const transaction = {
      uid,
      stock_id: stockId,
      symbol: stock.symbol,
      type: 'BUY',
      amount: initialLots,
      price: stock.last_price,
      commission: commission,
      reason: 'INITIAL',
      timestamp: Timestamp.now()
    };
    await addDoc(collection(db, 'transactions'), transaction);
    
    return stockId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'portfolio');
  }
}

export async function processDailyUpdate(
  portfolioItem: PortfolioItem,
  newPrice: number,
  kFactor: number,
  deadBand: number,
  commissionRate: number,
  stock?: Stock
) {
  try {
    const oldPrice = stock?.last_price || portfolioItem.avg_cost;
    const priceChangePercent = (newPrice - oldPrice) / oldPrice;
    
    // 1. Check Trailing Stop Loss
    let currentHighest = portfolioItem.highest_price || oldPrice;
    if (newPrice > currentHighest) {
      currentHighest = newPrice;
    }

    if (portfolioItem.trailing_stop_pct && portfolioItem.current_lots > 0) {
      const stopPrice = currentHighest * (1 - portfolioItem.trailing_stop_pct / 100);
      if (newPrice <= stopPrice) {
        // Trigger Stop Loss: Sell all
        return await executeTrade(portfolioItem, portfolioItem.current_lots, newPrice, 'SELL', commissionRate, 'STOP_LOSS', currentHighest);
      }
    }

    // 2. Check Take Profit
    if (portfolioItem.take_profit_pct && portfolioItem.take_profit_amount_pct && portfolioItem.current_lots > 0) {
      const profitTarget = portfolioItem.avg_cost * (1 + portfolioItem.take_profit_pct / 100);
      if (newPrice >= profitTarget) {
        const sellLots = Math.floor(portfolioItem.current_lots * (portfolioItem.take_profit_amount_pct / 100));
        if (sellLots > 0) {
          return await executeTrade(portfolioItem, sellLots, newPrice, 'SELL', commissionRate, 'TAKE_PROFIT', currentHighest);
        }
      }
    }

    // 3. Normal P-Control Trade
    const tradeLots = calculateTrade(
      portfolioItem.current_lots, 
      priceChangePercent, 
      kFactor, 
      deadBand, 
      stock?.current_atr, 
      stock?.adaptive_k
    );
    
    if (tradeLots === 0) {
      // Just update highest price if needed
      if (portfolioItem.id && currentHighest !== portfolioItem.highest_price) {
        await updateDoc(doc(db, 'portfolio', portfolioItem.id), { highest_price: currentHighest });
      }
      return { action: 'NONE', lots: 0 };
    }

    const type = priceChangePercent < 0 ? 'BUY' : 'SELL';
    
    // Max Position Check for BUY
    if (type === 'BUY' && stock?.max_position_pct) {
      const totalPortfolioValue = portfolioItem.allocated_capital; // Simplified: using allocated capital as base
      const currentPositionValue = portfolioItem.current_lots * newPrice;
      const maxPositionValue = totalPortfolioValue * (stock.max_position_pct / 100);
      
      if (currentPositionValue >= maxPositionValue) {
        return { action: 'NONE', lots: 0, reason: 'MAX_POSITION_REACHED' };
      }
      
      // Limit trade lots if it would exceed max position
      const remainingValue = maxPositionValue - currentPositionValue;
      const maxAllowedLots = Math.floor(remainingValue / newPrice);
      const actualTradeLots = Math.min(tradeLots, maxAllowedLots);
      
      if (actualTradeLots <= 0) return { action: 'NONE', lots: 0 };
      return await executeTrade(portfolioItem, actualTradeLots, newPrice, 'BUY', commissionRate, 'P_CONTROL', currentHighest);
    }

    return await executeTrade(portfolioItem, tradeLots, newPrice, type, commissionRate, 'P_CONTROL', currentHighest);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'portfolio');
  }
}

async function executeTrade(
  portfolioItem: PortfolioItem,
  tradeLots: number,
  price: number,
  type: 'BUY' | 'SELL',
  commissionRate: number,
  reason: string,
  highestPrice: number
) {
  const cost = tradeLots * price;
  const commission = cost * commissionRate;
  
  let newLots = portfolioItem.current_lots;
  let newReserve = portfolioItem.cash_reserve;
  let newAvgCost = portfolioItem.avg_cost;

  if (type === 'BUY') {
    newLots += tradeLots;
    newReserve -= (cost + commission);
    newAvgCost = ((portfolioItem.current_lots * portfolioItem.avg_cost) + cost) / newLots;
  } else {
    newLots -= tradeLots;
    newReserve += (cost - commission);
  }

  if (portfolioItem.id) {
    await updateDoc(doc(db, 'portfolio', portfolioItem.id), {
      current_lots: newLots,
      cash_reserve: newReserve,
      avg_cost: newAvgCost,
      highest_price: highestPrice
    });
  }

  await addDoc(collection(db, 'transactions'), {
    stock_id: portfolioItem.stock_id,
    symbol: portfolioItem.symbol,
    type,
    amount: tradeLots,
    price,
    commission,
    reason,
    timestamp: Timestamp.now()
  });

  return { action: type, lots: tradeLots, price, reason };
}

export interface BacktestResult {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  buyAndHoldReturn: number;
  trades: any[];
  equityCurve: { date: string, dynamic: number, static: number }[];
}

export async function updatePortfolioCapital(
  portfolioId: string,
  amount: number,
  type: 'DEPOSIT' | 'WITHDRAW'
) {
  try {
    const portfolioRef = doc(db, 'portfolio', portfolioId);
    const portfolioSnap = await getDoc(portfolioRef);
    
    if (!portfolioSnap.exists()) return;
    const portfolioData = portfolioSnap.data() as PortfolioItem;

    const change = type === 'DEPOSIT' ? amount : -amount;
    const currentInjected = portfolioData.injected_capital || portfolioData.allocated_capital;
    
    await updateDoc(portfolioRef, {
      injected_capital: currentInjected + change,
      cash_reserve: portfolioData.cash_reserve + change,
      last_update: Timestamp.now()
    });

    // Record transaction
    await addDoc(collection(db, 'transactions'), {
      uid: portfolioData.uid,
      stock_id: portfolioData.stock_id,
      symbol: portfolioData.symbol,
      type: type,
      amount: 0,
      price: amount,
      commission: 0,
      reason: type === 'DEPOSIT' ? 'Para Girişi' : 'Para Çıkışı',
      timestamp: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'portfolio');
  }
}

export async function getStocks(): Promise<Stock[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'stocks'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stock));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'stocks');
    return [];
  }
}

export async function fetchPriceHistory(
  stockId: string,
  startDate: string,
  endDate: string
): Promise<{ date: string, close_price: number }[]> {
  try {
    const q = query(
      collection(db, 'price_history'),
      where('stock_id', '==', stockId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      date: doc.data().date,
      close_price: doc.data().close_price
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'price_history');
    return [];
  }
}

export async function runBacktest(
  stockId: string,
  symbol: string,
  startDate: string,
  endDate: string,
  initialCapital: number,
  kFactor: number,
  deadBand: number,
  commissionRate: number,
  prices?: { date: string, close_price: number }[]
): Promise<BacktestResult> {
  let backtestPrices = prices;
  
  if (!backtestPrices) {
    backtestPrices = await fetchPriceHistory(stockId, startDate, endDate);
  }

  // Sort prices by date
  const sortedPrices = [...backtestPrices].sort((a, b) => a.date.localeCompare(b.date));
  
  if (sortedPrices.length < 2) throw new Error("Not enough price data for backtest");

  let currentLots = 0;
  let cash = initialCapital;
  let initialRatio = 0.6;
  
  // Initial Buy
  const firstPrice = sortedPrices[0].close_price;
  const buyCapital = initialCapital * initialRatio;
  currentLots = Math.floor(buyCapital / (firstPrice * (1 + commissionRate)));
  const initialCost = currentLots * firstPrice;
  const initialCommission = initialCost * commissionRate;
  cash -= (initialCost + initialCommission);
  
  const trades = [{
    date: sortedPrices[0].date,
    type: 'BUY',
    lots: currentLots,
    price: firstPrice,
    reason: 'INITIAL'
  }];

  const equityCurve = [{
    date: sortedPrices[0].date,
    dynamic: initialCapital,
    static: initialCapital
  }];

  let maxEquity = initialCapital;
  let maxDD = 0;
  let returns: number[] = [];

  for (let i = 1; i < sortedPrices.length; i++) {
    const prevPrice = sortedPrices[i-1].close_price;
    const currentPrice = sortedPrices[i].close_price;
    const priceChangePct = (currentPrice - prevPrice) / prevPrice;

    const tradeLots = calculateTrade(currentLots, priceChangePct, kFactor, deadBand);
    
    if (tradeLots > 0) {
      const type = priceChangePct < 0 ? 'BUY' : 'SELL';
      const cost = tradeLots * currentPrice;
      const commission = cost * commissionRate;

      if (type === 'BUY') {
        currentLots += tradeLots;
        cash -= (cost + commission);
      } else {
        const actualSellLots = Math.min(tradeLots, currentLots);
        if (actualSellLots > 0) {
          currentLots -= actualSellLots;
          cash += (actualSellLots * currentPrice - commission);
        }
      }

      trades.push({
        date: sortedPrices[i].date,
        type,
        lots: tradeLots,
        price: currentPrice,
        reason: 'P_CONTROL'
      });
    }

    const currentEquity = cash + (currentLots * currentPrice);
    const staticEquity = (initialCapital / firstPrice) * currentPrice;
    
    equityCurve.push({
      date: sortedPrices[i].date,
      dynamic: currentEquity,
      static: staticEquity
    });

    // Stats
    if (currentEquity > maxEquity) maxEquity = currentEquity;
    const dd = (maxEquity - currentEquity) / maxEquity;
    if (dd > maxDD) maxDD = dd;
    
    returns.push((equityCurve[i].dynamic - equityCurve[i-1].dynamic) / equityCurve[i-1].dynamic);
  }

  const totalReturn = (equityCurve[equityCurve.length-1].dynamic - initialCapital) / initialCapital;
  const buyAndHoldReturn = (equityCurve[equityCurve.length-1].static - initialCapital) / initialCapital;

  // Sharpe Ratio (simplified, assuming 0 risk-free rate)
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length);
  const sharpeRatio = stdDev !== 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

  return {
    totalReturn,
    sharpeRatio,
    maxDrawdown: maxDD,
    buyAndHoldReturn,
    trades,
    equityCurve
  };
}
