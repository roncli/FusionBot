const util = require("util"),

    queue = [];

/**
 * @type {typeof import("./discord")}
 */
let Discord;

//  #
//  #
//  #       ###    ## #
//  #      #   #  #  #
//  #      #   #   ##
//  #      #   #  #
//  #####   ###    ###
//                #   #
//                 ###
/**
 * A class that handles logging.
 */
class Log {
    // ##
    //  #
    //  #     ##    ###
    //  #    #  #  #  #
    //  #    #  #   ##
    // ###    ##   #
    //              ###
    /**
     * Logs a message.
     * @param {object} obj The object to log.
     * @returns {void}
     */
    static log(obj) {
        queue.push({
            type: "log",
            date: new Date(),
            obj
        });
        Log.output();
    }

    //                          #
    //
    // #  #   ###  ###   ###   ##    ###    ###
    // #  #  #  #  #  #  #  #   #    #  #  #  #
    // ####  # ##  #     #  #   #    #  #   ##
    // ####   # #  #     #  #  ###   #  #  #
    //                                      ###
    /**
     * Logs a warning.
     * @param {string} message The string to log.
     * @returns {void}
     */
    static warning(message) {
        queue.push({
            type: "warning",
            date: new Date(),
            message
        });
        Log.output();
    }

    //                                #     #
    //                                #
    //  ##   #  #   ##    ##   ###   ###   ##     ##   ###
    // # ##   ##   #     # ##  #  #   #     #    #  #  #  #
    // ##     ##   #     ##    #  #   #     #    #  #  #  #
    //  ##   #  #   ##    ##   ###     ##  ###    ##   #  #
    //                         #
    /**
     * Logs an exception.
     * @param {string} message The message describing the error.
     * @param {object} obj The object to log.
     * @returns {void}
     */
    static exception(message, obj) {
        queue.push({
            type: "exception",
            date: new Date(),
            message,
            obj
        });
        Log.output();
    }

    //              #                 #
    //              #                 #
    //  ##   #  #  ###   ###   #  #  ###
    // #  #  #  #   #    #  #  #  #   #
    // #  #  #  #   #    #  #  #  #   #
    //  ##    ###    ##  ###    ###    ##
    //                   #
    /**
     * Outputs the log queue.
     * @returns {void}
     */
    static output() {
        if (!Discord) {
            Discord = require("./discord");
        }

        if (Discord.isConnected()) {
            const logChannel = Discord.findChannelByName("fusionbot-log"),
                errorChannel = Discord.findChannelByName("fusionbot-errors");

            queue.forEach((log) => {
                const message = {
                    embed: {
                        color: log.type === "log" ? 0x80FF80 : log.type === "warning" ? 0xFFFF00 : 0xFF0000,
                        footer: {"icon_url": Discord.icon, text: "DescentBot"},
                        fields: [],
                        timestamp: log.date
                    }
                };

                if (log.message) {
                    ({message: message.embed.description} = log);
                }

                if (log.obj) {
                    const msg = util.inspect(log.obj);

                    if (msg.length > 1024) {
                        Discord.queue(msg, log.type === "exception" ? errorChannel : logChannel);
                        return;
                    }

                    message.embed.fields.push({
                        name: "Message",
                        value: msg
                    });
                }

                Discord.richQueue(message, log.type === "exception" ? errorChannel : logChannel);
            });

            queue.splice(0, queue.length);
        } else {
            console.log(queue[queue.length - 1]);
        }
    }
}

module.exports = Log;
