import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import{solarDirection}from'./solar.ts';
export type SolarView={altitude:number;azimuth:number};
export default function Scene({position,heading,reduced,onFallback}:{position:SolarView;heading:number|null;reduced:boolean;onFallback:()=>void}){
 const host=useRef<HTMLDivElement>(null),update=useRef<(p:SolarView,h:number|null)=>void>(()=>{}),[ready,setReady]=useState(false);
 useEffect(()=>{
 const el=host.current;if(!el)return;let renderer:T.WebGLRenderer;
 try{renderer=new T.WebGLRenderer({alpha:false,antialias:true,powerPreference:'low-power'});}catch{onFallback();return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;el.appendChild(renderer.domElement);
 const world=new T.Scene(),camera=new T.PerspectiveCamera(43,1,.1,400);
 const u={sun:{value:new T.Vector3()},day:{value:0}};
 const sky=new T.Mesh(new T.SphereGeometry(180,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:u,vertexShader:`varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 dir;uniform vec3 sun;uniform float day;void main(){vec3 d=normalize(dir);float h=max(d.y,0.);vec3 night=mix(vec3(.027,.042,.11),vec3(.006,.013,.053),pow(h,.4));vec3 blue=mix(vec3(.21,.32,.54),vec3(.025,.082,.26),pow(h,.4));float dusk=exp(-abs(sun.y)*12.);vec3 c=mix(night,blue,day);c+=vec3(.30,.10,.05)*dusk*pow(1.-h,5.);float a=max(dot(d,normalize(sun)),0.);c+=vec3(.75,.24,.09)*pow(a,40.)*(.10+dusk*.23);c+=vec3(.35,.15,.06)*pow(a,700.);gl_FragColor=vec4(c,1.);}`}));
 world.add(sky);
 const earth=new T.Mesh(new T.SphereGeometry(42,96,64),new T.ShaderMaterial({uniforms:u,vertexShader:`varying vec3 n;varying vec3 p;varying vec3 v;void main(){vec4 wp=modelMatrix*vec4(position,1.);n=normalize(mat3(modelMatrix)*normal);p=position;v=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}`,fragmentShader:`varying vec3 n;varying vec3 p;varying vec3 v;uniform vec3 sun;float noise(vec3 q){return sin(q.x*.31+sin(q.z*.26))*sin(q.z*.18+q.y*.21);}void main(){float lit=max(dot(normalize(n),normalize(sun)),0.);float rim=pow(1.-max(dot(normalize(n),normalize(v)),0.),3.5);float bands=sin(p.y*1.8+noise(p)*3.)*.5+.5;vec3 c=mix(vec3(.009,.026,.08),vec3(.023,.083,.22),lit);c+=vec3(.024,.05,.09)*bands*lit;c+=vec3(.06,.14,.32)*rim;c+=vec3(.5,.23,.10)*pow(lit,7.)*rim;gl_FragColor=vec4(c,1.);}`}));
 earth.position.set(0,-43,0);world.add(earth);
 const atmosphere=new T.Mesh(new T.SphereGeometry(42.24,96,64),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:u,vertexShader:`varying vec3 n;varying vec3 v;void main(){vec4 wp=modelMatrix*vec4(position,1.);n=normalize(mat3(modelMatrix)*normal);v=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}`,fragmentShader:`varying vec3 n;varying vec3 v;uniform vec3 sun;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),5.);float lit=max(dot(normalize(n),normalize(sun)),0.);gl_FragColor=vec4(mix(vec3(.13,.38,.95),vec3(1.,.45,.15),pow(lit,6.)),rim*.45);}`}));
 atmosphere.position.copy(earth.position);world.add(atmosphere);
 const solar=new T.Mesh(new T.SphereGeometry(1.6,48,32),new T.MeshBasicMaterial({color:0xfff2da}));world.add(solar);
 const starsPos:number[]=[];let seed=47;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 for(let i=0;i<800;i++){const a=rand()*Math.PI*2,y=rand(),r=160*Math.sqrt(1-y*y);starsPos.push(Math.sin(a)*r,y*160,Math.cos(a)*r);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(starsPos,3));const starsMaterial=new T.PointsMaterial({color:0xc9d8ff,size:.17,transparent:true,opacity:.5,depthWrite:false});world.add(new T.Points(geometry,starsMaterial));
 let frame=0,visible=true,disposed=false,yaw=position.azimuth*Math.PI/180,target=yaw;
 const orient=(distance=31)=>{camera.position.set(-Math.sin(yaw)*distance,4,Math.cos(yaw)*distance);camera.lookAt(Math.sin(yaw)*60,1,-Math.cos(yaw)*60);};
 const render=()=>{if(!disposed&&visible&&!document.hidden)renderer.render(world,camera);};
 const apply=(p:SolarView,h:number|null)=>{
 u.sun.value.set(...solarDirection(p.azimuth,p.altitude));u.day.value=T.MathUtils.smoothstep(p.altitude,-8,18);
 solar.position.copy(u.sun.value).multiplyScalar(115);solar.visible=p.altitude>-.8;starsMaterial.opacity=(1-u.day.value)*.7;
 target=(h??p.azimuth)*Math.PI/180;cancelAnimationFrame(frame);
 if(reduced||!visible||document.hidden){yaw=target;orient();render();return;}
 const from=yaw,delta=Math.atan2(Math.sin(target-from),Math.cos(target-from)),start=performance.now();
 const animate=()=>{if(disposed||!visible||document.hidden)return;const t=Math.min(1,(performance.now()-start)/380),ease=1-Math.pow(1-t,3);yaw=from+delta*ease;orient();render();if(t<1)frame=requestAnimationFrame(animate);};frame=requestAnimationFrame(animate);
 };
 update.current=apply;orient();
 const resize=new ResizeObserver(()=>{const b=el.getBoundingClientRect();if(b.width&&b.height){renderer.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();render();}});resize.observe(el);
 const observer=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(!visible)cancelAnimationFrame(frame);else{yaw=target;orient();render();}},{threshold:0});observer.observe(el);
 const visibility=()=>{if(document.hidden)cancelAnimationFrame(frame);else{yaw=target;orient();render();}};document.addEventListener('visibilitychange',visibility);
 const lost=(e:Event)=>{e.preventDefault();onFallback();};renderer.domElement.addEventListener('webglcontextlost',lost);
 apply(position,heading);setReady(true);
 return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lost);world.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){o.geometry.dispose();const m=o.material;Array.isArray(m)?m.forEach(x=>x.dispose()):m.dispose();}});renderer.dispose();renderer.domElement.remove();};
 },[reduced,onFallback]);
 useEffect(()=>update.current(position,heading),[position,heading]);
 return <div ref={host} className={'scene '+(ready?'ready':'')} aria-hidden="true"/>;
}
