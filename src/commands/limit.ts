import { GuildModel } from '@/models';
import {
    ActionRowBuilder,
    ComponentType,
    EmbedBuilder,
    Interaction,
    ModalBuilder,
    StringSelectMenuBuilder,
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
                                                guildData.settings[l.time] || client.config.DEFAULTS.LIMIT.TIME,
                                            )} süre içinde ${
                                                guildData.settings[l.count] || client.config.DEFAULTS.LIMIT.COUNT
                                            }`,
                                    )
                                    .join('\n'),
                            ].join('\n'),
                        ),
                    ].join('\n'),
                ),
            ],
            components: [row],
        });

        const collected = await question.awaitMessageComponent({
            filter: (i: Interaction) => i.user.id === message.author.id && i.isStringSelectMenu(),
            componentType: ComponentType.StringSelect,
            time: 1000 * 60 * 3,
        });
        if (collected) {
            const limit = limits.find((l) => l.value === collected.values[0]);

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

            await collected.showModal(modal);

            const modalCollected = collected.awaitModalSubmit({
                filter: (i) => i.user.id === message.author.id,
                time: 1000 * 60 * 5
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
                guildData.settings[limit.time] = ms(time);
                guildData.settings[limit.count] = count;
                await GuildModel.updateOne(
                    { id: modalCollected.guildId },
                    {
                        $set: {
                            [`settings.guard.${limit.time}`]: guildData.settings[limit.time],
                            [`settings.guard.${limit.count}`]: guildData.settings[limit.count],
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
            }
        } else question.delete();
    },
};

export default Limit;
