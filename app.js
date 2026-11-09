// Ocean Tide — render + orchestrate (no innerHTML; DOM/SVG built safely)
(function(){
var C=window.CONFIG, NS="http://www.w3.org/2000/svg", $=function(id){return document.getElementById(id);};
function el(tag,attrs,text){var e=document.createElement(tag);setAttrs(e,attrs);if(text!=null)e.textContent=text;return e;}
function svg(tag,attrs,text){var e=document.createElementNS(NS,tag);setAttrs(e,attrs);if(text!=null)e.textContent=text;return e;}
function setAttrs(e,a){if(a)for(var k in a)e.setAttribute(k,a[k]);}
function clear(n){while(n.firstChild)n.removeChild(n.firstChild);}

function applyTheme(h){
  var night=(C.nightStart>C.nightEnd)?(h>=C.nightStart||h<C.nightEnd):(h>=C.nightStart&&h<C.nightEnd);
  $("frame").className=night?"theme-night":"theme-day";
}
function fmt12(min){var h=Math.floor(min/60),mm=min%60,ap=h>=12?"PM":"AM";h=h%12;if(h===0)h=12;return h+":"+(mm<10?"0":"")+mm+" "+ap;}

function renderHeader(m){
  $("station").textContent=m.stationName;
  $("water").textContent=m.water; $("wind").textContent=m.wind; $("pressure").textContent=m.pressure;
  $("asof").textContent="as of "+fmt12(m.now.min).toLowerCase();
  $("cur-dir").textContent=m.current.rising?"▲":"▼";
  $("cur-height").textContent=m.current.height.toFixed(1);
  $("cur-unit").textContent=" "+C.units.tide;
  $("cur-state").textContent="and "+(m.current.rising?"Rising":"Falling");
  var vp=$("vs-pred"); clear(vp); vp.appendChild(el("span",{class:"vs-dash"}));
  vp.appendChild(document.createTextNode(m.isMock?" predicted":" prediction"));
  $("date").textContent=m.dateLabel;
  var st=$("status"); clear(st);
  var bars=svg("svg",{width:"26",height:"16",viewBox:"0 0 26 16"});
  [[0,11,5,"var(--ink)"],[6,8,8,"var(--ink)"],[12,4,12,"var(--ink)"],[18,0,16,"var(--hair)"]].forEach(function(b){
    bars.appendChild(svg("rect",{x:b[0],y:b[1],width:4,height:b[2],fill:b[3]}));});
  st.appendChild(bars);
  var ul=$("events"); clear(ul);
  m.events.forEach(function(e){
    var li=el("li");
    li.appendChild(el("span",{class:"etri"},e.type==="H"?"▲":"▼"));
    li.appendChild(el("span",{class:"elbl"},e.type==="H"?"High":"Low"));
    li.appendChild(el("span",{class:"eht"},e.v.toFixed(1)+C.units.tide));
    li.appendChild(el("span",{class:"etime"},e.time));
    if(e.tmrw)li.appendChild(el("span",{class:"etmrw"},"tmrw"));
    ul.appendChild(li);
  });
}
function renderFooter(m){
  $("sunrise").textContent=m.sun.rise; $("sunset").textContent=m.sun.set;
  $("moon-name").textContent=m.moon.name; $("moon-next").textContent="Next "+m.moon.next;
  var ic=$("moon-ic"); clear(ic); ic.appendChild(moonSVG(m.moon.illum, m.moon.phase<0.5));
}
// SVG moon phase disk. illum 0..1, waxing=lit on right. At quarter (illum=0.5) terminator is a straight diameter.
function moonSVG(illum, waxing){
  illum=Math.max(0,Math.min(1,illum));
  var r=12, cx=13, cy=13, s=svg("svg",{width:"26",height:"26",viewBox:"0 0 26 26"});
  s.appendChild(svg("circle",{cx:cx,cy:cy,r:r,fill:"var(--muted)","fill-opacity":"0.3",stroke:"var(--ink)","stroke-width":"1","stroke-opacity":"0.5"}));
  var rx=r*(1-2*illum);                    // signed terminator half-width (0 at quarter)
  var outer=waxing?1:0;                      // lit limb side
  var inner=(rx>=0)?(waxing?0:1):(waxing?1:0);
  var d="M "+cx+" "+(cy-r)+" A "+r+" "+r+" 0 0 "+outer+" "+cx+" "+(cy+r)+
        " A "+Math.abs(rx).toFixed(2)+" "+r+" 0 0 "+inner+" "+cx+" "+(cy-r)+" Z";
  s.appendChild(svg("path",{d:d,fill:"var(--ink)"}));
  return s;
}
function interpV(curve,min){var i=0;for(;i<curve.length-1;i++){if(curve[i+1].min>=min)break;}
  var a=curve[i],b=curve[Math.min(i+1,curve.length-1)];if(b.min===a.min)return a.v;
  return a.v+(b.v-a.v)*((min-a.min)/(b.min-a.min));}
function triPath(x,y,type){var d=6;return type==="H"
  ?"M"+(x-d)+","+(y+d)+" L"+(x+d)+","+(y+d)+" L"+x+","+(y-d)+" Z"
  :"M"+(x-d)+","+(y-d)+" L"+(x+d)+","+(y-d)+" L"+x+","+(y+d)+" Z";}

function renderGraph(m){
  var g=$("graph"); clear(g);
  var W=1200,H=360,padL=58,padR=16,padT=20,padB=34, pw=W-padL-padR, ph=H-padT-padB;
  var vs=m.curve.map(function(p){return p.v;}).concat(m.events.map(function(e){return e.v;}));
  var maxV=Math.max.apply(null,vs),minV=Math.min.apply(null,vs);
  var yMax=Math.ceil((maxV+0.4)/2)*2; if(yMax<2)yMax=2;
  var yMin = (minV < -0.1) ? Math.floor((minV-0.2)/2)*2 : 0;   // only dip below 0 for genuine negative tides
  function X(min){return padL+(min/1440)*pw;}
  function Y(v){return padT+(yMax-v)/(yMax-yMin)*ph;}
  var add=function(n){g.appendChild(n);};
  for(var t=yMin;t<=yMax;t+=2){
    var y=Y(t);
    add(svg("line",{class:t===0?"axis":"grid",x1:padL,y1:y.toFixed(1),x2:W-padR,y2:y.toFixed(1)}));
    add(svg("text",{x:padL-10,y:(y+6).toFixed(1),"text-anchor":"end"}, t===yMax?(t+" ft"):(""+t)));
  }
  [0,360,720,1080,1440].forEach(function(mm){add(svg("line",{class:"gridv",x1:X(mm),y1:padT,x2:X(mm),y2:padT+ph}));});
  var pts=m.curve.map(function(p){return X(p.min).toFixed(1)+","+Y(p.v).toFixed(1);});
  var base=Y(Math.max(0,yMin)).toFixed(1);
  add(svg("path",{class:"area",d:"M"+X(m.curve[0].min).toFixed(1)+","+base+" L"+pts.join(" L")+" L"+X(m.curve[m.curve.length-1].min).toFixed(1)+","+base+" Z"}));
  add(svg("path",{class:"curve",d:"M"+pts.join(" L")}));
  var nowMin=m.now.min, curNow=interpV(m.curve,nowMin);
  var past=m.curve.filter(function(p){return p.min<=nowMin;}).map(function(p){return X(p.min).toFixed(1)+","+Y(p.v).toFixed(1);});
  past.push(X(nowMin).toFixed(1)+","+Y(curNow).toFixed(1));
  if(past.length>1)add(svg("path",{class:"past",d:"M"+past.join(" L")}));
  m.events.forEach(function(e){if(!e.tmrw)add(svg("path",{class:"evmark",d:triPath(X(e.min),Y(e.v)-10,e.type)}));});
  axisGlyphs(m).forEach(function(gl){add(svg("text",{class:"axlabel",x:X(gl.min).toFixed(1),y:padT+ph+26,"text-anchor":"middle","font-size":"16"},gl.ic));});
  add(svg("line",{class:"nowline",x1:X(nowMin).toFixed(1),y1:padT,x2:X(nowMin).toFixed(1),y2:padT+ph}));
  add(svg("circle",{class:"nowdot",cx:X(nowMin).toFixed(1),cy:Y(curNow).toFixed(1),r:8}));
  [["12am",0,"start"],["6am",360,"middle"],["12pm",720,"middle"],["6pm",1080,"middle"],["12am",1440,"end"]].forEach(function(p){
    add(svg("text",{x:X(p[1]).toFixed(1),y:H-6,"text-anchor":p[2]},p[0]));});
}
function axisGlyphs(m){
  var g=[],dObj=new Date(m.now.y,m.now.mo-1,m.now.d);
  var sun=window.SunCalc.getTimes(dObj,C.lat,C.lon),mt=window.SunCalc.getMoonTimes(dObj,C.lat,C.lon);
  function mins(d){return d.getHours()*60+d.getMinutes();}
  if(sun.sunrise)g.push({min:mins(sun.sunrise),ic:"☀"}); if(sun.sunset)g.push({min:mins(sun.sunset),ic:"☀"});
  if(mt.rise)g.push({min:mins(mt.rise),ic:"☽"}); if(mt.set)g.push({min:mins(mt.set),ic:"☽"});
  return g;
}
var lastModel=null;
function render(m){ lastModel=m; applyTheme(m.now.h);renderHeader(m);renderFooter(m);renderGraph(m);}
function cacheSave(m){try{localStorage.setItem("oceanTide",JSON.stringify(m));}catch(e){}}
function cacheLoad(){try{var s=localStorage.getItem("oceanTide");return s?JSON.parse(s):null;}catch(e){return null;}}
function refresh(){
  window.OceanData.load().then(function(m){render(m);if(!m.isMock)cacheSave(m);})
   .catch(function(e){console.log("[OceanTide]",e);var c=cacheLoad();if(c)render(c);});
}
var cached=cacheLoad(); if(cached){try{render(cached);}catch(e){}}
refresh();
// Full data refresh on the configured cadence (fetches in live mode).
setInterval(refresh,Math.max(5,C.refreshMinutes)*60*1000);
// Local re-tick every minute: move the now-marker + re-theme, NO network.
setInterval(function(){ if(lastModel){ try{ render(window.OceanData.retick(lastModel)); }catch(e){} } },60*1000);
})();
