'use strict'

import ora from 'ora';
import chalk from 'chalk';
import puppeteer from 'puppeteer';
import jsonfile from 'jsonfile';
import crypto from 'crypto'
import dayjs from 'dayjs';

class Crawler {
  constructor(args) {
    this.url = args.url
    this.commands = args.commands
    this.listUrl = []
    this.detail = {}
    this.details = []
    this.writeFile = args.writeFile || true
    this.dataSelector = args.dataSelector
    this.categories = args.categories
    this.spinner = ora()
    this.filePath = 'data.json'
    this.initialJson = {
      'data': []
    }
    this.fileData = null
    this.initFile()
  }

  initFile() {
    try {
      jsonfile.readFileSync(this.filePath);
    } catch (error) {
      this.createInitialFile();
    }
  }

  createInitialFile() {
    try {
      jsonfile.writeFileSync(this.filePath, this.initialJson);
    } catch (error) {
      console.log('Could not create file ' + this.filePath + ': ' + error);
    }
  }

  async loadBrowser() {
    this.browser = await puppeteer.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-gpu",
      ]
    });
    this.page = await this.browser.newPage();
    await this.page.setRequestInterception(true);
    this.page.on('request', (request) => {
      if (['image'].indexOf(request.resourceType()) !== -1) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await this.page.on('console', msg => {
      for (let i = 0; i < msg._args.length; ++i) {
        msg._args[i].jsonValue().then(result => {
          console.log(result);
        })

      }
    });
  }

  async closeBrowser() {
    await this.browser.close();
  }

  async loadData() {
    await this.loadBrowser()
    await this.getCategoryData(this.categories[0], 1)
    await this.getFeedsData()
    await this.sleep(2000)
    await this.closeBrowser()
    //   this.storeData(this.details)
    return this.details
  }

  async getCategoryData(category, page) {
    let data = null
    await this.loadPage(category.link)
    if (category.json) {
      const rawData = await this.getJson(category.link)
      data = this.transformData(rawData)
    } else {
      const listCommands = this.commands
      let commandIndex = 0
      while (commandIndex < listCommands.length) {
        try {
          console.log(`command ${(commandIndex + 1)}/${listCommands.length}`)
          await this.executedCommand(listCommands[commandIndex], page, category.link)
        } catch (error) {
          console.log(error);
        }
        commandIndex++
      }
    }
    return data
  }

  async getJson(url) {
    const innerText = await this.page.evaluate(() => {
      return JSON.parse(document.querySelector("body").innerText);
    });
    return innerText
  }

  transformData(data) {
    data = data.data.cryptoCurrencyList
    return data.map(ele => ({
      id: ele.id,
      name: ele.name,
      symbol: ele.symbol,
      slug: ele.slug,
      totalSupply: ele.totalSupply,
      maxSupply: ele.maxSupply,
      quotes: ele.quotes,
      lastUpdated: ele.lastUpdated
    }))
  }

  async scrollDown(selector) {
    await this.page.$eval(`${selector}`, e => {
      e.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'end'
      });
    }, selector);
    await this.sleep(5000)
  }

  async loadPage(url) {
    this.spinner.start('Loading page ' + chalk.blue(url));
    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded'
      });
      this.spinner.stop();
      console.log(chalk.green('✔') + ' Loaded page ' + chalk.blue(url));
    } catch (error) {
      this.spinner.stop();
      console.error(chalk.red('✖') + ' Can\'t load the page ' + chalk.blue(url));
      console.error('Let\'s retry...');
      await this.loadPage(url);
    }
  }

  async executedCommand(command, page) {
    let curPage = page
    switch (command.type) {
      case "click":
        try {
          await this.scrollDown(command.selector)
          await this.page.evaluate(selector => {
            document.querySelector(selector).click()
          }, command.selector);
          curPage++
        } catch (error) {}
        await this.sleep(5000)
        break;
      case "getListUrl":
        try {
          let items = await this.page.evaluate((selector) => {
            return Array.from(document.querySelectorAll(selector)).map(x => x.getAttribute('href'))
          }, command.selector);
          items = items.map(item => this.buildUrl(item))
          console.log(items);
          this.listUrl = [...this.listUrl, ...items]
          return items;
        } catch (error) {}
        break;
      default:
        break;
    }
  }

  async getFeedsData() {
    for (let index = 0; index < this.listUrl.length; index++) {
      const data = await this.getFeedData(this.listUrl[index])
      this.details.push(data)
    }
    return this.details
  }

  async getFeedData(url) {
    await this.loadBrowser()
    await this.page.goto(url)
    this.spinner.start('getting data page ' + chalk.yellow(url));
    await this.sleep(3000)
    try {
      const defaultData = await this.getDefaultData()
      const id = defaultData.from + '_' + this.buildId(url)
      const detail = {
        ...defaultData,
        id,
        link: url,
      }
      console.log(chalk.green('✔') + ' done ' + url);
      return detail
    } catch (error) {
      console.log(chalk.red('X' + error));
    }
    this.spinner.stop();
  }

  async getDefaultData() {
    const data = await this.page.evaluate(dataSelector => {
      const title = document.querySelector('title').innerText.trim()
      const description = document.querySelector('[name="description"]').getAttribute('content').trim()
      const image = document.querySelector('[property="og:image"]').getAttribute('content').trim() || ''
      const from = document.querySelector('[property="og:site_name"]').getAttribute('content').trim().toLowerCase() || ''
      const exDetail = {}
      for (let key in dataSelector) {
        if (dataSelector[key].get = 'text') {
          exDetail[key] = Array.from(document.querySelectorAll(dataSelector[key].selector))
            .map(item => item.innerText.trim()).join(' ')
        } else if (dataSelector[key].get = 'html') {
          exDetail[key] = document.querySelector(dataSelector[key].selector).innerHTML.trim()
        } else if (dataSelector[key].get = 'convertHtml') {
          exDetail[key] = Array.from(document.querySelectorAll(dataSelector[key].selector))
            .map(item => '<p>' + item.innerText.trim() + '</p>').join(' ')
        } else {
          exDetail[key] = document.querySelector(dataSelector[key].selector).getAttribute(dataSelector[key].get).trim()
        }
      }
      let detail = {
        title: title,
        description: description,
        image: image,
        updateAt: new Date().toISOString(),
        from,
        ...exDetail
      }
      return detail;
    }, this.dataSelector)
    return data
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  buildUrl(url) {
    if (url.includes('https://') || url.includes('http://')) {
      return url
    } else {
      return `${this.url}${url}`
    }
  }

  buildId(url) {
    return crypto.createHash('md5').update(url).digest('hex')
  }

  storeData(data) {
    let fileData = this.getFileData()
    fileData['data'].push(data)
    this.writeFileData(fileData);
  }

  getFileData() {
    if (this.fileData && this.fileData.length) return this.fileData
    try {
      this.fileData = jsonfile.readFileSync(this.filePath)
      return this.fileData;
    } catch (error) {
      console.log('Could not read file:', this.filePath);
      return null;
    }
  }

  writeFileData(data) {
    try {
      jsonfile.writeFileSync(this.filePath, data, {
        spaces: 2
      });
      this.fileData = data;
    } catch (error) {
      console.log('Could not write file:', this.filePath);
      this.fileData = null;
    }
  }
}

export default Crawler