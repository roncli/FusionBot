const Db = require("node-database"),
    settings = require("./settings"),
    db = new Db(settings.database);

//  ####           #            #
//   #  #          #            #
//   #  #   ###   ####    ###   # ##    ###    ###    ###
//   #  #      #   #         #  ##  #      #  #      #   #
//   #  #   ####   #      ####  #   #   ####   ###   #####
//   #  #  #   #   #  #  #   #  ##  #  #   #      #  #
//  ####    ####    ##    ####  # ##    ####  ####    ###
/**
* Defines the database class.
*/
class Database {
    //          #     #  #  #
    //          #     #  #  #
    //  ###   ###   ###  ####   ##   # #    ##
    // #  #  #  #  #  #  #  #  #  #  ####  # ##
    // # ##  #  #  #  #  #  #  #  #  #  #  ##
    //  # #   ###   ###  #  #   ##   #  #   ##
    /**
     * Adds a home map for a player.
     * @param {string} discordId The player's Discord ID.
     * @param {string} home The home map to add.
     * @returns {Promise} A promise that resolves when the home map has been added.
     */
    static async addHome(discordId, home) {
        await db.query("INSERT INTO tblHome (DiscordID, Home) VALUES (@discordId, @home)", {
            discordId: {type: Db.VARCHAR(50), value: discordId},
            home: {type: Db.VARCHAR(50), value: home}
        });
    }

    //          #     #  ###                      ##     #
    //          #     #  #  #                      #     #
    //  ###   ###   ###  #  #   ##    ###   #  #   #    ###
    // #  #  #  #  #  #  ###   # ##  ##     #  #   #     #
    // # ##  #  #  #  #  # #   ##      ##   #  #   #     #
    //  # #   ###   ###  #  #   ##   ###     ###  ###     ##
    /**
     * Adds a match result to the database.
     * @param {number} eventId The event ID.
     * @param {string} map The map.
     * @param {number} round The round number.
     * @param {{discordId: string, score: number}[]} scores The scores for the result.
     * @returns {Promise} A promise that resolves when the result is added to the database.
     */
    static async addResult(eventId, map, round, scores) {
        const params = {
            eventId: {type: Db.INT, value: eventId},
            map: {type: Db.VARCHAR(200), value: map},
            round: {type: Db.INT, value: round}
        };

        scores.forEach((score, index) => {
            params[`score${index}`] = {type: Db.INT, value: score.score};
            params[`discordId${index}`] = {type: Db.VARCHAR(50), value: score.discordId};
        });

        await db.query(`
            DECLARE @MatchID INT

            INSERT INTO tblMatch (EventID, Map, Round) VALUES (@eventId, @map, @round)

            SET @MatchID = SCOPE_IDENTITY()

            ${scores.map((score, index) => `
                INSERT INTO tblScore (MatchID, PlayerID, Score)
                SELECT @MatchID, PlayerID, @score${index}
                FROM tblPlayer
                WHERE DiscordID = @discordId${index}
            `).join("\n")}
        `, params);
    }

    // #                 #
    // #                 #
    // ###    ###   ##   # #   #  #  ###
    // #  #  #  #  #     ##    #  #  #  #
    // #  #  # ##  #     # #   #  #  #  #
    // ###    # #   ##   #  #   ###  ###
    //                               #
    /**
     * Backs up the event data to the database.
     * @param {object[]} matches The matches.
     * @param {object[]} players The players.
     * @param {boolean} finals Whether the event is a Finals Tournament.
     * @param {number} round The current round number.
     * @param {string} eventName The name of the event.
     * @param {Date} eventDate The date of the event.
     * @param {number} eventId The ID of the event.
     * @param {number} season The season of the event.
     * @returns {Promise} A promise that resolves when the backup is complete.
     */
    static async backup(matches, players, finals, round, eventName, eventDate, eventId, season) {
        await db.query(`
            DELETE FROM tblBackup
            INSERT INTO tblBackup (Code) VALUES (@code)
        `, {
            code: {
                type: Db.TEXT,
                value: JSON.stringify({matches, players, finals, round, eventName, eventDate, eventId, season}, (key, value) => {
                    if (["channel", "voice", "results"].indexOf(key) !== -1) {
                        return value.id;
                    }

                    return value;
                })
            }
        });
    }

