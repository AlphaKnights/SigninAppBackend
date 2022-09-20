const results = require("./modules/results");
const time = require("./modules/time.js");
const http = require("http");
const url = require("url");
var fs = require('fs');
var path = require('path');
const constants = require("./modules/constants");
var MongoClient = require("mongodb").MongoClient;
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: 'out.csv',
  header: [
    { id: 'name', title: 'Name' },
    { id: 'grade', title: 'Grade' },
    { id: 'id', title: 'ID' },
    { id: 'check_in', title: 'Time In' },
    { id: 'check_out', title: 'Time Out' },
  ]
});

http
  .createServer(async function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Request-Method", "*");
    res.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "*");
    let q = url.parse(req.url, true).query;
    const u = req.url.split("?")[0];
    let success = new results(true, 500, "Internal Server Error");

    // if (u === "/flush/") {
    //   res.writeHead(200, { "Content-Type": "attachment;filename=myfilename.csv" });
    // }
    if(u !== "/flush/") {
      if ((q.name == undefined || q.name == "")) {
        success = new results(false, 10, "No name given");
      }

      if (q.id == undefined || q.id == "") {
        success = new results(false, 11, "No id given");
      }

      if (q.grade == undefined || q.grade == "") {
        success = new results(false, 12, "No grade given");
      }
    }
    if (success.success === true) {
      try {
        
      await MongoClient.connect(constants.url, async function (err, db) {
        if (err) {success = new results(false, 31, "Mongodb failed: " + err)
      throw err};
        var dbo = db.db("data");
        var col;
        var d = String("" + time.getDate() + "-" + time.getTime());
        if (u === "/entry/") {
          col = dbo.collection("signin-data");
          col.insertOne({
            name: q.name,
            grade: q.grade,
            id: q.id,
            check_in: d,
          });
          success = new results(true, 0, "Success");
          end()
        } else if (u === "/exit/") {
          col = dbo.collection("signout-data");
          col.insertOne({
            name: q.name,
            grade: q.grade,
            id: q.id,
            check_out: d,
          });
          success = new results(true, 0, "Success");
          end()
        } else if (u === "/flush/") {
          try {
          await getSigninSheet(() => {
            fs.readFile("./out.csv", function (error, content) {
              if (error) {
                if (error.code == 'ENOENT') {
                  fs.readFile('./404.html', function (error, content) {
                    res.writeHead(200, { 'Content-Type': "text/html" });
                    res.end(content, 'utf-8');
                  });
                }
                else {
                  res.writeHead(500);
                  res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
                  res.end();
                }
              }
              else {
                archive();
                res.writeHead(200, { 'Content-Type': "attachment;filename=myfilename.csv" });
                res.end(content, 'utf-8');
              }
            });
          });
            
        } catch (error) {
          console.log(error)
        }
        }
        c = true;
        // db.close();
      });
    } catch (error) {
      
    }
    } else {
      end();
    }
    function end() {
      res.writeHead(200, { "Content-Type": "text/json" });
      res.end(
        JSON.stringify({
          success: success.success,
          reason: success.reason,
          code: success.code,
          login: q.login,
        })
      );
    }
  })
  .listen(constants.PORT);
console.log("Listening on 127.0.0.1:" + constants.PORT);


async function genSheet(callback) {
  try {
  await MongoClient.connect(constants.url, async function (err, db) {
    if (err) throw err;
    var dbo = db.db("data");
    let entry = [];
    let exit = [];
    let tempentry = [];
    let tempexit = [];
    var ent = await dbo.collection("signin-data");
    var ext = await dbo.collection("signout-data");
    tempentry = await ent.find({}).toArray();
    tempexit = await ext.find({}).toArray();
    for (const item of tempentry) {
      if (item['name'].toString().indexOf("test") == -1) {
        var exists = false;
        for (const person of entry) {
          if (person['id'] == item['id'] && person['date'] == item['date']) {
            exists = true;
          }
        }
        if (!exists) entry.push(item);
      }
    }
    for (const item of tempexit) {
      if (item['name'].toString().indexOf("test") == -1) {
        var exists = false;
        for (const person of exit) {
          if (person['id'] == item['id'] && person['date'] == item['date']) {
            exists = true;
          }
        }
        if (!exists) exit.push(item);
      }
    }
    let signinSheet = [];
    for (const person of entry) {
      var exists = false;
      var exitData;
      for (const exitPerson of exit) {
        if (person['id'] == exitPerson['id'] && person['date'] == exitPerson['date']) {
          exists = true;
          exitData = exitPerson;
          continue;
        }
      }
      if (exists) {
        signinSheet.push({
          name: person['name'],
          grade: person['grade'],
          id: person['id'],
          check_in: person['check_in'],
          check_out: exitData['check_out']
        })
      }
      else {
        signinSheet.push({
          name: person['name'],
          grade: person['grade'],
          id: person['id'],
          check_in: person['check_in'],
          check_out: person['check_in'].toString().substring(0, 11) + "18:00:00"
        })
      }
    }
    callback(signinSheet);
    // db.close();
  });
  
    
} catch (error) {
    
}
}

async function getSigninSheet(callback) {
  try {
    var s = await genSheet(async (s) => {
    if (s != null) {
      await csvWriter
        .writeRecords(s)
        .then(() => {
          console.log('The CSV file was written successfully');
          callback()
        });
    }
  });
  } catch (error) {
    
  }
  
}


async function archive() {
  move("./out.csv", "./archive/"+time.getDate().toString()+":"+time.getTime().toString()+"_SigninSheet.csv", ()=>{})
  try {
    await MongoClient.connect(constants.url, async function (err, db) {
      if (err) throw err;
      var dbo = db.db("data");
      var col;
      col = dbo.collection("signin-data");
      await col.drop();
      col = dbo.collection("signout-data");
      await col.drop();
      // db.close();
    });
  } catch (error) {
    
  }
}

function move(oldPath, newPath, callback) {

  fs.rename(oldPath, newPath, function (err) {
      if (err) {
          if (err.code === 'EXDEV') {
              copy();
          } else {
              callback(err);
          }
          return;
      }
      callback();
  });

  function copy() {
      var readStream = fs.createReadStream(oldPath);
      var writeStream = fs.createWriteStream(newPath);

      readStream.on('error', callback);
      writeStream.on('error', callback);

      readStream.on('close', function () {
          fs.unlink(oldPath, callback);
      });

      readStream.pipe(writeStream);
  }
}