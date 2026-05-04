import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, UserPlus, CheckCircle2, ShieldAlert, Award, Briefcase, Plus, DollarSign, Globe, Trash2, Crown, ChevronRight
} from 'lucide-react';
// 引入 Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

// --- Webhook 設定 ---
const LOG_WEBHOOK = "https://discord.com/api/webhooks/1499763356540604550/mjn_MdCL6FmWPAmYBAMB1GYxsoH1RZKNdQ6abudmQ36kbDX5CQR3UxG0iQs5jVxduWXq";
const ACTION_WEBHOOK = "https://discord.com/api/webhooks/1499763359783059626/ZHT9MIQHuhX1pjjC_HUOwxmNxFintLYfeQf3ydfjYYtePh27vxXzRJstuG0dVoceO_f-";

// ============================================================================
// 👉 請將你從 Firebase 複製的設定貼在這裡：
// ============================================================================
const firebaseConfig = {
  // apiKey: "...",
  // authDomain: "...",
  // projectId: "...",
  // storageBucket: "...",
  // messagingSenderId: "...",
  // appId: "..."
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const usersCollection = collection(db, 'users');
const buyersCollection = collection(db, 'buyers'); // 買家資料庫
// ============================================================================

const logWebhook = (msg) => {
  fetch(LOG_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `[LOG] ${msg}` }) }).catch(console.error);
};
const actionWebhook = (msg) => {
  fetch(ACTION_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg }) }).catch(console.error);
};

