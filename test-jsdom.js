import fs from 'fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('index.html', 'utf8');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("jsdomError", (error) => {
  console.error(error.stack, error.detail);
});
virtualConsole.sendTo(console);

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  virtualConsole
});

setTimeout(() => {
    console.log("JSDOM initialization complete. Buttons count:", dom.window.document.querySelectorAll('button').length);
}, 2000);
