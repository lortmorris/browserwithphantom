/* eslint-disable semi */

'use strict';

var phantom = require('phantom');
var utils = require('util');
var EventEmitter = require('events').EventEmitter;
var fdebug = require("./fdebug");
var fs = require("fs");
var path = require("path");
var linerstream = require("linerstream");

var events = [
	'onInitialized',
	'onLoadStarted',
	'onLoadFinished',
	'onUrlChanged',
	'onClosing',
	'onConsoleMessage',
	'onAlert',
	'onConfirm',
	'onPrompt',
	'onPageCreated'
];


/**
 * Create a instance of Browser (phantomjs wrapper).
 * @param {string} instanceID - the instanceId (identification). Isn't passed the library will create automatic
 * @param {object} options - the options for instance of browser.
 * @param {integer} options.ttl - Time to live, this argument set the time for auto close (destroy) instance if no use. Default is 10 seconds.
 * @param {string} options.screenshotFolder  - the destination folder for screenshot (.render method).
 * @constructor
 */

class Browser {
	constructor(instanceID, options) {
		var self = this;

		self.options = options || {
				ttl: 60,
				screenshotFolder: process.cwd() + "/screenshots",
				phantomjs: [],
				debug: null
			};

		self.isLoaded = false;
		self.instanceID = (instanceID || new Date().getTime()).toString();
		self.tabs = [];
		self.ttl = (self.options.ttl || 60) * 1000;
		self.lastUse = new Date().getTime();
		self.debug = self.options.debug || fdebug('bot:browser', self.instanceID);
		self.debug("browser init...");

		if (fs.existsSync(self.options.screenshotFolder)) {
			self.screenshotFolder = self.options.screenshotFolder;
		} else {
			self.screenshotFolder = process.cwd() + "/screenshots";
		}

		let params = [].concat(self.options.phantomjs || [], "--web-security=no");


		phantom.create(params)
			.then((ph) => {
				self.debug('phantom craeted: ', self.instanceID);
				self.ph = ph;
				self.closed = false;

				return ph.createPage();
			})
			.then((page) => {
				self.debug('page craeted');
				self.page = page;
				function ownBindEvents(page) {

					for (var i = 0; i < events.length; i++) {
						page.property(events[i], function () {
							var args = [];
							var __IGNORE__EVENTS = ["onResourceReceived", "onRepaintRequested", "onResourceRequested"];
							for (var k in arguments) args.push(arguments[k]);
							var evt = args.pop();
							var str = args.join(" ");
							//ignore some events
							if (__IGNORE__EVENTS.indexOf(evt) == -1) console.log(evt, str);
						}, events[i]);

					}//end for
				}

				ownBindEvents(page);


				self.ph.process.stdout.pipe(new linerstream())
					.on('data', (data) => {
						let message = data.toString('utf8').trim();
						if (message[0] !== ">") {
							let pars = message.split(" ");
							let evt = pars.shift().trim();
							self.emit(evt, pars.join(" "));
						}

					});


				self.emit('ready', page);

				self.on('onLoadStarted', () => {
					self.isLoaded = false;
				});

				self.on('onLoadFinished', () => {
					self.isLoaded = true;
				});


				self.on('onPageCreated', (tab) => {
					self.tabs.push(tab[0]);
					self.page = tab[0];
					self.debug("New Tab Opened");
					ownBindEvents(tab);

				});


				self.on('onConsoleMessage', () => {

					let args = arguments;
					if (!self.processConsoleCMD(args)) {

						let toString = function () {
							var out = "";
							for (var k in args) out += args[k];
							return out;
						};
						self.debug('FROM BROWSER CONSOLE: ' + toString(args));
					}
				});
			})
			.catch((err) => {
				throw "Browser isn' ready: " + err.toString();
			});

		self.waitingReady = [];

		self.on('ready', () => {
			self._isReady = true;
			self.debug('Browser ready ');

			let p;
			while (p = self.waitingReady.splice(0, 1)[0]) {
				p();
			}
		});

//check the TTL
		self.TTLCheckID = setInterval(() => {
			let local = new Date().getTime();

			if ((local - self.lastUse) > self.ttl) {
				self.debug("TTL done!");
				clearInterval(self.TTLCheckID);
				self.close();
			}
		}, 500);
	}


