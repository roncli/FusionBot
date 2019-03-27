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
    //          #     #  ###                              #  #  #
    //          #     #  #  #                             #  #  #
    //  ###   ###   ###  ###    ###  ###   ###    ##    ###  ####   ##   # #    ##
    // #  #  #  #  #  #  #  #  #  #  #  #  #  #  # ##  #  #  #  #  #  #  ####  # ##
    // # ##  #  #  #  #  #  #  # ##  #  #  #  #  ##    #  #  #  #  #  #  #  #  ##
    //  # #   ###   ###  ###    # #  #  #  #  #   ##    ###  #  #   ##   #  #   ##
    /**
     * Adds a banned home for a player.
     * @param {string} home The home map to ban.
     * @param {string} id The Discord ID for the player to get a map banned.
     * @param {number} season The current season.
     * @returns {Promise} A promise that resolves when the home has been banned.
     */
    static async addBannedHome(home, id, season) {
        await db.query(`
            MERGE tblBannedHomes bh
                USING (VALUES (@id, @home, @nextSeason)) AS v (HomeDiscordID, Home, Season)
                ON bh.DiscordID = @id AND bh.Home = @home AND bh.Season = @nextSeason
            WHEN NOT MATCHED THEN
                INSERT (DiscordID, Home, Season) VALUES (v.HomeDiscordID, v.Home, v.Season);
        `, {
            home: {type: Db.VARCHAR(50), value: home},
            id: {type: Db.VARCHAR(50), value: id},
            nextSeason: {type: Db.INT, value: season + 1}
        });
    }

    //          #     #  #  #
    //          #     #  #  #
    //  ###   ###   ###  ####   ##   # #    ##
    // #  #  #  #  #  #  #  #  #  #  ####  # ##
    // # ##  #  #  #  #  #  #  #  #  #  #  ##
    //  # #   ###   ###  #  #   ##   #  #   ##
    /**
     * Adds a home map for a player.
     * @param {string} id The player's Discord ID.
     * @param {string} home The home map to add.
     * @returns {Promise} A promise that resolves when the home map has been added.
     */
    static async addHome(id, home) {
        await db.query("INSERT INTO tblHome (DiscordID, Home) VALUES (@id, @home)", {
            id: {type: Db.VARCHAR(50), value: id},
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
     * @param {{id: string, score: number}[]} scores The scores for the result.
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
            params[`id${index}`] = {type: Db.VARCHAR(50), value: score.id};
        });

        await db.query(`
            DECLARE @MatchID INT

            INSERT INTO tblMatch (EventID, Map, Round) VALUES (@eventId, @map, @round)

            SET @MatchID = SCOPE_IDENTITY()

            ${scores.map((score, index) => `
                INSERT INTO tblScore (MatchID, PlayerID, Score)
                SELECT @MatchID, PlayerID, @score${index}
                FROM tblPlayer
                WHERE DiscordID = @id${index}
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
     * @param {boolean} warningSent Whether a warning was sent.
     * @param {number} round The current round number.
     * @param {string} eventName The name of the event.
     * @param {Date} eventDate The date of the event.
     * @param {number} eventId The ID of the event.
     * @param {number} season The season of the event.
     * @returns {Promise} A promise that resolves when the backup is complete.
     */
    static async backup(matches, players, finals, warningSent, round, eventName, eventDate, eventId, season) {
        await db.query(`
            DELETE FROM tblBackup
            INSERT INTO tblBackup (Code) VALUES (@code)
        `, {
            code: {
                type: Db.TEXT,
                value: JSON.stringify({matches, players, finals, warningSent, round, eventName, eventDate, eventId, season}, (key, value) => {
                    if (["channel", "voice", "results"].indexOf(key) !== -1) {
                        return value ? value.id : void 0;
                    }

                    return value;
                })
            }
        });
    }

    //       ##                      #  #
    //        #                      #  #
    //  ##    #     ##    ###  ###   ####   ##   # #    ##    ###
    // #      #    # ##  #  #  #  #  #  #  #  #  ####  # ##  ##
    // #      #    ##    # ##  #     #  #  #  #  #  #  ##      ##
    //  ##   ###    ##    # #  #     #  #   ##   #  #   ##   ###
    /**
     * Clears all pilot's home maps.
     * @returns {Promise} A promise that resolves when the home maps are cleared.
     */
    static async clearHomes() {
        await db.query("TRUNCATE TABLE tblHome");
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
     * @param {string} id The player's Discord ID.
     * @returns {Promise} A promise that resolves when the home maps have been deleted.
     */
    static async deleteHomesForDiscordId(id) {
        await db.query("DELETE FROM tblHome WHERE DiscordID = @id", {id: {type: Db.VARCHAR(50), value: id}});
    }

    //                #  ####                     #
    //                #  #                        #
    //  ##   ###    ###  ###   # #    ##   ###   ###
    // # ##  #  #  #  #  #     # #   # ##  #  #   #
    // ##    #  #  #  #  #     # #   ##    #  #   #
    //  ##   #  #   ###  ####   #     ##   #  #    ##
    /**
     * Clears the current backup and sets all players replaced homes to false.
     * @returns {Promise} A promise that resolves when the backup is complete.
     */
    static async endEvent() {
        await db.query(`
            DELETE FROM tblBackup

            UPDATE tblPlayer SET HasReplacedHome = 0
        `);
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
     * @returns {Promise<{matches: object[], players: object[], finals: boolean, warningSent: boolean, round: number, eventName: string, eventDate: date, eventId: number, season: number}>} A promise that resolves with the current backup.
     */
    static async getBackup() {
        const data = await db.query("SELECT Code FROM tblBackup");
        return data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && data.recordsets[0][0].Code && JSON.parse(data.recordsets[0][0].Code) || void 0;
    }

    //              #    ###                              #  #  #
    //              #    #  #                             #  #  #
    //  ###   ##   ###   ###    ###  ###   ###    ##    ###  ####   ##   # #    ##    ###
    // #  #  # ##   #    #  #  #  #  #  #  #  #  # ##  #  #  #  #  #  #  ####  # ##  ##
    //  ##   ##     #    #  #  # ##  #  #  #  #  ##    #  #  #  #  #  #  #  #  ##      ##
    // #      ##     ##  ###    # #  #  #  #  #   ##    ###  #  #   ##   #  #   ##   ###
    //  ###
    /**
     * Gets the list of banned homes for a player for a given season.
     * @param {string} id The Discord ID of the player to retrieve banned homes for.
     * @param {number} season The season number to retrieve banned homes for.
     * @returns {Promise<string[]>} A promise that resolves with the list of banned homes.
     */
    static async getBannedHomes(id, season) {
        const data = await db.query("SELECT Home FROM tblBannedHomes WHERE DiscordID = @id AND Season = @season", {
            id: {type: Db.VARCHAR(50), value: id},
            season: {type: Db.INT, value: season}
        });
        return data && data.recordsets && data.recordsets[0] && data.recordsets[0].map((row) => row.Home) || [];
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
     * @param {string} id The player's DiscordID.
     * @returns {Promise<number>} The number of home maps the player has set.
     */
    static async getHomeCountForDiscordId(id) {
        const data = await db.query("SELECT COUNT(Home) Homes FROM tblHome WHERE DiscordID = @id", {id: {type: Db.VARCHAR(50), value: id}});
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
     * @param {string} id The player's Discord ID.
     * @returns {Promise<string[]>} The player's home maps.
     */
    static async getHomesForDiscordId(id) {
        const data = await db.query("SELECT Home FROM tblHome WHERE DiscordID = @id", {id: {type: Db.VARCHAR(50), value: id}});
        return data && data.recordsets && data.recordsets[0] && data.recordsets[0].map((row) => row.Home);
    }

    //              #    #            #                  #     ##                                  #  #              #
    //              #    #            #                  #    #  #                                 ## #              #
    //  ###   ##   ###   #      ###  ###    ##    ###   ###    #     ##    ###   ###    ##   ###   ## #  #  #  # #   ###    ##   ###
    // #  #  # ##   #    #     #  #   #    # ##  ##      #      #   # ##  #  #  ##     #  #  #  #  # ##  #  #  ####  #  #  # ##  #  #
    //  ##   ##     #    #     # ##   #    ##      ##    #    #  #  ##    # ##    ##   #  #  #  #  # ##  #  #  #  #  #  #  ##    #
    // #      ##     ##  ####   # #    ##   ##   ###      ##   ##    ##    # #  ###     ##   #  #  #  #   ###  #  #  ###    ##   #
    //  ###
    /**
     * Gets the latest season number.
     * @returns {Promise<Number|void>} The season number.
     */
    static async getLatestSeasonNumber() {
        const data = await db.query("SELECT MAX(Season) Season FROM tblEvent");
        return data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && data.recordsets[0][0].Season || void 0;
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
     * @param {string} id The player's Discord ID.
     * @returns {Promise<{hasHomes: boolean, locked: boolean}>} An object that contains the player's home map reset status.  hasHomes returns whether the player has home maps defined, and locked returns whether the player's home maps are locked.
     */
    static async getResetStatusForDiscordId(id) {
        const data = await db.query(`
            SELECT TOP 1 Locked FROM tblHome WHERE DiscordID = @id ORDER BY Locked DESC

            SELECT HasReplacedHome FROM tblPlayer WHERE DiscordID = @id
        `, {id: {type: Db.VARCHAR(50), value: id}});
        return {
            hasHomes: data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && true,
            locked: data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && data.recordsets[0][0].Locked || false,
            hasReplacedHome: data && data.recordsets && data.recordsets[1] && data.recordsets[1][0] && data.recordsets[1][0].HasReplacedHome || false
        };
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
     * @returns {Promise<{id: string, score: number}[]>} A promise that resolves with a season's standings.
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
            SELECT DISTINCT LoserPlayerID, 0
            FROM @results
            WHERE LoserPlayerID NOT IN (SELECT PlayerID FROM @standings)

            SELECT p.DiscordID, s.Score
            FROM @standings s
            INNER JOIN tblPlayer p ON s.PlayerID = p.PlayerID
            ORDER BY s.Score DESC, p.Rating DESC
        `, {season: {type: Db.INT, value: season}});

        return data && data.recordsets && data.recordsets[0] && data.recordsets[0].map((row) => ({id: row.DiscordID, score: row.Score})) || [];
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
     * @param {string[]} ids An array of the players' Discord IDs.
     * @return {Promise} A promise that resolves when the players' home maps have been locked.
     */
    static async lockHomeMapsForDiscordIds(ids) {
        const players = ids.map((id, index) => ({index: `player${index}`, atIndex: `@player${index}`, id}));

        await db.query(`UPDATE tblHome SET Locked = 1 WHERE DiscordID IN (${players.map((p) => p.atIndex).join(", ")})`, players.reduce((accumulator, player) => {
            accumulator[player.index] = {type: Db.VARCHAR(50), value: player.id};
            return accumulator;
        }, {}));
    }

    //                   ##                      #  #
    //                    #                      #  #
    // ###    ##   ###    #     ###   ##    ##   ####   ##   # #    ##
    // #  #  # ##  #  #   #    #  #  #     # ##  #  #  #  #  ####  # ##
    // #     ##    #  #   #    # ##  #     ##    #  #  #  #  #  #  ##
    // #      ##   ###   ###    # #   ##    ##   #  #   ##   #  #   ##
    //             #
    /**
     * Replaces a player's home map in the database.
     * @param {User} player The player whose home map to replace.
     * @param {string} oldMap The old home map.
     * @param {string} newMap The new home map.
     * @returns {Promise} A promise that resolves when the home has been replaced.
     */
    static async replaceHome(player, oldMap, newMap) {
        await db.query(`
            UPDATE tblHome SET Home = @newMap WHERE Home = @oldMap AND DiscordID = @discordId

            UPDATE tblPlayer SET HasReplacedHome = 1 WHERE DiscordID = @discordId
        `, {
            newMap: {type: Db.VARCHAR(50), value: newMap},
            oldMap: {type: Db.VARCHAR(50), value: oldMap},
            discordId: {type: Db.VARCHAR(50), value: player.id}
        });
    }

    //               #     ##                                  #  #   #
    //               #    #  #                                 #  #
    //  ###    ##   ###    #     ##    ###   ###    ##   ###   #  #  ##    ###   ###    ##   ###    ###
    // ##     # ##   #      #   # ##  #  #  ##     #  #  #  #  ####   #    #  #  #  #  # ##  #  #  ##
    //   ##   ##     #    #  #  ##    # ##    ##   #  #  #  #  ####   #    #  #  #  #  ##    #       ##
    // ###     ##     ##   ##    ##    # #  ###     ##   #  #  #  #  ###   #  #  #  #   ##   #     ###
    /**
     * Sets the winner and runner up for the season.
     * @param {number} season The season number.
     * @param {string} winnerDiscordId The Discord ID of the season winner.
     * @param {string} runnerUpDiscordId The Discord ID of the season runner-up.
     * @returns {Promise} A promise that resolves when the season winners have been set.
     */
    static async setSeasonWinners(season, winnerDiscordId, runnerUpDiscordId) {
        await db.query("INSERT INTO tblSeason (Season, ChampionPlayerID, RunnerUpPlayerID) SELECT @season, w.PlayerID, r.PlayerID FROM tblPlayer w CROSS JOIN tblPlayer r WHERE w.DiscordID = @winnerDiscordId AND r.DiscordID = @runnerUpDiscordId", {season: {type: Db.INT, value: season}, winnerDiscordId: {type: Db.VARCHAR(50), value: winnerDiscordId}, runnerUpDiscordId: {type: Db.VARCHAR(50), value: runnerUpDiscordId}});
    }

    //                #         #          ####                     #    ###          #     #
    //                #         #          #                        #    #  #         #
    // #  #  ###    ###   ###  ###    ##   ###   # #    ##   ###   ###   #  #   ###  ###   ##    ###    ###   ###
    // #  #  #  #  #  #  #  #   #    # ##  #     # #   # ##  #  #   #    ###   #  #   #     #    #  #  #  #  ##
    // #  #  #  #  #  #  # ##   #    ##    #     # #   ##    #  #   #    # #   # ##   #     #    #  #   ##     ##
    //  ###  ###    ###   # #    ##   ##   ####   #     ##   #  #    ##  #  #   # #    ##  ###   #  #  #     ###
    //       #                                                                                          ###
    /**
     * Updates the ratings upon conclusion of an event.
     * @param {number} eventId The event ID.
     * @returns {Promise} A promise that resolves when the ratings are updated.
     */
    static async updateEventRatings(eventId) {
        await db.query("INSERT INTO tblRating (PlayerID, Rating, RatingDeviation, Volatility, EventID) SELECT PlayerID, Rating, RatingDeviation, Volatility, @eventId FROM tblPlayer", {eventId: {type: Db.INT, value: eventId}});
    }

    //                #         #          ###   ##                            ###    #                                #  ###      #
    //                #         #          #  #   #                            #  #                                    #   #       #
    // #  #  ###    ###   ###  ###    ##   #  #   #     ###  #  #   ##   ###   #  #  ##     ###    ##    ##   ###    ###   #     ###
    // #  #  #  #  #  #  #  #   #    # ##  ###    #    #  #  #  #  # ##  #  #  #  #   #    ##     #     #  #  #  #  #  #   #    #  #
    // #  #  #  #  #  #  # ##   #    ##    #      #    # ##   # #  ##    #     #  #   #      ##   #     #  #  #     #  #   #    #  #
    //  ###  ###    ###   # #    ##   ##   #     ###    # #    #    ##   #     ###   ###   ###     ##    ##   #      ###  ###    ###
    //       #                                                #
    /**
     * Updates a player's Discord ID.
     * @param {string} discordId1 The Discord ID to change.
     * @param {string} discordId2 The Discord ID to change to.
     * @returns {Promise} A promise that resolves when the player's Discord ID is updated.
     */
    static async updatePlayerDiscordId(discordId1, discordId2) {
        await db.query("UPDATE tblPlayer SET DiscordID = @discordId2 WHERE DiscordID = @discordId1", {discordId1: {type: Db.VARCHAR(50), value: discordId1}, discordId2: {type: Db.VARCHAR(50), value: discordId2}});
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
     * @param {string} id The DiscordID of the player.
     * @param {number} rating The player's rating.
     * @param {number} ratingDeviation The player's rating deviation.
     * @param {number} volatility The volatility of the player's rating.
     * @returns {Promise} A promise that resolves when the player has been updated.
     */
    static async updatePlayerRating(name, id, rating, ratingDeviation, volatility) {
        await db.query(`
            MERGE tblPlayer p
                USING (VALUES (@name, @id, @rating, @ratingDeviation, @volatility)) AS v (Name, DiscordID, Rating, RatingDeviation, Volatility)
                ON p.DiscordID = @id
            WHEN MATCHED THEN
                UPDATE SET Name = v.Name, DiscordID = v.DiscordID, Rating = v.Rating, RatingDeviation = v.RatingDeviation, Volatility = v.Volatility
            WHEN NOT MATCHED THEN
                INSERT (Name, DiscordID, Rating, RatingDeviation, Volatility) VALUES (v.Name, v.DiscordID, v.Rating, v.RatingDeviation, v.Volatility);
        `, {
            name: {type: Db.VARCHAR(50), value: name},
            id: {type: Db.VARCHAR(50), value: id},
            rating: {type: Db.FLOAT, value: rating},
            ratingDeviation: {type: Db.FLOAT, value: ratingDeviation},
            volatility: {type: Db.FLOAT, value: volatility}
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
     * Updates a match result in the database.
     * @param {number} eventId The event ID.
     * @param {number} round The round number.
     * @param {{id: string, score: number}[]} scores The scores for the result.
     * @returns {Promise} A promise that resolves when the result is added to the database.
     */
    static async updateResult(eventId, round, scores) {
        const params = {
            eventId: {type: Db.INT, value: eventId},
            round: {type: Db.INT, value: round},
            scoresCount: {type: Db.INT, value: scores.length}
        };

        scores.forEach((score, index) => {
            params[`score${index}`] = {type: Db.INT, value: score.score};
            params[`id${index}`] = {type: Db.VARCHAR(50), value: score.id};
        });

        await db.query(`
            DECLARE @MatchID INT

            SELECT @MatchID = m.MatchID
            FROM tblMatch m
            WHERE m.EventID = @eventId
                AND m.Round = @round
                ${scores.map((score, index) => `
                AND EXISTS(
                    SELECT TOP 1 1
                    FROM tblScore s
                    INNER JOIN tblPlayer p ON s.PlayerID = p.PlayerID
                    WHERE s.MatchID = m.MatchID
                        AND p.DiscordID = @id${index}
                )
                `).join("\n")}
                AND (
                    SELECT COUNT(s.ScoreID)
                    FROM tblScore s
                    WHERE s.MatchID = m.MatchID
                ) = @scoresCount

            IF @MatchID IS NOT NULL
            BEGIN
                ${scores.map((score, index) => `
                    UPDATE s SET Score = @score${index}
                    FROM tblScore s
                    INNER JOIN tblPlayer p ON s.PlayerID = p.PlayerID
                    WHERE s.MatchID = @MatchID
                        AND p.DiscordID = @id${index}
                `).join("\n")}
            END
        `, params);
    }
}

module.exports = Database;
