var glicko2 = require("glicko2"),
    ranking = new glicko2.Glicko2({
        tau: 0.75,
        rating: 1500,
        rd: 200,
        vol: 0.06
    }),
    pjson = require("./package.json"),
    settings = require("./settings"),
    db = require("./database"),
    WebSocket = require("ws"),
    wss = new WebSocket.Server({port: 42423}),
    messageParse = /^!([^\ ]+)(?:\ +(.*[^\ ]+))?\ *$/,
    idParse = /^<@!?([0-9]+)>$/,
    twoIdParse = /^<@!?([0-9]+)>\ <@!?([0-9]+)>$/,
    setHomeParse = /^<@!?([0-9]+)> (.*)$/,
    forceMatchReportParse = /^<@!?([0-9]+)>\ <@!?([0-9]+)>\ (-?[0-9]+)\ (-?[0-9]+)$/,
    reportParse = /^(-?[0-9]+)\ (-?[0-9]+)$/,
    noPermissions = {
        CREATE_INSTANT_INVITE: false,
        ADD_REACTIONS: false,
        READ_MESSAGES: false,
        SEND_MESSAGES: false,
        SEND_TTS_MESSAGES: false,
        EMBED_LINKS: false,
        ATTACH_FILES: false,
        READ_MESSAGE_HISTORY: false,
        MENTION_EVERYONE: false,
        CONNECT: false,
        SPEAK: false,
        USE_VAD: false
    },
    textPermissions = {
        CREATE_INSTANT_INVITE: true,
        ADD_REACTIONS: true,
        READ_MESSAGES: true,
        SEND_MESSAGES: true,
        SEND_TTS_MESSAGES: true,
        EMBED_LINKS: true,
        ATTACH_FILES: true,
        READ_MESSAGE_HISTORY: true,
        MENTION_EVERYONE: true
    },
    voicePermissions = {
        CONNECT: true,
        SPEAK: true,
        USE_VAD: true
    },

    Fusion = {},
    tmiCooldown = {},
    discordCooldown = {},

    tmi, discord, obsDiscord, generalChannel, resultsChannel, roncli, eventRole, seasonRole, event;

wss.broadcast = (message) => {
    message = JSON.stringify(message);

    wss.clients.forEach((client) => {
        client.send(message);
    });
};

