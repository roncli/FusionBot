const DiscordJs = require("discord.js"),

    Commands = require("./commands"),
    Log = require("./log"),
    settings = require("./settings"),

    discord = new DiscordJs.Client(settings.discord),
    messageParse = /^!([^ ]+)(?: +(.+[^ ]))? *$/,
    noPermissions = {
        CREATE_INSTANT_INVITE: false,
        ADD_REACTIONS: false,
        READ_MESSAGES: false,
        SEND_MESSAGES: false,
        SEND_TTS_MESSAGES: false,
        EMBED_LINKS: false,
        ATTACH_FILES: false,
        READ_MESSAGE_HISTORY: false,
        MENTION_EVERYONE: false,
        CONNECT: false,
        SPEAK: false,
        USE_VAD: false
    },
    textPermissions = {
        CREATE_INSTANT_INVITE: true,
        ADD_REACTIONS: true,
        READ_MESSAGES: true,
        SEND_MESSAGES: true,
        SEND_TTS_MESSAGES: true,
        EMBED_LINKS: true,
        ATTACH_FILES: true,
        READ_MESSAGE_HISTORY: true,
        MENTION_EVERYONE: true
    },
    voicePermissions = {
        CONNECT: true,
        SPEAK: true,
        USE_VAD: true
    };

let eventRole,
    generalChannel,
    obsGuild,
    resultsChannel,
    seasonRole;

//  ####     #                                    #
//   #  #                                         #
//   #  #   ##     ###    ###    ###   # ##    ## #
//   #  #    #    #      #   #  #   #  ##  #  #  ##
//   #  #    #     ###   #      #   #  #      #   #
//   #  #    #        #  #   #  #   #  #      #  ##
//  ####    ###   ####    ###    ###   #       ## #
/**
 * A static class that handles all Discord.js interctions.
 */
class Discord {
    //    #   #                                #
    //    #                                    #
    //  ###  ##     ###    ##    ##   ###    ###
    // #  #   #    ##     #     #  #  #  #  #  #
    // #  #   #      ##   #     #  #  #     #  #
    //  ###  ###   ###     ##    ##   #      ###
    /**
     * The Discord object.
     * @returns {Discord} The Discord object.
     */
    static get discord() {
        return discord;
    }

    //  #
    //
    // ##     ##    ##   ###
    //  #    #     #  #  #  #
    //  #    #     #  #  #  #
    // ###    ##    ##   #  #
    /**
     * The Observatory's icon.
     * @returns {string} The URL of the icon.
     */
    static get icon() {
        if (discord && discord.status === 0) {
            return discord.user.avatarURL;
        }

        return void 0;
    }

    //                          ##     #            ##   #                             ##
    //                           #     #           #  #  #                              #
    // ###    ##    ###   #  #   #    ###    ###   #     ###    ###  ###   ###    ##    #
    // #  #  # ##  ##     #  #   #     #    ##     #     #  #  #  #  #  #  #  #  # ##   #
    // #     ##      ##   #  #   #     #      ##   #  #  #  #  # ##  #  #  #  #  ##     #
    // #      ##   ###     ###  ###     ##  ###     ##   #  #   # #  #  #  #  #   ##   ###
    /**
     * The results channel.
     * @returns {Channel} The results channel.
     */
    static get resultsChannel() {
        return resultsChannel;
    }

    //              #    ##       #  ###      #
    //                    #       #   #       #
    //  ###  #  #  ##     #     ###   #     ###
    // #  #  #  #   #     #    #  #   #    #  #
    //  ##   #  #   #     #    #  #   #    #  #
    // #      ###  ###   ###    ###  ###    ###
    //  ###
    /**
     * The ID of the guild.
     * @returns {string} The ID of the guild.
     */
    static get guildId() {
        return discord.id;
    }