    //       ##                      ###               #
    //        #                      #  #              #
    //  ##    #     ##    ###  ###   ###    ###   ##   # #   #  #  ###
    // #      #    # ##  #  #  #  #  #  #  #  #  #     ##    #  #  #  #
    // #      #    ##    # ##  #     #  #  # ##  #     # #   #  #  #  #
    //  ##   ###    ##    # #  #     ###    # #   ##   #  #   ###  ###
    //                                                             #
    /**
     * Clears the current backup.
     * @returns {Promise} A promise that resolves when the backup is complete.
     */
    static async clearBackup() {
        await db.query("DELETE FROM tblBackup");
    }

    //                          #          ####                     #
    //                          #          #                        #
    //  ##   ###    ##    ###  ###    ##   ###   # #    ##   ###   ###
    // #     #  #  # ##  #  #   #    # ##  #     # #   # ##  #  #   #
    // #     #     ##    # ##   #    ##    #     # #   ##    #  #   #
    //  ##   #      ##    # #    ##   ##   ####   #     ##   #  #    ##
    /**
     * Creates an event.
     * @param {number} season The season number.
     * @param {string} eventName The name of the event.
     * @param {Date} date The date of the event.
     * @returns {Promise<number|void>} A promise that resolves with the event ID of the new event.
     */
    static async createEvent(season, eventName, date) {
        const data = await db.query(`
            INSERT INTO tblEvent(Season, Event, Date) VALUES (@season, @event, @date)

            SELECT SCOPE_IDENTITY() EventID
        `, {
            season: {type: Db.INT, value: season},
            event: {type: Db.VARCHAR(50), value: eventName},
            date: {type: Db.DATETIME, value: date}
        });
        return data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && data.recordsets[0][0].EventID || void 0;
    }

    //    #        ##           #          #  #                           ####              ###    #                                #  ###      #
    //    #         #           #          #  #                           #                 #  #                                    #   #       #
    //  ###   ##    #     ##   ###    ##   ####   ##   # #    ##    ###   ###    ##   ###   #  #  ##     ###    ##    ##   ###    ###   #     ###
    // #  #  # ##   #    # ##   #    # ##  #  #  #  #  ####  # ##  ##     #     #  #  #  #  #  #   #    ##     #     #  #  #  #  #  #   #    #  #
    // #  #  ##     #    ##     #    ##    #  #  #  #  #  #  ##      ##   #     #  #  #     #  #   #      ##   #     #  #  #     #  #   #    #  #
    //  ###   ##   ###    ##     ##   ##   #  #   ##   #  #   ##   ###    #      ##   #     ###   ###   ###     ##    ##   #      ###  ###    ###
    /**
     * Deletes a player's home maps from their Discord ID.
     * @param {string} discordId The player's Discord ID.
     * @returns {Promise} A promise that resolves when the home maps have been deleted.
     */
    static async deleteHomesForDiscordId(discordId) {
        await db.query("DELETE FROM tblHome WHERE DiscordID = @discordId", {discordId: {type: Db.VARCHAR(50), value: discordId}});
    }

    //              #    ###               #
    //              #    #  #              #
    //  ###   ##   ###   ###    ###   ##   # #   #  #  ###
    // #  #  # ##   #    #  #  #  #  #     ##    #  #  #  #
    //  ##   ##     #    #  #  # ##  #     # #   #  #  #  #
    // #      ##     ##  ###    # #   ##   #  #   ###  ###
    //  ###                                            #
    /**
     * Gets the current backup.
     * @returns {Promise<{matches: object[], players: object[], finals: boolean, round: number, eventName: string, eventDate: date, eventId: number, season: number}>} A promise that resolves with the current backup.
     */
    static async getBackup() {
        const data = await db.query("SELECT Code FROM tblBackup");
        return data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && data.recordsets[0][0].Code && JSON.parse(data.recordsets[0][0].Code) || void 0;
    }

