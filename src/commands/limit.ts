import { GuildModel } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextInputBuilder,
    TextInputStyle,
    codeBlock,
    inlineCode,
} from 'discord.js';
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

const Limit: Guard.ICommand = {
    usages: ['limit'],
    execute: async ({ client, message, guildData }) => {
        const row = new ActionRowBuilder<StringSelectMenuBuilder>({
            components: [
                new StringSelectMenuBuilder({
                    custom_id: 'guard-limit',
                    placeholder: 'Limitini değişeceğiniz ayarı seçin!',
                    options: limits.map((l) => ({
                        label: l.name,
                        value: l.value,
                    })),
                }),
            ],
        });

        const embed = new EmbedBuilder({
            color: client.utils.getRandomColor(),
            author: {
                name: message.author.username,
                icon_url: message.author.displayAvatarURL({
                    forceStatic: true,
                    size: 4096,
                }),
            },
        });

        const question = await message.channel.send({
            embeds: [
                embed.setDescription(
                    [
                        `Merhaba ${message.author} (${inlineCode(
                            message.author.id,
                        )}) koruma botu limit menüsüne hoşgeldin,\n`,
                        codeBlock(
                            'yaml',
                            [
                                `# ${message.guild.name} Sunucusunun Limit Sistemi`,
                                limits
                                    .map(
                                        (l) =>
                                            `→ ${l.name}: ${ms(
                                                guildData[l.time] || client.config.DEFAULTS.LIMIT.TIME,
                                            )} süre içinde ${guildData[l.count] || client.config.DEFAULTS.LIMIT.COUNT}`,
                                    )
                                    .join('\n'),
                            ].join('\n'),
                        ),
                    ].join('\n'),
                ),
            ],
            components: [row],
        });

        const filter = (i: StringSelectMenuInteraction) => i.user.id === message.author.id && i.isStringSelectMenu();
        const collector = await question.createMessageComponentCollector({
            filter,
            componentType: ComponentType.StringSelect,
            time: 1000 * 60 * 3,
        });

        collector.on('collect', async (i: StringSelectMenuInteraction) => {
            const limit = limits.find((l) => l.value === i.values[0]);

            const row = new ActionRowBuilder<TextInputBuilder>({
                components: [
                    new TextInputBuilder({
                        custom_id: 'count',
                        max_length: 2,
                        label: 'Adet',
                        placeholder: '5',
                        style: TextInputStyle.Short,
                    }),
                ],
            });
            const rowTwo = new ActionRowBuilder<TextInputBuilder>({
                components: [
                    new TextInputBuilder({
                        custom_id: 'time',
                        max_length: 3,
                        label: 'Süre',
                        placeholder: '15m',
                        style: TextInputStyle.Short,
                    }),
                ],
            });

            const modal = new ModalBuilder({
                custom_id: `limit-${limit.value}`,
                title: limit.name,
                components: [row, rowTwo],
            });

            await i.showModal(modal);

            const modalCollected = await i.awaitModalSubmit({
                filter: (i) => i.user.id === message.author.id,
                time: 1000 * 60 * 5,
            });
            if (modalCollected) {
                const time = modalCollected.fields.getTextInputValue('time');
                if (!ms(time)) {
                    modalCollected.reply({ content: 'Geçerli bir zaman belirt! (15m)', ephemeral: true });
                    return;
                }

                const count = modalCollected.fields.getTextInputValue('count');
                if (!Number(count)) {
                    modalCollected.reply({ content: 'Geçerli bir adet belirt! (5)', ephemeral: true });
                    return;
                }

                const limit = limits.find((l) => l.value === modalCollected.customId.split('-')[1]);
                guildData[limit.time] = ms(time);
                guildData[limit.count] = count;
                await GuildModel.updateOne(
                    { id: modalCollected.guildId },
                    {
                        $set: {
                            [`guard.${limit.time}`]: guildData[limit.time],
                            [`guard.${limit.count}`]: guildData[limit.count],
                        },
                    },
                    { upsert: true },
                );

                modalCollected.message.edit({
                    embeds: [
                        new EmbedBuilder({
                            color: client.utils.getRandomColor(),
                            author: {
                                name: modalCollected.user.username,
                                icon_url: modalCollected.user.displayAvatarURL({
                                    forceStatic: true,
                                    size: 4096,
                                }),
                            },
                            description: [
                                `Merhaba ${modalCollected.user} (${inlineCode(
                                    modalCollected.user.id,
                                )}) koruma botu limit menüsüne hoşgeldin,\n`,
                                codeBlock(
                                    'yaml',
                                    [
                                        `# ${modalCollected.guild.name} Sunucusunun Koruma Sistemi (Sistem Durumu: )`,
                                        limits
                                            .map(
                                                (l) =>
                                                    `→ ${l.name}: ${ms(
                                                        guildData[l.time] || client.config.DEFAULTS.LIMIT.TIME,
                                                    )} süre içinde ${
                                                        guildData[l.count] || client.config.DEFAULTS.LIMIT.COUNT
                                                    }`,
                                            )
                                            .join('\n'),
                                    ].join('\n'),
                                ),
                            ].join('\n'),
                        }),
                    ],
                });

                await modalCollected.reply({
                    content: 'Limit ayarları başarıyla güncellendi!',
                    ephemeral: true,
                });
            }
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                const row = new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            custom_id: 'button-end',
                            label: 'Mesajın Geçerlilik Süresi Doldu.',
                            emoji: { name: '⏱️' },
                            style: ButtonStyle.Danger,
                            disabled: true,
                        }),
                    ],
                });

                question.edit({ components: [row] });
            }
        });
    },
};

export default Limit;
