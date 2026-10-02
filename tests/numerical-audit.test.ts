import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {Temporal} from '@js-temporal/polyfill';
import {calculateDay, dayBounds, plainDate, shiftDate, formatTime, geometricAltitude, positionAt, solarDirection, phaseForGeometric, seekMinute, places, validatePlace, validZone, utcOffset, type Place} from '../src/solar.ts';
import {parseSaved,initialSettings} from '../src/state.ts';
import {exportPlan, exportCalendar} from '../src/export.ts';

const fx = JSON.parse(readFileSync(new URL('./fixtures/usno-solar.json', import.meta.url), 'utf8'));
const place = (lat:number,lon:number,zone='UTC'):Place => ({id:'audit',ru:'Проверка',en:'Audit',lat,lon,zone});
const mappings:Record<string,string> = {'Begin Civil Twilight':'dawn',Rise:'sunrise','Upper Transit':'noon',Set:'sunset','End Civil Twilight':'dusk'};

test('published JPL Horizons positions preserve degree units and north-clockwise azimuth',()=>{
 const fx=JSON.parse(readFileSync(new URL('./fixtures/jpl-solar.json',import.meta.url),'utf8')),comparisons:any[]=[];
 for(const loc of fx.locations)for(const [instant,expected]of Object.entries(fx.positions[loc.name])as [string,{azimuth:number,altitude:number}][]){
  const actual=positionAt(Date.parse(instant),place(loc.lat,loc.lng));const azimuthError=Math.abs((actual.azimuth-expected.azimuth+540)%360-180),altitudeError=Math.abs(actual.altitude-expected.altitude);
  comparisons.push({location:loc.name,instant,actual,expected,azimuthError,altitudeError});assert.ok(azimuthError<=.05,`${loc.name} ${instant} azimuth ${azimuthError}`);assert.ok(altitudeError<=.25,`${loc.name} ${instant} altitude ${altitudeError}`);
 }
 writeFileSync('qa-private/numerical-reference/helio-jpl-comparison.json',JSON.stringify({checkedAt:new Date().toISOString(),source:fx.source,comparisons,maxAzimuthError:Math.max(...comparisons.map(c=>c.azimuthError)),maxAltitudeError:Math.max(...comparisons.map(c=>c.altitudeError))},null,2));assert.equal(comparisons.length,728);
});

test('published USNO oracle: every solar event is present within two minutes', () => {
 const comparisons:any[]=[];const missing:any[]=[];const failures:any[]=[];const roundedBoundary:any[]=[];
 for(const loc of fx.locations) for(const [date,rows] of Object.entries(fx.times[loc.name]) as [string,any[]][]){
  const plan=calculateDay(date,place(loc.lat,loc.lng));
  for(const row of rows){const id=mappings[row.phen];if(!id||!row.time)continue;
   const expected=Date.parse(date+'T'+row.time+':00Z');const events=plan.events.filter(e=>e.id===id);
   let closest=events.sort((a,b)=>Math.abs(a.at-expected)-Math.abs(b.at-expected))[0];
   // USNO's whole-minute 00:00 can round an exact event from the previous civil day.
   // Check that narrow boundary only; exact selected-day filtering must still exclude it.
   if(!closest&&row.time==='00:00'){
    const previous=calculateDay(shiftDate(date,-1),place(loc.lat,loc.lng)).events.filter(e=>e.id===id&&Math.abs(e.at-expected)<=30000)[0];
    if(previous){closest=previous;roundedBoundary.push({location:loc.name,date,id,actual:new Date(previous.at).toISOString(),explanation:'Whole-minute USNO midnight value rounds from preceding exact civil day; Helio correctly excludes it from selected day.'});}
   }
   if(!closest){missing.push({location:loc.name,date,id,expected:row.time});continue;}
   const errorSeconds=Math.abs(closest.at-expected)/1000;
   const comparison={location:loc.name,date,id,expected:new Date(expected).toISOString(),actual:new Date(closest.at).toISOString(),errorSeconds};
   comparisons.push(comparison);if(errorSeconds>120)failures.push(comparison);
  }
 }
 mkdirSync('qa-private/numerical-reference',{recursive:true});
 writeFileSync('qa-private/numerical-reference/helio-usno-comparison.json',JSON.stringify({checkedAt:new Date().toISOString(),source:fx.source,days:fx.locations.length*fx.days.length,comparisons,roundedBoundary,missing,failures,maxErrorSeconds:Math.max(...comparisons.map(c=>c.errorSeconds))},null,2));
 assert.deepEqual(missing,[],'reference events silently missing');assert.deepEqual(failures,[],'events differ by > 2 minutes');assert.ok(comparisons.length>600);
});

