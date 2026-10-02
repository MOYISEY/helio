import {Temporal} from '@js-temporal/polyfill';
import * as Sun from 'suncalc';
export type Place={id:string;ru:string;en:string;lat:number;lon:number;zone:string};
export const places:Place[]=[
{id:'astana',ru:'Астана',en:'Astana',lat:51.1694,lon:71.4491,zone:'Asia/Almaty'},
{id:'almaty',ru:'Алматы',en:'Almaty',lat:43.2389,lon:76.8897,zone:'Asia/Almaty'},
{id:'london',ru:'Лондон',en:'London',lat:51.5074,lon:-.1278,zone:'Europe/London'},
{id:'new-york',ru:'Нью-Йорк',en:'New York',lat:40.7128,lon:-74.006,zone:'America/New_York'},
{id:'tokyo',ru:'Токио',en:'Tokyo',lat:35.6762,lon:139.6503,zone:'Asia/Tokyo'},
{id:'sydney',ru:'Сидней',en:'Sydney',lat:-33.8688,lon:151.2093,zone:'Australia/Sydney'},
{id:'tromso',ru:'Тромсё',en:'Tromsø',lat:69.6492,lon:18.9553,zone:'Europe/Oslo'},
{id:'kathmandu',ru:'Катманду',en:'Kathmandu',lat:27.7172,lon:85.324,zone:'Asia/Kathmandu'},
{id:'kiritimati',ru:'Киритимати',en:'Kiritimati',lat:1.8721,lon:-157.4278,zone:'Pacific/Kiritimati'}
];
export function validZone(zone:string){if(!zone||zone.length>80||(!zone.includes('/')&&zone!=='UTC'))return false;try{new Intl.DateTimeFormat('en',{timeZone:zone});Temporal.Now.zonedDateTimeISO(zone);return true;}catch{return false;}}
export function validatePlace(p:Place){if(!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lon)||Math.abs(p.lon)>180)throw Error('coordinates');if(!validZone(p.zone))throw Error('zone');}
export function plainDate(date:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('date');let d;try{d=Temporal.PlainDate.from(date,{overflow:'reject'});}catch{throw Error('date');}if(d.year<1900||d.year>2100)throw Error('date');return d;}
export function dayBounds(date:string,zone:string){if(!validZone(zone))throw Error('zone');const d=plainDate(date),s=d.toZonedDateTime(zone),e=d.add({days:1}).toZonedDateTime(zone);if(!s.toPlainDate().equals(d)||e.epochMilliseconds<=s.epochMilliseconds)throw Error('skipped-date');return{start:s.epochMilliseconds,end:e.epochMilliseconds,minutes:(e.epochMilliseconds-s.epochMilliseconds)/60000};}
export function shiftDate(date:string,days:number){const d=plainDate(date).add({days});plainDate(d.toString());return d.toString();}
export function today(zone:string,now=Date.now()){return Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(zone).toPlainDate().toString();}
export function utcOffset(epoch:number,zone:string){return Temporal.Instant.fromEpochMilliseconds(Math.round(epoch)).toZonedDateTimeISO(zone).offset;}
export function formatTime(epoch:number,zone:string,lang:'ru'|'en',round=true){return new Intl.DateTimeFormat(lang==='ru'?'ru-RU':'en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(round?Math.round(epoch/60000)*60000:epoch);}
export function geometricAltitude(apparent:number){ // Inverse of SunCalc 2.1 Meeus 16.4 refraction; event thresholds are geometric.
 let low=-91,high=91;for(let i=0;i<45;i++){const h=(low+high)/2,rad=Math.max(h,0)*Math.PI/180,ref=.0002967/Math.tan(rad+.00312536/(rad+.08901179))*180/Math.PI;if(h+ref>apparent)high=h;else low=h;}return(low+high)/2;
}
export function positionAt(epoch:number,p:Place){return Sun.getPosition(new Date(epoch),p.lat,p.lon);}
export function solarDirection(azimuth:number,altitude:number):[number,number,number]{const a=azimuth*Math.PI/180,h=altitude*Math.PI/180;return[Math.sin(a)*Math.cos(h),Math.sin(h),-Math.cos(a)*Math.cos(h)];}
export type EventId='dawn'|'sunrise'|'goldenEnd'|'noon'|'goldenStart'|'sunset'|'dusk';
const ids:{id:EventId;key:keyof ReturnType<typeof Sun.getTimes>}[]=[{id:'dawn',key:'dawn'},{id:'sunrise',key:'sunrise'},{id:'goldenEnd',key:'goldenHourEnd'},{id:'noon',key:'solarNoon'},{id:'goldenStart',key:'goldenHour'},{id:'sunset',key:'sunset'},{id:'dusk',key:'dusk'}];
export type Phase='night'|'twilight'|'golden'|'day';
export function phaseForGeometric(h:number):Phase{return h< -6?'night':h<-.833?'twilight':h<=6?'golden':'day';}
export type SolarEvent={id:EventId;at:number};
export type Interval={kind:Phase;start:number;end:number};
export type DayPlan=ReturnType<typeof calculateDay>;
export function calculateDay(date:string,p:Place){
 validatePlace(p);const bounds=dayBounds(date,p.zone),d=plainDate(date);const events:SolarEvent[]=[];
 for(let delta=-2;delta<=2;delta++){const local=d.add({days:delta}).toZonedDateTime({timeZone:p.zone,plainTime:'12:00'});const times=Sun.getTimes(new Date(local.epochMilliseconds),p.lat,p.lon,0,local.offsetNanoseconds/6e10);
 for(const{id,key}of ids){const value=times[key];if(!(value instanceof Date)||!Number.isFinite(value.valueOf()))continue;const at=value.valueOf();if(at>=bounds.start&&at<bounds.end&&!events.some(e=>e.id===id&&Math.abs(e.at-at)<1000))events.push({id,at});}}
 events.sort((a,b)=>a.at-b.at);
 const points=[bounds.start,...events.filter(e=>e.id!=='noon').map(e=>e.at),bounds.end].sort((a,b)=>a-b),intervals:Interval[]=[];
 for(let i=0;i<points.length-1;i++){const s=points[i],e=points[i+1];if(e-s<1)continue;const kind=phaseForGeometric(geometricAltitude(positionAt((s+e)/2,p).altitude));const prev=intervals.at(-1);if(prev?.kind===kind)prev.end=e;else intervals.push({kind,start:s,end:e});}
 const daylightMinutes=intervals.filter(x=>x.kind==='day'||x.kind==='golden').reduce((v,x)=>v+(x.end-x.start)/60000,0);
 const samples=[];for(let t=bounds.start;t<bounds.end;t+=15*60000)samples.push(geometricAltitude(positionAt(t,p).altitude));samples.push(geometricAltitude(positionAt(bounds.end-1,p).altitude));
 const minAltitude=Math.min(...samples),maxAltitude=Math.max(...samples);
 const state=daylightMinutes>=bounds.minutes-.02?'polarDay':daylightMinutes<=.02?'polarNight':'ordinary';
 return{date,place:p,...bounds,events,intervals,daylightMinutes,minAltitude,maxAltitude,state};
}
export function phaseAt(epoch:number,plan:DayPlan){return phaseForGeometric(geometricAltitude(positionAt(epoch,plan.place).altitude));}
export function seekMinute(plan:DayPlan,minute:number){return Math.min(plan.end-1,Math.max(plan.start,plan.start+Math.round(minute)*60000));}

