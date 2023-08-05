import { SafeFlags } from '@/enums';
import { GuildModel, ISafe } from '@/models';
import { Client } from '@/structures';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    Interaction,
    MentionableSelectMenuBuilder,
    Message,
    Role,
    StringSelectMenuBuilder,
    codeBlock,
    inlineCode,
} from 'discord.js';

const titles = {
    FULL: {
        name: 'Full',
        description: 'Her şey serbesttir.',
    },
    GENERAL: {
        name: 'Sunucu Ayarları',
        description: 'Sınırlı sunucu ayarı işlemi.',
    },
    ROLE: {
        name: 'Rol',
        description: 'Sınırlı rol işlemi.',
    },
    CHANNEL: {
        name: 'Kanal',
        description: 'Sınırlı rol işlemi.',
    },
    EMOJI: {
        name: 'Emoji',
        description: 'Sınırlı emoji işlemi.',
    },
    STICKER: {
        name: 'Çıkartma',
        description: 'Sınırlı çıkartma işlemi.',
    },
    BAN_KICK: {
        name: 'Yasaklama & Atma',
        description: 'Sınırlı yasaklama & atma işlemi.',
    },
};

const Safe: Guard.ICommand = {
    usages: ['safe', 'güvenli'],
    execute: async ({ client, message }) => {
        const firstSafes = Array.from(client.safes).map((s) => ({
            id: s[0],
            allow: s[1],
        }));

        const question = await message.channel.send({
            content: 'Yapacağınız işlemi aşağıdan seçin.',
            components: createComponents(message, firstSafes),
        });

        const filter = (i: Interaction) => i.user.id === message.author.id && (i.isButton() || i.isStringSelectMenu());
        const collector = await question.createMessageComponentCollector({
            filter,
            time: 1000 * 60 * 5,
        });

        collector.on('collect', async (i: Interaction) => {
            if (i.isButton() && i.customId === 'add') {
                const targetRow = new ActionRowBuilder<MentionableSelectMenuBuilder>({
                    components: [
                        new MentionableSelectMenuBuilder({
                            custom_id: 'target',
                            max_values: 25 - client.safes.size,
                            placeholder: 'Rol veya kullanıcı ara...',
                        }),
                    ],
                });

                i.reply({
                    content: 'Eklenecek kullanıcı(ları) veya rol(leri) seç.',
                    components: [targetRow],
                    ephemeral: true,
                });

                const interactionMessage = await i.fetchReply();
                const targetCollected = await interactionMessage.awaitMessageComponent({
                    time: 1000 * 60 * 5,
                    componentType: ComponentType.MentionableSelect,
                });
                if (targetCollected) {
                    targetCollected.deferUpdate();

                    const titleKeys = Object.keys(titles);
                    const typeRow = new ActionRowBuilder<StringSelectMenuBuilder>({
                        components: [
                            new StringSelectMenuBuilder({
                                custom_id: 'type',
                                placeholder: 'İzin seçilmemiş!',
                                max_values: titleKeys.length,
                                options: titleKeys.map((key) => ({
                                    label: titles[key].name,
                                    value: key,
                                    description: titles[key].description,
                                })),
                            }),
                        ],
                    });

                    i.editReply({
                        content: 'Aşağıdaki menüden izinleri belirtin.',
                        components: [typeRow],
                    });

                    const typeCollected = await interactionMessage.awaitMessageComponent({
                        time: 1000 * 60 * 5,
                        componentType: ComponentType.StringSelect,
                    });
                    if (typeCollected) {
                        typeCollected.deferUpdate();

                        const addeds: string[] = [];
                        for (const value of targetCollected.values) {
                            addeds.push(
                                message.guild.roles.cache.get(value)?.name ||
                                    message.guild.members.cache.get(value)!.user.displayName,
                            );

                            const safe = client.safes.get(value);
                            const flags = (
                                typeCollected.values.includes(SafeFlags.Full) ? [SafeFlags.Full] : typeCollected.values
                            ) as SafeFlags[];
                            if (!safe) client.safes.set(value, flags);
                            else {
                                if ([...safe, ...flags].includes(SafeFlags.Full))
                                    client.safes.set(value, [SafeFlags.Full]);
                                else safe.push(...flags);
                            }
                        }

                        const safes = Array.from(client.safes).map((s) => ({
                            id: s[0],
                            allow: s[1],
                        }));

                        question.edit({ components: createComponents(message, safes) });

                        i.editReply({
                            content: `Başarıyla ${addeds
                                .map((d) => inlineCode(d))
                                .join(', ')} güvenlileri listeye eklendi!`,
                            components: [],
                        });

                        await GuildModel.updateOne(
                            { id: message.guildId },
                            { $set: { 'guard.safes': safes } },
                            { upsert: true },
                        );
                    } else i.deleteReply();
                } else i.deleteReply();
            }

            if (i.isStringSelectMenu() && i.customId === 'remove') {
                const deleteds: string[] = [];
                for (const value of i.values) {
                    deleteds.push(
                        message.guild.roles.cache.get(value)?.name ||
                            message.guild.members.cache.get(value)!.user!.displayName,
                    );
                    client.safes.delete(value);
                }

                const safes = Array.from(client.safes).map((s) => ({
                    id: s[0],
                    allow: s[1],
                }));

                question.edit({ components: createComponents(message, safes) });

                i.reply({
                    content: `Başarıyla ${deleteds
                        .map((d) => inlineCode(d))
                        .join(', ')} güvenlileri listeden çıkarıldı!`,
                    ephemeral: true,
                });

                await GuildModel.updateOne(
                    { id: message.guildId },
                    { $set: { 'guard.safes': safes } },
                    { upsert: true },
                );
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

export default Safe;

function createComponents(message: Message, safes: ISafe[]) {
    const list = safes.filter((s) => message.guild.roles.cache.has(s.id) || message.guild.members.cache.has(s.id));
    return [
        new ActionRowBuilder<StringSelectMenuBuilder>({
            components: [
                new StringSelectMenuBuilder({
                    custom_id: 'remove',
                    disabled: !list.length,
                    maxValues: list.length === 0 ? 1 : list.length,
                    placeholder: 'Güvenli Liste',
                    options: list.length
                        ? list.map((s) => ({
                              label:
                                  message.guild.roles.cache.get(s.id)?.name ||
                                  message.guild.members.cache.get(s.id)!.user!.displayName,
                              value: s.id,
                              description: s.allow.map((p) => titles[p].name).join(', '),
                              emoji: {
                                  id: '1135214115804172338',
                              },
                          }))
                        : [{ label: 'a', value: 'b' }],
                }),
            ],
        }),
        new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    custom_id: 'add',
                    disabled: safes.length >= 25,
                    label: 'Ekle',
                    style: ButtonStyle.Success,
                }),
            ],
        }),
    ];
}
