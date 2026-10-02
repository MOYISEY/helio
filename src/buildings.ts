import clipping from 'polygon-clipping';
export type Point=[number,number];
export type Polygon=Point[][];
export type Building={polygons:Polygon[];height:number;base:number;conditional:boolean};
export type Feature={id?:string|number;properties?:Record<string,unknown>|null;geometry:{type:string;coordinates:unknown}};
export type Neighborhood={buildings:Building[];parts:number;vertices:number;conditional:number;incomplete:boolean;skipped:number;reasons?:Record<string,number>};
// Closed contour vertices bound no-bevel, one-step extrusion to <=12x vertices.
export const HALF_SIZE=150,MAX_PARTS=240,MAX_VERTICES=8192,EYE_HEIGHT=1.6;
export const MAX_INPUT_FEATURES=10000,MAX_INPUT_VERTICES=100000,MAX_RING_VERTICES=2048,MAX_FEATURE_VERTICES=8192;
export const MAX_PREFILTER_VERTICES=1000000,MAX_PREFILTER_POLYGONS=50000;
const MAX_FEATURE_POLYGONS=MAX_PARTS,MAX_POLYGON_RINGS=128,MAX_GROUP_POLYGONS=960,MAX_MERCATOR_LAT=85.051129;
const circumference=40075016.68557849;
export function mercator(lon:number,lat:number):Point{return[(lon+180)/360,(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2];}
export function metersUnit(lat:number){return 1/(circumference*Math.cos(lat*Math.PI/180));}
export function localPoint(lon:number,lat:number,origin:Point,unit:number):Point{const m=mercator(lon,lat);let dx=m[0]-origin[0];dx-=Math.round(dx);return[dx/unit,-(m[1]-origin[1])/unit];} // east / north in local meters
export function toLngLat(p:Point,lon:number,lat:number):Point{const o=mercator(lon,lat),u=metersUnit(lat),x=o[0]+p[0]*u,y=o[1]-p[1]*u;return[((x*360-180+540)%360)-180,Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI];}
export function areaBounds(lon:number,lat:number){
 // MapLibre accepts unwrapped eastern longitude, so the bounds stay short at the date line.
 const sw=toLngLat([-HALF_SIZE,-HALF_SIZE],lon,lat),ne=toLngLat([HALF_SIZE,HALF_SIZE],lon,lat);sw[0]+=360*Math.round((lon-sw[0])/360);ne[0]+=360*Math.round((lon-ne[0])/360);if(ne[0]<sw[0])ne[0]+=360;return[sw,ne] as [Point,Point];
}
function finiteHeight(v:unknown){return typeof v==='number'&&Number.isFinite(v)?v:null;}
function stableId(v:unknown){return typeof v==='string'&&v.length>0&&v.length<=200?v:typeof v==='number'&&Number.isSafeInteger(v)?String(v):null;}
function vertexCount(polygons:Polygon[]){return polygons.reduce((n,p)=>n+p.reduce((v,r)=>v+r.length,0),0);}
function minimalRotation(tokens:string[]){ // Booth's linear-time minimum cyclic rotation; no all-rotations allocation.
 const n=tokens.length;if(!n)return'';let i=0,j=1,k=0;while(i<n&&j<n&&k<n){const a=tokens[(i+k)%n],b=tokens[(j+k)%n];if(a===b){k++;continue;}if(a>b){i+=k+1;if(i===j)i++;}else{j+=k+1;if(i===j)j++;}k=0;}const start=Math.min(i,j);return tokens.slice(start).concat(tokens.slice(0,start)).join(';');
}
function ringKey(r:Point[]){const tokens=r.slice(0,-1).map(p=>p.map(v=>String(Object.is(v,-0)?0:v)).join(',')),a=minimalRotation(tokens),b=minimalRotation([...tokens].reverse());return a<b?a:b;}
function keyGeometry(polygons:Polygon[]){return polygons.map(poly=>ringKey(poly[0])+'['+poly.slice(1).map(ringKey).sort().join('|')+']').sort().join('||');}
type Group={polygons:Polygon[];height:number;base:number;conditional:boolean;vertices:number;keys:Set<string>};
export function buildNeighborhood(features:Feature[],lon:number,lat:number):Neighborhood{
 const empty=(skipped=0):Neighborhood=>({buildings:[],parts:0,vertices:0,conditional:0,incomplete:true,skipped});
 if(!Array.isArray(features)||!Number.isFinite(lon)||Math.abs(lon)>180||!Number.isFinite(lat)||Math.abs(lat)>MAX_MERCATOR_LAT)return empty();
 const origin=mercator(lon,lat),unit=metersUnit(lat),groups=new Map<string,Group>(),reasons:Record<string,number>={};let incomplete=false,skipped=0,inputVertices=0,inputBudgetReached=false,prefilterVertices=0,prefilterPolygons=0;
 const reason=(name:string)=>{reasons[name]=(reasons[name]??0)+1;};
 const boundary:Polygon=[[[-HALF_SIZE,-HALF_SIZE],[HALF_SIZE,-HALF_SIZE],[HALF_SIZE,HALF_SIZE],[-HALF_SIZE,HALF_SIZE],[-HALF_SIZE,-HALF_SIZE]]];
 for(let index=0;index<features.length;index++){
  if(index>=MAX_INPUT_FEATURES){incomplete=true;reason('feature-count-budget');break;}const f=features[index];
  if(!f||typeof f!=='object'||!f.geometry||typeof f.geometry!=='object'){skipped++;incomplete=true;reason('invalid-feature');continue;}
  const props=f.properties&&typeof f.properties==='object'?f.properties:{};
  if(props.hide_3d===true||props.hide_3d===1||props.hide_3d==='true'||props.hide_3d==='1')continue;
  if(f.geometry.type!=='Polygon'&&f.geometry.type!=='MultiPolygon'){skipped++;incomplete=true;reason('unsupported-geometry');continue;}
  const source=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
  if(!Array.isArray(source)||!source.length){skipped++;incomplete=true;reason('invalid-source');continue;}
  let polygons:Polygon[]=[];
  try{
   let featureVertices=0,relevantParts=0;const normalized:Polygon[]=[];
   for(const poly of source){
    if(++prefilterPolygons>MAX_PREFILTER_POLYGONS){inputBudgetReached=true;throw Error('prefilter-part-budget');}
    // Source queries include far-away loaded tile features. Cull only when all outer points
    // prove this part cannot intersect the neighborhood, before height/inner-ring validation.
    const outer=Array.isArray(poly)?poly[0]:null;let bounded=Array.isArray(outer)&&outer.length>0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    if(Array.isArray(outer))for(const point of outer){if(++prefilterVertices>MAX_PREFILTER_VERTICES){inputBudgetReached=true;throw Error('prefilter-budget');}if(!Array.isArray(point)||!Number.isFinite(point[0])||!Number.isFinite(point[1])||Math.abs(point[0])>540||Math.abs(point[1])>MAX_MERCATOR_LAT){bounded=false;break;}const p=localPoint(point[0],point[1],origin,unit);minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
    if(bounded&&(maxX< -HALF_SIZE||minX>HALF_SIZE||maxY< -HALF_SIZE||minY>HALF_SIZE))continue;
    if(++relevantParts>MAX_FEATURE_POLYGONS)throw Error('feature-part-budget');
    if(!Array.isArray(poly)||!poly.length||poly.length>MAX_POLYGON_RINGS)throw Error('polygon');const rings:Polygon=[];
    for(const ring of poly){
     // Validate before counting: a malformed .length must never poison the global budget with NaN.
     if(!Array.isArray(ring)||ring.length<4||ring.length>MAX_RING_VERTICES)throw Error('ring');
     inputVertices+=ring.length;featureVertices+=ring.length;
     if(inputVertices>MAX_INPUT_VERTICES){inputBudgetReached=true;throw Error('input-budget');}if(featureVertices>MAX_FEATURE_VERTICES)throw Error('feature-budget');
     const points:Point[]=[];
     for(const p of ring){if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>540||Math.abs(p[1])>MAX_MERCATOR_LAT)throw Error('coordinate');const point=localPoint(p[0],p[1],origin,unit);if(!Number.isFinite(point[0])||!Number.isFinite(point[1]))throw Error('coordinate');const last=points.at(-1);if(!last||last[0]!==point[0]||last[1]!==point[1])points.push(point);}
     const first=points[0],last=points.at(-1);if(!first||!last)throw Error('ring');if(first[0]!==last[0]||first[1]!==last[1])points.push([...first]);if(points.length<4)throw Error('ring');
     let twiceArea=0;for(let i=0;i<points.length-1;i++)twiceArea+=points[i][0]*points[i+1][1]-points[i+1][0]*points[i][1];if(Math.abs(twiceArea)<1e-8)throw Error('degenerate-ring');rings.push(points);
    }
    normalized.push(rings);
   }
   if(!normalized.length)continue;polygons=clipping.intersection(normalized,boundary) as Polygon[];
   if(vertexCount(polygons)>MAX_FEATURE_VERTICES)throw Error('clipped-budget');
  }catch(error){skipped++;incomplete=true;reason(error instanceof Error?error.message:'geometry-error');if(inputBudgetReached)break;continue;}
  if(!polygons.length)continue;
  let height=finiteHeight(props.render_height),base=finiteHeight(props.render_min_height),conditional=false;
  if(height===null||height<=0||height>500){height=9;conditional=true;}if(base===null||base<0||base>=height){base=0;conditional=true;}
  const geometryKey=keyGeometry(polygons),id=stableId(f.id)??stableId(props.id),groupKey=(id===null?'geometry:'+geometryKey:'id:'+id)+'@'+height+'/'+base;
  const old=groups.get(groupKey),count=vertexCount(polygons);
  if(old){old.conditional ||=conditional;if(old.keys.has(geometryKey))continue;if(old.polygons.length+polygons.length>MAX_GROUP_POLYGONS||old.vertices+count>MAX_VERTICES){skipped++;incomplete=true;reason('group-budget');continue;}old.polygons.push(...polygons);old.vertices+=count;old.keys.add(geometryKey);}
  else groups.set(groupKey,{polygons,height,base,conditional,vertices:count,keys:new Set([geometryKey])});
 }
 const buildings:Building[]=[];let parts=0,vertices=0,conditional=0;
 for(const group of groups.values()){
  try{
   // Union each stable-ID group once, rather than repeatedly unioning an ever-growing result.
   const polygons=group.keys.size>1?clipping.union(group.polygons) as Polygon[]:group.polygons,count=polygons.length,n=vertexCount(polygons);
   if(parts+count>MAX_PARTS||vertices+n>MAX_VERTICES){incomplete=true;reason('output-budget');continue;}
   const b={polygons,height:group.height,base:group.base,conditional:group.conditional};buildings.push(b);parts+=count;vertices+=n;if(b.conditional)conditional+=count;
  }catch{skipped++;incomplete=true;reason('union-error');}
 }
 return{buildings,parts,vertices,conditional,incomplete,skipped,reasons};
}
function ringStatus(p:Point,r:Point[]){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j],cross=(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);if(Math.abs(cross)<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7)return 0;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside?1:-1;}
export function insideBuilding(p:Point,b:Building){return b.base<=EYE_HEIGHT&&b.polygons.some(poly=>ringStatus(p,poly[0])>=0&&!poly.slice(1).some(h=>ringStatus(p,h)===1));} // conservative footprint classification; elevated clearance is tested at eye height
