import React, { useState, useEffect, useMemo, Component } from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  ClipboardList, 
  BarChart3, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowRightLeft, 
  Settings as SettingsIcon,
  LogOut,
  LogIn,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Play,
  Database,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { 
  auth, 
  db, 
  signInWithPopup, 
  googleProvider, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  onSnapshot, 
  orderBy, 
  query, 
  limit,
  Timestamp,
  addDoc,
  updateDoc,
  doc,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  getDocs,
  where,
  linkWithPopup,
  handleFirestoreError,
  OperationType
} from './firebase';
import { 
  Stock, 
  PortfolioItem, 
  Transaction, 
  SystemSettings, 
  DEFAULT_SETTINGS,
  addStockToPortfolio,
  processDailyUpdate,
  calculateTrade,
  runBacktest,
  BacktestResult,
  UserProfile,
  BistStock,
  registerUser,
  getUserProfile,
  getPendingUsers,
  approveUser,
  getBistStocks,
  calculateKFactor,
  updatePortfolioCapital,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  seedBistStocks as seedBistStocksService,
  syncBistStocks,
  clearBistStocks,
  getBlacklist,
  updateBlacklist
} from './services/portfolioService';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Bir şeyler yanlış gitti.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Hata: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-md text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Sistem Hatası</h2>
            <p className="text-zinc-500 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold transition-all"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={cn(
        "fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl",
        type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
        type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" :
        "bg-blue-500/10 border-blue-500/20 text-blue-400"
      )}
    >
      {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
       type === 'error' ? <AlertCircle className="w-5 h-5" /> :
       <RefreshCw className="w-5 h-5 animate-spin" />}
      <p className="text-sm font-medium">{message}</p>
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const Navbar = ({ activeTab, setActiveTab, user, profile, onShowToast }: { activeTab: string, setActiveTab: (t: string) => void, user: User | null, profile: UserProfile | null, onShowToast: (m: string, t: 'success' | 'error' | 'info') => void }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'stocks', label: 'Hisseler', icon: Database },
    { id: 'portfolio', label: 'Portföy', icon: Briefcase },
    { id: 'tasks', label: 'Günlük İşlemler', icon: ClipboardList },
    { id: 'backtest', label: 'Geriye Dönük Test', icon: RefreshCw },
    { id: 'reports', label: 'K-Faktör Analizi', icon: BarChart3 },
  ];

  if (profile?.role === 'admin') {
    tabs.push({ id: 'admin', label: 'Yönetim', icon: SettingsIcon });
  }

  const handleLinkGoogle = async () => {
    if (!auth.currentUser) return;
    try {
      await linkWithPopup(auth.currentUser, googleProvider);
      onShowToast('Google hesabınız başarıyla bağlandı!', 'success');
    } catch (error: any) {
      onShowToast('Hata: ' + error.message, 'error');
    }
  };

  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 px-2 sm:px-4 py-4 sticky top-0 z-50">
      <div className="flex items-center justify-between w-full px-2 sm:px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <TrendingUp className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Mekatronik BİST</h1>
            <p className="text-zinc-500 text-[10px] sm:text-xs font-mono uppercase tracking-widest">P-Control System</p>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium",
                activeTab === tab.id 
                  ? "bg-zinc-800 text-white shadow-sm" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <div className="flex items-center gap-3 pl-4 border-l border-zinc-800">
              <div className="text-right hidden sm:block">
                <p className="text-white text-sm font-medium">{profile?.email?.split('@')[0] || 'Kullanıcı'}</p>
                <div className="flex items-center gap-2 justify-end">
                  <p className="text-zinc-500 text-xs">{profile?.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}</p>
                  {profile?.role === 'admin' && (
                    <button 
                      onClick={handleLinkGoogle}
                      className="text-[10px] text-emerald-500 hover:text-emerald-400 underline"
                    >
                      Google Bağla
                    </button>
                  )}
                </div>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors hidden sm:block"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : null}

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden mt-4 overflow-hidden border-t border-zinc-800 pt-4"
          >
            <div className="flex flex-col gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                    activeTab === tab.id 
                      ? "bg-emerald-500/10 text-emerald-500" 
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  )}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
              
              {user && (
                <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between px-4">
                  <div className="flex flex-col">
                    <p className="text-white text-sm font-medium">{profile?.email?.split('@')[0] || 'Kullanıcı'}</p>
                    <p className="text-zinc-500 text-xs">{profile?.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}</p>
                  </div>
                  <button 
                    onClick={() => signOut(auth)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-xl text-sm font-bold"
                  >
                    <LogOut className="w-4 h-4" />
                    Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Dashboard = ({ portfolio, transactions, stocks }: { portfolio: PortfolioItem[], transactions: Transaction[], stocks: Stock[] }) => {
  const totalEquity = useMemo(() => {
    return portfolio.reduce((acc, item) => {
      const stock = stocks.find(s => s.id === item.stock_id);
      const price = stock?.last_price || item.avg_cost;
      return acc + (item.current_lots * price) + item.cash_reserve;
    }, 0);
  }, [portfolio, stocks]);

  const totalInjected = useMemo(() => {
    return portfolio.reduce((acc, item) => acc + (item.injected_capital || item.allocated_capital), 0);
  }, [portfolio]);

  const totalProfit = useMemo(() => {
    return totalEquity - totalInjected;
  }, [totalEquity, totalInjected]);

  const profitPercent = useMemo(() => {
    return totalInjected > 0 ? (totalProfit / totalInjected) * 100 : 0;
  }, [totalProfit, totalInjected]);

  const monthlyProfitRate = useMemo(() => {
    const startEquity = portfolio.reduce((acc, item) => acc + (item.monthly_start_equity || item.allocated_capital), 0);
    if (startEquity === 0) return 0;
    return ((totalEquity - startEquity) / startEquity) * 100;
  }, [totalEquity, portfolio]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Wallet className="text-emerald-500 w-5 h-5" />
            </div>
            <span className="text-zinc-500 text-xs font-mono uppercase tracking-wider">Toplam Özkaynak</span>
          </div>
          <p className="text-3xl font-bold text-white">₺{totalEquity.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
          <p className="text-zinc-500 text-xs mt-1">Yatırılan: ₺{totalInjected.toLocaleString('tr-TR')}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <ArrowRightLeft className="text-blue-500 w-5 h-5" />
            </div>
            <span className="text-zinc-500 text-xs font-mono uppercase tracking-wider">Kümülatif Kâr/Zarar</span>
          </div>
          <p className={cn("text-3xl font-bold", totalProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
            ₺{totalProfit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
          <div className={cn("mt-2 flex items-center gap-1 text-sm", totalProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
            {totalProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>%{profitPercent.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <BarChart3 className="text-purple-500 w-5 h-5" />
            </div>
            <span className="text-zinc-500 text-xs font-mono uppercase tracking-wider">Aylık Getiri Oranı</span>
          </div>
          <p className={cn("text-3xl font-bold", monthlyProfitRate >= 0 ? "text-emerald-400" : "text-red-400")}>
            %{monthlyProfitRate.toFixed(2)}
          </p>
          <div className="mt-2 text-zinc-500 text-sm">
            <span>Bu ayki performans</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <SettingsIcon className="text-amber-500 w-5 h-5" />
            </div>
            <span className="text-zinc-500 text-xs font-mono uppercase tracking-wider">Aktif Hisseler</span>
          </div>
          <p className="text-3xl font-bold text-white">{portfolio.length}</p>
          <div className="mt-2 text-zinc-500 text-sm">
            <span>Sistem Atalet Modu: %1.0</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
          <h3 className="text-white font-bold mb-6 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-500" />
            Son İşlemler
          </h3>
          <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {transactions.length > 0 ? transactions.map((tx, idx) => {
              const stock = stocks.find(s => s.symbol === tx.symbol);
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={cn(
                        "p-2 rounded-lg",
                        tx.type === 'BUY' ? "bg-emerald-500/10 text-emerald-500" : 
                        tx.type === 'SELL' ? "bg-red-500/10 text-red-500" :
                        tx.type === 'DEPOSIT' ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {tx.type === 'BUY' ? <TrendingUp className="w-4 h-4" /> : 
                         tx.type === 'SELL' ? <TrendingDown className="w-4 h-4" /> :
                         tx.type === 'DEPOSIT' ? <Plus className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                      </div>
                      {tx.type !== 'DEPOSIT' && tx.type !== 'WITHDRAW' && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden">
                          <img 
                            src={stock?.logoid ? `https://s3-symbol-logo.tradingview.com/${stock.logoid}.svg` : `https://s3-symbol-logo.tradingview.com/istanbul-stock-exchange--${tx.symbol.split('.')[0]}.svg`}
                            alt={tx.symbol}
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const symbol = tx.symbol.split('.')[0];
                              if (target.src.includes('istanbul-stock-exchange')) {
                                target.src = `https://s3-symbol-logo.tradingview.com/${symbol}.svg`;
                              } else if (target.src.includes('tradingview') && !target.src.includes('istanbul-stock-exchange')) {
                                target.src = `https://raw.githubusercontent.com/fatih-yavuz/bist-logos/main/logos/${symbol}.png`;
                              } else if (target.src.includes('githubusercontent')) {
                                target.src = `https://ui-avatars.com/api/?name=${symbol}&background=18181b&color=10b981&bold=true&size=64`;
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">{tx.symbol}</p>
                      <p className="text-zinc-500 text-xs">{tx.timestamp.toDate().toLocaleString('tr-TR')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-bold", 
                      tx.type === 'BUY' || tx.type === 'DEPOSIT' ? "text-emerald-400" : "text-red-400"
                    )}>
                      {tx.type === 'BUY' || tx.type === 'SELL' ? `${tx.amount} Lot` : `₺${tx.price.toLocaleString('tr-TR')}`}
                    </p>
                    <p className="text-zinc-500 text-xs">
                      {tx.type === 'BUY' || tx.type === 'SELL' ? `₺${tx.price.toFixed(2)} / Lot` : tx.reason}
                    </p>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-10 text-zinc-500">
                Henüz işlem bulunmuyor.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PortfolioManager = ({ portfolio, stocks, user }: { portfolio: PortfolioItem[], stocks: Stock[], user: User | null }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isManagingCash, setIsManagingCash] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState(0);
  const [bistStocks, setBistStocks] = useState<BistStock[]>([]);
  const [newStock, setNewStock] = useState({
    symbol: '',
    name: '',
    capital: 10000,
    k: 1.75,
    price: 0,
    adaptive_k: false,
    atr: 2.5,
    max_pos: 20,
    trailing_stop: 5,
    take_profit: 15,
    tp_amount: 50,
    initial_ratio: 0.6,
    logoid: null as string | null
  });

  useEffect(() => {
    getBistStocks().then(setBistStocks);
  }, []);

  const handleCashUpdate = async (type: 'DEPOSIT' | 'WITHDRAW') => {
    if (!isManagingCash || cashAmount <= 0) return;
    await updatePortfolioCapital(isManagingCash, cashAmount, type);
    setIsManagingCash(null);
    setCashAmount(0);
  };

  const calculations = useMemo(() => {
    const buyCapital = newStock.capital * newStock.initial_ratio;
    const reserveCapital = newStock.capital * (1 - newStock.initial_ratio);
    const commissionRate = 0.0004;
    const lots = newStock.price > 0 ? Math.floor(buyCapital / (newStock.price * (1 + commissionRate))) : 0;
    const actualCost = lots * newStock.price;
    const commission = actualCost * commissionRate;
    
    return {
      lots,
      reserve: reserveCapital - commission,
      buyCapital: actualCost
    };
  }, [newStock.capital, newStock.initial_ratio, newStock.price]);

  const handleAdd = async () => {
    if (!newStock.symbol || newStock.price <= 0 || !user) return;
    
    const stockData: Stock = {
      symbol: newStock.symbol,
      name: newStock.name || newStock.symbol,
      sector: 'Genel',
      current_k: newStock.k,
      adaptive_k: newStock.adaptive_k,
      current_atr: newStock.atr,
      max_position_pct: newStock.max_pos,
      is_active: true,
      last_price: newStock.price,
      logoid: newStock.logoid
    };

    const riskSettings = {
      trailing_stop_pct: newStock.trailing_stop,
      take_profit_pct: newStock.take_profit,
      take_profit_amount_pct: newStock.tp_amount
    };

    await addStockToPortfolio(user.uid, stockData, newStock.capital, newStock.initial_ratio, 0.0004, riskSettings);
    setIsAdding(false);
    setNewStock({ 
      symbol: '', name: '', capital: 10000, k: 1.75, price: 0, 
      adaptive_k: false, atr: 2.5, max_pos: 20,
      trailing_stop: 5, take_profit: 15, tp_amount: 50,
      initial_ratio: 0.6,
      logoid: null
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Portföy Yönetimi</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Yeni Hisse Ekle
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl"
          >
            <h3 className="text-white font-bold mb-4">Hisse Kurulumu & Risk Yönetimi</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="space-y-1">
                <label className="text-zinc-500 text-xs uppercase font-mono">Hisse Seçin</label>
                <select 
                  value={newStock.symbol}
                  onChange={e => {
                    const s = bistStocks.find(x => x.symbol === e.target.value);
                    setNewStock({...newStock, symbol: e.target.value, name: s?.name || '', price: s?.last_price || 0, logoid: s?.logoid || null});
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Seçiniz...</option>
                  {bistStocks.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 text-xs uppercase font-mono">Sermaye (TL)</label>
                <input 
                  type="number" 
                  value={newStock.capital}
                  onChange={e => setNewStock({...newStock, capital: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 text-xs uppercase font-mono">Fiyat (TL)</label>
                <input 
                  type="number" 
                  value={newStock.price}
                  onChange={e => setNewStock({...newStock, price: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 text-xs uppercase font-mono">Başlangıç Oranı (Buy)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0.1"
                  max="0.9"
                  value={newStock.initial_ratio}
                  onChange={e => setNewStock({...newStock, initial_ratio: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 text-xs uppercase font-mono">K Katsayısı</label>
                <input 
                  type="number" 
                  step="0.05"
                  value={newStock.k}
                  onChange={e => setNewStock({...newStock, k: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 text-xs uppercase font-mono">ATR (Volatilite)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={newStock.atr}
                  onChange={e => setNewStock({...newStock, atr: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              
              {/* Calculations Display */}
              <div className="lg:col-span-6 bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-zinc-500 text-[10px] uppercase font-mono">Alınacak Lot</p>
                  <p className="text-emerald-400 font-bold text-lg">{calculations.lots} Lot</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-[10px] uppercase font-mono">Yedek Akçe</p>
                  <p className="text-amber-400 font-bold text-lg">₺{calculations.reserve.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-[10px] uppercase font-mono">Alım Tutarı</p>
                  <p className="text-white font-bold text-lg">₺{calculations.buyCapital.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500 text-xs uppercase font-mono">Max Pozisyon (%)</label>
                <input 
                  type="number" 
                  value={newStock.max_pos}
                  onChange={e => setNewStock({...newStock, max_pos: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 text-xs uppercase font-mono">Trailing Stop (%)</label>
                <input 
                  type="number" 
                  value={newStock.trailing_stop}
                  onChange={e => setNewStock({...newStock, trailing_stop: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 text-xs uppercase font-mono">Take Profit (%)</label>
                <input 
                  type="number" 
                  value={newStock.take_profit}
                  onChange={e => setNewStock({...newStock, take_profit: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 text-xs uppercase font-mono">TP Satış (%)</label>
                <input 
                  type="number" 
                  value={newStock.tp_amount}
                  onChange={e => setNewStock({...newStock, tp_amount: Number(e.target.value)})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input 
                  type="checkbox" 
                  id="adaptive_k"
                  checked={newStock.adaptive_k}
                  onChange={e => setNewStock({...newStock, adaptive_k: e.target.checked})}
                  className="w-4 h-4 accent-emerald-500"
                />
                <label htmlFor="adaptive_k" className="text-white text-xs font-medium">Adaptif K</label>
              </div>
              <div className="flex items-end gap-2 lg:col-span-2">
                <button 
                  onClick={handleAdd}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-10 rounded-lg font-medium transition-all"
                >
                  Onayla
                </button>
                <button 
                  onClick={() => setIsAdding(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 h-10 px-4 rounded-lg transition-all"
                >
                  İptal
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isManagingCash && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl w-full max-w-md">
              <h3 className="text-2xl font-bold text-white mb-2">Nakit Yönetimi</h3>
              <p className="text-zinc-500 text-sm mb-6">Portföye para ekleyin veya portföyden para çekin.</p>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-zinc-500 text-xs uppercase font-mono">Tutar (TL)</label>
                  <input 
                    type="number" 
                    value={cashAmount}
                    onChange={e => setCashAmount(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-emerald-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button 
                    onClick={() => handleCashUpdate('DEPOSIT')}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Para Yatır
                  </button>
                  <button 
                    onClick={() => handleCashUpdate('WITHDRAW')}
                    className="bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-5 h-5" />
                    Para Çek
                  </button>
                </div>
                
                <button 
                  onClick={() => setIsManagingCash(null)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 py-3 rounded-xl font-medium transition-all mt-2"
                >
                  İptal
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4">
        {portfolio.map((item) => {
          const stock = stocks.find(s => s.id === item.stock_id);
          const currentVal = item.current_lots * (stock?.last_price || item.avg_cost);
          const totalVal = currentVal + item.cash_reserve;
          const invested = item.injected_capital || item.allocated_capital;
          const profit = totalVal - invested;
          const profitPct = (profit / invested) * 100;

          return (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden border border-zinc-700">
                  <img 
                    src={stock?.logoid ? `https://s3-symbol-logo.tradingview.com/${stock.logoid}.svg` : `https://s3-symbol-logo.tradingview.com/istanbul-stock-exchange--${item.symbol.split('.')[0]}.svg`}
                    alt={item.symbol}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const symbol = item.symbol.split('.')[0];
                      if (target.src.includes('istanbul-stock-exchange')) {
                        target.src = `https://s3-symbol-logo.tradingview.com/${symbol}.svg`;
                      } else if (target.src.includes('tradingview') && !target.src.includes('istanbul-stock-exchange')) {
                        target.src = `https://raw.githubusercontent.com/fatih-yavuz/bist-logos/main/logos/${symbol}.png`;
                      } else if (target.src.includes('githubusercontent')) {
                        target.src = `https://ui-avatars.com/api/?name=${symbol}&background=18181b&color=10b981&bold=true&size=64`;
                      }
                    }}
                  />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg">{item.symbol}</h4>
                  <p className="text-zinc-500 text-sm">{stock?.name || 'Hisse Senedi'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1 w-full">
                <div>
                  <p className="text-zinc-500 text-xs uppercase font-mono mb-1">Mevcut Lot</p>
                  <p className="text-white font-bold">{item.current_lots} Lot</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase font-mono mb-1">Maliyet</p>
                  <p className="text-white font-bold">₺{item.avg_cost.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase font-mono mb-1">Yedek Akçe</p>
                  <p className={cn("font-bold", item.cash_reserve < 0 ? "text-red-400" : "text-emerald-400")}>
                    ₺{item.cash_reserve.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </p>
                  {item.cash_reserve < 0 && (
                    <p className="text-[10px] text-red-500 uppercase font-bold mt-1 animate-pulse">Likit Enjeksiyonu Gerekli!</p>
                  )}
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase font-mono mb-1">K/Z</p>
                  <div className={cn("flex items-center gap-1 font-bold", profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>%{profitPct.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={() => setIsManagingCash(item.id!)}
                  className="flex-1 md:flex-none px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-all border border-zinc-700"
                >
                  Nakit Yönetimi
                </button>
                <button className="flex-1 md:flex-none px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-all border border-zinc-700">
                  K Ayarla
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DailyTasks = ({ portfolio, stocks }: { portfolio: PortfolioItem[], stocks: Stock[] }) => {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const initialPrices: Record<string, number> = {};
    stocks.forEach(s => {
      initialPrices[s.symbol] = s.last_price;
    });
    setPrices(initialPrices);
  }, [stocks]);

  const generateOrders = () => {
    const newOrders = portfolio.map(item => {
      const stock = stocks.find(s => s.id === item.stock_id);
      if (!stock) return null;

      const newPrice = prices[item.symbol] || stock.last_price;
      const priceChangePercent = (newPrice - stock.last_price) / stock.last_price;
      
      const tradeLots = calculateTrade(item.current_lots, priceChangePercent, stock.current_k, 0.01);
      
      if (tradeLots === 0) return null;

      return {
        id: item.id,
        portfolioItem: item,
        symbol: item.symbol,
        type: priceChangePercent < 0 ? 'BUY' : 'SELL',
        lots: tradeLots,
        price: newPrice,
        change: priceChangePercent * 100
      };
    }).filter(Boolean);

    setOrders(newOrders);
  };

  const confirmOrder = async (order: any) => {
    setIsProcessing(true);
    const stock = stocks.find(s => s.id === order.portfolioItem.stock_id);
    await processDailyUpdate(
      order.portfolioItem,
      order.price,
      stock?.current_k || 1,
      0.01,
      0.0004,
      stock
    );
    // Update stock last price
    if (order.portfolioItem.stock_id) {
      await updateDoc(doc(db, 'stocks', order.portfolioItem.stock_id), {
        last_price: order.price
      });
    }
    setOrders(orders.filter(o => o.id !== order.id));
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-emerald-500" />
            Günlük Fiyat Güncelleme
          </h3>
          <button 
            onClick={generateOrders}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-lg shadow-emerald-500/20"
          >
            Emirleri Hesapla
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {stocks.map(stock => (
            <div key={stock.id} className="bg-zinc-800/50 border border-zinc-700/50 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold">{stock.symbol}</span>
                <span className="text-zinc-500 text-xs">Son: ₺{stock.last_price.toFixed(2)}</span>
              </div>
              <input 
                type="number" 
                step="0.01"
                value={prices[stock.symbol] || ''}
                onChange={e => setPrices({...prices, [stock.symbol]: Number(e.target.value)})}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
                placeholder="Yeni Fiyat"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-white font-bold px-2">Bekleyen Emirler</h3>
        {orders.length > 0 ? orders.map((order, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                order.type === 'BUY' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
              )}>
                {order.type === 'BUY' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-white font-bold">{order.symbol}</p>
                <p className={cn("text-xs", order.change < 0 ? "text-red-400" : "text-emerald-400")}>
                  Değişim: %{order.change.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex-1 px-10">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <p className="text-zinc-500 text-[10px] uppercase font-mono">Talimat</p>
                  <p className={cn("font-bold", order.type === 'BUY' ? "text-emerald-400" : "text-red-400")}>
                    {order.lots} Lot {order.type === 'BUY' ? 'AL' : 'SAT'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-zinc-500 text-[10px] uppercase font-mono">Fiyat</p>
                  <p className="text-white font-bold">₺{order.price.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <button 
              disabled={isProcessing}
              onClick={() => confirmOrder(order)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all border border-zinc-700 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Onayla
            </button>
          </motion.div>
        )) : (
          <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl py-12 text-center text-zinc-500">
            Bekleyen emir bulunmuyor. Fiyatları güncelleyip "Emirleri Hesapla" butonuna basın.
          </div>
        )}
      </div>
    </div>
  );
};

const BacktestModule = ({ stocks, onShowToast }: { stocks: Stock[], onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void }) => {
  const [selectedStockId, setSelectedStockId] = useState('');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [capital, setCapital] = useState(100000);
  const [k, setK] = useState(1.75);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (stocks.length > 0 && !selectedStockId) {
      setSelectedStockId(stocks[0].id || '');
    }
  }, [stocks]);

  const handleRun = async () => {
    if (!selectedStockId) return;
    setLoading(true);
    
    try {
      const stock = stocks.find(s => s.id === selectedStockId);
      if (!stock) return;

      const res = await runBacktest(
        selectedStockId,
        stock.symbol,
        startDate,
        endDate,
        capital,
        k,
        0.01,
        0.0004
      );
      setResult(res);
    } catch (e) {
      console.error(e);
      onShowToast("Backtest failed: " + (e instanceof Error ? e.message : "Unknown error"), 'error');
    } finally {
      setLoading(false);
    }
  };

  const seedSampleData = async () => {
    if (!selectedStockId) return;
    setLoading(true);
    try {
      const samplePrices = [];
      let currentPrice = 100;
      const start = new Date('2025-01-01');
      for (let i = 0; i < 60; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        currentPrice = currentPrice * (1 + (Math.random() * 0.04 - 0.02));
        samplePrices.push({
          stock_id: selectedStockId,
          date: date.toISOString().split('T')[0],
          close_price: currentPrice
        });
      }

      for (const p of samplePrices) {
        await addDoc(collection(db, 'price_history'), p);
      }
      onShowToast("Sample data seeded for " + stocks.find(s => s.id === selectedStockId)?.symbol, 'success');
    } catch (error) {
      console.error(error);
      onShowToast("Sample data seeding failed", 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <h3 className="text-white font-bold mb-6 flex items-center gap-2">
          <Play className="w-5 h-5 text-emerald-500" />
          Backtest Simülasyonu
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="space-y-1">
            <label className="text-zinc-500 text-xs uppercase font-mono">Hisse Seçin</label>
            <select 
              value={selectedStockId}
              onChange={e => setSelectedStockId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              {stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} - {s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-zinc-500 text-xs uppercase font-mono">Başlangıç Tarihi</label>
            <input 
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-zinc-500 text-xs uppercase font-mono">Bitiş Tarihi</label>
            <input 
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-zinc-500 text-xs uppercase font-mono">Başlangıç Sermayesi</label>
            <input 
              type="number" 
              value={capital}
              onChange={e => setCapital(Number(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-zinc-500 text-xs uppercase font-mono">K Katsayısı</label>
            <input 
              type="number" 
              step="0.1"
              value={k}
              onChange={e => setK(Number(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button 
              onClick={handleRun}
              disabled={loading || !selectedStockId}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-10 rounded-lg font-medium transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              {loading ? 'Simüle Ediliyor...' : 'Simülasyonu Başlat'}
            </button>
            <button
              onClick={seedSampleData}
              disabled={loading || !selectedStockId}
              title="60 günlük örnek fiyat verisi oluştur"
              className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <Database className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
              <p className="text-zinc-500 text-xs uppercase font-mono mb-1">Toplam Getiri</p>
              <p className={cn("text-2xl font-bold", result.totalReturn >= 0 ? "text-emerald-400" : "text-red-400")}>
                %{ (result.totalReturn * 100).toFixed(2) }
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
              <p className="text-zinc-500 text-xs uppercase font-mono mb-1">Sharpe Oranı</p>
              <p className="text-2xl font-bold text-white">{ result.sharpeRatio.toFixed(2) }</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
              <p className="text-zinc-500 text-xs uppercase font-mono mb-1">Maksimum Düşüş</p>
              <p className="text-2xl font-bold text-red-400">%{ (result.maxDrawdown * 100).toFixed(2) }</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
              <p className="text-zinc-500 text-xs uppercase font-mono mb-1">Al ve Tut</p>
              <p className={cn("text-2xl font-bold", result.buyAndHoldReturn >= 0 ? "text-emerald-400" : "text-red-400")}>
                %{ (result.buyAndHoldReturn * 100).toFixed(2) }
              </p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
            <h3 className="text-white font-bold mb-6">Özkaynak Eğrisi</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                  <YAxis stroke="#71717a" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }} />
                  <Legend />
                  <Line type="monotone" dataKey="dynamic" name="P-Kontrol" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="static" name="Al ve Tut" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const Reports = ({ stocks }: { stocks: Stock[] }) => {
  const [selectedStockId, setSelectedStockId] = useState('');
  const [analysis, setAnalysis] = useState<{ k: number, stats: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const handleAnalyze = async () => {
    if (!selectedStockId) return;
    setLoading(true);
    try {
      const res = await calculateKFactor(selectedStockId);
      setAnalysis(res);
      
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      const startStr = startDate.toISOString().split('T')[0];
      
      const prices = await getDocs(query(
        collection(db, 'price_history'),
        where('stock_id', '==', selectedStockId),
        where('date', '>=', startStr),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      ));
      setHistory(prices.docs.map(doc => doc.data()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <h3 className="text-white font-bold mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-500" />
          K-Faktör Analizi (2 Yıllık Veri)
        </h3>
        <div className="flex gap-4 items-end mb-8">
          <div className="flex-1 space-y-1">
            <label className="text-zinc-500 text-xs uppercase font-mono">Hisse Seçin</label>
            <select 
              value={selectedStockId}
              onChange={e => setSelectedStockId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">Seçiniz...</option>
              {stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} - {s.name}</option>)}
            </select>
          </div>
          <button 
            onClick={handleAnalyze}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
          >
            {loading ? 'Analiz Ediliyor...' : 'Analiz Et'}
          </button>
        </div>

        {analysis && analysis.stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-[400px] w-full bg-zinc-800/30 p-4 rounded-xl border border-zinc-800">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    />
                    <Line type="monotone" dataKey="close_price" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700/50">
                <p className="text-zinc-500 text-xs uppercase font-mono mb-2">Önerilen K Faktörü</p>
                <p className="text-4xl font-bold text-emerald-400">{analysis.k.toFixed(2)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-mono mb-1">Min Fiyat</p>
                  <p className="text-white font-bold">₺{analysis.stats.min.toFixed(2)}</p>
                </div>
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-mono mb-1">Max Fiyat</p>
                  <p className="text-white font-bold">₺{analysis.stats.max.toFixed(2)}</p>
                </div>
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-mono mb-1">Ortalama</p>
                  <p className="text-white font-bold">₺{analysis.stats.avg.toFixed(2)}</p>
                </div>
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                  <p className="text-zinc-500 text-[10px] uppercase font-mono mb-1">Trend</p>
                  <p className={cn("font-bold", analysis.stats.trend === 'UP' ? "text-emerald-400" : "text-red-400")}>
                    {analysis.stats.trend === 'UP' ? 'Yükseliş' : 'Düşüş'}
                  </p>
                </div>
              </div>
              <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                <p className="text-zinc-500 text-[10px] uppercase font-mono mb-1">Volatilite (Std Dev)</p>
                <p className="text-white font-bold">%{ (analysis.stats.volatility * 100).toFixed(2) }</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BistStocksExplorer = ({ onSelectStock, isAdmin, onShowToast }: { onSelectStock: (s: BistStock) => void, isAdmin: boolean, onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void }) => {
  const [bistStocks, setBistStocks] = useState<BistStock[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSorting, setIsSorting] = useState(false);
  const [displayStocks, setDisplayStocks] = useState<BistStock[]>([]);
  const [sortBy, setSortBy] = useState<'symbol_asc' | 'symbol_desc' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'change_asc' | 'change_desc' | 'volume_asc' | 'volume_desc'>('symbol_asc');

  const [isSeeding, setIsSeeding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const { addedCount, updatedCount } = await syncBistStocks();
      onShowToast(`${addedCount} yeni hisse eklendi, ${updatedCount} hisse güncellendi.`, 'success');
      fetchStocks();
    } catch (error: any) {
      onShowToast("Hata: " + error.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetAndSync = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await clearBistStocks();
      onShowToast("Hisse listesi temizlendi, yeni veriler çekiliyor...", 'info');
      const { addedCount } = await syncBistStocks();
      onShowToast(`${addedCount} hisse başarıyla eklendi.`, 'success');
      fetchStocks();
    } catch (error: any) {
      onShowToast("Hata: " + error.message, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const toggleSort = (key: 'symbol' | 'name' | 'price' | 'change' | 'volume') => {
    let newSort: any;
    if (sortBy.startsWith(key)) {
      newSort = sortBy.endsWith('_asc') ? `${key}_desc` : `${key}_asc`;
    } else {
      newSort = `${key}_asc`;
    }
    setSortBy(newSort);
  };

  const getSortIcon = (key: 'symbol' | 'name' | 'price' | 'change' | 'volume') => {
    if (!sortBy.startsWith(key)) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
    return sortBy.endsWith('_asc') ? <ArrowUp className="w-3 h-3 ml-1 text-emerald-500 inline" /> : <ArrowDown className="w-3 h-3 ml-1 text-emerald-500 inline" />;
  };

  const fetchStocks = async () => {
    try {
      setLoading(true);
      const stocks = await getBistStocks();
      setBistStocks(stocks);
    } catch (error) {
      console.error("Hisse çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (isSeeding) return;
    setIsSeeding(true);
    try {
      const count = await seedBistStocksService();
      onShowToast(`${count} yeni hisse eklendi.`, 'success');
      fetchStocks();
    } catch (error: any) {
      onShowToast("Hata: " + error.message, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, []);

  const filteredAndSorted = useMemo(() => {
    let result = bistStocks.filter(s => 
      (s.symbol.toLowerCase().includes(search.toLowerCase()) || 
      s.name.toLowerCase().includes(search.toLowerCase())) &&
      (s.last_price && s.last_price > 0) // Filter out 0 price stocks
    );

    if (sortBy === 'price_asc') {
      result.sort((a, b) => (a.last_price || 0) - (b.last_price || 0));
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => (b.last_price || 0) - (a.last_price || 0));
    } else if (sortBy === 'name_asc') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name_desc') {
      result.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'change_asc') {
      result.sort((a, b) => (a.daily_change || 0) - (b.daily_change || 0));
    } else if (sortBy === 'change_desc') {
      result.sort((a, b) => (b.daily_change || 0) - (a.daily_change || 0));
    } else if (sortBy === 'volume_asc') {
      result.sort((a, b) => (a.volume || 0) - (b.volume || 0));
    } else if (sortBy === 'volume_desc') {
      result.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    } else if (sortBy === 'symbol_desc') {
      result.sort((a, b) => b.symbol.localeCompare(a.symbol));
    } else {
      result.sort((a, b) => a.symbol.localeCompare(b.symbol));
    }

    return result;
  }, [bistStocks, search, sortBy]);

  useEffect(() => {
    if (loading) return;
    setIsSorting(true);
    const timer = setTimeout(() => {
      setDisplayStocks(filteredAndSorted);
      setIsSorting(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [filteredAndSorted, loading]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">BİST Hisseleri ({filteredAndSorted.length})</h2>
        
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative w-full md:w-80">
            <input 
              type="text"
              placeholder="Hisse ara (örn: THYAO)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500 transition-all pl-10"
            />
            <Database className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
          </div>

          <select 
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
          >
            <option value="symbol_asc">Sembol (A-Z)</option>
            <option value="symbol_desc">Sembol (Z-A)</option>
            <option value="name_asc">Ad (A-Z)</option>
            <option value="name_desc">Ad (Z-A)</option>
            <option value="price_asc">Fiyat (Artan)</option>
            <option value="price_desc">Fiyat (Azalan)</option>
            <option value="change_asc">Değişim (Artan)</option>
            <option value="change_desc">Değişim (Azalan)</option>
            <option value="volume_asc">Hacim (Artan)</option>
            <option value="volume_desc">Hacim (Azalan)</option>
          </select>

          {isAdmin && (
            <div className="flex gap-2">
              <button 
                onClick={handleResetAndSync}
                disabled={isResetting || isSyncing}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap text-sm border border-red-500/20"
                title="Tüm Listeyi Sil ve Yeniden Çek"
              >
                {isResetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                {isResetting ? 'Sıfırlanıyor...' : 'Listeyi Sıfırla'}
              </button>
              <button 
                onClick={handleSync}
                disabled={isSyncing || isResetting}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap text-sm"
                title="Verileri Senkronize Et"
              >
                {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isSyncing ? 'Senkronize Ediliyor...' : 'Verileri Güncelle'}
              </button>
            </div>
          )}
        </div>
      </div>

      {loading || isSorting ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
          <p className="text-zinc-500 animate-pulse font-medium">Hisseler güncelleniyor...</p>
        </div>
      ) : displayStocks.length > 0 ? (
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead className="z-30">
              <tr className="text-zinc-400 text-[10px] uppercase tracking-wider font-mono">
                <th 
                  className="sticky top-[73px] z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-1 sm:px-2 py-4 font-bold cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('symbol')}
                >
                  Hisse {getSortIcon('symbol')}
                </th>
                <th 
                  className="sticky top-[73px] z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-2 py-4 font-bold cursor-pointer hover:text-white transition-colors hidden sm:table-cell"
                  onClick={() => toggleSort('name')}
                >
                  Hisse Adı {getSortIcon('name')}
                </th>
                <th 
                  className="sticky top-[73px] z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 w-16 sm:w-28 px-1 sm:px-2 py-4 font-bold text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('price')}
                >
                  Fiyat {getSortIcon('price')}
                </th>
                <th 
                  className="sticky top-[73px] z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 w-16 sm:w-28 px-1 sm:px-2 py-4 font-bold text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('change')}
                >
                  <span className="hidden sm:inline">Değişim</span>
                  <span className="sm:hidden">%</span>
                  {getSortIcon('change')}
                </th>
                <th 
                  className="sticky top-[73px] z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 w-20 sm:w-32 px-1 sm:px-2 py-4 font-bold text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('volume')}
                >
                  Hacim {getSortIcon('volume')}
                </th>
                <th className="sticky top-[73px] z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 w-6 sm:w-10 px-1 py-4 font-bold"></th>
              </tr>
            </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {displayStocks.map((stock, index) => (
                  <motion.tr
                    key={stock.id || stock.symbol}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => onSelectStock(stock)}
                    className="hover:bg-emerald-500/10 cursor-pointer group transition-all duration-150 relative overflow-hidden"
                  >
                    <td className="px-1 sm:px-2 py-3 relative z-10">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-zinc-600 text-[9px] font-mono w-4 hidden sm:inline">{index + 1}</span>
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700 group-hover:border-emerald-500/50 transition-all shadow-sm flex-shrink-0">
                          <img 
                            src={stock.logoid ? `https://s3-symbol-logo.tradingview.com/${stock.logoid}.svg` : `https://s3-symbol-logo.tradingview.com/istanbul-stock-exchange--${stock.symbol.split('.')[0]}.svg`}
                            alt={stock.symbol}
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const symbol = stock.symbol.split('.')[0];
                              
                              // Fallback chain:
                              // 1. TradingView s3 (specific logoid)
                              // 2. TradingView s3 (istanbul-stock-exchange--SYMBOL)
                              // 3. TradingView s3 (SYMBOL)
                              // 4. GitHub bist-logos
                              // 5. UI Avatars
                              
                              if (target.src.includes('istanbul-stock-exchange')) {
                                target.src = `https://s3-symbol-logo.tradingview.com/${symbol}.svg`;
                              } else if (target.src.includes('tradingview') && !target.src.includes('istanbul-stock-exchange')) {
                                target.src = `https://raw.githubusercontent.com/fatih-yavuz/bist-logos/main/logos/${symbol}.png`;
                              } else if (target.src.includes('githubusercontent')) {
                                target.src = `https://ui-avatars.com/api/?name=${symbol}&background=18181b&color=10b981&bold=true&size=64`;
                              }
                            }}
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-white font-bold text-[11px] sm:text-sm group-hover:text-emerald-400 transition-colors truncate">
                            {stock.symbol.replace('.IS', '')}
                          </span>
                          <span className="text-zinc-500 text-[9px] truncate block max-w-[60px] sm:hidden">
                            {stock.name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 relative z-10 hidden sm:table-cell">
                      <span className="text-zinc-300 text-sm truncate block w-full max-w-[150px]">{stock.name}</span>
                    </td>
                    <td className="px-1 sm:px-2 py-3 text-right relative z-10">
                      <span className="text-white font-mono text-[11px] sm:text-sm">₺{(stock.last_price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-1 sm:px-2 py-3 text-right relative z-10">
                      {stock.daily_change !== undefined && (
                        <span className={cn(
                          "text-[9px] sm:text-xs font-mono font-bold px-1 py-0.5 rounded",
                          stock.daily_change >= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
                        )}>
                          {stock.daily_change >= 0 ? '+' : ''}{stock.daily_change.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="px-1 sm:px-2 py-3 text-right relative z-10">
                      <span className="text-zinc-400 font-mono text-[9px] sm:text-[10px]">
                        {stock.volume ? (
                          stock.volume >= 1000000000 ? `${(stock.volume / 1000000000).toFixed(1)}Mlr` :
                          stock.volume >= 1000000 ? `${(stock.volume / 1000000).toFixed(1)}Mn` :
                          stock.volume >= 1000 ? `${(stock.volume / 1000).toFixed(1)}B` :
                          stock.volume
                        ) : '0'}
                      </span>
                    </td>
                    <td className="px-1 py-3 text-right relative z-10">
                      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-zinc-700 group-hover:text-emerald-500 transition-colors inline" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
        </div>

      ) : (
        <div className="text-center py-20 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl">
          <Database className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
          <p className="text-zinc-500 mb-4">Henüz hisse verisi bulunmuyor.</p>
          {isAdmin && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={fetchStocks}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Yenile
              </button>
              <button 
                onClick={handleSync}
                disabled={isSyncing}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2"
              >
                {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isSyncing ? 'Güncelleniyor...' : 'TradingView ile Senkronize Et'}
              </button>
              <button 
                onClick={handleSeed}
                disabled={isSeeding}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2"
              >
                {isSeeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {isSeeding ? 'Oluşturuluyor...' : 'BIST Listesini Oluştur'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StockDetail = ({ stock, onBack }: { stock: BistStock, onBack: () => void }) => {
  const [analysis, setAnalysis] = useState<{ k: number, stats: any } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Hisse ID bul (symbol ile)
        const stocksSnap = await getDocs(query(collection(db, 'stocks'), where('symbol', '==', stock.symbol)));
        let stockId = '';
        
        if (!stocksSnap.empty) {
          stockId = stocksSnap.docs[0].id;
          const res = await calculateKFactor(stockId);
          setAnalysis(res);

          const endDate = new Date().toISOString().split('T')[0];
          const startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          const startStr = startDate.toISOString().split('T')[0];
          
          const prices = await getDocs(query(
            collection(db, 'price_history'),
            where('stock_id', '==', stockId),
            where('date', '>=', startStr),
            where('date', '<=', endDate),
            orderBy('date', 'asc')
          ));
          setHistory(prices.docs.map(doc => doc.data()));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [stock]);

  return (
    <div className="space-y-6">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-4"
      >
        <LayoutDashboard className="w-4 h-4" />
        Listeye Geri Dön
      </button>

      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden border border-zinc-700 shadow-lg shadow-emerald-500/20">
              <img 
                src={stock.logoid ? `https://s3-symbol-logo.tradingview.com/${stock.logoid}.svg` : `https://raw.githubusercontent.com/fatih-yavuz/bist-logos/main/logos/${stock.symbol.split('.')[0]}.png`}
                alt={stock.symbol}
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const symbol = stock.symbol.split('.')[0];
                  if (stock.logoid && target.src.includes(stock.logoid)) {
                    target.src = `https://raw.githubusercontent.com/fatih-yavuz/bist-logos/main/logos/${symbol}.png`;
                  } else if (target.src.includes('githubusercontent')) {
                    target.src = `https://s3-symbol-logo.tradingview.com/istanbul-stock-exchange--${symbol}.svg`;
                  } else if (target.src.includes('tradingview')) {
                    target.src = `https://s3-symbol-logo.tradingview.com/${symbol}.svg`;
                  } else {
                    target.src = `https://ui-avatars.com/api/?name=${symbol}&background=18181b&color=10b981&bold=true`;
                  }
                }}
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">{stock.symbol.replace('.IS', '')}</h2>
              <p className="text-zinc-500">{stock.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Portföye Ekle
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : analysis ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-zinc-800/20 p-6 rounded-2xl border border-zinc-800">
                <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                  Fiyat Grafiği (1 Yıllık)
                </h3>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                      />
                      <Area type="monotone" dataKey="close_price" stroke="#10b981" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-zinc-800/40 p-6 rounded-2xl border border-zinc-800">
                <p className="text-zinc-500 text-xs uppercase font-mono mb-2">Önerilen K Faktörü</p>
                <p className="text-5xl font-bold text-emerald-400">{analysis.k.toFixed(2)}</p>
                <p className="text-zinc-500 text-xs mt-4 leading-relaxed">
                  Bu değer, hissenin son 2 yıllık volatilite verilerine göre P-Kontrol algoritması için optimize edilmiştir.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="bg-zinc-800/40 p-5 rounded-2xl border border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-zinc-500 text-[10px] uppercase font-mono mb-1">Volatilite</p>
                    <p className="text-white font-bold text-lg">%{ (analysis.stats.volatility * 100).toFixed(2) }</p>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <RefreshCw className="text-blue-500 w-5 h-5" />
                  </div>
                </div>
                <div className="bg-zinc-800/40 p-5 rounded-2xl border border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-zinc-500 text-[10px] uppercase font-mono mb-1">Trend Yönü</p>
                    <p className={cn("font-bold text-lg", analysis.stats.trend === 'UP' ? "text-emerald-400" : "text-red-400")}>
                      {analysis.stats.trend === 'UP' ? 'Yükseliş' : 'Düşüş'}
                    </p>
                  </div>
                  <div className={cn("p-2 rounded-lg", analysis.stats.trend === 'UP' ? "bg-emerald-500/10" : "bg-red-500/10")}>
                    {analysis.stats.trend === 'UP' ? <TrendingUp className="w-5 h-5 text-emerald-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-zinc-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Bu hisse için henüz analiz verisi bulunmuyor.</p>
            <p className="text-sm">Analiz için hissenin sistemde kayıtlı olması ve fiyat geçmişinin bulunması gerekir.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminPanel = ({ onShowToast }: { onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [blacklistText, setBlacklistText] = useState('');
  const [isSavingBlacklist, setIsSavingBlacklist] = useState(false);

  const fetchUsers = async () => {
    const allUsers = await getAllUsers();
    setUsers(allUsers);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    const fetchBlacklist = async () => {
      const list = await getBlacklist();
      setBlacklistText(list.join('\n'));
    };
    fetchBlacklist();
  }, []);

  const handleStatusToggle = async (uid: string, currentStatus: string) => {
    const newStatus = currentStatus === 'approved' ? 'pending' : 'approved';
    await updateUserStatus(uid, newStatus);
    fetchUsers();
  };

  const handleRoleToggle = async (uid: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await updateUserRole(uid, newRole);
    fetchUsers();
  };

  const handleSaveBlacklist = async () => {
    setIsSavingBlacklist(true);
    try {
      const symbols = blacklistText.split('\n').map(s => s.trim()).filter(s => s !== '');
      await updateBlacklist(symbols);
      onShowToast("İstenmeyen liste güncellendi.", 'success');
    } catch (error) {
      onShowToast("Liste güncellenirken hata oluştu.", 'error');
    } finally {
      setIsSavingBlacklist(false);
    }
  };

  const [isSeeding, setIsSeeding] = useState(false);

  const seedBistStocks = async () => {
    if (isSeeding) return;
    setIsSeeding(true);
    try {
      const addedCount = await seedBistStocksService();
      onShowToast(`${addedCount} yeni hisse eklendi.`, 'success');
      fetchUsers(); // Refresh users too just in case
    } catch (error: any) {
      console.error("Tohumlama hatası:", error);
      onShowToast("Hisseler eklenirken bir hata oluştu: " + error.message, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            İstenmeyen Liste (Blacklist)
          </h3>
          <button 
            onClick={handleSaveBlacklist}
            disabled={isSavingBlacklist}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              isSavingBlacklist 
                ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" 
                : "bg-emerald-500 hover:bg-emerald-600 text-white"
            )}
          >
            {isSavingBlacklist ? 'Kaydediliyor...' : 'Listeyi Kaydet'}
          </button>
        </div>
        <p className="text-zinc-500 text-sm mb-4">
          Buraya yazdığınız hisse sembolleri (her satıra bir tane) senkronizasyon sırasında atlanacaktır. 
          Örn: EREGL veya EREGL.IS
        </p>
        <textarea
          value={blacklistText}
          onChange={(e) => setBlacklistText(e.target.value)}
          className="w-full h-48 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
          placeholder="EREGL&#10;THYAO&#10;..."
        />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-emerald-500" />
            Kullanıcı Onaylama
          </h3>
          <button 
            onClick={seedBistStocks}
            disabled={isSeeding}
            className={cn(
              "text-xs px-3 py-1 rounded border transition-all",
              isSeeding 
                ? "bg-zinc-800 text-zinc-600 border-zinc-700 cursor-not-allowed" 
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700"
            )}
          >
            {isSeeding ? 'Ekleniyor...' : 'BIST Listesini Tohumla'}
          </button>
        </div>

        {loading ? (
          <p className="text-zinc-500">Yükleniyor...</p>
        ) : users.length > 0 ? (
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.uid} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">{u.email}</p>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-mono uppercase",
                      u.role === 'admin' ? "bg-purple-500/20 text-purple-400" : "bg-zinc-700 text-zinc-400"
                    )}>
                      {u.role}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs">Kayıt: {u.created_at.toDate().toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleRoleToggle(u.uid, u.role)}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-700 transition-all"
                  >
                    Rol Değiştir
                  </button>
                  <button 
                    onClick={() => handleStatusToggle(u.uid, u.status)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                      u.status === 'approved' 
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" 
                        : "bg-emerald-500 hover:bg-emerald-600 text-white"
                    )}
                  >
                    {u.status === 'approved' ? 'Askıya Al' : 'Onayla'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-center py-10">Kullanıcı bulunmuyor.</p>
        )}
      </div>
    </div>
  );
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await registerUser(cred.user.uid, email);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const profile = await getUserProfile(result.user.uid);
      if (!profile) {
        await registerUser(result.user.uid, result.user.email || '');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
            <TrendingUp className="text-white w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">Mekatronik BİST</h2>
          <p className="text-zinc-500 text-sm">P-Control Portföy Yönetim Sistemi</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-zinc-500 text-xs uppercase font-mono">E-posta</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all"
              placeholder="ornek@mail.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-zinc-500 text-xs uppercase font-mono">Şifre</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {loading ? 'İşlem Yapılıyor...' : (isLogin ? 'Giriş Yap' : 'Kayıt Ol')}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-900 px-2 text-zinc-500 font-mono">Veya</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white hover:bg-zinc-100 text-black py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Google ile Devam Et
          </button>
        </div>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-zinc-400 hover:text-white text-sm transition-colors"
          >
            {isLogin ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedBistStock, setSelectedBistStock] = useState<BistStock | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const p = await getUserProfile(u.uid);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const isAdmin = profile?.role === 'admin' || user?.email === 'umitcenkozdemir@gmail.com';
  const isApproved = profile?.status === 'approved' || isAdmin;

  useEffect(() => {
    if (!user || !isApproved) return;

    const qStocks = query(collection(db, 'stocks'), orderBy('symbol'));
    const unsubStocks = onSnapshot(qStocks, (snap) => {
      setStocks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stock)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stocks');
    });

    const qPortfolio = query(collection(db, 'portfolio'), where('uid', '==', user.uid));
    const unsubPortfolio = onSnapshot(qPortfolio, (snap) => {
      setPortfolio(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PortfolioItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'portfolio');
    });

    const qTransactions = query(collection(db, 'transactions'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(20));
    const unsubTransactions = onSnapshot(qTransactions, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => {
      unsubStocks();
      unsubPortfolio();
      unsubTransactions();
    };
  }, [user, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Onay Bekleniyor</h2>
          <p className="text-zinc-500 mb-6">
            Hesabınız başarıyla oluşturuldu. Yönetici onayından sonra sisteme giriş yapabileceksiniz.
          </p>
          <button 
            onClick={() => signOut(auth)}
            className="text-emerald-500 hover:text-emerald-400 font-medium"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-emerald-500/30">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} user={user} profile={profile} onShowToast={showToast} />
        
        <main className="w-full px-0 sm:px-4 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard portfolio={portfolio} transactions={transactions} stocks={stocks} />}
              {activeTab === 'stocks' && (
                selectedBistStock ? (
                  <StockDetail stock={selectedBistStock} onBack={() => setSelectedBistStock(null)} />
                ) : (
                  <BistStocksExplorer onSelectStock={setSelectedBistStock} isAdmin={isAdmin} onShowToast={showToast} />
                )
              )}
              {activeTab === 'portfolio' && <PortfolioManager portfolio={portfolio} stocks={stocks} user={user} />}
              {activeTab === 'tasks' && <DailyTasks portfolio={portfolio} stocks={stocks} />}
              {activeTab === 'backtest' && <BacktestModule stocks={stocks} onShowToast={showToast} />}
              {activeTab === 'reports' && <Reports stocks={stocks} />}
              {activeTab === 'admin' && isAdmin && <AdminPanel onShowToast={showToast} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        <footer className="w-full px-4 sm:px-8 py-12 border-t border-zinc-900 mt-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center">
                <TrendingUp className="text-emerald-500 w-4 h-4" />
              </div>
              <span className="text-zinc-500 text-sm font-bold">Mekatronik BİST v2.0</span>
            </div>
            <p className="text-zinc-600 text-xs font-mono">
              &copy; 2026 Mekatronik Finansal Teknolojiler. Tüm hakları saklıdır.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-zinc-500 text-[10px] uppercase tracking-widest">Sistem Aktif</span>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
