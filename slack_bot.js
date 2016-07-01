var Botkit = require('botkit');

var controller = Botkit.slackbot({
    debug: true,
    interactive_replies: true,
    json_file_store: './bot_storage'
})

var bot = controller.spawn({
    token: 'xoxb-56251165760-vMGA7knE8DMMMLE9hCg8YOx6'
})

bot.startRTM(function(err,bot,payload){
  if(err){
    throw new Error('Could not connect to Slack')
  }
})

controller.hears(['who\'s the whip', 'whos the whip', 'whos whip'], 'direct_message,direct_mention,mention',
  function(bot, message){
    var team = message.team
    controller.storage.teams.get(team, function(err, team_data) {
      if(err || !team_data){
        saveTeam(team)
        bot.reply(message, 'There is no whip!');
      }
      else if(team_data.whip && team_data.whip.name){
          bot.reply(message, 'The whip is ' + team_data.whip.name + '!!');
      }
      else {
          bot.reply(message, 'There is no whip!');
      }
    })
  })

controller.hears(['set the whip', 'set whip', 'pick a whip', 'pick whip'], 'direct_message,direct_mention,mention,ambient',
  function(bot, message) {
    var team = {id: message.team};
    controller.storage.teams.get(team.id, function(err, foundTeam){
      console.log("Team: " + foundTeam)
    })
    team.whip = {name: "Baldvin"}
    saveTeam(team.id, team.name, team.whip)
  })

controller.hears(['hello', 'waddup', 'yo'], 'direct_message,direct_mention,mention', function(bot, message) {
  console.log(message)
    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    })


    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    })
})

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function(response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, {'key': 'nickname'}); // store the results in a field called nickname

                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function(err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });

                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});


controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function() {
                        process.exit();
                    }, 3000);
                }
            },
        {
            pattern: bot.utterances.no,
            default: true,
            callback: function(response, convo) {
                convo.say('*Phew!*');
                convo.next();
            }
        }
        ]);
    });
});


controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + '.');

    });

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
        bot.reply(message, 'Sorry I can\'t remember your team info now. Leave me alone');
      }
  })
}

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
