'use strick'

import ora from 'ora';
import chalk from "chalk";
import axios from "axios"
import cheerio from "cheerio"
import crypto from 'crypto'
import dayjs from "dayjs";

const DATE_FORMATS = [
  'YYYY-MM-DD HH:mm a',
  'DD/MM/YYYY HH:mm a',
  'YYYY-MM-DD HH:mm:ss a',
]

const spinner = ora()


class cheerioCrawler {
  constructor(args) {
    this.website = args.website
    this.url = args.url
    this.listUrl = []
    this.detail = {}
    this.details = []
    this.categories = args.categoies || []
    this.category = args.category
    this.typeCategoryUrl = args.typeCategoryUrl || 'page'
    this.writeFile = args.writeFile || true
    this.dataSelector = args.dataSelector
    this.pageLimit = args.pageLimit || 1
  }

  async getPage(url) {
    const categories = await this.getCategories()
    const response = await axios.get(this.url);
    return response.data
  }

  getJsonLinks(ctx) {
    return ctx.map(item => {
      return item[category.linkProperty]
    })
  }

  getLinks(ctx, category) {
    const website = this.website
    return ctx(category.linkSelector).map((i, el) => {
      let url = ctx(el).attr('href')
      url = url.startsWith('/') ? website.endsWith("/") ? website.slice(0, -1) : website + url : url
      return url
    }).get()
  }

  async getFeed(link = this.url) {
    spinner.start(this.website + ':: visiting ' + chalk.blueBright(link));
    try {
      const response = await axios.get(link);
      const ctx = cheerio.load(response.data)
      const data = this.transformFeed(ctx, link)
      spinner.stop()
      console.log(chalk.green('✔') + ':: visited ' + chalk.blueBright(link));
      return data
    } catch (error) {
      spinner.stop()
      console.log(chalk.red('✘') + ':: error ' + chalk.blueBright(link));
      console.log(error);      
    }
  }

  transformFeed(ctx, link) {
    const from = this.getFrom(ctx)
    const id = this.buildId(link, from)
    const title = this.getTitle(ctx)
    const description = this.getDescription(ctx)
    const image = this.getImage(ctx)
    const message = this.getMessage(ctx, this.dataSelector.message.selector)
    const createdAt = this.dataSelector.message.selector ? this.getCreatedAt(ctx) :this.getMetaCreatedTime(ctx)
    // const tags = this.getTags(ctx)
    const data = {
      link,
      id,
      title,
      description,
      image,
      message,
      from,
      createdAt: dayjs(createdAt).format(),
      updatedAt: new Date(),
      // tags
    }
    return data
  }

  buildId(link, from) {
    return from + '_' + crypto.createHash('md5').update(link).digest('hex')
  }

  getFrom(ctx) {
    return ctx('[name="application-name"]').attr('content')
  }

  getTitle(ctx) {
    return ctx('[property="og:title"]').attr('content')
  }

  getDescription(ctx) {
    return ctx('[property="og:description"]').attr('content')
  }

  getImage(ctx) {
    return ctx('[property="og:image"]').attr('content')
  }

  getMessage($, selector) {
    let contents = []
    const self = this
    $(selector + '> *').map(function () {
      if ($(this).find('img').attr('src') || $(this).find('img').attr('data-src')) {
        let image = self.buildContentImg($, this)
        contents.push(image)
      } else if ($(this).find('video').attr('src')) {
        // video
        {
          let videoSrc = $(this).find('video').attr('src')
          contents.push(
            `<div class="video-news-content"><video src="${videoSrc}"></video></div>`
          )
        }
      } else if ($(this).text().trim().length > 0) {
        contents.push(`<p>${$(this).text().trim()}</p>`)
      }
    })
    return contents.join(' ')
  }

  getCreatedAt($) {
    const timeElement = $(this.dataSelector.createdAt.selector)
    const typeContent = this.dataSelector.createdAt.get
    switch (typeContent) {
      case 'text':
        return timeElement.text().trim()
        break;
    
      default:
        return timeElement.attr(this.dataSelector.createdAt.get)
        break;
    }
  }

  getMetaCreatedTime(ctx) {
    const selectors = [
        'meta[name="pubdate"]',
        'meta[itemprop="datePublished"]',
        'meta[property="article:published_time"]',
    ]
    for (const selector of selectors) {
        if (ctx(selector).length) {
            return moment(ctx(selector).attr('content'), DATE_FORMATS).toDate()
        }
    }
    return null
  }

  buildSrcUrl(url, website = this.website) {
    let processUrl
    if (url.includes('https://') || url.includes('http://')) {
      processUrl = url
    } else if (url.includes('//')) {
      processUrl = website.includes('https://') ? `https:${url}` : `http:${url}`
    } else {
      processUrl = `${website}/${url}`
    }
    return processUrl.replace(/( )/g, '%20')
  }

  buildContentImg($, element) {
    const imgData = ['srcset', 'data-src', 'data-original']
    const imgReg = /(https?:\/\/|\/|\/|^((?:\.\.\/)+))[^\/\s]+\/\S+\.(jpg|png|gif|mp4|jpeg)/g
    let imgSrc = $(element).find('img').attr('src')
    for (const src of imgData) {
      if ($(element).find('img').attr(src)) {
        imgSrc = $(element).find('img').attr(src)
        if (imgSrc.match(imgReg)) {
          imgSrc = imgSrc.match(imgReg)[0] || imgSrc
        }
      }
    }
    return `<figure><img src="${this.buildSrcUrl(imgSrc)}"><figcaption><p>${$(element).text().trim()}</p></figcaption></figure>`
  }

  buildCategoryOptions(category = this.category) {
    return {
      method: category.method || 'get',
      url: category.url,
      headers: category.headers || {},
      params: category.params || {},
    }
  }

  async getCategoryData(category = this.category, page) {
    console.log(this.website + ':: getting category ' + chalk.yellow(category.url) + '||' + page);
    const option = this.buildCategoryOptions(category, page)
    const ctx = await axios(option)
    const $ = cheerio.load(ctx.data)
    const links = this.getLinks($, category)
    const data = []
    for (const link of links) {
      const feed = await this.getFeed(link)
      data.push(feed)
    }
    return data
  }

  async getCategory(category = this.category) {
    spinner.start(this.website + ':: getting category ' + chalk.yellow(category.url));
    try {
      let data = []
      for (let i = 1; i <= this.pageLimit; i++) {
        const categoryData = await this.getCategoryData(category, i)
        data.push(...categoryData)
      }
      spinner.stop();
      console.log(chalk.green('✔') + ' done category ' + chalk.yellow(category.url));
      return data
    } catch (error) {
      spinner.stop();
      console.log(chalk.red('✘') + ' failed category ' + chalk.yellow(category.url));
      return []      
    }
  }

}

export default cheerioCrawler