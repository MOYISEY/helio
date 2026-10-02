import{readFileSync,writeFileSync,readdirSync,existsSync}from'node:fs';
const lock=JSON.parse(readFileSync('package-lock.json','utf8')),pkgs=Object.entries(lock.packages).filter(([p,v])=>p.startsWith('node_modules/')&&!v.dev&&existsSync(p));
let text='Helio / Daylight Atlas — third-party notices\n\n';const missing=[];
for(const[p,v]of pkgs){const files=readdirSync(p).filter(n=>/^(license|licence|copying|copyright)(\.|$)/i.test(n));let body='';
 if(files.length)body=files.map(f=>readFileSync(p+'/'+f,'utf8')).join('\n\n');
 else{const readme=readdirSync(p).find(n=>/^readme\.md$/i.test(n)),content=readme?readFileSync(p+'/'+readme,'utf8'):'';const at=content.search(/^## License/m);if(at>=0)body=content.slice(at);}
 if(!body){missing.push(p);continue;}text+='== '+p.replace('node_modules/','')+' '+v.version+' ==\n'+body+'\n\n';
}
if(missing.length)throw Error('Missing full license texts: '+missing.join(', '));writeFileSync('THIRD_PARTY_NOTICES.txt',text);writeFileSync('public/THIRD_PARTY_NOTICES.txt',text);console.log('Preserved '+pkgs.length+' full runtime/font licenses.');
