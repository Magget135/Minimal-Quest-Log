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

function MiniMonth({selectedDate, onSelect}){
  const [current, setCurrent] = useState(new Date(selectedDate));
  const startOfMonth = new Date(current.getFullYear(), current.getMonth(), 1);
  const endOfMonth = new Date(current.getFullYear(), current.getMonth()+1, 0);
  const startGrid = startOfWeekMon(startOfMonth);
  const cells = Array.from({length:42}, (_,i)=> addDays(startGrid,i));
  const weekdays = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const title = current.toLocaleDateString(undefined, { month:'long', year:'numeric' });
  const todayKey = ymd(new Date());
  return (
    <div className="mini-month">
      <div className="mini-header">
        <button className="btn secondary" onClick={()=>setCurrent(new Date(current.getFullYear(), current.getMonth()-1, 1))}>◀</button>
        <div>{title}</div>
        <button className="btn secondary" onClick={()=&gt;setCurrent(new Date(current.getFullYear(), current.getMonth()+1, 1))}>▶</button>
      </div>
      <div className="mini-grid">
        {weekdays.map(w =&gt; <div key={w} className="mini-dow">{w}</div>)}
        {cells.map((d, idx)=&gt;{
          const isOther = d.getMonth() !== current.getMonth();
          const key = ymd(d);
          const isSelected = ymd(selectedDate) === key;
          return (
            <div key={idx} className={`mini-cell ${isOther?'other':''} ${isSelected?'selected':''}`} onClick={()=&gt;onSelect(d)}>
              {d.getDate()}
              {key===todayKey? <span className="dot-today" />: null}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function XPBadge({ summary }){
  return (
    <div className="badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 7h7l-5.5 4 2.5 7-7-4.5L5 20l2.5-7L2 9h7z"/></svg>
      <span className="small">XP: {summary?.balance ?? 0}</span>
    </div>
  );
}

function useXPSummary(){
  const api = useApi();
  const [summary, setSummary] = useState({ total_earned: 0, total_spent: 0, balance: 0 });
  const refresh = async () =&gt; {
    const { data } = await api.get(`/xp/summary`);
    setSummary(data);
  };
  useEffect(() =&gt; { refresh(); }, []);
  return { summary, refresh };
}

// Date helpers
const ymd = (d) =&gt; `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const startOfWeekMon = (d) =&gt; { const day = d.getDay(); const diff = (day === 0 ? -6 : 1) - day; const res = new Date(d); res.setDate(d.getDate()+diff); return new Date(res.getFullYear(), res.getMonth(), res.getDate()); };
const addDays = (d, n) =&gt; { const res = new Date(d); res.setDate(d.getDate()+n); return res; };
function startOfMonthGridMon(d){ const first = new Date(d.getFullYear(), d.getMonth(), 1); return startOfWeekMon(first); }

const HOUR_HEIGHT = 48; // px
const MINUTE_PX = HOUR_HEIGHT / 60; // 0.8px per min

function MonthCalendar({tasks, view, anchorDate, onPrev, onNext, onToday, onViewChange, onOpenTask}){
  let cells = [];
  const headerTitle = anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (view === 'week') {
    const start = startOfWeekMon(anchorDate);
    cells = Array.from({length:7}, (_,i)=&gt; addDays(start,i));
  } else if (view === 'month') {
    const start = startOfMonthGridMon(anchorDate);
    cells = Array.from({length:42}, (_,i)=&gt; addDays(start,i));
  } else {
    cells = [new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate())];
  }

  const weekdays = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

  return (
    <div className="calendar">
      <div className="calendar-header">
        <div className="header-left"><div className="header-title">{headerTitle}</div></div>
        <div className="header-right">
          <div className="calendar-controls">
            <button className="btn secondary" onClick={onPrev}>Prev</button>
            <button className="btn secondary" onClick={onToday}>Today</button>
            <button className="btn secondary" onClick={onNext}>Next</button>
          </div>
          <div className="calendar-controls">
            <button className={`btn secondary`} onClick={()=&gt;onViewChange('day')}>Day</button>
            <button className={`btn secondary`} onClick={()=&gt;onViewChange('week')}>Week</button>
            <button className={`btn secondary`} onClick={()=&gt;onViewChange('month')}>Month</button>
          </div>
        </div>
      </div>
      {view !== 'day' &amp;&amp; (
        <div className="month-headers">
          {weekdays.map((w,i) =&gt; <div key={i} className="month-head-cell">{w}</div>)}
        </div>
      )}
      <div className={`calendar-grid ${view}`}>
        {cells.map((day, idx) =&gt; {
          const key = ymd(day);
          const items = tasks.filter(t =&gt; t.due_date === key);
          return (
            <div key={idx} className="calendar-cell">
              <div className="calendar-day-number">{day.getDate()}</div>
              <div className="calendar-tasks">
                {items.map(item =&gt; (
                  <div key={item.id} className="task-chip" title={item.quest_name} onClick={()=&gt;onOpenTask(item)}>
                    {item.quest_name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeCalendar({tasks, view, anchorDate, onPrev, onNext, onToday, onViewChange, onOpenTask}){
  const isWeek = view === 'week';
  const start = isWeek ? startOfWeekMon(anchorDate) : new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  const days = isWeek ? Array.from({length:7}, (_,i)=&gt; addDays(start,i)) : [start];

  const now = new Date();

  // Group tasks by date
  const byDate = Object.create(null);
  days.forEach(d =&gt; { byDate[ymd(d)] = { timed: [], allDay: [] }; });
  tasks.forEach(t =&gt; {
    if (byDate[t.due_date]) {
      if (t.due_time) byDate[t.due_date].timed.push(t); else byDate[t.due_date].allDay.push(t);
    }
  });
  Object.values(byDate).forEach(bucket =&gt; {
    bucket.timed.sort((a,b)=&gt; (a.due_time||"00:00").localeCompare(b.due_time||"00:00"));
  });

  const hours = Array.from({length:24}, (_,i)=&gt; i);

  const dow = (d) =&gt; d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const dom = (d) =&gt; d.getDate();
  const headerTitle = anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="time-calendar">
      <div className="time-header">
        <div className="header-left"><div className="header-title">{headerTitle}</div></div>
        <div className="header-right">
          <div className="calendar-controls">
            <button className="btn secondary" onClick={onPrev}>Prev</button>
            <button className="btn secondary" onClick={onToday}>Today</button>
            <button className="btn secondary" onClick={onNext}>Next</button>
          </div>
          <div className="calendar-controls">
            <button className={`btn secondary`} onClick={()=&gt;onViewChange('day')}>Day</button>
            <button className={`btn secondary`} onClick={()=&gt;onViewChange('week')}>Week</button>
            <button className={`btn secondary`} onClick={()=&gt;onViewChange('month')}>Month</button>
          </div>
        </div>
      </div>

      <div className="time-scroll">
        {/* Day headers */}
        <div className={`day-headers ${isWeek ? 'week' : 'day'}`}>
          <div className="day-head-cell" />
          {days.map(d =&gt; (
            <div key={ymd(d)} className="day-head-cell">
              <div className="day-head-inner">
                <div className="dow">{dow(d)}</div>
                <div className="dom">{dom(d)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* All-day row */}
        <div className={`all-day ${isWeek ? '' : 'day'}`}>
          <div className="label">All-day</div>
          {days.map(d =&gt; (
            <div key={ymd(d)} className="col">
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {byDate[ymd(d)].allDay.map(item =&gt; (
                  <div key={item.id} className="task-chip" onClick={()=&gt;onOpenTask(item)}>{item.quest_name}</div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className={`time-grid ${isWeek ? 'week' : 'day'}`}>
          <div className="time-labels">
            {hours.map(h =&gt; (
              <div key={h} className="time-hour">{h === 0 ? '12 AM' : h &lt; 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`}</div>
            ))}
          </div>
          {days.map(d =&gt; (
            <DayColumn key={ymd(d)} day={d} items={byDate[ymd(d)].timed} onOpenTask={onOpenTask} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, items, onOpenTask }){
  const renderHourLines = () =&gt; Array.from({length:24}, (_,h) =&gt; (
    <div key={h} className="time-hour-line" style={{ top: h * HOUR_HEIGHT }} />
  ));
  const renderTaskBlock = (t) =&gt; {
    const [hh, mm] = (t.due_time || "00:00").split(":").map(Number);
    const top = (hh*60 + mm) * MINUTE_PX;
    const height = Math.max(22, 30);
    return (
      <div key={t.id} className="task-block" style={{ top, height }} title={t.quest_name} onClick={()=&gt;onOpenTask(t)}>
        {t.quest_name} {t.due_time ? `(${t.due_time})` : ''}
      </div>
    );
  };
  const nowLine = () =&gt; {
    const todayKey = ymd(new Date());
    if (ymd(day) !== todayKey) return null;
    const n = new Date();
    const minutes = n.getHours()*60 + n.getMinutes();
    const top = minutes * MINUTE_PX;
    return (
      <div className="time-now-line" style={{ top }}>
        <div className="time-now-dot" />
      </div>
    );
  };
  return (
    <div className="time-col">
      {renderHourLines()}
      {items.map(renderTaskBlock)}
      {nowLine()}
    </div>
  );
}

function Calendar({ tasks, view, anchorDate, onPrev, onNext, onToday, onViewChange, onOpenTask }){
  if (view === 'month') {
    return <MonthCalendar tasks={tasks} view={view} anchorDate={anchorDate} onPrev={onPrev} onNext={onNext} onToday={onToday} onViewChange={onViewChange} onOpenTask={onOpenTask} />
  }
  return <TimeCalendar tasks={tasks} view={view} anchorDate={anchorDate} onPrev={onPrev} onNext={onNext} onToday={onToday} onViewChange={onViewChange} onOpenTask={onOpenTask} />
}

function TaskEditModal({ open, task, onClose, onSave, onDelete }){
  const [name, setName] = useState(task?.quest_name || "");
  const [due, setDue] = useState(task?.due_date || "");
  const [dueTime, setDueTime] = useState(task?.due_time || "");
  useEffect(()=>{ setName(task?.quest_name || ""); setDue(task?.due_date || ""); setDueTime(task?.due_time || ""); }, [task]);
  if(!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=&gt;e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Task</h3>
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
        <div className="row" style={{marginBottom:8}}>
          <input className="input" placeholder="Task name" value={name} onChange={e=&gt;setName(e.target.value)} />
          <input className="input" type="date" value={due} onChange={e=&gt;setDue(e.target.value)} />
          <input className="input" type="time" value={dueTime} onChange={e=&gt;setDueTime(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={()=&gt;onDelete(task)}>Delete</button>
          <button className="btn" onClick={()=&gt;onSave({ ...task, quest_name: name, due_date: due, due_time: dueTime || null })}>Save</button>
        </div>
      </div>
    </div>
  );
}


function CustomRepeatModal({ open, baseDate, onClose, onSave }){
  const d = baseDate || new Date();
  const [freq, setFreq] = useState('Daily');
  const [interval, setInterval] = useState(1);
  const [monthlyMode, setMonthlyMode] = useState('date');
  const [monthlyWeekIndex, setMonthlyWeekIndex] = useState(1); // 1..5 or -1
  const [monthlyWeekday, setMonthlyWeekday] = useState(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]);
  const [monthlyOnDate, setMonthlyOnDate] = useState(d.getDate());
  const [ends, setEnds] = useState('never');
  const [untilDate, setUntilDate] = useState('');
  const [count, setCount] = useState(0);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=&gt;e.stopPropagation()}>
        <div className="modal-header">
          <h3>Custom Repeat</h3>
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
        <div className="row" style={{flexWrap:'wrap', marginBottom:8}}>
          <select value={freq} onChange={e=&gt;setFreq(e.target.value)}>
            {['Daily','Weekly','Weekdays','Monthly','Annual'].map(f=&gt; <option key={f}>{f}</option>)}
          </select>
          <input className="input" type="number" min={1} value={interval} onChange={e=&gt;setInterval(Number(e.target.value||1))} />
          <span className="small">Every N {freq.toLowerCase()}</span>
        </div>
        {freq==='Weekly' &amp;&amp; (
          <div className="row" style={{marginBottom:8}}>
            <span className="small">Days (Mon, Wed):</span>
            <input className="input" placeholder="Mon, Wed" id="weekly-days-input" />
            <span className="small">You can edit later in Recurring</span>
          </div>
        )}
        {freq==='Monthly' &amp;&amp; (
          <div className="row" style={{marginBottom:8, flexWrap:'wrap'}}>
            <select value={monthlyMode} onChange={e=&gt;setMonthlyMode(e.target.value)}>
              <option value="date">On day {monthlyOnDate}</option>
              <option value="weekday">On the nth weekday</option>
            </select>
            {monthlyMode==='date' ? (
              <input className="input" type="number" min={1} max={31} value={monthlyOnDate} onChange={e=&gt;setMonthlyOnDate(Number(e.target.value||1))} />
            ) : (
              <>
                <select value={monthlyWeekIndex} onChange={e=&gt;setMonthlyWeekIndex(Number(e.target.value))}>
                  {[1,2,3,4,5,-1].map(n=&gt; <option key={n} value={n}>{n===-1?'Last':`${n}th`}</option>)}
                </select>
                <select value={monthlyWeekday} onChange={e=&gt;setMonthlyWeekday(e.target.value)}>
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=&gt; <option key={w}>{w}</option>)}
                </select>
              </>
            )}
          </div>
        )}
        <div className="row" style={{marginBottom:8, flexWrap:'wrap'}}>
          <select value={ends} onChange={e=&gt;setEnds(e.target.value)}>
            <option value="never">Ends: Never</option>
            <option value="on_date">Ends: On date</option>
            <option value="after">Ends: After N</option>
          </select>
          {ends==='on_date' &amp;&amp; (&lt;input className="input" type="date" value={untilDate} onChange={e=&gt;setUntilDate(e.target.value)} /&gt;)}
          {ends==='after' &amp;&amp; (&lt;input className="input" type="number" min={1} value={count} onChange={e=&gt;setCount(Number(e.target.value||0))} /&gt;)}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={()=&gt;{
            onSave({
              frequency: freq,
              interval,
              monthly_mode: freq==='Monthly'? monthlyMode : undefined,
              monthly_on_date: freq==='Monthly' &amp;&amp; monthlyMode==='date'? monthlyOnDate : undefined,
              monthly_week_index: freq==='Monthly' &amp;&amp; monthlyMode==='weekday'? monthlyWeekIndex : undefined,
              monthly_weekday: freq==='Monthly' &amp;&amp; monthlyMode==='weekday'? monthlyWeekday : undefined,
              ends,
              until_date: ends==='on_date' &amp;&amp; untilDate ? untilDate : undefined,
              count: ends==='after' &amp;&amp; count ? count : undefined,
              days: freq==='Weekly' ? document.getElementById('weekly-days-input')?.value : undefined,
            });
            onClose();
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function ActiveQuests({ hideExtras=false }){
  const api = useApi();
  const { summary, refresh: refreshXP } = useXPSummary();
  const [list, setList] = useState([]);

  // calendar state
  const [view, setView] = useState('week'); // default 1 week
  const [anchorDate, setAnchorDate] = useState(new Date());

  const [form, setForm] = useState({ quest_name: "", quest_rank: "Common", due_date: "", due_time: "", status: "Pending" });
  const [repeat, setRepeat] = useState('none'); // none | daily | weekly_on | weekdays | monthly_on_date | annual | custom

  const fetchAll = async () =&gt; {
    const q = await api.get(`/quests/active`);
    // sort by due_date then due_time (empty first)
    const sorted = [...q.data].sort((a,b) =&gt; {
      const da = new Date(a.due_date + 'T00:00:00').getTime();
      const db = new Date(b.due_date + 'T00:00:00').getTime();
      if (da !== db) return da - db;
      const ta = (a.due_time || '');
      const tb = (b.due_time || '');
      return ta.localeCompare(tb);
    });
    setList(sorted);
  };

  useEffect(() =&gt; { fetchAll(); }, []);

  const onCreate = async (e) =&gt; {
    e.preventDefault();
    if(!form.quest_name || !form.due_date) return;
    await api.post(`/quests/active`, { ...form, due_time: form.due_time || null });
    // If repeating, create a recurring rule mirroring Google Calendar presets
    try {
      const d = new Date(form.due_date + 'T00:00:00');
      let recurringBody = null;
      if (repeat === 'daily') {
        recurringBody = { task_name: form.quest_name, quest_rank: form.quest_rank, frequency: 'Daily', status: form.status };
      } else if (repeat === 'weekly_on') {
        // store human weekday label e.g. Mon
        const wk = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
        recurringBody = { task_name: form.quest_name, quest_rank: form.quest_rank, frequency: 'Weekly', days: wk, status: form.status };
      } else if (repeat === 'weekdays') {
        recurringBody = { task_name: form.quest_name, quest_rank: form.quest_rank, frequency: 'Weekdays', status: form.status };
      } else if (repeat === 'monthly_on_date') {
        recurringBody = { task_name: form.quest_name, quest_rank: form.quest_rank, frequency: 'Monthly', monthly_on_date: d.getDate(), status: form.status };
      } else if (repeat === 'annual') {
        recurringBody = { task_name: form.quest_name, quest_rank: form.quest_rank, frequency: 'Annual', status: form.status };
      }
      if (recurringBody) await api.post(`/recurring`, recurringBody);
    } catch(err) { /* non-blocking */ }

    setForm({ quest_name: "", quest_rank: "Common", due_date: "", due_time: "", status: "Pending" });
    setRepeat('none');
    await fetchAll();
  };

  const markCompleted = async (id) =&gt; { await api.post(`/quests/active/${id}/complete`); await Promise.all([fetchAll(), refreshXP()]); };
  const markIncomplete = async (id) =&gt; { await api.post(`/quests/active/${id}/mark-incomplete`); await fetchAll(); };
  const updateRow = async (id, patch) =&gt; { await api.patch(`/quests/active/${id}`, patch); await fetchAll(); };
  const deleteRow = async (id) =&gt; { await api.delete(`/quests/active/${id}`); await fetchAll(); };

  const dueColor = (due) =&gt; {
    if(!due) return "";
    const today = new Date();
    const d = new Date(due + "T00:00:00");
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (d.getTime() &lt; t.getTime()) return "red";
    if (d.getTime() === t.getTime()) return "blue";
    return "green";
  };

  // Calendar navigation
  const onPrev = () =&gt; {
    if(view==='week') setAnchorDate(addDays(anchorDate, -7));
    else if(view==='month') setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth()-1, 1));
    else setAnchorDate(addDays(anchorDate, -1));
  };
  const onNext = () =&gt; {
    if(view==='week') setAnchorDate(addDays(anchorDate, 7));
    else if(view==='month') setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth()+1, 1));
    else setAnchorDate(addDays(anchorDate, 1));
  };
  const onToday = () =&gt; setAnchorDate(new Date());

  // Modal state
  const [editing, setEditing] = useState(null);
  const openTask = (task) =&gt; setEditing(task);
  const closeTask = () =&gt; setEditing(null);
  const saveTask = async (task) =&gt; { await updateRow(task.id, { quest_name: task.quest_name, due_date: task.due_date, due_time: task.due_time || null }); closeTask(); };
  const deleteTask = async (task) =&gt; { await deleteRow(task.id); closeTask(); };

  const [openCustom, setOpenCustom] = useState(false);

  return (
    <div className="app-shell">
      {/* Sidebar with all features (non-collapsible) */}
      <div className="sidebar">
        <XPBadge summary={summary} />
        <div style={{height:12}} />
        <MiniMonth selectedDate={anchorDate} onSelect={(d)=&gt;{ setAnchorDate(d); setView('day'); }} />

        {/* Quick add */}
        <div className="card" style={{marginTop:16}}>
          <div className="kicker" style={{marginBottom:8}}>Quick Add</div>
          <div className="row" style={{flexWrap:'wrap'}}>
            <input className="input" placeholder="Quest Name" value={form.quest_name} onChange={e=&gt;setForm({...form, quest_name: e.target.value})} />
            <select value={form.quest_rank} onChange={e=&gt;setForm({...form, quest_rank: e.target.value})}>{ranks.map(r=&gt; &lt;option key={r} value={r}>{r}&lt;/option&gt;)}</select>
            <input type="date" className="input" value={form.due_date} onChange={e=&gt;setForm({...form, due_date: e.target.value})} />
            <input type="time" className="input" value={form.due_time} onChange={e=&gt;setForm({...form, due_time: e.target.value})} />
            <select value={repeat} onChange={e=&gt;{
              const val = e.target.value; setRepeat(val); if(val==='custom') setOpenCustom(true);
            }}>
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly_on">Weekly on weekday</option>
              <option value="weekdays">Every weekday</option>
              <option value="monthly_on_date">Monthly on date</option>
              <option value="annual">Annually</option>
              <option value="custom">Custom…</option>
            </select>
            <button className="btn" onClick={onCreate}>Add</button>
          </div>
        </div>

        {/* Mini lists */}
        <div className="card" style={{marginTop:16}}>
          <div className="kicker" style={{marginBottom:8}}>Today</div>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {list.filter(t=&gt;t.due_date===ymd(anchorDate)).slice(0,6).map(t=&gt; (
              <button key={t.id} className="task-chip" style={{textAlign:'left'}} onClick={()=&gt;openTask(t)}>{t.quest_name}</button>
            ))}
            {list.filter(t=&gt;t.due_date===ymd(anchorDate)).length===0 &amp;&amp; <span className="small">No tasks</span>}
          </div>
        </div>

        {/* Custom repeat modal */}
        <CustomRepeatModal open={openCustom} baseDate={new Date(form.due_date || new Date())} onClose={()=&gt;setOpenCustom(false)} onSave={(cfg)=&gt;{
          // translate to backend payload and create recurring rule immediately
          try{
            const body = { task_name: form.quest_name, quest_rank: form.quest_rank, frequency: cfg.frequency, status: form.status };
            if (cfg.interval) body.interval = cfg.interval;
            if (cfg.frequency==='Weekly' &amp;&amp; cfg.days) body.days = cfg.days;
            if (cfg.frequency==='Monthly'){
              if (cfg.monthly_mode==='weekday'){
                body.monthly_mode = 'weekday';
                body.monthly_week_index = cfg.monthly_week_index;
                body.monthly_weekday = cfg.monthly_weekday;
              } else {
                body.monthly_on_date = cfg.monthly_on_date;
              }
            }
            if (cfg.ends) body.ends = cfg.ends;
            if (cfg.until_date) body.until_date = cfg.until_date;
            if (cfg.count) body.count = cfg.count;
            // store a signal in repeat state so onCreate doesn't duplicate recurring
            setRepeat('none');
            useApi().post(`/recurring`, body);
          }catch(e){}
        }} />

      </div>

      {/* Main calendar pane */}
      <div className="main-pane">
        <div className="row" style={{justifyContent: 'space-between', marginBottom:12}}>
          <h2>Calendar</h2>
          <XPBadge summary={summary} />
        </div>
        <Calendar
          tasks={list}
          view={view}
          anchorDate={anchorDate}
          onPrev={onPrev}
          onNext={onNext}
          onToday={onToday}
          onViewChange={setView}
          onOpenTask={openTask}
        />

        {/* Under-calendar table like agenda */}
        <div className="card list-scroll" style={{marginTop:16}}>
          &lt;table className="table"&gt;
            &lt;thead&gt;
              &lt;tr&gt;
                &lt;th&gt;Quest Name&lt;/th&gt;
                &lt;th&gt;Quest Rank&lt;/th&gt;
                &lt;th&gt;Due Date&lt;/th&gt;
                &lt;th&gt;Status&lt;/th&gt;
                &lt;th&gt;Actions&lt;/th&gt;
              &lt;/tr&gt;
            &lt;/thead&gt;
            &lt;tbody&gt;
              {list.map(row =&gt; (
                &lt;tr key={row.id}&gt;
                  &lt;td&gt;
                    &lt;button className="btn secondary" onClick={()=&gt;openTask(row)} style={{border:'none', background:'transparent', color:'#111', padding:0}}&gt;
                      {row.quest_name}
                    &lt;/button&gt;
                  &lt;/td&gt;
                  &lt;td&gt;
                    &lt;select value={row.quest_rank} onChange={e=&gt;updateRow(row.id,{quest_rank: e.target.value})}&gt;
                      {ranks.map(r =&gt; &lt;option key={r} value={r}&gt;{r}&lt;/option&gt;)}
                    &lt;/select&gt;
                  &lt;/td&gt;
                  &lt;td&gt;
                    &lt;span className={`dot ${dueColor(row.due_date)}`} style={{marginRight:6}}&gt;&lt;/span&gt;
                    &lt;input type="date" value={row.due_date} onChange={e=&gt;updateRow(row.id,{due_date: e.target.value})} /&gt;
                    {row.due_time ? &lt;span className="small" style={{marginLeft:8}}&gt;{row.due_time}&lt;/span&gt; : null}
                  &lt;/td&gt;
                  &lt;td&gt;
                    &lt;select value={row.status} onChange={async e=&gt;{
                      const val = e.target.value;
                      if (val === 'Completed') return await markCompleted(row.id);
                      if (val === 'Incomplete') return await markIncomplete(row.id);
                      await updateRow(row.id,{status: val});
                    }}&gt;
                      {statuses.map(s =&gt; &lt;option key={s} value={s}&gt;{s}&lt;/option&gt;)}
                    &lt;/select&gt;
                  &lt;/td&gt;
                  &lt;td&gt;
                    &lt;button className="btn secondary" onClick={()=&gt;markCompleted(row.id)}&gt;Complete&lt;/button&gt;
                  &lt;/td&gt;
                &lt;/tr&gt;
              ))}
            &lt;/tbody&gt;
          &lt;/table&gt;
        </div>

        {/* Modal for editing */}
        <TaskEditModal open={!!editing} task={editing} onClose={closeTask} onSave={saveTask} onDelete={deleteTask} />
      </div>
    </div>
  );
}

