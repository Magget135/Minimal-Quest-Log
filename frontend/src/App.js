import React, { useEffect, useMemo, useState, useRef } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Shared helpers
const ranks = ["Common", "Rare", "Epic", "Legendary"];
const statuses = ["Pending", "In Progress", "Completed", "Incomplete"];

const COLOR_PALETTE = [
  "#A3B18A", "#F4A261", "#E9C46A", "#2A9D8F", "#457B9D", "#B56576",
  "#6D597A", "#B8B8FF", "#FFD6A5", "#FDFFB6", "#CAFFBF", "#9BF6FF",
  "#A0C4FF", "#BDB2FF", "#FFC6FF", "#D0F4DE"
];
const UNCATEGORIZED = { id: null, name: "Uncategorized", color: "#B0B0B0", active: true };

function hexToRgba(hex, alpha=0.2){
  try{
    const h = hex.replace('#','');
    const bigint = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }catch{ return `rgba(0,0,0,${alpha})`; }
}

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
        <button className="btn secondary" onClick={()=>setCurrent(new Date(current.getFullYear(), current.getMonth()+1, 1))}>▶</button>
      </div>
      <div className="mini-grid">
        {weekdays.map(w => <div key={w} className="mini-dow">{w}</div>)}
        {cells.map((d, idx)=>{
          const isOther = d.getMonth() !== current.getMonth();
          const key = ymd(d);
          const isSelected = ymd(selectedDate) === key;
          return (
            <div key={idx} className={`mini-cell ${isOther?'other':''} ${isSelected?'selected':''}`} onClick={()=>onSelect(d)}>
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
  const refresh = async () => {
    const { data } = await api.get(`/xp/summary`);
    setSummary(data);
  };
  useEffect(() => { refresh(); }, []);
  return { summary, refresh };
}

// Date helpers
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const startOfWeekMon = (d) => { const day = d.getDay(); const diff = (day === 0 ? -6 : 1) - day; const res = new Date(d); res.setDate(d.getDate()+diff); return new Date(res.getFullYear(), res.getMonth(), res.getDate()); };
const addDays = (d, n) => { const res = new Date(d); res.setDate(d.getDate()+n); return res; };
function startOfMonthGridMon(d){ const first = new Date(d.getFullYear(), d.getMonth(), 1); return startOfWeekMon(first); }

const HOUR_HEIGHT = 48; // px
const MINUTE_PX = HOUR_HEIGHT / 60; // 0.8px per min
const SNAP_MIN = 15;
const SINGLE_CLICK_DEFAULT = 30; // minutes
const snapMin = (mins) => Math.round(mins / SNAP_MIN) * SNAP_MIN;
const hhmm = (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

function MonthCalendar({tasks, view, anchorDate, onPrev, onNext, onToday, onViewChange, onOpenTask, onCreateAtDay, getCategoryColor}){
  let cells = [];
  const headerTitle = anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (view === 'week') {
    const start = startOfWeekMon(anchorDate);
    cells = Array.from({length:7}, (_,i)=> addDays(start,i));
  } else if (view === 'month') {
    const start = startOfMonthGridMon(anchorDate);
    cells = Array.from({length:42}, (_,i)=> addDays(start,i));
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
            <button className={`btn secondary`} onClick={()=>onViewChange('day')}>Day</button>
            <button className={`btn secondary`} onClick={()=>onViewChange('week')}>Week</button>
            <button className={`btn secondary`} onClick={()=>onViewChange('month')}>Month</button>
          </div>
        </div>
      </div>
      {view !== 'day' && (
        <div className="month-headers">
          {weekdays.map((w,i) => <div key={i} className="month-head-cell">{w}</div>)}
        </div>
      )}
      <div className={`calendar-grid ${view}`}>
        {cells.map((day, idx) => {
          const key = ymd(day);
          const items = tasks.filter(t => t.due_date === key);
          return (
            <div key={idx} className="calendar-cell" onDoubleClick={()=> onCreateAtDay && onCreateAtDay(day)}>
              <div className="calendar-day-number">{day.getDate()}</div>
              <div className="calendar-tasks">
                {items.map(item => {
                  const color = getCategoryColor(item.category_id);
                  const bg = hexToRgba(color, 0.2);
                  const style = { backgroundColor: bg, color: '#111', border: `1px solid ${color}` };
                  return (
                    <div key={item.id} className="task-chip" style={style} title={item.quest_name} onClick={()=>onOpenTask(item)}>
                      {item.quest_name}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeCalendar({tasks, view, anchorDate, onPrev, onNext, onToday, onViewChange, onOpenTask, onCreateSelection, getCategoryColor}){
  const isWeek = view === 'week';
  const start = isWeek ? startOfWeekMon(anchorDate) : new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  const days = isWeek ? Array.from({length:7}, (_,i)=> addDays(start,i)) : [start];

  // Group tasks by date
  const byDate = Object.create(null);
  days.forEach(d => { byDate[ymd(d)] = { timed: [], allDay: [] }; });
  tasks.forEach(t => {
    if (byDate[t.due_date]) {
      if (t.due_time) byDate[t.due_date].timed.push(t); else byDate[t.due_date].allDay.push(t);
    }
  });
  Object.values(byDate).forEach(bucket => {
    bucket.timed.sort((a,b)=> (a.due_time||"00:00").localeCompare(b.due_time||"00:00"));
  });

  const hours = Array.from({length:24}, (_,i)=> i);

  const dow = (d) => d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const dom = (d) => d.getDate();
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
            <button className={`btn secondary`} onClick={()=>onViewChange('day')}>Day</button>
            <button className={`btn secondary`} onClick={()=>onViewChange('week')}>Week</button>
            <button className={`btn secondary`} onClick={()=>onViewChange('month')}>Month</button>
          </div>
        </div>
      </div>

      <div className="time-scroll">
        {/* Day headers */}
        <div className={`day-headers ${isWeek ? 'week' : 'day'}`}>
          <div className="day-head-cell" />
          {days.map(d => (
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
          {days.map(d => (
            <div key={ymd(d)} className="col">
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {byDate[ymd(d)].allDay.map(item => {
                  const color = getCategoryColor(item.category_id);
                  const bg = hexToRgba(color, 0.2);
                  return (
                    <div key={item.id} className="task-chip" style={{ backgroundColor: bg, border: `1px solid ${color}` }} onClick={()=>onOpenTask(item)}>{item.quest_name}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className={`time-grid ${isWeek ? 'week' : 'day'}`}>
          <div className="time-labels">
            {hours.map(h => (
              <div key={h} className="time-hour">{h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`}</div>
            ))}
          </div>
          {days.map(d => (
            <DayColumn key={ymd(d)} day={d} items={byDate[ymd(d)].timed} onOpenTask={onOpenTask} onCreateSelection={onCreateSelection} getCategoryColor={getCategoryColor} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, items, onOpenTask, onCreateSelection, getCategoryColor }){
  const colRef = useRef(null);
  const [draft, setDraft] = useState(null); // { top, height }
  const [dragState, setDragState] = useState(null); // { id, mode: 'move'|'resize', startY, origStartMin, origDuration }
  const movedRef = useRef(false);

  // Helpers
  const pxToMin = (y) => Math.max(0, Math.min(24*60, Math.round(y / MINUTE_PX)));

  // Selection to create
  const onMouseDown = (e) => { movedRef.current = false;
    if (e.target.closest('.task-block')) return; // don't start selection on task
    const rect = colRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const startMin = snapMin(pxToMin(y));
    setDraft({ top: startMin * MINUTE_PX, height: SNAP_MIN * MINUTE_PX, startMin, duration: SNAP_MIN });

    const onMove = (ev) => { movedRef.current = true;
      const yy = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));
      const curMin = snapMin(pxToMin(yy));
      const dur = Math.max(SNAP_MIN, curMin - startMin);
      setDraft({ top: startMin * MINUTE_PX, height: dur * MINUTE_PX, startMin, duration: dur });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (draft && movedRef.current) {
        const start = draft.startMin;
        const dur = Math.max(SNAP_MIN, draft.duration);
        onCreateSelection(day, start, dur);
      } else {
        // treat as simple click -> default 30 min slot where clicked
        const dur = SINGLE_CLICK_DEFAULT;
        onCreateSelection(day, startMin, dur);
      }
      setDraft(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
  };

  // Drag/resize existing task
  const startMove = (t, e) => {
    e.stopPropagation();
    const rect = colRef.current.getBoundingClientRect();
    const [hh, mm] = (t.due_time || "00:00").split(":").map(Number);
    const startMin = (hh*60 + mm);
    setDragState({ id: t.id, mode: 'move', startY: e.clientY - rect.top, origStartMin: startMin, origDuration: t.duration_minutes || 60 });
    const onMove = (ev) => {
      const dy = ev.clientY - rect.top - dragState.startY;
      const dmin = snapMin(pxToMin(dy)) - snapMin(pxToMin(0));
      const newStart = Math.max(0, Math.min(24*60 - (dragState?.origDuration||60), dragState.origStartMin + dmin));
      setDragState((s)=> ({ ...s, previewStart: newStart }));
    };
    const onUp = async () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const newStart = dragState?.previewStart ?? startMin;
      const newTime = hhmm(newStart);
      await onPatchTask(t.id, { due_time: newTime });
      setDragState(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
  };
  const startResize = (t, e) => {
    e.stopPropagation();
    const rect = colRef.current.getBoundingClientRect();
    const origDur = t.duration_minutes || 60;
    const startY = e.clientY - rect.top;
    setDragState({ id: t.id, mode: 'resize', startY, origStartMin: null, origDuration: origDur });
    const onMove = (ev) => {
      const dy = ev.clientY - rect.top - startY;
      const dmin = snapMin(pxToMin(dy));
      const newDur = Math.max(SNAP_MIN, origDur + dmin);
      setDragState((s)=> ({ ...s, previewDuration: newDur }));
    };
    const onUp = async () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const newDur = dragState?.previewDuration ?? origDur;
      await onPatchTask(t.id, { duration_minutes: newDur });
      setDragState(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
  };

  // Patch helper via custom event to parent (set in window)
  const onPatchTask = async (id, patch) => {
    // Dispatch custom event the parent listens to
    const evt = new CustomEvent('quest:patch', { detail: { id, patch } });
    window.dispatchEvent(evt);
  };

  const renderHourLines = () => Array.from({length:24}, (_,h) => (
    <div key={h} className="time-hour-line" style={{ top: h * HOUR_HEIGHT }} />
  ));

  const renderTaskBlock = (t) => {
    const [hh, mm] = (t.due_time || "00:00").split(":").map(Number);
    let startMin = (hh*60 + mm);
    let dur = t.duration_minutes || 60;
    if (dragState && dragState.id === t.id) {
      if (dragState.mode === 'move' && typeof dragState.previewStart === 'number') startMin = dragState.previewStart;
      if (dragState.mode === 'resize' && typeof dragState.previewDuration === 'number') dur = dragState.previewDuration;
    }
    const top = startMin * MINUTE_PX;
    const height = Math.max(22, dur * MINUTE_PX);
    const endMin = startMin + dur;
    const label = `${hhmm(startMin)}–${hhmm(endMin)}`;
    const color = getCategoryColor(t.category_id);
    const style = { borderColor: color, boxShadow: `inset 4px 0 0 0 ${color}` };
    return (
      <div key={t.id} className={`task-block ${dragState && dragState.id===t.id ? 'dragging':''}`} style={{ top, height, ...style }} title={t.quest_name} onMouseDown={(e)=>startMove(t,e)} onClick={()=>onOpenTask(t)}>
        <span className="task-time">{t.due_time ? label : ''}</span>{t.quest_name}
        <div className="resize-handle" onMouseDown={(e)=>startResize(t,e)} />
        {dragState && dragState.id===t.id ? (
          <span className="live-time-badge">{label}</span>
        ) : null}
      </div>
    );
  };

  const nowLine = () => {
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
    <div ref={colRef} className="time-col" onMouseDown={onMouseDown}>
      {renderHourLines()}
      {items.map(renderTaskBlock)}
      {draft ? <div className="draft-block" style={{ top: draft.top, height: draft.height }} /> : null}
      {nowLine()}
    </div>
  );
}

function Calendar({ tasks, view, anchorDate, onPrev, onNext, onToday, onViewChange, onOpenTask, onCreateSelection, onCreateAtDay, getCategoryColor }){
  if (view === 'month') {
    return <MonthCalendar tasks={tasks} view={view} anchorDate={anchorDate} onPrev={onPrev} onNext={onNext} onToday={onToday} onViewChange={onViewChange} onOpenTask={onOpenTask} onCreateAtDay={onCreateAtDay} getCategoryColor={getCategoryColor} />
  }
  return <TimeCalendar tasks={tasks} view={view} anchorDate={anchorDate} onPrev={onPrev} onNext={onNext} onToday={onToday} onViewChange={onViewChange} onOpenTask={onOpenTask} onCreateSelection={onCreateSelection} getCategoryColor={getCategoryColor} />
}

function PillDays({ value, onChange }){
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const selected = new Set(value || []);
  const toggle = (d) => {
    const next = new Set(selected);
    if (next.has(d)) next.delete(d); else next.add(d);
    onChange(Array.from(next));
  };
  return (
    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
      {days.map(d => (
        <button key={d} type="button" className={`pill ${selected.has(d)?'pill-on':'pill-off'}`} onClick={()=>toggle(d)}>{d}</button>
      ))}
    </div>
  );
}

function TaskEditModal({ open, task, onClose, onSave, onDelete, onSaveRecurrence, onRemoveRecurrence, categories }){
  const api = useApi();
  const [name, setName] = useState(task?.quest_name || "");
  const [due, setDue] = useState(task?.due_date || "");
  const [dueTime, setDueTime] = useState(task?.due_time || "");
  const [duration, setDuration] = useState(task?.duration_minutes || 60);
  const [categoryId, setCategoryId] = useState(task?.category_id ?? null);
  const [repeatMode, setRepeatMode] = useState('none');
  const [weeklyPills, setWeeklyPills] = useState([]);

  useEffect(()=>{ setName(task?.quest_name || ""); setDue(task?.due_date || ""); setDueTime(task?.due_time || ""); setDuration(task?.duration_minutes || 60); setCategoryId(task?.category_id ?? null); }, [task]);
  useEffect(()=>{
    let mounted = true;
    const loadRec = async () => {
      if (!task?.id) return;
      try{
        const { data } = await api.get(`/quests/active/${task.id}/recurrence`);
        if(!mounted) return;
        if (data && data.frequency){
          setRepeatMode(data.frequency);
          if (data.frequency === 'Weekly') setWeeklyPills((data.days||'').split(',').map(s=>s.trim()).filter(Boolean)); else setWeeklyPills([]);
        } else {
          setRepeatMode('none'); setWeeklyPills([]);
        }
      }catch{}
    };
    loadRec();
    return () => { mounted = false; }
  }, [task]);

  if(!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Task</h3>
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
        <div className="row" style={{marginBottom:8, flexWrap:'wrap'}}>
          <input className="input" placeholder="Task name" value={name} onChange={e=>setName(e.target.value)} />
          <input className="input" type="date" value={due} onChange={e=>setDue(e.target.value)} />
          <input className="input" type="time" value={dueTime} onChange={e=>setDueTime(e.target.value)} />
          <select className="input" value={duration} onChange={e=>setDuration(Number(e.target.value))}>
            {[15,30,45,60,90,120,180].map(v=> <option key={v} value={v}>{v} min</option>)}
          </select>
          {/* Category selector */}
          <div className="row" style={{gap:6, alignItems:'center'}}>
            <span className="small">Category:</span>
            <select className="input" value={categoryId ?? 'null'} onChange={(e)=> setCategoryId(e.target.value==='null'? null : e.target.value)}>
              <option value={'null'}>{UNCATEGORIZED.name}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="row" style={{marginBottom:8, flexWrap:'wrap'}}>
          <select value={repeatMode} onChange={e=>setRepeatMode(e.target.value)}>
            <option value="none">Does not repeat</option>
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Weekdays">Weekdays</option>
            <option value="Monthly">Monthly</option>
            <option value="Annual">Annual</option>
          </select>
          {repeatMode==='Weekly' && (
            <PillDays value={weeklyPills} onChange={setWeeklyPills} />
          )}
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={()=>onDelete(task)}>Delete</button>
          <button className="btn" onClick={()=>{
            onSave({ ...task, quest_name: name, due_date: due, due_time: dueTime || null, duration_minutes: duration, category_id: categoryId });
            if (repeatMode==='none') {
              onRemoveRecurrence(task);
            } else {
              const body = { frequency: repeatMode, days: repeatMode==='Weekly'? weeklyPills.join(', ') : undefined };
              onSaveRecurrence(task, body);
            }
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function QuickCreateModal({ open, dateStr, startMin, duration, allDay, onClose, onCreate, categories }){
  const [title, setTitle] = useState("");
  const [rank, setRank] = useState("Common");
  const [categoryId, setCategoryId] = useState(null);
  const [isAllDay, setIsAllDay] = useState(!!allDay);
  const [start, setStart] = useState(startMin || 9*60);
  const [dur, setDur] = useState(duration || 60);
  const [freq, setFreq] = useState('none');
  const [weeklyPills, setWeeklyPills] = useState([]);

  useEffect(()=>{ setIsAllDay(!!allDay); setStart(startMin || 9*60); setDur(duration || 60); }, [open, startMin, duration, allDay]);

  if(!open) return null;

  const timeOptions = Array.from({length:96}, (_,i)=> i*15).map(m=> ({ m, label: hhmm(m) }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h3>Quick Add</h3><button className="btn secondary" onClick={onClose}>Close</button></div>
        <div className="row" style={{flexWrap:'wrap', gap:8}}>
          <input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
          <select value={rank} onChange={e=>setRank(e.target.value)}>{ranks.map(r=> <option key={r} value={r}>{r}</option>)}</select>
          <div className="row" style={{gap:6, alignItems:'center'}}>
            <span className="small">Category:</span>
            <select className="input" value={categoryId ?? 'null'} onChange={(e)=> setCategoryId(e.target.value==='null'? null : e.target.value)}>
              <option value={'null'}>{UNCATEGORIZED.name}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="row" style={{gap:10, alignItems:'center'}}>
            <label className="small"><input type="checkbox" checked={isAllDay} onChange={(e)=>setIsAllDay(e.target.checked)} /> All-day</label>
            {!isAllDay && (
              <>
                <select className="input" value={start} onChange={(e)=>setStart(Number(e.target.value))}>
                  {timeOptions.map(o=> <option key={o.m} value={o.m}>{o.label}</option>)}
                </select>
                <select className="input" value={dur} onChange={(e)=>setDur(Number(e.target.value))}>
                  {[15,30,45,60,90,120,180].map(v=> <option key={v} value={v}>{v} min</option>)}
                </select>
              </>
            )}
          </div>
          <div className="row" style={{gap:8, alignItems:'center'}}>
            <span className="small">Repeat:</span>
            <select value={freq} onChange={e=>setFreq(e.target.value)}>
              <option value="none">Does not repeat</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Weekdays">Weekdays</option>
              <option value="Monthly">Monthly</option>
              <option value="Annual">Annual</option>
            </select>
            {freq === 'Weekly' && <PillDays value={weeklyPills} onChange={setWeeklyPills} />}
          </div>
          <span className="small">{dateStr} {isAllDay ? '(All-day)' : `${hhmm(start)}–${hhmm(start+dur)}`}</span>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={()=> onCreate({ title, rank, category_id: categoryId, allDay: isAllDay, startMin: start, duration: dur, frequency: freq, days: weeklyPills })} disabled={!title}>Create</button>
        </div>
      </div>
    </div>
  );
}

function DeleteScopeModal({ open, onClose, onDeleteOnly, onDeleteAll }){
  if(!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h3>Delete event</h3><button className="btn secondary" onClick={onClose}>Close</button></div>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <button className="btn secondary" onClick={onDeleteOnly}>Delete this event only</button>
          <button className="btn secondary" onClick={onDeleteAll}>Delete this event and its recurrence</button>
        </div>
      </div>
    </div>
  );
}

function useCategories(){
  const api = useApi();
  const [cats, setCats] = useState([]);
  const load = async () => {
    const { data } = await api.get(`/categories`);
    setCats(data);
  };
  const create = async ({ name, color, active=true }) => {
    const { data } = await api.post(`/categories`, { name, color, active });
    await load();
    return data;
  };
  const patch = async (id, body) => { await api.patch(`/categories/${id}`, body); await load(); };
  const remove = async (id) => { await api.delete(`/categories/${id}`); await load(); };
  useEffect(()=>{ load(); },[]);
  return { cats, load, create, patch, remove };
}

function ActiveQuests({ hideExtras=false }){
  const api = useApi();
  const { summary } = useXPSummary();
  const { cats, create: createCat, patch: patchCat, remove: removeCat } = useCategories();
  const [list, setList] = useState([]);

  // calendar state
  const [view, setView] = useState('week'); // default 1 week
  const [anchorDate, setAnchorDate] = useState(new Date());

  const [form, setForm] = useState({ quest_name: "", quest_rank: "Common", due_date: "", due_time: "", status: "Pending" });
  const [repeat, setRepeat] = useState('none'); // legacy sidebar quick add select

  // Quick create from selection (modal)
  const [quick, setQuick] = useState({ open:false, dateStr:'', startMin:0, duration:60, allDay:false });

  // Category filtering
  const [selectedCatIds, setSelectedCatIds] = useState(()=>{
    try{ const s = localStorage.getItem('categoryFilters'); return s ? JSON.parse(s) : null; }catch{return null}
  });
  const saveFilters = (ids) => { setSelectedCatIds(ids); try{ localStorage.setItem('categoryFilters', JSON.stringify(ids)); }catch{} };
  const allIds = ["null", ...cats.map(c=>c.id)];
  useEffect(()=>{ if (!selectedCatIds && cats.length){ saveFilters(allIds); } }, [cats]);

  const getCategoryColor = (id) => {
    if (!id) return UNCATEGORIZED.color;
    const c = cats.find(x=>x.id===id);
    return c?.color || UNCATEGORIZED.color;
  };

  const fetchAll = async () => {
    const q = await api.get(`/quests/active`);
    // sort by due_date then due_time
    const sorted = [...q.data].sort((a,b) => {
      const da = new Date(a.due_date + 'T00:00:00').getTime();
      const db = new Date(b.due_date + 'T00:00:00').getTime();
      if (da !== db) return da - db;
      const ta = (a.due_time || '');
      const tb = (b.due_time || '');
      return ta.localeCompare(tb);
    });
    setList(sorted);
  };

  useEffect(() => { fetchAll(); }, []);

  // Global patch listener used by DayColumn drag/resize
  useEffect(()=>{
    const handler = async (e) => {
      const { id, patch } = e.detail;
      await api.patch(`/quests/active/${id}`, patch);
      await fetchAll();
    };
    window.addEventListener('quest:patch', handler);
    return () => window.removeEventListener('quest:patch', handler);
  }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    if(!form.quest_name || !form.due_date) return;
    await api.post(`/quests/active`, { ...form, due_time: form.due_time || null, duration_minutes: 60 });
    // Keep legacy sidebar quick add recurrence (unchanged)
    try {
      const d = new Date(form.due_date + 'T00:00:00');
      let recurringBody = null;
      if (repeat === 'daily') {
        recurringBody = { task_name: form.quest_name, quest_rank: form.quest_rank, frequency: 'Daily', status: form.status };
      } else if (repeat === 'weekly_on') {
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

  // Create from selection
  const onCreateSelection = (dayDate, startMin, duration) => {
    setQuick({ open:true, dateStr: ymd(dayDate), startMin, duration });
  };
  const onCreateAtDay = (dayDate) => { setQuick({ open:true, dateStr: ymd(dayDate), startMin: 9*60, duration:60, allDay:true }); };

  // New quick add flow with recurrence per-quest
  const confirmQuickCreate = async ({ title, rank, category_id, allDay, startMin, duration, frequency, days }) => {
    // 1) Create quest
    const body = {
      quest_name: title,
      quest_rank: rank,
      due_date: quick.dateStr,
      due_time: allDay ? null : hhmm(startMin),
      duration_minutes: allDay ? null : duration,
      status: 'Pending',
      category_id: category_id || null,
    };
    const { data: created } = await api.post(`/quests/active`, body);
    // 2) Recurrence if any
    if (frequency && frequency !== 'none') {
      const rec = { frequency };
      if (frequency === 'Weekly' && days && days.length) rec['days'] = days.join(', ');
      await api.put(`/quests/active/${created.id}/recurrence`, rec);
    }
    setQuick({ ...quick, open:false });
    await fetchAll();
  };

  const markCompleted = async (id) => { await api.post(`/quests/active/${id}/complete`); await fetchAll(); };
  const markIncomplete = async (id) => { await api.post(`/quests/active/${id}/mark-incomplete`); await fetchAll(); };
  const updateRow = async (id, patch) => { await api.patch(`/quests/active/${id}`, patch); await fetchAll(); };
  const deleteRow = async (id) => { await api.delete(`/quests/active/${id}`); await fetchAll(); };

  const dueColor = (due) => {
    if(!due) return "";
    const today = new Date();
    const d = new Date(due + "T00:00:00");
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (d.getTime() < t.getTime()) return "red";
    if (d.getTime() === t.getTime()) return "blue";
    return "green";
  };

  // Calendar navigation
  const onPrev = () => {
    if(view==='week') setAnchorDate(addDays(anchorDate, -7));
    else if(view==='month') setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth()-1, 1));
    else setAnchorDate(addDays(anchorDate, -1));
  };
  const onNext = () => {
    if(view==='week') setAnchorDate(addDays(anchorDate, 7));
    else if(view==='month') setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth()+1, 1));
    else setAnchorDate(addDays(anchorDate, 1));
  };
  const onToday = () => setAnchorDate(new Date());

  // Modal state
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open:false, task:null });
  const openTask = (task) => setEditing(task);
  const closeTask = () => setEditing(null);
  const saveTask = async (task) => { await updateRow(task.id, { quest_name: task.quest_name, due_date: task.due_date, due_time: task.due_time || null, duration_minutes: task.duration_minutes || 60, category_id: task.category_id ?? null }); closeTask(); };
  const deleteTask = async (task) => { setConfirmDelete({ open:true, task }); };

  const onDeleteOnly = async () => {
    const t = confirmDelete.task; setConfirmDelete({ open:false, task:null });
    await deleteRow(t.id);
    closeTask();
  };
  const onDeleteAll = async () => {
    const t = confirmDelete.task; setConfirmDelete({ open:false, task:null });
    try{
      await api.delete(`/quests/active/${t.id}/recurrence`, { params: { delete_rule: true } });
    }catch{}
    await deleteRow(t.id);
    closeTask();
  };

  // Recurrence handlers from edit modal
  const saveRecurrence = async (task, body) => { try{ await api.put(`/quests/active/${task.id}/recurrence`, body); }catch{} };
  const removeRecurrence = async (task) => { try{ await api.delete(`/quests/active/${task.id}/recurrence`, { params: { delete_rule: true } }); }catch{} };

  // Filtering
  const isEnabled = (t) => {
    const idStr = t.category_id ?? 'null';
    return selectedCatIds ? selectedCatIds.includes(idStr) : true;
  };
  const filteredList = list.filter(isEnabled);

  // Sidebar Category Filters and Manager
  const [newCat, setNewCat] = useState({ name: "", color: COLOR_PALETTE[0] });
  const [editMap, setEditMap] = useState({}); // id -> { name, color, active }

  const startEdit = (c) => setEditMap({...editMap, [c.id]: { name: c.name, color: c.color, active: c.active }});
  const cancelEdit = (id) => { const m={...editMap}; delete m[id]; setEditMap(m); };
  const saveEdit = async (id) => { const body = editMap[id]; await patchCat(id, body); cancelEdit(id); };

  return (
    <div className="app-shell">
      {/* Sidebar with all features (non-collapsible) */}
      <div className="sidebar">
        <div style={{height:12}} />
        <MiniMonth selectedDate={anchorDate} onSelect={(d)=>{ setAnchorDate(d); setView('day'); }} />

        {/* Category Filters */}
        <div className="card" style={{marginTop:16}}>
          <div className="kicker" style={{marginBottom:8}}>Category Filters</div>
          <div style={{display:'flex', gap:6, flexDirection:'column'}}>
            <label className="small" style={{display:'flex', alignItems:'center', gap:6}}>
              <input type="checkbox" checked={selectedCatIds?.includes('null') || false} onChange={(e)=>{
                const ids = new Set(selectedCatIds||[]);
                if (e.target.checked) ids.add('null'); else ids.delete('null');
                saveFilters(Array.from(ids));
              }} />
              <span style={{display:'inline-flex', width:12, height:12, background:UNCATEGORIZED.color, borderRadius:3}} /> {UNCATEGORIZED.name}
            </label>
            {cats.map(c => (
              <label key={c.id} className="small" style={{display:'flex', alignItems:'center', gap:6}}>
                <input type="checkbox" checked={selectedCatIds?.includes(c.id) || false} onChange={(e)=>{
                  const ids = new Set(selectedCatIds||[]);
                  if (e.target.checked) ids.add(c.id); else ids.delete(c.id);
                  saveFilters(Array.from(ids));
                }} />
                <span style={{display:'inline-flex', width:12, height:12, background:c.color, borderRadius:3}} /> {c.name}
              </label>
            ))}
          </div>
          <div className="row" style={{marginTop:8, gap:6}}>
            <button className="btn secondary" onClick={()=> saveFilters(allIds)}>Select All</button>
            <button className="btn secondary" onClick={()=> saveFilters([])}>Deselect All</button>
          </div>
        </div>

        {/* Category Manager */}
        <div className="card" style={{marginTop:16}}>
          <div className="kicker" style={{marginBottom:8}}>Categories</div>
          {/* Create new */}
          <div className="row" style={{gap:6, flexWrap:'wrap'}}>
            <input className="input" placeholder="Name" value={newCat.name} onChange={e=>setNewCat({...newCat, name: e.target.value})} />
            <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
              {COLOR_PALETTE.map(col => (
                <button key={col} type="button" className="swatch" style={{ background: col, outline: newCat.color===col? '2px solid #111' : '1px solid #ccc' }} onClick={()=>setNewCat({...newCat, color: col})} />
              ))}
            </div>
            <button className="btn" onClick={async ()=>{ if(!newCat.name) return; await createCat({ name: newCat.name, color: newCat.color, active: true }); setNewCat({ name: "", color: COLOR_PALETTE[0] }); }}>Create</button>
          </div>

          {/* List + edit/delete */}
          <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:10}}>
            {cats.map(c => {
              const editing = !!editMap[c.id];
              const ed = editMap[c.id] || {};
              return (
                <div key={c.id} className="row" style={{justifyContent:'space-between', alignItems:'center', gap:8}}>
                  <div className="row" style={{gap:8, alignItems:'center'}}>
                    <span className="swatch" style={{ background: editing? ed.color : c.color }} />
                    {editing ? (
                      <>
                        <input className="input" value={ed.name} onChange={e=>setEditMap({...editMap, [c.id]: { ...ed, name: e.target.value }})} />
                        <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                          {COLOR_PALETTE.map(col => (
                            <button key={col} type="button" className="swatch" style={{ background: col, outline: ed.color===col? '2px solid #111' : '1px solid #ccc' }} onClick={()=> setEditMap({...editMap, [c.id]: { ...ed, color: col }}) } />
                          ))}
                        </div>
                        <label className="small" style={{display:'flex', alignItems:'center', gap:6}}>
                          <input type="checkbox" checked={!!ed.active} onChange={(e)=> setEditMap({...editMap, [c.id]: { ...ed, active: e.target.checked }}) } /> Active
                        </label>
                      </>
                    ) : (
                      <span>{c.name} {c.active? '' : '(inactive)'}</span>
                    )}
                  </div>
                  <div className="row" style={{gap:6}}>
                    {editing ? (
                      <>
                        <button className="btn" onClick={()=>saveEdit(c.id)}>Save</button>
                        <button className="btn secondary" onClick={()=>cancelEdit(c.id)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn secondary" onClick={()=>startEdit(c)}>Edit</button>
                        <button className="btn secondary" onClick={async ()=>{ if (confirm('Delete category? Tasks will be unlinked.')) await removeCat(c.id); }}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {cats.length===0 && <span className="small">No categories yet</span>}
          </div>
        </div>

        {/* Quick add (legacy minimal) */}
        <div className="card" style={{marginTop:16}}>
          <div className="kicker" style={{marginBottom:8}}>Quick Add</div>
          <div className="row" style={{flexWrap:'wrap'}}>
            <input className="input" placeholder="Quest Name" value={form.quest_name} onChange={e=>setForm({...form, quest_name: e.target.value})} />
            <select value={form.quest_rank} onChange={e=>setForm({...form, quest_rank: e.target.value})}>{ranks.map(r=> <option key={r} value={r}>{r}</option>)}</select>
            <input type="date" className="input" value={form.due_date} onChange={e=>setForm({...form, due_date: e.target.value})} />
            <input type="time" className="input" value={form.due_time} onChange={e=>setForm({...form, due_time: e.target.value})} />
            <button className="btn" onClick={onCreate}>Add</button>
          </div>
        </div>

        {/* Mini lists */}
        <div className="card" style={{marginTop:16}}>
          <div className="kicker" style={{marginBottom:8}}>Today</div>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {filteredList.filter(t=>t.due_date===ymd(anchorDate)).slice(0,6).map(t=> (
              <button key={t.id} className="task-chip" style={{textAlign:'left'}} onClick={()=>openTask(t)}>{t.quest_name}</button>
            ))}
            {filteredList.filter(t=>t.due_date===ymd(anchorDate)).length===0 && <span className="small">No tasks</span>}
          </div>
        </div>

      </div>

      {/* Main calendar pane */}
      <div className="main-pane">
        <div className="row" style={{justifyContent: 'space-between', marginBottom:12}}>
          <h2>Calendar</h2>
        </div>
        <Calendar
          tasks={filteredList}
          view={view}
          anchorDate={anchorDate}
          onPrev={onPrev}
          onNext={onNext}
          onToday={onToday}
          onViewChange={setView}
          onOpenTask={openTask}
          onCreateSelection={onCreateSelection}
          onCreateAtDay={onCreateAtDay}
          getCategoryColor={getCategoryColor}
        />

        {/* Under-calendar table like agenda */}
        <div className="card list-scroll" style={{marginTop:16}}>
          <table className="table">
            <thead>
              <tr>
                <th>Quest Name</th>
                <th>Quest Rank</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map(row => (
                <tr key={row.id}>
                  <td>
                    <button className="btn secondary" onClick={()=>openTask(row)} style={{border:'none', background:'transparent', color:'#111', padding:0}}>
                      {row.quest_name}
                    </button>
                  </td>
                  <td>
                    <select value={row.quest_rank} onChange={e=>updateRow(row.id,{quest_rank: e.target.value})}>
                      {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={`dot ${dueColor(row.due_date)}`} style={{marginRight:6}}></span>
                    <input type="date" value={row.due_date} onChange={e=>updateRow(row.id,{due_date: e.target.value})} />
                    {row.due_time ? <span className="small" style={{marginLeft:8}}>{row.due_time}</span> : null}
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
                    <button className="btn secondary" onClick={()=>openTask(row)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modals */}
        <TaskEditModal 
          open={!!editing} 
          task={editing} 
          onClose={closeTask} 
          onSave={saveTask} 
          onDelete={deleteTask}
          onSaveRecurrence={saveRecurrence}
          onRemoveRecurrence={removeRecurrence}
          categories={cats}
        />
        <DeleteScopeModal open={confirmDelete.open} onClose={()=>setConfirmDelete({ open:false, task:null })} onDeleteOnly={onDeleteOnly} onDeleteAll={onDeleteAll} />
        <QuickCreateModal open={quick.open} dateStr={quick.dateStr} startMin={quick.startMin} duration={quick.duration} allDay={quick.allDay} onClose={()=>setQuick({...quick, open:false})} onCreate={confirmQuickCreate} categories={cats} />
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

function Recurring(){
  const api = useApi();
  const [list, setList] = useState([]);

  const load = async () => {
    const { data } = await api.get(`/recurring`);
    setList(data);
  };
  useEffect(()=>{ load(); },[]);

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2>Recurring Rules</h2>
      </div>
      <div className="card" style={{marginTop:16}}>
        <table className="table">
          <thead>
            <tr><th>Task</th><th>Rank</th><th>Frequency</th><th>Days</th><th>Status</th></tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id}>
                <td>{r.task_name}</td>
                <td>{r.quest_rank}</td>
                <td>{r.frequency}</td>
                <td>{r.days || '-'}</td>
                <td>{r.status}</td>
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
  const [doc, setDoc] = useState(null);
  const [val, setVal] = useState("");
  const load = async () => { const { data } = await api.get(`/rules`); setDoc(data); setVal(data?.content || ""); };
  const save = async () => { const { data } = await api.put(`/rules`, { content: val }); setDoc(data); };
  useEffect(()=>{ load(); },[]);
  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2>Rules</h2>
      </div>
      <div className="card" style={{marginTop:16}}>
        <textarea className="input" rows={12} value={val} onChange={e=>setVal(e.target.value)} />
        <div className="row" style={{marginTop:8, justifyContent:'flex-end'}}>
          <button className="btn" onClick={save}>Save</button>
        </div>
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

  const load = async () => {
    const [s, l, inv] = await Promise.all([
      api.get(`/rewards/store`),
      api.get(`/rewards/log`),
      api.get(`/rewards/inventory`)
    ]);
    setStore(s.data); setLog(l.data); setInventory(inv.data);
  };
  useEffect(()=>{ load(); },[]);

  // ---- Minimal B&W confetti animation ----
  const fireRewardAnimation = (evt, variant='redeem') => {
    const x = evt?.clientX ?? window.innerWidth/2;
    const y = evt?.clientY ?? window.innerHeight/2;
    const container = document.createElement('div');
    container.className = 'reward-anim-container';
    document.body.appendChild(container);
    const pieces = 24;
    let removed = 0;
    const cleanup = () => { removed++; if (removed >= pieces) container.remove(); };
    for (let i=0;i<pieces;i++){
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
      el.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');
      el.style.setProperty('--rot', rot);
      el.style.setProperty('--bg', variant==='use' ? '#333' : '#111');
      el.addEventListener('animationend', cleanup, { once: true });
      container.appendChild(el);
    }
    // safety cleanup
    setTimeout(() => { try{container.remove();}catch{} }, 1200);
  };

  const addOrUpdate = async (e) => {
    e.preventDefault();
    if(!form.reward_name || !form.xp_cost) return;
    await api.post(`/rewards/store`, form);
    setForm({ reward_name: "", xp_cost: 25 });
    await load();
  };
  const del = async (id) => { await api.delete(`/rewards/store/${id}`); await load(); };

  const redeem = async (id, evt) => {
    try{
      await api.post(`/rewards/redeem`, { reward_id: id });
      fireRewardAnimation(evt, 'redeem');
      await Promise.all([load(), refreshXP()]);
    }catch(err){
      alert(err?.response?.data?.detail || 'Unable to redeem');
    }
  };
  const useReward = async (id, evt) => {
    try{
      await api.post(`/rewards/use/${id}`);
      fireRewardAnimation(evt, 'use');
      await Promise.all([load(), refreshXP()]);
    }catch(err){
      alert(err?.response?.data?.detail || 'Unable to use reward');
    }
  };

  const fmt = (iso) => new Date(iso).toLocaleString();

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h2>Rewards</h2>
        <XPBadge summary={summary} />
      </div>

      <form onSubmit={addOrUpdate} className="card" style={{marginTop:16}}>
        <div className="row">
          <input className="input" placeholder="Reward name" value={form.reward_name} onChange={e=>setForm({...form, reward_name:e.target.value})} />
          <input className="input" type="number" placeholder="XP cost" value={form.xp_cost} onChange={e=>setForm({...form, xp_cost: Number(e.target.value)})} />
          <button className="btn" type="submit">Save</button>
        </div>
      </form>

      <div className="card" style={{marginTop:16}}>
        <h3 className="kicker">Reward Store</h3>
        <table className="table">
          <thead>
            <tr><th>Reward</th><th>XP Cost</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {store.map(s => (
              <tr key={s.id}>
                <td>{s.reward_name}</td>
                <td>{s.xp_cost}</td>
                <td style={{display:'flex', gap:8}}>
                  <button className="btn" onClick={(e)=>redeem(s.id, e)}>Redeem</button>
                  <button className="btn secondary" onClick={()=>del(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3 className="kicker">My Redeemed Rewards</h3>
        <table className="table">
          <thead>
            <tr><th>Reward</th><th>XP Cost</th><th>Date</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {inventory.map(inv => (
              <tr key={inv.id}>
                <td>{inv.reward_name}</td>
                <td>{inv.xp_cost}</td>
                <td>{fmt(inv.date_redeemed)}</td>
                <td>{inv.used? 'Used' : 'Available'}</td>
                <td>
                  {!inv.used ? <button className="btn" onClick={(e)=>useReward(inv.id, e)}>Use</button> : <span className="small">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3 className="kicker">Redemption Log</h3>
        <table className="table">
          <thead>
            <tr><th>Reward</th><th>XP Spent</th><th>Date</th></tr>
          </thead>
          <tbody>
            {log.map(item => (
              <tr key={item.id}>
                <td>{item.reward_name}</td>
                <td>{item.xp_cost}</td>
                <td>{fmt(item.date_redeemed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function App(){
  return (
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
  );
}

export default App;