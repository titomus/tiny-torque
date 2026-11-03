import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRACK_ID,newRecordBook,restoreRecordBook,formatLap,sanitizeDriver,
  submitLap,fastestRecord,lapCrossing
} from '../assets/records.mjs';

test('records are track-specific and empty on first visit',()=>{
  assert.equal(newRecordBook().trackId,TRACK_ID);
  assert.equal(fastestRecord(newRecordBook()),null);
  assert.equal(restoreRecordBook({trackId:'different',version:1,bestByCar:[{}]}).lapsRecorded,0);
});

test('the first finish-line crossing is a start, not an unfair short lap',()=>{
  const car={lapStartAt:null,lapInvalid:false};
  assert.deepEqual(lapCrossing(car,29),{complete:false,valid:false,seconds:null});
  assert.deepEqual(lapCrossing(car,61.7),{complete:true,valid:true,seconds:32.7});
});

test('a rescue or setup change invalidates the affected lap only',()=>{
  const car={lapStartAt:15,lapInvalid:true};
  const rejected=lapCrossing(car,42);
  assert.equal(rejected.complete,true);
  assert.equal(rejected.valid,false);
  assert.equal(car.lapInvalid,false);
  assert.equal(lapCrossing(car,74).valid,true);
});

test('best lap is personal to each chassis, with a single local overall leader',()=>{
  const b=newRecordBook();
  assert.equal(submitLap(b,{carId:0,time:35,driver:'A',tune:{power:100}}).overallBest,true);
  assert.equal(submitLap(b,{carId:1,time:33,driver:'B',tune:{power:90}}).overallBest,true);
  assert.equal(submitLap(b,{carId:0,time:37,driver:'A',tune:{power:180}}).personalBest,false);
  assert.equal(submitLap(b,{carId:0,time:30.5,driver:'A',tune:{power:110}}).overallBest,true);
  assert.equal(b.lapsRecorded,4);
  assert.equal(fastestRecord(b).carId,0);
  assert.equal(b.bestByCar[0].tune.power,110);
});

test('bad and implausible times cannot enter the record book',()=>{
  const book=newRecordBook();
  for(const time of [NaN,Infinity,-5,1,7.99,240.01]) {
    assert.equal(submitLap(book,{carId:1,time,driver:'a'}).accepted,false);
  }
  assert.equal(book.lapsRecorded,0);
});

test('browser records can be saved, restored and safely displayed',()=>{
  const b=newRecordBook();
  submitLap(b,{carId:3,time:69.278,driver:'  <ME>  ',at:'2026-11-03',tune:{drivetrain:'rwd'}});
  const restored=restoreRecordBook(JSON.parse(JSON.stringify(b)));
  assert.equal(restored.bestByCar[3].driver,'ME');
  assert.equal(formatLap(restored.bestByCar[3].time),'01:09.27');
  assert.equal(formatLap(null),'--:--.--');
  assert.equal(sanitizeDriver(''),'Anonyme');
});

test('records are versioned, and invalid imported data is discarded',()=>{
  const b=restoreRecordBook({version:1,trackId:TRACK_ID,lapsRecorded:-2,
    bestByCar:[{carId:0,time:0},{carId:1,time:32,driver:'X'},null,null]});
  assert.equal(b.bestByCar[0],null);
  assert.equal(b.bestByCar[1].time,32);
  assert.equal(b.lapsRecorded,0);
});

test('a shared challenge is visible in the URL without writing a global record',async()=>{
  const {buildChallengeLink,readChallenge}=await import('../assets/records.mjs');
  const entry={time:31.478,carId:2,driver:'Mécano RC'};
  const url=buildChallengeLink(entry,'https://titomus.github.io/tiny-torque/?old=true#foo');
  const parsed=new URL(url);
  assert.equal(parsed.origin,'https://titomus.github.io');
  assert.equal(parsed.pathname,'/tiny-torque/');
  assert.equal(parsed.hash,'');
  assert.equal(parsed.searchParams.get('old'),null);
  assert.deepEqual(readChallenge(parsed.search),{time:31.478,carId:2,driver:'Mécano RC'});
  assert.equal(readChallenge('?tt_time=1&tt_car=2'),null);
  assert.equal(readChallenge('?tt_time=36&tt_car=999'),null);
  assert.equal(readChallenge('?tt_time=Infinity&tt_car=1'),null);
});