function Completed(){
  const api = useApi();
  const [list, setList] = useState([]);
  const { summary } = useXPSummary();

  const load = async () =&gt; {
    const { data } = await api.get(`/quests/completed`);
    setList(data);
  };
  useEffect(() =&gt; { load(); }, []);

  const fmt = (iso) =&gt; new Date(iso).toLocaleString();

  return (
    <div className="container">
      <div className="row" style={{justifyContent: 'space-between'}}>
        <h2>Completed Quests</h2>
        <div className="badge small">Total earned: {summary.total_earned}</div>
      </div>
      <div className="card" style={{marginTop:16}}>
        &lt;table className="table"&gt;
          &lt;thead&gt;
            &lt;tr&gt;
              &lt;th&gt;Quest Name&lt;/th&gt;
              &lt;th&gt;Quest Rank&lt;/th&gt;
              &lt;th&gt;XP Earned&lt;/th&gt;
              &lt;th&gt;Date Completed&lt;/th&gt;
            &lt;/tr&gt;
          &lt;/thead&gt;
          &lt;tbody&gt;
            {list.map(r =&gt; (
              &lt;tr key={r.id}&gt;
                &lt;td&gt;{r.quest_name}&lt;/td&gt;
                &lt;td&gt;{r.quest_rank}&lt;/td&gt;
                &lt;td&gt;{r.xp_earned}&lt;/td&gt;
                &lt;td&gt;{fmt(r.date_completed)}&lt;/td&gt;
              &lt;/tr&gt;
            ))}
          &lt;/tbody&gt;
        &lt;/table&gt;
      </div>
    </div>
  );
}

