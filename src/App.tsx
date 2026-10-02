import {lazy,Suspense,useCallback,useMemo,useState} from 'react';import * as Sun from 'suncalc';
const Scene=lazy(()=>import('./Scene'));
const cities=[{id:'astana',name:'Астана',en:'Astana',lat:51.1694,lon:71.4491,zone:'Asia/Almaty'},{id:'london',name:'Лондон',en:'London',lat:51.5074,lon:-.1278,zone:'Europe/London'},{id:'tokyo',name:'Токио',en:'Tokyo',lat:35.6762,lon:139.6503,zone:'Asia/Tokyo'},{id:'tromso',name:'Тромсё',en:'Tromsø',lat:69.6492,lon:18.9553,zone:'Europe/Oslo'}];
export default function App(){
 const[lang,setLang]=useState<'ru'|'en'>('ru'),[cityId,setCityId]=useState('astana'),[date,setDate]=useState('2026-10-02'),[minute,setMinute]=useState(1060),[fallback,setFallback]=useState(new URLSearchParams(location.search).get('view')==='2d');
 const city=cities.find(c=>c.id===cityId)!;const en=lang==='en';const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const instant=new Date(date+'T00:00:00Z');instant.setUTCMinutes(minute-300);const pos=Sun.getPosition(instant,city.lat,city.lon);
 const times=useMemo(()=>Sun.getTimes(new Date(date+'T12:00:00Z'),city.lat,city.lon,0,300),[date,city]);
 const fail=useCallback(()=>setFallback(true),[]);
 const fmt=(d:Date|null)=>d?new Intl.DateTimeFormat(en?'en-GB':'ru-RU',{timeZone:city.zone,hour:'2-digit',minute:'2-digit'}).format(d):'—';
 return <main className={pos.altitude<0?'night':'day'}>
 <a className="skip" href="#planner">{en?'Go to planner':'К планировщику'}</a>
 <header><a className="brand" href="/helio/" aria-label="Helio home">helio<span>®</span></a><span className="edition">DAYLIGHT ATLAS <i>01</i></span><button className="language" onClick={()=>setLang(en?'ru':'en')} aria-label={en?'Switch to Russian':'Переключить на английский'}>{en?'RU':'EN'}</button></header>
 <section className="hero" aria-labelledby="title">
 <div className="world">{fallback?<div className="flat-sky"><div className="flat-sun" style={{left:(pos.azimuth/360*85+7)+'%',top:Math.max(10,57-pos.altitude*.6)+'%'}}/><div className="flat-world"/></div>:<Suspense fallback={<div className="flat-sky"/>}><Scene position={pos} reduced={reduced} onFallback={fail}/></Suspense>}</div>
 <div className="hero-copy"><p className="eyebrow">{en?'A little closer to the sun':'Немного ближе к солнцу'}</p><h1 id="title">{en?<>Find your<br/><em>kind of light.</em></>:<>Застаньте<br/><em>свой свет.</em></>}</h1><p className="intro">{en?'A sunrise worth getting up for. A walk before the city turns blue. Find the moment — and make a plan.':'Рассвет, ради которого стоит встать. Прогулка, пока город не стал синим. Найдите момент — и запланируйте его.'}</p></div>
 <div className="solar-readout"><span className="phase">{en?'FOLLOW THE SUN':'ПО ХОДУ СОЛНЦА'}</span><strong>{String(Math.floor(minute/60)).padStart(2,'0')}<b>:</b>{String(minute%60).padStart(2,'0')}</strong><p>{pos.altitude.toFixed(1)}° {en?'altitude':'над горизонтом'} <span>↗ {pos.azimuth.toFixed(0)}°</span></p></div>
 <div className="scene-caption"><span className="status-dot"/>{en?'An imagined world. A calculated sun.':'Условный мир. Расчётное солнце.'}<button onClick={()=>setFallback(!fallback)}>{fallback?'3D':'2D'}</button></div>
 <div className="planner" id="planner"><div className="control-row"><label>{en?'Place':'Место'}<select value={cityId} onChange={e=>setCityId(e.target.value)}>{cities.map(c=><option value={c.id} key={c.id}>{en?c.en:c.name}</option>)}</select></label><label>{en?'Date':'Дата'}<input type="date" value={date} onChange={e=>setDate(e.target.value||'2026-10-02')}/></label><span className="zone">{city.zone}<small>{en?'Preview — calculations are being completed':'Превью — расчёты ещё дорабатываются'}</small></span></div>
 <div className="scrubber"><label htmlFor="time">{en?'Move through the day':'Проведите день по шкале'}</label><input id="time" type="range" min="0" max="1439" step="1" value={minute} onChange={e=>setMinute(+e.target.value)} aria-valuetext={Math.floor(minute/60)+':'+minute%60}/><div className="ticks"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div></div>
 <div className="event-row">{[['dawn',en?'First light':'Первые сумерки'],['sunrise',en?'Sunrise':'Рассвет'],['goldenHour',en?'Golden light':'Мягкий свет'],['sunset',en?'Sunset':'Закат']].map(([key,title])=><div key={key}><span>{title}</span><strong>{fmt(times[key as keyof typeof times] as Date|null)}</strong></div>)}</div>
 </div></section><footer><p>{en?'Look up. Leave some room for wonder.':'Поднимите глаза. Оставьте место удивлению.'}</p><span>HELIO · ORIGINAL WEBGL SCENE · LOCAL CALCULATIONS</span></footer>
 </main>;
}
