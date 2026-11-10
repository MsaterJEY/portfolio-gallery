import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox']
});

try {
  const page = await browser.newPage({
    viewport: {width: 1440, height: 1000}
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('http://localhost:5173');
  await page.getByRole('heading', {
    name: 'Designing digital systems'
  }).waitFor();

  await page.locator('.project').first().click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', {
    name: 'เปิดเว็บไซต์โปรเจกต์'
  }).click();

  await page.frameLocator('iframe').getByRole('heading', {
    name: 'Voice of customer'
  }).waitFor();

  await page.getByRole('button', {name: 'กลับเว็บหลัก'}).click();
  assert.equal(await page.locator('iframe').count(), 0);

  await page.setViewportSize({width: 390, height: 844});
  assert.ok(await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth
  ));

  await page.goto('http://localhost:5173/admin');
  await page.getByRole('heading', {
    name: 'ตั้งค่า Firebase ก่อนใช้งานแอดมิน'
  }).waitFor();

  assert.equal(errors.length, 0, errors.join('\n'));

  await page.route('**/api/public', route =>
    route.fulfill({json: {shortcut: 'Ctrl+Shift+K'}})
  );

  await page.route('**/api/unlock', async route => {
    const {code} = route.request().postDataJSON();
    await route.fulfill({
      status: code === 'secret123' ? 200 : 401,
      json: code === 'secret123'
        ? {ok: true}
        : {error: 'รหัสลับไม่ถูกต้อง'}
    });
  });

  await Promise.all([
    page.waitForResponse('**/api/public'),
    page.goto('http://localhost:5173')
  ]);

  await page.waitForTimeout(100);
  await page.keyboard.press('Control+Shift+K');

  await page.getByRole('dialog', {name: 'ใส่รหัสลับ'}).waitFor();

  for (let index = 0; index < 3; index++) {
    await page.getByLabel('รหัสลับ', {exact: true}).fill('wrong');
    await page.keyboard.press('Enter');

    if (index < 2) {
      await page.waitForFunction(
        count => document.querySelector('.unlock small')
          ?.textContent.includes(count + '/3'),
        index + 1
      );
    }
  }

  await page.getByRole('dialog', {
    name: 'ใส่รหัสลับ'
  }).waitFor({state: 'hidden'});

  await page.keyboard.press('Control+Shift+K');
  await page.getByLabel('รหัสลับ', {exact: true}).fill('secret123');
  await page.keyboard.press('Enter');

  await page.getByRole('button', {name: 'เปิด Admin panel'}).waitFor();
  assert.equal(await page.locator('.blurred').count(), 0);

  console.log(
    'PASS: desktop, mobile, modal, iframe, return, admin state, shortcut, three failures, bubble'
  );
} finally {
  await browser.close();
}
