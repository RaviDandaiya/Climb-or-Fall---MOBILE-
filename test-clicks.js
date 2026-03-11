import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
        
        console.log('Navigating to http://localhost:5173...');
        await page.goto('http://localhost:5173');
        await new Promise(r => setTimeout(r, 2000));
        
        console.log('Testing button clicks...');
        await page.click('#mode-fall');
        
        const fallActive = await page.$eval('#mode-fall', el => el.classList.contains('active'));
        console.log('Is Fall Mode button active?', fallActive);

        await browser.close();
    } catch (e) {
        console.error('Puppeteer Script Error:', e);
    }
})();
