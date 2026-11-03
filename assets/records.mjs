/**
 * TinyTorque personal lap records. No server and no account.
 * Each visitor owns a browser-local book for this exact track layout.
 * Pure functions are shared by browser gameplay and Node regression tests.
 */
export const RECORDS_KEY = 'tinytorque-lap-records-v1';
export const DRIVER_KEY = 'tinytorque-driver-v1';
export const TRACK_ID = 'backyard-circuit-v0.3.1';
export const MAX_VALID_LAP = 240;
export const MIN_VALID_LAP = 8;

export const newRecordBook = () => ({
  version:1,
  trackId:TRACK_ID,
  bestByCar:[null,null,null,null],
  lapsRecorded:0
});
export function formatLap(seconds) {
  if(!Number.isFinite(seconds) || seconds<0) return '--:--.--';
  const hundredths=Math.floor(seconds*100+1e-7);
  const minutes=Math.floor(hundredths/6000);
  const secs=Math.floor((hundredths%6000)/100);
  return String(minutes).padStart(2,'0')+':'+String(secs).padStart(2,'0')+'.'+
    String(hundredths%100).padStart(2,'0');
}
export function sanitizeDriver(value) {
  if(typeof value!=='string')return 'Anonyme';
  const name=value.trim().replace(/[\r\n\t<>]/g,' ').replace(/\s+/g,' ').slice(0,24);
  return name || 'Anonyme';
}
export function validLapSeconds(seconds) {
  return typeof seconds==='number' && Number.isFinite(seconds) && seconds>=MIN_VALID_LAP && seconds<=MAX_VALID_LAP;
}
export function restoreRecordBook(raw) {
  const book=newRecordBook();
  if(!raw || typeof raw!=='object' || raw.version!==1 || raw.trackId!==TRACK_ID ||
    !Array.isArray(raw.bestByCar))return book;
  for(let i=0;i<4;i++) {
    const entry=raw.bestByCar[i];
    if(!entry || !validLapSeconds(entry.time) || entry.carId!==i)continue;
    book.bestByCar[i]={
      carId:i,
      time:entry.time,
      driver:sanitizeDriver(entry.driver),
      at:typeof entry.at==='string'?entry.at.slice(0,32):'',
      tune:entry.tune && typeof entry.tune==='object' ? JSON.parse(JSON.stringify(entry.tune)) : {}
    };
  }
  book.lapsRecorded=Number.isInteger(raw.lapsRecorded) ?
    Math.max(0,Math.min(10000000,raw.lapsRecorded)) : book.bestByCar.filter(Boolean).length;
  return book;
}
export function fastestRecord(book) {
  return book.bestByCar.filter(Boolean).sort((a,b)=>a.time-b.time)[0] ?? null;
}
export function submitLap(book, {carId,time,driver,at,tune}) {
  if(!Number.isInteger(carId) || carId<0 || carId>3 || !validLapSeconds(time)) {
    return {accepted:false,personalBest:false,overallBest:false};
  }
  const oldOverall=fastestRecord(book);
  const oldCar=book.bestByCar[carId];
  const personalBest=!oldCar || time<oldCar.time-0.00001;
  const overallBest=!oldOverall || time<oldOverall.time-0.00001;
  book.lapsRecorded++;
  if(personalBest) {
    book.bestByCar[carId]={
      carId,time,driver:sanitizeDriver(driver),
      at:typeof at==='string'?at.slice(0,32):'',
      tune:JSON.parse(JSON.stringify(tune || {}))
    };
  }
  return {accepted:true,personalBest,overallBest};
}
export function lapCrossing(car, elapsed) {
  // First pass of the finish line establishes the starting reference.
  // Starting grid cars sit past the line, so their opening partial lap
  // is deliberately excluded from the record leaderboard.
  const result={complete:false,valid:false,seconds:null};
  if(car.lapStartAt!==null) {
    result.complete=true;
    result.seconds=elapsed-car.lapStartAt;
    result.valid=!car.lapInvalid && validLapSeconds(result.seconds);
  }
  car.lapStartAt=elapsed;
  car.lapInvalid=false;
  return result;
}
