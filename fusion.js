var pjson = require("./package.json"),
    settings = require("./settings"),
    db = require("./database"),
    messageParse = /^!([^ ]+)(?: +(.+[^ ]))? *$/,

    Fusion = {},
    tmiCooldown = {},

    tmi, discord, obsDescent, generalChannel;

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
        
        // Get players from database.
        
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
            obsDescent = discord.guilds.find("name", "The Observatory");
            generalChannel = obsDescent.channels.find("name", "general");
            
            if (!readied) {
                readied = true;
                
                // Connect to IRC.
                tmiConnect();
            }
        });
        
        discord.on("message", (message) => {
            if (message.guild && message.guild.name === "The Observatory") {
                Fusion.discordMessage(message.author.username, message.author, message.content);
            }
        });
    };
    
    startup();
};

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
        
        if (tmiCooldown.version > new Date()) {
            return;
        }
        
        Fusion.tmiQueue("FusionBot by roncli, Version " + pjson.version);
        
        tmiCooldown.version = new Date(new Date().getTime() + 60000);
    },
    
    discord: (from, message) => {
        "use strict";
        
        if (tmiCooldown.discord > new Date()) {
            return;
        }
        
        Fusion.tmiQueue("TODO: Include information about how to connect to Discord!");
        
        tmiCooldown.discord = new Date(new Date().getTime() + 60000);
    },
    
    website: (from, message) => {
        "use strict";
        
        if (tmiCooldown.website > new Date()) {
            return;
        }
        
        Fusion.tmiQueue("Visit The Observatory on the web at http://roncli.com/gaming/the-observatory!");
        
        tmiCooldown.discord = new Date(new Date().getTime() + 60000);
    },
};

module.exports = Fusion;
