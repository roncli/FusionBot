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

let eventDate,
    eventName,
    eventId,
    finals = false,
    ratedPlayers,
    round = 0,
    running = false,
    season;

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
        return Db.backup(matches, players, finals, round, eventName, eventDate, eventId, season);
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
     * @param {int} seasonNumber The season number for the event.
     * @param {string} event The name of the event.
     * @param {Date} date The date the event should be run.
     * @returns {Promise} A promise that resolves when a Swiss tournament event is open.
     */
    static async openEvent(seasonNumber, event, date) {
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
     * @returns {Promise<{discordId: string, score: int}[]>} A promise that resolves with the players who have made the Finals Tournament.
     */
    static async openFinals(seasonNumber, event, date) {
        let eventCount;
        try {
            eventCount = await Db.getEventCountForSeason(seasonNumber);
        } catch (err) {
            throw new Exception("There was a database error getting the count of the number of events for the current season.", err);
        }

        if (eventCount !== 3) {
            throw new Error("Three qualifiers have not been played yet.");
        }

        let seasonPlayers;
        try {
            seasonPlayers = await Db.getSeasonStandings(seasonNumber);
        } catch (err) {
            throw new Exception("There was a database error getting the season standings.", err);
        }

        while (seasonPlayers.length > 12 && seasonPlayers[11].score !== seasonPlayers[seasonPlayers.length - 1].score) {
            seasonPlayers.pop();
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

        const warningDate = new Date(new Date().toDateString());

        warningDate.setDate(warningDate.getDate() + (5 - warningDate.getDay()));
        if (warningDate < new Date()) {
            warningDate.setDate(warningDate.getDate() + 7);
        }

        // TODO: Set timeout when restoring from backup if necessary.
        Event.warningTimeout = setTimeout(Event.warning, warningDate.getTime() - new Date().getTime());

        try {
            for (const index of seasonPlayers.keys()) {
                const player = seasonPlayers[index];

                players.push({
                    id: player.discordId,
                    canHost: true,
                    status: "waiting",
                    score: player.score,
                    seed: index + 1,
                    homes: await Db.getHomesForDiscordId(player.discordId)
                });
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
                            await Discord.queue(`Reminder: You have earned a spot in the ${eventName} wildcard anarchy!  This event will take place ${eventDate.toLocaleDateString("en-us", {timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "long", day: "numeric", hour12: true, hour: "2-digit", minute: "2-digit", timeZoneName: "short"})}.  If you can attend, please reply with \`!accept\`.  If you cannot, please reply with \`!decline\`  Also, if you are able to join the event, please pick a map you'd like to play for the wildcard anarchy, which will be picked at random from all participants, using the \`!anarchymap\` command.  Please contact roncli if you have any questions regarding the event.`, user);
                            break;
                        case "standby":
                            await Discord.queue(`Reminder: You are on standby for the ${eventName}!  This event will take place ${eventDate.toLocaleDateString("en-us", {timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "long", day: "numeric", hour12: true, hour: "2-digit", minute: "2-digit", timeZoneName: "short"})}.  If you can attend, please reply with \`!accept\`.  If you cannot, please reply with \`!decline\`  Also, if you are able to join the event, please pick a map you'd like to play for the wildcard anarchy, which will be picked at random from all participants, using the \`!anarchymap\` command.  You will be informed when the event starts if your presence will be needed.  Please contact roncli if you have any questions regarding the event.`, user);
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

                if (players.filter((p) => p.id === player.discordId)) {
                    continue;
                }

                players.push({
                    id: player.discordId,
                    canHost: true,
                    status: "waiting",
                    type: "standby",
                    score: player.score,
                    seed: index + 1,
                    homes: await Db.getHomesForDiscordId(player.discordId)
                });

                const user = Discord.getGuildUser(player.discordId);

                await Discord.queue(`${user}, you are on last minute standby for the ${eventName}!  This event will take place ${eventDate.toLocaleDateString("en-us", {timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "long", day: "numeric", hour12: true, hour: "2-digit", minute: "2-digit", timeZoneName: "short"})}.  If you can attend, please reply with \`!accept\`.  If you cannot, please reply with \`!decline\`  Also, if you are able to join the event, please pick a map you'd like to play for the wildcard anarchy, which will be picked at random from all participants, using the \`!anarchymap\` command.  You will be informed when the event starts if your presence will be needed.  Please contact roncli if you have any questions regarding the event.`, user);
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

        // Reseed participants.
        players.forEach((player, index) => {
            player.seed = index + 1;
        });

        // TODO: Setup Current Event role.

        // Determine the tournament format and setup the next round.
        if (players.length > 6) {
            await Event.setupFinalsWildcard();
        } else {
            await Event.setupFinalsRound();
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
                const guildUser = Discord.getGuildUser(player.discordId);

                await Discord.queue(`Sorry, ${guildUser}, but the Finals Tournament has enough players entered into it, and you will not be needed to participate today.  However, we would like to thank you for remaining on standby!`, guildUser);
                player.status = "eliminated";
            }
        }

        // Determine who is in the wildcard.
        players.filter((p) => (p.seed > 4 || p.score === players[4].score) && p.status !== "eliminated").forEach((player) => {
            player.status = "wildcard";
        });

        // Ensure all players have an anarchy map picked.
        for (const player of players.filter((p) => p.status === "wildcard" && !p.anarchyMap)) {
            const guildUser = Discord.getGuildUser(player.discordId);

            await Discord.queue(`${guildUser}, we are about to start the event, and we need an anarchy map from you right now!  Please pick a map you'd like to play for the wildcard anarchy, which will be picked at random from all participants, using the \`!anarchymap\` command.`, guildUser);
            await Discord.queue(`${guildUser.displayName} has yet to select a map for the Wildcard Anarchy.`, Discord.alertsChannel);
        }

        if (players.find((p) => p.status === "wildcard" && !p.anarchyMap)) {
            return;
        }

        Event.generateFinalsWildcard();
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
            wildcardPlayers = players.filter((p) => p.status === "wildcard");

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
                homeSelected: wildcardPlayers.map((p) => p.anarchyMap)[Math.floor(Math.random() * wildcardPlayers.length)],
                round,
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
                            value: `The map has been randomly selected to be **${match.homeSelected}** with **x${Math.ceil(wildcardPlayers.length / 2)} Primaries**.`
                        },
                        {
                            name: "Goals",
                            value: `· The kill goal of the match is **${wildcardPlayers * 10}**.\n· The top **${spotsRequired}** players will advance to the next round.`
                        },
                        {
                            name: "Reminders",
                            value: "· Make sure your match is set to either Restricted or Closed.\n· Set your game for at least 4 observers.\n· Do not move when the game begins, ensure everyone is ready first.\n· The game will be reported by an admin upon completion."
                        }
                    ]
                }
            }, match.channel);

            wss.broadcast({
                finalsMatch: {
                    players: wildcardPlayers.map((player) => {
                        const guildUser = Discord.getGuildUser(player.id);

                        return {seed: player.seed, name: guildUser.displayName};
                    }),
                    home: match.homeSelected,
                    round: match.round
                }
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
                homeSelected: matchPlayers.map((p) => p.anarchyMap)[Math.floor(Math.random() * matchPlayers.length)],
                round,
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
                                value: `The map has been randomly selected to be **${match.homeSelected}** with **x${Math.ceil(matchPlayers.length / 2)} Primaries**.`
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
                finalsMatch: {
                    players: matchPlayers.map((player) => {
                        const guildUser = Discord.getGuildUser(player.id);

                        return {seed: player.seed, name: guildUser.displayName};
                    }),
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
        const roundPlayers = players.filter((p) => p.status === "knockout");

        round++;

        switch (roundPlayers.length) {
            case 2:
                await Event.generateFinalsRound([roundPlayers[0], roundPlayers[1]]);
                break;
            case 3:
                await Event.generateFinalsRound([roundPlayers[1], roundPlayers[2]]);
                break;
            case 4:
                await Event.setupFinalsOpponentSelection(roundPlayers[0], [roundPlayers[2], roundPlayers[3]]);
                break;
            case 5:
                await Event.generateFinalsRound([roundPlayers[3], roundPlayers[4]]);
                break;
            case 6:
                await Event.setupFinalsOpponentSelection(roundPlayers[2], [roundPlayers[4], roundPlayers[5]]);
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
        const roundPlayers = players.filter((p) => p.status === "knockout");
        let textChannel, voiceChannel;

        try {
            textChannel = await Discord.createTextChannel(roundPlayers === 4 ? "semifinals-1" : "quarterfinals-1", Discord.pilotsChatCategory);
            voiceChannel = await Discord.createVoiceChannel(roundPlayers === 4 ? "Semifinals 1" : "Quarterfinals 1", Discord.pilotsVoiceChatCategory);
        } catch (err) {
            throw new Exception("There was an error setting up a Wildcard Anarchy match.", err);
        }

        const match = {
            players: [player.id],
            opponents: opponents.map((o) => o.id),
            channel: textChannel,
            voice: voiceChannel,
            round
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
                title: `${roundPlayers === 4 ? "Semifinals" : "Quarterfinals"} - Select your opponent`,
                description: "As the higher seed in the tournament, you have get to choose who you want your next opponent to be.",
                timestamp: new Date(),
                color: 0x263686,
                footer: {icon_url: Discord.icon, text: "DescentBot"},
                fields: [
                    {
                        name: "Opponent Selection",
                        value: `${guildUser}, please choose from the following opponents:\n${opponents.map((o, index) => `\`!select ${index}\` - ${Discord.getGuildUser(o.id)}`).join("\n")}`
                    }
                ]
            }
        }, match.channel);
    }

    //                                      #          ####   #                ##           ###                        #
    //                                      #          #                        #           #  #                       #
    //  ###   ##   ###    ##   ###    ###  ###    ##   ###   ##    ###    ###   #     ###   #  #   ##   #  #  ###    ###
    // #  #  # ##  #  #  # ##  #  #  #  #   #    # ##  #      #    #  #  #  #   #    ##     ###   #  #  #  #  #  #  #  #
    //  ##   ##    #  #  ##    #     # ##   #    ##    #      #    #  #  # ##   #      ##   # #   #  #  #  #  #  #  #  #
    // #      ##   #  #   ##   #      # #    ##   ##   #     ###   #  #   # #  ###   ###    #  #   ##    ###  #  #   ###
    //  ###
    /**
     * Generates a finals round where there is only one possible match.
     * @param {object} player1 The first player.
     * @param {object} player2 The second player.
     * @returns {Promise} A promise that resolves when the finals round is setup.
     */
    static async generateFinalsRound(player1, player2) {
        // TODO
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

            ({finals, round, eventName, eventDate, eventId, season} = backup);

            backup.matches.forEach(async (match) => {
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
