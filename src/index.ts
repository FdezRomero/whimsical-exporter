#!/usr/bin/env node
import { mkdir, writeFile } from 'fs/promises';
import inquirer from 'inquirer';
import puppeteer, { CDPSession, Page } from 'puppeteer';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import validator from 'validator';

const { HEADLESS = 'true', DEVTOOLS = 'false' } = process.env;

const DOWNLOAD_PATH = 'downloads';
const WHIMSICAL_BASE_URL = 'https://whimsical.com/';

const enum FileType {
  PDF = 'pdf',
  PNG = 'png',
  SVG = 'svg'
}

const puppeteerExtra = addExtra(puppeteer);
puppeteerExtra.use(StealthPlugin());

let itemsDownloaded = 0;

const init = async () => {
  const downloadPath = `${process.cwd()}/${DOWNLOAD_PATH}`;
  console.log('👋 Welcome to whimsical-exporter');
  console.log(`ℹ All exported files will be saved in ${downloadPath}\n`);

  const { email, password, folderUrl, fileTypes } = await promptInputs();

  console.log('🚀 Launching browser');
  const browser = await puppeteerExtra.launch({
    headless: HEADLESS === 'true',
    devtools: DEVTOOLS === 'true'
  });

  console.log('📄 Opening new page');
  const page = await browser.newPage();

  await logIn(page, email, password);

  await navigateToFolder(page, folderUrl, downloadPath, fileTypes);

  console.log(`✨ Finished exporting ${itemsDownloaded} items`);
  await browser.close();
};

const promptInputs = (): Promise<{
  email: string;
  password: string;
  folderUrl: string;
  fileTypes: FileType[];
}> => {
  const { USER, PASSWORD, FOLDER_URL, FILE_TYPES } = process.env;

  return inquirer.prompt([
    {
      name: 'email',
      type: 'input',
      message: 'Your Whimsical email (username@domain.tld):',
      default: USER,
      validate: (input: string) => validator.isEmail(input)
    },
    {
      name: 'password',
      type: 'password',
      message: 'Your Whimsical password:',
      default: PASSWORD,
      validate: (input: string) => Boolean(input)
    },
    {
      name: 'folderUrl',
      type: 'input',
      message: 'Whimsical folder URL to start export from:',
      default: FOLDER_URL,
      validate: (input: string) =>
        validator.isURL(input) && input.startsWith(WHIMSICAL_BASE_URL)
    },
    {
      name: 'fileTypes',
      type: 'checkbox',
      message: 'Select which formats to export as:',
      default: FILE_TYPES?.split(','),
      choices: [
        {
          name: 'SVG (shapes can be zoomed in and edited)',
          short: 'SVG',
          value: FileType.SVG
        },
        {
          name: 'PNG at 2x zoom (static image, shapes cannot be edited)',
          short: 'PNG',
          value: FileType.PNG
        },
        {
          name: 'PDF (landscape, shapes can be zoomed in)',
          short: 'PDF',
          value: FileType.PDF
        }
      ],
      validate: (input: string[]) => Boolean(input.length)
    }
  ]);
};

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
  downloadPath: string,
  fileTypes: FileType[]
): Promise<void> => {
  console.log(`📂 Navigating to folder ${folderUrl}`);
  await goToUrlIfNeeded(page, folderUrl);

  // Scroll down to lazy load batches of 100 items
  await loadAllItems(page);

  const itemUrls = await getUrls(page);
  const folderName = getItemName(folderUrl);
  const folderPath = `${downloadPath}/${folderName}`;

  await createDirIfNotExists(folderPath);
  await downloadUrls(page, itemUrls, folderPath, fileTypes);
};

