// Separate Apps Script project. Set MAIL_SECRET in Script Properties.
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var envelope = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('MAIL_SECRET');
    if (!secret || typeof envelope.payload !== 'string') throw new Error('invalid');
    var digest = Utilities.computeHmacSha256Signature(envelope.payload, secret, Utilities.Charset.UTF_8).map(function(v){return ('0'+((v+256)%256).toString(16)).slice(-2);}).join('');
    if (digest !== envelope.signature) throw new Error('invalid');
    var data = JSON.parse(envelope.payload), time = Math.floor(Date.now()/1000);
    if (Math.abs(time-data.timestamp)>60 || !/^[a-f0-9]{64}$/.test(data.id) || !/^\d{6}$/.test(data.code) || typeof data.email !== 'string' || data.email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error('invalid');
    lock.waitLock(10000);
    var props=PropertiesService.getScriptProperties(), key='used_'+data.id;
    if(props.getProperty(key))throw new Error('replay');
    var all=props.getProperties();Object.keys(all).forEach(function(k){if(k.indexOf('used_')===0&&Number(all[k])<time-120)props.deleteProperty(k);});
    if(MailApp.getRemainingDailyQuota()<1)throw new Error('quota');
    props.setProperty(key,String(time));
    MailApp.sendEmail({to:data.email,subject:'캐릭터 스튜디오 로그인 인증번호',body:'인증번호: '+data.code+'\n\n5분 안에 수업 기기에 입력하세요. 인증번호를 다른 사람에게 알려주지 마세요. 요청하지 않았다면 이 메일을 무시하세요.'});
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false})).setMimeType(ContentService.MimeType.JSON);
  } finally { if(lock.hasLock())lock.releaseLock(); }
}
