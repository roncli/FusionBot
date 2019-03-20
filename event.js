const glicko2 = require("glicko2"),
    tz = require("timezone-js"),
    tzData = require("tzdata"),
    WebSocket = require("ws"),

    Db = require("./database"),
    Discord = require("./discord"),
    Exception = require("./exception"),
    Log = require("./log"),

    defaultRating = {
        rating: 1500,
        rd: 200,
        vol: 0.06
    },

    matches = [],
    players = [],
    ranking = new glicko2.Glicko2({
        tau: 0.75,
        rating: defaultRating.rating,
        rd: defaultRating.rd,
        vol: defaultRating.vol
    }),
    wss = new WebSocket.Server({port: 42423});

let eventDate,
    eventName,
    eventId,
    finals = false,
    ratedPlayers,
    round = 0,
    running = false,
    season,
    warningSent = false;

//  #####                        #
//  #                            #
//  #      #   #   ###   # ##   ####
//  ####   #   #  #   #  ##  #   #
//  #       # #   #####  #   #   #
//  #       # #   #      #   #   #  #
//  #####    #     ###   #   #    ##
/**
 * A class that manages the currently running event.
 */
class Event {
    //  #           ###                      #
    //              #  #
    // ##     ###   #  #  #  #  ###   ###   ##    ###    ###
    //  #    ##     ###   #  #  #  #  #  #   #    #  #  #  #
    //  #      ##   # #   #  #  #  #  #  #   #    #  #   ##
    // ###   ###    #  #   ###  #  #  #  #  ###   #  #  #
    //                                                   ###
    /**
     * Whether an event is running.
     * @returns {bool} Whether an event is running.
     */
    static get isRunning() {
        return running;
    }

    //  #           ####   #                ##
    //              #                        #
    // ##     ###   ###   ##    ###    ###   #     ###
    //  #    ##     #      #    #  #  #  #   #    ##
    //  #      ##   #      #    #  #  # ##   #      ##
    // ###   ###    #     ###   #  #   # #  ###   ###
    /**
     * Whether an event is a Finals Tournament.
     * @returns {bool} Whether an event is a Finals Tournament.
     */
    static get isFinals() {
        return finals;
    }

    //                            #
    //                            #
    // ###    ##   #  #  ###    ###
    // #  #  #  #  #  #  #  #  #  #
    // #     #  #  #  #  #  #  #  #
    // #      ##    ###  #  #   ###
    /**
     * The current round of the event.
     * @returns {number} The current round.
     */
    static get round() {
        return round;
    }

    //              #    ###   ##
    //              #    #  #   #
    //  ###   ##   ###   #  #   #     ###  #  #   ##   ###
    // #  #  # ##   #    ###    #    #  #  #  #  # ##  #  #
    //  ##   ##     #    #      #    # ##   # #  ##    #
    // #      ##     ##  #     ###    # #    #    ##   #
    //  ###                                 #
    /**
     * Returns a player from their Discord user ID.
     * @param {string} userId The Discord user ID.
     * @returns {object} The player object.
     */
    static getPlayer(userId) {
        return players.find((p) => p.id === userId);
    }

    // ##                   #  ###          #             #  ###   ##
    //  #                   #  #  #         #             #  #  #   #
    //  #     ##    ###   ###  #  #   ###  ###    ##    ###  #  #   #     ###  #  #   ##   ###    ###
    //  #    #  #  #  #  #  #  ###   #  #   #    # ##  #  #  ###    #    #  #  #  #  # ##  #  #  ##
    //  #    #  #  # ##  #  #  # #   # ##   #    ##    #  #  #      #    # ##   # #  ##    #       ##
    // ###    ##    # #   ###  #  #   # #    ##   ##    ###  #     ###    # #    #    ##   #     ###
    //                                                                          #
    /**
     * Caches the rated players if it's not already loaded.
     * @returns {void}
     */
    static async loadRatedPlayers() {
        if (!ratedPlayers) {
            try {
                ratedPlayers = await Db.getPlayers();
            } catch (err) {
                throw new Exception("There was a database error getting the list of rated players.", err);
            }
        }
    }

    //              #    ###          #             #  ###   ##
    //              #    #  #         #             #  #  #   #
    //  ###   ##   ###   #  #   ###  ###    ##    ###  #  #   #     ###  #  #   ##   ###    ###
    // #  #  # ##   #    ###   #  #   #    # ##  #  #  ###    #    #  #  #  #  # ##  #  #  ##
    //  ##   ##     #    # #   # ##   #    ##    #  #  #      #    # ##   # #  ##    #       ##
    // #      ##     ##  #  #   # #    ##   ##    ###  #     ###    # #    #    ##   #     ###
    //  ###                                                               #
    /**
     * Gets the list of rated players, caching it if it isn't yet loaded.
     * @returns {Promise<object[]>} A promise that resolves with the rated players.
     */
    static async getRatedPlayers() {
        await Event.loadRatedPlayers();
        return ratedPlayers;
    }

    //              #    ###          #             #  ###   ##                            ###         ###      #
    //              #    #  #         #             #  #  #   #                            #  #         #       #
    //  ###   ##   ###   #  #   ###  ###    ##    ###  #  #   #     ###  #  #   ##   ###   ###   #  #   #     ###
    // #  #  # ##   #    ###   #  #   #    # ##  #  #  ###    #    #  #  #  #  # ##  #  #  #  #  #  #   #    #  #
    //  ##   ##     #    # #   # ##   #    ##    #  #  #      #    # ##   # #  ##    #     #  #   # #   #    #  #
    // #      ##     ##  #  #   # #    ##   ##    ###  #     ###    # #    #    ##   #     ###     #   ###    ###
    //  ###                                                               #                       #
    /**
     * Returns a rated player from their Discord user ID.
     * @param {string} userId The Discord user ID.
     * @returns {Promise<object>} A promise that resolves with the rated player object.
     */
    static async getRatedPlayerById(userId) {
        return (await Event.getRatedPlayers()).find((p) => p.DiscordID === userId);
    }

    //              #    ###          #             #  ###   ##                            ###         #  #
    //              #    #  #         #             #  #  #   #                            #  #        ## #
    //  ###   ##   ###   #  #   ###  ###    ##    ###  #  #   #     ###  #  #   ##   ###   ###   #  #  ## #   ###  # #    ##
    // #  #  # ##   #    ###   #  #   #    # ##  #  #  ###    #    #  #  #  #  # ##  #  #  #  #  #  #  # ##  #  #  ####  # ##
    //  ##   ##     #    # #   # ##   #    ##    #  #  #      #    # ##   # #  ##    #     #  #   # #  # ##  # ##  #  #  ##
    // #      ##     ##  #  #   # #    ##   ##    ###  #     ###    # #    #    ##   #     ###     #   #  #   # #  #  #   ##
    //  ###                                                               #                       #
    /**
     * Returns a rated player from their name.
     * @param {string} name The name.
     * @returns {Promise<object>} A promise that resolves with the rated player object.
     */
    static async getRatedPlayerByName(name) {
        return (await Event.getRatedPlayers()).find((p) => p.Name === name);
    }

    //          #     #  ###   ##
    //          #     #  #  #   #
    //  ###   ###   ###  #  #   #     ###  #  #   ##   ###
    // #  #  #  #  #  #  ###    #    #  #  #  #  # ##  #  #
    // # ##  #  #  #  #  #      #    # ##   # #  ##    #
    //  # #   ###   ###  #     ###    # #    #    ##   #
    //                                      #
    /**
     * Adds a player and their home maps to the event.
     * @param {string} userId The Discord user ID.
     * @param {string[]} homes An array of home maps.
     * @returns {void}
     */
    static addPlayer(userId, homes) {
        players.push({
            id: userId,
            canHost: true
        });

        Event.setHomes(userId, homes);
    }

    //          #     #  ###          #             #  ###   ##
    //          #     #  #  #         #             #  #  #   #
    //  ###   ###   ###  #  #   ###  ###    ##    ###  #  #   #     ###  #  #   ##   ###
    // #  #  #  #  #  #  ###   #  #   #    # ##  #  #  ###    #    #  #  #  #  # ##  #  #
    // # ##  #  #  #  #  # #   # ##   #    ##    #  #  #      #    # ##   # #  ##    #
    //  # #   ###   ###  #  #   # #    ##   ##    ###  #     ###    # #    #    ##   #
    //                                                                    #
    /**
     * Adds a new rated player to the database.
     * @param {User} user The Discord user.
     * @returns {Promise} A promise that results when the player is added to the database.
     */
    static async addRatedPlayer(user) {
        await Db.updatePlayerRating(Discord.getGuildUser(user).displayName, user.id, defaultRating.rating, defaultRating.rd, defaultRating.vol);
    }

    //               #          #          ###   ##
    //                                     #  #   #
    // ###    ##     #    ##   ##    ###   #  #   #     ###  #  #   ##   ###
    // #  #  # ##    #   #  #   #    #  #  ###    #    #  #  #  #  # ##  #  #
    // #     ##      #   #  #   #    #  #  #      #    # ##   # #  ##    #
    // #      ##   # #    ##   ###   #  #  #     ###    # #    #    ##   #
    //              #                                         #
    /**
     * Rejoins a player to the tournament.
     * @param {object} player The player object.
     * @param {string[]} homes An array of home maps.
     * @returns {void}
     */
    static rejoinPlayer(player, homes) {
        delete player.withdrawn;

        Event.setHomes(player.id, homes);
    }

    //                                     ###   ##
    //                                     #  #   #
    // ###    ##   # #    ##   # #    ##   #  #   #     ###  #  #   ##   ###
    // #  #  # ##  ####  #  #  # #   # ##  ###    #    #  #  #  #  # ##  #  #
    // #     ##    #  #  #  #  # #   ##    #      #    # ##   # #  ##    #
    // #      ##   #  #   ##    #     ##   #     ###    # #    #    ##   #
    //                                                        #
    /**
     * Removes a player from the event.
     * @param {string} userId The Discord user ID.
     * @returns {Promise} A promise that resolves when the player is removed.
     */
    static async removePlayer(userId) {
        const player = Event.getPlayer(userId);

        if (!player) {
            return;
        }

        player.withdrawn = true;

        const user = Discord.getGuildUser(userId);

        await Discord.removeEventRole(user);

        wss.broadcast({
            withdraw: user.displayName,
            standings: Event.getStandings()
        });
    }

    // # #    ##   ###    ###   ##
    // ####  # ##  #  #  #  #  # ##
    // #  #  ##    #      ##   ##
    // #  #   ##   #     #      ##
    //                    ###
    /**
     * Merges one Discord ID to another.
     * @param {string} userId1 The Discord ID of the player to merge.
     * @param {string} userId2 The Discord ID of the player to merge into.
     * @returns {Promise} A promise that resolves when the players are merged.
     */
    static async merge(userId1, userId2) {
        const ratedPlayer = await Event.getRatedPlayerById(userId1),
            guildUser1 = Discord.getGuildUser(userId1),
            guildUser2 = Discord.getGuildUser(userId2);

        players.forEach((player) => {
            if (player.id === userId1) {
                player.id = userId2;
            }
        });

        matches.forEach((match) => {
            if (match.players && match.players.indexOf(userId1) !== -1) {
                match.players[match.players.indexOf(userId1)] = userId2;
            }

            if (match.opponents && match.opponents.indexOf(userId1) !== -1) {
                match.opponents[match.opponents.indexOf(userId1)] = userId2;
            }

            if (match.score) {
                if (match.score.indexOf(userId1) !== -1) {
                    match.score[match.score.indexOf(userId1)] = userId2;
                }

                match.score.forEach((score) => {
                    if (score.id === userId1) {
                        score.id = userId2;
                    }
                });
            }

            if (match.winner) {
                if (match.winner === userId1) {
                    match.winner = userId2;
                }

                if (match.winner instanceof Array && match.winner.indexOf(userId1) !== -1) {
                    match.winner[match.winner.indexOf(userId1)] = userId2;
                }
            }

            if (match.home === userId1) {
                match.home = userId2;
            }
        });

        ratedPlayer.DiscordID = userId2;

        await Db.updatePlayerDiscordId(userId1, userId2);

        if (guildUser1) {
            await guildUser2.addRoles(guildUser1.roles);
            await guildUser1.removeRoles(guildUser1.roles);
        }
    }

    //               #    #  #
    //               #    #  #
    //  ###    ##   ###   ####   ##   # #    ##    ###
    // ##     # ##   #    #  #  #  #  ####  # ##  ##
    //   ##   ##     #    #  #  #  #  #  #  ##      ##
    // ###     ##     ##  #  #   ##   #  #   ##   ###
    /**
     * Sets a player's home maps.
     * @param {string} userId The Discord user ID.
     * @param {string[]} homes An array of home maps.
     * @returns {void}
     */
    static setHomes(userId, homes) {
        Event.getPlayer(userId).homes = homes;

        wss.broadcast({
            addplayer: {
                name: Discord.getGuildUser(userId).displayName,
                homes
            },
            standings: Event.getStandings()
        });
    }

