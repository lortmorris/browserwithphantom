# Introduction

Use phantomjs from Node.js is very easy now!.


# Install
npm install nodephatombrowser
 
# Example 
<pre>
var browser = new require("browser");
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
</pre>
