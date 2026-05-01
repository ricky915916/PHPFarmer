import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, UserPlus, CheckCircle2, ShieldAlert, Award, Briefcase, Plus, DollarSign, Globe
} from 'lucide-react';
// 引入 Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

// --- Webhook 設定 ---
const LOG_WEBHOOK = "https://discord.com/api/webhooks/1499763356540604550/mjn_MdCL6FmWPAmYBAMB1GYxsoH1RZKNdQ6abudmQ36kbDX5CQR3UxG0iQs5jVxduWXq";
const ACTION_WEBHOOK = "https://discord.com/api/webhooks/1499763359783059626/ZHT9MIQHuhX1pjjC_HUOwxmNxFintLYfeQf3ydfjYYtePh27vxXzRJstuG0dVoceO_f-";

// ============================================================================
// 👉 請將你剛剛從 Firebase 複製的設定貼在這裡：
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyC3OyRHBo7iz2uU0udL60ru99CQZCk1b0A",
  authDomain: "phpfarmer.firebaseapp.com",
  projectId: "phpfarmer",
  storageBucket: "phpfarmer.firebasestorage.app",
  messagingSenderId: "933405127775",
  appId: "1:933405127775:web:921af7a7f513cd72c817ea"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const usersCollection = collection(db, 'users');
// ============================================================================

const logWebhook = (msg) => {
  fetch(LOG_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `[LOG] ${msg}` }) }).catch(console.error);
};
const actionWebhook = (msg) => {
  fetch(ACTION_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg }) }).catch(console.error);
};

