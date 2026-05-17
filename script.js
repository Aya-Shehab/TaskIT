// ── Data ──────────────────────────────────────────────────────────────────
const today = new Date();
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const daysShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Search state ───────────────────────────────────────────────────────────
let searchQuery = '';
function norm(s){return String(s||'').toLowerCase().trim();}
function matchesQuery(text){
  const q = norm(searchQuery);
  if(!q) return true;
  return norm(text).includes(q);
}

// ── Local storage ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'taskit.tasks.v1';
function defaultTasks(){
  return {
    morning: [
      {id:1,title:'Team standup meeting',description:'',done:true,tag:'work',prio:'high',time:'9:00 AM',deadline:null},
      {id:2,title:'Review design mockups',description:'',done:false,tag:'work',prio:'med',time:'10:30 AM',deadline:null},
    ],
    afternoon: [
      {id:3,title:'Gym — upper body',description:'',done:true,tag:'health',prio:'med',time:'12:30 PM',deadline:null},
      {id:4,title:'Finish quarterly report',description:'',done:false,tag:'work',prio:'high',time:'2:00 PM',deadline:null},
    ],
    evening: [
      {id:5,title:'Read 30 pages of Atomic Habits',description:'',done:false,tag:'personal',prio:'low',time:'8:00 PM',deadline:null},
    ]
  };
}
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return {tasks: defaultTasks(), nextId: 6};
    const parsed = JSON.parse(raw);
    if(!parsed || typeof parsed !== 'object') throw new Error('bad storage');
    return {
      tasks: parsed.tasks || defaultTasks(),
      nextId: Number(parsed.nextId || 6),
    };
  } catch {
    return {tasks: defaultTasks(), nextId: 6};
  }
}
function persistState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({tasks, nextId}));
}

let tasks = {
  morning: [
    {id:1,title:'Team standup meeting',description:'',done:true,tag:'work',prio:'high',time:'9:00 AM',deadline:null},
    {id:2,title:'Review design mockups',description:'',done:false,tag:'work',prio:'med',time:'10:30 AM',deadline:null},
  ],
  afternoon: [
    {id:3,title:'Gym — upper body',description:'',done:true,tag:'health',prio:'med',time:'12:30 PM',deadline:null},
    {id:4,title:'Finish quarterly report',description:'',done:false,tag:'work',prio:'high',time:'2:00 PM',deadline:null},
  ],
  evening: [
    {id:5,title:'Read 30 pages of Atomic Habits',description:'',done:false,tag:'personal',prio:'low',time:'8:00 PM',deadline:null},
  ]
};
let nextId = 6;

// Editing state
let editing = null; // { id:number, section:string } | null

