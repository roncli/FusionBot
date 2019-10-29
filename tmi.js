const TwitchJs = require("twitch-js"),

    Commands = require("./commands"),
    Exception = require("./exception"),
    Log = require("./log"),
    settings = require("./settings"),
    Warning = require("./warning"),

    messageParse = /^!(?<cmd>[^ ]+)(?: +(?<args>.+[^ ]))? *$/,
    tmi = new TwitchJs.Client(settings.tmi);

/**
 * @type {Commands}
 */
let commands;

//  #####           #
//    #
//    #    ## #    ##
//    #    # # #    #
//    #    # # #    #
//    #    # # #    #
//    #    #   #   ###
/**
 * A class that handles calls to twitch-js.
 */
class Tmi {
    //                                        #
    //                                        #
    //  ##    ##   # #   # #    ###  ###    ###   ###
    // #     #  #  ####  ####  #  #  #  #  #  #  ##
    // #     #  #  #  #  #  #  # ##  #  #  #  #    ##
    //  ##    ##   #  #  #  #   # #  #  #   ###  ###
    /**
     * Gets the commands object.
     * @returns {Commands} The commands object.
     */
    static get commands() {
        return commands;
    }

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
        commands = new Commands(Tmi);

        tmi.on("connected", () => {
            Log.log("Connected to tmi.");
        });

        tmi.on("disconnected", (ev) => {
            Log.exception("Disconnected from tmi...", ev);
        });

        tmi.on("message", async (channel, userstate, text, self) => {
            if (!self && channel === "#roncli") {
                await Tmi.message(userstate["display-name"], text);
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
     * @returns {Promise} A promise that resolves when tmi is connected.
     */
    static async connect() {
        Log.log("Connecting to tmi...");

        try {
            await tmi.connect();
        } catch (err) {
            Log.exception("tmi connection failed.", err);
        }
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
     * @returns {Promise} A promise that resolves when the message is parsed.
     */
    static async message(user, text) {
        if (messageParse.test(text)) {
            const {groups: {cmd, args}} = messageParse.exec(text),
                command = cmd.toLocaleLowerCase();

            if (Object.getOwnPropertyNames(Commands.prototype).filter((p) => typeof Commands.prototype[p] === "function" && p !== "constructor").indexOf(command) !== -1) {
                let success;
                try {
                    await Tmi.commands[command](user, args);
                } catch (err) {
                    if (err instanceof Warning) {
                        Log.warning(`${user}: ${text}\n${err}`);
                    } else if (err instanceof Exception) {
                        Log.exception(err.message, err.innerError);
                    } else {
                        Log.exception("Unhandled error found.", err);
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
    static async queue(message) {
        try {
            await tmi.say("sixgaminggg", message);
        } catch (err) {
            Log.exception("Say command failed.", err);
        }
    }
}

module.exports = Tmi;
