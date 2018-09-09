const Db = require("./database"),
    Event = require("./event"),
    Exception = require("./exception"),
    pjson = require("./package.json"),

    forceChooseParse = /^<@!?([0-9]+)> <@!?([0-9]+)> ([abc])$/,
    forceReportParse = /^<@!?([0-9]+)> <@!?([0-9]+)> (-?[0-9]+) (-?[0-9]+)$/,
    idParse = /^<@!?([0-9]+)>$/,
    reportParse = /^(-?[0-9]+) (-?[0-9]+)$/,
    twoIdParse = /^<@!?([0-9]+)> <@!?([0-9]+)>$/;

let Discord, Tmi;

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
     * @param {Discord|Tmi} service The service to use with the commands.
     */
    constructor(service) {
        this.service = service;

        if (!Discord) {
            Discord = require("./discord");
        }

        if (!Tmi) {
            Tmi = require("./tmi");
        }
    }

    //          #         #           ##   #                 #
    //          #                    #  #  #                 #
    //  ###   ###  # #   ##    ###   #     ###    ##    ##   # #
    // #  #  #  #  ####   #    #  #  #     #  #  # ##  #     ##
    // # ##  #  #  #  #   #    #  #  #  #  #  #  ##    #     # #
    //  # #   ###  #  #  ###   #  #   ##   #  #   ##    ##   #  #
    /**
     * Throws an error if the user is not an admin.
     * @param {Commands} commands The commands object.
     * @param {string|User} user The user to check.
     * @returns {void}
     */
    static adminCheck(commands, user) {
        if (!(commands.service.name === "Discord" && Discord.isOwner(user) || commands.service.name === "Tmi" && Tmi.isMod(user))) {
            throw new Error("Admin permission required to perform this command.");
        }
    }

    //    #   #                                #   ##   #                 #
    //    #                                    #  #  #  #                 #
    //  ###  ##     ###    ##    ##   ###    ###  #     ###    ##    ##   # #
    // #  #   #    ##     #     #  #  #  #  #  #  #     #  #  # ##  #     ##
    // #  #   #      ##   #     #  #  #     #  #  #  #  #  #  ##    #     # #
    //  ###  ###   ###     ##    ##   #      ###   ##   #  #   ##    ##   #  #
    /**
     * Throws an error if the user is not on Discord.
     * @param {Commands} commands The commands object.
     * @returns {Promise} A promise that resolves if the user is on Discord.
     */
    static discordCheck(commands) {
        if (commands.service.name !== "Discord") {
            throw new Error("This command is for Discord only.");
        }
    }

    //  #           #     ##   #                 #
    //  #                #  #  #                 #
    // ###   # #   ##    #     ###    ##    ##   # #
    //  #    ####   #    #     #  #  # ##  #     ##
    //  #    #  #   #    #  #  #  #  ##    #     # #
    //   ##  #  #  ###    ##   #  #   ##    ##   #  #
    /**
     * A promise that only proceeds if the user is on tmi.
     * @param {Commands} commands The commands object.
     * @returns {Promise} A promise that resolves if the user is on tmi.
     */
    static tmiCheck(commands) {
        if (commands.service.name !== "Tmi") {
            throw new Error("This command is for Twitch chat only.");
        }
    }

    //    #   #                                #
    //    #                                    #
    //  ###  ##     ###    ##    ##   ###    ###
    // #  #   #    ##     #     #  #  #  #  #  #
    // #  #   #      ##   #     #  #  #     #  #
    //  ###  ###   ###     ##    ##   #      ###
    /**
     * Replies with Six Gaming's Discord URL.  Tmi-only.
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async discord(user, message, channel) {
        const commands = this;

        Commands.tmiCheck(commands);

        if (message) {
            return false;
        }

        await commands.service.queue("Interested in playing in the tournament?  All skill levels are welcome!  Join our Discord server at http://ronc.li/obs-discord", channel);

        return true;
    }

    //             #             #     #
    //             #                   #
    // #  #   ##   ###    ###   ##    ###    ##
    // #  #  # ##  #  #  ##      #     #    # ##
    // ####  ##    #  #    ##    #     #    ##
    // ####   ##   ###   ###    ###     ##   ##
    /**
     * Replies with Six Gaming's Website URL.  Tmi-only.
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async website(user, message, channel) {
        const commands = this;

        if (message) {
            return false;
        }

        await commands.service.queue("Visit The Observatory on the web at http://roncli.com/gaming/the-observatory", channel);

        return true;
    }

    //                           #
    //
    // # #    ##   ###    ###   ##     ##   ###
    // # #   # ##  #  #  ##      #    #  #  #  #
    // # #   ##    #       ##    #    #  #  #  #
    //  #     ##   #     ###    ###    ##   #  #
    /**
     * Replies with the current version of the bot.
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async version(user, message, channel) {
        const commands = this;

        if (message) {
            return false;
        }

        await commands.service.queue(`FusionBot, DescentBot, whatever, I have an identity crisis.  Written by roncli, Version ${pjson.version}`, channel);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async join(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("No event currently running.");
        }

        if (!Event.isJoinable) {
            await commands.service.queue(`Sorry, ${user}, but this is not an event you can join.`, channel);
            throw new Error("Not a joinable event.");
        }

        const player = Event.getPlayer(user.id);

        if (player && !player.withdrawn) {
            await commands.service.queue(`Sorry, ${user}, but you have already joined this event.  You can use \`!withdraw\` to leave it.`, channel);
            throw new Error("Already joined.");
        }

        let homes;
        try {
            homes = await Db.getHomesForDiscordId(user.id);
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting a pilot's home maps.", err);
        }

        if (homes.length < 3) {
            await commands.service.queue(`Sorry, ${user}, but you have not yet set all 3 home maps.  Please use the \`!home\` command to select 3 home maps, one at a time, for example, \`!home Logic x2\`.`, channel);
            throw new Error("Pilot has not yet set 3 home maps.");
        }

        if (player) {
            delete player.withdrawn;
        } else {
            Event.addPlayer(user.id, homes);
        }

        Discord.addEventRole(user);

        await commands.service.queue("You have been successfully added to the event.  I assume you can host games, but if you cannot please issue the `!host` command to toggle this option.", channel);
        await Discord.queue(`${Discord.getGuildUser(user).displayName} has joined the tournament!`);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async withdraw(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("No event currently running.");
        }

        if (!Event.isJoinable) {
            await commands.service.queue(`Sorry, ${user}, but this is not an event you can withdraw from.`, channel);
            throw new Error("Not a withdrawable event.");
        }

        const player = Event.getPlayer(user.id);

        if (!player) {
            await commands.service.queue(`Sorry, ${user}, but you have not yet joined this event.  You can use \`!join\` to enter it.`, channel);
            throw new Error("Player has not entered.");
        }

        if (player.withdrawn) {
            await commands.service.queue(`Sorry, ${user}, but you have have already withdrawn from this event.  You can use \`!join\` to re-enter it.`, channel);
            throw new Error("Player has already withdrew.");
        }

        Event.removePlayer(user.id);

        await commands.service.queue("You have been successfully withdrawn from the event.  If you wish to return before the end of the event, you may use the `!join` command once again.", user);
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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async home(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);

        if (!message) {
            return false;
        }

        let homeCount;
        try {
            homeCount = await Db.getHomeCountForDiscordId(user.id);
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting the count of a pilot's home maps.", err);
        }

        if (homeCount >= 3) {
            await commands.service.queue(`Sorry, ${user}, but you have already set 3 home maps.  If you haven't played a match yet, you can use \`!resethome\` to reset your home map selections.`, channel);
            throw new Error("Player already has 3 homes.");
        }

        try {
            await Db.addHome(user.id, message);
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error setting a pilot's home map.", err);
        }

        homeCount++;
        if (homeCount < 3) {
            await commands.service.queue(`You have successfully set one of your home maps to \`${message}\`.  You may set ${3 - homeCount} more home map${3 - homeCount === 1 ? "" : "s"}. You can use \`!resethome\` at any point prior to playing a match to reset your home maps.`, user);
            return true;
        }

        if (!Event.isJoinable()) {
            await commands.service.queue(`You have successfully set one of your home maps to \`${message}\`.  Your maps for the season are now setup.  You can use \`!resethome\` at any point prior to playing a match to reset your home maps.`, user);
            return true;
        }

        const player = Event.getPlayer(user.id);
        if (!player) {
            await commands.service.queue(`You have successfully set one of your home maps to \`${message}\`.  Your maps for the season are now setup.  You can use \`!resethome\` at any point prior to playing a match to reset your home maps.  You may now \`!join\` the current event.`, user);
            return true;
        }

        let homes;
        try {
            homes = await Db.getHomesForDiscordId(user.id);
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting a pilot's home maps.", err);
        }

        Event.setHomes(user.id, homes);
        await commands.service.queue(`You have successfully set one of your home maps to \`${message}\`.  Your maps for the season are now setup.  You can use \`!resethome\` at any point prior to playing a match to reset your home maps.`, user);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async resethome(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);

        if (!message) {
            return false;
        }

        let status;
        try {
            status = await Db.getResetStatusForDiscordId(user.id);
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting whether a pilot's home maps are locked.", err);
        }

        if (!status.hasHomes) {
            await commands.service.queue(`Sorry, ${user}, but you haven't set any home maps yet.  Please use the \`!home\` command to select 3 home maps, one at a time, for example, \`!home Logic x2\`.`, channel);
            throw new Error("Player has no home maps.");
        }

        if (status.locked) {
            await commands.service.queue(`Sorry, ${user}, but your home maps are set for the season.`, channel);
            throw new Error("Player's home maps are locked.");
        }
        try {
            await Db.deleteHomesForDiscordId(user.id);
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error resetting a pilot's home maps.", err);
        }

        await commands.service.queue("You have successfully cleared your home maps.  Please use the `!home` command to select 3 home maps, one at a time, for example, `!home Logic x2`.", user);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async homelist(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);

        if (message) {
            return false;
        }

        let homeList;
        try {
            homeList = await Db.getHomeList();
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting the home map list.", err);
        }

        if (!homeList || homeList.length === 0) {
            await commands.service.queue(`Sorry, ${user}, but no one has set their home map yet.`, channel);
            throw new Error("No home maps set yet.");
        }

        const homes = {};

        homeList.forEach((row) => {
            const name = Discord.getGuildUser(row.DiscordID);

            if (!homes[name]) {
                homes[name] = [];
            }

            homes[name].push(row.Home);
        });

        let str = "Home maps for the season:";
        Object.keys(homes).sort().forEach((name) => {
            str += `\n${name}: \`${homes[name].join("`, `")}\``;
        });

        await commands.service.queue(str, user);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async standings(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("No event currently running.");
        }

        const standings = Event.getStandings();
        let str = "Standings:";

        standings.forEach((index) => {
            const player = standings[index];

            str += `\n${index + 1}) ${player.name} - ${player.score} (${player.wins}-${player.losses})`;
        });

        await commands.service.queue(str, user);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async host(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("No event currently running.");
        }

        const player = Event.getPlayer(user.id);

        if (!player) {
            if (Event.isJoinable) {
                await commands.service.queue(`Sorry, ${user}, but you first need to \`!join\` the tournament before toggling your ability to host games.`, channel);
            } else {
                await commands.service.queue(`Sorry, ${user}, but you are not entered into this tournament.`, channel);
            }
            throw new Error("Player hasn't joined tournament.");
        }

        if (player.withdrawn) {
            await commands.service.queue(`Sorry, ${user}, but you have withdrawn from the tournament.`, channel);
            throw new Error("Player withdrew from the tournament.");
        }

        player.canHost = !player.canHost;
        await commands.service.queue(`You have successfully toggled ${player.canHost ? "on" : "off"} your ability to host games.`, user);
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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async choose(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);

        if (!message || ["a", "b", "c"].indexOf(message.toLowerCase()) === -1) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("No event currently running.");
        }

        const match = Event.getCurrentMatch(user.id);

        if (!match) {
            await commands.service.queue(`Sorry, ${user}, but I cannot find a match available for you.`, channel);
            throw new Error("Player has no current match.");
        }

        if (match.home === user.id) {
            await commands.service.queue(`Sorry, ${user}, but your opponent must pick one of your home maps.`, channel);
            throw new Error("Home player tried to select home map.");
        }

        Event.setMatchHome(match, message.toLowerCase().charCodeAt(0) - 97);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async report(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("No event currently running.");
        }

        if (!Event.isJoinable) {
            await commands.service.queue(`Sorry, ${user}, but this is not an event you can report games in.`, channel);
            throw new Error("Event does not allow reporting.");
        }

        const matches = reportParse.exec(message);
        if (!matches) {
            await commands.service.queue(`Sorry, ${user}, but you you must report the score in the following format: \`!report 20 12\``, channel);
            throw new Error("Invalid syntax.");
        }

        const match = Event.getCurrentMatch(user.id);
        if (!match) {
            await commands.service.queue(`Sorry, ${user}, but I cannot find a match available for you.`, channel);
            throw new Error("Player has no current match.");
        }

        if (!match.homeSelected) {
            await commands.service.queue(`Sorry, ${user}, but no home map has been set for your match.  See the instructions in ${match.channel} to get a home map selected for this match.`, channel);
            throw new Error("Current match has no home map set.");
        }

        let score1 = +matches[1],
            score2 = +matches[2];

        if (score1 < score2) {
            const temp = score1;
            score1 = score2;
            score2 = temp;
        }

        if (score1 < 20 || score1 === 20 && score1 - score2 < 2 || score1 > 20 && score1 - score2 !== 2) {
            await commands.service.queue(`Sorry, ${user}, but that is an invalid score.  Games must be played to 20, and you must win by 2 points.`, channel);
            throw new Error("Invalid score.");
        }

        const player2 = Discord.getGuildUser(match.players.filter((p) => p !== user.id)[0]);

        match.reported = {
            winner: player2.id,
            score: [score1, score2]
        };

        await Discord.queue(`Game reported: ${player2.displayName} ${score1}, ${Discord.getGuildUser(user).displayName} ${score2}. ${player2}, please type \`!confirm\` to confirm the match.  If there is an error, such as the wrong person reported the game, it can be reported again to correct it.`, match.channel);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async confirm(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("No event currently running.");
        }

        if (!Event.isJoinable) {
            await commands.service.queue(`Sorry, ${user}, but this is not an event you can report games in.`, channel);
            throw new Error("Event does not allow reporting.");
        }

        const match = Event.getCurrentMatch(user.id);
        if (!match) {
            await commands.service.queue(`Sorry, ${user}, but I cannot find a match available for you.`, channel);
            throw new Error("Player has no current match.");
        }

        if (!match.reported) {
            await commands.service.queue(`Sorry, ${user}, but this match hasn't been reported yet.  Make sure the loser reports the result of the game in the following format: \`!report 20 12\``, channel);
            throw new Error("Match is not yet reported.");
        }

        if (!match.reported.winner === user.id) {
            await commands.service.queue(`Sorry, ${user}, but you can't confirm your own reports!`, channel);
            throw new Error("Player tried to confirm their own report.");
        }

        match.winner = match.reported.winner;
        match.score = match.reported.score;
        delete match.reported;

        await Discord.queue(`This match has been reported as a win for ${Discord.getGuildUser(user).displayName} by the score of ${match.score[0]} to ${match.score[1]}.  If this is in error, please contact an admin.  You may add a comment to this match using \`!comment <your comment>\` any time before your next match.  This channel and the voice channel will close in 2 minutes.`, match.channel);

        setTimeout(() => {
            Event.postResult(match);
        }, 120000);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async comment(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("No event currently running.");
        }

        const matches = Event.getCompletedMatches(user.id);

        if (matches.length === 0) {
            await commands.service.queue(`Sorry, ${user}, but you have not played in any matches that can be commented on.`, channel);
            throw new Error("User has no completed matches.");
        }

        const match = matches[matches.length - 1];

        if (!match.comments) {
            match.comments = {};
        }

        match.comments[user.id] = message;

        Event.updateResult(match);

        await commands.service.queue(`${user}, your match comment has been successfully updated.`);

        return true;
    }

    //                                                  #
    //                                                  #
    //  ##   ###    ##   ###    ##   # #    ##   ###   ###
    // #  #  #  #  # ##  #  #  # ##  # #   # ##  #  #   #
    // #  #  #  #  ##    #  #  ##    # #   ##    #  #   #
    //  ##   ###    ##   #  #   ##    #     ##   #  #    ##
    //       #
    /**
     * Opens a new event.
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async openevent(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);
        Commands.adminCheck(commands, user);

        if (message) {
            return false;
        }

        if (Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but you must \`!endevent\` the previous event first.`, channel);
            throw new Error("Event is currently running.");
        }

        Event.openEvent();

        await Discord.queue("Hey everyone, a new tournament has been created.  If you'd like to play be sure you have set your home maps for the season by using the `!home` command, setting one map at a time, for example, `!home Logic x2`.  Then `!join` the tournament!");

        return true;
    }

    //         #                 #                             #
    //         #                 #                             #
    //  ###   ###    ###  ###   ###    ##   # #    ##   ###   ###
    // ##      #    #  #  #  #   #    # ##  # #   # ##  #  #   #
    //   ##    #    # ##  #      #    ##    # #   ##    #  #   #
    // ###      ##   # #  #       ##   ##    #     ##   #  #    ##
    /**
     * Starts a new event.
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async startevent(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);
        Commands.adminCheck(commands, user);

        if (message) {
            return false;
        }

        if (Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but you must \`!endevent\` the previous event first.`, channel);
            throw new Error("Event is currently running.");
        }

        Event.startEvent();

        await Discord.queue("A new event has been started.");

        return true;
    }

    //          #     #        ##
    //          #     #         #
    //  ###   ###   ###  ###    #     ###  #  #   ##   ###
    // #  #  #  #  #  #  #  #   #    #  #  #  #  # ##  #  #
    // # ##  #  #  #  #  #  #   #    # ##   # #  ##    #
    //  # #   ###   ###  ###   ###    # #    #    ##   #
    //                   #                  #
    /**
     * Adds a player to the event.
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async addplayer(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);
        Commands.adminCheck(commands, user);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("Event is not currently running.");
        }

        const matches = idParse.exec(message);

        if (!matches) {
            await commands.service.queue(`Sorry, ${user}, but you must mention the user to add them.  Try this command in a public channel.`, channel);
            throw new Error("A user was not mentioned.");
        }

        const addedUser = Discord.getGuildUser(matches[1]);

        if (!addedUser) {
            await commands.service.queue(`Sorry, ${user}, but that person is not part of this Discord server.`, channel);
            throw new Error("User does not exist.");
        }

        const player = Event.getPlayer(addedUser.id);

        if (player && !player.withdrawn) {
            await commands.service.queue(`Sorry, ${user}, but ${addedUser.displayName} has already joined the event.  You can use \`!removeplayer\` to remove them instead.`, channel);
            throw new Error("User does not exist.");
        }

        let homes;
        try {
            homes = await Db.getHomesForDiscordId(addedUser.id);
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
            throw new Exception("There was a database error getting a pilot's home maps.", err);
        }

        if (homes.length < 3) {
            await commands.service.queue(`Sorry, ${user}, but this player has not added all 3 home maps yet.`, channel);
            throw new Error("Pilot has not yet set 3 home maps.");
        }

        Event.addPlayer(addedUser.id, homes);

        await commands.service.queue(`You have successfully added ${addedUser.displayName} to the event.`, channel);
        await Discord.queue(`${Discord.getGuildUser(user).displayName} has added you to the next event!  I assume you can host games, but if you cannot please issue the \`!host\` command to toggle this option.`, addedUser);
        await Discord.queue(`${addedUser.displayName} has joined the tournament!`);

        return true;
    }

    //                                           ##
    //                                            #
    // ###    ##   # #    ##   # #    ##   ###    #     ###  #  #   ##   ###
    // #  #  # ##  ####  #  #  # #   # ##  #  #   #    #  #  #  #  # ##  #  #
    // #     ##    #  #  #  #  # #   ##    #  #   #    # ##   # #  ##    #
    // #      ##   #  #   ##    #     ##   ###   ###    # #    #    ##   #
    //                                     #                  #
    /**
     * Removes a player from the event.
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async removeplayer(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);
        Commands.adminCheck(commands, user);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("Event is not currently running.");
        }

        const matches = idParse.exec(message);

        if (!matches) {
            await commands.service.queue(`Sorry, ${user}, but you must mention the user to add them.  Try this command in a public channel.`, channel);
            throw new Error("A user was not mentioned.");
        }

        const player = Event.getPlayer(matches[1]);

        if (!player) {
            await commands.service.queue(`Sorry, ${user}, but that player has not joined the event.  You can use \`!addplayer\` to add them instead.`, channel);
            throw new Error("A user was not mentioned.");
        }

        const removedUser = Discord.getGuildUser(matches[1]);

        Event.removePlayer(matches[1]);

        await commands.service.queue(`You have successfully removed ${removedUser ? removedUser.displayName : message} from the event.`, channel);
        if (removedUser) {
            await Discord.queue(`${Discord.getGuildUser(user).displayName} has removed you from the event.`, removedUser);
        }
        await Discord.queue(`${removedUser ? removedUser.displayName : message} has been removed from the tournament.`);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async generateround(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);
        Commands.adminCheck(commands, user);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("Event is not currently running.");
        }

        if (!Event.isJoinable) {
            await commands.service.queue(`Sorry, ${user}, but this is not an event you can generate rounds for.  Did you mean to use the \`!creatematch\` command?`, channel);
            throw new Error("Event is not of the right type.");
        }

        let matches;
        try {
            matches = Event.generateRound();
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there was a problem matching players up for the next round.`, channel);
            throw err;
        }

        await Discord.queue(`Round ${Event.round} starts now!`);

        try {
            matches.forEach(async (match) => {
                await Event.createMatch(match[0], match[1]);
            });
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there was a problem creating matches for the next round.`, channel);
            throw err;
        }

        return true;
    }

    //   #                                 #
    //  # #                                #
    //  #     ##   ###    ##    ##    ##   ###    ##    ##    ###    ##
    // ###   #  #  #  #  #     # ##  #     #  #  #  #  #  #  ##     # ##
    //  #    #  #  #     #     ##    #     #  #  #  #  #  #    ##   ##
    //  #     ##   #      ##    ##    ##   #  #   ##    ##   ###     ##
    /**
     * Forces a map to be picked.
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async forcechoose(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);
        Commands.adminCheck(commands, user);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("Event is not currently running.");
        }

        const matches = forceChooseParse.exec(message);
        if (!matches) {
            await commands.service.queue(`Sorry, ${user}, but you must mention two users to force the map, followed by the map choice.  Try this command in a public channel.`, channel);
            throw new Error("Users were not mentioned, or incorrect command format.");
        }

        const match = Event.getCurrentMatch(matches[1]);
        if (!match || match.players.indexOf(matches[1]) === -1 || match.players.indexOf(matches[2]) === -1) {
            await commands.service.queue(`Sorry, ${user}, but I cannot find a match between those two players.`, channel);
            throw new Error("No current match between players.");
        }

        Event.setMatchHome(match, matches[3].charCodeAt(0) - 97);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async creatematch(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);
        Commands.adminCheck(commands, user);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("Event is not currently running.");
        }

        const matches = twoIdParse.exec(message);

        if (!matches) {
            await commands.service.queue(`Sorry, ${user}, but you must mention two users to create a match.  Try this command in a public channel.`, channel);
            throw new Error("Users were not mentioned.");
        }

        try {
            await Event.createMatch(matches[1], matches[2]);
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there was a problem creating the match.`, channel);
            throw err;
        }

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async cancelmatch(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);
        Commands.adminCheck(commands, user);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("Event is not currently running.");
        }

        const matches = twoIdParse.exec(message);

        if (!matches) {
            await commands.service.queue(`Sorry, ${user}, but you must mention two users to cancel a match.  Try this command in a public channel.`, channel);
            throw new Error("Users were not mentioned.");
        }

        const match = Event.getCurrentMatch(matches[1]);

        if (!match || match.players.indexOf(matches[1]) === -1 || match.players.indexOf(matches[2]) === -1) {
            await commands.service.queue(`Sorry, ${user}, but I cannot find a match between those two players.`, channel);
            throw new Error("No current match between players.");
        }

        match.cancelled = true;

        const player1 = Discord.getGuildUser(match.players[0]),
            player2 = Discord.getGuildUser(match.players[1]);

        await Discord.queue(`The match between ${player1} and ${player2} has been cancelled.`);
        await Discord.queue("This match has been cancelled.  This channel and the voice channel will close in 2 minutes.", match.channel);

        setTimeout(() => {
            Discord.removePermissions(player1, match.channel);
            Discord.removePermissions(player2, match.channel);
            Discord.removeChannel(match.voice);
            delete match.channel;
            delete match.voice;
        }, 120000);

        return true;
    }

    //   #                                                          #
    //  # #                                                         #
    //  #     ##   ###    ##    ##   ###    ##   ###    ##   ###   ###
    // ###   #  #  #  #  #     # ##  #  #  # ##  #  #  #  #  #  #   #
    //  #    #  #  #     #     ##    #     ##    #  #  #  #  #      #
    //  #     ##   #      ##    ##   #      ##   ###    ##   #       ##
    //                                           #
    /**
     * Forces a match report.
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async forcereport(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);
        Commands.adminCheck(commands, user);

        if (!message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("Event is not currently running.");
        }

        const matches = forceReportParse.exec(message);

        if (!matches) {
            await commands.service.queue(`Sorry, ${user}, but you must mention two users to force the match report, followed by the score.  Try this command in a public channel.`, channel);
            throw new Error("Users were not mentioned.");
        }

        const score1 = +matches[1],
            score2 = +matches[2];

        if (score1 < 20 || score1 === 20 && score1 - score2 < 2 || score1 > 20 && score1 - score2 !== 2) {
            await commands.service.queue(`Sorry, ${user}, but that is an invalid score.  Games must be played to 20, and you must win by 2 points.`, channel);
            throw new Error("Invalid score.");
        }

        const match = Event.getCurrentMatch(matches[1]);

        if (!match || match.players.indexOf(matches[1]) === -1 || match.players.indexOf(matches[2]) === -1) {
            await commands.service.queue(`Sorry, ${user}, but I cannot find a match between those two players.`, channel);
            throw new Error("No current match between players.");
        }

        if (!match.homeSelected) {
            await commands.service.queue(`Sorry, ${user}, but no home map has been set for this match.`, channel);
            throw new Error("Current match has no home map set.");
        }

        match.winner = matches[1];
        match.score = [score1, score2];
        delete match.reported;

        await Discord.queue(`This match has been reported as a win for ${Discord.getGuildUser(match.winner).displayName} by the score of ${match.score[0]} to ${match.score[1]}.  If this is in error, please contact an admin.  You may add a comment to this match using \`!comment <your comment>\` any time before your next match.  This channel and the voice channel will close in 2 minutes.`, match.channel);

        setTimeout(() => {
            Event.postResult(match);
        }, 120000);

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
     * @param {string|User} user The user initiating the command.
     * @param {string} message The text of the command.
     * @param {object} channel The channel the command was sent on.
     * @returns {Promise<bool>} A promise that resolves with whether the command completed successfully.
     */
    async endevent(user, message, channel) {
        const commands = this;

        Commands.discordCheck(commands);
        Commands.adminCheck(commands, user);

        if (message) {
            return false;
        }

        if (!Event.isRunning) {
            await commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
            throw new Error("Event is not currently running.");
        }

        try {
            await Event.endEvent();
        } catch (err) {
            await commands.service.queue(`Sorry, ${user}, but there is was an error ending the event.`, channel);
            throw new Exception("There was an error while ending the event.", err);
        }

        await Discord.queue("The event has ended!  Thank you everyone for making it a success!");

        return true;
    }
}

module.exports = Commands;
