var pjson = require("./package.json"),
    settings = require("./settings"),
    db = require("./database"),
    messageParse = /^!([^ ]+)(?: +(.+[^ ]))? *$/,
    idParse = /^<@([0-9]+)>$/,

    Fusion = {},
    tmiCooldown = {},
    discordCooldown = {},
    players = {},

    tmi, discord, obsDiscord, generalChannel, eventRole, seasonRole, event;

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
            //obsDiscord = discord.guilds.find("name", "The Observatory");
            obsDiscord = discord.guilds.find("name", "roncli Gaming");
            generalChannel = obsDiscord.channels.find("name", "general");
            eventRole = obsDiscord.roles.find("name", "In Current Event");
            seasonRole = obsDiscord.roles.find("name", "Season 1 Participant");
            
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
    return user.username === settings.admin.username && user.discriminator == settings.admin.discriminator;
};

Fusion.getPlayers = new Promise((resolve, reject) => {
    db.query("SELECT PlayerID, Name, DiscordID, Rating, RatingDeviation, Volatility from tblPlayer", {}, (err, data) => {
        if (err) {
            console.log(err);
            reject(err);
        }

        players = {};

        if (!data[0]) {
            resolve([]);
            return;
        }

        data[0].forEach((player) => {
            players[player.DiscordID] = player;
        });

        resolve(players);
    });
});

Fusion.tmiQueue = (message) => {
    "use strict";

    tmi.say("roncli", message);
};

