var Discord = require("discord.js"),
    Tmi = require("tmi.js"),
    settings = require("./settings"),
    fusion = require("./fusion"),
    tmi = new Tmi.client(settings.tmi),
    discord = new Discord.Client(settings.discord.options);

fusion.start(tmi, discord);