    //              #     ##                                   ##    #                   #   #
    //              #    #  #                                 #  #   #                   #
    //  ###   ##   ###    #     ##    ###   ###    ##   ###    #    ###    ###  ###    ###  ##    ###    ###   ###
    // #  #  # ##   #      #   # ##  #  #  ##     #  #  #  #    #    #    #  #  #  #  #  #   #    #  #  #  #  ##
    //  ##   ##     #    #  #  ##    # ##    ##   #  #  #  #  #  #   #    # ##  #  #  #  #   #    #  #   ##     ##
    // #      ##     ##   ##    ##    # #  ###     ##   #  #   ##     ##   # #  #  #   ###  ###   #  #  #     ###
    //  ###                                                                                              ###
    /**
     * Gets a season's standings.
     * @param {number} season The season to get standings for.
     * @returns {Promise<{discordId: string, score: number}[]>} A promise that resolves with a season's standings.
     */
    static async getSeasonStandings(season) {
        const data = await db.query(`
            DECLARE @results TABLE (
                WinnerPlayerID INT NOT NULL,
                LoserPlayerID INT NOT NULL,
                EventID INT NOT NULL
            )

            DECLARE @standings TABLE (
                PlayerID INT NOT NULL,
                Score INT NOT NULL
            )

            INSERT INTO @results
            SELECT
                (SELECT TOP 1 PlayerID FROM tblScore WHERE MatchID = m.MatchID ORDER BY Score DESC),
                (SELECT TOP 1 PlayerID FROM tblScore WHERE MatchID = m.MatchID ORDER BY Score),
                (SELECT EventID FROM tblMatch WHERE MatchID = m.MatchID)
            FROM tblMatch m
            INNER JOIN tblEvent e ON m.EventID = e.EventID
            WHERE e.Season = @season
                AND e.Event LIKE '%Qualifier%'

            INSERT INTO @standings
            SELECT
                a.WinnerPlayerID,
                SUM(a.Score)
            FROM (
                SELECT
                    r.WinnerPlayerID,
                    3 + (SELECT COUNT(r2.WinnerPlayerID) Won FROM @results r2 WHERE r2.WinnerPlayerID = r.LoserPlayerId AND r2.EventID = r.EventID) Score
                FROM @results r
            ) a
            GROUP BY a.WinnerPlayerID

            INSERT INTO @standings
            SELECT LoserPlayerID, 0
            FROM @results
            WHERE LoserPlayerID NOT IN (SELECT PlayerID FROM @standings)

            SELECT p.DiscordID, s.Score
            FROM @standings s
            INNER JOIN tblPlayer p ON s.PlayerID = p.PlayerID
            ORDER BY s.Score DESC, p.Rating DESC
        `, {season: {type: Db.INT, value: season}});

        return data && data.recordsets && data.recordsets[0] && data.recordsets[0].map((row) => ({discordId: row.DiscordID, score: row.Score})) || [];
    }

    //              #    ####                     #     ##                      #    ####               ##
    //              #    #                        #    #  #                     #    #                 #  #
    //  ###   ##   ###   ###   # #    ##   ###   ###   #      ##   #  #  ###   ###   ###    ##   ###    #     ##    ###   ###    ##   ###
    // #  #  # ##   #    #     # #   # ##  #  #   #    #     #  #  #  #  #  #   #    #     #  #  #  #    #   # ##  #  #  ##     #  #  #  #
    //  ##   ##     #    #     # #   ##    #  #   #    #  #  #  #  #  #  #  #   #    #     #  #  #     #  #  ##    # ##    ##   #  #  #  #
    // #      ##     ##  ####   #     ##   #  #    ##   ##    ##    ###  #  #    ##  #      ##   #      ##    ##    # #  ###     ##   #  #
    //  ###
    /**
     * Gets the number of events for a season.
     * @param {number} season The season to get the event count for.
     * @returns {Promise<number>} A promise that resolves with the number of events in a season.
     */
    static async getEventCountForSeason(season) {
        const data = await db.query("SELECT COUNT(EventID) Events FROM tblEvent WHERE Season = @season", {season: {type: Db.INT, value: season}});
        return data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && data.recordsets[0][0].Events || 0;
    }

    //              #    #  #                     ##                      #    ####              ###    #                                #  ###      #
    //              #    #  #                    #  #                     #    #                 #  #                                    #   #       #
    //  ###   ##   ###   ####   ##   # #    ##   #      ##   #  #  ###   ###   ###    ##   ###   #  #  ##     ###    ##    ##   ###    ###   #     ###
    // #  #  # ##   #    #  #  #  #  ####  # ##  #     #  #  #  #  #  #   #    #     #  #  #  #  #  #   #    ##     #     #  #  #  #  #  #   #    #  #
    //  ##   ##     #    #  #  #  #  #  #  ##    #  #  #  #  #  #  #  #   #    #     #  #  #     #  #   #      ##   #     #  #  #     #  #   #    #  #
    // #      ##     ##  #  #   ##   #  #   ##    ##    ##    ###  #  #    ##  #      ##   #     ###   ###   ###     ##    ##   #      ###  ###    ###
    //  ###
    /**
     * Gets the number of home maps for a player from their Discord ID.
     * @param {string} discordId The player's DiscordID.
     * @returns {Promise<number>} The number of home maps the player has set.
     */
    static async getHomeCountForDiscordId(discordId) {
        const data = await db.query("SELECT COUNT(Home) Homes FROM tblHome WHERE DiscordID = @discordId", {discordId: {type: Db.VARCHAR(50), value: discordId}});
        return data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && data.recordsets[0][0].Homes || 0;
    }

