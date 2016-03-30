Introduction
========
Use phantomjs from Node.js is very easy now!.

# Install
```bash
$ npm install browserwithphantom --save
```
# Example 
```js
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
    
```

# Instance
The instance require two arguments, a instanceId (like a name for this instance), and the options (optional).

## options
```js
{
    ttl: 60, //the TTL for browser instance, if dont answser or use for this seconds, the instance close automatic.
    screenshotFolder: process.cwd()+"/screenshots", //the default folder for save screenshots.
    phantomjs: [], //arguments for phantomjs instance.
    debug: null //the instance of Debug. If null, the browser instance use default debug lib.
}
```

# Methods

## browseTo(url)
Open the URL Web Page. Return Promise
Can be HTTP or HTTPS.
```js
browser.browseTo("http://google.com");
```

## loaded
Waiting for load page. Return a promise. 
```js
browser.broseTo("http://google.com")
    .then(()=>{ return browser.loaded(); });
```

## fillField(selector, value);
Fill (set value property) in HTML element. Require 2 arguments, the css selector and the value to set.
```js
browser.fillField("input.gsfi", "node.js");
```

## fillFields(object);
this methods call to .fillField, each a object (key like as selector).
```js
borser.fillField({
    '#username': 'theusername',
    '#password': 'thepassword'
});
```

## click(selector, [index])
Click in HTML element. Require 2 arguments, the css selector and the index (if the selector return more than 1 result, by default is 0).
```js
broser.click(".jsb input",0);
```

## screenshot()
This method get a screenshot of current webpage opened.
Default folder is: process.cwd()+"/screenshots". You can set the default folder using the property "screenshotFolder" when create the browser instance.
Return Promise

```js
browser.screenshot()
    .then((file)=> {
        console.log("screenshot saved: ", file);
    });
```

## waitAjaxComplete()
Wait for ajax request is completed. Return Promise

```js
 browser.waitAjaxComplete()
    .then(()=> {
        console.log("ajax request is completed!");
    });
```

## evaluate
Run JavaScript code into PhantomJS instance. Return Promise
```js
browser.evaluate(function(){
    console.log("inside phantomjs!");
});
```
## findText(selector, text, [literal]);
Search text into textContent property. If literal argument == true, search literal expression, else search first occurrence.
```
browser.findText("h2.title, "Welcome")
    .then((e)=>{
        console.log(e);
    });
```

## enabled(selector);
Enabled or disabled a selector (form element);
```js
browser.enabled("input.username");
```

## getText(selector);
return the textContent property from selector.
```js
    browser.getText("a.userInfo")
        .then((text)=>{
            console.log(text);
        });
```

## exists(selector);
Check if exists some elemento by selector.

```js
 browser.exists("a.logout")
    .then((e){
        console.log(e); 
    });
```

## select(selector, value, [position])
Select some option (by value) in select element. If you have more than one select element, can use position property.

```js
    browser.select("select.countries", "54");
```
## sleep(seconds);
Wait for N seconds and return Promise.
```js
    browser.sleep(2);
```

