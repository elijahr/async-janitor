# async-janitor

[![Build Status](https://travis-ci.org/styleseat/async-janitor.svg?branch=master)](https://travis-ci.org/styleseat/async-janitor) [![dependencies Status](https://david-dm.org/styleseat/async-janitor/status.svg)](https://david-dm.org/styleseat/async-janitor) [![devDependencies Status](https://david-dm.org/styleseat/async-janitor/dev-status.svg)](https://david-dm.org/styleseat/async-janitor?type=dev) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Easily cancel callbacks for promises, timers, and observables** ✨

Have you ever seen the following in your React app's logs?

> Warning: Can't call setState (or forceUpdate) on an unmounted component. This is a no-op, but it indicates a memory leak in your application. To fix, cancel all subscriptions and asynchronous tasks in the componentWillUnmount method.

Yeah it's pretty annoying. Here's a tool to help you mop up the mess.

# Installation
```
$ npm install async-janitor
```

# Usage
```javascript
import Janitor from 'async-janitor';

class MyComponent extends React.Component {
  janitor = new Janitor();

  componentDidMount() {
    // delay a task
    this.janitor.setTimeout(this.timeoutCallback, 100);

    // fetch some stuff
    this.janitor.addPromise(fetchStuff())
      .then(this.doStuff);

    // add a subscription to a cool Rx.JS observable stream
    this.janitor.addStream(coolStream)
      .subscribe(this.doCoolThings);

    // add a handler for the 'scroll' event on the document
    this.janitor.addEventListener(document, 'scroll', this.handleScroll);
  }

  componentWillUnmount() {
    // Clears timeouts, cancels promises, disposes subscriptions, unbinds event handlers
    // that were created in componentDidMount()
    this.janitor.cleanup();
  }
}
```


# Development

```
$ npm install --only=dev
```

- `npm run clean` - Remove `lib/` directory
- `npm test` - Run tests with linting and coverage results.
- `npm test:only` - Run tests without linting or coverage.
- `npm test:watch` - You can even re-run tests on file changes!
- `npm test:prod` - Run tests with minified code.
- `npm run test:examples` - Test written examples on pure JS for better understanding module usage.
- `npm run lint` - Run ESlint with airbnb-config
- `npm run cover` - Get coverage report for your code.
- `npm run build` - Babel will transpile ES6 => ES5 and minify the code.
- `npm run prepublish` - Hook for npm. Do all the checks before publishing your module.


# License

MIT © StyleSeat
