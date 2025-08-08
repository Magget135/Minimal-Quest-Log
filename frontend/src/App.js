import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Shared helpers
const ranks = ["Common", "Rare", "Epic", "Legendary"];
const statuses = ["Pending", "In Progress", "Completed", "Incomplete"];

function useApi() {
  const api = useMemo(() => axios.create({ baseURL: API }), []);
  return api;
}

function Navbar() {
  return (
    <div className="navbar">
      <div className="container row" style={{ justifyContent: "space-between" }}>
        <div className="nav-brand">Quest Tracker</div>
        <div className="nav-items">
          <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}>Active</NavLink>
          <NavLink to="/completed" className={({isActive}) => `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}>Completed</NavLink>
          <NavLink to="/rewards" className={({isActive}) => `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}>Rewards</NavLink>
          <NavLink to="/recurring" className={({isActive}) => `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}>Recurring</NavLink>
          <NavLink to="/rules" className={({isActive}) => `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}>Rules</NavLink>
        </div>
      </div>
    </div>
  );
}

function XPBadge({ summary }){
  return (
    <div className="badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 7h7l-5.5 4 2.5 7-7-4.5L5 20l2.5-7L2 9h7z"/></svg>
      <span className="small">XP: {summary?.balance ?? 0} (earned {summary?.total_earned ?? 0} / spent {summary?.total_spent ?? 0})</span>
    </div>
  );
}

function useXPSummary(){
  const api = useApi();
  const [summary, setSummary] = useState({ total_earned: 0, total_spent: 0, balance: 0 });
  const refresh = async () => {
    const { data } = await api.get(`/xp/summary`);
    setSummary(data);
  };
  useEffect(() => { refresh(); }, []);
  return { summary, refresh };
}

