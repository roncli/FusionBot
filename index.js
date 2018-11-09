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

    if (process.platform === "win32") {
        process.title = "FusionBot";
    } else {
        process.stdout.write("\x1b]2;FusionBot\x1b\x5c");
    }

    const season = await Db.getLatestSeasonNumber();

    Discord.startup(season);
    Discord.connect();
})();
