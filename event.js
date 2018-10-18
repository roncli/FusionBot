const glicko2 = require("glicko2"),
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

let eventId,
    joinable = true,
    ratedPlayers,
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

    //              #    ###          #             #  ###   ##
    //              #    #  #         #             #  #  #   #
    //  ###   ##   ###   #  #   ###  ###    ##    ###  #  #   #     ###  #  #   ##   ###
    // #  #  # ##   #    ###   #  #   #    # ##  #  #  ###    #    #  #  #  #  # ##  #  #
    //  ##   ##     #    # #   # ##   #    ##    #  #  #      #    # ##   # #  ##    #
    // #      ##     ##  #  #   # #    ##   ##    ###  #     ###    # #    #    ##   #
    //  ###                                                               #
    /**
     * Returns a rated player from their Discord user ID.
     * @param {string} userId The Discord user ID.
     * @returns {Promise<object>} A promise that resolves with the rated player object.
     */
    static async getRatedPlayer(userId) {
        if (!ratedPlayers) {
            try {
                ratedPlayers = await Db.getPlayers();
            } catch (err) {
                throw new Exception("There was a database error getting the list of rated players.", err);
            }
        }

        return ratedPlayers.find((p) => p.DiscordID === userId);
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

        const player1 = Discord.getGuildUser(match.players[0]),
            player2 = Discord.getGuildUser(match.players[1]);

        await Discord.richQueue({
            embed: {
                title: `${player1.displayName} vs ${player2.displayName}`,
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
                player1: player1.displayName,
                player2: player2.displayName,
                home: match.homeSelected,
                round: match.round
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
                    footer: {icon_url: Discord.icon, text: "DescentBot"},
                    fields: []
                }
            };

        if (match.round) {
            embed.embed.fields.push({
                name: "Round",
                value: match.round
            });
        }

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

        embed.embed.fields.push({
            name: "Map",
            value: match.homeSelected,
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

        try {
            await Db.addResult(eventId, match.homeSelected, match.round, [{discordId: player1.id, score: match.score[0]}, {discordId: player2.id, score: match.score[0]}].sort((a, b) => b.score - a.score));
        } catch (err) {
            throw new Exception("There was a database error saving the result to the database.", err);
        }

        match.winner = winner;
        match.score = score;
        delete match.reported;

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
        const player1 = Discord.getGuildUser(match.winner),
            player2 = Discord.getGuildUser(match.players.find((p) => p !== match.winner));

        Discord.removePermissions(player1, match.channel);
        Discord.removePermissions(player2, match.channel);
        Discord.removeChannel(match.voice);
        delete match.channel;
        delete match.voice;

        Discord.addSeasonRole(player1);
        Discord.addSeasonRole(player2);
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

        match.results.edit("", Event.getResultEmbed(match));
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

        matches.filter((m) => m.winner).forEach((match) => {
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
        return Db.backup(matches, players, joinable, round);
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
     * @param {int} season The season number for the event.
     * @param {string} eventName The name of the event.
     * @param {string} time The time the event should be run.
     * @returns {Promise} A promise that resolves when a joinable event is open.
     */
    static async openEvent(season, eventName, time) {
        try {
            ratedPlayers = await Db.getPlayers();
        } catch (err) {
            throw new Exception("There was a database error getting the list of rated players.", err);
        }

        try {
            eventId = await Db.createEvent(season, eventName, time);
        } catch (err) {
            throw new Exception("There was a database error creating the event.", err);
        }

        joinable = true;
        matches.splice(0, matches.length);
        players.splice(0, players.length);
        round = 0;
        running = true;

        Event.backupInterval = setInterval(Event.backup, 300000);
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
    static generateRound() {
        try {
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
                throw new Error("Pairings didn't work out.");
            }

            round++;

            wss.broadcast({round});

            // Set home maps.
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
    static endEvent() {
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

            ({joinable, round} = backup);

            backup.matches.forEach(async (match) => {
                if (match.channel) {
                    match.channel = Discord.findChannelById(match.channel);
                }

                if (match.voice) {
                    match.voice = Discord.findChannelById(match.voice);
                }

                if (match.results) {
                    match.results = await Discord.resultsChannel.fetchMessage(match.results);
                }

                matches.push(match);
            });

            backup.players.forEach((player) => {
                players.push(player);
            });

            running = true;

            wss.broadcast({
                round,
                matches: matches.map((m) => ({
                    player1: Discord.getGuildUser(m.players[0]).displayName,
                    player2: Discord.getGuildUser(m.players[1]).displayName,
                    winner: m.winner ? Discord.getGuildUser(m.winner).displayName : "",
                    score1: m.score ? m.score[0] : void 0,
                    score2: m.score ? m.score[1] : void 0,
                    homes: m.homeSelected ? void 0 : Event.getPlayer(m.players[0]).homes,
                    home: m.homeSelected,
                    round: m.round
                })),
                standings: Event.getStandings()
            });

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

    if (running) {
        ws.send(JSON.stringify({
            round,
            matches: matches.map((m) => ({
                player1: Discord.getGuildUser(m.players[0]).displayName,
                player2: Discord.getGuildUser(m.players[1]).displayName,
                winner: m.winner ? Discord.getGuildUser(m.winner).displayName : "",
                score1: m.score ? m.score[0] : void 0,
                score2: m.score ? m.score[1] : void 0,
                homes: m.homeSelected ? void 0 : Event.getPlayer(m.players[0]).homes,
                home: m.homeSelected,
                round: m.round
            })),
            standings: Event.getStandings()
        }));
    }
});

module.exports = Event;