Fusion.discordQueue = (message, channel) => {
    "use strict";

    if (!channel) {
        channel = generalChannel;
    }
    
    channel.sendMessage(message);
};

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
        
        Fusion.tmiQueue("FusionBot by roncli, Version " + pjson.version);
        
        tmiCooldown.version = new Date(new Date().getTime() + 60000);
    },
    
    discord: (from, message) => {
        "use strict";
        
        if (message || tmiCooldown.discord > new Date()) {
            return;
        }
        
        Fusion.tmiQueue("TODO: Include information about how to connect to Discord!");
        
        tmiCooldown.discord = new Date(new Date().getTime() + 60000);
    },
    
    website: (from, message) => {
        "use strict";
        
        if (message || tmiCooldown.website > new Date()) {
            return;
        }
        
        Fusion.tmiQueue("Visit The Observatory on the web at http://roncli.com/gaming/the-observatory!");
        
        tmiCooldown.discord = new Date(new Date().getTime() + 60000);
    },
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
        
        Fusion.discordQueue("FusionBot by roncli, Version " + pjson.version, channel);
        
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
            Fusion.discordQueue("Sorry, " + user + ", but you have already joined this event.  You can use !withdraw to leave it.", channel);
            return;
        }

        if (event.players[user.id]) {
            delete event.players[user.id].withdrawn;
        } else {
            event.players[user.id] = {
                home: undefined,
                canHost: true
            };
        }
        user.addRole(eventRole);
        Fusion.discordQueue("You have been successfully added to the event.  Please use the `!home` command to select a home level, for example, `!home Logic x2`.  I assume you can host games, but if you cannot please issue the `!host` command to toggle this option.", user);
        Fusion.discordQueue(obsDiscord.members.get(user.id).displayName + " has joined the tournament!", generalChannel);
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
            Fusion.discordQueue("Sorry, " + user + ", but you have not yet entered this event.  You can use !join to enter it.", channel);
            return;
        }

        if (event.players[user.id].withdrawn) {
            Fusion.discordQueue("Sorry, " + user + ", but you have have already withdrawn from this event.  You can use !join to re-enter it.", channel);
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

        if (!event) {
            Fusion.discordQueue("Sorry, " + user + ", but there is no event currently running.", channel);
            return;
        }

        if (!event.players[user.id]) {
            if (event.joinable) {
                Fusion.discordQueue("Sorry, " + user + ", but you first need to `!join` the tournament before selecting a home level.", channel);
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

        if ((event.round && event.round > 0) || (event.matches && event.matches.length > 0)) {
            Fusion.discordQueue("Sorry, " + user + ", but you cannot change your home level after the tournament has started.", channel);
            return;
        }

        event.players.home = message;
        Fusion.discordQueue("You have successfully set your home level to `" + message + "`.  You may change it at any time before the tournament begins.", channel);
        Fusion.discordQueue(obsDiscord.members.get(user.id).displayName + " has set their home level to `" + message + "`.", channel);
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

        if ((event.round && event.round > 0) || (event.matches && event.matches.length > 0)) {
            Fusion.discordQueue("Sorry, " + user + ", but you cannot toggle your ability to host games after the tournament has started.", channel);
            return;
        }

        event.players.canHost = !event.players.canHost;
        Fusion.discordQueue("You have successfully toggled " + (event.players.canHost ? "on" : "off") + " your ability to host games.  You may change it at any time before the tournament begins.", user);
        Fusion.discordQueue(obsDiscord.members.get(user.id).displayName + " has set toggled " + (event.players.canHost ? "on" : "off") + " their ability to host games.", generalChannel);
    },
    
    report: (from, user, channel, message) => {
        "use strict";
        
        if (!message) {
            return;
        }

        // TODO: Reports the result of a match.
    },
    
    confirm: (from, user, channel, message) => {
        "use strict";
        
        if (message) {
            return;
        }

        // TODO: Confirms the result of a match.
    },
    
    comment: (from, user, channel, message) => {
        "use strict";
        
        if (!message) {
            return;
        }

        // TODO: Add a comment to the match.
    },
    
    openevent: (from, user, channel, message) => {
        "use strict";
        
        if (!Fusion.isAdmin(user) || message) {
            return;
        }

        if (event) {
            Fusion.discordQueue("Sorry, " + user + ", but you must !endevent the previous event first.", channel);
            return;
        }

        event = {
            joinable: true,
            round: 0,
            players: {},
            matches: []
        }

        Fusion.discordQueue("Hey @everyone, a new tournament has been created.  `!join` the tournament if you'd like to play!", generalChannel);
    },
    
    startevent: (from, user, channel, message) => {
        "use strict";

        if (!Fusion.isAdmin(user) || message) {
            return;
        }

        if (event) {
            Fusion.discordQueue("Sorry, " + user + ", but you must !endevent the previous event first.", channel);
            return;
        }

        event = {
            joinable: false,
            players: {},
            matches: []
        }
    },

    addplayer: (from, user, channel, message) => {
        "use strict";

        var matches, user;

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
            Fusion.discordQueue("Sorry, " + user + ", but " + addedUser.displayName + " has already joined the event.  You can use !removeplayer to remove them instead.", channel);
            return;
        }

        event.players[addedUser.id] = {
            home: undefined,
            canHost: true
        };

        user.addRole(eventRole);
        Fusion.discordQueue("You have been successfully added " + addedUser.displayName + " to the event.", user);
        Fusion.discordQueue(from + " has added you to the next event!  Please use the `!home` command to select a home level, for example, `!home Logic x2`.  I assume you can host games, but if you cannot please issue the `!host` command to toggle this option.", addedUser);
        Fusion.discordQueue(addedUser.displayName + " has joined the tournament!", generalChannel);
    },

    removeplayer: (from, user, channel, message) => {
        "use strict";

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
            Fusion.discordQueue("Sorry, " + user + ", but " + removedUser.displayName + " is not part of the event.  You can use !removeplayer to remove them instead.", channel);
            return;
        }

        event.players[removedUser.id] = {
            home: undefined,
            canHost: true
        };

        user.addRole(eventRole);
        Fusion.discordQueue("You have been successfully removed " + removedUser.displayName + " from the event.", user);
        Fusion.discordQueue(from + " has removed you from the next event!  If this is in error, please contact ", addedUser);
        Fusion.discordQueue(removedUser.displayName + " has been removed from the tournament.", generalChannel);
    },
    
    generateround: (from, user, channel, message) => {
        "use strict";
        
        if (!Fusion.isAdmin(user) || message) {
            return;
        }

        Fusion.getPlayers().then((players) => {
            Object.getOwnPropertyNames(event.players).filter((id) => !event.players[id].withdrawn).forEach((id) => {
                if (!players[id]) {
                    players.push({
                        Name: obsDiscord.members.get(id).displayName,
                        DiscordID: id,
                        Rating: 1500,
                        RatingDeviation: 200,
                        Volatility: 0.06
                    });
                }
            });
        }).catch((err) => {
            Fusion.discordQueue("There was a database problem generating the next round of matches!  See the error log for details.", user);
        });
        
        // TODO: Admin only, generate the next round of matches.
    },
    
    creatematch: (from, user, channel, message) => {
        "use strict";
        
        if (!Fusion.isAdmin(user) || !message) {
            return;
        }
        
        // TODO: Admin only, create a match.
    },
    
    endevent: (from, user, channel, message) => {
        "use strict";
        
        if (!Fusion.isAdmin(user) || message) {
            return;
        }
        
        // TODO: Admin only, end the event.
    }
};

module.exports = Fusion;
