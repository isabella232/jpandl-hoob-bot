var app = require('./slack_bot')
var Promise = require("bluebird");
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

var readFile = Promise.promisify(require("fs").readFile);


// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';

// Load client secrets from a local file.
function getEvents(){
  return readFile('client_secret.json')
        .then(function(content){
            console.log(content)
            return authorize(JSON.parse(content))
        }).then(function(auth){
            return listEvents(auth)
        }).catch(function(err){
            console.log('Error loading client secret file: ' + err);
        })
}
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
  console.log("Made it here in authorize")
  // Check if we have previously stored a token.
  readFile(TOKEN_PATH).then(function(token){
    console.log("AUTH:" + token)
    return JSON.parse(token);
  })
  .catch(function(err){
    console.log("AUTH ERROR:" + err)
    return getNewToken(oauth2Client);
  })
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
var getNewToken = Promise.promisify(
  function (oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
      rl.close();
      oauth2Client.getToken(code, function(err, token) {
        if (err) {
          console.log('Error while trying to retrieve access token', err);
          return;
        }
        oauth2Client.credentials = token;
        storeToken(token);
        callback(oauth2Client);
      });
    });
  }
);

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}




//Do stuff///////////////////////
/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
  var calendar = google.calendar('v3');
  console.log("Listing Events:" + auth)

  return new Promise(function(resolve,reject){

    var request = gapi.client.calendar.events.list({
      'auth': auth,
      'calendarId': 'primary',
      'timeMin': (new Date()).toISOString(),
      'showDeleted': false,
      'singleEvents': true,
      'maxResults': 10,
      'orderBy': 'startTime'
    })

    request.execute(function(resp) {
      var events = resp.items;
      console.log(events)
      //After the request is executed, you will invoke the resolve function with the result as a parameter.
      resolve(events);
    })
  })
}

module.exports = {
  getEvents: getEvents
}
