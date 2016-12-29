var Discord = require("discord.js"),
    Tmi = require("tmi.js"),
    TwitchApi = require("twitch-api"),
    settings = require("./settings"),
    fusion = require("./fusion"),
    tmi = new Tmi.client(settings.tmi),
    discord = new Discord.Client(settings.discord.options),
    twitch = new TwitchApi(settings.twitch);

fusion.start(tmi, discord, twitch);
