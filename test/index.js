import { assert, expect } from 'chai';
import mock from 'mock-require';
import Janitor from '../src/index';

const Rx4 = require('rx');
const Rx5 = require('rxjs/Subject');

describe('Janitor', () => {
  let janitor;

  beforeEach(() => {
    janitor = new Janitor();
  });

  function makePromise() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    promise.resolve = resolve;
    promise.reject = reject;
    return promise;
  }

  function hideRxJS4() {
    before(() => {
      // before:hideRxJS4
      mock('rx', null);
    });
    after(() => {
      mock.stop('rx');
    });
  }

  function hideRxJS5() {
    before(() => {
      // before:hideRxJS5
      mock('rxjs/Subject', null);
    });
    after(() => {
      mock.stop('rxjs/Subject');
    });
  }

  describe('.addPromise()', () => {
    let originalPromise;
    let promise;

    beforeEach(() => {
      originalPromise = makePromise();
      promise = janitor.addPromise(originalPromise);
    });

    it('attaches cleaner', () => {
      assert.equal(janitor.cleaners.length, 1);
    });

    it('on resolve: detaches cleaner', (done) => {
      promise.then(() => {
        assert.equal(janitor.cleaners.length, 0);
        done();
      });
      originalPromise.resolve();
    });

    it('on reject: detaches cleaner', (done) => {
      promise.catch(() => {
        assert.equal(janitor.cleaners.length, 0);
        done();
      });
      originalPromise.reject();
    });

    it('on cleanup: cancels promise', (done) => {
      promise.catch((err) => {
        assert.equal(err.type, 'cancel');
        done();
      });
      janitor.cleanup();
      assert.equal(janitor.cleaners.length, 0);
    });
  });

  describe('.setTimeout()', () => {
    const originalError = window.console.error;

    before(() => {
      // Silence expected error messaging for coherent test output.
      window.console.error = () => {};
    });

    after(() => {
      window.console.error = originalError;
    });

    it('runs timer, attaches cleaner, detaches cleaner', (done) => {
      let run = false;
      janitor.setTimeout(() => {
        run = true;
      }, 0);
      assert.equal(janitor.cleaners.length, 1);
      setTimeout(() => {
        assert.equal(run, true);
        assert.equal(janitor.cleaners.length, 0);
        done();
      }, 10);
    });

    it('on error: detaches cleaner', (done) => {
      janitor.setTimeout(() => {
        throw new Error();
      }, 0);
      assert.equal(janitor.cleaners.length, 1);
      setTimeout(() => {
        assert.equal(janitor.cleaners.length, 0);
        done();
      }, 10);
    });

    it('on cleanup: clears timer, detaches cleaner', (done) => {
      let cleared = true;
      janitor.setTimeout(() => {
        cleared = false;
      }, 0);
      assert.equal(janitor.cleaners.length, 1);
      janitor.cleanup();
      assert.equal(janitor.cleaners.length, 0);
      setTimeout(() => {
        assert.equal(cleared, true);
        done();
      }, 10);
    });
  });

  describe('.fetch()', () => {
    const originalFetch = window.fetch;
    let fetchPromise;

    before(() => {
      window.fetch = (url, options) => {
        const promise = makePromise();
        options.signal.addEventListener('abort', () => promise.reject());
        return promise;
      };
    });

    after(() => {
      window.fetch = originalFetch;
    });

    beforeEach(() => {
      fetchPromise = janitor.fetch('some://url');
    });

    it('attaches cleaner', () => {
      assert.equal(janitor.cleaners.length, 1);
    });

    it('on resolve: detaches cleaner', (done) => {
      fetchPromise.then(() => {
        assert.equal(janitor.cleaners.length, 0);
        done();
      });
      fetchPromise.resolve();
    });

    it('on reject: detaches cleaner', (done) => {
      fetchPromise.catch(() => {
        assert.equal(janitor.cleaners.length, 0);
        done();
      });
      fetchPromise.reject();
    });

    it('throws if provided options.signal', () => {
      const abortController = new window.AbortController();
      assert.throws(() => {
        janitor.fetch('some://url', { signal: abortController.signal });
      });
    });

    it('on cleanup: aborts request, detaches cleaner', (done) => {
      fetchPromise.catch(() => done());
      janitor.cleanup();
      assert.equal(janitor.cleaners.length, 0);
    });
  });

  describe('.addAbortController()', () => {
    let abortController;

    beforeEach(() => {
      abortController = new window.AbortController();
      janitor.addAbortController(abortController);
    });

    it('attaches cleaner', () => {
      assert.equal(janitor.cleaners.length, 1);
    });

    it('on cleanup: sends abort signal, detaches cleaner', () => {
      assert.equal(abortController.signal.aborted, false);
      janitor.cleanup();
      assert.equal(abortController.signal.aborted, true);
      assert.equal(janitor.cleaners.length, 0);
    });
  });

  describe('.addEventListener()', () => {
    let element;
    let handled;

    beforeEach(() => {
      element = document.createElement('div');
      handled = 0;
      const handleEvent = () => {
        handled += 1;
      };
      janitor.addEventListener(element, 'test', handleEvent);
    });

    it('handles events, attaches cleaner', () => {
      assert.equal(janitor.cleaners.length, 1);
      assert.equal(handled, 0);
      element.dispatchEvent(new Event('test'));
      element.dispatchEvent(new Event('test'));
      assert.equal(handled, 2);
    });

    it('on cleanup: stops handling events, detaches cleaner', () => {
      janitor.cleanup();
      assert.equal(janitor.cleaners.length, 0);
      element.dispatchEvent(new Event('test'));
      assert.equal(handled, 0);
    });
  });

  describe('.getRxJS()', () => {
    describe('with RxJS 4', () => {
      hideRxJS5();
      it('detects RxJS 4', () => {
        assert.equal(Janitor.getRxJS(), Rx4);
      });
    });
    describe('with RxJS 5+', () => {
      hideRxJS4();
      it('detects RxJS 5+', () => {
        assert.equal(Janitor.getRxJS(), Rx5);
      });
    });
    describe('with no RxJS', () => {
      hideRxJS4();
      hideRxJS5();
      it('throws error', () => {
        assert.throws(Janitor.getRxJS);
      });
    });
  });

  describe('.addStream()', () => {
    describe('with RxJS 4', () => {
      hideRxJS5();

      let received;
      let stream;

      const receiveAll = () => {
        received.push('receiveAll');
      };

      const receiveUntilCleanup = () => {
        received.push('receiveUntilCleanup');
      };

      beforeEach(() => {
        stream = new Rx4.Subject();
        received = [];

        // non-janitorized stream subscription receives everything
        stream.subscribe(receiveAll);

        // janitorized stream subscription receives until cleanup
        janitor.addStream(stream).subscribe(receiveUntilCleanup);
      });

      it('attaches cleaner', () => {
        assert.equal(janitor.cleaners.length, 1);
      });

      it('receives streams', () => {
        stream.onNext();
        expect(received).to.eql(['receiveAll', 'receiveUntilCleanup']);
      });

      it('on cleanup: disposes subscriptions, detaches cleaner', () => {
        janitor.cleanup();

        assert.equal(janitor.cleaners.length, 0);

        // receiveAll should be the only listener now
        stream.onNext();
        expect(received).to.eql(['receiveAll']);
      });
    });
    describe('with RxJS 5+', () => {
      hideRxJS4();

      let received;
      let stream;

      const receiveAll = () => {
        received.push('receiveAll');
      };

      const receiveUntilCleanup = () => {
        received.push('receiveUntilCleanup');
      };

      beforeEach(() => {
        stream = new Rx5.Subject();
        received = [];

        // non-janitorized stream subscription receives everything
        stream.subscribe(receiveAll);

        // janitorized stream subscription receives until cleanup
        janitor.addStream(stream).subscribe(receiveUntilCleanup);
      });

      it('attaches cleaner', () => {
        assert.equal(janitor.cleaners.length, 1);
      });

      it('receives streams', () => {
        stream.next();
        expect(received).to.eql(['receiveAll', 'receiveUntilCleanup']);
      });

      it('on cleanup: disposes subscriptions, detaches cleaner', () => {
        janitor.cleanup();

        assert.equal(janitor.cleaners.length, 0);

        // receiveAll should be the only listener now
        stream.next();
        expect(received).to.eql(['receiveAll']);
      });
    });
  });
});
