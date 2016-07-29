const Botkit = require('botkit')
const NATURAL = require('natural')
const CHRONO  = require('chrono-node')
const CALENDAR = require('./google_calendar_api')
const env = require('./.env.js')

// Programmatically use appropriate process environment variables
try {
  require('./.env.js');
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    console.log('Not using environment variables from env.js');
  }
}
var port = process.env.PORT || process.env.port;

if (!process.env.clientId || !process.env.clientSecret || !port) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

//Use REDIS store (MAKE SURE REDIS IS RUNNING- use redis-server in terminal)
var Redis_Store = require('./redis_storage.js');
var redis_url = "redis://127.0.0.1:6379"
var redis_store = new Redis_Store({url: redis_url});


//Labels
const HELLO = 'hello'
const WHIP = 'whip'
const TICKET = 'ticket'
const TODAY = 'today'
const RELEASE = 'release'
const RELEASE_MANAGER = 'release_manager'
const SPRINT = 'sprint'

// Initiate NLP classifier
const classifier = new NATURAL.BayesClassifier()

// Train classifier
classifier.addDocument('Hey', HELLO)
classifier.addDocument('Who is the next whip', WHIP)
classifier.addDocument('Who is on ticket duty', TICKET)
classifier.addDocument('What is happening today', TODAY)
classifier.addDocument('When is next release', RELEASE)
classifier.addDocument('Who is the next release manager', RELEASE_MANAGER)
classifier.addDocument('When does this sprint end', SPRINT)

classifier.train()

function getLabelFunctions(label){
  const labelFunctions = {
    'hello': function (bot, message) {
      CALENDAR.getEvents.then(function(events) {
        console.log(events)
        for (var i = 0; i < events.length; i++) {
          var event = events[i]
          var start = event.start.dateTime || event.start.date
          var hangoutLink = event.hangoutLink
          const botReply = start + " - " + event.summary
          console.log(botReply)
          bot.reply(message, botReply)
          // if ( hangoutLink ) console.log(hangoutLink);
        }
      }).catch(function(err){
        //What happens if the promise was rejected
        console.log(err)
      })
    },
    'whip': function (bot, message) {
      bot.reply(message, `label: ${WHIP}`)
    },
    'ticket': function (bot, message) {
      bot.reply(message, `label: ${TICKET}`)
    }
  }
  return labelFunctions[label]
}

const controller = Botkit.slackbot({
    debug: true,
    storage: redis_store
}).configureSlackApp(
  {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    scopes: ['bot'],
  }
)

controller.setupWebserver(port,function(err,webserver) {

  webserver.get('/',function(req,res) {
    res.sendFile('index.html', {root: __dirname});
  });

  controller.createWebhookEndpoints(controller.webserver);

  controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
    if (err) {
      res.status(500).send('ERROR: ' + err);
    } else {
      res.send('Success!');
    }
  });
});


// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var _bots = {}
function trackBot(bot) {
  _bots[bot.config.token] = bot
}

controller.on('create_bot',function(bot,config) {

  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function(err) {

      if (!err) {
        trackBot(bot)
      }

      bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
        if (err) {
          console.log(err)
        } else {
          convo.say('I am a bot that has just joined your team')
          convo.say('You must now /invite me to a channel so that I can be of use!')
        }
      })

    })
  }

})

//Handle slack bot mentions
controller.on('direct_message,direct_mention, mention', function(bot, message){
  // Run message through classifier
  const match = classifier.getClassifications(message.text)
  console.log("\n", JSON.stringify(match[0]))

  const label = match[0].label

  //TODO: Need code to determine if match is "good enough"

  //Match the detected label with the label's corresponding function
  getLabelFunctions(label)(bot, message)

})


controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var uptime = formatUptime(process.uptime())

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + '.')

    })

function getTeamById(teamId){
  console.log("Team ID: " + teamId)
  controller.storage.teams.get({id:teamId}, function(err, team){

    console.log("Team: " + team)

    if(err) return null
    else return team
  })
}

function saveTeam(teamID, name, whip){
  var newTeam = {
                  id: teamID,
                  name: name,
                  whip: whip
                }

  console.log("Saving team: " + newTeam)
  controller.storage.teams.save(newTeam, function(err) {
      if(err){
        bot.reply(message, 'Sorry I can\'t remember your team info now. Leave me alone')
      }
  })
}

function formatUptime(uptime) {
    var unit = 'second'
    if (uptime > 60) {
        uptime = uptime / 60
        unit = 'minute'
    }
    if (uptime > 60) {
        uptime = uptime / 60
        unit = 'hour'
    }
    if (uptime != 1) {
        unit = unit + 's'
    }

    uptime = uptime + ' ' + unit
    return uptime
}
