var browser = new require("../index");

browser = new browser("mytest", {ttl: 60})

browser.ready()
    .then(function(){
        return browser.browseTo('http://google.com');
    })
    .then(function(){
        return browser.loaded();
    })
    .then(function(){
        return browser.screenshot();
    })
    .then(function(){
        browser.close();
    })
