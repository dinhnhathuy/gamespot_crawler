'use strict'

import firebase from "firebase-admin"
import dayjs from 'dayjs'
import ora from 'ora';
import chalk from 'chalk';

class connectFirebase {
  constructor(args) {
    this.collection = args.collection
    this.accountKey = args.accountKey
    this.spinner = ora()
    this.initFireBase()
  }

  async initFireBase() {
    firebase.initializeApp({
      credential: firebase.credential.cert(this.accountKey),
    })
  }

  async saveFeed(data) {
    this.spinner.start('saving Feed to firebase');
    const db = firebase.firestore().collection(this.collection)
    const docRef = db.doc(data.id + '')
    await docRef.set(data);
    this.spinner.stop();
    console.log(chalk.green('✔') + ' success saving ' + chalk.blue(data.id));
  }

  async saveAllFeed(data) {
    this.spinner.start('saving ' + data.length + ' Feeds to firebase');
    const db = firebase.firestore().collection(this.collection)
    for (let index = 0; index < data.length; index++) {
      await this.saveFeed(data[index])
    }
    this.spinner.stop();
    console.log(chalk.green('✔') + ' success saving ' + data.length + ' Feeds');
  }

  async readCollection(query) {
    const data = await this.db.collection(this.collection).get();
    return data
  }

  async readFeed(id) {
    const data = await this.db.collection(this.collection).doc(id).get();
    return data

  }

  async updateFeed(id, updateData) {
    await this.db.collection(this.collection).doc(id).update(updateData);
  }
}

export default connectFirebase