    //               #    #  #         #          #     #  #
    //               #    ####         #          #     #  #
    //  ###    ##   ###   ####   ###  ###    ##   ###   ####   ##   # #    ##
    // ##     # ##   #    #  #  #  #   #    #     #  #  #  #  #  #  ####  # ##
    //   ##   ##     #    #  #  # ##   #    #     #  #  #  #  #  #  #  #  ##
    // ###     ##     ##  #  #   # #    ##   ##   #  #  #  #   ##   #  #   ##
    /**
     * Sets a home map for a match.
     * @param {object} match The match object.
     * @param {number} index The index of the home player's home map that was selected.
     * @returns {Promise} A promise that resolves when the home maps for a match are set.
     */
    static async setMatchHome(match, index) {
        match.homeSelected = match.homes[index];

        const guildUser1 = Discord.getGuildUser(match.players[0]),
            guildUser2 = Discord.getGuildUser(match.players[1]);

        if (finals) {
            let killGoal;

            match.waitingForHome = false;

            if (match.overtime) {
                killGoal = "This is overtime!  Overtime is played to 5, win by 2.  Good luck!";
            } else if (match.score && Math.abs(match.score[0] - match.score[1]) <= 1) {
                killGoal = `Second game of the match is to ${match.killGoal}.  There is no win-by-2 stipulation, the game should simply end when the kill goal is reached and all remaining weapons in the air have been resolved.`;
            } else if (match.score && match.score[0] > match.score[1]) {
                killGoal = `The second game of the match should end when either ${guildUser1} gets ${match.score[1] + 1} or when ${guildUser2} gets ${match.killGoal}.  There is no win-by-2 stipulation, the game should simply end when the kill goal is reached and all remaining weapons in the air have been resolved.`;
            } else if (match.score && match.score[0] < match.score[1]) {
                killGoal = `The second game of the match should end when either ${guildUser2} gets ${match.score[0] + 1} or when ${guildUser1} gets ${match.killGoal}.  There is no win-by-2 stipulation, the game should simply end when the kill goal is reached and all remaining weapons in the air have been resolved.`;
            } else {
                killGoal = `First game of the match is to ${match.killGoal}.  There is no win-by-2 stipulation, the game should simply end when the kill goal is reached and all remaining weapons in the air have been resolved.`;
            }

            await Discord.richQueue({
                embed: {
                    title: `${guildUser1.displayName} vs ${guildUser2.displayName}`,
                    description: "Please begin your match!",
                    timestamp: new Date(),
                    color: 0x263686,
                    footer: {icon_url: Discord.icon, text: "DescentBot"},
                    fields: [
                        {
                            name: "Selected Map",
                            value: `You have selected to play in **${match.homeSelected}**.`
                        },
                        {
                            name: "Reminders",
                            value: "· Make sure your match is set to either Restricted or Closed.\n· Set your game for at least 4 observers.\n· The match will be reported by an admin upon completion."
                        },
                        {
                            name: "Kill Goal",
                            value: killGoal
                        }
                    ]
                }
            }, match.channel);

            match.homesPlayed.push(match.homeSelected);

            wss.broadcast({
                finalsMatch: {
                    player1: guildUser1.displayName,
                    player2: guildUser2.displayName,
                    score1: match.score ? match.score[0] : void 0,
                    score2: match.score ? match.score[1] : void 0,
                    homesPlayed: match.homesPlayed,
                    round: match.round
                }
            });
        } else {
            await Discord.richQueue({
                embed: {
                    title: `${guildUser1.displayName} vs ${guildUser2.displayName}`,
                    description: "Please begin your match!",
                    timestamp: new Date(),
                    color: 0x263686,
                    footer: {icon_url: Discord.icon, text: "DescentBot"},
                    fields: [
                        {
                            name: "Selected Map",
                            value: `You have selected to play in **${match.homeSelected}**.`
                        },
                        {
                            name: "Reminders",
                            value: "· Make sure your match is set to either Restricted or Closed.\n· Set your game for at least 4 observers.\n· The loser of the game should report the match upon completion.\n· Use the command `!report 20 12` to report the score."
                        }
                    ]
                }
            }, match.channel);

            wss.broadcast({
                match: {
                    player1: guildUser1.displayName,
                    player2: guildUser2.displayName,
                    home: match.homeSelected,
                    round: match.round
                }
            });
        }
    }

    //              #     ##                                  #    #  #         #          #
    //              #    #  #                                 #    ####         #          #
    //  ###   ##   ###   #     #  #  ###   ###    ##   ###   ###   ####   ###  ###    ##   ###
    // #  #  # ##   #    #     #  #  #  #  #  #  # ##  #  #   #    #  #  #  #   #    #     #  #
    //  ##   ##     #    #  #  #  #  #     #     ##    #  #   #    #  #  # ##   #    #     #  #
    // #      ##     ##   ##    ###  #     #      ##   #  #    ##  #  #   # #    ##   ##   #  #
    //  ###
    /**
     * Gets the current match, filtering by Discord ID if passed.
     * @param {string} [userId] The Discord user ID.
     * @returns {object} The match object.
     */
    static getCurrentMatch(userId) {
        return matches.find((m) => !m.cancelled && (!userId || m.players.indexOf(userId) !== -1) && !m.winner);
    }

    //              #    #  #         #          #     ###          #                            ###   ##
    //              #    ####         #          #     #  #         #                            #  #   #
    //  ###   ##   ###   ####   ###  ###    ##   ###   ###    ##   ###   #  #   ##    ##   ###   #  #   #     ###  #  #   ##   ###    ###
    // #  #  # ##   #    #  #  #  #   #    #     #  #  #  #  # ##   #    #  #  # ##  # ##  #  #  ###    #    #  #  #  #  # ##  #  #  ##
    //  ##   ##     #    #  #  # ##   #    #     #  #  #  #  ##     #    ####  ##    ##    #  #  #      #    # ##   # #  ##    #       ##
    // #      ##     ##  #  #   # #    ##   ##   #  #  ###    ##     ##  ####   ##    ##   #  #  #     ###    # #    #    ##   #     ###
    //  ###                                                                                                         #
    /**
     * Gets a match between two pilots.
     * @param {string} userId1 The Discord user ID of the first player.
     * @param {string} userId2 The Discord user ID of the second player.
     * @returns {object} The match object.
     */
    static getMatchBetweenPlayers(userId1, userId2) {
        return matches.find((m) => !m.cancelled && m.players.length === 2 && m.players.indexOf(userId1) !== -1 && m.players.indexOf(userId2) !== -1);
    }

    //              #     ##                     ##           #             #  #  #         #          #
    //              #    #  #                     #           #             #  ####         #          #
    //  ###   ##   ###   #      ##   # #   ###    #     ##   ###    ##    ###  ####   ###  ###    ##   ###    ##    ###
    // #  #  # ##   #    #     #  #  ####  #  #   #    # ##   #    # ##  #  #  #  #  #  #   #    #     #  #  # ##  ##
    //  ##   ##     #    #  #  #  #  #  #  #  #   #    ##     #    ##    #  #  #  #  # ##   #    #     #  #  ##      ##
    // #      ##     ##   ##    ##   #  #  ###   ###    ##     ##   ##    ###  #  #   # #    ##   ##   #  #   ##   ###
    //  ###                                #
    /**
     * Gets the completed matches for a player.
     * @param {string} userId The Discord user ID.
     * @returns {object[]} An array of match objects.
     */
    static getCompletedMatches(userId) {
        return matches.filter((m) => !m.cancelled && m.players.indexOf(userId) !== -1 && m.winner);
    }

    //              #     ##   ##    ##    #  #         #          #
    //              #    #  #   #     #    ####         #          #
    //  ###   ##   ###   #  #   #     #    ####   ###  ###    ##   ###    ##    ###
    // #  #  # ##   #    ####   #     #    #  #  #  #   #    #     #  #  # ##  ##
    //  ##   ##     #    #  #   #     #    #  #  # ##   #    #     #  #  ##      ##
    // #      ##     ##  #  #  ###   ###   #  #   # #    ##   ##   #  #   ##   ###
    //  ###
    /**
     * Gets all non-cancelled matches.
     * @returns {object[]} An array of match objects.
     */
    static getAllMatches() {
        return matches.filter((m) => !m.cancelled);
    }

    //              #    ###                      ##     #    ####        #              #
    //              #    #  #                      #     #    #           #              #
    //  ###   ##   ###   #  #   ##    ###   #  #   #    ###   ###   # #   ###    ##    ###
    // #  #  # ##   #    ###   # ##  ##     #  #   #     #    #     ####  #  #  # ##  #  #
    //  ##   ##     #    # #   ##      ##   #  #   #     #    #     #  #  #  #  ##    #  #
    // #      ##     ##  #  #   ##   ###     ###  ###     ##  ####  #  #  ###    ##    ###
    //  ###
    /**
     * Gets the Rich Embed object for a match result.
     * @param {object} match The match object.
     * @returns {object} The Rich Embed object.
     */
    static getResultEmbed(match) {
        const embed = {
            embed: {
                timestamp: new Date(),
                color: 0x263686,
                footer: {icon_url: Discord.icon, text: "DescentBot"},
                fields: []
            }
        };

        if (match.roundName) {
            embed.embed.fields.push({
                name: "Round",
                value: match.roundName
            });
        } else if (match.round) {
            embed.embed.fields.push({
                name: "Round",
                value: match.round
            });
        }

        if (match.players.length > 2) {
            match.score.forEach((score) => {
                const player = Discord.getGuildUser(score.id);

                embed.embed.fields.push({
                    name: player.displayName,
                    value: score.score,
                    inline: true
                });
            });
        } else {
            const player1 = Discord.getGuildUser(match.winner),
                player2 = Discord.getGuildUser(match.players.find((p) => p !== match.winner));

            embed.embed.fields.push({
                name: player1.displayName,
                value: match.score[0],
                inline: true
            });

            embed.embed.fields.push({
                name: player2.displayName,
                value: match.score[1],
                inline: true
            });
        }

        embed.embed.fields.push({
            name: "Map",
            value: match.homesPlayed ? match.homesPlayed.join("/") : match.homeSelected,
            inline: true
        });

        if (match.comments) {
            Object.keys(match.comments).forEach((id) => {
                embed.embed.fields.push({
                    name: `Comment from ${Discord.getGuildUser(id).displayName}:`,
                    value: match.comments[id]
                });
            });
        }

        return embed;
    }

    //                     #    #                ###                      ##     #
    //                    # #                    #  #                      #     #
    //  ##    ##   ###    #    ##    ###   # #   #  #   ##    ###   #  #   #    ###
    // #     #  #  #  #  ###    #    #  #  ####  ###   # ##  ##     #  #   #     #
    // #     #  #  #  #   #     #    #     #  #  # #   ##      ##   #  #   #     #
    //  ##    ##   #  #   #    ###   #     #  #  #  #   ##   ###     ###  ###     ##
    /**
     * Confirms a match result.
     * @param {object} match The match object.
     * @param {string} winner The Discord ID of the winner.
     * @param {[number, number]} score The score, with the winner's score first.
     * @returns {Promise} A promise that resolves when the results of a match are confirmed.
     */
    static async confirmResult(match, winner, score) {
        const player1 = Discord.getGuildUser(match.players[0]),
            player2 = Discord.getGuildUser(match.players[1]),
            winnerUser = Discord.getGuildUser(winner);

        match.winner = winner;
        match.score = score;
        delete match.reported;

        try {
            await Db.addResult(eventId, match.homeSelected, match.round, [{id: player1.id, score: player1.id === winnerUser.id ? match.score[0] : match.score[1]}, {id: player2.id, score: player2.id === winnerUser.id ? match.score[0] : match.score[1]}].sort((a, b) => b.score - a.score));
        } catch (err) {
            throw new Exception("There was a database error saving the result to the database.", err);
        }

        await Discord.queue(`This match has been reported as a win for ${winnerUser.displayName} by the score of ${score[0]} to ${score[1]}.  If this is in error, please contact an admin.  You may add a comment to this match using \`!comment <your comment>\` any time before your next match.  This channel and the voice channel will close in 2 minutes.`, match.channel);

        setTimeout(() => {
            Event.postResult(match);
        }, 120000);

        wss.broadcast({
            match: {
                player1: player1.displayName,
                player2: player2.displayName,
                winner: winnerUser.displayName,
                score1: match.score[0],
                score2: match.score[1],
                home: match.homeSelected,
                round: match.round
            },
            standings: Event.getStandings()
        });

        const message = await Discord.richQueue(Event.getResultEmbed(match), Discord.resultsChannel);

        match.results = message;
    }

