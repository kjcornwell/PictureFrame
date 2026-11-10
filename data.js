// Ocean Tide data layer: NOAA CO-OPS + Open-Meteo, with a mock fallback.
(function(){
var C=window.CONFIG, NOAA="https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
function pad(n){return (n<10?"0":"")+n;}
function ymd(d){return ""+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate());}

// Current wall-clock in the station timezone (robust to the frame's own tz / no-RTC).
function nowInTz(){
  try{
    var f=new Intl.DateTimeFormat("en-US",{timeZone:C.tz,hour12:false,
      year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
    var p={}; f.formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;});
    var h=parseInt(p.hour,10)%24;
    return {h:h, m:parseInt(p.minute,10), min:h*60+parseInt(p.minute,10),
            y:+p.year, mo:+p.month, d:+p.day, dateKey:p.year+"-"+p.month+"-"+p.day};
  }catch(e){
    var n=new Date();return {h:n.getHours(),m:n.getMinutes(),min:n.getHours()*60+n.getMinutes(),
      y:n.getFullYear(),mo:n.getMonth()+1,d:n.getDate(),dateKey:ymd(n)};
  }
}
// Parse NOAA "YYYY-MM-DD HH:MM" -> {min:minutes since its midnight, dateKey}
function parseNoaa(t){
  var dk=t.slice(0,10), hh=parseInt(t.slice(11,13),10), mm=parseInt(t.slice(14,16),10);
  return {min:hh*60+mm, dateKey:dk, raw:t};
}
function degToCompass(d){
  var dirs=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(d/22.5)%16];
}
function getJSON(url){return fetch(url).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();});}

function noaaUrl(product,station,extra){
  var today=new Date();
  return NOAA+"?application=oceantide-frame&product="+product+"&station="+station+
    "&time_zone=lst_ldt&units=english&format=json"+(extra||"");
}

// days between two YYYY-MM-DD keys
function dayDiff(a,b){ return Math.round((Date.UTC(+a.slice(0,4),+a.slice(5,7)-1,+a.slice(8,10))
  - Date.UTC(+b.slice(0,4),+b.slice(5,7)-1,+b.slice(8,10)))/86400000); }