// --- 共用 UI 元件 ---
const GlassCard = ({ children, className = '' }) => (
  <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl ${className}`}>{children}</div>
);

const TrackedInput = ({ value, onChange, onCommitChange, className, suffix = "", min = 0, step = 1 }) => {
  const [localVal, setLocalVal] = useState(value?.toString() || "0");
  const [isFocused, setIsFocused] = useState(false);
  const [focusSnapshot, setFocusSnapshot] = useState(value);

  useEffect(() => { if (!isFocused) setLocalVal(value?.toString() || "0"); }, [value, isFocused]);

  const inputWidth = `${Math.max(localVal.toString().length, 1) + 2.5}ch`;

  return (
    <div className={`flex items-center bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all shrink-0 ${className}`}>
      <input
        type="number" min={min} step={step} value={localVal}
        onChange={e => { setLocalVal(e.target.value); const num = parseFloat(e.target.value); if (!isNaN(num)) onChange(num); }}
        onFocus={() => { setIsFocused(true); setFocusSnapshot(value); }}
        onBlur={() => {
          setIsFocused(false);
          const finalNum = parseFloat(localVal) || 0;
          setLocalVal(finalNum.toString());
          onChange(finalNum);
          if (focusSnapshot !== finalNum) onCommitChange(focusSnapshot, finalNum);
        }}
        style={{ width: inputWidth }}
        className="bg-transparent text-white focus:outline-none text-right font-mono"
      />
      {suffix && <span className="text-gray-500 ml-1 text-sm font-medium whitespace-nowrap">{suffix}</span>}
    </div>
  );
};

const AddHourInline = ({ onAdd }) => {
  const [val, setVal] = useState('');
  const handleCommit = () => {
    const num = parseFloat(val);
    if (!isNaN(num) && num !== 0) { onAdd(num); setVal(''); }
  };
  return (
    <div className="flex items-center space-x-1 bg-blue-500/10 rounded-xl px-2 py-1.5 border border-blue-500/20 focus-within:bg-blue-500/20 transition-all shrink-0">
      <Plus className="w-4 h-4 text-blue-400 shrink-0" />
      <input
        type="number" placeholder="加時數" value={val}
        onChange={e => setVal(e.target.value)} onBlur={handleCommit} onKeyDown={e => e.key === 'Enter' && handleCommit()}
        className="w-[70px] bg-transparent text-blue-100 text-sm focus:outline-none placeholder-blue-400/50 font-mono"
      />
    </div>
  );
};

// --- 主應用程式 ---
export default function App() {
  const [activeTab, setActiveTab] = useState('salary'); // 'salary' 薪資結算 | 'buyer' 買家資訊

  // 資料狀態
  const [users, setUsers] = useState([]); // 包含經理、員工
  const [buyers, setBuyers] = useState([]); // 買家
  const [exchangeRates, setExchangeRates] = useState({ usd: null, cny: null });
  const [loading, setLoading] = useState(true);
  
  // 表單狀態
  const [newUser, setNewUser] = useState({ name: '', role: 'employee', managerId: '', buyerId: '', cutHours: 1, hourlyWage: 100 });
  const [newBuyer, setNewBuyer] = useState({ name: '', cnyAmount: 0, balance: 0 });
  const [modal, setModal] = useState({ isOpen: false, user: null });

  // 取得即時匯率
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => { 
        if(data?.rates?.PHP) {
          const usdToPhp = data.rates.PHP;
          const usdToCny = data.rates.CNY;
          setExchangeRates({ 
            usd: usdToPhp, 
            cny: usdToCny ? (usdToPhp / usdToCny) : null // 換算 CNY to PHP
          });
        }
      })
      .catch(console.error);
  }, []);

  // 監聽 Firebase 資料
  useEffect(() => {
    const unsubUsers = onSnapshot(usersCollection, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, console.error);

    const unsubBuyers = onSnapshot(buyersCollection, (snapshot) => {
      setBuyers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, console.error);

    return () => { unsubUsers(); unsubBuyers(); };
  }, []);

  const managers = useMemo(() => users.filter(u => u.role === 'manager'), [users]);

  // --- 新增買家 ---
  const handleAddBuyer = async (e) => {
    e.preventDefault();
    if (!newBuyer.name) return alert('請輸入買家名稱');
    const id = Math.random().toString(36).substr(2, 9);
    try {
      await setDoc(doc(db, 'buyers', id), {
        name: newBuyer.name,
        cnyAmount: Number(newBuyer.cnyAmount) || 0,
        balance: Number(newBuyer.balance) || 0
      });
      logWebhook(`新增買家: ${newBuyer.name}`);
      setNewBuyer({ name: '', cnyAmount: 0, balance: 0 });
    } catch (err) { console.error(err); alert("新增買家失敗"); }
  };

  // --- 新增人員 (員工/經理) ---
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.name) return alert('請輸入名稱');
    
    const id = Math.random().toString(36).substr(2, 9);
    const userObj = { name: newUser.name, role: newUser.role, pendingHours: 0, hourlyWage: Number(newUser.hourlyWage) || 0 };

    if (newUser.role === 'employee') {
      if (!newUser.managerId) return alert('請選擇所屬經理');
      userObj.managerId = newUser.managerId;
      userObj.cutHours = Number(newUser.cutHours) || 0; // 改為固定時數
      const manager = users.find(u => u.id === newUser.managerId);
      logWebhook(`新增員工: ${newUser.name} (所屬經理: ${manager?.name}, 固定抽成: ${newUser.cutHours} h)`);
      actionWebhook(`👥 **新增員工**\n> 名字：${newUser.name}\n> 所屬經理：${manager?.name}\n> 固定抽成：${newUser.cutHours} h`);
    } else {
      if (activeTab === 'buyer' && !newUser.buyerId) return alert('請選擇所屬買家');
      if (activeTab === 'buyer') userObj.buyerId = newUser.buyerId;
      userObj.bonusPhp = 0;
      logWebhook(`新增經理: ${newUser.name}`);
      actionWebhook(`👤 **新增經理**\n> 名字：${newUser.name}`);
    }

    try {
      await setDoc(doc(db, 'users', id), userObj);
      setNewUser({ name: '', role: 'employee', managerId: '', buyerId: '', cutHours: 1, hourlyWage: 100 });
    } catch (error) { alert("新增失敗"); }
  };

  // --- 刪除與更新功能 ---
  const handleDeleteDoc = async (collectionName, item) => {
    if (collectionName === 'buyers') {
      const hasManagers = users.some(u => u.buyerId === item.id);
      if (hasManagers) return alert('無法刪除！此買家底下還有綁定的經理。');
    } else if (item.role === 'manager') {
      const hasEmployees = users.some(u => u.managerId === item.id);
      if (hasEmployees) return alert('無法刪除！此經理底下還有綁定的員工。');
    }

    if (!window.confirm(`確定要刪除「${item.name}」嗎？`)) return;

    try {
      await deleteDoc(doc(db, collectionName, item.id));
      logWebhook(`刪除資料: ${item.name}`);
    } catch (error) { alert("刪除失敗"); }
  };

  const handleUpdateField = async (collectionName, id, field, value) => {
    try { await updateDoc(doc(db, collectionName, id), { [field]: value }); } 
    catch (error) { console.error("更新失敗", error); }
  };

  // --- 結算功能 ---
  const handleAddHours = async (userId, addedHours) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    try { await updateDoc(doc(db, 'users', userId), { pendingHours: user.pendingHours + addedHours }); } 
    catch(error) { console.error(error); }
  };

  const confirmSettle = async () => {
    const user = modal.user;
    if (!user) return;
    try {
      if (user.role === 'manager') {
        const selfPhp = user.pendingHours * user.hourlyWage;
        await updateDoc(doc(db, 'users', user.id), { pendingHours: 0, bonusPhp: 0 });
        logWebhook(`結算經理: ${user.name}`);
      } else {
        const grossHours = user.pendingHours;
        const cutHours = Math.min(grossHours, user.cutHours); // 固定抽成時數 (最多抽全部)
        const netHours = grossHours - cutHours;
        
        const managerBonusPhp = cutHours * user.hourlyWage;
        const manager = users.find(u => u.id === user.managerId);
        
        await updateDoc(doc(db, 'users', user.id), { pendingHours: 0 });
        if (manager) await updateDoc(doc(db, 'users', manager.id), { bonusPhp: manager.bonusPhp + managerBonusPhp });
        logWebhook(`結算員工: ${user.name} (原時數: ${grossHours}h, 實得: ${netHours}h, 經理分紅: ${managerBonusPhp} PHP)`);
      }
      setModal({ isOpen: false, user: null });
    } catch (error) { alert("結算失敗！"); }
  };

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white text-2xl font-bold">載入中...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans relative overflow-hidden selection:bg-blue-500/30 pb-20">
      <style>{`
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>

      {/* 頂端匯率列 */}
      <div className="bg-white/5 border-b border-white/10 backdrop-blur-md px-6 py-2 flex flex-wrap justify-center items-center gap-6 relative z-20 text-sm">
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-gray-400">USD / PHP：</span>
          <span className="font-mono font-bold text-emerald-400">{exchangeRates.usd ? `1 = ${exchangeRates.usd.toFixed(2)}` : '載入中...'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4 text-rose-400" />
          <span className="text-gray-400">CNY / PHP：</span>
          <span className="font-mono font-bold text-rose-400">{exchangeRates.cny ? `1 = ${exchangeRates.cny.toFixed(2)}` : '載入中...'}</span>
        </div>
      </div>

      {/* 背景光暈 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-600/10 rounded-full blur-[150px] mix-blend-screen"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[150px] mix-blend-screen"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-10 pt-6">
        
        {/* 標題與分頁切換 */}
        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent mb-6">
            代練管理中樞
          </h1>
          <div className="flex space-x-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 w-fit backdrop-blur-md">
            <button 
              onClick={() => setActiveTab('salary')}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'salary' ? 'bg-blue-600 shadow-lg text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >代練薪資結算</button>
            <button 
              onClick={() => setActiveTab('buyer')}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'buyer' ? 'bg-rose-600 shadow-lg text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >買家帳戶資訊</button>
          </div>
        </header>

        {/* ----------------- 結算系統分頁 ----------------- */}
        {activeTab === 'salary' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3 space-y-6">
              <GlassCard className="p-6">
                <div className="flex items-center space-x-3 mb-6"><div className="p-2 bg-blue-500/20 rounded-xl"><UserPlus className="w-5 h-5 text-blue-400" /></div><h2 className="text-lg font-bold">新增人員</h2></div>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                    <button type="button" className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${newUser.role === 'employee' ? 'bg-white/10 shadow-sm' : 'text-gray-400 hover:text-white'}`} onClick={() => setNewUser({...newUser, role: 'employee'})}>員工</button>
                    <button type="button" className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${newUser.role === 'manager' ? 'bg-white/10 shadow-sm' : 'text-gray-400 hover:text-white'}`} onClick={() => setNewUser({...newUser, role: 'manager'})}>經理</button>
                  </div>
                  <input type="text" placeholder="人員名稱" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                  <div><label className="block text-xs text-gray-400 mb-1 ml-1">約定時薪 (PHP)</label><input type="number" min="0" placeholder="100" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" value={newUser.hourlyWage} onChange={e => setNewUser({...newUser, hourlyWage: e.target.value})} /></div>
                  
                  {newUser.role === 'employee' && (
                    <>
                      <select className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none" value={newUser.managerId} onChange={e => setNewUser({...newUser, managerId: e.target.value})}>
                        <option value="">選擇所屬經理...</option>
                        {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <div><label className="block text-xs text-gray-400 mb-1 ml-1">固定抽成時數 (h)</label><input type="number" min="0" step="0.5" placeholder="1" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50" value={newUser.cutHours} onChange={e => setNewUser({...newUser, cutHours: e.target.value})} /></div>
                    </>
                  )}
                  <button type="submit" className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl font-semibold transition-all">新增</button>
                </form>
              </GlassCard>
            </div>

            <div className="lg:col-span-9 space-y-6">
              {managers.map(manager => {
                const teamEmployees = users.filter(u => u.role === 'employee' && u.managerId === manager.id);
                return (
                  <div key={manager.id} className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-xl">
                    <div className="p-4 sm:p-5 flex items-center justify-between bg-gradient-to-r from-blue-900/30 to-transparent border-b border-white/5 gap-4 overflow-x-auto">
                      <div className="flex items-center space-x-3 shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg"><Briefcase className="w-5 h-5 text-white" /></div>
                        <div>
                          <h3 className="text-lg font-bold whitespace-nowrap">{manager.name}</h3>
                          <div className="text-xs text-gray-400 flex items-center space-x-1 mt-1 whitespace-nowrap"><DollarSign className="w-3 h-3 text-purple-400" /><span>累積紅利: <span className="text-purple-300 font-mono font-bold text-sm">{(manager.bonusPhp || 0).toFixed(0)}</span> PHP</span></div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center space-x-2 bg-black/20 p-1 pl-3 rounded-xl border border-white/5"><span className="text-xs text-gray-400 shrink-0">時薪</span><TrackedInput className="text-emerald-300" value={manager.hourlyWage} onChange={v => handleUpdateField('users', manager.id, 'hourlyWage', v)} suffix="PHP" /></div>
                        <AddHourInline onAdd={h => handleAddHours(manager.id, h)} />
                        <div className="flex items-center space-x-2"><span className="text-sm text-gray-400 shrink-0">時數</span><TrackedInput className="text-yellow-400 font-bold" value={manager.pendingHours} onChange={v => handleUpdateField('users', manager.id, 'pendingHours', v)} suffix="h" /></div>
                        <button onClick={() => setModal({isOpen: true, user: manager})} className="p-2.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-xl transition-all shrink-0"><CheckCircle2 className="w-5 h-5" /></button>
                        <button onClick={() => handleDeleteDoc('users', manager)} className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-all shrink-0 ml-1"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                    <div className="p-2">
                      {teamEmployees.map(employee => (
                        <div key={employee.id} className={`flex items-center justify-between p-3 px-4 sm:px-6 rounded-2xl hover:bg-white/5 transition-colors gap-4 overflow-x-auto border ${employee.pendingHours >= 150 ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-transparent'}`}>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center space-x-2"><Users className="w-5 h-5 text-gray-400 shrink-0" /><span className="font-medium whitespace-nowrap">{employee.name}</span></div>
                            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                              <div className="flex items-center space-x-1"><span className="text-xs text-gray-400 shrink-0">時薪</span><TrackedInput className="text-emerald-300" value={employee.hourlyWage} onChange={v => handleUpdateField('users', employee.id, 'hourlyWage', v)} suffix="PHP" /></div>
                              <div className="flex items-center space-x-1"><span className="text-xs text-gray-400 shrink-0">抽成(固定)</span><TrackedInput className="text-purple-300" value={employee.cutHours} onChange={v => handleUpdateField('users', employee.id, 'cutHours', v)} suffix="h" /></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <AddHourInline onAdd={h => handleAddHours(employee.id, h)} />
                            <div className="flex items-center space-x-2"><span className="text-sm text-gray-400 shrink-0">時數</span><TrackedInput className={`font-bold ${employee.pendingHours >= 150 ? 'text-red-400' : 'text-yellow-400'}`} value={employee.pendingHours} onChange={v => handleUpdateField('users', employee.id, 'pendingHours', v)} suffix="h" /></div>
                            <button onClick={() => setModal({isOpen: true, user: employee})} className="px-4 py-2 bg-blue-600/80 hover:bg-blue-500 text-white rounded-xl text-sm font-medium border border-blue-400/30 transition-all shrink-0 whitespace-nowrap">結算</button>
                            <button onClick={() => handleDeleteDoc('users', employee)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-all shrink-0 ml-1"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ----------------- 買家資訊分頁 ----------------- */}
        {activeTab === 'buyer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3 space-y-6">
              
              {/* 新增買家表單 */}
              <GlassCard className="p-6">
                <div className="flex items-center space-x-3 mb-6"><div className="p-2 bg-rose-500/20 rounded-xl"><Crown className="w-5 h-5 text-rose-400" /></div><h2 className="text-lg font-bold">新增買家</h2></div>
                <form onSubmit={handleAddBuyer} className="space-y-4">
                  <input type="text" placeholder="買家名稱" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50" value={newBuyer.name} onChange={e => setNewBuyer({...newBuyer, name: e.target.value})} />
                  <button type="submit" className="w-full py-3 px-4 bg-rose-600/80 hover:bg-rose-500 border border-rose-400/30 text-white rounded-xl font-semibold transition-all">建立買家帳戶</button>
                </form>
              </GlassCard>

              {/* 綁定經理表單 */}
              <GlassCard className="p-6">
                <div className="flex items-center space-x-3 mb-6"><div className="p-2 bg-purple-500/20 rounded-xl"><Briefcase className="w-5 h-5 text-purple-400" /></div><h2 className="text-lg font-bold">經理綁定買家</h2></div>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <input type="text" placeholder="經理名稱" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value, role: 'manager'})} />
                  <select className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none" value={newUser.buyerId} onChange={e => setNewUser({...newUser, buyerId: e.target.value, role: 'manager'})}>
                    <option value="">選擇所屬買家...</option>
                    {buyers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button type="submit" className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl font-semibold transition-all">新增經理</button>
                </form>
              </GlassCard>
            </div>

            {/* 買家列表呈現 */}
            <div className="lg:col-span-9 space-y-6">
              {buyers.map(buyer => {
                const buyerManagers = users.filter(u => u.role === 'manager' && u.buyerId === buyer.id);
                return (
                  <div key={buyer.id} className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-xl">
                    <div className="p-4 sm:p-5 flex items-center justify-between bg-gradient-to-r from-rose-900/30 to-transparent border-b border-rose-500/20 gap-4 overflow-x-auto">
                      <div className="flex items-center space-x-3 shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg"><Crown className="w-5 h-5 text-white" /></div>
                        <h3 className="text-xl font-bold whitespace-nowrap text-rose-100">{buyer.name}</h3>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex items-center space-x-2 bg-black/20 p-2 pl-4 rounded-xl border border-white/5"><span className="text-sm text-gray-400 shrink-0">儲值金額</span><TrackedInput className="text-rose-300 font-bold" value={buyer.cnyAmount} onChange={v => handleUpdateField('buyers', buyer.id, 'cnyAmount', v)} suffix="CNY" /></div>
                        <div className="flex items-center space-x-2 bg-black/20 p-2 pl-4 rounded-xl border border-white/5"><span className="text-sm text-gray-400 shrink-0">餘額</span><TrackedInput className="text-yellow-400 font-bold" value={buyer.balance} onChange={v => handleUpdateField('buyers', buyer.id, 'balance', v)} /></div>
                        <button onClick={() => handleDeleteDoc('buyers', buyer)} className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-all shrink-0 ml-1"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-3">
                      {buyerManagers.length === 0 ? <div className="text-gray-500 text-sm italic ml-2">尚未綁定任何經理</div> : 
                        buyerManagers.map(manager => {
                          const teamEmployees = users.filter(u => u.role === 'employee' && u.managerId === manager.id);
                          return (
                            <div key={manager.id} className="bg-black/20 rounded-2xl border border-white/5 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Briefcase className="w-4 h-4 text-purple-400" /><span className="font-bold text-purple-100">{manager.name}</span>
                              </div>
                              <div className="pl-6 grid grid-cols-2 md:grid-cols-3 gap-2">
                                {teamEmployees.length === 0 ? <span className="text-xs text-gray-500">無員工</span> : 
                                  teamEmployees.map(emp => (
                                    <div key={emp.id} className="flex items-center text-sm text-gray-400 bg-white/5 px-3 py-1.5 rounded-lg w-fit">
                                      <ChevronRight className="w-3 h-3 mr-1 opacity-50" /> {emp.name}
                                    </div>
                                  ))
                                }
                              </div>
                            </div>
                          )
                        })
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}