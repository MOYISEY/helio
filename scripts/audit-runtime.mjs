import {openBrowser} from './browser-config.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5175/helio/';
const directory='qa-private/numerical-runtime';mkdirSync(directory,{recursive:true});
const browser=await openBrowser();
const reports=[],errors=[],requests=[];
const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
await context.addInitScript(()=>{window.__storageWrites=[];window.__storageRemoves=[];const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;Storage.prototype.setItem=function(k,v){window.__storageWrites.push({key:k,value:v});return set.call(this,k,v);};Storage.prototype.removeItem=function(k){window.__storageRemoves.push(k);return remove.call(this,k);};});
const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
const check=async(name,fn)=>{try{await fn();reports.push({name,pass:true});}catch(error){reports.push({name,pass:false,error:error.message});}console.log(JSON.stringify(reports.at(-1)));};
const setRange=async(value)=>{await page.locator('#time').evaluate((input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);};
try{
await page.goto(base+'?lang=en&city=new-york&date=2026-11-01&view=2d');await page.locator('time').waitFor();
await check('No automatic storage writes',async()=>assert.deepEqual(await page.evaluate(()=>window.__storageWrites),[]));
await check('25-hour DST day uses elapsed range and both 01:30 instants',async()=>{
 const range=page.locator('#time');assert.equal(await range.getAttribute('max'),'1499');
 for(const [minute,iso,offset]of [[90,'2026-11-01T05:30:00.000Z','UTC-04:00'],[150,'2026-11-01T06:30:00.000Z','UTC-05:00']]){
  await setRange(minute);assert.equal(await page.locator('time').getAttribute('datetime'),iso);assert.equal(await page.locator('time').innerText(),'01:30');assert.ok((await page.locator('.clock-zone').innerText()).includes(offset));
 }
});
await check('Actual JSON and ICS downloads retain selected absolute time and zone',async()=>{
 const selected=await page.locator('time').getAttribute('datetime');
 const [json]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/^Download plan/}).click()]);await json.saveAs(directory+'/plan.json');const obj=JSON.parse(readFileSync(directory+'/plan.json','utf8'));assert.equal(obj.calendarDate,'2026-11-01');assert.equal(obj.timeZone,'America/New_York');assert.equal(obj.day.elapsedMinutes,1500);assert.equal(obj.selectedInstant,selected);
 const [ics]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/^Add to calendar/}).click()]);await ics.saveAs(directory+'/plan.ics');const content=readFileSync(directory+'/plan.ics','utf8');assert.ok(content.includes('DTSTART:20261101T063000Z'));assert.ok(content.includes('DTEND:20261101T070000Z'));
});
await check('Every available event button jumps to its exact calculated instant',async()=>{
 const plan=JSON.parse(readFileSync(directory+'/plan.json','utf8')),names={dawn:'Civil dawn',sunrise:'Sunrise',goldenEnd:'Golden light ends',noon:'Solar noon',goldenStart:'Golden light starts',sunset:'Sunset',dusk:'Civil dusk'};
 for(const event of plan.events){await page.getByRole('button',{name:new RegExp('^'+names[event.name]+',')}).click();await page.waitForFunction(expected=>document.querySelector('time').getAttribute('datetime')===expected,event.instant);}
 await setRange(150);
});
await check('Explicit save, restore and delete work without implicit writes',async()=>{
 const selected=await page.locator('time').getAttribute('datetime');await page.getByRole('button',{name:'Save on this device',exact:true}).click();assert.equal((await page.evaluate(()=>window.__storageWrites)).length,1);
 await page.getByRole('button',{name:'Next day',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[type=date]').value==='2026-11-02');await page.getByRole('button',{name:'Open saved',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[type=date]').value==='2026-11-01');assert.equal(await page.locator('time').getAttribute('datetime'),selected);assert.equal(await page.locator('input[type=date]').inputValue(),'2026-11-01');
 await page.getByRole('button',{name:'Delete saved',exact:true}).click();assert.equal(await page.evaluate(()=>localStorage.getItem('helio.saved-plan.v1')),null);assert.equal((await page.evaluate(()=>window.__storageWrites)).length,1);
});
await check('Invalid zone leaves the current plan and gives feedback',async()=>{
 const selected=await page.locator('time').getAttribute('datetime'),zone=page.locator('.zone-field input');await zone.fill('Mars/Olympus');await page.locator('.zone-field button').click();assert.equal(await page.locator('time').getAttribute('datetime'),selected);assert.match(await page.getByRole('status').innerText(),/IANA/);await zone.fill('America/New_York');await page.locator('.zone-field button').click();
});
await check('Manual coordinates reject out-of-range input, then stay local',async()=>{
 await page.getByText('Plan another location',{exact:true}).click();await page.getByLabel('Latitude',{exact:true}).fill('91');await page.getByLabel('Longitude',{exact:true}).fill('18.9553');await page.locator('.manual input').nth(2).fill('Europe/Oslo');await page.getByRole('button',{name:'Use location',exact:true}).click();assert.match(await page.getByRole('status').innerText(),/latitude/);
 await page.getByLabel('Latitude',{exact:true}).fill('69.6492');await page.getByRole('button',{name:'Use location',exact:true}).click();assert.match(await page.locator('.clock-zone').innerText(),/Custom location/);assert.ok(!page.url().includes('69.6492'));assert.equal((await page.evaluate(()=>window.__storageWrites)).length,1);
});
await check('Polar night events and jumps retain twilight',async()=>{
 await page.getByLabel('Calendar date',{exact:true}).fill('2026-12-21');assert.match(await page.locator('.day-summary').innerText(),/does not rise/);assert.equal(await page.locator('.event').filter({hasText:'Sunrise'}).isDisabled(),true);const dawn=page.getByRole('button',{name:/^Civil dawn,/});assert.equal(await dawn.isEnabled(),true);await dawn.click();assert.match(await page.locator('time').getAttribute('datetime'),/^2026-12-21T/);
});
await check('Now and previous/next day update date and keep the range bounded',async()=>{
 await page.getByRole('button',{name:'Now',exact:true}).click();const current=await page.locator('input[type=date]').inputValue();await page.getByRole('button',{name:'Previous day',exact:true}).click();await page.getByRole('button',{name:'Next day',exact:true}).click();assert.equal(await page.locator('input[type=date]').inputValue(),current);const range=page.locator('#time');assert.ok(Number(await range.inputValue())<=Number(await range.getAttribute('max')));
});
await check('3D compass headings, follow mode, 2D fallback and language toggle respond',async()=>{
 await page.getByRole('button',{name:'Switch to 3D',exact:true}).click();await page.locator('canvas').waitFor();for(const direction of ['north','east','south','west']){const button=page.getByRole('button',{name:'Look '+direction,exact:true});await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');}
 await page.getByRole('button',{name:'Follow sun',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Follow sun',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'Switch to 2D',exact:true}).click();assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.locator('.fallback svg').count(),1);
 const selected=await page.locator('time').getAttribute('datetime');await page.getByRole('button',{name:'Switch to Russian',exact:true}).click();assert.equal(await page.locator('html').getAttribute('lang'),'ru');assert.equal(await page.locator('time').getAttribute('datetime'),selected);await page.getByRole('button',{name:'Переключить на английский',exact:true}).click();assert.equal(await page.locator('html').getAttribute('lang'),'en');
});
await page.screenshot({path:directory+'/runtime-desktop.png',fullPage:true});
await check('Normal runtime and custom coordinates make no third-party requests',async()=>{
 const external=requests.filter(url=>new URL(url).origin!==new URL(base).origin);assert.deepEqual(external,[]);
});
await check('Malformed saved JSON produces feedback and remains removable',async()=>{
 await page.evaluate(()=>localStorage.setItem('helio.saved-plan.v1','{"version":999}'));await page.reload();await page.getByRole('button',{name:'Open saved',exact:true}).click();assert.match(await page.getByRole('status').innerText(),/could not be restored/);await page.getByRole('button',{name:'Delete saved',exact:true}).click();assert.equal(await page.evaluate(()=>localStorage.getItem('helio.saved-plan.v1')),null);
});
await check('Malformed URL recovers and DST gap URL reports feedback',async()=>{
 await page.goto(base+'?lang=en&city=unknown&date=2026-02-30&zone=Mars/Olympus&time=99:99');await page.locator('time').waitFor();assert.match(await page.getByRole('status').innerText(),/link settings/);await page.goto(base+'?lang=en&city=new-york&date=2026-03-08&time=02:30&view=2d');await page.locator('time').waitFor();assert.match(await page.getByRole('status').innerText(),/link settings/);
});
await check('Storage denied keeps planner usable and provides feedback',async()=>{
 const isolated=await browser.newContext();await isolated.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked','SecurityError');};});const p=await isolated.newPage();await p.goto(base+'?lang=en&view=2d');await p.getByRole('button',{name:'Save on this device',exact:true}).click();assert.match(await p.getByRole('status').innerText(),/storage is unavailable/);assert.ok(await p.locator('time').getAttribute('datetime'));await isolated.close();
});
await check('No JavaScript page errors during executed flows',async()=>assert.deepEqual(errors,[]));
}finally{writeFileSync(directory+'/report.json',JSON.stringify({checkedAt:new Date().toISOString(),base,reports,errors,requests},null,2));await browser.close();}
console.log(JSON.stringify(reports,null,2));if(reports.some(r=>!r.pass))process.exitCode=1;