// --- 共用 UI 元件 (與之前相同) ---
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
  const [users, setUsers] = useState([]); // 改為空陣列，等待 Firebase 讀取
  const [newUser, setNewUser] = useState({ name: '', role: 'employee', managerId: '', cutPercentage: 10, hourlyWage: 100 });
  const [modal, setModal] = useState({ isOpen: false, user: null });
  const [exchangeRate, setExchangeRate] = useState(null);
  const [loading, setLoading] = useState(true);

  // 取得即時匯率
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => { if(data?.rates?.PHP) setExchangeRate(data.rates.PHP); })
      .catch(console.error);
  }, []);

  // 監聽 Firebase 資料
  useEffect(() => {
    const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Firebase 讀取錯誤:", error);
      alert("無法連接資料庫，請確認 Firebase 設定是否正確！");
    });
    return () => unsubscribe();
  }, []);

  const managers = useMemo(() => users.filter(u => u.role === 'manager'), [users]);

  // 新增人員到 Firebase
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.name) return alert('請輸入名稱');
    if (newUser.role === 'employee' && !newUser.managerId) return alert('請選擇所屬經理');

    const id = Math.random().toString(36).substr(2, 9);
    const userRef = doc(db, 'users', id);
    
    const userObj = {
      name: newUser.name,
      role: newUser.role,
      pendingHours: 0,
      hourlyWage: Number(newUser.hourlyWage) || 0
    };

    if (newUser.role === 'employee') {
      userObj.managerId = newUser.managerId;
      userObj.cutPercentage = Number(newUser.cutPercentage) || 0;
      
      const manager = users.find(u => u.id === newUser.managerId);
      logWebhook(`新增員工: ${newUser.name} (所屬: ${manager?.name}, 時薪: ${userObj.hourlyWage} PHP, 抽成: ${newUser.cutPercentage}%)`);
      actionWebhook(`👥 **新增員工**\n> 名字：${newUser.name}\n> 所屬經理：${manager?.name}\n> 時薪：${userObj.hourlyWage} PHP\n> 抽成設定：${newUser.cutPercentage}%`);
    } else {
      userObj.bonusPhp = 0;
      logWebhook(`新增經理: ${newUser.name} (時薪: ${userObj.hourlyWage} PHP)`);
      actionWebhook(`👤 **新增經理**\n> 名字：${newUser.name}\n> 時薪：${userObj.hourlyWage} PHP`);
    }

    try {
      await setDoc(userRef, userObj);
      setNewUser({ name: '', role: 'employee', managerId: '', cutPercentage: 10, hourlyWage: 100 });
    } catch (error) {
      console.error("新增失敗:", error);
      alert("新增失敗，請檢查權限設定");
    }
  };

  // 更新欄位到 Firebase
  const handleUpdateField = async (userId, field, value) => {
    try {
      await updateDoc(doc(db, 'users', userId), { [field]: value });
    } catch (error) {
      console.error("更新失敗:", error);
    }
  };

  // 增加時數到 Firebase
  const handleAddHours = async (userId, addedHours) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const newTotal = user.pendingHours + addedHours;
    try {
      await updateDoc(doc(db, 'users', userId), { pendingHours: newTotal });
      logWebhook(`增加時數: ${user.name} 增加了 ${addedHours} 小時 (總計變為 ${newTotal})`);
    } catch(error) { console.error(error); }
  };

  const openSettleModal = (user) => setModal({ isOpen: true, user });
  const closeModal = () => setModal({ isOpen: false, user: null });

  // 確認結算 (更新 Firebase)
  const confirmSettle = async () => {
    const user = modal.user;
    if (!user) return;

    try {
      if (user.role === 'manager') {
        const selfHours = user.pendingHours;
        const selfPhp = selfHours * user.hourlyWage;
        const bonusPhp = user.bonusPhp;
        const totalPhp = selfPhp + bonusPhp;

        logWebhook(`結算經理: ${user.name} 結算了 自己時數 ${selfHours}h (${selfPhp} PHP) + 紅利 ${bonusPhp} PHP = 總計 ${totalPhp} PHP`);
        actionWebhook(`✅ **結算通知 (經理)**\n> 經理：${user.name}\n> 代打金額：${selfHours.toFixed(1)} h × ${user.hourlyWage} = ${selfPhp.toFixed(2)} PHP\n> 員工分紅：${bonusPhp.toFixed(2)} PHP\n> **總發放：${totalPhp.toFixed(2)} PHP**\n> (狀態：時數與紅利已歸零)`);
        
        await updateDoc(doc(db, 'users', user.id), { pendingHours: 0, bonusPhp: 0 });
      } else {
        const grossHours = user.pendingHours;
        const cutHours = grossHours * (user.cutPercentage / 100);
        const netHours = grossHours - cutHours;
        
        const managerBonusPhp = cutHours * user.hourlyWage;
        const employeePayoutPhp = netHours * user.hourlyWage;
        const manager = users.find(u => u.id === user.managerId);
        
        logWebhook(`結算員工: ${user.name} (原時數: ${grossHours}h, 實得: ${netHours}h = ${employeePayoutPhp} PHP, 經理分紅: ${managerBonusPhp} PHP)`);
        actionWebhook(`💰 **結算通知 (員工)**\n> 員工：${user.name}\n> 原打時數：${grossHours.toFixed(1)} h\n> 時薪工資：${user.hourlyWage} PHP/h\n> 實得時數：${netHours.toFixed(1)} h\n> **員工發放：${employeePayoutPhp.toFixed(2)} PHP**\n> 💼 經理分紅：${managerBonusPhp.toFixed(2)} PHP (歸入 ${manager?.name} 帳上)`);

        await updateDoc(doc(db, 'users', user.id), { pendingHours: 0 });
        if (manager) {
          await updateDoc(doc(db, 'users', manager.id), { bonusPhp: manager.bonusPhp + managerBonusPhp });
        }
      }
      closeModal();
    } catch (error) {
      console.error("結算失敗:", error);
      alert("結算更新失敗！");
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white text-2xl font-bold">載入中...</div>;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans relative overflow-hidden selection:bg-blue-500/30 pb-20">
      <style>{`
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>

      {/* 最頂端：即時匯率列 */}
      <div className="bg-white/5 border-b border-white/10 backdrop-blur-md px-6 py-2 flex justify-center items-center relative z-20">
        <div className="flex items-center space-x-2 text-sm">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-gray-400">即時匯率 (USD/PHP)：</span>
          <span className="font-mono font-bold text-emerald-400">
            {exchangeRate ? `1 USD = ${exchangeRate.toFixed(2)} PHP` : '載入中...'}
          </span>
        </div>
      </div>

      {/* 結算確認彈窗 Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all">
          <div className="bg-[#1c1c1e]/95 border border-white/10 rounded-[32px] p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 text-white border-b border-white/10 pb-4">結算明細確認</h3>
            
            <div className="mb-8 space-y-4 text-lg">
              <p className="text-gray-400">對象：<strong className="text-blue-400 text-xl">{modal.user?.name}</strong></p>
              {modal.user?.role === 'employee' && (
                <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3 font-mono text-base">
                  <div className="flex justify-between"><span className="text-gray-400">總時數</span><span className="text-white">{modal.user.pendingHours.toFixed(1)} h</span></div>
                  <div className="flex justify-between text-purple-400"><span>經理抽成 ({modal.user.cutPercentage}%)</span><span>- {(modal.user.pendingHours * (modal.user.cutPercentage / 100)).toFixed(1)} h</span></div>
                  <div className="border-t border-white/10 pt-2 flex justify-between font-bold"><span className="text-gray-200">實得時數</span><span className="text-blue-300">{(modal.user.pendingHours * (1 - modal.user.cutPercentage / 100)).toFixed(1)} h</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">約定時薪</span><span className="text-white">× {modal.user.hourlyWage} PHP</span></div>
                  <div className="border-t border-blue-500/30 pt-3 flex justify-between font-bold text-xl text-green-400 mt-2"><span>員工發放金額</span><span>{(modal.user.pendingHours * (1 - modal.user.cutPercentage / 100) * modal.user.hourlyWage).toFixed(0)} PHP</span></div>
                </div>
              )}
              {modal.user?.role === 'manager' && (
                <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3 font-mono text-base">
                  <div className="flex justify-between"><span className="text-gray-400">代打時數 ({modal.user.pendingHours.toFixed(1)}h)</span><span className="text-white">× {modal.user.hourlyWage} PHP</span></div>
                  <div className="flex justify-between text-blue-300"><span>自身代打薪資</span><span>= {(modal.user.pendingHours * modal.user.hourlyWage).toFixed(0)} PHP</span></div>
                  <div className="flex justify-between text-purple-400"><span>累積員工分紅</span><span>+ {modal.user.bonusPhp.toFixed(0)} PHP</span></div>
                  <div className="border-t border-blue-500/30 pt-3 flex justify-between font-bold text-xl text-green-400 mt-2"><span>經理發放總額</span><span>{(modal.user.pendingHours * modal.user.hourlyWage + modal.user.bonusPhp).toFixed(0)} PHP</span></div>
                </div>
              )}
            </div>
            <div className="flex space-x-3">
              <button onClick={closeModal} className="flex-1 py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-all">取消</button>
              <button onClick={confirmSettle} disabled={modal.user?.pendingHours === 0 && modal.user?.bonusPhp === 0} className="flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">確認結算歸零</button>
            </div>
          </div>
        </div>
      )}

      {/* 背景環境光暈 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-600/20 rounded-full blur-[150px] mix-blend-screen"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-600/15 rounded-full blur-[150px] mix-blend-screen"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-10 pt-4">
        <header className="mb-10 flex items-center justify-between">
          <div><h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">代練結算中樞</h1></div>
          <div className="hidden md:flex items-center space-x-2 bg-white/10 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
            <Award className="w-5 h-5 text-blue-400" /><span className="text-sm font-medium">即時薪資管理模式</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 左側：新增人員表單 */}
          <div className="lg:col-span-3 space-y-6">
            <GlassCard className="p-6">
              <div className="flex items-center space-x-3 mb-6"><div className="p-2 bg-purple-500/20 rounded-xl"><UserPlus className="w-5 h-5 text-purple-400" /></div><h2 className="text-lg font-bold">新增人員</h2></div>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                  <button type="button" className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${newUser.role === 'employee' ? 'bg-white/10 shadow-sm' : 'text-gray-400 hover:text-white'}`} onClick={() => setNewUser({...newUser, role: 'employee'})}>員工</button>
                  <button type="button" className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${newUser.role === 'manager' ? 'bg-white/10 shadow-sm' : 'text-gray-400 hover:text-white'}`} onClick={() => setNewUser({...newUser, role: 'manager'})}>經理</button>
                </div>
                <input type="text" placeholder="人員名稱" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                <div><label className="block text-xs text-gray-400 mb-1 ml-1">約定時薪 (PHP)</label><input type="number" min="0" placeholder="100" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" value={newUser.hourlyWage} onChange={e => setNewUser({...newUser, hourlyWage: e.target.value})} /></div>
                {newUser.role === 'employee' && (
                  <>
                    <select className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none" value={newUser.managerId} onChange={e => setNewUser({...newUser, managerId: e.target.value})}>
                      <option value="">選擇所屬經理...</option>
                      {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <div><label className="block text-xs text-gray-400 mb-1 ml-1">給經理抽成比例 (%)</label><input type="number" min="0" max="100" placeholder="10" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50" value={newUser.cutPercentage} onChange={e => setNewUser({...newUser, cutPercentage: e.target.value})} /></div>
                  </>
                )}
                <button type="submit" className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl font-semibold transition-all">新增</button>
              </form>
            </GlassCard>
          </div>

          {/* 右側：名單與即時時數管理 */}
          <div className="lg:col-span-9 space-y-6">
            {managers.length === 0 && (
              <div className="text-center py-20 border border-white/10 border-dashed rounded-3xl bg-white/5 backdrop-blur-sm"><ShieldAlert className="w-12 h-12 text-gray-500 mx-auto mb-3" /><p className="text-gray-400 text-lg">目前沒有任何經理，請先從左側新增。</p></div>
            )}
            {managers.map(manager => {
              const teamEmployees = users.filter(u => u.role === 'employee' && u.managerId === manager.id);
              return (
                <div key={manager.id} className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-xl">
                  {/* 經理列 */}
                  <div className="p-4 sm:p-5 flex items-center justify-between bg-gradient-to-r from-blue-900/30 to-transparent border-b border-white/5 gap-4 overflow-x-auto">
                    <div className="flex items-center space-x-3 shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg"><Briefcase className="w-5 h-5 text-white" /></div>
                      <div>
                        <h3 className="text-lg font-bold whitespace-nowrap">{manager.name}</h3>
                        <div className="text-xs text-gray-400 flex items-center space-x-1 mt-1 whitespace-nowrap"><DollarSign className="w-3 h-3 text-purple-400" /><span>累積紅利: <span className="text-purple-300 font-mono font-bold text-sm">{(manager.bonusPhp || 0).toFixed(0)}</span> PHP</span></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center space-x-2 bg-black/20 p-1 pl-3 rounded-xl border border-white/5"><span className="text-xs text-gray-400 shrink-0">時薪</span><TrackedInput className="text-emerald-300" value={manager.hourlyWage} onChange={v => handleUpdateField(manager.id, 'hourlyWage', v)} onCommitChange={(oldV, newV) => logWebhook(`修改: 經理 ${manager.name} 時薪由 ${oldV} 改為 ${newV}`)} suffix="PHP" /></div>
                      <AddHourInline onAdd={h => handleAddHours(manager.id, h)} />
                      <div className="flex items-center space-x-2"><span className="text-sm text-gray-400 shrink-0">時數</span><TrackedInput className="text-yellow-400 font-bold" value={manager.pendingHours} onChange={v => handleUpdateField(manager.id, 'pendingHours', v)} onCommitChange={(oldV, newV) => logWebhook(`修改: 經理 ${manager.name} 總時數由 ${oldV} 改為 ${newV}`)} suffix="h" /></div>
                      <button onClick={() => openSettleModal(manager)} className="p-2.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-xl transition-all shrink-0" title="結算經理時數與紅利"><CheckCircle2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                  {/* 員工列 */}
                  <div className="p-2">
                    {teamEmployees.length === 0 ? (<div className="px-5 py-3 text-sm text-gray-500">尚無員工</div>) : (
                      <div className="space-y-1">
                        {teamEmployees.map(employee => (
                          <div key={employee.id} className="flex items-center justify-between p-3 px-4 sm:px-6 rounded-2xl hover:bg-white/5 transition-colors gap-4 overflow-x-auto">
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex items-center space-x-2"><Users className="w-5 h-5 text-gray-400 shrink-0" /><span className="font-medium whitespace-nowrap">{employee.name}</span></div>
                              <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                                <div className="flex items-center space-x-1"><span className="text-xs text-gray-400 shrink-0">時薪</span><TrackedInput className="text-emerald-300" value={employee.hourlyWage} onChange={v => handleUpdateField(employee.id, 'hourlyWage', v)} onCommitChange={(oldV, newV) => logWebhook(`修改: 員工 ${employee.name} 時薪由 ${oldV} 改為 ${newV}`)} suffix="PHP" /></div>
                                <div className="flex items-center space-x-1"><span className="text-xs text-gray-400 shrink-0">抽成</span><TrackedInput className="text-purple-300" value={employee.cutPercentage} onChange={v => handleUpdateField(employee.id, 'cutPercentage', v)} onCommitChange={(oldV, newV) => logWebhook(`修改: 員工 ${employee.name} 抽成由 ${oldV}% 改為 ${newV}%`)} suffix="%" /></div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <AddHourInline onAdd={h => handleAddHours(employee.id, h)} />
                              <div className="flex items-center space-x-2"><span className="text-sm text-gray-400 shrink-0">時數</span><TrackedInput className="text-yellow-400 font-bold" value={employee.pendingHours} onChange={v => handleUpdateField(employee.id, 'pendingHours', v)} onCommitChange={(oldV, newV) => logWebhook(`修改: 員工 ${employee.name} 總時數由 ${oldV} 改為 ${newV}`)} suffix="h" /></div>
                              <button onClick={() => openSettleModal(employee)} className="px-4 py-2 bg-blue-600/80 hover:bg-blue-500 text-white rounded-xl text-sm font-medium border border-blue-400/30 transition-all shrink-0 whitespace-nowrap">結算薪資</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}