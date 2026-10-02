import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MercatorCoordinate} from 'maplibre-gl';
import {buildNeighborhood,insideBuilding,mercator,metersUnit,localPoint,toLngLat,areaBounds,HALF_SIZE,MAX_PARTS,MAX_VERTICES,type Point,type Polygon,type Building,type Feature,type Neighborhood} from '../src/buildings.ts';
import {polygonMesh,shadeAt,ShadowLayer,mercatorModelMatrix} from '../src/ShadowLayer.ts';
import {solarDirection} from '../src/solar.ts';
const origin:Point=[0,0];
const square=(x:number,y:number,width=2):Point[]=>[[x,y],[x+width,y],[x+width,y+width],[x,y+width],[x,y]];
const feature=(polygons:Polygon[],properties:Record<string,unknown>={render_height:10,render_min_height:0},id?:number|string):Feature=>({id,properties,geometry:{type:polygons.length===1?'Polygon':'MultiPolygon',coordinates:polygons.length===1?polygons[0].map(r=>r.map(p=>toLngLat(p,...origin))):polygons.map(poly=>poly.map(r=>r.map(p=>toLngLat(p,...origin))))}});
const box=(x:number,north:number,width=2,height=10,base=0):Building=>({polygons:[[square(x,north,width)]],height,base,conditional:false});
const model=(buildings:Building[],incomplete=false):Neighborhood=>({buildings,parts:buildings.reduce((n,b)=>n+b.polygons.length,0),vertices:buildings.reduce((n,b)=>n+b.polygons.reduce((v,p)=>v+p.reduce((w,r)=>w+r.length,0),0),0),conditional:0,incomplete,skipped:0});
const meshes=(buildings:Building[])=>{const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),out=buildings.flatMap(b=>b.polygons.map(p=>polygonMesh(p,b,material)));out.forEach(m=>m.updateMatrixWorld(true));return out;};
const epsilon=(actual:number,expected:number,tol=1e-5)=>assert.ok(Math.abs(actual-expected)<tol,`${actual} != ${expected}`);