test('civil day bounds use true IANA durations and date-line dates',()=>{
 for(const [date,zone,minutes,start,end] of [
  ['2026-03-08','America/New_York',1380,'2026-03-08T05:00:00.000Z','2026-03-09T04:00:00.000Z'],
  ['2026-11-01','America/New_York',1500,'2026-11-01T04:00:00.000Z','2026-11-02T05:00:00.000Z'],
  ['2026-04-05','Australia/Sydney',1500,'2026-04-04T13:00:00.000Z','2026-04-05T14:00:00.000Z'],
  ['2026-10-04','Australia/Sydney',1380,'2026-10-03T14:00:00.000Z','2026-10-04T13:00:00.000Z'],
  ['2024-02-29','Asia/Kathmandu',1440,'2024-02-28T18:15:00.000Z','2024-02-29T18:15:00.000Z'],
  ['2026-03-20','Pacific/Kiritimati',1440,'2026-03-19T10:00:00.000Z','2026-03-20T10:00:00.000Z']
 ] as const){const bounds=dayBounds(date,zone);assert.equal(bounds.minutes,minutes);assert.equal(new Date(bounds.start).toISOString(),start);assert.equal(new Date(bounds.end).toISOString(),end);}
 assert.throws(()=>dayBounds('2011-12-30','Pacific/Apia'),/skipped-date/);
 assert.equal(shiftDate('2024-02-29',1),'2024-03-01');assert.equal(shiftDate('2024-03-01',-1),'2024-02-29');
});

test('DST repeated hour keeps two distinct instants and offsets',()=>{
 const zone='America/New_York',a=Date.parse('2026-11-01T05:30Z'),b=Date.parse('2026-11-01T06:30Z');
 assert.equal(formatTime(a,zone,'en'), '01:30');assert.equal(formatTime(b,zone,'en'),'01:30');assert.equal(utcOffset(a,zone),'-04:00');assert.equal(utcOffset(b,zone),'-05:00');
});

test('polar, twilight and missing +6 crossing have distinct meanings',()=>{
 const p=places.find(p=>p.id==='tromso')!;
 const summer=calculateDay('2026-06-21',p),winter=calculateDay('2026-12-21',p),lowSun=calculateDay('2026-01-15',p),shoulder=calculateDay('2026-05-17',p);
 assert.equal(summer.state,'polarDay');assert.ok(Math.abs(summer.daylightMinutes-summer.minutes)<1e-7);assert.ok(summer.intervals.some(i=>i.kind==='golden'));assert.ok(!summer.events.some(e=>e.id==='sunrise'||e.id==='sunset'));
 assert.equal(winter.state,'polarNight');assert.equal(winter.daylightMinutes,0);assert.ok(winter.events.some(e=>e.id==='dawn'));assert.ok(winter.events.some(e=>e.id==='dusk'));assert.ok(winter.intervals.some(i=>i.kind==='twilight'));
 assert.equal(lowSun.state,'ordinary');assert.ok(lowSun.events.some(e=>e.id==='sunrise'));assert.ok(lowSun.events.some(e=>e.id==='sunset'));assert.ok(!lowSun.events.some(e=>e.id==='goldenEnd'||e.id==='goldenStart'));assert.ok(lowSun.intervals.some(i=>i.kind==='golden'));
 assert.ok(shoulder.events.some(e=>e.id==='sunset'&&e.at-shoulder.start<10*60000),'must recover preceding solar day sunset shortly after local midnight');
});

test('all intervals cover each actual civil day exactly and exclude adjacent-day events',()=>{
 const dates=['2024-02-29','2026-03-08','2026-03-20','2026-06-21','2026-09-23','2026-11-01','2026-12-21','2026-05-17'];
 for(const p of places)for(const date of dates){const plan=calculateDay(date,p);assert.equal(plan.intervals[0].start,plan.start);assert.equal(plan.intervals.at(-1)!.end,plan.end);
  let previous=plan.start;for(const interval of plan.intervals){assert.equal(interval.start,previous);assert.ok(interval.end>interval.start);previous=interval.end;assert.equal(interval.kind,phaseForGeometric(geometricAltitude(positionAt((interval.start+interval.end)/2,p).altitude)));}
  for(const e of plan.events){assert.ok(e.at>=plan.start&&e.at<plan.end);assert.equal(Temporal.Instant.fromEpochMilliseconds(e.at).toZonedDateTimeISO(p.zone).toPlainDate().toString(),date);}
  assert.ok(plan.daylightMinutes>=-1e-7&&plan.daylightMinutes<=plan.minutes+1e-7);assert.equal(seekMinute(plan,-500),plan.start);assert.equal(seekMinute(plan,99999),plan.end-1);
 }
});

test('apparent altitude is converted before geometric phase thresholds',()=>{
 const ref=(h:number)=>{const rad=Math.max(h,0)*Math.PI/180;return .0002967/Math.tan(rad+.00312536/(rad+.08901179))*180/Math.PI;};
 for(const h of [-90,-18,-6,-.833,0,6,20,89.99])assert.ok(Math.abs(geometricAltitude(h+ref(h))-h)<1e-9);
 const p=places.find(p=>p.id==='london')!,plan=calculateDay('2026-03-20',p);
 for(const [id,threshold]of [['dawn',-6],['sunrise',-.833],['goldenEnd',6],['goldenStart',6],['sunset',-.833],['dusk',-6]] as const){const e=plan.events.find(e=>e.id===id)!;assert.ok(Math.abs(geometricAltitude(positionAt(e.at,p).altitude)-threshold)<.02);}
});