    //   #    #           ##
    //  # #              #  #
    //  #    ##    #  #   #     ##    ##   ###    ##
    // ###    #     ##     #   #     #  #  #  #  # ##
    //  #     #     ##   #  #  #     #  #  #     ##
    //  #    ###   #  #   ##    ##    ##   #      ##
    /**
     * Fixes the score of a match.
     * @param {object} match The match.
     * @param {string} player1Id The ID of player 1.
     * @param {number} player1Score The score of player 1.
     * @param {string} player2Id The ID of player 2.
     * @param {number} player2Score The score of player 2.
     * @returns {Promise} A promise that resolves when the score is fixed.
     */
    static async fixScore(match, player1Id, player1Score, player2Id, player2Score) {
        if (player1Score < player2Score) {
            [player1Score, player2Score] = [player2Score, player1Score];
            [player1Id, player2Id] = [player2Id, player1Id];
        }

        const player1 = Discord.getGuildUser(player1Id),
            player2 = Discord.getGuildUser(player2Id);

        match.score = [player1Score, player2Score];
        match.winner = player1Id;

        try {
            await Db.updateResult(eventId, match.round, [{id: player1Id, score: player1Score}, {id: player2Id, score: player2Score}]);
        } catch (err) {
            throw new Exception("There was a database error saving the result to the database.", err);
        }

        if (match.channel) {
            await Discord.queue(`This match has been corrected to be a win for ${player1.displayName} by the score of ${player1Score} to ${player2Score}.  If this is in error, please contact an admin.`, match.channel);
        }

        wss.broadcast({
            match: {
                player1: player1.displayName,
                player2: player2.displayName,
                winner: player1.displayName,
                score1: match.score[0],
                score2: match.score[1],
                home: match.homeSelected,
                round: match.round
            },
            standings: Event.getStandings()
        });

        if (match.results) {
            await match.results.edit("", Event.getResultEmbed(match));
        }
    }

    //                                #     ##                           #
    //                                #    #  #                          #
    // ###    ##   ###    ##   ###   ###   #  #  ###    ###  ###    ##   ###   #  #
    // #  #  # ##  #  #  #  #  #  #   #    ####  #  #  #  #  #  #  #     #  #  #  #
    // #     ##    #  #  #  #  #      #    #  #  #  #  # ##  #     #     #  #   # #
    // #      ##   ###    ##   #       ##  #  #  #  #   # #  #      ##   #  #    #
    //             #                                                            #
    /**
     * Reports the score of an anarchy game.
     * @param {object} match The match to report.
     * @param {{id: string, score: number}[]} scores The scores of the match.
     * @returns {Promise} A promise that resolves when the score has been reported.
     */
    static async reportAnarchy(match, scores) {
        try {
            await Db.addResult(eventId, match.homeSelected, match.round, scores.map((s) => ({id: s.id, score: s.score})));
        } catch (err) {
            throw new Exception("There was a database error saving the result to the database.", err);
        }

        match.winner = scores.filter((s, index) => index < match.advancePlayers).map((s) => s.id);
        match.score = scores;

        await Discord.queue(`This match has been reported with the following scores:\n${scores.map((s) => `${Discord.getGuildUser(s.id)}: ${s.score}`).join("\n")}\nThe following players will advance to the next round: ${match.winner.map((w) => `${Discord.getGuildUser(w)}`).join(", ")}\nYou may add a comment to this match using \`!comment <your comment>\` any time before your next match.  This channel and the voice channel will close in 2 minutes.`, match.channel);

        setTimeout(() => {
            Event.postResult(match);
        }, 120000);

        wss.broadcast({
            wildcardMatch: {
                players: match.players.map((p) => Discord.getGuildUser(p).displayName),
                winner: match.winner.map((w) => Discord.getGuildUser(w).displayName),
                score: scores.map((s) => ({name: Discord.getGuildUser(s.id).displayName, score: s.score})),
                home: match.homeSelected,
                round: match.round
            }
        });

        const message = await Discord.richQueue(Event.getResultEmbed(match), Discord.resultsChannel);

        match.results = message;

        await Event.nextFinalsMatch();
    }

    //                     #    ###                      ##     #
    //                     #    #  #                      #     #
    // ###    ##    ###   ###   #  #   ##    ###   #  #   #    ###
    // #  #  #  #  ##      #    ###   # ##  ##     #  #   #     #
    // #  #  #  #    ##    #    # #   ##      ##   #  #   #     #
    // ###    ##   ###      ##  #  #   ##   ###     ###  ###     ##
    // #
    /**
     * Posts the result of a match.
     * @param {object} match The match object.
     * @returns {Promise} A promise that resolves when the results of a match are posted.
     */
    static postResult(match) {
        for (const id of match.players) {
            const guildUser = Discord.getGuildUser(id);
            Discord.removePermissions(guildUser, match.channel);
            Discord.addSeasonRole(guildUser);
        }

        Discord.removeChannel(match.voice);
        delete match.channel;
        delete match.voice;
    }

    //                #         #          ###                      ##     #
    //                #         #          #  #                      #     #
    // #  #  ###    ###   ###  ###    ##   #  #   ##    ###   #  #   #    ###
    // #  #  #  #  #  #  #  #   #    # ##  ###   # ##  ##     #  #   #     #
    // #  #  #  #  #  #  # ##   #    ##    # #   ##      ##   #  #   #     #
    //  ###  ###    ###   # #    ##   ##   #  #   ##   ###     ###  ###     ##
    //       #
    /**
     * Updates the match result.
     * @param {object} match The match object.
     * @returns {Promise} A promise that resolves when the match is updated.
     */
    static async updateResult(match) {
        if (!match.results) {
            return;
        }

        await match.results.edit("", Event.getResultEmbed(match));
    }

    //              #     ##    #                   #   #
    //              #    #  #   #                   #
    //  ###   ##   ###    #    ###    ###  ###    ###  ##    ###    ###   ###
    // #  #  # ##   #      #    #    #  #  #  #  #  #   #    #  #  #  #  ##
    //  ##   ##     #    #  #   #    # ##  #  #  #  #   #    #  #   ##     ##
    // #      ##     ##   ##     ##   # #  #  #   ###  ###   #  #  #     ###
    //  ###                                                         ###
    /**
     * Gets the event's standings.
     * @returns {object[]} An array of player standings.
     */
    static getStandings() {
        const standings = [];

        players.forEach((player) => {
            const id = player.id;

            standings.push({
                id: player.id,
                player,
                name: Discord.getGuildUser(id).displayName,
                wins: 0,
                losses: 0,
                score: 0,
                defeated: []
            });
        });

        matches.filter((m) => !m.cancelled && m.winner).forEach((match) => {
            match.players.forEach((id) => {
                const standing = standings.find((s) => s.id === id);
                if (match.winner === id) {
                    standing.wins++;
                } else {
                    const winner = standings.find((s) => s.id === match.winner);
                    standing.losses++;
                    winner.defeated.push(id);
                }
            });
        });

        standings.forEach((player) => {
            player.score = player.wins * 3 + player.defeated.reduce((accumulator, currentValue) => accumulator + standings.find((s) => s.id === currentValue).wins, 0);
        });

        return standings.sort((a, b) => b.score + b.wins / 100 - b.losses / 10000 - (a.score + a.wins / 100 - a.losses / 10000));
    }

    //              #     ##    #                   #   #                       ###                #
    //              #    #  #   #                   #                            #                 #
    //  ###   ##   ###    #    ###    ###  ###    ###  ##    ###    ###   ###    #     ##   #  #  ###
    // #  #  # ##   #      #    #    #  #  #  #  #  #   #    #  #  #  #  ##      #    # ##   ##    #
    //  ##   ##     #    #  #   #    # ##  #  #  #  #   #    #  #   ##     ##    #    ##     ##    #
    // #      ##     ##   ##     ##   # #  #  #   ###  ###   #  #  #     ###     #     ##   #  #    ##
    //  ###                                                         ###
    /**
     * Gets the text of the standings.
     * @returns {string} The text of the standings.
     */
    static getStandingsText() {
        const standings = Event.getStandings();
        let str = "Standings:";

        standings.forEach((player, index) => {
            str += `\n${index + 1}) ${player.name} - ${player.score} (${player.wins}-${player.losses})`;
        });

        return str;
    }

    // #                 #
    // #                 #
    // ###    ###   ##   # #   #  #  ###
    // #  #  #  #  #     ##    #  #  #  #
    // #  #  # ##  #     # #   #  #  #  #
    // ###    # #   ##   #  #   ###  ###
    //                               #
    /**
     * Backs up the current event to the database.
     * @returns {Promise} A promise that resolves when the database backup is complete.
     */
    static backup() {
        return Db.backup(matches, players, finals, warningSent, round, eventName, eventDate, eventId, season);
    }

    //                         ####                     #
    //                         #                        #
    //  ##   ###    ##   ###   ###   # #    ##   ###   ###
    // #  #  #  #  # ##  #  #  #     # #   # ##  #  #   #
    // #  #  #  #  ##    #  #  #     # #   ##    #  #   #
    //  ##   ###    ##   #  #  ####   #     ##   #  #    ##
    //       #
    /**
     * Opens a new Swiss tournament event.
     * @param {number} seasonNumber The season number for the event.
     * @param {string} event The name of the event.
     * @param {Date} date The date the event should be run.
     * @returns {Promise} A promise that resolves when a Swiss tournament event is open.
     */
    static async openEvent(seasonNumber, event, date) {
        // TODO: Open home changes.
        try {
            ratedPlayers = await Db.getPlayers();
        } catch (err) {
            throw new Exception("There was a database error getting the list of rated players.", err);
        }

        try {
            eventId = await Db.createEvent(seasonNumber, event, date);
        } catch (err) {
            throw new Exception("There was a database error creating the event.", err);
        }

        if (!Discord.findRoleByName(`Season ${seasonNumber} Participant`)) {
            const previousSeasonRole = Discord.findRoleByName(`Season ${seasonNumber - 1} Participant`),
                seasonRole = await Discord.createRole({
                    name: `Season ${seasonNumber} Participant`,
                    color: "#3498DB"
                });

            if (previousSeasonRole) {
                await previousSeasonRole.setColor("#206694");
            }

            let previousRole = Discord.findRoleByName("Season 1 Champion");

            if (!previousRole) {
                previousRole = Discord.findRoleByName("In Current Event");
            }

            await Discord.setRolePositionAfter(seasonRole, previousRole);

            Discord.setSeasonRole(seasonRole);

            const previousChannel = Discord.findChannelByName(`season-${seasonNumber - 1}`);

            if (previousChannel) {
                await previousChannel.setParent(Discord.archiveCategory);
            }

            const seasonChannel = await Discord.createTextChannel(`season-${seasonNumber}`, Discord.chatCategory);

            Discord.removePermissions(Discord.defaultRole, seasonChannel);
            Discord.addTextPermissions(seasonRole, seasonChannel);
        }

        finals = false;
        matches.splice(0, matches.length);
        players.splice(0, players.length);
        round = 0;
        running = true;
        eventName = event;
        eventDate = date;
        season = seasonNumber;

        Event.backupInterval = setInterval(Event.backup, 300000);
    }

    //                         ####   #                ##
    //                         #                        #
    //  ##   ###    ##   ###   ###   ##    ###    ###   #     ###
    // #  #  #  #  # ##  #  #  #      #    #  #  #  #   #    ##
    // #  #  #  #  ##    #  #  #      #    #  #  # ##   #      ##
    //  ##   ###    ##   #  #  #     ###   #  #   # #  ###   ###
    //       #
    /**
     * Opens a new Finals Tournament event.
     * @param {number} seasonNumber The season number of the event.
     * @param {string} event The name of the event.
     * @param {Date} date The date and time of the event.
     * @returns {Promise<{id: string, score: int}[]>} A promise that resolves with the players who have made the Finals Tournament.
     */
    static async openFinals(seasonNumber, event, date) {
        // TODO: Open home changes.
        let seasonPlayers;
        try {
            seasonPlayers = await Db.getSeasonStandings(seasonNumber);
        } catch (err) {
            throw new Exception("There was a database error getting the season standings.", err);
        }

        const warningDate = new tz.Date(date, "America/Los_Angeles");

        warningDate.setDate(warningDate.getDate() - 1);

        const time = new tz.Date(`${warningDate.toDateString()} 0:00`, "America/Los_Angeles").getTime() - new Date().getTime();

        if (time > 1) {
            while (seasonPlayers.length > 12 && seasonPlayers[11].score !== seasonPlayers[seasonPlayers.length - 1].score) {
                seasonPlayers.pop();
            }
        }

        finals = true;
        matches.splice(0, matches.length);
        players.splice(0, players.length);
        round = 0;
        running = true;
        eventName = event;
        eventDate = date;
        season = seasonNumber;

        Event.backupInterval = setInterval(Event.backup, 300000);

        try {
            for (const index of seasonPlayers.keys()) {
                const player = seasonPlayers[index];

                players.push({
                    id: player.id,
                    canHost: true,
                    status: "waiting",
                    score: player.score,
                    seed: index + 1
                });

                await Discord.addUserToRole(Discord.getGuildUser(player.id), Discord.finalsTournamentInvitedRole);
            }
        } catch (err) {
            throw new Exception("There was a database error adding players to the event.", err);
        }

        try {
            eventId = await Db.createEvent(seasonNumber, event, date);
        } catch (err) {
            throw new Exception("There was a database error creating the event.", err);
        }

        seasonPlayers.forEach((seasonPlayer, index) => {
            const player = Event.getPlayer(seasonPlayer.id);

            if (seasonPlayers.length <= 6) {
                player.type = seasonPlayer.type = "knockout";
                return;
            }

            if (seasonPlayers.length > 8) {
                if (index >= 8 && seasonPlayer.score !== seasonPlayers[7].score) {
                    player.type = seasonPlayer.type = "standby";
                    return;
                }
            }

            if (index >= 4) {
                player.type = seasonPlayer.type = "wildcard";
                return;
            }

            if (seasonPlayer.score === seasonPlayers[4].score) {
                player.type = seasonPlayer.type = "wildcard";
                return;
            }

            player.type = seasonPlayer.type = "knockout";
        });

        if (time > 1) {
            Event.warningTimeout = setTimeout(Event.warning, time);
        }

        return seasonPlayers;
    }