function ActiveQuests(){
  const api = useApi();
  const { summary, refresh: refreshXP } = useXPSummary();
  const [rewards, setRewards] = useState([]);
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ quest_name: "", quest_rank: "Common", due_date: "", status: "Pending", redeem_reward: "" });

  const fetchAll = async () => {
    const [q, r] = await Promise.all([
      api.get(`/quests/active`),
      api.get(`/rewards/store`),
    ]);
    setList(q.data);
    setRewards(r.data);
  };

  useEffect(() => { fetchAll(); }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    if(!form.quest_name || !form.due_date) return;
    await api.post(`/quests/active`, { ...form, redeem_reward: form.redeem_reward || null });
    setForm({ quest_name: "", quest_rank: "Common", due_date: "", status: "Pending", redeem_reward: "" });
    await fetchAll();
  };

  const markCompleted = async (id) => {
    await api.post(`/quests/active/${id}/complete`);
    await Promise.all([fetchAll(), refreshXP()]);
  };
  const markIncomplete = async (id) => {
    await api.post(`/quests/active/${id}/mark-incomplete`);
    await fetchAll();
  };

  const updateRow = async (id, patch) => {
    await api.patch(`/quests/active/${id}`, patch);
    await fetchAll();
  };

  const redeem = async (rewardId) => {
    if(!rewardId) return;
    await api.post(`/rewards/redeem`, { reward_id: rewardId });
    await refreshXP();
  };

  const dueColor = (due) => {
    if(!due) return "";
    const today = new Date();
    const d = new Date(due + "T00:00:00");
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (d.getTime() < t.getTime()) return "red";
    if (d.getTime() === t.getTime()) return "blue";
    return "green";
  };

  return (
    <div className="container">
      <div className="row" style={{justifyContent: 'space-between'}}>
        <h2>Active Quests</h2>
        <XPBadge summary={summary} />
      </div>

      <form onSubmit={onCreate} className="card" style={{marginTop: 16}}>
        <div className="row">
          <div className="col"><input className="input" placeholder="Quest Name" value={form.quest_name} onChange={e=>setForm({...form, quest_name: e.target.value})} /></div>
          <div>
            <select value={form.quest_rank} onChange={e=>setForm({...form, quest_rank: e.target.value})}>
              {ranks.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><input type="date" className="input" value={form.due_date} onChange={e=>setForm({...form, due_date: e.target.value})} /></div>
          <div>
            <select value={form.status} onChange={e=>setForm({...form, status: e.target.value})}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <select value={form.redeem_reward} onChange={e=>setForm({...form, redeem_reward: e.target.value})}>
              <option value="">Select reward (optional)</option>
              {rewards.map(r => <option key={r.id} value={r.id}>{r.reward_name} ({r.xp_cost})</option>)}
            </select>
          </div>
          <div><button className="btn" type="submit">Add</button></div>
        </div>
      </form>

      <div className="card" style={{marginTop: 16}}>
        <table className="table">
          <thead>
            <tr>
              <th>Quest Name</th>
              <th>Quest Rank</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Redeem Reward</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(row => (
              <tr key={row.id}>
                <td>{row.quest_name}</td>
                <td>
                  <select value={row.quest_rank} onChange={e=>updateRow(row.id,{quest_rank: e.target.value})}>
                    {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <span className={`dot ${dueColor(row.due_date)}`} style={{marginRight:6}}></span>
                  <input type="date" value={row.due_date} onChange={e=>updateRow(row.id,{due_date: e.target.value})} />
                </td>
                <td>
                  <select value={row.status} onChange={async e=>{
                    const val = e.target.value;
                    if (val === 'Completed') return await markCompleted(row.id);
                    if (val === 'Incomplete') return await markIncomplete(row.id);
                    await updateRow(row.id,{status: val});
                  }}>
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <select value={row.redeem_reward || ""} onChange={async e=>{
                    const val = e.target.value; 
                    await updateRow(row.id,{redeem_reward: val || null});
                    if(val) await redeem(val);
                  }}>
                    <option value="">Select reward</option>
                    {rewards.map(r => <option key={r.id} value={r.id}>{r.reward_name} ({r.xp_cost})</option>)}
                  </select>
                </td>
                <td>
                  <button className="btn secondary" onClick={()=>markCompleted(row.id)}>Complete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Completed(){
  const api = useApi();
  const [list, setList] = useState([]);
  const { summary } = useXPSummary();

  const load = async () => {
    const { data } = await api.get(`/quests/completed`);
    setList(data);
  };
  useEffect(() => { load(); }, []);

  const fmt = (iso) => new Date(iso).toLocaleString();

  return (
    <div className="container">
      <div className="row" style={{justifyContent: 'space-between'}}>
        <h2>Completed Quests</h2>
        <div className="badge small">Total earned: {summary.total_earned}</div>
      </div>
      <div className="card" style={{marginTop:16}}>
        <table className="table">
          <thead>
            <tr>
              <th>Quest Name</th>
              <th>Quest Rank</th>
              <th>XP Earned</th>
              <th>Date Completed</th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id}>
                <td>{r.quest_name}</td>
                <td>{r.quest_rank}</td>
                <td>{r.xp_earned}</td>
                <td>{fmt(r.date_completed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Rewards(){
  const api = useApi();
  const [store, setStore] = useState([]);
  const [log, setLog] = useState([]);
  const [form, setForm] = useState({ reward_name: "", xp_cost: 25 });

  const load = async () => {
    const [s, l] = await Promise.all([
      api.get(`/rewards/store`),
      api.get(`/rewards/log`)
    ]);
    setStore(s.data); setLog(l.data);
  };
  useEffect(()=>{ load(); },[]);

  const addOrUpdate = async (e) => {
    e.preventDefault();
    if(!form.reward_name || !form.xp_cost) return;
    await api.post(`/rewards/store`, form);
    setForm({ reward_name: "", xp_cost: 25 });
    await load();
  };
  const del = async (id) => { await api.delete(`/rewards/store/${id}`); await load(); };

  const fmt = (iso) => new Date(iso).toLocaleString();

  return (
    <div className="container">
      <h2>Rewards</h2>

      <form onSubmit={addOrUpdate} className="card" style={{marginTop:16}}>
        <div className="row">
          <input className="input" placeholder="Reward name" value={form.reward_name} onChange={e=>setForm({...form, reward_name:e.target.value})} />
          <input className="input" type="number" placeholder="XP cost" value={form.xp_cost} onChange={e=>setForm({...form, xp_cost: Number(e.target.value)})} />
          <button className="btn" type="submit">Save</button>
        </div>
      </form>

      <div className="card" style={{marginTop:16}}>
        <table className="table">
          <thead>
            <tr><th>Reward</th><th>XP Cost</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {store.map(s => (
              <tr key={s.id}>
                <td>{s.reward_name}</td>
                <td>{s.xp_cost}</td>
                <td><button className="btn secondary" onClick={()=>del(s.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3 className="kicker">Reward Log</h3>
        <table className="table">
          <thead>
            <tr><th>Date Redeemed</th><th>Reward</th><th>XP Cost</th></tr>
          </thead>
          <tbody>
            {log.map(l => (
              <tr key={l.id}>
                <td>{fmt(l.date_redeemed)}</td>
                <td>{l.reward_name}</td>
                <td>{l.xp_cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Recurring(){
  const api = useApi();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ task_name: "", quest_rank: "Common", frequency: "Daily", days: "", status: "Pending" });

  const load = async () => { const { data } = await api.get(`/recurring`); setRows(data); };
  useEffect(()=>{ load(); },[]);

  const upsert = async (e) => { e.preventDefault(); await api.post(`/recurring`, form); setForm({ task_name: "", quest_rank: "Common", frequency: "Daily", days: "", status: "Pending" }); await load(); };
  const del = async (id) => { await api.delete(`/recurring/${id}`); await load(); };
  const run = async () => { await api.post(`/recurring/run`); };

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2>Recurring Tasks</h2>
        <button className="btn" onClick={run}>Generate Today's Quests</button>
      </div>

      <form onSubmit={upsert} className="card" style={{marginTop:16}}>
        <div className="row">
          <input className="input" placeholder="Task name" value={form.task_name} onChange={e=>setForm({...form, task_name:e.target.value})} />
          <select value={form.quest_rank} onChange={e=>setForm({...form, quest_rank:e.target.value})}>{ranks.map(r=><option key={r}>{r}</option>)}</select>
          <select value={form.frequency} onChange={e=>setForm({...form, frequency:e.target.value})}>
            {['Daily','Weekly','Weekdays','Monthly'].map(f=> <option key={f}>{f}</option>)}
          </select>
          <input className="input" placeholder="Days (Mon, Fri) for Weekly" value={form.days} onChange={e=>setForm({...form, days: e.target.value})} />
          <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>{['Pending','In Progress','Completed','Incomplete'].map(s=> <option key={s}>{s}</option>)}</select>
          <button className="btn" type="submit">Add</button>
        </div>
      </form>

      <div className="card" style={{marginTop:16}}>
        <table className="table">
          <thead>
            <tr><th>Task Name</th><th>Quest Rank</th><th>Frequency</th><th>Days</th><th>Status</th><th>Last Added</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.task_name}</td>
                <td>{r.quest_rank}</td>
                <td>{r.frequency}</td>
                <td>{r.days || '-'}</td>
                <td>{r.status}</td>
                <td>{r.last_added || '-'}</td>
                <td><button className="btn secondary" onClick={()=>del(r.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Rules(){
  const api = useApi();
  const [rules, setRules] = useState("");

  const load = async () => { const { data } = await api.get(`/rules`); setRules(data?.content || ""); };
  useEffect(()=>{ load(); },[]);

  const save = async () => { await api.put(`/rules`, { content: rules }); };

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2>Rules</h2>
        <button className="btn" onClick={save}>Save</button>
      </div>
      <div className="card" style={{marginTop:16}}>
        <textarea rows={10} style={{width:'100%'}} value={rules} onChange={e=>setRules(e.target.value)} />
      </div>
    </div>
  );
}

function App(){
  return (
    <div className="App">
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<ActiveQuests />} />
          <Route path="/completed" element={<Completed />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/rules" element={<Rules />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;