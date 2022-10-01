const time = require('./time');
const path = require('path');

class constants{
    static START = new time(15, 30);
    static END = new time(18, 0);
    static CLUB = "Robotics";
    static FILESTORAGE = __dirname;
    static PORT = 4001;
    static version = 1.0;
    static url = "mongodb://192.168.7.51:3001/";
}

module.exports = constants;