function ensureTaskShape(t){
  return {
    id: Number(t.id),
    title: String(t.title || ''),
    description: String(t.description || ''),
    done: Boolean(t.done),
    tag: String(t.tag || 'work'),
    prio: String(t.prio || 'med'),
    time: String(t.time || ''),
    deadline: t.deadline ? String(t.deadline) : null,
  };
}
function getTaskById(id){
  for(const section of ['morning','afternoon','evening']){
    const idx = tasks[section].findIndex(x => x.id === id);
    if(idx !== -1) return {section, idx, task: tasks[section][idx]};
  }
  return null;
}
function formatDeadline(deadline){
  if(!deadline) return '';
  const d = new Date(deadline);
  if(Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
}

// ── Calendar helpers (calendar events + task deadlines) ────────────────────
function tagToEventColor(tag){
  if(tag === 'work') return 'event-blue';
  if(tag === 'personal') return 'event-purple';
  if(tag === 'health') return 'event-green';
  if(tag === 'study') return 'event-amber';
  return 'event-blue';
}

function toLocalDateTimeFromSection(section){
  // default times to match "Today" sections
  const hm = section === 'morning' ? [9,0] : section === 'afternoon' ? [14,0] : [20,0];
  const d = new Date();
  d.setSeconds(0,0);
  d.setMilliseconds(0);
  d.setHours(hm[0], hm[1], 0, 0);
  return d;
}

function getUnifiedEvents(){
  const allTasks = [...tasks.morning, ...tasks.afternoon, ...tasks.evening].map(ensureTaskShape);
  const taskEvents = allTasks
    .filter(t => t.deadline)
    .map(t => ({
      kind: 'task',
      title: t.title,
      start: new Date(t.deadline),
      durMinutes: 30,
      color: tagToEventColor(t.tag),
      done: t.done,
    }))
    .filter(e => !Number.isNaN(e.start.getTime()));

  return taskEvents;
}

function migrateTasksForCalendar(){
  // Ensure all tasks get a reasonable deadline so they can appear on the calendar.
  let changed = false;
  for(const section of ['morning','afternoon','evening']){
    tasks[section] = (tasks[section] || []).map(raw=>{
      const t = ensureTaskShape(raw);
      if(!t.deadline){
        const d = toLocalDateTimeFromSection(section);
        t.deadline = d.toISOString();
        changed = true;
      }
      return t;
    });
  }
  if(changed) persistState();
}

// ── Nav ───────────────────────────────────────────────────────────────────
function showLogin(){
  document.getElementById('splash').classList.remove('active');
  document.getElementById('login').classList.add('active');
}
function showApp(){
  document.getElementById('login').classList.remove('active');
  document.getElementById('app').classList.add('active');
  initApp();
}
function switchView(view, el){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  const titles={'today':'Today','upcoming':'Upcoming','hub':'Utility Hub','cal-day':'Calendar','cal-week':'Calendar','cal-month':'Calendar'};
  document.getElementById('topbar-title').textContent=titles[view]||'';
  const isCalendar=view.startsWith('cal-');
  document.getElementById('view-toggle').style.display=isCalendar?'flex':'none';
  if(isCalendar){
    const t=document.querySelectorAll('.view-btn');
    const v=view.replace('cal-','');
    t.forEach(b=>b.classList.toggle('active',b.textContent.toLowerCase()===v));
  }
  document.getElementById('view-'+view).classList.add('fade-in');
  setTimeout(()=>document.getElementById('view-'+view).classList.remove('fade-in'),300);
}
function setCalView(v){
  const navEl=document.querySelector(`[data-view="cal-${v}"]`);
  if(navEl) switchView('cal-'+v, navEl);
}

// ── Today ─────────────────────────────────────────────────────────────────
function initToday(){
  const d=today;
  document.getElementById('today-heading').textContent=days[d.getDay()]+', '+monthsShort[d.getMonth()]+' '+d.getDate();
  document.getElementById('today-sub').textContent=`${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  document.getElementById('topbar-date').textContent=days[d.getDay()]+', '+months[d.getMonth()]+' '+d.getDate();
  renderTasks();
}

function renderTasks(){
  const q = norm(searchQuery);
  let anyMatch = false;

  ['morning','afternoon','evening'].forEach(section=>{
    const el=document.getElementById('tasks-'+section);
    el.innerHTML='';
    const filtered = q ? tasks[section].filter(t => matchesQuery(t.title) || matchesQuery(t.tag) || matchesQuery(t.time)) : tasks[section];
    if(filtered.length) anyMatch = true;
    filtered.forEach(t=>{
      el.appendChild(createTaskEl(t,section));
    });
  });

  if(q && !anyMatch){
    const morningEl = document.getElementById('tasks-morning');
    if(morningEl) morningEl.innerHTML = `<div class="task-empty">No tasks found for "${searchQuery}".</div>`;
    const afternoonEl = document.getElementById('tasks-afternoon');
    if(afternoonEl) afternoonEl.innerHTML = '';
    const eveningEl = document.getElementById('tasks-evening');
    if(eveningEl) eveningEl.innerHTML = '';
  }

  updateProgress();
  // Keep calendar in sync whenever tasks list re-renders
  renderDay();renderWeek();renderMonth();
}

function createTaskEl(t,section){
  const task = ensureTaskShape(t);
  const div=document.createElement('div');
  div.className='task-item';
  div.addEventListener('click', ()=>openEditModal(task.id));

  const check=document.createElement('div');
  check.className='task-check'+(task.done?' checked':'');
  check.addEventListener('click',(e)=>{e.stopPropagation();toggleTask(task.id);});

  const body=document.createElement('div');
  body.className='task-body';

  const title=document.createElement('div');
  title.className='task-title'+(task.done?' done':'');
  title.textContent=task.title;

  const meta=document.createElement('div');
  meta.className='task-meta';

  const tag=document.createElement('span');
  tag.className='task-tag tag-'+task.tag;
  tag.textContent=task.tag;

  const time=document.createElement('span');
  time.className='task-time';
  time.innerHTML=`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${task.time}`;

  meta.appendChild(tag);
  meta.appendChild(time);

  const deadlineLabel = formatDeadline(task.deadline);
  if(deadlineLabel){
    const due=document.createElement('span');
    due.className='task-time';
    due.innerHTML=`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>Due ${deadlineLabel}`;
    meta.appendChild(due);
  }

  body.appendChild(title);
  body.appendChild(meta);

  const prio=document.createElement('div');
  prio.className='task-priority prio-'+task.prio;

  div.appendChild(check);
  div.appendChild(body);
  div.appendChild(prio);
  return div;
}

function toggleTask(id){
  const found = getTaskById(id);
  if(!found) return;
  tasks[found.section][found.idx].done = !tasks[found.section][found.idx].done;
  persistState();
  renderTasks();
  renderDay();renderWeek();renderMonth();
}

function updateProgress(){
  const all=[...tasks.morning,...tasks.afternoon,...tasks.evening];
  const q = norm(searchQuery);
  const visible = q ? all.filter(t => matchesQuery(t.title) || matchesQuery(t.tag) || matchesQuery(t.time)) : all;
  const done=visible.filter(t=>t.done).length;
  const total=visible.length;
  document.getElementById('done-count').textContent=done;
  document.getElementById('total-count').textContent=total;
  const pct=total?Math.round(done/total*100):0;
  document.getElementById('pct-label').textContent=pct+'%';
  const circ=document.getElementById('progress-ring');
  const r=20,c=2*Math.PI*r;
  circ.style.strokeDasharray=c;
  circ.style.strokeDashoffset=c-(c*(pct/100));
  // update badge
  const badge=document.querySelector('[data-view="today"] .badge');
  if(badge) badge.textContent=all.filter(t=>!t.done).length;
}

// ── Modal ─────────────────────────────────────────────────────────────────
function openModal(section='morning'){
  editing = null;
  document.getElementById('modal-title').textContent='Add Task';
  document.getElementById('save-task-btn').textContent='Add Task';
  document.getElementById('delete-task-btn').style.display='none';

  document.getElementById('new-task-title').value='';
  document.getElementById('new-task-desc').value='';
  document.getElementById('new-task-deadline').value='';
  document.getElementById('new-task-section').value=section;
  document.getElementById('new-task-tag').value='work';
  document.getElementById('new-task-prio').value='med';

  document.getElementById('modal').classList.add('open');
  document.getElementById('new-task-title').focus();
}
function openEditModal(id){
  const found = getTaskById(id);
  if(!found) return;
  const t = ensureTaskShape(found.task);
  editing = {id, section: found.section};

  document.getElementById('modal-title').textContent='Edit Task';
  document.getElementById('save-task-btn').textContent='Save';
  document.getElementById('delete-task-btn').style.display='inline-block';

  document.getElementById('new-task-title').value=t.title;
  document.getElementById('new-task-desc').value=t.description;
  document.getElementById('new-task-deadline').value=t.deadline ? String(t.deadline).slice(0,16) : '';
  document.getElementById('new-task-section').value=found.section;
  document.getElementById('new-task-tag').value=t.tag;
  document.getElementById('new-task-prio').value=t.prio;

  document.getElementById('modal').classList.add('open');
  document.getElementById('new-task-title').focus();
}
function closeModal(){document.getElementById('modal').classList.remove('open');editing=null;}
function saveTask(){
  const title=document.getElementById('new-task-title').value.trim();
  if(!title)return;
  const section=document.getElementById('new-task-section').value;
  const tag=document.getElementById('new-task-tag').value;
  const prio=document.getElementById('new-task-prio').value;
  const description=document.getElementById('new-task-desc').value.trim();
  const deadlineRaw=document.getElementById('new-task-deadline').value;
  
  // IMPORTANT: Always ensure a deadline is set so tasks appear in calendar
  let deadline;
  if(deadlineRaw){
    deadline = new Date(deadlineRaw).toISOString();
  } else {
    // If no deadline provided, infer one from the section
    const inferredDeadline = toLocalDateTimeFromSection(section);
    deadline = inferredDeadline.toISOString();
  }
  
  const hours={morning:'9:00 AM',afternoon:'2:00 PM',evening:'7:00 PM'};
  const time = deadlineRaw
    ? new Date(deadlineRaw).toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'})
    : hours[section];

  if(editing){
    const found = getTaskById(editing.id);
    if(found){
      // Move task if section changed
      const updated = {...ensureTaskShape(found.task), title, description, tag, prio, time, deadline};
      tasks[found.section].splice(found.idx, 1);
      tasks[section].push(updated);
    }
  } else {
    tasks[section].push({id:nextId++,title,description,done:false,tag,prio,time,deadline});
  }

  persistState();
  closeModal();
  renderTasks();
  initUpcoming();
  renderDay();renderWeek();renderMonth();
}

function deleteTask(){
  if(!editing) return;
  const found = getTaskById(editing.id);
  if(!found) return;
  tasks[found.section].splice(found.idx, 1);
  persistState();
  closeModal();
  renderTasks();
  initUpcoming();
  renderDay();renderWeek();renderMonth();
}

// ── Upcoming ──────────────────────────────────────────────────────────────
function initUpcoming(){
  const grid=document.getElementById('upcoming-grid');
  grid.innerHTML='';
  const q = norm(searchQuery);

  // Build upcoming days dynamically from today onwards
  for(let dayOffset = 0; dayOffset < 7; dayOffset++){
    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    
    const dayName = dayOffset === 0 ? 'Today' : days[date.getDay()];
    
    // Get all tasks with deadlines on this date
    const allTasks = [...tasks.morning, ...tasks.afternoon, ...tasks.evening];
    const tasksForDay = allTasks.filter(t => {
      if(!t.deadline) return false;
      const taskDate = new Date(t.deadline);
      return sameDay(taskDate, date);
    });
    
    const visibleTasks = q ? tasksForDay.filter(t => matchesQuery(t.title)) : tasksForDay;
    
    if(q && visibleTasks.length === 0) continue;
    
    const card=document.createElement('div');
    card.className='upcoming-card fade-in'+(dayOffset === 0 ? ' today':'');
    card.style.animationDelay=dayOffset*0.04+'s';
    
    const colors = ['#b5d4f4','#c0dd97','#fac775','#f4c0d1','#cecbf6'];
    const taskHtml = visibleTasks.length > 0 
      ? visibleTasks.map((t,j)=>`<div class="upcoming-task"><span class="dot" style="background:${colors[j % colors.length]}"></span>${t.title}</div>`).join('')
      : '<div class="upcoming-task" style="color: var(--gray-300);">No tasks</div>';
    
    card.innerHTML=`<div class="upcoming-card-day">${dayName.substring(0,3).toUpperCase()}</div>
    <div class="upcoming-card-date">${date.getDate()}</div>
    ${taskHtml}`;
    grid.appendChild(card);
  }
}

// ── Utility Hub ───────────────────────────────────────────────────────────
const POMODORO = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartNext: true,
};

let pomodoroMode = 'work'; // 'work' | 'short' | 'long'
let workSessionsCompleted = 0;
let timerSeconds = POMODORO.workMinutes * 60;
let timerInterval = null;
let timerRunning = false;

function pomodoroLabel(){
  if(pomodoroMode === 'work') return 'Work';
  if(pomodoroMode === 'short') return 'Short break';
  return 'Long break';
}
function applyModeToSeconds(){
  if(pomodoroMode === 'work') timerSeconds = POMODORO.workMinutes * 60;
  else if(pomodoroMode === 'short') timerSeconds = POMODORO.shortBreakMinutes * 60;
  else timerSeconds = POMODORO.longBreakMinutes * 60;
}
function updatePomodoroModeUI(){
  const el = document.getElementById('timer-mode');
  if(!el) return;
  const session = Math.max(1, workSessionsCompleted + (pomodoroMode === 'work' ? 1 : 0));
  el.textContent = `${pomodoroLabel()} • Session ${session}`;
}
function updateTimerDisplay(){
  const m=Math.floor(timerSeconds/60),s=timerSeconds%60;
  document.getElementById('timer-display').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  updatePomodoroModeUI();
}
function onPomodoroFinished(){
  // Move to next stage
  if(pomodoroMode === 'work'){
    workSessionsCompleted++;
    pomodoroMode = (workSessionsCompleted % POMODORO.longBreakEvery === 0) ? 'long' : 'short';
  } else {
    pomodoroMode = 'work';
  }
  applyModeToSeconds();
  updateTimerDisplay();
}
function toggleTimer(){
  const btn=document.getElementById('timer-btn');
  if(timerRunning){
    clearInterval(timerInterval);timerRunning=false;btn.textContent='Resume';
  } else {
    timerInterval=setInterval(()=>{
      if(timerSeconds<=0){
        clearInterval(timerInterval);
        timerRunning=false;
        btn.textContent='Start';
        onPomodoroFinished();
        if(POMODORO.autoStartNext) toggleTimer();
        return;
      }
      timerSeconds--;
      updateTimerDisplay();
    },1000);
    timerRunning=true;btn.textContent='Pause';
  }
}
function resetTimer(){
  clearInterval(timerInterval);
  timerRunning=false;
  pomodoroMode='work';
  workSessionsCompleted=0;
  applyModeToSeconds();
  updateTimerDisplay();
  document.getElementById('timer-btn').textContent='Start';
}
function setPomodoroMode(mode){
  clearInterval(timerInterval);
  timerRunning=false;
  pomodoroMode = (mode === 'short' || mode === 'long') ? mode : 'work';
  applyModeToSeconds();
  updateTimerDisplay();
  document.getElementById('timer-btn').textContent='Start';
}

function initHub(){
  const ht=document.getElementById('habit-tracker');
  ht.innerHTML='';
  const habits = [
    {name:'Exercise',done:[true,true,false,true,true,false,false]},
    {name:'Read',done:[true,true,true,true,false,false,false]},
    {name:'Meditate',done:[true,false,true,true,true,false,false]},
    {name:'Journal',done:[false,true,false,false,true,false,false]},
  ];
  habits.forEach(h=>{
    const row=document.createElement('div');
    row.className='habit-row';
    row.innerHTML=`<div class="habit-name" style="font-size:11px">${h.name}</div>
    <div class="habit-circles">${h.done.map((d,i)=>`<div class="habit-circle${d?(i===today.getDay()-1?' today-done':' done'):''}"></div>`).join('')}</div>`;
    ht.appendChild(row);
  });
  const moods=['😔','😐','🙂','😊','🤩'];
  const mr=document.getElementById('mood-row');
  mr.innerHTML='';
  moods.forEach((m,i)=>{
    const span=document.createElement('span');
    span.className='mood-emoji'+(i===3?' selected':'');
    span.textContent=m;
    span.onclick=()=>{document.querySelectorAll('.mood-emoji').forEach(x=>x.classList.remove('selected'));span.classList.add('selected');};
    mr.appendChild(span);
  });
}

// ── Calendar State ────────────────────────────────────────────────────────
let currentDay=new Date(today);
let currentWeekStart=new Date(today);
let currentMonth=new Date(today.getFullYear(),today.getMonth(),1);

function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();}

// ── Day View ──────────────────────────────────────────────────────────────
function renderDay(){
  document.getElementById('day-title').textContent=days[currentDay.getDay()]+', '+months[currentDay.getMonth()]+' '+currentDay.getDate()+', '+currentDay.getFullYear();
  const grid=document.getElementById('day-grid');
  grid.innerHTML='';
  const hours=Array.from({length:14},(_,i)=>i+7);
  const unified = getUnifiedEvents();
  hours.forEach(h=>{
    const timeEl=document.createElement('div');
    timeEl.className='week-time';
    timeEl.textContent=(h===12?'12 PM':h<12?h+' AM':(h-12)+' PM');
    grid.appendChild(timeEl);
    const cell=document.createElement('div');
    cell.className='week-cell';
    cell.style.paddingLeft='4px';
    cell.style.paddingRight='4px';
    const evs=unified.filter(e=>sameDay(e.start,currentDay)&&e.start.getHours()===h);
    evs.forEach(ev=>{
      const evEl=document.createElement('div');
      evEl.className='week-event '+(ev.color||'event-blue');
      evEl.style.position='relative';
      evEl.style.marginBottom='2px';
      evEl.style.height=(Math.max(15,ev.durMinutes)/60*48-4)+'px';
      evEl.style.display='flex';
      evEl.style.alignItems='center';
      evEl.style.borderRadius='6px';
      evEl.style.padding='4px 8px';
      evEl.style.opacity = ev.kind === 'task' && ev.done ? '0.55' : '1';
      evEl.textContent=ev.title;
      cell.appendChild(evEl);
    });
    grid.appendChild(cell);
  });
}
function navDay(d){currentDay.setDate(currentDay.getDate()+d);renderDay();}
function goToday(v){
  currentDay=new Date(today);currentMonth=new Date(today.getFullYear(),today.getMonth(),1);
  renderDay();renderWeek();renderMonth();
}

// ── Week View ─────────────────────────────────────────────────────────────
function renderWeek(){
  const startOfWeek=new Date(currentDay);
  startOfWeek.setDate(currentDay.getDate()-currentDay.getDay());
  const endOfWeek=new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate()+6);
  document.getElementById('week-title').textContent=
    monthsShort[startOfWeek.getMonth()]+' '+startOfWeek.getDate()+' – '+
    (startOfWeek.getMonth()!==endOfWeek.getMonth()?monthsShort[endOfWeek.getMonth()]+' ':'')+
    endOfWeek.getDate()+', '+endOfWeek.getFullYear();
  const grid=document.getElementById('week-grid');
  grid.innerHTML='';
  grid.style.gridTemplateColumns='48px repeat(7,1fr)';
  const unified = getUnifiedEvents();
  // Header row
  const emptyH=document.createElement('div');
  emptyH.className='week-header empty';
  grid.appendChild(emptyH);
  for(let d=0;d<7;d++){
    const date=new Date(startOfWeek);
    date.setDate(startOfWeek.getDate()+d);
    const hdr=document.createElement('div');
    hdr.className='week-header';
    const isToday=sameDay(date,today);
    hdr.innerHTML=`<div class="week-day-label">${daysShort[d]}</div>
    <div class="${isToday?'week-day-num today-num':'week-day-num'}">${date.getDate()}</div>`;
    grid.appendChild(hdr);
  }
  // Time rows
  const hours=Array.from({length:12},(_,i)=>i+7);
  hours.forEach(h=>{
    const timeEl=document.createElement('div');
    timeEl.className='week-time';
    timeEl.textContent=(h===12?'12 PM':h<12?h+' AM':(h-12)+' PM');
    grid.appendChild(timeEl);
    for(let d=0;d<7;d++){
      const date=new Date(startOfWeek);
      date.setDate(startOfWeek.getDate()+d);
      const cell=document.createElement('div');
      cell.className='week-cell';
      const evs=unified.filter(e=>sameDay(e.start,date)&&e.start.getHours()===h);
      evs.forEach(ev=>{
        const evEl=document.createElement('div');
        evEl.className='week-event '+(ev.color||'event-blue');
        evEl.style.height='90%';
        evEl.style.opacity = ev.kind === 'task' && ev.done ? '0.55' : '1';
        evEl.textContent=ev.title;
        cell.appendChild(evEl);
      });
      grid.appendChild(cell);
    }
  });
}
function navWeek(d){currentDay.setDate(currentDay.getDate()+d*7);renderWeek();}

// ── Month View ────────────────────────────────────────────────────────────
function renderMonth(){
  document.getElementById('month-title').textContent=months[currentMonth.getMonth()]+' '+currentMonth.getFullYear();
  const grid=document.getElementById('month-grid');
  grid.innerHTML='';
  daysShort.forEach(d=>{const h=document.createElement('div');h.className='month-header-cell';h.textContent=d;grid.appendChild(h);});
  const firstDay=new Date(currentMonth.getFullYear(),currentMonth.getMonth(),1);
  const startDay=firstDay.getDay();
  const daysInMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,0).getDate();
  const prevDays=new Date(currentMonth.getFullYear(),currentMonth.getMonth(),0).getDate();
  const unified = getUnifiedEvents();
  for(let i=startDay-1;i>=0;i--){
    const d=document.createElement('div');
    d.className='month-day other-month';
    d.innerHTML=`<div class="day-num">${prevDays-i}</div>`;
    grid.appendChild(d);
  }
  for(let i=1;i<=daysInMonth;i++){
    const date=new Date(currentMonth.getFullYear(),currentMonth.getMonth(),i);
    const isToday=sameDay(date,today);
    const d=document.createElement('div');
    d.className='month-day'+(isToday?' today':'');
    const dn=document.createElement('div');
    dn.className='day-num';
    dn.textContent=i;
    d.appendChild(dn);
    const evs=unified.filter(e=>sameDay(e.start,date));
    evs.slice(0,2).forEach(ev=>{
      const evEl=document.createElement('div');
      evEl.className='month-event '+(ev.color||'event-blue');
      evEl.textContent=ev.title;
      d.appendChild(evEl);
    });
    if(evs.length>2){const m=document.createElement('div');m.className='month-event';m.style.color='var(--gray-400)';m.textContent=`+${evs.length-2} more`;d.appendChild(m);}
    grid.appendChild(d);
  }
  const totalCells=startDay+daysInMonth;
  const remaining=totalCells%7===0?0:7-(totalCells%7);
  for(let i=1;i<=remaining;i++){
    const d=document.createElement('div');
    d.className='month-day other-month';
    d.innerHTML=`<div class="day-num">${i}</div>`;
    grid.appendChild(d);
  }
}
function navMonth(d){currentMonth.setMonth(currentMonth.getMonth()+d);renderMonth();}

// ── Init ──────────────────────────────────────────────────────────────────
function initApp(){
  const state = loadState();
  tasks = state.tasks;
  nextId = state.nextId;
  migrateTasksForCalendar();

  initToday();
  initUpcoming();
  initHub();
  renderDay();
  renderWeek();
  renderMonth();
}

// Hook up modal events once DOM exists (script is loaded at end of body)
document.getElementById('modal').addEventListener('click',function(e){if(e.target===this)closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
updateTimerDisplay();

// Search bar
const searchEl = document.querySelector('.search-bar');
if(searchEl){
  searchEl.addEventListener('input', (e) => {
    searchQuery = e.target.value || '';
    renderTasks();
    initUpcoming();
  });
}