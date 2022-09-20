const time = require('./time');
console.log(("-" + time.getDate() +"_"+ time.getTime().toString() + ".csv"));
console.log(("-" + time.getDate() +"_"+ time.getTime().toString() + ".csv").replace(":","_").replace(" ", "_").replace(" ", "_"));