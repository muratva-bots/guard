import { ChannelClass, ChannelModel, GuildModel, RoleModel } from '@/models';
import {
    ChannelType,
    EmbedBuilder,
    GuildChannel,
    GuildChannelCreateOptions,
    GuildPremiumTier,
    Message,
    inlineCode,
} from 'discord.js';

const MaxBitratePerTier = {
    [GuildPremiumTier.None]: 64000,
    [GuildPremiumTier.Tier1]: 128000,
    [GuildPremiumTier.Tier2]: 256000,
    [GuildPremiumTier.Tier3]: 384000,
};

export async function checkChannels(question: Message, channels: ChannelClass[]) {
    await GuildModel.updateOne(
        { id: question.guildId },
        { $set: { 'guard.lastChannelDistribution': Date.now() } },
        { upsert: true },
    );

    const embed = new EmbedBuilder(question.embeds[0]);
    const deletedChannels = channels.filter((channel) => !question.guild.channels.cache.has(channel.id));

    question.edit({ components: [], embeds: [embed.setDescription(`Kanallar kuruluyor... (${inlineCode('0%')})`)] });

    const sortedChannels = [
        ...deletedChannels.filter((channel) => channel.type === ChannelType.GuildCategory),
        ...deletedChannels.filter((channel) => channel.type !== ChannelType.GuildCategory),
    ];
    for (let i = 0; i < sortedChannels.length; i++) {
        const deletedChannel = sortedChannels[i];

        const createOptions: GuildChannelCreateOptions = {
            name: deletedChannel.name,
            type: deletedChannel.type,
            position: deletedChannel.position,
        };

        if (deletedChannel.type === ChannelType.GuildText || deletedChannel.type === ChannelType.GuildAnnouncement) {
            createOptions.topic = deletedChannel.topic;
            createOptions.nsfw = deletedChannel.nsfw;
            createOptions.rateLimitPerUser = deletedChannel.rateLimitPerUser;
            if (deletedChannel.parent) createOptions.parent = deletedChannel.parent;
        } else if (deletedChannel.type === ChannelType.GuildVoice) {
            let bitrate = deletedChannel.bitrate;
            const bitrates = Object.values(MaxBitratePerTier);
            while (bitrate > MaxBitratePerTier[question.guild.premiumTier]) {
                bitrate = bitrates[question.guild.premiumTier];
            }
            createOptions.bitrate = bitrate;
            createOptions.userLimit = deletedChannel.userLimit;
            if (deletedChannel.parent) createOptions.parent = deletedChannel.parent;
        }

        const newChannel = (await question.guild.channels.create(createOptions)) as GuildChannel;
        deletedChannel.permissionOverwrites
            .filter((p) => question.guild.roles.cache.has(p.id) || question.guild.members.cache.has(p.id))
            .forEach((p) => {
                newChannel.permissionOverwrites.create(p.id, p.permissions);
            });
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