    //         #                 #
    //         #                 #
    //  ###   ###    ###  ###   ###   #  #  ###
    // ##      #    #  #  #  #   #    #  #  #  #
    //   ##    #    # ##  #      #    #  #  #  #
    // ###      ##   # #  #       ##   ###  ###
    //                                      #
    /**
     * Starts up the connection to Discord.
     * @returns {void}
     */
    static startup() {
        Discord.commands = new Commands(Discord);

        discord.addListener("ready", () => {
            Log.log("Connected to Discord.");

            obsGuild = discord.guilds.find("name", "The Observatory");

            generalChannel = obsGuild.channels.find("name", "general");
            resultsChannel = obsGuild.channels.find("name", "match-results");

            eventRole = obsGuild.roles.find("name", "In Current Event");
            seasonRole = obsGuild.roles.find("name", "Season 7 Participant");
        });

        discord.on("disconnect", (ev) => {
            Log.exception("Disconnected from Discord.", ev);
        });

        discord.addListener("message", (message) => {
            if (message.guild && message.guild.name === "The Observatory" && message.channel.type === "text") {
                Discord.message(message.author, message.content, message.channel);
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
     * Connects to Discord.
     * @returns {void}
     */
    static connect() {
        Log.log("Connecting to Discord...");
        discord.login(settings.discord.token).then(() => {
            Log.log("Connected.");
        }).catch((err) => {
            Log.exception("Error connecting to Discord, will automatically retry.", err);
        });
    }

    //  #            ##                                  #             #
    //              #  #                                 #             #
    // ##     ###   #      ##   ###   ###    ##    ##   ###    ##    ###
    //  #    ##     #     #  #  #  #  #  #  # ##  #      #    # ##  #  #
    //  #      ##   #  #  #  #  #  #  #  #  ##    #      #    ##    #  #
    // ###   ###     ##    ##   #  #  #  #   ##    ##     ##   ##    ###
    /**
     * Determines whether the bot is connected to Discord.
     * @returns {boolean} Whether the bot is connected to Discord.
     */
    static isConnected() {
        return discord ? discord.status === 0 : false;
    }

    // # #    ##    ###    ###    ###   ###   ##
    // ####  # ##  ##     ##     #  #  #  #  # ##
    // #  #  ##      ##     ##   # ##   ##   ##
    // #  #   ##   ###    ###     # #  #      ##
    //                                  ###
    /**
     * Parses a message.
     * @param {User} user The user who sent the message.
     * @param {string} text The text of the message.
     * @returns {void}
     */
    static message(user, text) {
        const matches = messageParse.exec(text);

        if (matches) {
            if (Object.getOwnPropertyNames(Commands.prototype).filter((p) => typeof Commands.prototype[p] === "function" && p !== "constructor").indexOf(matches[1]) !== -1) {
                Discord.commands[matches[1]](user, matches[2]).then((success) => {
                    if (success) {
                        Log.log(`${user}: ${text}`);
                    }
                }).catch((err) => {
                    if (err.innerError) {
                        Log.exception(err.message, err.innerError);
                    } else {
                        Log.warning(err);
                    }
                });
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
     * @param {Channel} [channel] The channel to send the message to.
     * @returns {Promise} A promise that resolves when the message is sent.
     */
    static queue(message, channel) {
        if (!channel) {
            channel = generalChannel;
        }

        channel.send(
            "",
            {
                embed: {
                    description: message,
                    timestamp: new Date(),
                    color: 0x263686,
                    footer: {icon_url: Discord.icon} // eslint-disable-line camelcase
                }
            }
        );
    }

    //        #          #      ##
    //                   #     #  #
    // ###   ##     ##   ###   #  #  #  #   ##   #  #   ##
    // #  #   #    #     #  #  #  #  #  #  # ##  #  #  # ##
    // #      #    #     #  #  ## #  #  #  ##    #  #  ##
    // #     ###    ##   #  #   ##    ###   ##    ###   ##
    //                            #
    /**
     * Queues a rich embed message to be sent.
     * @param {object} message The message to be sent.
     * @param {Channel} [channel] The channel to send the message to.
     * @returns {Promise} A promise that resolves when the message is sent.
     */
    static richQueue(message, channel) {
        if (!channel) {
            channel = generalChannel;
        }

        channel.send("", message);
    }

    //  #            ##
    //              #  #
    // ##     ###   #  #  #  #  ###    ##   ###
    //  #    ##     #  #  #  #  #  #  # ##  #  #
    //  #      ##   #  #  ####  #  #  ##    #
    // ###   ###     ##   ####  #  #   ##   #
    /**
     * Determines whether the user is the owner.
     * @param {User} user The user to check.
     * @returns {boolean} Whether the user is a podcaster.
     */
    static isOwner(user) {
        return user && user.username === settings.admin.username && user.discriminator === settings.admin.discriminator;
    }

    //   #    #             #  #  #                     ###         ###      #
    //  # #                 #  #  #                     #  #         #       #
    //  #    ##    ###    ###  #  #   ###    ##   ###   ###   #  #   #     ###
    // ###    #    #  #  #  #  #  #  ##     # ##  #  #  #  #  #  #   #    #  #
    //  #     #    #  #  #  #  #  #    ##   ##    #     #  #   # #   #    #  #
    //  #    ###   #  #   ###   ##   ###     ##   #     ###     #   ###    ###
    //                                                         #
    /**
     * Returns the Discord user by their Discord ID.
     * @param {string} id The ID of the Discord user.
     * @returns {User} The Discord user.
     */
    static findUserById(id) {
        return discord.users.find("id", id);
    }

    //              #     ##          #    ##       #  #  #
    //              #    #  #               #       #  #  #
    //  ###   ##   ###   #     #  #  ##     #     ###  #  #   ###    ##   ###
    // #  #  # ##   #    # ##  #  #   #     #    #  #  #  #  ##     # ##  #  #
    //  ##   ##     #    #  #  #  #   #     #    #  #  #  #    ##   ##    #
    // #      ##     ##   ###   ###  ###   ###    ###   ##   ###     ##   #
    //  ###
    /**
     * Returns the guild member by their user ID or their Discord user.
     * @param {User|number|string} user The Discord user.
     * @returns {GuildMember} The guild member.
     */
    static getGuildUser(user) {
        if (["number", "string"].indexOf(typeof user) !== -1) {
            return obsGuild.member(discord.users.find("id", user));
        }

        return obsGuild.member(user);
    }

    //   #    #             #   ##   #                             ##    ###         #  #
    //  # #                 #  #  #  #                              #    #  #        ## #
    //  #    ##    ###    ###  #     ###    ###  ###   ###    ##    #    ###   #  #  ## #   ###  # #    ##
    // ###    #    #  #  #  #  #     #  #  #  #  #  #  #  #  # ##   #    #  #  #  #  # ##  #  #  ####  # ##
    //  #     #    #  #  #  #  #  #  #  #  # ##  #  #  #  #  ##     #    #  #   # #  # ##  # ##  #  #  ##
    //  #    ###   #  #   ###   ##   #  #   # #  #  #  #  #   ##   ###   ###     #   #  #   # #  #  #   ##
    //                                                                          #
    /**
     * Finds a Discord channel by its name.
     * @param {string} name The name of the channel.
     * @returns {Channel} The Discord channel.
     */
    static findChannelByName(name) {
        return obsGuild.channels.find("name", name);
    }

    //   #    #             #  ###         ##          ###         #  #
    //  # #                 #  #  #         #          #  #        ## #
    //  #    ##    ###    ###  #  #   ##    #     ##   ###   #  #  ## #   ###  # #    ##
    // ###    #    #  #  #  #  ###   #  #   #    # ##  #  #  #  #  # ##  #  #  ####  # ##
    //  #     #    #  #  #  #  # #   #  #   #    ##    #  #   # #  # ##  # ##  #  #  ##
    //  #    ###   #  #   ###  #  #   ##   ###    ##   ###     #   #  #   # #  #  #   ##
    //                                                        #
    /**
     * Finds a Discord role by its name.
     * @param {string} name The name of the role.
     * @returns {Role} The Discord Role.
     */
    static findRoleByName(name) {
        return obsGuild.roles.find("name", name);
    }

    //   #    #             #  ###         ##          ###         ###      #
    //  # #                 #  #  #         #          #  #         #       #
    //  #    ##    ###    ###  #  #   ##    #     ##   ###   #  #   #     ###
    // ###    #    #  #  #  #  ###   #  #   #    # ##  #  #  #  #   #    #  #
    //  #     #    #  #  #  #  # #   #  #   #    ##    #  #   # #   #    #  #
    //  #    ###   #  #   ###  #  #   ##   ###    ##   ###     #   ###    ###
    //                                                        #
    /**
     * Finds a Discord role by its ID.
     * @param {string} id The ID of the role.
     * @returns {Role} The Discord Role.
     */
    static findRoleById(id) {
        return obsGuild.roles.find("id", id);
    }

    //          #     #  ####                     #    ###         ##
    //          #     #  #                        #    #  #         #
    //  ###   ###   ###  ###   # #    ##   ###   ###   #  #   ##    #     ##
    // #  #  #  #  #  #  #     # #   # ##  #  #   #    ###   #  #   #    # ##
    // # ##  #  #  #  #  #     # #   ##    #  #   #    # #   #  #   #    ##
    //  # #   ###   ###  ####   #     ##   #  #    ##  #  #   ##   ###    ##
    /**
     * Adds a user to the event role.
     * @param {User} user The user.
     * @returns {Promise} A promise that resolves when the user is added to the role.
     */
    static addEventRole(user) {
        return obsGuild.member(user).addRole(eventRole);
    }

    //                                     ####                     #    ###         ##
    //                                     #                        #    #  #         #
    // ###    ##   # #    ##   # #    ##   ###   # #    ##   ###   ###   #  #   ##    #     ##
    // #  #  # ##  ####  #  #  # #   # ##  #     # #   # ##  #  #   #    ###   #  #   #    # ##
    // #     ##    #  #  #  #  # #   ##    #     # #   ##    #  #   #    # #   #  #   #    ##
    // #      ##   #  #   ##    #     ##   ####   #     ##   #  #    ##  #  #   ##   ###    ##
    /**
     * Removes a user from the event role.
     * @param {User} user The user.
     * @returns {Promise} A promise that resolves when the user is removed from the role.
     */
    static removeEventRole(user) {
        return obsGuild.member(user).removeRole(eventRole);
    }

    //          #     #   ##                                  ###         ##
    //          #     #  #  #                                 #  #         #
    //  ###   ###   ###   #     ##    ###   ###    ##   ###   #  #   ##    #     ##
    // #  #  #  #  #  #    #   # ##  #  #  ##     #  #  #  #  ###   #  #   #    # ##
    // # ##  #  #  #  #  #  #  ##    # ##    ##   #  #  #  #  # #   #  #   #    ##
    //  # #   ###   ###   ##    ##    # #  ###     ##   #  #  #  #   ##   ###    ##
    /**
     * Adds a user to the season role.
     * @param {User} user The user.
     * @returns {Promise} A promise that resolves when the user is added to the role.
     */
    static addSeasonRole(user) {
        return obsGuild.member(user).addRole(seasonRole);
    }

    //                          #          ###         ##
    //                          #          #  #         #
    //  ##   ###    ##    ###  ###    ##   #  #   ##    #     ##
    // #     #  #  # ##  #  #   #    # ##  ###   #  #   #    # ##
    // #     #     ##    # ##   #    ##    # #   #  #   #    ##
    //  ##   #      ##    # #    ##   ##   #  #   ##   ###    ##
    /**
     * Creates a role.
     * @param {object} data The role data.
     * @returns {Promise} A promise that resolves when the role has been created.
     */
    static createRole(data) {
        return obsGuild.createRole(data);
    }

    //          #     #  #  #                     ###         ###         ##
    //          #     #  #  #                      #          #  #         #
    //  ###   ###   ###  #  #   ###    ##   ###    #     ##   #  #   ##    #     ##
    // #  #  #  #  #  #  #  #  ##     # ##  #  #   #    #  #  ###   #  #   #    # ##
    // # ##  #  #  #  #  #  #    ##   ##    #      #    #  #  # #   #  #   #    ##
    //  # #   ###   ###   ##   ###     ##   #      #     ##   #  #   ##   ###    ##
    /**
     * Adds a user to a role.
     * @param {User} user The user to add to the role.
     * @param {Role} role The role to add the user to.
     * @returns {Promise} A promise that resolves when the user has been added to the role.
     */
    static addUserToRole(user, role) {
        return obsGuild.member(user).addRole(role);
    }

    //                                     #  #                     ####                    ###         ##
    //                                     #  #                     #                       #  #         #
    // ###    ##   # #    ##   # #    ##   #  #   ###    ##   ###   ###   ###    ##   # #   #  #   ##    #     ##
    // #  #  # ##  ####  #  #  # #   # ##  #  #  ##     # ##  #  #  #     #  #  #  #  ####  ###   #  #   #    # ##
    // #     ##    #  #  #  #  # #   ##    #  #    ##   ##    #     #     #     #  #  #  #  # #   #  #   #    ##
    // #      ##   #  #   ##    #     ##    ##   ###     ##   #     #     #      ##   #  #  #  #   ##   ###    ##
    /**
     * Removes a user from a role.
     * @param {User} user The user to remove from the role.
     * @param {Role} role The role to remove the user to.
     * @returns {Promise} A promise that resolves when the user has been removed from the role.
     */
    static removeUserFromRole(user, role) {
        return obsGuild.member(user).removeRole(role);
    }

    //          #     #  ###                #    ###                      #                   #
    //          #     #   #                 #    #  #
    //  ###   ###   ###   #     ##   #  #  ###   #  #   ##   ###   # #   ##     ###    ###   ##     ##   ###    ###
    // #  #  #  #  #  #   #    # ##   ##    #    ###   # ##  #  #  ####   #    ##     ##      #    #  #  #  #  ##
    // # ##  #  #  #  #   #    ##     ##    #    #     ##    #     #  #   #      ##     ##    #    #  #  #  #    ##
    //  # #   ###   ###   #     ##   #  #    ##  #      ##   #     #  #  ###   ###    ###    ###    ##   #  #  ###
    /**
     * Adds text permissions to a channel.
     * @param {User|Role} user The user or role to add permissions to.
     * @param {Channel} channel The channel to add permissions to.
     * @returns {Promise} A promise that resolves when text permissions have been added to the channel.
     */
    static addTextPermissions(user, channel) {
        return channel.overwritePermissions(user, textPermissions);
    }

    //          #     #  #  #         #                ###                      #                   #
    //          #     #  #  #                          #  #
    //  ###   ###   ###  #  #   ##   ##     ##    ##   #  #   ##   ###   # #   ##     ###    ###   ##     ##   ###    ###
    // #  #  #  #  #  #  #  #  #  #   #    #     # ##  ###   # ##  #  #  ####   #    ##     ##      #    #  #  #  #  ##
    // # ##  #  #  #  #   ##   #  #   #    #     ##    #     ##    #     #  #   #      ##     ##    #    #  #  #  #    ##
    //  # #   ###   ###   ##    ##   ###    ##    ##   #      ##   #     #  #  ###   ###    ###    ###    ##   #  #  ###
    /**
     * Adds voice permissions to a channel.
     * @param {User|Role} user The user or role to add permissions to.
     * @param {Channel} channel The channel to add permissions to.
     * @returns {Promise} A promise that resolves when voice permissions have been added to the channel.
     */
    static addVoicePermissions(user, channel) {
        return channel.overwritePermissions(user, voicePermissions);
    }

    //                                     ###                      #                   #
    //                                     #  #
    // ###    ##   # #    ##   # #    ##   #  #   ##   ###   # #   ##     ###    ###   ##     ##   ###    ###
    // #  #  # ##  ####  #  #  # #   # ##  ###   # ##  #  #  ####   #    ##     ##      #    #  #  #  #  ##
    // #     ##    #  #  #  #  # #   ##    #     ##    #     #  #   #      ##     ##    #    #  #  #  #    ##
    // #      ##   #  #   ##    #     ##   #      ##   #     #  #  ###   ###    ###    ###    ##   #  #  ###
    /**
     * Removes permissions from a channel.
     * @param {User|Role} user The user or role to remove permissions from.
     * @param {Channel} channel The channel to remove permissions from.
     * @returns {Promise} A promise that resolves when permissions have been removed from the channel.
     */
    static removePermissions(user, channel) {
        return channel.overwritePermissions(user, noPermissions);
    }

    //                          #          ###                #     ##   #                             ##
    //                          #           #                 #    #  #  #                              #
    //  ##   ###    ##    ###  ###    ##    #     ##   #  #  ###   #     ###    ###  ###   ###    ##    #
    // #     #  #  # ##  #  #   #    # ##   #    # ##   ##    #    #     #  #  #  #  #  #  #  #  # ##   #
    // #     #     ##    # ##   #    ##     #    ##     ##    #    #  #  #  #  # ##  #  #  #  #  ##     #
    //  ##   #      ##    # #    ##   ##    #     ##   #  #    ##   ##   #  #   # #  #  #  #  #   ##   ###
    /**
     * Creates a text channel.
     * @param {string} name The name of the channel to create.
     * @param {Channel} category The category to assign the channel to.
     * @returns {Promise} A promise that resolves when the channel has been created.
     */
    static createTextChannel(name, category) {
        return obsGuild.createChannel(name, "text").then((channel) => {
            channel.edit({parent_id: category && category.id}); // eslint-disable-line camelcase
        });
    }

    //                          #          #  #         #                 ##   #                             ##
    //                          #          #  #                          #  #  #                              #
    //  ##   ###    ##    ###  ###    ##   #  #   ##   ##     ##    ##   #     ###    ###  ###   ###    ##    #
    // #     #  #  # ##  #  #   #    # ##  #  #  #  #   #    #     # ##  #     #  #  #  #  #  #  #  #  # ##   #
    // #     #     ##    # ##   #    ##     ##   #  #   #    #     ##    #  #  #  #  # ##  #  #  #  #  ##     #
    //  ##   #      ##    # #    ##   ##    ##    ##   ###    ##    ##    ##   #  #   # #  #  #  #  #   ##   ###
    /**
     * Creates a voice channel.
     * @param {string} name The name of the channel to create.
     * @param {Channel} category The category to assign the channel to.
     * @returns {Promise} A promise that resolves when the channel has been created.
     */
    static createVoiceChannel(name, category) {
        return obsGuild.createChannel(name, "voice").then((channel) => {
            channel.edit({parent_id: category && category.id}); // eslint-disable-line camelcase
        });
    }

    //                                      ##   #                             ##
    //                                     #  #  #                              #
    // ###    ##   # #    ##   # #    ##   #     ###    ###  ###   ###    ##    #
    // #  #  # ##  ####  #  #  # #   # ##  #     #  #  #  #  #  #  #  #  # ##   #
    // #     ##    #  #  #  #  # #   ##    #  #  #  #  # ##  #  #  #  #  ##     #
    // #      ##   #  #   ##    #     ##    ##   #  #   # #  #  #  #  #   ##   ###
    /**
     * Removes a channel.
     * @param {Channel} channel The channel to remove.
     * @returns {Promise} A promise that resolves when the channel has been removed.
     */
    static removeChannel(channel) {
        return channel.delete();
    }
}

module.exports = Discord;