test('same stable ID unions tile fragments while preserving hole and MultiPolygon',()=>{
 const outer=square(-20,-20,40),hole=square(-5,-5,10),island=square(60,60,5),f=feature([[outer,hole],[island]],undefined,42);
 const n=buildNeighborhood([f,f],...origin);assert.equal(n.buildings.length,1);assert.equal(n.parts,2);assert.ok(n.buildings[0].polygons.some(p=>p.length===2));assert.equal(insideBuilding([0,0],n.buildings[0]),false);assert.equal(insideBuilding([15,0],n.buildings[0]),true);
});
test('distinct tile fragments of one building union into a courtyard and detached part',()=>{
 const rectangle=(x0:number,x1:number,y0:number,y1:number):Point[]=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]],hole=rectangle(-5,5,-5,5),left=feature([[rectangle(-20,5,-20,20),hole],[square(60,60,5)]],undefined,0),right=feature([[rectangle(-5,20,-20,20),hole]],undefined,0),n=buildNeighborhood([left,right],...origin);
 assert.equal(n.incomplete,false);assert.equal(n.buildings.length,1);assert.equal(n.parts,2);assert.ok(n.buildings[0].polygons.some(p=>p.length===2));assert.equal(insideBuilding([0,0],n.buildings[0]),false);assert.equal(insideBuilding([-15,0],n.buildings[0]),true);assert.equal(insideBuilding([15,0],n.buildings[0]),true);
});
test('same ID groups only equal height/base and different stable IDs are retained',()=>{
 const poly=[[square(0,0)]];const n=buildNeighborhood([feature(poly,undefined,'A'),feature(poly,undefined,'B'),feature(poly,{render_height:20,render_min_height:0},'A'),feature(poly,{render_height:20,render_min_height:4},'A')],...origin);assert.equal(n.buildings.length,4);
});
test('missing-ID dedup is conservative: orientation/starting vertex are equivalent, nearby footprints differ',()=>{
 const ring=square(0,0),open=ring.slice(0,-1),rotated=[...open.slice(2),...open.slice(0,2)],reversed=[...rotated].reverse();reversed.push(reversed[0]);
 const n=buildNeighborhood([feature([[ring]]),feature([[reversed]]),feature([[square(.003,0)]])],...origin);assert.equal(n.buildings.length,2);
});
test('clipping remains within exact +/-150 m and excludes nonintersecting contours',()=>{
 const n=buildNeighborhood([feature([[square(140,140,30)]]),feature([[square(300,300,10)]])],...origin);assert.equal(n.parts,1);for(const p of n.buildings[0].polygons.flat(2)){assert.ok(p[0]>=-HALF_SIZE-1e-6&&p[0]<=HALF_SIZE+1e-6);assert.ok(p[1]>=-HALF_SIZE-1e-6&&p[1]<=HALF_SIZE+1e-6);}
});
test('hide_3d variants are skipped and invalid height/base estimates are explicit',()=>{
 const hidden=[true,1,'true','1'].map((hide_3d,i)=>feature([[square(i*4,0)]],{hide_3d,render_height:10,render_min_height:0}));const n=buildNeighborhood([...hidden,feature([[square(30,0)]],{render_height:NaN,render_min_height:-1})],...origin);assert.equal(n.parts,1);assert.equal(n.conditional,1);assert.equal(n.buildings[0].height,9);assert.equal(n.buildings[0].base,0);
});
test('malformed features/geometry never throw and mark incomplete',()=>{
 for(const bad of [null,{}, {geometry:null},{geometry:{type:'Polygon',coordinates:[[null]]}},{geometry:{type:'Polygon',coordinates:[[[0,0],[1,Infinity],[0,1],[0,0]]]}},{geometry:{type:'MultiPolygon',coordinates:null}}]){const n=buildNeighborhood([bad as Feature,feature([[square(0,0)]])],...origin);assert.equal(n.incomplete,true);assert.equal(shadeAt(n,meshes(n.buildings),180,45),'insufficient');}
});
test('part/vertex/input limits set incomplete before unbounded canonicalization',()=>{
 const many=Array.from({length:MAX_PARTS+1},(_,i)=>feature([[square(-100+(i%20)*8,-100+Math.floor(i/20)*8,2)]],undefined,i));const n=buildNeighborhood(many,...origin);assert.equal(n.incomplete,true);assert.ok(n.parts<=MAX_PARTS);assert.ok(n.vertices<=MAX_VERTICES);
 const ring=Array.from({length:30000},(_,i)=>toLngLat([Math.cos(i/30000*Math.PI*2)*100,Math.sin(i/30000*Math.PI*2)*100],...origin));ring.push(ring[0]);const huge={geometry:{type:'Polygon',coordinates:[ring]},properties:{render_height:10,render_min_height:0}};const guarded=buildNeighborhood([huge as Feature],...origin);assert.equal(guarded.incomplete,true);assert.equal(guarded.parts,0);
});
test('a malformed ring cannot poison or bypass the subsequent input vertex budget',()=>{
 const malformed={geometry:{type:'Polygon',coordinates:[[{length:undefined}]]}} as unknown as Feature,ring=Array.from({length:100},(_,i)=>[Math.cos(i/100*Math.PI*2)*20,Math.sin(i/100*Math.PI*2)*20] as Point);ring.push(ring[0]);const repeated=feature([[ring]],undefined,1),n=buildNeighborhood([malformed,...Array.from({length:1100},()=>repeated)],...origin);assert.equal(n.incomplete,true);assert.equal(n.reasons?.['input-budget'],1);assert.equal(n.parts,1);
});
test('dateline coordinates remain local and bounds travel across the short interval',()=>{
 for(const longitude of [179.9999,-179.9999]){const o=mercator(longitude,20),u=metersUnit(20),p=toLngLat([100,50],longitude,20),local=localPoint(...p,o,u);epsilon(local[0],100);epsilon(local[1],50);const bounds=areaBounds(longitude,20);assert.ok(bounds[1][0]>bounds[0][0]);assert.ok(bounds[1][0]-bounds[0][0]<.01);epsilon((bounds[1][0]+bounds[0][0])/2,longitude);}
});
test('inside footprint classification remains conservative with low roofs and courtyard walls',()=>{
 assert.equal(insideBuilding([0,0],box(-1,-1,2,.5)),true);assert.equal(insideBuilding([0,0],box(-1,-1,2,10,4)),false);assert.equal(insideBuilding([0,0],box(-1,-1,2,10,1.6)),true);
 const courtyard:Building={polygons:[[square(-10,-10,20),square(-2,-2,4)]],height:10,base:0,conditional:false};assert.equal(insideBuilding([0,0],courtyard),false);assert.equal(insideBuilding([2,0],courtyard),true);
});
test('far degenerate tile fragments do not invalidate nearby geometry; near defects do',()=>{
 const farPoint=toLngLat([500,500],...origin),far:Feature={geometry:{type:'Polygon',coordinates:[[farPoint,farPoint,farPoint,farPoint]]}},nearPoint=toLngLat([0,0],...origin),near:Feature={geometry:{type:'Polygon',coordinates:[[nearPoint,nearPoint,nearPoint,nearPoint]]}};
 const outside=buildNeighborhood([far,feature([[square(10,10)]])],...origin);assert.equal(outside.incomplete,false);assert.equal(outside.parts,1);
 const inside=buildNeighborhood([near,feature([[square(10,10)]])],...origin);assert.equal(inside.incomplete,true);assert.equal(inside.reasons?.ring,1);
});
test('aggregated MultiPolygon source is spatially filtered before the relevant-part cap',()=>{
 const far=Array.from({length:500},(_,i)=>[square(500+i*4,500)]),near=[square(10,10)],n=buildNeighborhood([feature([...far,near],undefined,99)],...origin);assert.equal(n.incomplete,false);assert.equal(n.parts,1);assert.equal(n.skipped,0);
});
test('actual extruded meshes use xEast/yUp/zSouth, preserve elevated bases and courtyard hole',()=>{
 const b:Building={polygons:[[square(-10,-10,20),square(-2,-2,4)]],height:10,base:4,conditional:false},m=meshes([b])[0];m.geometry.computeBoundingBox();const bounds=m.geometry.boundingBox!;epsilon(bounds.min.x,-10);epsilon(bounds.max.x,10);epsilon(bounds.min.y,4);epsilon(bounds.max.y,10);epsilon(bounds.min.z,-10);epsilon(bounds.max.z,10);
 const vertical=new THREE.Raycaster(new THREE.Vector3(0,1.6,0),new THREE.Vector3(0,1,0));assert.equal(vertical.intersectObject(m).length,0,'courtyard must stay open in actual triangulated mesh');const roof=new THREE.Raycaster(new THREE.Vector3(5,1.6,0),new THREE.Vector3(0,1,0));assert.ok(roof.intersectObject(m).length>0);
});
test('10 m obstacle at45 degrees casts 10 m ground shadow opposite each cardinal sun',()=>{
 for(const azimuth of [0,90,180,270]){const dir=solarDirection(azimuth,0);const b=box(dir[0]*10-1,-dir[2]*10-1,2);const mesh=meshes([b])[0],top=new THREE.Vector3(dir[0]*10,10,dir[2]*10),towardGround=new THREE.Vector3(...solarDirection(azimuth,45)).negate();const t=-top.y/towardGround.y,shadowEnd=top.clone().addScaledVector(towardGround,t);epsilon(top.distanceTo(new THREE.Vector3(top.x,0,top.z)),10);epsilon(Math.hypot(shadowEnd.x-top.x,shadowEnd.z-top.z),10);epsilon(shadowEnd.x,0);epsilon(shadowEnd.z,0);const groundRay=new THREE.Raycaster(new THREE.Vector3(0,0,0),new THREE.Vector3(...solarDirection(azimuth,45)));assert.ok(groundRay.intersectObject(mesh).length>0);assert.equal(shadeAt(model([b]),[mesh],azimuth,45),'clear','1.6 m eye can be clear beyond the ground shadow tip');const nearer=box(dir[0]*8-1,-dir[2]*8-1,2);assert.equal(shadeAt(model([nearer]),meshes([nearer]),azimuth,45),'shade');assert.equal(shadeAt(model([b]),[mesh],(azimuth+180)%360,45),'clear');}
});
test('actual raycast distinguishes long shadow, elevated clearance, courtyard and pin inside',()=>{
 const north=box(-1,5,2);assert.equal(shadeAt(model([north]),meshes([north]),0,45),'shade');const distant=box(-1,25,2);assert.equal(shadeAt(model([distant]),meshes([distant]),0,45),'clear');
 const elevated=box(-1,1,2,10,5);assert.equal(shadeAt(model([elevated]),meshes([elevated]),0,30),'clear');assert.equal(shadeAt(model([box(-1,-1)]),meshes([box(-1,-1)]),0,45),'inside');
 const courtyard:Building={polygons:[[square(-10,-10,20),square(-2,-2,4)]],height:10,base:0,conditional:false};assert.equal(shadeAt(model([courtyard]),meshes([courtyard]),0,89),'clear');assert.equal(shadeAt(model([courtyard]),meshes([courtyard]),0,20),'shade');
});
test('missing/incomplete/invalid/mismatched mesh data can never report clear',()=>{
 const b=box(-1,50);for(const incomplete of [true,false]){const n=model([b],incomplete);assert.equal(shadeAt(n,[],0,45),'insufficient');}assert.equal(shadeAt(model([]),[],0,45),'insufficient');for(const [az,alt]of [[NaN,45],[0,NaN],[Infinity,45],[0,Infinity]])assert.equal(shadeAt(model([b]),meshes([b]),az,alt),'insufficient');assert.equal(shadeAt(model([b]),meshes([b]),0,-1),'night');
});
test('MapLibre model transform has east/south/up axes with exact meter scale',()=>{
 const o=MercatorCoordinate.fromLngLat([71.4491,51.1694],0),s=o.meterInMercatorCoordinateUnits(),matrix=mercatorModelMatrix(o);
 const zero=new THREE.Vector3().applyMatrix4(matrix);for(const [point,expected]of [[[1,0,0],[s,0,0]],[[0,1,0],[0,0,s]],[[0,0,1],[0,s,0]]]as const){const d=new THREE.Vector3(...point).applyMatrix4(matrix).sub(zero);d.toArray().forEach((v,i)=>epsilon(v,expected[i],1e-12));}
});
test('shadow camera contains the full model, including500 m roofs at low sun',()=>{
 const b=box(140,140,10,500),layer=new ShadowLayer(model([b]),...origin);
 for(const azimuth of [0,90,180,270])for(const altitude of [.1,10,45,89.9]){layer.setSun(azimuth,altitude);const camera=layer.light.shadow.camera,matrix=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);for(const x of [layer.bounds.min.x,layer.bounds.max.x])for(const y of [layer.bounds.min.y,layer.bounds.max.y])for(const z of [layer.bounds.min.z,layer.bounds.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(matrix);assert.ok(Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&Math.abs(p.z)<=1,`model clipped at azimuth${azimuth}/altitude${altitude}`);}}
 assert.equal(layer.setSun(NaN,45),'insufficient');assert.equal(layer.light.castShadow,false);assert.ok(layer.light.position.toArray().every(Number.isFinite));layer.onRemove();
});
test('inactive custom layer updates sunlight state without requesting map repaint',()=>{
 const b=box(-1,5),layer=new ShadowLayer(model([b]),...origin);let repaint=0;layer.map={triggerRepaint(){repaint++;}} as unknown as NonNullable<ShadowLayer['map']>;
 layer.active=false;assert.equal(layer.setSun(0,45),'shade');assert.equal(repaint,0);assert.equal(layer.azimuth,0);assert.equal(layer.altitude,45);assert.equal(layer.light.intensity,3);
 layer.active=true;assert.equal(layer.setSun(180,45),'clear');assert.equal(repaint,1);layer.onRemove();
});
test('production extrusion assigns cream caps and darker walls without changing ray geometry',()=>{
 const b=box(-1,5),layer=new ShadowLayer(model([b]),...origin),mesh=layer.meshes[0];assert.ok(Array.isArray(mesh.material));const material=mesh.material as THREE.MeshStandardMaterial[];assert.equal(material.length,2);assert.equal(material[0].color.getHex(),0xf3e4c8);assert.equal(material[1].color.getHex(),0xc8bca3);assert.deepEqual([...new Set(mesh.geometry.groups.map(g=>g.materialIndex))].sort(),[0,1]);assert.equal(layer.setSun(0,45),'shade');assert.equal(layer.setSun(180,45),'clear');layer.onRemove();
});
test('contour budget also caps actual production extrusion vertices across parts and holes',()=>{
 const circle=(x:number,y:number,radius:number,count:number):Point[]=>{const ring=Array.from({length:count},(_,i)=>[x+Math.cos(i/count*Math.PI*2)*radius,y+Math.sin(i/count*Math.PI*2)*radius] as Point);ring.push(ring[0]);return ring;};
 const input=Array.from({length:48},(_,i)=>{const x=-119+(i%8)*34,y=-85+Math.floor(i/8)*34;return feature([[circle(x,y,12,96),circle(x-4,y-3,1.8,24),circle(x+4,y-3,1.8,24),circle(x,y+4,1.8,24)]],undefined,i);});
 const n=buildNeighborhood(input,...origin);assert.equal(n.incomplete,true,'omitted excess geometry must stay explicit');assert.equal(n.reasons?.['output-budget'],1);assert.equal(MAX_VERTICES,8192);assert.ok(n.vertices>7500&&n.vertices<=MAX_VERTICES);assert.equal(n.parts,47);assert.ok(n.buildings.every(b=>b.polygons.every(p=>p.length===4)));
 const layer=new ShadowLayer(n,...origin),positions=layer.meshes.reduce((count,mesh)=>count+mesh.geometry.getAttribute('position').count,0);let scenePositions=0;layer.scene.traverse(o=>{if(o instanceof THREE.Mesh)scenePositions+=o.geometry.getAttribute('position').count;});assert.ok(positions<=12*n.vertices,`${positions} positions exceed closed-contour expansion bound`);assert.ok(positions<=98304&&positions<100000);assert.equal(scenePositions,positions+4);assert.ok(scenePositions<100000);assert.equal(layer.setSun(0,45),'insufficient');console.log(JSON.stringify({check:'production-render-budget',parts:n.parts,closedContourVertices:n.vertices,positionVertices:positions,scenePositionVertices:scenePositions,maxPositionVertices:98304,maxScenePositionVertices:98308,incomplete:n.incomplete}));layer.onRemove();
});
