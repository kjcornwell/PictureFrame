// SunCalc (Vladimir Agafonkin, BSD-2) — trimmed to sun times, moon illumination, moon times.
(function(){
var PI=Math.PI, rad=PI/180, dayMs=864e5, J1970=2440588, J2000=2451545;
function toJulian(d){return d.valueOf()/dayMs-0.5+J1970;}
function fromJulian(j){return new Date((j+0.5-J1970)*dayMs);}
function toDays(d){return toJulian(d)-J2000;}
var e=rad*23.4397;
function rightAscension(l,b){return Math.atan2(Math.sin(l)*Math.cos(e)-Math.tan(b)*Math.sin(e),Math.cos(l));}
function declination(l,b){return Math.asin(Math.sin(b)*Math.cos(e)+Math.cos(b)*Math.sin(e)*Math.sin(l));}
function azimuth(H,phi,dec){return Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi));}
function altitude(H,phi,dec){return Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H));}
function siderealTime(d,lw){return rad*(280.16+360.9856235*d)-lw;}
function solarMeanAnomaly(d){return rad*(357.5291+0.98560028*d);}
function eclipticLongitude(M){var C=rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M)),P=rad*102.9372;return M+C+P+PI;}
function sunCoords(d){var M=solarMeanAnomaly(d),L=eclipticLongitude(M);return{dec:declination(L,0),ra:rightAscension(L,0)};}
var J0=0.0009;
function julianCycle(d,lw){return Math.round(d-J0-lw/(2*PI));}
function approxTransit(Ht,lw,n){return J0+(Ht+lw)/(2*PI)+n;}
function solarTransitJ(ds,M,L){return J2000+ds+0.0053*Math.sin(M)-0.0069*Math.sin(2*L);}
function hourAngle(h,phi,d){return Math.acos((Math.sin(h)-Math.sin(phi)*Math.sin(d))/(Math.cos(phi)*Math.cos(d)));}
function getSetJ(h,lw,phi,dec,n,M,L){var w=hourAngle(h,phi,dec),a=approxTransit(w,lw,n);return solarTransitJ(a,M,L);}
var SC={};
SC.getTimes=function(date,lat,lng){
  var lw=rad*-lng,phi=rad*lat,d=toDays(date),n=julianCycle(d,lw),ds=approxTransit(0,lw,n),
  M=solarMeanAnomaly(ds),L=eclipticLongitude(M),dec=declination(L,0),
  Jnoon=solarTransitJ(ds,M,L),Jrise,Jset,h0=-0.833*rad,Jset2=getSetJ(h0,lw,phi,dec,n,M,L);
  Jrise=Jnoon-(Jset2-Jnoon);
  return{sunrise:fromJulian(Jrise),sunset:fromJulian(Jset2),solarNoon:fromJulian(Jnoon)};
};
function moonCoords(d){
  var L=rad*(218.316+13.176396*d),M=rad*(134.963+13.064993*d),F=rad*(93.272+13.229350*d),
  l=L+rad*6.289*Math.sin(M),b=rad*5.128*Math.sin(F),dt=385001-20905*Math.cos(M);
  return{ra:rightAscension(l,b),dec:declination(l,b),dist:dt};
}
SC.getMoonIllumination=function(date){
  var d=toDays(date||new Date()),s=sunCoords(d),m=moonCoords(d),sdist=149598000,
  phi=Math.acos(Math.sin(s.dec)*Math.sin(m.dec)+Math.cos(s.dec)*Math.cos(m.dec)*Math.cos(s.ra-m.ra)),
  inc=Math.atan2(sdist*Math.sin(phi),m.dist-sdist*Math.cos(phi)),
  angle=Math.atan2(Math.cos(s.dec)*Math.sin(s.ra-m.ra),Math.sin(s.dec)*Math.cos(m.dec)-Math.cos(s.dec)*Math.sin(m.dec)*Math.cos(s.ra-m.ra));
  return{fraction:(1+Math.cos(inc))/2,phase:0.5+0.5*inc*(angle<0?-1:1)/Math.PI,angle:angle};
};
function astroRefraction(h){if(h<0)h=0;return 0.0002967/Math.tan(h+0.00312536/(h+0.08901179));}
function moonPosition(d,lat,lng){
  var lw=rad*-lng,phi=rad*lat,dd=toDays(d),c=moonCoords(dd),H=siderealTime(dd,lw)-c.ra,h=altitude(H,phi,c.dec);
  h=h+astroRefraction(h);return{altitude:h};
}
SC.getMoonTimes=function(date,lat,lng){
  var t=new Date(date);t.setHours(0,0,0,0);
  var hc=0.133*rad,h0=moonPosition(t,lat,lng).altitude-hc,rise,set,ye,d,roots,x1,x2,xe,h1,h2,a,b,d2;
  for(var i=1;i<=24;i+=2){
    h1=moonPosition(hoursLater(t,i),lat,lng).altitude-hc;
    h2=moonPosition(hoursLater(t,i+1),lat,lng).altitude-hc;
    a=(h0+h2)/2-h1;b=(h2-h0)/2;xe=-b/(2*a);ye=(a*xe+b)*xe+h1;d2=b*b-4*a*h1;roots=0;
    if(d2>=0){var dx=Math.sqrt(d2)/(Math.abs(a)*2);x1=xe-dx;x2=xe+dx;if(Math.abs(x1)<=1)roots++;if(Math.abs(x2)<=1)roots++;if(x1<-1)x1=x2;}
    if(roots===1){if(h0<0)rise=i+x1;else set=i+x1;}
    else if(roots===2){rise=i+(ye<0?x2:x1);set=i+(ye<0?x1:x2);}
    if(rise&&set)break;h0=h2;
  }
  var r={};if(rise)r.rise=hoursLater(t,rise);if(set)r.set=hoursLater(t,set);
  if(!rise&&!set)r[ye>0?'alwaysUp':'alwaysDown']=true;return r;
};
function hoursLater(date,h){return new Date(date.valueOf()+h*dayMs/24);}
window.SunCalc=SC;
})();