wss.on("connection", function(ws) {
    ws.on("message", function(data) {
        var message = JSON.parse(data);

        if (!event) {
            return;
        }
        
        switch (message.type) {
            case "standings":
                let players = {},
                    sortedPlayers;
                
                Object.keys(event.players).forEach((id) => {
                    var displayName = obsDiscord.members.get(id).displayName;

                    players[displayName] = {
                        name: displayName,
                        score: 0,
                        home: event.players[id].home
                    };
                });

                event.matches.filter((m) => m.winner).forEach((match) => {
                    match.players.forEach((id) => {
                        var player = obsDiscord.members.get(id);

                        if (match.winner === id) {
                            players[player.displayName].score++;
                        }
                    });
                });
                
                sortedPlayers = Object.keys(players).map((name) => {
                    return players[name];
                }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
                
                ws.send(JSON.stringify({
                    type: "standings",
                    players: sortedPlayers
                }));
                
                break;
            case "results":
                var matches = event.matches.filter((m) => m.winner).map((match) => {
                    var player1id = match.winner,
                        player2id = match.players.filter((p) => p !== match.winner)[0],
                        player1 = obsDiscord.members.get(player1id),
                        player2 = obsDiscord.members.get(player2id);
                    
                    return {
                        player1: player1.displayName,
                        player2: player2.displayName,
                        score1: match.score[0],
                        score2: match.score[1],
                        home: match.homeSelected
                    };
                });
                
                ws.send(JSON.stringify({
                    type: "results",
                    matches: matches
                }));
                break;
        }
    });
});

Fusion.start = (_tmi, _discord) => {
    "use strict";
    
    tmi = _tmi;
    discord = _discord;
    
    var startup = () => {
        var readied = false,
        
            tmiConnect = () => {
                console.log("Connecting to IRC...");
                
                tmi.connect().then(() => {
                    console.log("Connected.  Startup complete.");
                }).catch((err) => {
                    console.log("Error connecting, will retry.");
                    console.log(err);
                });
            },
            
            discordConnect = () => {
                console.log("Connecting to Discord...");
                discord.login(settings.discord.token).catch((err) => {
                    if (err) {
                        console.log(err);
                        discord.destroy().then(discordConnect).catch(discordConnect);
                    }
                    console.log("Connected.");
                });
            };
        
        console.log("Starting up...");
        
        // Setup events.
        tmi.on("disconnected", (message) => {
            console.log("DISCONNECTED", message);
            tmi.disconnect().then(() => {
                tmiConnect();
            }).catch(() => {
                tmiConnect();
            });
        });
        
        tmi.on("message", (channel, userstate, text, self) => {
            if (!self && channel === "#roncli") {
                Fusion.tmiMessage(userstate["display-name"], text);
            }
        });
        
        discord.on("ready", () => {
            console.log("Discord ready.");
            obsDiscord = discord.guilds.find("name", "The Observatory");
            generalChannel = obsDiscord.channels.find("name", "general");
            resultsChannel = obsDiscord.channels.find("name", "match-results");
            eventRole = obsDiscord.roles.find("name", "In Current Event");
            seasonRole = obsDiscord.roles.find("name", "Season 2 Participant");
            roncli = obsDiscord.owner;
            
            if (!readied) {
                readied = true;
                
                // Connect to IRC.
                tmiConnect();
            }
        });
        
        discord.on("message", (message) => {
            var author;

            if (message.guild && message.guild.name === obsDiscord.name) {
                author = obsDiscord.members.get(message.author.id);
                Fusion.discordMessage(author.displayName, author, message.channel, message.content);
            } else if (!message.guild) {
                Fusion.discordMessage(message.author.username, message.author, message.channel, message.content);
            }
        });

        discordConnect();
    };

    startup();
};

Fusion.isAdmin = (user) => {
    "use strict";

    if (user.user) {
        user = user.user;
    }

    return user.username === settings.admin.username && user.discriminator === settings.admin.discriminator;
};

Fusion.getPlayers = () => new Promise((resolve, reject) => {
    "use strict";

    db.query("SELECT PlayerID, Name, DiscordID, Rating, RatingDeviation, Volatility from tblPlayer", {}).then((data) => {
        resolve(data[0]);
    }).catch((err) => {
        console.log(err);
        reject(err);
    });
});

Fusion.resultsText = (match) => {
    var player1 = obsDiscord.members.get(match.winner),
        player2 = obsDiscord.members.get(match.players.find((p) => p !== match.winner)),
        str = "```" + player1.displayName + " " + match.score[0] + ", " + player2.displayName + " " + match.score[1] + ", " + match.homeSelected + "```";

    if (match.comments) {
        Object.keys(match.comments).forEach((id) => {
            str += "\n" + obsDiscord.members.get(id).displayName + ": " + match.comments[id];
        });
    }
    
    return str;
};

Fusion.tmiQueue = (message) => {
    "use strict";

    tmi.say("roncli", message);
};

Fusion.discordQueue = (message, channel) => new Promise((resolve, reject) => {
    "use strict";

    if (!channel) {
        channel = generalChannel;
    }
    
    channel.sendMessage(message).then((message) => resolve(message));
});

Fusion.tmiMessage = (from, text) => {
    "use strict";

    var matches = messageParse.exec(text);
    
    if (matches) {
        if (Fusion.tmiMessages[matches[1]]) {
            Fusion.tmiMessages[matches[1]].call(this, from, matches[2]);
        }
    }
};

Fusion.tmiMessages = {
    version: (from, message) => {
        "use strict";
        
        if (message || tmiCooldown.version > new Date()) {
            return;
        }
        
        Fusion.tmiQueue("FusionBot, DescentBot, whatever, I have an identity crisis.  Written by roncli, Version " + pjson.version);
        
        tmiCooldown.version = new Date(new Date().getTime() + 60000);
    },
    
    discord: (from, message) => {
        "use strict";
        
        if (message || tmiCooldown.discord > new Date()) {
            return;
        }
        
        Fusion.tmiQueue("Interested in playing in the tournament?  All skill levels are welcome!  Join our Discord server at http://ronc.li/obs-discord!");
        
        tmiCooldown.discord = new Date(new Date().getTime() + 60000);
    },
    
    website: (from, message) => {
        "use strict";
        
        if (message || tmiCooldown.website > new Date()) {
            return;
        }
        
        Fusion.tmiQueue("Visit The Observatory on the web at http://roncli.com/gaming/the-observatory!");
        
        tmiCooldown.discord = new Date(new Date().getTime() + 60000);
    }
};

Fusion.discordMessage = (from, user, channel, text) => {
    "use strict";

    var matches = messageParse.exec(text);

    if (matches) {
        if (Fusion.discordMessages[matches[1]]) {
            Fusion.discordMessages[matches[1]].call(this, from, user, channel, matches[2]);
        }
    }
};

Fusion.discordMessages = {
    version: (from, user, channel, message) => {
        "use strict";
        
        if (message || discordCooldown.version > new Date()) {
            return;
        }
        
        Fusion.discordQueue("FusionBot, or DescentBot, whatever, I have an identity crisis.  Written by roncli, Version " + pjson.version, channel);
        
        discordCooldown.version = new Date(new Date().getTime() + 60000);
    },
    
    join: (from, user, channel, message) => {
        "use strict";

        if (message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        if (!event.joinable) {
            Fusion.discordQueue("Sorry, " + user + ", but this is not an event you can join.", channel);
            return;
        }

        if (event.players[user.id] && !event.players[user.id].withdrawn) {
            Fusion.discordQueue("Sorry, " + user + ", but you have already joined this event.  You can use `!withdraw` to leave it.", channel);
            return;
        }

        db.query(
            "SELECT Home FROM tblHome WHERE DiscordID = @discordId",
            {discordId: {type: db.VARCHAR(50), value: user.id}}
        ).then((data) => {
            var homes = data[0] && data[0].length || 0;

            if (homes < 3) {
                Fusion.discordQueue("Sorry, " + user + ", but you have not yet set all 3 home levels.  Please use the `!home` command to select 3 home levels, one at a time, for example, `!home Logic x2`.", channel);
                return;
            }

            if (event.players[user.id]) {
                delete event.players[user.id].withdrawn;
            } else {
                event.players[user.id] = {
                    home: data[0].map(m => m.Home),
                    canHost: true
                };
            }
            user.addRole(eventRole);

            wss.broadcast({
                type: "addplayer",
                match: {
                    player: obsDiscord.members.get(user.id).displayName
                }
            });
            
            Fusion.discordQueue("You have been successfully added to the event.  I assume you can host games, but if you cannot please issue the `!host` command to toggle this option.", user);
            Fusion.discordQueue(obsDiscord.members.get(user.id).displayName + " has joined the tournament!", generalChannel);
        }).catch((err) => {
            Fusion.discordQueue("Sorry, " + user + ", but there was a server error.  roncli will be notified about this.", channel);
            Fusion.discordQueue("There was a server error contacting the database when checking whether " + obsDiscord.members.get(user.id).displayName + " has 3 home levels to join the event. :(", roncli);
            console.log(err);
            return;
        });
    },
    
    withdraw: (from, user, channel, message) => {
        "use strict";

        if (message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        if (!event.joinable) {
            Fusion.discordQueue("Sorry, " + user + ", but this is not an event you can withdraw from.", channel);
            return;
        }

        if (!event.players[user.id]) {
            Fusion.discordQueue("Sorry, " + user + ", but you have not yet entered this event.  You can use `!join` to enter it.", channel);
            return;
        }

        if (event.players[user.id].withdrawn) {
            Fusion.discordQueue("Sorry, " + user + ", but you have have already withdrawn from this event.  You can use `!join` to re-enter it.", channel);
            return;
        }

        event.players[user.id].withdrawn = true;
        user.removeRole(eventRole);
        Fusion.discordQueue("You have been successfully withdrawn from the event.  If you wish to return before the end of the event, you may use the `!join` command once again.", user);
        Fusion.discordQueue(obsDiscord.members.get(user.id).displayName + " has withdrawn from the tournament!", generalChannel);
    },
    
    home: (from, user, channel, message) => {
        "use strict";
        
        if (!message) {
            return;
        }

        db.query(
            "SELECT COUNT(Home) Homes FROM tblHome WHERE DiscordID = @discordId",
            {discordId: {type: db.VARCHAR(50), value: user.id}}
        ).then((data) => {
            var homes = data[0] && data[0][0] && data[0][0].Homes || 0;

            if (homes >= 3) {
                Fusion.discordQueue("Sorry, " + user + ", but you have already set 3 home levels.  If you haven't played a match yet, you can use `!resethome` to reset your home level selections.", channel);
                return;
            }

            db.query(
                "INSERT INTO tblHome (DiscordID, Home) VALUES (@discordId, @home)",
                {
                    discordId: {type: db.VARCHAR(50), value: user.id},
                    home: {type: db.VARCHAR(50), value: message}
                }
            ).then(() => {
                Fusion.discordQueue("You have successfully set one of your home levels to `" + message + "`.  You may set " + (2 - homes) + " more home level" + (homes === 1 ? "" : "s") + ". You can use `!resethome` at any point prior to playing a match to reset your home levels.", user);
            }).catch((err) => {
                Fusion.discordQueue("Sorry, " + user + ", but there was a server error.  roncli will be notified about this.", channel);
                Fusion.discordQueue("There was a server error contacting the database when setting one of " + obsDiscord.members.get(user.id).displayName + "'s home level. :(", roncli);
                console.log(err);
                return;
            });
        }).catch((err) => {
            Fusion.discordQueue("Sorry, " + user + ", but there was a server error.  roncli will be notified about this.", channel);
            Fusion.discordQueue("There was a server error contacting the database when checking whether " + obsDiscord.members.get(user.id).displayName + " has less than 3 home levels to add another. :(", roncli);
            console.log(err);
            return;
        });
    },
    
    resethome: (from, user, channel, message) => {
        "use strict";

        if (message) {
            return;
        }

        db.query(
            "SELECT TOP 1 Locked FROM tblHome WHERE DiscordID = @discordId ORDER BY Locked DESC",
            {discordId: {type: db.VARCHAR(50), value: user.id}}
        ).then((data) => {
            if (data[0] && data[0].length === 0) {
                Fusion.discordQueue("Sorry, " + user + ", but you haven't set any home levels yet.  Please use the `!home` command to select 3 home levels, one at a time, for example, `!home Logic x2`.", channel);
                return;
            }

            if (data[0] && data[0][0] && data[0][0].Locked) {
                Fusion.discordQueue("Sorry, " + user + ", but your home levels are set for the season.", channel);
                return;
            }

            db.query(
                "DELETE FROM tblHome WHERE DiscordID = @discordId",
                {discordId: {type: db.VARCHAR(50), value: user.id}}
            ).then(() => {
                Fusion.discordQueue("You have successfully cleared your home levels.  Please use the `!home` command to select 3 home levels, one at a time, for example, `!home Logic x2`.", user);
            }).catch((err) => {
                Fusion.discordQueue("Sorry, " + user + ", but there was a server error.  roncli will be notified about this.", channel);
                Fusion.discordQueue("There was a server error contacting the database when clearing " + obsDiscord.members.get(user.id).displayName + "'s home levels. :(", roncli);
                console.log(err);
                return;
            });
        }).catch((err) => {
            Fusion.discordQueue("Sorry, " + user + ", but there was a server error.  roncli will be notified about this.", channel);
            Fusion.discordQueue("There was a server error contacting the database when checking whether " + obsDiscord.members.get(user.id).displayName + " is locked out from changing home levels. :(", roncli);
            console.log(err);
            return;
        });
    },

    homelist: (from, user, channel, message) => {
        "use strict";

        if (message) {
            return;
        }

        db.query("SELECT DiscordID, Home FROM tblHome", {} ).then((data) => {
            var homes = {},
                str = "";

            if (data[0] && data[0].length > 0) {
                data[0].forEach((row) => {
                    if (!homes[row.DiscordID]) {
                        homes[row.DiscordID] = [];
                    }

                    homes[row.DiscordID].push(row.Home);
                });

                str = "Home levels for the season:";
                Object.keys(homes).forEach((discordId) => {
                    str += "\n" + obsDiscord.members.get(discordId).displayName + ": `" + homes[discordId].join("`, `") + "`";
                });
                Fusion.discordQueue(str, user);
            }
        }).catch((err) => {
            Fusion.discordQueue("Sorry, " + user + ", but there was a server error.  roncli will be notified about this.", channel);
            Fusion.discordQueue("There was a server error contacting the database when checking whether " + obsDiscord.members.get(user.id).displayName + " has 3 home levels to join the event. :(", roncli);
            console.log(err);
            return;
        });
    },

    standings: (from, user, channel, message) => {
        "use strict";

        var players = {},
            sortedPlayers,
            str = "";
        
        if (message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        Object.keys(event.players).forEach((id) => {
            var displayName = obsDiscord.members.get(id).displayName;

            players[displayName] = {
                name: displayName,
                score: 0,
                home: event.players[id].home
            };
        });

        event.matches.filter((m) => m.winner).forEach((match) => {
            match.players.forEach((id) => {
                var player = obsDiscord.members.get(id);

                if (match.winner === id) {
                    players[player.displayName].score++;
                }
            });
        });
        
        sortedPlayers = Object.keys(players).map((name) => {
            return players[name];
        }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
        
        str = "Standings:";

        sortedPlayers.forEach((player, index) => {
            str += "\n" + (index + 1).toFixed(0) + ") " + player.name + " - " + player.score;
        });

        Fusion.discordQueue(str, user);
    },

    host: (from, user, channel, message) => {
        "use strict";
        
        if (message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        if (!event.players[user.id]) {
            if (event.joinable) {
                Fusion.discordQueue("Sorry, " + user + ", but you first need to `!join` the tournament before toggling your ability to host games.", channel);
                return;
            } else {
                Fusion.discordQueue("Sorry, " + user + ", but you are not entered into this tournament.", channel);
                return;
            }
        }

        if (event.players[user.id].withdrawn) {
            Fusion.discordQueue("Sorry, " + user + ", but you have withdrawn from the tournament.", channel);
            return;
        }

        if (event.round && event.round > 0 || event.matches && event.matches.length > 0) {
            Fusion.discordQueue("Sorry, " + user + ", but you cannot toggle your ability to host games after the tournament has started.", channel);
            return;
        }

        event.players[user.id].canHost = !event.players[user.id].canHost;
        Fusion.discordQueue("You have successfully toggled " + (event.players[user.id].canHost ? "on" : "off") + " your ability to host games.  You may change it at any time before the tournament begins.", user);
        Fusion.discordQueue(obsDiscord.members.get(user.id).displayName + " has set toggled " + (event.players[user.id].canHost ? "on" : "off") + " their ability to host games.", generalChannel);
    },
    
    report: (from, user, channel, message) => {
        "use strict";
        
        var matches, score1, score2, eventMatch, player2;

        if (!message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        if (!event.joinable) {
            Fusion.discordQueue("Sorry, " + user + ", but this is not an event that you can report games in.", channel);
            return;
        }

        matches = reportParse.exec(message);
        if (!matches) {
            Fusion.discordQueue("Sorry, " + user + ", but you you must report the score in the following format: `!report 20 12`", channel);
            return;
        }

        eventMatch = event.matches.filter((m) => !m.cancelled && m.players.indexOf(user.id) !== -1 && !m.winner)[0];
        if (!eventMatch) {
            Fusion.discordQueue("Sorry, " + user + ", but I cannot find a match available for you.", channel);
            return;
        }

        if (!eventMatch.homeSelected) {
            Fusion.discordQueue("Sorry, " + user + ", but no home level has been set for your match.  See the instructions in " + eventMatch.channel + " to get a home level selected for this match.", channel);
            return;
        }

        score1 = +matches[1];
        score2 = +matches[2];

        // Allow reporting out of order.
        if (score1 < score2) {
            let temp = score1;
            score1 = score2;
            score2 = temp;
        }

        if (score1 < 20 || score1 === 20 && score1 - score2 < 2 || score1 > 20 && score1 - score2 !== 2) {
            Fusion.discordQueue("Sorry, " + user + ", but that is an invalid score.  Games must be played to 20, and you must win by 2 points.", channel);
            return;
        }

        player2 = obsDiscord.members.get(eventMatch.players.filter((p) => p !== user.id)[0]);

        eventMatch.reported = {
            winner: player2.id,
            score: [score1, score2]
        };

        Fusion.discordQueue("Game reported: " + player2.displayName + " " + score1 + ", " + obsDiscord.members.get(user.id).displayName + " " + score2 + ". " + player2 + ", please type `!confirm` to confirm the match.  If there is an error, such as the wrong person reported the game, it can be reported again to correct it.", eventMatch.channel);
    },
    
    confirm: (from, user, channel, message) => {
        "use strict";
        
        var eventMatch;
        
        if (message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        if (!event.joinable) {
            Fusion.discordQueue("Sorry, " + user + ", but this is not an event that you can report games in.", channel);
            return;
        }

        eventMatch = event.matches.filter((m) => !m.cancelled && m.players.indexOf(user.id) !== -1 && !m.winner)[0];
        if (!eventMatch) {
            Fusion.discordQueue("Sorry, " + user + ", but I cannot find a match available for you.", channel);
            return;
        }

        if (!eventMatch.reported) {
            Fusion.discordQueue("Sorry, " + user + ", but this match hasn't been reported yet.  Make sure the loser reports the result of the game in the following format: '!report 20 12'", channel);
            return;
        }

        if (!eventMatch.reported.winner === user.id) {
            Fusion.discordQueue("Sorry, " + user + ", but you can't confirm your own reports!", channel);
            return;
        }

        eventMatch.winner = eventMatch.reported.winner;
        eventMatch.score = eventMatch.reported.score;
        delete eventMatch.reported;

        Fusion.discordQueue("This match has been reported as a win for " + obsDiscord.members.get(user.id).displayName + " by the score of " + eventMatch.score[0] + " to " + eventMatch.score[1] + ".  If this is in error, please contact an admin. You may add a comment to this match using `!comment <your comment>` any time before your next match.  This channel and the voice channel will close in 2 minutes.", eventMatch.channel);

        setTimeout(() => {
            var player1 = obsDiscord.members.get(user.id),
                player2 = obsDiscord.members.get(eventMatch.players.filter((p) => p !== user.id)[0]);

            eventMatch.channel.overwritePermissions(user, noPermissions);
            eventMatch.channel.overwritePermissions(player2, noPermissions);
            eventMatch.voice.delete();
            delete eventMatch.channel;
            delete eventMatch.voice;
            
            player1.addRole(seasonRole);
            player2.addRole(seasonRole);

            Fusion.discordQueue(Fusion.resultsText(eventMatch), resultsChannel).then((message) => {
                eventMatch.results = message;
            });

            wss.broadcast({
                type: "results",
                match: {
                    player1: player1.displayName,
                    player2: player2.displayName,
                    score1: eventMatch.score[0],
                    score2: eventMatch.score[1],
                    home: event.homeSelected
                }
            });
        }, 120000);
    },
    
    comment: (from, user, channel, message) => {
        "use strict";
        
        var eventMatches, eventMatch;
        
        if (!message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }
        
        eventMatches = event.matches.filter((m) => !m.cancelled && m.players.indexOf(user.id) !== -1);
        
        if (eventMatches.length === 0) {
            Fusion.discordQueue("Sorry, " + user + ", but you have not played in any matches that can be commented on.", channel);
            return;
        }
        
        eventMatch = eventMatches[eventMatches.length - 1];
        
        if (!eventMatch.comments) {
            eventMatch.comments = {};
        }
        eventMatch.comments[user.id] = message;
        
        if (eventMatch.results) {
            eventMatch.results.edit(Fusion.resultsText(eventMatch));
        }

        Fusion.discordQueue("Your match comment has been updated.", user);
    },
    
    openevent: (from, user, channel, message) => {
        "use strict";
        
        if (!Fusion.isAdmin(user) || message) {
            return;
        }

        if (event) {
            Fusion.discordQueue("Sorry, " + user + ", but you must `!endevent` the previous event first.", channel);
            return;
        }

        event = {
            joinable: true,
            round: 0,
            players: {},
            matches: []
        };

        Fusion.discordQueue("Hey @everyone, a new tournament has been created.  `!join` the tournament if you'd like to play!", generalChannel);
    },
    
    startevent: (from, user, channel, message) => {
        "use strict";

        if (!Fusion.isAdmin(user) || message) {
            return;
        }

        if (event) {
            Fusion.discordQueue("Sorry, " + user + ", but you must `!endevent` the previous event first.", channel);
            return;
        }

        event = {
            joinable: false,
            players: {},
            matches: []
        };

        Fusion.discordQueue("A new event has been started.", channel);
    },

    addplayer: (from, user, channel, message) => {
        "use strict";

        var matches;

        if (!Fusion.isAdmin(user) || !message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        // Get the user by ID.
        matches = idParse.exec(message);

        if (!matches) {
            Fusion.discordQueue("Sorry, " + user + ", but you must mention the user to add them, try this command on a public channel instead.", channel);
            return;
        }

        var addedUser = obsDiscord.members.get(matches[1]);

        if (!addedUser) {
            Fusion.discordQueue("Sorry, " + user + ", but that person is not part of this Discord server.", channel);
            return;
        }

        if (event.players[addedUser.id]) {
            Fusion.discordQueue("Sorry, " + user + ", but " + addedUser.displayName + " has already joined the event.  You can use `!removeplayer` to remove them instead.", channel);
            return;
        }

        db.query(
            "SELECT Home FROM tblHome WHERE DiscordID = @discordId",
            {discordId: {type: db.VARCHAR(50), value: addedUser.id}}
        ).then((data) => {
            var homes = data[0] && data[0].length || 0;

            if (homes < 3) {
                Fusion.discordQueue("Sorry, " + user + ", but you have not yet set all 3 home levels.  Please use the `!home` command to select 3 home levels, one at a time, for example, `!home Logic x2`.", channel);
                return;
            }

            if (event.players[addedUser.id]) {
                delete event.players[addedUser.id].withdrawn;
            } else {
                event.players[addedUser.id] = {
                    home: data[0].map(m => m.Home),
                    canHost: true
                };
            }
            addedUser.addRole(eventRole);

            wss.broadcast({
                type: "addplayer",
                match: {
                    player: obsDiscord.members.get(addedUser.id).displayName
                }
            });
            
            Fusion.discordQueue("You have successfully added " + addedUser.displayName + " to the event.", user);
            Fusion.discordQueue(obsDiscord.members.get(user.id).displayName + " has added you to the next event!  I assume you can host games, but if you cannot please issue the `!host` command to toggle this option.", addedUser);
            Fusion.discordQueue(addedUser.displayName + " has joined the tournament!", generalChannel);
        }).catch((err) => {
            Fusion.discordQueue("Sorry, " + user + ", but there was a server error.  roncli will be notified about this.", channel);
            Fusion.discordQueue("There was a server error contacting the database when checking whether " + obsDiscord.members.get(user.id).displayName + " has 3 home levels to join the event. :(", roncli);
            console.log(err);
            return;
        });
    },

    removeplayer: (from, user, channel, message) => {
        "use strict";

        var matches;
        
        if (!Fusion.isAdmin(user) || !message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        // Get the user by ID.
        matches = idParse.exec(message);

        if (!matches) {
            Fusion.discordQueue("Sorry, " + user + ", but you must mention the user to remove them, try this command on a public channel instead.", channel);
            return;
        }

        var removedUser = obsDiscord.members.get(matches[1]);

        if (!removedUser) {
            Fusion.discordQueue("Sorry, " + user + ", but that person is not part of this Discord server.", channel);
            return;
        }

        if (!event.players[removedUser.id]) {
            Fusion.discordQueue("Sorry, " + user + ", but " + removedUser.displayName + " is not part of the event.  You can use `!removeplayer` to remove them instead.", channel);
            return;
        }

        event.players[removedUser.id].withdrawn = true;
        removedUser.removeRole(eventRole);
        Fusion.discordQueue("You have been successfully removed " + removedUser.displayName + " from the event.", user);
        Fusion.discordQueue(obsDiscord.members.get(user.id).displayName + " has removed you from the next event!  If this is in error, please contact " + obsDiscord.members.get(user.id).displayName + ".", removedUser);
        Fusion.discordQueue(removedUser.displayName + " has been removed from the tournament.", generalChannel);
    },
    
    generateround: (from, user, channel, message) => {
        "use strict";
        
        if (!Fusion.isAdmin(user) || message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        Fusion.getPlayers().then((ratedPlayers) => {
            var eventPlayers = Object.getOwnPropertyNames(event.players).filter((id) => !event.players[id].withdrawn).map((id) => {
                return {
                    id: id,
                    eventPlayer: event.players[id],
                    ratedPlayer: ratedPlayers.find((p) => p.DiscordID === id) || {
                        Name: obsDiscord.members.get(id).displayName,
                        DiscordID: id,
                        Rating: 1500,
                        RatingDeviation: 200,
                        Volatility: 0.06
                    },
                    points: event.matches.filter((m) => !m.cancelled && m.winner === id).length,
                    matches: event.matches.filter((m) => !m.cancelled && m.players.indexOf(id) !== -1).length
                };
            }).sort((a, b) => b.points - a.points || b.ratedPlayer.Rating - a.ratedPlayer.Rating || b.matches - a.matches || (Math.random() < 0.5 ? 1 : -1)),
                matchPlayers = () => {
                    var remainingPlayers = eventPlayers.filter((p) => matches.filter((m) => m.indexOf(p.id) !== -1).length === 0),
                        firstPlayer = remainingPlayers[0],
                        potentialOpponents = remainingPlayers.filter(
                            (p) =>
                                // Potential opponents don't include the first player.
                                p.id !== firstPlayer.id &&

                                // Potential opponents cannot have played against the first player.
                                event.matches.filter((m) => !m.cancelled && m.players.indexOf(p.id) !== -1 && m.players.indexOf(firstPlayer.id) !== -1).length === 0 &&

                                // Potential opponents or the first player need to be able to host.
                                (firstPlayer.eventPlayer.canHost || p.eventPlayer.canHost)
                        );

                    // Attempt to assign a bye if necessary.
                    if (remainingPlayers.length === 1) {
                        if (firstPlayer.matches >= event.round) {
                            // We can assign the bye.  We're done, return true.
                            return true;
                        } else {
                            // We can't assign the bye, return false.
                            return false;
                        }
                    }

                    while (potentialOpponents.length > 0) {
                        // This allows us to get an opponent that's roughly in the middle in round 1, in the top 1/4 in round 2, the top 1/8 in round 3, etc, so as the tournament goes on we'll get what should be closer matches.
                        let index = Math.floor(potentialOpponents.length / Math.pow(2, event.round + 1));

                        // Add the match.
                        matches.push([firstPlayer.id, potentialOpponents[index].id]);

                        // If we had 2 or less remaining players at the start of this function, there's none left, so we're done!  Return true.
                        if (remainingPlayers.length <= 2) {
                            return true;
                        }

                        // If we can match the remaining players, we're done!  return true.
                        if (matchPlayers()) {
                            return true;
                        }

                        // If we get here, there was a problem with the previous pairing.  Back the match out, remove the offending player, and continue the loop.
                        matches.pop();
                        remainingPlayers.splice(index, 1);
                    }

                    // If we get here, we can't do any pairings.  Return false.
                    return false;
                },
                matches = [];

            if (!matchPlayers()) {
                Fusion.discordQueue("There was a problem matching players up.  You'll have to match them up manually.  Sorry about that!", user);
                return;
            }

            // We have our matches!  Setup rooms, pick home level, and announce the match.
            event.round++;
            Fusion.discordQueue("Round " + event.round + " starts now!", generalChannel);
            Fusion.discordQueue("Round " + event.round + " results:", resultsChannel);

            matches.forEach((match) => {
                var player1 = obsDiscord.members.get(match[0]),
                    player2 = obsDiscord.members.get(match[1]),
                    fxs = [
                        obsDiscord.createChannel((player1.displayName + "-" + player2.displayName).toLowerCase().replace(/[^\-a-z0-9]/g, ""), "text"),
                        obsDiscord.createChannel(player1.displayName + "-" + player2.displayName, "voice")
                    ];

                Promise.all(fxs).then((channels) => {
                    var eventMatch = {
                        players: match,
                        channel: channels[0],
                        voice: channels[1]
                    },
                        homePlayer, awayPlayer;

                    // Select home level.
                    match.sort((a, b) => {
                        event.matches.filter((m) => !m.cancelled && m.home === a).length - event.matches.filter((m) => !m.cancelled && m.home === b).length ||
                        event.matches.filter((m) => !m.cancelled && m.home !== b).length - event.matches.filter((m) => !m.cancelled && m.home !== a).length ||
                        (Math.random() < 0.5 ? 1 : -1);
                    });
                    homePlayer = obsDiscord.members.get(match[0]),
                    awayPlayer = obsDiscord.members.get(match[1]),
                    eventMatch.home = match[0];
                    event.matches.push(eventMatch);
                    
                    // Setup channels
                    eventMatch.channel.overwritePermissions(obsDiscord.roles.get(obsDiscord.id), noPermissions);
                    eventMatch.channel.overwritePermissions(player1, textPermissions);
                    eventMatch.channel.overwritePermissions(player2, textPermissions);
                    eventMatch.voice.overwritePermissions(obsDiscord.roles.get(obsDiscord.id), noPermissions);
                    eventMatch.voice.overwritePermissions(player1, voicePermissions);
                    eventMatch.voice.overwritePermissions(player2, voicePermissions);

                    // Announce match
                    Fusion.discordQueue(player1.displayName + " vs " + player2.displayName, generalChannel);
                    Fusion.discordQueue(player1 + " vs " + player2, eventMatch.channel);
                    Fusion.discordQueue("A voice channel has been setup for you to use for this match!", eventMatch.channel);

                    eventMatch.homes = event.players[match[0]].home;

                    Fusion.discordQueue(awayPlayer + ", please choose from the following three home levels:\n`!choose a` - " + eventMatch.homes[0] + "\n`!choose b` - " + eventMatch.homes[1] + "\n`!choose c` - " + eventMatch.homes[2], eventMatch.channel);

                    db.query(
                        "UPDATE tblHome SET Locked = 1 WHERE DiscordID IN (@player1, @player2)",
                        {
                            player1: {type: db.VARCHAR(50), value: match[0]},
                            player2: {type: db.VARCHAR(50), value: match[1]}
                        }
                    ).catch((err) => {
                        console.log(err);
                        Fusion.discordQueue("There was a database error locking home levels!  See the error log for details.", user);
                    });
                });
            });
        }).catch((err) => {
            console.log(err);
            Fusion.discordQueue("There was a database problem generating the next round of matches!  See the error log for details.", user);
        });
    },
    
    // TODO: !forcechoose [a|b|c]
    choose: (from, user, channel, message) => {
        "use strict";

        var eventMatch, index;

        if (!message || ["a", "b", "c"].indexOf(message.toLowerCase()) === -1) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        eventMatch = event.matches.filter((m) => !m.cancelled && m.players.indexOf(user.id) !== -1 && !m.winner)[0];
        if (!eventMatch) {
            Fusion.discordQueue("Sorry, " + user + ", but I cannot find a match available for you.", channel);
            return;
        }

        if (eventMatch.home === user.id) {
            Fusion.discordQueue("Sorry, " + user + ", but your opponent must pick one of your home levels.", channel);
            return;
        }

        index = message.toLowerCase().charCodeAt(0) - 97;

        eventMatch.homeSelected = eventMatch.homes[index];

        Fusion.discordQueue("You have selected to play in **" + eventMatch.homeSelected + "**.", eventMatch.channel);

        wss.broadcast({
            type: "match",
            match: {
                player1: obsDiscord.members.get(eventMatch.players[0]).displayName,
                player2: obsDiscord.members.get(eventMatch.players[1]).displayName,
                home: eventMatch.homeSelected
            }
        });

        Fusion.discordQueue("Please begin your match!  Don't forget to open it up to at least 4 observers.  Loser reports the match upon completion.  Use the command `!report 20 12` to report the score.", eventMatch.channel);
    },
    
    creatematch: (from, user, channel, message) => {
        "use strict";

        var matches, player1, player2, fxs;
        
        if (!Fusion.isAdmin(user) || !message) {
            return;
        }
        
        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        matches = twoIdParse.exec(message);
        if (!matches) {
            Fusion.discordQueue("Sorry, " + user + ", but you must mention two users to match them up, try this command in a public channel instead.", channel);
            return;
        }
        
        player1 = obsDiscord.members.get(matches[1]);
        player2 = obsDiscord.members.get(matches[2]);
        fxs = [
            obsDiscord.createChannel((player1.displayName + "-" + player2.displayName).toLowerCase().replace(/[^\-a-z0-9]/g, ""), "text"),
            obsDiscord.createChannel(player1.displayName + "-" + player2.displayName, "voice")
        ];
        Promise.all(fxs).then((channels) => {
            var eventMatch = {
                players: [matches[1], matches[2]],
                channel: channels[0],
                voice: channels[1]
            };

            // Select home level.
            eventMatch.home = matches[1];
            event.matches.push(eventMatch);
            
            // Setup channels
            eventMatch.channel.overwritePermissions(obsDiscord.roles.get(obsDiscord.id), noPermissions);
            eventMatch.channel.overwritePermissions(player1, textPermissions);
            eventMatch.channel.overwritePermissions(player2, textPermissions);
            eventMatch.voice.overwritePermissions(obsDiscord.roles.get(obsDiscord.id), noPermissions);
            eventMatch.voice.overwritePermissions(player1, voicePermissions);
            eventMatch.voice.overwritePermissions(player2, voicePermissions);

            // Announce match
            Fusion.discordQueue(player1.displayName + " vs " + player2.displayName, generalChannel);
            Fusion.discordQueue(player1 + " vs " + player2, eventMatch.channel);
            Fusion.discordQueue("A voice channel has been setup for you to use for this match!", eventMatch.channel);
            // TODO: For the finals tournament, we need to give both pilots the chance to choose the level.
            Fusion.discordQueue("Please begin your first game!  Don't forget to open it up to at least 4 observers.", eventMatch.channel);
        });
    },

    cancelmatch: (from, user, channel, message) => {
        "use strict";

        var matches, player1, player2, eventMatch;

        if (!Fusion.isAdmin(user) || !message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        matches = twoIdParse.exec(message);
        if (!matches) {
            Fusion.discordQueue("Sorry, " + user + ", but you must mention two users to force the report, followed by the score. Try this command in a public channel instead.", channel);
            return;
        }

        player1 = obsDiscord.members.get(matches[1]);
        player2 = obsDiscord.members.get(matches[2]);
        eventMatch = event.matches.filter((m) => !m.cancelled && m.players.indexOf(matches[1]) !== -1 && m.players.indexOf(matches[2]) !== -1 && !m.winner)[0];

        if (!eventMatch) {
            Fusion.discordQueue("Sorry, " + user + ", but I cannot find a match between those two players.", channel);
            return;
        }

        eventMatch.cancelled = true;

        if (eventMatch.channel) {
            Fusion.discordQueue("This match has been cancelled.  This channel and the voice channel will close in 2 minutes.", eventMatch.channel);

            setTimeout(() => {
                eventMatch.channel.overwritePermissions(player1, noPermissions);
                eventMatch.channel.overwritePermissions(player2, noPermissions);
                eventMatch.voice.delete();
                delete eventMatch.channel;
                delete eventMatch.voice;
            }, 120000);
        }
    },

    forcereport: (from, user, channel, message) => {
        "use strict";

        var matches, player1, player2, score1, score2, eventMatch;

        if (!Fusion.isAdmin(user) || !message) {
            return;
        }

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        matches = forceMatchReportParse.exec(message);
        if (!matches) {
            Fusion.discordQueue("Sorry, " + user + ", but you must mention two users to force the report, followed by the score. Try this command in a public channel instead.", channel);
            return;
        }

        player1 = obsDiscord.members.get(matches[1]);
        player2 = obsDiscord.members.get(matches[2]);
        score1 = +matches[3];
        score2 = +matches[4];

        if (score1 - score2 < 2) {
            Fusion.discordQueue("Sorry, " + user + ", but you must list the winner first, and the winner must win by 2.", channel);
            return;
        }

        eventMatch = event.matches.filter((m) => !m.cancelled && m.players.indexOf(matches[1]) !== -1 && m.players.indexOf(matches[2]) !== -1 && !m.winner)[0];

        if (!eventMatch) {
            Fusion.discordQueue("Sorry, " + user + ", but I cannot find a match between those two players.", channel);
            return;
        }

        if (!eventMatch.homeSelected) {
            Fusion.discordQueue("Sorry, " + user + ", but no home level has been set for this match.  See the instructions in " + eventMatch.channel + " to get a home level selected for this match.", channel);
            return;
        }

        eventMatch.winner = matches[1];
        eventMatch.score = [score1, score2];

        new Promise((resolve, reject) => {
            if (eventMatch.channel) {
                Fusion.discordQueue("This match has been reported as a win for " + player1.displayName + " by the score of " + score1 + " to " + score2 + ".  If this is in error, please contact " + user + ". You may add a comment to this match using `!comment <your comment>` any time before your next match.  This channel and the voice channel will close in 2 minutes.", eventMatch.channel);
    
                setTimeout(() => {
                    eventMatch.channel.overwritePermissions(player1, noPermissions);
                    eventMatch.channel.overwritePermissions(player2, noPermissions);
                    eventMatch.voice.delete();
                    delete eventMatch.channel;
                    delete eventMatch.voice;
    
                    player1.addRole(seasonRole);
                    player2.addRole(seasonRole);
    
                    Fusion.discordQueue(Fusion.resultsText(eventMatch), resultsChannel).then((message) => {
                        eventMatch.results = message;
                    });

                    resolve();                    
                }, 120000);
            } else {
                eventMatch.results.edit(Fusion.resultsText(eventMatch));
                resolve();
            }
        }).then(() => {
            wss.broadcast({
                type: "results",
                match: {
                    player1: player1.displayName,
                    player2: player2.displayName,
                    score1: score1,
                    score2: score2,
                    home: event.homeSelected
                }
            });
        });
    },
    
    endevent: (from, user, channel, message) => {
        "use strict";
        
        if (!Fusion.isAdmin(user) || message) {
            return;
        }
        
        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        // Get the players from the database.
        Fusion.getPlayers().then((ratedPlayers) => {
            var fxs;

            // Add new ratings for players that haven't played yet.
            Object.keys(event.players).forEach((id) => {
                if (ratedPlayers.filter((p) => p.DiscordID === id).length === 0) {
                    ratedPlayers.push({
                        DiscordID: id,
                        Rating: 1500,
                        RatingDeviation: 200,
                        Volatility: 0.06
                    });
                }
            });

            // Update Discord name, and create the glicko ranking for each player.
            ratedPlayers.forEach((player) => {
                var playerUser = obsDiscord.members.get(player.DiscordID);

                if (playerUser) {
                    player.Name = playerUser.displayName;
                    playerUser.removeRole(eventRole);
                }

                player.glicko = ranking.makePlayer(player.Rating, player.RatingDeviation, player.Volatility);
            });

            // Update ratings.
            ranking.updateRatings(
                event.matches.filter((m) => !m.cancelled).map((match) => {
                    var player1 = ratedPlayers.find((p) => p.DiscordID === match.players[0]),
                        player2 = ratedPlayers.find((p) => p.DiscordID === match.players[1]);
                    
                    return [player1.glicko, player2.glicko, match.players[0] === match.winner ? 1 : 0];
                })
            );

            // Update ratings on object.
            ratedPlayers.forEach((player) => {
                player.Rating = player.glicko.getRating();
                player.RatingDeviation = player.glicko.getRd();
                player.Volatility = player.glicko.getVol();
            });

            // Update the database with the ratings.
            fxs = ratedPlayers.map((player) => {
                return () => new Promise((resolve, reject) => {
                    if (player.PlayerID) {
                        db.query(
                            "UPDATE tblPlayer SET Name = @name, DiscordID = @discordId, Rating = @rating, RatingDeviation = @ratingDeviation, Volatility = @volatility WHERE PlayerID = @playerId",
                            {
                                name: {type: db.VARCHAR(50), value: player.Name},
                                discordId: {type: db.VARCHAR(50), value: player.DiscordID},
                                rating: {type: db.FLOAT, value: player.Rating},
                                ratingDeviation: {type: db.FLOAT, value: player.RatingDeviation},
                                volatility: {type: db.FLOAT, value: player.Volatility},
                                playerId: {type: db.INT, value: player.PlayerID}
                            }
                        ).then(() => {
                            resolve();
                        }).catch((err) => {
                            console.log(err);
                            reject(err);
                        });
                    } else {
                        db.query(
                            "INSERT INTO tblPlayer (Name, DiscordID, Rating, RatingDeviation, Volatility) VALUES (@name, @discordId, @rating, @ratingDeviation, @volatility)",
                            {
                                name: {type: db.VARCHAR(50), value: player.Name},
                                discordId: {type: db.VARCHAR(50), value: player.DiscordID},
                                rating: {type: db.FLOAT, value: player.Rating},
                                ratingDeviation: {type: db.FLOAT, value: player.RatingDeviation},
                                volatility: {type: db.FLOAT, value: player.Volatility},
                                playerId: {type: db.INT, value: player.PlayerID}
                            }
                        ).then(() => {
                            resolve();
                        }).catch((err) => {
                            console.log(err);
                            reject(err);
                        });
                    }
                });
            });

            fxs.reduce((promise, fx) => {
                return promise = promise.then(fx);
            }, Promise.resolve()).then(() => {
                Fusion.discordQueue("The event has ended!  Thank you everyone for making it a success!", generalChannel);
                event = undefined;
            }).catch(() => {
                Fusion.discordQueue("There was a database error saving the ratings.", user);
            });
        });
    }
};

module.exports = Fusion;
