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
     * @param {boolean} joinable Whether the event is joinable.
     * @param {number} round The current round number.
     * @returns {Promise} A promise that resolves when the backup is complete.
     */
    static async backup(matches, players, joinable, round) {
        await db.query(`
            DELETE FROM tblBackup
            INSERT INTO tblBackup (Code) VALUES (@code)
        `, {
            code: {
                type: Db.TEXT,
                value: JSON.stringify({matches, players, joinable, round}, (key, value) => {
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
     * @returns {Promise<{matches: object[], players: object[], joinable: boolean, round: number}>} A promise that resolves with the current backup.
     */
    static async getBackup() {
        const data = await db.query("SELECT Code FROM tblBackup");
        return data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && data.recordsets[0][0].Code && JSON.parse(data.recordsets[0][0].Code) || void 0;
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