    //                          #

    // #  #   ###  ###   ###   ##    ###    ###
    // #  #  #  #  #  #  #  #   #    #  #  #  #
    // ####  # ##  #     #  #   #    #  #   ##
    // ####   # #  #     #  #  ###   #  #  #
    //                                      ###
    /**
     * Warns players that they still need to accept or decline their invitation to the Finals Tournament.
     * @returns {Promise} A promise that resolves when warnings have been processed.
     */
    static async warning() {
        // Anyone still waiting before the 6th accept gets a warning.
        let accepted = 0;

        warningSent = true;

        for (const player of players) {
            if (player.status === "accepted") {
                accepted++;
                if (accepted === 6) {
                    return;
                }
                continue;
            }

            if (player.status === "waiting") {
                const user = Discord.getGuildUser(player.id);

                if (user) {
                    switch (player.type) {
                        case "knockout":
                            await Discord.queue(`Reminder: You have earned a spot in the ${eventName} knockout stage!  This event will take place ${eventDate.toLocaleDateString("en-us", {timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "long", day: "numeric", hour12: true, hour: "2-digit", minute: "2-digit", timeZoneName: "short"})}.  If you can attend, please reply with \`!accept\`.  If you cannot, please reply with \`!decline\`  Please contact roncli if you have any questions regarding the event.`, user);
                            break;
                        case "wildcard":
                            await Discord.queue(`Reminder: You have earned a spot in the ${eventName} wildcard anarchy!  This event will take place ${eventDate.toLocaleDateString("en-us", {timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "long", day: "numeric", hour12: true, hour: "2-digit", minute: "2-digit", timeZoneName: "short"})}.  If you can attend, please reply with \`!accept\`.  If you cannot, please reply with \`!decline\`  Also, if you are able to join the event, please pick a map you'd like to play for the wildcard anarchy, which will be picked at random from all participants, using the \`!anarchymap <map>\` command.  Please contact roncli if you have any questions regarding the event.`, user);
                            break;
                        case "standby":
                            await Discord.queue(`Reminder: You are on standby for the ${eventName}!  This event will take place ${eventDate.toLocaleDateString("en-us", {timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "long", day: "numeric", hour12: true, hour: "2-digit", minute: "2-digit", timeZoneName: "short"})}.  If you can attend, please reply with \`!accept\`.  If you cannot, please reply with \`!decline\`  Also, if you are able to join the event, please pick a map you'd like to play for the wildcard anarchy, which will be picked at random from all participants, using the \`!anarchymap <map>\` command.  You will be informed when the event starts if your presence will be needed.  Please contact roncli if you have any questions regarding the event.`, user);
                            break;
                    }
                }
            }
        }

        // Anyone that hasn't already been invited will get a standby invite.
        let seasonPlayers;
        try {
            seasonPlayers = await Db.getSeasonStandings(season);
        } catch (err) {
            Log.exception("There was a database error getting the season standings to determine standbys.", err);
        }

        try {
            for (const index of seasonPlayers.keys()) {
                const player = seasonPlayers[index];

                if (players.filter((p) => p.id === player.id)) {
                    continue;
                }

                players.push({
                    id: player.id,
                    canHost: true,
                    status: "waiting",
                    type: "standby",
                    score: player.score,
                    seed: index + 1,
                    homes: await Db.getHomesForDiscordId(player.id)
                });

                const user = Discord.getGuildUser(player.id);

                await Discord.addUserToRole(user, Discord.finalsTournamentInvitedRole);
                await Discord.queue(`${user}, you are on last minute standby for the ${eventName}!  This event will take place ${eventDate.toLocaleDateString("en-us", {timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "long", day: "numeric", hour12: true, hour: "2-digit", minute: "2-digit", timeZoneName: "short"})}.  If you can attend, please reply with \`!accept\`.  If you cannot, please reply with \`!decline\`  Also, if you are able to join the event, please pick a map you'd like to play for the wildcard anarchy, which will be picked at random from all participants, using the \`!anarchymap <map>\` command.  You will be informed when the event starts if your presence will be needed.  Please contact roncli if you have any questions regarding the event.`, user);
            }
        } catch (err) {
            Log.exception("There was a database error adding standby players to the event.", err);
        }
    }

    //         #                 #    ####   #                ##
    //         #                 #    #                        #
    //  ###   ###    ###  ###   ###   ###   ##    ###    ###   #     ###
    // ##      #    #  #  #  #   #    #      #    #  #  #  #   #    ##
    //   ##    #    # ##  #      #    #      #    #  #  # ##   #      ##
    // ###      ##   # #  #       ##  #     ###   #  #   # #  ###   ###
    /**
     * Starts a Finals Tournament event.
     * @returns {Promise} A promise that resolves when the finals are started.
     */
    static async startFinals() {
        // Filter out unaccepted participants.
        const unaccepted = players.filter((p) => p.status !== "accepted");

        unaccepted.forEach((u) => players.splice(players.findIndex((p) => p.id === u.id), 1));

        const guildUsers = players.map((p) => Discord.getGuildUser(p.id));

        // Reseed participants, add the appropriate role, and set home levels.
        for (const index of players.keys()) {
            const player = players[index],
                guildUser = guildUsers[index];

            await Discord.removeUserFromRole(guildUser, Discord.finalsTournamentAcceptedRole);
            await Discord.removeUserFromRole(guildUser, Discord.finalsTournamentDeclinedRole);
            await Discord.removeUserFromRole(guildUser, Discord.finalsTournamentInvitedRole);
            await Discord.addEventRole(guildUser);
            player.seed = index + 1;
            player.homes = await Db.getHomesForDiscordId(player.id);
        }

        await Discord.queue(`The Finals Tournament has begun!  Here is the seeding for today's event:\n${players.map((p, index) => `${p.seed}) ${guildUsers[index]}`).join("\n")}\nMatches will be announced in separate channels.`);

        wss.broadcast({
            seeding: players.map((p) => ({name: Discord.getGuildUser(p.id).displayName, seed: p.seed}))
        });

