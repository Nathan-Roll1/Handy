const {chromium}=require('playwright');
const crypto=require('node:crypto');
const fs=require('node:fs');
(async()=>{
  const context=await chromium.launchPersistentContext('/tmp/fourier-chromium',{headless:true,viewport:{width:1040,height:920},args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page=await context.newPage();
    const cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable');
    cdp.on('Network.loadingFailed', e=>console.log('NET_ERROR',e.errorText,e.blockedReason,e.corsErrorStatus?.corsError));
    context.on('response',r=>{if(r.status()>=400)console.log('BAD_HTTP',r.status(),new URL(r.url()).hostname);});
    page.on('console',m=>{if(!m.text().includes('data:'))console.log('PAGE',m.text().slice(0,450));});
    page.on('pageerror',e=>console.log('ERROR',e.message));
    page.on('requestfailed',r=>console.log('NET_FAIL',new URL(r.url()).hostname,r.failure()?.errorText));
    context.on('request',r=>{const u=new URL(r.url()); if(u.host==='huggingface.co'&&u.pathname.includes('Fourier-2B-Q8_0.gguf'))console.log('MODEL_REQUEST',r.method(),u.pathname);});
    await page.goto(process.env.DEMO_URL||'http://127.0.0.1:8144');
    console.log('PLATFORM',await context.browser().version(),await page.evaluate(()=>[crossOriginIsolated,typeof SharedArrayBuffer]));
    const before=await page.evaluate(()=>navigator.storage.estimate());console.log('STORAGE',before);
    await page.locator('#load').click();
    let last='';const timer=setInterval(async()=>{try{const v=await page.locator('#status').innerText();if(v!==last){console.log('STATE',v);last=v;}}catch{}},2000);timer.unref();
    try {
      await page.waitForFunction(()=>!document.querySelector('#run').disabled||(!document.querySelector('#load').disabled&&document.querySelector('#status').innerText),{},{timeout:420000});
      if(await page.locator('#run').isDisabled())throw new Error(await page.locator('#status').innerText());
      async function run(label,expected){const s=Date.now();await page.locator('#run').click();await page.waitForFunction(()=>!document.querySelector('#run').disabled||!document.querySelector('#load').disabled,{},{timeout:600000});if(await page.locator('#result').isHidden())throw new Error(await page.locator('#status').innerText());const raw=await page.locator('#text').innerText();console.log('TRANSCRIPT',JSON.stringify({label,text:raw,seconds:(Date.now()-s)/1000}));if(!expected.test(raw))throw new Error('Unexpected '+label+' transcript');}
      await run('jfk',/ask not what your country can do for you[\s\S]+ask what you can do for your country/i);
      await page.locator('#audio').setInputFiles('/tmp/fleurs-en.wav');
      await context.setOffline(true);await run('fleurs-offline',/communication channels.*styles.*(years?|30)/i);
      console.log('LOCAL_AUDIO_COMPLETE');
      if(process.env.DEMO_URL){await context.setOffline(false);await page.reload(); await context.route('https://huggingface.co/**/Fourier-2B-Q8_0.gguf*',r=>r.abort());await page.locator('#load').click();await page.waitForFunction(()=>!document.querySelector('#run').disabled||!document.querySelector('#load').disabled,{},{timeout:180000});if(await page.locator('#run').isDisabled())throw new Error('Cached reload: '+await page.locator('#status').innerText());console.log('PERSISTENT_CACHE_REUSED');}
      await page.screenshot({path:'/tmp/demo.png'});
    } finally {clearInterval(timer);}
  } finally {await context.close();}
})().catch(e=>{console.error('TEST_FAILED',e);process.exit(1)});
