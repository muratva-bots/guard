import { ChannelModel, GuildModel, RoleModel } from '@/models';
import { ChannelType, EmbedBuilder, GuildChannel, Message, inlineCode } from 'discord.js';

export async function checkChannels(question: Message) {
    await GuildModel.updateOne(
        { id: question.guildId },
        { $set: { 'settings.guard.lastChannelControl': Date.now() } },
        { upsert: true },
    );

    const embed = new EmbedBuilder(question.embeds[0]);
    const channels = await ChannelModel.find();
    const deletedChannels = channels.filter((channel) => !question.guild.channels.cache.has(channel.id));
    if (!deletedChannels.length) {
        question.edit({ components: [], embeds: [embed.setDescription('Silinmiş kanal bulunmuyor.')] });
        return;
    }

    question.edit({ components: [], embeds: [embed.setDescription(`Kanallar kuruluyor... (${inlineCode('0%')})`)] });

    const sortedChannels = [
        ...deletedChannels.filter((channel) => channel.type === ChannelType.GuildCategory),
        ...deletedChannels.filter((channel) => channel.type !== ChannelType.GuildCategory),
    ];
    for (let i = 0; i < sortedChannels.length; i++) {
        const deletedChannel = sortedChannels[i];
        const newChannel = (await question.guild.channels.create({
            name: deletedChannel.name,
            nsfw: deletedChannel.nsfw,
            parent: deletedChannel.parent,
            type: deletedChannel.type,
            topic: deletedChannel.topic,
            position: deletedChannel.position,
            userLimit: deletedChannel.userLimit,
        })) as GuildChannel;
        deletedChannel.permissionOverwrites.forEach((p) => newChannel.permissionOverwrites.create(p.id, p.permissions));
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

        if (i % 5 === 0)
            question.edit({
                embeds: [
                    embed.setDescription(
                        `Kanallar oluşturuluyor... (${inlineCode(
                            `%${Math.round(((i + 1) / sortedChannels.length) * 100)}`,
                        )})`,
                    ),
                ],
            });
    }

    question.edit({ embeds: [embed.setDescription('Kanallar oluşturuldu ve izinler ayarlandı.')] });
}
