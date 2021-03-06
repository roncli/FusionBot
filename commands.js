/**
 * @typedef {typeof Discord|typeof Tmi} Service
 * @typedef {import("./user")} User
 */

const tz = require("timezone-js"),
    tzData = require("tzdata"),

    Db = require("./database"),
    Exception = require("./exception"),
    pjson = require("./package.json"),
    Warning = require("./warning"),

    forceHomeParse = /^<@!?([0-9]+)> (.+)$/,
    forceReplaceHomeParse = /^<@!?([0-9]+)> (.+) with (.+)$/i,
    idMessageParse = /^<@!?([0-9]+)> ([^ ]+)(?: (.+))?$/,
    mergeParse = /^<@!?([0-9]+)> into <@!?([0-9]+)>$/,
    addEventParse = /^([1-9][0-9]*) (.*) (\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}) (?:1[012]|[1-9]):[0-5][0-9] [AP]M)$/i,
    replaceHomeParse = /^(.+) with (.+)$/i,
    reportAnarchyParse = /^ ?(?:<@!?(\d+)> (-?\d+))((?: <@!?\d+> -?\d+)*)$/,
    reportGameParse = /^<@!?(\d+)> (-?\d+) <@!?(\d+)> (-?\d+)$/,
    reportParse = /^(-?[0-9]+) (-?[0-9]+)$/,
    twoIdParse = /^<@!?([0-9]+)> <@!?([0-9]+)>$/,
    wrongReportParse = /^(-?[0-9]+)-(-?[0-9]+)$/;

/**
 * @type {typeof import("./discord.js")}
 */
let Discord;

/**
 * @type {typeof import("./event")}
 */
let Event;

/**
 * @type {typeof import("./tmi")}
 */
let Tmi;

//   ###                                          #
//  #   #                                         #
//  #       ###   ## #   ## #    ###   # ##    ## #   ###
//  #      #   #  # # #  # # #      #  ##  #  #  ##  #
//  #      #   #  # # #  # # #   ####  #   #  #   #   ###
//  #   #  #   #  # # #  # # #  #   #  #   #  #  ##      #
//   ###    ###   #   #  #   #   ####  #   #   ## #  ####
/**
 * A class that handles commands given by chat.
 */
class Commands {
    //                           #                       #
    //                           #                       #
    //  ##    ##   ###    ###   ###   ###   #  #   ##   ###    ##   ###
    // #     #  #  #  #  ##      #    #  #  #  #  #      #    #  #  #  #
    // #     #  #  #  #    ##    #    #     #  #  #      #    #  #  #
    //  ##    ##   #  #  ###      ##  #      ###   ##     ##   ##   #
    /**
     * Initializes the class with the service to use.
     * @param {Service} service The service to use with the commands.
     */
    constructor(service) {
        this.service = service;

        if (!Discord) {
            Discord = require("./discord");
        }

        if (!Tmi) {
            Tmi = require("./tmi");
        }

        if (!Event) {
            Event = require("./event");
        }

        Event.onLoad();
    }

    //       #                 #     #  #                     ###           ##      #         #
    //       #                 #     #  #                      #           #  #     #
    //  ##   ###    ##    ##   # #   #  #   ###    ##   ###    #     ###   #  #   ###  # #   ##    ###
    // #     #  #  # ##  #     ##    #  #  ##     # ##  #  #   #    ##     ####  #  #  ####   #    #  #
    // #     #  #  ##    #     # #   #  #    ##   ##    #      #      ##   #  #  #  #  #  #   #    #  #
    //  ##   #  #   ##    ##   #  #   ##   ###     ##   #     ###   ###    #  #   ###  #  #  ###   #  #
    /**
     * Checks that the user is an admin.
     * @param {User} user The user to check.
     * @returns {void}
     */
    static checkUserIsAdmin(user) {
        if (!Discord.isOwner(user)) {
            throw new Warning("Admin permission required to perform this command.");
        }
    }

    //       #                 #     #  #                                        ###          ####                    ###    #                                #
    //       #                 #     ####                                         #           #                       #  #                                    #
    //  ##   ###    ##    ##   # #   ####   ##    ###    ###    ###   ###   ##    #     ###   ###   ###    ##   # #   #  #  ##     ###    ##    ##   ###    ###
    // #     #  #  # ##  #     ##    #  #  # ##  ##     ##     #  #  #  #  # ##   #    ##     #     #  #  #  #  ####  #  #   #    ##     #     #  #  #  #  #  #
    // #     #  #  ##    #     # #   #  #  ##      ##     ##   # ##   ##   ##     #      ##   #     #     #  #  #  #  #  #   #      ##   #     #  #  #     #  #
    //  ##   #  #   ##    ##   #  #  #  #   ##   ###    ###     # #  #      ##   ###   ###    #     #      ##   #  #  ###   ###   ###     ##    ##   #      ###
    //                                                                ###
    /**
     * Checks that the message is from Discord.
     * @param {Service} service The service.
     * @returns {void}
     */
    static checkMessageIsFromDiscord(service) {
        if (service.name !== Discord.name) {
            throw new Warning("This command is for Discord only.");
        }
    }

    //       #                 #     #  #                                        ###          ####                    ###          #
    //       #                 #     ####                                         #           #                        #
    //  ##   ###    ##    ##   # #   ####   ##    ###    ###    ###   ###   ##    #     ###   ###   ###    ##   # #    #    # #   ##
    // #     #  #  # ##  #     ##    #  #  # ##  ##     ##     #  #  #  #  # ##   #    ##     #     #  #  #  #  ####   #    ####   #
    // #     #  #  ##    #     # #   #  #  ##      ##     ##   # ##   ##   ##     #      ##   #     #     #  #  #  #   #    #  #   #
    //  ##   #  #   ##    ##   #  #  #  #   ##   ###    ###     # #  #      ##   ###   ###    #     #      ##   #  #   #    #  #  ###
    //                                                                ###
    /**
     * A promise that only proceeds if the user is on tmi.
     * @param {Service} service The service.
     * @returns {void}
     */
    static checkMessageIsFromTmi(service) {
        if (service.name !== Tmi.name) {
            throw new Warning("This command is for Twitch chat only.");
        }
    }

    //         #                ##           #
    //                           #           #
    //  ###   ##    # #   #  #   #     ###  ###    ##
    // ##      #    ####  #  #   #    #  #   #    # ##
    //   ##    #    #  #  #  #   #    # ##   #    ##
    // ###    ###   #  #   ###  ###    # #    ##   ##
    /**
     * Simulates other users making a command.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise} A promise that resolves when the command completes.
     */
    async simulate(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (!idMessageParse.test(message)) {
            return false;
        }

        const matches = idMessageParse.exec(message),
            {1: userId, 3: newMessage} = matches,
            command = matches[2].toLocaleLowerCase();

        if (Object.getOwnPropertyNames(Commands.prototype).filter((p) => typeof Commands.prototype[p] === "function" && p !== "constructor").indexOf(command) === -1) {
            return false;
        }

        const newUser = Discord.getGuildUser(userId);
        if (!newUser) {
            throw new Warning("User does not exist.");
        }

        return await this[command](newUser, newMessage, channel) || void 0;
    }