    //              #    #  #                    #      #            #
    //              #    #  #                    #                   #
    //  ###   ##   ###   ####   ##   # #    ##   #     ##     ###   ###
    // #  #  # ##   #    #  #  #  #  ####  # ##  #      #    ##      #
    //  ##   ##     #    #  #  #  #  #  #  ##    #      #      ##    #
    // #      ##     ##  #  #   ##   #  #   ##   ####  ###   ###      ##
    //  ###
    /**
     * Gets the home map list for all players.
     * @returns {Promise<{DiscordID: string, Home: string}[]>} An array of maps containing all of the home maps for every player by their Discord ID.
     */
    static async getHomeList() {
        const data = await db.query("SELECT DiscordID, Home FROM tblHome");
        return data && data.recordsets && data.recordsets[0];
    }

    //              #    #  #                           ####              ###    #                                #  ###      #
    //              #    #  #                           #                 #  #                                    #   #       #
    //  ###   ##   ###   ####   ##   # #    ##    ###   ###    ##   ###   #  #  ##     ###    ##    ##   ###    ###   #     ###
    // #  #  # ##   #    #  #  #  #  ####  # ##  ##     #     #  #  #  #  #  #   #    ##     #     #  #  #  #  #  #   #    #  #
    //  ##   ##     #    #  #  #  #  #  #  ##      ##   #     #  #  #     #  #   #      ##   #     #  #  #     #  #   #    #  #
    // #      ##     ##  #  #   ##   #  #   ##   ###    #      ##   #     ###   ###   ###     ##    ##   #      ###  ###    ###
    //  ###
    /**
     * Gets the homes for a player from their Discord ID.
     * @param {string} discordId The player's Discord ID.
     * @returns {Promise<string[]>} The player's home maps.
     */
    static async getHomesForDiscordId(discordId) {
        const data = await db.query("SELECT Home FROM tblHome WHERE DiscordID = @discordId", {discordId: {type: Db.VARCHAR(50), value: discordId}});
        return data && data.recordsets && data.recordsets[0] && data.recordsets[0].map((row) => row.Home);
    }

    //              #    ###   ##
    //              #    #  #   #
    //  ###   ##   ###   #  #   #     ###  #  #   ##   ###    ###
    // #  #  # ##   #    ###    #    #  #  #  #  # ##  #  #  ##
    //  ##   ##     #    #      #    # ##   # #  ##    #       ##
    // #      ##     ##  #     ###    # #    #    ##   #     ###
    //  ###                                 #
    /**
     * Gets a list of all players and their ratings.
     * @returns {Promise<{PlayerID: number, Name: string, DiscordID: string, Rating: number, RatingDeviation: number, Volatility: number}[]>} An array of players containing their database ID, name, Discord ID, and rating details.
     */
    static async getPlayers() {
        const data = await db.query("SELECT PlayerID, Name, DiscordID, Rating, RatingDeviation, Volatility from tblPlayer");
        return data && data.recordsets && data.recordsets[0];
    }

    //              #    ###                       #     ##    #           #                 ####              ###    #                                #  ###      #
    //              #    #  #                      #    #  #   #           #                 #                 #  #                                    #   #       #
    //  ###   ##   ###   #  #   ##    ###    ##   ###    #    ###    ###  ###   #  #   ###   ###    ##   ###   #  #  ##     ###    ##    ##   ###    ###   #     ###
    // #  #  # ##   #    ###   # ##  ##     # ##   #      #    #    #  #   #    #  #  ##     #     #  #  #  #  #  #   #    ##     #     #  #  #  #  #  #   #    #  #
    //  ##   ##     #    # #   ##      ##   ##     #    #  #   #    # ##   #    #  #    ##   #     #  #  #     #  #   #      ##   #     #  #  #     #  #   #    #  #
    // #      ##     ##  #  #   ##   ###     ##     ##   ##     ##   # #    ##   ###  ###    #      ##   #     ###   ###   ###     ##    ##   #      ###  ###    ###
    //  ###
    /**
     * Retrieves a player's home map reset status from their Discord ID.
     * @param {string} discordId The player's Discord ID.
     * @returns {Promise<{hasHomes: boolean, locked: boolean}>} An object that contains the player's home map reset status.  hasHomes returns whether the player has home maps defined, and locked returns whether the player's home maps are locked.
     */
    static async getResetStatusForDiscordId(discordId) {
        const data = await db.query("SELECT TOP 1 Locked FROM tblHome WHERE DiscordID = @discordId ORDER BY Locked DESC", {discordId: {type: Db.VARCHAR(50), value: discordId}});
        return {
            hasHomes: data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && true,
            locked: data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && data.recordsets[0][0].Locked
        };
    }

