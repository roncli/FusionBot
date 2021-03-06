const DiscordJs = require("discord.js"),

    Commands = require("./commands"),
    Exception = require("./exception"),
    Log = require("./log"),
    settings = require("./settings"),
    Warning = require("./warning"),

    discord = new DiscordJs.Client(settings.discord),
    guildName = settings.server,
    messageParse = /^!([^ ]+)(?: +(.*[^ ]))? *$/,
    noPermissions = {
        CREATE_INSTANT_INVITE: false,
        ADD_REACTIONS: false,
        VIEW_CHANNEL: false,
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
        VIEW_CHANNEL: true,
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

let alertsChannel,
    archiveCategory,
    chatCategory,
    eventRole,
    finalsTournamentAcceptedRole,
    finalsTournamentDeclinedRole,
    finalsTournamentInvitedRole,
    generalChannel,
    obsGuild,
    pilotsChatCategory,
    pilotsVoiceChatCategory,
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

    //       ##                 #            ##   #                             ##
    //        #                 #           #  #  #                              #
    //  ###   #     ##   ###   ###    ###   #     ###    ###  ###   ###    ##    #
    // #  #   #    # ##  #  #   #    ##     #     #  #  #  #  #  #  #  #  # ##   #
    // # ##   #    ##    #      #      ##   #  #  #  #  # ##  #  #  #  #  ##     #
    //  # #  ###    ##   #       ##  ###     ##   #  #   # #  #  #  #  #   ##   ###
    /**
     * The alerts channel.
     * @returns {TextChannel} The alerts channel.
     */
    static get alertsChannel() {
        return alertsChannel;
    }

    //                          ##     #            ##   #                             ##
    //                           #     #           #  #  #                              #
    // ###    ##    ###   #  #   #    ###    ###   #     ###    ###  ###   ###    ##    #
    // #  #  # ##  ##     #  #   #     #    ##     #     #  #  #  #  #  #  #  #  # ##   #
    // #     ##      ##   #  #   #     #      ##   #  #  #  #  # ##  #  #  #  #  ##     #
    // #      ##   ###     ###  ###     ##  ###     ##   #  #   # #  #  #  #  #   ##   ###
    /**
     * The results channel.
     * @returns {TextChannel} The results channel.
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

    //    #          #               ##     #    ###         ##
    //    #         # #               #     #    #  #         #
    //  ###   ##    #     ###  #  #   #    ###   #  #   ##    #     ##
    // #  #  # ##  ###   #  #  #  #   #     #    ###   #  #   #    # ##
    // #  #  ##     #    # ##  #  #   #     #    # #   #  #   #    ##
    //  ###   ##    #     # #   ###  ###     ##  #  #   ##   ###    ##
    /**
     * The default role for the server.
     * @returns {Role} The server's default role.
     */
    static get defaultRole() {
        return obsGuild.defaultRole;
    }

    //   #    #                ##           ###                                                    #     ##                            #             #  ###         ##
    //  # #                     #            #                                                     #    #  #                           #             #  #  #         #
    //  #    ##    ###    ###   #     ###    #     ##   #  #  ###   ###    ###  # #    ##   ###   ###   #  #   ##    ##    ##   ###   ###    ##    ###  #  #   ##    #     ##
    // ###    #    #  #  #  #   #    ##      #    #  #  #  #  #  #  #  #  #  #  ####  # ##  #  #   #    ####  #     #     # ##  #  #   #    # ##  #  #  ###   #  #   #    # ##
    //  #     #    #  #  # ##   #      ##    #    #  #  #  #  #     #  #  # ##  #  #  ##    #  #   #    #  #  #     #     ##    #  #   #    ##    #  #  # #   #  #   #    ##
    //  #    ###   #  #   # #  ###   ###     #     ##    ###  #     #  #   # #  #  #   ##   #  #    ##  #  #   ##    ##    ##   ###     ##   ##    ###  #  #   ##   ###    ##
    //                                                                                                                          #
    /**
     * The Finals Tournament - Accepted role.
     * @returns {Role} The Finals Tournament - Accepted role
     */
    static get finalsTournamentAcceptedRole() {
        return finalsTournamentAcceptedRole;
    }

    //   #    #                ##           ###                                                    #    ###               ##     #                   #  ###         ##
    //  # #                     #            #                                                     #    #  #               #                         #  #  #         #
    //  #    ##    ###    ###   #     ###    #     ##   #  #  ###   ###    ###  # #    ##   ###   ###   #  #   ##    ##    #    ##    ###    ##    ###  #  #   ##    #     ##
    // ###    #    #  #  #  #   #    ##      #    #  #  #  #  #  #  #  #  #  #  ####  # ##  #  #   #    #  #  # ##  #      #     #    #  #  # ##  #  #  ###   #  #   #    # ##
    //  #     #    #  #  # ##   #      ##    #    #  #  #  #  #     #  #  # ##  #  #  ##    #  #   #    #  #  ##    #      #     #    #  #  ##    #  #  # #   #  #   #    ##
    //  #    ###   #  #   # #  ###   ###     #     ##    ###  #     #  #   # #  #  #   ##   #  #    ##  ###    ##    ##   ###   ###   #  #   ##    ###  #  #   ##   ###    ##
    /**
     * The Finals Tournament - Declined role.
     * @returns {Role} The Finals Tournament - Declined role
     */
    static get finalsTournamentDeclinedRole() {
        return finalsTournamentDeclinedRole;
    }


    //   #    #                ##           ###                                                    #    ###                #     #             #  ###         ##
    //  # #                     #            #                                                     #     #                       #             #  #  #         #
    //  #    ##    ###    ###   #     ###    #     ##   #  #  ###   ###    ###  # #    ##   ###   ###    #    ###   # #   ##    ###    ##    ###  #  #   ##    #     ##
    // ###    #    #  #  #  #   #    ##      #    #  #  #  #  #  #  #  #  #  #  ####  # ##  #  #   #     #    #  #  # #    #     #    # ##  #  #  ###   #  #   #    # ##
    //  #     #    #  #  # ##   #      ##    #    #  #  #  #  #     #  #  # ##  #  #  ##    #  #   #     #    #  #  # #    #     #    ##    #  #  # #   #  #   #    ##
    //  #    ###   #  #   # #  ###   ###     #     ##    ###  #     #  #   # #  #  #   ##   #  #    ##  ###   #  #   #    ###     ##   ##    ###  #  #   ##   ###    ##
    /**
     * The Finals Tournament - Invited role.
     * @returns {Role} The Finals Tournament - Invited role
     */
    static get finalsTournamentInvitedRole() {
        return finalsTournamentInvitedRole;
    }

    //                   #      #                 ##          #
    //                   #                       #  #         #
    //  ###  ###    ##   ###   ##    # #    ##   #      ###  ###    ##    ###   ##   ###   #  #
    // #  #  #  #  #     #  #   #    # #   # ##  #     #  #   #    # ##  #  #  #  #  #  #  #  #
    // # ##  #     #     #  #   #    # #   ##    #  #  # ##   #    ##     ##   #  #  #      # #
    //  # #  #      ##   #  #  ###    #     ##    ##    # #    ##   ##   #      ##   #       #
    //                                                                    ###               #
    /**
     * Gets the archive category.
     * @returns {TextChannel} The archive category.
     */
    static get archiveCategory() {
        return archiveCategory;
    }

    //       #            #     ##          #
    //       #            #    #  #         #
    //  ##   ###    ###  ###   #      ###  ###    ##    ###   ##   ###   #  #
    // #     #  #  #  #   #    #     #  #   #    # ##  #  #  #  #  #  #  #  #
    // #     #  #  # ##   #    #  #  # ##   #    ##     ##   #  #  #      # #
    //  ##   #  #   # #    ##   ##    # #    ##   ##   #      ##   #       #
    //                                                  ###               #
    /**
     * Gets the chat category.
     * @returns {TextChannel} The chat category.
     */
    static get chatCategory() {
        return chatCategory;
    }

    //        #    ##           #            ##   #            #     ##          #
    //              #           #           #  #  #            #    #  #         #
    // ###   ##     #     ##   ###    ###   #     ###    ###  ###   #      ###  ###    ##    ###   ##   ###   #  #
    // #  #   #     #    #  #   #    ##     #     #  #  #  #   #    #     #  #   #    # ##  #  #  #  #  #  #  #  #
    // #  #   #     #    #  #   #      ##   #  #  #  #  # ##   #    #  #  # ##   #    ##     ##   #  #  #      # #
    // ###   ###   ###    ##     ##  ###     ##   #  #   # #    ##   ##    # #    ##   ##   #      ##   #       #
    // #                                                                                     ###               #
    /**
     * Gets the pilots chat category.
     * @returns {TextChannel} The pilots chat category.
     */
    static get pilotsChatCategory() {
        return pilotsChatCategory;
    }

    //        #    ##           #           #  #         #                 ##   #            #     ##          #
    //              #           #           #  #                          #  #  #            #    #  #         #
    // ###   ##     #     ##   ###    ###   #  #   ##   ##     ##    ##   #     ###    ###  ###   #      ###  ###    ##    ###   ##   ###   #  #
    // #  #   #     #    #  #   #    ##     #  #  #  #   #    #     # ##  #     #  #  #  #   #    #     #  #   #    # ##  #  #  #  #  #  #  #  #
    // #  #   #     #    #  #   #      ##    ##   #  #   #    #     ##    #  #  #  #  # ##   #    #  #  # ##   #    ##     ##   #  #  #      # #
    // ###   ###   ###    ##     ##  ###     ##    ##   ###    ##    ##    ##   #  #   # #    ##   ##    # #    ##   ##   #      ##   #       #
    // #                                                                                                                   ###               #
    /**
     * Gets the pilots voice chat category.
     * @returns {VoiceChannel} The pilots voice chat category.
     */
    static get pilotsVoiceChatCategory() {
        return pilotsVoiceChatCategory;
    }

    //                                       ###         ##
    //                                       #  #         #
    //  ###    ##    ###   ###    ##   ###   #  #   ##    #     ##
    // ##     # ##  #  #  ##     #  #  #  #  ###   #  #   #    # ##
    //   ##   ##    # ##    ##   #  #  #  #  # #   #  #   #    ##
    // ###     ##    # #  ###     ##   #  #  #  #   ##   ###    ##
    /**
     * Gets the current season participant role.
     * @returns {Role} The season role.
     */
    static get seasonRole() {
        return seasonRole;
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
     * @param {number} season The current season number.
     * @returns {void}
     */
    static startup(season) {
        discord.addListener("ready", () => {
            Log.log("Connected to Discord.");

            obsGuild = discord.guilds.find((g) => g.name === guildName);

            alertsChannel = obsGuild.channels.find((c) => c.name === "fusionbot-alerts");
            generalChannel = obsGuild.channels.find((c) => c.name === "general");
            resultsChannel = obsGuild.channels.find((c) => c.name === "match-results");

            eventRole = obsGuild.roles.find((r) => r.name === "In Current Event");
            finalsTournamentAcceptedRole = obsGuild.roles.find((r) => r.name === "Finals Tournament - Accepted");
            finalsTournamentDeclinedRole = obsGuild.roles.find((r) => r.name === "Finals Tournament - Declined");
            finalsTournamentInvitedRole = obsGuild.roles.find((r) => r.name === "Finals Tournament - Invited");
            if (!seasonRole) {
                seasonRole = obsGuild.roles.find((r) => r.name === `Season ${season} Participant`);
            }

            archiveCategory = obsGuild.channels.find((c) => c.name === "Archive");
            chatCategory = obsGuild.channels.find((c) => c.name === "Chat");
            pilotsChatCategory = obsGuild.channels.find((c) => c.name === "Pilots Chat");
            pilotsVoiceChatCategory = obsGuild.channels.find((c) => c.name === "Pilots Voice Chat");

            if (!Discord.commands) {
                Discord.commands = new Commands();
            }
        });

        discord.on("disconnect", (ev) => {
            Log.exception("Disconnected from Discord.", ev);
        });

        discord.on("error", (ev) => {
            Log.exception("Unhandled error.", ev);
        });

        discord.addListener("message", (message) => {
            if (!message.guild || message.guild.name === guildName && message.channel.type === "text") {
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
     * @returns {Promise} A promise that resolves when the connection is complete.
     */
    static async connect() {
        Log.log("Connecting to Discord...");

        try {
            await discord.login(settings.discord.token);
        } catch (err) {
            Log.exception("Error connecting to Discord, will automatically retry.", err);
            return;
        }

        Log.log("Connected.");
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
        return discord && obsGuild ? discord.status === 0 : false;
    }

    // # #    ##    ###    ###    ###   ###   ##
    // ####  # ##  ##     ##     #  #  #  #  # ##
    // #  #  ##      ##     ##   # ##   ##   ##
    // #  #   ##   ###    ###     # #  #      ##
    //                                  ###
    /**
     * Parses a message.
     * @param {User} user The user who sent the message.
     * @param {string} message The text of the message.
     * @param {TextChannel} channel The channel the message was sent on.
     * @returns {Promise} A promise that resolves when the message is parsed.
     */
    static async message(user, message, channel) {
        for (const text of message.split("\n")) {
            const matches = messageParse.exec(text);

            if (matches) {
                const command = matches[1].toLocaleLowerCase(),
                    args = matches[2];

                if (Object.getOwnPropertyNames(Commands.prototype).filter((p) => typeof Commands.prototype[p] === "function" && p !== "constructor").indexOf(command) !== -1) {
                    let success;
                    try {
                        success = await Discord.commands[command](user, args, channel);
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
    static async queue(message, channel) {
        if (!channel) {
            channel = generalChannel;
        }

        const msg = {
            embed: {
                description: message,
                timestamp: new Date(),
                color: 0x263686,
                footer: {icon_url: Discord.icon, text: "DescentBot"}
            }
        };

        try {
            if (JSON.stringify(msg).length > 1024) {
                while (message.length > 0) {
                    await channel.send(message.substr(0, 2000));
                    if (message.length > 2000) {
                        message = message.substr(2000, message.length - 2000);
                    } else {
                        message = "";
                    }
                }
                return void 0;
            }

            return await channel.send(
                "",
                {
                    embed: {
                        description: message,
                        timestamp: new Date(),
                        color: 0x263686,
                        footer: {icon_url: Discord.icon, text: "DescentBot"}
                    }
                }
            );
        } catch (err) {
            console.log("Could not send queue.");
            console.log(message);
            console.log(err);
            return void 0;
        }
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
    static async richQueue(message, channel) {
        if (!channel) {
            channel = generalChannel;
        }

        try {
            return await channel.send("", message);
        } catch (err) {
            console.log("Could not send rich queue.");
            console.log(message);
            console.log(err);
            return void 0;
        }
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
        return discord.users.find((u) => u.id === id);
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
     * @param {User|string} user The Discord user.
     * @returns {GuildMember} The guild member.
     */
    static getGuildUser(user) {
        return obsGuild.members.find((u) => u.id === user || u.id === user.id);
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
        return obsGuild.channels.find((c) => c.name === name);
    }

    //   #    #             #   ##   #                             ##    ###         ###      #
    //  # #                 #  #  #  #                              #    #  #         #       #
    //  #    ##    ###    ###  #     ###    ###  ###   ###    ##    #    ###   #  #   #     ###
    // ###    #    #  #  #  #  #     #  #  #  #  #  #  #  #  # ##   #    #  #  #  #   #    #  #
    //  #     #    #  #  #  #  #  #  #  #  # ##  #  #  #  #  ##     #    #  #   # #   #    #  #
    //  #    ###   #  #   ###   ##   #  #   # #  #  #  #  #   ##   ###   ###     #   ###    ###
    //                                                                          #
    /**
     * Finds a Discord channel by its ID.
     * @param {string} id The ID of the channel.
     * @returns {Channel} The Discord channel.
     */
    static findChannelById(id) {
        return obsGuild.channels.find((c) => c.id === id);
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
        return obsGuild.roles.find((r) => r.name === name);
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
        return obsGuild.roles.find((r) => r.id === id);
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

    //               #    ###         ##          ###                 #     #     #                 ##     #    #
    //               #    #  #         #          #  #                      #                      #  #   # #   #
    //  ###    ##   ###   #  #   ##    #     ##   #  #   ##    ###   ##    ###   ##     ##   ###   #  #   #    ###    ##   ###
    // ##     # ##   #    ###   #  #   #    # ##  ###   #  #  ##      #     #     #    #  #  #  #  ####  ###    #    # ##  #  #
    //   ##   ##     #    # #   #  #   #    ##    #     #  #    ##    #     #     #    #  #  #  #  #  #   #     #    ##    #
    // ###     ##     ##  #  #   ##   ###    ##   #      ##   ###    ###     ##  ###    ##   #  #  #  #   #      ##   ##   #
    /**
     * Sets the position of role1 to be after role 2.
     * @param {Role} role1 The role to put before role2.
     * @param {Role} role2 The role to pput role1 before.
     * @returns {Promise} A promise that resolves when the role has been placed.
     */
    static setRolePositionAfter(role1, role2) {
        return role1.setPosition(role2.calculatedPosition - role1.calculatedPosition + (role1.calculatedPosition > role2.calculatedPosition ? 1 : 0) - 1, true);
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
     * @returns {Promise<TextChannel>} A promise that resolves with the text channel created.
     */
    static async createTextChannel(name, category) {
        const channel = await obsGuild.createChannel(name, {type: "text"});
        if (category) {
            await channel.setParent(category);
        }
        return channel;
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
     * @returns {Promise<VoiceChannel>} A promise that resolves with the voice channel created.
     */
    static async createVoiceChannel(name, category) {
        const channel = await obsGuild.createChannel(name, {type: "voice"});
        if (category) {
            await channel.setParent(category);
        }
        return channel;
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

    //               #     ##                                  ###         ##
    //               #    #  #                                 #  #         #
    //  ###    ##   ###    #     ##    ###   ###    ##   ###   #  #   ##    #     ##
    // ##     # ##   #      #   # ##  #  #  ##     #  #  #  #  ###   #  #   #    # ##
    //   ##   ##     #    #  #  ##    # ##    ##   #  #  #  #  # #   #  #   #    ##
    // ###     ##     ##   ##    ##    # #  ###     ##   #  #  #  #   ##   ###    ##
    /**
     * Sets the season role.
     * @param {Role} role The role to set as the season role.
     * @returns {void}
     */
    static setSeasonRole(role) {
        seasonRole = role;
    }
}

module.exports = Discord;