function Rewards(){
  const api = useApi();
  const { summary, refresh: refreshXP } = useXPSummary();
  const [store, setStore] = useState([]);
  const [log, setLog] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState({ reward_name: "", xp_cost: 25 });

  const load = async () =&gt; {
    const [s, l, inv] = await Promise.all([
      api.get(`/rewards/store`),
      api.get(`/rewards/log`),
      api.get(`/rewards/inventory`)
    ]);
    setStore(s.data); setLog(l.data); setInventory(inv.data);
  };
  useEffect(()=>{ load(); },[]);

  // ---- Minimal B&amp;W confetti animation ----
  const fireRewardAnimation = (evt, variant='redeem') =&gt; {
    const x = evt?.clientX ?? window.innerWidth/2;
    const y = evt?.clientY ?? window.innerHeight/2;
    const container = document.createElement('div');
    container.className = 'reward-anim-container';
    document.body.appendChild(container);
    const pieces = 24;
    let removed = 0;
    const cleanup = () =&gt; { removed++; if (removed &gt;= pieces) container.remove(); };
    for (let i=0;i&lt;pieces;i++){
      const el = document.createElement('span');
      el.className = 'reward-confetti';
      const dx = (Math.random()*2-1) * 160; // -160..160
      const dy = - (40 + Math.random()*160); // upwards
      const rot = (Math.random()*360 - 180).toFixed(0) + 'deg';
      const size = 6 + Math.random()*6;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.borderRadius = Math.random() &gt; .5 ? '50%' : '2px';
      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');
      el.style.setProperty('--rot', rot);
      el.style.setProperty('--bg', variant==='use' ? '#333' : '#111');
      el.addEventListener('animationend', cleanup, { once: true });
      container.appendChild(el);
    }
    // safety cleanup
    setTimeout(() =&gt; { try{container.remove();}catch{} }, 1200);
  };

  const addOrUpdate = async (e) =&gt; {
    e.preventDefault();
    if(!form.reward_name || !form.xp_cost) return;
    await api.post(`/rewards/store`, form);
    setForm({ reward_name: "", xp_cost: 25 });
    await load();
  };
  const del = async (id) =&gt; { await api.delete(`/rewards/store/${id}`); await load(); };

  const redeem = async (id, evt) =&gt; {
    try{
      await api.post(`/rewards/redeem`, { reward_id: id });
      fireRewardAnimation(evt, 'redeem');
      await Promise.all([load(), refreshXP()]);
    }catch(err){
      alert(err?.response?.data?.detail || 'Unable to redeem');
    }
  };
  const useReward = async (id, evt) =&gt; {
    try{
      await api.post(`/rewards/use/${id}`);
      fireRewardAnimation(evt, 'use');
      await Promise.all([load(), refreshXP()]);
    }catch(err){
      alert(err?.response?.data?.detail || 'Unable to use reward');
    }
  };

  const fmt = (iso) =&gt; new Date(iso).toLocaleString();

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2>Rewards</h2>
        <XPBadge summary={summary} />
      </div>

      <form onSubmit={addOrUpdate} className="card" style={{marginTop:16}}>
        <div className="row">
          <input className="input" placeholder="Reward name" value={form.reward_name} onChange={e=&gt;setForm({...form, reward_name:e.target.value})} />
          &lt;input className="input" type="number" placeholder="XP cost" value={form.xp_cost} onChange={e=&gt;setForm({...form, xp_cost: Number(e.target.value)})} /&gt;
          <button className="btn" type="submit">Save</button>
        </div>
      </form>

      <div className="card" style={{marginTop:16}}>
        <h3 className="kicker">Reward Store</h3>
        &lt;table className="table"&gt;
          &lt;thead&gt;
            &lt;tr&gt;&lt;th&gt;Reward&lt;/th&gt;&lt;th&gt;XP Cost&lt;/th&gt;&lt;th&gt;Actions&lt;/th&gt;&lt;/tr&gt;
          &lt;/thead&gt;
          &lt;tbody&gt;
            {store.map(s =&gt; (
              &lt;tr key={s.id}&gt;
                &lt;td&gt;{s.reward_name}&lt;/td&gt;
                &lt;td&gt;{s.xp_cost}&lt;/td&gt;
                &lt;td style={{display:'flex', gap:8}}&gt;
                  &lt;button className="btn" onClick={(e)=&gt;redeem(s.id, e)}&gt;Redeem&lt;/button&gt;
                  &lt;button className="btn secondary" onClick={()=&gt;del(s.id)}&gt;Delete&lt;/button&gt;
                &lt;/td&gt;
              &lt;/tr&gt;
            ))}
          &lt;/tbody&gt;
        &lt;/table&gt;
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3 className="kicker">My Redeemed Rewards</h3>
        &lt;table className="table"&gt;
          &lt;thead&gt;
            &lt;tr&gt;&lt;th&gt;Date Redeemed&lt;/th&gt;&lt;th&gt;Reward&lt;/th&gt;&lt;th&gt;XP Cost&lt;/th&gt;&lt;th&gt;Status&lt;/th&gt;&lt;th&gt;Actions&lt;/th&gt;&lt;/tr&gt;
          &lt;/thead&gt;
          &lt;tbody&gt;
            {inventory.filter(i=&gt;!i.used).map(item =&gt; (
              &lt;tr key={item.id}&gt;
                &lt;td&gt;{fmt(item.date_redeemed)}&lt;/td&gt;
                &lt;td&gt;{item.reward_name}&lt;/td&gt;
                &lt;td&gt;{item.xp_cost}&lt;/td&gt;
                &lt;td&gt;{item.used ? 'Used' : 'Available'}&lt;/td&gt;
                &lt;td&gt;
                  {!item.used ? (
                    &lt;button className="btn" onClick={(e)=&gt;useReward(item.id, e)}&gt;Use&lt;/button&gt;
                  ) : null}
                &lt;/td&gt;
              &lt;/tr&gt;
            ))}
          &lt;/tbody&gt;
        &lt;/table&gt;
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3 className="kicker">Reward Log</h3>
        &lt;table className="table"&gt;
          &lt;thead&gt;
            &lt;tr&gt;&lt;th&gt;Date Redeemed&lt;/th&gt;&lt;th&gt;Reward&lt;/th&gt;&lt;th&gt;XP Cost&lt;/th&gt;&lt;/tr&gt;
          &lt;/thead&gt;
          &lt;tbody&gt;
            {log.map(l =&gt; (
              &lt;tr key={l.id}&gt;
                &lt;td&gt;{fmt(l.date_redeemed)}&lt;/td&gt;
                &lt;td&gt;{l.reward_name}&lt;/td&gt;
                &lt;td&gt;{l.xp_cost}&lt;/td&gt;
              &lt;/tr&gt;
            ))}
          &lt;/tbody&gt;
        &lt;/table&gt;
      </div>
    </div>
  );
}