    //                           #
    //
    // # #    ##   ###    ###   ##     ##   ###
    // # #   # ##  #  #  ##      #    #  #  #  #
    // # #   ##    #       ##    #    #  #  #  #
    //  #     ##   #     ###    ###    ##   #  #
    /**
     * Replies with the current version of the bot.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async version(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (message) {
            return false;
        }

        await Discord.queue(`FusionBot, DescentBot, whatever, I have an identity crisis.  Written by roncli, Version ${pjson.version}`, channel);

        return true;
    }

    //   #          #
    //
    //   #    ##   ##    ###
    //   #   #  #   #    #  #
    //   #   #  #   #    #  #
    // # #    ##   ###   #  #
    //  #
    /**
     * Joins the user to the event.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async join(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        if (Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but this is not an event you can join.`, channel);
            throw new Warning("Not a joinable event.");
        }

        const guildUser = Discord.getGuildUser(user),
            ratedPlayer = await Event.getRatedPlayerByName(guildUser.displayName);

        if (ratedPlayer && user.discord.id !== ratedPlayer.DiscordID) {
            await Discord.queue(`Sorry, ${user}, but I already have a record of you previously participating under another account.  Please either log into the account you previously played under, or contact roncli to have your accounts merged.`);
            throw new Warning("User made another account.");
        }

        const player = Event.getPlayer(user.discord.id);

        if (player && !player.withdrawn) {
            await Discord.queue(`Sorry, ${user}, but you have already joined this event.  You can use \`!withdraw\` to leave it.`, channel);
            throw new Warning("Already joined.");
        }

        let homes;
        try {
            homes = await Db.getHomesForDiscordId(user.discord.id);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting a pilot's home maps.", err);
        }

        if (homes.length < 3) {
            await Discord.queue(`Sorry, ${user}, but you have not yet set all 3 home maps.  Please use the \`!home\` command to select 3 home maps, one at a time, for example, \`!home Logic x2\`.`, channel);
            throw new Warning("Pilot has not yet set 3 home maps.");
        }

        if (player) {
            Event.rejoinPlayer(player, homes);
        } else {
            Event.addPlayer(user.discord.id, homes);
        }

        await Discord.addEventRole(user);

        await Discord.queue("You have been successfully added to the event.  I assume you can host games, but if you cannot please issue the `!host` command to toggle this option.", channel);
        await Discord.queue(`${guildUser.displayName} has joined the tournament!`);

        try {
            if (!await Event.getRatedPlayerById(user.discord.id)) {
                await Event.addRatedPlayer(user.discord);
                await Discord.queue(`${user} has joined the tournament, but there is no record of them participating previously.  Ensure this is not an existing player using a new Discord account.`, Discord.alertsChannel);
            }
        } catch (err) {
            throw new Exception("There was a database error while determining if this player exists.", err);
        }

        return true;
    }

    //        #     #    #        #
    //              #    #        #
    // #  #  ##    ###   ###    ###  ###    ###  #  #
    // #  #   #     #    #  #  #  #  #  #  #  #  #  #
    // ####   #     #    #  #  #  #  #     # ##  ####
    // ####  ###     ##  #  #   ###  #      # #  ####
    /**
     * Withdraws the user from the event.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async withdraw(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        if (Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but this is not an event you can withdraw from.`, channel);
            throw new Warning("Not a withdrawable event.");
        }

        const player = Event.getPlayer(user.discord.id);

        if (!player) {
            await Discord.queue(`Sorry, ${user}, but you have not yet joined this event.  You can use \`!join\` to enter it.`, channel);
            throw new Warning("Player has not entered.");
        }

        if (player.withdrawn) {
            await Discord.queue(`Sorry, ${user}, but you have have already withdrawn from this event.  You can use \`!join\` to re-enter it.`, channel);
            throw new Warning("Player has already withdrew.");
        }

        try {
            await Event.removePlayer(user.discord.id);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a Discord error removing a pilot from the tournament.", err);
        }

        await Discord.queue("You have been successfully withdrawn from the event.  If you wish to return before the end of the event, you may use the `!join` command once again.", user);
        await Discord.queue(`${Discord.getGuildUser(user).displayName} has withdrawn from the tournament.`);

        return true;
    }

    // #
    // #
    // ###    ##   # #    ##
    // #  #  #  #  ####  # ##
    // #  #  #  #  #  #  ##
    // #  #   ##   #  #   ##
    /**
     * Sets home maps.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async home(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (!message) {
            return false;
        }

        let homeCount;
        try {
            homeCount = await Db.getHomeCountForDiscordId(user.discord.id);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting the count of a pilot's home maps.", err);
        }

        if (homeCount >= 3) {
            await Discord.queue(`Sorry, ${user}, but you have already set 3 home maps.  If you haven't played a match yet, you can use \`!resethome\` to reset your home map selections.`, channel);
            throw new Warning("Player already has 3 homes.");
        }

        let bannedHomes;
        try {
            bannedHomes = await Db.getBannedHomes(user.discord.id, Event.season);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting a pilot's banned homes.", err);
        }

        for (const home of bannedHomes) {
            const bannedHome = home.split(" ", 1)[0].toLowerCase(),
                homeToCheck = message.split(" ", 1)[0].toLowerCase();

            if (bannedHome === homeToCheck) {
                await Discord.queue(`Sorry, ${user}, but \`${message}\` appears to be banned for this season.  If you believe this is in error, please address this with @roncli.`, channel);
                throw new Warning("Home map is banned.");
            }
        }

        try {
            await Db.addHome(user.discord.id, message);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error setting a pilot's home map.", err);
        }

        homeCount++;
        if (homeCount < 3) {
            await Discord.queue(`You have successfully set one of your home maps to \`${message}\`.  You may set ${3 - homeCount} more home map${3 - homeCount === 1 ? "" : "s"}. You can use \`!resethome\` at any point prior to playing a match to reset your home maps.`, user);
            return true;
        }

        if (!Event.isRunning || Event.isFinals) {
            await Discord.queue(`You have successfully set one of your home maps to \`${message}\`.  Your maps for the season are now setup.  You can use \`!resethome\` at any point prior to playing a match to reset your home maps.`, user);
            await Discord.queue(`${user} has set their home maps, please check them against the ban list.`, Discord.alertsChannel);
            return true;
        }

        const player = Event.getPlayer(user.discord.id);
        if (!player) {
            await Discord.queue(`You have successfully set one of your home maps to \`${message}\`.  Your maps for the season are now setup.  You can use \`!resethome\` at any point prior to playing a match to reset your home maps.  You may now \`!join\` the current event.`, user);
            await Discord.queue(`${user} has set their home maps, please check them against the ban list.`, Discord.alertsChannel);
            return true;
        }

        let homes;
        try {
            homes = await Db.getHomesForDiscordId(user.discord.id);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting a pilot's home maps.", err);
        }

        Event.setHomes(user.discord.id, homes);
        await Discord.queue(`You have successfully set one of your home maps to \`${message}\`.  Your maps for the season are now setup.  You can use \`!resethome\` at any point prior to playing a match to reset your home maps.`, user);

        return true;
    }

    //                           #    #
    //                           #    #
    // ###    ##    ###    ##   ###   ###    ##   # #    ##
    // #  #  # ##  ##     # ##   #    #  #  #  #  ####  # ##
    // #     ##      ##   ##     #    #  #  #  #  #  #  ##
    // #      ##   ###     ##     ##  #  #   ##   #  #   ##
    /**
     * Resets home maps.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async resethome(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (message) {
            return false;
        }

        let status;
        try {
            status = await Db.getResetStatusForDiscordId(user.discord.id);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting whether a pilot's home maps are locked.", err);
        }

        if (!status.hasHomes) {
            await Discord.queue(`Sorry, ${user}, but you haven't set any home maps yet.  Please use the \`!home\` command to select 3 home maps, one at a time, for example, \`!home Logic x2\`.`, channel);
            throw new Warning("Player has no home maps.");
        }

        if (status.locked) {
            await Discord.queue(`Sorry, ${user}, but your home maps are set for the season.`, channel);
            throw new Warning("Player's home maps are locked.");
        }
        try {
            await Db.deleteHomesForDiscordId(user.discord.id);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error resetting a pilot's home maps.", err);
        }

        await Discord.queue("You have successfully cleared your home maps.  Please use the `!home` command to select 3 home maps, one at a time, for example, `!home Logic x2`.", user);

        return true;
    }

    // #                       ##     #            #
    // #                        #                  #
    // ###    ##   # #    ##    #    ##     ###   ###
    // #  #  #  #  ####  # ##   #     #    ##      #
    // #  #  #  #  #  #  ##     #     #      ##    #
    // #  #   ##   #  #   ##   ###   ###   ###      ##
    /**
     * Sends the list of home maps to a user.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async homelist(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (message) {
            return false;
        }

        let homeList;
        try {
            homeList = await Db.getHomeList();
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting the home map list.", err);
        }

        if (!homeList || homeList.length === 0) {
            await Discord.queue(`Sorry, ${user}, but no one has set their home map yet.`, channel);
            throw new Warning("No home maps set yet.");
        }

        const homes = {};

        homeList.forEach((row) => {
            const name = Discord.getGuildUser(row.DiscordID) || `<@${row.DiscordID}>`;

            if (!homes[name]) {
                homes[name] = [];
            }

            homes[name].push(row.Home);
        });

        let str = "Home maps for the season:";
        Object.keys(homes).sort().forEach((name) => {
            str += `\n${name}: \`${homes[name].join("`, `")}\``;
        });

        await Discord.queue(str, user);

        return true;
    }

    //         #                   #   #
    //         #                   #
    //  ###   ###    ###  ###    ###  ##    ###    ###   ###
    // ##      #    #  #  #  #  #  #   #    #  #  #  #  ##
    //   ##    #    # ##  #  #  #  #   #    #  #   ##     ##
    // ###      ##   # #  #  #   ###  ###   #  #  #     ###
    //                                             ###
    /**
     * Gets the current tournament's standings.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async standings(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        if (Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but this is a Finals Tournament event, and does not have any standings to display.  See the #match-results page for results from the tournament.`, channel);
            throw new Warning("Event is a Finals Tournament.");
        }

        let standings;
        try {
            standings = Event.getStandingsText();
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was an error getting the standings.", err);
        }

        await Discord.queue(standings, user);

        return true;
    }

    // #                   #
    // #                   #
    // ###    ##    ###   ###
    // #  #  #  #  ##      #
    // #  #  #  #    ##    #
    // #  #   ##   ###      ##
    /**
     * Toggles the player's ability to host.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async host(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        const player = Event.getPlayer(user.discord.id);

        if (!player) {
            if (Event.isFinals) {
                await Discord.queue(`Sorry, ${user}, but you are not entered into this tournament.`, channel);
            } else {
                await Discord.queue(`Sorry, ${user}, but you first need to \`!join\` the tournament before toggling your ability to host games.`, channel);
            }
            throw new Warning("Player hasn't joined tournament.");
        }

        if (player.withdrawn) {
            await Discord.queue(`Sorry, ${user}, but you have withdrawn from the tournament.`, channel);
            throw new Warning("Player withdrew from the tournament.");
        }

        player.canHost = !player.canHost;
        await Discord.queue(`You have successfully toggled ${player.canHost ? "on" : "off"} your ability to host games.`, user);
        await Discord.queue(`${Discord.getGuildUser(user).displayName} has toggled ${player.canHost ? "on" : "off"} their ability to host games.`);

        return true;
    }

    //       #
    //       #
    //  ##   ###    ##    ##    ###    ##
    // #     #  #  #  #  #  #  ##     # ##
    // #     #  #  #  #  #  #    ##   ##
    //  ##   #  #   ##    ##   ###     ##
    /**
     * Chooses a home map.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async choose(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (!message || ["a", "b", "c"].indexOf(message.toLowerCase()) === -1) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        const match = Event.getCurrentMatch(user.discord.id);

        if (!match) {
            await Discord.queue(`Sorry, ${user}, but I cannot find a match available for you.`, channel);
            throw new Warning("Player has no current match.");
        }

        if (match.home === user.discord.id) {
            await Discord.queue(`Sorry, ${user}, but your opponent must pick one of your home maps.`, channel);
            throw new Warning("Home player tried to select home map.");
        }

        await Event.setMatchHome(match, message.toLowerCase().charCodeAt(0) - 97);

        return true;
    }

    //                                #
    //                                #
    // ###    ##   ###    ##   ###   ###
    // #  #  # ##  #  #  #  #  #  #   #
    // #     ##    #  #  #  #  #      #
    // #      ##   ###    ##   #       ##
    //             #
    /**
     * Reports a match result.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async report(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        if (Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but this is not an event you can report games in.`, channel);
            throw new Warning("Event does not allow reporting.");
        }

        if (!reportParse.test(message)) {
            if (wrongReportParse.test(message)) {
                await Discord.queue(`Sorry, ${user}, but did you mean to report a negative score, or are you using the dash as a separator?  You must separate your score and your opponent's score with a space, not a dash: \`!report 20 12\``, channel);
                throw new Warning("Invalid syntax.");
            } else {
                await Discord.queue(`Sorry, ${user}, but you must report the score in the following format: \`!report 20 12\``, channel);
                throw new Warning("Invalid syntax.");
            }
        }

        const match = Event.getCurrentMatch(user.discord.id);
        if (!match) {
            await Discord.queue(`Sorry, ${user}, but I cannot find a match available for you.`, channel);
            throw new Warning("Player has no current match.");
        }

        if (!match.homeSelected) {
            await Discord.queue(`Sorry, ${user}, but no home map has been set for your match.  See the instructions in ${match.channel} to get a home map selected for this match.`, channel);
            throw new Warning("Current match has no home map set.");
        }

        let score1, score2;

        ({1: score1, 2: score2} = reportParse.exec(message));

        score1 = +score1;
        score2 = +score2;

        if (score1 < score2) {
            [score1, score2] = [score2, score1];
        }

        if (score1 < 20 || score1 === 20 && score1 - score2 < 2 || score1 > 20 && score1 - score2 !== 2) {
            await Discord.queue(`Sorry, ${user}, but that is an invalid score.  Games must be played to 20, and you must win by 2 points.`, channel);
            throw new Warning("Invalid score.");
        }

        const player2 = Discord.getGuildUser(match.players.filter((p) => p !== user.discord.id)[0]);

        match.reported = {
            winner: player2.id,
            score: [score1, score2]
        };

        await Discord.queue(`Game reported: ${player2.displayName} ${score1}, ${Discord.getGuildUser(user).displayName} ${score2}. ${player2}, please type \`!confirm\` to confirm the match.  If there is an error, such as the wrong person reported the game, it can be reported again to correct it.`, match.channel);

        return true;
    }

    //   #    #
    //  # #
    //  #    ##    #  #   ###    ##    ##   ###    ##
    // ###    #     ##   ##     #     #  #  #  #  # ##
    //  #     #     ##     ##   #     #  #  #     ##
    //  #    ###   #  #  ###     ##    ##   #      ##
    /**
     * Fixes the score of a match already played.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async fixscore(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but an event is not currently running.`, channel);
            throw new Warning("Event is currently running.");
        }

        if (!Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but the event currently running is not a Finals Tournament.`, channel);
            throw new Warning("Event is currently running.");
        }

        if (!reportGameParse.test(message)) {
            await Discord.queue(`Sorry, ${user}, but you must correct the score using the following format: \`!fixscore <player1> <score1> <player2> <score2>\`.`, channel);
            throw new Warning("Incorrect syntax.");
        }

        const {1: player1Id, 2: player1Score, 3: player2Id, 4: player2Score} = reportGameParse.exec(message);

        const match = Event.getMatchBetweenPlayers(player1Id, player2Id);

        if (!match) {
            await Discord.queue(`Sorry, ${user}, but I cannot find a match between those two players.`, channel);
            throw new Warning("No match between players.");
        }

        if (!match.winner) {
            await Discord.queue(`Sorry, ${user}, but you cannot correct game scores of an unreported match.`, channel);
            throw new Warning("Match not yet confirmed.");
        }

        await Event.fixScore(match, player1Id, +player1Score, player2Id, +player2Score);

        return true;
    }

    //                     #    #
    //                    # #
    //  ##    ##   ###    #    ##    ###   # #
    // #     #  #  #  #  ###    #    #  #  ####
    // #     #  #  #  #   #     #    #     #  #
    //  ##    ##   #  #   #    ###   #     #  #
    /**
     * Confirms a match result.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async confirm(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        if (Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but this is not an event you can report games in.`, channel);
            throw new Warning("Event does not allow reporting.");
        }

        const match = Event.getCurrentMatch(user.discord.id);
        if (!match) {
            await Discord.queue(`Sorry, ${user}, but I cannot find a match available for you.`, channel);
            throw new Warning("Player has no current match.");
        }

        if (!match.reported) {
            await Discord.queue(`Sorry, ${user}, but this match hasn't been reported yet.  Make sure the loser reports the result of the game in the following format: \`!report 20 12\``, channel);
            throw new Warning("Match is not yet reported.");
        }

        if (match.reported.winner !== user.discord.id) {
            await Discord.queue(`Sorry, ${user}, but you can't confirm your own reports!`, channel);
            throw new Warning("Player tried to confirm their own report.");
        }

        await Event.confirmResult(match, match.reported.winner, match.reported.score);

        return true;
    }

    //                                      #
    //                                      #
    //  ##    ##   # #   # #    ##   ###   ###
    // #     #  #  ####  ####  # ##  #  #   #
    // #     #  #  #  #  #  #  ##    #  #   #
    //  ##    ##   #  #  #  #   ##   #  #    ##
    /**
     * Comments a match.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async comment(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        const matches = Event.getCompletedMatches(user.discord.id);

        if (matches.length === 0) {
            await Discord.queue(`Sorry, ${user}, but you have not played in any matches that can be commented on.`, channel);
            throw new Warning("User has no completed matches.");
        }

        const match = matches[matches.length - 1];

        if (!match.comments) {
            match.comments = {};
        }

        match.comments[user.discord.id] = message;

        await Event.updateResult(match);

        await Discord.queue(`${user}, your match comment has been successfully updated.`, channel);

        return true;
    }

    //          #     #                           #
    //          #     #                           #
    //  ###   ###   ###   ##   # #    ##   ###   ###
    // #  #  #  #  #  #  # ##  # #   # ##  #  #   #
    // # ##  #  #  #  #  ##    # #   ##    #  #   #
    //  # #   ###   ###   ##    #     ##   #  #    ##
    /**
     * Adds a new event.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async addevent(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (!message) {
            return false;
        }

        if (!addEventParse.test(message)) {
            await Discord.queue(`Sorry, ${user}, but for you to add the event, you must include the name of the event followed by the time that it is to start.`, channel);
            return false;
        }

        const {1: season, 2: event, 3: date} = addEventParse.exec(message);

        let eventDate;
        try {
            eventDate = new Date(new tz.Date(date, "America/Los_Angeles"));
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but that is an invalid date and time.`, channel);
            throw new Warning("Invalid date and time.");
        }

        if (eventDate < new Date()) {
            await Discord.queue(`Sorry, ${user}, but that date occurs in the past.`, channel);
            throw new Warning("Date is in the past.");
        }

        try {
            await Event.addEvent(+season, event, eventDate);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a problem adding a new event.`, channel);
            throw err;
        }

        return true;
    }

    //                                      #                                     #
    //                                      #                                     #
    //  ###   ##   ###    ##   ###    ###  ###    ##   ###    ##   #  #  ###    ###
    // #  #  # ##  #  #  # ##  #  #  #  #   #    # ##  #  #  #  #  #  #  #  #  #  #
    //  ##   ##    #  #  ##    #     # ##   #    ##    #     #  #  #  #  #  #  #  #
    // #      ##   #  #   ##   #      # #    ##   ##   #      ##    ###  #  #   ###
    //  ###
    /**
     * Generates the next round of the tournament.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async generateround(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("Event is not currently running.");
        }

        if (Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but this is not an event you can generate rounds for.`, channel);
            throw new Warning("Event is not of the right type.");
        }

        try {
            await Event.loadRatedPlayers();
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.`, channel);
            throw new Exception("There was a database error getting the list of rated players.", err);
        }

        let matches;
        try {
            matches = await Event.generateRound();
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a problem matching players up for the next round.`, channel);
            throw err;
        }

        await Discord.queue(`Round ${Event.round} starts now!`);

        try {
            let str = "Matches:";

            for (const match of matches) {
                await Event.createMatch(match[0], match[1]);
                str += `\n**${Discord.getGuildUser(match[0]).displayName}** vs **${Discord.getGuildUser(match[1]).displayName}**`;
            }

            await Discord.queue(str);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a problem creating matches for the next round.`, channel);
            throw err;
        }

        return true;
    }

    //                #                                   #
    //                #                                   #
    // #  #  ###    ###   ##   ###    ##   #  #  ###    ###
    // #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #  #
    // #  #  #  #  #  #  #  #  #     #  #  #  #  #  #  #  #
    //  ###  #  #   ###   ##   #      ##    ###  #  #   ###
    /**
     * Completely backs out the current round.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async undoround(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("Event is not currently running.");
        }

        if (Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but this is not an event you can undo rounds in.`, channel);
            throw new Warning("Not an event where you can undo rounds.");
        }

        if (Event.round === 0) {
            await Discord.queue(`Sorry, ${user}, but the tournament has not started yet!`, channel);
            throw new Warning("Event has not started.");
        }

        await Event.undoRound();

        return true;
    }

    //                          #                       #          #
    //                          #                       #          #
    //  ##   ###    ##    ###  ###    ##   # #    ###  ###    ##   ###
    // #     #  #  # ##  #  #   #    # ##  ####  #  #   #    #     #  #
    // #     #     ##    # ##   #    ##    #  #  # ##   #    #     #  #
    //  ##   #      ##    # #    ##   ##   #  #   # #    ##   ##   #  #
    /**
     * Creates a match.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async creatematch(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("Event is not currently running.");
        }

        if (!twoIdParse.test(message)) {
            await Discord.queue(`Sorry, ${user}, but you must mention two users to create a match.  Try this command in a public channel.`, channel);
            throw new Warning("Users were not mentioned.");
        }

        const {1: player1Id, 2: player2Id} = twoIdParse.exec(message),
            player1 = Event.getPlayer(player1Id);

        if (!player1) {
            await Discord.queue(`Sorry, ${user}, but <@${player1Id}> has not joined the event.`, channel);
            throw new Warning("Player 1 hasn't joined the event.");
        }

        if (player1.withdrawn) {
            await Discord.queue(`Sorry, ${user}, but <@${player1Id}> has withdrawn from the event.`, channel);
            throw new Warning("Player 1 has withdrawn from the event.");
        }

        const player2 = Event.getPlayer(player2Id);

        if (!player2) {
            await Discord.queue(`Sorry, ${user}, but <@${player2Id}> has not joined the event.`, channel);
            throw new Warning("Player 2 hasn't joined the event.");
        }

        if (player2.withdrawn) {
            await Discord.queue(`Sorry, ${user}, but <@${player2Id}> has withdrawn from the event.`, channel);
            throw new Warning("Player 2 has withdrawn from the event.");
        }

        try {
            await Event.createMatch(player1Id, player2Id);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a problem creating the match.`, channel);
            throw err;
        }

        await Discord.queue(`Additional match:\n**${Discord.getGuildUser(player1Id).displayName}** vs **${Discord.getGuildUser(player2Id).displayName}**`);

        return true;
    }

    //                               ##                 #          #
    //                                #                 #          #
    //  ##    ###  ###    ##    ##    #    # #    ###  ###    ##   ###
    // #     #  #  #  #  #     # ##   #    ####  #  #   #    #     #  #
    // #     # ##  #  #  #     ##     #    #  #  # ##   #    #     #  #
    //  ##    # #  #  #   ##    ##   ###   #  #   # #    ##   ##   #  #
    /**
     * Cancels a match.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async cancelmatch(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("Event is not currently running.");
        }

        if (!twoIdParse.test(message)) {
            await Discord.queue(`Sorry, ${user}, but you must mention two users to cancel a match.  Try this command in a public channel.`, channel);
            throw new Warning("Users were not mentioned.");
        }

        const {1: player1Id, 2: player2Id} = twoIdParse.exec(message),
            match = Event.getMatchBetweenPlayers(player1Id, player2Id);

        if (!match) {
            await Discord.queue(`Sorry, ${user}, but I cannot find a match between those two players.`, channel);
            throw new Warning("No current match between players.");
        }

        await Event.cancelMatch(match);

        return true;
    }

    //                #                           #
    //                #                           #
    //  ##   ###    ###   ##   # #    ##   ###   ###
    // # ##  #  #  #  #  # ##  # #   # ##  #  #   #
    // ##    #  #  #  #  ##    # #   ##    #  #   #
    //  ##   #  #   ###   ##    #     ##   #  #    ##
    /**
     * Ends the event.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async endevent(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("Event is not currently running.");
        }

        if (Event.getAllMatches().filter((m) => !m.winner).length > 0) {
            await Discord.queue(`Sorry, ${user}, but there are still matches underway.`, channel);
            throw new Warning("Event is not currently running.");
        }

        let standings;
        try {
            standings = Event.getStandingsText();
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there is was an error ending the event.`, channel);
            throw new Exception("There was an error getting the standings.", err);
        }

        await Discord.queue(standings, Discord.resultsChannel);

        try {
            await Event.endEvent();
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there is was an error ending the event.`, channel);
            throw new Exception("There was an error while ending the event.", err);
        }

        await Discord.queue("The event has ended!  Thank you everyone for making it a success!");

        return true;
    }

    // #                 #
    // #                 #
    // ###    ###   ##   # #   #  #  ###
    // #  #  #  #  #     ##    #  #  #  #
    // #  #  # ##  #     # #   #  #  #  #
    // ###    # #   ##   #  #   ###  ###
    //                               #
    /**
     * Backs up the event.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async backup(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("Event is not currently running.");
        }

        try {
            await Event.backup();
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there is was an error backing up the event.`, channel);
            throw new Exception("There was an error while ending the event.", err);
        }

        await Discord.queue("The event has been backed up.", channel);

        return true;
    }

    //    #              ##     #
    //    #               #
    //  ###   ##    ##    #    ##    ###    ##
    // #  #  # ##  #      #     #    #  #  # ##
    // #  #  ##    #      #     #    #  #  ##
    //  ###   ##    ##   ###   ###   #  #   ##
    /**
     * Declines the invitation to the Finals Tournament.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async decline(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        if (!Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but this is not an event you can decline.`, channel);
            throw new Warning("Not a declinable event.");
        }

        const player = Event.getPlayer(user.discord.id);

        if (!player) {
            await Discord.queue(`Sorry, ${user}, but you have not been invited to this event.`, channel);
            throw new Warning("Player not invited to event.");
        }

        if (Event.round !== 0) {
            await Discord.queue(`Sorry, ${user}, but the event has already started.`, channel);
            throw new Warning("Event has already started.");
        }

        player.status = "declined";

        await Discord.removeUserFromRole(user, Discord.finalsTournamentAcceptedRole);
        await Discord.addUserToRole(user, Discord.finalsTournamentDeclinedRole);
        await Discord.removeUserFromRole(user, Discord.finalsTournamentInvitedRole);

        await Discord.queue(`${user}, I have recorded your response to decline the invitation.  You may change your mind at any time up until the tournament begins with \`!accept\`.`, channel);

        return true;
    }

    //                                #
    //                                #
    //  ###   ##    ##    ##   ###   ###
    // #  #  #     #     # ##  #  #   #
    // # ##  #     #     ##    #  #   #
    //  # #   ##    ##    ##   ###     ##
    //                         #
    /**
     * Accepts the invitation to the Finals Tournament.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async accept(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        if (!Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but this is not an event you can decline.`, channel);
            throw new Warning("Not a declinable event.");
        }

        const player = Event.getPlayer(user.discord.id);

        if (!player) {
            await Discord.queue(`Sorry, ${user}, but you have not been invited to this event.`, channel);
            throw new Warning("Player not invited to event.");
        }

        if (Event.round !== 0) {
            await Discord.queue(`Sorry, ${user}, but the event has already started.`, channel);
            throw new Warning("Event has already started.");
        }

        player.status = "accepted";

        await Discord.addUserToRole(user, Discord.finalsTournamentAcceptedRole);
        await Discord.removeUserFromRole(user, Discord.finalsTournamentDeclinedRole);
        await Discord.removeUserFromRole(user, Discord.finalsTournamentInvitedRole);

        if (player.anarchyMap || player.type === "knockout") {
            await Discord.queue(`${user}, I have recorded your response to accept the invitation!  You may change your mind at any time up until the tournament begins with \`!decline\`.`, channel);
        } else {
            await Discord.queue(`${user}, I have recorded your response to accept the invitation!  You will also need to select your anarchy map of choice by using the \`!anarchymap <map>\` command.  Remember primary weapons are duplicated!  You may change your mind at any time up until the tournament begins with \`!decline\`.`, channel);
        }

        return true;
    }

    //                               #
    //                               #
    //  ###  ###    ###  ###    ##   ###   #  #  # #    ###  ###
    // #  #  #  #  #  #  #  #  #     #  #  #  #  ####  #  #  #  #
    // # ##  #  #  # ##  #     #     #  #   # #  #  #  # ##  #  #
    //  # #  #  #   # #  #      ##   #  #    #   #  #   # #  ###
    //                                      #                #
    /**
     * Selects an anarchy map for the Wildcard Anarchy game.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async anarchymap(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (!message) {
            await Discord.queue(`Sorry, ${user}, but you must include the name of the map you want to play, for example, \`!anarchymap Logic x2\`.`, channel);
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        if (!Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but this is not an event you can decline.`, channel);
            throw new Warning("Not a declinable event.");
        }

        const player = Event.getPlayer(user.discord.id);

        if (!player) {
            await Discord.queue(`Sorry, ${user}, but you have not been invited to this event.`, channel);
            throw new Warning("Player not invited to event.");
        }

        if (Event.round !== 0) {
            await Discord.queue(`Sorry, ${user}, but the event has already started.`, channel);
            throw new Warning("Event has already started.");
        }

        if (player.type === "knockout") {
            await Discord.queue(`Sorry, ${user}, but you automatically qualified for the knockout tournament and do not need to select an anarchy map.`, channel);
            throw new Warning("Player is in the knockout tournament.");
        }

        player.anarchyMap = message;

        await Discord.queue(`${user}, I have recorded your choice for anarchy map as **${message}**.  Remember, the map that is actually played will be randomly selected from all participants' chosen anarchy map, and will have the map's primaries duplicated appropriately for the size of the anarchy.  You may change your selection at any time up until the event begins.`, channel);

        if (player.notified) {
            delete player.notified;
            await Event.checkWildcardMaps();
        }

        return true;
    }

    //              ##                 #
    //               #                 #
    //  ###    ##    #     ##    ##   ###
    // ##     # ##   #    # ##  #      #
    //   ##   ##     #    ##    #      #
    // ###     ##   ###    ##    ##     ##
    /**
     * Selects an opponent during the FInals Tournament.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async select(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Warning("No event currently running.");
        }

        if (!Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but this is not an event you can select an opponent in.`, channel);
            throw new Warning("Not an event that you can select an opponent in.");
        }

        const match = Event.getCurrentMatch(user.discord.id);

        if (!match) {
            await Discord.queue(`Sorry, ${user}, but you are not currently involved in a match.`, channel);
            throw new Warning("Not involved in a match.");
        }

        if (match.players.length !== 1) {
            await Discord.queue(`Sorry, ${user}, but your current match doesn't need an opponent selected.`, channel);
            throw new Warning("Opponent selection not needed.");
        }

        if (!match.opponents[+message - 1]) {
            await Discord.queue(`Sorry, ${user}, but your current match doesn't need an opponent selected.`, channel);
            throw new Warning("Opponent selection not needed.");
        }

        await Event.setOpponentForMatch(match, match.opponents[+message - 1]);

        return true;
    }

    //                   ##                      #
    //                    #                      #
    // ###    ##   ###    #     ###   ##    ##   ###    ##   # #    ##
    // #  #  # ##  #  #   #    #  #  #     # ##  #  #  #  #  ####  # ##
    // #     ##    #  #   #    # ##  #     ##    #  #  #  #  #  #  ##
    // #      ##   ###   ###    # #   ##    ##   #  #   ##   #  #   ##
    //             #
    /**
     * Replaces a home map between events.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async replacehome(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        if (!message) {
            return false;
        }

        let status;
        try {
            status = await Db.getResetStatusForDiscordId(user.discord.id);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting whether a pilot's home maps are locked.", err);
        }

        if (!status.hasHomes) {
            await Discord.queue(`Sorry, ${user}, but you have no home levels set.  Please use the \`!home\` command to select 3 home maps, one at a time, for example, \`!home Logic x2\`.`, channel);
            throw new Warning("Does not have homes.");
        }

        if (Event.isRunning && Event.round > 0) {
            await Discord.queue(`Sorry, ${user}, but an event is currently in progress, please wait for it to conclude.`, channel);
            throw new Warning("Event is currently in progress.");
        }

        if (!replaceHomeParse.test(message)) {
            await Discord.queue(`Sorry, ${user}, but the correct syntax of this command is \`!replace <oldhome> with <newhome>\`, for example, \`!replace Logic with Vamped\`.`, channel);
            throw new Warning("No event currently running.");
        }

        const {1: oldMap, 2: newMap} = replaceHomeParse.exec(message);

        let homes;
        try {
            homes = await Db.getHomesForDiscordId(user.discord.id);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting a pilot's home maps.", err);
        }

        if (homes.indexOf(oldMap) === -1) {
            await Discord.queue(`Sorry, ${user}, but \`${oldMap}\` is not a home level you can replace.  Your home levels are: ${homes.map((h) => `\`${h}\``).join(", ")}`, channel);
            throw new Warning("Invalid old home level.");
        }

        if (homes.indexOf(newMap) !== -1) {
            await Discord.queue(`Sorry, ${user}, but \`${newMap}\` is already one of your home maps!`, channel);
            throw new Warning("Invalid old home level.");
        }

        let bannedHomes;
        try {
            bannedHomes = await Db.getBannedHomes(user.discord.id, Event.season);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting a pilot's banned homes.", err);
        }

        for (const home of bannedHomes) {
            const bannedHome = home.split(" ", 1)[0].toLowerCase(),
                homeToCheck = newMap.split(" ", 1)[0].toLowerCase();

            if (bannedHome === homeToCheck) {
                await Discord.queue(`Sorry, ${user}, but \`${message}\` appears to be banned for this season.  If you believe this is in error, please address this with @roncli.`, channel);
                throw new Warning("Home map is banned.");
            }
        }

        try {
            await Event.replaceHome(user.discord, oldMap, newMap);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was an error replacing a pilot's home map.", err);
        }

        await Discord.queue(`${user} has replaced the map ${oldMap} with ${newMap}.`);

        return true;
    }

    //          #     #    #    #                ##
    //          #     #   # #                     #
    //  ###   ###   ###   #    ##    ###    ###   #     ###
    // #  #  #  #  #  #  ###    #    #  #  #  #   #    ##
    // # ##  #  #  #  #   #     #    #  #  # ##   #      ##
    //  # #   ###   ###   #    ###   #  #   # #  ###   ###
    /**
     * Adds a Finals Tournament event.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async addfinals(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (!message) {
            return false;
        }

        if (!addEventParse.test(message)) {
            await Discord.queue(`Sorry, ${user}, but for you to add the event, you must include the name of the event followed by the time that it is to start.`, channel);
            throw new Warning("Invalid syntax.");
        }

        const matches = addEventParse.exec(message),
            {2: event, 3: date} = matches,
            season = +matches[1];

        let eventDate;
        try {
            eventDate = new Date(new tz.Date(date, "America/Los_Angeles"));
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but that is an invalid date and time.`, channel);
            throw new Warning("Invalid date and time.");
        }

        if (eventDate < new Date()) {
            await Discord.queue(`Sorry, ${user}, but that date occurs in the past.`, channel);
            throw new Warning("Date is in the past.");
        }

        try {
            await Event.addFinals(season, event, eventDate);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a problem adding a new Finals Tournament event.`, channel);
            throw err;
        }

        return true;
    }

    //         #                 #      #    #                ##
    //         #                 #     # #                     #
    //  ###   ###    ###  ###   ###    #    ##    ###    ###   #     ###
    // ##      #    #  #  #  #   #    ###    #    #  #  #  #   #    ##
    //   ##    #    # ##  #      #     #     #    #  #  # ##   #      ##
    // ###      ##   # #  #       ##   #    ###   #  #   # #  ###   ###
    /**
     * Starts a currently open Finals Tournament event.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async startfinals(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but an event is not currently running.`, channel);
            throw new Warning("Event is currently running.");
        }

        if (!Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but the event currently running is not a Finals Tournament.`, channel);
            throw new Warning("Event is currently running.");
        }

        if (Event.round > 0) {
            await Discord.queue(`Sorry, ${user}, but the Finals Tournament has already started!`, channel);
            throw new Warning("Event has already started.");
        }

        await Event.startFinals();

        return true;
    }

    //                                #                                  #
    //                                #                                  #
    // ###    ##   ###    ##   ###   ###    ###  ###    ###  ###    ##   ###   #  #
    // #  #  # ##  #  #  #  #  #  #   #    #  #  #  #  #  #  #  #  #     #  #  #  #
    // #     ##    #  #  #  #  #      #    # ##  #  #  # ##  #     #     #  #   # #
    // #      ##   ###    ##   #       ##   # #  #  #   # #  #      ##   #  #    #
    //             #                                                            #
    /**
     * Reports the score of a Wildcard Anarchy game.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async reportanarchy(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but an event is not currently running.`, channel);
            throw new Warning("Event is currently running.");
        }

        if (!Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but the event currently running is not a Finals Tournament.`, channel);
            throw new Warning("Event is currently running.");
        }

        if (Event.round === 0) {
            await Discord.queue(`Sorry, ${user}, but the Finals Tournament has not started yet!`, channel);
            throw new Warning("Event has not started.");
        }

        const match = Event.getCurrentMatch();

        if (!match) {
            await Discord.queue(`Sorry, ${user}, but there is no match available!`, channel);
            throw new Warning("No match available.");
        }

        if (match.players.length <= 2) {
            await Discord.queue(`Sorry, ${user}, but you cannot report this as an anarchy match, use \`!reportgame\` instead.`, channel);
            throw new Warning("Not an anarchy match.");
        }

        if (!reportAnarchyParse.test(message)) {
            await Discord.queue(`Sorry, ${user}, but you must report an anarchy match using the following format: \`!reportanarchy <player1> <score1> <player2> <score2> ... <playern> <scoren>\`.`, channel);
            throw new Warning("Invalid syntax.");
        }

        const scores = [];
        let text = message,
            lastScore = Infinity;

        while (text) {
            const {1: userId, 2: score, 3: newMessage} = reportAnarchyParse.exec(text);

            if (+score > lastScore) {
                await Discord.queue(`Sorry, ${user}, but you must report scores in order of their placement in the game, with the top score first.`, channel);
                throw new Warning("Scores not in order.");
            }

            scores.push({
                id: userId,
                score: +score
            });

            text = newMessage;

            lastScore = +score;
        }

        const matchIds = match.players.map((p) => p),
            scoreIds = scores.map((s) => s.id);

        for (const scoreId of scoreIds) {
            if (matchIds.indexOf(scoreId) === -1) {
                await Discord.queue(`Sorry, ${user}, but ${Discord.getGuildUser(scoreId)} is not in this match.`, channel);
                throw new Warning("A player is not in the match.");
            }
        }

        for (const matchId of matchIds) {
            if (scoreIds.indexOf(matchId) === -1) {
                await Discord.queue(`Sorry, ${user}, but you must include the score for ${Discord.getGuildUser(matchId)}.`, channel);
                throw new Warning("A score was not reported.");
            }
        }

        await Event.reportAnarchy(match, scores);

        return true;
    }

    //                                #
    //                                #
    // ###    ##   ###    ##   ###   ###    ###   ###  # #    ##
    // #  #  # ##  #  #  #  #  #  #   #    #  #  #  #  ####  # ##
    // #     ##    #  #  #  #  #      #     ##   # ##  #  #  ##
    // #      ##   ###    ##   #       ##  #      # #  #  #   ##
    //             #                        ###
    /**
     * Reports the socre of a Finals Tournament game.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async reportgame(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await Discord.queue(`Sorry, ${user}, but an event is not currently running.`, channel);
            throw new Warning("Event is currently running.");
        }

        if (!Event.isFinals) {
            await Discord.queue(`Sorry, ${user}, but the event currently running is not a Finals Tournament.`, channel);
            throw new Warning("Event is currently running.");
        }

        if (Event.round === 0) {
            await Discord.queue(`Sorry, ${user}, but the Finals Tournament has not started yet!`, channel);
            throw new Warning("Event has not started.");
        }

        const match = Event.getCurrentMatch();

        if (!match) {
            await Discord.queue(`Sorry, ${user}, but there is no match available!`, channel);
            throw new Warning("No match available.");
        }

        if (match.players.length > 2) {
            await Discord.queue(`Sorry, ${user}, but you cannot report this as a head to head match, use the \`!reportanarchy\` command instead.`, channel);
            throw new Warning("Not a head to head match.");
        }

        if (!reportGameParse.test(message)) {
            await Discord.queue(`Sorry, ${user}, but you must report the game in the following format: \`!reportgame <player1> <score1> <player2> <score2>\``, channel);
            throw new Warning("Invalid syntax.");
        }

        const reportGameParsed = reportGameParse.exec(message);
        let player1Score, player2Score;

        const {1: player1Id, 3: player2Id} = reportGameParsed;
        ({2: player1Score, 4: player2Score} = reportGameParsed);

        player1Score = +player1Score;
        player2Score = +player2Score;

        if (match.players.indexOf(player1Id) === -1 || match.players.indexOf(player2Id) === -1) {
            await Discord.queue(`Sorry, ${user}, but there is not a match between those two players.`, channel);
            throw new Warning("No current match between the specified players.");
        }

        if (match.waitingForHome) {
            await Discord.queue(`Sorry, ${user}, but a home map has not been selected between those two players.`, channel);
            throw new Warning("No home map selected between the specified players.");
        }

        if (match.overtime) {
            if (Math.abs(+player1Score - +player2Score) < 2) {
                await Discord.queue(`Sorry, ${user}, but in overtime, a player must win by 2.`, channel);
                throw new Warning("Invalid overtime score.");
            }

            if (player1Score < 5 && player2Score < 5) {
                await Discord.queue(`Sorry, ${user}, but in overtime, a player must get a minimum of 5 points.`, channel);
                throw new Warning("Invalid overtime score.");
            }

            await Event.updateGame(match, [match.score[0] + (match.players[0] === player1Id ? +player1Score : +player2Score), match.score[1] + (match.players[1] === player1Id ? +player1Score : +player2Score)]);
        } else if (match.score) {
            const goalScores = [match.score[0] === match.killGoal ? match.score[1] + 1 : match.killGoal, match.score[1] === match.killGoal ? match.score[0] + 1 : match.killGoal],
                player1 = Discord.getGuildUser(player1Id),
                player2 = Discord.getGuildUser(player2Id);

            if ((match.players[0] === player1Id ? +player1Score : +player2Score) < goalScores[0] && (match.players[1] === player1Id ? +player1Score : +player2Score) < goalScores[1] || (match.players[0] === player1Id ? +player1Score : +player2Score) > goalScores[0] || (match.players[1] === player1Id ? +player1Score : +player2Score) > goalScores[1]) {
                await Discord.queue(`Sorry, ${user}, but this is an invalid score.  Either ${player1} needs ${match.players[0] === player1Id ? goalScores[0] : goalScores[1]} or ${player2} needs ${match.players[1] === player1Id ? goalScores[0] : goalScores[1]} for this to be a valid score.`, channel);
                throw new Warning("Invalid second game score.");
            }

            await Event.updateGame(match, [match.score[0] + (match.players[0] === player1Id ? +player1Score : +player2Score), match.score[1] + (match.players[1] === player1Id ? +player1Score : +player2Score)]);
        } else {
            if (player1Score < match.killGoal && player2Score < match.killGoal || player1Score > match.killGoal || player2Score > match.killGoal) {
                await Discord.queue(`Sorry, ${user}, but this is an invalid score.  One or both players must reach ${match.killGoal}.`, channel);
                throw new Warning("Invalid second game score.");
            }

            await Event.updateGame(match, [match.players[0] === player1Id ? +player1Score : +player2Score, match.players[1] === player1Id ? +player1Score : +player2Score]);
        }

        return true;
    }

    //   #                                             ##                      #
    //  # #                                             #                      #
    //  #     ##   ###    ##    ##   ###    ##   ###    #     ###   ##    ##   ###    ##   # #    ##
    // ###   #  #  #  #  #     # ##  #  #  # ##  #  #   #    #  #  #     # ##  #  #  #  #  ####  # ##
    //  #    #  #  #     #     ##    #     ##    #  #   #    # ##  #     ##    #  #  #  #  #  #  ##
    //  #     ##   #      ##    ##   #      ##   ###   ###    # #   ##    ##   #  #   ##   #  #   ##
    //                                           #
    /**
     * Forces a player to replace one of their home maps.  Overrides ban checks.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async forcereplacehome(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (!message) {
            return false;
        }

        if (!forceReplaceHomeParse.test(message)) {
            await Discord.queue(`Sorry, ${user}, but you must mention the user whose home to replace along with the map to replace and the map to replace it with.  For example, \`!forcereplacehome @roncli Logic with Vamped\`.`, channel);
            throw new Warning("Invalid syntax.");
        }

        const {1: playerId, 2: oldMap, 3: newMap} = forceReplaceHomeParse.exec(message),
            guildMember = Discord.getGuildUser(playerId);

        if (!guildMember) {
            await Discord.queue(`Sorry, ${user}, but the user you are trying to replace a home for does not exist.`, channel);
            throw new Warning("User does not exist.");
        }

        try {
            await Event.replaceHome(guildMember, oldMap, newMap);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was an error replacing a pilot's home map.", err);
        }

        await Discord.queue(`${guildMember} has replaced the map ${oldMap} with ${newMap}.`);

        return true;
    }

    //   #                           #
    //  # #                          #
    //  #     ##   ###    ##    ##   ###    ##   # #    ##
    // ###   #  #  #  #  #     # ##  #  #  #  #  ####  # ##
    //  #    #  #  #     #     ##    #  #  #  #  #  #  ##
    //  #     ##   #      ##    ##   #  #   ##   #  #   ##
    /**
     * Forces a player to set one of their home maps.  Overrides ban checks.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async forcehome(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (!message) {
            return false;
        }

        if (!forceHomeParse.test(message)) {
            await Discord.queue(`Sorry, ${user}, but you must mention the user whose home to replace along with the map to replace and the map to replace it with.  For example, \`!forcereplacehome @roncli Logic with Vamped\`.`, channel);
            throw new Warning("Invalid syntax.");
        }

        const {1: playerId, 2: map} = forceHomeParse.exec(message),
            guildMember = Discord.getGuildUser(playerId);

        if (!guildMember) {
            await Discord.queue(`Sorry, ${user}, but the user you are trying to replace a home for does not exist.`, channel);
            throw new Warning("User does not exist.");
        }

        let homeCount;
        try {
            homeCount = await Db.getHomeCountForDiscordId(playerId);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting the count of a pilot's home maps.", err);
        }

        if (homeCount >= 3) {
            await Discord.queue(`Sorry, ${user}, but ${guildMember.displayName} has already set 3 home maps.`, channel);
            throw new Warning("Player already has 3 homes.");
        }

        try {
            await Db.addHome(playerId, map);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error setting a pilot's home map.", err);
        }

        homeCount++;
        if (homeCount < 3) {
            await Discord.queue(`${guildMember}, ${user} has set one of your home maps to \`${message}\`.  You may set ${3 - homeCount} more home map${3 - homeCount === 1 ? "" : "s"}. You can use \`!resethome\` at any point prior to playing a match to reset your home maps.`, guildMember);
            return true;
        }

        if (!Event.isRunning || Event.isFinals) {
            await Discord.queue(`${guildMember}, ${user} has set one of your home maps to \`${message}\`.  Your maps for the season are now setup.  You can use \`!resethome\` at any point prior to playing a match to reset your home maps.`, guildMember);
            await Discord.queue(`${guildMember.displayName} has set their home maps, please check them against the ban list.`, Discord.alertsChannel);
            return true;
        }

        const player = Event.getPlayer(playerId);
        if (!player) {
            await Discord.queue(`${guildMember}, ${user} has set one of your home maps to \`${message}\`.  Your maps for the season are now setup.  You can use \`!resethome\` at any point prior to playing a match to reset your home maps.  You may now \`!join\` the current event.`, guildMember);
            await Discord.queue(`${guildMember.displayName} has set their home maps, please check them against the ban list.`, Discord.alertsChannel);
            return true;
        }

        let homes;
        try {
            homes = await Db.getHomesForDiscordId(playerId);
        } catch (err) {
            await Discord.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting a pilot's home maps.", err);
        }

        Event.setHomes(playerId, homes);
        await Discord.queue(`${guildMember}, ${user} has successfully set one of your home maps to \`${message}\`.  Your maps for the season are now setup.  You can use \`!resethome\` at any point prior to playing a match to reset your home maps.`, guildMember);

        return true;
    }

    // # #    ##   ###    ###   ##
    // ####  # ##  #  #  #  #  # ##
    // #  #  ##    #      ##   ##
    // #  #   ##   #     #      ##
    //                    ###
    /**
     * Merge two players into one, ensuring stats are updated.
     * @param {User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<boolean>} A promise that resolves with whether the command completed successfully.
     */
    async merge(user, message, channel) {
        Commands.checkMessageIsFromDiscord(this.service);

        Commands.checkUserIsAdmin(user);

        if (!message) {
            return false;
        }

        if (!mergeParse.test(message)) {
            await Discord.queue(`Sorry, ${user}, but you must mention two users to merge them, such as \`!merge @roncli#1234 into @roncli#5678\`.  Try this command in a public channel.`, channel);
            throw new Warning("Users were not mentioned.");
        }

        const {1: player1Id, 2: player2Id} = mergeParse.exec(message);

        if (!await Event.getRatedPlayerById(player1Id)) {
            await Discord.queue(`Sorry, ${user}, but the user you are trying to merge does not exist.`, channel);
            throw new Warning("First user does not exist.");
        }

        if (await Event.getRatedPlayerById(player2Id)) {
            await Discord.queue(`Sorry, ${user}, but the user you are trying to merge into already exists.`, channel);
            throw new Warning("First user does not exist.");
        }

        await Event.merge(player1Id, player2Id);

        const guildUser = Discord.getGuildUser(player2Id);

        await Discord.queue(`${guildUser}, your account has been updated, and you should now be able to join events under this one.`);

        return true;
    }
}

tz.timezone.loadingScheme = tz.timezone.loadingSchemes.MANUAL_LOAD;
tz.timezone.loadZoneDataFromObject(tzData);

module.exports = Commands;