test('solar world vector is north-clockwise and unit length',()=>{
 for(const [azimuth,expected] of [[0,[0,0,-1]],[90,[1,0,0]],[180,[0,0,1]],[270,[-1,0,0]]] as const){const actual=solarDirection(azimuth,0);actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-12));}
 for(const azimuth of [0,27,90,180,270,359])for(const altitude of [-90,-12,0,6,45,90])assert.ok(Math.abs(Math.hypot(...solarDirection(azimuth,altitude))-1)<1e-12);
});

test('malformed date/coordinates/zone/saved state are rejected',()=>{
 for(const date of ['2026-02-30','2023-02-29','2026-13-01','2026-1-01','1899-12-31','2101-01-01','<script>'])assert.throws(()=>plainDate(date));
 for(const coords of [[NaN,0],[91,0],[-91,0],[0,181],[0,-181],[Infinity,0]])assert.throws(()=>validatePlace(place(...coords as [number,number])));
 for(const zone of ['','+05:00','GMT','Mars/Olympus','<script>'])assert.equal(validZone(zone),false);
 const p=places[0],plan=calculateDay('2026-03-20',p),good={version:1,place:p,date:plan.date,instant:plan.start};assert.deepEqual(parseSaved(JSON.stringify(good)),good);
 for(const bad of ['', '{}','null', JSON.stringify({...good,version:2}),JSON.stringify({...good,instant:plan.end}),JSON.stringify({...good,instant:Infinity}),JSON.stringify({...good,place:{...p,zone:'Mars/Olympus'}}),' '.repeat(10001)])assert.throws(()=>parseSaved(bad));
});

test('JSON plan exports retain explicit zone, absolute instants, date and null-free polar events',()=>{
 for(const [date,p]of [['2026-11-01',places.find(p=>p.id==='new-york')!],['2026-12-21',places.find(p=>p.id==='tromso')!]] as const){const plan=calculateDay(date,p),selected=plan.start+60000,obj=JSON.parse(exportPlan(plan,selected,'en'));assert.equal(obj.calendarDate,date);assert.equal(obj.timeZone,p.zone);assert.equal(obj.day.elapsedMinutes,plan.minutes);assert.equal(obj.selectedInstant,new Date(selected).toISOString());assert.equal(obj.selectedOffset,utcOffset(selected,p.zone));assert.equal(obj.events.length,plan.events.length);assert.ok(!obj.events.some((e:any)=>e.instant===null||e.instant.startsWith('1970')));}
});

test('calendar exports use UTC, CRLF, RFC line folding and escaped values',()=>{
 const p={...places[0],ru:'Ж'.repeat(45)+', semi; slash\\ line\nnext'},plan=calculateDay('2026-03-20',p),selected=plan.start+60000,ics=exportCalendar(plan,selected,'ru',plan.start),unfold=ics.replace(/\r\n /g,'');
 assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));assert.ok(ics.endsWith('END:VCALENDAR\r\n'));assert.ok(unfold.includes('DTSTART:20260319T190100Z'));assert.ok(unfold.includes('DTEND:20260319T193100Z'));
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);assert.ok(unfold.includes('\\, semi\\; slash\\\\ line\\nnext'));assert.equal((unfold.match(/BEGIN:VEVENT/g)||[]).length,1);
});

test('calendar names cannot inject physical lines through CR or LF',()=>{
 const p={...places[0],en:'A\rBEGIN:VEVENT\nSUMMARY:injected\r\nEND:VEVENT'},plan=calculateDay('2026-03-20',p),ics=exportCalendar(plan,plan.start,'en',plan.start),unfold=ics.replace(/\r\n /g,'');
 assert.ok(!/(?<!\r)\n|\r(?!\n)/.test(ics),'bare LF or CR must not appear');assert.equal((unfold.match(/(?:^|\r\n)BEGIN:VEVENT/g)||[]).length,1);assert.ok(unfold.includes('A\\nBEGIN:VEVENT\\nSUMMARY:injected\\nEND:VEVENT'));
});

test('default URL date follows final selected zone',()=>{
 const previousNow=Date.now;Date.now=()=>Date.parse('2026-10-02T12:00:00Z');
 try{Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?zone=Pacific/Kiritimati'}});const settings=initialSettings();assert.equal(settings.date,'2026-10-03');}finally{Date.now=previousNow;}
});

test('nonexistent DST URL time produces recoverable feedback',()=>{
 Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?city=new-york&date=2026-03-08&time=02:30'}});const settings=initialSettings();assert.equal(settings.error,true);assert.ok(Number.isFinite(settings.instant));
});

test('malformed URL settings recover into valid bounded state',()=>{
 for(const query of ['?city=unknown&date=2026-02-30&zone=Mars/Olympus&time=99:99','?lat=90&lon=180','?city=new-york&date=2011-12-30&zone=Pacific/Apia','?time=%3Cscript%3E']){
  Object.defineProperty(globalThis,'location',{configurable:true,value:{search:query}});const settings=initialSettings(),plan=calculateDay(settings.date,settings.place);assert.equal(settings.error,true);assert.ok(settings.instant>=plan.start&&settings.instant<plan.end);
 }
});