    // ##                #     #  #                    #  #                     ####              ###    #                                #  ###      #
    //  #                #     #  #                    ####                     #                 #  #                                    #   #       #
    //  #     ##    ##   # #   ####   ##   # #    ##   ####   ###  ###    ###   ###    ##   ###   #  #  ##     ###    ##    ##   ###    ###   #     ###   ###
    //  #    #  #  #     ##    #  #  #  #  ####  # ##  #  #  #  #  #  #  ##     #     #  #  #  #  #  #   #    ##     #     #  #  #  #  #  #   #    #  #  ##
    //  #    #  #  #     # #   #  #  #  #  #  #  ##    #  #  # ##  #  #    ##   #     #  #  #     #  #   #      ##   #     #  #  #     #  #   #    #  #    ##
    // ###    ##    ##   #  #  #  #   ##   #  #   ##   #  #   # #  ###   ###    #      ##   #     ###   ###   ###     ##    ##   #      ###  ###    ###  ###
    //                                                             #
    /**
     * Locks players' home maps from their Discord IDs.
     * @param {string[]} discordIds An array of the players' Discord IDs.
     * @return {Promise} A promise that resolves when the players' home maps have been locked.
     */
    static async lockHomeMapsForDiscordIds(discordIds) {
        const players = discordIds.map((discordId, index) => ({index: `player${index}`, atIndex: `@player${index}`, discordId}));

        await db.query(`UPDATE tblHome SET Locked = 1 WHERE DiscordID IN (${players.map((p) => p.atIndex).join(", ")})`, players.reduce((accumulator, player) => {
            accumulator[player.index] = {type: Db.VARCHAR(50), value: player.discordId};
            return accumulator;
        }, {}));
    }

    //                #         #          ###   ##                            ###          #     #
    //                #         #          #  #   #                            #  #         #
    // #  #  ###    ###   ###  ###    ##   #  #   #     ###  #  #   ##   ###   #  #   ###  ###   ##    ###    ###
    // #  #  #  #  #  #  #  #   #    # ##  ###    #    #  #  #  #  # ##  #  #  ###   #  #   #     #    #  #  #  #
    // #  #  #  #  #  #  # ##   #    ##    #      #    # ##   # #  ##    #     # #   # ##   #     #    #  #   ##
    //  ###  ###    ###   # #    ##   ##   #     ###    # #    #    ##   #     #  #   # #    ##  ###   #  #  #
    //       #                                                #                                               ###
    /**
     * Updates a player's rating.
     * @param {string} name The name of the player.
     * @param {string} discordId The DiscordID of the player.
     * @param {number} rating The player's rating.
     * @param {number} ratingDeviation The player's rating deviation.
     * @param {number} volatility The volatility of the player's rating.
     * @param {number} [playerId] The player's database ID.  Leave undefined if this is a new player.
     * @returns {Promise} A promise that resolves when the player's rating has been updated.
     */
    static async updatePlayerRating(name, discordId, rating, ratingDeviation, volatility, playerId) {
        await db.query(`
            MERGE tblPlayer p
                USING (VALUES (@name, @discordID, @rating, @ratingDeviation, @volatility)) AS v (Name, DiscordID, Rating, RatingDeviation, Volatility)
                ON p.PlayerID = @playerID
            WHEN MATCHED THEN
                UPDATE SET Name = v.Name, DiscordID = v.DiscordID, Rating = v.Rating, RatingDeviation = v.RatingDeviation, Volatility = v.Volatility
            WHEN NOT MATCHED THEN
                INSERT (Name, DiscordID, Rating, RatingDeviation, Volatility) VALUES (v.Name, v.DiscordID, v.Rating, v.RatingDeviation, v.Volatility);
        `, {
            name: {type: Db.VARCHAR(50), value: name},
            discordId: {type: Db.VARCHAR(50), value: discordId},
            rating: {type: Db.FLOAT, value: rating},
            ratingDeviation: {type: Db.FLOAT, value: ratingDeviation},
            volatility: {type: Db.FLOAT, value: volatility},
            playerId: {type: Db.INT, value: playerId || -1}
        });
    }
}

module.exports = Database;