        // Determine the tournament format and setup the next round.
        if (players.length > 6) {
            await Event.setupFinalsWildcard();
        } else {
            await Event.setupFinalsRound();
        }
    }

    //                    #    ####   #                ##           #  #         #          #
    //                    #    #                        #           ####         #          #
    // ###    ##   #  #  ###   ###   ##    ###    ###   #     ###   ####   ###  ###    ##   ###
    // #  #  # ##   ##    #    #      #    #  #  #  #   #    ##     #  #  #  #   #    #     #  #
    // #  #  ##     ##    #    #      #    #  #  # ##   #      ##   #  #  # ##   #    #     #  #
    // #  #   ##   #  #    ##  #     ###   #  #   # #  ###   ###    #  #   # #    ##   ##   #  #
    /**
     * Sets up the next event match in the Finals Tournament.
     * @returns {Promise} A promise that resolves when the next match is setup.
     */
    static async nextFinalsMatch() {
        const currentMatch = Event.getCurrentMatch();

        if (currentMatch) {
            if (currentMatch.players.length === 2) {
                const guildUser1 = Discord.getGuildUser(currentMatch.players[0]),
                    guildUser2 = Discord.getGuildUser(currentMatch.players[1]),
                    player1 = Event.getPlayer(guildUser1.id),
                    player2 = Event.getPlayer(guildUser2.id);

                await Discord.richQueue({
                    embed: {
                        title: "First game",
                        description: "Map selection",
                        timestamp: new Date(),
                        color: 0x263686,
                        footer: {icon_url: Discord.icon, text: "DescentBot"},
                        fields: [
                            {
                                name: currentMatch.roundName,
                                value: `This will be a home-and-home series decided by total score with each game having a kill goal of ${currentMatch.killGoal}.`
                            },
                            {
                                name: "First Game Rules",
                                value: `· The game ends when either pilot reaches **${currentMatch.killGoal}** and all remaining weapons in the air have been resolved.\n· ${guildUser2} is the home pilot, and ${guildUser1} will get to select the level played.`
                            },
                            {
                                name: "Map Selection",
                                value: `${guildUser1}, please choose from the following three home maps:\n\`!choose a\` - ${currentMatch.homes[0]}\n\`!choose b\` - ${currentMatch.homes[1]}\n\`!choose c\` - ${currentMatch.homes[2]}`
                            }
                        ]
                    }
                }, currentMatch.channel);

                wss.broadcast({
                    finalsRound: currentMatch.roundName,
                    finalsStatus: `${player1.seed}) ${guildUser1.displayName} vs ${player2.seed}) ${guildUser2.displayName}`
                });
            } else {
                await Discord.richQueue({
                    embed: {
                        title: "Wildcard Anarchy",
                        description: "Please begin your match!",
                        timestamp: new Date(),
                        color: 0x263686,
                        footer: {icon_url: Discord.icon, text: "DescentBot"},
                        fields: [
                            {
                                name: "Selected Map",
                                value: `The map has been randomly selected to be **${currentMatch.homeSelected}**.`
                            },
                            {
                                name: "Goals",
                                value: `· The kill goal of the match is **${currentMatch.players.length * 10}**.\n· The top **${currentMatch.advancePlayers}** players will advance to the next round.`
                            },
                            {
                                name: "Reminders",
                                value: "· Make sure your match is set to either Restricted or Closed.\n· Set your game for at least 4 observers.\n· Do not move when the game begins, ensure everyone is ready first.\n· The game will be reported by an admin upon completion."
                            }
                        ]
                    }
                }, currentMatch.channel);

                wss.broadcast({finalsRound: currentMatch.roundName});
            }
        } else {
            // Round is complete.  Update player statuses and setup the next round.
            let lastEliminated;

            matches.filter((m) => !m.cancelled && m.round === round).forEach((match) => {
                if (typeof match.winner === "string") {
                    match.players.filter((p) => p !== match.winner).forEach((id) => {
                        lastEliminated = id;
                        Event.getPlayer(id).type = "eliminated";
                    });
                } else {
                    match.players.filter((p) => match.winner.indexOf(p) === -1).forEach((id) => {
                        Event.getPlayer(id).type = "eliminated";
                    });
                }
            });

            // Setup the next round.
            const remainingPlayers = players.filter((p) => p.type !== "eliminated");

            if (remainingPlayers.length > 6) {
                await Event.generateFinalsWildcard();
            } else if (remainingPlayers.length >= 2) {
                players.filter((p) => p.type === "wildcard").forEach((player) => {
                    player.type = "knockout";
                });

                const roundPlayers = players.filter((p) => p.type === "knockout");

                round++;

                switch (roundPlayers.length) {
                    case 2:
                        await Event.generateFinalsMatch(roundPlayers[0], roundPlayers[1]);
                        break;
                    case 3:
                        await Event.generateFinalsMatch(roundPlayers[1], roundPlayers[2]);
                        break;
                    case 4:
                        await Event.setupFinalsOpponentSelection(roundPlayers[0], [roundPlayers[1], roundPlayers[2], roundPlayers[3]]);
                        break;
                    case 5:
                        await Event.generateFinalsMatch(roundPlayers[3], roundPlayers[4]);
                        break;
                    case 6:
                        await Event.setupFinalsOpponentSelection(roundPlayers[2], [roundPlayers[3], roundPlayers[4], roundPlayers[5]]);
                        break;
                }
            } else {
                wss.broadcast({finalsRound: ""});

                const guildUser = Discord.getGuildUser(remainingPlayers[0].id),
                    previousRole = Discord.findRoleByName("In Current Event"),
                    lastSeasonChampion = Discord.findRoleByName(`Season ${season - 1} Champion`),
                    championRole = await Discord.createRole({
                        name: `Season ${season} Champion`,
                        color: "#E67E22",
                        hoist: true
                    });

                if (lastSeasonChampion) {
                    await lastSeasonChampion.setColor("#A84300");
                }

                await Discord.addUserToRole(guildUser, championRole);

                await Discord.setRolePositionAfter(championRole, previousRole);

                await Db.setSeasonWinners(season, remainingPlayers[0].id, lastEliminated);

                await Discord.queue(`Congratulations to ${guildUser}, the champion of Season ${season}!  Thanks everyone for participating, we'll see you next season!`);

                await Event.endEvent();
            }
        }
    }

    //               #                ####   #                ##           #  #   #    ##       #                       #
    //               #                #                        #           #  #         #       #                       #
    //  ###    ##   ###   #  #  ###   ###   ##    ###    ###   #     ###   #  #  ##     #     ###   ##    ###  ###    ###
    // ##     # ##   #    #  #  #  #  #      #    #  #  #  #   #    ##     ####   #     #    #  #  #     #  #  #  #  #  #
    //   ##   ##     #    #  #  #  #  #      #    #  #  # ##   #      ##   ####   #     #    #  #  #     # ##  #     #  #
    // ###     ##     ##   ###  ###   #     ###   #  #   # #  ###   ###    #  #  ###   ###    ###   ##    # #  #      ###
    //                          #
    /**
     * Sets up the Wildcard Anarchy match for the Finals Tournament.
     * @returns {Promise} A promise that resolves once the Wildcard Anarchy match is setup.
     */
    static async setupFinalsWildcard() {
        // Eliminate anyone who is not 8th place or tied with 8th place.
        for (const player of players.filter((p) => p.seed > 8)) {
            if (player.score < players[7].score) {
                const guildUser = Discord.getGuildUser(player.id);

                await Discord.queue(`Sorry, ${guildUser}, but the Finals Tournament has enough players entered into it, and you will not be needed to participate today.  However, we would like to thank you for remaining on standby!`, guildUser);
                player.type = "eliminated";
            }
        }

        // Determine who is in the wildcard.
        players.filter((p) => p.type !== "eliminated").forEach((player) => {
            if (player.seed > 4 || player.score === players[4].score) {
                player.type = "wildcard";
            } else {
                player.type = "knockout";
            }
        });

        await Event.checkWildcardMaps();
    }

    //       #                 #     #  #   #    ##       #                       #  #  #
    //       #                 #     #  #         #       #                       #  ####
    //  ##   ###    ##    ##   # #   #  #  ##     #     ###   ##    ###  ###    ###  ####   ###  ###    ###
    // #     #  #  # ##  #     ##    ####   #     #    #  #  #     #  #  #  #  #  #  #  #  #  #  #  #  ##
    // #     #  #  ##    #     # #   ####   #     #    #  #  #     # ##  #     #  #  #  #  # ##  #  #    ##
    //  ##   #  #   ##    ##   #  #  #  #  ###   ###    ###   ##    # #  #      ###  #  #   # #  ###   ###
    //                                                                                           #
    /**
     * Checks if wildcard maps have been set.
     * @returns {Promise} A promise that resolves when wildcard maps have been set.
     */
    static async checkWildcardMaps() {
        // Ensure all players have an anarchy map picked.
        for (const player of players.filter((p) => p.type === "wildcard" && !p.anarchyMap)) {
            if (!player.notified) {
                const guildUser = Discord.getGuildUser(player.id);

                player.notified = true;

                await Discord.queue(`${guildUser}, we are about to start the event, and we need an anarchy map from you right now!  Please pick a map you'd like to play for the wildcard anarchy, which will be picked at random from all participants, using the \`!anarchymap <map>\` command.`, guildUser);
                await Discord.queue(`${guildUser.displayName} has yet to select a map for the Wildcard Anarchy.`, Discord.alertsChannel);
            }
        }

        if (players.find((p) => p.type === "wildcard" && !p.anarchyMap)) {
            return;
        }

        await Event.generateFinalsWildcard();
    }

    //                                      #          ####   #                ##           #  #   #    ##       #                       #
    //                                      #          #                        #           #  #         #       #                       #
    //  ###   ##   ###    ##   ###    ###  ###    ##   ###   ##    ###    ###   #     ###   #  #  ##     #     ###   ##    ###  ###    ###
    // #  #  # ##  #  #  # ##  #  #  #  #   #    # ##  #      #    #  #  #  #   #    ##     ####   #     #    #  #  #     #  #  #  #  #  #
    //  ##   ##    #  #  ##    #     # ##   #    ##    #      #    #  #  # ##   #      ##   ####   #     #    #  #  #     # ##  #     #  #
    // #      ##   #  #   ##   #      # #    ##   ##   #     ###   #  #   # #  ###   ###    #  #  ###   ###    ###   ##    # #  #      ###
    //  ###
    /**
     * Generates the Wildcard Anarchy match for the Finals Tournament.
     * @returns {Promise} A promise that resolves when the wildcard matches have been generated for the Finals Tournament.
     */
    static async generateFinalsWildcard() {
        round++;

        const spotsRequired = 6 - players.filter((p) => p.score > players[4].score).length,
            wildcardPlayers = players.filter((p) => p.type === "wildcard");

        let textChannel, voiceChannel;

        if (wildcardPlayers.length <= 7) {
            try {
                textChannel = await Discord.createTextChannel("wildcard-anarchy", Discord.pilotsChatCategory);
                voiceChannel = await Discord.createVoiceChannel("Wildcard Anarchy", Discord.pilotsVoiceChatCategory);
            } catch (err) {
                throw new Exception("There was an error setting up a Wildcard Anarchy match.", err);
            }

            const match = {
                players: wildcardPlayers.map((p) => p.id),
                channel: textChannel,
                voice: voiceChannel,
                homeSelected: `${wildcardPlayers[Math.floor(Math.random() * wildcardPlayers.length)].anarchyMap} x${Math.ceil(wildcardPlayers.length / 2)} Primaries`,
                round,
                roundName: `Wildcard Anarchy${round > 1 ? ` Round ${round}` : ""}`,
                advancePlayers: spotsRequired
            };

            matches.push(match);

            // Setup channels
            Discord.removePermissions(Discord.defaultRole, match.channel);
            Discord.removePermissions(Discord.defaultRole, match.voice);
            wildcardPlayers.forEach((player) => {
                const guildUser = Discord.getGuildUser(player.id);

                Discord.addTextPermissions(guildUser, match.channel);
                Discord.addVoicePermissions(guildUser, match.voice);
            });

            // Announce match
            await Discord.richQueue({
                embed: {
                    title: "Wildcard Anarchy - Please begin your match!",
                    description: `The voice channel **${voiceChannel}** has been setup for you to use for this match!`,
                    timestamp: new Date(),
                    color: 0x263686,
                    footer: {icon_url: Discord.icon, text: "DescentBot"},
                    fields: [
                        {
                            name: "Selected Map",
                            value: `The map has been randomly selected to be **${match.homeSelected}**.`
                        },
                        {
                            name: "Goals",
                            value: `· The kill goal of the match is **${wildcardPlayers.length * 10}**.\n· The top **${spotsRequired}** players will advance to the next round.`
                        },
                        {
                            name: "Reminders",
                            value: "· Make sure your match is set to either Restricted or Closed.\n· Set your game for at least 4 observers.\n· Do not move when the game begins, ensure everyone is ready first.\n· The game will be reported by an admin upon completion."
                        }
                    ]
                }
            }, match.channel);

            wss.broadcast({
                wildcardMatch: {
                    players: wildcardPlayers.map((p) => Discord.getGuildUser(p).displayName),
                    home: match.homeSelected,
                    round: match.round
                },
                finalsRound: match.roundName
            });

            return;
        }

        let advancePlayers;

        if (spotsRequired === 2) {
            advancePlayers = 2;
        } else if (spotsRequired === 3 && wildcardPlayers.length >= 15) {
            advancePlayers = 2;
        } else if (spotsRequired === 3 && wildcardPlayers.length <= 14) {
            advancePlayers = 3;
        } else if (spotsRequired === 4) {
            advancePlayers = 2;
        } else if (spotsRequired === 5 && wildcardPlayers.length >= 15) {
            advancePlayers = 2;
        } else if (spotsRequired === 5 && wildcardPlayers.length <= 14) {
            advancePlayers = 3;
        } else if (spotsRequired === 6 && wildcardPlayers.length >= 15) {
            advancePlayers = 2;
        } else if (spotsRequired === 6 && wildcardPlayers.length <= 14) {
            advancePlayers = 3;
        }

        const numMatches = Math.ceil(wildcardPlayers.length / 7),
            playersPerMatch = [];

        for (let index = 0; index < numMatches; index++) {
            playersPerMatch.push([]);
        }

        wildcardPlayers.forEach((player, index) => {
            playersPerMatch[index % numMatches].push(player);
        });

        for (const index of playersPerMatch.keys()) {
            const matchPlayers = playersPerMatch[index];

            try {
                textChannel = await Discord.createTextChannel(`wildcard-anarchy-${round}-${index + 1}`, Discord.pilotsChatCategory);
                voiceChannel = await Discord.createVoiceChannel(`Wildcard Anarchy ${round}-${index + 1}`, Discord.pilotsVoiceChatCategory);
            } catch (err) {
                throw new Exception("There was an error setting up a Wildcard Anarchy match.", err);
            }

            const match = {
                players: matchPlayers.map((p) => p.id),
                channel: textChannel,
                voice: voiceChannel,
                homeSelected: `${matchPlayers[Math.floor(Math.random() * matchPlayers.length)].anarchyMap} x${Math.ceil(matchPlayers.length / 2)} Primaries`,
                round,
                roundName: `Wildcard Anarchy Round ${round}`,
                advancePlayers
            };

            matches.push(match);

            // Setup channels
            Discord.removePermissions(Discord.defaultRole, match.channel);
            Discord.removePermissions(Discord.defaultRole, match.voice);
            matchPlayers.forEach((player) => {
                const guildUser = Discord.getGuildUser(player.id);

                Discord.addTextPermissions(guildUser, match.channel);
                Discord.addVoicePermissions(guildUser, match.voice);
            });

            // Announce match
            if (index === 0) {
                await Discord.richQueue({
                    embed: {
                        title: "Wildcard Anarchy - Please begin your match!",
                        description: `The voice channel **${voiceChannel}** has been setup for you to use for this match!`,
                        timestamp: new Date(),
                        color: 0x263686,
                        footer: {icon_url: Discord.icon, text: "DescentBot"},
                        fields: [
                            {
                                name: "Selected Map",
                                value: `The map has been randomly selected to be **${match.homeSelected}**.`
                            },
                            {
                                name: "Goals",
                                value: `· The kill goal of the match is **${matchPlayers * 10}**.\n· The top **${advancePlayers}** players will advance to the next round.`
                            },
                            {
                                name: "Reminders",
                                value: "· Make sure your match is set to either Restricted or Closed.\n· Set your game for at least 4 observers.\n· Do not move when the game begins, ensure everyone is ready first.\n· The game will be reported by an admin upon completion."
                            }
                        ]
                    }
                }, match.channel);

                wss.broadcast({finalsRound: match.roundName});
            } else {
                await Discord.richQueue({
                    embed: {
                        title: "Wildcard Anarchy",
                        description: `The voice channel **${voiceChannel}** has been setup for you to use for this match!`,
                        timestamp: new Date(),
                        color: 0x263686,
                        footer: {icon_url: Discord.icon, text: "DescentBot"},
                        fields: [
                            {
                                name: "Please Wait",
                                value: "Your match will begin after other matches conclude."
                            }
                        ]
                    }
                }, match.channel);
            }

            wss.broadcast({
                wildcardMatch: {
                    players: matchPlayers.map((p) => Discord.getGuildUser(p).displayName),
                    home: match.homeSelected,
                    round: match.round
                }
            });
        }
    }

    //               #                ####   #                ##           ###                        #
    //               #                #                        #           #  #                       #
    //  ###    ##   ###   #  #  ###   ###   ##    ###    ###   #     ###   #  #   ##   #  #  ###    ###
    // ##     # ##   #    #  #  #  #  #      #    #  #  #  #   #    ##     ###   #  #  #  #  #  #  #  #
    //   ##   ##     #    #  #  #  #  #      #    #  #  # ##   #      ##   # #   #  #  #  #  #  #  #  #
    // ###     ##     ##   ###  ###   #     ###   #  #   # #  ###   ###    #  #   ##    ###  #  #   ###
    //                          #
    /**
     * Sets up a round in the Finals Tournament.
     * @returns {Promise} A promise that resolves when the round has been setup.
     */
    static async setupFinalsRound() {
        players.forEach((player) => {
            player.type = "knockout";
        });

        round++;

        switch (players.length) {
            case 2:
                await Event.generateFinalsMatch(players[0], players[1]);
                break;
            case 3:
                await Event.generateFinalsMatch(players[1], players[2]);
                break;
            case 4:
                await Event.setupFinalsOpponentSelection(players[0], [players[1], players[2], players[3]]);
                break;
            case 5:
                await Event.generateFinalsMatch(players[3], players[4]);
                break;
            case 6:
                await Event.setupFinalsOpponentSelection(players[2], [players[3], players[4], players[5]]);
                break;
        }
    }

    //               #                ####   #                ##            ##                                        #     ##         ##                 #     #
    //               #                #                        #           #  #                                       #    #  #         #                 #
    //  ###    ##   ###   #  #  ###   ###   ##    ###    ###   #     ###   #  #  ###   ###    ##   ###    ##   ###   ###    #     ##    #     ##    ##   ###   ##     ##   ###
    // ##     # ##   #    #  #  #  #  #      #    #  #  #  #   #    ##     #  #  #  #  #  #  #  #  #  #  # ##  #  #   #      #   # ##   #    # ##  #      #     #    #  #  #  #
    //   ##   ##     #    #  #  #  #  #      #    #  #  # ##   #      ##   #  #  #  #  #  #  #  #  #  #  ##    #  #   #    #  #  ##     #    ##    #      #     #    #  #  #  #
    // ###     ##     ##   ###  ###   #     ###   #  #   # #  ###   ###     ##   ###   ###    ##   #  #   ##   #  #    ##   ##    ##   ###    ##    ##     ##  ###    ##   #  #
    //                          #                                                #     #
    /**
     * Sets up a finals match by asking a player to choose from multiple opponents.
     * @param {object} player The player required to pick an opponent.
     * @param {object[]} opponents The opponents the player needs to choose from.
     * @returns {Promise} A promise that resolves when the finals opponent selection is setup.
     */
    static async setupFinalsOpponentSelection(player, opponents) {
        const roundPlayers = players.filter((p) => p.type === "knockout");
        let textChannel, voiceChannel;

        try {
            textChannel = await Discord.createTextChannel(roundPlayers.length === 4 ? "semifinals-1" : "quarterfinals-1", Discord.pilotsChatCategory);
            voiceChannel = await Discord.createVoiceChannel(roundPlayers.length === 4 ? "Semifinals 1" : "Quarterfinals 1", Discord.pilotsVoiceChatCategory);
        } catch (err) {
            throw new Exception("There was an error setting up a finals match.", err);
        }

        const match = {
            players: [player.id],
            opponents: opponents.map((o) => o.id),
            channel: textChannel,
            voice: voiceChannel,
            round,
            roundName: roundPlayers.length === 4 ? "Semifinals" : "Quarterfinals",
            killGoal: roundPlayers.length === 2 ? 20 : 15,
            waitingForHome: true
        };

        matches.push(match);

        // Setup channels
        const guildUser = Discord.getGuildUser(player.id);

        Discord.removePermissions(Discord.defaultRole, match.channel);
        Discord.removePermissions(Discord.defaultRole, match.voice);
        Discord.addTextPermissions(guildUser, match.channel);
        Discord.addVoicePermissions(guildUser, match.voice);

        // Announce match
        await Discord.richQueue({
            embed: {
                title: `${roundPlayers.length === 4 ? "Semifinals" : "Quarterfinals"} - Select your opponent`,
                description: "As the higher seed in the tournament, you have get to choose who you want your next opponent to be.",
                timestamp: new Date(),
                color: 0x263686,
                footer: {icon_url: Discord.icon, text: "DescentBot"},
                fields: [
                    {
                        name: "Opponent Selection",
                        value: `${guildUser}, please choose from the following opponents:\n${opponents.map((o, index) => `\`!select ${index + 1}\` - ${Discord.getGuildUser(o.id)}`).join("\n")}`
                    }
                ]
            }
        }, match.channel);

        wss.broadcast({finalsRound: match.roundName});
    }

    //               #     ##                                        #    ####              #  #         #          #
    //               #    #  #                                       #    #                 ####         #          #
    //  ###    ##   ###   #  #  ###   ###    ##   ###    ##   ###   ###   ###    ##   ###   ####   ###  ###    ##   ###
    // ##     # ##   #    #  #  #  #  #  #  #  #  #  #  # ##  #  #   #    #     #  #  #  #  #  #  #  #   #    #     #  #
    //   ##   ##     #    #  #  #  #  #  #  #  #  #  #  ##    #  #   #    #     #  #  #     #  #  # ##   #    #     #  #
    // ###     ##     ##   ##   ###   ###    ##   #  #   ##   #  #    ##  #      ##   #     #  #   # #    ##   ##   #  #
    //                          #     #
    /**
     * Sets the opponent for a match.
     * @param {object} match The match.
     * @param {string} opponent The Discord ID of the selected opponent.
     * @returns {Promise} A promise that resolves when the opponent is set for the match.
     */
    static async setOpponentForMatch(match, opponent) {
        // Go into level selection for the match if this is the current match.
        const guildUser1 = Discord.getGuildUser(match.players[0]),
            guildUser2 = Discord.getGuildUser(opponent),
            player1 = Event.getPlayer(guildUser1.id),
            player2 = Event.getPlayer(guildUser2.id);

        match.players.push(opponent);
        match.home = opponent;
        match.homes = players.find((p) => p.id === opponent).homes;
        match.homesPlayed = [];

        Discord.addTextPermissions(guildUser2, match.channel);
        Discord.addVoicePermissions(guildUser2, match.voice);

        await Discord.richQueue({
            embed: {
                title: `${guildUser1.displayName} vs ${guildUser2.displayName}`,
                description: `The voice channel **${match.voice}** has been setup for you to use for this match!`,
                timestamp: new Date(),
                color: 0x263686,
                footer: {icon_url: Discord.icon, text: "DescentBot"},
                fields: [
                    {
                        name: match.roundName,
                        value: `This will be a home-and-home series decided by total score with each game having a kill goal of ${match.killGoal}.`
                    },
                    {
                        name: "First Game Rules",
                        value: `· The game ends when either pilot reaches **${match.killGoal}** and all remaining weapons in the air have been resolved.\n· ${guildUser2} is the home pilot, and ${guildUser1} will get to select the level played.`
                    },
                    {
                        name: "Map Selection",
                        value: `${guildUser1}, please choose from the following three home maps:\n\`!choose a\` - ${match.homes[0]}\n\`!choose b\` - ${match.homes[1]}\n\`!choose c\` - ${match.homes[2]}`
                    }
                ]
            }
        }, match.channel);

        wss.broadcast({
            finalsMatch: {
                player1: guildUser1.displayName,
                player2: guildUser2.displayName,
                homesPlayed: [],
                round: match.round
            },
            finalsRound: match.roundName,
            finalsStatus: `${player1.seed}) ${guildUser1.displayName} vs ${player2.seed}) ${guildUser2.displayName}`
        });

        // Setup next match.
        const roundPlayers = players.filter((p) => p.type === "knockout"),
            remainingPlayers = players.filter((p) => p.type === "knockout" && match.players.indexOf(p.id) === -1);

        if (remainingPlayers.length > 0) {
            remainingPlayers.splice(0, remainingPlayers.length - 2);

            const guildUser3 = Discord.getGuildUser(remainingPlayers[0].id),
                guildUser4 = Discord.getGuildUser(remainingPlayers[1].id),
                roundMatches = matches.filter((m) => !m.cancelled && m.round === round);
            let textChannel, voiceChannel;

            try {
                textChannel = await Discord.createTextChannel(roundPlayers.length === 4 ? `semifinals-${roundMatches.length + 1}` : `quarterfinals-${roundMatches.length + 1}`, Discord.pilotsChatCategory);
                voiceChannel = await Discord.createVoiceChannel(roundPlayers.length === 4 ? `Semifinals ${roundMatches.length + 1}` : `Quarterfinals ${roundMatches.length + 1}`, Discord.pilotsVoiceChatCategory);
            } catch (err) {
                throw new Exception(`There was an error setting up the match between ${guildUser3.displayName} and ${guildUser4.displayName}.`, err);
            }

            const nextMatch = {
                players: [guildUser3.id, guildUser4.id],
                channel: textChannel,
                voice: voiceChannel,
                round: round === 0 ? void 0 : round,
                roundName: match.roundName,
                killGoal: match.killGoal,
                home: guildUser4.id,
                homesPlayed: [],
                waitingForHome: true
            };

            matches.push(nextMatch);

            // Setup channels
            Discord.removePermissions(Discord.defaultRole, nextMatch.channel);
            Discord.addTextPermissions(guildUser3, nextMatch.channel);
            Discord.addTextPermissions(guildUser4, nextMatch.channel);
            Discord.removePermissions(Discord.defaultRole, nextMatch.voice);
            Discord.addVoicePermissions(guildUser3, nextMatch.voice);
            Discord.addVoicePermissions(guildUser4, nextMatch.voice);

            nextMatch.homes = players.find((p) => p.id === nextMatch.players[1]).homes;

            // Announce match
            await Discord.richQueue({
                embed: {
                    title: `${guildUser3.displayName} vs ${guildUser4.displayName}`,
                    description: `The voice channel **${voiceChannel}** has been setup for you to use for this match!`,
                    timestamp: new Date(),
                    color: 0x263686,
                    footer: {icon_url: Discord.icon, text: "DescentBot"},
                    fields: [
                        {
                            name: "Please Wait",
                            value: "Your match will begin after other matches conclude."
                        }
                    ]
                }
            }, nextMatch.channel);

            wss.broadcast({
                finalsMatch: {
                    player1: guildUser3.displayName,
                    player2: guildUser4.displayName,
                    homesPlayed: [],
                    round: nextMatch.round
                }
            });
        }
    }

    //                                      #          ####   #                ##           #  #         #          #
    //                                      #          #                        #           ####         #          #
    //  ###   ##   ###    ##   ###    ###  ###    ##   ###   ##    ###    ###   #     ###   ####   ###  ###    ##   ###
    // #  #  # ##  #  #  # ##  #  #  #  #   #    # ##  #      #    #  #  #  #   #    ##     #  #  #  #   #    #     #  #
    //  ##   ##    #  #  ##    #     # ##   #    ##    #      #    #  #  # ##   #      ##   #  #  # ##   #    #     #  #
    // #      ##   #  #   ##   #      # #    ##   ##   #     ###   #  #   # #  ###   ###    #  #   # #    ##   ##   #  #
    //  ###
    /**
     * Generates a finals match between two players.
     * @param {object} player1 The first player.
     * @param {object} player2 The second player.
     * @returns {Promise} A promise that resolves when the finals match is setup.
     */
    static async generateFinalsMatch(player1, player2) {
        const roundPlayers = players.filter((p) => p.type === "knockout"),
            guildUser1 = Discord.getGuildUser(player1.id),
            guildUser2 = Discord.getGuildUser(player2.id),
            roundMatches = matches.filter((m) => !m.cancelled && m.round === round);
        let textChannel, voiceChannel;

        try {
            textChannel = await Discord.createTextChannel(roundPlayers.length === 2 ? "finals" : roundPlayers.length === 4 ? `semifinals-${roundMatches.length + 1}` : `quarterfinals-${roundMatches.length + 1}`, Discord.pilotsChatCategory);
            voiceChannel = await Discord.createVoiceChannel(roundPlayers.length === 2 ? "Finals" : roundPlayers.length === 4 ? `Semifinals ${roundMatches.length + 1}` : `Quarterfinals ${roundMatches.length + 1}`, Discord.pilotsVoiceChatCategory);
        } catch (err) {
            throw new Exception(`There was an error setting up the match between ${guildUser1.displayName} and ${guildUser2.displayName}.`, err);
        }

        const match = {
            players: [guildUser1.id, guildUser2.id],
            channel: textChannel,
            voice: voiceChannel,
            round: round === 0 ? void 0 : round,
            roundName: `${roundPlayers.length === 2 ? "Finals" : roundPlayers.length < 4 ? "Semifinals" : roundPlayers.length < 8 ? "Quarterfinals" : `Round of ${Math.pow(2, Math.ceil(Math.log2(roundPlayers)))}`}`,
            killGoal: roundPlayers.length === 2 ? 20 : 15,
            home: guildUser2.id,
            homesPlayed: [],
            waitingForHome: true
        };

        matches.push(match);

        // Setup channels
        Discord.removePermissions(Discord.defaultRole, match.channel);
        Discord.addTextPermissions(guildUser1, match.channel);
        Discord.addTextPermissions(guildUser2, match.channel);
        Discord.removePermissions(Discord.defaultRole, match.voice);
        Discord.addVoicePermissions(guildUser1, match.voice);
        Discord.addVoicePermissions(guildUser2, match.voice);

        match.homes = player2.homes;

        // Announce match
        await Discord.richQueue({
            embed: {
                title: `${guildUser1.displayName} vs ${guildUser2.displayName}`,
                description: `The voice channel **${voiceChannel}** has been setup for you to use for this match!`,
                timestamp: new Date(),
                color: 0x263686,
                footer: {icon_url: Discord.icon, text: "DescentBot"},
                fields: [
                    {
                        name: match.roundName,
                        value: `This will be a home-and-home series decided by total score with each game having a kill goal of ${match.killGoal}.`
                    },
                    {
                        name: "First Game Rules",
                        value: `· The game ends when either pilot reaches **${match.killGoal}** and all remaining weapons in the air have been resolved.\n· ${guildUser2} is the home pilot, and ${guildUser1} will get to select the level played.`
                    },
                    {
                        name: "Map Selection",
                        value: `${guildUser1}, please choose from the following three home maps:\n\`!choose a\` - ${match.homes[0]}\n\`!choose b\` - ${match.homes[1]}\n\`!choose c\` - ${match.homes[2]}`
                    }
                ]
            }
        }, match.channel);

        wss.broadcast({
            finalsMatch: {
                player1: guildUser1.displayName,
                player2: guildUser2.displayName,
                homesPlayed: [],
                round: match.round
            },
            finalsRound: match.roundName,
            finalsStatus: `${player1.seed}) ${guildUser1.displayName} vs ${player2.seed}) ${guildUser2.displayName}`
        });
    }

    //                #         #           ##
    //                #         #          #  #
    // #  #  ###    ###   ###  ###    ##   #      ###  # #    ##
    // #  #  #  #  #  #  #  #   #    # ##  # ##  #  #  ####  # ##
    // #  #  #  #  #  #  # ##   #    ##    #  #  # ##  #  #  ##
    //  ###  ###    ###   # #    ##   ##    ###   # #  #  #   ##
    //       #
    /**
     * Updates the scores for a game.
     * @param {object} match The match to update.
     * @param {[number, number]} score The new score of the game.
     * @returns {Promise} A promise that resolves when the game is updated.
     */
    static async updateGame(match, score) {
        const guildUser1 = Discord.getGuildUser(match.players[0]),
            guildUser2 = Discord.getGuildUser(match.players[1]),
            player1 = Event.getPlayer(guildUser1.id),
            player2 = Event.getPlayer(guildUser2.id);

        if (!match.overtime && match.score) {
            // If the scores match, setup overtime.
            if (score[0] === score[1]) {
                match.overtime = true;
                match.waitingForHome = true;
                match.score = score;

                await Discord.richQueue({
                    embed: {
                        title: "Overtime!",
                        description: `The match is tied ${score[0]}-${score[1]} after two games!`,
                        timestamp: new Date(),
                        color: 0x263686,
                        footer: {icon_url: Discord.icon, text: "DescentBot"},
                        fields: [
                            {
                                name: "Overtime Rules",
                                value: `· The overtime game is played to **5**, win by **2**.\n· ${guildUser1} is the home pilot, and ${guildUser2} will get to re-select the level played.`
                            },
                            {
                                name: "Map Selection",
                                value: `${guildUser2}, please choose from the following three home maps:\n\`!choose a\` - ${match.homes[0]}\n\`!choose b\` - ${match.homes[1]}\n\`!choose c\` - ${match.homes[2]}`
                            }
                        ]
                    }
                }, match.channel);

                wss.broadcast({
                    finalsMatch: {
                        player1: guildUser1.displayName,
                        player2: guildUser2.displayName,
                        score1: match.score[0],
                        score2: match.score[1],
                        homesPlayed: match.homesPlayed,
                        round: match.round
                    },
                    finalsRound: match.roundName,
                    finalsStatus: `${player1.seed}) ${guildUser1.displayName} ${match.score[0]} - ${player2.seed}) ${guildUser2.displayName} ${match.score[1]}`
                });

                return;
            }
        } else if (!match.overtime && !match.score) {
            // If the difference in scores are less than or equal to the kill goal, setup 2nd game.
            if (Math.abs(score[0] - score[1]) <= match.killGoal) {
                match.score = score;
                match.waitingForHome = true;
                match.home = match.players[0];
                match.homes = Event.getPlayer(match.players[0]).homes;

                const goalScores = [match.score[0] === match.killGoal ? match.score[1] + 1 : match.killGoal, match.score[1] === match.killGoal ? match.score[0] + 1 : match.killGoal];

                await Discord.richQueue({
                    embed: {
                        title: "Second Game",
                        description: `${score[0] === score[1] ? `The score is tied ${score[0]}-${score[1]}` : score[0] > score[1] ? `${guildUser1} leads ${score[0]}-${score[1]}` : `${guildUser2} leads ${score[1]}-${score[0]}`} after the first game.`,
                        timestamp: new Date(),
                        color: 0x263686,
                        footer: {icon_url: Discord.icon, text: "DescentBot"},
                        fields: [
                            {
                                name: "Second Game Rules",
                                value: `· The game ends when either ${guildUser1} reaches **${goalScores[0]}** or ${guildUser2} reaches **${goalScores[1]}** and all remaining weapons in the air have been resolved.\n· ${guildUser1} is now the home pilot, and ${guildUser2} will get to select the level played.`
                            },
                            {
                                name: "Map Selection",
                                value: `${guildUser2}, please choose from the following three home maps:\n\`!choose a\` - ${match.homes[0]}\n\`!choose b\` - ${match.homes[1]}\n\`!choose c\` - ${match.homes[2]}`
                            }
                        ]
                    }
                }, match.channel);

                wss.broadcast({
                    finalsMatch: {
                        player1: guildUser1.displayName,
                        player2: guildUser2.displayName,
                        score1: match.score[0],
                        score2: match.score[1],
                        homesPlayed: match.homesPlayed,
                        round: match.round
                    },
                    finalsRound: match.roundName,
                    finalsStatus: `${player1.seed}) ${guildUser1.displayName} ${match.score[0]} - ${player2.seed}) ${guildUser2.displayName} ${match.score[1]}`
                });

                return;
            }
        }

        // The game is over, wrap up game and move to the next game.
        try {
            await Db.addResult(eventId, match.homesPlayed.join("/"), match.round, [{id: match.players[0], score: score[0]}, {id: match.players[1], score: score[1]}]);
        } catch (err) {
            throw new Exception("There was a database error saving the result to the database.", err);
        }

        let winnerUser, winnerScore, loserScore;

        if (score[0] > score[1]) {
            match.winner = match.players[0];
            winnerUser = guildUser1;
            winnerScore = score[0];
            loserScore = score[1];
            match.score = score;
        } else {
            match.winner = match.players[1];
            winnerUser = guildUser2;
            winnerScore = score[1];
            loserScore = score[0];
            match.score = [score[1], score[0]];
        }

        await Discord.queue(`This match has been reported as a win for ${winnerUser.displayName} by the score of ${winnerScore} to ${loserScore}.  You may add a comment to this match using \`!comment <your comment>\` any time before your next match.  This channel and the voice channel will close in 2 minutes.`, match.channel);

        setTimeout(() => {
            Event.postResult(match);
        }, 120000);

        wss.broadcast({
            finalsMatch: {
                player1: guildUser1.displayName,
                player2: guildUser2.displayName,
                winner: winnerUser.displayName,
                score1: score[0],
                score2: score[1],
                homesPlayed: match.homesPlayed,
                round: match.round
            }
        });

        const message = await Discord.richQueue(Event.getResultEmbed(match), Discord.resultsChannel);

        match.results = message;

        await Event.nextFinalsMatch();
    }

    //              #          #     ###   ##
    //              #          #     #  #   #
    // # #    ###  ###    ##   ###   #  #   #     ###  #  #   ##   ###    ###
    // ####  #  #   #    #     #  #  ###    #    #  #  #  #  # ##  #  #  ##
    // #  #  # ##   #    #     #  #  #      #    # ##   # #  ##    #       ##
    // #  #   # #    ##   ##   #  #  #     ###    # #    #    ##   #     ###
    //                                                  #
    /**
     * A recursive function to match players within a round.
     * @param {object[]} eventPlayers The players in the event.
     * @param {object[]} potentialMatches The array of potential matches.
     * @returns {boolean} Whether matching players was successful for this iteration.
     */
    static matchPlayers(eventPlayers, potentialMatches) {
        // If there's only one player, we can't match anyone.
        if (eventPlayers.length <= 1) {
            return false;
        }

        const remainingPlayers = eventPlayers.filter((p) => potentialMatches.filter((m) => m.indexOf(p.id) !== -1).length === 0),
            firstPlayer = remainingPlayers[0],

            // Potential opponents don't include the first player, potential opponents cannot have played against the first player, and potential opponents or the first player need to be able to host.
            potentialOpponents = remainingPlayers.filter((p) => p.id !== firstPlayer.id && matches.filter((m) => !m.cancelled && m.players.indexOf(p.id) !== -1 && m.players.indexOf(firstPlayer.id) !== -1).length === 0 && (firstPlayer.eventPlayer.canHost || p.eventPlayer.canHost));

        // Attempt to assign a bye if necessary.
        if (remainingPlayers.length === 1) {
            if (firstPlayer.matches >= round) {
                // We can assign the bye.  We're done, return true.
                return true;
            }

            // We can't assign the bye, return false.
            return false;
        }

        while (potentialOpponents.length > 0) {
            // This allows us to get an opponent that's roughly in the middle in round 1, in the top 1/4 in round 2, the top 1/8 in round 3, etc, so as the tournament goes on we'll get what should be closer matches.
            const position = potentialMatches.length * 2 / eventPlayers.length,
                goal = Math.ceil((potentialMatches.length * 2 + 1) * Math.pow(2, round) / eventPlayers.length) / Math.pow(2, round),
                target = ((position + goal) / 2 - position) / (1 - position),
                index = Math.floor(target * potentialOpponents.length);

            // Add the match.
            potentialMatches.push([firstPlayer.id, potentialOpponents[index].id]);

            // If we had 2 or less remaining players at the start of this function, there's none left, so we're done!  Return true.
            if (remainingPlayers.length <= 2) {
                return true;
            }

            // If we can match the remaining players, we're done!  return true.
            if (Event.matchPlayers(eventPlayers, potentialMatches)) {
                return true;
            }

            // If we get here, there was a problem with the previous pairing.  Back the match out, remove the offending player, and continue the loop.
            potentialMatches.pop();
            potentialOpponents.splice(index, 1);
        }

        // If we get here, we can't do any pairings.  Return false.
        return false;
    }

    //                                      #          ###                        #
    //                                      #          #  #                       #
    //  ###   ##   ###    ##   ###    ###  ###    ##   #  #   ##   #  #  ###    ###
    // #  #  # ##  #  #  # ##  #  #  #  #   #    # ##  ###   #  #  #  #  #  #  #  #
    //  ##   ##    #  #  ##    #     # ##   #    ##    # #   #  #  #  #  #  #  #  #
    // #      ##   #  #   ##   #      # #    ##   ##   #  #   ##    ###  #  #   ###
    //  ###
    /**
     * Generates the matches for the next round.
     * @returns {object[]} The potential matches for the round.
     */
    static generateRound() {
        const potentialMatches = [];

        if (!Event.matchPlayers(
            players.filter((player) => !player.withdrawn).map((player) => ({
                id: player.id,
                eventPlayer: player,
                ratedPlayer: ratedPlayers.find((p) => p.DiscordID === player.id) || {
                    Name: Discord.getGuildUser(player.id) ? Discord.getGuildUser(player.id).displayName : `<@${player.id}>`,
                    DiscordID: player.id,
                    Rating: defaultRating.rating,
                    RatingDeviation: defaultRating.rd,
                    Volatility: defaultRating.vol
                },
                points: matches.filter((m) => !m.cancelled && m.winner === player.id).length - (matches.filter((m) => !m.cancelled && m.players.indexOf(player.id) !== -1).length - matches.filter((m) => !m.cancelled && m.winner === player.id).length),
                matches: matches.filter((m) => !m.cancelled && m.players.indexOf(player.id) !== -1).length
            })).sort((a, b) => b.points - a.points || b.ratedPlayer.Rating - a.ratedPlayer.Rating || b.matches - a.matches || (Math.random() < 0.5 ? 1 : -1)),
            potentialMatches
        )) {
            throw new Exception("Pairings didn't work out.");
        }

        round++;

        wss.broadcast({round});

        // Set home maps.
        potentialMatches.forEach((match) => {
            match.sort((a, b) => matches.filter((m) => !m.cancelled && m.home === a).length - matches.filter((m) => !m.cancelled && m.home === b).length || matches.filter((m) => !m.cancelled && m.players.indexOf(b) !== -1 && m.home !== b).length - matches.filter((m) => !m.cancelled && m.players.indexOf(a) !== -1 && m.home !== a).length || (Math.random() < 0.5 ? 1 : -1));
        });

        return potentialMatches;
    }

    //                #        ###                        #
    //                #        #  #                       #
    // #  #  ###    ###   ##   #  #   ##   #  #  ###    ###
    // #  #  #  #  #  #  #  #  ###   #  #  #  #  #  #  #  #
    // #  #  #  #  #  #  #  #  # #   #  #  #  #  #  #  #  #
    //  ###  #  #   ###   ##   #  #   ##    ###  #  #   ###
    /**
     * Undoes the last round.
     * @returns {Promise} A promise that resolves when the round is undone.
     */
    static async undoRound() {
        for (const match of matches.filter((m) => !m.cancelled && m.round === round)) {
            await Event.cancelMatch(match);
        }

        round--;

        await Discord.queue("The previous round has been cancelled.  Please standby for updates.");
    }

    //                          #          #  #         #          #
    //                          #          ####         #          #
    //  ##   ###    ##    ###  ###    ##   ####   ###  ###    ##   ###
    // #     #  #  # ##  #  #   #    # ##  #  #  #  #   #    #     #  #
    // #     #     ##    # ##   #    ##    #  #  # ##   #    #     #  #
    //  ##   #      ##    # #    ##   ##   #  #   # #    ##   ##   #  #
    /**
     * Creates a match between two players.
     * @param {string} homeUserId The user ID of the home player.
     * @param {string} awayUserId The user ID of the away player.
     * @returns {Promise} A promise that resolves when the match is created.
     */
    static async createMatch(homeUserId, awayUserId) {
        const player1 = Discord.getGuildUser(homeUserId),
            player2 = Discord.getGuildUser(awayUserId),
            channelName = `${player1.displayName}-${player2.displayName}`;
        let textChannel, voiceChannel;

        try {
            textChannel = await Discord.createTextChannel(channelName.toLowerCase().replace(/[^\-a-z0-9]/g, ""), Discord.pilotsChatCategory);
            voiceChannel = await Discord.createVoiceChannel(channelName, Discord.pilotsVoiceChatCategory);
        } catch (err) {
            throw new Exception(`There was an error setting up the match between ${player1.displayName} and ${player2.displayName}.`, err);
        }

        const match = {
            players: [player1.id, player2.id],
            channel: textChannel,
            voice: voiceChannel,
            home: player1.id,
            round: round === 0 ? void 0 : round
        };

        matches.push(match);

        // Setup channels
        Discord.removePermissions(Discord.defaultRole, match.channel);
        Discord.addTextPermissions(player1, match.channel);
        Discord.addTextPermissions(player2, match.channel);
        Discord.removePermissions(Discord.defaultRole, match.voice);
        Discord.addVoicePermissions(player1, match.voice);
        Discord.addVoicePermissions(player2, match.voice);

        match.homes = Event.getPlayer(player1.id).homes;

        // Announce match
        await Discord.richQueue({
            embed: {
                title: `${player1.displayName} vs ${player2.displayName}`,
                description: `The voice channel **${voiceChannel}** has been setup for you to use for this match!`,
                timestamp: new Date(),
                color: 0x263686,
                footer: {icon_url: Discord.icon, text: "DescentBot"},
                fields: [
                    {
                        name: "Map Selection",
                        value: `${player2}, please choose from the following three home maps:\n\`!choose a\` - ${match.homes[0]}\n\`!choose b\` - ${match.homes[1]}\n\`!choose c\` - ${match.homes[2]}`
                    }
                ]
            }
        }, match.channel);

        Db.lockHomeMapsForDiscordIds([player1.id, player2.id]).catch((err) => {
            Log.exception(`There was a non-critical database error locking the home maps for ${player1.displayName} and ${player2.displayName}.`, err);
        });

        wss.broadcast({
            match: {
                player1: player1.displayName,
                player2: player2.displayName,
                homes: match.homes,
                round: match.round
            }
        });
    }

    //                               ##    #  #         #          #
    //                                #    ####         #          #
    //  ##    ###  ###    ##    ##    #    ####   ###  ###    ##   ###
    // #     #  #  #  #  #     # ##   #    #  #  #  #   #    #     #  #
    // #     # ##  #  #  #     ##     #    #  #  # ##   #    #     #  #
    //  ##    # #  #  #   ##    ##   ###   #  #   # #    ##   ##   #  #
    /**
     * Cancels a match.
     * @param {object} match The match to cancel.
     * @returns {Promise} A promise that resolves when the match is cancelled.
     */
    static async cancelMatch(match) {
        match.cancelled = true;

        const player1 = Discord.getGuildUser(match.players[0]),
            player2 = Discord.getGuildUser(match.players[1]);

        if (match.channel) {
            await Discord.queue(`The match between ${player1} and ${player2} has been cancelled.`);
            await Discord.queue("This match has been cancelled.  This channel and the voice channel will close in 2 minutes.", match.channel);

            setTimeout(() => {
                Discord.removePermissions(player1, match.channel);
                Discord.removePermissions(player2, match.channel);
                Discord.removeChannel(match.voice);
                delete match.channel;
                delete match.voice;
            }, 120000);
        }

        wss.broadcast({
            cancelMatch: {
                player1: player1.displayName,
                player2: player2.displayName,
                round: match.round
            }
        });
    }

    //                #  ####                     #
    //                #  #                        #
    //  ##   ###    ###  ###   # #    ##   ###   ###
    // # ##  #  #  #  #  #     # #   # ##  #  #   #
    // ##    #  #  #  #  #     # #   ##    #  #   #
    //  ##   #  #   ###  ####   #     ##   #  #    ##
    /**
     * Ends the event, saving all updates to the database.
     * @returns {Promise} A promise that resolves when the data has been saved.
     */
    static async endEvent() {
        await Event.loadRatedPlayers();

        // Add new ratings for players that haven't played yet.
        players.forEach((player) => {
            if (ratedPlayers.filter((p) => p.DiscordID === player.id).length === 0) {
                ratedPlayers.push({
                    DiscordID: player.id,
                    Rating: defaultRating.rating,
                    RatingDeviation: defaultRating.rd,
                    Volatility: defaultRating.vol
                });
            }
        });

        // Update Discord name, and create the glicko ranking for each player.
        for (const player of ratedPlayers) {
            const user = Discord.getGuildUser(player.DiscordID);

            if (user) {
                player.Name = user.displayName;
                await Discord.removeEventRole(user);
            }

            player.glicko = ranking.makePlayer(player.Rating, player.RatingDeviation, player.Volatility);
        }

        // Update ratings.
        const reportedMatches = [];
        matches.filter((m) => !m.cancelled && m.winner).forEach((match) => {
            if (match.players.length === 2) {
                reportedMatches.push([ratedPlayers.find((p) => p.DiscordID === match.players[0]).glicko, ratedPlayers.find((p) => p.DiscordID === match.players[1]).glicko, match.players[0] === match.winner ? 1 : 0]);
            } else {
                const racers = [],
                    lastScore = Infinity;

                match.score.forEach((score) => {
                    const player = ratedPlayers.find((p) => p.DiscordID === score.id).glicko;

                    if (score.score === lastScore) {
                        racers[racers.length - 1].push(player);
                    } else {
                        racers.push([player]);
                    }
                });

                ranking.makeRace(racers).getMatches().forEach((pairing) => {
                    reportedMatches.push(pairing);
                });
            }
        });

        ranking.updateRatings(reportedMatches);

        // Update ratings on object.
        ratedPlayers.forEach((player) => {
            player.Rating = player.glicko.getRating();
            player.RatingDeviation = player.glicko.getRd();
            player.Volatility = player.glicko.getVol();
        });

        // Update the database with the ratings.
        for (const player of ratedPlayers) {
            await Db.updatePlayerRating(player.Name, player.DiscordID, player.Rating, player.RatingDeviation, player.Volatility);
        }

        await Db.updateEventRatings(eventId);

        running = false;
        matches.splice(0, matches.length);
        players.splice(0, players.length);

        clearInterval(Event.backupInterval);
        Db.clearBackup();
        Event.backupInterval = void 0;
    }

    //             #                    #
    //             #                    #
    //  ##   ###   #      ##    ###   ###
    // #  #  #  #  #     #  #  #  #  #  #
    // #  #  #  #  #     #  #  # ##  #  #
    //  ##   #  #  ####   ##    # #   ###
    /**
     * Performs event initialization on load.
     * @returns {Promise} A promise that resolves when the event is initialized.
     */
    static async onLoad() {
        const backup = await Db.getBackup();

        if (backup) {
            matches.splice(0, matches.length);
            players.splice(0, players.length);

            ({finals, warningSent, round, eventName, eventId, season} = backup);
            eventDate = new Date(backup.eventDate);

            Discord.setSeasonRole(Discord.findRoleByName(`Season ${season} Participant`));

            if (finals && !warningSent) {
                const warningDate = new tz.Date(eventDate, "America/Los_Angeles");

                warningDate.setDate(warningDate.getDate() - 1);

                Event.warningTimeout = setTimeout(Event.warning, Math.max(new tz.Date(`${warningDate.toDateString()} 0:00`, "America/Los_Angeles").getTime() - new Date().getTime(), 1));
            }

            for (const match of backup.matches) {
                if (match.channel) {
                    match.channel = Discord.findChannelById(match.channel);
                }

                if (match.voice) {
                    match.voice = Discord.findChannelById(match.voice);
                }

                if (match.results) {
                    const resultsChannel = await Discord.resultsChannel.fetchMessage(match.results);
                    match.results = resultsChannel;
                }

                matches.push(match);
            }

            backup.players.forEach((player) => {
                players.push(player);
            });

            running = true;

            wss.broadcast({
                round: finals ? void 0 : round,
                seeding: finals ? players.map((p) => ({name: Discord.getGuildUser(p.id).displayName, seed: p.seed})) : void 0,
                matches: finals ? void 0 : matches.filter((m) => !m.cancelled).map((m) => ({
                    player1: Discord.getGuildUser(m.players[0]).displayName,
                    player2: Discord.getGuildUser(m.players[1]).displayName,
                    winner: m.winner ? Discord.getGuildUser(m.winner).displayName : "",
                    score1: m.score ? m.score[0] : void 0,
                    score2: m.score ? m.score[1] : void 0,
                    homes: m.homeSelected ? void 0 : Event.getPlayer(m.players[0]).homes,
                    home: m.homeSelected,
                    round: m.round
                })),
                wildcardMatches: finals ? matches.filter((m) => !m.cancelled && m.players.length > 2).map((m) => ({
                    players: m.players.map((p) => Discord.getGuildUser(p).displayName),
                    winner: m.winner ? m.winner.map((w) => Discord.getGuildUser(w).displayName) : [],
                    score: m.score ? m.score.map((s) => ({name: Discord.getGuildUser(s.id).displayName, score: s.score})) : [],
                    home: m.homeSelected,
                    round: m.round
                })) : void 0,
                finalsMatches: finals ? matches.filter((m) => !m.cancelled && m.players.length === 2).map((m) => ({
                    player1: Discord.getGuildUser(m.players[0]).displayName,
                    player2: Discord.getGuildUser(m.players[1]).displayName,
                    winner: m.winner ? Discord.getGuildUser(m.winner).displayName : "",
                    score1: m.score ? m.score[0] : void 0,
                    score2: m.score ? m.score[1] : void 0,
                    home: m.homesPlayed.join("/"),
                    round: m.round
                })) : void 0,
                standings: finals ? void 0 : Event.getStandings()
            });

            try {
                ratedPlayers = await Db.getPlayers();
            } catch (err) {
                Log.exception("There was a database error getting the rated players.", err);
            }

            Event.backupInterval = setInterval(Event.backup, 300000);

            Log.log("Backup loaded.");
        }
    }
}