const loadAllItems = async (page: Page): Promise<void> => {
  let moreItems = true;
  const scrollSelector =
    '#content-wrapper12 > div:nth-child(1) > div:nth-child(1) > div';

  while (moreItems) {
    await page.$eval(
      scrollSelector,
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
  itemUrls: string[],
  downloadPath: string,
  fileTypes: FileType[]
): Promise<void> => {
  for await (const itemUrl of itemUrls) {
    console.debug(`⚙️ Processing ${itemUrl}`);
    const isFolder = await checkItemIsFolder(page, itemUrl);

    if (isFolder) {
      return navigateToFolder(page, itemUrl, downloadPath, fileTypes);
    }

    const itemName = getItemName(itemUrl);
    const downloadSvg = fileTypes.includes(FileType.SVG);
    const downloadPng = fileTypes.includes(FileType.PNG);
    const downloadPdf = fileTypes.includes(FileType.PDF);

    if (downloadSvg) {
      const filePath = `${downloadPath}/${itemName}.${FileType.SVG}`;
      const svg = await page.content();
      await writeFile(filePath, addGrayBackground(svg));
      console.log(`⬇️ Downloaded SVG to ${filePath}`);
    }

    if (downloadPng || downloadPdf) {
      const { imageBlob, imageBuffer } = await getImageBlob(page, itemUrl);

      if (downloadPng) {
        const filePath = `${downloadPath}/${itemName}.${FileType.PNG}`;
        await writeFile(filePath, imageBuffer);
        console.log(`⬇️ Downloaded PNG to ${filePath}`);
      }

      if (downloadPdf) {
        const filePath = `${downloadPath}/${itemName}.${FileType.PDF}`;
        await goToUrlIfNeeded(page, imageBlob);
        const pdfStream = await page.createPDFStream({ landscape: true });
        await writeFile(filePath, pdfStream);
        console.log(`⬇️ Downloaded PDF to ${filePath}`);
      }
    }

    itemsDownloaded++;
  }
};

const getItemName = (url: string): string => {
  const [, path] = url.split(WHIMSICAL_BASE_URL);
  return path;
};

const checkItemIsFolder = async (
  page: Page,
  itemUrl: string
): Promise<boolean> => {
  await goToUrlIfNeeded(page, `${itemUrl}/svg`);
  const title = await page.title();
  return title === 'Not Found';
};

const addGrayBackground = (svg: string): string =>
  svg.replace('>', ' style="background: #f0f4f7;">');

const getImageBlob = async (
  page: Page,
  itemUrl: string
): Promise<{ imageBlob: string; imageBuffer: Buffer }> => {
  await goToUrlIfNeeded(page, itemUrl);

  const shareButtonSelector = 'button[aria-label="Share, Export & Print"]';
  await page.waitForSelector(shareButtonSelector);
  await page.click(shareButtonSelector);

  const copyImageButtonSelector = 'div.m7.large div.mi8:nth-child(3)';
  await page.waitForSelector(copyImageButtonSelector);

  return clickAndWaitForImageBlob(page, copyImageButtonSelector);
};

const clickAndWaitForImageBlob = async (
  page: Page,
  elementSelector: string
): Promise<{ imageBlob: string; imageBuffer: Buffer }> =>
  new Promise((resolve, reject) => {
    const emitter = page.on('response', async response => {
      const url = response.url();

      if (url.startsWith(`blob:${WHIMSICAL_BASE_URL}`)) {
        emitter.removeAllListeners();

        if (response.ok()) {
          resolve({ imageBlob: url, imageBuffer: await response.buffer() });
        } else {
          reject();
        }
      }
    });

    page.click(elementSelector);
  });

const goToUrlIfNeeded = async (page: Page, url: string): Promise<void> => {
  if (page.url() !== url) {
    await page.goto(url, { waitUntil: 'networkidle0' });
  }
};

const setDownloadPath = (
  session: CDPSession,
  downloadPath: string
): Promise<void> =>
  session.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath
  });

const clickAndWaitForDownload = async (
  page: Page,
  session: CDPSession,
  elementSelector: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    const emitter = session.on('Page.downloadProgress', download => {
      if (download.state === 'completed') {
        emitter.removeAllListeners();
        return resolve();
      } else if (download.state === 'canceled') {
        emitter.removeAllListeners();
        return reject();
      }
    });

    page.click(elementSelector);
  });

init();
