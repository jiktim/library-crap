/**
 * @file SlashLib D.JS https://github.com/jiktim/library-crap
 * @description An ES6 extension to Discord.JS to use slash commands while waiting for the official
 *              implementation.
 *              ! This library was tested as working with discord.js v12.5.3 !
 * @author lambdagg <lambdagg@jikt.im>
 * @license AGPL-3.0-or-later
 * @version 0.1.0
 */

import { Client, MessageEmbed, APIMessage } from 'discord.js';

/**
 * @typedef {Object} Command
 * @property {string} [guildId]
 * @property {string} name
 * @property {string} description
 * @property {CommandOption[]} [options]
 * @property {CommandCallback} callback
 */

/**
 * @typedef {Object} CommandOption
 * @property {string} name
 * @property {string} description
 * @property {number} type
 * @property {boolean} required
 * @property {CommandOptionChoice[]} [choices]
 */

/**
 * @typedef {Object} CommandOptionChoice
 * @property {string} name
 * @property {string} value
 */

/**
 * What to do when a command gets executed?
 * @callback CommandCallback
 * @param {CommandOption[]} args Arguments given when executing the command
 * @param {import('discord.js').TextChannel} chan The channel where this command has been executed
 * @param {import('discord.js').User} author The command executor
 * @param {CommandReplyCallback} reply A function to call to reply to the interaction
 * @param {Interaction} interaction The raw interaction object
 */

/**
 * Replies to an interaction
 * @callback CommandReplyCallback
 * @param {import('discord.js').StringResolvable | APIMessage} content The content to send
 */

/**
 * @typedef {Object} Interaction
 * https://discord.com/developers/docs/interactions/slash-commands#interaction-applicationcommandinteractiondata
 */

/**
 * Represents the Slash Library, an extension to Discord.JS to use slash commands while waiting for
 * the official implementation
 */
export default class SlashLib {
  /**
   * @param {Client} client
   */
  constructor(client) {
    if (!(client instanceof Client)) throw new Error('Given arg "client" was not an instance of djs.Client');

    /**
     * @type {Client}
     */
    this.client = client;

    /**
     * @type {Command[]}
     */
    this.commands = [];

    client.on('raw', (event) => {
      if (event.t !== 'INTERACTION_CREATE' || !client.readyAt) return;

      /**
       * @type {Interaction}
       */
      const inter = event.d;

      /**
       * @type {Command}
       */
      const command = this.commands.filter((c) => c.name === inter.data.name.toLowerCase())[0];

      if (!command) return;

      /**
       * @type {import('discord.js').Guild}
       */
      const guild = client.guilds.cache.get(inter.guild_id);

      /**
       * @type {import('discord.js').TextChannel}
       */
      const channel = guild.channels.cache.get(inter.channel_id);

      /**
       * @type {import('discord.js').User}
       */
      const author = client.users.resolve(inter.member.user.id);

      /**
       * @type {CommandOption[]}
       */
      const args = {};

      inter.data.options?.forEach((item, index, arr) => {
        args[item.name] = item.value;
        if (index === arr.length - 1) {
          command.callback(args, channel, author, async (message) => {
            let data = { content: message };
            if (message instanceof MessageEmbed) {
              const { data: _, files } = await APIMessage
                .create(this.client.channels.resolve(inter.channel_id), message)
                .resolveData()
                .resolveFiles();
              data = { ..._, files };
            }
            this.client.api.interactions(inter.id, inter.token).callback.post({
              data: {
                type: 4,
                data,
              },
            });
          }, inter); // function callback(args, chan, author, reply, interaction) {...}
        }
      });
    });

    client.on('ready', () => this.commands.forEach((c) => this.postCommand(c.guildId, c)));
  }

  /**
   * Get an application from the D.JS client.api object
   * @param {string} guildId
   * @returns The application
   */
  apiApp(guildId) {
    const _ = this.client.api.applications(this.client.user.id);
    if (guildId) _.guilds(guildId);
    return _;
  }

  clearCommands(guildId) {
    return new Promise((res) => {
      Promise.resolve(this.getCommands(guildId)).then((arr) => {
        if (!arr.length) res();
        arr.forEach(async (cmd, index) => {
          await this.deleteCommand(guildId, cmd.id);
          if (index === arr.length - 1) res();
        });
      });
    });
  }

  async getCommands(guildId) {
    return this.apiApp(guildId).commands.get();
  }

  deleteCommand(guildId, commandId) {
    return this.apiApp(guildId).commands(commandId).delete();
  }

  /**
   * @param {guildId} guildId
   * @param {Command} command
   */
  async registerCommand(command) {
    if (!this.client.readyAt) return;
    const {
      guildId, name, description, options, callback,
    } = command;
    const data = {
      guildId,
      name: name.toLowerCase(),
      description,
      options,
      callback,
    };
    if (this.client.readyAt) await this.postCommand(data);
    this.commands = this.commands.filter((c) => c.name !== name);
    this.commands.push(data);
  }

  /**
   * @private
   * @param {string} guildId
   * @param {Command} command
   */
  async postCommand(command) {
    const {
      guildId, name, description, options,
    } = command;
    await this.apiApp(guildId).commands.post({ data: { name, description, options } });
  }
}