// Smooth curve over [startOff,endOff] (offsets = minutes since today 00:00, local),
// half-cosine interpolation between hi/lo events (each event carries .off).
function curveFromHilo(events, startOff, endOff){
  var pts=events.map(function(e){return {m:e.off, v:e.v};}).sort(function(a,b){return a.m-b.m;});
  if(pts.length<2) return [];
  var out=[];
  for(var off=startOff;off<=endOff;off+=20){
    var i=0; while(i<pts.length-1 && pts[i+1].m<off) i++;
    var a=pts[i], b=pts[Math.min(i+1,pts.length-1)];
    var v;
    if(off<=a.m) v=a.v; else if(off>=b.m) v=b.v;
    else { var f=(off-a.m)/(b.m-a.m); v=a.v+(b.v-a.v)*(1-Math.cos(f*Math.PI))/2; }
    out.push({off:off, v:v});
  }
  return out;
}
function buildLive(){
  var now=nowInTz();
  var todayKey=now.y+"-"+pad(now.mo)+"-"+pad(now.d);
  // start yesterday so the curve is anchored before 00:00; 4-day range covers today+tomorrow events
  var y=new Date(Date.UTC(now.y,now.mo-1,now.d)); y.setUTCDate(y.getUTCDate()-1);
  var begin=""+y.getUTCFullYear()+pad(y.getUTCMonth()+1)+pad(y.getUTCDate());
  var hiloU=NOAA+"?application=oceantide-frame&product=predictions&datum="+C.datum+
    "&station="+C.tideStation+"&time_zone=lst_ldt&units=english&format=json&interval=hilo&begin_date="+begin+"&range=96";
  var waterU=noaaUrl("water_temperature",C.waterTempStation,"&date=latest");
  var wxU="https://api.open-meteo.com/v1/forecast?latitude="+C.lat+"&longitude="+C.lon+
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure"+
    "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone="+encodeURIComponent(C.tz);
  return Promise.all([
    getJSON(hiloU),
    getJSON(waterU).catch(function(){return null;}),
    getJSON(wxU).catch(function(){return null;})
  ]).then(function(res){
    var hiloRaw=res[0] && res[0].predictions;
    if(!hiloRaw || !hiloRaw.length){ throw new Error("NOAA returned no predictions: "+JSON.stringify(res[0]).slice(0,160)); }
    var evs=hiloRaw.map(function(p){var pn=parseNoaa(p.t);
      return {type:p.type, v:parseFloat(p.v), off:dayDiff(pn.dateKey,todayKey)*1440+pn.min,
        dateKey:pn.dateKey, tmrw:pn.dateKey!==todayKey, time:fmtClock(pn.min)};})
      .filter(function(e){return isFinite(e.v);});
    var win=buildWindow(now, evs);
    if(!win.curve.length){ throw new Error("could not build curve from "+evs.length+" events"); }
    var upcoming=evs.filter(function(e){return e.off>=now.min;}).slice(0,4);
    var cur=interp(win.curve, now.min);
    var water=res[1]&&res[1].data&&res[1].data[0]&&isFinite(parseFloat(res[1].data[0].v))
      ? Math.round(parseFloat(res[1].data[0].v))+C.units.temp : "--";
    var wx=res[2]&&res[2].current?res[2].current:null;
    var windStr="--", pressStr="--", humStr="--", airStr="--";
    if(wx){
      windStr=degToCompass(wx.wind_direction_10m)+" "+Math.round(wx.wind_speed_10m);
      pressStr=(wx.surface_pressure*0.02953).toFixed(2)+" in";
      if(isFinite(wx.relative_humidity_2m)) humStr=Math.round(wx.relative_humidity_2m)+"%";
      if(isFinite(wx.temperature_2m)) airStr=Math.round(wx.temperature_2m)+C.units.temp;
    }
    return assemble(now, todayKey, win, upcoming, cur, water, airStr, windStr, pressStr, humStr, false);
  });
}
// 48h default window: 12h past + 36h future; render further future for scrolling (clamped to data).
function buildWindow(now, evs){
  var offs=evs.map(function(e){return e.off;});
  var minE=Math.min.apply(null,offs), maxE=Math.max.apply(null,offs);
  var startOff=Math.max(minE, now.min-720);         // 12h before now
  var endOff=Math.min(maxE, now.min+72*60);          // up to 3 days future (scrollable)
  if(endOff < now.min+48*60) endOff=Math.min(maxE, now.min+48*60);
  var marks=evs.filter(function(e){return e.off>=startOff && e.off<=endOff;});
  return {curve:curveFromHilo(evs,startOff,endOff), startOff:startOff, endOff:endOff, marks:marks};
}

function interp(curve, off){
  if(!curve.length) return {v:0, rising:true};
  var i=0; for(;i<curve.length-1;i++){ if(curve[i+1].off>=off) break; }
  var a=curve[i], b=curve[Math.min(i+1,curve.length-1)];
  var v=a.v, rising=(b.v>=a.v);
  if(b.off!==a.off){ var f=(off-a.off)/(b.off-a.off); v=a.v+(b.v-a.v)*f; rising=(b.v>a.v); }
  return {v:v, rising:rising};
}
function fmtClock(min){
  var h=Math.floor(min/60), m=min%60, ap=h>=12?"PM":"AM"; h=h%12; if(h===0)h=12;
  return h+":"+pad(m)+" "+ap;
}

