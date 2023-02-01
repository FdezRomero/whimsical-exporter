#!/usr/bin/env node
import { mkdir, writeFile } from 'fs/promises';
import inquirer from 'inquirer';
import puppeteer, { Page } from 'puppeteer';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import validator from 'validator';

const { HEADLESS = 'true', DEVTOOLS = 'false' } = process.env;

const DOWNLOAD_PATH = 'downloads';
const WHIMSICAL_BASE_URL = 'https://whimsical.com/';

const puppeteerExtra = addExtra(puppeteer);
puppeteerExtra.use(StealthPlugin());

let itemsDownloaded = 0;

const init = async () => {
  const path = `${process.cwd()}/${DOWNLOAD_PATH}`;
  console.log('👋 Welcome to whimsical-exporter');
  console.log(`ℹ All exported files will be saved in ${path}\n`);

  const { email, password, url } = await promptInputs();

  console.log('🚀 Launching browser');
  const browser = await puppeteerExtra.launch({
    headless: HEADLESS === 'true',
    devtools: DEVTOOLS === 'true'
  });

  console.log('📄 Opening new page');
  const page = await browser.newPage();

  await logIn(page, email, password);
  await navigateToFolder(page, url, path);

  console.log(`✨ Finished exporting ${itemsDownloaded} items`);
  await browser.close();
};

const promptInputs = async (): Promise<{
  email: string;
  password: string;
  url: string;
}> =>
  inquirer.prompt([
    {
      name: 'email',
      type: 'input',
      message: 'Your Whimsical email (username@domain.tld):',
      validate: input => validator.isEmail(input)
    },
    {
      name: 'password',
      type: 'password',
      message: 'Your Whimsical password:',
      validate: password => Boolean(password)
    },
    {
      name: 'url',
      type: 'input',
      message: 'Whimsical folder URL to start export from:',
      validate: url =>
        validator.isURL(url) && (url as string).startsWith(WHIMSICAL_BASE_URL)
    }
  ]);

const logIn = async (
  page: Page,
  email: string,
  password: string
): Promise<void> => {
  console.log('🔐 Logging in');
  await page.goto('https://whimsical.com/login', { waitUntil: 'networkidle0' });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.click('input[type="submit"]');

  try {
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
  } catch {
    throw new Error(
      '❌ Login failed, please check email and password are correct'
    );
  }
};

const navigateToFolder = async (
  page: Page,
  folderUrl: string,
  basePath: string
): Promise<void> => {
  console.log(`📂 Navigating to folder ${folderUrl}`);
  await page.goto(folderUrl, { waitUntil: 'networkidle0' });

  // Scroll down to lazy load batches of 100 items
  await loadAllItems(page);

  const itemUrls = await getUrls(page);
  const folderName = getItemName(folderUrl);
  const folderPath = `${basePath}/${folderName}`;

  await createDirIfNotExists(folderPath);
  await downloadUrls(page, itemUrls, folderPath);
};

const loadAllItems = async (page: Page): Promise<void> => {
  let moreItems = true;

  while (moreItems) {
    await page.$eval(
      '#content-wrapper12 > div:nth-child(1) > div:nth-child(1) > div',
      wrapper => (wrapper.scrollTop = wrapper.scrollHeight)
    );

    try {
      await page.waitForResponse(
        response =>
          response.url() === 'https://whimsical.com/api/items.sync' &&
          response.status() === 200,
        { timeout: 1000 }
      );
    } catch {
      moreItems = false;
    }
  }
};

const getUrls = async (page: Page): Promise<string[]> =>
  page.$$eval('[data-wc="folder-item"]', items =>
    items.map(item => (item as HTMLLinkElement).href)
  );

const createDirIfNotExists = async (path: string) => {
  try {
    await mkdir(path, { recursive: true });
  } catch {
    // Do nothing
  }
};

const downloadUrls = async (
  page: Page,
  urls: string[],
  basePath: string
): Promise<void> => {
  for await (const url of urls) {
    const svgUrl = `${url}/svg`;
    console.debug(`⚙️ Processing ${url}`);

    await page.goto(svgUrl, { waitUntil: 'networkidle0' });
    const title = await page.title();

    if (title === 'Not Found') {
      await navigateToFolder(page, url, basePath);
    } else {
      const svg = await page.content();
      const name = getItemName(url);
      const path = `${basePath}/${name}.svg`;
      await writeFile(path, addGrayBackground(svg));
      console.log(`⬇️ Downloaded SVG to ${path}`);
      itemsDownloaded++;
    }
  }
};

const getItemName = (url: string): string => {
  const [, path] = url.split(WHIMSICAL_BASE_URL);
  return path;
};

const addGrayBackground = (svg: string): string =>
  svg.replace('>', ' style="background: #f0f4f7;">');

init();
