const results = require("./modules/results");
const dirTree = require("directory-tree");
const time = require("./modules/time.js");
const url = require("url");
var fs = require('fs');
var express = require('express');
var app = express();
const cors = require('cors');
const constants = require("./modules/constants");
var MongoClient = require("mongodb").MongoClient;
const schedule = require("node-schedule");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
//CSV Writer
const csvWriter = createCsvWriter({
    //temp path for newly produced files
    path: 'out.csv',
    //format for the csv file
    header: [
        { id: 'name', title: 'Name' },
        { id: 'grade', title: 'Grade' },
        { id: 'id', title: 'ID' },
        { id: 'check_in', title: 'Time In' },
        { id: 'check_out', title: 'Time Out' },
    ]
});
//selecting the static file directory, which allows us to get the csv files.
app.use(express.static('archive'));
app.use(cors({
    //allows communication between the api site and the main site
    origin: 'https://alphaknights.xyz'
}));

//Generates the csv file once a day
const rule = new schedule.RecurrenceRule();
rule.hour = 18;
rule.minute = 00;
rule.tz = "America/Los_Angeles";

//Program to run once a day to generate the csv file
const job = schedule.scheduleJob(rule, async () => {
    console.log("auto")
    try {
        //connects to the mongodb server to read the data
        await MongoClient.connect(constants.url, async function (err, db) {
            if (err) {
                throw err
            };
            //selects the database named data
            var dbo = db.db("data");
            //selects the collection of the signin data.
            var ent = await dbo.collection("signin-data");
            //only creates the csv file if there are people who signed in during the day.
            if (await ent.countDocuments() > 0) {
                try {
                    //gets the sign in and out data and then checks to see if it was successfully produced.
                    await getSigninSheet(() => {
                        //checks the out put csv file
                        fs.readFile("./out.csv", function (error, content) {
                            if (error) {
                                throw error
                            }
                            else {
                                archive();
                            }
                        });
                    });

                } catch (error) {
                    console.log(error)
                }
            }
        });
    } catch (error) {
        console.log(error)
    }
});

//function to end the http request.
function end(req, res, success) {
    let q = url.parse(req.url, true).query;
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

//This http request is called when the user clicks check in, it will check the user's data and then if it is all valid it writes it to the sign in database
app.get('/entry/', async function (req, res) {
    let q = url.parse(req.url, true).query;
    let success = new results(true, 500, "Internal Server Error");

    if ((q.name == undefined || q.name == "")) {
        success = new results(false, 10, "No name given");
    }

    if (q.id == undefined || q.id == "") {
        success = new results(false, 11, "No id given");
    }

    if (q.grade == undefined || q.grade == "") {
        success = new results(false, 12, "No grade given");
    }
    if (success.success === true) {
        try {

            await MongoClient.connect(constants.url, async function (err, db) {
                if (err) {
                    success = new results(false, 31, "Mongodb failed: " + err)
                    throw err
                };
                var dbo = db.db("data");
                var col;
                var d = String("" + time.getDate() + "-" + time.getTime());
                col = dbo.collection("signin-data");
                col.insertOne({
                    name: q.name,
                    grade: q.grade,
                    id: q.id,
                    check_in: d,
                });
                success = new results(true, 0, "Success");
                end(req, res, success)
            });
        } catch (error) {
            success = new results(false, 31, "Failed to communicate with database");
            end(req, res, success);
        }
    } else {
        end(req, res, success);
    }
})


//This http request is called when the user clicks check out, it will check the user's data and then if it is all valid it writes it to the sign out database
app.get('/exit/', async function (req, res) {
    let q = url.parse(req.url, true).query;
    let success = new results(true, 500, "Internal Server Error");

    if ((q.name == undefined || q.name == "")) {
        success = new results(false, 10, "No name given");
    }

    if (q.id == undefined || q.id == "") {
        success = new results(false, 11, "No id given");
    }

    if (q.grade == undefined || q.grade == "") {
        success = new results(false, 12, "No grade given");
    }
    if (success.success === true) {
        try {

            await MongoClient.connect(constants.url, async function (err, db) {
                if (err) {
                    success = new results(false, 31, "Mongodb failed: " + err)
                    throw err
                };
                var dbo = db.db("data");
                var col;
                var d = String("" + time.getDate() + "-" + time.getTime());
                col = dbo.collection("signout-data");
                col.insertOne({
                    name: q.name,
                    grade: q.grade,
                    id: q.id,
                    check_out: d,
                });
                success = new results(true, 0, "Success");
                end(req, res, success)
            });
        } catch (error) {
            success = new results(false, 31, "Failed to communicate with database");
            end(req, res, success);
        }
    } else {
        end(req, res, success);
    }
})

//This http request is called when the api auto scheduler fails to run, this will also produce and then return the csv file.
app.get('/flush/', async function (req, res) {
    res.setHeader("Access-Control-Allow-Headers", "*");
    let success = new results(true, 500, "Internal Server Error");
    if (success.success === true) {
        try {

            await MongoClient.connect(constants.url, async function (err, db) {
                if (err) {
                    success = new results(false, 31, "Mongodb failed: " + err)
                    throw err;
                };
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
                                    res.end(req, res, success);
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
            });
        } catch (error) {
            success = new results(false, 31, "Failed to communicate with database");
            end(req, res, success);
        }
    } else {
        end(req, res, success);
    }
})

//This http request is called when the tree for the archive directory is needed, this will allow us to see what files we have from which days and where they are located.
app.get('/tree/', function (req, res) {
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.writeHead(200);
    const tree = dirTree("./archive");
    res.end(JSON.stringify(tree), 'utf-8');
})

//This is the catch all for the api website which gives us the server directory in an html file.
app.get('/', function (req, res) {
    res.sendFile(__dirname + "/" + "index.html");
})

//connects app to the http server
var server = app.listen(constants.PORT, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("Version: v"+constants.version)
    console.log("listening at http://%s:%s", "127.0.0.1", port)
})


