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

    //          #         #          ###                      #
    //          #                    #  #
    //  ###   ###  # #   ##    ###   #  #  ###    ##   # #   ##     ###    ##
    // #  #  #  #  ####   #    #  #  ###   #  #  #  #  ####   #    ##     # ##
    // # ##  #  #  #  #   #    #  #  #     #     #  #  #  #   #      ##   ##
    //  # #   ###  #  #  ###   #  #  #     #      ##   #  #  ###   ###     ##
    /**
     * A promise that only proceeds if the user is an admin.
     * @param {Commands} commands The commands object.
     * @param {string|User} user The user to check.
     * @param {function} fx The function to run with the promise.
     * @returns {Promise} A promise that resolves if the user is an admin.
     */
    static adminPromise(commands, user, fx) {
        return new Promise((resolve, reject) => {
            if (!(commands.service.name === "Discord" && Discord.isOwner(user) || commands.service.name === "Tmi" && Tmi.isMod(user))) {
                reject(new Error("Admin permission required to perform this command."));
                return;
            }

            if (fx) {
                new Promise(fx).then(resolve).catch(reject);
            } else {
                resolve();
            }
        });
    }

    //    #   #                                #  ###                      #
    //    #                                    #  #  #
    //  ###  ##     ###    ##    ##   ###    ###  #  #  ###    ##   # #   ##     ###    ##
    // #  #   #    ##     #     #  #  #  #  #  #  ###   #  #  #  #  ####   #    ##     # ##
    // #  #   #      ##   #     #  #  #     #  #  #     #     #  #  #  #   #      ##   ##
    //  ###  ###   ###     ##    ##   #      ###  #     #      ##   #  #  ###   ###     ##
    /**
     * A promise that only proceeds if the user is on Discord.
     * @param {Commands} commands The commands object.
     * @param {function} fx The function to run with the promise.
     * @returns {Promise} A promise that resolves if the user is on Discord.
     */
    static discordPromise(commands, fx) {
        return new Promise((resolve, reject) => {
            if (commands.service.name !== "Discord") {
                reject(new Error("This command is for Discord only."));
                return;
            }

            if (fx) {
                new Promise(fx).then(resolve).catch(reject);
            } else {
                resolve();
            }
        });
    }

    //                               ###                      #
    //                               #  #
    //  ##   #  #  ###    ##   ###   #  #  ###    ##   # #   ##     ###    ##
    // #  #  #  #  #  #  # ##  #  #  ###   #  #  #  #  ####   #    ##     # ##
    // #  #  ####  #  #  ##    #     #     #     #  #  #  #   #      ##   ##
    //  ##   ####  #  #   ##   #     #     #      ##   #  #  ###   ###     ##
    /**
     * A promise that only proceeds if the user is the owner.
     * @param {User} user The user to check.
     * @param {function} fx The function to run with the promise.
     * @returns {Promise} A promise that resolves if the user is the owner.
     */
    static ownerPromise(user, fx) {
        return new Promise((resolve, reject) => {
            if (typeof user === "string" || !Discord.isOwner(user)) {
                reject(new Error("Owner permission required to perform this command."));
                return;
            }

            if (fx) {
                new Promise(fx).then(resolve).catch(reject);
            } else {
                resolve();
            }
        });
    }

    //  #           #    ###                      #
    //  #                #  #
    // ###   # #   ##    #  #  ###    ##   # #   ##     ###    ##
    //  #    ####   #    ###   #  #  #  #  ####   #    ##     # ##
    //  #    #  #   #    #     #     #  #  #  #   #      ##   ##
    //   ##  #  #  ###   #     #      ##   #  #  ###   ###     ##
    /**
     * A promise that only proceeds if the user is on tmi.
     * @param {Commands} commands The commands object.
     * @param {function} fx The function to run with the promise
     * @returns {Promise} A promise that resolves if the user is on tmi.
     */
    static tmiPromise(commands, fx) {
        return new Promise((resolve, reject) => {
            if (commands.service.name !== "Tmi") {
                reject(new Error("This command is for Twitch chat only."));
                return;
            }

            if (fx) {
                new Promise(fx).then(resolve).catch(reject);
            } else {
                resolve();
            }
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    discord(user, message, channel) {
        const commands = this;

        return Commands.tmiPromise(commands, (resolve) => {
            if (message) {
                resolve(false);
                return;
            }

            commands.service.queue("Interested in playing in the tournament?  All skill levels are welcome!  Join our Discord server at http://ronc.li/obs-discord", channel);
            resolve(true);
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    website(user, message, channel) {
        const commands = this;

        return Commands.tmiPromise(commands, (resolve) => {
            if (message) {
                resolve(false);
                return;
            }

            commands.service.queue("Visit The Observatory on the web at http://roncli.com/gaming/the-observatory", channel);
            resolve(true);
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    version(user, message, channel) {
        const commands = this;

        return new Promise((resolve) => {
            if (message) {
                resolve(false);
                return;
            }

            commands.service.queue(`FusionBot, DescentBot, whatever, I have an identity crisis.  Written by roncli, Version ${pjson.version}`, channel);
            resolve(true);
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    join(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands, (resolve, reject) => {
            if (message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("No event currently running."));
                return;
            }

            if (!Event.isJoinable) {
                commands.service.queue(`Sorry, ${user}, but this is not an event you can join.`, channel);
                reject(new Error("Not a joinable event."));
                return;
            }

            const player = Event.getPlayer(user.id);

            if (player && !player.withdrawn) {
                commands.service.queue(`Sorry, ${user}, but you have already joined this event.  You can use \`!withdraw\` to leave it.`, channel);
                reject(new Error("Already joined."));
                return;
            }

            Db.getHomesForDiscordId(user.id).then((homes) => {
                if (homes.length < 3) {
                    commands.service.queue(`Sorry, ${user}, but you have not yet set all 3 home maps.  Please use the \`!home\` command to select 3 home maps, one at a time, for example, \`!home Logic x2\`.`, channel);
                    reject(new Error("Pilot has not yet set 3 home maps."));
                    return;
                }

                if (player) {
                    delete player.withdrawn;
                } else {
                    Event.addPlayer(user.id, homes);
                }

                Discord.addEventRole(user);

                commands.service.queue("You have been successfully added to the event.  I assume you can host games, but if you cannot please issue the `!host` command to toggle this option.", channel);
                Discord.queue(`${Discord.getGuildUser(user).displayName} has joined the tournament!`);
            }).catch((err) => {
                commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
                reject(new Exception("There was a database error getting a pilot's home maps.", err));
            });
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    withdraw(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands, (resolve, reject) => {
            if (message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("No event currently running."));
                return;
            }

            if (!Event.isJoinable) {
                commands.service.queue(`Sorry, ${user}, but this is not an event you can withdraw from.`, channel);
                reject(new Error("Not a withdrawable event."));
                return;
            }

            const player = Event.getPlayer(user.id);

            if (!player) {
                commands.service.queue(`Sorry, ${user}, but you have not yet joined this event.  You can use \`!join\` to enter it.`, channel);
                reject(new Error("Player has not entered."));
                return;
            }

            if (player.withdrawn) {
                commands.service.queue(`Sorry, ${user}, but you have have already withdrawn from this event.  You can use \`!join\` to re-enter it.`, channel);
                reject(new Error("Player has already withdrew."));
                return;
            }

            Event.removePlayer(user.id);

            commands.service.queue("You have been successfully withdrawn from the event.  If you wish to return before the end of the event, you may use the `!join` command once again.", user);
            Discord.queue(`${Discord.getGuildUser(user).displayName} has withdrawn from the tournament.`);
            resolve();
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    home(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands, (resolve, reject) => {
            if (!message) {
                resolve(false);
                return;
            }

            Db.getHomeCountForDiscordId(user.id).then((homeCount) => {
                if (homeCount >= 3) {
                    commands.service.queue(`Sorry, ${user}, but you have already set 3 home maps.  If you haven't played a match yet, you can use \`!resethome\` to reset your home map selections.`, channel);
                    reject(new Error("Player already has 3 homes."));
                    return;
                }

                Db.addHome(user.id, message).then(() => {
                    homeCount++;

                    const player = Event.getPlayer(user.id);

                    if (homeCount < 3 || !player) {
                        resolve(true);
                        return;
                    }

                    Db.getHomesForDiscordId(user.id).then((homes) => {
                        commands.service.queue(`You have successfully set one of your home maps to \`${message}\`.  You may set ${3 - homes.length} more home map${3 - homes.length === 1 ? "" : "s"}. You can use \`!resethome\` at any point prior to playing a match to reset your home maps.`, user);

                        Event.setHomes(user.id, homes);

                        resolve(true);
                    }).catch((err) => {
                        commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
                        reject(new Exception("There was a database error getting a pilot's home maps.", err));
                    });
                }).catch((err) => {
                    commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
                    reject(new Exception("There was a database error setting a pilot's home map.", err));
                });
            }).catch((err) => {
                commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
                reject(new Exception("There was a database error getting the count of a pilot's home maps.", err));
            });
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    resethome(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands, (resolve, reject) => {
            if (!message) {
                resolve(false);
                return;
            }

            Db.getResetStatusForDiscordId(user.id).then((status) => {
                if (!status.hasHomes) {
                    commands.service.queue(`Sorry, ${user}, but you haven't set any home maps yet.  Please use the \`!home\` command to select 3 home maps, one at a time, for example, \`!home Logic x2\`.`, channel);
                    reject(new Error("Player has no home maps."));
                    return;
                }

                if (status.locked) {
                    commands.service.queue(`Sorry, ${user}, but your home maps are set for the season.`, channel);
                    reject(new Error("Player's home maps are locked."));
                    return;
                }

                Db.deleteHomesForDiscordId(user.id).then(() => {
                    commands.service.queue("You have successfully cleared your home maps.  Please use the `!home` command to select 3 home maps, one at a time, for example, `!home Logic x2`.", user);
                    resolve(true);
                }).catch((err) => {
                    commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
                    reject(new Exception("There was a database error resetting a pilot's home maps.", err));
                });
            }).catch((err) => {
                commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
                reject(new Exception("There was a database error getting whether a pilot's home maps are locked.", err));
            });
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    homelist(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands, (resolve, reject) => {
            if (message) {
                resolve(false);
                return;
            }

            Db.getHomeList().then((homeList) => {
                if (!homeList || homeList.length === 0) {
                    commands.service.queue(`Sorry, ${user}, but no one has set their home map yet.`, channel);
                    reject(new Error("No home maps set yet."));
                    return;
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

                commands.service.queue(str, user);
                resolve(true);
            }).catch((err) => {
                commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
                reject(new Exception("There was a database error getting the home map list.", err));
            });
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    standings(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands, (resolve, reject) => {
            if (message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("No event currently running."));
                return;
            }

            const standings = Event.getStandings();
            let str = "Standings:";

            standings.forEach((index) => {
                const player = standings[index];

                str += `\n${index + 1}) ${player.name} - ${player.score} (${player.wins}-${player.losses})`;
            });

            commands.service.queue(str, user);
            resolve(true);
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    host(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands, (resolve, reject) => {
            if (message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("No event currently running."));
                return;
            }

            const player = Event.getPlayer(user.id);

            if (!player) {
                if (Event.isJoinable) {
                    commands.service.queue(`Sorry, ${user}, but you first need to \`!join\` the tournament before toggling your ability to host games.`, channel);
                    reject(new Error("Player hasn't joined tournament."));
                    return;
                }

                commands.service.queue(`Sorry, ${user}, but you are not entered into this tournament.`, channel);
                reject(new Error("Player hasn't joined tournament."));
                return;
            }

            if (player.withdrawn) {
                commands.service.queue(`Sorry, ${user}, but you have withdrawn from the tournament.`, channel);
                reject(new Error("Player withdrew from the tournament."));
                return;
            }

            player.canHost = !player.canHost;
            commands.service.queue(`You have successfully toggled ${player.canHost ? "on" : "off"} your ability to host games.`, user);
            Discord.queue(`${Discord.getGuildUser(user).displayName} has toggled ${player.canHost ? "on" : "off"} their ability to host games.`);
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    choose(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands, (resolve, reject) => {
            if (!message || ["a", "b", "c"].indexOf(message.toLowerCase()) === -1) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("No event currently running."));
                return;
            }

            const match = Event.getCurrentMatch(user.id);

            if (!match) {
                commands.service.queue(`Sorry, ${user}, but I cannot find a match available for you.`, channel);
                reject(new Error("Player has no current match."));
                return;
            }

            if (match.home === user.id) {
                commands.service.queue(`Sorry, ${user}, but your opponent must pick one of your home maps.`, channel);
                reject(new Error("Home player tried to select home map."));
                return;
            }

            Event.setMatchHome(match, message.toLowerCase().charCodeAt(0) - 97);

            resolve(true);
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    report(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands, (resolve, reject) => {
            if (!message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("No event currently running."));
                return;
            }

            if (!Event.isJoinable) {
                commands.service.queue(`Sorry, ${user}, but this is not an event you can report games in.`, channel);
                reject(new Error("Event does not allow reporting."));
                return;
            }

            const matches = reportParse.exec(message);
            if (!matches) {
                commands.service.queue(`Sorry, ${user}, but you you must report the score in the following format: \`!report 20 12\``, channel);
                reject(new Error("Invalid syntax."));
                return;
            }

            const match = Event.getCurrentMatch(user.id);
            if (!match) {
                commands.service.queue(`Sorry, ${user}, but I cannot find a match available for you.`, channel);
                reject(new Error("Player has no current match."));
                return;
            }

            if (!match.homeSelected) {
                commands.service.queue(`Sorry, ${user}, but no home map has been set for your match.  See the instructions in ${match.channel} to get a home map selected for this match.`, channel);
                reject(new Error("Current match has no home map set."));
                return;
            }

            let score1 = +matches[1],
                score2 = +matches[2];

            if (score1 < score2) {
                const temp = score1;
                score1 = score2;
                score2 = temp;
            }

            if (score1 < 20 || score1 === 20 && score1 - score2 < 2 || score1 > 20 && score1 - score2 !== 2) {
                commands.service.queue(`Sorry, ${user}, but that is an invalid score.  Games must be played to 20, and you must win by 2 points.`, channel);
                reject(new Error("Invalid score."));
                return;
            }

            const player2 = Discord.getGuildUser(match.players.filter((p) => p !== user.id)[0]);

            match.reported = {
                winner: player2.id,
                score: [score1, score2]
            };

            Discord.queue(`Game reported: ${player2.displayName} ${score1}, ${Discord.getGuildUser(user).displayName} ${score2}. ${player2}, please type \`!confirm\` to confirm the match.  If there is an error, such as the wrong person reported the game, it can be reported again to correct it.`, match.channel);
            resolve(true);
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    confirm(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands, (resolve, reject) => {
            if (message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("No event currently running."));
                return;
            }

            if (!Event.isJoinable) {
                commands.service.queue(`Sorry, ${user}, but this is not an event you can report games in.`, channel);
                reject(new Error("Event does not allow reporting."));
                return;
            }

            const match = Event.getCurrentMatch(user.id);
            if (!match) {
                commands.service.queue(`Sorry, ${user}, but I cannot find a match available for you.`, channel);
                reject(new Error("Player has no current match."));
                return;
            }

            if (!match.reported) {
                commands.service.queue(`Sorry, ${user}, but this match hasn't been reported yet.  Make sure the loser reports the result of the game in the following format: \`!report 20 12\``, channel);
                reject(new Error("Match is not yet reported."));
                return;
            }

            if (!match.reported.winner === user.id) {
                commands.service.queue(`Sorry, ${user}, but you can't confirm your own reports!`, channel);
                reject(new Error("Player tried to confirm their own report."));
                return;
            }

            match.winner = match.reported.winner;
            match.score = match.reported.score;
            delete match.reported;

            Discord.queue(`This match has been reported as a win for ${Discord.getGuildUser(user).displayName} by the score of ${match.score[0]} to ${match.score[1]}.  If this is in error, please contact an admin.  You may add a comment to this match using \`!comment <your comment>\` any time before your next match.  This channel and the voice channel will close in 2 minutes.`, match.channel);

            setTimeout(() => {
                Event.postResult(match);
            }, 120000);

            resolve(true);
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    comment(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands, (resolve, reject) => {
            if (!message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("No event currently running."));
                return;
            }

            const matches = Event.getCompletedMatches(user.id);

            if (matches.length === 0) {
                commands.service.queue(`Sorry, ${user}, but you have not played in any matches that can be commented on.`, channel);
                reject(new Error("User has no completed matches."));
                return;
            }

            const match = matches[matches.length - 1];

            if (!match.comments) {
                match.comments = {};
            }

            match.comments[user.id] = message;

            Event.updateResult(match);

            commands.service.queue(`${user}, your match comment has been successfully updated.`);
            resolve(true);
        });
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    openevent(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands).then(() => Commands.adminPromise(commands, user, (resolve, reject) => {
            if (message) {
                resolve(false);
                return;
            }

            if (Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but you must \`!endevent\` the previous event first.`, channel);
                reject(new Error("Event is currently running."));
                return;
            }

            Event.openEvent();

            Discord.queue("Hey @everyone, a new tournament has been created.  If you'd like to play be sure you have set your home maps for the season by using the `!home` command, setting one map at a time, for example, `!home Logic x2`.  Then `!join` the tournament!");
            resolve(true);
        }));
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    startevent(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands).then(() => Commands.adminPromise(commands, user, (resolve, reject) => {
            if (message) {
                resolve(false);
                return;
            }

            if (Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but you must \`!endevent\` the previous event first.`, channel);
                reject(new Error("Event is currently running."));
                return;
            }

            Event.startEvent();

            Discord.queue("A new event has been started.");
            resolve(true);
        }));
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    addplayer(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands).then(() => Commands.adminPromise(commands, user, (resolve, reject) => {
            if (!message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("Event is not currently running."));
                return;
            }

            const matches = idParse.exec(message);

            if (!matches) {
                commands.service.queue(`Sorry, ${user}, but you must mention the user to add them.  Try this command in a public channel.`, channel);
                reject(new Error("A user was not mentioned."));
                return;
            }

            const addedUser = Discord.getGuildUser(matches[1]);

            if (!addedUser) {
                commands.service.queue(`Sorry, ${user}, but that person is not part of this Discord server.`, channel);
                reject(new Error("User does not exist."));
                return;
            }

            const player = Event.getPlayer(addedUser.id);

            if (player && !player.withdrawn) {
                commands.service.queue(`Sorry, ${user}, but ${addedUser.displayName} has already joined the event.  You can use \`!removeplayer\` to remove them instead.`, channel);
                reject(new Error("User does not exist."));
                return;
            }

            Db.getHomesForDiscordId(addedUser.id).then((homes) => {
                if (homes.length < 3) {
                    commands.service.queue(`Sorry, ${user}, but this player has not added all 3 home maps yet.`, channel);
                    reject(new Error("Pilot has not yet set 3 home maps."));
                    return;
                }

                Event.addPlayer(addedUser.id, homes);

                commands.service.queue(`You have successfully added ${addedUser.displayName} to the event.`, channel);
                Discord.queue(`${Discord.getGuildUser(user).displayName} has added you to the next event!  I assume you can host games, but if you cannot please issue the \`!host\` command to toggle this option.`, addedUser);
                Discord.queue(`${addedUser.displayName} has joined the tournament!`);
                resolve(true);
            }).catch((err) => {
                commands.service.queue(`Sorry, ${user}, but there was a server error.  roncli will be notified about this.`, channel);
                reject(new Exception("There was a database error getting a pilot's home maps.", err));
            });
        }));
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    removeplayer(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands).then(() => Commands.adminPromise(commands, user, (resolve, reject) => {
            if (!message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("Event is not currently running."));
                return;
            }

            const matches = idParse.exec(message);

            if (!matches) {
                commands.service.queue(`Sorry, ${user}, but you must mention the user to add them.  Try this command in a public channel.`, channel);
                reject(new Error("A user was not mentioned."));
                return;
            }

            const player = Event.getPlayer(matches[1]);

            if (!player) {
                commands.service.queue(`Sorry, ${user}, but that player has not joined the event.  You can use \`!addplayer\` to add them instead.`, channel);
                reject(new Error("A user was not mentioned."));
                return;
            }

            const removedUser = Discord.getGuildUser(matches[1]);

            Event.removePlayer(matches[1]);

            commands.service.queue(`You have successfully removed ${removedUser ? removedUser.displayName : message} from the event.`, channel);
            if (removedUser) {
                Discord.queue(`${Discord.getGuildUser(user).displayName} has removed you from the event.`, removedUser);
            }
            Discord.queue(`${removedUser ? removedUser.displayName : message} has been removed from the tournament.`);
            resolve(true);
        }));
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    generateround(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands).then(() => Commands.adminPromise(commands, user, (resolve, reject) => {
            if (message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("Event is not currently running."));
                return;
            }

            if (!Event.isJoinable) {
                commands.service.queue(`Sorry, ${user}, but this is not an event you can generate rounds for.  Did you mean to use the \`!creatematch\` command?`, channel);
                reject(new Error("Event is not of the right type."));
                return;
            }

            Event.generateRound().then((matches) => {
                Discord.queue(`Round ${Event.round} starts now!`);

                Promise.all(matches.map((match) => Event.createMatch(match[0], match[1]))).then(() => {
                    resolve(true);
                }).catch((err) => {
                    commands.service.queue(`Sorry, ${user}, but there was a problem creating matches for the next round.`, channel);
                    reject(err);
                });
            }).catch((err) => {
                commands.service.queue(`Sorry, ${user}, but there was a problem matching players up for the next round.`, channel);
                reject(err);
            });
        }));
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    forcechoose(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands).then(() => Commands.adminPromise(commands, user, (resolve, reject) => {
            if (!message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("Event is not currently running."));
                return;
            }

            const matches = forceChooseParse.exec(message);

            if (!matches) {
                commands.service.queue(`Sorry, ${user}, but you must mention two users to force the map, followed by the map choice.  Try this command in a public channel.`, channel);
                reject(new Error("Users were not mentioned, or incorrect command format."));
                return;
            }

            const match = Event.getCurrentMatch(matches[1]);

            if (!match || match.players.indexOf(matches[1]) === -1 || match.players.indexOf(matches[2]) === -1) {
                commands.service.queue(`Sorry, ${user}, but I cannot find a match between those two players.`, channel);
                reject(new Error("No current match between players."));
                return;
            }

            Event.setMatchHome(match, matches[3].charCodeAt(0) - 97);

            resolve(true);
        }));
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    creatematch(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands).then(() => Commands.adminPromise(commands, user, (resolve, reject) => {
            if (!message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("Event is not currently running."));
                return;
            }

            const matches = twoIdParse.exec(message);

            if (!matches) {
                commands.service.queue(`Sorry, ${user}, but you must mention two users to create a match.  Try this command in a public channel.`, channel);
                reject(new Error("Users were not mentioned."));
                return;
            }

            Event.createMatch(matches[1], matches[2]).then(() => {
                resolve(true);
            }).catch((err) => {
                reject(err);
            });
        }));
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    cancelmatch(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands).then(() => Commands.adminPromise(commands, user, (resolve, reject) => {
            if (!message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("Event is not currently running."));
                return;
            }

            const matches = twoIdParse.exec(message);

            if (!matches) {
                commands.service.queue(`Sorry, ${user}, but you must mention two users to cancel a match.  Try this command in a public channel.`, channel);
                reject(new Error("Users were not mentioned."));
                return;
            }

            const match = Event.getCurrentMatch(matches[1]);

            if (!match || match.players.indexOf(matches[1]) === -1 || match.players.indexOf(matches[2]) === -1) {
                commands.service.queue(`Sorry, ${user}, but I cannot find a match between those two players.`, channel);
                reject(new Error("No current match between players."));
                return;
            }

            match.cancelled = true;

            const player1 = Discord.getGuildUser(match.players[0]),
                player2 = Discord.getGuildUser(match.players[1]);

            Discord.queue(`The match between ${player1} and ${player2} has been cancelled.`);
            Discord.queue("This match has been cancelled.  This channel and the voice channel will close in 2 minutes.", match.channel);

            setTimeout(() => {
                Discord.removePermissions(player1, match.channel);
                Discord.removePermissions(player2, match.channel);
                Discord.removeChannel(match.voice);
                delete match.channel;
                delete match.voice;
            }, 120000);

            resolve(true);
        }));
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    forcereport(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands).then(() => Commands.adminPromise(commands, user, (resolve, reject) => {
            if (!message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("Event is not currently running."));
                return;
            }

            const matches = forceReportParse.exec(message);

            if (!matches) {
                commands.service.queue(`Sorry, ${user}, but you must mention two users to force the match report, followed by the score.  Try this command in a public channel.`, channel);
                reject(new Error("Users were not mentioned."));
                return;
            }

            const score1 = +matches[1],
                score2 = +matches[2];

            if (score1 < 20 || score1 === 20 && score1 - score2 < 2 || score1 > 20 && score1 - score2 !== 2) {
                commands.service.queue(`Sorry, ${user}, but that is an invalid score.  Games must be played to 20, and you must win by 2 points.`, channel);
                reject(new Error("Invalid score."));
                return;
            }

            const match = Event.getCurrentMatch(matches[1]);

            if (!match || match.players.indexOf(matches[1]) === -1 || match.players.indexOf(matches[2]) === -1) {
                commands.service.queue(`Sorry, ${user}, but I cannot find a match between those two players.`, channel);
                reject(new Error("No current match between players."));
                return;
            }

            if (!match.homeSelected) {
                commands.service.queue(`Sorry, ${user}, but no home map has been set for this match.`, channel);
                reject(new Error("Current match has no home map set."));
                return;
            }

            match.winner = matches[1];
            match.score = [score1, score2];
            delete match.reported;

            Discord.queue(`This match has been reported as a win for ${Discord.getGuildUser(match.winner).displayName} by the score of ${match.score[0]} to ${match.score[1]}.  If this is in error, please contact an admin.  You may add a comment to this match using \`!comment <your comment>\` any time before your next match.  This channel and the voice channel will close in 2 minutes.`, match.channel);

            setTimeout(() => {
                Event.postResult(match);
            }, 120000);

            resolve(true);
        }));
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
     * @returns {Promise} A promise that resolves when the command completes.
     */
    endevent(user, message, channel) {
        const commands = this;

        return Commands.discordPromise(commands).then(() => Commands.adminPromise(commands, user, (resolve, reject) => {
            if (message) {
                resolve(false);
                return;
            }

            if (!Event.isRunning) {
                commands.service.queue(`Sorry, ${user}, but there is no event currently running.`, channel);
                reject(new Error("Event is not currently running."));
                return;
            }

            Event.endEvent().then(() => {
                Discord.queue("The event has ended!  Thank you everyone for making it a success!");
                resolve(true);
            }).catch((err) => {
                commands.service.queue(`Sorry, ${user}, but there is was an error ending the event.`, channel);
                reject(new Exception("There was an error while ending the event.", err));
            });
        }));
    }
}

module.exports = Commands;
