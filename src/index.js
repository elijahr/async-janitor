import promiseCancel from 'promise-cancel';

/**
 * Class that assists with cleanup of asynchronous callbacks when those callbacks
 * should no longer fire (such as when a React component has been unmounted).
 *
 * Can be used with promises, Rx.JS observables, timeouts, and DOM event handlers.
 *
 * @example
 *   import Janitor from 'modules/Janitor';
 *
 *   class MyComponent extends React.PureComponent {
 *     janitor = new Janitor();
 *
 *     componentDidMount() {
 *       // delay a task
 *       this.janitor.setTimeout(this.timeoutCallback, 100);
 *
 *       // fetch some stuff
 *       this.janitor.addPromise(fetchStuff())
 *         .then(this.doStuff);
 *
 *       // add a subscription to a cool Rx.JS observable stream
 *       this.janitor.addStream(coolStream)
 *         .subscribe(this.doCoolThings);
 *
 *       // add a handler for the 'scroll' event on the document
 *       this.janitor.addDOMEvent(document, 'scroll', this.handleScroll);
 *     }
 *
 *     componentWillUnmount() {
 *       // Clears timeouts, cancels promises, disposes subscriptions, unbinds event handlers
 *       // that were created in componentDidMount()
 *       this.janitor.cleanup();
 *     }
 *   }
 *
 */
export default class Janitor {
  constructor() {
    this.cleaners = [];
  }

  /**
   * Set a timeout, track it for clearing on cleanup, and attach handlers to untrack it on cleanup.
   *
   * @param {Function} callback - the function to timeout with
   * @param {Number} timeoutMs - number of milliseconds
   * @returns {Number} timeout - the timeout ID
   */
  setTimeout(callback, timeoutMs) {
    let timeout;
    const removeCleaner = this.addCleaner(() => {
      clearTimeout(timeout);
    });
    timeout = setTimeout(
      () => {
        try {
          callback();
        } catch (err) {
          window.console.error(err);
        } finally {
          removeCleaner();
        }
      },
      timeoutMs,
    );
    return timeout;
  }

  /**
   * Signal an AbortController to abort when the janitor cleans up.
   *
   * @param {AbortController} abortController - the AbortController instance.
   * @returns {Function} - callback to remove the cleanup callback
   */
  addAbortController(abortController) {
    return this.addCleaner(() => {
      abortController.abort();
    });
  }

  /**
   * Wrapper around fetch() which will abort outstanding requests when the janitor cleans up.
   *
   * @param {RequestInfo} resource - the resource that you wish to fetch.
   * @param {Object} [init] - options object containing any custom settings that you want to
   *  apply to the request.
   * @returns {Promise<Response>}
   */
  fetch(resource, init) {
    const opts = init || {};
    if (opts.signal) {
      throw new Error('Cannot call Janitor.fetch() with an existing AbortSignal.');
    }
    const abortController = new window.AbortController();
    const removeCleaner = this.addAbortController(abortController);
    opts.signal = abortController.signal;
    const promise = window.fetch(resource, opts);
    // If the promise finishes, remove the cleaner
    promise.then(removeCleaner, removeCleaner);
    return promise;
  }

  /**
   * Track a promise for cancellation on cleanup.
   *
   * @param {Promise} promise - the promise to cancel on cleanup
   * @returns {Promise}
   */
  addPromise(promise) {
    const cancellable = promiseCancel(promise);
    const removeCleaner = this.addCleaner(() => {
      cancellable.cancel();
    });
    // If the promise finishes, remove the cleaner
    cancellable.promise.then(removeCleaner, removeCleaner);
    return cancellable.promise;
  }

  /**
   * Lazily import RxJS 5+ or 4.
   */
  static getRxJS() {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    const Rx5 = require('rxjs/Subject');
    if (Rx5) {
      return Rx5;
    }
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    const Rx4 = require('rx');
    if (Rx4) {
      return Rx4;
    }
    throw new Error('Could not import RxJS. Is it installed?');
  }

  /**
   * Return a version of the stream that will have its subscriptions disposed on cleanup.
   *
   * @param {Rx.Observable} observable - the observable that will be subscribed to.
   * @returns {Rx.Observable} - the version of the observable that will be disposed on cleanup.
   */
  addStream(observable) {
    if (!this.cleanupSubject) {
      // Lazily import RxJS when addStream is called, since RxJS is not a requirement
      // for using Janitor.
      const { Subject } = Janitor.getRxJS();
      this.cleanupSubject = new Subject();
      this.addCleaner(() => {
        if (this.cleanupSubject.onNext) {
          this.cleanupSubject.onNext();
        } else {
          this.cleanupSubject.next();
        }
      });
    }
    if (observable.takeUntil) {
      // RxJS 4
      return observable.takeUntil(this.cleanupSubject);
    }
    // RxJS 5+
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    const { takeUntil } = require('rxjs/operators');
    return observable.pipe(takeUntil(this.cleanupSubject));
  }

  /**
   * Attach an event handler to an element that will be removed on cleanup.
   *
   * @param {EventTarget} target - the DOM node or other event-attachable target
   * @param {String} type - the event type
   * @param {Function} callback - the event handler function
   * @param {Object} [options] - See docs for addEventListener
   */
  addEventListener(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    this.addCleaner(() => {
      target.removeEventListener(type, callback);
    });
  }

  /**
   * Add a callback to the cleanup queue.
   *
   * @param callback - the cleanup task.
   * @returns {removeCleaner} - a function which removes the cleanup task from the cleanup queue.
   */
  addCleaner(callback) {
    let removeCleaner;
    const wrapped = () => {
      callback();
      removeCleaner();
    };
    removeCleaner = () => {
      const index = this.cleaners.indexOf(wrapped);
      if (index >= 0) {
        this.cleaners.splice(index, 1);
      }
    };
    this.cleaners.push(wrapped);
    return removeCleaner;
  }

  /**
   * Clears timeouts, cancels promises, disposes subscriptions, unbinds event handlers.
   */
  cleanup() {
    this.cleaners.slice(0).forEach((callback) => {
      // callbacks should cleanup after themselves
      callback();
    });
  }
}
