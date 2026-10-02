import type{Map}from'maplibre-gl';
// Visual paint changes only: source data, building geometry and attribution stay intact.
export function muteBasemap(map:Map){for(const layer of map.getStyle().layers){const sourceLayer='source-layer'in layer?layer['source-layer']:'';
 if(layer.type==='background')map.setPaintProperty(layer.id,'background-color','#e8e5dc');
 if(layer.type==='fill'&&['park','landuse','landcover'].includes(sourceLayer??'')){map.setPaintProperty(layer.id,'fill-color',sourceLayer==='park'?'#d9dfd0':'#e1e1d5');map.setPaintProperty(layer.id,'fill-opacity',.72);}
 if(layer.type==='fill'&&sourceLayer==='water')map.setPaintProperty(layer.id,'fill-color','#c5d2d7');
 if(layer.type==='line'&&sourceLayer==='transportation')map.setPaintProperty(layer.id,'line-opacity',.7);
 if(layer.type==='symbol'&&sourceLayer==='poi'){map.setPaintProperty(layer.id,'text-opacity',.58);map.setPaintProperty(layer.id,'icon-opacity',.58);}
 if(layer.type==='symbol'&&/shield/.test(layer.id)){map.setPaintProperty(layer.id,'text-opacity',.58);map.setPaintProperty(layer.id,'icon-opacity',.58);}
 if(layer.type==='symbol'&&sourceLayer==='place')map.setPaintProperty(layer.id,'text-opacity',.72);
}}
