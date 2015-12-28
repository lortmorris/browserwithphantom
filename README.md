# nodephatombrowser


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
