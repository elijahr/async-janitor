/* eslint-disable no-console */

const Janitor = require('../lib').default;

const janitor = new Janitor();

// Do something in 100ms
janitor.setTimeout(() => { console.log('setTimeout') }, 100);

// Do something else in 200ms
janitor.addPromise(() => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 200)
  });
})
  .then(() => console.log('addPromise'));

// Wait, actually, don't do any of that stuff.
janitor.cleanup();