function assemble(now, todayKey, win, events, cur, water, air, wind, press, hum, isMock){
  var dObj=new Date(now.y, now.mo-1, now.d, now.h, now.m);
  var sun=window.SunCalc.getTimes(dObj, C.lat, C.lon);
  var ill=window.SunCalc.getMoonIllumination(dObj);
  var mt=window.SunCalc.getMoonTimes(dObj, C.lat, C.lon);
  var nextEv=null, nextLbl="--";
  if(mt.rise&&mt.rise>dObj){nextEv=mt.rise;} if(mt.set&&mt.set>dObj&&(!nextEv||mt.set<nextEv)){nextEv=mt.set;}
  if(nextEv){nextLbl=minClock(nextEv);}
  return {
    stationName:C.stationName, now:now, dateLabel:fmtDate(dObj), todayKey:todayKey,
    curve:win.curve, startOff:win.startOff, endOff:win.endOff, marks:(win.marks||[]), events:events,
    current:{height:cur.v, rising:cur.rising},
    water:water, air:air, wind:wind, pressure:press, humidity:hum,
    sun:{rise:minClock(sun.sunrise), set:minClock(sun.sunset)},
    moon:{name:phaseName(ill.phase), illum:ill.fraction, phase:ill.phase, next:nextLbl},
    isMock:isMock
  };
}
// Format an instant in the STATION timezone (robust to a wrong device tz).
function minClock(d){
  try{
    var p={}; new Intl.DateTimeFormat("en-US",{timeZone:C.tz,hour:"numeric",minute:"2-digit",hour12:true})
      .formatToParts(d).forEach(function(x){p[x.type]=x.value;});
    return p.hour+":"+p.minute+" "+(p.dayPeriod||"").toLowerCase();
  }catch(e){ var h=d.getHours(),m=d.getMinutes(),ap=h>=12?"pm":"am";h=h%12;if(h===0)h=12;return h+":"+pad(m)+" "+ap; }
}
// Minutes-since-midnight of an instant, in the STATION timezone (for x-axis placement).
window.__tzMins=function(d){
  try{ var p={}; new Intl.DateTimeFormat("en-US",{timeZone:C.tz,hour:"2-digit",minute:"2-digit",hour12:false})
      .formatToParts(d).forEach(function(x){p[x.type]=x.value;}); return (parseInt(p.hour,10)%24)*60+parseInt(p.minute,10); }
  catch(e){ return d.getHours()*60+d.getMinutes(); }
};
function fmtDate(d){var mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return mo[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear();}
function phaseName(p){
  if(p<0.03||p>0.97)return "New Moon";
  if(p<0.22)return "Wax Cres"; if(p<0.28)return "First Qtr"; if(p<0.47)return "Wax Gib";
  if(p<0.53)return "Full Moon"; if(p<0.72)return "Wan Gib"; if(p<0.78)return "Last Qtr";
  return "Wan Cres";
}

// ---- mock: synthetic semidiurnal tides across several days ----
function buildMock(){
  var now=nowInTz();
  var todayKey=now.y+"-"+pad(now.mo)+"-"+pad(now.d);
  var evs=[], hi=true, start=now.min-1500; start=start-(((start%372)+372)%372);
  for(var off=start; off<=now.min+72*60+372; off+=372){
    var mod=(((off%1440)+1440)%1440);
    evs.push({type:hi?"H":"L", v:hi?4.6:0.3, off:off, dateKey:todayKey, tmrw:off>=1440, time:fmtClock(mod)});
    hi=!hi;
  }
  var win=buildWindow(now, evs);
  var upcoming=evs.filter(function(e){return e.off>=now.min;}).slice(0,4);
  var cur=interp(win.curve, now.min);
  return Promise.resolve(assemble(now, todayKey, win, upcoming, cur, "72"+C.units.temp, "68"+C.units.temp, "SSE 8", "30.11 in", "65%", true));
}

window.OceanData={
  // useMock => demo data. Live mode rejects on failure so the app can show last-good cache (not invented data).
  load:function(){ return C.useMock ? buildMock() : buildLive(); },
  // Lightweight re-tick: recompute "now" + current height from an existing model, no network.
  retick:function(m){ if(!m||!m.curve||!m.curve.length) return m;
    var now=nowInTz(); var cur=interp(m.curve, now.min);
    m.now=now; m.current={height:cur.v, rising:cur.rising}; return m; }
};
})();
