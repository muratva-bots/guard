import { GuildModel } from '@/models';
import { Events, inlineCode, codeBlock, EmbedBuilder } from 'discord.js';
import ms from 'ms';

const limits = [
    {
        name: 'Sunucu Ayar Koruması',
        value: 'general',
        count: 'generalLimitCount',
        time: 'generalLimitTime',
    },
    {
        name: 'Rol Koruması',
        value: 'role',
        count: 'roleLimitCount',
        time: 'roleLimitTime',
    },
    {
        name: 'Kanal Koruması',
        value: 'channel',
        count: 'channelLimitCount',
        time: 'channelLimitTime',
    },
    {
        name: 'Emoji Koruması',
        value: 'emoji',
        count: 'emojiLimitCount',
        time: 'emojiLimitTime',
    },
    {
        name: 'Çıkartma Koruması',
        value: 'sticker',
        count: 'stickerLimitCount',
        time: 'stickerLimitTime',
    },
    {
        name: 'Yasaklama & Atma Koruması',
        value: 'banKick',
        count: 'banKickLimitCount',
        time: 'banKickLimitTime',
    },
    {
        name: 'Bağlantı Kesme Koruması',
        value: 'voiceKick',
        count: 'voiceKickLimitCount',
        time: 'voiceKickLimitTime',
    },
];

const InteractionCreate: Guard.IEvent<Events.InteractionCreate> = {
    name: Events.InteractionCreate,
    execute: async (client, interaction) => {
        if (!interaction.isModalSubmit() || !interaction.customId.startsWith('limit')) return;

        const guildData = client.servers.get(interaction.guildId);
        if (!guildData) return;

        const time = interaction.fields.getTextInputValue('time');
        if (!ms(time)) {
            interaction.reply({ content: 'Geçerli bir zaman belirt! (15m)', ephemeral: true });
            return;
        }

        const count = interaction.fields.getTextInputValue('count');
        if (!Number(count)) {
            interaction.reply({ content: 'Geçerli bir adet belirt! (5)', ephemeral: true });
            return;
        }

        const limit = limits.find((l) => l.value === interaction.customId.split('-')[1]);
        guildData.settings[limit.time] = ms(time);
        guildData.settings[limit.count] = count;
        await GuildModel.updateOne(
            { id: interaction.guildId },
            {
                $set: {
                    [`settings.guard.${limit.time}`]: guildData.settings[limit.time],
                    [`settings.guard.${limit.count}`]: guildData.settings[limit.count],
                },
            },
            { upsert: true },
        );

        interaction.message.edit({
            embeds: [
                new EmbedBuilder({
                    color: client.utils.getRandomColor(),
                    author: {
                        name: interaction.user.username,
                        icon_url: interaction.user.displayAvatarURL({
                            forceStatic: true,
                            size: 4096,
                        }),
                    },
                    description: [
                        `Merhaba ${interaction.user} (${inlineCode(
                            interaction.user.id,
                        )}) koruma botu limit menüsüne hoşgeldin,\n`,
                        codeBlock(
                            'yaml',
                            [
                                `# ${interaction.guild.name} Sunucusunun Koruma Sistemi (Sistem Durumu: )`,
                                limits
                                    .map(
                                        (l) =>
                                            `→ ${l.name}: ${ms(
                                                guildData.settings[l.time] || client.config.DEFAULTS.LIMIT.TIME,
                                            )} süre içinde ${
                                                guildData.settings[l.count] || client.config.DEFAULTS.LIMIT.COUNT
                                            }`,
                                    )
                                    .join('\n'),
                            ].join('\n'),
                        ),
                    ].join('\n'),
                }),
            ],
        });

        await interaction.reply({
            content: 'Limit ayarları başarıyla güncellendi!',
            ephemeral: true,
        });
    },
};

export default InteractionCreate;