	/**
	 * is a internal method, is called by onConsoleMessage.
	 * This method catch the console.log emit by evaluate expression, split the string and process for internal browser libreary commands.
	 */
	processConsoleCMD(data) {
		let browser = this;
		let input = data[0];
		let res = false;
		let parts = input.split(";;||;;");

		parts.forEach((v, i) => parts[i] = v.trim());

		switch (parts[0]) {
			case '__PHANTOMJS_EVENT__AJAX_STARTED':
				browser.emit('__PHANTOMJS_EVENT__AJAX_STARTED');
				res = true;
				break;

			case '__PHANTOMJS_EVENT__AJAX_COMPLETE':
				browser.emit('__PHANTOMJS_EVENT__AJAX_COMPLETE', parts[1], parts[2]);

				res = true;
				break;
		}

		return res;

	}


	/**
	 * wait for ajax request is complete
	 * @returns {Promise}
	 */
	waitAjaxComplete() {
		let browser = this;
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				browser.emit("__PHANTOMJS_EVENT__AJAX_COMPLETE");
			}, 60 * 1000);

			browser.once('__PHANTOMJS_EVENT__AJAX_COMPLETE', function () {
				resolve();
			});
		});
	}

	/**
	 * return cookies (actual web page)
	 * @returns {string}
	 */
	getCookies() {
		let self = this;
		return new Promise((resolve, reject) => {
			this.property('cookies')
				.then((cookies)=> {
					resolve(cookies);
				})
				.catch((err)=> {
					reject(err);
				});
		});
	}

	/**
	 * waiting for the browser instance is ready
	 * @returns {Promise}
	 */
	ready() {
		let browser = this;
		this.debug('ready, is closed? ' + browser.closed);


		if (this.closed) return Promise.reject('Browser already closed');
		if (this._isReady) return Promise.resolve();

		return new Promise((resolve, reject) => {
			browser.waitingReady.push(() => {
				resolve();
			});
		});

	}

	/**
	 * Close the Browser instance
	 * @returns {Promise}
	 */
	close() {
		let browser = this;

		browser.debug("Browser.close called");
		return new Promise(function (resolve, reject) {
			browser.ready()
				.then(() => {

					browser.ph.process.on('exit', function (code) {
						browser.closed = true;
						browser.debug('Browser lib closed instance');
						browser.ttl = 0;
						resolve(code);
					});

					browser.ph.exit();


				}).catch(()=> {
					resolve();
				});
		});
	}

	/**
	 * open a website (page)
	 * @param {string} url - the url to open
	 * @param {string} method - (get, post, etc)
	 * @param {object} data -  (object with data to passed to request)
	 * @returns {Promise}
	 */
	open(url, method, data) {
		var self = this;
		var debug = this.debug;

		debug("open method called: " + url);

		return new Promise((resolve, reject) => {
			if (!url) return reject('Missing URL');
			if (!method) return reject('Missing method');

			self.ready()
				.then(()=> {
					self.page.open(url, method, data)
						.then(function () {
							self.debug('page opened ' + url);
							resolve();
						})
						.catch(function (err) {
							reject(err);
						});
				}).catch(reject);
		});
	}


	/**
	 * run javascript into website scope. All aditionals arguments passed will are arguments by evaluate function.
	 * @param {function} - the function (expression) for evaluate into phantomjs instance
	 * @returns {Promise}
	 */
	evaluate(fn) {
		let browser = this;
		let args = Array.prototype.slice.call(arguments, 1);

		browser.lastUse = new Date().getTime();
		browser.debug('evaluate args ' + args);

		return new Promise((resolve, reject) => {

			var evalArgs = [fn].concat(args);

			browser.ready()
				.then(() => {
					browser.debug("EVALUATE OK " + args);
					return browser.page.evaluate.apply(browser.page, evalArgs);
				})
				.then((res)=> {
					resolve(res);
				})
				.catch((err)=> {
					browser.debug('ERORR EVALUATE: ' + err);
					reject(err);
				});
		});
	}

	/**
	 * Go to url (open webpage)
	 * @param {string} url - the url to open. Asume GET method, without params
	 * @returns {Promise}
	 */
	browseTo(url) {
		let browser = this;
		browser.isLoaded = false;
		browser.lastUse = new Date().getTime();
		return new Promise((resolve, reject) => {
			browser.open(url, 'GET', '')
				.then((status) => {
					browser.debug('browseTo ' + url + "  : " + status);
					resolve();
				}).catch((err) => {
					browser.debug('Error open website: ' + url + ' : ' + err.toString());
					reject();
				});
		});
	}

	/**
	 * Click bottom. For example: browser.click('.btn', 2);
	 * @param {string} selector -
	 * @param {integer} position - When the selector return more than 1 posible element, you can set the element number (init 0).
	 * @returns {Promise}
	 */
	click(selector, position) {
		let browser = this;
		position = position || 0;

		return new Promise((resolve, reject) => {
			browser
				.evaluate(
				function (selector, position) {

					var target = null;
					var only = false;

					if (selector.split(" ").length == 1 && selector[0] == "#") {
						selector = selector.substr(1, selector.length);
						target = document.getElementById(selector);
						only = true;
					} else {
						target = document.querySelectorAll(selector);
					}

					if (!only) target = target[position];

					if (target) {
						target.focus();
						var ev = document.createEvent('MouseEvents');
						ev.initEvent('click', true, true);
						target.dispatchEvent(ev);
						return true;
					} else {
						return false;
					}

				},
				selector, position)
				.then((result)=> {
					if (result === false) return reject("browser.click: element not found: " + selector);
					else {
						browser.debug('clicked ' + selector);
						resolve();
					}

				})
				.catch((err) => {
					browser.debug("reject click method: " + err);
					reject(err);
				}
			);
		});
	}


	/**
	 * Click into checkbox element.
	 * @param {string} - query selector
	 * @param {boolean} is - if false, not do anythink.
	 * @returns {Promise}
	 */
	check(selector, is) {
		let browser = this;
		let debug = browser.debug;
		return new Promise((resolve, reject)=> {
			if (!is) {
				browser.debug('no click for check, is false or zero');
				resolve();
			} else {
				browser.click(selector, 0)
					.then(() => {
						debug('check ' + selector);
						resolve();
					});
			}
		});
	}


	/**
	 * inject JS into website (after onload) and catch all ajax request. Dont remove console.log, is the core off internal EVENTS!
	 * @returns {Promise}
	 */
	ajaxLoad() {
		let browser = this;

		return new Promise((resolve, reject) => {
			browser.evaluate(function (content) {

				(function () {
					console.log('Adding external JS');
					var origOpen = XMLHttpRequest.prototype.open;
					XMLHttpRequest.prototype.open = function () {

						console.log('__PHANTOMJS_EVENT__AJAX_STARTED;;||;;', this.readyState, ';;||;;');
						this.addEventListener('load', function () {

							if (this.readyState == 4) {
								console.log('__PHANTOMJS_EVENT__AJAX_COMPLETE ;;||;;', this.readyState, ';;||;;', this.responseText);
							}

						});
						origOpen.apply(this, arguments);
					};
				})();


			}, "")
				.then(() => {
					resolve();
				}).catch(err=> {
					browser.debug('Error 2992837');
					reject(err);
				});
		});


	}


	/**
	 * Wait the page is loaded (onload).
	 * @returns {Promise}
	 */
	loaded() {
		let browser = this;
		let debug = browser.debug;
		browser.lastUse = new Date().getTime();

		return new Promise((resolve, reject) => {
			debug("listen loaded");

			if (browser.isLoaded) {
				debug("isLoaded preview resolve");
				browser.isLoaded = false;
				resolve();
			} else {
				debug("register event onLoadFinished");

				browser.on('onLoadFinished', function () {
					browser.page.property('url')
						.then(function (currentURL) {
							debug("CurrentURL:> " + currentURL);
							browser.ajaxLoad()
								.then(() => {
									browser.debug('LoadFINISH : ' + currentURL);
									browser.isLoaded = false;
									browser.removeAllListeners('onLoadFinished');
									resolve(currentURL);
								})
								.then(() => {
									return browser.replaceEvents();
								});

						}).catch((err)=> {
							reject(err);
						});//end catch
				});//end on.onLoadfinished
			}//end else
		});
	}


	/**
	 * wait for url chage, fire a event (internal)
	 * @param url (the url for wait)
	 * @returns {Promise}
	 */
	waitForUrl(url) {
		let browser = this;
		browser.lastUse = new Date().getTime();

		return new Promise((resolve, reject) => {
			browser.page.property('url')
				.then((actualUrl) => {
					browser.debug("actualURL: ", actualUrl);

					if ((typeof (url) === 'string' && url === actualUrl) ||
						(url instanceof RegExp && url.test(actualUrl))) {
						browser.debug('waitForUrl matched! (first) ' + actualUrl);
						resolve(actualUrl);
					} else {

						var listener = function () {
							browser.debug('waitForUrl init event...');

							browser.page.property('url')
								.then((actualUrl)=> {

									if ((typeof (url) === 'string' && url === actualUrl) ||
										(url instanceof RegExp && url.test(actualUrl))) {
										browser.removeListener('onUrlChanged', listener);
										browser.debug('waitForUrl matched ' + actualUrl);

										resolve(actualUrl);
									} else {
										browser.debug('waitForUrl NOT matched ' + actualUrl + ' with ' + url);
										reject("waitForUrl NOT matched ");
									}
								});
						};

						browser.once('onUrlChanged', listener);
					}//end else

				});
		});
	}


	/**
	 * complete a field (input, for example) with value.
	 * @param selector (dom path to element)
	 * @param value (the string value for value property)
	 * @returns {Promise}
	 */
	fillField(selector, value, position) {
		let browser = this;
		let debug = browser.debug;
		position = position || 0;
		debug("fillField Called: " + selector + " : " + value);

		return new Promise((resolve, reject) => {

			if (value == null) {
				resolve("value is null");
				return;
			}

			browser
				.evaluate(
				function (selector, value, position) {
					var r = null;

					try {
						if (selector.split(" ").length == 1 && selector[0] == "#") {
							selector = selector.substr(1, selector.length);

							var element = document.getElementById(selector);
							if (element) {
								element.focus();
								element.value = value;
								r = true;

							} else {
								r = null;
							}
						} else {
							var element = document.querySelectorAll(selector);
							if (element && element[position]) {
								element[position].focus();
								element[position].value = value;
								r = true;
							} else {
								element = null;
							}

						}

						/**
						 * After fill, fire events: blur
						 */
						if (element !== null) {
							element.blur();
						}

						return r;
					} catch (e) {
						return null;
					}

				},
				selector,
				value,
				position)
				.then((result) => {
					if (result === null) {
						browser.debug('browser.fillField ' + selector + ' error,  selector: ' + selector + ' not foud: ');
						return reject('browser.fillField ' + selector + ' error,  selector: ' + selector + ' not foud: ');
					} else {
						browser.debug('browser.fillField succeded for ' + selector + ' with value ' + value);
						resolve();
					}//end else

				});
		});
	}

	/**
	 * Find text aparition into textContent property element
	 * @param selector (dom path)
	 * @param text (string to find, is partial text, not literal).
	 * @returns {Promise}
	 */
	findText(selector, text, literal) {
		let browser = this;
		literal = literal || false;

		return new Promise((resolve, reject) => {
			browser.evaluate(function (selector, text, literal) {
					var element = document.querySelector(selector);
					if (!element) return false;

					if (literal) {
						if (element.textContent == text) {
							return true;
						}
						else {
							return false;
						}
					} else {
						if (element.textContent.indexOf(text) > -1) {
							return true;
						}
						else {
							return false;
						}
					}//end else

				},
				selector,
				text,
				literal)
				.then((result) => {
					if (result) {
						browser.debug('findText ' + text + ' in ' + selector);
						resolve(result);
					} else {
						browser.debug('findText ' + text + ' in ' + selector + ' result: ' + result);
						reject("browser.findText: selector not found: " + selector);
					}

				});
		});
	}


	/**
	 * fill all fields passed to argument.
	 * @param fields (is a object, the key is the dom path, the value of key is value of value property)
	 * @returns {Promise}
	 */
	fillFields(fields) {
		let browser = this;
		let debug = this.debug;

		debug("fillfields is called ");
		let FillFunction = (browser, selector, value)=> {
			return ()=> {
				debug("fillfield from fillFields: " + selector + " : " + value);
				return browser.fillField(selector, value);
			}
		};

		return new Promise((resolve, reject) => {
			let pending = [];

			for (var k in fields) {
				pending.push(new FillFunction(browser, k, fields[k]));
			}

			let checkPending = () => {
				let current = pending.shift();
				if (!current) return resolve();
				current().then(checkPending, reject);
			};

			checkPending();
		});
	}


	/**
	 * get a screenshot of actualy page
	 * @param file (is optional, the the filename, isnt passed, the filename is the actual timestamp)
	 */
	screenshot(file) {
		let browser = this;
		let folder = browser.instanceID + "/";
		let path = browser.screenshotFolder;

		file = file || (new Date().getTime() + '.png');

		if (!fs.existsSync(path + "/" + folder)) {
			fs.mkdirSync(path + "/" + folder);
		}

		let fpath = path + "/" + folder + file;


		return new Promise((resolve, reject) => {
			browser.page.render(fpath)
				.then(() => {
					browser.debug('__SCREENSHOT__: ' + fpath);
					resolve(fpath, folder);
				}).catch((err) => {
					debug("Catch Browser.screenshot");
					reject(err);
				});//end catch
		});

	}

	/**
	 * Enabled a disabled dom element
	 * @param selector (is dom path)
	 * @returns {Promise}
	 */
	enabled(selector) {
		let browser = this;

		return new Promise((resolve, reject) => {
			browser.evaluate(function (selector) {
				var el = document.querySelector(selector);
				if (el) {
					el.disabled = null;
					return true;
				}
				else {
					return null;
				}
			}, selector)
				.then((r) => {
					if (r) {
						browser.debug('Enabling ' + selector + ' is ' + r);
						resolve();
					} else {
						browser.debug('No found ' + selector + ' is ' + r);
						reject("browser.enabled: selector not found: " + selector);
					}

				});
		});
	}


	/**
	 * Get the textContent form dom element
	 * @param selector (dom path)
	 * @returns {Promise}
	 */
	getText(selector) {
		let browser = this;

		return new Promise((resolve, reject) => {
			browser.evaluate(function (selector) {
				var el = document.querySelector(selector);
				if (el) return el.textContent;
				else return null;
			}, selector)
				.then((text) => {
					if (text) {
						resolve(text);
					} else {
						reject("getText : not found: " + selector);
					}

				});
		});
	}


	/**
	 * Check if a element/s exist into DOM. Everytime the method run the resolve pass like a argument true/false if exists or not the selector.
	 * If some error, the reject is called.
	 * @param selector
	 * @returns {Promise}
	 */
	exists(selector) {
		let browser = this;

		return new Promise((resolve, reject) => {
			browser.evaluate(function (selector) {

				if (document.getElementById(selector)) return true;
				else return false;
			}, selector)
				.then((r) => {
					if (r) resolve(true);
					else resolve(false);
				}, reject);
		});

	}

	/**
	 * set value for option and fire "onchange" event
	 * @param selector: query selector element
	 * @param value: the value for select tag
	 * @returns {Promise}
	 */
	select(selector, value, position) {
		let browser = this;
		position = position || 0;

		return new Promise((resolve, reject) => {

			if (value == null) {
				resolve("value is null");
				return;
			}

			browser.evaluate(function (selector, value, position) {

				var target = null;
				var only = false;

				if (selector.split(" ").length == 1 && selector[0] == "#") {
					selector = selector.substr(1, selector.length);
					target = document.getElementById(selector);
					only = true;
				} else {
					target = document.querySelectorAll(selector);
				}

				if (!only) target = target[position];

				if (target) {
					target.focus();
					var evt = document.createEvent("HTMLEvents");
					evt.initEvent("change", false, true);
					target.value = value;
					target.dispatchEvent(evt);
					target.blur();

					return true;
				} else {
					return false;
				}

			}, selector, value, position)
				.then((r) => {
					if (r) {
						browser.debug('browser.selector: select ok ' + selector + ' ' + value);
						resolve()
					} else {
						browser.debug('select with error: ' + selector + ' :  ' + value + ' ' + r);
						reject('browser.select: cant select ' + selector + ":" + value);
					}
				});
		});
	}


	/**
	 * Select (click) a element and fill the second associate element
	 * @param {string} sel1 - query selector for the first element (a radio for example).
	 * @param {string} val1 - the value for the first select
	 * @param sel2
	 * @param val2
	 * @returns {Promise}
	 */
	selectAndFill(sel1, val1, sel2, val2) {
		var browser = this;

		return new Promise((resolve, reject) => {
			if (!val1) {
				resolve();
			} else {
				browser.click(sel1)
					.then(() => {
						browser.fillField(sel2, val2)
					})
					.then(() => {
						browser.debug('selectAndFill finish without errors');
						resolve();
					}).catch((err) => {
						browser.debug('selectAndFill finish WITH ERRORS: ' + err.toString());
						reject(err);
					});
			}
		});
	}

	/**
	 * Do nothing, just return a promise
	 * @returns {Promise}
	 */
	none() {
		return Promise.resolve();
	}


	/**
	 * Sleep N seconds
	 * @param {integer} seconds - seconds to sleep
	 * @returns {Promise}
	 */
	sleep(seconds) {
		seconds = (seconds || 1) * 1000;
		let browser = this;
		browser.lastUse = new Date().getTime();

		return new Promise((resolve, reject) => {
			setTimeout(function () {
				browser.debug("browser.sleep done!");
				resolve(seconds);
			}, seconds);
		})

	}


	replaceEvents() {
		let browser = this;
		let debug = browser.debug;

		debug("replaceEvents Called");

		return new Promise((resolve, reject) => {
			browser.evaluate(function () {

				var eventsDefined = [];

				function __get__all__events(elements) {
					for (var x = 0; x < elements.length; x++) {
						var el = elements[x];
						var evts = jQuery._data(el, "events")
						if (evts) eventsDefined.push({Event: evts, Element: el});

					}//end for
				}


				function __bind__new__function() {

					for (var x = 0; x < eventsDefined.length; x++) {
						var target = eventsDefined[x].Event;
						var evts = Object.keys(target);

						for (var v = 0; v < evts.length; v++) {
							var binds = Object.keys(target[evts[v]]);
							for (var i = 0; i < binds.length; i++) {
								var bind = target[evts[v]][binds[i]];
								if (bind.handler) {
									(function (Element, bind) {
										var f = bind.handler;
										bind.handler = function () {
											return f.apply(null, arguments);
										};
									})(eventsDefined[x].Element, bind);
								}//end handler
							}//end for i==
						}//end for v

					}//end for
				}

				if ($ && $._data) {
					console.log("____________________________jQuery Loaded");
					__get__all__events($("a"));
					__get__all__events($("input"));
					__get__all__events($("textarea"));
					__bind__new__function();

				} else {
					console.log("_____________________________jQuery NOT LOADED!");
				}

			}).then(() => {
				resolve();
			}).catch((err) => {
				reject(err);
			});
		});

	}


}//end class Browser


utils.inherits(Browser, EventEmitter);


module.exports = Browser;
