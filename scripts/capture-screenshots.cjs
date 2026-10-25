const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async()=>{
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage','--allow-file-access-from-files']
  });
  const page = await browser.newPage({viewport:{width:1400,height:940},deviceScaleFactor:2});
  await page.goto('file://' + path.join(process.cwd(), 'index.html') + '#home', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.view[data-screen="home"]');
  const screens = [
    ['01-home','Home','home'],
    ['02-plan','Plan an event','plan'],
    ['03-bundle','Recommended bundle','bundle'],
    ['04-market','Marketplace','market'],
    ['05-item','Item details','item'],
    ['06-coverage','Coverage','coverage'],
    ['07-checkout','Checkout','checkout'],
    ['08-booked','Booking confirmation','booked'],
    ['09-return','Return and rate','ret'],
    ['10-earnings','Lender earnings','earnings'],
    ['11-request','Lender request','request'],
    ['12-list','List an item','list']
  ];
  const choose = async (name) => {
    const nav = page.locator('.panel .flow [data-act="jump"][data-v="'+name+'"]');
    await nav.click();
    await page.waitForSelector('.view[data-screen="'+name+'"]', {timeout:10000});
    await page.waitForTimeout(220);
  };
  await fs.promises.mkdir('screenshots/phone',{recursive:true});
  await fs.promises.mkdir('screenshots/full',{recursive:true});
  const failures = [];
  // Build an actual selected bundle before collecting journey screenshots.
  await choose('plan');
  await page.locator('.view[data-screen="plan"] [data-act="occasion"][data-v="dinner"]').click();
  await page.locator('.view[data-screen="plan"] [data-act="makebundle"]').click();
  await page.waitForSelector('.view[data-screen="bundle"]');
  for (const [slug,label,route] of screens) {
    await choose(route);
    // Give loaded images time to decode; failures are logged rather than blocking screenshots.
    await page.locator('.view img.listing-photo').evaluateAll(async images => {
      await Promise.all(images.map(img => {
        if(img.complete) return Promise.resolve();
        return Promise.race([new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})}),new Promise(resolve=>setTimeout(resolve,4500))]);
      }));
    });
    await page.waitForTimeout(180);
    const errors = await page.locator('.view img.listing-photo').evaluateAll(imgs=>imgs.filter(x=>x.complete && x.naturalWidth===0).map(x=>x.src));
    if(errors.length)failures.push({screen:slug,brokenImages:errors});
    await page.locator('.phone').screenshot({path:'screenshots/phone/'+slug+'.png',animations:'disabled'});
    await page.screenshot({path:'screenshots/full/'+slug+'.png',animations:'disabled'});
    console.log('Captured',slug,label,errors.length?'('+errors.length+' image failures)':'');
  }
  fs.writeFileSync('screenshots/manifest.json',JSON.stringify({screens:screens.map(([slug,label])=>({slug,label})),imageFailures:failures},null,2));
  console.log('Image failure details:',JSON.stringify(failures));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
