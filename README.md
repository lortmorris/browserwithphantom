# Introduction

Use phantomjs from Node.js is very easy now!.


# Install
npm install browserwithphantom
 
# Example 
<pre>
var browser = require("browserwithphantom");

browser = new browser("mytest", {ttl: 60})

browser.ready()
    .then(()=>{
        return browser.browseTo('http://google.com');
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

</pre>
