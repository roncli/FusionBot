const Discord = require("./discord"),
    Db = require("./db"),
    Log = require("./log");

//         #                 #
//         #                 #
//  ###   ###    ###  ###   ###   #  #  ###
// ##      #    #  #  #  #   #    #  #  #  #
//   ##    #    # ##  #      #    #  #  #  #
// ###      ##   # #  #       ##   ###  ###
//                                      #
/**
 * Starts up the application.
 */
(async () => {
    Log.log("Starting up...");

    const season = await Db.getLatestSeasonNumber();

    Discord.startup(season);
    Discord.connect();
})();
