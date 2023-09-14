import { Events } from 'discord.js';

const MessageCreate: Guard.IEvent<Events.MessageCreate> = {
    name: Events.MessageCreate,
    execute: (client, message) => {
        if (
            !message.content ||
            message.author.bot ||
            !message.guild ||
            !message.content.startsWith(client.config.PREFIX)
        )
            return;

        if (!client.config.BOT_OWNERS.includes(message.author.id)) return;

        const [commandName, ...args] = message.content.slice(client.config.PREFIX.length).trim().split(' ');
        const command = client.commands.find((command) => command.usages.includes(commandName.toLowerCase()));
        if (!command) return;

        const guildData = client.servers.get(message.guildId);
        command.execute({ client, message, args, guildData });
    },
};

export default MessageCreate;
