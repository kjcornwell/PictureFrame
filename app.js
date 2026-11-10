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
  $("airtemp").textContent=m.air||"--"; $("humidity").textContent=m.humidity||"--";
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
function interpV(curve,off){var i=0;for(;i<curve.length-1;i++){if(curve[i+1].off>=off)break;}
  var a=curve[i],b=curve[Math.min(i+1,curve.length-1)];if(b.off===a.off)return a.v;
  return a.v+(b.v-a.v)*((off-a.off)/(b.off-a.off));}
function triPath(x,y,type){var d=7;return type==="H"
  ?"M"+(x-d)+","+(y+d)+" L"+(x+d)+","+(y+d)+" L"+x+","+(y-d)+" Z"
  :"M"+(x-d)+","+(y-d)+" L"+(x+d)+","+(y-d)+" L"+x+","+(y+d)+" Z";}

var PADT=30, PADB=46;  // graph top/bottom padding (px)
function yRange(m){
  var vs=m.curve.map(function(p){return p.v;}).concat((m.marks||[]).map(function(e){return e.v;}));
  var maxV=Math.max.apply(null,vs), minV=Math.min.apply(null,vs);
  var yMax=Math.ceil((maxV+0.4)/2)*2; if(yMax<2)yMax=2;
  var yMin=(minV<-0.1)?Math.floor((minV-0.2)/2)*2:0;
  return {yMax:yMax,yMin:yMin};
}
function yFn(yr,H){return function(v){return PADT+(yr.yMax-v)/(yr.yMax-yr.yMin)*(H-PADT-PADB);};}
function dayAbbrev(m,dayOff){var names=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return names[new Date(m.now.y,m.now.mo-1,m.now.d+dayOff).getDay()];}
function hourLbl(off){var mod=(((off%1440)+1440)%1440),h=Math.floor(mod/60);
  return h===0?"":(h<12?(h+"a"):h===12?"12p":((h-12)+"p"));}

