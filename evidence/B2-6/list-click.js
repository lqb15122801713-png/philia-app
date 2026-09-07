const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const q = (t) => [...document.querySelectorAll('button')].find(b => b.innerText.trim().includes(t));
q('待确认')?.click();
await sleep(1200);
return document.body.innerText.slice(0, 500);
