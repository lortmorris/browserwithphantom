var browser = new require("../index");

browser = new browser("mytest", {ttl: 60});

browser.ready()
	.then(()=> {
		return browser.browseTo('https://ar.linkedin.com/in/cesarcasas');
	})
	.then(()=> {
		return browser.loaded();
	})
	.then(()=> {
		return browser.screenshot();
	})
	.then(()=> {
		console.log("closing...");
		return browser.close();
	})
	.catch((err)=> {
		throw err;
	});
