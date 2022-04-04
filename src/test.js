'use strict'

import Crawler from "./puppeteerCrawler.js";
import cheerioCrawler from "./requestCrawler.js";
import connectFirebase from "./firebase.js";
import {
  readFile
} from 'fs/promises';


const accountKey = JSON.parse(await readFile(new URL('../serviceAccountKey.json',
  import.meta.url)));

const firebaseOption = {
  collection: "posts",
  accountKey: accountKey
}

const gamespotOptions = {
  url: 'https://www.gamespot.com',
  categories: [
    {
      link: 'https://www.gamespot.com/news/'
    }
  ],
  maxPage: 3,
  commands: [{
      description: 'get list Url',
      selector: '.card-item__content > a',
      type: 'getListUrl',
    },
    {
      description: 'click next page',
      selector: '.paginate .paginate__item.on + .paginate__item',
      type: 'click',
    }
  ],
  removeElement: '',
  dataSelector: {
    author: {
      selector: '[rel="author"]',
      get: 'text'
    },
    message: {
      selector: '.js-content-entity-body.content-entity-body',
      get: 'html',
    }
  }
}

const initFirebase = new connectFirebase(firebaseOption)
// const crawler = new Crawler(gamespotOptions)
// const data = await crawler.loadData()
// const data = await crawler.getFeedData('https://www.gamespot.com/articles/overwatch-2-beta-starts-in-april-pve-being-decoupled-from-pvp/1100-6501441/')

const test2 = {
  website: 'https://www.gamespot.com',
  url: 'https://www.gamespot.com/articles/heres-what-other-games-should-steal-from-elden-ring/1100-6502119/',
  dataSelector: {
    message: {
      selector: '.js-content-entity-body',
      get: 'text'
    },
    createdAt: {
      selector: 'time',
      get: 'datetime',
    }
  },
  category: {
    url: 'https://www.gamespot.com/games/reviews/',
    linkSelector: '.card-item__content > a',
    method: 'get'
  },
  pageLimit: 2
}

class gamespot extends cheerioCrawler {
  constructor(options) {
    super(options)
  }

  buildCategoryOptions(category, page) {
    return {
      url: category.url,
      params: {
        page
      },
      method: 'get',
    }
  }
}
// const crawler2 = new gamespot(test2)
// const data = await crawler2.getCategory()
// await initFirebase.saveAllFeed(data)
// const data = await crawler2.getFeed()
// await initFirebase.saveFeed(data)