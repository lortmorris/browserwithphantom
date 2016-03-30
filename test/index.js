var browser = new require("../index");

browser = new browser("mytest", {ttl: 60})

browser.ready()
    .then(()=>{
        return browser.browseTo('http://yahoo.com');
    })
    .then(()=>{
        return browser.loaded();
    })
    .then(()=>{
        return browser.fillField("#UHSearchBox", "node.js");
    })
    .then(()=>{
        return browser.click("#UHSearchWeb");
    })
    .then(()=>{
        return browser.loaded();
    })
    .then(()=>{
        return browser.screenshot();
    })
    .then(()=>{
        console.log("closing...");
       return browser.close();
    })
    .catch((err)=>{
        throw err;
    })
