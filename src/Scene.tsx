import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
export type SolarView={altitude:number;azimuth:number};
export default function Scene({position,reduced,onFallback}:{position:SolarView;reduced:boolean;onFallback:()=>void}){
 const host=useRef<HTMLDivElement>(null),update=useRef<(p:SolarView)=>void>(()=>{}); const [ready,setReady]=useState(false);
 useEffect(()=>{const el=host.current;if(!el)return;let renderer:T.WebGLRenderer;
 try{renderer=new T.WebGLRenderer({alpha:false,antialias:true,powerPreference:'low-power'});}catch{onFallback();return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;el.appendChild(renderer.domElement);
 const world=new T.Scene(),camera=new T.PerspectiveCamera(43,1,.1,400);camera.position.set(0,4,31);camera.lookAt(0,1,-30);
 const u={sun:{value:new T.Vector3()},day:{value:0},clock:{value:0}};
 const sky=new T.Mesh(new T.SphereGeometry(180,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:u,vertexShader:`varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 dir;uniform vec3 sun;uniform float day;void main(){vec3 d=normalize(dir);float h=max(d.y,0.);vec3 night=mix(vec3(.027,.042,.11),vec3(.006,.013,.053),pow(h,.4));vec3 blue=mix(vec3(.21,.32,.54),vec3(.025,.082,.26),pow(h,.4));float dusk=exp(-abs(sun.y)*12.);vec3 c=mix(night,blue,day);c+=vec3(.45,.19,.09)*dusk*pow(1.-h,5.);float a=max(dot(d,normalize(sun)),0.);c+=vec3(.98,.42,.13)*pow(a,40.)*(.4+dusk);c+=vec3(1.,.8,.46)*pow(a,700.)*1.4;gl_FragColor=vec4(c,1.);}`}));
 world.add(sky);
 const planetUniform={sun:u.sun,day:u.day};
 const earth=new T.Mesh(new T.SphereGeometry(42,96,64),new T.ShaderMaterial({uniforms:planetUniform,vertexShader:`varying vec3 n;varying vec3 p;varying vec3 v;void main(){n=normalize(normalMatrix*normal);p=position;vec4 mv=modelViewMatrix*vec4(position,1.);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec3 n;varying vec3 p;varying vec3 v;uniform vec3 sun;uniform float day;float noise(vec3 q){return sin(q.x*.31+sin(q.z*.26))*sin(q.z*.18+q.y*.21);}void main(){float lit=max(dot(normalize(n),normalize(sun)),0.);float rim=pow(1.-max(dot(normalize(n),normalize(v)),0.),3.5);float bands=sin(p.y*1.8+noise(p)*3.)*.5+.5;vec3 base=mix(vec3(.009,.026,.08),vec3(.023,.083,.22),lit);base+=vec3(.024,.05,.09)*bands*lit;base+=vec3(.06,.14,.32)*rim;float warm=pow(lit,7.)*rim;base+=vec3(.5,.23,.10)*warm;gl_FragColor=vec4(base,1.);}`}));
 earth.position.set(7,-43,-34);world.add(earth);
 const atmosphere=new T.Mesh(new T.SphereGeometry(42.24,96,64),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:planetUniform,vertexShader:`varying vec3 n;varying vec3 v;void main(){n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec3 n;varying vec3 v;uniform vec3 sun;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),5.);float lit=max(dot(normalize(n),normalize(sun)),0.);gl_FragColor=vec4(mix(vec3(.13,.38,.95),vec3(1.,.45,.15),pow(lit,6.)),rim*.45);}`}));
 atmosphere.position.copy(earth.position);world.add(atmosphere);
 const solar=new T.Mesh(new T.SphereGeometry(1.55,48,32),new T.MeshBasicMaterial({color:0xffdba1}));world.add(solar);
 const starsPos=[];let seed=47;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};for(let i=0;i<800;i++){const a=rand()*Math.PI*2,y=rand(),r=160*Math.sqrt(1-y*y);starsPos.push(Math.sin(a)*r,y*160,Math.cos(a)*r);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(starsPos,3));const starsMat=new T.PointsMaterial({color:0xc9d8ff,size:.17,transparent:true,opacity:.5,depthWrite:false});world.add(new T.Points(geo,starsMat));
 let frame=0,visible=true,disposed=false,drag=0,down:number|null=null;
 function set(p:SolarView){const alt=T.MathUtils.degToRad(p.altitude);const yaw=T.MathUtils.degToRad(p.azimuth)+drag; // view tracks the solar azimuth; camera heading is reported by the UI
 const dir=new T.Vector3(Math.sin(drag)*Math.cos(alt),Math.sin(alt),-Math.cos(drag)*Math.cos(alt));u.sun.value.copy(dir);u.day.value=T.MathUtils.smoothstep(p.altitude,-8,18);solar.position.copy(dir).multiplyScalar(115);solar.visible=p.altitude>-.8;starsMat.opacity=(1-u.day.value)*.7;void yaw;render();}
 let current=position;update.current=p=>{current=p;set(p);};
 function render(){if(!disposed&&visible)renderer.render(world,camera);}
 const resize=new ResizeObserver(()=>{const b=el.getBoundingClientRect();if(b.width&&b.height){renderer.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();render();}});resize.observe(el);
 const obs=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(visible)render();},{threshold:0});obs.observe(el);
 const pd=(e:PointerEvent)=>{down=e.clientX;el.setPointerCapture(e.pointerId);};const pm=(e:PointerEvent)=>{if(down!==null){drag=Math.max(-1.1,Math.min(1.1,drag+(e.clientX-down)*.003));down=e.clientX;set(current);}};const pu=()=>{down=null;};el.addEventListener('pointerdown',pd);el.addEventListener('pointermove',pm);el.addEventListener('pointerup',pu);el.addEventListener('pointercancel',pu);
 const lost=(e:Event)=>{e.preventDefault();onFallback();};renderer.domElement.addEventListener('webglcontextlost',lost);
 set(position);setReady(true);
 if(!reduced){let steps=0;const intro=()=>{if(disposed)return;if(visible&&steps<38){camera.position.z=31+(1-steps/38)*3;steps++;render();frame=requestAnimationFrame(intro);}};frame=requestAnimationFrame(intro);}
 return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();obs.disconnect();el.removeEventListener('pointerdown',pd);el.removeEventListener('pointermove',pm);el.removeEventListener('pointerup',pu);el.removeEventListener('pointercancel',pu);renderer.domElement.removeEventListener('webglcontextlost',lost);world.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){o.geometry.dispose();const m=o.material;Array.isArray(m)?m.forEach(x=>x.dispose()):m.dispose();}});renderer.dispose();renderer.domElement.remove();};
 },[reduced,onFallback]);useEffect(()=>update.current(position),[position]);
 return <div ref={host} className={'scene '+(ready?'ready':'')} aria-hidden="true"/>;
}
