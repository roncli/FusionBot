const glicko2 = require("glicko2"),
    WebSocket = require("ws"),

    Db = require("./database"),
    Discord = require("./discord"),
    Exception = require("./exception"),
    Log = require("./log"),

    matches = [],
    players = [],
    ranking = new glicko2.Glicko2({
        tau: 0.75,
        rating: 1500,
        rd: 200,
        vol: 0.06
    }),
    wss = new WebSocket.Server({port: 42423});

let joinable = true,
    round = 0,
    running = false;

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

    //  #              #         #                #     ##
    //                 #                          #      #
    // ##     ###      #   ##   ##    ###    ###  ###    #     ##
    //  #    ##        #  #  #   #    #  #  #  #  #  #   #    # ##
    //  #      ##   #  #  #  #   #    #  #  # ##  #  #   #    ##
    // ###   ###     ##    ##   ###   #  #   # #  ###   ###    ##
    /**
     * Whether an event is joinable.
     * @returns {bool} Whether an event is joinable.
     */
    static get isJoinable() {
        return joinable;
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

    //          #     #  ###   ##
    //          #     #  #  #   #
    //  ###   ###   ###  #  #   #     ###  #  #   ##   ###
    // #  #  #  #  #  #  ###    #    #  #  #  #  # ##  #  #
    // # ##  #  #  #  #  #      #    # ##   # #  ##    #
    //  # #   ###   ###  #     ###    # #    #    ##   #
    //                                      #
    /**
     * Adds a player and their home levels to the event.
     * @param {string} userId The Discord user ID.
     * @param {string[]} homes An array of home levels.
     * @returns {void}
     */
    static addPlayer(userId, homes) {
        players.push({
            id: userId,
            canHost: true
        });

        Event.setHomes(userId, homes);
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
     * @returns {void}
     */
    static removePlayer(userId) {
        const player = Event.getPlayer(userId);

        if (!player) {
            return;
        }

        player.withdrawn = true;

        Discord.removeEventRole(Discord.getGuildUser(userId));
    }

    //               #    #  #
    //               #    #  #
    //  ###    ##   ###   ####   ##   # #    ##    ###
    // ##     # ##   #    #  #  #  #  ####  # ##  ##
    //   ##   ##     #    #  #  #  #  #  #  ##      ##
    // ###     ##     ##  #  #   ##   #  #   ##   ###
    /**
     * Sets a player's home levels.
     * @param {string} userId The Discord user ID.
     * @param {string[]} homes An array of home levels.
     * @returns {void}
     */
    static setHomes(userId, homes) {
        Event.getPlayer(userId).homes = homes;

        wss.broadcast({
            type: "addplayer",
            match: {player: Discord.getGuildUser(userId).displayName}
        });
    }

    //               #    #  #         #          #     #  #
    //               #    ####         #          #     #  #
    //  ###    ##   ###   ####   ###  ###    ##   ###   ####   ##   # #    ##
    // ##     # ##   #    #  #  #  #   #    #     #  #  #  #  #  #  ####  # ##
    //   ##   ##     #    #  #  # ##   #    #     #  #  #  #  #  #  #  #  ##
    // ###     ##     ##  #  #   # #    ##   ##   #  #  #  #   ##   #  #   ##
    /**
     * Sets a home level for a match.
     * @param {object} match The match object.
     * @param {number} index The index of the home player's home level that was selected.
     * @returns {Promise} A promise that resolves when the home levels for a match are set.
     */
    static async setMatchHome(match, index) {
        match.homeSelected = match.homes[index];

        const player1 = Discord.getGuildUser(match.players[0]),
            player2 = Discord.getGuildUser(match.players[1]);

        await Discord.richQueue({
            embed: {
                title: `${player1} vs ${player2}`,
                description: "Please begin your match!",
                timestamp: new Date(),
                color: 0x263686,
                footer: {icon_url: Discord.icon},
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
            type: "match",
            match: {
                player1: player1.displayName,
                player2: player2.displayName,
                home: match.homeSelected
            }
        });
    }

    //              #     ##                                  #    #  #         #          #
    //              #    #  #                                 #    ####         #          #
    //  ###   ##   ###   #     #  #  ###   ###    ##   ###   ###   ####   ###  ###    ##   ###
    // #  #  # ##   #    #     #  #  #  #  #  #  # ##  #  #   #    #  #  #  #   #    #     #  #
    //  ##   ##     #    #  #  #  #  #     #     ##    #  #   #    #  #  # ##   #    #     #  #
    // #      ##     ##   ##    ###  #     #      ##   #  #    ##  #  #   # #    ##   ##   #  #
    //  ###
    /**
     * Gets the current match for a player.
     * @param {string} userId The Discord user ID.
     * @returns {object} The match object.
     */
    static getCurrentMatch(userId) {
        return matches.find((m) => !m.cancelled && m.players.indexOf(userId) !== -1 && !m.winner);
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
        const player1 = Discord.getGuildUser(match.winner),
            player2 = Discord.getGuildUser(match.players.find((p) => p !== match.winner)),
            embed = {
                embed: {
                    timestamp: new Date(),
                    color: 0x263686,
                    footer: {icon_url: Discord.icon},
                    description: match.homeSelected,
                    fields: [
                        {
                            name: player1.displayName,
                            value: match.score[0],
                            inline: true
                        },
                        {
                            name: player2.displayName,
                            value: match.score[1],
                            inline: true
                        }
                    ]
                }
            };

        if (match.comments) {
            Object.keys(match.comments).forEach((id) => {
                embed.embed.fields.push({
                    name: Discord.getGuildUser(id).displayName,
                    value: match.comments[id]
                });
            });
        }

        return embed;
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
    static async postResult(match) {
        const player1 = Discord.getGuildUser(match.winner),
            player2 = Discord.getGuildUser(match.players.find((p) => p !== match.winner));

        Discord.removePermissions(player1, match.channel);
        Discord.removePermissions(player2, match.channel);
        Discord.removeChannel(match.voice);
        delete match.channel;
        delete match.voice;

        Discord.addSeasonRole(player1);
        Discord.addSeasonRole(player2);

        const message = await Discord.richQueue(Event.getResultEmbed(match), Discord.resultsChannel);

        match.results = message;

        wss.broadcast({
            type: "results",
            match: {
                player1: player1.displayName,
                player2: player2.displayName,
                score1: match.score[0],
                score2: match.score[1],
                home: match.homeSelected
            }
        });
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
     * @returns {void}
     */
    static updateResult(match) {
        if (!match.results) {
            return;
        }

        match.results.edit("", Event.getResultEmbed(match), Discord.resultsChannel);
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
        const standings = {};

        players.forEach((player) => {
            const id = player.id;

            standings[id] = {
                name: Discord.getGuildUser(id).displayName,
                wins: 0,
                losses: 0,
                score: 0,
                defeated: []
            };
        });

        matches.filter((m) => m.winner).forEach((match) => {
            match.players.forEach((id) => {
                if (match.winner === id) {
                    standings[id].wins++;
                } else {
                    standings[id].losses++;
                    standings[match.winner].defeated.push(id);
                }
            });
        });

        standings.forEach((player) => {
            player.score = player.wins * 3 + player.defeated.reduce((accumulator, currentValue) => accumulator + standings[currentValue].wins);
        });
console.log(standings);
        return standings.sort((a, b) => b.score + b.wins / 100 - b.losses / 10000 - (a.score + a.wins / 100 - a.losses / 10000));
    }

    //                         ####                     #
    //                         #                        #
    //  ##   ###    ##   ###   ###   # #    ##   ###   ###
    // #  #  #  #  # ##  #  #  #     # #   # ##  #  #   #
    // #  #  #  #  ##    #  #  #     # #   ##    #  #   #
    //  ##   ###    ##   #  #  ####   #     ##   #  #    ##
    //       #
    /**
     * Opens a new joinable event.
     * @returns {void}
     */
    static openEvent() {
        joinable = true;
        matches.length = 0;
        players.length = 0;
        round = 0;
        running = true;
    }

    //         #                 #    ####                     #
    //         #                 #    #                        #
    //  ###   ###    ###  ###   ###   ###   # #    ##   ###   ###
    // ##      #    #  #  #  #   #    #     # #   # ##  #  #   #
    //   ##    #    # ##  #      #    #     # #   ##    #  #   #
    // ###      ##   # #  #       ##  ####   #     ##   #  #    ##
    /**
     * Starts a new non-joinable event.
     * @returns {void}
     */
    static startEvent() {
        joinable = false;
        matches.length = 0;
        players.length = 0;
        round = 0;
        running = true;
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
            const index = Math.floor(potentialOpponents.length / Math.pow(2, round + 1));

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
     * @returns {Promise<object[]>} The potential matches for the round.
     */
    static async generateRound() {
        try {
            const ratedPlayers = await Db.getPlayers();
            const potentialMatches = [];

            if (!Event.matchPlayers(
                players.filter((player) => !player.withdrawn).map((id) => ({
                    id,
                    eventPlayer: players[id],
                    ratedPlayer: ratedPlayers.find((p) => p.DiscordID === id) || {
                        Name: Discord.getGuildUser(id) ? Discord.getGuildUser(id).displayName : `<@${id}>`,
                        DiscordID: id,
                        Rating: 1500,
                        RatingDeviation: 200,
                        Volatility: 0.06
                    },
                    points: matches.filter((m) => !m.cancelled && m.winner === id).length - (matches.filter((m) => !m.cancelled && m.players.indexOf(id) !== -1).length - matches.filter((m) => !m.cancelled && m.winner === id).length),
                    matches: matches.filter((m) => !m.cancelled && m.players.indexOf(id) !== -1).length
                })).sort((a, b) => b.points - a.points || b.ratedPlayer.Rating - a.ratedPlayer.Rating || b.matches - a.matches || (Math.random() < 0.5 ? 1 : -1)),
                potentialMatches
            )) {
                throw new Error("Pairings didn't work out.");
            }

            round++;

            // Set home levels.
            potentialMatches.forEach((match) => {
                match.sort((a, b) => matches.filter((m) => !m.cancelled && m.home === a).length - matches.filter((m) => !m.cancelled && m.home === b).length || matches.filter((m) => !m.cancelled && m.players.indexOf(b) !== -1 && m.home !== b).length - matches.filter((m) => !m.cancelled && m.players.indexOf(a) !== -1 && m.home !== a).length || (Math.random() < 0.5 ? 1 : -1));
            });

            return potentialMatches;
        } catch (err) {
            throw new Exception("There was a database error getting the list of rated players.", err);
        }
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
            textChannel = await Discord.createTextChannel(channelName.toLowerCase().replace(/[^\-a-z0-9]/g, ""), Discord.gamesCategory);
            voiceChannel = await Discord.createVoiceChannel(channelName, Discord.gamesCategory);
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
        Discord.removePermissions(Discord.findRoleById(Discord.guildId), match.channel);
        Discord.addTextPermissions(player1, match.channel);
        Discord.addTextPermissions(player2, match.channel);
        Discord.removePermissions(Discord.findRoleById(Discord.guildId), match.voice);
        Discord.addVoicePermissions(player1, match.voice);
        Discord.addVoicePermissions(player2, match.voice);

        match.homes = Event.getPlayer(player1.id).homes;

        // Announce match
        await Discord.queue(`${player1.displayName} vs ${player2.displayName}`);
        await Discord.richQueue({
            embed: {
                title: `${player1} vs ${player2}`,
                description: `The voice channel **${channelName}** has been setup for you to use for this match!`,
                timestamp: new Date(),
                color: 0x263686,
                footer: {icon_url: Discord.icon},
                fields: [
                    {
                        name: "Map Selection",
                        value: `${player2}, please choose from the following three home maps:\n\`!choose a\` - ${match.homes[0]}\n\`!choose b\` - ${match.homes[1]}\n\`!choose c\` - ${match.homes[2]}`
                    }
                ]
            }
        }, match.channel);

        Db.lockHomeLevelsForDiscordIds([player1.id, player2.id]).catch((err) => {
            Log.exception(`There was a non-critical database error locking the home maps for ${player1.displayName} and ${player2.displayName}.`, err);
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
        let ratedPlayers;
        try {
            ratedPlayers = await Db.getPlayers();
        } catch (err) {
            throw new Exception("There was a database error getting the list of rated players.", err);
        }

        // Add new ratings for players that haven't played yet.
        players.forEach((player) => {
            if (ratedPlayers.filter((p) => p.DiscordID === player.id).length === 0) {
                ratedPlayers.push({
                    DiscordID: player.id,
                    Rating: 1500,
                    RatingDeviation: 200,
                    Volatility: 0.06
                });
            }
        });

        // Update Discord name, and create the glicko ranking for each player.
        ratedPlayers.forEach((player) => {
            const user = Discord.getGuildUser(player.DiscordID);

            if (user) {
                player.Name = user.displayName;
                Discord.removeEventRole(user);
            }

            player.glicko = ranking.makePlayer(player.Rating, player.RatingDeviation, player.Volatility);
        });

        // Update ratings.
        ranking.updateRatings(matches.filter((m) => !m.cancelled && m.winner).map((match) => [ratedPlayers.find((p) => p.DiscordID === match.players[0]).glicko, ratedPlayers.find((p) => p.DiscordID === match.players[1]).glicko, match.players[0] === match.winner ? 1 : 0]));

        // Update ratings on object.
        ratedPlayers.forEach((player) => {
            player.Rating = player.glicko.getRating();
            player.RatingDeviation = player.glicko.getRd();
            player.Volatility = player.glicko.getVol();
        });

        // Update the database with the ratings.
        ratedPlayers.forEach(async (player) => {
            await Db.updatePlayerRating(player.Name, player.DiscordID, player.Rating, player.RatingDeviation, player.Volatility, player.PlayerID);
        });

        running = false;
        matches.splice(0, matches.length);
        players.splice(0, players.length);
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
                    players: Event.getStandings()
                }));
                break;
            case "results":
                ws.send(JSON.stringify({
                    type: "results",
                    matches: matches.filter((m) => m.winner).map((match) => ({
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
});

module.exports = Event;
