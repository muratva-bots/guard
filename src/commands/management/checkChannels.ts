import { ChannelModel, RoleModel } from '@/models';
import { ActionRowBuilder, ButtonBuilder, ChannelType, GuildChannel, Message } from 'discord.js';

export async function checkChannels(question: Message, row: ActionRowBuilder<ButtonBuilder>) {
    const channels = await ChannelModel.find();
    const deletedChannels = channels.filter((channel) => !question.guild.channels.cache.has(channel.id));
    if (!deletedChannels.length) return;

    (row.components[1] as ButtonBuilder).setDisabled(true);
    question.edit({ components: [row] });

    const sortedChannels = [
        ...deletedChannels.filter((channel) => channel.type === ChannelType.GuildCategory),
        ...deletedChannels.filter((channel) => channel.type !== ChannelType.GuildCategory),
    ];
    for (const deletedChannel of sortedChannels) {
        const newChannel = (await question.guild.channels.create({
            name: deletedChannel.name,
            nsfw: deletedChannel.nsfw,
            parent: deletedChannel.parent,
            type: deletedChannel.type,
            topic: deletedChannel.topic,
            position: deletedChannel.position,
            permissionOverwrites: deletedChannel.permissionOverwrites,
            userLimit: deletedChannel.userLimit,
        })) as GuildChannel;
        await RoleModel.updateMany(
            { 'channelOverwrites.$.id': deletedChannel.id },
            { $set: { 'channelOverwrites.$.id': newChannel.id } },
        );
        await ChannelModel.updateOne({ id: deletedChannel.id }, { id: newChannel.id });

        if (newChannel.type === ChannelType.GuildCategory) {
            for (const parentChannel of deletedChannels.filter((channel) => channel.parent === deletedChannel.id)) {
                parentChannel.parent = newChannel.id;
            }
            await ChannelModel.updateMany({ parent: deletedChannel.id }, { $set: { parent: newChannel.id } });

            const parentChannels = channels.filter((channel) => channel.parent === deletedChannel.id);
            for (const parentChannel of parentChannels) {
                const channel = question.guild.channels.cache.get(parentChannel.id) as GuildChannel;
                if (channel)
                    await channel.setParent(newChannel.id, {
                        lockPermissions: false,
                    });
            }
        }
    }
}
