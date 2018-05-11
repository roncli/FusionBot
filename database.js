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
    static getHomesForDiscordId(discordId) {
        return db.query("SELECT Home FROM tblHome WHERE DiscordID = @discordId", {discordId: {type: Db.VARCHAR(50), value: discordId}}).then((data) => data && data.recordsets && data.recordsets[0] && data.recordsets[0].map((row) => row.Home));
    }

    static getHomeCountForDiscordId(discordId) {
        return db.query("SELECT COUNT(Home) Homes FROM tblHome WHERE DiscordID = @discordId", {discordId: {type: Db.VARCHAR(50), value: discordId}}).then((data) => data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && data.recordsets[0][0].Homes || 0);
    }

    static addHome(discordId, home) {
        return db.query("INSERT INTO tblHome (DiscordID, Home) VALUES (@discordId, @home)", {
            discordId: {type: Db.VARCHAR(50), value: discordId},
            home: {type: Db.VARCHAR(50), value: home}
        });
    }

    /**
     *
     * @param {string[]} discordIds
     */
    static lockHomeLevelsForDiscordIds(discordIds) {
        const players = discordIds.map((discordId, index) => ({index: `player${index}`, discordId}));

        return db.query(`UPDATE tblHome SET Locked = 1 WHERE DiscordID IN (${players.map((p) => p.index).join(", ")})`, players.reduce((accumulator, player) => {
            accumulator[player.index] = {type: Db.VARCHAR(50), value: player.discordId};
            return accumulator;
        }, {}));
    }

    static updatePlayerRating(name, discordId, rating, ratingDeviation, volatility, playerId) {
        return db.query(`
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

    static getResetStatusForDiscordId(discordId) {
        return db.query("SELECT TOP 1 Locked FROM tblHome WHERE DiscordID = @discordId ORDER BY Locked DESC", {discordId: {type: Db.VARCHAR(50), value: discordId}}).then((data) => ({hasHomes: data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && true, locked: data && data.recordsets && data.recordsets[0] && data.recordsets[0][0] && data.recordsets[0][0].Locked}));
    }

    static deleteHomesForDiscordId(discordId) {
        return db.query("DELETE FROM tblHome WHERE DiscordID = @discordId", {discordId: {type: Db.VARCHAR(50), value: discordId}});
    }

    static getHomeList() {
        Db.query("SELECT DiscordID, Home FROM tblHome").then((data) => data && data.recordsets && data.recordsets[0]);
    }

    static getPlayers() {
        Db.query("SELECT PlayerID, Name, DiscordID, Rating, RatingDeviation, Volatility from tblPlayer").then((data) => data && data.recordsets && data.recordsets[0]);
    }
}

module.exports = Database;