function renderYAxis(m,H){
  var ya=$("yaxis"); clear(ya); var yr=yRange(m), Y=yFn(yr,H);
  ya.setAttribute("viewBox","0 0 52 "+H);
  for(var t=yr.yMin;t<=yr.yMax;t+=2){
    ya.appendChild(svg("text",{x:46,y:(Y(t)+7).toFixed(1),"text-anchor":"end"}, t===yr.yMax?(t+" ft"):(""+t)));
  }
  ya.appendChild(svg("line",{class:"axis",x1:51,y1:PADT,x2:51,y2:Y(yr.yMin).toFixed(1)}));
}
function renderGraph(m){
  var scroll=$("graph-scroll"), g=$("graph");
  var first=!g.getAttribute("data-drawn"), prev=scroll.scrollLeft;
  var vw=scroll.clientWidth||1176, H=scroll.clientHeight||420, VIEW=48*60;
  var yr=yRange(m), Y=yFn(yr,H), yMin=yr.yMin, yMax=yr.yMax;
  var pxPerMin=vw/VIEW, totalMin=m.endOff-m.startOff;
  var svgW=Math.max(vw, totalMin*pxPerMin);
  function X(off){return (off-m.startOff)*pxPerMin;}
  g.setAttribute("viewBox","0 0 "+svgW.toFixed(0)+" "+H); g.style.width=svgW.toFixed(0)+"px";
  clear(g); var add=function(n){g.appendChild(n);};
  var bot=Y(yMin);
  // horizontal gridlines (under the fill)
  for(var t=yMin;t<=yMax;t+=2){ var y=Y(t);
    add(svg("line",{class:t===0?"axis":"grid",x1:0,y1:y.toFixed(1),x2:svgW.toFixed(0),y2:y.toFixed(1)})); }
  // area + predicted curve
  var pts=m.curve.map(function(p){return X(p.off).toFixed(1)+","+Y(p.v).toFixed(1);});
  var base=Y(Math.max(0,yMin)).toFixed(1);
  add(svg("path",{class:"area",d:"M"+X(m.curve[0].off).toFixed(1)+","+base+" L"+pts.join(" L")+" L"+X(m.curve[m.curve.length-1].off).toFixed(1)+","+base+" Z"}));
  add(svg("path",{class:"curve",d:"M"+pts.join(" L")}));
  // elapsed (maroon) up to now
  var nowOff=m.now.min, curNow=interpV(m.curve,nowOff);
  var past=m.curve.filter(function(p){return p.off<=nowOff;}).map(function(p){return X(p.off).toFixed(1)+","+Y(p.v).toFixed(1);});
  past.push(X(nowOff).toFixed(1)+","+Y(curNow).toFixed(1));
  if(past.length>1)add(svg("path",{class:"past",d:"M"+past.join(" L")}));
  // vertical 6h grid + day separators — drawn ON TOP of the fill, full plot height
  for(var vmin=Math.ceil(m.startOff/360)*360; vmin<=m.endOff; vmin+=360){
    var mid=(((vmin%1440)+1440)%1440)===0;
    add(svg("line",{class:mid?"daysep":"gridv",x1:X(vmin).toFixed(1),y1:PADT,x2:X(vmin).toFixed(1),y2:bot.toFixed(1)}));
    add(svg("text",{x:X(vmin).toFixed(1),y:(H-12),"text-anchor":"middle"}, mid?dayAbbrev(m,Math.round(vmin/1440)):hourLbl(vmin)));
  }
  // hi/lo markers across the window
  (m.marks||[]).forEach(function(e){ add(svg("path",{class:"evmark",d:triPath(X(e.off),Y(e.v)-16,e.type)})); });
  // sun/moon glyphs
  axisGlyphs(m).forEach(function(gl){ if(gl.off>=m.startOff&&gl.off<=m.endOff)
    add(svg("text",{class:"axlabel",x:X(gl.off).toFixed(1),y:(H-36),"text-anchor":"middle","font-size":"30"},gl.ic)); });
  // now line + dot + current-time bubble at the top
  var nx=X(nowOff);
  add(svg("line",{class:"nowline",x1:nx.toFixed(1),y1:26,x2:nx.toFixed(1),y2:bot.toFixed(1)}));
  add(svg("circle",{class:"nowdot",cx:nx.toFixed(1),cy:Y(curNow).toFixed(1),r:11}));
  var lbl=nowTimeLabel(), bw=Math.max(70, lbl.length*12+24), bh=28;
  add(svg("rect",{class:"nowbubble",x:(nx-bw/2).toFixed(1),y:1,width:bw.toFixed(0),height:bh,rx:14,ry:14}));
  add(svg("text",{class:"nowbubtext",x:nx.toFixed(1),y:20,"text-anchor":"middle"},lbl));
  g.setAttribute("data-drawn","1");
  renderYAxis(m,H);
  scroll.scrollLeft = first ? 0 : prev;   // first render shows now-12h..now+36h; keep user scroll after
}
function axisGlyphs(m){
  var out=[], dStart=Math.floor(m.startOff/1440), dEnd=Math.ceil(m.endOff/1440);
  function tzmin(d){return window.__tzMins?window.__tzMins(d):(d.getHours()*60+d.getMinutes());}
  for(var dd=dStart; dd<=dEnd; dd++){
    var dObj=new Date(m.now.y,m.now.mo-1,m.now.d+dd);
    var sun=window.SunCalc.getTimes(dObj,C.lat,C.lon), mt=window.SunCalc.getMoonTimes(dObj,C.lat,C.lon);
    if(sun.sunrise)out.push({off:dd*1440+tzmin(sun.sunrise),ic:"☀"});
    if(sun.sunset)out.push({off:dd*1440+tzmin(sun.sunset),ic:"☀"});
    if(mt.rise)out.push({off:dd*1440+tzmin(mt.rise),ic:"☽"});
    if(mt.set)out.push({off:dd*1440+tzmin(mt.set),ic:"☽"});
  }
  return out;
}
function nowTimeLabel(){
  try{ var p={}; new Intl.DateTimeFormat("en-US",{timeZone:C.tz,hour:"numeric",minute:"2-digit",hour12:true})
      .formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;});
    return p.hour+":"+p.minute+" "+(p.dayPeriod||""); }catch(e){ return ""; }
}
function startClock(){
  function tick(){ var t=nowTimeLabel(); if(t) $("clock").textContent=t; }
  tick(); setInterval(tick,1000);
}
var lastModel=null;
function render(m){ lastModel=m; applyTheme(m.now.h);renderHeader(m);renderFooter(m);renderGraph(m);}
function cacheSave(m){try{localStorage.setItem("oceanTide",JSON.stringify(m));}catch(e){}}
function cacheLoad(){try{var s=localStorage.getItem("oceanTide");return s?JSON.parse(s):null;}catch(e){return null;}}
function refresh(){
  window.OceanData.load().then(function(m){render(m);if(!m.isMock)cacheSave(m);})
   .catch(function(e){console.log("[OceanTide]",e);var c=cacheLoad();if(c)render(c);});
}
startClock();
var cached=cacheLoad(); if(cached){try{render(cached);}catch(e){}}
refresh();
// Full data refresh on the configured cadence (fetches in live mode).
setInterval(refresh,Math.max(5,C.refreshMinutes)*60*1000);
// Local re-tick every minute: move the now-marker + re-theme, NO network.
setInterval(function(){ if(lastModel){ try{ render(window.OceanData.retick(lastModel)); }catch(e){} } },60*1000);
})();
