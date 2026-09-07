const sleep = (ms) => new Promise(r => setTimeout(r, ms));
await sleep(1500);
return document.body.innerText.slice(0, 500);