function Recurring(){
  const api = useApi();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ task_name: "", quest_rank: "Common", frequency: "Daily", days: "", status: "Pending" });

  const load = async () =&gt; { const { data } = await api.get(`/recurring`); setRows(data); };
  useEffect(()=>{ load(); },[]);

  const upsert = async (e) =&gt; { e.preventDefault(); await api.post(`/recurring`, form); setForm({ task_name: "", quest_rank: "Common", frequency: "Daily", days: "", status: "Pending" }); await load(); };
  const del = async (id) =&gt; { await api.delete(`/recurring/${id}`); await load(); };
  const run = async () =&gt; { await api.post(`/recurring/run`); };

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2>Recurring Tasks</h2>
        <button className="btn" onClick={run}>Generate Today's Quests</button>
      </div>

      <form onSubmit={upsert} className="card" style={{marginTop:16}}>
        <div className="row">
          <input className="input" placeholder="Task name" value={form.task_name} onChange={e=&gt;setForm({...form, task_name:e.target.value})} />
          <select value={form.quest_rank} onChange={e=&gt;setForm({...form, quest_rank:e.target.value})}>{ranks.map(r=&gt;&lt;option key={r}&gt;{r}&lt;/option&gt;)}</select>
          <select value={form.frequency} onChange={e=&gt;setForm({...form, frequency:e.target.value})}>
            {['Daily','Weekly','Weekdays','Monthly'].map(f=&gt; &lt;option key={f}&gt;{f}&lt;/option&gt;)}
          </select>
          <input className="input" placeholder="Days (Mon, Fri) for Weekly" value={form.days} onChange={e=&gt;setForm({...form, days: e.target.value})} />
          <select value={form.status} onChange={e=&gt;setForm({...form, status:e.target.value})}>{['Pending','In Progress','Completed','Incomplete'].map(s=&gt; &lt;option key={s}&gt;{s}&lt;/option&gt;)}</select>
          <button className="btn" type="submit">Add</button>
        </div>
      </form>

      <div className="card" style={{marginTop:16}}>
        &lt;table className="table"&gt;
          &lt;thead&gt;
            &lt;tr&gt;&lt;th&gt;Task Name&lt;/th&gt;&lt;th&gt;Quest Rank&lt;/th&gt;&lt;th&gt;Frequency&lt;/th&gt;&lt;th&gt;Days&lt;/th&gt;&lt;th&gt;Status&lt;/th&gt;&lt;th&gt;Last Added&lt;/th&gt;&lt;th&gt;Actions&lt;/th&gt;&lt;/tr&gt;
          &lt;/thead&gt;
          &lt;tbody&gt;
            {rows.map(r =&gt; (
              &lt;tr key={r.id}&gt;
                &lt;td&gt;{r.task_name}&lt;/td&gt;
                &lt;td&gt;{r.quest_rank}&lt;/td&gt;
                &lt;td&gt;{r.frequency}&lt;/td&gt;
                &lt;td&gt;{r.days || '-'}&lt;/td&gt;
                &lt;td&gt;{r.status}&lt;/td&gt;
                &lt;td&gt;{r.last_added || '-'}&lt;/td&gt;
                &lt;td&gt;&lt;button className="btn secondary" onClick={()=&gt;del(r.id)}&gt;Delete&lt;/button&gt;&lt;/td&gt;
              &lt;/tr&gt;
            ))}
          &lt;/tbody&gt;
        &lt;/table&gt;
      </div>
    </div>
  );
}

function Rules(){
  const api = useApi();
  const [rules, setRules] = useState("");

  const load = async () =&gt; { const { data } = await api.get(`/rules`); setRules(data?.content || ""); };
  useEffect(()=>{ load(); },[]);

  const save = async () =&gt; { await api.put(`/rules`, { content: rules }); };

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2>Rules</h2>
        <button className="btn" onClick={save}>Save</button>
      </div>
      <div className="card" style={{marginTop:16}}>
        &lt;textarea rows={10} style={{width:'100%'}} value={rules} onChange={e=&gt;setRules(e.target.value)} /&gt;
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