async function genSheet(callback) {
    try {
        await MongoClient.connect(constants.url, async function (err, db) {
            if (err) throw err;
            var dbo = db.db("data");
            let entry = [];//sorted and cleaned array of every user that entered
            let exit = [];//sorted and cleaned array of every user that exited
            let tempentry = [];//list of every entry of each user that entered, it needs to be sorted due to possible duplicates
            let tempexit = [];//list of every exit of each user that exited, it needs to be sorted due to possible duplicates
            var ent = await dbo.collection("signin-data");
            var ext = await dbo.collection("signout-data");
            tempentry = await ent.find({}).toArray();
            tempexit = await ext.find({}).toArray();
            for (const item of tempentry) {
                if (item['name'].toString().indexOf("test") == -1) {//ignores any person with name test
                    var duplicate = false;//is there a duplicate?
                    for (const person of entry) {
                        if (person['id'] == item['id'] && person['date'] == item['date']) {
                            duplicate = true;//if there is a duplicate then it sets duplicate to true
                        }
                    }
                    if (!duplicate) entry.push(item);//if there is no duplicate then it pushes it to the list
                }
            }
            for (const item of tempexit) {
                if (item['name'].toString().indexOf("test") == -1) {//ignores any person with name test
                    var duplicate = false;//is there a duplicate?
                    for (const person of exit) {
                        if (person['id'] == item['id'] && person['date'] == item['date']) {
                            duplicate = true;//if there is a duplicate then it sets duplicate to true
                        }
                    }
                    if (!duplicate) exit.push(item);//if there is no duplicate then it pushes it to the list
                }
            }
            let signinSheet = [];//list of each user and their check in and out times
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
            //adds the singature part to the sheet
            signinSheet.push({
                name: 'Signature',
                grade: '',
                id: '',
                check_in: 'Date',
                check_out: ''
            })
            callback(signinSheet);
        });


    } catch (error) {

    }
}

//creates the sign in csv sheet
async function getSigninSheet(callback) {
    try {
        var s = await genSheet(async (s) => {
            if (s != null) {
                await csvWriter
                    .writeRecords(s)
                    .then(() => {
                        callback()
                    });
            }
        });
    } catch (error) {

    }

}

//moves the output file to the final place in the archive folder, then backs up and clears the mongodb for the next time.
async function archive() {
    let x = await time.getDate().toString() + "_" + await time.getTime().toString();
    move("./out.csv", "./archive/" + x + "_SigninSheet.csv", () => { })
    try {
        await save();
        await MongoClient.connect(constants.url, async function (err, db) {
            var dbo = db.db("data");
            var col;
            col = dbo.collection("signin-data");
            await col.drop().catch((err)=>{
                console.log(err)
            });
            col = dbo.collection("signout-data");
            await col.drop().catch((err)=>{
                console.log(err)
            });
        });
    } catch (error) {
    }
}

//backs up the mongodb server
async function save() {
    let x = await time.getDate().toString() + "_" + await time.getTime().toString();
    try {
        await MongoClient.connect(constants.url, async function (err, db) {
            if (err) throw err;
            var dbo = db.db("data");
            let tempentry = [];
            let tempexit = [];
            var ent = await dbo.collection("signin-data");
            var ext = await dbo.collection("signout-data");
            tempentry = await ent.find({}).toArray();
            tempexit = await ext.find({}).toArray();
            fs.writeFile(`\\backup\\${x}_signin.txt`, tempentry.toString(), function (err) {
                if (err) throw err;
            });
            fs.writeFile(`\\backup\\${x}_signout.txt`, tempexit.toString(), function (err) {
                if (err) throw err;
            });
        });


    } catch (error) {
        throw error
    }
}

//moves any file to another location
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