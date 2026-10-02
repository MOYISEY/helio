import{places,calculateDay,today,plainDate,validZone,validatePlace,type Place}from'./solar.ts';
import{Temporal}from'@js-temporal/polyfill';
export type SavedPlan={version:1;place:Place;date:string;instant:number};
export const STORAGE_KEY='helio.saved-plan.v1';
export function parseSaved(raw:string):SavedPlan{
 if(raw.length>10000)throw Error('saved');const s=JSON.parse(raw);if(s?.version!==1||typeof s.date!=='string'||typeof s.instant!=='number'||!s.place||typeof s.place.id!=='string'||typeof s.place.ru!=='string'||typeof s.place.en!=='string'||s.place.ru.length>80||s.place.en.length>80)throw Error('saved');validatePlace(s.place);plainDate(s.date);const p=calculateDay(s.date,s.place);if(!Number.isFinite(s.instant)||s.instant<p.start||s.instant>=p.end)throw Error('saved');return s;
}
export function initialSettings(){const params=new URLSearchParams(location.search);let place=places[0],date=today(place.zone),error=false,lang:'ru'|'en'=params.get('lang')==='en'?'en':'ru';
 if(params.has('city')){const found=places.find(p=>p.id===params.get('city'));if(found)place=found;else error=true;}date=today(place.zone);
 if(params.has('zone')){const zone=params.get('zone')!;if(validZone(zone))place={...place,zone};else error=true;}
 date=today(place.zone);
 if(params.has('date'))try{plainDate(params.get('date')!);calculateDay(params.get('date')!,place);date=params.get('date')!;}catch{error=true;}
 if(params.has('lat')||params.has('lon'))error=true; // Manual coordinates are local form input; never generate coordinate URLs.
 let plan=calculateDay(date,place),instant=plan.events.find(e=>e.id==='goldenStart')?.at??plan.start+plan.minutes*.65*60000;
 if(params.has('time')){const value=params.get('time')!;if(/^\d{2}:\d{2}$/.test(value)){const h=Number(value.slice(0,2)),m=Number(value.slice(3));if(h<24&&m<60){const d=plainDate(date);try{const z=Temporal.ZonedDateTime.from({year:d.year,month:d.month,day:d.day,hour:h,minute:m,timeZone:place.zone},{disambiguation:'reject'});instant=z.epochMilliseconds;if(instant<plan.start||instant>=plan.end)error=true;}catch{error=true;}}else error=true;}else error=true;}
 instant=Math.max(plan.start,Math.min(plan.end-1,instant));return{place,date,instant,lang,error,view:params.get('view')==='2d'};
}
