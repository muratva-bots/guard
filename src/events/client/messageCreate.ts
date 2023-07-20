import { Events } from 'discord.js';

const MessageCreate: Guard.IEvent<Events.MessageCreate> = {
    name: Events.MessageCreate,
    execute: (client, message) => {
        if (!message.content.startsWith(client.config.PREFIX)) return;

        // const ownerID =
        //     client.application.owner instanceof Team
        //         ? (client.application.owner as Team).ownerId
        //         : client.application.owner.id;
        // if (message.author.id !== ownerID) return;

        // const safe = client.safes.get(message.author.id);
        // if (!safe || !safe.includes(SafeFlags.Full)) return;

        const [commandName, ...args] = message.content.slice(client.config.PREFIX.length).trim().split(' ');
        const command = client.commands.find((command) => command.usages.includes(commandName.toLowerCase()));
        if (!command) return;

        const guildData = client.servers.get(message.guildId);
        command.execute({ client, message, args, guildData });
    },
};

export default MessageCreate;
