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
    li.appendChild(el("span",{class:"eht"},((Math.round(e.v*10)/10)||0).toFixed(1)+C.units.tide));
    li.appendChild(el("span",{class:"etime"},e.time));
    if(e.tmrw)li.appendChild(el("span",{class:"etmrw"},"tmrw"));
    ul.appendChild(li);
  });
}
function renderFooter(m){
  $("sunrise").textContent=m.sun.rise; $("sunset").textContent=m.sun.set;
  $("moon-name").textContent=m.moon.name;
  $("moonrise").textContent=m.moon.rise||"--"; $("moonset").textContent=m.moon.set||"--";
  $("moon-pct").textContent=isFinite(m.moon.illum)?(Math.round(m.moon.illum*100)+"% lit"):"";
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
// Fit the y-axis to the predicted range (like NOAA's chart) on a "nice" tick step, so heights can be read off.
function yRange(m,H){
  var vs=m.curve.map(function(p){return p.v;}).concat((m.marks||[]).map(function(e){return e.v;}));
  var maxV=Math.max.apply(null,vs), minV=Math.min(0,Math.min.apply(null,vs));
  var steps=[0.25,0.5,1,2,5,10], step=steps[steps.length-1];
  for(var i=0;i<steps.length;i++){ if((maxV-minV)/steps[i]<=6){step=steps[i];break;} }
  var yMin=Math.floor(minV/step+1e-9)*step, yMax=Math.ceil(maxV/step-1e-9)*step;
  if(yMax<=yMin) yMax=yMin+step;
  // headroom so the high-tide marker + badge clear the top of the plot
  var plotH=Math.max(1,(H||420)-PADT-PADB);
  while((yMax-maxV)/(yMax-yMin)*plotH<58) yMax+=step;
  return {yMax:yMax,yMin:yMin,step:step,n:Math.round((yMax-yMin)/step)};
}
function tickLabel(t){ var r=Math.round(t*100)/100; return ""+(r===0?0:r); }
function fmtFt(v){ var r=Math.round(v*100)/100; return (r===0?0:r).toFixed(2); }
function yFn(yr,H){return function(v){return PADT+(yr.yMax-v)/(yr.yMax-yr.yMin)*(H-PADT-PADB);};}
function dayLabel(m,dayOff){var names=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var d=new Date(m.now.y,m.now.mo-1,m.now.d+dayOff);
  function p2(n){return (n<10?"0":"")+n;}
  return {day:names[d.getDay()], date:p2(d.getMonth()+1)+"/"+p2(d.getDate())};}
function hourLbl(off){var mod=(((off%1440)+1440)%1440),h=Math.floor(mod/60);
  return h===0?"":(h<12?(h+"a"):h===12?"12p":((h-12)+"p"));}

function renderYAxis(m,H){
  var ya=$("yaxis"); clear(ya); var yr=yRange(m,H), Y=yFn(yr,H);
  ya.setAttribute("viewBox","0 0 52 "+H);
  for(var i=0;i<=yr.n;i++){ var t=yr.yMin+i*yr.step;
    ya.appendChild(svg("text",{class:"ytick",x:46,y:(Y(t)+6).toFixed(1),"text-anchor":"end"}, tickLabel(t)));
  }
  ya.appendChild(svg("text",{class:"yunit",x:46,y:PADT-12,"text-anchor":"end"}, C.units.tide));
  ya.appendChild(svg("line",{class:"axis",x1:51,y1:PADT,x2:51,y2:Y(yr.yMin).toFixed(1)}));
}
function renderGraph(m){
  var scroll=$("graph-scroll"), g=$("graph");
  var first=!g.getAttribute("data-drawn"), prev=scroll.scrollLeft;
  var vw=scroll.clientWidth||1176, H=scroll.clientHeight||420, VIEW=48*60;
  var yr=yRange(m,H), Y=yFn(yr,H), yMin=yr.yMin, yMax=yr.yMax;
  var pxPerMin=vw/VIEW, totalMin=m.endOff-m.startOff;
  var svgW=Math.max(vw, totalMin*pxPerMin);
  function X(off){return (off-m.startOff)*pxPerMin;}
  g.setAttribute("viewBox","0 0 "+svgW.toFixed(0)+" "+H); g.style.width=svgW.toFixed(0)+"px";
  clear(g); var add=function(n){g.appendChild(n);};
  var bot=Y(yMin);
  // horizontal gridlines (under the fill)
  for(var gi=0;gi<=yr.n;gi++){ var t=yMin+gi*yr.step, y=Y(t);
    add(svg("line",{class:Math.abs(t)<1e-9?"axis":"grid",x1:0,y1:y.toFixed(1),x2:svgW.toFixed(0),y2:y.toFixed(1)})); }
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
  // vertical 6h grid + day separators (on top of fill, full height). Only noon/midnight get axis
  // text, leaving room for the sunrise/sunset time labels that sit near 6a/6p.
  for(var vmin=Math.ceil(m.startOff/360)*360; vmin<=m.endOff; vmin+=360){
    var mod=(((vmin%1440)+1440)%1440), mid=mod===0;
    add(svg("line",{class:mid?"daysep":"gridv",x1:X(vmin).toFixed(1),y1:PADT,x2:X(vmin).toFixed(1),y2:bot.toFixed(1)}));
    if(mid){ var dl=dayLabel(m,Math.round(vmin/1440));   // weekday below the axis, mm/dd date above the chart
      add(svg("text",{x:X(vmin).toFixed(1),y:(H-12),"text-anchor":"middle"}, dl.day));
      add(svg("text",{class:"daydate",x:X(vmin).toFixed(1),y:21,"text-anchor":"middle"}, dl.date));
    } else if(mod===720){ add(svg("text",{x:X(vmin).toFixed(1),y:(H-12),"text-anchor":"middle"}, "12p")); }
  }
  // hi/lo markers + subtle time/height badges
  (m.marks||[]).forEach(function(e){
    var mx=X(e.off), my=Y(e.v);
    add(svg("path",{class:"evmark",d:triPath(mx,my-16,e.type)}));
    if(Math.abs(e.off-nowOff) < 24) return;   // skip right at "now" (the time bubble covers it)
    var tc=e.time.replace(/ ?AM/i,"a").replace(/ ?PM/i,"p")+" · "+fmtFt(e.v)+" "+C.units.tide;
    var by=(e.type==="H"||my+30>bot-14)?Math.max(my-42,44):my+30;
    var bw=tc.length*7.8+16, nowX=X(nowOff), cbx=mx;
    if(Math.abs(cbx-nowX)<bw/2+12) cbx=nowX+(mx<nowX?-1:1)*(bw/2+12);   // slide clear of the now line
    cbx=Math.max(bw/2+2, Math.min(cbx, svgW-bw/2-2));  // keep badge in view
    add(svg("rect",{class:"tidebadge",x:(cbx-bw/2).toFixed(1),y:(by-11).toFixed(1),width:bw.toFixed(0),height:22,rx:11,ry:11}));
    add(svg("text",{class:"tidebadgetext",x:cbx.toFixed(1),y:(by+5).toFixed(1),"text-anchor":"middle"},tc));
  });
  // sun/moon glyphs (sunrise/sunset get a time label)
  axisGlyphs(m).forEach(function(gl){ if(gl.off>=m.startOff&&gl.off<=m.endOff){
    var gx=X(gl.off);
    add(svg("text",{class:"axlabel",x:gx.toFixed(1),y:(H-34),"text-anchor":"middle","font-size":"26"},gl.ic));
    if(gl.t) add(svg("text",{class:"suntime",x:gx.toFixed(1),y:(H-13),"text-anchor":"middle"},gl.t));
  }});
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
    if(sun.sunrise)out.push({off:dd*1440+tzmin(sun.sunrise),ic:"☀",t:compactClock(sun.sunrise)});
    if(sun.sunset)out.push({off:dd*1440+tzmin(sun.sunset),ic:"☀",t:compactClock(sun.sunset)});
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
function clockLabel(){
  try{ var p={}; new Intl.DateTimeFormat("en-US",{timeZone:C.tz,hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true})
      .formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;});
    return p.hour+":"+p.minute+":"+p.second+" "+(p.dayPeriod||""); }catch(e){ return ""; }
}
function compactClock(d){
  try{ var p={}; new Intl.DateTimeFormat("en-US",{timeZone:C.tz,hour:"numeric",minute:"2-digit",hour12:true})
      .formatToParts(d).forEach(function(x){p[x.type]=x.value;});
    return p.hour+":"+p.minute+((p.dayPeriod||"").toLowerCase()==="am"?"a":"p"); }catch(e){ return ""; }
}
// Clock ticks on the second boundary; the instant the minute rolls over, the chart's now-line,
// time bubble and current height are re-ticked so they never lag the clock.
function startClock(){
  var lastMin=null;
  function tick(){
    var t=clockLabel(); if(t) $("clock").textContent=t;
    var mk=nowTimeLabel();
    if(lastMin!==null && mk!==lastMin && lastModel){ try{ render(window.OceanData.retick(lastModel)); }catch(e){ console.log("[OceanTide] retick",e); } }
    lastMin=mk;
    setTimeout(tick, 1000-(Date.now()%1000)+5);
  }
  tick();
}
var lastModel=null;
function render(m){ lastModel=m; applyTheme(m.now.h);renderHeader(m);renderFooter(m);renderGraph(m);}
function cacheSave(m){try{localStorage.setItem("oceanTide",JSON.stringify(m));}catch(e){}}
function cacheLoad(){try{var s=localStorage.getItem("oceanTide");return s?JSON.parse(s):null;}catch(e){return null;}}
function refresh(){
  window.OceanData.load().then(function(m){render(m);if(!m.isMock)cacheSave(m);})
   .catch(function(e){console.log("[OceanTide]",e);var c=cacheLoad();if(c)render(c);});
}
// "Reset" button: appears once the chart is dragged away from now, jumps back on tap.
function initChartReset(){
  var scroll=$("graph-scroll"), btn=$("chart-reset"); if(!scroll||!btn) return;
  function sync(){ btn.hidden = scroll.scrollLeft < 12; }
  scroll.addEventListener("scroll", sync);
  btn.addEventListener("click", function(){ scroll.scrollLeft=0; sync(); });
  sync();
}
startClock(); initChartReset();
var cached=cacheLoad(); if(cached){try{render(cached);}catch(e){}}
refresh();
// Full data refresh on the configured cadence (fetches in live mode).
setInterval(refresh,Math.max(5,C.refreshMinutes)*60*1000);
})();