//                           #                          #                      #
//                           #                          #                      #
// #  #   ###    ###         ###   ###    ##    ###   ###   ##    ###   ###   ###
// #  #  ##     ##           #  #  #  #  #  #  #  #  #  #  #     #  #  ##      #
// ####    ##     ##    ##   #  #  #     #  #  # ##  #  #  #     # ##    ##    #
// ####  ###    ###     ##   ###   #      ##    # #   ###   ##    # #  ###      ##
wss.broadcast = (message) => {
    message = JSON.stringify(message);

    wss.clients.forEach((client) => {
        client.send(message);
    });
};

//                                                                                  #     #
//                                                                                  #
// #  #   ###    ###          ##   ###          ##    ##   ###   ###    ##    ##   ###   ##     ##   ###
// #  #  ##     ##           #  #  #  #        #     #  #  #  #  #  #  # ##  #      #     #    #  #  #  #
// ####    ##     ##         #  #  #  #        #     #  #  #  #  #  #  ##    #      #     #    #  #  #  #
// ####  ###    ###           ##   #  #         ##    ##   #  #  #  #   ##    ##     ##  ###    ##   #  #
wss.on("connection", (ws) => {
    ws.on("message", (data) => {
        const message = JSON.parse(data);

        if (!Event.isRunning()) {
            return;
        }

        switch (message.type) {
            case "standings":
                ws.send(JSON.stringify({
                    type: "standings",
                    standings: Event.getStandings()
                }));
                break;
            case "results":
                ws.send(JSON.stringify({
                    type: "results",
                    matches: matches.filter((m) => !m.cancelled && m.winner).map((match) => ({
                        player1: Discord.getGuildUser(match.winner).displayName,
                        player2: Discord.getGuildUser(match.players.find((p) => p !== match.winner)[0]).displayName,
                        score1: match.score[0],
                        score2: match.score[1],
                        home: match.homeSelected
                    }))
                }));
                break;
        }
    });

    if (running) {
        ws.send(JSON.stringify({
            round: finals ? void 0 : round,
            seeding: finals ? players.map((player) => ({name: Discord.getGuildUser(player.id).displayName, seed: player.seed})) : void 0,
            matches: finals ? void 0 : matches.filter((m) => !m.cancelled).map((m) => ({
                player1: Discord.getGuildUser(m.players[0]).displayName,
                player2: Discord.getGuildUser(m.players[1]).displayName,
                winner: m.winner ? Discord.getGuildUser(m.winner).displayName : "",
                score1: m.score ? m.score[0] : void 0,
                score2: m.score ? m.score[1] : void 0,
                homes: m.homeSelected ? void 0 : Event.getPlayer(m.players[0]).homes,
                home: m.homeSelected,
                round: m.round
            })),
            wildcardMatches: finals ? matches.filter((m) => m.players.length > 2).map((m) => ({
                players: m.players.map((p) => Discord.getGuildUser(p).displayName),
                winner: m.winner ? m.winner.map((w) => Discord.getGuildUser(w).displayName) : [],
                score: m.scode ? m.score.map((s) => ({name: Discord.getGuildUser(s.id).displayName, score: s.score})) : [],
                home: m.homeSelected,
                round: m.round
            })) : void 0,
            finalsMatches: finals ? matches.filter((m) => m.players.length === 2).map((m) => ({
                player1: Discord.getGuildUser(m.players[0]).displayName,
                player2: Discord.getGuildUser(m.players[1]).displayName,
                winner: m.winner ? Discord.getGuildUser(m.winner).displayName : "",
                score1: m.score ? m.score[0] : void 0,
                score2: m.score ? m.score[1] : void 0,
                home: m.homesPlayed.join("/"),
                round: m.round
            })) : void 0,
            standings: finals ? void 0 : Event.getStandings()
        }));
    }
});

tz.timezone.loadingScheme = tz.timezone.loadingSchemes.MANUAL_LOAD;
tz.timezone.loadZoneDataFromObject(tzData);

module.exports = Event;
