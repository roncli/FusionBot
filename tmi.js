const TmiJs = require("tmi.js"),

    Commands = require("./commands"),
    Log = require("./log"),
    settings = require("./settings"),

    messageParse = /^!([^ ]+)(?: +(.+[^ ]))? *$/,
    tmi = new TmiJs.Client(settings.tmi);

//  #####           #
//    #
//    #    ## #    ##
//    #    # # #    #
//    #    # # #    #
//    #    # # #    #
//    #    #   #   ###
/**
 * A class that handles calls to tmi.js.
 */
class Tmi {
    //         #                 #
    //         #                 #
    //  ###   ###    ###  ###   ###   #  #  ###
    // ##      #    #  #  #  #   #    #  #  #  #
    //   ##    #    # ##  #      #    #  #  #  #
    // ###      ##   # #  #       ##   ###  ###
    //                                      #
    /**
     * Starts up the connection to tmi.
     * @returns {void}
     */
    static startup() {
        Tmi.commands = new Commands(Tmi);

        tmi.on("connected", () => {
            Log.log("Connected to tmi.");
            tmi.raw("CAP REQ :twitch.tv/membership");
        });

        tmi.on("disconnected", (ev) => {
            Log.exception("Disconnected from tmi...", ev);
        });

        tmi.on("message", (channel, userstate, text, self) => {
            if (!self && channel === "#roncli") {
                Tmi.message(userstate["display-name"], text);
            }
        });
    }

    //                                      #
    //                                      #
    //  ##    ##   ###   ###    ##    ##   ###
    // #     #  #  #  #  #  #  # ##  #      #
    // #     #  #  #  #  #  #  ##    #      #
    //  ##    ##   #  #  #  #   ##    ##     ##
    /**
     * Connects to tmi.
     * @returns {void}
     */
    static connect() {
        Log.log("Connecting to tmi...");
        tmi.connect();
    }

    // # #    ##    ###    ###    ###   ###   ##
    // ####  # ##  ##     ##     #  #  #  #  # ##
    // #  #  ##      ##     ##   # ##   ##   ##
    // #  #   ##   ###    ###     # #  #      ##
    //                                  ###
    /**
     * Parses a message.
     * @param {string} user The user who sent the message.
     * @param {string} text The text of the message.
     * @returns {Promise} A promise that resolves when the message is processed.
     */
    static async message(user, text) {
        const matches = messageParse.exec(text);

        if (matches) {
            if (Object.getOwnPropertyNames(Commands.prototype).filter((p) => typeof Commands.prototype[p] === "function" && p !== "constructor").indexOf(matches[1]) !== -1) {
                let success;
                try {
                    success = await Tmi.commands[matches[1]](user, matches[2]);
                } catch (err) {
                    if (err.innerError) {
                        Log.exception(err.message, err.innerError);
                    } else {
                        Log.warning(`${user}: ${text}\n${err}`);
                    }
                    return;
                }

                if (success) {
                    Log.log(`${user}: ${text}`);
                }
            }
        }
    }

    //  ###  #  #   ##   #  #   ##
    // #  #  #  #  # ##  #  #  # ##
    // #  #  #  #  ##    #  #  ##
    //  ###   ###   ##    ###   ##
    //    #
    /**
     * Queues a message to be sent.
     * @param {string} message The message to be sent.
     * @returns {Promise} A promise that resolves when the message is sent.
     */
    static queue(message) {
        return tmi.say("roncli", message);
    }
}

module.exports = Tmi;
